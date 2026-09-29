//! Sahne geçişleri ve Studio Mode.
//!
//! Her tuvalin programı doğrudan bir sahne değil, bir **geçiş kaynağıdır** (OBS'teki gibi): kanal 0'da geçiş durur,
//! sahne değişimi `obs_transition_start` ile yapılır. Studio Mode'da önizleme sahnesi ayrı, **özel** bir tuvalde
//! işlenir (libobs `PREVIEW` ön ayarı: kaynakları etkinleştirmez, sesi karıştırmaz); "Geçiş" önizlemedeki sahneyi
//! programa alır.

use serde::Serialize;
use serde_json::{Map, Value};

use crate::motor::{video_bilgisi, Kanvas, Motor};
use crate::obs::{self, api, cs, cstr, Ptr, Veri};

pub struct Gecis {
  pub ptr: Ptr,
  pub tur: String,
  pub sure_ms: u32,
}

pub struct Studyo {
  pub kanvas: Kanvas,
  pub sahne: Option<String>,
  /// T-bar sürükleniyor: (eski program, hedef) — bırakılınca ya hedefe tamamlanır ya eskiye döner
  pub tbar: Option<(String, String)>,
}

/// T-bar uçlara bu kadar yakın bırakılırsa geçiş tamamlanır / geri alınır
const TBAR_UC: f32 = 0.02;

#[derive(Clone, Debug, Serialize)]
pub struct GecisTuru {
  pub id: String,
  pub ad: String,
}

pub const VARSAYILAN_GECIS: &str = "fade_transition";
pub const VARSAYILAN_SURE_MS: u32 = 300;
pub const AZAMI_SURE_MS: u32 = 20_000;

/// OBS_ALIGN_CENTER = 0 (sol/sağ/üst/alt bitleri yok)
const ORTA: u32 = 0;

pub fn gecis_turleri() -> Vec<GecisTuru> {
  let a = api();
  let mut v = Vec::new();
  for i in 0.. {
    let mut id: *const std::ffi::c_char = std::ptr::null();
    if !unsafe { (a.obs_enum_transition_types)(i, &mut id) } || id.is_null() {
      break;
    }
    let kimlik = unsafe { cstr(id) };
    let ad = unsafe { cstr((a.obs_source_get_display_name)(id)) };
    v.push(GecisTuru { id: kimlik, ad });
  }
  v
}

impl Motor {
  /// Tuvalin kanal 0'ına kaynak bağlar (ana tuvalde çıktı kaynağı, ek tuvalde kanal).
  fn kanal_ayarla(&self, tuval: &str, kaynak: Ptr) -> Result<(), String> {
    let k = self.kanvaslar.get(tuval).ok_or_else(|| format!("tuval yok: {tuval}"))?;
    unsafe {
      if k.ptr.is_null() {
        (api().obs_set_output_source)(0, kaynak);
      } else {
        (api().obs_canvas_set_channel)(k.ptr, 0, kaynak);
      }
    }
    Ok(())
  }

  fn gecis_olustur(&self, tuval: &str, tur: &str, ayarlar: &Map<String, Value>) -> Result<Ptr, String> {
    let k = self.kanvaslar.get(tuval).ok_or_else(|| format!("tuval yok: {tuval}"))?;
    if !gecis_turleri().iter().any(|t| t.id == tur) {
      return Err(format!("geçiş türü yok: {tur}"));
    }
    let veri = Veri::yeni().json(ayarlar);
    let (tur_c, ad_c) = (cs(tur), cs(&format!("Geçiş ({tuval})")));
    let ptr = unsafe { (api().obs_source_create_private)(tur_c.as_ptr(), ad_c.as_ptr(), veri.0) };
    if ptr.is_null() {
      return Err(format!("geçiş oluşturulamadı: {tur}"));
    }
    unsafe {
      (api().obs_transition_set_size)(ptr, k.genislik, k.yukseklik);
      (api().obs_transition_set_alignment)(ptr, ORTA);
    }
    Ok(ptr)
  }

  /// Tuvalin geçiş kaynağı; yoksa varsayılan (yumuşak geçiş, 300 ms) kurulup kanala bağlanır.
  pub(crate) fn gecis_hazirla(&mut self, tuval: &str) -> Result<Ptr, String> {
    if let Some(g) = self.gecisler.get(tuval) {
      return Ok(g.ptr);
    }
    let ptr = self.gecis_olustur(tuval, VARSAYILAN_GECIS, &Map::new())?;
    self.kanal_ayarla(tuval, ptr)?;
    self.gecisler.insert(tuval.into(), Gecis { ptr, tur: VARSAYILAN_GECIS.into(), sure_ms: VARSAYILAN_SURE_MS });
    Ok(ptr)
  }

  fn sahne_kimligi(&self, kaynak: Ptr) -> Option<String> {
    self
      .sahneler
      .iter()
      .find(|(_, s)| unsafe { (api().obs_scene_get_source)(s.ptr) } == kaynak)
      .map(|(id, _)| id.clone())
  }

  /// Tuvalin programdaki sahnesi (geçişin etkin kaynağı).
  pub fn program_sahnesi(&self, tuval: &str) -> Option<String> {
    let g = self.gecisler.get(tuval)?;
    let kaynak = unsafe { (api().obs_transition_get_active_source)(g.ptr) };
    if kaynak.is_null() {
      return None;
    }
    let id = self.sahne_kimligi(kaynak);
    unsafe { (api().obs_source_release)(kaynak) };
    id
  }

  /// Sahneyi programa alır: `gecis` ise tuvalin geçişiyle, değilse anında (kesme).
  pub fn sahneye_gec(&mut self, id: &str, gecis: bool, sure_ms: Option<u32>) -> Result<(), String> {
    let (kanvas, kaynak) = {
      let s = self.sahneler.get(id).ok_or_else(|| format!("sahne yok: {id}"))?;
      (s.kanvas.clone(), unsafe { (api().obs_scene_get_source)(s.ptr) })
    };
    let tr = self.gecis_hazirla(&kanvas)?;
    // Programa doğrudan geçiş yarım kalmış T-bar'ı geçersiz kılar
    if let Some(s) = self.studyo.get_mut(&kanvas) {
      s.tbar = None;
    }
    let sure = sure_ms.unwrap_or(self.gecisler[&kanvas].sure_ms).min(AZAMI_SURE_MS);
    unsafe {
      if !gecis || !(api().obs_transition_start)(tr, obs::OBS_TRANSITION_MODE_AUTO, sure, kaynak) {
        (api().obs_transition_set)(tr, kaynak);
      }
    }
    Ok(())
  }

  /// Geçiş türünü, süresini ya da ayarlarını değiştirir. Tür değişince yeni geçiş mevcut programla kurulur.
  pub fn gecis_ayarla(&mut self, tuval: &str, tur: Option<&str>, sure_ms: Option<u32>, ayarlar: Option<&Map<String, Value>>) -> Result<(), String> {
    let eski = self.gecis_hazirla(tuval)?;
    let simdiki = self.gecisler[tuval].tur.clone();
    if let Some(t) = tur.filter(|t| *t != simdiki) {
      let bos = Map::new();
      let yeni = self.gecis_olustur(tuval, t, ayarlar.unwrap_or(&bos))?;
      unsafe {
        let etkin = (api().obs_transition_get_active_source)(eski);
        (api().obs_transition_set)(yeni, etkin);
        if !etkin.is_null() {
          (api().obs_source_release)(etkin);
        }
      }
      self.kanal_ayarla(tuval, yeni)?;
      unsafe {
        (api().obs_transition_force_stop)(eski);
        (api().obs_source_release)(eski);
      }
      let g = self.gecisler.get_mut(tuval).unwrap();
      g.ptr = yeni;
      g.tur = t.to_string();
    } else if let Some(a) = ayarlar {
      let veri = Veri::yeni().json(a);
      unsafe { (api().obs_source_update)(eski, veri.0) };
    }
    if let Some(s) = sure_ms {
      self.gecisler.get_mut(tuval).unwrap().sure_ms = s.min(AZAMI_SURE_MS);
    }
    Ok(())
  }

  pub fn gecis_bilgisi(&self, tuval: &str) -> Option<(String, u32)> {
    self.gecisler.get(tuval).map(|g| (g.tur.clone(), g.sure_ms))
  }

  pub fn gecis_ozellikleri(&mut self, tuval: &str) -> Result<Value, String> {
    let tr = self.gecis_hazirla(tuval)?;
    crate::eklenti::ozellikler(tr)
  }

  pub fn gecis_guncelle(&mut self, tuval: &str, ayarlar: &Map<String, Value>) -> Result<(), String> {
    let tr = self.gecis_hazirla(tuval)?;
    crate::eklenti::guncelle(tr, ayarlar)
  }

  // ─── Studio Mode ──────────────────────────────────────────────────────

  pub fn studyo_ac(&mut self, tuval: &str) -> Result<(), String> {
    if self.studyo.contains_key(tuval) {
      return Ok(());
    }
    let (g, y) = {
      let k = self.kanvaslar.get(tuval).ok_or_else(|| format!("tuval yok: {tuval}"))?;
      (k.genislik, k.yukseklik)
    };
    let mut ovi = video_bilgisi(self.ana.boyutla(g, y), c"libobs-d3d11");
    let ad = cs(&format!("Önizleme ({tuval})"));
    let ptr = unsafe { (api().obs_canvas_create_private)(ad.as_ptr(), &mut ovi, obs::CANVAS_PREVIEW) };
    if ptr.is_null() {
      return Err("önizleme tuvali oluşturulamadı".into());
    }
    let program = self.program_sahnesi(tuval);
    self.studyo.insert(tuval.into(), Studyo { kanvas: Kanvas { ptr, genislik: g, yukseklik: y }, sahne: None, tbar: None });
    if let Some(p) = program {
      self.studyo_onizleme(tuval, &p)?;
    }
    Ok(())
  }

  pub fn studyo_kapat(&mut self, tuval: &str) -> Result<(), String> {
    // Yarım bırakılmış T-bar: program olduğu yerde (hedef sahne) kalmaz, eskiye döner
    if self.studyo.get(tuval).is_some_and(|s| s.tbar.is_some()) {
      let _ = self.studyo_tbar(tuval, 0.0, true);
    }
    self.onizlemeler.remove(&format!("studyo-{tuval}"));
    if let Some(s) = self.studyo.remove(tuval) {
      unsafe {
        (api().obs_canvas_set_channel)(s.kanvas.ptr, 0, std::ptr::null_mut());
        (api().obs_canvas_remove)(s.kanvas.ptr);
        (api().obs_canvas_release)(s.kanvas.ptr);
      }
    }
    Ok(())
  }

  /// Studio Mode önizlemesine sahne koyar (programı etkilemez).
  pub fn studyo_onizleme(&mut self, tuval: &str, sahne: &str) -> Result<(), String> {
    let kaynak = {
      let s = self.sahneler.get(sahne).ok_or_else(|| format!("sahne yok: {sahne}"))?;
      if s.kanvas != tuval {
        return Err(format!("{sahne} bu tuvalin sahnesi değil"));
      }
      unsafe { (api().obs_scene_get_source)(s.ptr) }
    };
    let st = self.studyo.get_mut(tuval).ok_or("Studio Mode kapalı")?;
    if st.tbar.is_some() {
      return Err("T-bar sürükleniyor; önce bırakın".into());
    }
    unsafe { (api().obs_canvas_set_channel)(st.kanvas.ptr, 0, kaynak) };
    st.sahne = Some(sahne.to_string());
    Ok(())
  }

  /// Önizlemedeki sahneyi geçişle programa alır. `takas`: eski program önizlemeye gelir (OBS'teki seçenek).
  pub fn studyo_gecis(&mut self, tuval: &str, takas: bool, sure_ms: Option<u32>) -> Result<(), String> {
    let st = self.studyo.get(tuval).ok_or("Studio Mode kapalı")?;
    if st.tbar.is_some() {
      return Err("T-bar sürükleniyor; önce bırakın".into());
    }
    let onizleme = st.sahne.clone().ok_or("önizlemede sahne yok")?;
    let eski = self.program_sahnesi(tuval);
    self.sahneye_gec(&onizleme, true, sure_ms)?;
    if takas {
      if let Some(e) = eski.filter(|e| *e != onizleme) {
        self.studyo_onizleme(tuval, &e)?;
      }
    }
    Ok(())
  }

  /// T-bar (OBS Studio Mode): geçişi elle `konum` (0–1) noktasına getirir. İlk hareket önizlemedeki sahneye manuel
  /// geçiş başlatır. `birak`: uca yakınsa (≥0,98) geçiş tamamlanır, başa yakınsa (≤0,02) eski programa dönülür,
  /// arada bırakılırsa olduğu yerde kalır (OBS'teki gibi). Sabit geçişler (Kes, Stinger) T-bar'ı desteklemez.
  /// Dönüş: T-bar hâlâ etkin mi.
  pub fn studyo_tbar(&mut self, tuval: &str, konum: f32, birak: bool) -> Result<bool, String> {
    if !konum.is_finite() {
      return Err("konum sayı olmalı".into());
    }
    let konum = konum.clamp(0.0, 1.0);
    let tr = self.gecis_hazirla(tuval)?;
    let st = self.studyo.get(tuval).ok_or("Studio Mode kapalı")?;
    let (eski, hedef) = match st.tbar.clone() {
      Some(e) => e,
      None => {
        if birak {
          return Ok(false);
        }
        if unsafe { (api().obs_transition_fixed)(tr) } {
          return Err("bu geçiş türü T-bar ile sürüklenemez (sabit geçiş)".into());
        }
        let hedef = st.sahne.clone().ok_or("önizlemede sahne yok")?;
        let eski = self.program_sahnesi(tuval).ok_or("programda sahne yok")?;
        if eski == hedef {
          return Err("önizleme ve program aynı sahne".into());
        }
        let kaynak = unsafe { (api().obs_scene_get_source)(self.sahneler[&hedef].ptr) };
        if !unsafe { (api().obs_transition_start)(tr, obs::OBS_TRANSITION_MODE_MANUAL, 0, kaynak) } {
          return Err("manuel geçiş başlatılamadı".into());
        }
        self.studyo.get_mut(tuval).unwrap().tbar = Some((eski.clone(), hedef.clone()));
        (eski, hedef)
      }
    };
    unsafe { (api().obs_transition_set_manual_time)(tr, konum) };
    if !birak {
      return Ok(true);
    }
    let sonuc = if konum >= 1.0 - TBAR_UC {
      Some(hedef)
    } else if konum <= TBAR_UC {
      Some(eski)
    } else {
      None
    };
    let Some(son) = sonuc else {
      return Ok(true);
    };
    // Uçta bırakıldı: geçiş temizlenir ve sonuç sahnesi doğrudan program olur (yarım kalmış geçiş bırakılmaz)
    let kaynak = unsafe { (api().obs_scene_get_source)(self.sahneler.get(&son).ok_or("sahne silindi")?.ptr) };
    unsafe { (api().obs_transition_set)(tr, kaynak) };
    self.studyo.get_mut(tuval).unwrap().tbar = None;
    Ok(false)
  }

  pub fn studyo_durumu(&self, tuval: &str) -> Option<Option<String>> {
    self.studyo.get(tuval).map(|s| s.sahne.clone())
  }

  /// Kapanışta: geçişler kanaldan çıkarılır ve bırakılır, önizleme tuvalleri kaldırılır.
  pub(crate) fn gecisleri_kapat(&mut self) {
    let tuvaller: Vec<String> = self.studyo.keys().cloned().collect();
    for t in tuvaller {
      let _ = self.studyo_kapat(&t);
    }
    for (tuval, g) in std::mem::take(&mut self.gecisler) {
      let _ = self.kanal_ayarla(&tuval, std::ptr::null_mut());
      unsafe {
        (api().obs_transition_force_stop)(g.ptr);
        (api().obs_source_release)(g.ptr);
      }
    }
  }
}
