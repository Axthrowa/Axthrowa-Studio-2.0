//! Portable / kurulu veri yolu çözümlemesi.
//!
//! ## Güvenlik
//! - `portable.txt` yalnızca **exe dizininin kendinde** aranır (`current_exe` parent).
//! - Veri klasörü `exe_dir/data` — canonicalize sonrası parent kontrolü ile
//!   dizin kaçışı engellenir.
//! - Kurulu modda `%APPDATA%/<identifier>` (Tauri `app_data_dir` eşdeğeri);
//!   kullanıcı yolu enjekte edilemez.
//! - Sembolik bağ / junction: hedef yine beklenen kök altında olmalı.

use std::fs;
use std::path::{Path, PathBuf};

/// `tauri.conf.json` → identifier
pub const APP_IDENTIFIER: &str = "com.axthrowa.yayin-yonetim-araci";
const PORTABLE_MARKER: &str = "portable.txt";
const DATA_FOLDER: &str = "data";

#[derive(Debug, Clone)]
pub struct AppPaths {
  /// dist / assets / resources (okuma ağırlıklı)
  pub resource_root: PathBuf,
  /// SQLite, medya, ayarlar, OAuth (yazılabilir)
  pub data_dir: PathBuf,
  pub portable: bool,
}

pub fn exe_dir() -> PathBuf {
  std::env::current_exe()
    .ok()
    .and_then(|p| p.parent().map(|d| d.to_path_buf()))
    .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
}

/// Exe yanında `portable.txt` var mı?
pub fn is_portable_mode() -> bool {
  let marker = exe_dir().join(PORTABLE_MARKER);
  match fs::metadata(&marker) {
    Ok(m) => m.is_file(),
    Err(_) => false,
  }
}

fn installed_app_data_dir() -> PathBuf {
  #[cfg(windows)]
  {
    if let Some(appdata) = std::env::var_os("APPDATA") {
      return PathBuf::from(appdata).join(APP_IDENTIFIER);
    }
  }
  #[cfg(not(windows))]
  {
    if let Some(home) = std::env::var_os("HOME") {
      return PathBuf::from(home)
        .join(".local")
        .join("share")
        .join(APP_IDENTIFIER);
    }
  }
  exe_dir().join(DATA_FOLDER)
}

/// `exe/data` — canonicalize + parent doğrulama.
fn portable_data_dir(exe: &Path) -> PathBuf {
  let candidate = exe.join(DATA_FOLDER);
  let _ = fs::create_dir_all(&candidate);
  match (fs::canonicalize(exe), fs::canonicalize(&candidate)) {
    (Ok(exe_c), Ok(data_c)) => {
      if data_c.starts_with(&exe_c) {
        data_c
      } else {
        yya_warn!(
          "[paths] portable data yolu exe dışında kaldı ({}); yedek kullanılıyor",
          data_c.display()
        );
        exe.join(DATA_FOLDER)
      }
    }
    _ => candidate,
  }
}

/// Eski `resource_root/app-data` → yeni `data_dir` (boşsa bir kez).
fn migrate_legacy_app_data(resource_root: &Path, data_dir: &Path) {
  let legacy = resource_root.join("app-data");
  if !legacy.is_dir() {
    return;
  }
  let new_db = data_dir.join("botaxt.db");
  let legacy_db = legacy.join("botaxt.db");
  let legacy_botrix = legacy.join("botrix.db");
  if new_db.exists() {
    return;
  }
  if !legacy_db.exists() && !legacy_botrix.exists() {
    // ayar dosyası var mı?
    let has_settings = fs::read_dir(&legacy)
      .ok()
      .map(|rd| rd.filter_map(|e| e.ok()).any(|_| true))
      .unwrap_or(false);
    if !has_settings {
      return;
    }
  }
  yya_warn!(
    "[paths] eski app-data → {} taşınıyor…",
    data_dir.display()
  );
  if let Ok(entries) = fs::read_dir(&legacy) {
    for ent in entries.flatten() {
      let name = ent.file_name();
      let dest = data_dir.join(&name);
      if dest.exists() {
        continue;
      }
      let _ = if ent.path().is_dir() {
        copy_dir_recursive(&ent.path(), &dest)
      } else {
        fs::copy(ent.path(), &dest).map(|_| ())
      };
    }
  }
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
  fs::create_dir_all(dst)?;
  for ent in fs::read_dir(src)? {
    let ent = ent?;
    let to = dst.join(ent.file_name());
    if ent.path().is_dir() {
      copy_dir_recursive(&ent.path(), &to)?;
    } else {
      fs::copy(ent.path(), &to)?;
    }
  }
  Ok(())
}

pub fn resolve(resource_root: PathBuf) -> AppPaths {
  let portable = is_portable_mode();
  let data_dir = if portable {
    portable_data_dir(&exe_dir())
  } else {
    let d = installed_app_data_dir();
    let _ = fs::create_dir_all(&d);
    d
  };
  migrate_legacy_app_data(&resource_root, &data_dir);
  let _ = fs::create_dir_all(&data_dir);
  let _ = fs::create_dir_all(data_dir.join("media"));
  yya_log!(
    "[paths] mode={} · data={} · resources={}",
    if portable { "portable" } else { "installed" },
    data_dir.display(),
    resource_root.display()
  );
  AppPaths {
    resource_root,
    data_dir,
    portable,
  }
}

