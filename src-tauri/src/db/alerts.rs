//! Alert types + variants CRUD (SQLite).
//! Medya yolları `media::paths` ile mutlak path olarak saklanır;
//! oynatma OBS için HTTP Range stream üzerinden yapılır.

use anyhow::{bail, Result};
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
