//! libobs "UI görevleri" (`obs_queue_task(OBS_TASK_UI, …)`). OBS Studio'da bu görevleri arayüz iş parçacığı çalıştırır;
//! başsız motorda işleyici yoksa libobs görevi kuyruğa koyamaz ("no UI task handler") ve `wait` isteyen çağıran
//! sonsuza dek bekler (ör. kayıt dosyasını elle bölmek). Burada tek bir iş parçacığı görevleri sırayla çalıştırır;
//! `wait` istenirse çağıran görev bitene dek bekler — OBS'in arayüz iş parçacığıyla aynı anlam.

use std::sync::mpsc::{channel, Sender};
use std::sync::{Arc, Condvar, Mutex, OnceLock};

use crate::obs::{api, Ptr};

pub type Gorev = unsafe extern "C" fn(param: Ptr);
pub type Isleyici = unsafe extern "C" fn(gorev: Gorev, param: Ptr, bekle: bool);

type Bitti = Arc<(Mutex<bool>, Condvar)>;
struct Is {
  gorev: Gorev,
  param: usize,
  bitti: Option<Bitti>,
}

static KUYRUK: OnceLock<Mutex<Sender<Is>>> = OnceLock::new();

unsafe extern "C" fn isleyici(gorev: Gorev, param: Ptr, bekle: bool) {
  let Some(k) = KUYRUK.get() else {
    // Kurulmadan çağrılırsa (olmamalı) çağıranın iş parçacığında çalıştır
    gorev(param);
    return;
  };
  let bitti: Option<Bitti> = bekle.then(|| Arc::new((Mutex::new(false), Condvar::new())));
  let gonderildi = k.lock().map(|s| s.send(Is { gorev, param: param as usize, bitti: bitti.clone() }).is_ok()).unwrap_or(false);
  if !gonderildi {
    gorev(param);
    return;
  }
  if let Some(b) = bitti {
    let (m, c) = &*b;
    let mut tamam = m.lock().unwrap_or_else(|e| e.into_inner());
    while !*tamam {
      tamam = c.wait(tamam).unwrap_or_else(|e| e.into_inner());
    }
  }
}

/// İş parçacığını başlatır ve libobs'a işleyici olarak kaydeder (motor açılışında bir kez).
pub fn kur() {
  if KUYRUK.get().is_some() {
    return;
  }
  let (tx, rx) = channel::<Is>();
  if KUYRUK.set(Mutex::new(tx)).is_err() {
    return;
  }
  let _ = std::thread::Builder::new().name("obs-ui-gorev".into()).spawn(move || {
    for is in rx {
      unsafe { (is.gorev)(is.param as Ptr) };
      if let Some(b) = is.bitti {
        let (m, c) = &*b;
        *m.lock().unwrap_or_else(|e| e.into_inner()) = true;
        c.notify_all();
      }
    }
  });
  unsafe { (api().obs_set_ui_task_handler)(Some(isleyici)) };
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::sync::atomic::{AtomicUsize, Ordering};

  static SAYAC: AtomicUsize = AtomicUsize::new(0);
  unsafe extern "C" fn artir(p: Ptr) {
    SAYAC.fetch_add(p as usize, Ordering::SeqCst);
  }

  #[test]
  fn bekleyen_gorev_dondugunde_calismis_olur() {
    // Kayıt (libobs'a) olmadan kuyruk mantığı: iş parçacığı + bekleme
    let (tx, rx) = channel::<Is>();
    let _ = KUYRUK.set(Mutex::new(tx));
    std::thread::spawn(move || {
      for is in rx {
        unsafe { (is.gorev)(is.param as Ptr) };
        if let Some(b) = is.bitti {
          let (m, c) = &*b;
          *m.lock().unwrap() = true;
          c.notify_all();
        }
      }
    });
    unsafe { isleyici(artir, 5 as Ptr, true) };
    assert_eq!(SAYAC.load(Ordering::SeqCst), 5);
  }
}
