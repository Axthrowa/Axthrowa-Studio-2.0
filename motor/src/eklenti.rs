//! Üçüncü taraf OBS eklentilerinin motor içinde yüklenmesi, yalıtılmış yoklama ve genel özellik (property) API'si.
//!
//! Yükleme sırası libobs'un `load_all_callback`'iyle aynıdır (obs-module.c): `obs_open_module` → (başarıda)
//! `obs_init_module` → yalnız yeni modülün `obs_module_post_load`'u. Her eklentiden önce **yükleme işareti**
//! dosyası yazılır, yükleme bitince silinir: süreç eklentinin `obs_module_load`'unda çökerse dosya kalır ve panel
//! şüpheli eklentiyi adıyla bilir (OBS'in güvenli kipi yalnız "temiz kapanmadı" bilgisini tutar).
//!
//! Sanal alan (sandbox) YOKTUR: yüklenen eklenti bu süreçte, kullanıcının yetkileriyle çalışır.

use std::collections::BTreeSet;
use std::ffi::c_char;
use std::path::Path;
use std::time::Instant;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::obs::{self, api, cs, cstr, Ptr};

#[derive(Clone, Debug, Deserialize)]
pub struct EklentiIstegi {
  /// Panelin kayıt defterindeki kimlik (modül adı)
  pub id: String,
  pub dll: String,
  #[serde(default)]
  pub veri: String,
}

#[derive(Clone, Debug, Default, Serialize, PartialEq, Eq, PartialOrd, Ord)]
pub struct KayitliTur {
  pub id: String,
  /// kaynak | filtre | gecis | cikis | kodlayici | servis
  pub tur: String,
  pub ad: String,
}

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EklentiSonucu {
  pub id: String,
  /// yuklendi | acilamadi | eksik_disa | surum | baslatilamadi | atlandi | hata
  pub sonuc: String,
  pub kod: i32,
  pub api_surumu: u32,
  pub turler: Vec<KayitliTur>,
  pub ad: String,
  pub aciklama: String,
  pub yazar: String,
  pub sure_ms: u64,
}

fn turleri_topla() -> BTreeSet<(String, String)> {
  let a = api();
  let mut s = BTreeSet::new();
  let listeler: [(&str, unsafe extern "C" fn(usize, *mut *const c_char) -> bool); 6] = [
    ("kaynak", a.obs_enum_input_types),
    ("filtre", a.obs_enum_filter_types),
    ("gecis", a.obs_enum_transition_types),
    ("cikis", a.obs_enum_output_types),
    ("kodlayici", a.obs_enum_encoder_types),
    ("servis", a.obs_enum_service_types),
  ];
  for (tur, f) in listeler {
    for i in 0.. {
      let mut id: *const c_char = std::ptr::null();
      if !unsafe { f(i, &mut id) } || id.is_null() {
        break;
      }
      s.insert((tur.to_string(), unsafe { cstr(id) }));
    }
  }
  s
}

fn gorunen_ad(tur: &str, id: &str) -> String {
  let a = api();
  let c = cs(id);
  let p = unsafe {
    match tur {
      "cikis" => (a.obs_output_get_display_name)(c.as_ptr()),
      "kodlayici" => (a.obs_encoder_get_display_name)(c.as_ptr()),
      "servis" => (a.obs_service_get_display_name)(c.as_ptr()),
      _ => (a.obs_source_get_display_name)(c.as_ptr()),
    }
  };
  unsafe { cstr(p) }
}

#[cfg(windows)]
mod win {
  use super::Ptr;
  #[link(name = "kernel32")]
  extern "system" {
    pub fn GetProcAddress(modul: Ptr, ad: *const i8) -> Ptr;
    pub fn GetModuleHandleW(ad: *const u16) -> Ptr;
  }
}

/// Modülün isteğe bağlı dışa aktarımını çağırır (yalnız bu modül için; `obs_post_load_modules` hepsini çağırırdı).
fn post_load(lib: Ptr) {
  if lib.is_null() {
    return;
  }
  #[cfg(windows)]
  unsafe {
    let f = win::GetProcAddress(lib, c"obs_module_post_load".as_ptr());
    if !f.is_null() {
      let f: unsafe extern "C" fn() = std::mem::transmute(f);
      f();
    }
  }
}

pub fn modul_post_load(modul: Ptr) {
  if !modul.is_null() {
    post_load(unsafe { (api().obs_get_module_lib)(modul) });
  }
}

/// `obs_module_ver()` — modül açılmış (ya da sürüm reddinde sızmış) kitaplıktan okunur.
fn api_surumu(lib: Ptr) -> u32 {
  if lib.is_null() {
    return 0;
  }
  #[cfg(windows)]
  unsafe {
    let f = win::GetProcAddress(lib, c"obs_module_ver".as_ptr());
    if !f.is_null() {
      let f: unsafe extern "C" fn() -> u32 = std::mem::transmute(f);
      return f();
    }
  }
  0
}

#[cfg(windows)]
fn yuklu_kitaplik(dll: &str) -> Ptr {
  let genis: Vec<u16> = dll.replace('/', "\\").encode_utf16().chain(std::iter::once(0)).collect();
  unsafe { win::GetModuleHandleW(genis.as_ptr()) }
}

#[cfg(not(windows))]
fn yuklu_kitaplik(_dll: &str) -> Ptr {
  std::ptr::null_mut()
}

/// İşaret dosyası: yükleme boyunca var olur. Yazma hatası yüklemeyi durdurmaz (işaret yalnız tanı içindir).
fn isaret_yaz(yol: Option<&Path>, istek: &EklentiIstegi) {
  if let Some(y) = yol {
    let v = json!({ "id": istek.id, "dll": istek.dll, "zaman": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0) });
    if let Ok(mut f) = std::fs::File::create(y) {
      use std::io::Write;
      let _ = f.write_all(v.to_string().as_bytes());
      let _ = f.sync_all();
    }
  }
}

fn isaret_sil(yol: Option<&Path>) {
  if let Some(y) = yol {
    let _ = std::fs::remove_file(y);
  }
}

/// Tek bir üçüncü taraf eklentiyi yükler. Modül işaretçisini de döndürür (başarıda).
pub fn yukle(istek: &EklentiIstegi, isaret: Option<&Path>) -> (EklentiSonucu, Option<Ptr>) {
  let a = api();
  let bas = Instant::now();
  let mut s = EklentiSonucu { id: istek.id.clone(), ..Default::default() };
  if !Path::new(&istek.dll).is_file() {
    s.sonuc = "hata".into();
    s.aciklama = "dosya yok".into();
    return (s, None);
  }
  let once = turleri_topla();
  let (dll_c, veri_c) = (cs(&crate::obs::obs_yolu(&istek.dll)), cs(&crate::obs::obs_yolu(&istek.veri)));
  let mut modul: Ptr = std::ptr::null_mut();
  isaret_yaz(isaret, istek);
  let kod = unsafe { (a.obs_open_module)(&mut modul, dll_c.as_ptr(), veri_c.as_ptr()) };
  s.kod = kod;
  let mut acik = None;
  match kod {
    obs::MODULE_SUCCESS if !modul.is_null() => {
      let lib = unsafe { (a.obs_get_module_lib)(modul) };
      s.api_surumu = api_surumu(lib);
      let basladi = unsafe { (a.obs_init_module)(modul) };
      if basladi {
        post_load(lib);
        s.sonuc = "yuklendi".into();
        acik = Some(modul);
      } else {
        s.sonuc = "baslatilamadi".into();
      }
      unsafe {
        s.ad = cstr((a.obs_get_module_name)(modul));
        s.aciklama = cstr((a.obs_get_module_description)(modul));
        s.yazar = cstr((a.obs_get_module_author)(modul));
      }
    }
    obs::MODULE_FAILED_TO_OPEN => s.sonuc = "acilamadi".into(),
    obs::MODULE_MISSING_EXPORTS => s.sonuc = "eksik_disa".into(),
    obs::MODULE_INCOMPATIBLE_VER => {
      s.sonuc = "surum".into();
      // libobs sürümü reddedince kitaplığı kapatmaz; sürümü okumak için hâlâ yüklü tutamak kullanılır
      s.api_surumu = api_surumu(yuklu_kitaplik(&istek.dll));
    }
    obs::MODULE_HARDCODED_SKIP => s.sonuc = "atlandi".into(),
    obs::MODULE_ERROR => s.sonuc = "hata".into(),
    _ => {
      s.sonuc = "hata".into();
      s.aciklama = format!("beklenmeyen libobs kodu {kod}");
    }
  }
  isaret_sil(isaret);
  let sonra = turleri_topla();
  s.turler = sonra
    .difference(&once)
    .map(|(tur, id)| KayitliTur { ad: gorunen_ad(tur, id), id: id.clone(), tur: tur.clone() })
    .collect();
  s.sure_ms = bas.elapsed().as_millis() as u64;
  (s, acik)
}

// ─── Özellikler (plugin property UI'ı panelin formlarıyla) ─────────────────────

fn ozellik_listesi(props: Ptr, gizliler: &mut Vec<String>) -> Vec<Value> {
  let a = api();
  let mut out = Vec::new();
  let mut p = unsafe { (a.obs_properties_first)(props) };
  while !p.is_null() {
    let tur = unsafe { (a.obs_property_get_type)(p) };
    let ad = unsafe { cstr((a.obs_property_name)(p)) };
    let mut v = json!({
      "ad": ad,
      "aciklama": unsafe { cstr((a.obs_property_description)(p)) },
      "gorunur": unsafe { (a.obs_property_visible)(p) },
      "etkin": unsafe { (a.obs_property_enabled)(p) },
    });
    let uzun = unsafe { cstr((a.obs_property_long_description)(p)) };
    if !uzun.is_empty() {
      v["ipucu"] = json!(uzun);
    }
    let tur_adi = match tur {
      obs::OBS_PROPERTY_BOOL => "bool",
      obs::OBS_PROPERTY_INT => {
        unsafe {
          v["min"] = json!((a.obs_property_int_min)(p));
          v["max"] = json!((a.obs_property_int_max)(p));
          v["adim"] = json!((a.obs_property_int_step)(p));
          v["sonek"] = json!(cstr((a.obs_property_int_suffix)(p)));
        }
        "int"
      }
      obs::OBS_PROPERTY_FLOAT => {
        unsafe {
          v["min"] = json!((a.obs_property_float_min)(p));
          v["max"] = json!((a.obs_property_float_max)(p));
          v["adim"] = json!((a.obs_property_float_step)(p));
          v["sonek"] = json!(cstr((a.obs_property_float_suffix)(p)));
        }
        "float"
      }
      obs::OBS_PROPERTY_TEXT => {
        let t = unsafe { (a.obs_property_text_type)(p) };
        const METIN_TURLERI: [&str; 4] = ["normal", "parola", "cok_satir", "bilgi"];
        v["metinTuru"] = json!(METIN_TURLERI.get(t as usize).copied().unwrap_or("normal"));
        if t == obs::OBS_TEXT_PASSWORD {
          gizliler.push(ad.clone());
        }
        "text"
      }
      obs::OBS_PROPERTY_PATH => {
        const YOL_TURLERI: [&str; 3] = ["dosya", "kayit_dosyasi", "klasor"];
        v["yolTuru"] = json!(YOL_TURLERI.get(unsafe { (a.obs_property_path_type)(p) } as usize).copied().unwrap_or("dosya"));
        "path"
      }
      obs::OBS_PROPERTY_LIST => {
        let bicim = unsafe { (a.obs_property_list_format)(p) };
        let n = unsafe { (a.obs_property_list_item_count)(p) }.min(2000);
        let ogeler: Vec<Value> = (0..n)
          .map(|i| unsafe {
            let deger = match bicim {
              obs::OBS_COMBO_FORMAT_INT => json!((a.obs_property_list_item_int)(p, i)),
              obs::OBS_COMBO_FORMAT_FLOAT => json!((a.obs_property_list_item_float)(p, i)),
              obs::OBS_COMBO_FORMAT_BOOL => json!((a.obs_property_list_item_bool)(p, i)),
              _ => json!(cstr((a.obs_property_list_item_string)(p, i))),
            };
            json!({"ad": cstr((a.obs_property_list_item_name)(p, i)), "deger": deger, "devreDisi": (a.obs_property_list_item_disabled)(p, i)})
          })
          .collect();
        const LISTE_TURLERI: [&str; 4] = ["", "duzenlenebilir", "liste", "secenek"];
        const BICIMLER: [&str; 5] = ["", "int", "float", "string", "bool"];
        let liste_turu = LISTE_TURLERI.get(unsafe { (a.obs_property_list_type)(p) } as usize).copied().unwrap_or("liste");
        let bicim_adi = BICIMLER.get(bicim as usize).copied().unwrap_or("string");
        v["liste"] = json!({ "tur": liste_turu, "bicim": bicim_adi, "ogeler": ogeler });
        "list"
      }
      obs::OBS_PROPERTY_COLOR => "color",
      obs::OBS_PROPERTY_COLOR_ALPHA => "color_alpha",
      obs::OBS_PROPERTY_BUTTON => "button",
      obs::OBS_PROPERTY_FONT => "font",
      obs::OBS_PROPERTY_EDITABLE_LIST => "editable_list",
      obs::OBS_PROPERTY_FRAME_RATE => "frame_rate",
      obs::OBS_PROPERTY_GROUP => {
        let icerik = unsafe { (a.obs_property_group_content)(p) };
        if !icerik.is_null() {
          v["grup"] = json!(ozellik_listesi(icerik, gizliler));
        }
        "group"
      }
      _ => "bilinmeyen",
    };
    v["tur"] = json!(tur_adi);
    out.push(v);
    if !unsafe { (a.obs_property_next)(&mut p) } {
      break;
    }
  }
  out
}

/// Kaynağın özellik tanımları ve güncel ayarları. Parola türündeki alanların DEĞERİ döndürülmez (yalnız dolu mu).
pub fn ozellikler(kaynak: Ptr) -> Result<Value, String> {
  let a = api();
  let ayar = unsafe { (a.obs_source_get_settings)(kaynak) };
  let props = unsafe { (a.obs_source_properties)(kaynak) };
  Ok(tanim_uret(props, ayar))
}

/// Kodlayıcı türünün özellik tanımı ve varsayılan ayarları (Uzman kip formu)
pub fn kodlayici_ozellikleri(tur: &str) -> Result<Value, String> {
  let a = api();
  let t = cs(tur);
  let ayar = unsafe { (a.obs_encoder_defaults)(t.as_ptr()) };
  if ayar.is_null() {
    return Err(format!("kodlayıcı türü yok: {tur}"));
  }
  let props = unsafe { (a.obs_get_encoder_properties)(t.as_ptr()) };
  Ok(tanim_uret(props, ayar))
}

/// Kaynak türünün özellik formu ve varsayılanları — **örnek oluşturmadan** (`obs_get_source_properties`). Yakalama
/// türleri için güvenli yol: oyun yakalama örneği oluşturmak çalışan bir oyuna kanca atmayı başlatabilirdi.
pub fn kaynak_turu_ozellikleri(tur: &str) -> Result<Value, String> {
  let a = api();
  let t = cs(tur);
  let ayar = unsafe { (a.obs_get_source_defaults)(t.as_ptr()) };
  if ayar.is_null() {
    return Err(format!("kaynak türü kayıtlı değil: {tur}"));
  }
  let props = unsafe { (a.obs_get_source_properties)(t.as_ptr()) };
  Ok(tanim_uret(props, ayar))
}

/// Belirli bir kategorideki kayıtlı libobs türleri (ör. `cikis`)
pub fn kayitli_turler(kategori: &str) -> Vec<String> {
  turleri_topla().into_iter().filter(|(t, _)| t == kategori).map(|(_, id)| id).collect()
}

/// Özellikler + ayar nesnesinden form tanımı; ikisini de bırakır. Parola değerleri çıkarılır.
fn tanim_uret(props: Ptr, ayar: Ptr) -> Value {
  let a = api();
  if props.is_null() {
    unsafe { (a.obs_data_release)(ayar) };
    return json!({"ozellikler": [], "ayarlar": {}});
  }
  // Değiştirilince görünürlüğü değişen alanlar (modified geri çağrıları) güncel ayarla bir kez çalışır
  unsafe { (a.obs_properties_apply_settings)(props, ayar) };
  // Varsayılanlar dahil: kaynağın hiç değiştirilmemiş alanları da formda gerçek değeriyle görünsün
  let mut ayarlar: Value = serde_json::from_str(&unsafe { cstr((a.obs_data_get_json_with_defaults)(ayar)) }).unwrap_or(json!({}));
  let mut gizliler = Vec::new();
  let liste = ozellik_listesi(props, &mut gizliler);
  unsafe {
    (a.obs_properties_destroy)(props);
    (a.obs_data_release)(ayar);
  }
  let mut dolu_gizli = serde_json::Map::new();
  if let Some(m) = ayarlar.as_object_mut() {
    for g in gizliler {
      let dolu = m.get(&g).and_then(Value::as_str).is_some_and(|s| !s.is_empty());
      m.remove(&g);
      dolu_gizli.insert(g, json!(dolu));
    }
  }
  json!({"ozellikler": liste, "ayarlar": ayarlar, "gizliDolu": dolu_gizli})
}

/// Ayarları kaynağa uygular (yalnız verilen alanlar değişir; `obs_source_update` birleştirir).
pub fn guncelle(kaynak: Ptr, ayarlar: &serde_json::Map<String, Value>) -> Result<(), String> {
  let a = api();
  let metin = Value::Object(ayarlar.clone()).to_string();
  if metin.len() > 256 * 1024 {
    return Err("ayarlar çok büyük".into());
  }
  let veri = unsafe { (a.obs_data_create_from_json)(cs(&metin).as_ptr()) };
  if veri.is_null() {
    return Err("ayarlar okunamadı".into());
  }
  unsafe {
    (a.obs_source_update)(kaynak, veri);
    (a.obs_data_release)(veri);
  }
  Ok(())
}
