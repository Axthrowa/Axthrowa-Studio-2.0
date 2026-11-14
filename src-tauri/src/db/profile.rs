//! Profil / dashboard / yayın oturumu sorguları.

use anyhow::Result;
use sqlx::SqlitePool;

use crate::db::models::{DashboardSnapshot, EventLog, StreamSession};
use crate::db::{chrono_now, default_channel_id, meta_get};

pub async fn dashboard(pool: &SqlitePool) -> Result<DashboardSnapshot> {
  let channel_id = default_channel_id(pool).await?;
  let channel_name: String = sqlx::query_as(
    "SELECT display_name FROM channels WHERE id = ?",
  )
  .bind(&channel_id)
  .fetch_optional(pool)
  .await?
  .map(|(n,): (String,)| n)
  .unwrap_or_else(|| "Yayıncı".into());

  let active_session: Option<StreamSession> = sqlx::query_as(
    "SELECT id, channel_id, started_at, ended_at, title, category,
            peak_viewers, avg_viewers, new_followers, new_subs, tips_total,
            chat_messages, duration_sec, notes, vod_url
     FROM stream_sessions
     WHERE channel_id = ? AND ended_at IS NULL
     ORDER BY started_at DESC LIMIT 1",
  )
  .bind(&channel_id)
  .fetch_optional(pool)
  .await?;

  let (viewers, chat_rpm) = if let Some(ref s) = active_session {
    let sample: Option<(i64, f64)> = sqlx::query_as(
      "SELECT viewers, chat_rpm FROM stream_metrics_samples
       WHERE session_id = ? ORDER BY ts DESC LIMIT 1",
    )
    .bind(&s.id)
    .fetch_optional(pool)
    .await?;
    sample.unwrap_or((0, 0.0))
  } else {
    (0, 0.0)
  };

  let session_followers = active_session.as_ref().map(|s| s.new_followers).unwrap_or(0);
  let session_subs = active_session.as_ref().map(|s| s.new_subs).unwrap_or(0);
  let session_chat = active_session.as_ref().map(|s| s.chat_messages).unwrap_or(0);
  let now = chrono_now();
  let active_chatters: i64 = sqlx::query_scalar(
    "SELECT COUNT(*) FROM loyalty_users WHERE channel_id = ? AND last_seen >= ?",
  )
  .bind(&channel_id)
  .bind(now - 5 * 60 * 1000)
  .fetch_one(pool)
  .await
  .unwrap_or(0);
  let session_viewers: i64 = if let Some(ref session) = active_session {
    sqlx::query_scalar(
      "SELECT COUNT(*) FROM loyalty_users WHERE channel_id = ? AND last_seen >= ?",
    )
    .bind(&channel_id)
    .bind(session.started_at)
    .fetch_one(pool)
    .await
    .unwrap_or(0)
  } else {
    0
  };

  let loyalty_users: i64 = sqlx::query_scalar(
    "SELECT COUNT(*) FROM loyalty_users WHERE channel_id = ?",
  )
  .bind(&channel_id)
  .fetch_one(pool)
  .await
  .unwrap_or(0);

  let commands: i64 = sqlx::query_scalar(
    "SELECT COUNT(*) FROM bot_commands WHERE channel_id = ?",
  )
  .bind(&channel_id)
  .fetch_one(pool)
  .await
  .unwrap_or(0);

  let recent_events: Vec<EventLog> = sqlx::query_as(
    "SELECT id, session_id, channel_id, kind, platform, user_name, user_id,
            amount, message, meta_json, ts
     FROM events_log WHERE channel_id = ?
     ORDER BY ts DESC LIMIT 25",
  )
  .bind(&channel_id)
  .fetch_all(pool)
  .await
  .unwrap_or_default();

  let sessions: Vec<StreamSession> = sqlx::query_as(
    "SELECT id, channel_id, started_at, ended_at, title, category,
            peak_viewers, avg_viewers, new_followers, new_subs, tips_total,
            chat_messages, duration_sec, notes, vod_url
     FROM stream_sessions WHERE channel_id = ?
     ORDER BY started_at DESC LIMIT 20",
  )
  .bind(&channel_id)
  .fetch_all(pool)
  .await
  .unwrap_or_default();

  let eski_panel_aktarildi = meta_get(pool, crate::db::eski_panel_aktarimi::BAYRAK)
    .await?
    .as_deref()
    == Some("1");

  Ok(DashboardSnapshot {
    channel_id,
    channel_name,
    active_session,
    viewers,
    chat_rpm,
    session_followers,
    session_subs,
    session_chat,
    active_chatters,
    session_viewers,
    loyalty_users,
    commands,
    recent_events,
    sessions,
    eski_panel_aktarildi,
  })
}

pub async fn list_sessions(pool: &SqlitePool, limit: i64) -> Result<Vec<StreamSession>> {
  let channel_id = default_channel_id(pool).await?;
  let rows = sqlx::query_as(
    "SELECT id, channel_id, started_at, ended_at, title, category,
            peak_viewers, avg_viewers, new_followers, new_subs, tips_total,
            chat_messages, duration_sec, notes, vod_url
     FROM stream_sessions WHERE channel_id = ?
     ORDER BY started_at DESC LIMIT ?",
  )
  .bind(&channel_id)
  .bind(limit.clamp(1, 100))
  .fetch_all(pool)
  .await?;
  Ok(rows)
}

pub async fn start_session(pool: &SqlitePool, title: Option<String>) -> Result<StreamSession> {
  let channel_id = default_channel_id(pool).await?;
  // Açık oturum varsa onu döndür
  if let Some(s) = sqlx::query_as::<_, StreamSession>(
    "SELECT id, channel_id, started_at, ended_at, title, category,
            peak_viewers, avg_viewers, new_followers, new_subs, tips_total,
            chat_messages, duration_sec, notes, vod_url
     FROM stream_sessions
     WHERE channel_id = ? AND ended_at IS NULL
     ORDER BY started_at DESC LIMIT 1",
  )
  .bind(&channel_id)
  .fetch_optional(pool)
  .await?
  {
    return Ok(s);
  }

  let id = uuid::Uuid::new_v4().to_string();
  let now = chrono_now();
  sqlx::query(
    "INSERT INTO stream_sessions(
       id, channel_id, started_at, title, peak_viewers, avg_viewers,
       new_followers, new_subs, tips_total, chat_messages
     ) VALUES(?,?,?,?,0,0,0,0,0,0)",
  )
  .bind(&id)
  .bind(&channel_id)
  .bind(now)
  .bind(title)
  .execute(pool)
  .await?;

  sqlx::query_as(
    "SELECT id, channel_id, started_at, ended_at, title, category,
            peak_viewers, avg_viewers, new_followers, new_subs, tips_total,
            chat_messages, duration_sec, notes, vod_url
     FROM stream_sessions WHERE id = ?",
  )
  .bind(&id)
  .fetch_one(pool)
  .await
  .map_err(Into::into)
}

pub async fn end_session(pool: &SqlitePool, session_id: &str) -> Result<Option<StreamSession>> {
  let now = chrono_now();
  let started: Option<(i64,)> =
    sqlx::query_as("SELECT started_at FROM stream_sessions WHERE id = ? AND ended_at IS NULL")
      .bind(session_id)
      .fetch_optional(pool)
      .await?;
  let Some((started_at,)) = started else {
    return Ok(None);
  };
  let duration = ((now - started_at) / 1000).max(0);
  sqlx::query(
    "UPDATE stream_sessions SET ended_at = ?, duration_sec = ? WHERE id = ?",
  )
  .bind(now)
  .bind(duration)
  .bind(session_id)
  .execute(pool)
  .await?;

  let s = sqlx::query_as(
    "SELECT id, channel_id, started_at, ended_at, title, category,
            peak_viewers, avg_viewers, new_followers, new_subs, tips_total,
            chat_messages, duration_sec, notes, vod_url
     FROM stream_sessions WHERE id = ?",
  )
  .bind(session_id)
  .fetch_optional(pool)
  .await?;
  Ok(s)
}

/// U7b: yayının son OBS kare sayaçları (düşen / toplam)
pub async fn kareleri_yaz(pool: &SqlitePool, session_id: &str, dusen: i64, toplam: i64) -> Result<()> {
  sqlx::query("INSERT OR REPLACE INTO stream_session_frames(session_id, dropped, total) VALUES(?,?,?)")
    .bind(session_id)
    .bind(dusen.max(0))
    .bind(toplam.max(0))
    .execute(pool)
    .await?;
  Ok(())
}

/// Grafiğe en çok `n` nokta: uçlar korunarak eşit aralıkla seyreltilir
pub fn seyrelt(v: Vec<(i64, i64)>, n: usize) -> Vec<(i64, i64)> {
  if v.len() <= n || n < 2 {
    return v;
  }
  (0..n).map(|i| v[i * (v.len() - 1) / (n - 1)]).collect()
}

/// U7b: yayın raporu: izleyici eğrisi ([zaman ms, izleyici]) ve düşen kare (yazılmadıysa null)
pub async fn oturum_raporu(pool: &SqlitePool, session_id: &str) -> Result<serde_json::Value> {
  let ornekler: Vec<(i64, i64)> = sqlx::query_as("SELECT ts, viewers FROM stream_metrics_samples WHERE session_id = ? ORDER BY ts")
    .bind(session_id)
    .fetch_all(pool)
    .await?;
  let kare: Option<(i64, i64)> = sqlx::query_as("SELECT dropped, total FROM stream_session_frames WHERE session_id = ?")
    .bind(session_id)
    .fetch_optional(pool)
    .await?;
  Ok(serde_json::json!({
    "izleyici": seyrelt(ornekler, 200),
    "dusenKare": kare.map(|k| k.0),
    "toplamKare": kare.map(|k| k.1),
  }))
}

/// U6: OBS'ten toplanan işaret bilgisi (yazılmadan önce)
#[derive(Debug, Default, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Isaret {
  pub offset_ms: Option<i64>,
  pub scene: Option<String>,
  pub note: Option<String>,
  pub replay_path: Option<String>,
  pub chapter: bool,
  pub via: Option<String>,
}

/// U6: işareti açık yayın oturumuna (yoksa oturumsuz) yazar; kimliği döner
pub async fn isaret_ekle(pool: &SqlitePool, i: &Isaret) -> Result<i64> {
  let oturum: Option<(String,)> = sqlx::query_as("SELECT id FROM stream_sessions WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1")
    .fetch_optional(pool)
    .await?;
  let r = sqlx::query("INSERT INTO stream_markers(session_id, ts, offset_ms, scene, note, replay_path, chapter, via) VALUES(?,?,?,?,?,?,?,?)")
    .bind(oturum.map(|o| o.0))
    .bind(super::chrono_now())
    .bind(i.offset_ms)
    .bind(&i.scene)
    .bind(&i.note)
    .bind(&i.replay_path)
    .bind(i.chapter as i64)
    .bind(&i.via)
    .execute(pool)
    .await?;
  Ok(r.last_insert_rowid())
}

/// Y2: işaretin tekrar dosyası (yoksa None)
pub async fn isaret_dosyasi(pool: &SqlitePool, id: i64) -> Result<Option<String>> {
  let r: Option<(Option<String>,)> = sqlx::query_as("SELECT replay_path FROM stream_markers WHERE id = ?").bind(id).fetch_optional(pool).await?;
  Ok(r.and_then(|r| r.0).filter(|p| !p.is_empty()))
}

/// U6: işaret listesi; `session_id` verilmezse son 100 işaret (yeniden eskiye)
pub async fn isaretler(pool: &SqlitePool, session_id: Option<&str>) -> Result<Vec<serde_json::Value>> {
  let satirlar: Vec<(i64, Option<String>, i64, Option<i64>, Option<String>, Option<String>, Option<String>, i64, Option<String>)> = match session_id {
    Some(id) => sqlx::query_as("SELECT id, session_id, ts, offset_ms, scene, note, replay_path, chapter, via FROM stream_markers WHERE session_id = ? ORDER BY ts DESC").bind(id).fetch_all(pool).await?,
    None => sqlx::query_as("SELECT id, session_id, ts, offset_ms, scene, note, replay_path, chapter, via FROM stream_markers ORDER BY ts DESC LIMIT 100").fetch_all(pool).await?,
  };
  Ok(
    satirlar
      .into_iter()
      .map(|(id, sid, ts, off, scene, note, path, chapter, via)| {
        serde_json::json!({ "id": id, "sessionId": sid, "ts": ts, "offsetMs": off, "scene": scene, "note": note, "replayPath": path, "chapter": chapter != 0, "via": via })
      })
      .collect(),
  )
}

pub async fn push_metric(
  pool: &SqlitePool,
  session_id: &str,
  viewers: i64,
  chat_rpm: f64,
  followers: i64,
  subs: i64,
) -> Result<()> {
  let now = chrono_now();
  sqlx::query(
    "INSERT INTO stream_metrics_samples(session_id, ts, viewers, chat_rpm, followers, subs)
     VALUES(?,?,?,?,?,?)",
  )
  .bind(session_id)
  .bind(now)
  .bind(viewers)
  .bind(chat_rpm)
  .bind(followers)
  .bind(subs)
  .execute(pool)
  .await?;

  // peak güncelle
  sqlx::query(
    "UPDATE stream_sessions SET
       peak_viewers = CASE WHEN peak_viewers < ? THEN ? ELSE peak_viewers END,
       avg_viewers = (avg_viewers + ?) / 2.0
     WHERE id = ?",
  )
  .bind(viewers)
  .bind(viewers)
  .bind(viewers as f64)
  .bind(session_id)
  .execute(pool)
  .await?;
  Ok(())
}

pub async fn log_event(
  pool: &SqlitePool,
  kind: &str,
  platform: &str,
  user_name: &str,
  amount: Option<f64>,
  message: Option<&str>,
) -> Result<()> {
  let channel_id = default_channel_id(pool).await?;
  let session_id: Option<String> = sqlx::query_scalar(
    "SELECT id FROM stream_sessions WHERE channel_id = ? AND ended_at IS NULL
     ORDER BY started_at DESC LIMIT 1",
  )
  .bind(&channel_id)
  .fetch_optional(pool)
  .await?;

  let id = uuid::Uuid::new_v4().to_string();
  let now = chrono_now();
  sqlx::query(
    "INSERT INTO events_log(
       id, session_id, channel_id, kind, platform, user_name, amount, message, meta_json, ts
     ) VALUES(?,?,?,?,?,?,?,?, '{}', ?)",
  )
  .bind(&id)
  .bind(&session_id)
  .bind(&channel_id)
  .bind(kind)
  .bind(platform)
  .bind(user_name)
  .bind(amount)
  .bind(message)
  .bind(now)
  .execute(pool)
  .await?;

  if let Some(sid) = session_id {
    if kind == "follow" {
      sqlx::query(
        "UPDATE stream_sessions SET new_followers = new_followers + 1 WHERE id = ?",
      )
      .bind(&sid)
      .execute(pool)
      .await?;
    } else if kind == "sub" || kind == "gifted" || kind == "membership" {
      sqlx::query("UPDATE stream_sessions SET new_subs = new_subs + 1 WHERE id = ?")
        .bind(&sid)
        .execute(pool)
        .await?;
    } else if kind == "tip" || kind == "bits" || kind == "donation" {
      if let Some(a) = amount {
        sqlx::query(
          "UPDATE stream_sessions SET tips_total = tips_total + ? WHERE id = ?",
        )
        .bind(a)
        .bind(&sid)
        .execute(pool)
        .await?;
      }
    }
  }
  Ok(())
}

#[cfg(test)]
mod seyrelt_testleri {
  use super::seyrelt;

  #[test]
  fn uclari_korur_ve_sinira_iner() {
    let v: Vec<(i64, i64)> = (0..1000).map(|i| (i, i)).collect();
    let s = seyrelt(v, 200);
    assert_eq!(s.len(), 200);
    assert_eq!(s[0], (0, 0));
    assert_eq!(s[199], (999, 999));
    assert_eq!(seyrelt(vec![(1, 1)], 200), vec![(1, 1)]);
  }
}

#[cfg(test)]
mod isaret_testleri {
  use super::*;

  #[tokio::test]
  async fn isaret_acik_oturuma_yazilir_ve_listelenir() {
    let pool = sqlx::sqlite::SqlitePoolOptions::new().max_connections(1).connect("sqlite::memory:").await.unwrap();
    sqlx::migrate!("./migrations").run(&pool).await.unwrap();
    crate::db::ensure_default_channel(&pool).await.unwrap();
    // Oturum yokken de yazılır (oturumsuz)
    isaret_ekle(&pool, &Isaret { note: Some("önce".into()), ..Default::default() }).await.unwrap();
    let s = start_session(&pool, Some("Prova".into())).await.unwrap();
    let i = Isaret { offset_ms: Some(65_000), scene: Some("Oyun".into()), replay_path: Some("C:/k/tekrar.mkv".into()), chapter: true, via: Some("chat".into()), ..Default::default() };
    isaret_ekle(&pool, &i).await.unwrap();
    let liste = isaretler(&pool, Some(&s.id)).await.unwrap();
    assert_eq!(liste.len(), 1);
    assert_eq!(liste[0]["offsetMs"], 65_000);
    assert_eq!(liste[0]["scene"], "Oyun");
    assert_eq!(liste[0]["replayPath"], "C:/k/tekrar.mkv");
    assert_eq!(liste[0]["chapter"], true);
    assert_eq!(isaretler(&pool, None).await.unwrap().len(), 2);
  }
}
