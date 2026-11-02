//! Twitch IRC dinleyicisi → ChatInbound.

use anyhow::{anyhow, Context, Result};
use futures_util::{SinkExt, StreamExt};
use tokio::sync::mpsc;
use tokio_tungstenite::{connect_async, tungstenite::Message};

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

