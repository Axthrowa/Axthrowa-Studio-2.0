//! Eski sürümlerin klasör, dosya ve kasa adları. Yalnız ilk açılışta veriyi yeni adlara taşımak için kullanılır;
//! eski veri yerinde bırakılır (kopyalanır), böylece yarıda kalan bir taşıma hiçbir şeyi kaybettirmez.

use std::fs;
use std::path::{Path, PathBuf};

/// Eski uygulama kimliği: `%APPDATA%`/`%LOCALAPPDATA%` klasör adı ve Windows Kimlik Yöneticisi kasa adı
pub const KIMLIK: &str = "com.axthrowa.yayin-yonetim-araci";
/// Studio veritabanının eski dosya adı
pub const STUDIO_DB: &str = "botaxt.db";
/// AxBoT veritabanının eski dosya adı
pub const BOT_DB: &str = "streamaxt.sqlite";
/// Paketteki bot klasörünün eski adı
pub const BOT_KLASORU: &str = "streamaxt";
/// Yedek arşivindeki Studio klasörünün eski adı
pub const YEDEK_KLASORU: &str = "yya";
/// OBS ayar dosyasının ilk değişiklikten önceki yedeğinin eski uzantısı
pub const OBS_YEDEK_UZANTISI: &str = "ini.yya-yedek";

/// SQLite dosyasını WAL/SHM eşleriyle yeni ada taşır. Yeni dosya varsa ya da eski yoksa dokunmaz.
/// Önce eşler, sonra ana dosya: yarıda kesilirse sonraki açılış ana dosyayı taşıyıp tamamlar.
pub fn db_tasi(eski: &Path, yeni: &Path) -> bool {
  if yeni.exists() || !eski.is_file() {
    return false;
  }
  for ek in ["-wal", "-shm"] {
    let (e, y) = (yan(eski, ek), yan(yeni, ek));
    if e.exists() && !y.exists() {
      let _ = fs::rename(&e, &y);
    }
  }
  fs::rename(eski, yeni).is_ok()
}

fn yan(db: &Path, ek: &str) -> PathBuf {
  let mut s = db.as_os_str().to_owned();
  s.push(ek);
  PathBuf::from(s)
}

/// `kok/<eski kimlik>` klasörünü `kok/<yeni kimlik>` olarak kopyalar. Döner: yeni klasör kullanılabilir mi.
/// Kopya geçici klasöre yapılıp tek adımda yeni ada çevrilir; hata olursa geçici klasör silinir ve false döner.
pub fn kimlik_klasorunu_kopyala(kok: &Path, yeni_kimlik: &str) -> bool {
  let yeni = kok.join(yeni_kimlik);
  let eski = kok.join(KIMLIK);
  if yeni.exists() || !eski.is_dir() {
    return yeni.exists();
  }
  let gecici = kok.join(format!("{yeni_kimlik}.tasiniyor"));
  let _ = fs::remove_dir_all(&gecici);
  match crate::paths::copy_dir_recursive(&eski, &gecici).and_then(|_| fs::rename(&gecici, &yeni)) {
    Ok(()) => {
      studio_log!("[eski-adlar] {} → {} kopyalandı", eski.display(), yeni.display());
      true
    }
    Err(e) => {
      studio_warn!("[eski-adlar] {} kopyalanamadı: {e}; eski klasör kullanılacak", eski.display());
      let _ = fs::remove_dir_all(&gecici);
      false
    }
  }
}

/// WebView verisi (oturumlar, tarayıcı depolaması) `%LOCALAPPDATA%/<kimlik>` altında: pencere açılmadan taşınmalı.
pub fn webview_verisini_tasi() {
  #[cfg(windows)]
  if let Some(yerel) = std::env::var_os("LOCALAPPDATA") {
    kimlik_klasorunu_kopyala(Path::new(&yerel), crate::paths::APP_IDENTIFIER);
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  fn gecici() -> PathBuf {
    let d = std::env::temp_dir().join(format!("studio-eski-adlar-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&d).unwrap();
    d
  }

  #[test]
  fn db_ve_wal_birlikte_tasinir_yeni_varsa_dokunulmaz() {
    let d = gecici();
    fs::write(d.join(STUDIO_DB), "ana").unwrap();
    fs::write(d.join(format!("{STUDIO_DB}-wal")), "wal").unwrap();
    assert!(db_tasi(&d.join(STUDIO_DB), &d.join("studio.db")));
    assert_eq!(fs::read_to_string(d.join("studio.db")).unwrap(), "ana");
    assert_eq!(fs::read_to_string(d.join("studio.db-wal")).unwrap(), "wal");
    fs::write(d.join(STUDIO_DB), "baska").unwrap();
    assert!(!db_tasi(&d.join(STUDIO_DB), &d.join("studio.db")));
    assert_eq!(fs::read_to_string(d.join("studio.db")).unwrap(), "ana");
    let _ = fs::remove_dir_all(&d);
  }

  #[test]
  fn kimlik_klasoru_kopyalanir_eskisi_kalir() {
    let d = gecici();
    fs::create_dir_all(d.join(KIMLIK).join("media")).unwrap();
    fs::write(d.join(KIMLIK).join("media").join("a.png"), "x").unwrap();
    assert!(kimlik_klasorunu_kopyala(&d, "com.ornek.yeni"));
    assert_eq!(fs::read_to_string(d.join("com.ornek.yeni").join("media").join("a.png")).unwrap(), "x");
    assert!(d.join(KIMLIK).join("media").join("a.png").exists());
    assert!(!d.join("com.ornek.yeni.tasiniyor").exists());
    // İkinci açılış: yeni var, yeniden kopyalanmaz
    fs::write(d.join(KIMLIK).join("yeni-dosya"), "y").unwrap();
    assert!(kimlik_klasorunu_kopyala(&d, "com.ornek.yeni"));
    assert!(!d.join("com.ornek.yeni").join("yeni-dosya").exists());
    let _ = fs::remove_dir_all(&d);
  }
}
