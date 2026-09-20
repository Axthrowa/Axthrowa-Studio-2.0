//! Anti-spam filtreleri + strike zinciri.

use anyhow::Result;
use serde_json::{json, Value};

use crate::db::botaxt_api::{get_filters, record_moderation_strike};
use crate::db::chrono_now;
use crate::db::models::BotFilters;
use crate::AppState;

use super::integrations::ChatInbound;

#[derive(Debug, Clone)]
pub struct FilterHit {
  pub reason: String,
  pub action: String,
  pub reply: String,
  /// true → komut/oyun/puan atlanır
  pub block_pipeline: bool,
}

fn parse_blacklist(raw: &str) -> Vec<String> {
  let v: Value = serde_json::from_str(raw).unwrap_or(json!([]));
  match v {
    Value::Array(arr) => arr
      .into_iter()
      .filter_map(|x| x.as_str().map(|s| s.to_ascii_lowercase()))
      .filter(|s| !s.is_empty())
      .collect(),
    Value::String(s) => s
      .split(|c: char| c == ',' || c == '\n')
      .map(|x| x.trim().to_ascii_lowercase())
      .filter(|s| !s.is_empty())
      .collect(),
    _ => vec![],
  }
}

fn parse_ladder(raw: &str) -> Vec<String> {
  let v: Value = serde_json::from_str(raw).unwrap_or(json!(["warn", "timeout", "ban"]));
  match v {
    Value::Array(arr) => arr
      .into_iter()
      .filter_map(|x| x.as_str().map(|s| s.to_ascii_lowercase()))
      .collect(),
    _ => vec!["warn".into(), "timeout".into(), "ban".into()],
  }
}

fn detect_violation(filters: &BotFilters, text: &str) -> Option<&'static str> {
  let t = text.trim();
  if t.is_empty() {
    return None;
  }

  if filters.caps_enabled != 0 && t.chars().count() as i64 >= filters.caps_min_len {
    let letters: Vec<char> = t.chars().filter(|c| c.is_alphabetic()).collect();
    if !letters.is_empty() {
      let upper = letters.iter().filter(|c| c.is_uppercase()).count() as f64;
      let ratio = upper / letters.len() as f64;
      if ratio >= filters.caps_ratio {
        return Some("caps");
      }
    }
  }

  if filters.links_enabled != 0 {
    let lower = t.to_ascii_lowercase();
    if lower.contains("http://")
      || lower.contains("https://")
      || lower.contains("www.")
      || lower.split_whitespace().any(|w| {
        w.contains('.')
          && (w.ends_with(".com")
            || w.ends_with(".net")
            || w.ends_with(".org")
            || w.ends_with(".gg")
            || w.ends_with(".tv")
            || w.ends_with(".io"))
      })
    {
      return Some("link");
    }
  }

  if filters.symbols_enabled != 0 {
    let sym = t
      .chars()
      .filter(|c| !c.is_alphanumeric() && !c.is_whitespace())
      .count() as i64;
    if sym > filters.symbols_max {
      return Some("symbols");
    }
  }

  if filters.long_msg_enabled != 0 && t.chars().count() as i64 > filters.long_msg_max {
    return Some("long_msg");
  }

  let bl = parse_blacklist(&filters.blacklist_json);
  if !bl.is_empty() {
    let lower = t.to_ascii_lowercase();
    for w in bl {
      if lower.contains(&w) {
        return Some("blacklist");
      }
    }
  }

  None
}

fn user_level(msg: &ChatInbound) -> i64 {
  if msg.is_mod {
    1000
  } else if msg.is_vip {
    500
  } else if msg.is_sub {
    100
  } else {
    0
  }
}

/// İhlal yoksa `None`. Varsa strike kaydı + eylem broadcast.
pub async fn check_filters(state: &AppState, msg: &ChatInbound) -> Result<Option<FilterHit>> {
  if msg.kind != "chat" || msg.text.is_empty() {
    return Ok(None);
  }
  let filters = get_filters(&state.db).await?;
  if user_level(msg) >= filters.exempt_level && filters.exempt_level > 0 {
    return Ok(None);
  }
  // mod her zaman muaf (exempt_level 0 olsa bile)
  if msg.is_mod {
    return Ok(None);
  }

  let Some(reason) = detect_violation(&filters, &msg.text) else {
    return Ok(None);
  };

  let ladder = parse_ladder(&filters.strike_ladder_json);
  // count after insert
  let expires = Some(chrono_now() + filters.strike_window_sec.max(60) * 1000);
  let count = record_moderation_strike(&state.db, &msg.user_key, reason, "pending", expires).await?;
  let idx = (count as usize).saturating_sub(1);
  let action = ladder
    .get(idx)
    .cloned()
    .or_else(|| ladder.last().cloned())
    .unwrap_or_else(|| filters.action.clone());

  // strike action güncelle (son kayıt)
  let channel_id = crate::db::default_channel_id(&state.db).await?;
  let _ = sqlx::query(
    "UPDATE moderation_strikes SET action = ?
     WHERE id = (
       SELECT id FROM moderation_strikes
       WHERE channel_id = ? AND user_key = ?
       ORDER BY ts DESC LIMIT 1
     )",
  )
  .bind(&action)
  .bind(&channel_id)
  .bind(&msg.user_key)
  .execute(&state.db)
  .await;

  let timeout_sec = filters.timeout_sec.max(1);
  state.broadcast_json(&json!({
    "type": "moderation-action",
    "action": action,
    "reason": reason,
    "strike": count,
    "user_key": msg.user_key,
    "user": msg.user_name,
    "platform": msg.platform,
    "message_id": msg.raw_id,
    "timeout_sec": timeout_sec,
    "t": chrono_now(),
  }));

  let reply = match action.as_str() {
    "warn" | "delete" => format!(
      "@{} uyarı ({reason}) · strike {count}/{}",
      msg.user_name,
      ladder.len().max(1)
    ),
    "timeout" => format!(
      "@{} timeout {timeout_sec}s ({reason}) · strike {count}",
      msg.user_name
    ),
    "ban" => format!("@{} ban ({reason}) · strike {count}", msg.user_name),
    _ => format!("@{} moderasyon ({action}/{reason})", msg.user_name),
  };

  // Kick: resmi API moderasyon
  if msg.platform == "kick" && state.kick_auth.is_connected() {
    match action.as_str() {
      "timeout" => {
        let mins = ((timeout_sec + 59) / 60).max(1) as u64;
        if let Err(e) = state
          .kick_auth
          .moderation_ban(&msg.user_name, Some(mins), reason)
          .await
        {
          yya_warn!("[mod] Kick API timeout: {e:#}");
        }
      }
      "ban" => {
        if let Err(e) = state
          .kick_auth
          .moderation_ban(&msg.user_name, None, reason)
          .await
        {
          yya_warn!("[mod] Kick API ban: {e:#}");
        }
      }
      "delete" | "warn" => {
        if !msg.raw_id.is_empty() {
          if let Err(e) = state.kick_auth.delete_chat_message(&msg.raw_id).await {
            yya_warn!("[mod] Kick API delete: {e:#}");
          }
        }
      }
      _ => {}
    }
  }

  Ok(Some(FilterHit {
    reason: reason.into(),
    action,
    reply,
    block_pipeline: true,
  }))
}
