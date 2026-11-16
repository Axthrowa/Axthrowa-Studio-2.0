//! Bot modülü 2–8 HTTP handlers.

use std::net::SocketAddr;
use std::sync::Arc;

use axum::extract::{ConnectInfo, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::AppState;

pub fn router() -> Router<Arc<AppState>> {
  Router::new()
    // Alerts
    .route("/api/bot/alerts/seed", post(api_alerts_seed))
    .route("/api/bot/alerts/test", post(api_alerts_test))
    // Widgets / Goals
    .route("/api/bot/widgets", get(api_widgets_get).post(api_widgets_post))
    .route("/api/bot/widgets/seed", post(api_widgets_seed))
    .route(
      "/api/bot/widgets/{id}/config",
      axum::routing::put(api_widgets_patch_config).patch(api_widgets_patch_config),
    )
    .route("/api/bot/widgets/{id}", axum::routing::delete(api_widgets_delete))
    // Chatbot
    .route(
      "/api/bot/bot-settings",
      get(api_bot_settings_get),
    )
    .route("/api/bot/sync/eski-panel", post(api_eski_paneli_aktar))
    // Loyalty
    .route("/api/bot/loyalty/tick", post(api_loyalty_tick))
    // Integrations — spesifik path önce
    .route("/api/bot/integrations/discord/test", post(api_discord_test))
    // Remote
    .route("/api/bot/remote/setup", post(api_remote_setup))
    .route("/api/bot/remote/login", post(api_remote_login))
    .route("/api/bot/remote/logout", post(api_remote_logout))
    .route("/api/bot/remote/me", get(api_remote_me))
    .route(
      "/api/bot/remote/users",
      get(api_remote_users_list).post(api_remote_users_upsert),
    )
    .route("/api/bot/remote/users/delete", post(api_remote_users_delete))
}

fn map_err(e: anyhow::Error) -> (StatusCode, String) {
  map_err_status(e)
}

pub(crate) fn map_err_status(e: anyhow::Error) -> (StatusCode, String) {
  let msg = e.to_string();
  if crate::kick::is_kick_rate_limit(&msg) {
    return (StatusCode::TOO_MANY_REQUESTS, crate::kick::kick_rate_limit_user_msg().into());
  }
  let lower = msg.to_lowercase();
  let status = if lower.contains("yetkisiz") || lower.contains("oturum") {
    StatusCode::UNAUTHORIZED
  } else if lower.contains("bulunamadı") || lower.contains("yok") {
    StatusCode::NOT_FOUND
  } else if lower.contains("geçersiz")
    || lower.contains("yetersiz")
    || lower.contains("zaten")
    || lower.contains("gerekli")
  {
    StatusCode::BAD_REQUEST
  } else {
    StatusCode::INTERNAL_SERVER_ERROR
  };
  (status, msg)
}

pub(crate) fn extract_bearer(headers: &HeaderMap) -> Option<String> {
  let v = headers.get(axum::http::header::AUTHORIZATION)?.to_str().ok()?;
  let t = v
    .strip_prefix("Bearer ")
    .or_else(|| v.strip_prefix("bearer "))?;
  Some(t.trim().to_string())
}

async fn require_remote(
  state: &AppState,
  headers: &HeaderMap,
) -> Result<crate::db::bot_api::RemoteAuthInfo, (StatusCode, String)> {
  let token = extract_bearer(headers).ok_or((
    StatusCode::UNAUTHORIZED,
    "Yetkisiz: Bearer token gerekli".into(),
  ))?;
  crate::db::bot_api::remote_auth_full(&state.db, &token)
    .await
    .map_err(map_err)
}


fn ok_json<T: serde::Serialize>(v: T) -> Json<Value> {
  Json(serde_json::to_value(v).unwrap_or(Value::Null))
}

// ─── Alerts ───────────────────────────────────────────────────────────



async fn api_alerts_seed(
  State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let settings = state.settings.read().clone();
  let n = crate::db::bot_api::seed_alerts_if_empty(&state.db, &settings)
    .await
    .map_err(map_err)?;
  Ok(Json(json!({ "seeded": n })))
}

#[derive(Deserialize)]
struct AlertTestBody {
  #[serde(default = "default_follow")]
  type_id: String,
  #[serde(default)]
  kind: Option<String>,
  user: Option<String>,
  message: Option<String>,
  #[serde(default)]
  amount: Option<Value>,
}

fn default_follow() -> String {
  "follow".into()
}

async fn api_alerts_test(
  State(state): State<Arc<AppState>>,
  Json(body): Json<AlertTestBody>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let type_id = body
    .kind
    .as_deref()
    .filter(|s| !s.is_empty())
    .unwrap_or(body.type_id.as_str());
  let (item, ws) = crate::db::bot_api::enqueue_alert_test(
    &state.db,
    type_id,
    body.user.as_deref(),
    body.message.as_deref(),
    body.amount.clone(),
  )
  .await
  .map_err(map_err)?;
  state.broadcast_json(&ws);
  // Overlay queue için açık new_alert event’i
  if let Some(ev) = ws.get("data").and_then(|d| d.get("_widgetEvent")) {
    state.broadcast_json(&json!({
      "type": "new_alert",
      "data": ev,
    }));
    state.broadcast_json(&json!({
      "type": "trigger_alert",
      "data": ev,
    }));
  }
  Ok(Json(json!({ "queue": item, "broadcast": ws })))
}




// ─── Goals / Widgets ──────────────────────────────────────────────────




async fn api_widgets_get(
  State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let base = state.base_url();
  let rows = crate::db::widgets::list_widgets(&state.db)
    .await
    .map_err(map_err)?;
  let enriched: Vec<Value> = rows
    .iter()
    .map(|w| crate::db::widgets::enrich_widget(&base, w))
    .collect();
  Ok(Json(json!({ "widgets": enriched })))
}

async fn api_widgets_post(
  State(state): State<Arc<AppState>>,
  Json(body): Json<Value>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let base = state.base_url();
  let w = crate::db::widgets::upsert_widget(&state.db, &body, &state.data_dir, &base)
    .await
    .map_err(map_err)?;
  broadcast_widget_config(&state, &w);
  Ok(Json(crate::db::widgets::enrich_widget(&base, &w)))
}

async fn api_widgets_patch_config(
  State(state): State<Arc<AppState>>,
  axum::extract::Path(id): axum::extract::Path<String>,
  Json(body): Json<Value>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let base = state.base_url();
  let patch = body
    .get("config")
    .cloned()
    .unwrap_or(body);
  let w = crate::db::widgets::patch_widget_config(&state.db, &id, &patch, &state.data_dir, &base)
    .await
    .map_err(map_err)?;
  broadcast_widget_config(&state, &w);
  Ok(Json(crate::db::widgets::enrich_widget(&base, &w)))
}

fn broadcast_widget_config(state: &AppState, w: &crate::db::models::WidgetInstance) {
  let cfg: Value = serde_json::from_str(&w.config_json).unwrap_or(json!({}));
  let enabled = w.enabled != 0;
  let payload = json!({
    "type": "config_updated",
    "id": w.id,
    "kind": w.kind,
    "config": cfg,
    "enabled": enabled,
  });
  state.broadcast_json(&payload);
  state.broadcast_json(&json!({
    "type": "widgets_updated",
    "id": w.id,
    "kind": w.kind,
    "config": cfg,
    "enabled": enabled,
  }));
}

async fn api_widgets_delete(
  State(state): State<Arc<AppState>>,
  axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let ok = crate::db::widgets::delete_widget(&state.db, &id)
    .await
    .map_err(map_err)?;
  Ok(Json(json!({ "deleted": ok })))
}

async fn api_widgets_seed(
  State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let n = crate::db::widgets::seed_default_widgets(&state.db)
    .await
    .map_err(map_err)?;
  Ok(Json(json!({
    "seeded": n,
    "catalog": crate::db::widgets::catalog_as_json(),
  })))
}

/// Panel “Test Et” — overlay-sync üzerinden sahte olay yayınla.

// ─── Chatbot ──────────────────────────────────────────────────────────












async fn api_bot_settings_get(
  State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::db::bot_api::get_bot_settings(&state.db)
    .await
    .map(ok_json)
    .map_err(map_err)
}




/// GET /api/bot/settings/kick — kayıtlı kullanıcı + canlı durum

/// GET /api/bot/settings/kick/status — canlı Pusher bağlı mı?

/// POST /api/bot/settings/kick — kaydet + WebSocket’i hemen başlat

/// DELETE /api/bot/settings/kick — Pusher bağlantısını kes

#[derive(Deserialize)]
struct SyncQuery {
  #[serde(default)]
  force: Option<String>,
}

async fn api_eski_paneli_aktar(
  State(state): State<Arc<AppState>>,
  Query(q): Query<SyncQuery>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let force = matches!(
    q.force.as_deref(),
    Some("1") | Some("true") | Some("yes")
  );
  let settings = state.settings.read().clone();
  crate::db::eski_panel_aktarimi::eski_paneli_aktar(&state.db, &settings, force)
    .await
    .map_err(map_err)?;
  Ok(Json(json!({ "ok": true, "force": force })))
}

// ─── Loyalty ──────────────────────────────────────────────────────────













async fn api_loyalty_tick(
  State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::db::loyalty::loyalty_tick(&state.db)
    .await
    .map(Json)
    .map_err(map_err)
}



// ─── Games ────────────────────────────────────────────────────────────













// ─── Integrations ─────────────────────────────────────────────────────



async fn api_discord_test(
  State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::db::bot_api::discord_test_webhook(&state.db)
    .await
    .map(Json)
    .map_err(map_err)
}



// ─── Remote ───────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct RemoteCreds {
  username: String,
  password: String,
}

/// İlk yönetici YALNIZ bu bilgisayardan kurulur. Eskiden uç herkese açıktı:
/// uzak erişim (LAN) açıkken ve henüz yönetici yokken ağdaki herhangi biri
/// tüm yetkili (`["*"]`) ilk yöneticiyi kendisi oluşturup paneli ele geçirebilirdi.
async fn api_remote_setup(
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  State(state): State<Arc<AppState>>,
  Json(body): Json<RemoteCreds>,
) -> Result<Json<Value>, (StatusCode, String)> {
  if !addr.ip().is_loopback() {
    return Err((
      StatusCode::FORBIDDEN,
      "İlk yönetici yalnız bu bilgisayardaki panelden kurulabilir".into(),
    ));
  }
  crate::db::bot_api::remote_setup(&state.db, &body.username, &body.password)
    .await
    .map(Json)
    .map_err(map_err)
}

/// Uzak giriş denemesi sınırı: adres başına `GIRIS_SINIRI` başarısız deneme /
/// `GIRIS_PENCERESI_MS`. Eskiden sınırsızdı (kısa parolalar ağdan kaba kuvvetle bulunabilirdi).
const GIRIS_SINIRI: u32 = 8;
const GIRIS_PENCERESI_MS: u64 = 10 * 60 * 1000;

#[derive(Default)]
pub(super) struct GirisDenemeleri(std::collections::HashMap<std::net::IpAddr, (u32, u64)>);

impl GirisDenemeleri {
  /// Bu adres şu an engelli mi? (süresi dolan kayıt temizlenir)
  pub(super) fn engelli(&mut self, ip: std::net::IpAddr, simdi_ms: u64) -> bool {
    match self.0.get(&ip) {
      Some(&(_, bas)) if simdi_ms.saturating_sub(bas) > GIRIS_PENCERESI_MS => {
        self.0.remove(&ip);
        false
      }
      Some(&(n, _)) => n >= GIRIS_SINIRI,
      None => false,
    }
  }
  pub(super) fn basarisiz(&mut self, ip: std::net::IpAddr, simdi_ms: u64) {
    let e = self.0.entry(ip).or_insert((0, simdi_ms));
    e.0 += 1;
    // Bellek sınırı: çok sayıda farklı adresten deneme tabloyu şişirmesin
    if self.0.len() > 4096 {
      self.0.retain(|_, (_, bas)| simdi_ms.saturating_sub(*bas) <= GIRIS_PENCERESI_MS);
    }
  }
  pub(super) fn basarili(&mut self, ip: std::net::IpAddr) {
    self.0.remove(&ip);
  }
}

pub(super) static GIRIS_DENEMELERI: std::sync::LazyLock<parking_lot::Mutex<GirisDenemeleri>> =
  std::sync::LazyLock::new(Default::default);

pub(super) fn simdi_ms() -> u64 {
  std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map(|d| d.as_millis() as u64)
    .unwrap_or(0)
}

async fn api_remote_login(
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  State(state): State<Arc<AppState>>,
  Json(body): Json<RemoteCreds>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let ip = addr.ip();
  if GIRIS_DENEMELERI.lock().engelli(ip, simdi_ms()) {
    return Err((
      StatusCode::TOO_MANY_REQUESTS,
      "Çok fazla başarısız deneme — 10 dakika sonra tekrar deneyin".into(),
    ));
  }
  match crate::db::bot_api::remote_login(&state.db, &body.username, &body.password).await {
    Ok(v) => {
      GIRIS_DENEMELERI.lock().basarili(ip);
      Ok(Json(v))
    }
    Err(e) => {
      GIRIS_DENEMELERI.lock().basarisiz(ip, simdi_ms());
      Err(map_err(e))
    }
  }
}

async fn api_remote_logout(
  State(state): State<Arc<AppState>>,
  headers: HeaderMap,
  body: Option<Json<Value>>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let token = extract_bearer(&headers)
    .or_else(|| {
      body
        .and_then(|Json(v)| v.get("token").and_then(|t| t.as_str()).map(str::to_string))
    })
    .ok_or((StatusCode::BAD_REQUEST, "token gerekli".into()))?;
  crate::db::bot_api::remote_logout(&state.db, &token)
    .await
    .map_err(map_err)?;
  Ok(Json(json!({ "ok": true })))
}




async fn api_remote_me(
  State(state): State<Arc<AppState>>,
  headers: HeaderMap,
) -> Result<Json<Value>, (StatusCode, String)> {
  let info = require_remote(&state, &headers).await?;
  Ok(Json(json!({
    "user_id": info.user_id,
    "username": info.username,
    "role": info.role,
    "permissions": info.permissions,
  })))
}

async fn api_remote_users_list(
  State(state): State<Arc<AppState>>,
  headers: HeaderMap,
) -> Result<Json<Value>, (StatusCode, String)> {
  // Yerel panel (loopback) Bearer olmadan da listeleyebilir — auth middleware zaten loopback serbest.
  // Uzaktan sadece admin.
  if extract_bearer(&headers).is_some() {
    let info = require_remote(&state, &headers).await?;
    if info.role != "admin" && !crate::db::bot_api::remote_has_perm(&info, "users") {
      return Err((StatusCode::FORBIDDEN, "Yalnızca yönetici".into()));
    }
  }
  let rows = crate::db::bot_api::list_remote_users(&state.db)
    .await
    .map_err(map_err)?;
  Ok(Json(json!({ "users": rows })))
}

async fn api_remote_users_upsert(
  State(state): State<Arc<AppState>>,
  headers: HeaderMap,
  Json(body): Json<Value>,
) -> Result<Json<Value>, (StatusCode, String)> {
  if extract_bearer(&headers).is_some() {
    let info = require_remote(&state, &headers).await?;
    if info.role != "admin" {
      return Err((StatusCode::FORBIDDEN, "Yalnızca yönetici".into()));
    }
  }
  crate::db::bot_api::upsert_remote_user(&state.db, &body)
    .await
    .map(ok_json)
    .map_err(map_err)
}

#[derive(Deserialize)]
struct IdBody {
  id: String,
}

async fn api_remote_users_delete(
  State(state): State<Arc<AppState>>,
  headers: HeaderMap,
  Json(body): Json<IdBody>,
) -> Result<Json<Value>, (StatusCode, String)> {
  if extract_bearer(&headers).is_some() {
    let info = require_remote(&state, &headers).await?;
    if info.role != "admin" {
      return Err((StatusCode::FORBIDDEN, "Yalnızca yönetici".into()));
    }
  }
  let ok = crate::db::bot_api::delete_remote_user(&state.db, &body.id)
    .await
    .map_err(map_err)?;
  Ok(Json(json!({ "ok": ok })))
}





#[cfg(test)]
mod giris_sinir_testleri {
  use super::*;

  #[test]
  fn sinir_dolunca_engeller_pencere_bitince_acar() {
    let ip: std::net::IpAddr = "192.168.1.50".parse().unwrap();
    let mut g = GirisDenemeleri::default();
    for _ in 0..GIRIS_SINIRI {
      assert!(!g.engelli(ip, 1_000));
      g.basarisiz(ip, 1_000);
    }
    assert!(g.engelli(ip, 2_000));
    // Pencere geçince yeniden denenebilir
    assert!(!g.engelli(ip, 1_000 + GIRIS_PENCERESI_MS + 1));
  }

  #[test]
  fn basarili_giris_sayaci_sifirlar_ve_adresler_ayri() {
    let a: std::net::IpAddr = "10.0.0.1".parse().unwrap();
    let b: std::net::IpAddr = "10.0.0.2".parse().unwrap();
    let mut g = GirisDenemeleri::default();
    for _ in 0..GIRIS_SINIRI {
      g.basarisiz(a, 0);
    }
    assert!(g.engelli(a, 1));
    assert!(!g.engelli(b, 1));
    g.basarili(a);
    assert!(!g.engelli(a, 2));
  }
}
