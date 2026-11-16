//! Çoklu yayın HTTP API'si (`/api/multistream/*`).
//!
//! Tüm yazma uçları Control Plane'den geçer: izin (`broadcast.outputs`) → yürütme → denetim günlüğü.
//! Yayın anahtarları yalnız yazılır (Kimlik Yöneticisi); hiçbir yanıtta dönmez.

use std::net::SocketAddr;
use std::sync::Arc;

use axum::extract::{ConnectInfo, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};

use super::control_plane::{audit, authorize};
use crate::multistream::config::{self, DestinationConfig, Platform};
use crate::multistream::{obs_profile, policy};
use crate::settings::ScreenKind;
use crate::AppState;

type ApiResult = Result<Json<Value>, (StatusCode, String)>;

const PERM: &str = "broadcast.outputs";
/// OBS'in özgün yayın servisi (kullanıcının kendi anahtarını içerir) — yalnız Kimlik Yöneticisinde.
const OBS_BACKUP_KEY: &str = "multistream.obs_service_backup";

pub fn router() -> Router<Arc<AppState>> {
  Router::new()
    .route("/api/multistream", get(api_status))
    .route("/api/multistream/preflight", get(api_preflight))
    .route("/api/multistream/destinations", post(api_upsert))
    .route("/api/multistream/destinations/delete", post(api_delete))
    .route("/api/multistream/destinations/reveal", post(api_reveal))
    .route("/api/multistream/destinations/key-delete", post(api_key_delete))
    .route("/api/multistream/destinations/test", post(api_test))
    .route("/api/multistream/destinations/start", post(api_dest_start))
    .route("/api/multistream/destinations/stop", post(api_dest_stop))
    .route("/api/multistream/session/start", post(api_session_start))
    .route("/api/multistream/session/stop", post(api_session_stop))
    .route("/api/multistream/go-live", post(api_go_live))
    .route("/api/multistream/obs/connect", post(api_obs_connect))
    .route("/api/multistream/obs/restore", post(api_obs_restore))
    .route("/api/audit", get(api_audit))
}

fn bad(msg: impl Into<String>) -> (StatusCode, String) {
  (StatusCode::BAD_REQUEST, msg.into())
}

fn presets() -> Value {
  json!([Platform::Twitch, Platform::Kick, Platform::Youtube, Platform::Custom]
    .iter()
    .map(|p| json!({"platform": p, "label": p.label(), "server": p.preset_server()}))
    .collect::<Vec<_>>())
}

fn status_json(state: &AppState, local: bool) -> Value {
  let mut v = serde_json::to_value(state.multistream.snapshot()).unwrap_or_else(|_| json!({}));
  v["presets"] = presets();
  // Doğrulanmış platform sınırları (kaynak + tarih); arayüz yalnız bunları önerir, değer uydurmaz
  v["sinirlar"] = json!({
    "kickMaxKbps": policy::LIMITS.kick_max_kbps,
    "youtubeMaxKeyintSn": policy::LIMITS.youtube_max_keyint,
    "kaynaklar": {"kick": policy::KICK_SRC, "youtube": policy::YT_SRC},
    "dogrulama": policy::DOGRULAMA,
  });
  v["obsRedirected"] = json!(crate::secret_store::get_secret(OBS_BACKUP_KEY).is_some());
  // Alıcı anahtarı yalnız yerel panele (OBS'e elle yazmak isteyene); uzak istemciye hiç gitmez
  if local {
    if let Some((server, key)) = state.multistream.ingest_target() {
      v["ingest"] = json!({"server": server, "key": key});
    }
  }
  v
}

async fn api_status(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, "broadcast.read").await?;
  Ok(Json(status_json(&state, actor.local)))
}

fn save_destinations(state: &AppState, list: &[DestinationConfig]) -> Result<(), (StatusCode, String)> {
  let mut s = state.settings.write();
  let mut panel = s.get(ScreenKind::Panel).clone();
  if !panel.is_object() {
    panel = json!({});
  }
  panel["multistream"] = json!({ "version": 1, "destinations": list });
  s.set(ScreenKind::Panel, panel);
  s.save_one(&state.data_dir, ScreenKind::Panel)
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("ayar yazılamadı: {e}")))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpsertBody {
  #[serde(default)]
  id: Option<String>,
  name: String,
  platform: String,
  server: String,
  #[serde(default = "varsayilan_acik")]
  enabled: bool,
  /// Boş/eksik: mevcut anahtar korunur
  #[serde(default)]
  key: Option<String>,
}

fn varsayilan_acik() -> bool {
  true
}

fn anahtar_yeniden_gerekli(eski: &DestinationConfig, yeni: &DestinationConfig) -> bool {
  eski.server.trim() != yeni.server.trim() || eski.platform != yeni.platform
}

async fn api_upsert(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(body): Json<UpsertBody>,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, PERM).await?;
  let platform = Platform::parse(&body.platform).ok_or_else(|| bad("Bilinmeyen platform"))?;
  let id = body
    .id
    .filter(|s| !s.trim().is_empty())
    .unwrap_or_else(|| uuid::Uuid::new_v4().simple().to_string()[..12].to_string());
  let cfg = DestinationConfig {
    id: id.clone(),
    name: body.name.trim().to_string(),
    platform,
    server: body.server.trim().to_string(),
    enabled: body.enabled,
  };
  config::validate(&cfg).map_err(bad)?;
  let yeni_anahtar = body.key.as_deref().map(str::trim).filter(|k| !k.is_empty());
  // GÜVENLİK: kayıtlı anahtar yalnız girildiği sunucuya gider; sunucu ya da platform değişirse
  // eski anahtar yeni (belki saldırganın) adrese taşınmasın
  if yeni_anahtar.is_none()
    && state.multistream.configs().iter().any(|c| c.id == id && anahtar_yeniden_gerekli(c, &cfg))
  {
    return Err(bad("Sunucu ya da platform değişti: yayın anahtarını yeniden girin"));
  }
  if let Some(k) = yeni_anahtar {
    if k.chars().any(|c| c.is_whitespace() || c.is_control()) || k.len() > 512 {
      return Err(bad("Yayın anahtarı geçersiz karakter içeriyor"));
    }
    if !state.multistream.set_key(&id, k) {
      return Err((StatusCode::INTERNAL_SERVER_ERROR, "Anahtar Kimlik Yöneticisine yazılamadı".into()));
    }
  }
  let mut list = state.multistream.configs();
  let yeni = match list.iter_mut().find(|c| c.id == id) {
    Some(c) => {
      *c = cfg.clone();
      false
    }
    None => {
      list.push(cfg.clone());
      true
    }
  };
  save_destinations(&state, &list)?;
  state.multistream.load(list);
  audit(
    &state,
    &actor,
    if yeni { "MULTISTREAM_DEST_ADD" } else { "MULTISTREAM_DEST_UPDATE" },
    json!({"id": id, "platform": platform, "enabled": cfg.enabled, "keyChanged": body.key.map(|k| !k.trim().is_empty()).unwrap_or(false)}),
  )
  .await;
  Ok(Json(status_json(&state, actor.local)))
}

#[derive(Deserialize)]
struct IdBody {
  id: String,
}

async fn api_delete(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(body): Json<IdBody>,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, PERM).await?;
  let mut list = state.multistream.configs();
  let before = list.len();
  list.retain(|c| c.id != body.id);
  if list.len() == before {
    return Err((StatusCode::NOT_FOUND, "Hedef bulunamadı".into()));
  }
  let _ = state.multistream.stop_destination(&body.id);
  save_destinations(&state, &list)?;
  state.multistream.load(list);
  state.multistream.delete_key(&body.id);
  audit(&state, &actor, "MULTISTREAM_DEST_DELETE", json!({"id": body.id})).await;
  Ok(Json(status_json(&state, actor.local)))
}

/// Yayın anahtarını GÖSTERİR: yalnız bu bilgisayardan (uzak istemciye asla), bilinçli eylemle; denetime yalnız
/// "gösterildi" yazılır (değer değil). Yanıt önbelleğe alınmaz; arayüz 20 sn sonra gizler ve hiçbir duruma yazmaz.
async fn api_reveal(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(body): Json<IdBody>,
) -> Result<axum::response::Response, (StatusCode, String)> {
  use axum::response::IntoResponse;
  let actor = authorize(&state, &addr, &headers, PERM).await?;
  if !actor.local {
    return Err((StatusCode::FORBIDDEN, "Anahtar yalnız bu bilgisayarda gösterilir".into()));
  }
  let cfg = state.multistream.configs().into_iter().find(|c| c.id == body.id).ok_or((StatusCode::NOT_FOUND, "Hedef bulunamadı".into()))?;
  let key = state.multistream.key_for(&body.id).ok_or((StatusCode::NOT_FOUND, "Bu hedefin anahtarı yok".into()))?;
  audit(&state, &actor, "MULTISTREAM_KEY_REVEAL", json!({"id": body.id, "ref": config::secure_ref(cfg.platform, &cfg.id)})).await;
  let mut r = Json(json!({"key": key})).into_response();
  r.headers_mut().insert(axum::http::header::CACHE_CONTROL, axum::http::HeaderValue::from_static("no-store"));
  Ok(r)
}

/// Yalnız anahtarı siler (hedef kalır)
async fn api_key_delete(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(body): Json<IdBody>,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, PERM).await?;
  if !state.multistream.configs().iter().any(|c| c.id == body.id) {
    return Err((StatusCode::NOT_FOUND, "Hedef bulunamadı".into()));
  }
  if state.multistream.snapshot().destinations.iter().any(|d| d.id == body.id && d.state.is_active()) {
    return Err((StatusCode::CONFLICT, "Hedef yayındayken anahtarı silinemez".into()));
  }
  state.multistream.delete_key(&body.id);
  audit(&state, &actor, "MULTISTREAM_KEY_DELETE", json!({"id": body.id})).await;
  Ok(Json(status_json(&state, actor.local)))
}

/// Bağlantı sınaması: yalnız sunucuya TCP bağlantısı açılıp kapatılır — yayın gönderilmez, anahtar kullanılmaz.
async fn api_test(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(body): Json<IdBody>,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, PERM).await?;
  let cfg = state.multistream.configs().into_iter().find(|c| c.id == body.id).ok_or((StatusCode::NOT_FOUND, "Hedef bulunamadı".into()))?;
  let (host, port) = config::host_port(&cfg.server).ok_or_else(|| bad("Sunucu adresi rtmp:// ya da rtmps:// olmalı"))?;
  let bas = std::time::Instant::now();
  let sonuc = tokio::time::timeout(std::time::Duration::from_secs(5), tokio::net::TcpStream::connect((host.as_str(), port))).await;
  let ms = bas.elapsed().as_millis() as u64;
  let (ok, hata) = match sonuc {
    Ok(Ok(_)) => (true, None),
    Ok(Err(e)) => (false, Some(e.to_string())),
    Err(_) => (false, Some("5 sn içinde yanıt yok".to_string())),
  };
  audit(&state, &actor, "MULTISTREAM_DEST_TEST", json!({"id": body.id, "ok": ok})).await;
  Ok(Json(json!({"ok": ok, "ms": ms, "hata": hata, "sunucu": format!("{host}:{port}"), "not": "Yalnız TCP bağlantısı sınandı; yayın gönderilmedi, anahtar doğrulanmadı."})))
}

async fn api_dest_start(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(body): Json<IdBody>,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, PERM).await?;
  let (findings, _) = build_preflight(&state).await;
  if policy::blocked(&findings, &body.id) {
    let neden: Vec<&str> = findings
      .iter()
      .filter(|f| f.level == policy::Level::Block && (f.destination.as_deref() == Some(body.id.as_str()) || f.destination.is_none()))
      .map(|f| f.message.as_str())
      .collect();
    return Err((StatusCode::CONFLICT, format!("Yayın öncesi kontrol engelledi: {}", neden.join(" · "))));
  }
  state.multistream.start_destination(&body.id).map_err(bad)?;
  audit(&state, &actor, "MULTISTREAM_DEST_START", json!({"id": body.id})).await;
  Ok(Json(status_json(&state, actor.local)))
}

async fn api_dest_stop(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(body): Json<IdBody>,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, PERM).await?;
  state.multistream.stop_destination(&body.id).map_err(bad)?;
  audit(&state, &actor, "MULTISTREAM_DEST_STOP", json!({"id": body.id})).await;
  Ok(Json(status_json(&state, actor.local)))
}

async fn api_session_start(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, PERM).await?;
  state.multistream.start_session().map_err(bad)?;
  audit(&state, &actor, "MULTISTREAM_SESSION_START", json!({})).await;
  Ok(Json(status_json(&state, actor.local)))
}

#[derive(Deserialize)]
struct ConfirmBody {
  #[serde(default)]
  confirm: bool,
}

/// Tüm hedefleri ve alıcıyı kapatır — kazara tetiklenmesin diye açık onay ister (§87).
async fn api_session_stop(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(body): Json<ConfirmBody>,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, PERM).await?;
  if !body.confirm {
    return Err(bad("Onay gerekli: {\"confirm\": true}"));
  }
  state.multistream.stop_session();
  audit(&state, &actor, "MULTISTREAM_SESSION_STOP", json!({})).await;
  Ok(Json(status_json(&state, actor.local)))
}

/// GO LIVE: alıcıyı açar, kontrol listesinden geçen etkin hedefleri başlatır; engellenen hedefler raporlanır,
/// diğerleri yine başlar.
async fn api_go_live(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, PERM).await?;
  let (findings, _) = build_preflight(&state).await;
  state.multistream.start_session().map_err(bad)?;
  let mut started = Vec::new();
  let mut blocked = Vec::new();
  for cfg in state.multistream.configs().into_iter().filter(|c| c.enabled) {
    if policy::blocked(&findings, &cfg.id) {
      blocked.push(json!({"id": cfg.id, "name": cfg.name}));
      continue;
    }
    match state.multistream.start_destination(&cfg.id) {
      Ok(()) => started.push(cfg.id),
      Err(e) => blocked.push(json!({"id": cfg.id, "name": cfg.name, "error": e})),
    }
  }
  audit(&state, &actor, "MULTISTREAM_GO_LIVE", json!({"started": started, "blocked": blocked.len()})).await;
  let mut v = status_json(&state, actor.local);
  v["started"] = json!(started);
  v["blocked"] = json!(blocked);
  v["findings"] = json!(findings);
  Ok(Json(v))
}

/// AxBoT'ta çapraz sohbet aktarımı açık mı? (AxBoT kapalıysa bilinmiyor → `false`)
async fn axbot_relay_enabled() -> bool {
  let Ok(client) = reqwest::Client::builder().timeout(std::time::Duration::from_millis(1500)).build() else {
    return false;
  };
  // Panel AxBoT'u `AXBOT_PORT` ile başka portta başlatabilir (eskiden 3001 sabitti)
  let url = format!("http://127.0.0.1:{}/api/settings", crate::axbot::port());
  match client.get(url).send().await {
    Ok(r) if r.status().is_success() => r
      .json::<Value>()
      .await
      .ok()
      .and_then(|v| v.get("cross_chat_enabled").and_then(|x| x.as_str()).map(|s| s == "true"))
      .unwrap_or(false),
    _ => false,
  }
}

pub(crate) async fn build_preflight(state: &Arc<AppState>) -> (Vec<policy::Finding>, policy::EncoderInfo) {
  let encoder = tokio::task::spawn_blocking(obs_profile::read_current)
    .await
    .ok()
    .flatten()
    .unwrap_or_default();
  let (chat, starting, upload_mbps) = {
    let s = state.settings.read();
    let yukleme = s
      .get(ScreenKind::Panel)
      .get("multistreamUploadMbps")
      .and_then(|v| v.as_f64())
      .filter(|v| v.is_finite() && *v > 0.0 && *v < 100_000.0);
    (s.get(ScreenKind::Chat).clone(), s.get(ScreenKind::Starting).clone(), yukleme)
  };
  let ctx = policy::Context {
    destinations: state
      .multistream
      .configs()
      .into_iter()
      .filter(|c| c.enabled)
      .map(|c| (c.id, c.platform, c.server))
      .collect(),
    encoder: encoder.clone(),
    combined_chat_overlay: policy::chat_overlay_platforms(&chat, &starting) > 1,
    cross_chat_relay: axbot_relay_enabled().await,
    ffmpeg_found: state.multistream.ffmpeg().is_some(),
    obs_connected: state.obs.is_connected(),
    upload_mbps,
    disks: kayit_birimleri().await,
    muted_mic: susturulmus_mikrofon(state).await,
  };
  (policy::evaluate(&ctx), encoder)
}

/// OBS'in kayıt klasörünün birimindeki boş alan.
async fn kayit_birimleri() -> Vec<(&'static str, String, u64)> {
  tokio::task::spawn_blocking(|| {
    let mut out: Vec<(&'static str, String, u64)> = Vec::new();
    let adaylar = [
      ("OBS kayıt klasörü", obs_profile::current_record_dir()),
    ];
    for (etiket, yol) in adaylar {
      let Some(yol) = yol else { continue };
      let birim = crate::disk::birim_etiketi(&yol);
      if out.iter().any(|(_, b, _)| *b == birim) {
        continue;
      }
      if let Some(bos) = crate::disk::bos_alan(&yol) {
        out.push((etiket, birim, bos));
      }
    }
    out
  })
  .await
  .unwrap_or_default()
}

/// Ayarlarda seçili mikrofon OBS'te susturulmuşsa adı. OBS bağlı değilse ya da mikrofon seçilmemişse `None`
/// (bilinmeyen durum "susturulmuş" sayılmaz).
async fn susturulmus_mikrofon(state: &Arc<AppState>) -> Option<String> {
  if !state.obs.is_connected() {
    return None;
  }
  let (_, _, _, obs) = crate::hotkeys::obs_cfg_from_settings(state);
  let mik = obs.get("micInput").and_then(|v| v.as_str()).map(str::trim).filter(|s| !s.is_empty())?.to_string();
  let girisler = state.obs.inputs().await.ok()?;
  girisler.iter().find(|g| g.name == mik && g.muted).map(|_| mik)
}

async fn api_preflight(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
) -> ApiResult {
  authorize(&state, &addr, &headers, "broadcast.read").await?;
  let (findings, encoder) = build_preflight(&state).await;
  Ok(Json(json!({ "findings": findings, "encoder": encoder })))
}

/// OBS'in yayın servisini yönlendiricinin alıcısına çevirir. Özgün servis (kullanıcının kendi anahtarıyla) bir kez
/// Kimlik Yöneticisine yedeklenir; `restore` ile geri yüklenir.
async fn api_obs_connect(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, PERM).await?;
  let (server, key) = state.multistream.start_session().map_err(bad)?;
  let (kind, current) = state.obs.stream_service().await.map_err(bad)?;
  let zaten = current.get("server").and_then(|v| v.as_str()) == Some(server.as_str())
    && current.get("key").and_then(|v| v.as_str()) == Some(key.as_str());
  if !zaten {
    let bizim = current
      .get("server")
      .and_then(|v| v.as_str())
      .map(|s| s.starts_with("rtmp://127.0.0.1:"))
      .unwrap_or(false);
    // Yedek yalnız kullanıcının kendi ayarıyken alınır (eski bir oturumun yerel adresi yedeğin üstüne yazılmasın)
    if !bizim && crate::secret_store::get_secret(OBS_BACKUP_KEY).is_none() {
      let yedek = json!({"type": kind, "settings": current}).to_string();
      if !crate::secret_store::set_secret(OBS_BACKUP_KEY, &yedek) {
        return Err((StatusCode::INTERNAL_SERVER_ERROR, "OBS ayarı yedeklenemedi; değişiklik yapılmadı".into()));
      }
    }
    state
      .obs
      .set_stream_service("rtmp_custom", &json!({"server": server, "key": key, "use_auth": false, "bwtest": false}))
      .await
      .map_err(bad)?;
  }
  audit(&state, &actor, "MULTISTREAM_OBS_CONNECT", json!({"alreadyConnected": zaten})).await;
  Ok(Json(status_json(&state, actor.local)))
}

async fn api_obs_restore(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, PERM).await?;
  let yedek = crate::secret_store::get_secret(OBS_BACKUP_KEY).ok_or_else(|| bad("Geri yüklenecek OBS ayarı yok"))?;
  let v: Value = serde_json::from_str(&yedek).map_err(|_| bad("OBS yedeği bozuk"))?;
  let kind = v.get("type").and_then(|x| x.as_str()).unwrap_or("rtmp_common").to_string();
  let settings = v.get("settings").cloned().unwrap_or_else(|| json!({}));
  state.obs.set_stream_service(&kind, &settings).await.map_err(bad)?;
  crate::secret_store::delete_secret(OBS_BACKUP_KEY);
  audit(&state, &actor, "MULTISTREAM_OBS_RESTORE", json!({})).await;
  Ok(Json(status_json(&state, actor.local)))
}

#[derive(Deserialize)]
struct AuditQuery {
  #[serde(default)]
  limit: Option<i64>,
}

async fn api_audit(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Query(q): Query<AuditQuery>,
) -> ApiResult {
  authorize(&state, &addr, &headers, "audit.read").await?;
  let rows = crate::db::audit::recent(&state.db, q.limit.unwrap_or(100))
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  Ok(Json(json!({ "items": rows })))
}

#[cfg(test)]
mod anahtar_baglama_testleri {
  use super::*;

  #[test]
  fn sunucu_degisince_anahtar_istenir() {
    let eski = DestinationConfig {
      id: "a1".into(),
      name: "Twitch".into(),
      platform: Platform::parse("twitch").unwrap(),
      server: "rtmp://live.twitch.tv/app".into(),
      enabled: true,
    };
    let mut yeni = eski.clone();
    yeni.name = "Yeni ad".into();
    yeni.enabled = false;
    assert!(!anahtar_yeniden_gerekli(&eski, &yeni), "ad/açık değişimi anahtarı korur");
    yeni.server = "rtmp://saldirgan.example/app".into();
    assert!(anahtar_yeniden_gerekli(&eski, &yeni));
  }
}
