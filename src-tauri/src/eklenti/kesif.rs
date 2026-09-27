//! Eklenti keşfi: OBS'in bilinen konumları (resmi belgelerle ve OBS 32.2.2 kaynağıyla aynı) ve kullanıcının eklediği
//! klasörler taranır; OBS'in kendi eklenti yöneticisinin durum dosyası (modules.json) okunur. Hepsi salt-okunur;
//! tarama kullanıcı izin verince yapılır, hiçbir dosya kopyalanmaz/değiştirilmez.
//!
//! Konumlar (Windows):
//! - Kurulum (eski/"legacy"): `<OBS>\obs-plugins\64bit\<modül>.dll`, veri `<OBS>\data\obs-plugins\<modül>\`
//!   (libobs obs-windows.c `module_bin`/`module_data`)
//! - Önerilen: `%ProgramData%\obs-studio\plugins\<modül>\bin\64bit\<modül>.dll`, veri `...\<modül>\data\`
//!   (frontend/widgets/OBSBasic.cpp `AddExtraModulePaths`; obsproject.com/kb/plugins-guide)
//! - Ortam: `OBS_PLUGINS_PATH` (+ `OBS_PLUGINS_DATA_PATH\<modül>`)

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use super::kayit::KonumTuru;

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Aday {
  pub modul: String,
  pub dll: PathBuf,
  pub veri: Option<PathBuf>,
  pub konum: KonumTuru,
}

/// OBS kurulum kökü (`...\obs-studio`) — obs.dll'in bulunduğu bin\64bit'in iki üstü.
pub fn obs_kok() -> Option<PathBuf> {
  super::cozumleme::Baglam::bu_makine().obs_bin.and_then(|b| b.parent()?.parent().map(Path::to_path_buf))
}

pub fn programdata_kok() -> Option<PathBuf> {
  std::env::var_os("ProgramData").map(|p| PathBuf::from(p).join("obs-studio").join("plugins"))
}

/// Bu makinede bilinen OBS eklenti konumları (var olsun olmasın; arayüz "bulunamadı" gösterir).
pub fn bilinen_konumlar() -> Vec<(KonumTuru, PathBuf)> {
  let mut v = Vec::new();
  if let Some(k) = obs_kok() {
    v.push((KonumTuru::ObsKurulum, k.join("obs-plugins").join("64bit")));
  }
  if let Some(p) = programdata_kok() {
    v.push((KonumTuru::ProgramData, p));
  }
  if let Some(p) = std::env::var_os("OBS_PLUGINS_PATH") {
    v.push((KonumTuru::Ozel, PathBuf::from(p)));
  }
  v
}

fn dll_mi(p: &Path) -> bool {
  p.extension().and_then(|e| e.to_str()).is_some_and(|e| e.eq_ignore_ascii_case("dll"))
}

fn modul_adi(p: &Path) -> String {
  p.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default()
}

/// Bir konumdaki aday DLL'ler (OBS eklentisi olup olmadıkları çözümlemede anlaşılır).
pub fn tara(yol: &Path, tur: KonumTuru) -> Vec<Aday> {
  let mut out = Vec::new();
  let Ok(it) = std::fs::read_dir(yol) else { return out };
  let mut girdiler: Vec<PathBuf> = it.flatten().map(|e| e.path()).collect();
  girdiler.sort();
  for p in girdiler {
    if p.is_dir() {
      // ProgramData düzeni: <modül>\bin\64bit\<modül>.dll + <modül>\data
      let m = modul_adi(&p);
      let dll = p.join("bin").join("64bit").join(format!("{m}.dll"));
      if dll.is_file() {
        let veri = p.join("data");
        out.push(Aday { modul: m, dll, veri: veri.is_dir().then_some(veri), konum: tur });
      }
    } else if dll_mi(&p) {
      // Düz düzen (kurulum klasörü ya da özel klasör)
      let m = modul_adi(&p);
      let veri = match tur {
        KonumTuru::ObsKurulum => yol.parent().and_then(Path::parent).map(|k| k.join("data").join("obs-plugins").join(&m)),
        _ => std::env::var_os("OBS_PLUGINS_DATA_PATH")
          .map(|d| PathBuf::from(d).join(&m))
          .filter(|d| d.is_dir())
          .or_else(|| Some(yol.join("data").join(&m))),
      };
      out.push(Aday { modul: m, dll: p, veri: veri.filter(|v| v.is_dir()), konum: tur });
    }
  }
  out
}

/// OBS 32 eklenti yöneticisinin durum dosyası (`%APPDATA%\obs-studio\plugin_manager\modules.json`,
/// frontend/plugin-manager/PluginManager.cpp). Yalnız devre dışı bırakılabilen (üçüncü taraf) modülleri listeler.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct ObsModulu {
  pub display_name: String,
  pub module_name: String,
  pub id: String,
  pub version: String,
  pub enabled: bool,
  pub sources: Vec<String>,
  pub outputs: Vec<String>,
  pub encoders: Vec<String>,
  pub services: Vec<String>,
}

pub fn obs_modul_dosyasi() -> Option<PathBuf> {
  std::env::var_os("APPDATA").map(|a| PathBuf::from(a).join("obs-studio").join("plugin_manager").join("modules.json"))
}

pub fn obs_modulleri_oku(dosya: &Path) -> Vec<ObsModulu> {
  std::fs::read_to_string(dosya)
    .ok()
    .and_then(|t| serde_json::from_str::<Vec<ObsModulu>>(t.trim_start_matches('\u{feff}')).ok())
    .unwrap_or_default()
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn iki_duzen_ve_obs_modul_dosyasi() {
    let kok = std::env::temp_dir().join(format!("yya-kesif-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&kok);
    // ProgramData düzeni
    let pd = kok.join("pd");
    std::fs::create_dir_all(pd.join("benim").join("bin").join("64bit")).unwrap();
    std::fs::create_dir_all(pd.join("benim").join("data").join("locale")).unwrap();
    std::fs::write(pd.join("benim").join("bin").join("64bit").join("benim.dll"), b"MZ").unwrap();
    std::fs::create_dir_all(pd.join("yarim").join("bin")).unwrap(); // DLL'siz klasör aday değil
    let a = tara(&pd, KonumTuru::ProgramData);
    assert_eq!(a.len(), 1);
    assert_eq!(a[0].modul, "benim");
    assert!(a[0].veri.as_ref().unwrap().ends_with("data"));
    // Kurulum düzeni
    let obs = kok.join("obs-studio");
    std::fs::create_dir_all(obs.join("obs-plugins").join("64bit")).unwrap();
    std::fs::create_dir_all(obs.join("data").join("obs-plugins").join("x")).unwrap();
    std::fs::write(obs.join("obs-plugins").join("64bit").join("x.dll"), b"MZ").unwrap();
    std::fs::write(obs.join("obs-plugins").join("64bit").join("x.pdb"), b"").unwrap();
    let b = tara(&obs.join("obs-plugins").join("64bit"), KonumTuru::ObsKurulum);
    assert_eq!(b.len(), 1);
    assert_eq!(b[0].veri.as_deref(), Some(obs.join("data").join("obs-plugins").join("x").as_path()));
    // OBS modules.json
    let m = kok.join("modules.json");
    std::fs::write(&m, r#"[{"display_name":"","module_name":"logi","id":"","version":"","enabled":true,"sources":["a"],"outputs":[],"encoders":[],"services":[]}]"#).unwrap();
    let l = obs_modulleri_oku(&m);
    assert_eq!(l[0].module_name, "logi");
    assert_eq!(l[0].sources, ["a"]);
    assert!(obs_modulleri_oku(&kok.join("yok.json")).is_empty());
    let _ = std::fs::remove_dir_all(&kok);
  }
}
