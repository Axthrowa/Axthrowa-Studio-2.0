//! "Hareket" geçişi (OBS'teki üçüncü taraf Move eklentisinin işlevsel karşılığı; kodu kullanılmadı): iki sahnede aynı
//! kaynağı gösteren öğeler konum, ölçek, açı, sınır ve kırpmayla eski yerinden yenisine kayar. Geçiş anında özel bir
//! ara sahne kurulur ve programa alınır; öğeler ayrı bir iş parçacığında (≈60 Hz, yumuşak eğri) ara değerlere taşınır,
//! eşleşmeyen öğeler yarı noktada değişir. Bitince program hedef sahneye (ya da Studio Mode kopyasına) bırakılır.
//! Başka bir geçiş başlarsa hareket iptal edilir. Kısıtlar: grup içeren sahnelerde ve hizalama/sınır türü farklı
//! eşleşmelerde kayma yapılmaz (grup varsa yumuşak geçişe düşülür, uyumsuz eşleşme yarı noktada değişir).

use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use crate::motor::Motor;
use crate::obs::{api, cs, Kirp, Ptr, Vec2};

/// Panelin gördüğü geçiş türü kimliği; motor altında yumuşak geçiş nesnesi (T-bar ve özellikler için) tutulur
pub const TUR: &str = "hareket";
pub const AD: &str = "Hareket (eşleşen öğeler kayar)";

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Durum {
  pub konum: Vec2,
  pub olcek: Vec2,
  pub aci: f32,
  pub sinir: Vec2,
  pub sinir_turu: i32,
  pub hizalama: u32,
  pub sinir_hizalama: u32,
  pub kirp: Kirp,
}

impl Durum {
  fn oku(o: Ptr) -> Durum {
    let a = api();
    let (mut konum, mut olcek, mut sinir, mut kirp) = (Vec2::default(), Vec2::default(), Vec2::default(), Kirp::default());
    unsafe {
      (a.obs_sceneitem_get_pos)(o, &mut konum);
      (a.obs_sceneitem_get_scale)(o, &mut olcek);
      (a.obs_sceneitem_get_bounds)(o, &mut sinir);
      (a.obs_sceneitem_get_crop)(o, &mut kirp);
      Durum {
        konum,
        olcek,
        aci: (a.obs_sceneitem_get_rot)(o),
        sinir,
        sinir_turu: (a.obs_sceneitem_get_bounds_type)(o),
        hizalama: (a.obs_sceneitem_get_alignment)(o),
        sinir_hizalama: (a.obs_sceneitem_get_bounds_alignment)(o),
        kirp,
      }
    }
  }

  fn uygula(&self, o: Ptr) {
    let a = api();
    unsafe {
      (a.obs_sceneitem_set_alignment)(o, self.hizalama);
      (a.obs_sceneitem_set_bounds_type)(o, self.sinir_turu);
      (a.obs_sceneitem_set_bounds_alignment)(o, self.sinir_hizalama);
      (a.obs_sceneitem_set_bounds)(o, &self.sinir);
      (a.obs_sceneitem_set_scale)(o, &self.olcek);
      (a.obs_sceneitem_set_rot)(o, self.aci);
      (a.obs_sceneitem_set_crop)(o, &self.kirp);
      (a.obs_sceneitem_set_pos)(o, &self.konum);
    }
  }

  /// Aynı temsilde mi (hizalama ve sınır türü aynı): yalnız o zaman değerler doğrudan ara değerlenir
  pub fn uyumlu(&self, b: &Durum) -> bool {
    self.sinir_turu == b.sinir_turu && self.hizalama == b.hizalama && self.sinir_hizalama == b.sinir_hizalama
  }
}

/// Yumuşak başla-bitir (kübik)
pub fn egri(t: f32) -> f32 {
  let t = t.clamp(0.0, 1.0);
  if t < 0.5 {
    4.0 * t * t * t
  } else {
    1.0 - (-2.0 * t + 2.0).powi(3) / 2.0
  }
}

/// `a`dan `b`ye `e` (0–1) oranında ara durum; açı en kısa yönden döner
pub fn ara(a: &Durum, b: &Durum, e: f32) -> Durum {
  let l = |x: f32, y: f32| x + (y - x) * e;
  let v = |p: Vec2, q: Vec2| Vec2 { x: l(p.x, q.x), y: l(p.y, q.y) };
  let fark = ((b.aci - a.aci + 540.0).rem_euclid(360.0)) - 180.0;
  let k = |x: i32, y: i32| (x as f32 + (y - x) as f32 * e).round() as i32;
  Durum {
    konum: v(a.konum, b.konum),
    olcek: v(a.olcek, b.olcek),
    aci: a.aci + fark * e,
    sinir: v(a.sinir, b.sinir),
    kirp: Kirp { sol: k(a.kirp.sol, b.kirp.sol), ust: k(a.kirp.ust, b.kirp.ust), sag: k(a.kirp.sag, b.kirp.sag), alt: k(a.kirp.alt, b.kirp.alt) },
    ..*b
  }
}

enum Rol {
  /// Eşleşti: başlangıçtan bitişe kayar
  Kayan(Durum, Durum),
  /// Yalnız hedefte: yarı noktada görünür
  Gelen,
  /// Yalnız eski programda: yarı noktada gizlenir
  Giden,
}

/// İş parçacığına geçen libobs işaretçileri (başvuruları iş parçacığı bırakır)
struct Is {
  ogeler: Vec<(Ptr, Rol)>,
  ara_sahne: Ptr,
  gecis: Ptr,
  hedef: Ptr,
  sure: Duration,
  durum: Arc<Mutex<HareketDurumu>>,
}
unsafe impl Send for Is {}

#[derive(Default)]
pub struct HareketDurumu {
  pub iptal: bool,
  pub bitti: bool,
}

pub struct Hareket {
  pub durum: Arc<Mutex<HareketDurumu>>,
  pub is: Option<std::thread::JoinHandle<()>>,
  /// Ara sahnenin kaynağı ve hedef sahnenin kimliği (program sorgusu hedefi göstersin)
  pub ara_kaynak: Ptr,
  pub hedef_kimlik: String,
}

fn calistir(is: Is) {
  let a = api();
  let bas = Instant::now();
  let mut yarida = false;
  loop {
    if is.durum.lock().map(|d| d.iptal).unwrap_or(true) {
      break;
    }
    let t = (bas.elapsed().as_secs_f32() / is.sure.as_secs_f32().max(0.001)).min(1.0);
    let e = egri(t);
    for (o, rol) in &is.ogeler {
      if let Rol::Kayan(x, y) = rol {
        ara(x, y, e).uygula(*o);
      }
    }
    if !yarida && t >= 0.5 {
      yarida = true;
      for (o, rol) in &is.ogeler {
        match rol {
          Rol::Gelen => unsafe {
            (a.obs_sceneitem_set_visible)(*o, true);
          },
          Rol::Giden => unsafe {
            (a.obs_sceneitem_set_visible)(*o, false);
          },
          Rol::Kayan(..) => {}
        }
      }
    }
    if t >= 1.0 {
      // Bitiş: başka bir geçiş başlamadıysa program hedefe bırakılır (kilit altında: iptalle yarışmaz)
      if let Ok(mut d) = is.durum.lock() {
        if !d.iptal {
          unsafe { (a.obs_transition_set)(is.gecis, is.hedef) };
        }
        d.bitti = true;
      }
      break;
    }
    std::thread::sleep(Duration::from_millis(16));
  }
  if let Ok(mut d) = is.durum.lock() {
    d.bitti = true;
  }
  unsafe {
    (a.obs_source_release)(is.hedef);
    (a.obs_source_release)(is.gecis);
    (a.obs_scene_release)(is.ara_sahne);
  }
}

impl Motor {
  /// Tuvaldeki hareketi iptal eder ve iş parçacığının bitmesini bekler (en çok bir adım)
  pub(crate) fn hareketi_iptal(&mut self, tuval: &str) {
    if let Some(mut h) = self.hareketler.remove(tuval) {
      if let Ok(mut d) = h.durum.lock() {
        d.iptal = true;
      }
      if let Some(j) = h.is.take() {
        let _ = j.join();
      }
    }
  }

  pub(crate) fn hareketleri_iptal(&mut self) {
    let hepsi: Vec<String> = self.hareketler.keys().cloned().collect();
    for t in hepsi {
      self.hareketi_iptal(&t);
    }
  }

  /// Programdaki sahnenin (ara sahne dahil) en üstteki öğesinin konumu — sınama için (önizleme karesi gecikmesinden
  /// bağımsız okuma)
  pub(crate) fn program_ust_oge_konumu(&self, tuval: &str) -> Option<Vec2> {
    let a = api();
    let g = self.gecisler.get(tuval)?;
    let etkin = unsafe { (a.obs_transition_get_active_source)(g.ptr) };
    if etkin.is_null() {
      return None;
    }
    let sahne = unsafe { (a.obs_scene_from_source)(etkin) };
    let konum = (!sahne.is_null())
      .then(|| crate::sahne::sahne_ogeleri_ham(sahne).last().map(|o| Durum::oku(*o).konum))
      .flatten();
    unsafe { (a.obs_source_release)(etkin) };
    konum
  }

  /// Süren hareketin ara sahnesi hedef sahne kimliğiyle görünür
  pub(crate) fn hareket_hedefi(&self, kaynak: Ptr) -> Option<String> {
    self
      .hareketler
      .values()
      .find(|h| h.ara_kaynak == kaynak && h.durum.lock().map(|d| !d.bitti).unwrap_or(false))
      .map(|h| h.hedef_kimlik.clone())
  }

  /// Hareket geçişini başlatır. `hedef_kaynak`: bitince programa alınacak sahne kaynağı (asıl ya da Studio Mode
  /// kopyası; öğeleri ondan okunur). Dönüş: hareket başladı mı (değilse çağıran düz geçiş yapar).
  pub(crate) fn hareket_baslat(&mut self, tuval: &str, hedef_kaynak: Ptr, hedef_kimlik: &str, sure_ms: u32) -> Result<bool, String> {
    let a = api();
    let hedef_sahne = unsafe { (a.obs_scene_from_source)(hedef_kaynak) };
    if hedef_sahne.is_null() {
      return Ok(false);
    }
    let tr = self.gecis_hazirla(tuval)?;
    self.hareketi_iptal(tuval);
    let etkin = unsafe { (a.obs_transition_get_active_source)(tr) };
    if etkin.is_null() {
      return Ok(false);
    }
    let eski_sahne = unsafe { (a.obs_scene_from_source)(etkin) };
    unsafe { (a.obs_source_release)(etkin) };
    if eski_sahne.is_null() || eski_sahne == hedef_sahne {
      return Ok(false);
    }
    let eski: Vec<Ptr> = crate::sahne::sahne_ogeleri_ham(eski_sahne);
    let yeni: Vec<Ptr> = crate::sahne::sahne_ogeleri_ham(hedef_sahne);
    if eski.iter().chain(yeni.iter()).any(|o| unsafe { (a.obs_sceneitem_is_group)(*o) }) {
      return Ok(false);
    }
    let gorunur = |o: &Ptr| unsafe { (a.obs_sceneitem_visible)(*o) };
    let kaynak = |o: &Ptr| unsafe { (a.obs_sceneitem_get_source)(*o) };
    let mut kullanildi = vec![false; eski.len()];
    // Hedef sırasıyla: eşleşen eski öğe (aynı kaynak, görünür, ilk kullanılmamış)
    let mut plan: Vec<(Ptr, Option<usize>)> = Vec::new();
    for o in yeni.iter().filter(|o| gorunur(o)) {
      let es = (0..eski.len()).find(|&i| !kullanildi[i] && gorunur(&eski[i]) && kaynak(&eski[i]) == kaynak(o));
      if let Some(i) = es {
        kullanildi[i] = true;
      }
      plan.push((*o, es));
    }
    let ad = cs(&format!("Hareket ({tuval})"));
    let ara_sahne = unsafe { (a.obs_scene_create_private)(ad.as_ptr()) };
    if ara_sahne.is_null() {
      return Ok(false);
    }
    let kopyala = |kaynak_oge: Ptr, yeni_oge: Ptr| unsafe {
      (a.obs_sceneitem_set_scale_filter)(yeni_oge, (a.obs_sceneitem_get_scale_filter)(kaynak_oge));
      (a.obs_sceneitem_set_blending_mode)(yeni_oge, (a.obs_sceneitem_get_blending_mode)(kaynak_oge));
      (a.obs_sceneitem_set_blending_method)(yeni_oge, (a.obs_sceneitem_get_blending_method)(kaynak_oge));
    };
    let mut ogeler: Vec<(Ptr, Rol)> = Vec::new();
    // Yalnız eski programda olanlar en altta, eski yerlerinde; yarıda gizlenir
    for (i, o) in eski.iter().enumerate() {
      if kullanildi[i] || !gorunur(o) {
        continue;
      }
      let y = unsafe { (a.obs_scene_add)(ara_sahne, kaynak(o)) };
      if y.is_null() {
        continue;
      }
      Durum::oku(*o).uygula(y);
      kopyala(*o, y);
      ogeler.push((y, Rol::Giden));
    }
    for (o, es) in plan {
      let y = unsafe { (a.obs_scene_add)(ara_sahne, kaynak(&o)) };
      if y.is_null() {
        continue;
      }
      let son = Durum::oku(o);
      kopyala(o, y);
      match es.map(|i| Durum::oku(eski[i])) {
        Some(bas) if bas.uyumlu(&son) => {
          bas.uygula(y);
          ogeler.push((y, Rol::Kayan(bas, son)));
        }
        // Uyumsuz eşleşme: eski görünüm yarıda yenisine geçer
        Some(bas) => {
          son.uygula(y);
          unsafe { (a.obs_sceneitem_set_visible)(y, false) };
          let g = unsafe { (a.obs_scene_add)(ara_sahne, kaynak(&o)) };
          if !g.is_null() {
            bas.uygula(g);
            kopyala(o, g);
            ogeler.push((g, Rol::Giden));
          }
          ogeler.push((y, Rol::Gelen));
        }
        None => {
          son.uygula(y);
          unsafe { (a.obs_sceneitem_set_visible)(y, false) };
          ogeler.push((y, Rol::Gelen));
        }
      }
    }
    let ara_kaynak = unsafe { (a.obs_scene_get_source)(ara_sahne) };
    unsafe { (a.obs_transition_set)(tr, ara_kaynak) };
    let durum = Arc::new(Mutex::new(HareketDurumu::default()));
    let is = Is {
      ogeler,
      ara_sahne,
      gecis: unsafe { (a.obs_source_get_ref)(tr) },
      hedef: unsafe { (a.obs_source_get_ref)(hedef_kaynak) },
      sure: Duration::from_millis(sure_ms.max(1) as u64),
      durum: Arc::clone(&durum),
    };
    let j = std::thread::Builder::new().name(format!("hareket-{tuval}")).spawn(move || calistir(is)).map_err(|e| e.to_string())?;
    self.hareketler.insert(tuval.into(), Hareket { durum, is: Some(j), ara_kaynak, hedef_kimlik: hedef_kimlik.into() });
    Ok(true)
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  fn d(x: f32, aci: f32) -> Durum {
    Durum {
      konum: Vec2 { x, y: 0.0 },
      olcek: Vec2 { x: 1.0, y: 1.0 },
      aci,
      sinir: Vec2::default(),
      sinir_turu: 0,
      hizalama: 5,
      sinir_hizalama: 0,
      kirp: Kirp::default(),
    }
  }

  #[test]
  fn egri_uclar_ve_simetri() {
    assert_eq!((egri(0.0), egri(1.0), egri(0.5)), (0.0, 1.0, 0.5));
    assert!((egri(0.25) + egri(0.75) - 1.0).abs() < 1e-6);
    assert_eq!(egri(-1.0), 0.0);
  }

  #[test]
  fn ara_deger_ve_en_kisa_aci() {
    let m = ara(&d(0.0, 350.0), &d(100.0, 10.0), 0.5);
    assert_eq!(m.konum.x, 50.0);
    assert!((m.aci - 360.0).abs() < 1e-4, "350° → 10° en kısa yoldan (+20°): {}", m.aci);
    assert!(d(0.0, 0.0).uyumlu(&d(1.0, 0.0)));
    assert!(!d(0.0, 0.0).uyumlu(&Durum { hizalama: 0, ..d(0.0, 0.0) }));
  }
}
