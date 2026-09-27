//! Kick bot girişi — oturum Edge CDP üzerinden alınır.
//!
//! Kullanıcı `open_kick_login_in_browser` ile açılan ayrı Edge penceresinde
//! giriş yapar; çerezler CDP ile okunur (HttpOnly dahil, token yapıştırma yok).
//! Eskiden uygulama içi bir WebView giriş penceresi de vardı; ön yüz onu
//! açmayı bıraktığı için kaldırıldı.

use serde_json::{json, Value};
use std::time::Duration;
use tauri::{AppHandle, Manager, State};

use crate::AppState;
use super::browser_cdp;

async fn ensure_kick_chat_after_session(state: &AppState) -> Value {
  let existing = state.kick_chat.status_json();
  let already = existing
    .get("connected")
    .and_then(|v| v.as_bool())
    .unwrap_or(false)
    || existing
      .get("connecting")
      .and_then(|v| v.as_bool())
      .unwrap_or(false);
  if already {
    let room = (*state.kick_chat.chatroom_id.read()).unwrap_or(0);
    let slug = existing
      .get("username")
      .and_then(|v| v.as_str())
      .unwrap_or("")
      .to_string();
    if !slug.is_empty() || room > 0 {
      state.kick_session.set_channel_meta(&slug, room);
      let _ = state.kick_session.persist_to_db(&state.db).await;
    }
    return json!({
      "chatConnected": existing.get("connected").and_then(|v| v.as_bool()).unwrap_or(false),
      "chatConnecting": existing.get("connecting").and_then(|v| v.as_bool()).unwrap_or(false),
      "chatroomId": room,
      "channelSlug": slug,
      "chatStatus": existing,
    });
  }

  let slug = crate::bot::pipeline::resolve_channels(state)
    .await
    .kick_slug;
  let Some(slug) = slug.filter(|s| !s.trim().is_empty()) else {
    yya_warn!("[kick-session] kanal slug yok — sohbet bağlanamadı (Ayarlar → Kick veya kanal adı)");
    return json!({
      "chatConnected": false,
      "chatConnecting": false,
      "chatroomId": 0,
      "channelSlug": Value::Null,
      "needsChannel": true,
      "error": "Kanal adı yok — İsim sekmesinde Kick kanalını bağlayın",
    });
  };

  yya_warn!("[kick-session] oturum hazır → sohbet bağlanıyor: {slug}");
  match state.kick_chat.connect(state.clone(), &slug).await {
    Ok(status) => {
      let room = (*state.kick_chat.chatroom_id.read()).unwrap_or(0);
      state.kick_session.set_channel_meta(&slug, room);
      if let Err(e) = state.kick_session.persist_to_db(&state.db).await {
        yya_warn!("[kick-session] meta persist: {e:#}");
      }
      {
        use crate::settings::ScreenKind;
        let mut settings = state.settings.write();
        let mut panel = settings.get(ScreenKind::Panel).clone();
        if let Some(obj) = panel.as_object_mut() {
          let smart = obj
            .entry("smartBot".to_string())
            .or_insert_with(|| json!({}));
          if let Some(sb) = smart.as_object_mut() {
            sb.insert("channelName".into(), json!(slug.clone()));
          }
          obj.insert("kickChannel".into(), json!(slug.clone()));
        }
        settings.set(ScreenKind::Panel, panel);
        let _ = settings.save_one(&state.data_dir, ScreenKind::Panel);
      }
      json!({
        "chatConnected": status.get("connected").and_then(|v| v.as_bool()).unwrap_or(false),
        "chatConnecting": status.get("connecting").and_then(|v| v.as_bool()).unwrap_or(false),
        "chatroomId": room,
        "channelSlug": slug,
        "chatStatus": status,
        "needsChannel": false,
      })
    }
    Err(e) => {
      yya_warn!("[kick-session] sohbet bağlanamadı: {e:#}");
      json!({
        "chatConnected": false,
        "chatConnecting": false,
        "chatroomId": 0,
        "channelSlug": slug,
        "needsChannel": false,
        "error": e.to_string(),
      })
    }
  }
}

/// Önerilen yol: Edge’i CDP ile aç (tokensız otomatik cookie).
#[tauri::command]
pub fn open_kick_login_in_browser(app: AppHandle) -> Result<Value, String> {
  let state = app.state::<AppState>();
  let launched = browser_cdp::launch_kick_browser_cdp(&state.data_dir).map_err(|e| e.to_string())?;
  // Arka planda oturum hazır olana kadar CDP poll
  spawn_cdp_session_poll(app.clone());
  Ok(launched)
}

/// Edge CDP’den Kick oturumunu otomatik al (yapıştırma yok).
#[tauri::command]
pub async fn import_kick_session_from_browser(app: AppHandle) -> Result<Value, String> {
  import_kick_session_from_cdp_inner(&app).await
}

fn spawn_cdp_session_poll(app: AppHandle) {
  tauri::async_runtime::spawn(async move {
    // Edge + kullanıcının giriş yapması için bekle — erken poll login’i bozmasın
    tokio::time::sleep(Duration::from_secs(8)).await;
    for i in 0..30 {
      match import_kick_session_from_cdp_inner(&app).await {
        Ok(status) if status.get("ready").and_then(|v| v.as_bool()).unwrap_or(false) => {
          yya_warn!("[kick-cdp] otomatik oturum hazır (deneme {i})");
          break;
        }
        Ok(status)
          if status
            .pointer("/status/hasCookies")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
            || status.get("pending").and_then(|v| v.as_bool()).unwrap_or(false) =>
        {
          // Cookie var / login sürüyor — agresif değil, daha seyrek
          yya_warn!("[kick-cdp] poll bekleniyor (deneme {i})");
        }
        Ok(_) => {}
        Err(e) => {
          if i == 0 || i % 4 == 0 {
            yya_warn!("[kick-cdp] poll: {e}");
          }
        }
      }
      tokio::time::sleep(Duration::from_secs(6)).await;
    }
  });
}

async fn import_kick_session_from_cdp_inner(app: &AppHandle) -> Result<Value, String> {
  let state = app.state::<AppState>();
  let (port, pairs) = browser_cdp::fetch_kick_cookies_via_cdp_with_data_dir(&state.data_dir)
    .await
    .map_err(|e| e.to_string())?;
  let names: Vec<&str> = pairs.iter().map(|(n, _)| n.as_str()).collect();
  yya_warn!(
    "[kick-cdp] port={port} cookies={} names={:?}",
    pairs.len(),
    names
  );

  let looks_session = pairs.iter().any(|(n, _)| {
    let l = n.to_ascii_lowercase();
    l.contains("session")
      || l.contains("kick_session")
      || l.contains("auth")
      || l.contains("laravel")
      || l.contains("sanctum")
      || l.contains("jwt")
      || l == "token"
      || l.contains("xsrf")
      || l.contains("csrf")
  });

  // Giriş henüz yok → kayıtlı oturumu ezme, sadece bekle
  if !looks_session {
    let existing = state.kick_session.status();
    let already = existing
      .get("ready")
      .and_then(|v| v.as_bool())
      .unwrap_or(false)
      || existing
        .get("hasCookies")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    return Ok(json!({
      "ok": already,
      "ready": existing.get("ready"),
      "pending": true,
      "port": port,
      "cookieCount": pairs.len(),
      "cookieNames": names,
      "error": "Edge’de Kick girişini tamamlayın — sayfa yenilenmeyecek, bekleniyor",
      "status": existing,
    }));
  }

  let room = (*state.kick_chat.chatroom_id.read()).unwrap_or(0);
  let slug = state
    .kick_chat
    .status_json()
    .get("username")
    .and_then(|v| v.as_str())
    .unwrap_or("")
    .to_string();
  if !slug.is_empty() || room > 0 {
    state.kick_session.set_channel_meta(&slug, room);
  }

  let mut status = state
    .kick_session
    .ingest_cookies(&pairs, None, None, None)
    .map_err(|e| e.to_string())?;

  // Cookie geldiği anda kalıcı yaz (XSRF olmasa bile — uygulama yeniden açılınca kalsın)
  if let Err(e) = state.kick_session.persist_to_db(&state.db).await {
    yya_warn!("[kick-cdp] erken persist: {e:#}");
  }

  if !status.get("ready").and_then(|v| v.as_bool()).unwrap_or(false) {
    match state.kick_session.fetch_missing_xsrf().await {
      Ok(s) => {
        status = s;
        let _ = state.kick_session.persist_to_db(&state.db).await;
      }
      Err(e) => {
        yya_warn!("[kick-cdp] xsrf: {e:#}");
        // Cookie varsa pending dön — kullanıcıyı login’e zorlama
        let has_cookies = status
          .get("hasCookies")
          .and_then(|v| v.as_bool())
          .unwrap_or(false);
        return Ok(json!({
          "ok": has_cookies,
          "ready": false,
          "pending": true,
          "port": port,
          "cookieCount": pairs.len(),
          "cookieNames": names,
          "error": if has_cookies {
            format!("Çerez kaydedildi; XSRF tamamlanıyor: {e}")
          } else {
            format!("Giriş tamamlanmamış veya XSRF eksik: {e}")
          },
          "status": status,
        }));
      }
    }
  }

  if status.get("ready").and_then(|v| v.as_bool()).unwrap_or(false) {
    state.kick_session.clear_session_lost();
    let _ = state.kick_session.resolve_identity().await;
    if let Err(e) = state.kick_session.persist_to_db(&state.db).await {
      yya_warn!("[kick-cdp] bot_auth: {e:#}");
    }
    let chat = ensure_kick_chat_after_session(&state).await;
    // Refresh status after chatroom meta sync
    status = state.kick_session.status();
    state.broadcast_json(&json!({
      "type": "kick-bot-session-ready",
      "status": status,
      "chat": chat,
      "via": "edge-cdp",
      "t": chrono::Utc::now().timestamp_millis(),
    }));
    // Oturum hazır → özel Edge penceresini kapat
    browser_cdp::close_kick_browser_cdp(&state.data_dir).await;
    return Ok(json!({
      "ok": true,
      "ready": true,
      "port": port,
      "cookieCount": pairs.len(),
      "status": status,
      "chatConnected": chat.get("chatConnected"),
      "chatConnecting": chat.get("chatConnecting"),
      "chatroomId": chat.get("chatroomId"),
      "channelSlug": chat.get("channelSlug"),
      "needsChannel": chat.get("needsChannel"),
      "chatError": chat.get("error"),
      "browserClosed": true,
    }));
  }

  Ok(json!({
    "ok": true,
    "ready": status.get("ready"),
    "port": port,
    "cookieCount": pairs.len(),
    "status": status,
  }))
}

#[tauri::command]
pub async fn harvest_kick_bot_cookies(app: AppHandle) -> Result<Value, String> {
  harvest_kick_cookies_inner(&app).await
}

#[tauri::command]
pub fn kick_bot_session_status(state: State<'_, AppState>) -> Value {
  state.kick_session.status()
}

pub async fn harvest_kick_cookies_inner(app: &AppHandle) -> Result<Value, String> {
  // Oturum yalnız Edge CDP yoluyla alınır (uygulama içi giriş penceresi kaldırıldı).
  import_kick_session_from_cdp_inner(app).await
}
