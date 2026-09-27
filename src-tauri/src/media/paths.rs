//! Yerel medya yolu — DB saklama + OBS/panel oynatma URL'leri.
//!
//! OBS Browser Source `asset://` / `tauri://` protokolünü bilmez.
//! Bu yüzden overlay'ler ve panel için **HTTP Range stream** (`/media/file`)
//! kullanılır. Tauri asset protokolü kapatıldı (kullanılmıyordu ve uygulama
//! veri klasörünü webview'e açıyordu); eski kayıtlardaki `asset://` adresleri
//! yine de dosya yoluna çevrilir.

use std::path::{Path, PathBuf};

use anyhow::{anyhow, Result};
use serde::Serialize;

/// DB'ye yazılacak mutlak yol + oynatma URL'leri.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayableMedia {
  /// SQLite'a kaydedilen mutlak dosya yolu (normalize).
  pub path: String,
  /// OBS / overlay — Range destekli yerel HTTP akış (RAM şişirmez).
  pub stream_url: String,
}

/// Kullanıcı / form girdisini mutlak dosya yoluna çevirir.
///
/// Kabul edilen biçimler:
/// - `C:\media\alert.webm`
/// - `file:///C:/media/alert.webm`
/// - `http://127.0.0.1:8843/media/file?path=...` (geri çözülür)
/// - `/assets/videos/foo.mp4` → `root/assets/videos/foo.mp4`
pub fn normalize_for_storage(raw: &str, app_root: &Path, http_base: &str) -> Result<String> {
  let t = raw.trim();
  if t.is_empty() {
    return Err(anyhow!("boş medya yolu"));
  }

  // Zaten stream URL ise path query'sini çıkar
  if let Some(q) = t.split("media/file?path=").nth(1) {
    let decoded = urlencoding::decode(q.split('&').next().unwrap_or(q))
      .unwrap_or_else(|_| q.into())
      .into_owned();
    return canonical_abs(&decoded);
  }

  // asset://localhost/... veya http://asset.localhost/...
  for prefix in ["asset://localhost/", "http://asset.localhost/", "https://asset.localhost/"] {
    if let Some(rest) = t.strip_prefix(prefix) {
      let decoded = urlencoding::decode(rest)
        .unwrap_or_else(|_| rest.into())
        .into_owned()
        .replace('/', std::path::MAIN_SEPARATOR_STR);
      return canonical_abs(&decoded);
    }
  }

  // file:// URI
  if let Some(rest) = t.strip_prefix("file://") {
    let path = rest.trim_start_matches('/');
    // Windows: file:///C:/... → C:/...
    let path = if cfg!(windows) && path.len() >= 2 && path.as_bytes()[1] == b':' {
      path.to_string()
    } else if cfg!(windows) && path.starts_with("localhost/") {
      path.trim_start_matches("localhost/").to_string()
    } else {
      format!("/{path}")
    };
    return canonical_abs(&path);
  }

  // Uygulama göreli asset
  if t.starts_with("/assets/") || t.starts_with("assets/") {
    let rel = t.trim_start_matches('/');
    let full = app_root.join(rel);
    return canonical_abs(&full.to_string_lossy());
  }

  // http_base ile başlayan göreli URL değilse mutlak dosya kabul et
  let _ = http_base;
  canonical_abs(t)
}

fn canonical_abs(raw: &str) -> Result<String> {
  let decoded = raw.replace('/', std::path::MAIN_SEPARATOR_STR);
  let path = PathBuf::from(decoded.trim());
  if path
    .components()
    .any(|c| matches!(c, std::path::Component::ParentDir))
  {
    return Err(anyhow!("path traversal engellendi"));
  }
  if !path.is_absolute() {
    return Err(anyhow!("mutlak yol gerekli: {}", path.display()));
  }
  // Dosya henüz kopyalanmamış olabilir — yol biçimini yine de kaydet
  Ok(path.to_string_lossy().replace('/', std::path::MAIN_SEPARATOR_STR))
}

/// DB path → OBS / panel stream URL (`/media/file`).
pub fn playable(http_base: &str, stored_path: &str) -> Result<PlayableMedia> {
  let path = PathBuf::from(stored_path.trim());
  if !path.is_absolute() {
    return Err(anyhow!("mutlak yol gerekli"));
  }
  let path_str = path.to_string_lossy().to_string();
  let encoded = urlencoding::encode(&path_str);
  let base = http_base.trim_end_matches('/');
  let stream_url = format!("{base}/media/file?path={encoded}");
  Ok(PlayableMedia {
    path: path_str,
    stream_url,
  })
}

/// JSON alanındaki medya yolunu normalize et (yoksa None).
pub fn opt_normalize(
  raw: Option<&str>,
  app_root: &Path,
  http_base: &str,
) -> Result<Option<String>> {
  match raw.map(str::trim).filter(|s| !s.is_empty()) {
    None => Ok(None),
    Some(s) => Ok(Some(normalize_for_storage(s, app_root, http_base)?)),
  }
}
