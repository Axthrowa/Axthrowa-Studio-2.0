//! Mesaj işleme — sohbet kaydı → istatistik → overlay → widget komutları. Sohbet botu AxBoT'tur.

use std::sync::Arc;

use anyhow::Result;
use serde_json::json;

use crate::db::botaxt_api::get_bot_settings;
use crate::db::loyalty::ensure_loyalty_user;
use crate::db::profile::log_event;
use crate::db::{chrono_now, default_channel_id};
use crate::settings::ScreenKind;
use crate::AppState;

use super::activity::log_chat;
use super::integrations::ChatInbound;

pub struct ChannelConfig {
  pub kick_slug: Option<String>,
  pub twitch_login: Option<String>,
}

pub async fn resolve_channels(state: &AppState) -> ChannelConfig {
  let mut kick = None;
  let mut twitch = None;

  if let Ok(cid) = default_channel_id(&state.db).await {
    if let Ok(Some(row)) = sqlx::query_as::<_, (String,)>(
      "SELECT platforms_json FROM channels WHERE id = ?",
    )
    .bind(&cid)
    .fetch_optional(&state.db)
    .await
    {
      if let Ok(p) = serde_json::from_str::<serde_json::Value>(&row.0) {
        kick = p
          .get("kick")
          .and_then(|v| v.as_str())
          .map(|s| s.trim().to_string())
          .filter(|s| !s.is_empty());
        twitch = p
          .get("twitch")
          .and_then(|v| v.as_str())
          .map(|s| s.trim().trim_start_matches('#').to_string())
          .filter(|s| !s.is_empty());
      }
    }
  }

  let panel = state.settings.read().get(ScreenKind::Panel).clone();
  let starting = state.settings.read().get(ScreenKind::Starting).clone();

  if kick.is_none() {
    kick = panel
      .pointer("/smartBot/channelName")
      .and_then(|v| v.as_str())
      .or_else(|| panel.get("kickChannel").and_then(|v| v.as_str()))
      .map(|s| s.trim().to_string())
      .filter(|s| !s.is_empty());
  }
  if kick.is_none() {
    kick = starting
      .pointer("/socials/kick")
      .and_then(|v| v.as_str())
      .or_else(|| starting.get("kick").and_then(|v| v.as_str()))
      .map(|s| s.trim().to_string())
      .filter(|s| !s.is_empty());
  }
  if twitch.is_none() {
    twitch = panel
      .pointer("/smartBot/twitchChannel")
      .and_then(|v| v.as_str())
      .or_else(|| starting.pointer("/socials/twitch").and_then(|v| v.as_str()))
      .map(|s| s.trim().trim_start_matches('#').to_string())
      .filter(|s| !s.is_empty());
  }

  if kick.is_none() {
    let auth = state.kick_auth.status();
    kick = auth
      .get("broadcasterSlug")
      .and_then(|v| v.as_str())
      .filter(|s| !s.is_empty())
      .map(|s| s.to_string())
      .or_else(|| {
        auth
          .get("username")
          .and_then(|v| v.as_str())
          .filter(|s| !s.is_empty())
          .map(|s| s.to_string())
      });
  }

  ChannelConfig {
    kick_slug: kick,
    twitch_login: twitch,
  }
}

pub async fn handle_inbound(state: Arc<AppState>, msg: ChatInbound) -> Result<()> {
  let channel_id = default_channel_id(&state.db).await?;

  if msg.kind == "chat" {
    log_chat(&state, &msg.platform, &msg.user_name, &msg.text);
  }

  ensure_loyalty_user(
    &state.db,
    &channel_id,
    &msg.user_key,
    Some(&msg.user_name),
  )
  .await?;

  // 1) Pano istatistikleri (puan vermez)
  if msg.kind == "chat" && !msg.text.is_empty() {
    let now = chrono_now();
    let _ = sqlx::query(
      "INSERT INTO loyalty_users(
         channel_id, user_key, user_name, platform, points, xp, messages, watch_sec, last_seen
       ) VALUES(?, ?, ?, ?, 0, 0, 1, 0, ?)
       ON CONFLICT(channel_id, user_key) DO UPDATE SET
         user_name = excluded.user_name,
         platform = excluded.platform,
         last_seen = excluded.last_seen,
         messages = loyalty_users.messages + 1",
    )
    .bind(&channel_id)
    .bind(&msg.user_key)
    .bind(&msg.user_name)
    .bind(&msg.platform)
    .bind(now)
    .execute(&state.db)
    .await;
    let _ = sqlx::query(
      "UPDATE stream_sessions SET chat_messages = chat_messages + 1
       WHERE channel_id = ? AND ended_at IS NULL",
    )
    .bind(&channel_id)
    .execute(&state.db)
    .await;
  }

  // 2) Overlay chat + Emote Combo motoru
  if msg.kind == "chat" {
    state.broadcast_json(&json!({
      "type": "chat-message",
      "platform": msg.platform,
      "user": msg.user_name,
      "user_key": msg.user_key,
      "text": msg.text,
      "badges": msg.badges,
      "is_mod": msg.is_mod,
      "is_vip": msg.is_vip,
      "is_sub": msg.is_sub,
      "color": msg.color,
      "id": msg.raw_id,
      "t": chrono_now(),
    }));
    crate::widgets::handle_combo_on_chat(state.as_ref(), &msg.text);
  }

  // 3) Alert olayları
  if matches!(
    msg.kind.as_str(),
    "follow" | "sub" | "tip" | "raid" | "bits" | "donation"
  ) {
    let kind = if msg.kind == "bits" {
      "bits"
    } else if msg.kind == "donation" {
      "donation"
    } else {
      msg.kind.as_str()
    };
    let _ = log_event(
      &state.db,
      kind,
      &msg.platform,
      &msg.user_name,
      msg.amount,
      if msg.text.is_empty() {
        None
      } else {
        Some(msg.text.as_str())
      },
    )
    .await;

    let widget_kind = match kind {
      "follow" => "follow",
      "sub" => "sub",
      "raid" => "raid",
      "bits" => "bits",
      "tip" | "donation" => "donation",
      _ => kind,
    };
    let ev = json!({
      "id": msg.raw_id,
      "kind": widget_kind,
      "user": msg.user_name,
      "message": msg.text,
      "amount": msg.amount.map(|a| a.to_string()),
      "platform": msg.platform,
      "t": chrono_now(),
    });
    state.broadcast_json(&json!({
      "type": "settings",
      "screen": "panel",
      "data": { "_widgetEvent": ev }
    }));
    state.broadcast_json(&json!({
      "type": "trigger_alert",
      "data": ev
    }));
    let subathon_evt = match kind {
      "follow" => Some("new_follow"),
      "sub" => Some("new_sub"),
      "tip" | "donation" => Some("new_donation"),
      "raid" | "kick" | "host" => Some("new_kick"),
      _ => None,
    };
    if let Some(st) = subathon_evt {
      state.broadcast_json(&json!({
        "type": st,
        "user": msg.user_name,
        "message": msg.text,
        "amount": msg.amount,
        "platform": msg.platform,
        "t": chrono_now(),
        "data": ev
      }));
    }
    if kind == "follow" {
      if let Ok(rows) = crate::db::widgets::bump_goal_for_event(&state.db, "follow", 1.0).await {
        let now = chrono_now();
        for (_id, cur, target, completed) in rows {
          state.broadcast_json(&json!({
            "type": "goal-update",
            "metric": "followers",
            "amount": 1,
            "current": cur,
            "target": target,
            "user": msg.user_name,
            "t": now,
          }));
          if completed {
            state.broadcast_json(&json!({
              "type": "widget-bus",
              "from": "goal",
              "action": "goal.complete",
              "payload": { "current": cur, "target": target, "user": msg.user_name },
              "t": now,
            }));
          }
        }
      }
    }
    if matches!(kind, "tip" | "donation") {
      if let Some(amount) = msg.amount {
        state.obs.trigger_from_settings(
          &state.settings,
          crate::obs_client::ObsAutomationEvent::Donation(amount),
        );
      }
    }
  }

  // 4) Widget runtime: !oy / !katil / !sr (extras_json.runtime_commands ile kapatılabilir).
  // Sohbet yanıtlarını AxBoT yazar; burada yalnız oy/katılım işlenir.
  if msg.kind == "chat" {
    let settings = get_bot_settings(&state.db).await?;
    let _ = crate::server::runtime_api::handle_runtime_chat(
      &state,
      &msg.user_name,
      &msg.user_key,
      &msg.text,
      &settings.extras_json,
    )
    .await;
  }

  Ok(())
}
