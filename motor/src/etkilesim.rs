//! Kaynakla etkileşim (OBS "Etkileşim" penceresi) ve sahne öğesi gösterme/gizleme geçişleri.
//!
//! **Etkileşim**: fare/klavye olayları libobs üzerinden kaynağa iletilir (`obs_source_send_*`); yalnız
//! `OBS_SOURCE_INTERACTION` bayraklı kaynaklar (tarayıcı kaynağı vb.) kabul eder. Kaynağın tek başına görüntüsü için
//! kaynak boyutunda özel bir önizleme tuvali açılır (kanal 0 = kaynağın kendisi; kaynakları etkinleştirmez, ses
//! karıştırmaz) ve mevcut önizleme/canlı akış altyapısı `etkilesim-<kaynak>` adıyla bunu kullanır.
//!
//! **Öğe geçişleri**: öğeye gösterme ve gizleme için ayrı geçiş kaynağı (özel, sahne listesinde görünmez) ve süre
//! atanır; `obs_sceneitem_set_visible` geçişi libobs'un kendisi oynatır.

use std::ffi::CString;

use serde_json::{json, Map, Value};

use crate::motor::{gecerli_boyut, video_bilgisi, Kanvas, Motor};
use crate::obs::{self, api, cs, cstr, FareOlayi, Ptr, TusOlayi, Veri};

pub const ONEK: &str = "etkilesim-";

fn degistiriciler(o: &Value) -> u32 {
  let b = |ad: &str| o.get(ad).and_then(Value::as_bool).unwrap_or(false);
  let mut m = 0;
  if b("shift") {
    m |= obs::INTERACT_SHIFT_KEY;
  }
  if b("ctrl") {
    m |= obs::INTERACT_CONTROL_KEY;
  }
  if b("alt") {
    m |= obs::INTERACT_ALT_KEY;
  }
  m
}

fn sayi(o: &Value, ad: &str) -> i64 {
  o.get(ad).and_then(Value::as_f64).map(|x| x.round() as i64).unwrap_or(0)
}

/// Fare düğmesi: libobs `MOUSE_LEFT` 0, `MOUSE_MIDDLE` 1, `MOUSE_RIGHT` 2; basılı düğme bayrağıyla birlikte
fn dugme(ad: &str) -> Result<(i32, u32), String> {
  match ad {
    "sol" => Ok((0, obs::INTERACT_MOUSE_LEFT)),
    "orta" => Ok((1, obs::INTERACT_MOUSE_MIDDLE)),
    "sag" => Ok((2, obs::INTERACT_MOUSE_RIGHT)),
    x => Err(format!("geçersiz fare düğmesi: {x}")),
  }
}

impl Motor {
  fn etkilesimli_kaynak(&self, kaynak: &str) -> Result<Ptr, String> {
    let k = *self.kaynaklar.get(kaynak).ok_or_else(|| format!("kaynak yok: {kaynak}"))?;
    if unsafe { (api().obs_source_get_output_flags)(k) } & obs::OBS_SOURCE_INTERACTION == 0 {
      return Err("bu kaynak etkileşimi desteklemiyor".into());
    }
    Ok(k)
  }

  /// Tek bir etkileşim olayı. Koordinatlar kaynak pikseli (0,0 sol üst).
  /// `tur`: `tik` (dugme, birak, sayi), `hareket` (ayril), `tekerlek` (dx, dy), `odak` (acik), `tus` (metin, vkey,
  /// tarama, birak). Değiştiriciler: `shift`, `ctrl`, `alt`.
  pub fn etkilesim(&self, kaynak: &str, olay: &Value) -> Result<(), String> {
    let k = self.etkilesimli_kaynak(kaynak)?;
    let a = api();
    let mut fare = FareOlayi { modifiers: degistiriciler(olay), x: sayi(olay, "x") as i32, y: sayi(olay, "y") as i32 };
    let tur = olay.get("tur").and_then(Value::as_str).ok_or("olay türü (tur) gerekli")?;
    match tur {
      "tik" => {
        let (d, bayrak) = dugme(olay.get("dugme").and_then(Value::as_str).unwrap_or("sol"))?;
        let birak = olay.get("birak").and_then(Value::as_bool).unwrap_or(false);
        let adet = sayi(olay, "sayi").clamp(1, 3) as u32;
        if !birak {
          fare.modifiers |= bayrak;
        }
        unsafe { (a.obs_source_send_mouse_click)(k, &fare, d, birak, adet) };
      }
      "hareket" => {
        let ayril = olay.get("ayril").and_then(Value::as_bool).unwrap_or(false);
        if let Some(b) = olay.get("basili").and_then(Value::as_str) {
          fare.modifiers |= dugme(b)?.1;
        }
        unsafe { (a.obs_source_send_mouse_move)(k, &fare, ayril) };
      }
      "tekerlek" => {
        let (dx, dy) = (sayi(olay, "dx").clamp(-1200, 1200) as i32, sayi(olay, "dy").clamp(-1200, 1200) as i32);
        unsafe { (a.obs_source_send_mouse_wheel)(k, &fare, dx, dy) };
      }
      "odak" => {
        let acik = olay.get("acik").and_then(Value::as_bool).unwrap_or(true);
        unsafe { (a.obs_source_send_focus)(k, acik) };
      }
      "tus" => {
        let metin = olay.get("metin").and_then(Value::as_str).unwrap_or("");
        if metin.chars().count() > 8 {
          return Err("tuş metni çok uzun".into());
        }
        let metin_c = CString::new(metin).map_err(|_| "tuş metninde NUL var")?;
        let tus = TusOlayi {
          modifiers: degistiriciler(olay),
          text: metin_c.as_ptr(),
          native_modifiers: 0,
          native_scancode: sayi(olay, "tarama").clamp(0, 0xFFFF) as u32,
          native_vkey: sayi(olay, "vkey").clamp(0, 0xFF) as u32,
        };
        let birak = olay.get("birak").and_then(Value::as_bool).unwrap_or(false);
        unsafe { (a.obs_source_send_key_click)(k, &tus, birak) };
      }
      x => return Err(format!("bilinmeyen etkileşim olayı: {x}")),
    }
    Ok(())
  }

  /// Kaynağın tek başına görüntüsü için önizleme tuvali (kaynak boyutunda). Dönüş: tuval adı ve boyut.
  pub fn etkilesim_ac(&mut self, kaynak: &str) -> Result<Value, String> {
    let k = self.etkilesimli_kaynak(kaynak)?;
    let ad = format!("{ONEK}{kaynak}");
    if let Some(t) = self.etkilesim_tuvalleri.get(kaynak) {
      return Ok(json!({"tuval": ad, "genislik": t.genislik, "yukseklik": t.yukseklik}));
    }
    let (g, y) = unsafe { ((api().obs_source_get_width)(k), (api().obs_source_get_height)(k)) };
    if g == 0 || y == 0 {
      return Err("kaynağın boyutu henüz yok (yükleniyor olabilir)".into());
    }
    // NV12 çift boyut ister
    let (g, y) = (g.max(16).div_ceil(2) * 2, y.max(16).div_ceil(2) * 2);
    gecerli_boyut(g, y, self.ana.fps)?;
    let mut ovi = video_bilgisi(self.ana.boyutla(g, y), c"libobs-d3d11");
    let ad_c = cs(&format!("Etkileşim ({kaynak})"));
    let ptr = unsafe { (api().obs_canvas_create_private)(ad_c.as_ptr(), &mut ovi, obs::CANVAS_PREVIEW) };
    if ptr.is_null() {
      return Err("etkileşim tuvali oluşturulamadı".into());
    }
    unsafe { (api().obs_canvas_set_channel)(ptr, 0, k) };
    self.etkilesim_tuvalleri.insert(kaynak.into(), Kanvas { ptr, genislik: g, yukseklik: y });
    Ok(json!({"tuval": ad, "genislik": g, "yukseklik": y}))
  }

  pub fn etkilesim_kapat(&mut self, kaynak: &str) {
    let ad = format!("{ONEK}{kaynak}");
    self.akis_durdur(&ad);
    self.onizlemeler.remove(&ad);
    self.video_akislari.remove(&ad);
    if let Some(t) = self.etkilesim_tuvalleri.remove(kaynak) {
      unsafe {
        (api().obs_canvas_set_channel)(t.ptr, 0, std::ptr::null_mut());
        (api().obs_canvas_remove)(t.ptr);
        (api().obs_canvas_release)(t.ptr);
      }
    }
  }

  pub(crate) fn etkilesimleri_kapat(&mut self) {
    let hepsi: Vec<String> = self.etkilesim_tuvalleri.keys().cloned().collect();
    for k in hepsi {
      self.etkilesim_kapat(&k);
    }
  }

  // ─── Öğe gösterme/gizleme geçişleri ─────────────────────────────────────

  /// Öğeye gösterme (`goster`=true) ya da gizleme geçişi atar. `tur` None → geçiş kaldırılır.
  pub fn oge_gecisi(&mut self, oge: &str, goster: bool, tur: Option<&str>, sure_ms: u32, ayarlar: &Map<String, Value>) -> Result<(), String> {
    let p = *self.ogeler.get(oge).ok_or_else(|| format!("öğe yok: {oge}"))?;
    let a = api();
    let Some(tur) = tur else {
      unsafe { (a.obs_sceneitem_set_transition)(p, goster, std::ptr::null_mut()) };
      return Ok(());
    };
    if !crate::gecis::gecis_turleri().iter().any(|t| t.id == tur) {
      return Err(format!("geçiş türü yok: {tur}"));
    }
    if !(50..=20_000).contains(&sure_ms) {
      return Err(format!("geçersiz süre: {sure_ms} ms (50–20000)"));
    }
    let veri = Veri::yeni().json(ayarlar);
    let ad = cs(&format!("{oge} {}", if goster { "gösterme" } else { "gizleme" }));
    let tr = unsafe { (a.obs_source_create_private)(cs(tur).as_ptr(), ad.as_ptr(), veri.0) };
    if tr.is_null() {
      return Err(format!("geçiş oluşturulamadı: {tur}"));
    }
    unsafe {
      // libobs öğe için kendi başvurusunu alır; bizimki bırakılır
      (a.obs_sceneitem_set_transition)(p, goster, tr);
      (a.obs_sceneitem_set_transition_duration)(p, goster, sure_ms);
      (a.obs_source_release)(tr);
    }
    Ok(())
  }

  /// Öğenin geçişleri: `{goster: {tur, sure_ms} | null, gizle: …}`
  pub fn oge_gecisleri(&self, oge: &str) -> Result<Value, String> {
    let p = *self.ogeler.get(oge).ok_or_else(|| format!("öğe yok: {oge}"))?;
    let a = api();
    let bilgi = |goster: bool| {
      let tr = unsafe { (a.obs_sceneitem_get_transition)(p, goster) };
      if tr.is_null() {
        Value::Null
      } else {
        json!({
          "tur": unsafe { cstr((a.obs_source_get_id)(tr)) },
          "sure_ms": unsafe { (a.obs_sceneitem_get_transition_duration)(p, goster) },
        })
      }
    };
    Ok(json!({"goster": bilgi(true), "gizle": bilgi(false)}))
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn degistirici_ve_dugme_eslemesi() {
    assert_eq!(degistiriciler(&json!({"shift": true, "alt": true})), obs::INTERACT_SHIFT_KEY | obs::INTERACT_ALT_KEY);
    assert_eq!(degistiriciler(&json!({})), 0);
    assert_eq!(dugme("sag").unwrap(), (2, obs::INTERACT_MOUSE_RIGHT));
    assert!(dugme("x").is_err());
    assert_eq!(sayi(&json!({"x": 12.6}), "x"), 13);
  }
}
