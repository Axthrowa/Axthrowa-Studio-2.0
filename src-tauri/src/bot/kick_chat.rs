//! Kick chat (Pusher) bağlantı yöneticisi — Ayarlar paneli / HTTP API ile yönetilir.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use anyhow::{anyhow, Context, Result};
use parking_lot::{Mutex, RwLock};
use serde_json::{json, Value};
use tokio::sync::mpsc;
use tokio::task::JoinHandle;

use crate::db::{chrono_now, default_channel_id};
use crate::AppState;

use super::integrations::{kick_listener, ChatInbound};
use super::pipeline::handle_chat_message;

pub struct KickChatRuntime {
  connected: AtomicBool,
  connecting: AtomicBool,
  slug: RwLock<Option<String>>,
  pub chatroom_id: Arc<RwLock<Option<u64>>>,
  last_error: RwLock<Option<String>>,
  task: Mutex<Option<JoinHandle<()>>>,
}

impl KickChatRuntime {
  pub fn new() -> Self {
    Self {
      connected: AtomicBool::new(false),
      connecting: AtomicBool::new(false),
      slug: RwLock::new(None),
      chatroom_id: Arc::new(RwLock::new(None)),
      last_error: RwLock::new(None),
      task: Mutex::new(None),
    }
  }

  pub fn is_connected(&self) -> bool {
    self.connected.load(Ordering::SeqCst)
  }

  fn already_running_for(&self, slug: &str) -> bool {
    let same = self.slug.read().as_deref() == Some(slug);
    if !same {
      return false;
    }
    let alive = self
      .task
      .lock()
      .as_ref()
      .map(|h| !h.is_finished())
      .unwrap_or(false);
    alive && (self.is_connected() || self.connecting.load(Ordering::SeqCst))
  }

  pub fn status_json(&self) -> Value {
    json!({
      "connected": self.connected.load(Ordering::SeqCst),
      "connecting": self.connecting.load(Ordering::SeqCst),
      "username": self.slug.read().clone(),
      "chatroomId": *self.chatroom_id.read(),
      "lastError": self.last_error.read().clone(),
    })
  }

  pub fn disconnect(&self) {
    self.abort_task();
    self.connected.store(false, Ordering::SeqCst);
    self.connecting.store(false, Ordering::SeqCst);
    *self.slug.write() = None;
    *self.chatroom_id.write() = None;
    *self.last_error.write() = None;
    yya_log!("[kick-chat] bağlantı kesildi");
  }

  /// Önceki oturumu durdur; kullanıcı adını koru (yeniden bağlanırken).
  fn abort_task(&self) {
    if let Some(h) = self.task.lock().take() {
      h.abort();
    }
    self.connected.store(false, Ordering::SeqCst);
  }

  /// Kullanıcı adını kaydet + Pusher dinleyicisini başlat.
  pub async fn connect(self: &Arc<Self>, state: AppState, username: &str) -> Result<Value> {
    self.connect_with_chatroom(state, username, None).await
  }

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

    if self.already_running_for(&slug) {
      yya_log!("[kick-chat] zaten bağlı/bağlanıyor: {slug} — soket kesilmedi");
      return Ok(self.status_json());
    }

    // Önce eski task'ı kes — slug'ı silme (UI status için)
    self.abort_task();
    *self.slug.write() = Some(slug.clone());
    *self.chatroom_id.write() = known_chatroom;
    *self.last_error.write() = None;
    self.connecting.store(true, Ordering::SeqCst);
    if let Some(id) = known_chatroom {
      state.kick_session.set_channel_meta(&slug, id);
    } else {
      state.kick_session.set_channel_meta(&slug, 0);
    }

    let runtime = Arc::clone(self);
    let st = state.clone();
    let slug_task = slug.clone();
    let handle = tokio::spawn(async move {
      let outcome = run_session(runtime.clone(), st, slug_task, known_chatroom).await;
      runtime.connected.store(false, Ordering::SeqCst);
      runtime.connecting.store(false, Ordering::SeqCst);
      match outcome {
        Ok(()) => yya_log!("[kick-chat] oturum sonlandı"),
        Err(e) => {
          yya_warn!("[kick-chat] oturum hatası: {e:#}");
          *runtime.last_error.write() = Some(e.to_string());
        }
      }
    });
    *self.task.lock() = Some(handle);

    // Kısa bekleme: chatroom çözülürse / hata yazılırsa status güncel olsun
    for _ in 0..40 {
      tokio::time::sleep(std::time::Duration::from_millis(100)).await;
      if self.connected.load(Ordering::SeqCst) || self.last_error.read().is_some() {
        break;
      }
      if self.chatroom_id.read().is_some() && self.connected.load(Ordering::SeqCst) {
        break;
      }
    }

    Ok(self.status_json())
  }

  /// Uygulama açılışında DB/ayarlarda slug varsa bağlan.
  pub async fn autoconnect_from_settings(self: &Arc<Self>, state: AppState) {
    if self.is_connected() || self.connecting.load(Ordering::SeqCst) {
      return;
    }
    let slug = super::pipeline::resolve_channels(&state).await.kick_slug;
    let Some(slug) = slug else {
      yya_log!("[kick-chat] kayıtlı Kick kanalı yok — Ayarlar’dan Bağlan");
      return;
    };
    yya_log!("[kick-chat] otomatik bağlanılıyor: {slug}");
    if let Err(e) = self.connect(state, &slug).await {
      yya_warn!("[kick-chat] otomatik bağlantı başarısız: {e:#}");
    }
  }
}

async fn run_session(
  runtime: Arc<KickChatRuntime>,
  state: AppState,
  slug: String,
  known_chatroom: Option<u64>,
) -> Result<()> {
  let (tx, mut rx) = mpsc::channel::<ChatInbound>(512);
  let live = Arc::new(AtomicBool::new(false));
  let live_flag = Arc::clone(&live);
  let chatroom_out = Arc::clone(&runtime.chatroom_id);
  let slug_listen = slug.clone();

  let listen = tokio::spawn(async move {
    kick_listener(
      slug_listen,
      tx,
      Some(live_flag),
      Some(chatroom_out),
      known_chatroom,
    )
    .await
  });

  // connected bayrağını kick_listener ile senkron tut
  let runtime_poll = Arc::clone(&runtime);
  let live_poll = Arc::clone(&live);
  let state_meta = state.clone();
  let slug_meta = slug.clone();
  let poll = tokio::spawn(async move {
    let mut synced_room = false;
    loop {
      let on = live_poll.load(Ordering::SeqCst);
      runtime_poll.connected.store(on, Ordering::SeqCst);
      if on {
        runtime_poll.connecting.store(false, Ordering::SeqCst);
      }
          if !synced_room {
            let room_id = *runtime_poll.chatroom_id.read();
            if let Some(id) = room_id {
              state_meta.kick_session.set_channel_meta(&slug_meta, id);
              if let Err(e) = state_meta.kick_session.persist_to_db(&state_meta.db).await {
                yya_warn!("[kick-chat] chatroom persist: {e:#}");
              }
              synced_room = true;
            }
          }
      tokio::time::sleep(std::time::Duration::from_millis(200)).await;
    }
  });

  let st = Arc::new(state);
  while let Some(msg) = rx.recv().await {
    if let Err(e) = handle_chat_message(st.clone(), msg).await {
      yya_warn!("[kick-chat/pipeline] {e:#}");
    }
  }

  poll.abort();
  live.store(false, Ordering::SeqCst);
  runtime.connected.store(false, Ordering::SeqCst);

  match listen.await {
    Ok(Ok(())) => Ok(()),
    Ok(Err(e)) => Err(e),
    Err(e) if e.is_cancelled() => Ok(()),
    Err(e) => Err(anyhow!("kick listen task: {e}")),
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
