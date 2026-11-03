//! Sohbet alımı — platform dinleyicileri ve overlay'e aktarım. Sohbet botu StreamAxT'tir.
//!
//! ## Mimari
//! ```text
//! Kick Pusher ──┐
//!               ├──► mpsc(ChatInbound) ──► pipeline
//! Twitch IRC ───┘         │
//!                         ├─ ensure_loyalty + mesaj sayımı
//!                         ├─ follow/sub/tip → events_log + overlay-sync
//!                         ├─ chat-message → overlay-sync (OBS chat)
//!                         └─ !oy / !katil / !sr → widget runtime
//! ```
//!
//! OBS Browser Source Tauri IPC bilmez; overlay tetikleri `AppState.broadcast_json`.

pub mod activity;
pub mod integrations;
pub mod kick_chat;
pub mod pipeline;

use std::sync::Arc;
use std::time::Duration;

use tokio::sync::mpsc;

use crate::AppState;

use self::integrations::{twitch_listener, ChatInbound};
use self::pipeline::handle_inbound;

/// Uygulama açılışında çağır — dinleyiciler + tick sonsuz döngü.
pub fn spawn_bot_runtime(state: AppState) {
  let st = state.clone();
  tauri::async_runtime::spawn(async move {
    bot_supervisor(st).await;
  });
  // Kick chat: kayıtlı slug + token varsa tarayıcı girişi olmadan bağlan
  let st3 = state.clone();
  tauri::async_runtime::spawn(async move {
    tokio::time::sleep(Duration::from_millis(600)).await;
    let _ = st3.kick_auth.warmup().await;
    st3.kick_chat.autoconnect_from_settings(st3.clone()).await;
  });
  let st_refresh = state.clone();
  tauri::async_runtime::spawn(async move {
    loop {
      tokio::time::sleep(Duration::from_secs(20 * 60)).await;
      let _ = st_refresh.kick_auth.warmup().await;
    }
  });
  let st4 = state.clone();
  tauri::async_runtime::spawn(async move {
    tokio::time::sleep(Duration::from_millis(350)).await;
    if let Err(e) = crate::db::botaxt_api::seed_default_commands(&st4.db).await {
      yya_warn!("[bot] varsayılan komut seed: {e:#}");
    }
  });
}

async fn bot_supervisor(state: AppState) {
  loop {
    if let Err(e) = bot_session(state.clone()).await {
      yya_warn!("[bot] oturum koptu: {e:#} — 5s sonra yeniden");
    }
    tokio::time::sleep(Duration::from_secs(5)).await;
  }
}

async fn bot_session(state: AppState) -> anyhow::Result<()> {
  let (tx, mut rx) = mpsc::channel::<ChatInbound>(512);
  let cfg = pipeline::resolve_channels(&state).await;

  let mut handles = Vec::new();

  // Kick, KickChatRuntime üzerinden yönetilir (çift dinleyici yok)

  if let Some(login) = cfg.twitch_login.clone() {
    let txt = tx.clone();
    handles.push(tokio::spawn(async move {
      if let Err(e) = twitch_listener(login, txt).await {
        yya_warn!("[bot/twitch] {e:#}");
      }
    }));
  }

  drop(tx);

  if handles.is_empty() {
    // Twitch yok — Kick ayrı runtime'da; supervisor'ı flapping'den koru
    std::future::pending::<()>().await;
    return Ok(());
  }

  let state = Arc::new(state);
  while let Some(msg) = rx.recv().await {
    if let Err(e) = handle_inbound(state.clone(), msg).await {
      yya_warn!("[bot/pipeline] {e:#}");
    }
  }

  for h in handles {
    let _ = h.await;
  }
  Ok(())
}
