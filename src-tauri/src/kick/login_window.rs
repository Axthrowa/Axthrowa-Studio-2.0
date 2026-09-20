//! Kick bot login webview — cookie harvest (HttpOnly: Tauri cookies API).
//!
//! Önemli:
//! - Global CloseRequested «hide» yalnızca `main` için; kick penceresi gerçekten kapanır.
//! - Kapanışta / yok etmede ses kesilir (`about:blank` + media mute).
//! - Açılışta hayalet (gizli) pencere varsa önce destroy.

use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::sync::mpsc;
use std::time::Duration;
use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use url::Url;

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

const WIN_LABEL: &str = "kick-bot-login";
/// Login formu — anasayfa (canlı yayın sesi) yüklenmesin.
const LOGIN_URL: &str = "https://id.kick.com/login";
const SILENCE_JS: &str = r#"(function(){
  try {
    var path = (location.pathname || '').toLowerCase();
    var host = (location.hostname || '').toLowerCase();
    // Login / Turnstile sırasında iframe veya medyaya dokunma
    if (host.indexOf('id.kick.com') >= 0 || path.indexOf('/login') >= 0 || path.indexOf('/sign') >= 0) {
      return;
    }
    document.querySelectorAll('video').forEach(function(el){
      try {
        var w = el.clientWidth || 0, h = el.clientHeight || 0;
        if (w >= 240 && h >= 140) { el.muted = true; el.volume = 0; el.pause(); }
      } catch(_){}
    });
  } catch(_){}
})()"#;

/// Panelden: Kick bot hesabına giriş penceresi.
#[tauri::command]
pub async fn open_kick_bot_login(app: AppHandle) -> Result<Value, String> {
  // Eski/gizli hayalet pencere → ses + etiket çakışması. Her açılışta temiz başla.
  if app.get_webview_window(WIN_LABEL).is_some() {
    yya_warn!("[kick-login] mevcut pencere temizleniyor…");
    destroy_login_window(&app).await;
    tokio::time::sleep(Duration::from_millis(350)).await;
  }

  match create_login_window(&app) {
    Ok(()) => {
      spawn_cookie_poll(app);
      Ok(json!({ "ok": true, "reused": false }))
    }
    Err(e1) => {
      yya_warn!("[kick-login] ilk açılış başarısız: {e1}");
      destroy_login_window(&app).await;
      tokio::time::sleep(Duration::from_millis(500)).await;
      create_login_window(&app).map_err(|e2| {
        format!(
          "Kick giriş penceresi açılamadı. {e2} — Uygulamayı tamamen kapatıp tekrar açın."
        )
      })?;
      spawn_cookie_poll(app);
      Ok(json!({ "ok": true, "reused": false, "retried": true }))
    }
  }
}

/// Login penceresini ses keserek yok et (panelden de çağrılabilir).
#[tauri::command]
pub async fn close_kick_bot_login(app: AppHandle) -> Result<Value, String> {
  destroy_login_window(&app).await;
  Ok(json!({ "ok": true }))
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

/// Edge’den kopyalanan Cookie satırını doğrudan oturuma yaz.
#[tauri::command]
pub async fn ingest_kick_bot_cookie_header(
  app: AppHandle,
  cookie_header: String,
  username: Option<String>,
) -> Result<Value, String> {
  let state = app.state::<AppState>();
  let raw = cookie_header.trim();
  if raw.is_empty() {
    return Err("Cookie satırı boş".into());
  }
  // DevTools’tan gelen "name\\tvalue\\n" satırlarını da kabul et
  let normalized = if raw.contains('\t') && !raw.contains('=') {
    raw
      .lines()
      .filter_map(|line| {
        let line = line.trim();
        if line.is_empty() {
          return None;
        }
        let mut parts = line.splitn(2, '\t');
        let n = parts.next()?.trim();
        let v = parts.next().unwrap_or("").trim();
        if n.is_empty() {
          None
        } else {
          Some(format!("{n}={v}"))
        }
      })
      .collect::<Vec<_>>()
      .join("; ")
  } else {
    raw.replace('\n', "; ").replace('\r', "")
  };

  let mut pairs: Vec<(String, String)> = Vec::new();
  for part in normalized.split(';') {
    let part = part.trim();
    if let Some((n, v)) = part.split_once('=') {
      let n = n.trim();
      if !n.is_empty() {
        pairs.push((n.to_string(), v.trim().to_string()));
      }
    }
  }
  if pairs.is_empty() {
    return Err("Geçerli cookie bulunamadı — örn. XSRF-TOKEN=...; session_token=...".into());
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
    .ingest_cookies(
      &pairs,
      Some(&normalized),
      None,
      username.as_deref(),
    )
    .map_err(|e| e.to_string())?;

  if !status.get("ready").and_then(|v| v.as_bool()).unwrap_or(false) {
    match state.kick_session.fetch_missing_xsrf().await {
      Ok(s) => status = s,
      Err(e) => {
        yya_warn!("[kick-login] xsrf fetch: {e:#}");
        return Ok(json!({
          "ok": false,
          "ready": false,
          "pending": true,
          "error": e.to_string(),
          "status": status,
        }));
      }
    }
  }

  if status.get("ready").and_then(|v| v.as_bool()).unwrap_or(false) {
    state.kick_session.clear_session_lost();
    if let Err(e) = state.kick_session.persist_to_db(&state.db).await {
      yya_warn!("[kick-login] bot_auth kayıt: {e:#}");
    }
    let chat = ensure_kick_chat_after_session(&state).await;
    status = state.kick_session.status();
    state.broadcast_json(&json!({
      "type": "kick-bot-session-ready",
      "status": status,
      "chat": chat,
      "t": chrono::Utc::now().timestamp_millis(),
    }));
    return Ok(json!({
      "ok": true,
      "ready": true,
      "status": status,
      "chatConnected": chat.get("chatConnected"),
      "chatConnecting": chat.get("chatConnecting"),
      "chatroomId": chat.get("chatroomId"),
      "channelSlug": chat.get("channelSlug"),
      "needsChannel": chat.get("needsChannel"),
      "chatError": chat.get("error"),
    }));
  }

  Ok(json!({ "ok": true, "ready": status.get("ready"), "status": status }))
}

fn create_login_window(app: &AppHandle) -> Result<(), String> {
  let url = LOGIN_URL
    .parse::<Url>()
    .map_err(|e| format!("Kick URL geçersiz: {e}"))?;
  let app_nav = app.clone();

  // initialization_script YOK — Kick/Cloudflare form gönderimini bozuyor
  // (“bilinmeyen bir hata, tekrar deneyin”). WebView yedek yoldur;
  // asıl yol: Edge’de giriş + Cookie yapıştır.
  let win = WebviewWindowBuilder::new(app, WIN_LABEL, WebviewUrl::External(url))
    .title("Kick Bot — yedek WebView (önerilen: Edge + Cookie yapıştır)")
    .inner_size(1100.0, 840.0)
    .resizable(true)
    .center()
    .focused(true)
    .visible(true)
    .on_navigation(move |nav_url| {
      let href = nav_url.as_str().to_string();
      if is_auth_signal_url(&href) {
        let app3 = app_nav.clone();
        tauri::async_runtime::spawn(async move {
          tokio::time::sleep(Duration::from_millis(400)).await;
          let _ = harvest_kick_cookies_inner(&app3).await;
        });
        return true;
      }
      if is_login_url(&href) || is_auth_challenge_url(&href) {
        if is_auth_challenge_url(&href) {
          if let Some(w) = app_nav.get_webview_window(WIN_LABEL) {
            let _ = w.set_title("Kick Bot — doğrulama kodunu girin");
          }
        }
        return true;
      }
      if is_noisy_kick_url(&href) {
        let app3 = app_nav.clone();
        tauri::async_runtime::spawn(async move {
          tokio::time::sleep(Duration::from_millis(800)).await;
          let _ = harvest_kick_cookies_inner(&app3).await;
        });
      }
      true
    })
    .build()
    .map_err(|e| {
      let msg = e.to_string();
      if msg.is_empty()
        || msg.eq_ignore_ascii_case("unknown error")
        || msg.to_ascii_lowercase().contains("unknown error")
      {
        "WebView2 açılamadı — Edge’de giriş + Cookie yapıştır yolunu kullanın".into()
      } else {
        msg
      }
    })?;

  let win_ev = win.clone();
  win.on_window_event(move |event| {
    if let tauri::WindowEvent::CloseRequested { .. } = event {
      silence_webview(&win_ev);
    }
  });

  let _ = win.set_focus();
  Ok(())
}

async fn destroy_login_window(app: &AppHandle) {
  if let Some(w) = app.get_webview_window(WIN_LABEL) {
    silence_webview(&w);
    if let Ok(blank) = "about:blank".parse::<Url>() {
      let _ = w.navigate(blank);
    }
    // Navigate’in sesi kesmesi için kısa bekle
    tokio::time::sleep(Duration::from_millis(120)).await;
    let _ = w.destroy();
  }
  // Etiket temizlenene kadar bekle
  for _ in 0..20 {
    if app.get_webview_window(WIN_LABEL).is_none() {
      break;
    }
    tokio::time::sleep(Duration::from_millis(50)).await;
  }
}

fn silence_webview(win: &WebviewWindow) {
  let _ = win.eval(SILENCE_JS);
}

fn spawn_cookie_poll(app: AppHandle) {
  tauri::async_runtime::spawn(async move {
    for _ in 0..24 {
      tokio::time::sleep(Duration::from_secs(12)).await;
      if app.get_webview_window(WIN_LABEL).is_none() {
        break;
      }
      match harvest_kick_cookies_inner(&app).await {
        Ok(status) if status.get("ready").and_then(|v| v.as_bool()).unwrap_or(false) => {
          break;
        }
        _ => {}
      }
    }
  });
}

fn is_auth_signal_url(href: &str) -> bool {
  let h = href.to_ascii_lowercase();
  h.contains("127.0.0.1:8843/api/kick/auth-signal")
    || h.contains("localhost:8843/api/kick/auth-signal")
}

fn is_login_url(href: &str) -> bool {
  let h = href.to_ascii_lowercase();
  h.contains("/login")
    || h.contains("/sign-in")
    || h.contains("/signin")
    || h.contains("/register")
}

fn is_auth_challenge_url(href: &str) -> bool {
  let h = href.to_ascii_lowercase();
  h.contains("/verify")
    || h.contains("2fa")
    || h.contains("/otp")
    || h.contains("one-time")
    || h.contains("email-code")
    || h.contains("mfa")
    || h.contains("turnstile")
    || (h.contains("challenge") && !h.contains("oauth"))
}

/// Anasayfa / kanal sayfaları — canlı yayın oynatıcısı ses çıkarır.
fn is_noisy_kick_url(href: &str) -> bool {
  let h = href.to_ascii_lowercase();
  if !h.contains("kick.com") {
    return false;
  }
  if is_login_url(&h) || is_auth_challenge_url(&h) || is_auth_signal_url(&h) {
    return false;
  }
  if h.contains("id.kick.com") {
    return false;
  }
  if h.contains("about:blank") {
    return false;
  }
  true
}

fn is_kick_domain(domain: &str) -> bool {
  let d = domain.trim().trim_start_matches('.').to_ascii_lowercase();
  d == "kick.com" || d.ends_with(".kick.com")
}

/// Cookie okuma — main thread (WebView2 GetCookies).
fn collect_kick_cookie_pairs(app: &AppHandle) -> Result<Vec<(String, String)>, String> {
  let (tx, rx) = mpsc::sync_channel(1);
  let app_c = app.clone();
  app
    .run_on_main_thread(move || {
      let result = (|| {
        let win = app_c
          .get_webview_window(WIN_LABEL)
          .ok_or_else(|| "Kick giriş penceresi yok".to_string())?;
        let mut map: BTreeMap<String, String> = BTreeMap::new();
        if let Ok(all) = win.cookies() {
          for c in all {
            let d = c.domain().unwrap_or("");
            if is_kick_domain(d) || d.is_empty() {
              let n = c.name().to_string();
              if !n.is_empty() {
                map.insert(n, c.value().to_string());
              }
            }
          }
        }
        if map.is_empty() {
          if let Ok(u) = Url::parse("https://kick.com/") {
            if let Ok(cookies) = win.cookies_for_url(u) {
              for c in cookies {
                let n = c.name().to_string();
                if !n.is_empty() {
                  map.insert(n, c.value().to_string());
                }
              }
            }
          }
        }
        Ok(map.into_iter().collect())
      })();
      let _ = tx.send(result);
    })
    .map_err(|e| format!("cookie UI thread: {e}"))?;

  rx.recv_timeout(Duration::from_secs(8))
    .map_err(|_| "Cookie okuma zaman aşımı".to_string())?
}

#[tauri::command]
pub async fn harvest_kick_bot_cookies(app: AppHandle) -> Result<Value, String> {
  harvest_kick_cookies_inner(&app).await
}

#[tauri::command]
pub fn kick_bot_session_status(state: State<'_, AppState>) -> Value {
  state.kick_session.status()
}

#[tauri::command]
pub async fn kick_bot_session_disconnect(state: State<'_, AppState>) -> Result<Value, String> {
  state.kick_session.disconnect_db(&state.db).await;
  Ok(state.kick_session.status())
}

pub async fn harvest_kick_cookies_inner(app: &AppHandle) -> Result<Value, String> {
  let state = app.state::<AppState>();

  // WebView yoksa Edge CDP yoluna düş (asıl tokensız akış)
  if app.get_webview_window(WIN_LABEL).is_none() {
    yya_warn!("[kick-login] WebView yok → Edge CDP oturum alma");
    return import_kick_session_from_cdp_inner(app).await;
  }

  let pairs = collect_kick_cookie_pairs(app)?;
  let names: Vec<&str> = pairs.iter().map(|(n, _)| n.as_str()).collect();
  yya_warn!("[kick-login] cookies={} names={:?}", pairs.len(), names);

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

  let status = match state
    .kick_session
    .ingest_cookies(&pairs, None, None, None)
  {
    Ok(s) => s,
    Err(e) => {
      let msg = e.to_string();
      if let Some(w) = app.get_webview_window(WIN_LABEL) {
        let _ = w.set_title(&format!(
          "Kick Bot — bekleniyor · {} cookie",
          pairs.len()
        ));
      }
      return Ok(json!({
        "ok": false,
        "ready": false,
        "connected": false,
        "pending": true,
        "error": msg,
        "cookieCount": pairs.len(),
        "cookieNames": names,
      }));
    }
  };

  if status.get("ready").and_then(|v| v.as_bool()).unwrap_or(false) {
    state.kick_session.clear_session_lost();
    if let Err(e) = state.kick_session.persist_to_db(&state.db).await {
      yya_warn!("[kick-login] bot_auth kayıt: {e:#}");
    }
    let chat = ensure_kick_chat_after_session(&state).await;
    let status = state.kick_session.status();
    state.broadcast_json(&json!({
      "type": "kick-bot-session-ready",
      "status": status,
      "chat": chat,
      "t": chrono::Utc::now().timestamp_millis(),
    }));
    if let Some(w) = app.get_webview_window(WIN_LABEL) {
      let _ = w.set_title("Kick Bot — oturum yakalandı ✓");
      silence_webview(&w);
    }
    let app_close = app.clone();
    tauri::async_runtime::spawn(async move {
      // Kısa süre blank'ta tut — panel «Çerezleri Yakala» hâlâ durum alabilsin
      tokio::time::sleep(Duration::from_millis(2500)).await;
      destroy_login_window(&app_close).await;
    });
    yya_log!("[kick-login] oturum hazır · cookies={}", pairs.len());
    return Ok(json!({
      "ok": true,
      "ready": true,
      "status": status,
      "chatConnected": chat.get("chatConnected"),
      "chatroomId": chat.get("chatroomId"),
      "channelSlug": chat.get("channelSlug"),
      "needsChannel": chat.get("needsChannel"),
      "chatError": chat.get("error"),
      "cookieCount": pairs.len(),
    }));
  } else if let Some(w) = app.get_webview_window(WIN_LABEL) {
    let _ = w.set_title(&format!(
      "Kick Bot — giriş / kod bekleniyor (cookie {})",
      pairs.len()
    ));
  }

  Ok(status)
}
