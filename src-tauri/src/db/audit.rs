//! Denetim günlüğü (`audit_log`, migrasyon 001) — kim, ne, ne zaman.
//!
//! Tablo baştan vardı ama hiç yazılmıyordu. Control Plane eylemleri (çoklu yayın, uyarı kuyruğu, hızlı eylemler)
//! buraya düşer. Ayrıntıya asla sır yazılmaz (anahtar, token, parola): çağıran yalnız kimlik ve durum verir.

use anyhow::Result;
use serde::Serialize;
use serde_json::Value;
use sqlx::SqlitePool;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct AuditRow {
  pub id: i64,
  pub actor: String,
  pub action: String,
  pub detail_json: String,
  pub ts: i64,
}

pub async fn record(pool: &SqlitePool, actor: &str, action: &str, detail: &Value) -> Result<()> {
  let channel_id = super::default_channel_id(pool).await?;
  sqlx::query("INSERT INTO audit_log (channel_id, actor, action, detail_json, ts) VALUES (?, ?, ?, ?, ?)")
    .bind(channel_id)
    .bind(actor.chars().take(80).collect::<String>())
    .bind(action.chars().take(80).collect::<String>())
    .bind(detail.to_string())
    .bind(crate::db::chrono_now())
    .execute(pool)
    .await?;
  Ok(())
}

pub async fn recent(pool: &SqlitePool, limit: i64) -> Result<Vec<AuditRow>> {
  let rows = sqlx::query_as::<_, AuditRow>(
    "SELECT id, actor, action, detail_json, ts FROM audit_log ORDER BY id DESC LIMIT ?",
  )
  .bind(limit.clamp(1, 500))
  .fetch_all(pool)
  .await?;
  Ok(rows)
}
