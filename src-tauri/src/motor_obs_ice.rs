//! OBS Studio sahne koleksiyonu (JSON) içe aktarımı → motor koleksiyonu.
//!
//! OBS'in dosya biçimi yalnız okunur (davranış referansı; OBS kodu kullanılmaz). Kaynak türleri libobs türleridir,
//! bu yüzden ayarlar olduğu gibi taşınır. İçe aktarım salt-okunur ve yerel: OBS'in dosyasına dokunulmaz; sırlar
//! (yayın anahtarları) OBS'te profil dosyasındadır, koleksiyonda değildir.
//!
//! Desteklenen: kaynaklar (ayarlar, filtreler, ses: düzey/sessiz/denge/senkron/izleme/izler, mono), sahneler ve
//! sıraları, sahne öğeleri (konum, ölçek, döndürme, hizalama, sınır, kırpma, kilit, görünürlük, ölçek filtresi,
//! karıştırma), gruplar, iç içe sahneler, program sahnesi, geçerli geçiş ve süresi. Desteklenmeyen (raporlanır):
//! öğe göster/gizle geçişleri, kısayol bağları, ek tuvaller, sahneye özel çözünürlük.

use std::collections::HashMap;

use serde_json::{json, Value};

use crate::motor_koleksiyon::{Donusum, FiltreKaydi, GecisKaydi, KaynakKaydi, Koleksiyon, OgeTuru, SahneKaydi, SahneOgesi, SesKaydi};

#[derive(Debug, Default)]
pub struct IceAktarimRaporu {
  pub kaynak: usize,
  pub sahne: usize,
  pub grup: usize,
  pub filtre: usize,
  /// Aktarılamayan ya da yaklaşık aktarılan özellikler (kullanıcıya gösterilir)
  pub notlar: Vec<String>,
}

/// libobs türü → panel türü (panelin kendi formu olan türler); diğerleri `obs`
pub fn panel_turu(obs_turu: &str) -> &'static str {
  let taban = surumsuz(obs_turu);
  match taban {
    "color_source" => "renk",
    "text_gdiplus" => "yazi",
    "image_source" => "gorsel",
    "slideshow" => "slayt",
    "ffmpeg_source" => "medya",
    "browser_source" => "tarayici",
    "monitor_capture" => "ekran",
    "window_capture" => "pencere",
    "game_capture" => "oyun",
    "dshow_input" => "kamera",
    "wasapi_input_capture" => "mikrofon",
    "wasapi_output_capture" => "masaustu",
    "wasapi_process_output_capture" => "uygulama_sesi",
    _ => "obs",
  }
}

/// `color_source_v3` → `color_source`
pub fn surumsuz(id: &str) -> &str {
  match id.rsplit_once("_v") {
    Some((t, n)) if !n.is_empty() && n.bytes().all(|b| b.is_ascii_digit()) => t,
    _ => id,
  }
}

/// Kayıtlı türler arasında `tur`un en yeni sürümü (`color_source` → `color_source_v3`); yoksa kendisi.
pub fn en_yeni_surum(tur: &str, kayitli: &[String]) -> String {
  let taban = surumsuz(tur);
  let mut en: Option<(u32, &String)> = None;
  for k in kayitli {
    let surum = if k == taban {
      1
    } else {
      match k.strip_prefix(taban).and_then(|r| r.strip_prefix("_v")).and_then(|n| n.parse::<u32>().ok()) {
        Some(n) => n,
        None => continue,
      }
    };
    if en.is_none_or(|(s, _)| surum > s) {
      en = Some((surum, k));
    }
  }
  en.map(|(_, k)| k.clone()).unwrap_or_else(|| tur.to_string())
}

fn olcek_filtresi(s: &str) -> i32 {
  match s {
    "point" => 1,
    "bicubic" => 2,
    "bilinear" => 3,
    "lanczos" => 4,
    "area" => 5,
    _ => 0,
  }
}

fn karistirma(s: &str) -> i32 {
  match s {
    "additive" => 1,
    "subtract" => 2,
    "screen" => 3,
    "multiply" => 4,
    "lighten" => 5,
    "darken" => 6,
    _ => 0,
  }
}

fn vek(v: &Value, vars: [f32; 2]) -> [f32; 2] {
  match (v.get("x").and_then(Value::as_f64), v.get("y").and_then(Value::as_f64)) {
    (Some(x), Some(y)) => [x as f32, y as f32],
    _ => vars,
  }
}

fn donusum(o: &Value) -> Donusum {
  let tam = |ad: &str| o.get(ad).and_then(Value::as_i64).unwrap_or(0);
  let sinir_turu = tam("bounds_type").clamp(0, 6) as i32;
  Donusum {
    konum: vek(&o["pos"], [0.0, 0.0]),
    olcek: vek(&o["scale"], [1.0, 1.0]),
    sinir: (sinir_turu != 0).then(|| vek(&o["bounds"], [1.0, 1.0])),
    sinir_turu,
    sinir_hizalama: (tam("bounds_align") & 0xF) as u32,
    hizalama: o.get("align").and_then(Value::as_i64).map_or(5, |a| (a & 0xF) as u32),
    aci: o.get("rot").and_then(Value::as_f64).unwrap_or(0.0) as f32,
    kirp: [
      tam("crop_left").clamp(0, 16_384) as i32,
      tam("crop_top").clamp(0, 16_384) as i32,
      tam("crop_right").clamp(0, 16_384) as i32,
      tam("crop_bottom").clamp(0, 16_384) as i32,
    ],
    kilit: o.get("locked").and_then(Value::as_bool).unwrap_or(false),
    gorunur: o.get("visible").and_then(Value::as_bool).unwrap_or(true),
    olcek_filtresi: olcek_filtresi(o.get("scale_filter").and_then(Value::as_str).unwrap_or("disable")),
    karistirma: karistirma(o.get("blend_type").and_then(Value::as_str).unwrap_or("normal")),
  }
}

/// OBS filtre dizisi (kaynak, sahne ya da grup `filters`) → filtre kayıtları
fn filtreleri_cevir(sahip: &str, s: &Value, r: &mut IceAktarimRaporu) -> Vec<FiltreKaydi> {
  let mut v = Vec::new();
  for f in s.get("filters").and_then(Value::as_array).into_iter().flatten() {
    let ftur = f.get("versioned_id").or(f.get("id")).and_then(Value::as_str).unwrap_or("");
    if ftur.is_empty() {
      continue;
    }
    v.push(FiltreKaydi {
      id: format!("{sahip}-f{}", v.len() + 1),
      tur: ftur.to_string(),
      ad: f.get("name").and_then(Value::as_str).unwrap_or(ftur).to_string(),
      etkin: f.get("enabled").and_then(Value::as_bool).unwrap_or(true),
      ayarlar: f.get("settings").cloned().unwrap_or(json!({})),
    });
    r.filtre += 1;
  }
  v
}

/// Öğenin gösterme/gizleme geçişi (OBS: `{"id", "versioned_id", "name", "transition": {ayarlar}, "duration"}`;
/// geçiş atanmamışsa yalnız `duration`)
fn oge_gecisi(t: &Value) -> Option<GecisKaydi> {
  let tur = t.get("versioned_id").or(t.get("id")).and_then(Value::as_str).filter(|x| !x.is_empty())?;
  Some(GecisKaydi {
    tur: tur.to_string(),
    sure_ms: t.get("duration").and_then(Value::as_u64).unwrap_or(300).clamp(50, 20_000) as u32,
    ayarlar: t.get("transition").or(t.get("settings")).cloned().filter(Value::is_object).unwrap_or(Value::Null),
  })
}

/// OBS koleksiyon JSON'unu motor koleksiyonuna çevirir (hepsi ana tuvalde). `kayitli`: motorda kayıtlı giriş türleri
/// (boşsa sürüm seçimi OBS dosyasındaki `versioned_id` ile yapılır).
pub fn cevir(obs: &Value, ad: &str, kayitli: &[String]) -> Result<(Koleksiyon, IceAktarimRaporu), String> {
  let kaynaklar = obs.get("sources").and_then(Value::as_array).ok_or("OBS sahne koleksiyonu değil ('sources' yok)")?;
  let gruplar = obs.get("groups").and_then(Value::as_array).cloned().unwrap_or_default();
  let mut k = Koleksiyon::bos(ad, false, 60);
  k.sahneler.clear();
  k.program.clear();
  let mut r = IceAktarimRaporu::default();
  // Ad ve uuid → kimlik
  let mut ad_kimlik: HashMap<String, String> = HashMap::new();
  let mut uuid_kimlik: HashMap<String, String> = HashMap::new();
  let mut sahne_json: Vec<(String, &Value)> = Vec::new();
  let mut grup_json: HashMap<String, &Value> = HashMap::new();
  for s in kaynaklar.iter().chain(gruplar.iter()) {
    let tur = s.get("id").and_then(Value::as_str).unwrap_or("");
    let isim = s.get("name").and_then(Value::as_str).unwrap_or("").to_string();
    if isim.is_empty() {
      continue;
    }
    let id = match tur {
      "scene" => k.yeni_kimlik("s"),
      "group" => k.yeni_kimlik("g"),
      _ => k.yeni_kimlik("k"),
    };
    // yeni_kimlik yalnız kullanılan kimliklere bakar; aynı çağrıda üretilenler için sayaç yeter
    if let Some(u) = s.get("uuid").and_then(Value::as_str) {
      uuid_kimlik.insert(u.to_string(), id.clone());
    }
    ad_kimlik.insert(isim.clone(), id.clone());
    match tur {
      "scene" => sahne_json.push((id, s)),
      "group" => {
        grup_json.insert(id, s);
      }
      _ => {
        let surumlu = s.get("versioned_id").and_then(Value::as_str).unwrap_or(tur);
        let obs_turu = if kayitli.is_empty() || kayitli.iter().any(|x| x == surumlu) { surumlu.to_string() } else { en_yeni_surum(tur, kayitli) };
        let mut rec = KaynakKaydi::yeni(&id, panel_turu(&obs_turu), &obs_turu, &isim, s.get("settings").cloned().unwrap_or(json!({})));
        rec.izler = (s.get("mixers").and_then(Value::as_u64).unwrap_or(0x3F) & 0x3F) as u32;
        rec.ses = SesKaydi {
          ses: s.get("volume").and_then(Value::as_f64).unwrap_or(1.0).clamp(0.0, 20.0) as f32,
          sessiz: s.get("muted").and_then(Value::as_bool).unwrap_or(false),
          denge: s.get("balance").and_then(Value::as_f64).unwrap_or(0.5).clamp(0.0, 1.0) as f32,
          // OBS_SOURCE_FLAG_FORCE_MONO = 1 << 1
          mono: s.get("flags").and_then(Value::as_u64).unwrap_or(0) & 2 != 0,
          senkron_ms: (s.get("sync").and_then(Value::as_i64).unwrap_or(0) / 1_000_000).clamp(-950, 20_000),
          izleme: s.get("monitoring_type").and_then(Value::as_i64).unwrap_or(0).clamp(0, 2) as i32,
        };
        rec.filtreler = filtreleri_cevir(&id, s, &mut r);
        if s.get("hotkeys").and_then(Value::as_object).is_some_and(|h| h.values().any(|v| v.as_array().is_some_and(|a| !a.is_empty()))) {
          r.notlar.push(format!("«{isim}»: kısayol bağları aktarılmadı (Kısayollar sayfasından atayın)"));
        }
        k.kaynaklar.push(rec);
        r.kaynak += 1;
      }
    }
  }
  let kimlik = |o: &Value| -> Option<String> {
    o.get("source_uuid").and_then(Value::as_str).and_then(|u| uuid_kimlik.get(u)).or_else(|| o.get("name").and_then(Value::as_str).and_then(|n| ad_kimlik.get(n))).cloned()
  };
  let sahne_kimlikleri: Vec<String> = sahne_json.iter().map(|(id, _)| id.clone()).collect();
  let oge_cevir = |o: &Value, cocuklar: Vec<SahneOgesi>, grup_adi: Option<&str>| -> Option<SahneOgesi> {
    let hedef = kimlik(o)?;
    let tur = if grup_json.contains_key(&hedef) {
      OgeTuru::Grup
    } else if sahne_kimlikleri.contains(&hedef) {
      OgeTuru::Sahne
    } else {
      OgeTuru::Kaynak
    };
    Some(SahneOgesi {
      kaynak: hedef,
      tur,
      ad: grup_adi.unwrap_or("").to_string(),
      donusum: donusum(o),
      cocuklar,
      goster_gecisi: oge_gecisi(&o["show_transition"]),
      gizle_gecisi: oge_gecisi(&o["hide_transition"]),
      ..Default::default()
    })
  };
  for (sid, s) in &sahne_json {
    let mut ogeler = Vec::new();
    for o in s["settings"]["items"].as_array().into_iter().flatten() {
      let Some(hedef) = kimlik(o) else {
        r.notlar.push(format!("«{}» sahnesinde bilinmeyen öğe atlandı", s["name"].as_str().unwrap_or("?")));
        continue;
      };
      if let Some(g) = grup_json.get(&hedef) {
        let cocuklar: Vec<SahneOgesi> = g["settings"]["items"].as_array().into_iter().flatten().filter_map(|c| oge_cevir(c, Vec::new(), None)).collect();
        if let Some(mut x) = oge_cevir(o, cocuklar, g["name"].as_str()) {
          x.filtreler = filtreleri_cevir(&hedef, g, &mut r);
          ogeler.push(x);
          r.grup += 1;
        }
      } else if let Some(x) = oge_cevir(o, Vec::new(), None) {
        ogeler.push(x);
      }
    }
    let filtreler = filtreleri_cevir(sid, s, &mut r);
    k.sahneler.push(SahneKaydi { id: sid.clone(), ad: s["name"].as_str().unwrap_or("Sahne").to_string(), tuval: "ana".into(), ogeler, gecis: None, filtreler });
    r.sahne += 1;
  }
  // Sahne sırası (OBS "scene_order")
  let sira: Vec<String> = obs["scene_order"].as_array().into_iter().flatten().filter_map(|x| x["name"].as_str()).filter_map(|n| ad_kimlik.get(n).cloned()).collect();
  k.sahneler.sort_by_key(|s| sira.iter().position(|x| x == &s.id).unwrap_or(usize::MAX));
  let program = obs["current_program_scene"].as_str().or(obs["current_scene"].as_str()).and_then(|n| ad_kimlik.get(n)).cloned();
  if let Some(p) = program {
    k.program.insert("ana".into(), p);
  }
  // Geçerli geçiş: yerleşik adlar ya da `transitions` dizisindeki kayıt
  let sure = obs["transition_duration"].as_u64().unwrap_or(300).min(20_000) as u32;
  if let Some(ad) = obs["current_transition"].as_str() {
    let bulunan = obs["transitions"].as_array().into_iter().flatten().find(|t| t["name"] == ad);
    let (tur, ayarlar) = match (bulunan, ad) {
      (Some(t), _) => (t["id"].as_str().unwrap_or("fade_transition").to_string(), t.get("settings").cloned().unwrap_or(Value::Null)),
      (None, "Cut") => ("cut_transition".into(), Value::Null),
      _ => ("fade_transition".into(), Value::Null),
    };
    k.gecisler.insert("ana".into(), GecisKaydi { tur, sure_ms: sure, ayarlar });
  }
  if obs.get("canvases").and_then(Value::as_array).is_some_and(|c| !c.is_empty()) {
    r.notlar.push("Ek tuvaller (OBS 31+) aktarılmadı; tüm sahneler ana tuvalde".into());
  }
  k.duzelt();
  Ok((k, r))
}

#[cfg(test)]
mod tests {
  use super::*;

  fn ornek() -> Value {
    json!({
      "name": "Sentetik",
      "current_scene": "Oyun",
      "current_program_scene": "Oyun",
      "current_transition": "Kayar",
      "transition_duration": 450,
      "scene_order": [{"name": "Oyun"}, {"name": "Ara"}],
      "transitions": [{"name": "Kayar", "id": "slide_transition", "settings": {"direction": "left"}}],
      "sources": [
        {"name": "Arka", "uuid": "u1", "id": "color_source", "versioned_id": "color_source_v3", "settings": {"color": 4278190335u32},
         "mixers": 0, "volume": 1.0, "muted": false, "balance": 0.5, "sync": 0, "flags": 0, "monitoring_type": 0,
         "filters": [{"name": "Renk", "id": "color_filter", "versioned_id": "color_filter_v2", "enabled": false, "settings": {"opacity": 0.5}}]},
        {"name": "Müzik", "uuid": "u2", "id": "ffmpeg_source", "versioned_id": "ffmpeg_source", "settings": {"local_file": "C:/m.mp3"},
         "mixers": 255, "volume": 0.5, "muted": true, "balance": 0.25, "sync": 150000000i64, "flags": 2, "monitoring_type": 1},
        {"name": "Başlık", "uuid": "u3", "id": "text_gdiplus", "versioned_id": "text_gdiplus_v3", "settings": {"text": "Merhaba"},
         "hotkeys": {"libobs.show_scene_item.1": [{"key": "OBS_KEY_F1"}]}},
        {"name": "Ara", "uuid": "u4", "id": "scene", "versioned_id": "scene", "settings": {"items": [
          {"name": "Arka", "source_uuid": "u1", "visible": true, "locked": false, "pos": {"x": 0, "y": 0}, "scale": {"x": 1, "y": 1}, "align": 5, "bounds_type": 0}
        ]}},
        {"name": "Oyun", "uuid": "u5", "id": "scene", "versioned_id": "scene",
         "filters": [{"name": "Sahne rengi", "id": "color_filter", "versioned_id": "color_filter_v2", "settings": {"brightness": -0.2}}],
         "settings": {"items": [
          {"name": "Arka", "source_uuid": "u1", "visible": true, "locked": true, "rot": 90.0, "pos": {"x": 10, "y": 20}, "scale": {"x": 2, "y": 2},
           "align": 5, "bounds_type": 2, "bounds_align": 0, "bounds": {"x": 1920, "y": 1080}, "crop_left": 4, "crop_top": 0, "crop_right": 0, "crop_bottom": 8,
           "scale_filter": "lanczos", "blend_type": "screen",
           "show_transition": {"id": "fade_transition", "versioned_id": "fade_transition", "name": "Soldur", "transition": {}, "duration": 450},
           "hide_transition": {"duration": 300}},
          {"name": "Kamera Grubu", "source_uuid": "u6", "visible": true, "pos": {"x": 100, "y": 100}, "scale": {"x": 1, "y": 1}},
          {"name": "Ara", "source_uuid": "u4", "visible": false, "pos": {"x": 0, "y": 0}, "scale": {"x": 0.5, "y": 0.5}},
          {"name": "Yok", "source_uuid": "u99"}
        ]}}
      ],
      "groups": [
        {"name": "Kamera Grubu", "uuid": "u6", "id": "group",
         "filters": [{"name": "Grup maskesi", "id": "mask_filter", "versioned_id": "mask_filter_v2", "enabled": false, "settings": {}}],
         "settings": {"items": [
          {"name": "Başlık", "source_uuid": "u3", "visible": false, "pos": {"x": 5, "y": 6}, "scale": {"x": 1, "y": 1}},
          {"name": "Müzik", "source_uuid": "u2", "visible": true, "pos": {"x": 0, "y": 0}, "scale": {"x": 1, "y": 1}}
        ]}}
      ]
    })
  }

  #[test]
  fn obs_koleksiyonu_cevrilir() {
    let kayitli: Vec<String> = ["color_source", "color_source_v2", "color_source_v3", "ffmpeg_source", "text_gdiplus", "text_gdiplus_v3"].iter().map(|s| s.to_string()).collect();
    let (k, r) = cevir(&ornek(), "OBS: Sentetik", &kayitli).unwrap();
    assert_eq!((r.kaynak, r.sahne, r.grup, r.filtre), (3, 2, 1, 3));
    assert_eq!(k.ad, "OBS: Sentetik");
    // Sahne sırası ve program
    let adlar: Vec<&str> = k.sahneler.iter().map(|s| s.ad.as_str()).collect();
    assert_eq!(adlar, ["Oyun", "Ara"]);
    let oyun = &k.sahneler[0];
    assert_eq!(k.program["ana"], oyun.id);
    // Kaynaklar: tür, sürüm, ses, filtre
    let arka = k.kaynaklar.iter().find(|x| x.ad == "Arka").unwrap();
    assert_eq!((arka.tur.as_str(), arka.obs_turu.as_str(), arka.izler), ("renk", "color_source_v3", 0));
    assert_eq!(arka.filtreler[0].tur, "color_filter_v2");
    assert!(!arka.filtreler[0].etkin);
    let muzik = k.kaynaklar.iter().find(|x| x.ad == "Müzik").unwrap();
    assert_eq!((muzik.ses.ses, muzik.ses.sessiz, muzik.ses.denge, muzik.ses.mono, muzik.ses.senkron_ms, muzik.ses.izleme), (0.5, true, 0.25, true, 150, 1));
    assert_eq!(muzik.izler, 0x3F);
    // Öğeler: dönüşüm, grup, iç içe sahne, bilinmeyen atlandı
    assert_eq!(oyun.ogeler.len(), 3);
    let d = &oyun.ogeler[0].donusum;
    assert_eq!((d.konum, d.olcek, d.aci, d.kilit, d.sinir, d.kirp, d.olcek_filtresi, d.karistirma), ([10.0, 20.0], [2.0, 2.0], 90.0, true, Some([1920.0, 1080.0]), [4, 0, 0, 8], 4, 3));
    let g = &oyun.ogeler[1];
    assert_eq!((g.tur, g.ad.as_str(), g.cocuklar.len()), (OgeTuru::Grup, "Kamera Grubu", 2));
    assert!(!g.cocuklar[0].donusum.gorunur);
    assert_eq!(oyun.ogeler[2].tur, OgeTuru::Sahne);
    // Geçiş ve notlar
    assert_eq!(k.gecisler["ana"].tur, "slide_transition");
    assert_eq!(k.gecisler["ana"].sure_ms, 450);
    assert!(r.notlar.iter().any(|n| n.contains("kısayol")));
    // Öğe geçişleri, sahne ve grup filtreleri
    let gos = oyun.ogeler[0].goster_gecisi.as_ref().unwrap();
    assert_eq!((gos.tur.as_str(), gos.sure_ms), ("fade_transition", 450));
    assert!(oyun.ogeler[0].gizle_gecisi.is_none(), "atanmamış geçiş (yalnız süre) aktarılmaz");
    assert_eq!(oyun.filtreler.len(), 1);
    assert_eq!(oyun.filtreler[0].tur, "color_filter_v2");
    assert_eq!((g.filtreler.len(), g.filtreler[0].etkin), (1, false));
    assert!(!r.notlar.iter().any(|n| n.contains("göster/gizle")));
    assert!(r.notlar.iter().any(|n| n.contains("bilinmeyen")));
    assert!(cevir(&json!({"x": 1}), "a", &[]).is_err());
  }

  #[test]
  fn surum_secimi() {
    let k: Vec<String> = ["color_source", "color_source_v2", "color_source_v3", "text_gdiplus", "browser_source"].iter().map(|s| s.to_string()).collect();
    assert_eq!(en_yeni_surum("color_source", &k), "color_source_v3");
    assert_eq!(en_yeni_surum("color_source_v2", &k), "color_source_v3");
    assert_eq!(en_yeni_surum("text_gdiplus", &k), "text_gdiplus");
    assert_eq!(en_yeni_surum("yok_tur", &k), "yok_tur");
    assert_eq!(surumsuz("slideshow_v2"), "slideshow");
    assert_eq!(surumsuz("obs_x264"), "obs_x264");
    assert_eq!(panel_turu("text_gdiplus_v3"), "yazi");
    assert_eq!(panel_turu("vlc_source"), "obs");
  }
}
