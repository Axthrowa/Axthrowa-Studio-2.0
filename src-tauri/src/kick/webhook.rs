//! Kick Events API webhook → ChatInbound / activity.

use serde_json::{json, Value};

use crate::bot::integrations::ChatInbound;

/// Kick webhook gövdesini bot mesajına çevir.
pub fn inbound_from_event(event_type: &str, body: &Value) -> Option<ChatInbound> {
  match event_type {
    "chat.message.sent" => {
      let sender = body.get("sender").cloned().unwrap_or(json!({}));
      let name = sender
        .get("username")
        .or_else(|| sender.get("slug"))
        .and_then(|v| v.as_str())
        .unwrap_or("anon")
        .to_string();
      let content = body
        .get("content")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
      if content.is_empty() {
        return None;
      }
      let badges = sender
        .pointer("/identity/badges")
        .and_then(|b| b.as_array())
        .map(|arr| {
          arr
            .iter()
            .filter_map(|b| b.get("type").and_then(|t| t.as_str()).map(|s| s.to_string()))
            .collect::<Vec<_>>()
        })
        .unwrap_or_default();
      let is_mod = badges.iter().any(|b| b == "moderator" || b == "broadcaster");
      let is_vip = badges.iter().any(|b| b == "vip");
      let is_sub = badges.iter().any(|b| b == "subscriber");
      let color = sender
        .pointer("/identity/username_color")
        .and_then(|c| c.as_str())
        .map(|s| s.to_string());
      let raw_id = body
        .get("message_id")
        .or_else(|| body.get("id"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
      Some(ChatInbound {
        platform: "kick".into(),
        user_key: format!("kick:{}", name.to_lowercase()),
        user_name: name,
        text: content,
        kind: "chat".into(),
        amount: None,
        badges,
        is_mod,
        is_vip,
        is_sub,
        color,
        raw_id,
      })
    }
    "channel.followed" => {
      let name = body
        .pointer("/follower/username")
        .or_else(|| body.get("username"))
        .and_then(|v| v.as_str())
        .unwrap_or("someone")
        .to_string();
      Some(ChatInbound {
        platform: "kick".into(),
        user_key: format!("kick:{}", name.to_lowercase()),
        user_name: name,
        text: "followed".into(),
        kind: "follow".into(),
        amount: None,
        badges: vec![],
        is_mod: false,
        is_vip: false,
        is_sub: false,
        color: None,
        raw_id: String::new(),
      })
    }
    "channel.subscription.new" | "channel.subscription.renewal" => {
      let name = body
        .pointer("/subscriber/username")
        .or_else(|| body.get("username"))
        .and_then(|v| v.as_str())
        .unwrap_or("someone")
        .to_string();
      Some(ChatInbound {
        platform: "kick".into(),
        user_key: format!("kick:{}", name.to_lowercase()),
        user_name: name,
        text: event_type.into(),
        kind: "sub".into(),
        amount: None,
        badges: vec![],
        is_mod: false,
        is_vip: false,
        is_sub: true,
        color: None,
        raw_id: String::new(),
      })
    }
    "channel.subscription.gifts" => {
      let name = body
        .pointer("/gifter/username")
        .or_else(|| body.get("username"))
        .and_then(|v| v.as_str())
        .unwrap_or("someone")
        .to_string();
      let amount = body
        .get("giftee_ids")
        .and_then(|v| v.as_array())
        .map(|a| a.len() as f64)
        .or_else(|| body.get("total").and_then(|v| v.as_f64()));
      Some(ChatInbound {
        platform: "kick".into(),
        user_key: format!("kick:{}", name.to_lowercase()),
        user_name: name,
        text: "gift subs".into(),
        kind: "sub".into(),
        amount,
        badges: vec![],
        is_mod: false,
        is_vip: false,
        is_sub: true,
        color: None,
        raw_id: String::new(),
      })
    }
    "kicks.gifted" => {
      let name = body
        .pointer("/sender/username")
        .or_else(|| body.get("username"))
        .and_then(|v| v.as_str())
        .unwrap_or("someone")
        .to_string();
      let amount = body
        .get("amount")
        .or_else(|| body.get("kicks"))
        .and_then(|v| v.as_f64().or_else(|| v.as_u64().map(|n| n as f64)));
      Some(ChatInbound {
        platform: "kick".into(),
        user_key: format!("kick:{}", name.to_lowercase()),
        user_name: name,
        text: "kicks".into(),
        kind: "bits".into(),
        amount,
        badges: vec![],
        is_mod: false,
        is_vip: false,
        is_sub: false,
        color: None,
        raw_id: String::new(),
      })
    }
    _ => None,
  }
}
