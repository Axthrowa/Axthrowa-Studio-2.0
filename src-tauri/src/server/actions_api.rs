//! Eylem kayıt defterinin HTTP yüzü (`/api/actions`, `/api/actions/run`).
//!
//! Her çağrı: tanım → parametre doğrulama → izin (`control_plane::authorize`, eylemin kendi izni) → onay →
//! yürütme → denetim günlüğü (`ACTION:<id>`). Kontrol Merkezi, uzak arayüz ve ileride Stream Deck aynı ucu kullanır.

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

use axum::extract::{ConnectInfo, State};
use axum::http::{HeaderMap, StatusCode};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};

use super::control_plane::{audit, authorize, Actor};
use super::motor_api;
use crate::actions::{self, Action, ActionSpec, Requires};
use crate::hotkeys::HotkeyBindingIn;
use crate::AppState;

type ApiResult = Result<Json<Value>, (StatusCode, String)>;

pub fn router() -> Router<Arc<AppState>> {
  Router::new()
    .route("/api/actions", get(api_list))
    .route("/api/actions/run", post(api_run))
    .route("/api/obs/canvases", get(api_canvases))
    .route("/api/obs/meters", get(api_meters))
}

/// Giriş ses seviyeleri (salt-okunur). Abonelik ilk istekte açılır, istek kesilince kendiliğinden kapanır.
async fn api_meters(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
) -> ApiResult {
  authorize(&state, &addr, &headers, "broadcast.read").await?;
  if !state.obs.is_connected() {
    return Err((StatusCode::CONFLICT, "OBS bağlı değil".into()));
  }
  let (inputs, age_ms) = state.obs.meters().await.map_err(|e| (StatusCode::BAD_GATEWAY, e))?;
  Ok(Json(json!({ "inputs": inputs, "ageMs": age_ms })))
}

/// OBS tuvalleri (salt-okunur). İkincil tuvalde sahne geçişi obs-websocket'te yok; sağlayıcı eklenti adıyla gösterilir.
async fn api_canvases(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
) -> ApiResult {
  authorize(&state, &addr, &headers, "broadcast.read").await?;
  if !state.obs.is_connected() {
    return Err((StatusCode::CONFLICT, "OBS bağlı değil".into()));
  }
  let list = state.obs.canvases().await.map_err(|e| (StatusCode::BAD_GATEWAY, e))?;
  Ok(Json(json!({ "canvases": list })))
}

async fn hazir_mi(state: &AppState, r: Requires) -> (bool, Option<&'static str>) {
  match r {
    Requires::Obs if !state.obs.is_connected() => (false, Some("OBS bağlı değil")),
    Requires::Multistream if !state.multistream.session_active() => (false, Some("Çoklu yayın oturumu kapalı")),
    Requires::Motor if !state.motor.calisiyor().await => (false, Some("Yayın motoru çalışmıyor")),
    // StreamAxT her çağrıda yoklanmaz (liste ucu hızlı kalsın); yürütmede ulaşılamazsa hata döner
    _ => (true, None),
  }
}

/// Eylem kataloğu + anlık kullanılabilirlik (arayüz düğmeleri ve ileride Stream Deck durum simgeleri için).
async fn api_list(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
) -> ApiResult {
  // Liste okunabilir bilgi; yalnız kimlik doğrulaması (uzakta) istenir
  let actor = authorize(&state, &addr, &headers, "actions.read").await?;
  let mut list: Vec<Value> = Vec::with_capacity(actions::ACTIONS.len());
  for a in actions::ACTIONS {
    let (available, reason) = hazir_mi(&state, a.requires).await;
    let mut v = serde_json::to_value(a).unwrap_or(Value::Null);
    v["available"] = json!(available);
    v["reason"] = json!(reason);
    list.push(v);
  }
  Ok(Json(json!({ "actions": list, "local": actor.local })))
}

#[derive(Deserialize)]
struct RunBody {
  id: String,
  #[serde(default)]
  params: Value,
  #[serde(default)]
  confirm: bool,
}

async fn api_run(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(body): Json<RunBody>,
) -> ApiResult {
  let spec = actions::find(&body.id).ok_or((StatusCode::NOT_FOUND, format!("Bilinmeyen eylem: {}", body.id)))?;
  let actor = authorize(&state, &addr, &headers, spec.perm).await?;
  let v = calistir(&state, spec, &body.params, body.confirm, &actor, None).await?;
  Ok(Json(json!({ "ok": true, "id": spec.id, "result": v })))
}

/// Tek yürütme yolu: onay → parametre → kullanılabilirlik → yürütme → denetim (`ACTION:<id>`). İzin denetimi
/// çağıranındır (HTTP ucu `authorize`, genel kısayol yerel yayıncıdır). `kaynak`: denetim kaydında denetleyici
/// ("hotkey" gibi); HTTP'den gelen çağrıda yok.
pub(crate) async fn calistir(
  state: &AppState,
  spec: &'static ActionSpec,
  params: &Value,
  confirm: bool,
  actor: &Actor,
  kaynak: Option<&str>,
) -> Result<Value, (StatusCode, String)> {
  if spec.confirm && !confirm {
    return Err((StatusCode::PRECONDITION_REQUIRED, format!("Onay gerekli: {}", spec.label)));
  }
  let action = actions::parse(spec.id, params).map_err(|e| (StatusCode::BAD_REQUEST, e))?;
  let (available, reason) = hazir_mi(state, spec.requires).await;
  if !available {
    return Err((StatusCode::CONFLICT, reason.unwrap_or("Kullanılamıyor").to_string()));
  }

  let mut kayit = actions::audit_detail(spec, params);
  if let Some(k) = kaynak {
    kayit["via"] = json!(k);
  }
  let sonuc = yurut(state, &action, &actor.name).await;
  kayit["ok"] = json!(sonuc.is_ok());
  if let Err(e) = &sonuc {
    kayit["error"] = json!(e.chars().take(200).collect::<String>());
  }
  audit(state, actor, &format!("ACTION:{}", spec.id), kayit).await;
  sonuc.map_err(|e| (StatusCode::BAD_GATEWAY, e))
}

/// Genel kısayoldan gelen eylem: yerel yayıncı adına yürür, denetim kaydında `via: "hotkey"`. Onayı kısayol ayarı
/// taşır (`confirmed`); kayıt anında `hotkeys::eylem_denetimi` onaysız kısayolu zaten reddeder.
pub(crate) async fn kisayol_eylemi(state: &AppState, id: &str, params: Value, onayli: bool) -> Result<Value, String> {
  let spec = actions::find(id).ok_or_else(|| format!("Bilinmeyen eylem: {id}"))?;
  let actor = Actor { name: "yerel".into(), local: true };
  calistir(state, spec, &params, onayli, &actor, Some("hotkey")).await.map_err(|(_, e)| e)
}

fn motor_hatasi((_, e): (StatusCode, String)) -> String {
  e
}

async fn yurut(state: &AppState, action: &Action, actor: &str) -> Result<Value, String> {
  match action {
    Action::SceneSwitch { scene } => state.obs.set_scene(scene).await.map(|_| json!({ "scene": scene })),
    Action::AudioMute { input, muted } => {
      let hedef = match muted {
        Some(m) => *m,
        None => {
          let girisler = state.obs.inputs().await?;
          let g = girisler
            .iter()
            .find(|g| g.name == *input)
            .ok_or_else(|| format!("«{input}» adlı ses girişi yok"))?;
          !g.muted
        }
      };
      state.obs.set_muted(input, hedef).await.map(|_| json!({ "input": input, "muted": hedef }))
    }
    Action::RecordStart => state.obs.set_recording(true).await.map(|_| json!({ "recording": true })),
    Action::RecordStop => state.obs.set_recording(false).await.map(|_| json!({ "recording": false })),
    Action::ReplaySave => state.obs.save_replay().await.map(|_| json!({ "saved": true })),
    Action::StreamStart => state.obs.start_stream().await.map(|_| json!({ "streaming": true })),
    Action::StreamStop => state.obs.stop_stream().await.map(|_| json!({ "streaming": false })),
    Action::DestinationStart { id } => state.multistream.start_destination(id).map(|_| json!({ "id": id })),
    Action::DestinationStop { id } => state.multistream.stop_destination(id).map(|_| json!({ "id": id })),
    Action::DestinationReconnect { id } => state.multistream.reconnect_destination(id).await.map(|_| json!({ "id": id })),
    Action::DestinationsStopAll => {
      state.multistream.stop_session();
      Ok(json!({ "stopped": true }))
    }
    Action::Alert { action } => uyari_denetimi(action, actor).await,
    // OBS kaynak görünürlüğü ve ses seviyesi kısayollarla aynı yürütücüden geçer (tek davranış, tek test)
    Action::SourceVisibility { scene, source, mode } => {
      let b = HotkeyBindingIn {
        id: "action".into(),
        kind: "srcToggle".into(),
        scene: scene.clone().unwrap_or_default(),
        source: source.clone(),
        mode: (*mode).into(),
        ..Default::default()
      };
      crate::hotkeys::run_obs_action(state, &b, "srcToggle").await.map(|_| json!({ "source": source, "mode": mode }))
    }
    Action::AudioVolume { input, delta_db } => {
      let b = HotkeyBindingIn { id: "action".into(), kind: "volume".into(), input: input.clone(), delta: *delta_db, ..Default::default() };
      crate::hotkeys::run_obs_action(state, &b, "volume").await.map(|_| json!({ "input": input, "delta": delta_db }))
    }
    Action::EngineGoLive => {
      let s = motor_api::golive_baslat(state).await.map_err(motor_hatasi)?;
      let ok = motor_api::basarili(&s);
      if !s.is_empty() && ok == 0 {
        return Err(format!("Hiçbir hedef başlatılamadı ({} hedef)", s.len()));
      }
      Ok(json!({ "hedefler": s.len(), "basarili": ok, "sonuc": s }))
    }
    Action::EngineStopAll => motor_api::golive_durdur(state).await.map(|s| json!({ "durdurulan": s.len() })).map_err(motor_hatasi),
    Action::EngineRecord { start: true } => motor_api::kayit_baslat(state).await.map(|_| json!({ "kayit": true })).map_err(motor_hatasi),
    Action::EngineRecord { start: false } => motor_api::kayit_durdur(state).await.map(|_| json!({ "kayit": false })).map_err(motor_hatasi),
    Action::EngineReplaySave => motor_api::tekrar_kaydet(state).await.map(|_| json!({ "kaydedildi": true })).map_err(motor_hatasi),
    Action::EngineSceneSwitch { scene } => motor_api::motor_sahnesine_gec(state, scene).await.map_err(motor_hatasi),
    Action::EngineStudioTransition => super::motor_sahne_api::studyo_gecisi(state, "ana", false, None)
      .await
      .map(|p| json!({ "program": p }))
      .map_err(motor_hatasi),
    Action::EngineAudioMute { source, muted } => {
      let (id, ad, sessiz) = motor_api::motor_ses_kaynagi(state, source).await.map_err(motor_hatasi)?;
      let yeni = muted.unwrap_or(!sessiz);
      super::motor_ses_api::ses_ayarla(state, &id, "sessiz", &json!(yeni)).await.map_err(motor_hatasi)?;
      Ok(json!({ "kaynak": ad, "sessiz": yeni }))
    }
    Action::EngineHold { source, konus, basili } => {
      let (id, ad, _) = motor_api::motor_ses_kaynagi(state, source).await.map_err(motor_hatasi)?;
      // Bas-konuş: basılıyken açık, bırakınca kapalı; bas-sustur tersi
      let sessiz = if *konus { !basili } else { *basili };
      super::motor_ses_api::ses_ayarla(state, &id, "sessiz", &json!(sessiz)).await.map_err(motor_hatasi)?;
      Ok(json!({ "kaynak": ad, "sessiz": sessiz }))
    }
    Action::EngineMedia { source, eylem } => {
      let (id, ad, _) = motor_api::motor_ses_kaynagi(state, source).await.map_err(motor_hatasi)?;
      let e = if *eylem == "degistir" { motor_api::medya_degistir_eylemi(state, &id).await.map_err(motor_hatasi)? } else { eylem };
      super::motor_ses_api::medya(state, &id, e).await.map_err(motor_hatasi)?;
      Ok(json!({ "kaynak": ad, "eylem": e }))
    }
    Action::EngineRecordPause { pause } => motor_api::kayit_duraklat(state, *pause).await.map(|d| json!({ "duraklatildi": d })).map_err(motor_hatasi),
    Action::EngineRecordSplit => motor_api::kayit_bol(state).await.map(|_| json!({ "bolundu": true })).map_err(motor_hatasi),
    Action::EngineVirtualCam { eylem } => motor_api::sanal_kamera(state, eylem, "ana").await.map(|a| json!({ "acik": a })).map_err(motor_hatasi),
    Action::EngineFilter { source, filter, acik } => {
      let (kaynak, ad, _) = motor_api::motor_ses_kaynagi(state, source).await.map_err(motor_hatasi)?;
      super::motor_ses_api::filtre_adla_etkin(state, &kaynak, filter, *acik).await.map(|a| json!({ "kaynak": ad, "filtre": filter, "acik": a })).map_err(motor_hatasi)
    }
    Action::EngineSourceVisibility { source, mode } => motor_api::kaynak_gorunurlugu(state, source, mode)
      .await
      .map(|(ad, gorunur, n)| json!({ "kaynak": ad, "gorunur": gorunur, "oge": n }))
      .map_err(motor_hatasi),
  }
}

/// StreamAxT'in ekip çapındaki uyarı kuyruğu denetimine iletir. Sürüm gönderilmez: hızlı eylemde son yazan kazanır
/// (StreamAxT sürümsüz isteği kabul eder ve yeni durumu tüm panellere yayar).
async fn uyari_denetimi(action: &str, actor: &str) -> Result<Value, String> {
  let url = format!("http://127.0.0.1:{}/api/alerts/control", crate::streamaxt::port());
  let client = reqwest::Client::builder()
    .timeout(Duration::from_secs(3))
    .build()
    .map_err(|e| e.to_string())?;
  let res = client
    .post(url)
    .json(&json!({ "action": action, "actor": actor.chars().take(40).collect::<String>() }))
    .send()
    .await
    .map_err(|_| "StreamAxT'e ulaşılamadı (Bot sekmesinden başlatın)".to_string())?;
  let durum = res.status();
  let govde: Value = res.json().await.unwrap_or(Value::Null);
  if !durum.is_success() {
    return Err(govde.get("error").and_then(|v| v.as_str()).unwrap_or("Uyarı denetimi uygulanamadı").to_string());
  }
  Ok(govde.get("state").cloned().unwrap_or(Value::Null))
}
