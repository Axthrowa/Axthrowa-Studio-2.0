//! Kayıtlı Kick kanalı ve oda kimliği. Sohbeti bot (StreamAxT) okur: Kick'in Pusher anahtarı
//! 2026 Ekim'de kapandı (kod 4001), burada artık dinleyici yok.

use std::sync::Arc;

use anyhow::{anyhow, Context, Result};
use parking_lot::RwLock;
use serde_json::{json, Value};

use crate::db::{chrono_now, default_channel_id};
use crate::AppState;

#[derive(Default)]
pub struct KickChatRuntime {
  slug: RwLock<Option<String>>,
  pub chatroom_id: Arc<RwLock<Option<u64>>>,
  last_error: RwLock<Option<String>>,
}

impl KickChatRuntime {
  pub fn new() -> Self {
    Self::default()
  }

  pub fn status_json(&self) -> Value {
    json!({
      "connected": false,
      "connecting": false,
      "username": self.slug.read().clone(),
      "chatroomId": *self.chatroom_id.read(),
      "lastError": self.last_error.read().clone(),
    })
  }

  pub fn disconnect(&self) {
    *self.slug.write() = None;
    *self.chatroom_id.write() = None;
    *self.last_error.write() = None;
  }

  pub async fn connect(self: &Arc<Self>, state: AppState, username: &str) -> Result<Value> {
    self.connect_with_chatroom(state, username, None).await
  }

  /// Kullanıcı adını kaydeder ve oda kimliğini çözer.
  pub async fn connect_with_chatroom(
    self: &Arc<Self>,
    state: AppState,
    username: &str,
    known_chatroom: Option<u64>,
  ) -> Result<Value> {
    let slug = crate::kick::normalize_slug(username);
    if slug.is_empty() {
      return Err(anyhow!("Kick kullanıcı adı boş"));
    }
    save_kick_slug(&state.db, &slug).await?;
    *self.slug.write() = Some(slug.clone());
    *self.last_error.write() = None;
    let oda = match known_chatroom {
      Some(id) => Some(id),
      None => match crate::kick::fetch_chatroom(&slug).await {
        Ok(v) => v.get("chatroomId").and_then(Value::as_u64),
        Err(e) => {
          *self.last_error.write() = Some(e.to_string());
          None
        }
      },
    };
    *self.chatroom_id.write() = oda;
    Ok(self.status_json())
  }

  /// Uygulama açılışında kayıtlı kanalı yükler.
  pub async fn autoconnect_from_settings(self: &Arc<Self>, state: AppState) {
    let Some(slug) = super::pipeline::resolve_channels(&state).await.kick_slug else {
      return;
    };
    if let Err(e) = self.connect(state, &slug).await {
      yya_warn!("[kick-chat] kanal yüklenemedi: {e:#}");
    }
  }
}

pub async fn save_kick_slug(pool: &sqlx::SqlitePool, slug: &str) -> Result<()> {
  let cid = default_channel_id(pool).await?;
  let row: Option<(String,)> =
    sqlx::query_as("SELECT platforms_json FROM channels WHERE id = ?")
      .bind(&cid)
      .fetch_optional(pool)
      .await?;
  let mut platforms = row
    .and_then(|r| serde_json::from_str::<Value>(&r.0).ok())
    .unwrap_or_else(|| json!({}));
  if !platforms.is_object() {
    platforms = json!({});
  }
  platforms["kick"] = json!(slug);
  let now = chrono_now();
  sqlx::query(
    "UPDATE channels SET platforms_json = ?, slug = ?, display_name = ?, updated_at = ? WHERE id = ?",
  )
  .bind(platforms.to_string())
  .bind(slug)
  .bind(slug)
  .bind(now)
  .bind(&cid)
  .execute(pool)
  .await
  .context("Kick slug kaydı")?;
  yya_log!("[kick-chat] SQLite’a kaydedildi: kick={slug}");
  Ok(())
}

pub async fn clear_kick_slug(pool: &sqlx::SqlitePool) -> Result<()> {
  let cid = default_channel_id(pool).await?;
  let row: Option<(String,)> =
    sqlx::query_as("SELECT platforms_json FROM channels WHERE id = ?")
      .bind(&cid)
      .fetch_optional(pool)
      .await?;
  let mut platforms = row
    .and_then(|r| serde_json::from_str::<Value>(&r.0).ok())
    .unwrap_or_else(|| json!({}));
  if let Some(obj) = platforms.as_object_mut() {
    obj.remove("kick");
  }
  let now = chrono_now();
  sqlx::query("UPDATE channels SET platforms_json = ?, updated_at = ? WHERE id = ?")
    .bind(platforms.to_string())
    .bind(now)
    .bind(&cid)
    .execute(pool)
    .await?;
  Ok(())
}
