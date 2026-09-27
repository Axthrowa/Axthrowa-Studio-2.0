//! Tek bir eklenti DLL'inin statik çözümlemesi: PE, imza, sürüm kaynağı, SHA-256, OBS 32 `manifest.json`, diller ve
//! bağımlılıkların nereden çözüleceği. Eklenti kodu çalışmaz.
//!
//! Bağımlılık arama modeli OBS 32.2.2 `os_dlopen` ile aynıdır (util/platform-windows.c): `LoadLibraryExW(tam_yol,
//! LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR | LOAD_LIBRARY_SEARCH_DEFAULT_DIRS)` → önce eklentinin kendi klasörü, sonra
//! uygulama klasörü (OBS'te `bin\64bit`; bizim motor bu klasörü AddDllDirectory ile ekler), sonra System32.
//! API kümeleri (`api-ms-win-*`, `ext-ms-*`) sistemce eşlenir.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use super::pe::{self, PeBilgisi};
use super::win::{self, Imza, SurumBilgisi};

/// OBS 32 eklenti bildirimi (`<veri>/manifest.json`, libobs obs-module.c `obs_module_load_metadata`)
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct Manifest {
  pub display_name: String,
  pub id: String,
  pub version: String,
  pub os_arch: String,
  pub name: String,
  pub description: String,
  pub urls: ManifestAdresleri,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct ManifestAdresleri {
  pub repository: String,
  pub website: String,
  pub support: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum BagimlilikYeri {
  /// Windows API kümesi (api-ms-win-*)
  ApiKumesi,
  Sistem,
  /// OBS'in uygulama klasörü (bin\64bit): obs.dll, Qt, FFmpeg…
  ObsUygulama,
  /// Eklentinin kendi klasörü (birlikte gelen kitaplık)
  EklentiKlasoru,
  Eksik,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Bagimlilik {
  pub ad: String,
  pub yer: BagimlilikYeri,
  pub gecikmeli: bool,
  /// Dolaylı bağımlılıkta: hangi birlikte gelen kitaplık üzerinden
  #[serde(skip_serializing_if = "Option::is_none")]
  pub uzerinden: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Cozumleme {
  pub dosya: PathBuf,
  /// libobs'un kullandığı modül adı: dosya adı uzantısız (`obs-module.c` get_module_name)
  pub modul: String,
  pub boyut: u64,
  pub sha256: String,
  pub pe: Option<PeBilgisi>,
  pub pe_hatasi: Option<String>,
  pub imza: Imza,
  pub surum_bilgisi: SurumBilgisi,
  pub veri_klasoru: Option<PathBuf>,
  pub manifest: Option<Manifest>,
  pub diller: Vec<String>,
  pub bagimliliklar: Vec<Bagimlilik>,
  /// obs-frontend-api.dll'e bağlı (OBS'in Qt ön yüzü olmadan menü/dock/araç özellikleri çalışmaz)
  pub on_yuz: bool,
  /// Qt'ye bağlı (arayüz öğesi kurar)
  pub qt: bool,
  /// Chromium (CEF) ya da obs-browser'a bağlı
  pub tarayici: bool,
}

/// Çözümleme bağlamı: OBS uygulama klasörü ve System32.
#[derive(Clone, Debug)]
pub struct Baglam {
  pub obs_bin: Option<PathBuf>,
  pub sistem: PathBuf,
}

impl Baglam {
  pub fn bu_makine() -> Self {
    let kok = std::env::var_os("SystemRoot").map(PathBuf::from).unwrap_or_else(|| PathBuf::from(r"C:\Windows"));
    let obs_bin = [
      std::env::var_os("ProgramFiles").map(|p| PathBuf::from(p).join("obs-studio").join("bin").join("64bit")),
      Some(PathBuf::from(r"C:\Program Files\obs-studio\bin\64bit")),
    ]
    .into_iter()
    .flatten()
    .find(|p| p.join("obs.dll").is_file());
    Self { obs_bin, sistem: kok.join("System32") }
  }
}

/// Eklenti dosyası en çok bu kadar olabilir (dev CEF paketleri bile 300 MB'ı geçmez); fazlası okunmaz.
const AZAMI_BOYUT: u64 = 512 * 1024 * 1024;

fn yer_bul(ad: &str, eklenti_klasoru: &Path, b: &Baglam) -> BagimlilikYeri {
  if ad.starts_with("api-ms-win-") || ad.starts_with("ext-ms-") {
    return BagimlilikYeri::ApiKumesi;
  }
  if eklenti_klasoru.join(ad).is_file() {
    return BagimlilikYeri::EklentiKlasoru;
  }
  if b.obs_bin.as_ref().is_some_and(|o| o.join(ad).is_file()) {
    return BagimlilikYeri::ObsUygulama;
  }
  if b.sistem.join(ad).is_file() {
    return BagimlilikYeri::Sistem;
  }
  BagimlilikYeri::Eksik
}

/// Eklentinin veri klasörü: OBS'in iki düzeni — kurulum (`<kök>/data/obs-plugins/<modül>`) ve ProgramData
/// (`<kök>/<modül>/data`). Çağıran bilinen veri yolunu verebilir.
pub fn veri_klasoru_tahmini(dll: &Path, modul: &str) -> Option<PathBuf> {
  let bin = dll.parent()?; // …/64bit
  let ust = bin.parent()?; // …/bin ya da …/obs-plugins
  let kok = ust.parent()?;
  [kok.join("data").join("obs-plugins").join(modul), kok.join("data"), ust.join("data")]
    .into_iter()
    .find(|p| p.is_dir())
}

pub fn cozumle(dll: &Path, veri: Option<&Path>, b: &Baglam) -> Result<Cozumleme, String> {
  let meta = std::fs::metadata(dll).map_err(|e| format!("okunamadı: {e}"))?;
  if !meta.is_file() {
    return Err("dosya değil".into());
  }
  if meta.len() > AZAMI_BOYUT {
    return Err(format!("dosya çok büyük ({} MB)", meta.len() / 1024 / 1024));
  }
  let baytlar = std::fs::read(dll).map_err(|e| format!("okunamadı: {e}"))?;
  let sha256 = format!("{:x}", Sha256::digest(&baytlar));
  let modul = dll.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
  let (pe, pe_hatasi) = match pe::ayristir(&baytlar) {
    Ok(p) => (Some(p), None),
    Err(e) => (None, Some(e)),
  };
  drop(baytlar);

  let klasor = dll.parent().unwrap_or(Path::new("."));
  let mut bagimliliklar = Vec::new();
  if let Some(p) = &pe {
    for ad in &p.ice_aktarimlar {
      let yer = yer_bul(ad, klasor, b);
      bagimliliklar.push(Bagimlilik { ad: ad.clone(), yer, gecikmeli: p.gecikmeli.contains(ad), uzerinden: None });
      // Birlikte gelen kitaplığın kendi bağımlılıkları (bir düzey): eksik dolaylı DLL de açılışı düşürür
      if yer == BagimlilikYeri::EklentiKlasoru {
        if let Ok(alt) = std::fs::read(klasor.join(ad)).map_err(|e| e.to_string()).and_then(|v| pe::ayristir(&v)) {
          for a in alt.ice_aktarimlar {
            let y = yer_bul(&a, klasor, b);
            if y == BagimlilikYeri::Eksik && !bagimliliklar.iter().any(|x: &Bagimlilik| x.ad == a) {
              bagimliliklar.push(Bagimlilik { ad: a, yer: y, gecikmeli: false, uzerinden: Some(ad.clone()) });
            }
          }
        }
      }
    }
  }
  let ice = |f: &dyn Fn(&str) -> bool| pe.as_ref().is_some_and(|p| p.ice_aktarimlar.iter().any(|x| f(x)));
  let on_yuz = ice(&|x| x == "obs-frontend-api.dll");
  let qt = ice(&|x| x.starts_with("qt5") || x.starts_with("qt6"));
  let tarayici = ice(&|x| x == "libcef.dll" || x.starts_with("obs-browser"));

  let veri_klasoru = veri.map(Path::to_path_buf).filter(|p| p.is_dir()).or_else(|| veri_klasoru_tahmini(dll, &modul));
  let manifest = veri_klasoru
    .as_ref()
    .and_then(|v| std::fs::read_to_string(v.join("manifest.json")).ok())
    .and_then(|t| serde_json::from_str::<Manifest>(t.trim_start_matches('\u{feff}')).ok());
  let mut diller: Vec<String> = veri_klasoru
    .as_ref()
    .and_then(|v| std::fs::read_dir(v.join("locale")).ok())
    .map(|it| {
      it.flatten()
        .filter_map(|e| {
          let p = e.path();
          if p.extension().and_then(|x| x.to_str()) != Some("ini") {
            return None;
          }
          Some(p.file_stem()?.to_string_lossy().into_owned())
        })
        .collect()
    })
    .unwrap_or_default();
  diller.sort();

  Ok(Cozumleme {
    dosya: dll.to_path_buf(),
    modul,
    boyut: meta.len(),
    sha256,
    pe,
    pe_hatasi,
    imza: win::imza(dll),
    surum_bilgisi: win::surum_bilgisi(dll),
    veri_klasoru,
    manifest,
    diller,
    bagimliliklar,
    on_yuz,
    qt,
    tarayici,
  })
}

impl Cozumleme {
  pub fn eksik_bagimliliklar(&self, gecikmeli: bool) -> Vec<&str> {
    self
      .bagimliliklar
      .iter()
      .filter(|b| b.yer == BagimlilikYeri::Eksik && b.gecikmeli == gecikmeli)
      .map(|b| b.ad.as_str())
      .collect()
  }

  /// Görüntülenecek sürüm: manifest > sürüm kaynağı (ürün, sonra dosya)
  pub fn surum(&self) -> Option<String> {
    self
      .manifest
      .as_ref()
      .map(|m| m.version.clone())
      .filter(|v| !v.is_empty())
      .or_else(|| self.surum_bilgisi.urun_surumu.clone())
      .or_else(|| self.surum_bilgisi.dosya_surumu.clone())
  }

  pub fn gorunen_ad(&self) -> String {
    self
      .manifest
      .as_ref()
      .map(|m| if m.display_name.is_empty() { m.name.clone() } else { m.display_name.clone() })
      .filter(|s| !s.is_empty())
      // Dosya açıklaması modüle özgüdür ("OBS FFmpeg module"); ürün adı paketle ortak olabilir ("OBS Studio")
      .or_else(|| self.surum_bilgisi.aciklama.clone())
      .or_else(|| self.surum_bilgisi.urun_adi.clone())
      .unwrap_or_else(|| self.modul.clone())
  }

  pub fn satici(&self) -> Option<String> {
    self.imza.imzalayan().map(str::to_string).or_else(|| self.surum_bilgisi.sirket.clone())
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  fn test_dll(ad: &str) -> Option<PathBuf> {
    let p = Path::new(env!("CARGO_MANIFEST_DIR")).join("../motor/test-eklentileri/target/release").join(format!("{ad}.dll"));
    p.is_file().then_some(p)
  }

  #[test]
  fn sahte_klasorde_bagimlilik_yerleri() {
    let kok = std::env::temp_dir().join(format!("yya-cozum-{}", std::process::id()));
    let (eklenti, obs, sistem) = (kok.join("eklenti"), kok.join("obs"), kok.join("sistem"));
    for d in [&eklenti, &obs, &sistem] {
      std::fs::create_dir_all(d).unwrap();
    }
    std::fs::write(eklenti.join("birlikte.dll"), pe::tests::kucuk_pe(0x8664, &[], &["dolayli-yok.dll", "kernel32.dll"])).unwrap();
    std::fs::write(obs.join("obs.dll"), b"x").unwrap();
    std::fs::write(sistem.join("kernel32.dll"), b"x").unwrap();
    let dll = eklenti.join("benim-eklentim.dll");
    let ice = ["obs.dll", "kernel32.dll", "birlikte.dll", "yok.dll", "api-ms-win-crt-runtime-l1-1-0.dll", "obs-frontend-api.dll", "qt6core.dll"];
    std::fs::write(&dll, pe::tests::kucuk_pe(0x8664, &["obs_module_load", "obs_module_set_pointer", "obs_module_ver"], &ice)).unwrap();
    let veri = kok.join("veri");
    std::fs::create_dir_all(veri.join("locale")).unwrap();
    std::fs::write(veri.join("locale").join("tr-TR.ini"), "A=B").unwrap();
    std::fs::write(veri.join("locale").join("en-US.ini"), "A=B").unwrap();
    std::fs::write(veri.join("manifest.json"), r#"{"display_name":"Benim","id":"com.ornek.benim","version":"1.2.0","os_arch":"x64"}"#).unwrap();

    let b = Baglam { obs_bin: Some(obs.clone()), sistem: sistem.clone() };
    let c = cozumle(&dll, Some(&veri), &b).unwrap();
    let yer = |ad: &str| c.bagimliliklar.iter().find(|x| x.ad == ad).map(|x| x.yer);
    assert_eq!(yer("obs.dll"), Some(BagimlilikYeri::ObsUygulama));
    assert_eq!(yer("kernel32.dll"), Some(BagimlilikYeri::Sistem));
    assert_eq!(yer("birlikte.dll"), Some(BagimlilikYeri::EklentiKlasoru));
    assert_eq!(yer("api-ms-win-crt-runtime-l1-1-0.dll"), Some(BagimlilikYeri::ApiKumesi));
    // İçe aktarımlar sıralı; dolaylı olan, üzerinden geldiği kitaplığın hemen ardından
    assert_eq!(c.eksik_bagimliliklar(false), ["dolayli-yok.dll", "obs-frontend-api.dll", "qt6core.dll", "yok.dll"]);
    let dolayli = c.bagimliliklar.iter().find(|x| x.ad == "dolayli-yok.dll").unwrap();
    assert_eq!(dolayli.uzerinden.as_deref(), Some("birlikte.dll"));
    assert!(c.on_yuz && c.qt && !c.tarayici);
    assert_eq!(c.modul, "benim-eklentim");
    assert_eq!(c.diller, ["en-US", "tr-TR"]);
    assert_eq!(c.gorunen_ad(), "Benim");
    assert_eq!(c.surum().as_deref(), Some("1.2.0"));
    assert_eq!(c.sha256.len(), 64);
    let _ = std::fs::remove_dir_all(&kok);
  }

  #[test]
  fn kendi_test_eklentilerimiz() {
    let b = Baglam::bu_makine();
    if let Some(p) = test_dll("yym_test_kaynak") {
      let c = cozumle(&p, None, &b).unwrap();
      let pe = c.pe.as_ref().unwrap();
      assert!(pe.obs_eklentisi() && pe.eksik_zorunlu().is_empty(), "{:?}", pe.disa_aktarimlar);
      assert!(pe.ice_aktarir("obs.dll"));
      assert!(!c.on_yuz && !c.qt);
      if b.obs_bin.is_some() {
        assert!(c.eksik_bagimliliklar(false).is_empty(), "{:?}", c.bagimliliklar);
      }
    }
    if let Some(p) = test_dll("yym_test_eksik_bagimlilik") {
      let c = cozumle(&p, None, &b).unwrap();
      assert_eq!(c.eksik_bagimliliklar(false), ["yym-olmayan-kutuphane.dll"]);
    }
    if let Some(p) = test_dll("yym_test_onyuz") {
      assert!(cozumle(&p, None, &b).unwrap().on_yuz);
    }
  }
}
