//! Kick bot cookie oturumu — SQLite `bot_auth` tablosu.

use anyhow::{Context, Result};
use serde_json::Value;
use sqlx::SqlitePool;

use crate::kick::StoredKickBotSession;

pub async fn load(pool: &SqlitePool) -> Result<Option<StoredKickBotSession>> {
  let row: Option<(String, String, String, String, i64, String, i64, i64)> = sqlx::query_as(
    r#"
    SELECT cookie_header, xsrf_token, bearer_token, username, user_id,
           channel_slug, chatroom_id, updated_at
    FROM bot_auth WHERE id = 1
    "#,
  )
  .fetch_optional(pool)
  .await
  .context("bot_auth load")?;

  let Some((
    cookie_header,
    xsrf_token,
    bearer_token,
    username,
    user_id,
    channel_slug,
    chatroom_id,
    updated_at,
  )) = row
  else {
    return Ok(None);
  };

  if cookie_header.is_empty() && xsrf_token.is_empty() && bearer_token.is_empty() {
    if username.is_empty() && channel_slug.is_empty() {
      return Ok(None);
    }
  }

  Ok(Some(StoredKickBotSession {
    cookie_header,
    xsrf_token,
    bearer_token,
    username,
    user_id: user_id.max(0) as u64,
    channel_slug,
    chatroom_id: chatroom_id.max(0) as u64,
    updated_at_ms: updated_at,
  }))
}

pub async fn save(pool: &SqlitePool, data: &StoredKickBotSession) -> Result<()> {
  let config_json = Value::Object(Default::default());
  sqlx::query(
    r#"
    INSERT INTO bot_auth (
      id, cookie_header, xsrf_token, bearer_token, username, user_id,
      channel_slug, chatroom_id, config_json, updated_at
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      cookie_header = excluded.cookie_header,
      xsrf_token = excluded.xsrf_token,
      bearer_token = excluded.bearer_token,
      username = excluded.username,
      user_id = excluded.user_id,
      channel_slug = excluded.channel_slug,
      chatroom_id = excluded.chatroom_id,
      config_json = excluded.config_json,
      updated_at = excluded.updated_at
    "#,
  )
  .bind(&data.cookie_header)
  .bind(&data.xsrf_token)
  .bind(&data.bearer_token)
  .bind(&data.username)
  .bind(data.user_id as i64)
  .bind(&data.channel_slug)
  .bind(data.chatroom_id as i64)
  .bind(config_json.to_string())
  .bind(data.updated_at_ms)
  .execute(pool)
  .await
  .context("bot_auth save")?;
  Ok(())
}

pub async fn clear(pool: &SqlitePool) -> Result<()> {
  sqlx::query("DELETE FROM bot_auth WHERE id = 1")
    .execute(pool)
    .await
    .context("bot_auth clear")?;
  Ok(())
}
