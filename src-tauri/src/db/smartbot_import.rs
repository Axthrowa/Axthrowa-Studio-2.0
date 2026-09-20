//! panel.smartBot JSON → SQLite (bir kerelik, app_meta bayrağı ile).

use anyhow::Result;
use serde_json::Value;
use sqlx::SqlitePool;

use crate::db::{chrono_now, default_channel_id, meta_get, meta_set};
use crate::settings::{AppSettings, ScreenKind};

const FLAG: &str = "smartbot_imported_v1";

pub async fn import_if_needed(pool: &SqlitePool, settings: &AppSettings) -> Result<()> {
  import_smartbot(pool, settings, false).await
}

/// `force=true` iken bayrak yok sayılır; mevcut satırlar INSERT OR IGNORE ile korunur,
/// ayarlar / loyalty upsert edilir. (İleride argon2 benzeri yükseltmeler gibi soft re-import.)
pub async fn import_smartbot(pool: &SqlitePool, settings: &AppSettings, force: bool) -> Result<()> {
  if !force && meta_get(pool, FLAG).await?.as_deref() == Some("1") {
    return Ok(());
  }

  let panel = settings.get(ScreenKind::Panel);
  let smart = panel.get("smartBot").cloned().unwrap_or(Value::Null);
  if smart.is_null() {
    meta_set(pool, FLAG, "1").await?;
    return Ok(());
  }

  let channel_id = default_channel_id(pool).await?;
  let now = chrono_now();

  // Kanal adı
  let display = smart
    .get("channelName")
    .and_then(|v| v.as_str())
    .filter(|s| !s.is_empty())
    .unwrap_or("Yayıncı");
  let bot_name = smart
    .get("botName")
    .and_then(|v| v.as_str())
    .unwrap_or("BotAxT");

  sqlx::query("UPDATE channels SET display_name = ?, slug = ?, updated_at = ? WHERE id = ?")
    .bind(display)
    .bind(display.to_lowercase().replace(' ', "-"))
    .bind(now)
    .bind(&channel_id)
    .execute(pool)
    .await?;

  let enabled = smart.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true) as i64;
  let reply_kick = smart
    .get("replyToKick")
    .and_then(|v| v.as_bool())
    .unwrap_or(true) as i64;
  let reply_twitch = smart
    .get("replyToTwitch")
    .and_then(|v| v.as_bool())
    .unwrap_or(true) as i64;
  let reply_overlay = smart
    .get("replyToOverlay")
    .and_then(|v| v.as_bool())
    .unwrap_or(true) as i64;
  let extras = smart.to_string();

  sqlx::query(
    "INSERT INTO bot_settings(channel_id, enabled, bot_name, prefix, reply_to_kick, reply_to_twitch, reply_to_overlay, extras_json)
     VALUES(?, ?, ?, '!', ?, ?, ?, ?)
     ON CONFLICT(channel_id) DO UPDATE SET
       enabled=excluded.enabled, bot_name=excluded.bot_name,
       reply_to_kick=excluded.reply_to_kick, reply_to_twitch=excluded.reply_to_twitch,
       reply_to_overlay=excluded.reply_to_overlay,
       extras_json=excluded.extras_json",
  )
  .bind(&channel_id)
  .bind(enabled)
  .bind(bot_name)
  .bind(reply_kick)
  .bind(reply_twitch)
  .bind(reply_overlay)
  .bind(&extras)
  .execute(pool)
  .await?;

  // Komutlar
  if let Some(cmds) = smart.get("commands").and_then(|v| v.as_array()) {
    for c in cmds {
      let id = c
        .get("id")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
      let name = c.get("name").and_then(|v| v.as_str()).unwrap_or("cmd");
      let response = c.get("response").and_then(|v| v.as_str()).unwrap_or("");
      let aliases = c
        .get("aliases")
        .cloned()
        .unwrap_or(Value::Array(vec![]))
        .to_string();
      let enabled = c.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true) as i64;
      let cooldown = c
        .get("globalCooldownSec")
        .or_else(|| c.get("cooldown"))
        .and_then(|v| v.as_i64())
        .unwrap_or(5);
      let user_cd = c
        .get("userCooldownSec")
        .and_then(|v| v.as_i64())
        .unwrap_or(0);
      let min_level = c
        .get("level")
        .or_else(|| c.get("minLevel"))
        .and_then(|v| v.as_i64())
        .unwrap_or(0);
      let cost = c.get("cost").and_then(|v| v.as_i64()).unwrap_or(0);
      let _ = sqlx::query(
        "INSERT OR IGNORE INTO bot_commands(
           id, channel_id, name, aliases_json, response, enabled,
           cooldown_sec, user_cooldown_sec, min_level, cost_points, extras_json
         ) VALUES(?,?,?,?,?,?,?,?,?,?, '{}')",
      )
      .bind(&id)
      .bind(&channel_id)
      .bind(name)
      .bind(&aliases)
      .bind(response)
      .bind(enabled)
      .bind(cooldown)
      .bind(user_cd)
      .bind(min_level)
      .bind(cost)
      .execute(pool)
      .await;
    }
  }

  // Timerlar
  if let Some(timers) = smart.get("timers").and_then(|v| v.as_array()) {
    for t in timers {
      let id = t
        .get("id")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
      let name = t.get("name").and_then(|v| v.as_str()).unwrap_or("timer");
      let message = t.get("message").and_then(|v| v.as_str()).unwrap_or("");
      let enabled = t.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true) as i64;
      let interval = t
        .get("intervalSec")
        .and_then(|v| v.as_i64())
        .or_else(|| t.get("intervalMin").and_then(|v| v.as_i64()).map(|m| m * 60))
        .unwrap_or(300);
      let min_lines = t
        .get("minChatLines")
        .or_else(|| t.get("minLines"))
        .and_then(|v| v.as_i64())
        .unwrap_or(0);
      let _ = sqlx::query(
        "INSERT OR IGNORE INTO bot_timers(
           id, channel_id, name, message, enabled, interval_sec, min_chat_lines
         ) VALUES(?,?,?,?,?,?,?)",
      )
      .bind(&id)
      .bind(&channel_id)
      .bind(name)
      .bind(message)
      .bind(enabled)
      .bind(interval)
      .bind(min_lines)
      .execute(pool)
      .await;
    }
  }

  // Filtreler
  if let Some(f) = smart.get("filters") {
    let caps = f
      .get("caps")
      .and_then(|v| v.as_bool())
      .or_else(|| {
        f.get("maxCapsPercent")
          .and_then(|v| v.as_f64())
          .map(|p| p < 100.0 && f.get("enabled").and_then(|e| e.as_bool()).unwrap_or(false))
      })
      .unwrap_or(false) as i64;
    let links = f
      .get("links")
      .or_else(|| f.get("blockLinks"))
      .and_then(|v| v.as_bool())
      .unwrap_or(false) as i64;
    let symbols = f.get("symbols").and_then(|v| v.as_bool()).unwrap_or(false) as i64;
    let blacklist = f
      .get("blacklist")
      .or_else(|| f.get("bannedWords"))
      .cloned()
      .unwrap_or(Value::Array(vec![]))
      .to_string();
    let caps_ratio = f
      .get("maxCapsPercent")
      .and_then(|v| v.as_f64())
      .map(|p| p / 100.0)
      .unwrap_or(0.7);
    let _ = sqlx::query(
      "INSERT INTO bot_filters(
         channel_id, caps_enabled, caps_ratio, links_enabled, symbols_enabled, blacklist_json
       ) VALUES(?,?,?,?,?,?)
       ON CONFLICT(channel_id) DO UPDATE SET
         caps_enabled=excluded.caps_enabled,
         caps_ratio=excluded.caps_ratio,
         links_enabled=excluded.links_enabled,
         symbols_enabled=excluded.symbols_enabled,
         blacklist_json=excluded.blacklist_json",
    )
    .bind(&channel_id)
    .bind(caps)
    .bind(caps_ratio)
    .bind(links)
    .bind(symbols)
    .bind(&blacklist)
    .execute(pool)
    .await;
  }

  // Loyalty settings + users
  let points_name = smart
    .get("pointsName")
    .and_then(|v| v.as_str())
    .unwrap_or("Coin");
  let _ = sqlx::query(
    "INSERT INTO loyalty_settings(channel_id, points_name)
     VALUES(?, ?)
     ON CONFLICT(channel_id) DO UPDATE SET points_name=excluded.points_name",
  )
  .bind(&channel_id)
  .bind(points_name)
  .execute(pool)
  .await;

  if let Some(loy) = smart.get("loyalty").and_then(|v| v.as_object()) {
    for (user_key, u) in loy {
      let points = u.get("points").and_then(|v| v.as_i64()).unwrap_or(0);
      let messages = u.get("messages").and_then(|v| v.as_i64()).unwrap_or(0);
      let watch_min = u.get("watchMin").and_then(|v| v.as_i64()).unwrap_or(0);
      let last_seen = u.get("lastSeen").and_then(|v| v.as_i64()).unwrap_or(now);
      let platform = user_key.split(':').next().unwrap_or("local");
      let user_name = user_key.split(':').nth(1).unwrap_or(user_key.as_str());
      let _ = sqlx::query(
        "INSERT INTO loyalty_users(
           channel_id, user_key, user_name, platform, points, xp, messages, watch_sec, last_seen
         ) VALUES(?,?,?,?,?,?,?,?,?)
         ON CONFLICT(channel_id, user_key) DO UPDATE SET
           points=excluded.points, messages=excluded.messages,
           watch_sec=excluded.watch_sec, last_seen=excluded.last_seen",
      )
      .bind(&channel_id)
      .bind(user_key)
      .bind(user_name)
      .bind(platform)
      .bind(points)
      .bind(points) // xp ≈ points başlangıçta
      .bind(messages)
      .bind(watch_min * 60)
      .bind(last_seen)
      .execute(pool)
      .await;
    }
  }

  // Goals
  if let Some(goals) = smart.get("goals").and_then(|v| v.as_array()) {
    for g in goals {
      let id = g
        .get("id")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
      let name = g.get("name").and_then(|v| v.as_str()).unwrap_or("Hedef");
      let kind = g.get("kind").and_then(|v| v.as_str()).unwrap_or("custom");
      let current = g.get("current").and_then(|v| v.as_f64()).unwrap_or(0.0);
      let target = g.get("target").and_then(|v| v.as_f64()).unwrap_or(100.0);
      let color = g.get("color").and_then(|v| v.as_str()).unwrap_or("#3ECFCF");
      let enabled = g.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true) as i64;
      let _ = sqlx::query(
        "INSERT OR IGNORE INTO goals(
           id, channel_id, kind, name, current_value, target_value, color, enabled
         ) VALUES(?,?,?,?,?,?,?,?)",
      )
      .bind(&id)
      .bind(&channel_id)
      .bind(kind)
      .bind(name)
      .bind(current)
      .bind(target)
      .bind(color)
      .bind(enabled)
      .execute(pool)
      .await;
    }
  }

  // Shop
  if let Some(shop) = smart.get("shop").and_then(|v| v.as_array()) {
    for s in shop {
      let id = s
        .get("id")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
      let name = s.get("name").and_then(|v| v.as_str()).unwrap_or("item");
      let cost = s.get("cost").and_then(|v| v.as_i64()).unwrap_or(0);
      let response = s.get("response").and_then(|v| v.as_str()).unwrap_or("");
      let enabled = s.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true) as i64;
      let alert = s.get("alert").and_then(|v| v.as_bool()).unwrap_or(true) as i64;
      let _ = sqlx::query(
        "INSERT OR IGNORE INTO shop_items(
           id, channel_id, name, cost, response, enabled, alert
         ) VALUES(?,?,?,?,?,?,?)",
      )
      .bind(&id)
      .bind(&channel_id)
      .bind(name)
      .bind(cost)
      .bind(response)
      .bind(enabled)
      .bind(alert)
      .execute(pool)
      .await;
    }
  }

  // Recent → events_log (örnek geçmiş)
  if let Some(recent) = smart.get("recent") {
    for (kind, key) in [
      ("follow", "follows"),
      ("sub", "subs"),
      ("raid", "raids"),
      ("redeem", "redeems"),
    ] {
      if let Some(arr) = recent.get(key).and_then(|v| v.as_array()) {
        for item in arr.iter().take(30) {
          let user = item.get("user").and_then(|v| v.as_str()).unwrap_or("?");
          let ts = item.get("t").and_then(|v| v.as_i64()).unwrap_or(now);
          let message = item
            .get("item")
            .or_else(|| item.get("amount"))
            .and_then(|v| v.as_str())
            .map(str::to_string);
          let id = uuid::Uuid::new_v4().to_string();
          let _ = sqlx::query(
            "INSERT OR IGNORE INTO events_log(
               id, session_id, channel_id, kind, platform, user_name, message, meta_json, ts
             ) VALUES(?, NULL, ?, ?, 'local', ?, ?, '{}', ?)",
          )
          .bind(&id)
          .bind(&channel_id)
          .bind(kind)
          .bind(user)
          .bind(message)
          .bind(ts)
          .execute(pool)
          .await;
        }
      }
    }
  }

  // Discord webhook → integrations
  if let Some(wh) = smart.get("discordWebhook").and_then(|v| v.as_str()) {
    if !wh.is_empty() {
      let cfg = serde_json::json!({ "webhookUrl": wh }).to_string();
      let _ = sqlx::query(
        "INSERT INTO integrations(channel_id, provider, enabled, config_json, updated_at)
         VALUES(?, 'discord', 1, ?, ?)
         ON CONFLICT(channel_id, provider) DO UPDATE SET
           config_json=excluded.config_json, enabled=1, updated_at=excluded.updated_at",
      )
      .bind(&channel_id)
      .bind(&cfg)
      .bind(now)
      .execute(pool)
      .await;
    }
  }

  meta_set(pool, FLAG, "1").await?;
  yya_warn!("smartBot → SQLite otomatik migrate tamam ({channel_id})");
  Ok(())
}
