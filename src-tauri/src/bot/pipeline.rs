//! Mesaj işleme — filtre → loyalty → oyun/mağaza → komut → overlay.

use std::sync::Arc;

use anyhow::Result;
use serde_json::json;

use crate::db::botaxt_api::{adjust_loyalty, get_bot_settings, get_loyalty_settings};
use crate::db::loyalty::ensure_loyalty_user;
use crate::db::profile::log_event;
use crate::db::{chrono_now, default_channel_id};
use crate::settings::ScreenKind;
use crate::AppState;

use super::activity::{log_chat, log_reply};
use super::chatbot::{try_builtin_command, try_match_command};
use super::filters::check_filters;
use super::games::try_handle_game;
use super::integrations::ChatInbound;
use super::shop::try_handle_shop;

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
    // Zamanlayıcıların "en az N satır aksın" eşiği için sayaç.
    super::timers::bump_chat_line();
  }

  ensure_loyalty_user(
    &state.db,
    &channel_id,
    &msg.user_key,
    Some(&msg.user_name),
  )
  .await?;

  // 1) Moderasyon — ihlalde uyarı/timeout/ban + pipeline kes
  if msg.kind == "chat" {
    if let Some(hit) = check_filters(&state, &msg).await? {
      let _ = send_reply(&state, &msg, &hit.reply).await;
      // chat overlay'e silindi işareti
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
        "deleted": true,
        "mod_action": hit.action,
        "t": chrono_now(),
      }));
      if hit.block_pipeline {
        return Ok(());
      }
    }
  }

  // 2) Mesaj puanı
  if msg.kind == "chat" && !msg.text.is_empty() {
    let settings = get_loyalty_settings(&state.db).await?;
    let mut pts = settings.points_per_message;
    if msg.is_sub && settings.sub_multiplier > 1.0 {
      pts = ((pts as f64) * settings.sub_multiplier).round() as i64;
    }
    if pts != 0 {
      let _ = adjust_loyalty(&state.db, &msg.user_key, pts, "chat_message").await;
    }
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
    if let Ok(settings) = get_bot_settings(&state.db).await {
      let msgs: i64 = sqlx::query_scalar(
        "SELECT messages FROM loyalty_users WHERE channel_id = ? AND user_key = ?",
      )
      .bind(&channel_id)
      .bind(&msg.user_key)
      .fetch_optional(&state.db)
      .await
      .ok()
      .flatten()
      .unwrap_or(0);
      if msgs == 1 {
        if let Some(text) = crate::bot::chatbot::chat_alert_reply(
          &settings.extras_json,
          "welcome",
          &msg.user_name,
          None,
          &msg.text,
        ) {
          let _ = send_reply(&state, &msg, &text).await;
        }
      }
    }
  }

  // 3) Overlay chat + Emote Combo motoru
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

  // 4) Alert olayları
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
    if matches!(kind, "tip" | "donation") {
      if let Some(amount) = msg.amount {
        state.obs.trigger_from_settings(
          &state.settings,
          crate::obs_client::ObsAutomationEvent::Donation(amount),
        );
      }
    }
    if let Ok(settings) = get_bot_settings(&state.db).await {
      if let Some(text) = crate::bot::chatbot::chat_alert_reply(
        &settings.extras_json,
        kind,
        &msg.user_name,
        msg.amount,
        &msg.text,
      ) {
        let _ = send_reply(&state, &msg, &text).await;
      }
    }
  }

  // 5) Builtin: mod cmds → games → shop → bot_commands
  if msg.kind == "chat" {
    let settings = get_bot_settings(&state.db).await?;
    let prefix = if settings.prefix.is_empty() {
      "!".to_string()
    } else {
      settings.prefix.clone()
    };

    if let Some(reply) = try_handle_mod_commands(&state, &msg, &prefix).await? {
      send_reply(&state, &msg, &reply).await?;
      return Ok(());
    }
    if let Some(reply) = try_handle_game(&state, &msg, &prefix).await? {
      send_reply(&state, &msg, &reply).await?;
      return Ok(());
    }
    if let Some(reply) = try_handle_shop(&state, &msg, &prefix).await? {
      send_reply(&state, &msg, &reply).await?;
      return Ok(());
    }
    // Widget runtime: !oy / !katil / !sr (extras_json.runtime_commands ile kapatılabilir)
    if let Some(reply) = crate::server::runtime_api::handle_runtime_chat(
      &state,
      &msg.user_name,
      &msg.user_key,
      &msg.text,
      &settings.extras_json,
    )
    .await
    {
      send_reply(&state, &msg, &reply).await?;
      return Ok(());
    }
    let mut vars = crate::bot::chatbot::CommandTemplateVars::from_state(&state);
    vars.time = crate::bot::chatbot::stream_uptime_label(&state.db).await;
    if let Some(reply) = crate::bot::chatbot::try_meta_command(&state, &msg).await? {
      send_reply(&state, &msg, &reply).await?;
      return Ok(());
    }
    if let Some(hit) = try_builtin_command(&state.db, &msg, &vars).await? {
      send_reply(&state, &msg, &hit).await?;
      return Ok(());
    }
    if let Some(hit) = try_match_command(
      &state.db,
      &msg,
      &vars,
    )
    .await?
    {
      send_reply(&state, &msg, &hit.reply).await?;
    }
  }

  Ok(())
}

/// !timeout / !ban / !unban — yalnız mod/broadcaster.
async fn try_handle_mod_commands(
  state: &AppState,
  msg: &ChatInbound,
  prefix: &str,
) -> Result<Option<String>> {
  if msg.platform != "kick" || !msg.is_mod {
    return Ok(None);
  }
  let text = msg.text.trim();
  let Some(rest) = text.strip_prefix(prefix) else {
    return Ok(None);
  };
  let mut parts = rest.split_whitespace();
  let cmd = parts.next().unwrap_or("").to_lowercase();
  let target = parts.next().unwrap_or("").trim_start_matches('@');
  if target.is_empty() {
    return Ok(None);
  }
  if !state.kick_auth.is_connected() {
    return Ok(Some(
      "Kick API bağlı değil — Chat Bot’tan OAuth ile bağlan".into(),
    ));
  }
  let slug = {
    let s = state
      .kick_auth
      .status()
      .get("broadcasterSlug")
      .and_then(|v| v.as_str())
      .unwrap_or("")
      .to_string();
    if !s.is_empty() {
      s
    } else {
      state
        .kick_chat
        .status_json()
        .get("username")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string()
    }
  };
  let _ = slug;
  match cmd.as_str() {
    "timeout" | "to" => {
      let mins: u64 = parts
        .next()
        .and_then(|s| s.parse().ok())
        .unwrap_or(5)
        .max(1);
      let reason_owned = parts.collect::<Vec<_>>().join(" ");
      let reason = if reason_owned.is_empty() {
        "Moderasyon"
      } else {
        reason_owned.as_str()
      };
      state
        .kick_auth
        .moderation_ban(target, Some(mins), reason)
        .await?;
      Ok(Some(format!("@{target} {mins} dk timeout")))
    }
    "ban" => {
      let reason_owned = parts.collect::<Vec<_>>().join(" ");
      let reason = if reason_owned.is_empty() {
        "Ban"
      } else {
        reason_owned.as_str()
      };
      state
        .kick_auth
        .moderation_ban(target, None, reason)
        .await?;
      Ok(Some(format!("@{target} banlandı")))
    }
    "unban" => {
      state.kick_auth.moderation_unban(target).await?;
      Ok(Some(format!("@{target} ban kaldırıldı")))
    }
    _ => Ok(None),
  }
}

pub async fn send_reply(state: &AppState, msg: &ChatInbound, reply: &str) -> Result<()> {
  if reply.trim().is_empty() {
    return Ok(());
  }
  log_reply(state, &msg.platform, reply);
  let settings = get_bot_settings(&state.db).await?;
  // KickAuth gönderim kuyruğu 429 güvenliği için mesajlar arasındaki aralığı
  // zaten uygular. Burada ayrıca beklemek ilk bot yanıtını geciktiriyordu.

  if settings.reply_to_overlay != 0 {
    state.broadcast_json(&json!({
      "type": "settings",
      "screen": "chat",
      "data": {
        "_botAnnounce": {
          "id": uuid::Uuid::new_v4().to_string(),
          "text": reply,
          "user": settings.bot_name,
          "platform": "bot",
          "t": chrono_now(),
        }
      }
    }));
  }

  if msg.platform == "kick" && settings.reply_to_kick != 0 {
    let slug = resolve_channels(state).await.kick_slug;
    send_kick_chat(state, reply, slug.as_deref()).await;
  }

  if msg.platform == "twitch" && settings.reply_to_twitch != 0 {
    state.broadcast_json(&json!({
      "type": "bot-reply-request",
      "platform": "twitch",
      "text": reply,
      "t": chrono_now(),
    }));
  }

  // bot/heist announce — Kick API
  if msg.platform == "bot" && settings.reply_to_kick != 0 {
    let slug = resolve_channels(state).await.kick_slug;
    send_kick_chat(state, reply, slug.as_deref()).await;
  }

  Ok(())
}

async fn send_kick_chat(state: &AppState, reply: &str, slug: Option<&str>) {
  if state.kick_auth.is_connected() {
    match state.kick_auth.send_chat(reply, slug).await {
      Ok(_) => return,
      Err(e) => {
        let err = format!("{e:#}");
        yya_warn!("[bot] Kick API yanıt hatası: {err}");
        if crate::kick::is_kick_rate_limit(&err) {
          return;
        }
        state.broadcast_json(&json!({
          "type": "bot-error",
          "text": format!("Kick sohbet yanıtı gönderilemedi: {e}"),
          "t": chrono_now(),
        }));
        // Cookie yedeği yalnızca Kick API bilgisi yoksa — site çıkışı API tokenını öldürmesin.
        if state.kick_auth.has_app_credentials() {
          return;
        }
      }
    }
  } else {
    yya_warn!("[bot] Kick API bağlı değil — oturum yedeği deneniyor");
  }
  let room = (*state.kick_chat.chatroom_id.read()).unwrap_or(0);
  if room == 0 {
    yya_warn!("[bot] Kick yanıt atlandı — chatroom yok");
    state.broadcast_json(&json!({
      "type": "bot-error",
      "text": "Kick sohbet yanıtı atlandı — Kick API bağlı değil ve sohbet odası yok. Chat Bot’tan Bağlan’a basın.",
      "t": chrono_now(),
    }));
    return;
  }
  if let Err(e) = state.kick_session.send_message(room, reply).await {
    yya_warn!("[bot] Kick oturum yanıt hatası: {e:#}");
    state.broadcast_json(&json!({
      "type": "bot-error",
      "text": format!("Kick yanıtı gönderilemedi: {e}"),
      "t": chrono_now(),
    }));
  }
}

/// Kullanıcı talebindeki ad — `handle_inbound` ile aynı pipeline.
pub async fn handle_chat_message(state: Arc<AppState>, msg: ChatInbound) -> Result<()> {
  handle_inbound(state, msg).await
}
