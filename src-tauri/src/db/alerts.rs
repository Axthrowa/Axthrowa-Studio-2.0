//! Alert types + variants CRUD (SQLite).
//! Medya yolları `media::paths` ile mutlak path olarak saklanır;
//! oynatma OBS için HTTP Range stream üzerinden yapılır.

use anyhow::{bail, Context, Result};
use serde_json::{json, Value};
use sqlx::SqlitePool;

use crate::db::default_channel_id;
use crate::db::models::{AlertType, AlertVariant};
use crate::media::paths;

const ALERT_SELECT: &str = "SELECT id, channel_id, enabled, label, template, duration_ms, volume,
            media_path, sound_path, font_family, font_size, text_color, accent_color,
            anim_in, anim_out, tts_enabled, tts_lang, min_amount, layout, sort_order,
            custom_html, custom_css, tts_rate, tts_volume
     FROM alert_types";

const VARIANT_SELECT: &str = "SELECT id, channel_id, type_id, name, min_amount, max_amount, enabled, template,
            media_path, sound_path, duration_ms, volume, anim_in, layout,
            custom_html, custom_css, sort_order, extras_json
     FROM alert_variants";

pub async fn list_alert_types(pool: &SqlitePool) -> Result<Vec<AlertType>> {
  let channel_id = default_channel_id(pool).await?;
  let rows = sqlx::query_as(&format!(
    "{ALERT_SELECT} WHERE channel_id = ? ORDER BY sort_order, id"
  ))
  .bind(&channel_id)
  .fetch_all(pool)
  .await?;
  Ok(rows)
}

pub async fn get_alert_type(pool: &SqlitePool, id: &str) -> Result<Option<AlertType>> {
  let channel_id = default_channel_id(pool).await?;
  let row = sqlx::query_as(&format!(
    "{ALERT_SELECT} WHERE channel_id = ? AND id = ?"
  ))
  .bind(&channel_id)
  .bind(id)
  .fetch_optional(pool)
  .await?;
  Ok(row)
}

/// Tek alert oluştur / güncelle. `app_root` + `http_base` medya path normalize için.
pub async fn upsert_alert_type(
  pool: &SqlitePool,
  body: &Value,
  app_root: &std::path::Path,
  http_base: &str,
) -> Result<AlertType> {
  let channel_id = default_channel_id(pool).await?;
  let id = body
    .get("id")
    .and_then(|v| v.as_str())
    .filter(|s| !s.is_empty())
    .map(str::to_string)
    .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

  let enabled = body.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true) as i64;
  let label = body
    .get("label")
    .and_then(|v| v.as_str())
    .unwrap_or(id.as_str())
    .to_string();
  let template = body
    .get("template")
    .or_else(|| body.get("text"))
    .and_then(|v| v.as_str())
    .unwrap_or("{user}")
    .to_string();
  let duration_ms = body
    .get("duration_ms")
    .and_then(|v| v.as_i64())
    .or_else(|| {
      body
        .get("durationSec")
        .and_then(|v| v.as_i64())
        .map(|s| s * 1000)
    })
    .unwrap_or(6000);
  let volume = body.get("volume").and_then(|v| v.as_f64()).unwrap_or(0.8);

  let existing = get_alert_type(pool, &id).await?;

  let media_path = match body
    .get("media_path")
    .or_else(|| body.get("imageUrl"))
  {
    None => existing.as_ref().and_then(|e| e.media_path.clone()),
    Some(Value::Null) => None,
    Some(v) => paths::opt_normalize(v.as_str(), app_root, http_base)?,
  };
  let sound_path = match body
    .get("sound_path")
    .or_else(|| body.get("soundUrl"))
  {
    None => existing.as_ref().and_then(|e| e.sound_path.clone()),
    Some(Value::Null) => None,
    Some(v) => paths::opt_normalize(v.as_str(), app_root, http_base)?,
  };

  let font_family = body
    .get("font_family")
    .and_then(|v| v.as_str())
    .map(str::to_string);
  let font_size = body.get("font_size").and_then(|v| v.as_i64()).unwrap_or(32);
  let text_color = body
    .get("text_color")
    .or_else(|| body.get("textColor"))
    .and_then(|v| v.as_str())
    .unwrap_or("#FFFFFF");
  let accent_color = body
    .get("accent_color")
    .or_else(|| body.get("accentColor"))
    .and_then(|v| v.as_str())
    .unwrap_or("#3ECFCF");
  let anim_in = body
    .get("anim_in")
    .or_else(|| body.get("animation"))
    .and_then(|v| v.as_str())
    .unwrap_or("fade");
  let anim_out = body
    .get("anim_out")
    .and_then(|v| v.as_str())
    .unwrap_or("fade");
  let tts_enabled = body
    .get("tts_enabled")
    .and_then(|v| v.as_bool())
    .unwrap_or(false) as i64;
  let tts_lang = body
    .get("tts_lang")
    .or_else(|| body.get("ttsLang"))
    .and_then(|v| v.as_str())
    .unwrap_or("tr-TR");
  let min_amount = body
    .get("min_amount")
    .and_then(|v| v.as_f64())
    .unwrap_or(0.0);
  let layout = body
    .get("layout")
    .and_then(|v| v.as_str())
    .unwrap_or("banner");
  let sort_order = body
    .get("sort_order")
    .and_then(|v| v.as_i64())
    .unwrap_or(0);
  let custom_html = body
    .get("custom_html")
    .and_then(|v| v.as_str())
    .map(str::to_string);
  let custom_css = body
    .get("custom_css")
    .and_then(|v| v.as_str())
    .map(str::to_string);
  let tts_rate = body.get("tts_rate").and_then(|v| v.as_f64()).unwrap_or(1.0);
  let tts_volume = body
    .get("tts_volume")
    .and_then(|v| v.as_f64())
    .unwrap_or(1.0);

  sqlx::query(
    "INSERT INTO alert_types(
       id, channel_id, enabled, label, template, duration_ms, volume,
       media_path, sound_path, font_family, font_size, text_color, accent_color,
       anim_in, anim_out, tts_enabled, tts_lang, min_amount, layout, sort_order,
       custom_html, custom_css, tts_rate, tts_volume
     ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(channel_id, id) DO UPDATE SET
       enabled=excluded.enabled, label=excluded.label, template=excluded.template,
       duration_ms=excluded.duration_ms, volume=excluded.volume,
       media_path=excluded.media_path, sound_path=excluded.sound_path,
       font_family=excluded.font_family, font_size=excluded.font_size,
       text_color=excluded.text_color, accent_color=excluded.accent_color,
       anim_in=excluded.anim_in, anim_out=excluded.anim_out,
       tts_enabled=excluded.tts_enabled, tts_lang=excluded.tts_lang,
       min_amount=excluded.min_amount, layout=excluded.layout,
       sort_order=excluded.sort_order, custom_html=excluded.custom_html,
       custom_css=excluded.custom_css, tts_rate=excluded.tts_rate,
       tts_volume=excluded.tts_volume",
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
  .bind(tts_rate)
  .bind(tts_volume)
  .execute(pool)
  .await?;

  get_alert_type(pool, &id)
    .await?
    .context("alert yazıldı ama okunamadı")
}

pub async fn delete_alert_type(pool: &SqlitePool, id: &str) -> Result<bool> {
  let channel_id = default_channel_id(pool).await?;
  // varyantları temizle
  sqlx::query("DELETE FROM alert_variants WHERE channel_id = ? AND type_id = ?")
    .bind(&channel_id)
    .bind(id)
    .execute(pool)
    .await?;
  let r = sqlx::query("DELETE FROM alert_types WHERE channel_id = ? AND id = ?")
    .bind(&channel_id)
    .bind(id)
    .execute(pool)
    .await?;
  Ok(r.rows_affected() > 0)
}

pub async fn list_alert_variants(pool: &SqlitePool) -> Result<Vec<AlertVariant>> {
  let channel_id = default_channel_id(pool).await?;
  let rows = sqlx::query_as(&format!(
    "{VARIANT_SELECT} WHERE channel_id = ?
     ORDER BY type_id, sort_order, min_amount DESC, id"
  ))
  .bind(&channel_id)
  .fetch_all(pool)
  .await?;
  Ok(rows)
}

pub async fn list_variants_for_type(
  pool: &SqlitePool,
  type_id: &str,
) -> Result<Vec<AlertVariant>> {
  let channel_id = default_channel_id(pool).await?;
  let rows = sqlx::query_as(&format!(
    "{VARIANT_SELECT} WHERE channel_id = ? AND type_id = ?
     ORDER BY sort_order, min_amount DESC, id"
  ))
  .bind(&channel_id)
  .bind(type_id)
  .fetch_all(pool)
  .await?;
  Ok(rows)
}

pub async fn upsert_alert_variant(
  pool: &SqlitePool,
  body: &Value,
  app_root: &std::path::Path,
  http_base: &str,
) -> Result<AlertVariant> {
  let channel_id = default_channel_id(pool).await?;
  let id = body
    .get("id")
    .and_then(|v| v.as_str())
    .map(str::to_string)
    .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
  let type_id = body
    .get("type_id")
    .and_then(|v| v.as_str())
    .unwrap_or("tip")
    .to_string();

  // parent alert var mı?
  if get_alert_type(pool, &type_id).await?.is_none() {
    bail!("alert tipi yok: {type_id}");
  }

  let name = body
    .get("name")
    .and_then(|v| v.as_str())
    .unwrap_or("Varyant")
    .to_string();
  let min_amount = body
    .get("min_amount")
    .and_then(|v| v.as_f64())
    .unwrap_or(0.0);
  let max_amount = body.get("max_amount").and_then(|v| {
    if v.is_null() {
      None
    } else {
      v.as_f64()
    }
  });
  let enabled = body.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true) as i64;
  let template = body
    .get("template")
    .and_then(|v| v.as_str())
    .unwrap_or("")
    .to_string();
  let existing: Option<AlertVariant> = sqlx::query_as(&format!("{VARIANT_SELECT} WHERE id = ?"))
    .bind(&id)
    .fetch_optional(pool)
    .await?;

  let media_path = match body.get("media_path") {
    None => existing.as_ref().and_then(|e| e.media_path.clone()),
    Some(Value::Null) => None,
    Some(v) => paths::opt_normalize(v.as_str(), app_root, http_base)?,
  };
  let sound_path = match body.get("sound_path") {
    None => existing.as_ref().and_then(|e| e.sound_path.clone()),
    Some(Value::Null) => None,
    Some(v) => paths::opt_normalize(v.as_str(), app_root, http_base)?,
  };
  let duration_ms = body
    .get("duration_ms")
    .and_then(|v| v.as_i64())
    .unwrap_or(6000);
  let volume = body.get("volume").and_then(|v| v.as_f64()).unwrap_or(0.8);
  let anim_in = body
    .get("anim_in")
    .and_then(|v| v.as_str())
    .map(str::to_string);
  let layout = body
    .get("layout")
    .and_then(|v| v.as_str())
    .map(str::to_string);
  let custom_html = body
    .get("custom_html")
    .and_then(|v| v.as_str())
    .map(str::to_string);
  let custom_css = body
    .get("custom_css")
    .and_then(|v| v.as_str())
    .map(str::to_string);
  let sort_order = body
    .get("sort_order")
    .and_then(|v| v.as_i64())
    .unwrap_or(0);
  let extras_json = body
    .get("extras_json")
    .cloned()
    .or_else(|| body.get("extras").cloned())
    .map(|v| {
      if v.is_string() {
        v.as_str().unwrap_or("{}").to_string()
      } else {
        v.to_string()
      }
    })
    .unwrap_or_else(|| "{}".into());

  sqlx::query(
    "INSERT INTO alert_variants(
       id, channel_id, type_id, name, min_amount, max_amount, enabled, template,
       media_path, sound_path, duration_ms, volume, anim_in, layout,
       custom_html, custom_css, sort_order, extras_json
     ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       type_id=excluded.type_id, name=excluded.name, min_amount=excluded.min_amount,
       max_amount=excluded.max_amount, enabled=excluded.enabled, template=excluded.template,
       media_path=excluded.media_path, sound_path=excluded.sound_path,
       duration_ms=excluded.duration_ms, volume=excluded.volume,
       anim_in=excluded.anim_in, layout=excluded.layout,
       custom_html=excluded.custom_html, custom_css=excluded.custom_css,
       sort_order=excluded.sort_order, extras_json=excluded.extras_json,
       channel_id=excluded.channel_id",
  )
  .bind(&id)
  .bind(&channel_id)
  .bind(&type_id)
  .bind(&name)
  .bind(min_amount)
  .bind(max_amount)
  .bind(enabled)
  .bind(&template)
  .bind(&media_path)
  .bind(&sound_path)
  .bind(duration_ms)
  .bind(volume)
  .bind(&anim_in)
  .bind(&layout)
  .bind(&custom_html)
  .bind(&custom_css)
  .bind(sort_order)
  .bind(&extras_json)
  .execute(pool)
  .await?;

  sqlx::query_as(&format!("{VARIANT_SELECT} WHERE id = ?"))
    .bind(&id)
    .fetch_one(pool)
    .await
    .map_err(Into::into)
}

pub async fn delete_alert_variant(pool: &SqlitePool, id: &str) -> Result<bool> {
  let r = sqlx::query("DELETE FROM alert_variants WHERE id = ?")
    .bind(id)
    .execute(pool)
    .await?;
  Ok(r.rows_affected() > 0)
}

/// Toplu upsert (HTTP API uyumu) — medya path normalize eder.
pub async fn upsert_alert_variants(
  pool: &SqlitePool,
  items: &[Value],
  app_root: &std::path::Path,
  http_base: &str,
) -> Result<Vec<AlertVariant>> {
  for a in items {
    upsert_alert_variant(pool, a, app_root, http_base).await?;
  }
  list_alert_variants(pool).await
}

/// Alert + stream/asset URL zenginleştirmesi (panel için).
pub fn enrich_alert_media(http_base: &str, alert: &AlertType) -> Value {
  let mut v = serde_json::to_value(alert).unwrap_or(json!({}));
  if let Some(obj) = v.as_object_mut() {
    if let Some(p) = alert.media_path.as_deref() {
      if let Ok(m) = paths::playable(http_base, p) {
        obj.insert("media".into(), json!(m));
      }
    }
    if let Some(p) = alert.sound_path.as_deref() {
      if let Ok(m) = paths::playable(http_base, p) {
        obj.insert("sound".into(), json!(m));
      }
    }
  }
  v
}

pub fn enrich_variant_media(http_base: &str, variant: &AlertVariant) -> Value {
  let mut v = serde_json::to_value(variant).unwrap_or(json!({}));
  if let Some(obj) = v.as_object_mut() {
    if let Some(p) = variant.media_path.as_deref() {
      if let Ok(m) = paths::playable(http_base, p) {
        obj.insert("media".into(), json!(m));
      }
    }
    if let Some(p) = variant.sound_path.as_deref() {
      if let Ok(m) = paths::playable(http_base, p) {
        obj.insert("sound".into(), json!(m));
      }
    }
  }
  v
}
