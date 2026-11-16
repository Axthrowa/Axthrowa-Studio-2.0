//! Bot modülü 2–8 — SQLite sorgu yardımcıları.

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
  let smart = panel.get("sohbetBot");
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


// ─── Widgets / Goals ──────────────────────────────────────────────────
// Enterprise katalog + seed: `crate::db::widgets`




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
    studio_log!("[bot] varsayılan komut eklendi: {inserted}");
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
  sqlx::query("INSERT INTO bot_settings(channel_id, bot_name, reply_delay_ms) VALUES(?, 'AxBoT', 0)")
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



// ─── Loyalty ──────────────────────────────────────────────────────────



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


/// game_settings.config_json içinden heist/roulette/duel alt objesi.
pub fn game_cfg_section(config_json: &str, game: &str) -> Value {
  serde_json::from_str::<Value>(config_json)
    .ok()
    .and_then(|v| v.get(game).cloned())
    .unwrap_or(json!({}))
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
    "username": "AxthrowA Studio",
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



// ─── Remote editors ───────────────────────────────────────────────────

fn hash_password(password: &str) -> String {
  use argon2::password_hash::{PasswordHasher, SaltString};
  let salt = SaltString::encode_b64(uuid::Uuid::new_v4().as_bytes()).expect("16 bayt geçerli tuzdur");
  argon2::Argon2::default()
    .hash_password(password.as_bytes(), &salt)
    .expect("argon2 varsayılan ayarlarla özet üretir")
    .to_string()
}

fn verify_password(stored: &str, password: &str) -> bool {
  use argon2::password_hash::{PasswordHash, PasswordVerifier};
  if stored.starts_with("$argon2") {
    return PasswordHash::new(stored)
      .is_ok_and(|h| argon2::Argon2::default().verify_password(password.as_bytes(), &h).is_ok());
  }
  // Eski kayıt: salt$sha256; ilk başarılı girişte argon2'ye yükseltilir
  let Some((salt, expect)) = stored.split_once('$') else {
    return false;
  };
  let mut hasher = Sha256::new();
  hasher.update(salt.as_bytes());
  hasher.update(password.as_bytes());
  let dig = hasher.finalize();
  let hex: String = dig.iter().map(|b| format!("{b:02x}")).collect();
  // Sabit süreli karşılaştırma: zamanlama farkından özet tahmin edilmesin
  hex.len() == expect.len() && hex.bytes().zip(expect.bytes()).fold(0u8, |acc, (a, b)| acc | (a ^ b)) == 0
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
  // En az 8 karakter: uzak (LAN) girişe açık hesap; 4 karakter ağdan kaba kuvvetle bulunabiliyordu
  if username.trim().is_empty() || password.chars().count() < 8 {
    bail!("Kullanıcı adı boş olamaz, şifre en az 8 karakter olmalı");
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
    // Aynı süre harcansın: yanıt süresi kullanıcı adının var olup olmadığını ele vermesin
    let _ = hash_password(password);
    bail!("Geçersiz kimlik bilgileri");
  };
  if enabled == 0 || !verify_password(&ph, password) {
    bail!("Geçersiz kimlik bilgileri");
  }
  if !ph.starts_with("$argon2") {
    sqlx::query("UPDATE remote_users SET password_hash = ? WHERE id = ?")
      .bind(hash_password(password))
      .bind(&uid)
      .execute(pool)
      .await?;
  }
  let token = uuid::Uuid::new_v4().to_string();
  let now = chrono_now();
  let expires = now + 7 * 24 * 60 * 60 * 1000;
  sqlx::query(
    "INSERT INTO remote_sessions(token, user_id, expires_at, created_at, last_seen_at)
     VALUES(?,?,?,?,?)",
  )
  .bind(oturum_anahtari(&token))
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

/// T8: oturum anahtarı veritabanında düz değil `h:` + SHA-256 olarak durur; veritabanı dosyasını okuyan
/// biri geçerli bir anahtar elde edemez. Anahtarlar 122 bit rastgele olduğu için tuzsuz özet yeterli.
pub fn oturum_anahtari(token: &str) -> String {
  let ozet = Sha256::digest(token.as_bytes());
  let mut s = String::with_capacity(66);
  s.push_str("h:");
  for b in ozet {
    s.push_str(&format!("{b:02x}"));
  }
  s
}

pub async fn remote_logout(pool: &SqlitePool, token: &str) -> Result<()> {
  // Eski düz kayıt da silinsin (özetli kaydın kendisi anahtar yerine geçmez)
  sqlx::query("DELETE FROM remote_sessions WHERE token = ? OR (token = ? AND token NOT LIKE 'h:%')")
    .bind(oturum_anahtari(token))
    .bind(token)
    .execute(pool)
    .await?;
  Ok(())
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
  let anahtar = oturum_anahtari(token);
  // Güncellemeden önce açılmış oturumlar düz durur: ilk kullanımda özete çevrilir, kimse çıkış yapmak zorunda kalmaz
  let row: Option<(String, String, String, String, i64, String)> = sqlx::query_as(
    "SELECT u.id, u.username, u.role, u.permissions_json, s.expires_at, s.token
     FROM remote_sessions s
     JOIN remote_users u ON u.id = s.user_id
     WHERE (s.token = ? OR (s.token = ? AND s.token NOT LIKE 'h:%')) AND u.enabled = 1",
  )
  .bind(&anahtar)
  .bind(token)
  .fetch_optional(pool)
  .await?;
  let Some((uid, uname, role, perms_json, exp, kayitli)) = row else {
    bail!("Yetkisiz");
  };
  if exp < now {
    let _ = sqlx::query("DELETE FROM remote_sessions WHERE token = ?")
      .bind(&kayitli)
      .execute(pool)
      .await;
    bail!("Oturum süresi doldu");
  }
  let _ = sqlx::query("UPDATE remote_sessions SET last_seen_at = ?, token = ? WHERE token = ?")
    .bind(now)
    .bind(&anahtar)
    .bind(&kayitli)
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

// ─── T8: eşleştirilmiş cihazlar ───────────────────────────────────────
//
// Her cihaz kendi `remote_users` satırıdır (rol `cihaz`, yönetici olamaz, parolasıyla girilemez) ve tek oturumu vardır.
// Cihazı silmek satırı ve oturumu birlikte siler: iptal anında geçerli.

/// Cihaza verilebilecek izinler. Ayar yazma, çıkış hedefleri (yayın anahtarı), kullanıcılar ve denetim günlüğü yok.
pub const CIHAZ_IZINLERI: &[&str] = &[
  "broadcast.read",
  "scene.switch",
  "scene.edit",
  "audio.control",
  "alerts.control",
  "music.control",
  "broadcast.replay",
  "broadcast.record",
  "broadcast.stream",
  "voice.control",
  "actions.read",
];
pub const CIHAZ_OTURUM_GUN: i64 = 90;

pub fn cihaz_izinlerini_suz(ham: &Value) -> Vec<String> {
  let mut l: Vec<String> = ham
    .as_array()
    .map(|a| a.iter().filter_map(|v| v.as_str()).filter(|p| CIHAZ_IZINLERI.contains(p)).map(String::from).collect())
    .unwrap_or_default();
  l.sort();
  l.dedup();
  l
}

pub async fn cihaz_ekle(pool: &SqlitePool, ad: &str, izinler: &[String]) -> Result<Value> {
  let channel_id = default_channel_id(pool).await?;
  let uid = uuid::Uuid::new_v4().to_string();
  let now = chrono_now();
  // Kullanıcı adı benzersiz ve elle girişe kapalı: parola rastgele, kimse bilmez
  let kullanici = format!("cihaz:{}:{}", ad, &uid[..8]);
  sqlx::query(
    "INSERT INTO remote_users(id, channel_id, username, password_hash, role, permissions_json, enabled, created_at)
     VALUES(?,?,?,?,?,?,1,?)",
  )
  .bind(&uid)
  .bind(&channel_id)
  .bind(&kullanici)
  .bind(hash_password(&uuid::Uuid::new_v4().to_string()))
  .bind("cihaz")
  .bind(serde_json::to_string(izinler)?)
  .bind(now)
  .execute(pool)
  .await?;
  let token = format!("{}{}", uuid::Uuid::new_v4().simple(), uuid::Uuid::new_v4().simple());
  let expires = now + CIHAZ_OTURUM_GUN * 24 * 60 * 60 * 1000;
  sqlx::query("INSERT INTO remote_sessions(token, user_id, expires_at, created_at, last_seen_at) VALUES(?,?,?,?,?)")
    .bind(oturum_anahtari(&token))
    .bind(&uid)
    .bind(expires)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await?;
  Ok(json!({ "token": token, "token_type": "Bearer", "expires_at": expires, "cihaz": ad, "izinler": izinler }))
}

/// Cihaz listesi: anahtar asla dönmez
pub async fn cihazlar(pool: &SqlitePool) -> Result<Vec<Value>> {
  let rows: Vec<(String, String, String, i64, Option<i64>, Option<i64>)> = sqlx::query_as(
    "SELECT u.id, u.username, u.permissions_json, u.created_at, MAX(s.last_seen_at), MAX(s.expires_at)
     FROM remote_users u LEFT JOIN remote_sessions s ON s.user_id = u.id
     WHERE u.role = 'cihaz' GROUP BY u.id ORDER BY u.created_at DESC",
  )
  .fetch_all(pool)
  .await?;
  Ok(rows
    .into_iter()
    .map(|(id, ad, izin, olusma, son, bitis)| {
      let ad = ad.strip_prefix("cihaz:").and_then(|a| a.rsplit_once(':')).map(|(a, _)| a.to_string()).unwrap_or(ad);
      json!({ "id": id, "ad": ad, "izinler": serde_json::from_str::<Value>(&izin).unwrap_or(json!([])), "olusturma": olusma, "sonGorulme": son, "bitis": bitis })
    })
    .collect())
}

pub async fn cihaz_sil(pool: &SqlitePool, id: &str) -> Result<bool> {
  sqlx::query("DELETE FROM remote_sessions WHERE user_id = ?").bind(id).execute(pool).await?;
  let r = sqlx::query("DELETE FROM remote_users WHERE id = ? AND role = 'cihaz'").bind(id).execute(pool).await?;
  Ok(r.rows_affected() > 0)
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
      // Şifre değişti: eski oturumlar (sızmış olabilir) geçersiz
      sqlx::query("DELETE FROM remote_sessions WHERE user_id = ?")
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

#[cfg(test)]
mod oturum_testleri {
  use super::*;

  #[tokio::test]
  async fn oturum_anahtari_ozet_olarak_saklanir_eski_duz_kayit_yukseltilir() {
    // Bellek veritabanı bağlantı başına ayrı: tek bağlantı
    let pool = sqlx::sqlite::SqlitePoolOptions::new().max_connections(1).connect("sqlite::memory:").await.unwrap();
    sqlx::migrate!("./migrations").run(&pool).await.unwrap();
    crate::db::ensure_default_channel(&pool).await.unwrap();
    remote_setup(&pool, "yonetici", "parola-123456").await.unwrap();

    let g = remote_login(&pool, "yonetici", "parola-123456").await.unwrap();
    let token = g["token"].as_str().unwrap().to_string();
    let kayitlar: Vec<(String,)> = sqlx::query_as("SELECT token FROM remote_sessions").fetch_all(&pool).await.unwrap();
    assert!(kayitlar.iter().all(|(t,)| t.starts_with("h:") && *t != token), "düz anahtar saklanmaz");
    assert_eq!(remote_auth_full(&pool, &token).await.unwrap().username, "yonetici");
    assert!(remote_auth_full(&pool, &oturum_anahtari(&token)).await.is_err(), "özetin kendisi anahtar yerine geçmez");

    // Güncellemeden önce açılmış düz oturum: ilk kullanımda geçer ve özete çevrilir
    sqlx::query("UPDATE remote_sessions SET token = ?").bind(&token).execute(&pool).await.unwrap();
    assert!(remote_auth_full(&pool, &token).await.is_ok());
    let (t,): (String,) = sqlx::query_as("SELECT token FROM remote_sessions").fetch_one(&pool).await.unwrap();
    assert_eq!(t, oturum_anahtari(&token));

    remote_logout(&pool, &token).await.unwrap();
    assert!(remote_auth_full(&pool, &token).await.is_err());
  }

  #[tokio::test]
  async fn sifre_degisince_eski_oturum_kapanir() {
    let pool = sqlx::sqlite::SqlitePoolOptions::new().max_connections(1).connect("sqlite::memory:").await.unwrap();
    sqlx::migrate!("./migrations").run(&pool).await.unwrap();
    crate::db::ensure_default_channel(&pool).await.unwrap();
    let u = upsert_remote_user(&pool, &json!({"username": "mod1", "password": "eski-sifre"})).await.unwrap();
    let token = remote_login(&pool, "mod1", "eski-sifre").await.unwrap()["token"].as_str().unwrap().to_string();
    assert!(remote_auth_full(&pool, &token).await.is_ok());

    // Şifresiz güncelleme oturumu düşürmez
    upsert_remote_user(&pool, &json!({"id": u.id, "username": "mod1"})).await.unwrap();
    assert!(remote_auth_full(&pool, &token).await.is_ok());

    upsert_remote_user(&pool, &json!({"id": u.id, "username": "mod1", "password": "yeni-sifre"})).await.unwrap();
    assert!(remote_auth_full(&pool, &token).await.is_err(), "şifre sıfırlanınca eski anahtar geçmez");
  }
}
