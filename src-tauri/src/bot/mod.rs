//! Botaxt bot motoru — platform dinleyicileri + komut ayrıştırıcı + loyalty tick.
//!
//! ## Mimari
//! ```text
//! Kick Pusher ──┐
//!               ├──► mpsc(ChatInbound) ──► pipeline
//! Twitch IRC ───┘         │
//!                         ├─ filters (strike ladder)
//!                         ├─ ensure_loyalty + msg points
//!                         ├─ !heist/roulette/duel → games
//!                         ├─ !buy → shop (sfx / obs_scene)
//!                         ├─ !cmd → bot_commands → reply
//!                         ├─ follow/sub/tip → events_log + overlay-sync
//!                         └─ chat-message → overlay-sync (OBS chat)
//! loyalty_tick_loop ──► her interval_sec (varsayılan ~5 dk)
//! ```
//!
//! OBS Browser Source Tauri IPC bilmez; overlay tetikleri `AppState.broadcast_json`.

pub mod activity;
pub mod chatbot;
pub mod filters;
pub mod games;
pub mod integrations;
pub mod kick_chat;
pub mod pipeline;
pub mod shop;
pub mod timers;
pub mod variables;

use std::sync::Arc;
use std::time::Duration;

use tokio::sync::mpsc;

use crate::AppState;

use self::integrations::{twitch_listener, ChatInbound};
use self::pipeline::handle_chat_message;

/// Uygulama açılışında çağır — dinleyiciler + tick sonsuz döngü.
pub fn spawn_bot_runtime(state: AppState) {
  let st = state.clone();
  tauri::async_runtime::spawn(async move {
    bot_supervisor(st).await;
  });
  // İzleme puanı ve zamanlayıcılar yalnız eski botta (bkz. pipeline::legacy_replies_enabled):
  // StreamAxT kendi zamanlayıcılarını ve puanlarını yürütür.
  let eski_bot = pipeline::legacy_replies_enabled();
  if eski_bot {
    let st2 = state.clone();
    tauri::async_runtime::spawn(async move {
      loyalty_tick_loop(st2).await;
    });
  }
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
  // Zamanlayıcılar: tablo ve panel vardı ama satırları çalıştıran döngü yoktu.
  if eski_bot {
    let st_timers = state.clone();
    tauri::async_runtime::spawn(async move {
      timers::timer_tick_loop(st_timers).await;
    });
  }
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
    if let Err(e) = handle_chat_message(state.clone(), msg).await {
      yya_warn!("[bot/pipeline] {e:#}");
    }
  }

  for h in handles {
    let _ = h.await;
  }
  Ok(())
}

async fn loyalty_tick_loop(state: AppState) {
  loop {
    let interval = crate::db::loyalty::get_tick_interval_sec(&state.db)
      .await
      .unwrap_or(300)
      .max(30);
    tokio::time::sleep(Duration::from_secs(interval as u64)).await;
    match crate::db::loyalty::loyalty_tick(&state.db).await {
      Ok(v) => {
        if v.get("ticked").and_then(|x| x.as_bool()).unwrap_or(false) {
          yya_log!(
            "[loyalty] tick · users={}",
            v.get("users_updated").and_then(|x| x.as_i64()).unwrap_or(0)
          );
        }
      }
      Err(e) => yya_warn!("[loyalty] tick hata: {e:#}"),
    }
  }
}
