//! Yerel Botaxt SQLite (sqlx) — pool, migrasyon, smartBot import.

pub mod alerts;
pub mod audit;
pub mod bot_vars;
pub mod botaxt_api;
pub mod loyalty;
pub mod models;
pub mod profile;
pub mod smartbot_import;
pub mod widgets;

use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions};
use sqlx::SqlitePool;

use crate::settings::AppSettings;

pub fn db_file(data_dir: &Path) -> PathBuf {
  // Yeni düzen: data_dir/botaxt.db · eski: data_dir/app-data/botaxt.db
  let path = data_dir.join("botaxt.db");
  let nested = data_dir.join("app-data").join("botaxt.db");
  let legacy = data_dir.join("botrix.db");
  let nested_legacy = data_dir.join("app-data").join("botrix.db");
  if !path.exists() {
    if nested.exists() {
      return nested;
    }
    if legacy.exists() {
      let _ = std::fs::rename(&legacy, &path);
    } else if nested_legacy.exists() {
      let _ = std::fs::rename(&nested_legacy, &path);
    }
  }
  path
}

/// Tokio context içinde gerçek bağlantı (AppState::new / block_on).
pub async fn open_connected(data_dir: &Path) -> Result<SqlitePool> {
  let path = db_file(data_dir);
  if let Some(parent) = path.parent() {
    std::fs::create_dir_all(parent).context("data klasörü")?;
  }
  // URL değil doğrudan yol: portable'da canonicalize `\\?\C:\…` verir, URL'de bozulup bellek DB'ye düşüyordu
  let opts = SqliteConnectOptions::new()
    .filename(&path)
    .create_if_missing(true)
    .journal_mode(SqliteJournalMode::Wal)
    .foreign_keys(true);
  SqlitePoolOptions::new()
    .max_connections(5)
    .connect_with(opts)
    .await
    .context("sqlite connect")
}

/// Migrasyon + varsayılan kanal + smartBot otomatik import.
pub async fn init(pool: &SqlitePool, settings: &AppSettings) -> Result<()> {
  sqlx::migrate!("./migrations")
    .run(pool)
    .await
    .context("sqlx migrate")?;

  ensure_default_channel(pool).await?;
  smartbot_import::import_if_needed(pool, settings).await?;
  Ok(())
}

pub async fn meta_get(pool: &SqlitePool, key: &str) -> Result<Option<String>> {
  let row: Option<(String,)> = sqlx::query_as("SELECT value FROM app_meta WHERE key = ?")
    .bind(key)
    .fetch_optional(pool)
    .await?;
  Ok(row.map(|r| r.0))
}

pub async fn meta_set(pool: &SqlitePool, key: &str, value: &str) -> Result<()> {
  sqlx::query(
    "INSERT INTO app_meta(key, value) VALUES(?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  )
  .bind(key)
  .bind(value)
  .execute(pool)
  .await?;
  Ok(())
}

pub async fn ensure_default_channel(pool: &SqlitePool) -> Result<String> {
  if let Some(id) = meta_get(pool, "default_channel_id").await? {
    return Ok(id);
  }
  let id = uuid::Uuid::new_v4().to_string();
  let now = chrono_now();
  sqlx::query(
    "INSERT INTO channels(id, slug, display_name, platforms_json, created_at, updated_at)
     VALUES(?, 'default', 'Yayıncı', '{}', ?, ?)",
  )
  .bind(&id)
  .bind(now)
  .bind(now)
  .execute(pool)
  .await?;
  meta_set(pool, "default_channel_id", &id).await?;
  Ok(id)
}

pub fn chrono_now() -> i64 {
  std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map(|d| d.as_millis() as i64)
    .unwrap_or(0)
}

pub async fn default_channel_id(pool: &SqlitePool) -> Result<String> {
  ensure_default_channel(pool).await
}

#[cfg(test)]
mod tests {
  // portable data yolu canonicalize edilir (Windows: \?\C:\...); DB yine dosyada açılmalı
  #[tokio::test]
  async fn opens_file_db_in_canonical_dir() {
    let dir = std::env::temp_dir().join(format!("yya-db-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    let canon = std::fs::canonicalize(&dir).unwrap();
    let pool = super::open_connected(&canon).await.unwrap();
    pool.close().await;
    assert!(canon.join("botaxt.db").exists());
    let _ = std::fs::remove_dir_all(&dir);
  }

  // Kayıtlı DB'ler LF sağlamasıyla; CRLF çekimden derlenirse migrasyon "değişti" sayılır ve init düşer
  #[test]
  fn migrations_are_lf() {
    for m in sqlx::migrate!("./migrations").iter() {
      assert!(!m.sql.contains('\r'), "{} CRLF içeriyor", m.description);
    }
  }
}
