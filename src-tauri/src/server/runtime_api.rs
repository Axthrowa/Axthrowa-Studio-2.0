//! Widget runtime HTTP — poll / raffle / song queue + donation webhook.

use std::collections::HashMap;
use std::sync::Arc;

use axum::extract::State;
use axum::http::StatusCode;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::db::chrono_now;
use crate::widget_runtime::{
  extract_youtube_id, PollState, RaffleState, SongQueueItem, SongQueueState,
};
use crate::AppState;

pub fn router() -> Router<Arc<AppState>> {
  Router::new()
    .route("/api/webhooks/donations", post(api_donations_webhook))
    .route("/api/bot/runtime/poll", get(api_poll_get).post(api_poll_start))
    .route("/api/bot/runtime/poll/stop", post(api_poll_stop))
    .route(
      "/api/bot/runtime/raffle",
      get(api_raffle_get).post(api_raffle_start),
    )
    .route("/api/bot/runtime/raffle/draw", post(api_raffle_draw))
    .route("/api/bot/runtime/raffle/stop", post(api_raffle_stop))
    .route(
      "/api/bot/runtime/songs",
      get(api_songs_get).post(api_songs_add),
    )
    .route("/api/bot/runtime/songs/skip", post(api_songs_skip))
    .route("/api/bot/runtime/songs/play", post(api_songs_play))
    .route("/api/bot/runtime/songs/pause", post(api_songs_pause))
    .route("/api/bot/runtime/songs/clear", post(api_songs_clear))
    .route("/api/bot/runtime/songs/reorder", post(api_songs_reorder))
    .route("/api/bot/runtime/bus", post(api_widget_bus))
}

fn broadcast_poll(state: &AppState) {
  state.broadcast_json(&json!({
    "type": "poll-state",
    "data": state.widget_rt.poll_json(),
    "t": chrono_now(),
  }));
}

fn broadcast_raffle(state: &AppState) {
  state.broadcast_json(&json!({
    "type": "raffle-state",
    "data": state.widget_rt.raffle_json(),
    "t": chrono_now(),
  }));
}

fn broadcast_songs(state: &AppState) {
  state.broadcast_json(&json!({
    "type": "sr-queue",
    "data": state.widget_rt.songs_json(),
    "t": chrono_now(),
  }));
}

fn broadcast_widget_bus(state: &AppState, from: &str, action: &str, payload: Value) {
  state.broadcast_json(&json!({
    "type": "widget-bus",
    "from": from,
    "action": action,
    "payload": payload,
    "t": chrono_now(),
  }));
}

#[derive(Deserialize)]
struct WidgetBusBody {
  from: String,
  action: String,
  #[serde(default)]
  payload: Value,
}

async fn api_widget_bus(
  State(state): State<Arc<AppState>>,
  Json(body): Json<WidgetBusBody>,
) -> Json<Value> {
  let from = if body.from.is_empty() {
    "panel".into()
  } else {
    body.from
  };
  let action = if body.action.is_empty() {
    "ping".into()
  } else {
    body.action
  };
  let payload = if body.payload.is_null() {
    json!({})
  } else {
    body.payload
  };
  broadcast_widget_bus(&state, &from, &action, payload);
  Json(json!({ "ok": true, "from": from, "action": action }))
}

// ── Poll ──────────────────────────────────────────────────────────────

async fn api_poll_get(State(state): State<Arc<AppState>>) -> Json<Value> {
  Json(state.widget_rt.poll_json())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PollStartBody {
  question: String,
  options: Vec<String>,
  #[serde(default = "default_oy")]
  command: String,
}

fn default_oy() -> String {
  "!oy".into()
}

async fn api_poll_start(
  State(state): State<Arc<AppState>>,
  Json(body): Json<PollStartBody>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let opts: Vec<String> = body
    .options
    .into_iter()
    .map(|s| s.trim().to_string())
    .filter(|s| !s.is_empty())
    .collect();
  if body.question.trim().is_empty() || opts.len() < 2 {
    return Err((
      StatusCode::BAD_REQUEST,
      "Soru ve en az 2 seçenek gerekli".into(),
    ));
  }
  let mut votes = HashMap::new();
  for i in 1..=opts.len() as u32 {
    votes.insert(i, 0);
  }
  let cmd = if body.command.trim().is_empty() {
    "!oy".into()
  } else {
    body.command.trim().to_lowercase()
  };
  let question = body.question.trim().to_string();
  let opts_len = opts.len();
  *state.widget_rt.poll.write() = PollState {
    active: true,
    question: question.clone(),
    options: opts,
    command: cmd,
    votes,
    voters: Default::default(),
  };
  broadcast_poll(&state);
  broadcast_widget_bus(
    &state,
    "poll",
    "poll.started",
    json!({ "question": question, "options": opts_len }),
  );
  Ok(Json(state.widget_rt.poll_json()))
}

async fn api_poll_stop(State(state): State<Arc<AppState>>) -> Json<Value> {
  let snapshot = state.widget_rt.poll_json();
  state.widget_rt.poll.write().active = false;
  broadcast_poll(&state);
  broadcast_widget_bus(&state, "poll", "poll.ended", snapshot.clone());
  Json(state.widget_rt.poll_json())
}

// ── Raffle ────────────────────────────────────────────────────────────

async fn api_raffle_get(State(state): State<Arc<AppState>>) -> Json<Value> {
  Json(state.widget_rt.raffle_json())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RaffleStartBody {
  #[serde(default = "default_katil")]
  join_command: String,
  #[serde(default = "default_dur")]
  duration_sec: u32,
}

fn default_katil() -> String {
  "!katil".into()
}
fn default_dur() -> u32 {
  120
}

async fn api_raffle_start(
  State(state): State<Arc<AppState>>,
  Json(body): Json<RaffleStartBody>,
) -> Json<Value> {
  let now = chrono_now();
  let dur = body.duration_sec.max(10);
  *state.widget_rt.raffle.write() = RaffleState {
    active: true,
    join_command: if body.join_command.trim().is_empty() {
      "!katil".into()
    } else {
      body.join_command.trim().to_lowercase()
    },
    duration_sec: dur,
    entrants: vec![],
    winner: None,
    ends_at: Some(now + dur as i64),
  };
  broadcast_raffle(&state);
  Json(state.widget_rt.raffle_json())
}

async fn api_raffle_draw(State(state): State<Arc<AppState>>) -> Json<Value> {
  {
    let mut r = state.widget_rt.raffle.write();
    if r.entrants.is_empty() {
      r.winner = None;
    } else {
      let idx = (chrono_now() as usize).wrapping_mul(1103515245) % r.entrants.len();
      r.winner = Some(r.entrants[idx].clone());
      r.active = false;
    }
  }
  let data = state.widget_rt.raffle_json();
  state.broadcast_json(&json!({
    "type": "raffle-state",
    "data": data,
    "t": chrono_now(),
  }));
  if let Some(w) = state.widget_rt.raffle.read().winner.clone() {
    state.broadcast_json(&json!({
      "type": "raffle-winner",
      "winner": w.clone(),
      "t": chrono_now(),
    }));
    broadcast_widget_bus(
      &state,
      "raffles",
      "raffle.winner",
      json!({ "winner": w }),
    );
  }
  Json(state.widget_rt.raffle_json())
}

async fn api_raffle_stop(State(state): State<Arc<AppState>>) -> Json<Value> {
  state.widget_rt.raffle.write().active = false;
  broadcast_raffle(&state);
  Json(state.widget_rt.raffle_json())
}

// ── Songs ─────────────────────────────────────────────────────────────

async fn api_songs_get(State(state): State<Arc<AppState>>) -> Json<Value> {
  Json(state.widget_rt.songs_json())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SongAddBody {
  #[serde(default)]
  text: String,
  #[serde(default)]
  by: String,
  #[serde(default)]
  video_id: Option<String>,
  #[serde(default)]
  title: Option<String>,
}

async fn api_songs_add(
  State(state): State<Arc<AppState>>,
  Json(body): Json<SongAddBody>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let video_id = body
    .video_id
    .filter(|s| !s.is_empty())
    .or_else(|| extract_youtube_id(&body.text));
  let title = body
    .title
    .filter(|s| !s.is_empty())
    .unwrap_or_else(|| {
      video_id
        .as_ref()
        .map(|id| format!("YouTube {id}"))
        .unwrap_or_else(|| body.text.chars().take(80).collect())
    });
  if title.trim().is_empty() && video_id.is_none() {
    return Err((StatusCode::BAD_REQUEST, "Şarkı veya YouTube link gerekli".into()));
  }
  let item = SongQueueItem {
    id: uuid::Uuid::new_v4().to_string(),
    title,
    by: if body.by.is_empty() {
      "panel".into()
    } else {
      body.by
    },
    url: video_id
      .as_ref()
      .map(|id| format!("https://www.youtube.com/watch?v={id}")),
    video_id,
    requested_at: chrono_now(),
  };
  {
    let mut s = state.widget_rt.songs.write();
    s.queue.push(item);
    if s.current.is_none() {
      promote_next(&mut s);
    }
  }
  broadcast_songs(&state);
  Ok(Json(state.widget_rt.songs_json()))
}

fn promote_next(s: &mut SongQueueState) {
  if s.queue.is_empty() {
    s.current = None;
    s.playing = false;
    return;
  }
  s.current = Some(s.queue.remove(0));
  s.playing = true;
}

async fn api_songs_skip(State(state): State<Arc<AppState>>) -> Json<Value> {
  {
    let mut s = state.widget_rt.songs.write();
    promote_next(&mut s);
  }
  broadcast_songs(&state);
  Json(state.widget_rt.songs_json())
}

async fn api_songs_play(State(state): State<Arc<AppState>>) -> Json<Value> {
  {
    let mut s = state.widget_rt.songs.write();
    if s.current.is_none() {
      promote_next(&mut s);
    } else {
      s.playing = true;
    }
  }
  broadcast_songs(&state);
  Json(state.widget_rt.songs_json())
}

async fn api_songs_pause(State(state): State<Arc<AppState>>) -> Json<Value> {
  state.widget_rt.songs.write().playing = false;
  broadcast_songs(&state);
  Json(state.widget_rt.songs_json())
}

async fn api_songs_clear(State(state): State<Arc<AppState>>) -> Json<Value> {
  *state.widget_rt.songs.write() = SongQueueState::default();
  broadcast_songs(&state);
  Json(state.widget_rt.songs_json())
}

#[derive(Deserialize)]
struct SongReorderBody {
  #[serde(default)]
  order: Vec<String>,
}

async fn api_songs_reorder(
  State(state): State<Arc<AppState>>,
  Json(body): Json<SongReorderBody>,
) -> Result<Json<Value>, (StatusCode, String)> {
  if body.order.is_empty() {
    return Err((StatusCode::BAD_REQUEST, "order gerekli".into()));
  }
  {
    let mut s = state.widget_rt.songs.write();
    let mut by_id: HashMap<String, SongQueueItem> = s
      .queue
      .drain(..)
      .map(|item| (item.id.clone(), item))
      .collect();
    let mut next = Vec::with_capacity(body.order.len());
    for id in &body.order {
      if let Some(item) = by_id.remove(id) {
        next.push(item);
      }
    }
    // Kimliği listede olmayanları sona ekle
    for item in by_id.into_values() {
      next.push(item);
    }
    s.queue = next;
  }
  broadcast_songs(&state);
  Ok(Json(state.widget_rt.songs_json()))
}

// ── Donations webhook ─────────────────────────────────────────────────

#[derive(Deserialize)]
struct DonationWebhook {
  #[serde(default)]
  amount: f64,
  #[serde(default)]
  user: String,
  #[serde(default)]
  message: String,
  #[serde(default)]
  currency: String,
  /// Hedef widget kind veya goal id (opsiyonel)
  #[serde(default)]
  goal_id: Option<String>,
}

async fn api_donations_webhook(
  State(state): State<Arc<AppState>>,
  Json(body): Json<DonationWebhook>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let amount = if body.amount > 0.0 { body.amount } else { 1.0 };
  let user = if body.user.is_empty() {
    "Anonim".into()
  } else {
    body.user
  };

  // goals tablosuna ekle (ilk aktif hedef veya goal_id)
  if let Err(e) = crate::db::bot_api::apply_donation_to_goals(
    &state.db,
    amount,
    body.goal_id.as_deref(),
  )
  .await
  {
    studio_warn!("[webhook/donations] goal update: {e:#}");
  }

  // Widget config current alanını da artır (kind=goal)
  let mut completed_any = false;
  let mut last_current = 0.0_f64;
  match crate::db::widgets::bump_goal_widget_current(&state.db, amount, true).await {
    Ok(rows) => {
      for (_id, cur, target, completed) in rows {
        last_current = cur;
        if completed {
          completed_any = true;
          broadcast_widget_bus(
            &state,
            "goal",
            "goal.complete",
            json!({ "current": cur, "target": target, "user": user }),
          );
        } else {
          broadcast_widget_bus(
            &state,
            "goal",
            "goal.progress",
            json!({ "current": cur, "target": target, "amount": amount }),
          );
        }
      }
    }
    Err(e) => studio_warn!("[webhook/donations] widget bump: {e:#}"),
  }

  state.broadcast_json(&json!({
    "type": "trigger_alert",
    "data": {
      "kind": "donation",
      "type": "donation",
      "user": user,
      "amount": amount,
      "currency": body.currency,
      "message": body.message,
      "t": chrono_now(),
    }
  }));
  state.broadcast_json(&json!({
    "type": "goal-update",
    "amount": amount,
    "current": last_current,
    "user": user,
    "t": chrono_now(),
  }));
  state.broadcast_json(&json!({
    "type": "config_updated",
    "kind": "goal",
    "t": chrono_now(),
  }));

  Ok(Json(json!({
    "ok": true,
    "amount": amount,
    "user": user,
    "goalComplete": completed_any,
  })))
}

struct RuntimeCmdFlags {
  oy: bool,
  sr: bool,
  katil: bool,
}

fn runtime_command_flags(extras_json: &str) -> RuntimeCmdFlags {
  let extras = crate::db::bot_api::parse_json_object(extras_json);
  let rc = extras.get("runtime_commands").cloned().unwrap_or(json!({}));
  RuntimeCmdFlags {
    oy: rc.get("oy").and_then(|v| v.as_bool()).unwrap_or(true),
    sr: rc.get("sr").and_then(|v| v.as_bool()).unwrap_or(true),
    katil: rc.get("katil").and_then(|v| v.as_bool()).unwrap_or(true),
  }
}

/// Chat pipeline: aktif anket / çekiliş / !sr
pub async fn handle_runtime_chat(
  state: &AppState,
  user: &str,
  user_key: &str,
  text: &str,
  extras_json: &str,
) -> Option<String> {
  let lower = text.trim().to_lowercase();
  let key = if user_key.is_empty() { user } else { user_key };
  let cmds = runtime_command_flags(extras_json);

  // Poll vote
  {
    let mut poll = state.widget_rt.poll.write();
    if poll.active && !poll.command.is_empty() && lower.starts_with(&poll.command) {
      if !cmds.oy {
        return Some("Anket komutu kapalı.".into());
      }
      if poll.voters.contains(key) {
        return Some("Zaten oy verdin.".into());
      }
      let rest = lower[poll.command.len()..].trim();
      let token = rest.split_whitespace().next().unwrap_or("");
      let mut idx = token.parse::<u32>().unwrap_or(0);
      if idx == 0 {
        if let Some(i) = poll
          .options
          .iter()
          .position(|o| o.to_lowercase() == token)
        {
          idx = (i + 1) as u32;
        }
      }
      if idx >= 1 && (idx as usize) <= poll.options.len() {
        *poll.votes.entry(idx).or_insert(0) += 1;
        poll.voters.insert(key.to_string());
        drop(poll);
        broadcast_poll(state);
        return Some(format!("Oyun kaydedildi ({idx})."));
      }
      return Some(format!("Geçersiz oy. {} 1-{}", poll.command, poll.options.len()));
    }
  }

  // Raffle join
  {
    let mut raffle = state.widget_rt.raffle.write();
    if raffle.active && !raffle.join_command.is_empty() {
      let cmd = raffle.join_command.clone();
      if lower == cmd || lower.starts_with(&(cmd.clone() + " ")) {
        if !cmds.katil {
          return Some("Çekiliş komutu kapalı.".into());
        }
        if !raffle.entrants.iter().any(|e| e.eq_ignore_ascii_case(user)) {
          raffle.entrants.push(user.to_string());
          drop(raffle);
          broadcast_raffle(state);
          return Some("Çekilişe katıldın!".into());
        }
        return Some("Zaten listedesin.".into());
      }
    }
  }

  // Song request !sr
  if lower.starts_with("!sr") || lower.starts_with("!istek") || lower.starts_with("!song") {
    if !cmds.sr {
      return Some("Şarkı isteği komutu kapalı.".into());
    }
    let rest = text
      .trim()
      .split_once(char::is_whitespace)
      .map(|(_, r)| r.trim())
      .unwrap_or("")
      .to_string();
    if rest.is_empty() {
      return Some("Kullanım: !sr <youtube link veya isim>".into());
    }
    let video_id = extract_youtube_id(&rest);
    let item = SongQueueItem {
      id: uuid::Uuid::new_v4().to_string(),
      title: video_id
        .as_ref()
        .map(|id| format!("YouTube {id}"))
        .unwrap_or_else(|| rest.chars().take(80).collect()),
      by: user.to_string(),
      url: video_id
        .as_ref()
        .map(|id| format!("https://www.youtube.com/watch?v={id}")),
      video_id,
      requested_at: chrono_now(),
    };
    {
      let mut s = state.widget_rt.songs.write();
      if s.queue.len() >= 40 {
        return Some("Müzik sırası dolu.".into());
      }
      s.queue.push(item);
      if s.current.is_none() {
        promote_next(&mut s);
      }
    }
    broadcast_songs(state);
    return Some("Sıraya eklendi ✓".into());
  }

  None
}
