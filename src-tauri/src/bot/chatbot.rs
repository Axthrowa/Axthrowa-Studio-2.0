//! Komut ayrıştırıcı — `bot_commands` tablosu + cooldown.

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

use anyhow::Result;
use serde_json::{json, Value};
use sqlx::SqlitePool;

use crate::db::botaxt_api::{
  delete_command_by_name, find_command_by_name, get_bot_settings, list_commands, parse_json_object,
  upsert_command,
};
use crate::db::chrono_now;
use crate::db::default_channel_id;
use crate::db::models::BotCommand;
use crate::settings::ScreenKind;
use crate::AppState;

use super::integrations::ChatInbound;
use super::variables;

fn cooldowns() -> &'static Mutex<HashMap<String, i64>> {
  static M: OnceLock<Mutex<HashMap<String, i64>>> = OnceLock::new();
  M.get_or_init(|| Mutex::new(HashMap::new()))
}

pub struct CommandHit {
  pub command: BotCommand,
  pub reply: String,
}

#[derive(Debug, Clone, Default)]
pub struct CommandTemplateVars {
  pub channel: String,
  pub title: String,
  pub game: String,
  pub discord_url: String,
  pub kick_url: String,
  pub socials_line: String,
  pub time: String,
}

impl CommandTemplateVars {
  pub fn from_state(state: &AppState) -> Self {
    let starting = state.settings.read().get(ScreenKind::Starting).clone();
    let ending = state.settings.read().get(ScreenKind::Ending).clone();
    let brb = state.settings.read().get(ScreenKind::Brb).clone();
    let chat = state.settings.read().get(ScreenKind::Chat).clone();
    let panel = state.settings.read().get(ScreenKind::Panel).clone();
    let screens = [&starting, &ending, &brb, &chat, &panel];
    let discord = social_handle_any(&screens, "discord");
    let mut kick = social_handle_any(&screens, "kick");
    if kick.is_empty() {
      kick = panel
        .get("kickChannel")
        .and_then(|v| v.as_str())
        .or_else(|| panel.pointer("/smartBot/channelName").and_then(|v| v.as_str()))
        .unwrap_or("")
        .trim()
        .trim_start_matches('@')
        .to_string();
    }
    if kick.is_empty() {
      let auth = state.kick_auth.status();
      kick = auth
        .get("broadcasterSlug")
        .and_then(|v| v.as_str())
        .or_else(|| auth.get("username").and_then(|v| v.as_str()))
        .unwrap_or("")
        .trim()
        .to_string();
    }
    let twitch = social_handle_any(&screens, "twitch");
    let youtube = social_handle_any(&screens, "youtube");
    let x = social_handle_any(&screens, "x");
    let instagram = social_handle_any(&screens, "instagram");
    let tiktok = social_handle_any(&screens, "tiktok");
    let mut socials: Vec<String> = Vec::new();
    for (kind, raw) in [
      ("kick", kick.as_str()),
      ("twitch", twitch.as_str()),
      ("youtube", youtube.as_str()),
      ("x", x.as_str()),
      ("instagram", instagram.as_str()),
      ("tiktok", tiktok.as_str()),
      ("discord", discord.as_str()),
    ] {
      if raw.is_empty() {
        continue;
      }
      let url = if kind == "youtube" && !raw.starts_with("http") {
        if raw.contains('.') {
          format!("https://{raw}")
        } else {
          format!("https://youtube.com/{raw}")
        }
      } else {
        normalize_social_url(kind, raw)
      };
      if !url.is_empty() {
        socials.push(url);
      }
    }
    let title = panel
      .get("title")
      .and_then(|v| v.as_str())
      .or_else(|| starting.get("title").and_then(|v| v.as_str()))
      .unwrap_or("")
      .trim()
      .to_string();
    Self {
      channel: if kick.is_empty() {
        twitch.clone()
      } else {
        kick.clone()
      },
      title,
      game: panel
        .get("game")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string(),
      discord_url: if discord.is_empty() {
        String::new()
      } else {
        normalize_social_url("discord", &discord)
      },
      kick_url: if kick.is_empty() {
        String::new()
      } else {
        normalize_social_url("kick", &kick)
      },
      socials_line: socials.join(" · "),
      time: "az önce".into(),
    }
  }
}

fn social_handle_any(screens: &[&Value], key: &str) -> String {
  for starting in screens {
    let h = social_handle(starting, key);
    if !h.is_empty() {
      return h;
    }
  }
  String::new()
}

fn social_handle(starting: &Value, key: &str) -> String {
  let path = format!("/socials/{key}/handle");
  starting
    .pointer(&path)
    .and_then(|v| v.as_str())
    .map(str::trim)
    .filter(|s| !s.is_empty())
    .or_else(|| {
      starting
        .pointer(&format!("/socials/{key}"))
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
    })
    .unwrap_or("")
    .trim_start_matches('@')
    .to_string()
}

pub fn normalize_social_url(kind: &str, raw: &str) -> String {
  let s = raw.trim().trim_start_matches('@');
  if s.is_empty() {
    return String::new();
  }
  if s.starts_with("http://") || s.starts_with("https://") {
    return s.to_string();
  }
  let k = kind.trim_start_matches('!').to_ascii_lowercase();
  if k == "discord" {
    let path = s
      .trim_start_matches("https://")
      .trim_start_matches("http://")
      .trim_start_matches("discord.gg/")
      .trim_start_matches("discord.gg");
    return format!("https://discord.gg/{}", path.trim_start_matches('/'));
  }
  if k == "kick" {
    let slug = s
      .trim_start_matches("https://")
      .trim_start_matches("http://")
      .trim_start_matches("www.")
      .trim_start_matches("kick.com/");
    return format!("https://kick.com/{}", slug.trim_start_matches('/'));
  }
  if k == "twitch" {
    let slug = s
      .trim_start_matches("https://")
      .trim_start_matches("http://")
      .trim_start_matches("www.")
      .trim_start_matches("twitch.tv/");
    return format!("https://twitch.tv/{}", slug.trim_start_matches('/'));
  }
  if k == "x" || k == "twitter" {
    let slug = s
      .trim_start_matches("https://")
      .trim_start_matches("http://")
      .trim_start_matches("www.")
      .trim_start_matches("x.com/")
      .trim_start_matches("twitter.com/");
    return format!("https://x.com/{}", slug.trim_start_matches('/'));
  }
  if k == "instagram" {
    let slug = s
      .trim_start_matches("https://")
      .trim_start_matches("http://")
      .trim_start_matches("www.")
      .trim_start_matches("instagram.com/");
    return format!("https://instagram.com/{}", slug.trim_start_matches('/'));
  }
  if k == "tiktok" {
    let slug = s
      .trim_start_matches("https://")
      .trim_start_matches("http://")
      .trim_start_matches("www.")
      .trim_start_matches("tiktok.com/@")
      .trim_start_matches("tiktok.com/");
    return format!("https://tiktok.com/@{}", slug.trim_start_matches('/').trim_start_matches('@'));
  }
  if s.contains('.') {
    return format!("https://{}", s.trim_start_matches('/'));
  }
  s.to_string()
}

fn extras_url(extras_json: &str) -> String {
  let mut parsed = serde_json::from_str::<Value>(extras_json).ok();
  if let Some(Value::String(inner)) = &parsed {
    let t = inner.trim();
    if t.starts_with('{') || t.starts_with('[') {
      parsed = serde_json::from_str::<Value>(t).ok();
    }
  }
  parsed
    .and_then(|v| {
      v.get("url")
        .and_then(|u| u.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
    })
    .unwrap_or_default()
}

fn extract_discord_invite(text: &str) -> String {
  let lower = text.to_ascii_lowercase();
  for needle in ["https://discord.gg/", "http://discord.gg/", "discord.gg/"] {
    if let Some(i) = lower.find(needle) {
      let rest = &text[i + needle.len()..];
      let code: String = rest
        .chars()
        .take_while(|c| c.is_ascii_alphanumeric() || *c == '-')
        .collect();
      if !code.is_empty() {
        return format!("https://discord.gg/{code}");
      }
    }
  }
  String::new()
}

fn url_for_command(cmd: &BotCommand, vars: &CommandTemplateVars, touser: &str) -> String {
  let extra = extras_url(&cmd.extras_json);
  let name = cmd.name.to_ascii_lowercase();
  if !extra.is_empty() {
    return normalize_social_url(&name, &extra);
  }
  match name.as_str() {
    "discord" => {
      if !vars.discord_url.is_empty() {
        vars.discord_url.clone()
      } else {
        extract_discord_invite(&cmd.response)
      }
    }
    "sosyal" | "socials" | "links" => {
      if vars.socials_line.is_empty() {
        vars.kick_url.clone()
      } else {
        vars.socials_line.clone()
      }
    }
    "so" | "promo" | "shoutout" => {
      let slug = if touser.is_empty() {
        vars.channel.as_str()
      } else {
        touser.trim_start_matches('@')
      };
      if slug.is_empty() {
        vars.kick_url.clone()
      } else {
        normalize_social_url("kick", slug)
      }
    }
    _ => vars.kick_url.clone(),
  }
}

fn reserved_command(name: &str) -> bool {
  matches!(
    name,
    "addcom"
      | "editcom"
      | "delcom"
      | "followage"
      | "commands"
      | "komutlar"
      | "cmds"
      | "clip"
      | "points"
      | "puan"
      | "level"
      | "seviye"
      | "watchtime"
      | "izleme"
      | "sosyal"
      | "socials"
      | "links"
  )
}

async fn builtin_enabled(pool: &SqlitePool, name: &str, default_on: bool) -> Result<bool> {
  Ok(match find_command_by_name(pool, name).await? {
    Some(c) => c.enabled != 0,
    None => default_on,
  })
}

pub fn format_duration_tr(ms: i64) -> String {
  let sec = (ms / 1000).max(0);
  let d = sec / 86_400;
  let h = (sec % 86_400) / 3600;
  let m = (sec % 3600) / 60;
  if d > 0 {
    format!("{d} gün {h} saat")
  } else if h > 0 {
    format!("{h} saat {m} dk")
  } else if m > 0 {
    format!("{m} dakika")
  } else {
    "az önce".into()
  }
}

pub async fn stream_uptime_label(pool: &SqlitePool) -> String {
  let row: Option<(i64,)> = sqlx::query_as(
    "SELECT started_at FROM stream_sessions WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1",
  )
  .fetch_optional(pool)
  .await
  .ok()
  .flatten();
  match row {
    Some((started,)) => format_duration_tr(chrono_now().saturating_sub(started)),
    None => "yayın oturumu yok".into(),
  }
}

pub fn chatbot_extras(extras_json: &str) -> Value {
  let root = parse_json_object(extras_json);
  let inner = root.get("chatbot_extras").cloned().unwrap_or(json!({}));
  if inner.is_string() {
    parse_json_object(inner.as_str().unwrap_or(""))
  } else if inner.is_object() {
    inner
  } else {
    json!({})
  }
}

fn extra_toggle(extras: &Value, key: &str, default_on: bool) -> bool {
  extras
    .pointer(&format!("/{key}/enabled"))
    .and_then(|v| v.as_bool())
    .unwrap_or(default_on)
}

/// Sohbet uyarıları (Ekstralar) — follow/sub/raid metni.
pub fn chat_alert_reply(extras_json: &str, kind: &str, user: &str, amount: Option<f64>, text: &str) -> Option<String> {
  let extras = chatbot_extras(extras_json);
  let alerts = extras.get("chat_alerts").cloned().unwrap_or(json!({}));
  if alerts.get("enabled").and_then(|v| v.as_bool()) == Some(false) {
    return None;
  }
  let event_key = match kind {
    "follow" => "follow",
    "sub" => {
      if text.to_ascii_lowercase().contains("hediye") {
        "gift"
      } else if amount.unwrap_or(0.0) > 1.0 {
        "resubscription"
      } else {
        "subscription"
      }
    }
    "tip" | "donation" | "bits" => "kicks",
    "raid" | "host" => "host",
    "welcome" => "welcome",
    _ => return None,
  };
  let ev = alerts
    .pointer(&format!("/events/{event_key}"))
    .cloned()
    .unwrap_or(json!({}));
  let default_on = !matches!(event_key, "follow" | "welcome");
  if !ev.get("enabled").and_then(|v| v.as_bool()).unwrap_or(default_on) {
    return None;
  }
  let min_amount = ev.get("min_amount").and_then(|v| v.as_f64()).unwrap_or(0.0);
  let min_viewers = ev.get("min_viewers").and_then(|v| v.as_f64()).unwrap_or(0.0);
  let amt = amount.unwrap_or(0.0);
  if event_key == "kicks" && amt < min_amount {
    return None;
  }
  if event_key == "host" && amt < min_viewers {
    return None;
  }
  let tpl = ev
    .get("message")
    .and_then(|v| v.as_str())
    .unwrap_or("")
    .trim();
  if tpl.is_empty() {
    return None;
  }
  let months = if amt > 0.0 {
    format!("{}", amt.round() as i64)
  } else {
    "1".into()
  };
  Some(
    tpl
      .replace("{name}", user)
      .replace("{username}", user)
      .replace("@{name}", &format!("@{user}"))
      .replace("{amount}", &amt.to_string())
      .replace("{months}", &months)
      .replace("{viewers}", &format!("{}", amt.round() as i64))
      .replace("{user}", user),
  )
}

/// `!ping` / `!komutlar` / `!lurk` / `!sosyal` — SQLite satırı olmasa da çalışır.
pub async fn try_builtin_command(
  pool: &SqlitePool,
  msg: &ChatInbound,
  vars: &CommandTemplateVars,
) -> Result<Option<String>> {
  let settings = get_bot_settings(pool).await?;
  if settings.enabled == 0 {
    return Ok(None);
  }
  let prefix = if settings.prefix.is_empty() {
    "!"
  } else {
    settings.prefix.as_str()
  };
  let text = msg.text.trim();
  let Some(without) = text.strip_prefix(prefix) else {
    return Ok(None);
  };
  let name = without
    .split_whitespace()
    .next()
    .unwrap_or("")
    .trim()
    .to_lowercase();
  if name.is_empty() {
    return Ok(None);
  }
  match name.as_str() {
    "ping" => Ok(Some("Pong!".into())),
    "lurk" | "lurkmode" => Ok(Some(format!("{} lurk modunda.", msg.user_name))),
    "sosyal" | "socials" | "links" => {
      if !builtin_enabled(pool, "sosyal", true).await? {
        return Ok(None);
      }
      let cmd = find_command_by_name(pool, "sosyal").await?;
      let url = cmd
        .as_ref()
        .map(|c| extras_url(&c.extras_json))
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| vars.socials_line.clone());
      let url = if url.is_empty() {
        vars.kick_url.clone()
      } else {
        url
      };
      if url.is_empty() {
        return Ok(Some(
          "Sosyal link yok — Giriş ekranına hesapları yaz veya Komutlar’dan bağlantıyı yaz."
            .into(),
        ));
      }
      if let Some(cmd) = cmd {
        let filled = render_command(pool, &cmd.response, msg, "", vars, &cmd).await;
        let out = finalize_command_reply(&cmd.name, &filled, &url, msg.text.trim());
        if !out.is_empty() {
          return Ok(Some(out));
        }
      }
      Ok(Some(format!("Sosyal: {url}")))
    }
    "commands" | "komutlar" | "cmds" => {
      if !builtin_enabled(pool, "commands", true).await? {
        return Ok(None);
      }
      let cmds = list_commands(pool).await?;
      let mut names: Vec<String> = cmds
        .into_iter()
        .filter(|c| c.enabled != 0)
        .filter(|c| !reserved_command(&c.name.to_ascii_lowercase()))
        .map(|c| format!("!{}", c.name))
        .collect();
      for extra in [
        "!ping",
        "!komutlar",
        "!lurk",
        "!sosyal",
        "!followage",
        "!addcom",
      ] {
        if !names.iter().any(|n| n.eq_ignore_ascii_case(extra)) {
          names.push(extra.to_string());
        }
      }
      names.sort();
      names.dedup();
      Ok(Some(format!("Komutlar: {}", names.join(" · "))))
    }
    _ => Ok(None),
  }
}

/// `!addcom` / `!editcom` / `!delcom` / `!followage` / `!clip` / puan-seviye.
pub async fn try_meta_command(state: &AppState, msg: &ChatInbound) -> Result<Option<String>> {
  let settings = get_bot_settings(&state.db).await?;
  if settings.enabled == 0 {
    return Ok(None);
  }
  let prefix = if settings.prefix.is_empty() {
    "!"
  } else {
    settings.prefix.as_str()
  };
  let text = msg.text.trim();
  let Some(without) = text.strip_prefix(prefix) else {
    return Ok(None);
  };
  let mut parts = without.splitn(2, char::is_whitespace);
  let name = parts.next().unwrap_or("").trim().to_lowercase();
  let rest = parts.next().unwrap_or("").trim();
  if name.is_empty() {
    return Ok(None);
  }
  let extras = chatbot_extras(&settings.extras_json);
  let level = user_level(msg);

  match name.as_str() {
    "addcom" | "editcom" | "delcom" => {
      if !builtin_enabled(&state.db, &name, true).await? {
        return Ok(None);
      }
      let row = find_command_by_name(&state.db, &name).await?;
      let min = row.map(|c| c.min_level).unwrap_or(1000);
      if level < min {
        return Ok(Some("Bu komut için moderatör yetkisi gerekir.".into()));
      }
      let mut args = rest.splitn(2, char::is_whitespace);
      let cmd_name = args
        .next()
        .unwrap_or("")
        .trim()
        .trim_start_matches('!')
        .to_string();
      let response = args.next().unwrap_or("").trim().to_string();
      if name == "addcom" {
        if cmd_name.is_empty() || response.is_empty() {
          return Ok(Some("Kullanım: !addcom !isim yanıt metni".into()));
        }
        if reserved_command(&cmd_name.to_ascii_lowercase()) {
          return Ok(Some(format!("!{cmd_name} sistem komutu, üzerine yazılmaz.")));
        }
        if find_command_by_name(&state.db, &cmd_name).await?.is_some() {
          return Ok(Some(format!(
            "!{cmd_name} zaten var — değiştirmek için !editcom !{cmd_name} yeni yanıt"
          )));
        }
        upsert_command(
          &state.db,
          &json!({
            "name": cmd_name,
            "response": response,
            "enabled": true,
            "min_level": 0,
            "cooldown_sec": 5,
            "aliases": [],
            "platforms": ["kick", "twitch"],
          }),
          true,
        )
        .await?;
        return Ok(Some(format!("Komut eklendi: !{cmd_name}")));
      }
      if name == "editcom" {
        if cmd_name.is_empty() || response.is_empty() {
          return Ok(Some("Kullanım: !editcom !isim yeni yanıt".into()));
        }
        let Some(existing) = find_command_by_name(&state.db, &cmd_name).await? else {
          return Ok(Some(format!("!{cmd_name} bulunamadı")));
        };
        upsert_command(
          &state.db,
          &json!({
            "id": existing.id,
            "name": existing.name,
            "response": response,
            "enabled": existing.enabled != 0,
            "min_level": existing.min_level,
            "cooldown_sec": existing.cooldown_sec,
            "user_cooldown_sec": existing.user_cooldown_sec,
            "aliases_json": existing.aliases_json,
            "platforms_json": existing.platforms_json,
            "cost_points": existing.cost_points,
            "live_only": existing.live_only != 0,
            "extras_json": existing.extras_json,
          }),
          false,
        )
        .await?;
        return Ok(Some(format!("Komut güncellendi: !{cmd_name}")));
      }
      if cmd_name.is_empty() {
        return Ok(Some("Kullanım: !delcom !isim".into()));
      }
      if reserved_command(&cmd_name.to_ascii_lowercase()) {
        return Ok(Some(format!("!{cmd_name} sistem komutu silinmez — Komutlar’dan kapat.")));
      }
      if delete_command_by_name(&state.db, &cmd_name).await? {
        Ok(Some(format!("Komut silindi: !{cmd_name}")))
      } else {
        Ok(Some(format!("!{cmd_name} bulunamadı")))
      }
    }
    "followage" => {
      if !builtin_enabled(&state.db, "followage", true).await? {
        return Ok(None);
      }
      let target = rest
        .split_whitespace()
        .next()
        .unwrap_or(&msg.user_name)
        .trim_start_matches('@');
      Ok(Some(followage_reply(&state.db, target).await?))
    }
    "clip" => {
      if !extra_toggle(&extras, "clip_command", true) {
        return Ok(None);
      }
      let min = extras
        .pointer("/clip_command/min_rank")
        .and_then(|v| v.as_i64())
        .unwrap_or(0);
      if min < 0 {
        return Ok(None);
      }
      if level < min {
        return Ok(Some("Bu komut için yetkin yok.".into()));
      }
      Ok(Some(format!(
        "{} klip istedi — yayıncı Kick üzerinden klip alsın.",
        msg.user_name
      )))
    }
    "points" | "puan" => {
      if !builtin_enabled(&state.db, "points", true).await? {
        return Ok(None);
      }
      // BotRix sözdizimi: `!points add @kullanıcı 100` / `!points add all 100`
      let mut it = rest.split_whitespace();
      let first = it.next().unwrap_or("");
      if first.eq_ignore_ascii_case("add") {
        if level < 1000 {
          return Ok(Some("Puan eklemek için moderatör yetkisi gerekir.".into()));
        }
        let hedef = it.next().unwrap_or("");
        let miktar: i64 = it.next().and_then(|v| v.parse().ok()).unwrap_or(0);
        if hedef.is_empty() || miktar == 0 {
          return Ok(Some("Kullanım: !points add @kullanıcı 100".into()));
        }
        if hedef.eq_ignore_ascii_case("all") {
          let n = crate::db::loyalty::add_points_all(&state.db, miktar).await?;
          return Ok(Some(format!("{n} kişiye {miktar} puan eklendi.")));
        }
        let ad = hedef.trim_start_matches('@');
        return Ok(Some(
          match crate::db::loyalty::add_points(&state.db, ad, miktar).await? {
            Some(yeni) => format!("@{ad} → {yeni} puan"),
            None => format!("@{ad} puan tablosunda yok."),
          },
        ));
      }
      let target = if first.is_empty() {
        msg.user_name.as_str()
      } else {
        first.trim_start_matches('@')
      };
      Ok(Some(loyalty_points_reply(&state.db, target).await?))
    }
    "level" | "seviye" => {
      let extras_on = extra_toggle(&extras, "level_system", false);
      let row_on = builtin_enabled(&state.db, "level", false).await?;
      if !extras_on && !row_on {
        return Ok(None);
      }
      let target = rest
        .split_whitespace()
        .next()
        .unwrap_or(&msg.user_name)
        .trim_start_matches('@');
      Ok(Some(loyalty_level_reply(&state.db, target).await?))
    }
    "watchtime" | "izleme" => {
      let extras_on = extra_toggle(&extras, "watchtime_points", false);
      let row_on = builtin_enabled(&state.db, "watchtime", false).await?;
      if !extras_on && !row_on {
        return Ok(None);
      }
      let target = rest
        .split_whitespace()
        .next()
        .unwrap_or(&msg.user_name)
        .trim_start_matches('@');
      Ok(Some(loyalty_watch_reply(&state.db, target).await?))
    }

    /* ---- BotRix denkliği için eklenen yerleşikler ---- */

    // `!editcounter olum 10` · `!editcounter dolar 10.5`
    "editcounter" => {
      if level < 1000 {
        return Ok(Some("Sayaç düzenlemek için moderatör yetkisi gerekir.".into()));
      }
      let mut it = rest.split_whitespace();
      let ad = it.next().unwrap_or("").trim();
      let deger: Option<f64> = it.next().and_then(|v| v.replace(',', ".").parse().ok());
      match (ad.is_empty(), deger) {
        (false, Some(v)) => {
          let yeni = crate::db::bot_vars::set_counter(&state.db, ad, v).await?;
          Ok(Some(format!("{ad} sayacı: {}", format_counter(yeni))))
        }
        _ => Ok(Some("Kullanım: !editcounter <ad> <değer>".into())),
      }
    }

    "uptime" => {
      // Yardımcı fonksiyon vardı ama komut olarak açılmamıştı.
      Ok(Some(format!(
        "Yayın {} önce başladı.",
        stream_uptime_label(&state.db).await
      )))
    }

    "top" => {
      let rows = crate::db::loyalty::leaderboard_by_points(&state.db, 5).await?;
      if rows.is_empty() {
        return Ok(Some("Henüz puan tablosu boş.".into()));
      }
      let list = rows
        .iter()
        .enumerate()
        .map(|(i, u)| format!("{}. {} ({})", i + 1, u.user_name, u.points))
        .collect::<Vec<_>>()
        .join(" · ");
      Ok(Some(format!("En çok puan: {list}")))
    }

    "xp" => {
      let rows = crate::db::loyalty::leaderboard_by_xp(&state.db, 5).await?;
      if rows.is_empty() {
        return Ok(Some("Henüz seviye tablosu boş.".into()));
      }
      let list = rows
        .iter()
        .enumerate()
        .map(|(i, u)| format!("{}. {} ({} XP)", i + 1, u.user_name, u.xp))
        .collect::<Vec<_>>()
        .join(" · ");
      Ok(Some(format!("En çok XP: {list}")))
    }

    _ => Ok(None),
  }
}

/// Sayaç değerini yazarken gereksiz ondalık kuyruğu olmasın: 10 → "10".
fn format_counter(v: f64) -> String {
  if (v - v.round()).abs() < 1e-9 {
    format!("{}", v.round() as i64)
  } else {
    format!("{v}")
  }
}

async fn followage_reply(pool: &SqlitePool, user: &str) -> Result<String> {
  let channel_id = default_channel_id(pool).await?;
  let follow_ts: Option<(i64,)> = sqlx::query_as(
    "SELECT ts FROM events_log
     WHERE channel_id = ? AND kind = 'follow' AND lower(user_name) = lower(?)
     ORDER BY ts ASC LIMIT 1",
  )
  .bind(&channel_id)
  .bind(user)
  .fetch_optional(pool)
  .await?;
  if let Some((ts,)) = follow_ts {
    let dur = format_duration_tr(chrono_now().saturating_sub(ts));
    return Ok(format!("@{user} bu kanalı {dur} süredir takip ediyor!"));
  }
  let watch: Option<(i64, i64)> = sqlx::query_as(
    "SELECT watch_sec, messages FROM loyalty_users
     WHERE channel_id = ? AND (lower(user_name) = lower(?) OR lower(user_key) LIKE ?)",
  )
  .bind(&channel_id)
  .bind(user)
  .bind(format!("%:{}", user.to_ascii_lowercase()))
  .fetch_optional(pool)
  .await?;
  if let Some((watch_sec, messages)) = watch {
    if watch_sec > 60 || messages > 0 {
      let dur = format_duration_tr(watch_sec.saturating_mul(1000));
      return Ok(format!(
        "@{user} kanalda {dur} süredir görünüyor (Kick takip tarihi bot açıkken kaydedilir)."
      ));
    }
  }
  Ok(format!("@{user} henüz bu kanalı takip etmiyor."))
}

async fn loyalty_points_reply(pool: &SqlitePool, user: &str) -> Result<String> {
  let channel_id = default_channel_id(pool).await?;
  let row: Option<(i64, i64, i64)> = sqlx::query_as(
    "SELECT points, xp, watch_sec FROM loyalty_users
     WHERE channel_id = ? AND (lower(user_name) = lower(?) OR lower(user_key) LIKE ?)",
  )
  .bind(&channel_id)
  .bind(user)
  .bind(format!("%:{}", user.to_ascii_lowercase()))
  .fetch_optional(pool)
  .await?;
  match row {
    Some((points, _xp, watch)) => Ok(format!(
      "{user}: {points} puan · {} izleme",
      format_duration_tr(watch.saturating_mul(1000))
    )),
    None => Ok(format!("{user}: 0 puan")),
  }
}

async fn loyalty_level_reply(pool: &SqlitePool, user: &str) -> Result<String> {
  let channel_id = default_channel_id(pool).await?;
  let xp: i64 = sqlx::query_scalar(
    "SELECT xp FROM loyalty_users
     WHERE channel_id = ? AND (lower(user_name) = lower(?) OR lower(user_key) LIKE ?) LIMIT 1",
  )
  .bind(&channel_id)
  .bind(user)
  .bind(format!("%:{}", user.to_ascii_lowercase()))
  .fetch_optional(pool)
  .await?
  .unwrap_or(0);
  let rank: Option<String> = sqlx::query_scalar(
    "SELECT name FROM loyalty_ranks WHERE channel_id = ? AND min_xp <= ? ORDER BY min_xp DESC LIMIT 1",
  )
  .bind(&channel_id)
  .bind(xp)
  .fetch_optional(pool)
  .await?;
  let level = rank.unwrap_or_else(|| format!("{}", (xp / 100) + 1));
  Ok(format!("{user} adlı kullanıcının seviyesi {level}."))
}

async fn loyalty_watch_reply(pool: &SqlitePool, user: &str) -> Result<String> {
  let channel_id = default_channel_id(pool).await?;
  let watch: i64 = sqlx::query_scalar(
    "SELECT watch_sec FROM loyalty_users
     WHERE channel_id = ? AND (lower(user_name) = lower(?) OR lower(user_key) LIKE ?) LIMIT 1",
  )
  .bind(&channel_id)
  .bind(user)
  .bind(format!("%:{}", user.to_ascii_lowercase()))
  .fetch_optional(pool)
  .await?
  .unwrap_or(0);
  Ok(format!(
    "{user} izleme süresi: {}",
    format_duration_tr(watch.saturating_mul(1000))
  ))
}

/// `!cmd args` → eşleşen komut + şablon doldurulmuş yanıt.
pub async fn try_match_command(
  pool: &SqlitePool,
  msg: &ChatInbound,
  vars: &CommandTemplateVars,
) -> Result<Option<CommandHit>> {
  let settings = get_bot_settings(pool).await?;
  if settings.enabled == 0 {
    return Ok(None);
  }
  let prefix = if settings.prefix.is_empty() {
    "!"
  } else {
    settings.prefix.as_str()
  };
  let text = msg.text.trim();
  if !text.starts_with(prefix) {
    return Ok(None);
  }
  let without = text[prefix.len()..].trim();
  if without.is_empty() {
    return Ok(None);
  }
  let mut parts = without.splitn(2, char::is_whitespace);
  let name = parts.next().unwrap_or("").to_lowercase();
  let args = parts.next().unwrap_or("").trim();
  if reserved_command(&name) {
    return Ok(None);
  }

  let cmds = list_commands(pool).await?;
  let Some(cmd) = cmds.into_iter().find(|c| {
    if c.enabled == 0 {
      return false;
    }
    if c.name.eq_ignore_ascii_case(&name) {
      return true;
    }
    let aliases: Vec<String> = serde_json::from_str(&c.aliases_json).unwrap_or_default();
    aliases.iter().any(|a| a.eq_ignore_ascii_case(&name))
  }) else {
    return Ok(None);
  };

  // platform filtresi
  let platforms: Vec<String> = serde_json::from_str(&cmd.platforms_json).unwrap_or_default();
  if !platforms.is_empty()
    && !platforms.iter().any(|p| p.eq_ignore_ascii_case("all"))
    && !platforms
      .iter()
      .any(|p| p.eq_ignore_ascii_case(&msg.platform))
  {
    return Ok(None);
  }

  // yetki: min_level — 0=everyone, 100=sub, 500=vip, 1000=mod
  let level = user_level(msg);
  if level < cmd.min_level {
    return Ok(None);
  }

  // cooldown
  let now = chrono_now();
  {
    let mut map = cooldowns().lock().unwrap();
    let gkey = format!("g:{}", cmd.id);
    if let Some(last) = map.get(&gkey) {
      if now - last < cmd.cooldown_sec.saturating_mul(1000) {
        return Ok(None);
      }
    }
    let ukey = format!("u:{}:{}", cmd.id, msg.user_key);
    if cmd.user_cooldown_sec > 0 {
      if let Some(last) = map.get(&ukey) {
        if now - last < cmd.user_cooldown_sec.saturating_mul(1000) {
          return Ok(None);
        }
      }
    }
    map.insert(gkey, now);
    map.insert(ukey, now);
  }

  let reply = render_command(pool, &cmd.response, msg, args, vars, &cmd).await;
  let reply = finalize_command_reply(&cmd.name, &reply, &url_for_command(&cmd, vars, args.split_whitespace().next().unwrap_or("")), msg.text.trim());
  if reply.is_empty() {
    return Ok(None);
  }
  let _ = sqlx::query("UPDATE bot_commands SET count_uses = count_uses + 1 WHERE id = ?")
    .bind(&cmd.id)
    .execute(pool)
    .await;

  Ok(Some(CommandHit {
    command: cmd,
    reply,
  }))
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

/// Şablon motorunun kendi başına bilemeyeceği, veritabanından gelen değerler.
///
/// Komut başına iki sorgu: kullanıcının sadakat satırı ve yayın süresi.
/// Hepsini tek seferde toplayıp motora veriyoruz; motor saf kalsın diye
/// içeride sorgu çalıştırmıyoruz.
async fn db_lookup(pool: &SqlitePool, user: &str) -> std::collections::HashMap<String, String> {
  let mut m = std::collections::HashMap::new();
  let channel_id = match default_channel_id(pool).await {
    Ok(v) => v,
    Err(_) => return m,
  };
  let row: Option<(i64, i64, i64)> = sqlx::query_as(
    "SELECT points, xp, watch_sec FROM loyalty_users
     WHERE channel_id = ? AND (lower(user_name) = lower(?) OR lower(user_key) LIKE ?)",
  )
  .bind(&channel_id)
  .bind(user)
  .bind(format!("%:{}", user.to_ascii_lowercase()))
  .fetch_optional(pool)
  .await
  .ok()
  .flatten();
  let (points, xp, watch) = row.unwrap_or((0, 0, 0));
  m.insert("points".into(), points.to_string());
  m.insert("xp".into(), xp.to_string());
  m.insert("watchtime".into(), format_duration_tr(watch.saturating_mul(1000)));
  m.insert("uptime".into(), stream_uptime_label(pool).await);
  m
}

/// Şablonun ihtiyaç duyduğu kalıcı değerleri yükler, render eder ve
/// yazma isteklerini uygular.
///
/// İki aşamalı: önce `collect_refs` ile hangi sayaç/değişkenin kullanıldığını
/// çıkarıyoruz, tek turda okuyoruz, sonra render sonrası yazıyoruz. Motor bu
/// sayede saf kalıyor (bkz. `variables::Effect`).
async fn render_command(
  pool: &SqlitePool,
  tpl: &str,
  msg: &ChatInbound,
  args: &str,
  vars: &CommandTemplateVars,
  cmd: &BotCommand,
) -> String {
  let mut db = db_lookup(pool, &msg.user_name).await;
  let refs = variables::collect_refs(tpl, &cmd.name);
  let sender = msg.user_name.to_ascii_lowercase();

  for ad in &refs.counters {
    let v = crate::db::bot_vars::get_counter(pool, ad).await.unwrap_or(0.0);
    db.insert(format!("counter:{ad}"), format!("{v}"));
  }
  for key in &refs.uservars {
    if let Ok(Some(v)) = crate::db::bot_vars::get_var(pool, "user", &sender, key).await {
      db.insert(format!("uservar:{sender}:{key}"), v);
    }
  }
  for key in &refs.globalvars {
    if let Ok(Some(v)) = crate::db::bot_vars::get_var(pool, "global", "", key).await {
      db.insert(format!("globalvar:{key}"), v);
    }
  }
  if tpl.contains("$(uservarlist)") {
    if let Ok(list) = crate::db::bot_vars::list_vars(pool, "user", &sender).await {
      db.insert(format!("uservarlist:{sender}"), list.join(", "));
    }
  }
  if tpl.contains("$(globalvarlist)") {
    if let Ok(list) = crate::db::bot_vars::list_vars(pool, "global", "").await {
      db.insert("globalvarlist".into(), list.join(", "));
    }
  }

  let (out, effects) = fill_template(tpl, msg, args, vars, cmd, &db);
  for fx in effects {
    match fx {
      variables::Effect::SetCounter { name, value } => {
        let _ = crate::db::bot_vars::set_counter(pool, &name, value).await;
      }
      variables::Effect::SetVar { scope, owner, key, value } => {
        let _ = crate::db::bot_vars::set_var(pool, &scope, &owner, &key, &value).await;
      }
    }
  }
  out
}

fn fill_template(
  tpl: &str,
  msg: &ChatInbound,
  args: &str,
  vars: &CommandTemplateVars,
  cmd: &BotCommand,
  db: &std::collections::HashMap<String, String>,
) -> (String, Vec<variables::Effect>) {
  let touser = args
    .split_whitespace()
    .next()
    .unwrap_or(&msg.user_name)
    .trim_start_matches('@');
  let url = url_for_command(cmd, vars, touser);
  let filled = tpl
    .replace("@{username}", &format!("@{}", msg.user_name))
    .replace("$(user)", &msg.user_name)
    .replace("{user}", &msg.user_name)
    .replace("{username}", &msg.user_name)
    .replace("$(args)", args)
    .replace("{args}", args)
    .replace("{query}", args)
    .replace("$(touser)", touser)
    .replace("{touser}", touser)
    .replace("{name}", touser)
    .replace("{time}", if vars.time.is_empty() { "az önce" } else { vars.time.as_str() })
    .replace("{url}", if url.is_empty() { "{url}" } else { url.as_str() })
    .replace("{channel}", &vars.channel)
    .replace("{title}", &vars.title)
    .replace("{game}", &vars.game)
    .replace("{discord}", &vars.discord_url);

  // Eski süslü parantez biçimi yukarıda korundu (mevcut komutlar bozulmasın);
  // geri kalan $() katalogunu BotRix uyumlu motor çözüyor. Böylece BotRix'ten
  // kopyalanan bir komut yanıtı değiştirilmeden çalışıyor.
  let ctx = variables::Ctx {
    sender: msg.user_name.clone(),
    sender_id: msg.user_key.clone(),
    roles: msg.badges.clone(),
    args: args.to_string(),
    platform: msg.platform.clone(),
    channel: vars.channel.clone(),
    chatters: Vec::new(),
    command: cmd.name.clone(),
    lookup: {
      let mut m = template_lookup(vars, &url);
      // DB değerleri ayarlardan gelenleri ezsin: $(uptime) canlı olmalı.
      m.extend(db.clone());
      m
    },
  };
  // Yazma istekleri burada uygulanmıyor: `fill_template` senkron, DB yazımı
  // async. Çağıran taraf `render_with_effects` kullanacak; bu yol yalnız
  // okuma yapan şablonlar için.
  let mut effects = Vec::new();
  let out = variables::render(&filled, &ctx, &mut variables::SysRng, chrono::Utc::now(), &mut effects);
  (out, effects)
}

/// Motorun kendi başına üretemediği (ayar/DB kaynaklı) değerler.
fn template_lookup(vars: &CommandTemplateVars, url: &str) -> std::collections::HashMap<String, String> {
  let mut m = std::collections::HashMap::new();
  m.insert("title".into(), vars.title.clone());
  m.insert("category".into(), vars.game.clone());
  m.insert("game".into(), vars.game.clone());
  m.insert("discord".into(), vars.discord_url.clone());
  m.insert("url".into(), url.to_string());
  if !vars.time.is_empty() {
    m.insert("time".into(), vars.time.clone());
  }
  m
}

pub fn finalize_command_reply(name: &str, reply: &str, url: &str, trigger: &str) -> String {
  let name = name.trim_start_matches('!').trim().to_ascii_lowercase();
  let trigger = trigger.trim().to_ascii_lowercase();
  if (reply.contains("{url}") || reply.trim().is_empty()) && url.is_empty() {
    if name == "discord" {
      return "Discord linki yok — Komutlar sekmesinde Varsayılan komutlar içinde discord ayarlarından davet linkini yaz.".into();
    }
    if name == "sosyal" || name == "socials" {
      return "Sosyal link yok — Giriş ekranına hesapları yaz veya Komutlar’dan bağlantıyı yaz.".into();
    }
  }
  let s = reply.replace("{url}", url).trim().to_string();
  let compact: String = s.chars().filter(|c| !c.is_whitespace()).collect::<String>().to_ascii_lowercase();
  let echoed = s.is_empty()
    || compact == trigger
    || compact == name
    || compact == format!("!{name}")
    || s.contains("{url}");
  if echoed {
    if !url.is_empty() {
      return if name == "discord" {
        format!("Discord: {url}")
      } else {
        url.to_string()
      };
    }
    if name == "discord" {
      return "Discord linki yok — Komutlar sekmesinde Varsayılan komutlar içinde discord ayarlarından davet linkini yaz.".into();
    }
  }
  s
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::bot::integrations::ChatInbound;

  fn msg(user: &str, text: &str) -> ChatInbound {
    ChatInbound {
      platform: "kick".into(),
      user_key: format!("kick:{user}"),
      user_name: user.into(),
      text: text.into(),
      kind: "chat".into(),
      amount: None,
      badges: vec![],
      is_mod: false,
      is_vip: false,
      is_sub: false,
      color: None,
      raw_id: "1".into(),
    }
  }

  /// BotRix sözdiziminin komut yanıtında gerçekten çözüldüğünü doğrular.
  /// Motorun kendi testleri var; buradaki asıl soru şablonun **bağlı** olup
  /// olmadığı — eskiden `$(sender)` ham metin olarak sohbete gidiyordu.
  #[test]
  fn botrix_degiskenleri_komut_yanitinda_cozulur() {
    let m = msg("AxthrowA", "!puanim");
    let cmd = dummy_cmd("puanim", "@$(sender) $(points) puanın var.", "{}");
    let mut db = std::collections::HashMap::new();
    db.insert("points".to_string(), "150".to_string());
    let (out, _) = fill_template(&cmd.response, &m, "", &CommandTemplateVars::default(), &cmd, &db);
    assert_eq!(out, "@AxthrowA 150 puanın var.");
  }

  #[test]
  fn db_degeri_ayar_degerini_ezer() {
    // $(uptime) canlı olmalı: ayarlardan gelen sabit değil, DB'den gelen.
    let m = msg("AxthrowA", "!uptime");
    let cmd = dummy_cmd("uptime", "Yayın $(uptime) önce başladı.", "{}");
    let vars = CommandTemplateVars { time: "eski".into(), ..Default::default() };
    let mut db = std::collections::HashMap::new();
    db.insert("uptime".to_string(), "1 saat 33 dakika".to_string());
    let (out, _) = fill_template(&cmd.response, &m, "", &vars, &cmd, &db);
    assert!(out.contains("1 saat 33 dakika"), "{out}");
  }

  #[test]
  fn eski_suslu_parantez_bicimi_bozulmadi() {
    // Mevcut komutlar {username} kullanıyor; motor eklenince kırılmamalı.
    let m = msg("AxthrowA", "!selam");
    let cmd = dummy_cmd("selam", "Selam {username}!", "{}");
    let (out, _) = fill_template(&cmd.response, &m, "", &CommandTemplateVars::default(), &cmd, &Default::default());
    assert_eq!(out, "Selam AxthrowA!");
  }

  fn dummy_cmd(name: &str, response: &str, extras: &str) -> BotCommand {
    BotCommand {
      id: "1".into(),
      channel_id: "c".into(),
      name: name.into(),
      aliases_json: "[]".into(),
      response: response.into(),
      enabled: 1,
      cooldown_sec: 0,
      user_cooldown_sec: 0,
      min_level: 0,
      cost_points: 0,
      platforms_json: "[\"kick\"]".into(),
      live_only: 0,
      count_uses: 0,
      extras_json: extras.into(),
    }
  }

  #[test]
  fn fill_template_username_and_time() {
    let m = msg("AxthrowA", "!lurk");
    let cmd = dummy_cmd("lurk", "{username} lurk · {time}", "{}");
    let (out, _) = fill_template(
      "{username} lurk · {time}",
      &m,
      "",
      &CommandTemplateVars::default(),
      &cmd,
      &Default::default(),
    );
    assert!(out.contains("AxthrowA"), "{out}");
    assert!(out.contains("az önce"), "{out}");
  }

  #[test]
  fn discord_url_from_extras_not_echo() {
    let m = msg("Ali", "!discord");
    let cmd = dummy_cmd(
      "discord",
      "Discord: {url}",
      r#"{"url":"abc123"}"#,
    );
    let vars = CommandTemplateVars::default();
    let (filled, _) = fill_template(&cmd.response, &m, "", &vars, &cmd, &Default::default());
    let url = url_for_command(&cmd, &vars, "");
    let out = finalize_command_reply("discord", &filled, &url, "!discord");
    assert!(out.contains("discord.gg/abc123"), "{out}");
    assert!(!out.to_ascii_lowercase().contains("!discord"), "{out}");
    assert!(!out.contains("{url}"), "{out}");
  }

  #[test]
  fn discord_echo_reply_is_replaced() {
    let out = finalize_command_reply(
      "discord",
      "!discord",
      "https://discord.gg/x",
      "!discord",
    );
    assert_eq!(out, "Discord: https://discord.gg/x");
  }

  #[test]
  fn discord_empty_url_does_not_echo_command() {
    let out = finalize_command_reply("discord", "Discord: {url}", "", "!discord");
    assert!(out.contains("Komutlar"), "{out}");
    assert_ne!(out.trim().to_ascii_lowercase(), "!discord");
    assert!(!out.contains("{url}"), "{out}");
  }

  #[test]
  fn discord_url_from_response_text() {
    let cmd = dummy_cmd("discord", "https://discord.gg/fromtext", "{}");
    let vars = CommandTemplateVars::default();
    let url = url_for_command(&cmd, &vars, "");
    assert!(url.contains("fromtext"), "{url}");
    let out = finalize_command_reply("discord", &cmd.response, &url, "!discord");
    assert!(out.contains("discord.gg/fromtext"), "{out}");
  }

  #[test]
  fn duration_tr_formats() {
    assert_eq!(format_duration_tr(0), "az önce");
    assert!(format_duration_tr(3 * 86_400_000 + 2 * 3_600_000).contains("3 gün"));
  }

  #[test]
  fn chat_alert_uses_follow_template() {
    let extras = r#"{"chatbot_extras":{"chat_alerts":{"enabled":true,"events":{"follow":{"enabled":true,"message":"@{name} hoş geldin"}}}}}"#;
    let out = chat_alert_reply(extras, "follow", "Ali", None, "");
    assert_eq!(out.as_deref(), Some("@Ali hoş geldin"));
  }

  #[test]
  fn chat_alert_parses_double_encoded_extras() {
    let inner = r#"{"chatbot_extras":{"chat_alerts":{"enabled":true,"events":{"subscription":{"enabled":true,"message":"{name} abone"}}}}}"#;
    let wrapped = serde_json::Value::String(inner.to_string()).to_string();
    let out = chat_alert_reply(&wrapped, "sub", "Ece", Some(1.0), "");
    assert_eq!(out.as_deref(), Some("Ece abone"));
  }
}
