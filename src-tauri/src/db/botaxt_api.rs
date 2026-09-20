//! Botaxt Modül 2–8 — SQLite sorgu yardımcıları.

use anyhow::{bail, Context, Result};
use serde::Serialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sqlx::SqlitePool;

use crate::db::models::*;
use crate::db::{chrono_now, default_channel_id};
use crate::settings::{AppSettings, ScreenKind};

// ─── Alerts ───────────────────────────────────────────────────────────

const DEFAULT_ALERTS: &[(&str, &str, &str, &str)] = &[
  ("follow", "Takip", "{user} takip etti!", "#f59e0b"),
  ("sub", "Abone", "{user} abone oldu!", "#38bdf8"),
  ("gifted", "Hediye abone", "{user} hediye abone gönderdi!", "#a78bfa"),
  ("tip", "Bahşiş", "{user} bahşiş gönderdi!", "#fb7185"),
  ("raid", "Raid", "{user} raid attı!", "#f97316"),
  ("host", "Host", "{user} host attı!", "#34d399"),
  ("bits", "Bits", "{user} bits gönderdi!", "#a3e635"),
  ("redeem", "Ödül", "{user} aldı: {item}", "#e879f9"),
];

pub async fn list_alerts(pool: &SqlitePool) -> Result<Vec<AlertType>> {
  let channel_id = default_channel_id(pool).await?;
  let rows = sqlx::query_as(
    "SELECT id, channel_id, enabled, label, template, duration_ms, volume,
            media_path, sound_path, font_family, font_size, text_color, accent_color,
            anim_in, anim_out, tts_enabled, tts_lang, min_amount, layout, sort_order,
            custom_html, custom_css, tts_rate, tts_volume
     FROM alert_types WHERE channel_id = ? ORDER BY sort_order, id",
  )
  .bind(&channel_id)
  .fetch_all(pool)
  .await?;
  Ok(rows)
}

pub async fn upsert_alerts(pool: &SqlitePool, items: &[Value]) -> Result<Vec<AlertType>> {
  let channel_id = default_channel_id(pool).await?;
  for (i, a) in items.iter().enumerate() {
    let id = a
      .get("id")
      .and_then(|v| v.as_str())
      .unwrap_or("custom")
      .to_string();
    let enabled = a.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true) as i64;
    let label = a
      .get("label")
      .and_then(|v| v.as_str())
      .unwrap_or(id.as_str())
      .to_string();
    let template = a
      .get("template")
      .or_else(|| a.get("text"))
      .and_then(|v| v.as_str())
      .unwrap_or("{user}")
      .to_string();
    let duration_ms = a
      .get("duration_ms")
      .and_then(|v| v.as_i64())
      .or_else(|| {
        a.get("durationSec")
          .and_then(|v| v.as_i64())
          .map(|s| s * 1000)
      })
      .unwrap_or(6000);
    let volume = a.get("volume").and_then(|v| v.as_f64()).unwrap_or(0.8);
    let media_path = a
      .get("media_path")
      .or_else(|| a.get("imageUrl"))
      .and_then(|v| v.as_str())
      .map(str::to_string);
    let sound_path = a
      .get("sound_path")
      .or_else(|| a.get("soundUrl"))
      .and_then(|v| v.as_str())
      .map(str::to_string);
    let font_family = a
      .get("font_family")
      .and_then(|v| v.as_str())
      .map(str::to_string);
    let font_size = a.get("font_size").and_then(|v| v.as_i64()).unwrap_or(32);
    let text_color = a
      .get("text_color")
      .or_else(|| a.get("textColor"))
      .and_then(|v| v.as_str())
      .unwrap_or("#FFFFFF");
    let accent_color = a
      .get("accent_color")
      .or_else(|| a.get("accentColor"))
      .and_then(|v| v.as_str())
      .unwrap_or("#3ECFCF");
    let anim_in = a
      .get("anim_in")
      .or_else(|| a.get("animation"))
      .and_then(|v| v.as_str())
      .unwrap_or("fade");
    let anim_out = a.get("anim_out").and_then(|v| v.as_str()).unwrap_or("fade");
    let tts_enabled = a.get("tts_enabled").and_then(|v| v.as_bool()).unwrap_or(false) as i64;
    let tts_lang = a
      .get("tts_lang")
      .or_else(|| a.get("ttsLang"))
      .and_then(|v| v.as_str())
      .unwrap_or("tr-TR");
    let min_amount = a.get("min_amount").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let layout = a.get("layout").and_then(|v| v.as_str()).unwrap_or("banner");
    let sort_order = a
      .get("sort_order")
      .and_then(|v| v.as_i64())
      .unwrap_or(i as i64);
    let custom_html = a
      .get("custom_html")
      .and_then(|v| v.as_str())
      .map(str::to_string);
    let custom_css = a
      .get("custom_css")
      .and_then(|v| v.as_str())
      .map(str::to_string);

    sqlx::query(
      "INSERT INTO alert_types(
         id, channel_id, enabled, label, template, duration_ms, volume,
         media_path, sound_path, font_family, font_size, text_color, accent_color,
         anim_in, anim_out, tts_enabled, tts_lang, min_amount, layout, sort_order,
         custom_html, custom_css
       ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(channel_id, id) DO UPDATE SET
         enabled=excluded.enabled, label=excluded.label, template=excluded.template,
         duration_ms=excluded.duration_ms, volume=excluded.volume,
         media_path=excluded.media_path, sound_path=excluded.sound_path,
         font_family=excluded.font_family, font_size=excluded.font_size,
         text_color=excluded.text_color, accent_color=excluded.accent_color,
         anim_in=excluded.anim_in, anim_out=excluded.anim_out,
         tts_enabled=excluded.tts_enabled, tts_lang=excluded.tts_lang,
         min_amount=excluded.min_amount, layout=excluded.layout,
         sort_order=excluded.sort_order,
         custom_html=excluded.custom_html, custom_css=excluded.custom_css",
    )
    .bind(&id)
    .bind(&channel_id)
    .bind(enabled)
    .bind(&label)
    .bind(&template)
    .bind(duration_ms)
    .bind(volume)
    .bind(&media_path)
    .bind(&sound_path)
    .bind(&font_family)
    .bind(font_size)
    .bind(text_color)
    .bind(accent_color)
    .bind(anim_in)
    .bind(anim_out)
    .bind(tts_enabled)
    .bind(tts_lang)
    .bind(min_amount)
    .bind(layout)
    .bind(sort_order)
    .bind(&custom_html)
    .bind(&custom_css)
    .execute(pool)
    .await?;
  }
  list_alerts(pool).await
}

pub async fn seed_alerts_if_empty(pool: &SqlitePool, settings: &AppSettings) -> Result<usize> {
  let channel_id = default_channel_id(pool).await?;
  let count: i64 =
    sqlx::query_scalar("SELECT COUNT(*) FROM alert_types WHERE channel_id = ?")
      .bind(&channel_id)
      .fetch_one(pool)
      .await?;
  if count > 0 {
    return Ok(0);
  }

  let panel = settings.get(ScreenKind::Panel);
  let smart = panel.get("smartBot");
  let mut seeded = 0usize;

  if let Some(types) = smart.and_then(|s| s.get("alertTypes")).and_then(|v| v.as_object()) {
    let mut items = Vec::new();
    for (key, val) in types {
      let mut obj = val.clone();
      if let Some(o) = obj.as_object_mut() {
        o.insert("id".into(), json!(key));
        if !o.contains_key("label") {
          o.insert("label".into(), json!(key));
        }
        if let Some(t) = o.get("text").cloned() {
          o.entry("template".to_string()).or_insert(t);
        }
      }
      items.push(obj);
    }
    if !items.is_empty() {
      upsert_alerts(pool, &items).await?;
      return Ok(items.len());
    }
  }

  // alerts (global style) → şablonlara yansıt
  let alerts_style = smart.and_then(|s| s.get("alerts"));

  for (i, (id, label, template, accent)) in DEFAULT_ALERTS.iter().enumerate() {
    let mut tpl = (*template).to_string();
    if let Some(style) = alerts_style {
      let key = match *id {
        "follow" => "followText",
        "sub" => "subText",
        "raid" => "raidText",
        "bits" => "bitsText",
        "redeem" => "redeemText",
        _ => "",
      };
      if !key.is_empty() {
        if let Some(t) = style.get(key).and_then(|v| v.as_str()) {
          tpl = t.to_string();
        }
      }
    }
    let item = json!({
      "id": id,
      "label": label,
      "template": tpl,
      "accent_color": accent,
      "sort_order": i,
    });
    upsert_alerts(pool, &[item]).await?;
    seeded += 1;
  }
  Ok(seeded)
}

pub async fn enqueue_alert_test(
  pool: &SqlitePool,
  type_id: &str,
  user: Option<&str>,
  message: Option<&str>,
  amount: Option<Value>,
) -> Result<(AlertQueueItem, Value)> {
  let channel_id = default_channel_id(pool).await?;
  let at: Option<AlertType> = sqlx::query_as(
    "SELECT id, channel_id, enabled, label, template, duration_ms, volume,
            media_path, sound_path, font_family, font_size, text_color, accent_color,
            anim_in, anim_out, tts_enabled, tts_lang, min_amount, layout, sort_order,
            custom_html, custom_css, tts_rate, tts_volume
     FROM alert_types WHERE channel_id = ? AND id = ?",
  )
  .bind(&channel_id)
  .bind(type_id)
  .fetch_optional(pool)
  .await?;

  let user = user.unwrap_or("TestKullanıcı");
  let template = at
    .as_ref()
    .map(|a| a.template.as_str())
    .unwrap_or("{user} test uyarısı!");
  let amount_str = amount
    .as_ref()
    .map(|v| match v {
      Value::String(s) => s.clone(),
      Value::Number(n) => n.to_string(),
      _ => v.to_string().trim_matches('"').to_string(),
    })
    .unwrap_or_default();
  let msg = message.map(str::to_string).unwrap_or_else(|| {
    template
      .replace("{user}", user)
      .replace("{name}", user)
      .replace("{amount}", &amount_str)
      .replace("{item}", "Test Ödül")
  });

  let now = chrono_now();
  let ev_id = uuid::Uuid::new_v4().to_string();
  let widget_event = json!({
    "id": ev_id,
    "kind": type_id,
    "user": user,
    "message": msg,
    "amount": amount.unwrap_or(Value::Null),
    "platform": "local",
    "meta": { "test": true, "typeId": type_id },
    "t": now,
  });

  let qid = uuid::Uuid::new_v4().to_string();
  let payload = widget_event.to_string();
  sqlx::query(
    "INSERT INTO alert_queue(id, channel_id, type_id, payload_json, status, created_at)
     VALUES(?,?,?,?,'pending',?)",
  )
  .bind(&qid)
  .bind(&channel_id)
  .bind(type_id)
  .bind(&payload)
  .bind(now)
  .execute(pool)
  .await?;

  let item = AlertQueueItem {
    id: qid,
    channel_id,
    type_id: type_id.to_string(),
    variant_id: None,
    payload_json: payload,
    status: "pending".into(),
    priority: 0,
    created_at: now,
    played_at: None,
  };

  let ws = json!({
    "type": "settings",
    "screen": "panel",
    "data": { "_widgetEvent": widget_event },
  });
  Ok((item, ws))
}

pub async fn list_alert_queue(pool: &SqlitePool) -> Result<Vec<AlertQueueItem>> {
  let channel_id = default_channel_id(pool).await?;
  let rows = sqlx::query_as(
    "SELECT id, channel_id, type_id, variant_id, payload_json, status, priority, created_at, played_at
     FROM alert_queue WHERE channel_id = ? AND status = 'pending'
     ORDER BY priority DESC, created_at ASC LIMIT 100",
  )
  .bind(&channel_id)
  .fetch_all(pool)
  .await?;
  Ok(rows)
}

// ─── Widgets / Goals ──────────────────────────────────────────────────
// Enterprise katalog + seed: `crate::db::widgets`

pub async fn list_goals(pool: &SqlitePool) -> Result<Vec<Goal>> {
  let channel_id = default_channel_id(pool).await?;
  let rows = sqlx::query_as(
    "SELECT id, channel_id, widget_id, kind, name, current_value, target_value,
            start_value, ends_at, color, gradient_to, thickness, enabled,
            layout, show_percent, schema_version
     FROM goals WHERE channel_id = ? ORDER BY name",
  )
  .bind(&channel_id)
  .fetch_all(pool)
  .await?;
  Ok(rows)
}

pub async fn create_goal(pool: &SqlitePool, body: &Value) -> Result<Goal> {
  let channel_id = default_channel_id(pool).await?;
  let id = body
    .get("id")
    .and_then(|v| v.as_str())
    .map(str::to_string)
    .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
  let kind = body.get("kind").and_then(|v| v.as_str()).unwrap_or("custom");
  let name = body.get("name").and_then(|v| v.as_str()).unwrap_or("Hedef");
  let current = body
    .get("current_value")
    .or_else(|| body.get("current"))
    .and_then(|v| v.as_f64())
    .unwrap_or(0.0);
  let target = body
    .get("target_value")
    .or_else(|| body.get("target"))
    .and_then(|v| v.as_f64())
    .unwrap_or(100.0);
  let color = body
    .get("color")
    .and_then(|v| v.as_str())
    .unwrap_or("#3ECFCF");
  let enabled = body.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true) as i64;
  let widget_id = body
    .get("widget_id")
    .and_then(|v| v.as_str())
    .map(str::to_string);
  let layout = body
    .get("layout")
    .and_then(|v| v.as_str())
    .unwrap_or("bar");
  let show_percent = body
    .get("show_percent")
    .and_then(|v| v.as_bool())
    .unwrap_or(true) as i64;
  let schema_version = body
    .get("schema_version")
    .and_then(|v| v.as_i64())
    .unwrap_or(1);

  sqlx::query(
    "INSERT INTO goals(id, channel_id, widget_id, kind, name, current_value, target_value, color, enabled,
                       layout, show_percent, schema_version)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
  )
  .bind(&id)
  .bind(&channel_id)
  .bind(&widget_id)
  .bind(kind)
  .bind(name)
  .bind(current)
  .bind(target)
  .bind(color)
  .bind(enabled)
  .bind(layout)
  .bind(show_percent)
  .bind(schema_version)
  .execute(pool)
  .await?;

  sqlx::query_as(
    "SELECT id, channel_id, widget_id, kind, name, current_value, target_value,
            start_value, ends_at, color, gradient_to, thickness, enabled,
            layout, show_percent, schema_version
     FROM goals WHERE id = ?",
  )
  .bind(&id)
  .fetch_one(pool)
  .await
  .map_err(Into::into)
}

pub async fn patch_goal(pool: &SqlitePool, body: &Value) -> Result<Goal> {
  let id = body
    .get("id")
    .and_then(|v| v.as_str())
    .context("id gerekli")?;
  let existing: Goal = sqlx::query_as(
    "SELECT id, channel_id, widget_id, kind, name, current_value, target_value,
            start_value, ends_at, color, gradient_to, thickness, enabled,
            layout, show_percent, schema_version
     FROM goals WHERE id = ?",
  )
  .bind(id)
  .fetch_optional(pool)
  .await?
  .context("Hedef bulunamadı")?;

  let kind = body
    .get("kind")
    .and_then(|v| v.as_str())
    .unwrap_or(&existing.kind);
  let name = body
    .get("name")
    .and_then(|v| v.as_str())
    .unwrap_or(&existing.name);
  let current = body
    .get("current_value")
    .or_else(|| body.get("current"))
    .and_then(|v| v.as_f64())
    .unwrap_or(existing.current_value);
  let target = body
    .get("target_value")
    .or_else(|| body.get("target"))
    .and_then(|v| v.as_f64())
    .unwrap_or(existing.target_value);
  let color = body
    .get("color")
    .and_then(|v| v.as_str())
    .unwrap_or(&existing.color);
  let enabled = body
    .get("enabled")
    .and_then(|v| v.as_bool())
    .map(|b| b as i64)
    .unwrap_or(existing.enabled);
  let widget_id = body
    .get("widget_id")
    .and_then(|v| v.as_str())
    .map(str::to_string)
    .or(existing.widget_id.clone());
  let layout = body
    .get("layout")
    .and_then(|v| v.as_str())
    .unwrap_or(&existing.layout);
  let show_percent = body
    .get("show_percent")
    .and_then(|v| v.as_bool())
    .map(|b| b as i64)
    .unwrap_or(existing.show_percent);
  let schema_version = body
    .get("schema_version")
    .and_then(|v| v.as_i64())
    .unwrap_or(existing.schema_version);

  sqlx::query(
    "UPDATE goals SET kind=?, name=?, current_value=?, target_value=?, color=?, enabled=?, widget_id=?,
                    layout=?, show_percent=?, schema_version=?
     WHERE id=?",
  )
  .bind(kind)
  .bind(name)
  .bind(current)
  .bind(target)
  .bind(color)
  .bind(enabled)
  .bind(&widget_id)
  .bind(layout)
  .bind(show_percent)
  .bind(schema_version)
  .bind(id)
  .execute(pool)
  .await?;

  sqlx::query_as(
    "SELECT id, channel_id, widget_id, kind, name, current_value, target_value,
            start_value, ends_at, color, gradient_to, thickness, enabled,
            layout, show_percent, schema_version
     FROM goals WHERE id = ?",
  )
  .bind(id)
  .fetch_one(pool)
  .await
  .map_err(Into::into)
}

/// Webhook bağışı — aktif hedef(ler)e current_value ekle.
pub async fn apply_donation_to_goals(
  pool: &SqlitePool,
  amount: f64,
  goal_id: Option<&str>,
) -> Result<()> {
  let channel_id = default_channel_id(pool).await?;
  if let Some(id) = goal_id {
    sqlx::query(
      "UPDATE goals SET current_value = current_value + ? WHERE id = ? AND channel_id = ?",
    )
    .bind(amount)
    .bind(id)
    .bind(&channel_id)
    .execute(pool)
    .await?;
  } else {
    sqlx::query(
      "UPDATE goals SET current_value = current_value + ?
       WHERE channel_id = ? AND enabled = 1
       AND id = (
         SELECT id FROM goals WHERE channel_id = ? AND enabled = 1 ORDER BY name LIMIT 1
       )",
    )
    .bind(amount)
    .bind(&channel_id)
    .bind(&channel_id)
    .execute(pool)
    .await?;
  }
  Ok(())
}

pub async fn list_widgets(pool: &SqlitePool) -> Result<Vec<WidgetInstance>> {
  let channel_id = default_channel_id(pool).await?;
  let rows = sqlx::query_as(
    "SELECT id, channel_id, kind, name, obs_path, config_json, enabled,
            schema_version, sort_order, updated_at
     FROM widget_instances WHERE channel_id = ? ORDER BY sort_order, name",
  )
  .bind(&channel_id)
  .fetch_all(pool)
  .await?;
  Ok(rows)
}

pub async fn upsert_widget(pool: &SqlitePool, body: &Value) -> Result<WidgetInstance> {
  let channel_id = default_channel_id(pool).await?;
  let id = body
    .get("id")
    .and_then(|v| v.as_str())
    .map(str::to_string)
    .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
  let kind = body.get("kind").and_then(|v| v.as_str()).unwrap_or("custom");
  let name = body.get("name").and_then(|v| v.as_str()).unwrap_or("Widget");
  let obs_path = body
    .get("obs_path")
    .and_then(|v| v.as_str())
    .unwrap_or("/");
  let config_json = body
    .get("config_json")
    .cloned()
    .unwrap_or(json!({}))
    .to_string();
  // allow object config
  let config_json = if body.get("config").is_some() {
    body.get("config").cloned().unwrap_or(json!({})).to_string()
  } else {
    config_json
  };
  let enabled = body.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true) as i64;
  let now = chrono_now();

  sqlx::query(
    "INSERT INTO widget_instances(id, channel_id, kind, name, obs_path, config_json, enabled, updated_at)
     VALUES(?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       kind=excluded.kind, name=excluded.name, obs_path=excluded.obs_path,
       config_json=excluded.config_json, enabled=excluded.enabled, updated_at=excluded.updated_at",
  )
  .bind(&id)
  .bind(&channel_id)
  .bind(kind)
  .bind(name)
  .bind(obs_path)
  .bind(&config_json)
  .bind(enabled)
  .bind(now)
  .execute(pool)
  .await?;

  sqlx::query_as(
    "SELECT id, channel_id, kind, name, obs_path, config_json, enabled,
            schema_version, sort_order, updated_at
     FROM widget_instances WHERE id = ?",
  )
  .bind(&id)
  .fetch_one(pool)
  .await
  .map_err(Into::into)
}

pub async fn seed_widgets_if_empty(pool: &SqlitePool) -> Result<usize> {
  crate::db::widgets::seed_default_widgets(pool).await
}

// ─── Chatbot ──────────────────────────────────────────────────────────

pub async fn list_commands(pool: &SqlitePool) -> Result<Vec<BotCommand>> {
  let channel_id = default_channel_id(pool).await?;
  let rows = sqlx::query_as(
    "SELECT id, channel_id, name, aliases_json, response, enabled, cooldown_sec,
            user_cooldown_sec, min_level, cost_points, platforms_json, live_only,
            count_uses, extras_json
     FROM bot_commands WHERE channel_id = ? ORDER BY name",
  )
  .bind(&channel_id)
  .fetch_all(pool)
  .await?;
  Ok(rows)
}

pub fn default_bot_command_seeds() -> &'static [(&'static str, &'static str, &'static str)] {
  &[
    ("ping", "[]", "Pong!"),
    (
      "commands",
      "[\"komutlar\",\"cmds\"]",
      "Komut listesi: !ping · !komutlar · !lurk · !sosyal · !discord",
    ),
    ("discord", "[]", "Discord: {url}"),
    ("sosyal", "[\"socials\",\"links\"]", "Sosyal: {url}"),
    ("lurk", "[]", "{username} lurk modunda."),
    ("uptime", "[]", "Bu yayın {time} önce başladı."),
  ]
}

/// Eksik varsayılan komutları ekler (mevcut özel komutlar silinmez).
pub async fn seed_default_commands(pool: &SqlitePool) -> Result<usize> {
  let channel_id = default_channel_id(pool).await?;
  let mut inserted = 0usize;
  for (name, aliases, response) in default_bot_command_seeds() {
    let id = uuid::Uuid::new_v4().to_string();
    let r = sqlx::query(
      "INSERT OR IGNORE INTO bot_commands(
         id, channel_id, name, aliases_json, response, enabled, cooldown_sec,
         user_cooldown_sec, min_level, cost_points, platforms_json, live_only, extras_json
       ) VALUES(?,?,?,?,?,?,5,0,0,0,'[\"kick\",\"twitch\"]',0,'{}')",
    )
    .bind(&id)
    .bind(&channel_id)
    .bind(name)
    .bind(aliases)
    .bind(response)
    .execute(pool)
    .await?;
    inserted += r.rows_affected() as usize;
  }
  if inserted > 0 {
    yya_log!("[bot] varsayılan komut eklendi: {inserted}");
  }
  let _ = sqlx::query(
    "UPDATE bot_commands SET response = 'Discord: {url}'
     WHERE lower(name) = 'discord'
       AND (
         trim(response) = ''
         OR lower(trim(replace(response, '!', ''))) = 'discord'
         OR trim(response) = '{url}'
       )",
  )
  .execute(pool)
  .await;
  let _ = sqlx::query(
    "UPDATE bot_commands SET response = 'Sosyal: {url}'
     WHERE lower(name) IN ('sosyal','socials','links')
       AND (
         trim(response) = ''
         OR lower(trim(replace(response, '!', ''))) IN ('sosyal','socials','links')
         OR trim(response) = '{url}'
       )",
  )
  .execute(pool)
  .await;
  let _ = sqlx::query(
    "UPDATE bot_commands SET response = '@{username} bu kanalı {time} süredir takip ediyor!'
     WHERE lower(name) = 'followage'
       AND (
         instr(response, char(10)) > 0
         OR instr(lower(response), 'henüz') > 0
       )",
  )
  .execute(pool)
  .await;
  Ok(inserted)
}

pub async fn find_command_by_name(pool: &SqlitePool, name: &str) -> Result<Option<BotCommand>> {
  let channel_id = default_channel_id(pool).await?;
  let key = name.trim().trim_start_matches('!').to_ascii_lowercase();
  let row = sqlx::query_as(
    "SELECT id, channel_id, name, aliases_json, response, enabled, cooldown_sec,
            user_cooldown_sec, min_level, cost_points, platforms_json, live_only,
            count_uses, extras_json
     FROM bot_commands WHERE channel_id = ? AND lower(name) = ?",
  )
  .bind(&channel_id)
  .bind(&key)
  .fetch_optional(pool)
  .await?;
  Ok(row)
}

pub async fn delete_command_by_name(pool: &SqlitePool, name: &str) -> Result<bool> {
  let channel_id = default_channel_id(pool).await?;
  let key = name.trim().trim_start_matches('!').to_ascii_lowercase();
  let r = sqlx::query("DELETE FROM bot_commands WHERE channel_id = ? AND lower(name) = ?")
    .bind(&channel_id)
    .bind(&key)
    .execute(pool)
    .await?;
  Ok(r.rows_affected() > 0)
}

fn as_json_text(v: &Value) -> String {
  match v {
    Value::String(s) => {
      let t = s.trim();
      if t.starts_with('{') || t.starts_with('[') {
        t.to_string()
      } else {
        v.to_string()
      }
    }
    _ => v.to_string(),
  }
}

/// Çift kodlanmış `extras_json` (`"\"{...}\""`) nesneye çözülür.
pub fn parse_json_object(s: &str) -> Value {
  let mut cur = s.trim().to_string();
  if cur.is_empty() {
    return json!({});
  }
  for _ in 0..4 {
    match serde_json::from_str::<Value>(&cur) {
      Ok(Value::String(inner)) => {
        cur = inner;
        continue;
      }
      Ok(v) if v.is_object() || v.is_array() => return v,
      _ => break,
    }
  }
  json!({})
}

fn extract_discord_invite_text(text: &str) -> String {
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

pub async fn upsert_command(pool: &SqlitePool, body: &Value, create: bool) -> Result<BotCommand> {
  let channel_id = default_channel_id(pool).await?;
  let id = body
    .get("id")
    .and_then(|v| v.as_str())
    .map(str::to_string)
    .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
  if !create {
    let exists: Option<(String,)> =
      sqlx::query_as("SELECT id FROM bot_commands WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool)
        .await?;
    if exists.is_none() {
      bail!("Komut bulunamadı");
    }
  }
  let name = body.get("name").and_then(|v| v.as_str()).unwrap_or("cmd");
  let raw_response = body
    .get("response")
    .and_then(|v| v.as_str())
    .unwrap_or("")
    .trim()
    .to_string();
  let mut response = raw_response.clone();
  let echo = response
    .trim_start_matches('!')
    .trim()
    .eq_ignore_ascii_case(name.trim_start_matches('!').trim());
  if name.eq_ignore_ascii_case("discord") && (response.is_empty() || echo || response == "{url}")
  {
    response = "Discord: {url}".into();
  }
  let aliases_json = as_json_text(
    &body
      .get("aliases_json")
      .cloned()
      .or_else(|| body.get("aliases").cloned())
      .unwrap_or(json!([])),
  );
  let enabled = body.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true) as i64;
  let cooldown = body
    .get("cooldown_sec")
    .or_else(|| body.get("cooldown"))
    .and_then(|v| v.as_i64())
    .unwrap_or(5);
  let user_cd = body
    .get("user_cooldown_sec")
    .and_then(|v| v.as_i64())
    .unwrap_or(0);
  let min_level = body.get("min_level").and_then(|v| v.as_i64()).unwrap_or(0);
  let cost = body
    .get("cost_points")
    .or_else(|| body.get("cost"))
    .and_then(|v| v.as_i64())
    .unwrap_or(0);
  let platforms = as_json_text(
    &body
      .get("platforms_json")
      .cloned()
      .or_else(|| body.get("platforms").cloned())
      .unwrap_or(json!(["kick", "twitch"])),
  );
  let live_only = body.get("live_only").and_then(|v| v.as_bool()).unwrap_or(false) as i64;
  let mut extras = as_json_text(
    &body
      .get("extras_json")
      .cloned()
      .or_else(|| body.get("extras").cloned())
      .unwrap_or(json!({})),
  );
  if name.eq_ignore_ascii_case("discord") {
    let mut obj: Value = serde_json::from_str(&extras).unwrap_or(json!({}));
    let has_url = obj
      .get("url")
      .and_then(|v| v.as_str())
      .map(|s| !s.trim().is_empty())
      .unwrap_or(false);
    if !has_url {
      let found = extract_discord_invite_text(&raw_response);
      if !found.is_empty() {
        if let Value::Object(map) = &mut obj {
          map.insert("url".into(), json!(found));
          extras = obj.to_string();
        }
        if response == found || response.eq_ignore_ascii_case(&found) {
          response = "Discord: {url}".into();
        }
      }
    }
  }

  sqlx::query(
    "INSERT INTO bot_commands(
       id, channel_id, name, aliases_json, response, enabled, cooldown_sec,
       user_cooldown_sec, min_level, cost_points, platforms_json, live_only, extras_json
     ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name, aliases_json=excluded.aliases_json, response=excluded.response,
       enabled=excluded.enabled, cooldown_sec=excluded.cooldown_sec,
       user_cooldown_sec=excluded.user_cooldown_sec, min_level=excluded.min_level,
       cost_points=excluded.cost_points, platforms_json=excluded.platforms_json,
       live_only=excluded.live_only, extras_json=excluded.extras_json",
  )
  .bind(&id)
  .bind(&channel_id)
  .bind(name)
  .bind(&aliases_json)
  .bind(response)
  .bind(enabled)
  .bind(cooldown)
  .bind(user_cd)
  .bind(min_level)
  .bind(cost)
  .bind(&platforms)
  .bind(live_only)
  .bind(&extras)
  .execute(pool)
  .await?;

  sqlx::query_as(
    "SELECT id, channel_id, name, aliases_json, response, enabled, cooldown_sec,
            user_cooldown_sec, min_level, cost_points, platforms_json, live_only,
            count_uses, extras_json
     FROM bot_commands WHERE id = ?",
  )
  .bind(&id)
  .fetch_one(pool)
  .await
  .map_err(Into::into)
}

pub async fn delete_command(pool: &SqlitePool, id: &str) -> Result<bool> {
  let r = sqlx::query("DELETE FROM bot_commands WHERE id = ?")
    .bind(id)
    .execute(pool)
    .await?;
  Ok(r.rows_affected() > 0)
}

pub async fn list_timers(pool: &SqlitePool) -> Result<Vec<BotTimer>> {
  let channel_id = default_channel_id(pool).await?;
  let rows = sqlx::query_as(
    "SELECT id, channel_id, name, message, enabled, interval_sec, min_chat_lines,
            last_fired_at, lines_since
     FROM bot_timers WHERE channel_id = ? ORDER BY name",
  )
  .bind(&channel_id)
  .fetch_all(pool)
  .await?;
  Ok(rows)
}

pub async fn upsert_timer(pool: &SqlitePool, body: &Value) -> Result<BotTimer> {
  let channel_id = default_channel_id(pool).await?;
  let id = body
    .get("id")
    .and_then(|v| v.as_str())
    .map(str::to_string)
    .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
  let name = body.get("name").and_then(|v| v.as_str()).unwrap_or("timer");
  let message = body.get("message").and_then(|v| v.as_str()).unwrap_or("");
  let enabled = body.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true) as i64;
  let interval = body
    .get("interval_sec")
    .and_then(|v| v.as_i64())
    .unwrap_or(300);
  let min_lines = body
    .get("min_chat_lines")
    .and_then(|v| v.as_i64())
    .unwrap_or(0);

  sqlx::query(
    "INSERT INTO bot_timers(id, channel_id, name, message, enabled, interval_sec, min_chat_lines)
     VALUES(?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name, message=excluded.message, enabled=excluded.enabled,
       interval_sec=excluded.interval_sec, min_chat_lines=excluded.min_chat_lines",
  )
  .bind(&id)
  .bind(&channel_id)
  .bind(name)
  .bind(message)
  .bind(enabled)
  .bind(interval)
  .bind(min_lines)
  .execute(pool)
  .await?;

  sqlx::query_as(
    "SELECT id, channel_id, name, message, enabled, interval_sec, min_chat_lines,
            last_fired_at, lines_since
     FROM bot_timers WHERE id = ?",
  )
  .bind(&id)
  .fetch_one(pool)
  .await
  .map_err(Into::into)
}

pub async fn delete_timer(pool: &SqlitePool, id: &str) -> Result<bool> {
  let r = sqlx::query("DELETE FROM bot_timers WHERE id = ?")
    .bind(id)
    .execute(pool)
    .await?;
  Ok(r.rows_affected() > 0)
}

pub async fn get_filters(pool: &SqlitePool) -> Result<BotFilters> {
  let channel_id = default_channel_id(pool).await?;
  if let Some(f) = sqlx::query_as::<_, BotFilters>(
    "SELECT channel_id, caps_enabled, caps_min_len, caps_ratio,
            long_msg_enabled, long_msg_max, links_enabled,
            symbols_enabled, symbols_max, blacklist_json, action, timeout_sec, exempt_level,
            strike_window_sec, strike_ladder_json
     FROM bot_filters WHERE channel_id = ?",
  )
  .bind(&channel_id)
  .fetch_optional(pool)
  .await?
  {
    return Ok(f);
  }
  sqlx::query(
    "INSERT INTO bot_filters(channel_id) VALUES(?)",
  )
  .bind(&channel_id)
  .execute(pool)
  .await?;
  sqlx::query_as(
    "SELECT channel_id, caps_enabled, caps_min_len, caps_ratio,
            long_msg_enabled, long_msg_max, links_enabled,
            symbols_enabled, symbols_max, blacklist_json, action, timeout_sec, exempt_level,
            strike_window_sec, strike_ladder_json
     FROM bot_filters WHERE channel_id = ?",
  )
  .bind(&channel_id)
  .fetch_one(pool)
  .await
  .map_err(Into::into)
}

pub async fn put_filters(pool: &SqlitePool, body: &Value) -> Result<BotFilters> {
  let channel_id = default_channel_id(pool).await?;
  let cur = get_filters(pool).await?;
  let caps_enabled = body
    .get("caps_enabled")
    .and_then(|v| v.as_bool())
    .map(|b| b as i64)
    .unwrap_or(cur.caps_enabled);
  let caps_min_len = body
    .get("caps_min_len")
    .and_then(|v| v.as_i64())
    .unwrap_or(cur.caps_min_len);
  let caps_ratio = body
    .get("caps_ratio")
    .and_then(|v| v.as_f64())
    .unwrap_or(cur.caps_ratio);
  let links_enabled = body
    .get("links_enabled")
    .and_then(|v| v.as_bool())
    .map(|b| b as i64)
    .unwrap_or(cur.links_enabled);
  let symbols_enabled = body
    .get("symbols_enabled")
    .and_then(|v| v.as_bool())
    .map(|b| b as i64)
    .unwrap_or(cur.symbols_enabled);
  let symbols_max = body
    .get("symbols_max")
    .and_then(|v| v.as_i64())
    .unwrap_or(cur.symbols_max);
  let blacklist_json = body
    .get("blacklist_json")
    .cloned()
    .or_else(|| body.get("blacklist").cloned())
    .map(|v| v.to_string())
    .unwrap_or(cur.blacklist_json);
  let action = body
    .get("action")
    .and_then(|v| v.as_str())
    .unwrap_or(&cur.action);
  let timeout_sec = body
    .get("timeout_sec")
    .and_then(|v| v.as_i64())
    .unwrap_or(cur.timeout_sec);
  let exempt_level = body
    .get("exempt_level")
    .and_then(|v| v.as_i64())
    .unwrap_or(cur.exempt_level);
  let long_msg_enabled = body
    .get("long_msg_enabled")
    .and_then(|v| v.as_bool())
    .map(|b| b as i64)
    .unwrap_or(cur.long_msg_enabled);
  let long_msg_max = body
    .get("long_msg_max")
    .and_then(|v| v.as_i64())
    .unwrap_or(cur.long_msg_max);
  let strike_window_sec = body
    .get("strike_window_sec")
    .and_then(|v| v.as_i64())
    .unwrap_or(cur.strike_window_sec);
  let strike_ladder_json = body
    .get("strike_ladder_json")
    .cloned()
    .or_else(|| body.get("strike_ladder").cloned())
    .map(|v| {
      if v.is_string() {
        v.as_str().unwrap_or("[]").to_string()
      } else {
        v.to_string()
      }
    })
    .unwrap_or(cur.strike_ladder_json);

  sqlx::query(
    "INSERT INTO bot_filters(
       channel_id, caps_enabled, caps_min_len, caps_ratio, long_msg_enabled, long_msg_max,
       links_enabled, symbols_enabled, symbols_max, blacklist_json, action, timeout_sec,
       exempt_level, strike_window_sec, strike_ladder_json
     ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(channel_id) DO UPDATE SET
       caps_enabled=excluded.caps_enabled, caps_min_len=excluded.caps_min_len,
       caps_ratio=excluded.caps_ratio, long_msg_enabled=excluded.long_msg_enabled,
       long_msg_max=excluded.long_msg_max, links_enabled=excluded.links_enabled,
       symbols_enabled=excluded.symbols_enabled, symbols_max=excluded.symbols_max,
       blacklist_json=excluded.blacklist_json, action=excluded.action,
       timeout_sec=excluded.timeout_sec, exempt_level=excluded.exempt_level,
       strike_window_sec=excluded.strike_window_sec,
       strike_ladder_json=excluded.strike_ladder_json",
  )
  .bind(&channel_id)
  .bind(caps_enabled)
  .bind(caps_min_len)
  .bind(caps_ratio)
  .bind(long_msg_enabled)
  .bind(long_msg_max)
  .bind(links_enabled)
  .bind(symbols_enabled)
  .bind(symbols_max)
  .bind(&blacklist_json)
  .bind(action)
  .bind(timeout_sec)
  .bind(exempt_level)
  .bind(strike_window_sec)
  .bind(&strike_ladder_json)
  .execute(pool)
  .await?;
  get_filters(pool).await
}

pub async fn get_bot_settings(pool: &SqlitePool) -> Result<BotSettings> {
  let channel_id = default_channel_id(pool).await?;
  if let Some(s) = sqlx::query_as::<_, BotSettings>(
    "SELECT channel_id, enabled, bot_name, prefix, reply_to_kick, reply_to_twitch,
            reply_to_youtube, reply_to_overlay, reply_delay_ms, extras_json
     FROM bot_settings WHERE channel_id = ?",
  )
  .bind(&channel_id)
  .fetch_optional(pool)
  .await?
  {
    return Ok(s);
  }
  sqlx::query("INSERT INTO bot_settings(channel_id, bot_name, reply_delay_ms) VALUES(?, 'BotAxT', 0)")
    .bind(&channel_id)
    .execute(pool)
    .await?;
  sqlx::query_as(
    "SELECT channel_id, enabled, bot_name, prefix, reply_to_kick, reply_to_twitch,
            reply_to_youtube, reply_to_overlay, reply_delay_ms, extras_json
     FROM bot_settings WHERE channel_id = ?",
  )
  .bind(&channel_id)
  .fetch_one(pool)
  .await
  .map_err(Into::into)
}

fn json_flag(body: &Value, keys: &[&str], cur: i64) -> i64 {
  for k in keys {
    let Some(v) = body.get(*k) else {
      continue;
    };
    if let Some(b) = v.as_bool() {
      return i64::from(b);
    }
    if let Some(n) = v.as_i64() {
      return i64::from(n != 0);
    }
    if let Some(s) = v.as_str() {
      match s.trim().to_ascii_lowercase().as_str() {
        "1" | "true" | "yes" | "on" => return 1,
        "0" | "false" | "no" | "off" => return 0,
        _ => {}
      }
    }
  }
  cur
}

pub async fn put_bot_settings(pool: &SqlitePool, body: &Value) -> Result<BotSettings> {
  let channel_id = default_channel_id(pool).await?;
  let cur = get_bot_settings(pool).await?;
  let enabled = json_flag(body, &["enabled"], cur.enabled);
  let bot_name = body
    .get("bot_name")
    .or_else(|| body.get("botName"))
    .and_then(|v| v.as_str())
    .unwrap_or(&cur.bot_name);
  let prefix = body
    .get("prefix")
    .and_then(|v| v.as_str())
    .unwrap_or(&cur.prefix);
  let reply_to_kick = json_flag(body, &["reply_to_kick", "replyToKick"], cur.reply_to_kick);
  let reply_to_twitch = json_flag(
    body,
    &["reply_to_twitch", "replyToTwitch"],
    cur.reply_to_twitch,
  );
  let reply_to_youtube = json_flag(
    body,
    &["reply_to_youtube", "replyToYoutube"],
    cur.reply_to_youtube,
  );
  let reply_to_overlay = json_flag(
    body,
    &["reply_to_overlay", "replyToOverlay"],
    cur.reply_to_overlay,
  );
  let reply_delay_ms = body
    .get("reply_delay_ms")
    .and_then(|v| v.as_i64())
    .unwrap_or(cur.reply_delay_ms);
  let extras = body
    .get("extras_json")
    .cloned()
    .or_else(|| body.get("extras").cloned())
    .map(|v| as_json_text(&v))
    .unwrap_or(cur.extras_json);

  sqlx::query(
    "INSERT INTO bot_settings(
       channel_id, enabled, bot_name, prefix, reply_to_kick, reply_to_twitch,
       reply_to_youtube, reply_to_overlay, reply_delay_ms, extras_json
     ) VALUES(?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(channel_id) DO UPDATE SET
       enabled=excluded.enabled, bot_name=excluded.bot_name, prefix=excluded.prefix,
       reply_to_kick=excluded.reply_to_kick, reply_to_twitch=excluded.reply_to_twitch,
       reply_to_youtube=excluded.reply_to_youtube, reply_to_overlay=excluded.reply_to_overlay,
       reply_delay_ms=excluded.reply_delay_ms, extras_json=excluded.extras_json",
  )
  .bind(&channel_id)
  .bind(enabled)
  .bind(bot_name)
  .bind(prefix)
  .bind(reply_to_kick)
  .bind(reply_to_twitch)
  .bind(reply_to_youtube)
  .bind(reply_to_overlay)
  .bind(reply_delay_ms)
  .bind(&extras)
  .execute(pool)
  .await?;
  get_bot_settings(pool).await
}

// ─── Loyalty ──────────────────────────────────────────────────────────

pub async fn list_loyalty_users(pool: &SqlitePool, limit: i64) -> Result<Vec<LoyaltyUser>> {
  let channel_id = default_channel_id(pool).await?;
  let rows = sqlx::query_as(
    "SELECT channel_id, user_key, user_name, platform, points, xp, rank_id,
            messages, watch_sec, last_seen
     FROM loyalty_users WHERE channel_id = ?
     ORDER BY points DESC, xp DESC LIMIT ?",
  )
  .bind(&channel_id)
  .bind(limit.clamp(1, 500))
  .fetch_all(pool)
  .await?;
  Ok(rows)
}

pub async fn reset_loyalty(pool: &SqlitePool, points: bool, levels: bool) -> Result<u64> {
  if !points && !levels {
    bail!("Puanlar veya seviyelerden en az biri seçilmeli");
  }
  let channel_id = default_channel_id(pool).await?;
  let result = sqlx::query(
    "UPDATE loyalty_users
     SET points = CASE WHEN ? THEN 0 ELSE points END,
         xp = CASE WHEN ? THEN 0 ELSE xp END,
         rank_id = CASE WHEN ? THEN NULL ELSE rank_id END
     WHERE channel_id = ?",
  )
  .bind(points)
  .bind(levels)
  .bind(levels)
  .bind(channel_id)
  .execute(pool)
  .await?;
  Ok(result.rows_affected())
}

pub async fn get_loyalty_settings(pool: &SqlitePool) -> Result<LoyaltySettings> {
  let channel_id = default_channel_id(pool).await?;
  if let Some(s) = sqlx::query_as::<_, LoyaltySettings>(
    "SELECT channel_id, points_name, points_per_interval, interval_sec,
            points_per_message, initial_points, sub_multiplier, tip_points_per_unit,
            tip_currency_unit, ignored_users_json, extras_json,
            last_tick_at, tick_enabled
     FROM loyalty_settings WHERE channel_id = ?",
  )
  .bind(&channel_id)
  .fetch_optional(pool)
  .await?
  {
    return Ok(s);
  }
  sqlx::query("INSERT INTO loyalty_settings(channel_id) VALUES(?)")
    .bind(&channel_id)
    .execute(pool)
    .await?;
  sqlx::query_as(
    "SELECT channel_id, points_name, points_per_interval, interval_sec,
            points_per_message, initial_points, sub_multiplier, tip_points_per_unit,
            tip_currency_unit, ignored_users_json, extras_json,
            last_tick_at, tick_enabled
     FROM loyalty_settings WHERE channel_id = ?",
  )
  .bind(&channel_id)
  .fetch_one(pool)
  .await
  .map_err(Into::into)
}

pub async fn put_loyalty_settings(pool: &SqlitePool, body: &Value) -> Result<LoyaltySettings> {
  let channel_id = default_channel_id(pool).await?;
  let cur = get_loyalty_settings(pool).await?;
  let points_name = body
    .get("points_name")
    .and_then(|v| v.as_str())
    .unwrap_or(&cur.points_name);
  let points_per_interval = body
    .get("points_per_interval")
    .and_then(|v| v.as_i64())
    .unwrap_or(cur.points_per_interval);
  let interval_sec = body
    .get("interval_sec")
    .and_then(|v| v.as_i64())
    .unwrap_or(cur.interval_sec);
  let points_per_message = body
    .get("points_per_message")
    .and_then(|v| v.as_i64())
    .unwrap_or(cur.points_per_message);
  let initial_points = body
    .get("initial_points")
    .and_then(|v| v.as_i64())
    .unwrap_or(cur.initial_points);
  let ignored = body
    .get("ignored_users_json")
    .cloned()
    .or_else(|| body.get("ignored_users").cloned())
    .map(|v| v.to_string())
    .unwrap_or(cur.ignored_users_json);
  let extras = body
    .get("extras_json")
    .cloned()
    .or_else(|| body.get("extras").cloned())
    .map(|v| v.to_string())
    .unwrap_or(cur.extras_json);
  let tick_enabled = body
    .get("tick_enabled")
    .and_then(|v| v.as_bool())
    .map(|b| b as i64)
    .or_else(|| body.get("tick_enabled").and_then(|v| v.as_i64()))
    .unwrap_or(cur.tick_enabled);
  let sub_multiplier = body
    .get("sub_multiplier")
    .and_then(|v| v.as_f64())
    .unwrap_or(cur.sub_multiplier);
  let tip_points_per_unit = body
    .get("tip_points_per_unit")
    .and_then(|v| v.as_i64())
    .unwrap_or(cur.tip_points_per_unit);
  let tip_currency_unit = body
    .get("tip_currency_unit")
    .and_then(|v| v.as_f64())
    .unwrap_or(cur.tip_currency_unit);

  sqlx::query(
    "INSERT INTO loyalty_settings(
       channel_id, points_name, points_per_interval, interval_sec,
       points_per_message, initial_points, sub_multiplier, tip_points_per_unit,
       tip_currency_unit, ignored_users_json, extras_json, tick_enabled
     ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(channel_id) DO UPDATE SET
       points_name=excluded.points_name,
       points_per_interval=excluded.points_per_interval,
       interval_sec=excluded.interval_sec,
       points_per_message=excluded.points_per_message,
       initial_points=excluded.initial_points,
       sub_multiplier=excluded.sub_multiplier,
       tip_points_per_unit=excluded.tip_points_per_unit,
       tip_currency_unit=excluded.tip_currency_unit,
       ignored_users_json=excluded.ignored_users_json,
       extras_json=excluded.extras_json,
       tick_enabled=excluded.tick_enabled",
  )
  .bind(&channel_id)
  .bind(points_name)
  .bind(points_per_interval)
  .bind(interval_sec)
  .bind(points_per_message)
  .bind(initial_points)
  .bind(sub_multiplier)
  .bind(tip_points_per_unit)
  .bind(tip_currency_unit)
  .bind(&ignored)
  .bind(&extras)
  .bind(tick_enabled)
  .execute(pool)
  .await?;
  get_loyalty_settings(pool).await
}

pub async fn list_shop(pool: &SqlitePool) -> Result<Vec<ShopItem>> {
  let channel_id = default_channel_id(pool).await?;
  let rows = sqlx::query_as(
    "SELECT id, channel_id, name, cost, response, enabled, alert, stock, cooldown_sec,
            trigger_kind, trigger_json
     FROM shop_items WHERE channel_id = ? ORDER BY name",
  )
  .bind(&channel_id)
  .fetch_all(pool)
  .await?;
  Ok(rows)
}

pub async fn upsert_shop_item(pool: &SqlitePool, body: &Value) -> Result<ShopItem> {
  let channel_id = default_channel_id(pool).await?;
  let id = body
    .get("id")
    .and_then(|v| v.as_str())
    .map(str::to_string)
    .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
  let name = body.get("name").and_then(|v| v.as_str()).unwrap_or("item");
  let cost = body.get("cost").and_then(|v| v.as_i64()).unwrap_or(0);
  let response = body.get("response").and_then(|v| v.as_str()).unwrap_or("");
  let enabled = body.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true) as i64;
  let alert = body.get("alert").and_then(|v| v.as_bool()).unwrap_or(true) as i64;
  let trigger_kind = body
    .get("trigger_kind")
    .and_then(|v| v.as_str())
    .unwrap_or("chat");
  let trigger_json = body
    .get("trigger_json")
    .cloned()
    .or_else(|| body.get("trigger").cloned())
    .unwrap_or(json!({}))
    .to_string();
  let stock = body.get("stock").and_then(|v| {
    if v.is_null() {
      None
    } else {
      v.as_i64()
    }
  });
  let cooldown_sec = body
    .get("cooldown_sec")
    .and_then(|v| v.as_i64())
    .unwrap_or(0);

  sqlx::query(
    "INSERT INTO shop_items(id, channel_id, name, cost, response, enabled, alert, stock, cooldown_sec, trigger_kind, trigger_json)
     VALUES(?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name, cost=excluded.cost, response=excluded.response,
       enabled=excluded.enabled, alert=excluded.alert, stock=excluded.stock,
       cooldown_sec=excluded.cooldown_sec,
       trigger_kind=excluded.trigger_kind, trigger_json=excluded.trigger_json",
  )
  .bind(&id)
  .bind(&channel_id)
  .bind(name)
  .bind(cost)
  .bind(response)
  .bind(enabled)
  .bind(alert)
  .bind(stock)
  .bind(cooldown_sec)
  .bind(trigger_kind)
  .bind(&trigger_json)
  .execute(pool)
  .await?;

  sqlx::query_as(
    "SELECT id, channel_id, name, cost, response, enabled, alert, stock, cooldown_sec,
            trigger_kind, trigger_json
     FROM shop_items WHERE id = ?",
  )
  .bind(&id)
  .fetch_one(pool)
  .await
  .map_err(Into::into)
}

pub async fn delete_shop_item(pool: &SqlitePool, id: &str) -> Result<bool> {
  let r = sqlx::query("DELETE FROM shop_items WHERE id = ?")
    .bind(id)
    .execute(pool)
    .await?;
  Ok(r.rows_affected() > 0)
}

/// `!buy <id|name>` — puan düş, stok azalt, sale kaydet.
pub async fn shop_buy(
  pool: &SqlitePool,
  user_key: &str,
  user_name: &str,
  item_ref: &str,
) -> Result<(ShopItem, ShopSale)> {
  let channel_id = default_channel_id(pool).await?;
  let item_ref = item_ref.trim();
  if item_ref.is_empty() {
    bail!("Öğe belirtilmedi");
  }
  let item: ShopItem = sqlx::query_as(
    "SELECT id, channel_id, name, cost, response, enabled, alert, stock, cooldown_sec,
            trigger_kind, trigger_json
     FROM shop_items
     WHERE channel_id = ? AND enabled = 1 AND (id = ? OR lower(name) = lower(?))
     LIMIT 1",
  )
  .bind(&channel_id)
  .bind(item_ref)
  .bind(item_ref)
  .fetch_optional(pool)
  .await?
  .context("Mağaza öğesi bulunamadı")?;

  if let Some(stock) = item.stock {
    if stock <= 0 {
      bail!("Stok tükendi");
    }
  }

  crate::db::loyalty::ensure_loyalty_user(pool, &channel_id, user_key, Some(user_name)).await?;
  try_spend_points(pool, user_key, item.cost, "shop_buy").await?;

  if item.stock.is_some() {
    sqlx::query(
      "UPDATE shop_items SET stock = CASE
         WHEN stock IS NULL THEN NULL
         WHEN stock <= 0 THEN 0
         ELSE stock - 1 END
       WHERE id = ?",
    )
    .bind(&item.id)
    .execute(pool)
    .await?;
  }

  let sale_id = uuid::Uuid::new_v4().to_string();
  let now = chrono_now();
  sqlx::query(
    "INSERT INTO shop_sales(id, channel_id, user_key, user_name, item_id, item_name, cost, ts)
     VALUES(?,?,?,?,?,?,?,?)",
  )
  .bind(&sale_id)
  .bind(&channel_id)
  .bind(user_key)
  .bind(user_name)
  .bind(&item.id)
  .bind(&item.name)
  .bind(item.cost)
  .bind(now)
  .execute(pool)
  .await?;

  let sale = ShopSale {
    id: sale_id,
    channel_id,
    user_key: user_key.into(),
    user_name: user_name.into(),
    item_id: item.id.clone(),
    item_name: item.name.clone(),
    cost: item.cost,
    ts: now,
  };
  Ok((item, sale))
}

pub async fn record_moderation_strike(
  pool: &SqlitePool,
  user_key: &str,
  reason: &str,
  action: &str,
  expires_at: Option<i64>,
) -> Result<i64> {
  let channel_id = default_channel_id(pool).await?;
  crate::db::loyalty::ensure_loyalty_user(pool, &channel_id, user_key, None).await?;
  let id = uuid::Uuid::new_v4().to_string();
  let now = chrono_now();
  sqlx::query(
    "INSERT INTO moderation_strikes(id, channel_id, user_key, reason, action, ts, expires_at)
     VALUES(?,?,?,?,?,?,?)",
  )
  .bind(&id)
  .bind(&channel_id)
  .bind(user_key)
  .bind(reason)
  .bind(action)
  .bind(now)
  .bind(expires_at)
  .execute(pool)
  .await?;

  let window_sec: i64 = sqlx::query_scalar(
    "SELECT strike_window_sec FROM bot_filters WHERE channel_id = ?",
  )
  .bind(&channel_id)
  .fetch_optional(pool)
  .await?
  .unwrap_or(3600);
  let since = now - window_sec * 1000;
  let count: i64 = sqlx::query_scalar(
    "SELECT COUNT(*) FROM moderation_strikes
     WHERE channel_id = ? AND user_key = ? AND ts >= ?",
  )
  .bind(&channel_id)
  .bind(user_key)
  .bind(since)
  .fetch_one(pool)
  .await?;
  Ok(count)
}

pub async fn adjust_loyalty(
  pool: &SqlitePool,
  user_key: &str,
  delta: i64,
  reason: &str,
) -> Result<LoyaltyUser> {
  let channel_id = default_channel_id(pool).await?;
  let now = chrono_now();
  let platform = user_key.split(':').next().unwrap_or("local");
  let user_name = user_key.split(':').nth(1).unwrap_or(user_key);

  sqlx::query(
    "INSERT INTO loyalty_users(channel_id, user_key, user_name, platform, points, xp, messages, watch_sec, last_seen)
     VALUES(?,?,?,?,?,?,0,0,?)
     ON CONFLICT(channel_id, user_key) DO UPDATE SET
       points = loyalty_users.points + excluded.points,
       last_seen = excluded.last_seen,
       user_name = excluded.user_name",
  )
  .bind(&channel_id)
  .bind(user_key)
  .bind(user_name)
  .bind(platform)
  .bind(delta)
  .bind(delta.max(0))
  .bind(now)
  .execute(pool)
  .await?;

  sqlx::query(
    "INSERT INTO points_ledger(channel_id, user_key, delta, reason, ts) VALUES(?,?,?,?,?)",
  )
  .bind(&channel_id)
  .bind(user_key)
  .bind(delta)
  .bind(reason)
  .bind(now)
  .execute(pool)
  .await?;

  sqlx::query_as(
    "SELECT channel_id, user_key, user_name, platform, points, xp, rank_id,
            messages, watch_sec, last_seen
     FROM loyalty_users WHERE channel_id = ? AND user_key = ?",
  )
  .bind(&channel_id)
  .bind(user_key)
  .fetch_one(pool)
  .await
  .map_err(Into::into)
}

async fn try_spend_points(pool: &SqlitePool, user_key: &str, amount: i64, reason: &str) -> Result<()> {
  let channel_id = default_channel_id(pool).await?;
  let pts: Option<i64> = sqlx::query_scalar(
    "SELECT points FROM loyalty_users WHERE channel_id = ? AND user_key = ?",
  )
  .bind(&channel_id)
  .bind(user_key)
  .fetch_optional(pool)
  .await?;
  let Some(pts) = pts else {
    bail!("Kullanıcı bulunamadı");
  };
  if pts < amount {
    bail!("Yetersiz puan");
  }
  adjust_loyalty(pool, user_key, -amount, reason).await?;
  Ok(())
}

// ─── Games ────────────────────────────────────────────────────────────

fn rnd_u32() -> u32 {
  (uuid::Uuid::new_v4().as_u128() & 0xffff_ffff) as u32
}

pub async fn get_game_settings(pool: &SqlitePool) -> Result<GameSettings> {
  let channel_id = default_channel_id(pool).await?;
  if let Some(s) = sqlx::query_as::<_, GameSettings>(
    "SELECT channel_id, config_json FROM game_settings WHERE channel_id = ?",
  )
  .bind(&channel_id)
  .fetch_optional(pool)
  .await?
  {
    return Ok(s);
  }
  sqlx::query("INSERT INTO game_settings(channel_id, config_json) VALUES(?, '{}')")
    .bind(&channel_id)
    .execute(pool)
    .await?;
  Ok(GameSettings {
    channel_id,
    config_json: "{}".into(),
  })
}

pub async fn put_game_settings(pool: &SqlitePool, body: &Value) -> Result<GameSettings> {
  let channel_id = default_channel_id(pool).await?;
  let mut base = default_game_config();
  if let Ok(cur) = get_game_settings(pool).await {
    if let Ok(v) = serde_json::from_str::<Value>(&cur.config_json) {
      if let (Some(b), Some(c)) = (base.as_object_mut(), v.as_object()) {
        for (k, val) in c {
          b.insert(k.clone(), val.clone());
        }
      }
    }
  }
  let incoming = body
    .get("config_json")
    .cloned()
    .or_else(|| body.get("config").cloned())
    .unwrap_or_else(|| body.clone());
  if let (Some(b), Some(inc)) = (base.as_object_mut(), incoming.as_object()) {
    for (k, val) in inc {
      if k == "channel_id" || k == "config_json" || k == "config" {
        continue;
      }
      if let (Some(dst), Some(src)) = (b.get_mut(k).and_then(|x| x.as_object_mut()), val.as_object())
      {
        for (sk, sv) in src {
          dst.insert(sk.clone(), sv.clone());
        }
      } else {
        b.insert(k.clone(), val.clone());
      }
    }
  }
  let cfg = base.to_string();
  sqlx::query(
    "INSERT INTO game_settings(channel_id, config_json) VALUES(?,?)
     ON CONFLICT(channel_id) DO UPDATE SET config_json=excluded.config_json",
  )
  .bind(&channel_id)
  .bind(&cfg)
  .execute(pool)
  .await?;
  get_game_settings(pool).await
}

/// game_settings.config_json içinden heist/roulette/duel alt objesi.
pub fn game_cfg_section(config_json: &str, game: &str) -> Value {
  serde_json::from_str::<Value>(config_json)
    .ok()
    .and_then(|v| v.get(game).cloned())
    .unwrap_or(json!({}))
}

pub fn default_game_config() -> Value {
  json!({
    "heist": {
      "enabled": true,
      "win_chance": 0.5,
      "multiplier": 2.0,
      "gather_sec": 120,
      "cooldown_sec": 60,
      "min_bet": 10,
      "max_bet": 5000
    },
    "roulette": {
      "enabled": true,
      "cooldown_sec": 15,
      "color_mult": 2.0,
      "green_mult": 14.0,
      "number_mult": 14.0,
      "max_bet": 5000
    },
    "duel": {
      "enabled": true,
      "win_chance": 0.5,
      "multiplier": 2.0,
      "cooldown_sec": 30,
      "accept_sec": 60,
      "max_bet": 5000
    }
  })
}

pub async fn heist_start(pool: &SqlitePool) -> Result<GameRound> {
  let channel_id = default_channel_id(pool).await?;
  // açık heist varsa onu döndür
  if let Some(r) = sqlx::query_as::<_, GameRound>(
    "SELECT id, channel_id, game, status, pot, config_json, result_json, started_at, settled_at
     FROM game_rounds WHERE channel_id = ? AND game = 'heist' AND status = 'open'
     ORDER BY started_at DESC LIMIT 1",
  )
  .bind(&channel_id)
  .fetch_optional(pool)
  .await?
  {
    return Ok(r);
  }
  let gs = get_game_settings(pool).await?;
  let heist = game_cfg_section(&gs.config_json, "heist");
  let gather = heist
    .get("gather_sec")
    .and_then(|v| v.as_i64())
    .unwrap_or(120)
    .clamp(15, 600);
  let id = uuid::Uuid::new_v4().to_string();
  let now = chrono_now();
  let cfg = json!({
    "window_sec": gather,
    "ends_at": now + gather * 1000,
    "win_chance": heist.get("win_chance").and_then(|v| v.as_f64()).unwrap_or(0.5),
    "multiplier": heist.get("multiplier").and_then(|v| v.as_f64()).unwrap_or(2.0),
  })
  .to_string();
  sqlx::query(
    "INSERT INTO game_rounds(id, channel_id, game, status, pot, config_json, result_json, started_at)
     VALUES(?,?,'heist','open',0,?,'{}',?)",
  )
  .bind(&id)
  .bind(&channel_id)
  .bind(&cfg)
  .bind(now)
  .execute(pool)
  .await?;
  sqlx::query_as(
    "SELECT id, channel_id, game, status, pot, config_json, result_json, started_at, settled_at
     FROM game_rounds WHERE id = ?",
  )
  .bind(&id)
  .fetch_one(pool)
  .await
  .map_err(Into::into)
}

pub async fn heist_join(
  pool: &SqlitePool,
  user_key: &str,
  user_name: &str,
  amount: i64,
) -> Result<Value> {
  if amount <= 0 {
    bail!("Miktar geçersiz");
  }
  let channel_id = default_channel_id(pool).await?;
  let round: GameRound = sqlx::query_as(
    "SELECT id, channel_id, game, status, pot, config_json, result_json, started_at, settled_at
     FROM game_rounds WHERE channel_id = ? AND game = 'heist' AND status = 'open'
     ORDER BY started_at DESC LIMIT 1",
  )
  .bind(&channel_id)
  .fetch_optional(pool)
  .await?
  .context("Açık heist yok")?;

  // süre kontrolü
  if let Ok(cfg) = serde_json::from_str::<Value>(&round.config_json) {
    if let Some(ends) = cfg.get("ends_at").and_then(|v| v.as_i64()) {
      if chrono_now() > ends {
        bail!("Heist süresi doldu");
      }
    }
  }

  crate::db::loyalty::ensure_loyalty_user(pool, &channel_id, user_key, Some(user_name)).await?;
  try_spend_points(pool, user_key, amount, "heist_bet").await?;

  let bet_id = uuid::Uuid::new_v4().to_string();
  let now = chrono_now();
  sqlx::query(
    "INSERT INTO game_bets(id, round_id, channel_id, user_key, user_name, amount, choice_json, payout, ts)
     VALUES(?,?,?,?,?,?,'{}',0,?)",
  )
  .bind(&bet_id)
  .bind(&round.id)
  .bind(&channel_id)
  .bind(user_key)
  .bind(user_name)
  .bind(amount)
  .bind(now)
  .execute(pool)
  .await?;

  sqlx::query("UPDATE game_rounds SET pot = pot + ? WHERE id = ?")
    .bind(amount)
    .bind(&round.id)
    .execute(pool)
    .await?;

  Ok(json!({ "bet_id": bet_id, "round_id": round.id, "amount": amount }))
}

pub async fn heist_settle(pool: &SqlitePool) -> Result<Value> {
  let channel_id = default_channel_id(pool).await?;
  let round: GameRound = sqlx::query_as(
    "SELECT id, channel_id, game, status, pot, config_json, result_json, started_at, settled_at
     FROM game_rounds WHERE channel_id = ? AND game = 'heist' AND status = 'open'
     ORDER BY started_at DESC LIMIT 1",
  )
  .bind(&channel_id)
  .fetch_optional(pool)
  .await?
  .context("Açık heist yok")?;

  let round_cfg: Value = serde_json::from_str(&round.config_json).unwrap_or(json!({}));
  let gs = get_game_settings(pool).await.ok();
  let heist = gs
    .as_ref()
    .map(|g| game_cfg_section(&g.config_json, "heist"))
    .unwrap_or(json!({}));
  let win_chance = round_cfg
    .get("win_chance")
    .and_then(|v| v.as_f64())
    .or_else(|| heist.get("win_chance").and_then(|v| v.as_f64()))
    .unwrap_or(0.5)
    .clamp(0.0, 1.0);
  let mult = round_cfg
    .get("multiplier")
    .and_then(|v| v.as_f64())
    .or_else(|| heist.get("multiplier").and_then(|v| v.as_f64()))
    .unwrap_or(2.0)
    .max(1.0);
  let roll = (rnd_u32() as f64) / (u32::MAX as f64);
  let win = roll < win_chance;

  let bets: Vec<(String, String, i64)> = sqlx::query_as(
    "SELECT user_key, user_name, amount FROM game_bets WHERE round_id = ?",
  )
  .bind(&round.id)
  .fetch_all(pool)
  .await?;

  let mut payouts = Vec::new();
  if win {
    for (uk, un, amt) in &bets {
      let payout = ((*amt as f64) * mult).round() as i64;
      let _ = adjust_loyalty(pool, uk, payout, "heist_win").await;
      sqlx::query("UPDATE game_bets SET payout = ? WHERE round_id = ? AND user_key = ?")
        .bind(payout)
        .bind(&round.id)
        .bind(uk)
        .execute(pool)
        .await?;
      payouts.push(json!({ "user_key": uk, "user_name": un, "payout": payout }));
    }
  }

  let now = chrono_now();
  let result = json!({
    "win": win,
    "win_chance": win_chance,
    "multiplier": mult,
    "roll": roll,
    "payouts": payouts,
    "pot": round.pot
  });
  sqlx::query(
    "UPDATE game_rounds SET status = 'settled', result_json = ?, settled_at = ? WHERE id = ?",
  )
  .bind(result.to_string())
  .bind(now)
  .bind(&round.id)
  .execute(pool)
  .await?;

  Ok(json!({
    "round_id": round.id,
    "win": win,
    "win_chance": win_chance,
    "multiplier": mult,
    "payouts": payouts,
    "pot": round.pot
  }))
}

pub async fn duel(
  pool: &SqlitePool,
  a_key: &str,
  a_name: &str,
  b_key: &str,
  b_name: &str,
  amount: i64,
) -> Result<Value> {
  if amount <= 0 {
    bail!("Miktar geçersiz");
  }
  let gs = get_game_settings(pool).await.ok();
  let duel_cfg = gs
    .as_ref()
    .map(|g| game_cfg_section(&g.config_json, "duel"))
    .unwrap_or(json!({}));
  let max_bet = duel_cfg
    .get("max_bet")
    .and_then(|v| v.as_i64())
    .unwrap_or(5000);
  if amount > max_bet {
    bail!("Maks bahis {max_bet}");
  }
  let win_chance = duel_cfg
    .get("win_chance")
    .and_then(|v| v.as_f64())
    .unwrap_or(0.5)
    .clamp(0.0, 1.0);
  let mult = duel_cfg
    .get("multiplier")
    .and_then(|v| v.as_f64())
    .unwrap_or(2.0)
    .max(1.0);

  try_spend_points(pool, a_key, amount, "duel_bet").await?;
  try_spend_points(pool, b_key, amount, "duel_bet").await?;

  let channel_id = default_channel_id(pool).await?;
  let a_wins = ((rnd_u32() as f64) / (u32::MAX as f64)) < win_chance;
  let (w_key, w_name, l_key, l_name) = if a_wins {
    (a_key, a_name, b_key, b_name)
  } else {
    (b_key, b_name, a_key, a_name)
  };
  let prize = ((amount as f64) * mult).round() as i64;
  let _ = adjust_loyalty(pool, w_key, prize, "duel_win").await;

  let id = uuid::Uuid::new_v4().to_string();
  let now = chrono_now();
  let result = json!({
    "winner_key": w_key,
    "winner_name": w_name,
    "loser_key": l_key,
    "loser_name": l_name,
    "amount": amount,
    "prize": prize,
  });
  sqlx::query(
    "INSERT INTO game_rounds(id, channel_id, game, status, pot, config_json, result_json, started_at, settled_at)
     VALUES(?,?,'duel','settled',?, '{}', ?, ?, ?)",
  )
  .bind(&id)
  .bind(&channel_id)
  .bind(amount * 2)
  .bind(result.to_string())
  .bind(now)
  .bind(now)
  .execute(pool)
  .await?;

  Ok(result)
}

pub async fn roulette(pool: &SqlitePool, user_key: Option<&str>, bet: Option<i64>, choice: Option<&str>) -> Result<Value> {
  let number = (rnd_u32() % 37) as i64;
  let color = if number == 0 {
    "green"
  } else if number % 2 == 0 {
    "black"
  } else {
    "red"
  };
  let gs = get_game_settings(pool).await.ok();
  let rcfg = gs
    .as_ref()
    .map(|g| game_cfg_section(&g.config_json, "roulette"))
    .unwrap_or(json!({}));
  let color_mult = rcfg
    .get("color_mult")
    .and_then(|v| v.as_f64())
    .unwrap_or(2.0);
  let green_mult = rcfg
    .get("green_mult")
    .and_then(|v| v.as_f64())
    .unwrap_or(14.0);
  let number_mult = rcfg
    .get("number_mult")
    .and_then(|v| v.as_f64())
    .unwrap_or(14.0);
  let max_bet = rcfg.get("max_bet").and_then(|v| v.as_i64()).unwrap_or(5000);

  let mut won = false;
  let mut payout = 0i64;
  if let (Some(uk), Some(amt), Some(ch)) = (user_key, bet, choice) {
    if amt > 0 {
      if amt > max_bet {
        bail!("Maks bahis {max_bet}");
      }
      try_spend_points(pool, uk, amt, "roulette_bet").await?;
      let hit = match ch {
        "red" | "black" | "green" => ch == color,
        n if n.parse::<i64>().ok() == Some(number) => true,
        _ => false,
      };
      if hit {
        won = true;
        let mult = if ch.parse::<i64>().is_ok() {
          number_mult
        } else if ch == "green" {
          green_mult
        } else {
          color_mult
        };
        payout = ((amt as f64) * mult).round() as i64;
        let _ = adjust_loyalty(pool, uk, payout, "roulette_win").await;
      }
    }
  }
  Ok(json!({ "number": number, "color": color, "won": won, "payout": payout }))
}

const EIGHTBALL: &[&str] = &[
  "Kesinlikle.",
  "Evet.",
  "Muhtemelen.",
  "Belirsiz, tekrar dene.",
  "Şimdi söyleyemem.",
  "Pek sayılmaz.",
  "Hayır.",
  "Kesinlikle hayır.",
];

pub async fn eightball(pool: &SqlitePool, user_key: Option<&str>, cost: Option<i64>) -> Result<Value> {
  if let (Some(uk), Some(c)) = (user_key, cost) {
    if c > 0 {
      try_spend_points(pool, uk, c, "8ball").await?;
    }
  }
  let ans = EIGHTBALL[(rnd_u32() as usize) % EIGHTBALL.len()];
  Ok(json!({ "answer": ans }))
}

// ─── Integrations / Soundboard ────────────────────────────────────────

pub async fn get_integration(pool: &SqlitePool, provider: &str) -> Result<Integration> {
  let channel_id = default_channel_id(pool).await?;
  if let Some(i) = sqlx::query_as::<_, Integration>(
    "SELECT channel_id, provider, enabled, config_json, secrets_json, updated_at
     FROM integrations WHERE channel_id = ? AND provider = ?",
  )
  .bind(&channel_id)
  .bind(provider)
  .fetch_optional(pool)
  .await?
  {
    return Ok(i);
  }
  let now = chrono_now();
  sqlx::query(
    "INSERT INTO integrations(channel_id, provider, enabled, config_json, updated_at)
     VALUES(?,?,0,'{}',?)",
  )
  .bind(&channel_id)
  .bind(provider)
  .bind(now)
  .execute(pool)
  .await?;
  Ok(Integration {
    channel_id,
    provider: provider.to_string(),
    enabled: 0,
    config_json: "{}".into(),
    secrets_json: "{}".into(),
    updated_at: now,
  })
}

pub async fn put_integration(pool: &SqlitePool, provider: &str, body: &Value) -> Result<Integration> {
  let channel_id = default_channel_id(pool).await?;
  let cur = get_integration(pool, provider).await?;
  let enabled = body
    .get("enabled")
    .and_then(|v| v.as_bool())
    .map(|b| b as i64)
    .unwrap_or(cur.enabled);
  let cfg = body
    .get("config_json")
    .cloned()
    .or_else(|| body.get("config").cloned())
    .map(|v| v.to_string())
    .unwrap_or(cur.config_json);
  let secrets = body
    .get("secrets_json")
    .cloned()
    .or_else(|| body.get("secrets").cloned())
    .map(|v| {
      if v.is_string() {
        v.as_str().unwrap_or("{}").to_string()
      } else {
        v.to_string()
      }
    })
    .unwrap_or(cur.secrets_json);
  let now = chrono_now();
  sqlx::query(
    "INSERT INTO integrations(channel_id, provider, enabled, config_json, secrets_json, updated_at)
     VALUES(?,?,?,?,?,?)
     ON CONFLICT(channel_id, provider) DO UPDATE SET
       enabled=excluded.enabled, config_json=excluded.config_json,
       secrets_json=excluded.secrets_json, updated_at=excluded.updated_at",
  )
  .bind(&channel_id)
  .bind(provider)
  .bind(enabled)
  .bind(&cfg)
  .bind(&secrets)
  .bind(now)
  .execute(pool)
  .await?;
  get_integration(pool, provider).await
}

pub async fn discord_test_webhook(pool: &SqlitePool) -> Result<Value> {
  let integ = get_integration(pool, "discord").await?;
  let cfg: Value = serde_json::from_str(&integ.config_json).unwrap_or(json!({}));
  let url = cfg
    .get("webhookUrl")
    .or_else(|| cfg.get("webhook_url"))
    .or_else(|| cfg.get("url"))
    .and_then(|v| v.as_str())
    .filter(|s| !s.is_empty())
    .context("Discord webhook URL yapılandırılmamış")?;

  let payload = json!({
    "content": "Yayındayız",
    "username": "Yayın Yönetim Aracı",
  });
  let res = reqwest::Client::new()
    .post(url)
    .json(&payload)
    .send()
    .await
    .context("Discord webhook gönderilemedi")?;
  let status = res.status().as_u16();
  if !res.status().is_success() && status != 204 {
    let t = res.text().await.unwrap_or_default();
    bail!("Discord hata {status}: {t}");
  }
  Ok(json!({ "ok": true, "status": status }))
}

pub async fn list_soundboard(pool: &SqlitePool) -> Result<Vec<SoundboardPad>> {
  let channel_id = default_channel_id(pool).await?;
  let rows = sqlx::query_as(
    "SELECT id, channel_id, name, file_path, hotkey, volume, sort_order
     FROM soundboard_pads WHERE channel_id = ? ORDER BY sort_order, name",
  )
  .bind(&channel_id)
  .fetch_all(pool)
  .await?;
  Ok(rows)
}

pub async fn upsert_soundboard(pool: &SqlitePool, body: &Value) -> Result<SoundboardPad> {
  let channel_id = default_channel_id(pool).await?;
  let id = body
    .get("id")
    .and_then(|v| v.as_str())
    .map(str::to_string)
    .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
  let name = body.get("name").and_then(|v| v.as_str()).unwrap_or("Pad");
  let file_path = body
    .get("file_path")
    .and_then(|v| v.as_str())
    .unwrap_or("");
  let hotkey = body
    .get("hotkey")
    .and_then(|v| v.as_str())
    .map(str::to_string);
  let volume = body.get("volume").and_then(|v| v.as_f64()).unwrap_or(0.8);
  let sort_order = body.get("sort_order").and_then(|v| v.as_i64()).unwrap_or(0);

  sqlx::query(
    "INSERT INTO soundboard_pads(id, channel_id, name, file_path, hotkey, volume, sort_order)
     VALUES(?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name, file_path=excluded.file_path, hotkey=excluded.hotkey,
       volume=excluded.volume, sort_order=excluded.sort_order",
  )
  .bind(&id)
  .bind(&channel_id)
  .bind(name)
  .bind(file_path)
  .bind(&hotkey)
  .bind(volume)
  .bind(sort_order)
  .execute(pool)
  .await?;

  sqlx::query_as(
    "SELECT id, channel_id, name, file_path, hotkey, volume, sort_order
     FROM soundboard_pads WHERE id = ?",
  )
  .bind(&id)
  .fetch_one(pool)
  .await
  .map_err(Into::into)
}

// ─── Remote editors ───────────────────────────────────────────────────
// Not: sha256(salt+password) — ileride argon2'ye yükseltilebilir.

fn hash_password(password: &str) -> String {
  let salt = uuid::Uuid::new_v4().to_string().replace('-', "");
  let mut hasher = Sha256::new();
  hasher.update(salt.as_bytes());
  hasher.update(password.as_bytes());
  let dig = hasher.finalize();
  let hex: String = dig.iter().map(|b| format!("{b:02x}")).collect();
  format!("{salt}${hex}")
}

fn verify_password(stored: &str, password: &str) -> bool {
  let Some((salt, expect)) = stored.split_once('$') else {
    return false;
  };
  let mut hasher = Sha256::new();
  hasher.update(salt.as_bytes());
  hasher.update(password.as_bytes());
  let dig = hasher.finalize();
  let hex: String = dig.iter().map(|b| format!("{b:02x}")).collect();
  hex == expect
}

pub async fn remote_setup(pool: &SqlitePool, username: &str, password: &str) -> Result<Value> {
  let channel_id = default_channel_id(pool).await?;
  let count: i64 = sqlx::query_scalar(
    "SELECT COUNT(*) FROM remote_users WHERE channel_id = ? AND role = 'admin'",
  )
  .bind(&channel_id)
  .fetch_one(pool)
  .await?;
  if count > 0 {
    bail!("Yönetici zaten tanımlı");
  }
  if username.trim().is_empty() || password.len() < 4 {
    bail!("Kullanıcı adı / şifre geçersiz");
  }
  let id = uuid::Uuid::new_v4().to_string();
  let now = chrono_now();
  let ph = hash_password(password);
  sqlx::query(
    "INSERT INTO remote_users(id, channel_id, username, password_hash, role, permissions_json, enabled, created_at)
     VALUES(?,?,?,?,'admin','[\"*\"]',1,?)",
  )
  .bind(&id)
  .bind(&channel_id)
  .bind(username.trim())
  .bind(&ph)
  .bind(now)
  .execute(pool)
  .await?;
  Ok(json!({ "user_id": id, "username": username.trim(), "role": "admin" }))
}

pub async fn remote_login(pool: &SqlitePool, username: &str, password: &str) -> Result<Value> {
  let channel_id = default_channel_id(pool).await?;
  let row: Option<(String, String, i64, String, String)> = sqlx::query_as(
    "SELECT id, password_hash, enabled, role, permissions_json FROM remote_users
     WHERE channel_id = ? AND username = ?",
  )
  .bind(&channel_id)
  .bind(username.trim())
  .fetch_optional(pool)
  .await?;
  let Some((uid, ph, enabled, role, perms_json)) = row else {
    bail!("Geçersiz kimlik bilgileri");
  };
  if enabled == 0 || !verify_password(&ph, password) {
    bail!("Geçersiz kimlik bilgileri");
  }
  let token = uuid::Uuid::new_v4().to_string();
  let now = chrono_now();
  let expires = now + 7 * 24 * 60 * 60 * 1000;
  sqlx::query(
    "INSERT INTO remote_sessions(token, user_id, expires_at, created_at, last_seen_at)
     VALUES(?,?,?,?,?)",
  )
  .bind(&token)
  .bind(&uid)
  .bind(expires)
  .bind(now)
  .bind(now)
  .execute(pool)
  .await?;
  let permissions: Value = serde_json::from_str(&perms_json).unwrap_or(json!([]));
  Ok(json!({
    "token": token,
    "token_type": "Bearer",
    "expires_at": expires,
    "user_id": uid,
    "username": username.trim(),
    "role": role,
    "permissions": permissions,
  }))
}

pub async fn remote_logout(pool: &SqlitePool, token: &str) -> Result<()> {
  sqlx::query("DELETE FROM remote_sessions WHERE token = ?")
    .bind(token)
    .execute(pool)
    .await?;
  Ok(())
}

pub async fn remote_auth_user(pool: &SqlitePool, token: &str) -> Result<(String, String)> {
  let info = remote_auth_full(pool, token).await?;
  Ok((info.user_id, info.username))
}

#[derive(Debug, Clone, Serialize)]
pub struct RemoteAuthInfo {
  pub user_id: String,
  pub username: String,
  pub role: String,
  pub permissions: Vec<String>,
}

pub async fn remote_auth_full(pool: &SqlitePool, token: &str) -> Result<RemoteAuthInfo> {
  let now = chrono_now();
  let row: Option<(String, String, String, String, i64)> = sqlx::query_as(
    "SELECT u.id, u.username, u.role, u.permissions_json, s.expires_at
     FROM remote_sessions s
     JOIN remote_users u ON u.id = s.user_id
     WHERE s.token = ? AND u.enabled = 1",
  )
  .bind(token)
  .fetch_optional(pool)
  .await?;
  let Some((uid, uname, role, perms_json, exp)) = row else {
    bail!("Yetkisiz");
  };
  if exp < now {
    let _ = sqlx::query("DELETE FROM remote_sessions WHERE token = ?")
      .bind(token)
      .execute(pool)
      .await;
    bail!("Oturum süresi doldu");
  }
  let _ = sqlx::query("UPDATE remote_sessions SET last_seen_at = ? WHERE token = ?")
    .bind(now)
    .bind(token)
    .execute(pool)
    .await;
  let permissions: Vec<String> = serde_json::from_str(&perms_json).unwrap_or_default();
  Ok(RemoteAuthInfo {
    user_id: uid,
    username: uname,
    role,
    permissions,
  })
}

pub fn remote_has_perm(info: &RemoteAuthInfo, need: &str) -> bool {
  if info.role == "admin" {
    return true;
  }
  info
    .permissions
    .iter()
    .any(|p| p == "*" || p == need || p.starts_with(&format!("{need}:")))
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct RemoteUserRow {
  pub id: String,
  pub channel_id: String,
  pub username: String,
  pub role: String,
  pub permissions_json: String,
  pub enabled: i64,
  pub created_at: i64,
}

pub async fn list_remote_users(pool: &SqlitePool) -> Result<Vec<RemoteUserRow>> {
  let channel_id = default_channel_id(pool).await?;
  let rows = sqlx::query_as(
    "SELECT id, channel_id, username, role, permissions_json, enabled, created_at
     FROM remote_users WHERE channel_id = ? ORDER BY created_at",
  )
  .bind(&channel_id)
  .fetch_all(pool)
  .await?;
  Ok(rows)
}

pub async fn upsert_remote_user(pool: &SqlitePool, body: &Value) -> Result<RemoteUserRow> {
  let channel_id = default_channel_id(pool).await?;
  let username = body
    .get("username")
    .and_then(|v| v.as_str())
    .unwrap_or("")
    .trim();
  if username.is_empty() {
    bail!("Kullanıcı adı gerekli");
  }
  let role = body
    .get("role")
    .and_then(|v| v.as_str())
    .unwrap_or("moderator");
  if role == "admin" {
    // ikinci admin yalnızca açıkça
  }
  let perms = body
    .get("permissions")
    .cloned()
    .or_else(|| body.get("permissions_json").cloned())
    .unwrap_or_else(|| {
      json!([
        "dashboard",
        "commands",
        "alerts",
        "chat",
        "loyalty",
        "shop",
        "obs"
      ])
    });
  let perms_json = if perms.is_string() {
    perms.as_str().unwrap_or("[]").to_string()
  } else {
    perms.to_string()
  };
  let enabled = body
    .get("enabled")
    .and_then(|v| v.as_bool())
    .map(|b| b as i64)
    .unwrap_or(1);
  let id = body
    .get("id")
    .and_then(|v| v.as_str())
    .map(str::to_string)
    .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
  let now = chrono_now();

  let password = body.get("password").and_then(|v| v.as_str());
  if let Some(existing) = sqlx::query_as::<_, RemoteUserRow>(
    "SELECT id, channel_id, username, role, permissions_json, enabled, created_at
     FROM remote_users WHERE id = ?",
  )
  .bind(&id)
  .fetch_optional(pool)
  .await?
  {
    if let Some(pw) = password {
      if pw.len() < 4 {
        bail!("Şifre en az 4 karakter");
      }
      let ph = hash_password(pw);
      sqlx::query(
        "UPDATE remote_users SET username=?, role=?, permissions_json=?, enabled=?, password_hash=?
         WHERE id=?",
      )
      .bind(username)
      .bind(role)
      .bind(&perms_json)
      .bind(enabled)
      .bind(&ph)
      .bind(&id)
      .execute(pool)
      .await?;
    } else {
      sqlx::query(
        "UPDATE remote_users SET username=?, role=?, permissions_json=?, enabled=? WHERE id=?",
      )
      .bind(username)
      .bind(role)
      .bind(&perms_json)
      .bind(enabled)
      .bind(&id)
      .execute(pool)
      .await?;
    }
    let _ = existing;
  } else {
    let pw = password.unwrap_or("");
    if pw.len() < 4 {
      bail!("Yeni kullanıcı için şifre en az 4 karakter");
    }
    let ph = hash_password(pw);
    sqlx::query(
      "INSERT INTO remote_users(id, channel_id, username, password_hash, role, permissions_json, enabled, created_at)
       VALUES(?,?,?,?,?,?,?,?)",
    )
    .bind(&id)
    .bind(&channel_id)
    .bind(username)
    .bind(&ph)
    .bind(role)
    .bind(&perms_json)
    .bind(enabled)
    .bind(now)
    .execute(pool)
    .await?;
  }

  sqlx::query_as(
    "SELECT id, channel_id, username, role, permissions_json, enabled, created_at
     FROM remote_users WHERE id = ?",
  )
  .bind(&id)
  .fetch_one(pool)
  .await
  .map_err(Into::into)
}

pub async fn delete_remote_user(pool: &SqlitePool, id: &str) -> Result<bool> {
  let channel_id = default_channel_id(pool).await?;
  // son admin silinmesin
  let role: Option<String> =
    sqlx::query_scalar("SELECT role FROM remote_users WHERE id = ? AND channel_id = ?")
      .bind(id)
      .bind(&channel_id)
      .fetch_optional(pool)
      .await?;
  if role.as_deref() == Some("admin") {
    let admins: i64 = sqlx::query_scalar(
      "SELECT COUNT(*) FROM remote_users WHERE channel_id = ? AND role = 'admin'",
    )
    .bind(&channel_id)
    .fetch_one(pool)
    .await?;
    if admins <= 1 {
      bail!("Son yönetici silinemez");
    }
  }
  let r = sqlx::query("DELETE FROM remote_users WHERE id = ? AND channel_id = ?")
    .bind(id)
    .bind(&channel_id)
    .execute(pool)
    .await?;
  Ok(r.rows_affected() > 0)
}

#[cfg(test)]
mod flag_tests {
  use super::*;

  #[test]
  fn json_flag_accepts_camel_int_and_bool() {
    assert_eq!(
      json_flag(
        &json!({"replyToKick": true}),
        &["reply_to_kick", "replyToKick"],
        0
      ),
      1
    );
    assert_eq!(
      json_flag(
        &json!({"reply_to_kick": 0}),
        &["reply_to_kick", "replyToKick"],
        1
      ),
      0
    );
    assert_eq!(json_flag(&json!({"enabled": "true"}), &["enabled"], 0), 1);
    assert_eq!(json_flag(&json!({}), &["enabled"], 1), 1);
  }

  #[test]
  fn default_command_seeds_include_ping() {
    let names: Vec<&str> = default_bot_command_seeds()
      .iter()
      .map(|(n, _, _)| *n)
      .collect();
    assert!(names.contains(&"ping"));
    assert!(names.contains(&"commands"));
    assert!(names.contains(&"sosyal"));
  }
}
