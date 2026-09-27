//! Ses mikseri çekirdeği: kaynak başına ses ölçer (tepe + ortalama/RMS, dB), denge, mono, senkron kaydırma, izleme
//! (monitoring) ve medya denetimi.
//!
//! Ölçer geri çağrısı libobs'un ses iş parçacığında çalışır; kompozitörü ya da ses işlemeyi bekletmemek için hiçbir
//! kilit tutmaz — son değerler atomik hücrelere yazılır. Ayrı bir iş parçacığı yalnız abone varken (panel mikseri
//! açıkken) 20 Hz'de hücreleri okuyup tek bir `seviyeler` olayı gönderir.

use std::collections::BTreeMap;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::mpsc::Sender;
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::Duration;

use serde::Serialize;

use crate::motor::{Motor, Olay};
use crate::obs::{self, api, cs, cstr, Ptr};

/// Son ölçüm (dB, f32 bitleri): [tepe sol, tepe sağ, ortalama sol, ortalama sağ]
#[derive(Default)]
pub struct Hucre([AtomicU32; 4]);

impl Hucre {
  fn yaz(&self, i: usize, db: f32) {
    self.0[i].store(db.to_bits(), Ordering::Relaxed);
  }
  fn oku(&self, i: usize) -> f32 {
    f32::from_bits(self.0[i].load(Ordering::Relaxed))
  }
}

pub struct Olcer {
  ptr: Ptr,
  hucre: *const Hucre,
}

#[derive(Default)]
pub struct SesDurumu {
  pub(crate) olcerler: BTreeMap<String, Olcer>,
  /// İş parçacığıyla paylaşılan hücreler (kaynak kimliği → hücre)
  pub(crate) hucreler: Arc<Mutex<BTreeMap<String, Arc<Hucre>>>>,
  pub(crate) abone: Arc<AtomicBool>,
  pub(crate) dur: Arc<AtomicBool>,
  pub(crate) is: Option<JoinHandle<()>>,
}

#[derive(Clone, Debug, Serialize, PartialEq)]
pub struct Seviye {
  pub id: String,
  /// dB, sol/sağ; sessizlikte -inf yerine -144 (JSON sonsuz taşımaz)
  pub tepe: [f32; 2],
  pub ortalama: [f32; 2],
}

#[derive(Clone, Debug, Serialize)]
pub struct SesBilgisi {
  pub id: String,
  pub ad: String,
  /// Doğrusal çarpan (0–?); arayüz dB'ye çevirir
  pub ses: f32,
  pub sessiz: bool,
  pub denge: f32,
  pub mono: bool,
  pub senkron_ms: i64,
  /// 0 kapalı, 1 yalnız izle, 2 izle ve çıkışa ver
  pub izleme: i32,
  pub izler: u32,
  /// Medya kaynağıysa durumu (yoksa None)
  pub medya: Option<MedyaDurumu>,
}

#[derive(Clone, Debug, Serialize)]
pub struct MedyaDurumu {
  pub durum: &'static str,
  pub sure_ms: i64,
  pub zaman_ms: i64,
}

#[derive(Clone, Debug, Serialize)]
pub struct Aygit {
  pub ad: String,
  pub id: String,
}

pub const SESSIZLIK_DB: f32 = -144.0;

fn db_temizle(v: f32) -> f32 {
  if v.is_finite() {
    v.max(SESSIZLIK_DB)
  } else {
    SESSIZLIK_DB
  }
}

unsafe extern "C" fn olcer_cb(param: Ptr, magnitude: *const f32, peak: *const f32, _giris: *const f32) {
  let Some(h) = (param as *const Hucre).as_ref() else { return };
  if magnitude.is_null() || peak.is_null() {
    return;
  }
  let m = std::slice::from_raw_parts(magnitude, obs::MAX_AUDIO_CHANNELS);
  let p = std::slice::from_raw_parts(peak, obs::MAX_AUDIO_CHANNELS);
  // Tek kanallı kaynakta ikinci kanal sessizlik (libobs doldurmaz); arayüz iki kanalı aynı gösterebilir
  h.yaz(0, db_temizle(p[0]));
  h.yaz(1, db_temizle(if p[1].is_finite() { p[1] } else { p[0] }));
  h.yaz(2, db_temizle(m[0]));
  h.yaz(3, db_temizle(if m[1].is_finite() { m[1] } else { m[0] }));
}

/// Hücrelerden anlık görüntü (sıralı)
pub fn seviyeleri_oku(h: &BTreeMap<String, Arc<Hucre>>) -> Vec<Seviye> {
  h.iter()
    .map(|(id, c)| Seviye { id: id.clone(), tepe: [c.oku(0), c.oku(1)], ortalama: [c.oku(2), c.oku(3)] })
    .collect()
}

const MEDYA_DURUMLARI: [&str; 8] = ["yok", "oynuyor", "aciliyor", "tamponlaniyor", "duraklatildi", "durdu", "bitti", "hata"];

impl SesDurumu {
  /// Seviye yayını iş parçacığı: yalnız abone varken 20 Hz'de tek olay.
  pub fn baslat(&mut self, olay: Sender<Olay>) {
    let (hucreler, abone, dur) = (self.hucreler.clone(), self.abone.clone(), self.dur.clone());
    self.is = Some(std::thread::spawn(move || {
      while !dur.load(Ordering::Relaxed) {
        std::thread::sleep(Duration::from_millis(50));
        if !abone.load(Ordering::Relaxed) {
          continue;
        }
        let v = match hucreler.lock() {
          Ok(h) => seviyeleri_oku(&h),
          Err(_) => continue,
        };
        if !v.is_empty() && olay.send(Olay::Seviyeler { seviyeler: v }).is_err() {
          break;
        }
      }
    }));
  }
}

impl Motor {
  /// Ses çıkışı olan kaynağa ölçer bağlar (yoksa hiçbir şey yapmaz).
  pub(crate) fn olcer_bagla(&mut self, id: &str) {
    let Some(&k) = self.kaynaklar.get(id) else { return };
    if self.ses.olcerler.contains_key(id) || unsafe { (api().obs_source_get_output_flags)(k) } & obs::OBS_SOURCE_AUDIO == 0 {
      return;
    }
    let a = api();
    let vm = unsafe { (a.obs_volmeter_create)(obs::OBS_FADER_LOG) };
    if vm.is_null() {
      return;
    }
    let hucre = Arc::new(Hucre::default());
    for i in 0..4 {
      hucre.yaz(i, SESSIZLIK_DB);
    }
    let ham = Arc::into_raw(hucre.clone());
    unsafe {
      (a.obs_volmeter_add_callback)(vm, olcer_cb, ham as Ptr);
      if !(a.obs_volmeter_attach_source)(vm, k) {
        (a.obs_volmeter_remove_callback)(vm, olcer_cb, ham as Ptr);
        (a.obs_volmeter_destroy)(vm);
        drop(Arc::from_raw(ham));
        return;
      }
    }
    if let Ok(mut h) = self.ses.hucreler.lock() {
      h.insert(id.to_string(), hucre);
    }
    self.ses.olcerler.insert(id.to_string(), Olcer { ptr: vm, hucre: ham });
  }

  pub(crate) fn olcer_birak(&mut self, id: &str) {
    if let Some(o) = self.ses.olcerler.remove(id) {
      let a = api();
      unsafe {
        (a.obs_volmeter_remove_callback)(o.ptr, olcer_cb, o.hucre as Ptr);
        (a.obs_volmeter_detach_source)(o.ptr);
        (a.obs_volmeter_destroy)(o.ptr);
        drop(Arc::from_raw(o.hucre));
      }
    }
    if let Ok(mut h) = self.ses.hucreler.lock() {
      h.remove(id);
    }
  }

  pub fn seviye_abone(&self, acik: bool) {
    self.ses.abone.store(acik, Ordering::Relaxed);
  }

  /// Anlık seviyeler (olay beklemeden; sınama ve tek seferlik okuma için)
  pub fn seviyeler(&self) -> Vec<Seviye> {
    self.ses.hucreler.lock().map(|h| seviyeleri_oku(&h)).unwrap_or_default()
  }

  fn kaynak_ptr(&self, id: &str) -> Result<Ptr, String> {
    self.kaynaklar.get(id).copied().ok_or_else(|| format!("kaynak yok: {id}"))
  }

  pub fn kaynak_denge(&mut self, id: &str, denge: f32) -> Result<(), String> {
    if !(0.0..=1.0).contains(&denge) {
      return Err("denge 0 (sol) – 1 (sağ) olmalı".into());
    }
    unsafe { (api().obs_source_set_balance_value)(self.kaynak_ptr(id)?, denge) };
    Ok(())
  }

  pub fn kaynak_mono(&mut self, id: &str, acik: bool) -> Result<(), String> {
    let k = self.kaynak_ptr(id)?;
    unsafe {
      let b = (api().obs_source_get_flags)(k);
      let yeni = if acik { b | obs::OBS_SOURCE_FLAG_FORCE_MONO } else { b & !obs::OBS_SOURCE_FLAG_FORCE_MONO };
      (api().obs_source_set_flags)(k, yeni);
    }
    Ok(())
  }

  /// Senkron kaydırma (ms). OBS'in aralığı: −950 … 20 000 ms.
  pub fn kaynak_senkron(&mut self, id: &str, ms: i64) -> Result<(), String> {
    if !(-950..=20_000).contains(&ms) {
      return Err("senkron kaydırma −950 … 20000 ms olmalı".into());
    }
    unsafe { (api().obs_source_set_sync_offset)(self.kaynak_ptr(id)?, ms * 1_000_000) };
    Ok(())
  }

  pub fn kaynak_izleme(&mut self, id: &str, tur: i32) -> Result<(), String> {
    if !(0..=2).contains(&tur) {
      return Err("izleme 0 (kapalı), 1 (yalnız izle), 2 (izle ve çıkış)".into());
    }
    unsafe { (api().obs_source_set_monitoring_type)(self.kaynak_ptr(id)?, tur) };
    Ok(())
  }

  pub fn medya(&mut self, id: &str, eylem: &str) -> Result<(), String> {
    let k = self.kaynak_ptr(id)?;
    let a = api();
    unsafe {
      match eylem {
        "oynat" => (a.obs_source_media_play_pause)(k, false),
        "duraklat" => (a.obs_source_media_play_pause)(k, true),
        "yeniden" => (a.obs_source_media_restart)(k),
        "durdur" => (a.obs_source_media_stop)(k),
        e => return Err(format!("bilinmeyen medya eylemi: {e}")),
      }
    }
    Ok(())
  }

  /// Ses çıkışı olan kaynakların mikser/gelişmiş ses özellikleri
  pub fn ses_listesi(&self) -> Vec<SesBilgisi> {
    let a = api();
    self
      .kaynaklar
      .iter()
      .filter(|(_, k)| unsafe { (a.obs_source_get_output_flags)(**k) } & obs::OBS_SOURCE_AUDIO != 0)
      .map(|(id, &k)| unsafe {
        let medya_durumu = (a.obs_source_media_get_state)(k);
        let medya = (medya_durumu != 0).then(|| MedyaDurumu {
          durum: MEDYA_DURUMLARI.get(medya_durumu as usize).copied().unwrap_or("yok"),
          sure_ms: (a.obs_source_media_get_duration)(k),
          zaman_ms: (a.obs_source_media_get_time)(k),
        });
        SesBilgisi {
          id: id.clone(),
          ad: cstr((a.obs_source_get_name)(k)),
          ses: (a.obs_source_get_volume)(k),
          sessiz: (a.obs_source_muted)(k),
          denge: (a.obs_source_get_balance_value)(k),
          mono: (a.obs_source_get_flags)(k) & obs::OBS_SOURCE_FLAG_FORCE_MONO != 0,
          senkron_ms: (a.obs_source_get_sync_offset)(k) / 1_000_000,
          izleme: (a.obs_source_get_monitoring_type)(k),
          izler: (a.obs_source_get_audio_mixers)(k),
          medya,
        }
      })
      .collect()
  }

  /// İzleme aygıtları (ilk öğe "Varsayılan") ve şu an seçili olan
  pub fn izleme_aygitlari(&self) -> (Vec<Aygit>, Aygit) {
    unsafe extern "C" fn topla(data: Ptr, ad: *const std::ffi::c_char, id: *const std::ffi::c_char) -> bool {
      if let Some(v) = (data as *mut Vec<Aygit>).as_mut() {
        v.push(Aygit { ad: cstr(ad), id: cstr(id) });
      }
      true
    }
    let a = api();
    let mut v = vec![Aygit { ad: "Varsayılan".into(), id: "default".into() }];
    unsafe { (a.obs_enum_audio_monitoring_devices)(topla, &mut v as *mut Vec<Aygit> as Ptr) };
    let (mut ad, mut id): (*const std::ffi::c_char, *const std::ffi::c_char) = (std::ptr::null(), std::ptr::null());
    unsafe { (a.obs_get_audio_monitoring_device)(&mut ad, &mut id) };
    let secili = unsafe { Aygit { ad: cstr(ad), id: cstr(id) } };
    (v, secili)
  }

  pub fn izleme_aygiti(&mut self, ad: &str, id: &str) -> Result<(), String> {
    let (liste, _) = self.izleme_aygitlari();
    if !liste.iter().any(|x| x.id == id) {
      return Err(format!("izleme aygıtı yok: {id}"));
    }
    if !unsafe { (api().obs_set_audio_monitoring_device)(cs(ad).as_ptr(), cs(id).as_ptr()) } {
      return Err("izleme aygıtı ayarlanamadı".into());
    }
    Ok(())
  }

  pub(crate) fn sesi_kapat(&mut self) {
    self.ses.dur.store(true, Ordering::Relaxed);
    if let Some(is) = self.ses.is.take() {
      let _ = is.join();
    }
    let ids: Vec<String> = self.ses.olcerler.keys().cloned().collect();
    for id in ids {
      self.olcer_birak(&id);
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn hucre_ve_sessizlik() {
    let h = Hucre::default();
    h.yaz(0, -12.5);
    assert_eq!(h.oku(0), -12.5);
    assert_eq!(db_temizle(f32::NEG_INFINITY), SESSIZLIK_DB);
    assert_eq!(db_temizle(f32::NAN), SESSIZLIK_DB);
    assert_eq!(db_temizle(-500.0), SESSIZLIK_DB);
    let mut m = BTreeMap::new();
    m.insert("b".to_string(), Arc::new(Hucre::default()));
    m.insert("a".to_string(), Arc::new(Hucre::default()));
    assert_eq!(seviyeleri_oku(&m).iter().map(|s| s.id.as_str()).collect::<Vec<_>>(), ["a", "b"]);
  }

  #[test]
  fn olcer_geri_cagrisi_kilitsiz_yazar() {
    let h = Hucre::default();
    let mut tepe = [f32::NEG_INFINITY; 8];
    let mut ort = [f32::NEG_INFINITY; 8];
    tepe[0] = -6.0;
    ort[0] = -20.0;
    unsafe { olcer_cb(&h as *const Hucre as Ptr, ort.as_ptr(), tepe.as_ptr(), tepe.as_ptr()) };
    // Tek kanal: sağ kanal sol ile aynı gösterilir
    assert_eq!([h.oku(0), h.oku(1), h.oku(2), h.oku(3)], [-6.0, -6.0, -20.0, -20.0]);
    tepe[1] = -3.0;
    ort[1] = -9.0;
    unsafe { olcer_cb(&h as *const Hucre as Ptr, ort.as_ptr(), tepe.as_ptr(), tepe.as_ptr()) };
    assert_eq!([h.oku(1), h.oku(3)], [-3.0, -9.0]);
  }
}
