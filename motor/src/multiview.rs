//! Multiview (OBS "Multiview"): üstte önizleme ve program, altta en çok 8 sahne. Tek bir özel tuvalde (1920×1080,
//! `CANVAS_PREVIEW`: kaynakları etkinleştirmez, ses karıştırmaz) özel bir sahne kurulur; hücrelere sahne kaynakları,
//! program hücresine tuvalin geçiş kaynağı (canlı geçiş görünür) konur. Önizleme/canlı kare altyapısı bu tuvali
//! `multiview-<tuval>` adıyla kullanır; etiketler ve çerçeveler panelde çizilir (düzen JSON olarak döner).

use serde::Serialize;
use serde_json::{json, Value};

use crate::motor::{video_bilgisi, Kanvas, Motor};
use crate::obs::{self, api, cs, Ptr, Vec2};

pub const ONEK: &str = "multiview-";
pub const GENISLIK: u32 = 1920;
pub const YUKSEKLIK: u32 = 1080;
pub const EN_COK_SAHNE: usize = 8;
/// OBS_BOUNDS_SCALE_INNER: en-boy korunarak hücreye sığdırılır
const SINIR_ICERIDEN: i32 = 2;
/// OBS_SCALE_AREA
const OLCEK_ALAN: i32 = 5;
/// Hücre kenar boşluğu (çerçeve çizgisi için yer)
const BOSLUK: f32 = 4.0;

pub struct Multiview {
  pub kanvas: Kanvas,
  pub sahne: Ptr,
  pub ogeler: Vec<Ptr>,
  /// Izgaradaki sahneler (sahne silinince düzen yeniden kurulur)
  pub sahneler: Vec<String>,
}

#[derive(Clone, Debug, Serialize, PartialEq)]
pub struct Hucre {
  /// onizleme | program | sahne
  pub tur: &'static str,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub sahne: Option<String>,
  /// 0–1 arası (tuvale göre) x, y, genişlik, yükseklik
  pub kutu: [f32; 4],
}

/// OBS'in varsayılan "Yatay, üstte 8 sahne" düzenine benzer: üst yarı önizleme | program, alt yarı 2×4 sahne
pub fn duzen(sahneler: &[String]) -> Vec<Hucre> {
  let mut v = vec![
    Hucre { tur: "onizleme", sahne: None, kutu: [0.0, 0.0, 0.5, 0.5] },
    Hucre { tur: "program", sahne: None, kutu: [0.5, 0.0, 0.5, 0.5] },
  ];
  for (i, s) in sahneler.iter().take(EN_COK_SAHNE).enumerate() {
    let (sut, sat) = ((i % 4) as f32, (i / 4) as f32);
    v.push(Hucre { tur: "sahne", sahne: Some(s.clone()), kutu: [sut * 0.25, 0.5 + sat * 0.25, 0.25, 0.25] });
  }
  v
}

impl Motor {
  /// Multiview'u (yeniden) kurar. `sahneler` sırayla ızgaraya yerleşir (en çok 8; bu tuvalin sahneleri olmalı).
  pub fn multiview_ac(&mut self, tuval: &str, sahneler: &[String]) -> Result<Value, String> {
    let sahneler = &sahneler[..sahneler.len().min(EN_COK_SAHNE)];
    for s in sahneler {
      let sk = self.sahneler.get(s).ok_or_else(|| format!("sahne yok: {s}"))?;
      if sk.kanvas != tuval {
        return Err(format!("{s} bu tuvalin sahnesi değil"));
      }
    }
    let gecis = self.gecis_hazirla(tuval)?;
    let onizleme = match self.studyo.get(tuval).and_then(|s| s.sahne.clone()) {
      Some(s) => unsafe { (api().obs_scene_get_source)(self.sahneler[&s].ptr) },
      None => gecis,
    };
    if !self.multiviewler.contains_key(tuval) {
      let mut ovi = video_bilgisi(self.ana.boyutla(GENISLIK, YUKSEKLIK), c"libobs-d3d11");
      let ad = cs(&format!("Multiview ({tuval})"));
      let ptr = unsafe { (api().obs_canvas_create_private)(ad.as_ptr(), &mut ovi, obs::CANVAS_PREVIEW) };
      if ptr.is_null() {
        return Err("multiview tuvali oluşturulamadı".into());
      }
      let sahne = unsafe { (api().obs_scene_create_private)(ad.as_ptr()) };
      if sahne.is_null() {
        unsafe {
          (api().obs_canvas_remove)(ptr);
          (api().obs_canvas_release)(ptr);
        }
        return Err("multiview sahnesi oluşturulamadı".into());
      }
      unsafe { (api().obs_canvas_set_channel)(ptr, 0, (api().obs_scene_get_source)(sahne)) };
      self.multiviewler.insert(tuval.into(), Multiview { kanvas: Kanvas { ptr, genislik: GENISLIK, yukseklik: YUKSEKLIK }, sahne, ogeler: Vec::new(), sahneler: Vec::new() });
    }
    let hucreler = duzen(sahneler);
    let kaynaklar: Vec<Ptr> = hucreler
      .iter()
      .map(|h| match h.tur {
        "onizleme" => onizleme,
        "program" => gecis,
        _ => unsafe { (api().obs_scene_get_source)(self.sahneler[h.sahne.as_ref().unwrap()].ptr) },
      })
      .collect();
    let mv = self.multiviewler.get_mut(tuval).unwrap();
    mv.sahneler = sahneler.to_vec();
    unsafe {
      for o in mv.ogeler.drain(..) {
        (api().obs_sceneitem_remove)(o);
      }
      for (h, k) in hucreler.iter().zip(kaynaklar) {
        let oge = (api().obs_scene_add)(mv.sahne, k);
        if oge.is_null() {
          continue;
        }
        let (gx, gy) = (GENISLIK as f32, YUKSEKLIK as f32);
        let konum = Vec2 { x: h.kutu[0] * gx + BOSLUK, y: h.kutu[1] * gy + BOSLUK };
        let sinir = Vec2 { x: h.kutu[2] * gx - 2.0 * BOSLUK, y: h.kutu[3] * gy - 2.0 * BOSLUK };
        (api().obs_sceneitem_set_alignment)(oge, obs::OBS_ALIGN_LEFT | obs::OBS_ALIGN_TOP);
        (api().obs_sceneitem_set_pos)(oge, &konum);
        (api().obs_sceneitem_set_bounds_type)(oge, SINIR_ICERIDEN);
        (api().obs_sceneitem_set_bounds_alignment)(oge, 0);
        (api().obs_sceneitem_set_bounds)(oge, &sinir);
        // Ölçek filtresi öğeyi kaynağın kendi boyutunda bir dokuya çizdirir: sahnenin tuval dışına taşan öğeleri
        // hücreye taşmaz (OBS multiview'unun kırpması gibi) ve küçültme "alan" filtresiyle yumuşak olur
        (api().obs_sceneitem_set_scale_filter)(oge, OLCEK_ALAN);
        mv.ogeler.push(oge);
      }
    }
    Ok(json!({ "tuval": format!("{ONEK}{tuval}"), "genislik": GENISLIK, "yukseklik": YUKSEKLIK, "hucreler": hucreler }))
  }

  pub fn multiview_kapat(&mut self, tuval: &str) {
    let ad = format!("{ONEK}{tuval}");
    self.akis_durdur(&ad);
    self.onizlemeler.remove(&ad);
    if let Some(mv) = self.multiviewler.remove(tuval) {
      unsafe {
        (api().obs_canvas_set_channel)(mv.kanvas.ptr, 0, std::ptr::null_mut());
        for o in mv.ogeler {
          (api().obs_sceneitem_remove)(o);
        }
        (api().obs_scene_release)(mv.sahne);
        (api().obs_canvas_remove)(mv.kanvas.ptr);
        (api().obs_canvas_release)(mv.kanvas.ptr);
      }
    }
  }

  /// Önizleme sahnesi ya da Studio Mode değişince önizleme hücresi güncellensin
  pub(crate) fn multiview_yenile(&mut self, tuval: &str) {
    if let Some(s) = self.multiviewler.get(tuval).map(|m| m.sahneler.clone()) {
      if self.multiview_ac(tuval, &s).is_err() {
        self.multiview_kapat(tuval);
      }
    }
  }

  /// Sahne silinmeden önce: onu gösteren multiview'lar o sahne olmadan yeniden kurulur
  pub(crate) fn multiviewden_cikar(&mut self, sahne: &str) {
    let etkilenen: Vec<(String, Vec<String>)> = self
      .multiviewler
      .iter()
      .filter(|(_, m)| m.sahneler.iter().any(|s| s == sahne))
      .map(|(t, m)| (t.clone(), m.sahneler.iter().filter(|s| *s != sahne).cloned().collect()))
      .collect();
    for (t, kalan) in etkilenen {
      if self.multiview_ac(&t, &kalan).is_err() {
        self.multiview_kapat(&t);
      }
    }
  }

  pub(crate) fn multiviewleri_kapat(&mut self) {
    let hepsi: Vec<String> = self.multiviewler.keys().cloned().collect();
    for t in hepsi {
      self.multiview_kapat(&t);
    }
  }
}

/// Sahne/kaynak projektörü tuvali öneki (`kaynak-<kimlik>`)
pub const KAYNAK_ONEK: &str = "kaynak-";

impl Motor {
  /// Sahne ya da kaynak projektörü (OBS bağlam menüsü › Projektör): kaynağı kendi boyutunda (sahneyi tuval
  /// boyutunda) özel, etkinleştirmeyen bir tuvalde işler; önizleme/canlı kare altyapısı `kaynak-<kimlik>` adıyla
  /// kullanır. Zaten açıksa aynı tuval döner.
  pub fn kaynak_tuvali_ac(&mut self, id: &str) -> Result<Value, String> {
    let ad = format!("{KAYNAK_ONEK}{id}");
    if let Some(t) = self.kaynak_tuvalleri.get(id) {
      return Ok(json!({"tuval": ad, "genislik": t.genislik, "yukseklik": t.yukseklik}));
    }
    let (kaynak, g, y) = if let Some(s) = self.sahneler.get(id) {
      let k = self.kanvaslar.get(&s.kanvas).ok_or("sahnenin tuvali yok")?;
      (unsafe { (api().obs_scene_get_source)(s.ptr) }, k.genislik, k.yukseklik)
    } else {
      let k = *self.kaynaklar.get(id).ok_or_else(|| format!("kaynak ya da sahne yok: {id}"))?;
      (k, unsafe { (api().obs_source_get_width)(k) }, unsafe { (api().obs_source_get_height)(k) })
    };
    if g == 0 || y == 0 {
      return Err("kaynağın görüntüsü yok (boyutu 0)".into());
    }
    let (g, y) = (g.max(16).div_ceil(2) * 2, y.max(16).div_ceil(2) * 2);
    crate::motor::gecerli_boyut(g, y, self.ana.fps)?;
    let mut ovi = video_bilgisi(self.ana.boyutla(g, y), c"libobs-d3d11");
    let ad_c = cs(&format!("Projektör ({id})"));
    let ptr = unsafe { (api().obs_canvas_create_private)(ad_c.as_ptr(), &mut ovi, obs::CANVAS_PREVIEW) };
    if ptr.is_null() {
      return Err("projektör tuvali oluşturulamadı".into());
    }
    unsafe { (api().obs_canvas_set_channel)(ptr, 0, kaynak) };
    self.kaynak_tuvalleri.insert(id.into(), Kanvas { ptr, genislik: g, yukseklik: y });
    Ok(json!({"tuval": ad, "genislik": g, "yukseklik": y}))
  }

  pub fn kaynak_tuvali_kapat(&mut self, id: &str) {
    let ad = format!("{KAYNAK_ONEK}{id}");
    self.akis_durdur(&ad);
    self.onizlemeler.remove(&ad);
    if let Some(t) = self.kaynak_tuvalleri.remove(id) {
      unsafe {
        (api().obs_canvas_set_channel)(t.ptr, 0, std::ptr::null_mut());
        (api().obs_canvas_remove)(t.ptr);
        (api().obs_canvas_release)(t.ptr);
      }
    }
  }

  pub(crate) fn kaynak_tuvallerini_kapat(&mut self) {
    let hepsi: Vec<String> = self.kaynak_tuvalleri.keys().cloned().collect();
    for k in hepsi {
      self.kaynak_tuvali_kapat(&k);
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn duzen_ust_yarida_onizleme_program_altta_sekiz_sahne() {
    let s: Vec<String> = (1..=10).map(|i| format!("s{i}")).collect();
    let d = duzen(&s);
    assert_eq!(d.len(), 10, "2 + en çok 8 sahne");
    assert_eq!(d[0].kutu, [0.0, 0.0, 0.5, 0.5]);
    assert_eq!(d[1].kutu, [0.5, 0.0, 0.5, 0.5]);
    assert_eq!(d[2].kutu, [0.0, 0.5, 0.25, 0.25]);
    assert_eq!(d[9].kutu, [0.75, 0.75, 0.25, 0.25]);
    assert_eq!(d[9].sahne.as_deref(), Some("s8"));
  }
}
