//! Tauri invoke komutları — Alerts / Widgets CRUD + medya.

use serde_json::{json, Value};
use tauri::State;

use crate::db::{alerts, widgets};
use crate::media::paths;
use crate::AppState;

fn map_err(e: impl std::fmt::Display) -> String {
  e.to_string()
}

// ─── Medya ────────────────────────────────────────────────────────────

/// Mutlak path → OBS stream URL + asset:// önizleme URL.
#[tauri::command]
pub fn media_playable_urls(
  state: State<'_, AppState>,
  path: String,
) -> Result<paths::PlayableMedia, String> {
  let stored = paths::normalize_for_storage(&path, &state.root, &state.base_url())
    .map_err(map_err)?;
  paths::playable(&state.base_url(), &stored).map_err(map_err)
}

/// Dosyayı app-data/media/{kind}/ altına kopyalar; stream+asset URL döner.
#[tauri::command]
pub fn media_import_file(
  state: State<'_, AppState>,
  source_path: String,
  kind: Option<String>,
) -> Result<paths::PlayableMedia, String> {
  let kind = kind.unwrap_or_else(|| "alerts".into());
  let src = std::path::PathBuf::from(source_path.trim());
  let dest = paths::import_into_library(&state.data_dir, &kind, &src).map_err(map_err)?;
  paths::playable(&state.base_url(), &dest.to_string_lossy()).map_err(map_err)
}

// ─── Alerts ───────────────────────────────────────────────────────────

#[tauri::command]
pub async fn alerts_list(state: State<'_, AppState>) -> Result<Value, String> {
  let base = state.base_url();
  let rows = alerts::list_alert_types(&state.db)
    .await
    .map_err(map_err)?;
  let enriched: Vec<Value> = rows
    .iter()
    .map(|a| alerts::enrich_alert_media(&base, a))
    .collect();
  Ok(json!({ "alerts": enriched }))
}

#[tauri::command]
pub async fn alerts_get(state: State<'_, AppState>, id: String) -> Result<Value, String> {
  let base = state.base_url();
  let row = alerts::get_alert_type(&state.db, &id)
    .await
    .map_err(map_err)?
    .ok_or_else(|| "alert bulunamadı".to_string())?;
  Ok(alerts::enrich_alert_media(&base, &row))
}

#[tauri::command]
pub async fn alerts_upsert(state: State<'_, AppState>, alert: Value) -> Result<Value, String> {
  let base = state.base_url();
  let row = alerts::upsert_alert_type(&state.db, &alert, &state.root, &base)
    .await
    .map_err(map_err)?;
  state.broadcast_json(&json!({ "type": "alerts_updated", "id": row.id }));
  Ok(alerts::enrich_alert_media(&base, &row))
}

#[tauri::command]
pub async fn alerts_delete(state: State<'_, AppState>, id: String) -> Result<Value, String> {
  let ok = alerts::delete_alert_type(&state.db, &id)
    .await
    .map_err(map_err)?;
  if ok {
    state.broadcast_json(&json!({ "type": "alerts_updated", "deleted": id }));
  }
  Ok(json!({ "deleted": ok }))
}

#[tauri::command]
pub async fn alert_variants_list(
  state: State<'_, AppState>,
  type_id: Option<String>,
) -> Result<Value, String> {
  let base = state.base_url();
  let rows = if let Some(tid) = type_id {
    alerts::list_variants_for_type(&state.db, &tid)
      .await
      .map_err(map_err)?
  } else {
    alerts::list_alert_variants(&state.db)
      .await
      .map_err(map_err)?
  };
  let enriched: Vec<Value> = rows
    .iter()
    .map(|v| alerts::enrich_variant_media(&base, v))
    .collect();
  Ok(json!({ "variants": enriched }))
}

#[tauri::command]
pub async fn alert_variants_upsert(
  state: State<'_, AppState>,
  variant: Value,
) -> Result<Value, String> {
  let base = state.base_url();
  let row = alerts::upsert_alert_variant(&state.db, &variant, &state.root, &base)
    .await
    .map_err(map_err)?;
  state.broadcast_json(&json!({
    "type": "alert_variants_updated",
    "id": row.id,
    "type_id": row.type_id,
  }));
  Ok(alerts::enrich_variant_media(&base, &row))
}

#[tauri::command]
pub async fn alert_variants_delete(
  state: State<'_, AppState>,
  id: String,
) -> Result<Value, String> {
  let ok = alerts::delete_alert_variant(&state.db, &id)
    .await
    .map_err(map_err)?;
  Ok(json!({ "deleted": ok }))
}

// ─── Widgets ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn widgets_list(state: State<'_, AppState>) -> Result<Value, String> {
  let base = state.base_url();
  let rows = widgets::list_widgets(&state.db)
    .await
    .map_err(map_err)?;
  let enriched: Vec<Value> = rows
    .iter()
    .map(|w| widgets::enrich_widget(&base, w))
    .collect();
  Ok(json!({ "widgets": enriched }))
}

#[tauri::command]
pub async fn widgets_get(state: State<'_, AppState>, id: String) -> Result<Value, String> {
  let base = state.base_url();
  let row = widgets::get_widget(&state.db, &id)
    .await
    .map_err(map_err)?
    .ok_or_else(|| "widget bulunamadı".to_string())?;
  Ok(widgets::enrich_widget(&base, &row))
}

#[tauri::command]
pub async fn widgets_upsert(state: State<'_, AppState>, widget: Value) -> Result<Value, String> {
  let base = state.base_url();
  let row = widgets::upsert_widget(&state.db, &widget, &state.root, &base)
    .await
    .map_err(map_err)?;
  let cfg: Value = serde_json::from_str(&row.config_json).unwrap_or(json!({}));
  state.broadcast_json(&json!({
    "type": "config_updated",
    "id": row.id,
    "kind": row.kind,
    "config": cfg,
  }));
  state.broadcast_json(&json!({
    "type": "widgets_updated",
    "id": row.id,
    "kind": row.kind,
    "config": cfg,
  }));
  Ok(widgets::enrich_widget(&base, &row))
}

#[tauri::command]
pub async fn widgets_patch_config(
  state: State<'_, AppState>,
  id: String,
  config: Value,
) -> Result<Value, String> {
  let base = state.base_url();
  let row = widgets::patch_widget_config(&state.db, &id, &config, &state.root, &base)
    .await
    .map_err(map_err)?;
  let cfg: Value = serde_json::from_str(&row.config_json).unwrap_or(json!({}));
  state.broadcast_json(&json!({
    "type": "config_updated",
    "id": row.id,
    "kind": row.kind,
    "config": cfg,
  }));
  state.broadcast_json(&json!({
    "type": "widgets_updated",
    "id": row.id,
    "kind": row.kind,
    "config": cfg,
  }));
  Ok(widgets::enrich_widget(&base, &row))
}

#[tauri::command]
pub async fn widgets_delete(state: State<'_, AppState>, id: String) -> Result<Value, String> {
  let ok = widgets::delete_widget(&state.db, &id)
    .await
    .map_err(map_err)?;
  if ok {
    state.broadcast_json(&json!({ "type": "widgets_updated", "deleted": id }));
  }
  Ok(json!({ "deleted": ok }))
}

#[tauri::command]
pub async fn widgets_obs_url(state: State<'_, AppState>, id: String) -> Result<Value, String> {
  let base = state.base_url();
  let row = widgets::get_widget(&state.db, &id)
    .await
    .map_err(map_err)?
    .ok_or_else(|| "widget bulunamadı".to_string())?;
  Ok(json!({
    "id": row.id,
    "obs_url": widgets::obs_browser_url(&base, &row),
    "obs_path": row.obs_path,
  }))
}
