//! Zamanlayıcılar — `bot_timers` satırlarını periyodik olarak sohbete yazar.
//!
//! Tablo, CRUD ve panel arayüzü zaten vardı ama satırları çalıştıran bir şey
//! yoktu: zamanlayıcı kaydediliyor, hiç mesaj atmıyordu. Burası o eksik parça.
//!
//! ## Kural (Nightbot / BotRix ile aynı)
//! Bir zamanlayıcı ancak **iki koşul birden** sağlanınca yazar:
//! 1. Son gönderiminden bu yana `interval_sec` saniye geçmiş,
//! 2. Son gönderiminden bu yana en az `min_chat_lines` sohbet satırı akmış.
//!
//! İkinci koşul, kimsenin yazmadığı bir sohbete botun tek başına konuşmasını
//! engelliyor.
//!
//! ## Sohbet satırı sayımı
//! Her mesajda tabloya yazmak, yoğun sohbette saniyede onlarca disk yazımı
//! demekti. Bunun yerine bellekte tek bir sayaç tutuluyor; tick her çalıştığında
//! aradaki fark tüm etkin zamanlayıcılara tek `UPDATE` ile ekleniyor.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;

use anyhow::Result;
use sqlx::SqlitePool;

use crate::db::chrono_now;
use crate::db::models::BotTimer;
use crate::AppState;

use super::integrations::ChatInbound;

/// Uygulama açıldığından beri akan sohbet satırı sayısı.
static CHAT_LINES: AtomicU64 = AtomicU64::new(0);

/// Tick aralığı. Zamanlayıcı çözünürlüğü bu kadar; 10 sn, 5 dakikalık bir
/// aralıkta gözle fark edilmez ama boşuna sorgu da attırmaz.
const TICK_SEC: u64 = 10;

/// Pipeline her gerçek sohbet mesajında çağırır.
pub fn bump_chat_line() {
  CHAT_LINES.fetch_add(1, Ordering::Relaxed);
}

/// Zamanlayıcı döngüsü — `spawn_bot_runtime` içinden bir kez başlatılır.
pub async fn timer_tick_loop(state: AppState) {
  // Açılışta hemen yazmasın: uygulama yeni açıldıysa sohbet de yeni bağlanıyor.
  tokio::time::sleep(Duration::from_secs(20)).await;
  let mut seen_lines = CHAT_LINES.load(Ordering::Relaxed);
  let state = Arc::new(state);
  loop {
    tokio::time::sleep(Duration::from_secs(TICK_SEC)).await;
    let now_lines = CHAT_LINES.load(Ordering::Relaxed);
    let delta = now_lines.saturating_sub(seen_lines);
    seen_lines = now_lines;
    if let Err(e) = tick_once(&state, delta as i64).await {
      yya_warn!("[bot/timers] tick hata: {e:#}");
    }
  }
}

async fn tick_once(state: &Arc<AppState>, new_lines: i64) -> Result<()> {
  if new_lines > 0 {
    sqlx::query("UPDATE bot_timers SET lines_since = lines_since + ? WHERE enabled = 1")
      .bind(new_lines)
      .execute(&state.db)
      .await?;
  }

  let due = due_timers(&state.db, chrono_now()).await?;
  for timer in due {
    announce(state, &timer.message).await;
    sqlx::query("UPDATE bot_timers SET last_fired_at = ?, lines_since = 0 WHERE id = ?")
      .bind(chrono_now())
      .bind(&timer.id)
      .execute(&state.db)
      .await?;
    yya_log!("[bot/timers] «{}» gönderildi", timer.name);
    // Aynı tick'te birden çok zamanlayıcı dolduysa arka arkaya basmasın.
    tokio::time::sleep(Duration::from_millis(1200)).await;
  }
  Ok(())
}

/// Zamanı ve satır eşiği dolmuş, mesajı boş olmayan etkin zamanlayıcılar.
///
/// `last_fired_at` boşsa (hiç çalışmamışsa) ilk gönderim için de tam bir
/// aralık beklenir — kaydeder kaydetmez sohbete düşmesi istenmiyor.
async fn due_timers(pool: &SqlitePool, now_ms: i64) -> Result<Vec<BotTimer>> {
  let rows: Vec<BotTimer> = sqlx::query_as(
    "SELECT id, channel_id, name, message, enabled, interval_sec, min_chat_lines,
            last_fired_at, lines_since
     FROM bot_timers
     WHERE enabled = 1 AND TRIM(message) <> ''
       AND lines_since >= min_chat_lines
       AND (? - COALESCE(last_fired_at, ?)) >= interval_sec * 1000
     ORDER BY COALESCE(last_fired_at, 0)",
  )
  .bind(now_ms)
  .bind(now_ms)
  .fetch_all(pool)
  .await?;
  Ok(rows)
}

/// Zamanlayıcı mesajını etkin tüm hedeflere yollar.
///
/// `send_reply` gelen mesajın platformuna göre hedef seçiyor; zamanlayıcının
/// gelen mesajı olmadığı için "bot" platformu kullanılıyor (heist duyurusuyla
/// aynı yol) ve ayrıca Twitch yayını elle tetikleniyor.
async fn announce(state: &Arc<AppState>, message: &str) {
  let synthetic = ChatInbound {
    platform: "bot".into(),
    user_key: "timer".into(),
    user_name: "timer".into(),
    text: message.to_string(),
    kind: "chat".into(),
    amount: None,
    badges: Vec::new(),
    is_mod: false,
    is_vip: false,
    is_sub: false,
    color: None,
    raw_id: String::new(),
  };
  if let Err(e) = super::pipeline::send_reply(state, &synthetic, message).await {
    yya_warn!("[bot/timers] gönderilemedi: {e:#}");
  }
  if let Ok(settings) = crate::db::botaxt_api::get_bot_settings(&state.db).await {
    if settings.reply_to_twitch != 0 {
      state.broadcast_json(&serde_json::json!({
        "type": "bot-reply-request",
        "platform": "twitch",
        "text": message,
        "t": chrono_now(),
      }));
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  async fn pool() -> SqlitePool {
    let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
    sqlx::query(
      "CREATE TABLE bot_timers (
         id TEXT PRIMARY KEY NOT NULL, channel_id TEXT NOT NULL, name TEXT NOT NULL,
         message TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1,
         interval_sec INTEGER NOT NULL DEFAULT 300, min_chat_lines INTEGER NOT NULL DEFAULT 0,
         last_fired_at INTEGER, lines_since INTEGER NOT NULL DEFAULT 0)",
    )
    .execute(&pool)
    .await
    .unwrap();
    pool
  }

  async fn add(pool: &SqlitePool, id: &str, interval: i64, min_lines: i64, last: Option<i64>, lines: i64) {
    sqlx::query(
      "INSERT INTO bot_timers(id, channel_id, name, message, enabled, interval_sec,
                              min_chat_lines, last_fired_at, lines_since)
       VALUES(?,'c',?,'mesaj',1,?,?,?,?)",
    )
    .bind(id)
    .bind(id)
    .bind(interval)
    .bind(min_lines)
    .bind(last)
    .bind(lines)
    .execute(pool)
    .await
    .unwrap();
  }

  #[tokio::test]
  async fn suresi_dolan_calisir_dolmayan_beklemez() {
    let pool = pool().await;
    let now = 1_000_000_000i64;
    add(&pool, "hazir", 60, 0, Some(now - 61_000), 0).await;
    add(&pool, "erken", 60, 0, Some(now - 10_000), 0).await;
    let due = due_timers(&pool, now).await.unwrap();
    assert_eq!(due.len(), 1);
    assert_eq!(due[0].id, "hazir");
  }

  #[tokio::test]
  async fn satir_esigi_dolmadan_yazmaz() {
    let pool = pool().await;
    let now = 1_000_000_000i64;
    add(&pool, "sessiz", 60, 5, Some(now - 120_000), 2).await;
    assert!(due_timers(&pool, now).await.unwrap().is_empty());

    sqlx::query("UPDATE bot_timers SET lines_since = 5")
      .execute(&pool)
      .await
      .unwrap();
    assert_eq!(due_timers(&pool, now).await.unwrap().len(), 1);
  }

  #[tokio::test]
  async fn hic_calismamis_timer_ilk_araligi_bekler() {
    let pool = pool().await;
    let now = 1_000_000_000i64;
    // last_fired_at NULL — kaydedilir kaydedilmez sohbete düşmemeli
    add(&pool, "yeni", 60, 0, None, 0).await;
    assert!(due_timers(&pool, now).await.unwrap().is_empty());
  }

  #[tokio::test]
  async fn kapali_ve_bos_mesajli_atlanir() {
    let pool = pool().await;
    let now = 1_000_000_000i64;
    add(&pool, "kapali", 60, 0, Some(now - 120_000), 0).await;
    sqlx::query("UPDATE bot_timers SET enabled = 0 WHERE id = 'kapali'")
      .execute(&pool)
      .await
      .unwrap();
    add(&pool, "bos", 60, 0, Some(now - 120_000), 0).await;
    sqlx::query("UPDATE bot_timers SET message = '   ' WHERE id = 'bos'")
      .execute(&pool)
      .await
      .unwrap();
    assert!(due_timers(&pool, now).await.unwrap().is_empty());
  }
}
