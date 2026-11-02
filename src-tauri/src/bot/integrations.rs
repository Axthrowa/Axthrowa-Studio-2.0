//! Kick Pusher + Twitch IRC dinleyicileri → ChatInbound.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use anyhow::{anyhow, Context, Result};
use futures_util::{SinkExt, StreamExt};
use parking_lot::RwLock;
use serde_json::{json, Value};
use tokio::sync::mpsc;
use tokio::sync::Mutex as AsyncMutex;
use tokio::time::{interval, MissedTickBehavior};
use tokio_tungstenite::{connect_async, tungstenite::Message};

/// Kick public Pusher anahtarları (güncel + yedek).
const KICK_PUSHER_KEYS: &[&str] = &[
  "32cbd69e4b950bf97679",
  "eb1d5f283081a78b932c",
];

/// Pusher activity_timeout (120s) dolmadan istemci ping atmazsa Kick soketi keser.
const PUSHER_PING_EVERY: Duration = Duration::from_secs(20);
const SUBSCRIBE_TIMEOUT: Duration = Duration::from_secs(15);

fn kick_pusher_url(key: &str) -> String {
  format!(
    "wss://ws-us2.pusher.com/app/{key}?protocol=7&client=js&version=7.6.0&flash=false"
  )
}

fn pusher_text(v: Value) -> Message {
  Message::Text(v.to_string().into())
}

enum PusherOutcome {
  /// mpsc kapandı — dinleyici bitsin
  Stop,
  /// Subscribe oldu, soket koptu — aynı key ile geri bağlan
  LiveDropped { lived: Duration },
  /// Subscribe olmadan koptu — sonraki key
  AuthFailed(String),
}

#[derive(Debug, Clone)]
pub struct ChatInbound {
  pub platform: String,
  pub user_key: String,
  pub user_name: String,
  pub text: String,
  pub kind: String, // chat | follow | sub | tip | raid | bits
  pub amount: Option<f64>,
  pub badges: Vec<String>,
  pub is_mod: bool,
  pub is_vip: bool,
  pub is_sub: bool,
  pub color: Option<String>,
  pub raw_id: String,
}

/// Kick public Pusher — `chatrooms.{id}.v2`
///
/// Soket kopunca oturumu öldürmez: ping + aynı anahtarla backoff. `live` bayrağı
/// bir kez true olduktan sonra geçici kopmalarda düşmez (UI flicker olmasın).
pub async fn kick_listener(
  slug: String,
  tx: mpsc::Sender<ChatInbound>,
  live: Option<Arc<AtomicBool>>,
  chatroom_out: Option<Arc<RwLock<Option<u64>>>>,
  known_chatroom: Option<u64>,
) -> Result<()> {
  yya_log!("Kick kanal ID aranıyor: {slug}");
  let chatroom_id = loop {
    if tx.is_closed() {
      return Ok(());
    }
    match resolve_kick_chatroom(&slug, known_chatroom).await {
      Ok(id) => break id,
      Err(e) => {
        yya_warn!("[bot/kick] chatroom çözülemedi: {e:#} — 3s sonra tekrar");
        tokio::time::sleep(Duration::from_secs(3)).await;
      }
    }
  };

  yya_log!("Bulunan Chatroom ID: {chatroom_id}");
  if let Some(out) = &chatroom_out {
    *out.write() = Some(chatroom_id);
  }
  let channel = format!("chatrooms.{chatroom_id}.v2");
  let mut key_i = 0usize;
  let mut backoff = Duration::from_millis(400);
  let mut ever_live = false;

  loop {
    if tx.is_closed() {
      return Ok(());
    }
    let key = KICK_PUSHER_KEYS[key_i % KICK_PUSHER_KEYS.len()];
    let url = kick_pusher_url(key);
    yya_log!("Kick WebSocket'e bağlanılıyor... (key={key}, cluster=us2)");
    match kick_pusher_session(&url, &channel, &slug, &tx, live.as_ref(), &mut ever_live).await {
      PusherOutcome::Stop => return Ok(()),
      PusherOutcome::LiveDropped { lived } => {
        if lived > Duration::from_secs(20) {
          backoff = Duration::from_millis(400);
        }
        yya_warn!(
          "[bot/kick] Pusher koptu (canlı {:?}) — {backoff:?} sonra aynı anahtarla yeniden",
          lived
        );
        tokio::time::sleep(backoff).await;
        if lived <= Duration::from_secs(20) {
          backoff = (backoff.saturating_mul(2)).min(Duration::from_secs(12));
        }
      }
      PusherOutcome::AuthFailed(e) => {
        yya_warn!("[bot/kick] Pusher key={key} başarısız: {e}");
        key_i = key_i.saturating_add(1);
        if !ever_live {
          if let Some(l) = &live {
            l.store(false, Ordering::SeqCst);
          }
        }
        tokio::time::sleep(backoff).await;
        if key_i.is_multiple_of(KICK_PUSHER_KEYS.len()) {
          backoff = (backoff.saturating_mul(2)).min(Duration::from_secs(12));
        }
      }
    }
  }
}

async fn resolve_kick_chatroom(slug: &str, known_chatroom: Option<u64>) -> Result<u64> {
  if let Some(id) = known_chatroom.filter(|id| *id > 0) {
    yya_log!("Bulunan Chatroom ID: {id} (manuel/önbellek)");
    return Ok(id);
  }
  let info = crate::kick::fetch_chatroom(slug).await?;
  info
    .get("chatroomId")
    .or_else(|| info.get("chatroom_id"))
    .and_then(|v| v.as_u64().or_else(|| v.as_str().and_then(|s| s.parse().ok())))
    .context("Kick chatroomId yok")
}

async fn kick_pusher_session(
  url: &str,
  channel: &str,
  slug: &str,
  tx: &mpsc::Sender<ChatInbound>,
  live: Option<&Arc<AtomicBool>>,
  ever_live: &mut bool,
) -> PusherOutcome {
  let (ws, _) = match connect_async(url).await {
    Ok(pair) => pair,
    Err(e) => return PusherOutcome::AuthFailed(format!("Kick Pusher WS ({url}): {e}")),
  };
  let (write, mut read) = ws.split();
  let write = Arc::new(AsyncMutex::new(write));
  let mut subscribed = false;
  let mut live_since: Option<Instant> = None;

  let mark_live = |subscribed: &mut bool, ever_live: &mut bool, live_since: &mut Option<Instant>| {
    if !*subscribed {
      *subscribed = true;
      *ever_live = true;
      *live_since = Some(Instant::now());
      if let Some(l) = live {
        l.store(true, Ordering::SeqCst);
      }
      yya_log!("Kick bağlantısı başarılı / Chat dinleniyor! ({slug} · {channel})");
    }
  };

  let dropped = |subscribed: bool, live_since: Option<Instant>, why: String| {
    if subscribed {
      PusherOutcome::LiveDropped {
        lived: live_since
          .map(|t| t.elapsed())
          .unwrap_or(Duration::ZERO),
      }
    } else {
      PusherOutcome::AuthFailed(why)
    }
  };

  let mut ping = interval(PUSHER_PING_EVERY);
  ping.set_missed_tick_behavior(MissedTickBehavior::Delay);
  ping.tick().await;

  let sub_timeout = tokio::time::sleep(SUBSCRIBE_TIMEOUT);
  tokio::pin!(sub_timeout);

  loop {
    tokio::select! {
      _ = &mut sub_timeout, if !subscribed => {
        return PusherOutcome::AuthFailed("subscribe zaman aşımı".into());
      }
      _ = ping.tick() => {
        let mut w = write.lock().await;
        let _ = w.send(Message::Ping(Default::default())).await;
        let _ = w.send(pusher_text(json!({"event":"pusher:ping","data":{}}))).await;
      }
      incoming = read.next() => {
        let msg = match incoming {
          None => return dropped(subscribed, live_since, "WS eof".into()),
          Some(Err(e)) => return dropped(subscribed, live_since, format!("Kick WS okuma: {e}")),
          Some(Ok(m)) => m,
        };
        let text = match msg {
          Message::Text(t) => t.to_string(),
          Message::Ping(p) => {
            let mut w = write.lock().await;
            let _ = w.send(Message::Pong(p)).await;
            continue;
          }
          Message::Pong(_) => continue,
          Message::Close(frame) => {
            return dropped(subscribed, live_since, format!("WS close {frame:?}"));
          }
          _ => continue,
        };
        let Ok(v) = serde_json::from_str::<Value>(&text) else {
          continue;
        };
        let event = v.get("event").and_then(|e| e.as_str()).unwrap_or("");

        if event == "pusher:connection_established" {
          let sub = json!({
            "event": "pusher:subscribe",
            "data": { "auth": "", "channel": channel }
          });
          yya_log!("Kick subscribe paketi: {sub}");
          let mut w = write.lock().await;
          if w.send(pusher_text(sub)).await.is_err() {
            return dropped(subscribed, live_since, "subscribe gönderilemedi".into());
          }
          continue;
        }

        if event == "pusher:subscription_succeeded" || event == "pusher_internal:subscription_succeeded"
        {
          mark_live(&mut subscribed, ever_live, &mut live_since);
          continue;
        }

        if event == "pusher:error" {
          yya_warn!("[bot/kick] pusher:error · {text}");
          continue;
        }

        if event == "pusher:ping" {
          let mut w = write.lock().await;
          let _ = w
            .send(pusher_text(json!({"event":"pusher:pong","data":{}})))
            .await;
          continue;
        }

        if event == "pusher:pong" {
          continue;
        }

        if !subscribed && event.contains("ChatMessage") {
          mark_live(&mut subscribed, ever_live, &mut live_since);
        }

        let data = match v.get("data") {
          Some(Value::String(s)) => serde_json::from_str::<Value>(s).unwrap_or(json!({})),
          Some(other) => other.clone(),
          None => continue,
        };

        if let Some(inbound) = parse_kick_event(event, &data) {
          if tx.send(inbound).await.is_err() {
            return PusherOutcome::Stop;
          }
        }
      }
    }
  }
}

/// Pusher olayı `App\Events\FollowersUpdated` ya da `….FollowersUpdatedEvent` gelir.
fn kick_event_tail(event: &str) -> &str {
  event.rsplit(['\\', '.']).next().unwrap_or(event)
}

fn kick_person_name(data: &Value) -> Option<String> {
  const PATHS: &[&str] = &[
    "/username",
    "/user/username",
    "/follower/username",
    "/sender/username",
    "/followers/0/username",
    "/recentFollowers/0/username",
    "/recent_followers/0/username",
  ];
  for path in PATHS {
    if let Some(name) = data.pointer(path).and_then(|v| v.as_str()) {
      let name = name.trim();
      if !name.is_empty() {
        return Some(name.to_string());
      }
    }
  }
  None
}

fn parse_kick_event(event: &str, data: &Value) -> Option<ChatInbound> {
  let ev = kick_event_tail(event);
  match ev {
    "ChatMessageEvent" => {
      let user = data
        .pointer("/sender/username")
        .or_else(|| data.pointer("/user/username"))
        .and_then(|v| v.as_str())?;
      let id = data
        .get("id")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
      let text = data.get("content").and_then(|v| v.as_str()).unwrap_or("");
      let badges = data
        .pointer("/sender/identity/badges")
        .and_then(|v| v.as_array())
        .map(|arr| {
          arr
            .iter()
            .filter_map(|b| b.get("type").and_then(|t| t.as_str()).map(str::to_string))
            .collect::<Vec<_>>()
        })
        .unwrap_or_default();
      let is_mod = badges.iter().any(|b| b == "moderator" || b == "broadcaster");
      let is_vip = badges.iter().any(|b| b == "vip");
      let is_sub = badges.iter().any(|b| b == "subscriber" || b == "og");
      Some(ChatInbound {
        platform: "kick".into(),
        user_key: format!("kick:{user}"),
        user_name: user.to_string(),
        text: text.to_string(),
        kind: "chat".into(),
        amount: None,
        badges,
        is_mod,
        is_vip,
        is_sub,
        color: data
          .pointer("/sender/identity/color")
          .and_then(|v| v.as_str())
          .map(str::to_string),
        raw_id: id,
      })
    }
    "FollowersUpdated" | "FollowersUpdatedEvent" | "SubscriptionEvent" => {
      let user = kick_person_name(data)?;
      let kind = if ev.contains("Follow") { "follow" } else { "sub" };
      Some(ChatInbound {
        platform: "kick".into(),
        user_key: format!("kick:{user}"),
        user_name: user.to_string(),
        text: String::new(),
        kind: kind.into(),
        amount: data
          .get("months")
          .and_then(|v| v.as_u64().or_else(|| v.as_f64().map(|f| f as u64)))
          .map(|m| m as f64),
        badges: vec![],
        is_mod: false,
        is_vip: false,
        is_sub: kind == "sub",
        color: None,
        raw_id: uuid::Uuid::new_v4().to_string(),
      })
    }
    "GiftedSubscriptionsEvent" | "App\\Events\\GiftedSubscriptionsEvent" => {
      let user = data
        .get("gifter_username")
        .or_else(|| data.pointer("/gifter/username"))
        .or_else(|| data.get("username"))
        .and_then(|v| v.as_str())
        .unwrap_or("someone");
      let count = data
        .get("gifted_usernames")
        .and_then(|v| v.as_array())
        .map(|a| a.len() as f64)
        .or_else(|| data.get("months").and_then(|v| v.as_f64()))
        .unwrap_or(1.0);
      Some(ChatInbound {
        platform: "kick".into(),
        user_key: format!("kick:{user}"),
        user_name: user.to_string(),
        text: "Hediye abonelik".into(),
        kind: "sub".into(),
        amount: Some(count),
        badges: vec!["gifted".into()],
        is_mod: false,
        is_vip: false,
        is_sub: true,
        color: None,
        raw_id: uuid::Uuid::new_v4().to_string(),
      })
    }
    _ => None,
  }
}

/// Twitch anon IRC (justinfan) — salt okuma.
pub async fn twitch_listener(login: String, tx: mpsc::Sender<ChatInbound>) -> Result<()> {
  let channel = login.trim().trim_start_matches('#').to_lowercase();
  if channel.is_empty() {
    return Err(anyhow!("Twitch kanal boş"));
  }
  yya_warn!("[bot/twitch] bağlanıyor · #{channel}");

  let (ws, _) = connect_async("wss://irc-ws.chat.twitch.tv:443")
    .await
    .context("Twitch IRC WS")?;
  let (mut write, mut read) = ws.split();

  let nick = format!("justinfan{}", 100_000 + (uuid::Uuid::new_v4().as_u128() % 800_000));
  write
    .send(Message::Text("CAP REQ :twitch.tv/tags twitch.tv/commands\r\n".into()))
    .await?;
  write
    .send(Message::Text(format!("NICK {nick}\r\n").into()))
    .await?;
  write
    .send(Message::Text(format!("JOIN #{channel}\r\n").into()))
    .await?;

  while let Some(msg) = read.next().await {
    let msg = msg.context("Twitch okuma")?;
    let text = match msg {
      Message::Text(t) => t.to_string(),
      Message::Ping(p) => {
        write.send(Message::Pong(p)).await.ok();
        continue;
      }
      Message::Close(_) => break,
      _ => continue,
    };
    for line in text.split("\r\n") {
      if line.is_empty() {
        continue;
      }
      if line.starts_with("PING") {
        let pong = line.replacen("PING", "PONG", 1);
        write.send(Message::Text(format!("{pong}\r\n").into())).await.ok();
        continue;
      }
      if let Some(inbound) = parse_twitch_line(line) {
        if tx.send(inbound).await.is_err() {
          return Ok(());
        }
      }
    }
  }
  Err(anyhow!("Twitch IRC kapandı"))
}

fn parse_twitch_line(line: &str) -> Option<ChatInbound> {
  // @tags :user!user@user.tmi.twitch.tv PRIVMSG #chan :msg
  let (tags_raw, rest) = if let Some(s) = line.strip_prefix('@') {
    let idx = s.find(' ')?;
    (&s[..idx], &s[idx + 1..])
  } else {
    ("", line)
  };
  if !rest.contains(" PRIVMSG ") {
    // USERNOTICE for sub
    if rest.contains(" USERNOTICE ") {
      let tags = parse_tags(tags_raw);
      let login = tags.get("login").cloned().unwrap_or_else(|| "user".into());
      let msg_id = tags.get("msg-id").cloned().unwrap_or_default();
      let kind = if msg_id.contains("sub") || msg_id == "subgift" {
        "sub"
      } else if msg_id == "raid" {
        "raid"
      } else {
        return None;
      };
      return Some(ChatInbound {
        platform: "twitch".into(),
        user_key: format!("twitch:{login}"),
        user_name: tags.get("display-name").cloned().unwrap_or(login.clone()),
        text: tags.get("system-msg").cloned().unwrap_or_default(),
        kind: kind.into(),
        amount: None,
        badges: vec![],
        is_mod: false,
        is_vip: false,
        is_sub: kind == "sub",
        color: tags.get("color").cloned(),
        raw_id: tags.get("id").cloned().unwrap_or_else(|| uuid::Uuid::new_v4().to_string()),
      });
    }
    return None;
  }
  let tags = parse_tags(tags_raw);
  let msg_part = rest.split_once(" PRIVMSG ")?.1;
  let text = msg_part
    .find(" :")
    .map(|i| &msg_part[i + 2..])
    .unwrap_or("")
    .to_string();
  let user = tags
    .get("display-name")
    .cloned()
    .or_else(|| {
      rest
        .trim_start_matches(':')
        .split('!')
        .next()
        .map(str::to_string)
    })
    .unwrap_or_else(|| "user".into());
  let badge_tag = tags.get("badges").cloned().unwrap_or_default();
  let is_mod = badge_tag.contains("moderator") || tags.get("mod").map(|s| s == "1").unwrap_or(false);
  let is_vip = badge_tag.contains("vip");
  let is_sub = badge_tag.contains("subscriber") || badge_tag.contains("founder");
  let bits = tags
    .get("bits")
    .and_then(|b| b.parse::<f64>().ok());
  let kind = if bits.is_some() { "bits" } else { "chat" };
  Some(ChatInbound {
    platform: "twitch".into(),
    user_key: format!("twitch:{}", user.to_lowercase()),
    user_name: user,
    text,
    kind: kind.into(),
    amount: bits,
    badges: badge_tag
      .split(',')
      .filter_map(|p| p.split('/').next().map(str::to_string))
      .filter(|s| !s.is_empty())
      .collect(),
    is_mod,
    is_vip,
    is_sub,
    color: tags.get("color").cloned(),
    raw_id: tags
      .get("id")
      .cloned()
      .unwrap_or_else(|| uuid::Uuid::new_v4().to_string()),
  })
}

fn parse_tags(raw: &str) -> std::collections::HashMap<String, String> {
  let mut m = std::collections::HashMap::new();
  for part in raw.split(';') {
    if let Some((k, v)) = part.split_once('=') {
      m.insert(k.to_string(), v.replace("\\s", " "));
    }
  }
  m
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn kick_pusher_url_targets_us2() {
    let url = kick_pusher_url("32cbd69e4b950bf97679");
    assert!(url.starts_with("wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?"));
    assert!(url.contains("protocol=7"));
  }

  #[test]
  fn parse_kick_chat_message() {
    let data = json!({
      "id": "abc",
      "content": "!ping",
      "sender": { "username": "AxthrowA", "identity": { "badges": [{"type": "broadcaster"}], "color": "#53fc18" } }
    });
    let msg = parse_kick_event("App\\Events\\ChatMessageEvent", &data).expect("parse");
    assert_eq!(msg.user_name, "AxthrowA");
    assert_eq!(msg.text, "!ping");
    assert!(msg.is_mod);
    assert_eq!(msg.platform, "kick");
  }

  #[test]
  fn parse_kick_followers_updated_event() {
    let data = json!({
      "follower": { "username": "yeni" },
      "followersCount": 12
    });
    let msg = parse_kick_event("App\\Events\\FollowersUpdatedEvent", &data).expect("parse");
    assert_eq!(msg.kind, "follow");
    assert_eq!(msg.user_name, "yeni");
  }

  #[test]
  fn parse_kick_followers_updated_list() {
    let data = json!({ "recentFollowers": [{ "username": "ali" }] });
    let msg = parse_kick_event("App\\Events\\FollowersUpdated", &data).expect("parse");
    assert_eq!(msg.user_name, "ali");
    assert_eq!(msg.kind, "follow");
  }

  #[test]
  fn ignore_follow_count_without_name() {
    let data = json!({ "followersCount": 12 });
    assert!(parse_kick_event("App\\Events\\FollowersUpdatedEvent", &data).is_none());
  }
}
