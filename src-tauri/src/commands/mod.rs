//! Tauri invoke komutları — uyarı listeleri + medya adresleri.

use serde_json::{json, Value};
use tauri::State;

use crate::db::alerts;
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
  let stored = paths::normalize_for_storage(&path, &state.data_dir, &state.base_url())
    .map_err(map_err)?;
  paths::playable(&state.base_url(), &stored).map_err(map_err)
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

// ─── Widgets ──────────────────────────────────────────────────────────

