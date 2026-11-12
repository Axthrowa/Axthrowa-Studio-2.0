//! Uzak erişim kapısı — loopback serbest, LAN/WAN için Bearer zorunlu.
//!
//! ## Mimari
//! `AppState` `Clone` + iç alanlar `Arc`/`SqlitePool` (zaten paylaşımlı).
//! Tauri `.manage(state)` ve Axum `.with_state(Arc::new(state.clone()))`
//! **aynı** DB pool + `broadcast::Sender` üzerinde çalışır — kopya veri yok,
//! yalnızca handle çoğalır (memory-safe, Send+Sync).

use std::net::SocketAddr;
use std::sync::Arc;

use axum::extract::{ConnectInfo, Request, State};
use axum::http::{Method, StatusCode};
use axum::middleware::Next;
use axum::response::Response;

use crate::AppState;

use super::bot_api::{extract_bearer, map_err_status};

/// Overlay / OAuth / login gibi herkese açık yollar.
pub fn is_public_path(path: &str) -> bool {
  if path == "/" || path == "/api/health" || path == "/api/server" {
    return true;
  }
  if path.starts_with("/api/bot/remote/login")
    || path.starts_with("/api/bot/remote/setup")
  {
    return true;
  }
  if path.starts_with("/ws/")
    || path.starts_with("/media/")
    || path.starts_with("/assets/")
    || path.starts_with("/resonance")
  {
    return true;
  }
  // OBS Browser Source sayfaları
  if matches!(
    path,
    "/starting"
      | "/ending"
      | "/brb"
      | "/chat"
      | "/panel"
      | "/alerts"
      | "/overlay"
      | "/sfx"
      | "/remote"
      | "/remote/login"
  ) || path.starts_with("/overlay/")
    || path.starts_with("/widgets/")
  {
    return true;
  }
  // OAuth callback'ler
  if path.contains("/oauth/callback") || path.contains("/spotify/callback") {
    return true;
  }
  // Statik paket (js/css) — SPA yüklenmesi için. `/api/` hariç: uzantı kuralı
  // `/api/bot/integrations/x.png` gibi parametreli uçları Bearer'sız açıyordu.
  if !path.starts_with("/api/")
    && (path.ends_with(".js")
    || path.ends_with(".css")
    || path.ends_with(".map")
    || path.ends_with(".woff2")
    || path.ends_with(".png")
    || path.ends_with(".svg")
    || path.ends_with(".ico")
    || path.ends_with(".webp"))
  {
    return true;
  }
  false
}

/// LAN/WAN isteklerinde Bearer yoksa 401.
pub async fn require_bearer_outside_loopback(
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  State(state): State<Arc<AppState>>,
  req: Request,
  next: Next,
) -> Result<Response, (StatusCode, String)> {
  let path = req.uri().path().to_string();
  if req.method() == Method::OPTIONS || is_public_path(&path) || addr.ip().is_loopback() {
    return Ok(next.run(req).await);
  }

  let headers = req.headers();
  let token = extract_bearer(headers).ok_or((
    StatusCode::UNAUTHORIZED,
    "Yetkisiz: uzak erişim için Bearer token gerekli (Settings → Alt kullanıcılar)".into(),
  ))?;

  let info = crate::db::bot_api::remote_auth_full(&state.db, &token)
    .await
    .map_err(map_err_status)?;
  // Kısıtlı uzak kullanıcı yalnız kendi yetkisini denetleyen uçlara girer; eskiden geçerli her token
  // ayarlar, Kick, müzik gibi denetimsiz uçları da açıyordu
  if !crate::db::bot_api::remote_has_perm(&info, "*") && !perm_checked_path(&path) {
    return Err((StatusCode::FORBIDDEN, "Bu uç yalnız yönetici içindir".into()));
  }

  Ok(next.run(req).await)
}

/// İşleyicisi `remote_has_perm` ile kendi yetkisini denetleyen uçlar.
fn perm_checked_path(path: &str) -> bool {
  [
    "/api/bot/remote/",
    "/api/actions",
    "/api/asistan",
    "/api/obs/",
    "/api/obs-studio",
    "/api/destek",
    "/api/guncelleme",
    "/api/multistream",
    "/api/audit",
    "/api/yayin-bilgisi",
  ]
  .iter()
  .any(|p| path.starts_with(p))
}

/// Panel ayarı / env: `0.0.0.0` veya `127.0.0.1`.
pub fn resolve_bind_host(state: &AppState) -> [u8; 4] {
  if let Ok(v) = std::env::var("STUDIO_BIND") {
    let t = v.trim().to_ascii_lowercase();
    if t == "0.0.0.0" || t == "lan" || t == "all" {
      return [0, 0, 0, 0];
    }
    if t == "127.0.0.1" || t == "localhost" || t == "loopback" {
      return [127, 0, 0, 1];
    }
  }
  let settings = state.settings.read();
  let panel = settings.get(crate::settings::ScreenKind::Panel);
  let lan = panel
    .pointer("/remote/bindLan")
    .and_then(|v| v.as_bool())
    .or_else(|| panel.get("remoteBindLan").and_then(|v| v.as_bool()))
    .unwrap_or(false);
  if lan {
    [0, 0, 0, 0]
  } else {
    [127, 0, 0, 1]
  }
}

#[cfg(test)]
mod tests {
  use super::{is_public_path, perm_checked_path};

  #[test]
  fn api_ucu_uzantiyla_herkese_acilmaz() {
    assert!(!is_public_path("/api/bot/integrations/x.png"));
    assert!(!is_public_path("/api/bot/widgets/a.js"));
    assert!(is_public_path("/assets/index-abc.js"));
    assert!(is_public_path("/logo.png"));
    assert!(is_public_path("/api/kick/oauth/callback"));
  }

  #[test]
  fn kisitli_kullanici_denetimsiz_uca_giremez() {
    assert!(perm_checked_path("/api/multistream/status"));
    assert!(perm_checked_path("/api/bot/remote/chat/send"));
    assert!(!perm_checked_path("/api/settings"));
    assert!(!perm_checked_path("/api/kick/oauth/disconnect"));
    assert!(!perm_checked_path("/api/bot/alerts"));
  }
}
