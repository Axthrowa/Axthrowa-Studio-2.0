//! Eklenti paketi: zip ya da klasör → hazırlık (inceleme ekranı) → kullanıcı onayıyla yönetilen klasöre kurulum.
//!
//! Kurallar:
//! - Paketteki kurulum programı (.exe/.msi/betik) ÇALIŞTIRILMAZ; yalnız kullanıcıya gösterilir.
//! - Yalnız yönetilen klasöre yazılır (`<veri>/eklentiler/kurulu/<modül>/bin/64bit`, `.../data` — OBS'in ProgramData
//!   düzeniyle aynı). OBS kurulumu ve ProgramData'ya dokunulmaz.
//! - Güncellemede eski sürüm silinmez, `<veri>/eklentiler/yedek/<modül>-<zaman>` altına taşınır; geri alma ve
//!   kaldırma da taşıma ile yapılır (kalıcı silme yok).

use std::path::{Path, PathBuf};

use serde::Serialize;

use super::kayit::{simdi, Yedek};
use super::pe;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaketAdayi {
  pub modul: String,
  pub dll: PathBuf,
  pub veri: Option<PathBuf>,
  /// Aynı klasördeki, OBS eklentisi olmayan kitaplıklar (birlikte kopyalanır)
  pub yardimcilar: Vec<PathBuf>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Hazirlik {
  pub kimlik: String,
  pub kok: PathBuf,
  /// Zip'ten açıldıysa kurulumdan/vazgeçmeden sonra silinecek geçici klasör
  pub gecici: bool,
  pub adaylar: Vec<PaketAdayi>,
  pub kurulum_programlari: Vec<String>,
  pub betikler: Vec<String>,
  pub diger_dll: usize,
  pub dosya_sayisi: usize,
}

const AZAMI_ZIP: u64 = 512 * 1024 * 1024;
const AZAMI_DOSYA: usize = 20_000;

fn uzanti(p: &Path) -> String {
  p.extension().and_then(|e| e.to_str()).map(str::to_ascii_lowercase).unwrap_or_default()
}

fn dolas(kok: &Path, derinlik: usize, out: &mut Vec<PathBuf>) {
  if derinlik > 10 || out.len() >= AZAMI_DOSYA {
    return;
  }
  let Ok(it) = std::fs::read_dir(kok) else { return };
  for e in it.flatten() {
    let p = e.path();
    // Sembolik bağlantı izlenmez (paket dışına çıkılmasın)
    let Ok(t) = e.file_type() else { continue };
    if t.is_symlink() {
      continue;
    }
    if t.is_dir() {
      dolas(&p, derinlik + 1, out);
    } else if out.len() < AZAMI_DOSYA {
      out.push(p);
    }
  }
}

/// Modül adı dosya/klasör adı olarak güvenli mi (yol ayırıcı, üst dizin, denetim karakteri yok)?
pub fn gecerli_modul(m: &str) -> bool {
  !m.is_empty()
    && m.len() <= 100
    && m != "."
    && m != ".."
    && m.chars().all(|c| c.is_alphanumeric() || "-_. ".contains(c))
}

fn veri_bul(dll: &Path, modul: &str) -> Option<PathBuf> {
  let bin = dll.parent()?;
  let adaylar = [
    // <m>\bin\64bit\<m>.dll → <m>\data
    bin.parent().and_then(Path::parent).map(|k| k.join("data")),
    // obs-plugins\64bit\<m>.dll → data\obs-plugins\<m>
    bin.parent().and_then(Path::parent).map(|k| k.join("data").join("obs-plugins").join(modul)),
    Some(bin.join("data").join(modul)),
    Some(bin.join(modul)),
    Some(bin.join("data")),
  ];
  adaylar.into_iter().flatten().find(|p| p.is_dir() && (p.join("locale").is_dir() || p.join("manifest.json").is_file() || p.ends_with(modul)))
}

pub fn hazirla(kaynak: &Path, hazirlik_kok: &Path) -> Result<Hazirlik, String> {
  let kimlik = uuid::Uuid::new_v4().simple().to_string();
  let (kok, gecici) = if kaynak.is_dir() {
    (kaynak.to_path_buf(), false)
  } else if uzanti(kaynak) == "zip" {
    let boyut = std::fs::metadata(kaynak).map_err(|e| format!("okunamadı: {e}"))?.len();
    if boyut > AZAMI_ZIP {
      return Err("zip 512 MB'tan büyük".into());
    }
    let baytlar = std::fs::read(kaynak).map_err(|e| format!("okunamadı: {e}"))?;
    let hedef = hazirlik_kok.join(&kimlik);
    std::fs::create_dir_all(&hedef).map_err(|e| e.to_string())?;
    if let Err(e) = super::zip::ac(&baytlar, &hedef) {
      let _ = std::fs::remove_dir_all(&hedef);
      return Err(e);
    }
    (hedef, true)
  } else if uzanti(kaynak) == "dll" {
    // Tek DLL: bulunduğu klasör incelenir ama yalnız bu DLL aday olur
    let klasor = kaynak.parent().ok_or("klasör yok")?.to_path_buf();
    let mut h = hazirla(&klasor, hazirlik_kok)?;
    h.adaylar.retain(|a| a.dll == kaynak);
    return Ok(h);
  } else if ["exe", "msi"].contains(&uzanti(kaynak).as_str()) {
    return Err("Bu bir kurulum programı. Güvenlik nedeniyle çalıştırılmaz: üreticinin kurulumunu kendiniz çalıştırın ya da zip/klasör sürümünü seçin.".into());
  } else {
    return Err("Desteklenen: .zip, klasör ya da tek .dll".into());
  };

  let mut dosyalar = Vec::new();
  dolas(&kok, 0, &mut dosyalar);
  let goreli = |p: &Path| p.strip_prefix(&kok).unwrap_or(p).to_string_lossy().into_owned();
  let mut kurulum = Vec::new();
  let mut betikler = Vec::new();
  let mut eklenti_dll = Vec::new();
  let mut diger = Vec::new();
  for p in &dosyalar {
    match uzanti(p).as_str() {
      "exe" | "msi" | "bat" | "cmd" | "ps1" | "vbs" => kurulum.push(goreli(p)),
      "lua" | "py" => betikler.push(goreli(p)),
      "dll" => {
        let obs = std::fs::read(p).ok().and_then(|b| pe::ayristir(&b).ok()).is_some_and(|x| x.obs_eklentisi());
        if obs {
          eklenti_dll.push(p.clone());
        } else {
          diger.push(p.clone());
        }
      }
      _ => {}
    }
  }
  let adaylar = eklenti_dll
    .iter()
    .map(|dll| {
      let modul = dll.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
      let klasor = dll.parent().map(Path::to_path_buf).unwrap_or_default();
      PaketAdayi {
        veri: veri_bul(dll, &modul),
        yardimcilar: diger.iter().filter(|d| d.parent() == Some(klasor.as_path())).cloned().collect(),
        modul,
        dll: dll.clone(),
      }
    })
    .collect();
  Ok(Hazirlik {
    kimlik,
    kok,
    gecici,
    adaylar,
    kurulum_programlari: kurulum,
    betikler,
    diger_dll: diger.len(),
    dosya_sayisi: dosyalar.len(),
  })
}

pub fn klasor_kopyala(kaynak: &Path, hedef: &Path) -> Result<(), String> {
  std::fs::create_dir_all(hedef).map_err(|e| e.to_string())?;
  for e in std::fs::read_dir(kaynak).map_err(|e| e.to_string())?.flatten() {
    let t = e.file_type().map_err(|e| e.to_string())?;
    if t.is_symlink() {
      continue;
    }
    let h = hedef.join(e.file_name());
    if t.is_dir() {
      klasor_kopyala(&e.path(), &h)?;
    } else {
      std::fs::copy(e.path(), &h).map_err(|x| format!("{}: {x}", e.path().display()))?;
    }
  }
  Ok(())
}

/// Klasörü taşır; farklı birimde kopyala + sil.
fn tasi(kaynak: &Path, hedef: &Path) -> Result<(), String> {
  if let Some(u) = hedef.parent() {
    std::fs::create_dir_all(u).map_err(|e| e.to_string())?;
  }
  if std::fs::rename(kaynak, hedef).is_ok() {
    return Ok(());
  }
  klasor_kopyala(kaynak, hedef)?;
  std::fs::remove_dir_all(kaynak).map_err(|e| format!("eski klasör kaldırılamadı: {e}"))
}

fn yedek_yolu(yedek_kok: &Path, modul: &str, ek: &str) -> PathBuf {
  let damga = chrono::Local::now().format("%Y%m%d-%H%M%S");
  let mut p = yedek_kok.join(format!("{modul}-{damga}{ek}"));
  let mut n = 1;
  while p.exists() {
    n += 1;
    p = yedek_kok.join(format!("{modul}-{damga}{ek}-{n}"));
  }
  p
}

/// Yönetilen klasöre kurar. Aynı modül kuruluysa önce yedeğe taşınır. Dönüş: (dll, veri, yedek).
pub fn kur(aday: &PaketAdayi, yonetilen: &Path, yedek_kok: &Path, eski_surum: Option<String>) -> Result<(PathBuf, Option<PathBuf>, Option<Yedek>), String> {
  if !gecerli_modul(&aday.modul) {
    return Err(format!("geçersiz modül adı: {}", aday.modul));
  }
  let hedef = yonetilen.join(&aday.modul);
  let yedek = if hedef.exists() {
    let y = yedek_yolu(yedek_kok, &aday.modul, "");
    tasi(&hedef, &y)?;
    Some(Yedek { surum: eski_surum, yol: y, zaman: simdi() })
  } else {
    None
  };
  let bin = hedef.join("bin").join("64bit");
  let sonuc = (|| -> Result<(PathBuf, Option<PathBuf>), String> {
    std::fs::create_dir_all(&bin).map_err(|e| e.to_string())?;
    let dll = bin.join(format!("{}.dll", aday.modul));
    std::fs::copy(&aday.dll, &dll).map_err(|e| format!("kopyalanamadı: {e}"))?;
    for y in &aday.yardimcilar {
      if let Some(ad) = y.file_name() {
        std::fs::copy(y, bin.join(ad)).map_err(|e| format!("kopyalanamadı: {e}"))?;
      }
    }
    let veri = match &aday.veri {
      Some(v) => {
        let h = hedef.join("data");
        klasor_kopyala(v, &h)?;
        Some(h)
      }
      None => None,
    };
    Ok((dll, veri))
  })();
  match sonuc {
    Ok((dll, veri)) => Ok((dll, veri, yedek)),
    Err(e) => {
      // Yarım kurulumu geri al: yeni klasör kaldırılır, yedek yerine döner
      let _ = std::fs::remove_dir_all(&hedef);
      if let Some(y) = &yedek {
        let _ = tasi(&y.yol, &hedef);
      }
      Err(e)
    }
  }
}

/// Önceki sürüme döner: mevcut klasör yedeğe, yedek yerine. Dönüş: mevcut sürümün yeni yedeği.
pub fn geri_al(modul: &str, yedek: &Yedek, yonetilen: &Path, yedek_kok: &Path, simdiki_surum: Option<String>) -> Result<Yedek, String> {
  if !gecerli_modul(modul) || !yedek.yol.is_dir() {
    return Err("yedek bulunamadı".into());
  }
  let hedef = yonetilen.join(modul);
  let yeni = yedek_yolu(yedek_kok, modul, "-geri-alindi");
  if hedef.exists() {
    tasi(&hedef, &yeni)?;
  }
  tasi(&yedek.yol, &hedef)?;
  Ok(Yedek { surum: simdiki_surum, yol: yeni, zaman: simdi() })
}

/// Kaldırır: klasör yedeğe taşınır (kalıcı silinmez). Dönüş: yedeğin yeri.
pub fn kaldir(modul: &str, yonetilen: &Path, yedek_kok: &Path, surum: Option<String>) -> Result<Yedek, String> {
  if !gecerli_modul(modul) {
    return Err("geçersiz modül".into());
  }
  let hedef = yonetilen.join(modul);
  if !hedef.exists() {
    return Err("kurulu klasör yok".into());
  }
  let y = yedek_yolu(yedek_kok, modul, "-kaldirildi");
  tasi(&hedef, &y)?;
  Ok(Yedek { surum, yol: y, zaman: simdi() })
}

#[cfg(test)]
mod tests {
  use super::super::pe::tests::kucuk_pe;
  use super::super::zip::tests::zip_yap;
  use super::*;

  fn gecici(ad: &str) -> PathBuf {
    let d = std::env::temp_dir().join(format!("yya-paket-{ad}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&d);
    std::fs::create_dir_all(&d).unwrap();
    d
  }

  #[test]
  fn zip_hazirla_kur_guncelle_geri_al_kaldir() {
    let d = gecici("tam");
    let eklenti = kucuk_pe(0x8664, &["obs_module_load", "obs_module_set_pointer", "obs_module_ver"], &["obs.dll"]);
    let yardimci = kucuk_pe(0x8664, &["yardim"], &[]);
    let z = zip_yap(&[
      ("benim/bin/64bit/benim.dll", &eklenti, true),
      ("benim/bin/64bit/yardimci.dll", &yardimci, true),
      ("benim/data/locale/tr-TR.ini", b"Ad=Benim", false),
      ("kurulum.exe", b"MZ", false),
      ("betik.lua", b"--", false),
    ]);
    let zip_yol = d.join("benim-1.0.zip");
    std::fs::write(&zip_yol, z).unwrap();
    let h = hazirla(&zip_yol, &d.join("hazirlik")).unwrap();
    assert!(h.gecici);
    assert_eq!(h.adaylar.len(), 1, "yardımcı DLL aday sayılmaz");
    let a = &h.adaylar[0];
    assert_eq!(a.modul, "benim");
    assert!(a.veri.as_ref().unwrap().ends_with("data"));
    assert_eq!(a.yardimcilar.len(), 1);
    assert_eq!(h.kurulum_programlari, ["kurulum.exe"]);
    assert_eq!(h.betikler, ["betik.lua"]);

    let (yon, yed) = (d.join("kurulu"), d.join("yedek"));
    let (dll, veri, y) = kur(a, &yon, &yed, None).unwrap();
    assert!(dll.is_file() && dll.parent().unwrap().join("yardimci.dll").is_file());
    assert!(veri.unwrap().join("locale").join("tr-TR.ini").is_file());
    assert!(y.is_none());
    // Güncelleme: eski sürüm yedeğe gider
    let (_, _, y2) = kur(a, &yon, &yed, Some("1.0".into())).unwrap();
    let y2 = y2.unwrap();
    assert!(y2.yol.join("bin").join("64bit").join("benim.dll").is_file());
    // Geri al: yedek yerine döner, mevcut yeni yedeğe
    let y3 = geri_al("benim", &y2, &yon, &yed, Some("1.1".into())).unwrap();
    assert!(yon.join("benim").is_dir() && y3.yol.is_dir() && !y2.yol.exists());
    // Kaldır: silinmez, yedeğe taşınır
    let y4 = kaldir("benim", &yon, &yed, None).unwrap();
    assert!(!yon.join("benim").exists() && y4.yol.join("bin").is_dir());
    let _ = std::fs::remove_dir_all(&d);
  }

  #[test]
  fn kurulum_programi_ve_gecersiz_ad_reddedilir() {
    let d = gecici("red");
    let exe = d.join("kur.exe");
    std::fs::write(&exe, b"MZ").unwrap();
    assert!(hazirla(&exe, &d).unwrap_err().contains("çalıştırılmaz"));
    for kotu in ["", "..", "a/b", "a\\b", "c:x"] {
      assert!(!gecerli_modul(kotu), "{kotu}");
    }
    assert!(gecerli_modul("obs-move-transition") && gecerli_modul("logi_obs_plugin_x64"));
    let _ = std::fs::remove_dir_all(&d);
  }
}
