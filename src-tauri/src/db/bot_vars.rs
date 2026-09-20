//! Sayaçlar ve kalıcı değişkenler — BotRix komut değişkenlerinin deposu.
//!
//! - **Sayaç** (`bot_counters`): sayısal, komut başına ya da adlandırılmış.
//!   `$(count)` `$(count +1)` `$(getcounter ad)` `$(setcounter ad değer)`
//!   ve sohbetten `!editcounter ad değer`.
//! - **Değişken** (`bot_variables`): metin, iki kapsamda.
//!   `user` → izleyici başına (`$(uservar)`), `global` → kanal geneli
//!   (`$(globalvar)`).
//!
//! Değerler metin olarak saklanıyor; JSON yardımcıları (`$(json ...)`) da
//! aynı alanı okuyup yazıyor. BotRix de aynı yaklaşımı kullanıyor.

use anyhow::Result;
use sqlx::SqlitePool;

use super::default_channel_id;

/* ------------------------------------------------------------- sayaçlar */

/// Sayacın güncel değeri. Yoksa 0 — BotRix de olmayan sayaca 0 diyor.
pub async fn get_counter(pool: &SqlitePool, name: &str) -> Result<f64> {
  let channel_id = default_channel_id(pool).await?;
  let row: Option<(f64,)> =
    sqlx::query_as("SELECT value FROM bot_counters WHERE channel_id = ? AND name = ?")
      .bind(&channel_id)
      .bind(name.trim().to_ascii_lowercase())
      .fetch_optional(pool)
      .await?;
  Ok(row.map(|r| r.0).unwrap_or(0.0))
}

/// Sayacı doğrudan atar ve yazılan değeri döndürür.
pub async fn set_counter(pool: &SqlitePool, name: &str, value: f64) -> Result<f64> {
  let channel_id = default_channel_id(pool).await?;
  sqlx::query(
    "INSERT INTO bot_counters(channel_id, name, value) VALUES(?,?,?)
     ON CONFLICT(channel_id, name) DO UPDATE SET value = excluded.value",
  )
  .bind(&channel_id)
  .bind(name.trim().to_ascii_lowercase())
  .bind(value)
  .execute(pool)
  .await?;
  Ok(value)
}

/// Sayacı `delta` kadar değiştirir, yeni değeri döndürür.
pub async fn bump_counter(pool: &SqlitePool, name: &str, delta: f64) -> Result<f64> {
  let current = get_counter(pool, name).await?;
  set_counter(pool, name, current + delta).await
}

/* ---------------------------------------------------------- değişkenler */

/// `user` kapsamında sahip anahtarı; `global` kapsamında sahip yok.
fn owner_for(scope: &str, owner: &str) -> String {
  if scope == "user" {
    owner.trim_start_matches('@').to_ascii_lowercase()
  } else {
    String::new()
  }
}

pub async fn get_var(pool: &SqlitePool, scope: &str, owner: &str, key: &str) -> Result<Option<String>> {
  let channel_id = default_channel_id(pool).await?;
  let row: Option<(String,)> = sqlx::query_as(
    "SELECT value FROM bot_variables
     WHERE channel_id = ? AND scope = ? AND owner = ? AND key = ?",
  )
  .bind(&channel_id)
  .bind(scope)
  .bind(owner_for(scope, owner))
  .bind(key.trim().to_ascii_lowercase())
  .fetch_optional(pool)
  .await?;
  Ok(row.map(|r| r.0))
}

pub async fn set_var(
  pool: &SqlitePool,
  scope: &str,
  owner: &str,
  key: &str,
  value: &str,
) -> Result<String> {
  let channel_id = default_channel_id(pool).await?;
  sqlx::query(
    "INSERT INTO bot_variables(channel_id, scope, owner, key, value) VALUES(?,?,?,?,?)
     ON CONFLICT(channel_id, scope, owner, key) DO UPDATE SET value = excluded.value",
  )
  .bind(&channel_id)
  .bind(scope)
  .bind(owner_for(scope, owner))
  .bind(key.trim().to_ascii_lowercase())
  .bind(value)
  .execute(pool)
  .await?;
  Ok(value.to_string())
}

/// `$(uservarlist)` / `$(globalvarlist)` — anahtarlar alfabetik, virgüllü.
pub async fn list_vars(pool: &SqlitePool, scope: &str, owner: &str) -> Result<Vec<String>> {
  let channel_id = default_channel_id(pool).await?;
  let rows: Vec<(String,)> = sqlx::query_as(
    "SELECT key FROM bot_variables
     WHERE channel_id = ? AND scope = ? AND owner = ? ORDER BY key",
  )
  .bind(&channel_id)
  .bind(scope)
  .bind(owner_for(scope, owner))
  .fetch_all(pool)
  .await?;
  Ok(rows.into_iter().map(|r| r.0).collect())
}

#[cfg(test)]
mod tests {
  use super::*;

  async fn kur() -> SqlitePool {
    let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
    for sql in [
      "CREATE TABLE app_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)",
      "CREATE TABLE channels (id TEXT PRIMARY KEY NOT NULL, slug TEXT NOT NULL,
         display_name TEXT NOT NULL, platforms_json TEXT NOT NULL DEFAULT '{}',
         created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)",
      "CREATE TABLE bot_counters (channel_id TEXT NOT NULL, name TEXT NOT NULL,
         value REAL NOT NULL DEFAULT 0, PRIMARY KEY (channel_id, name))",
      "CREATE TABLE bot_variables (channel_id TEXT NOT NULL, scope TEXT NOT NULL,
         owner TEXT NOT NULL DEFAULT '', key TEXT NOT NULL, value TEXT NOT NULL DEFAULT '',
         PRIMARY KEY (channel_id, scope, owner, key))",
    ] {
      sqlx::query(sql).execute(&pool).await.unwrap();
    }
    pool
  }

  #[tokio::test]
  async fn olmayan_sayac_sifir() {
    let pool = kur().await;
    assert_eq!(get_counter(&pool, "olum").await.unwrap(), 0.0);
  }

  #[tokio::test]
  async fn sayac_artar_azalir_ondalik_tutar() {
    let pool = kur().await;
    assert_eq!(bump_counter(&pool, "olum", 1.0).await.unwrap(), 1.0);
    assert_eq!(bump_counter(&pool, "olum", 9.0).await.unwrap(), 10.0);
    assert_eq!(bump_counter(&pool, "olum", -4.0).await.unwrap(), 6.0);
    // BotRix `!editcounter dollars 10.5` örneğindeki gibi ondalık
    assert_eq!(set_counter(&pool, "dolar", 10.5).await.unwrap(), 10.5);
    assert_eq!(get_counter(&pool, "dolar").await.unwrap(), 10.5);
  }

  #[tokio::test]
  async fn sayac_adi_buyuk_kucuk_harf_ayirmaz() {
    let pool = kur().await;
    set_counter(&pool, "Olum", 3.0).await.unwrap();
    assert_eq!(get_counter(&pool, "OLUM").await.unwrap(), 3.0);
  }

  #[tokio::test]
  async fn kullanici_degiskeni_kisiye_ozel() {
    let pool = kur().await;
    set_var(&pool, "user", "@ahmet", "rank", "gold").await.unwrap();
    set_var(&pool, "user", "ayse", "rank", "silver").await.unwrap();
    assert_eq!(get_var(&pool, "user", "ahmet", "rank").await.unwrap().as_deref(), Some("gold"));
    assert_eq!(get_var(&pool, "user", "@ayse", "rank").await.unwrap().as_deref(), Some("silver"));
    assert_eq!(get_var(&pool, "user", "mehmet", "rank").await.unwrap(), None);
  }

  #[tokio::test]
  async fn global_degisken_sahipsiz() {
    let pool = kur().await;
    // Kapsam global olduğunda sahip yok sayılır: kim yazarsa yazsın aynı kayıt
    set_var(&pool, "global", "ahmet", "durum", "canli").await.unwrap();
    assert_eq!(get_var(&pool, "global", "bambaska", "durum").await.unwrap().as_deref(), Some("canli"));
  }

  #[tokio::test]
  async fn liste_alfabetik_ve_kapsama_ozel() {
    let pool = kur().await;
    set_var(&pool, "user", "ahmet", "wins", "7").await.unwrap();
    set_var(&pool, "user", "ahmet", "rank", "gold").await.unwrap();
    set_var(&pool, "global", "", "mode", "x").await.unwrap();
    assert_eq!(list_vars(&pool, "user", "ahmet").await.unwrap(), vec!["rank", "wins"]);
    assert_eq!(list_vars(&pool, "global", "").await.unwrap(), vec!["mode"]);
    assert!(list_vars(&pool, "user", "ayse").await.unwrap().is_empty());
  }
}
