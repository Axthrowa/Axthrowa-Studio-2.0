//! Bot modülü 2–8 HTTP handlers.

use std::net::SocketAddr;
use std::sync::Arc;

use axum::extract::{ConnectInfo, Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::AppState;

pub fn router() -> Router<Arc<AppState>> {
  Router::new()
    // Alerts
    .route("/api/bot/alerts", get(api_alerts_get).put(api_alerts_put))
    .route("/api/bot/alerts/seed", post(api_alerts_seed))
    .route("/api/bot/alerts/test", post(api_alerts_test))
    .route("/api/bot/alerts/queue", get(api_alerts_queue))
    .route(
      "/api/bot/alerts/variants",
      get(api_alert_variants_get).put(api_alert_variants_put),
    )
    // Widgets / Goals
    .route(
      "/api/bot/goals",
      get(api_goals_get).post(api_goals_post).patch(api_goals_patch),
    )
    .route("/api/bot/widgets", get(api_widgets_get).post(api_widgets_post))
    .route("/api/bot/widgets/seed", post(api_widgets_seed))
    .route("/api/bot/widgets/test", post(api_widgets_test))
    .route(
      "/api/bot/widgets/{id}/config",
      axum::routing::put(api_widgets_patch_config).patch(api_widgets_patch_config),
    )
    .route("/api/bot/widgets/{id}", axum::routing::delete(api_widgets_delete))
    // Chatbot
    .route(
      "/api/bot/commands",
      get(api_commands_get)
        .post(api_commands_post)
        .put(api_commands_put)
        .delete(api_commands_delete),
    )
    .route(
      "/api/bot/timers",
      get(api_timers_get)
        .post(api_timers_post)
        .put(api_timers_put)
        .delete(api_timers_delete),
    )
    .route("/api/bot/filters", get(api_filters_get).put(api_filters_put))
    .route(
      "/api/bot/bot-settings",
      get(api_bot_settings_get).put(api_bot_settings_put),
    )
    .route("/api/bot/bot/console", get(api_bot_console))
    .route(
      "/api/bot/settings/kick",
      get(api_kick_settings_get)
        .post(api_kick_settings_post)
        .delete(api_kick_settings_delete),
    )
    .route(
      "/api/bot/settings/kick/status",
      get(api_kick_settings_status),
    )
    .route("/api/bot/sync/eski-panel", post(api_eski_paneli_aktar))
    // Loyalty
    .route("/api/bot/loyalty/users", get(api_loyalty_users))
    .route(
      "/api/bot/loyalty/settings",
      get(api_loyalty_settings_get).put(api_loyalty_settings_put),
    )
    .route(
      "/api/bot/shop",
      get(api_shop_get)
        .post(api_shop_post)
        .put(api_shop_put)
        .delete(api_shop_delete),
    )
    .route("/api/bot/loyalty/adjust", post(api_loyalty_adjust))
    .route("/api/bot/loyalty/tick", post(api_loyalty_tick))
    .route("/api/bot/loyalty/reset", post(api_loyalty_reset))
    // Games
    .route(
      "/api/bot/games/settings",
      get(api_games_settings_get).put(api_games_settings_put),
    )
    .route("/api/bot/games/heist/start", post(api_heist_start))
    .route("/api/bot/games/heist/join", post(api_heist_join))
    .route("/api/bot/games/heist/settle", post(api_heist_settle))
    .route("/api/bot/games/duel", post(api_duel))
    .route("/api/bot/games/roulette", post(api_roulette))
    .route("/api/bot/games/8ball", post(api_eightball))
    // Integrations — spesifik path önce
    .route("/api/bot/integrations/discord/test", post(api_discord_test))
    .route(
      "/api/bot/integrations/{provider}",
      get(api_integration_get).put(api_integration_put),
    )
    .route(
      "/api/bot/soundboard",
      get(api_soundboard_get).post(api_soundboard_post),
    )
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
    .route(
      "/api/bot/remote/panel/dashboard",
      get(api_remote_dashboard),
    )
    .route(
      "/api/bot/remote/panel/commands",
      get(api_remote_commands_get).post(api_remote_commands_post),
    )
    .route("/api/bot/remote/alerts/trigger", post(api_remote_alert_trigger))
    .route("/api/bot/remote/chat/send", post(api_remote_chat_send))
    .route("/api/bot/remote/obs/scene", post(api_remote_obs_scene))
    .route("/api/bot/remote/settings/patch", post(api_remote_settings_patch))
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

async fn require_remote_perm(
  state: &AppState,
  headers: &HeaderMap,
  perm: &str,
) -> Result<crate::db::bot_api::RemoteAuthInfo, (StatusCode, String)> {
  let info = require_remote(state, headers).await?;
  if !crate::db::bot_api::remote_has_perm(&info, perm) {
    return Err((
      StatusCode::FORBIDDEN,
      format!("Yetki yok: {perm}"),
    ));
  }
  Ok(info)
}

fn ok_json<T: serde::Serialize>(v: T) -> Json<Value> {
  Json(serde_json::to_value(v).unwrap_or(Value::Null))
}

// ─── Alerts ───────────────────────────────────────────────────────────

async fn api_alerts_get(
  State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let rows = crate::db::bot_api::list_alerts(&state.db)
    .await
    .map_err(map_err)?;
  Ok(Json(json!({ "alerts": rows })))
}

async fn api_alerts_put(
  State(state): State<Arc<AppState>>,
  Json(body): Json<Value>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let items = body
    .get("alerts")
    .and_then(|v| v.as_array())
    .cloned()
    .or_else(|| body.as_array().cloned())
    .unwrap_or_else(|| vec![body]);
  let rows = crate::db::bot_api::upsert_alerts(&state.db, &items)
    .await
    .map_err(map_err)?;
  Ok(Json(json!({ "alerts": rows })))
}

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

async fn api_alerts_queue(
  State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let rows = crate::db::bot_api::list_alert_queue(&state.db)
    .await
    .map_err(map_err)?;
  Ok(Json(json!({ "queue": rows })))
}

async fn api_alert_variants_get(
  State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let rows = crate::db::alerts::list_alert_variants(&state.db)
    .await
    .map_err(map_err)?;
  Ok(Json(json!({ "variants": rows })))
}

async fn api_alert_variants_put(
  State(state): State<Arc<AppState>>,
  Json(body): Json<Value>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let items = body
    .get("variants")
    .and_then(|v| v.as_array())
    .cloned()
    .or_else(|| body.as_array().cloned())
    .unwrap_or_else(|| vec![body]);
  let rows = crate::db::alerts::upsert_alert_variants(
    &state.db,
    &items,
    &state.data_dir,
    &state.base_url(),
  )
  .await
  .map_err(map_err)?;
  Ok(Json(json!({ "variants": rows })))
}

// ─── Goals / Widgets ──────────────────────────────────────────────────

async fn api_goals_get(
  State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let rows = crate::db::bot_api::list_goals(&state.db)
    .await
    .map_err(map_err)?;
  Ok(Json(json!({ "goals": rows })))
}

async fn api_goals_post(
  State(state): State<Arc<AppState>>,
  Json(body): Json<Value>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::db::bot_api::create_goal(&state.db, &body)
    .await
    .map(ok_json)
    .map_err(map_err)
}

async fn api_goals_patch(
  State(state): State<Arc<AppState>>,
  Json(body): Json<Value>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::db::bot_api::patch_goal(&state.db, &body)
    .await
    .map(ok_json)
    .map_err(map_err)
}

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
async fn api_widgets_test(
  State(state): State<Arc<AppState>>,
  Json(body): Json<Value>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let kind = body
    .get("kind")
    .and_then(|v| v.as_str())
    .unwrap_or("cup")
    .to_ascii_lowercase();
  let event = body
    .get("event")
    .and_then(|v| v.as_str())
    .map(|s| s.to_ascii_lowercase());
  let now = crate::db::chrono_now();
  let mut broadcast = 0usize;

  let push_alert = |st: &AppState, ev_kind: &str, user: &str, message: &str, amount: Value| -> usize {
    let ev = json!({
      "id": uuid::Uuid::new_v4().to_string(),
      "kind": ev_kind,
      "user": user,
      "message": message,
      "amount": amount,
      "platform": "test",
      "t": now,
    });
    st.broadcast_json(&json!({
      "type": "settings",
      "screen": "panel",
      "data": { "_widgetEvent": ev }
    }));
    st.broadcast_json(&json!({ "type": "trigger_alert", "data": ev.clone() }));
    st.broadcast_json(&json!({
      "type": "widget-test",
      "widgetKind": kind,
      "data": ev.clone()
    }));
    let subathon_type = match ev_kind {
      "follow" => Some("new_follow"),
      "sub" => Some("new_sub"),
      "tip" | "donation" => Some("new_donation"),
      "raid" => Some("new_kick"),
      _ => None,
    };
    if let Some(evt_type) = subathon_type {
      st.broadcast_json(&json!({
        "type": evt_type,
        "user": user,
        "message": message,
        "amount": amount,
        "platform": "test",
        "t": now,
        "data": ev
      }));
      return 4;
    }
    3
  };

  let push_chat = |st: &AppState, text: &str, user: &str| {
    let msg = json!({
      "type": "chat-message",
      "platform": "test",
      "user": user,
      "user_key": format!("test:{user}"),
      "text": text,
      "badges": ["subscriber"],
      "is_mod": false,
      "is_vip": false,
      "is_sub": true,
      "color": "#3ECFCF",
      "id": uuid::Uuid::new_v4().to_string(),
      "t": now,
    });
    st.broadcast_json(&msg);
    st.broadcast_json(&json!({
      "type": "widget-test",
      "widgetKind": kind,
      "data": msg
    }));
  };

  if let Some(ev) = event.as_deref() {
    match ev {
      "chat" | "message" => {
        let text = if kind == "emotewall" || kind == "emotecombo" {
          "🔥 😂 ✨ 🎉 TEST EMOTE"
        } else {
          "Merhaba! Bu bir widget test mesajı."
        };
        push_chat(state.as_ref(), text, "TestUser");
        broadcast += 2;
      }
      "tip" | "donation" => {
        broadcast += push_alert(state.as_ref(), "tip", "TestDonor", "Test bağışı!", json!(100));
      }
      "sub" => {
        broadcast += push_alert(state.as_ref(), "sub", "TestSub", "Test abone!", Value::Null);
      }
      "follow" => {
        broadcast += push_alert(state.as_ref(), "follow", "TestFollower", "", Value::Null);
      }
      "kick" | "host" | "raid" => {
        state.broadcast_json(&serde_json::json!({
          "type": "new_kick",
          "user": "TestKick",
          "message": "Kick / host test",
          "platform": "test",
          "t": now,
          "data": {
            "kind": "kick",
            "user": "TestKick",
            "message": "Kick / host test",
            "platform": "test",
            "t": now,
          }
        }));
        broadcast += push_alert(state.as_ref(), "raid", "TestKick", "Kick test", Value::Null);
      }
      "bits" => {
        broadcast += push_alert(state.as_ref(), "bits", "TestCheerer", "Cheer test!", json!(500));
      }
      "vote" => {
        push_chat(state.as_ref(), "!oy 1", "TestVoter");
        broadcast += 2;
      }
      "goal_bump" | "goal-bump" => {
        let mut bump = body
          .get("amount")
          .and_then(|v| v.as_f64())
          .unwrap_or(0.0);
        if bump <= 0.0 {
          bump = 15.0;
          if let Ok(cid) = crate::db::default_channel_id(&state.db).await {
            if let Ok(Some((cfg_text,))) = sqlx::query_as::<_, (String,)>(
              "SELECT config_json FROM widget_instances
               WHERE channel_id = ? AND kind IN ('goal','goals') AND enabled = 1
               ORDER BY sort_order LIMIT 1",
            )
            .bind(&cid)
            .fetch_optional(&state.db)
            .await
            {
              if let Ok(cfg) = serde_json::from_str::<serde_json::Value>(&cfg_text) {
                let target = cfg.get("target").and_then(|v| v.as_f64()).unwrap_or(100.0).max(1.0);
                let start = cfg
                  .get("startValue")
                  .or_else(|| cfg.get("start"))
                  .and_then(|v| v.as_f64())
                  .unwrap_or(0.0);
                bump = ((target - start).max(1.0) * 0.15).max(5.0);
              }
            }
          }
        }
        match crate::db::widgets::bump_goal_widget_current(&state.db, bump, false).await {
          Ok(rows) => {
            for (_id, cur, target, completed) in &rows {
              state.broadcast_json(&serde_json::json!({
                "type": "goal-update",
                "amount": bump,
                "current": cur,
                "target": target,
                "t": now,
              }));
              state.broadcast_json(&serde_json::json!({
                "type": "config_updated",
                "kind": "goal",
                "t": now,
              }));
              if *completed {
                state.broadcast_json(&serde_json::json!({
                  "type": "widget-bus",
                  "from": "goal",
                  "action": "goal.complete",
                  "payload": { "current": cur, "target": target, "user": "Test" },
                  "t": now,
                }));
                broadcast += 3;
              } else {
                broadcast += 2;
              }
            }
          }
          Err(e) => studio_warn!("[widgets/test] goal_bump: {e:#}"),
        }
        return Ok(Json(json!({
          "ok": true,
          "kind": kind,
          "event": ev,
          "broadcast": broadcast,
          "bump": bump,
        })));
      }
      "sfx_test" => {
        state.broadcast_json(&serde_json::json!({
          "type": "widget-sfx-test",
          "preset": "coin",
          "volume": 0.75,
          "t": now,
        }));
        broadcast += 1;
        return Ok(Json(json!({
          "ok": true,
          "kind": kind,
          "event": ev,
          "broadcast": broadcast,
        })));
      }
      _ => {
        broadcast += push_alert(
          state.as_ref(),
          "tip",
          "TestUser",
          &format!("test:{ev}"),
          json!(100),
        );
      }
    }

    return Ok(Json(json!({
      "ok": true,
      "kind": kind,
      "event": ev,
      "broadcast": broadcast,
    })));
  }

  match kind.as_str() {
    "chat" | "emotewall" | "emotecombo" => {
      let text = if kind == "emotewall" || kind == "emotecombo" {
        "🔥 🔥 🔥 TEST EMOTE"
      } else {
        "Merhaba! Bu bir widget test mesajı."
      };
      push_chat(state.as_ref(), text, "TestUser");
      broadcast += 2;
    }
    "cup" | "glass" | "subathon" | "hypetrain" | "hype" | "activity" => {
      broadcast += push_alert(state.as_ref(), "tip", "TestDonor", "Test bağışı!", json!(100));
      broadcast += push_alert(state.as_ref(), "sub", "TestSub", "Test abone!", Value::Null);
    }
    "goal" | "goals" | "viewers" | "labels" => {
      broadcast += push_alert(state.as_ref(), "follow", "TestFollower", "", Value::Null);
      broadcast += push_alert(state.as_ref(), "tip", "TestDonor", "100", json!(100));
    }
    "shoutout" | "shoutouts" => {
      push_chat(state.as_ref(), "!so @TestStreamer", "ModUser");
      broadcast += 2;
    }
    "wheel" | "fortunewheel" | "poll" | "polls" | "raffles" | "giveaway" => {
      let cmd = match kind.as_str() {
        "poll" | "polls" => "!oy 1",
        "raffles" | "giveaway" => "!katil",
        _ => "!cark",
      };
      push_chat(state.as_ref(), cmd, "TestUser");
      broadcast += 2;
    }
    "tts" | "cloudtts" | "credits" | "moviecredits" => {
      push_alert(state.as_ref(), "tip", "TestDonor", "Sesli test mesajı", json!(50));
      broadcast += 3;
    }
    _ => {
      broadcast += push_alert(
        state.as_ref(),
        "tip",
        "TestUser",
        &format!("test:{kind}"),
        json!(100),
      );
    }
  }

  Ok(Json(json!({
    "ok": true,
    "kind": kind,
    "broadcast": broadcast,
  })))
}

// ─── Chatbot ──────────────────────────────────────────────────────────

async fn api_commands_get(
  State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let rows = crate::db::bot_api::list_commands(&state.db)
    .await
    .map_err(map_err)?;
  Ok(Json(json!({ "commands": rows })))
}

async fn api_commands_post(
  State(state): State<Arc<AppState>>,
  Json(body): Json<Value>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::db::bot_api::upsert_command(&state.db, &body, true)
    .await
    .map(ok_json)
    .map_err(map_err)
}

async fn api_commands_put(
  State(state): State<Arc<AppState>>,
  Json(body): Json<Value>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::db::bot_api::upsert_command(&state.db, &body, false)
    .await
    .map(ok_json)
    .map_err(map_err)
}

#[derive(Deserialize)]
struct IdQuery {
  id: Option<String>,
}

async fn api_commands_delete(
  State(state): State<Arc<AppState>>,
  Query(q): Query<IdQuery>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let id = q
    .id
    .ok_or((StatusCode::BAD_REQUEST, "id gerekli".into()))?;
  let ok = crate::db::bot_api::delete_command(&state.db, &id)
    .await
    .map_err(map_err)?;
  Ok(Json(json!({ "deleted": ok })))
}

async fn api_timers_get(
  State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let rows = crate::db::bot_api::list_timers(&state.db)
    .await
    .map_err(map_err)?;
  Ok(Json(json!({ "timers": rows })))
}

async fn api_timers_post(
  State(state): State<Arc<AppState>>,
  Json(body): Json<Value>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::db::bot_api::upsert_timer(&state.db, &body)
    .await
    .map(ok_json)
    .map_err(map_err)
}

async fn api_timers_put(
  State(state): State<Arc<AppState>>,
  Json(body): Json<Value>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::db::bot_api::upsert_timer(&state.db, &body)
    .await
    .map(ok_json)
    .map_err(map_err)
}

async fn api_timers_delete(
  State(state): State<Arc<AppState>>,
  Query(q): Query<IdQuery>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let id = q
    .id
    .ok_or((StatusCode::BAD_REQUEST, "id gerekli".into()))?;
  let ok = crate::db::bot_api::delete_timer(&state.db, &id)
    .await
    .map_err(map_err)?;
  Ok(Json(json!({ "deleted": ok })))
}

async fn api_filters_get(
  State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::db::bot_api::get_filters(&state.db)
    .await
    .map(ok_json)
    .map_err(map_err)
}

async fn api_filters_put(
  State(state): State<Arc<AppState>>,
  Json(body): Json<Value>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::db::bot_api::put_filters(&state.db, &body)
    .await
    .map(ok_json)
    .map_err(map_err)
}

async fn api_bot_settings_get(
  State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::db::bot_api::get_bot_settings(&state.db)
    .await
    .map(ok_json)
    .map_err(map_err)
}

async fn api_bot_console(
  State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let lines = state.bot_activity.snapshot(120);
  Ok(Json(json!({ "lines": lines })))
}

async fn api_bot_settings_put(
  State(state): State<Arc<AppState>>,
  Json(body): Json<Value>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::db::bot_api::put_bot_settings(&state.db, &body)
    .await
    .map(ok_json)
    .map_err(map_err)
}

#[derive(Deserialize)]
struct KickSettingsBody {
  #[serde(alias = "username", alias = "slug", alias = "channel")]
  username: Option<String>,
  #[serde(default, alias = "chatroom_id", alias = "chatroomId")]
  chatroom_id: Option<u64>,
}

/// GET /api/bot/settings/kick — kayıtlı kullanıcı + canlı durum
async fn api_kick_settings_get(
  State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
  Ok(Json(state.kick_chat.status_json()))
}

/// GET /api/bot/settings/kick/status — canlı Pusher bağlı mı?
async fn api_kick_settings_status(
  State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
  Ok(Json(state.kick_chat.status_json()))
}

/// POST /api/bot/settings/kick — kaydet + WebSocket’i hemen başlat
async fn api_kick_settings_post(
  State(state): State<Arc<AppState>>,
  Json(body): Json<KickSettingsBody>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let username = body
    .username
    .as_deref()
    .map(str::trim)
    .filter(|s| !s.is_empty())
    .ok_or_else(|| {
      (
        StatusCode::BAD_REQUEST,
        "username gerekli (Kick kullanıcı adı)".into(),
      )
    })?;

  studio_log!(
    "[api] Kick bağlan isteği: {username} chatroom={:?}",
    body.chatroom_id
  );
  let status = state
    .kick_chat
    .connect_with_chatroom(state.as_ref().clone(), username, body.chatroom_id)
    .await
    .map_err(map_err)?;

  // Panel sohbetBot.channelName ile senkron
  {
    use crate::settings::ScreenKind;
    let mut settings = state.settings.write();
    let mut panel = settings.get(ScreenKind::Panel).clone();
    if let Some(obj) = panel.as_object_mut() {
      let smart = obj
        .entry("sohbetBot".to_string())
        .or_insert_with(|| json!({}));
      if let Some(sb) = smart.as_object_mut() {
        sb.insert("channelName".into(), json!(username));
      }
      obj.insert("kickChannel".into(), json!(username));
    }
    settings.set(ScreenKind::Panel, panel);
    let _ = settings.save_one(&state.data_dir, ScreenKind::Panel);
  }

  Ok(Json(status))
}

/// DELETE /api/bot/settings/kick — Pusher bağlantısını kes
async fn api_kick_settings_delete(
  State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
  state.kick_chat.disconnect();
  let _ = crate::bot::kick_chat::clear_kick_slug(&state.db).await;
  Ok(Json(json!({
    "ok": true,
    "connected": false,
    "username": serde_json::Value::Null,
  })))
}

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

#[derive(Deserialize)]
struct LimitQuery {
  #[serde(default = "default_loyalty_limit")]
  limit: i64,
}

fn default_loyalty_limit() -> i64 {
  50
}

async fn api_loyalty_users(
  State(state): State<Arc<AppState>>,
  Query(q): Query<LimitQuery>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let rows = crate::db::bot_api::list_loyalty_users(&state.db, q.limit)
    .await
    .map_err(map_err)?;
  Ok(Json(json!({ "users": rows })))
}

async fn api_loyalty_settings_get(
  State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::db::bot_api::get_loyalty_settings(&state.db)
    .await
    .map(ok_json)
    .map_err(map_err)
}

async fn api_loyalty_settings_put(
  State(state): State<Arc<AppState>>,
  Json(body): Json<Value>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::db::bot_api::put_loyalty_settings(&state.db, &body)
    .await
    .map(ok_json)
    .map_err(map_err)
}

async fn api_shop_get(
  State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let rows = crate::db::bot_api::list_shop(&state.db)
    .await
    .map_err(map_err)?;
  Ok(Json(json!({ "items": rows })))
}

async fn api_shop_post(
  State(state): State<Arc<AppState>>,
  Json(body): Json<Value>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::db::bot_api::upsert_shop_item(&state.db, &body)
    .await
    .map(ok_json)
    .map_err(map_err)
}

async fn api_shop_put(
  State(state): State<Arc<AppState>>,
  Json(body): Json<Value>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::db::bot_api::upsert_shop_item(&state.db, &body)
    .await
    .map(ok_json)
    .map_err(map_err)
}

async fn api_shop_delete(
  State(state): State<Arc<AppState>>,
  Query(q): Query<IdQuery>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let id = q
    .id
    .ok_or((StatusCode::BAD_REQUEST, "id gerekli".into()))?;
  let ok = crate::db::bot_api::delete_shop_item(&state.db, &id)
    .await
    .map_err(map_err)?;
  Ok(Json(json!({ "deleted": ok })))
}

#[derive(Deserialize)]
struct AdjustBody {
  user_key: String,
  delta: i64,
  #[serde(default = "default_reason")]
  reason: String,
}

fn default_reason() -> String {
  "manual".into()
}

async fn api_loyalty_adjust(
  State(state): State<Arc<AppState>>,
  Json(body): Json<AdjustBody>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::db::bot_api::adjust_loyalty(&state.db, &body.user_key, body.delta, &body.reason)
    .await
    .map(ok_json)
    .map_err(map_err)
}

async fn api_loyalty_tick(
  State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::db::loyalty::loyalty_tick(&state.db)
    .await
    .map(Json)
    .map_err(map_err)
}

#[derive(Deserialize)]
struct LoyaltyResetBody {
  #[serde(default)]
  points: bool,
  #[serde(default)]
  levels: bool,
}

async fn api_loyalty_reset(
  State(state): State<Arc<AppState>>,
  Json(body): Json<LoyaltyResetBody>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let updated = crate::db::bot_api::reset_loyalty(&state.db, body.points, body.levels)
    .await
    .map_err(map_err)?;
  Ok(Json(json!({ "ok": true, "updated": updated })))
}

// ─── Games ────────────────────────────────────────────────────────────

async fn api_games_settings_get(
  State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::db::bot_api::get_game_settings(&state.db)
    .await
    .map(ok_json)
    .map_err(map_err)
}

async fn api_games_settings_put(
  State(state): State<Arc<AppState>>,
  Json(body): Json<Value>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::db::bot_api::put_game_settings(&state.db, &body)
    .await
    .map(ok_json)
    .map_err(map_err)
}

async fn api_heist_start(
  State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::db::bot_api::heist_start(&state.db)
    .await
    .map(ok_json)
    .map_err(map_err)
}

#[derive(Deserialize)]
struct HeistJoinBody {
  user_key: String,
  user_name: String,
  amount: i64,
}

async fn api_heist_join(
  State(state): State<Arc<AppState>>,
  Json(body): Json<HeistJoinBody>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::db::bot_api::heist_join(
    &state.db,
    &body.user_key,
    &body.user_name,
    body.amount,
  )
  .await
  .map(Json)
  .map_err(map_err)
}

async fn api_heist_settle(
  State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::db::bot_api::heist_settle(&state.db)
    .await
    .map(Json)
    .map_err(map_err)
}

#[derive(Deserialize)]
struct DuelBody {
  a_key: String,
  a_name: String,
  b_key: String,
  b_name: String,
  amount: i64,
}

async fn api_duel(
  State(state): State<Arc<AppState>>,
  Json(body): Json<DuelBody>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::db::bot_api::duel(
    &state.db,
    &body.a_key,
    &body.a_name,
    &body.b_key,
    &body.b_name,
    body.amount,
  )
  .await
  .map(Json)
  .map_err(map_err)
}

#[derive(Deserialize)]
struct RouletteBody {
  user_key: Option<String>,
  bet: Option<i64>,
  choice: Option<String>,
}

async fn api_roulette(
  State(state): State<Arc<AppState>>,
  Json(body): Json<RouletteBody>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::db::bot_api::roulette(
    &state.db,
    body.user_key.as_deref(),
    body.bet,
    body.choice.as_deref(),
  )
  .await
  .map(Json)
  .map_err(map_err)
}

#[derive(Deserialize)]
struct EightBody {
  user_key: Option<String>,
  cost: Option<i64>,
}

async fn api_eightball(
  State(state): State<Arc<AppState>>,
  body: Option<Json<EightBody>>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let b = body.map(|Json(v)| v).unwrap_or(EightBody {
    user_key: None,
    cost: None,
  });
  crate::db::bot_api::eightball(&state.db, b.user_key.as_deref(), b.cost)
    .await
    .map(Json)
    .map_err(map_err)
}

// ─── Integrations ─────────────────────────────────────────────────────

async fn api_integration_get(
  State(state): State<Arc<AppState>>,
  Path(provider): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::db::bot_api::get_integration(&state.db, &provider)
    .await
    .map(ok_json)
    .map_err(map_err)
}

async fn api_integration_put(
  State(state): State<Arc<AppState>>,
  Path(provider): Path<String>,
  Json(body): Json<Value>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::db::bot_api::put_integration(&state.db, &provider, &body)
    .await
    .map(ok_json)
    .map_err(map_err)
}

async fn api_discord_test(
  State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::db::bot_api::discord_test_webhook(&state.db)
    .await
    .map(Json)
    .map_err(map_err)
}

async fn api_soundboard_get(
  State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let rows = crate::db::bot_api::list_soundboard(&state.db)
    .await
    .map_err(map_err)?;
  Ok(Json(json!({ "pads": rows })))
}

async fn api_soundboard_post(
  State(state): State<Arc<AppState>>,
  Json(body): Json<Value>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::db::bot_api::upsert_soundboard(&state.db, &body)
    .await
    .map(ok_json)
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

async fn api_remote_dashboard(
  State(state): State<Arc<AppState>>,
  headers: HeaderMap,
) -> Result<Json<Value>, (StatusCode, String)> {
  let _ = require_remote_perm(&state, &headers, "dashboard").await?;
  crate::db::profile::dashboard(&state.db)
    .await
    .map(ok_json)
    .map_err(map_err)
}

async fn api_remote_commands_get(
  State(state): State<Arc<AppState>>,
  headers: HeaderMap,
) -> Result<Json<Value>, (StatusCode, String)> {
  let _ = require_remote_perm(&state, &headers, "commands").await?;
  let rows = crate::db::bot_api::list_commands(&state.db)
    .await
    .map_err(map_err)?;
  Ok(Json(json!({ "commands": rows })))
}

async fn api_remote_commands_post(
  State(state): State<Arc<AppState>>,
  headers: HeaderMap,
  Json(body): Json<Value>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let _ = require_remote_perm(&state, &headers, "commands").await?;
  let limited = json!({
    "id": body.get("id"),
    "name": body.get("name"),
    "response": body.get("response").cloned().unwrap_or(json!("")),
    "enabled": body.get("enabled").cloned().unwrap_or(json!(true)),
    "aliases": body.get("aliases").cloned().unwrap_or(json!([])),
    "cooldown_sec": body.get("cooldown_sec").cloned().unwrap_or(json!(5)),
  });
  crate::db::bot_api::upsert_command(&state.db, &limited, true)
    .await
    .map(ok_json)
    .map_err(map_err)
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

async fn api_remote_alert_trigger(
  State(state): State<Arc<AppState>>,
  headers: HeaderMap,
  Json(body): Json<Value>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let info = require_remote_perm(&state, &headers, "alerts").await?;
  let kind = body
    .get("kind")
    .and_then(|v| v.as_str())
    .unwrap_or("follow");
  let user = body
    .get("user")
    .and_then(|v| v.as_str())
    .unwrap_or(&info.username);
  let message = body
    .get("message")
    .and_then(|v| v.as_str())
    .unwrap_or("");
  let ev = json!({
    "id": uuid::Uuid::new_v4().to_string(),
    "kind": kind,
    "user": user,
    "message": message,
    "amount": body.get("amount").cloned().unwrap_or(Value::Null),
    "platform": "remote",
    "t": crate::db::chrono_now(),
  });
  state.broadcast_json(&json!({
    "type": "settings",
    "screen": "panel",
    "data": { "_widgetEvent": ev }
  }));
  state.broadcast_json(&json!({ "type": "trigger_alert", "data": ev }));
  Ok(Json(json!({ "ok": true, "event": ev })))
}

async fn api_remote_chat_send(
  State(state): State<Arc<AppState>>,
  headers: HeaderMap,
  Json(body): Json<Value>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let _ = require_remote_perm(&state, &headers, "chat").await?;
  let text = body
    .get("text")
    .or_else(|| body.get("message"))
    .and_then(|v| v.as_str())
    .unwrap_or("")
    .trim();
  if text.is_empty() {
    return Err((StatusCode::BAD_REQUEST, "text gerekli".into()));
  }
  let slug = crate::bot::pipeline::resolve_channels(&state)
    .await
    .kick_slug;
  state
    .kick_auth
    .send_chat(text, slug.as_deref())
    .await
    .map_err(map_err)?;
  // Twitch FE köprüsü
  state.broadcast_json(&json!({
    "type": "bot-reply-request",
    "platform": "twitch",
    "text": text,
    "t": crate::db::chrono_now(),
  }));
  Ok(Json(json!({ "ok": true })))
}

async fn api_remote_obs_scene(
  State(state): State<Arc<AppState>>,
  headers: HeaderMap,
  Json(body): Json<Value>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let _ = require_remote_perm(&state, &headers, "obs").await?;
  let scene = body
    .get("scene")
    .or_else(|| body.get("sceneName"))
    .and_then(|v| v.as_str())
    .unwrap_or("")
    .trim();
  if scene.is_empty() {
    return Err((StatusCode::BAD_REQUEST, "scene gerekli".into()));
  }
  state.broadcast_json(&json!({
    "type": "shop-obs-scene",
    "scene": scene,
    "user": "remote",
    "t": crate::db::chrono_now(),
  }));
  state.broadcast_json(&json!({
    "type": "settings",
    "screen": "panel",
    "data": { "_shopObsScene": { "scene": scene, "user": "remote" } }
  }));
  Ok(Json(json!({ "ok": true, "scene": scene })))
}

async fn api_remote_settings_patch(
  State(state): State<Arc<AppState>>,
  headers: HeaderMap,
  Json(body): Json<Value>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let _ = require_remote_perm(&state, &headers, "dashboard").await?;
  let screen = body
    .get("screen")
    .and_then(|v| v.as_str())
    .unwrap_or("panel");
  let kind = crate::settings::ScreenKind::parse(screen)
    .map_err(|e| (StatusCode::BAD_REQUEST, e))?;
  let patch = body
    .get("data")
    .cloned()
    .or_else(|| body.get("patch").cloned())
    .unwrap_or(body.clone());
  {
    let mut s = state.settings.write();
    let mut cur = s.get(kind).clone();
    if let (Some(c), Some(p)) = (cur.as_object_mut(), patch.as_object()) {
      for (k, v) in p {
        c.insert(k.clone(), v.clone());
      }
    }
    s.set(kind, cur.clone());
    s.save_one(&state.data_dir, kind)
      .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    state.broadcast_json(&json!({
      "type": "settings",
      "screen": screen,
      "data": cur,
    }));
  }
  Ok(Json(json!({ "ok": true })))
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
