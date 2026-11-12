//! Sadakat izleme süresi tick — aralık dolunca puan ekler.
//! `ensure_loyalty_user`: ledger/sales/strike/bet yazmadan önce FK için zorunlu.

use anyhow::Result;
use serde_json::json;
use sqlx::SqlitePool;

use crate::db::bot_api::get_loyalty_settings;
use crate::db::chrono_now;
use crate::db::default_channel_id;
use crate::db::models::LoyaltyUser;

/// Ledger / sales / strikes / bets yazmadan önce çağır (FK CASCADE bütünlüğü).
pub async fn ensure_loyalty_user(
  pool: &SqlitePool,
  channel_id: &str,
  user_key: &str,
  user_name: Option<&str>,
) -> Result<()> {
  let platform = user_key.split(':').next().unwrap_or("local");
  let name = user_name
    .filter(|s| !s.trim().is_empty())
    .unwrap_or_else(|| user_key.split(':').nth(1).unwrap_or(user_key));
  let now = chrono_now();
  sqlx::query(
    "INSERT INTO loyalty_users(channel_id, user_key, user_name, platform, points, xp, messages, watch_sec, last_seen)
     VALUES(?,?,?,?,0,0,0,0,?)
     ON CONFLICT(channel_id, user_key) DO UPDATE SET
       user_name = excluded.user_name,
       last_seen = excluded.last_seen",
  )
  .bind(channel_id)
  .bind(user_key)
  .bind(name)
  .bind(platform)
  .bind(now)
  .execute(pool)
  .await?;
  Ok(())
}

/// !top / !leaderboard — points indeksi kullanır.
pub async fn leaderboard_by_points(
  pool: &SqlitePool,
  limit: i64,
) -> Result<Vec<LoyaltyUser>> {
  let channel_id = default_channel_id(pool).await?;
  let rows = sqlx::query_as(
    "SELECT channel_id, user_key, user_name, platform, points, xp, rank_id,
            messages, watch_sec, last_seen
     FROM loyalty_users WHERE channel_id = ?
     ORDER BY points DESC, xp DESC LIMIT ?",
  )
  .bind(&channel_id)
  .bind(limit.clamp(1, 100))
  .fetch_all(pool)
  .await?;
  Ok(rows)
}

/// XP sıralaması — idx_loyalty_users_xp.
pub async fn leaderboard_by_xp(pool: &SqlitePool, limit: i64) -> Result<Vec<LoyaltyUser>> {
  let channel_id = default_channel_id(pool).await?;
  let rows = sqlx::query_as(
    "SELECT channel_id, user_key, user_name, platform, points, xp, rank_id,
            messages, watch_sec, last_seen
     FROM loyalty_users WHERE channel_id = ?
     ORDER BY xp DESC, points DESC LIMIT ?",
  )
  .bind(&channel_id)
  .bind(limit.clamp(1, 100))
  .fetch_all(pool)
  .await?;
  Ok(rows)
}

/// Aktif izleyicilere (`last_seen` yakın) aralık puanı verir; `last_tick_at` günceller.
pub async fn loyalty_tick(pool: &SqlitePool) -> Result<serde_json::Value> {
  let channel_id = default_channel_id(pool).await?;
  let settings = get_loyalty_settings(pool).await?;
  let extras_raw: Option<(String,)> = sqlx::query_as(
    "SELECT extras_json FROM bot_settings WHERE channel_id = ?",
  )
  .bind(&channel_id)
  .fetch_optional(pool)
  .await?;
  let watch_override = extras_raw.and_then(|(raw,)| {
    let extras = crate::db::bot_api::parse_json_object(&raw);
    let chat = extras.get("chatbot_extras").cloned().unwrap_or(json!({}));
    let chat = if chat.is_string() {
      crate::db::bot_api::parse_json_object(chat.as_str().unwrap_or(""))
    } else {
      chat
    };
    chat
      .pointer("/watchtime_points/enabled")
      .and_then(|v| v.as_bool())
  });
  let tick_on = watch_override.unwrap_or(settings.tick_enabled != 0);

  if !tick_on {
    return Ok(json!({
      "ticked": false,
      "reason": "disabled",
      "users_updated": 0,
    }));
  }

  let now = chrono_now();
  let interval_ms = settings.interval_sec.max(1) * 1000;
  let due = match settings.last_tick_at {
    None => true,
    Some(last) => now.saturating_sub(last) >= interval_ms,
  };

  if !due {
    return Ok(json!({
      "ticked": false,
      "reason": "interval",
      "users_updated": 0,
      "last_tick_at": settings.last_tick_at,
      "interval_sec": settings.interval_sec,
    }));
  }

  let recent_cutoff = now.saturating_sub(interval_ms.saturating_mul(2));
  let ignored: Vec<String> =
    serde_json::from_str(&settings.ignored_users_json).unwrap_or_default();

  let users: Vec<(String,)> = sqlx::query_as(
    "SELECT user_key FROM loyalty_users
     WHERE channel_id = ? AND last_seen >= ?",
  )
  .bind(&channel_id)
  .bind(recent_cutoff)
  .fetch_all(pool)
  .await?;

  let points = settings.points_per_interval;
  let watch_add = settings.interval_sec.max(0);
  let mut updated: i64 = 0;

  for (user_key,) in users {
    let lower = user_key.to_lowercase();
    if ignored
      .iter()
      .any(|u| u.eq_ignore_ascii_case(&user_key) || u.eq_ignore_ascii_case(&lower))
    {
      continue;
    }
    let res = sqlx::query(
      "UPDATE loyalty_users
       SET points = points + ?,
           xp = xp + ?,
           watch_sec = watch_sec + ?
       WHERE channel_id = ? AND user_key = ?",
    )
    .bind(points)
    .bind(points)
    .bind(watch_add)
    .bind(&channel_id)
    .bind(&user_key)
    .execute(pool)
    .await?;
    if res.rows_affected() > 0 {
      sqlx::query(
        "INSERT INTO points_ledger(channel_id, user_key, delta, reason, ts) VALUES(?,?,?,?,?)",
      )
      .bind(&channel_id)
      .bind(&user_key)
      .bind(points)
      .bind("tick")
      .bind(now)
      .execute(pool)
      .await?;
      updated += 1;
    }
  }

  sqlx::query("UPDATE loyalty_settings SET last_tick_at = ? WHERE channel_id = ?")
    .bind(now)
    .bind(&channel_id)
    .execute(pool)
    .await?;

  Ok(json!({
    "ticked": true,
    "users_updated": updated,
    "points_each": points,
    "last_tick_at": now,
  }))
}

/// Bot tick döngüsü için interval (sn).
/* ------------------------------------------------- puan yazma (BotRix denkliği) */

/// Kullanıcı adından `loyalty_users` satırını bulmak için ortak eşleşme.
///
/// `user_key` platform öneki taşıyor (`kick:ahmet`), `user_name` ise görünen
/// ad. Komutlarda kullanıcı `@ahmet` yazdığı için ikisine de bakıyoruz.
const MATCH_USER: &str =
  "(lower(user_name) = lower(?) OR lower(user_key) = lower(?) OR lower(user_key) LIKE ?)";

fn like_key(user: &str) -> String {
  format!("%:{}", user.trim_start_matches('@').to_ascii_lowercase())
}

/// Bir kullanıcının puanını `delta` kadar değiştirir ve yeni toplamı döndürür.
///
/// Kullanıcı yoksa `None`. Negatif `delta` düşer; toplam sıfırın altına inmez
/// (BotRix de negatif puanı 0 olarak saklıyor).
pub async fn add_points(pool: &SqlitePool, user: &str, delta: i64) -> Result<Option<i64>> {
  let channel_id = default_channel_id(pool).await?;
  let name = user.trim_start_matches('@');
  let sql = format!(
    "UPDATE loyalty_users SET points = MAX(0, points + ?)
     WHERE channel_id = ? AND {MATCH_USER}"
  );
  let affected = sqlx::query(&sql)
    .bind(delta)
    .bind(&channel_id)
    .bind(name)
    .bind(name)
    .bind(like_key(name))
    .execute(pool)
    .await?
    .rows_affected();
  if affected == 0 {
    return Ok(None);
  }
  get_points(pool, name).await
}

/// Puanı doğrudan belirli bir değere ayarlar. Negatif değer 0 olur.
pub async fn set_points(pool: &SqlitePool, user: &str, value: i64) -> Result<Option<i64>> {
  let channel_id = default_channel_id(pool).await?;
  let name = user.trim_start_matches('@');
  let sql = format!(
    "UPDATE loyalty_users SET points = ? WHERE channel_id = ? AND {MATCH_USER}"
  );
  let affected = sqlx::query(&sql)
    .bind(value.max(0))
    .bind(&channel_id)
    .bind(name)
    .bind(name)
    .bind(like_key(name))
    .execute(pool)
    .await?
    .rows_affected();
  if affected == 0 {
    return Ok(None);
  }
  get_points(pool, name).await
}

/// `!points add all N` — sistemdeki herkese puan ekler, etkilenen satır sayısı.
pub async fn add_points_all(pool: &SqlitePool, delta: i64) -> Result<u64> {
  let channel_id = default_channel_id(pool).await?;
  let affected = sqlx::query(
    "UPDATE loyalty_users SET points = MAX(0, points + ?) WHERE channel_id = ?",
  )
  .bind(delta)
  .bind(&channel_id)
  .execute(pool)
  .await?
  .rows_affected();
  Ok(affected)
}

/// Tek kullanıcının güncel puanı.
pub async fn get_points(pool: &SqlitePool, user: &str) -> Result<Option<i64>> {
  let channel_id = default_channel_id(pool).await?;
  let name = user.trim_start_matches('@');
  let sql = format!("SELECT points FROM loyalty_users WHERE channel_id = ? AND {MATCH_USER}");
  let row: Option<(i64,)> = sqlx::query_as(&sql)
    .bind(&channel_id)
    .bind(name)
    .bind(name)
    .bind(like_key(name))
    .fetch_optional(pool)
    .await?;
  Ok(row.map(|r| r.0))
}

#[cfg(test)]
mod puan_testleri {
  use super::*;

  /// Yardımcılar `default_channel_id` üzerinden çalıştığı için `channels` ve
  /// `app_meta` tabloları da gerekiyor.
  async fn kur() -> SqlitePool {
    let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
    for sql in [
      "CREATE TABLE app_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)",
      "CREATE TABLE channels (id TEXT PRIMARY KEY NOT NULL, slug TEXT NOT NULL,
         display_name TEXT NOT NULL, platforms_json TEXT NOT NULL DEFAULT '{}',
         created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)",
      "CREATE TABLE loyalty_users (channel_id TEXT NOT NULL, user_key TEXT NOT NULL,
         user_name TEXT NOT NULL, platform TEXT NOT NULL, points INTEGER NOT NULL DEFAULT 0,
         xp INTEGER NOT NULL DEFAULT 0, rank_id TEXT, messages INTEGER NOT NULL DEFAULT 0,
         watch_sec INTEGER NOT NULL DEFAULT 0, last_seen INTEGER NOT NULL DEFAULT 0)",
    ] {
      sqlx::query(sql).execute(&pool).await.unwrap();
    }
    pool
  }

  async fn ekle(pool: &SqlitePool, key: &str, name: &str, points: i64) {
    let ch = default_channel_id(pool).await.unwrap();
    sqlx::query(
      "INSERT INTO loyalty_users(channel_id, user_key, user_name, platform, points)
       VALUES(?,?,?,'kick',?)",
    )
    .bind(ch)
    .bind(key)
    .bind(name)
    .bind(points)
    .execute(pool)
    .await
    .unwrap();
  }

  #[tokio::test]
  async fn puan_ekler_ve_yeni_toplami_dondurur() {
    let pool = kur().await;
    ekle(&pool, "kick:ahmet", "Ahmet", 50).await;
    assert_eq!(add_points(&pool, "Ahmet", 25).await.unwrap(), Some(75));
    // @ ile de bulunmalı — komutlarda kullanıcı @ad yazıyor
    assert_eq!(add_points(&pool, "@ahmet", 5).await.unwrap(), Some(80));
  }

  #[tokio::test]
  async fn puan_sifirin_altina_inmez() {
    let pool = kur().await;
    ekle(&pool, "kick:ayse", "Ayse", 10).await;
    assert_eq!(add_points(&pool, "Ayse", -100).await.unwrap(), Some(0));
  }

  #[tokio::test]
  async fn bilinmeyen_kullanici_none_doner() {
    let pool = kur().await;
    ekle(&pool, "kick:ahmet", "Ahmet", 50).await;
    assert_eq!(add_points(&pool, "kimse", 10).await.unwrap(), None);
    assert_eq!(get_points(&pool, "kimse").await.unwrap(), None);
  }

  #[tokio::test]
  async fn set_points_dogrudan_atar_negatifi_sifirlar() {
    let pool = kur().await;
    ekle(&pool, "kick:ahmet", "Ahmet", 50).await;
    assert_eq!(set_points(&pool, "Ahmet", 500).await.unwrap(), Some(500));
    assert_eq!(set_points(&pool, "Ahmet", -3).await.unwrap(), Some(0));
  }

  #[tokio::test]
  async fn herkese_ekleme_tum_satirlari_gunceller() {
    let pool = kur().await;
    ekle(&pool, "kick:a", "A", 10).await;
    ekle(&pool, "kick:b", "B", 20).await;
    assert_eq!(add_points_all(&pool, 5).await.unwrap(), 2);
    assert_eq!(get_points(&pool, "A").await.unwrap(), Some(15));
    assert_eq!(get_points(&pool, "B").await.unwrap(), Some(25));
  }

  #[tokio::test]
  async fn user_key_uzerinden_de_bulur() {
    let pool = kur().await;
    // Görünen ad farklı yazılmış olsa bile platform anahtarı eşleşmeli
    ekle(&pool, "kick:mehmet", "MehmetOyun", 0).await;
    assert_eq!(add_points(&pool, "mehmet", 7).await.unwrap(), Some(7));
  }
}
