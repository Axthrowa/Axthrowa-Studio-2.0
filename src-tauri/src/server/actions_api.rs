//! Eylem kayıt defterinin HTTP yüzü (`/api/actions`, `/api/actions/run`).
//!
//! Her çağrı: tanım → parametre doğrulama → izin (`control_plane::authorize`, eylemin kendi izni) → onay →
//! yürütme → denetim günlüğü (`ACTION:<id>`). Kontrol Merkezi, uzak arayüz ve ileride Stream Deck aynı ucu kullanır.

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{ConnectInfo, State};
use axum::response::IntoResponse;
use axum::http::{HeaderMap, StatusCode};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};

use super::control_plane::{audit, authorize, Actor};
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
    .route("/ws/obs-meters", get(ws_meters))
    .route("/api/obs/kumanda", get(api_kumanda))
}

/// Uzaktan kumanda (telefon) düğmeleri için OBS'teki gerçek sahne ve ses girişi adları
async fn api_kumanda(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
) -> ApiResult {
  authorize(&state, &addr, &headers, "scene.switch").await?;
  if !state.obs.is_connected() {
    return Err((StatusCode::CONFLICT, "OBS bağlı değil".into()));
  }
  let sahne = state.obs.scene_snapshot().await.map_err(|e| (StatusCode::BAD_GATEWAY, e))?;
  let girisler = state.obs.inputs().await.map_err(|e| (StatusCode::BAD_GATEWAY, e))?;
  Ok(Json(json!({ "scenes": sahne.scenes, "currentScene": sahne.current_scene, "streaming": sahne.streaming, "inputs": girisler })))
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

/// R7: ölçerleri yoklamasız yayınlar. OBS 50 ms'de bir ölçüm gönderir; her yeni ölçüm `{inputs, ageMs}` olarak
/// itilir, OBS bağlı değilse saniyede bir `{error}`. İzin HTTP ucuyla aynı (tarayıcı WS başlık gönderemez: uzaktan Bearer
/// olmadan reddedilir, loopback açıktır). Bağlantı sürdükçe ölçer talebi tazelenir; kapanınca abonelik kendiliğinden düşer.
async fn ws_meters(
  ws: WebSocketUpgrade,
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
) -> Result<impl IntoResponse, (StatusCode, String)> {
  authorize(&state, &addr, &headers, "broadcast.read").await?;
  Ok(ws.on_upgrade(move |socket| olcer_akisi(socket, state)))
}

async fn olcer_akisi(mut socket: WebSocket, state: Arc<AppState>) {
  let mut tik = tokio::time::interval(Duration::from_millis(25));
  tik.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
  let mut son_yas: Option<i64> = None;
  let mut son_hata = 0i64;
  loop {
    tokio::select! {
      gelen = socket.recv() => match gelen {
        Some(Ok(Message::Close(_))) | Some(Err(_)) | None => return,
        _ => continue,
      },
      _ = tik.tick() => {}
    }
    let simdi = crate::db::chrono_now();
    let mesaj = if !state.obs.is_connected() {
      None
    } else {
      match state.obs.meters().await {
        Ok((inputs, yas)) => {
          // Aynı ölçümü yeniden gönderme: ölçüm zamanı (şimdi - yaş) değişmediyse yeni veri yok
          let damga = if yas < 0 { -1 } else { simdi - yas };
          if son_yas == Some(damga) {
            continue;
          }
          son_yas = Some(damga);
          Some(json!({ "inputs": inputs, "ageMs": yas }))
        }
        Err(e) => Some(json!({ "error": e })),
      }
    };
    let mesaj = match mesaj {
      Some(m) if m.get("error").is_none() => m,
      hata => {
        if simdi - son_hata < 1000 {
          continue;
        }
        son_hata = simdi;
        son_yas = None;
        hata.unwrap_or_else(|| json!({ "error": "OBS bağlı değil" }))
      }
    };
    if socket.send(Message::Text(mesaj.to_string().into())).await.is_err() {
      return;
    }
  }
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
    Requires::Music if !state.music.kaynak_bagli() => (false, Some("Müzik kaynağı bağlı değil (Spotify ya da YTMD)")),
    // AxBoT her çağrıda yoklanmaz (liste ucu hızlı kalsın); yürütmede ulaşılamazsa hata döner
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

/// T6: eski tür genel kısayollar (sahne, mikrofon, kaynak…) kendi OBS yürütücüsüyle çalışır (bağlantı kopmuşsa
/// yeniden bağlanır); denetim kaydı yine eylem kayıt defterindeki adla `ACTION:<id>`, `via: "hotkey"`.
pub(crate) async fn kisayol_kaydi(state: &AppState, eylem: &str, params: Value, sonuc: &Result<(), String>) {
  let mut kayit = match actions::find(eylem) {
    Some(spec) => actions::audit_detail(spec, &params),
    None => json!({ "id": eylem }),
  };
  kayit["via"] = json!("hotkey");
  kayit["ok"] = json!(sonuc.is_ok());
  if let Err(e) = sonuc {
    kayit["error"] = json!(e.chars().take(200).collect::<String>());
  }
  let actor = Actor { name: "yerel".into(), local: true };
  audit(state, &actor, &format!("ACTION:{eylem}"), kayit).await;
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
    Action::MarkerAdd { note, via } => {
      let mut i = state.obs.isaret_al(note.as_deref()).await?;
      i.note = note.clone();
      i.via = via.clone();
      let id = crate::db::profile::isaret_ekle(&state.db, &i).await.map_err(|e| format!("İşaret yazılamadı: {e}"))?;
      let mut v = json!(i);
      v["id"] = json!(id);
      Ok(v)
    }
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
    Action::Muzik { komut, liste } if komut == "playlistAdd" => {
      state.music.spotify_kitaplik(komut, liste.as_deref()).await.map(|ileti| json!({ "message": ileti })).map_err(|e| e.to_string())
    }
    Action::Muzik { komut, .. } => state.music.command(komut, None).await.map(|_| json!({ "command": komut })).map_err(|e| e.to_string()),
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
    Action::SourceLock { scene, source, locked } => {
      let sahne = match scene {
        Some(s) => s.clone(),
        None => state.obs.scene_snapshot().await?.current_scene,
      };
      let op = if *locked { "lock" } else { "unlock" };
      state.obs.scene_item_op(&sahne, source, op).await.map(|_| json!({ "source": source, "locked": locked }))
    }
    Action::AudioVolume { input, delta_db } => {
      let b = HotkeyBindingIn { id: "action".into(), kind: "volume".into(), input: input.clone(), delta: *delta_db, ..Default::default() };
      crate::hotkeys::run_obs_action(state, &b, "volume").await.map(|_| json!({ "input": input, "delta": delta_db }))
    }
    Action::RecordPause { pause } => state.obs.set_record_paused(*pause).await.map(|d| json!({ "paused": d })),
    Action::RecordSplit => state.obs.split_recording().await.map(|_| json!({ "split": true })),
    Action::VirtualCam { on } => state.obs.set_virtualcam(*on).await.map(|a| json!({ "active": a })),
    Action::Filter { source, filter, acik } => state
      .obs
      .set_filter_enabled(source, filter, *acik)
      .await
      .map(|a| json!({ "source": source, "filter": filter, "enabled": a })),
    Action::StudioTransition { transition } => state.obs.studio_transition(transition.as_deref()).await.map(|_| json!({ "transitioned": true })),
    Action::Caption { text } => state.obs.send_caption(text).await.map(|_| json!({ "sent": true })),
    Action::Hold { input, konus, basili } => {
      // Bas-konuş: basılıyken açık, bırakınca kapalı; bas-sustur tersi
      let sessiz = if *konus { !basili } else { *basili };
      state.obs.set_muted(input, sessiz).await.map(|_| json!({ "input": input, "muted": sessiz }))
    }
    Action::Media { input, eylem } => state.obs.media_action(input, eylem).await.map(|e| json!({ "input": input, "action": e })),
    Action::SesliBasKonus { basili } => {
      // Ön yüz bunu gizli dinleyici çerçevesine (AxBoT /sesli-dinleyici) postMessage ile iletir
      state.broadcast_json(&json!({ "type": "sesli-ptt", "basili": basili }));
      Ok(json!({ "basili": basili }))
    }
  }
}

/// AxBoT'un ekip çapındaki uyarı kuyruğu denetimine iletir. Sürüm gönderilmez: hızlı eylemde son yazan kazanır
/// (AxBoT sürümsüz isteği kabul eder ve yeni durumu tüm panellere yayar).
async fn uyari_denetimi(action: &str, actor: &str) -> Result<Value, String> {
  let url = format!("http://127.0.0.1:{}/api/alerts/control", crate::axbot::port());
  let client = reqwest::Client::builder()
    .timeout(Duration::from_secs(3))
    .build()
    .map_err(|e| e.to_string())?;
  let res = client
    .post(url)
    .json(&json!({ "action": action, "actor": actor.chars().take(40).collect::<String>() }))
    .send()
    .await
    .map_err(|_| "AxBoT'a ulaşılamadı (Bot sekmesinden başlatın)".to_string())?;
  let durum = res.status();
  let govde: Value = res.json().await.unwrap_or(Value::Null);
  if !durum.is_success() {
    return Err(govde.get("error").and_then(|v| v.as_str()).unwrap_or("Uyarı denetimi uygulanamadı").to_string());
  }
  Ok(govde.get("state").cloned().unwrap_or(Value::Null))
}
