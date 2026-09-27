//! Control Plane: her yönetim eylemi izin → yürütme → denetim günlüğü yolundan geçer.
//!
//! Yerel yayıncı (loopback + `local_guard`) sahiptir. Uzak kullanıcılar (LAN, Bearer) yalnız rollerinin ya da
//! açık izinlerinin kapsadığı eylemleri yapabilir (`remote_has_perm`: admin her şey, diğerleri `permissions`).
//! Uzak arayüz çekirdeğe doğrudan erişmez (§149).

use std::net::SocketAddr;

use axum::http::{HeaderMap, StatusCode};
use serde_json::Value;

use crate::AppState;

#[derive(Clone, Debug)]
pub struct Actor {
  pub name: String,
  pub local: bool,
}

/// İsteği yapanı belirler ve `perm` iznini denetler.
pub async fn authorize(
  state: &AppState,
  addr: &SocketAddr,
  headers: &HeaderMap,
  perm: &str,
) -> Result<Actor, (StatusCode, String)> {
  if addr.ip().is_loopback() {
    return Ok(Actor {
      name: "yerel".into(),
      local: true,
    });
  }
  let token = super::botaxt::extract_bearer(headers)
    .ok_or((StatusCode::UNAUTHORIZED, "Yetkisiz: Bearer token gerekli".to_string()))?;
  let info = crate::db::botaxt_api::remote_auth_full(&state.db, &token)
    .await
    .map_err(|_| (StatusCode::UNAUTHORIZED, "Oturum geçersiz".to_string()))?;
  if !crate::db::botaxt_api::remote_has_perm(&info, perm) {
    return Err((StatusCode::FORBIDDEN, format!("Yetki yok: {perm}")));
  }
  Ok(Actor {
    name: info.username,
    local: false,
  })
}

/// Denetim kaydı; günlük yazılamasa bile eylem başarısız sayılmaz (yalnız uyarı).
pub async fn audit(state: &AppState, actor: &Actor, action: &str, detail: Value) {
  if let Err(e) = crate::db::audit::record(&state.db, &actor.name, action, &detail).await {
    yya_warn!("[denetim] yazılamadı ({action}): {e:#}");
  }
}
