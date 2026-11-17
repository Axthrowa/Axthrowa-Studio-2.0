//! Bot paneli: oturumlar, işaretler, klip, altyazı, metrik ve olay günlüğü

use super::*;

pub(super) async fn api_bot_dashboard(
  State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::db::profile::dashboard(&state.db)
    .await
    .map(|d| Json(serde_json::to_value(d).unwrap_or(Value::Null)))
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

#[derive(Deserialize)]
pub(super) struct SessionsQuery {
  #[serde(default = "default_limit")]
  limit: i64,
}

pub(super) fn default_limit() -> i64 {
  20
}

pub(super) async fn api_bot_sessions(
  State(state): State<Arc<AppState>>,
  Query(q): Query<SessionsQuery>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::db::profile::list_sessions(&state.db, q.limit)
    .await
    .map(|rows| Json(serde_json::json!({ "sessions": rows })))
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

#[derive(Deserialize)]
pub(super) struct SessionStartBody {
  title: Option<String>,
}

pub(super) async fn api_bot_session_start(
  State(state): State<Arc<AppState>>,
  Json(body): Json<SessionStartBody>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let pool = state.db.clone();
  let title = body.title.clone();
  // SQLite işini runtime'a bırak — handler bloke olmasın
  let session = tokio::task::spawn(async move {
    crate::db::profile::start_session(&pool, title).await
  })
  .await
  .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
  .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

  state.broadcast_json(&serde_json::json!({
    "type": "session",
    "action": "start",
    "session": serde_json::to_value(&session).unwrap_or(Value::Null),
  }));
  Ok(Json(serde_json::to_value(session).unwrap_or(Value::Null)))
}

#[derive(Deserialize)]
pub(super) struct SessionEndBody {
  session_id: String,
  /// U7b: OBS'in yayın sonundaki kare sayaçları (isteğe bağlı)
  #[serde(default)]
  dropped_frames: Option<i64>,
  #[serde(default)]
  total_frames: Option<i64>,
}

#[derive(Deserialize)]
pub(super) struct RaporQuery {
  id: String,
}

pub(super) async fn api_bot_session_report(
  State(state): State<Arc<AppState>>,
  Query(q): Query<RaporQuery>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::db::profile::oturum_raporu(&state.db, &q.id)
    .await
    .map(Json)
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

#[derive(Deserialize)]
pub(super) struct IsaretQuery {
  session: Option<String>,
}

/// U6: yayının işaretleri (oturum verilmezse son 100)
pub(super) async fn api_bot_markers(
  State(state): State<Arc<AppState>>,
  Query(q): Query<IsaretQuery>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::db::profile::isaretler(&state.db, q.session.as_deref().filter(|s| !s.is_empty()))
    .await
    .map(|v| Json(json!(v)))
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

/// Y2: işaretin tekrar dosyası ve ffmpeg; ikisi de yoksa açıklayıcı hata
pub(super) async fn klip_kaynagi(state: &AppState, isaret: i64) -> Result<(std::path::PathBuf, std::path::PathBuf), (StatusCode, String)> {
  let yol = crate::db::profile::isaret_dosyasi(&state.db, isaret)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .map(std::path::PathBuf::from)
    .filter(|p| p.is_file())
    .ok_or((StatusCode::NOT_FOUND, "Bu işaretin tekrar dosyası yok ya da taşınmış".to_string()))?;
  let ffmpeg = crate::ytdl::ffmpeg_yolu(&state.data_dir).ok_or((StatusCode::FAILED_DEPENDENCY, "ffmpeg bulunamadı".to_string()))?;
  Ok((ffmpeg, yol))
}

#[derive(Deserialize)]
pub(super) struct KlipKareQuery {
  isaret: i64,
}

pub(super) async fn api_klip_kare(State(state): State<Arc<AppState>>, Query(q): Query<KlipKareQuery>) -> Result<axum::response::Response, (StatusCode, String)> {
  let (ffmpeg, yol) = klip_kaynagi(&state, q.isaret).await?;
  let jpeg = crate::klip::kare(&ffmpeg, &yol).await.map_err(|e| (StatusCode::BAD_GATEWAY, e))?;
  Ok(([(axum::http::header::CONTENT_TYPE, "image/jpeg")], jpeg).into_response())
}

#[derive(Deserialize)]
pub(super) struct KlipDikeyBody {
  isaret: i64,
  oyun: crate::klip::Bolge,
  kamera: Option<crate::klip::Bolge>,
  sure: Option<f64>,
}

/// Y2: işaretin tekrar dosyasından 1080×1920 MP4 (kaynağın yanına)
#[derive(Deserialize)]
pub(super) struct AltyaziBody {
  metin: String,
  #[serde(default)]
  kesin: bool,
  #[serde(default)]
  obs: bool,
}

/// Y13 canlı altyazı: paneldeki tanıyıcının metni katmana (`/widgets/altyazi`) yayılır; kesinleşen satır
/// istenirse OBS'e CEA-608 olarak gider (yayın kapalıyken OBS reddeder, hata metni döner, katman yine yazar).
pub(super) async fn api_altyazi(State(state): State<Arc<AppState>>, Json(b): Json<AltyaziBody>) -> Json<Value> {
  let metin: String = b.metin.trim().chars().take(500).collect();
  state.broadcast_json(&json!({ "type": "altyazi", "metin": metin, "kesin": b.kesin }));
  let obs = if b.kesin && b.obs && !metin.is_empty() && state.obs.is_connected() {
    Some(state.obs.send_caption(&metin).await)
  } else {
    None
  };
  Json(json!({ "obs": obs.as_ref().map(|r| r.is_ok()), "hata": obs.and_then(|r| r.err()) }))
}

pub(super) async fn api_klip_dikey(State(state): State<Arc<AppState>>, Json(b): Json<KlipDikeyBody>) -> Result<Json<Value>, (StatusCode, String)> {
  let filtre = crate::klip::dikey_filtre(b.oyun, b.kamera).map_err(|e| (StatusCode::BAD_REQUEST, e))?;
  let (ffmpeg, yol) = klip_kaynagi(&state, b.isaret).await?;
  let cikti = crate::klip::dikey_yap(&ffmpeg, &yol, &filtre, b.sure).await.map_err(|e| (StatusCode::BAD_GATEWAY, e))?;
  Ok(Json(json!({ "yol": cikti.to_string_lossy() })))
}

pub(super) async fn api_bot_session_end(
  State(state): State<Arc<AppState>>,
  Json(body): Json<SessionEndBody>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let pool = state.db.clone();
  let sid = body.session_id.clone();
  let session = tokio::task::spawn(async move {
    crate::db::profile::end_session(&pool, &sid).await
  })
  .await
  .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
  .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  if let (Some(dusen), Some(toplam), Some(_)) = (body.dropped_frames, body.total_frames, &session) {
    if toplam > 0 {
      crate::db::profile::kareleri_yaz(&state.db, &body.session_id, dusen, toplam)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }
  }

  state.broadcast_json(&serde_json::json!({
    "type": "session",
    "action": "end",
    "session": serde_json::to_value(&session).unwrap_or(Value::Null),
  }));
  Ok(Json(serde_json::json!({ "session": session })))
}

#[derive(Deserialize)]
pub(super) struct MetricsBody {
  session_id: String,
  #[serde(default)]
  viewers: i64,
  #[serde(default)]
  chat_rpm: f64,
  #[serde(default)]
  followers: i64,
  #[serde(default)]
  subs: i64,
}

pub(super) async fn api_bot_metrics(
  State(state): State<Arc<AppState>>,
  Json(body): Json<MetricsBody>,
) -> Result<StatusCode, (StatusCode, String)> {
  crate::db::profile::push_metric(
    &state.db,
    &body.session_id,
    body.viewers,
    body.chat_rpm,
    body.followers,
    body.subs,
  )
  .await
  .map(|_| StatusCode::OK)
  .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

#[derive(Deserialize)]
pub(super) struct EventsQuery {
  #[serde(default = "default_limit")]
  limit: i64,
}

pub(super) async fn api_bot_events(
  State(state): State<Arc<AppState>>,
  Query(q): Query<EventsQuery>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let channel_id = crate::db::default_channel_id(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  let rows: Vec<crate::db::models::EventLog> = sqlx::query_as(
    "SELECT id, session_id, channel_id, kind, platform, user_name, user_id,
            amount, message, meta_json, ts
     FROM events_log WHERE channel_id = ?
     ORDER BY ts DESC LIMIT ?",
  )
  .bind(&channel_id)
  .bind(q.limit.clamp(1, 100))
  .fetch_all(&state.db)
  .await
  .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  Ok(Json(serde_json::json!({ "events": rows })))
}

#[derive(Deserialize)]
pub(super) struct EventLogBody {
  kind: String,
  #[serde(default = "default_platform")]
  platform: String,
  user_name: String,
  amount: Option<f64>,
  message: Option<String>,
}

pub(super) fn default_platform() -> String {
  "local".into()
}

pub(super) async fn api_bot_event_log(
  State(state): State<Arc<AppState>>,
  Json(body): Json<EventLogBody>,
) -> Result<StatusCode, (StatusCode, String)> {
  crate::db::profile::log_event(
    &state.db,
    &body.kind,
    &body.platform,
    &body.user_name,
    body.amount,
    body.message.as_deref(),
  )
  .await
  .map(|_| StatusCode::OK)
  .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}
