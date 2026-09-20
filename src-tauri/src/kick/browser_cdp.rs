//! Kick bot oturumu — tokensız: Edge (CDP) üzerinden otomatik cookie okuma.
//!
//! Akış:
//! 1. Uygulama Edge’i ayrı profil + `--remote-debugging-port` ile açar
//! 2. Kullanıcı Kick’e normal giriş yapar (Cloudflare gerçek Edge’de geçer)
//! 3. Panel «Oturumu otomatik al» / arka plan poll → CDP cookie okuma
//! 4. Cookie + XSRF bot oturumuna yazılır (yapıştırma yok)

use anyhow::{anyhow, Context, Result};
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicU16, Ordering};
use std::time::Duration;

static CDP_PORT: AtomicU16 = AtomicU16::new(0);

const PROFILE_DIRNAME: &str = "kick-edge-profile";
const LOGIN_URL: &str = "https://id.kick.com/login";
const PORT_FILE: &str = "cdp-port.txt";

fn find_free_port() -> Result<u16> {
  let listener = TcpListener::bind("127.0.0.1:0").context("port bind")?;
  Ok(listener.local_addr()?.port())
}

fn edge_candidates() -> Vec<PathBuf> {
  let mut out = Vec::new();
  if let Ok(pf) = std::env::var("ProgramFiles(x86)") {
    out.push(PathBuf::from(pf).join(r"Microsoft\Edge\Application\msedge.exe"));
  }
  if let Ok(pf) = std::env::var("ProgramFiles") {
    out.push(PathBuf::from(pf).join(r"Microsoft\Edge\Application\msedge.exe"));
  }
  out.push(PathBuf::from(
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
  ));
  out.push(PathBuf::from(
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
  ));
  out
}

fn chrome_candidates() -> Vec<PathBuf> {
  let mut out = Vec::new();
  if let Ok(pf) = std::env::var("ProgramFiles") {
    out.push(PathBuf::from(pf).join(r"Google\Chrome\Application\chrome.exe"));
  }
  if let Ok(pf) = std::env::var("ProgramFiles(x86)") {
    out.push(PathBuf::from(pf).join(r"Google\Chrome\Application\chrome.exe"));
  }
  if let Ok(la) = std::env::var("LOCALAPPDATA") {
    out.push(PathBuf::from(la).join(r"Google\Chrome\Application\chrome.exe"));
  }
  out
}

fn first_existing(paths: &[PathBuf]) -> Option<PathBuf> {
  paths.iter().find(|p| p.is_file()).cloned()
}

fn profile_dir(data_dir: &Path) -> PathBuf {
  data_dir.join(PROFILE_DIRNAME)
}

fn port_file(data_dir: &Path) -> PathBuf {
  profile_dir(data_dir).join(PORT_FILE)
}

fn persist_port(data_dir: &Path, port: u16) {
  let _ = std::fs::create_dir_all(profile_dir(data_dir));
  let _ = std::fs::write(port_file(data_dir), port.to_string());
  CDP_PORT.store(port, Ordering::SeqCst);
}

fn load_persisted_port(data_dir: &Path) -> u16 {
  std::fs::read_to_string(port_file(data_dir))
    .ok()
    .and_then(|s| s.trim().parse().ok())
    .unwrap_or(0)
}

/// Edge/Chrome’u Kick login + CDP ile başlat. Dönüş: { ok, port, browser, profile }.
pub fn launch_kick_browser_cdp(data_dir: &Path) -> Result<Value> {
  // Önce mevcut CDP hâlâ ayakta mı?
  let existing = load_persisted_port(data_dir);
  if existing > 0 {
    CDP_PORT.store(existing, Ordering::SeqCst);
  }

  let edge = first_existing(&edge_candidates());
  let chrome = first_existing(&chrome_candidates());
  let (exe, browser) = match (edge, chrome) {
    (Some(e), _) => (e, "edge"),
    (None, Some(c)) => (c, "chrome"),
    _ => {
      return Err(anyhow!(
        "Edge veya Chrome bulunamadı — lütfen Microsoft Edge kurun"
      ))
    }
  };

  let port = find_free_port()?;
  let profile = profile_dir(data_dir);
  std::fs::create_dir_all(&profile).ok();

  let mut cmd = Command::new(&exe);
  cmd.arg(format!("--remote-debugging-port={port}"))
    .arg(format!("--user-data-dir={}", profile.display()))
    .arg("--no-first-run")
    .arg("--no-default-browser-check")
    .arg("--disable-features=TranslateUI")
    .arg("--disable-background-networking")
    .arg("--new-window")
    .arg(LOGIN_URL);

  #[cfg(windows)]
  {
    use std::os::windows::process::CommandExt;
    const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;
    const DETACHED_PROCESS: u32 = 0x0000_0008;
    cmd.creation_flags(CREATE_NEW_PROCESS_GROUP | DETACHED_PROCESS);
  }

  cmd.spawn()
    .with_context(|| format!("{} başlatılamadı: {}", browser, exe.display()))?;

  persist_port(data_dir, port);
  yya_warn!(
    "[kick-cdp] {browser} açıldı · port={port} · profile={}",
    profile.display()
  );

  Ok(json!({
    "ok": true,
    "browser": browser,
    "port": port,
    "profile": profile.to_string_lossy(),
    "url": LOGIN_URL,
    "hint": "AÇILAN Edge penceresinde (mavi başlık / ayrı pencere) Kick’e giriş yapın. Kendi normal Edge’iniz değil — bu özel giriş penceresi."
  }))
}

pub fn cdp_port() -> u16 {
  CDP_PORT.load(Ordering::SeqCst)
}

pub fn set_cdp_port(port: u16) {
  CDP_PORT.store(port, Ordering::SeqCst);
}

/// Uygulama data_dir ile port dosyasını yükle (import öncesi).
pub fn warm_port_from_disk(data_dir: &Path) {
  let p = load_persisted_port(data_dir);
  if p > 0 && cdp_port() == 0 {
    CDP_PORT.store(p, Ordering::SeqCst);
  }
}

async fn http_get_json(url: &str) -> Result<Value> {
  let client = reqwest::Client::builder()
    .timeout(Duration::from_secs(4))
    .build()?;
  let res = client.get(url).send().await?;
  if !res.status().is_success() {
    return Err(anyhow!("CDP HTTP {}", res.status()));
  }
  Ok(res.json().await?)
}

fn is_kick_domain(domain: &str) -> bool {
  let d = domain.trim_start_matches('.').to_ascii_lowercase();
  d == "kick.com" || d.ends_with(".kick.com") || d.contains("kick.com")
}

fn cookies_from_array(cookies: &[Value]) -> BTreeMap<String, String> {
  let mut map = BTreeMap::new();
  for c in cookies {
    let name = c.get("name").and_then(|n| n.as_str()).unwrap_or("");
    let value = c.get("value").and_then(|n| n.as_str()).unwrap_or("");
    let domain = c.get("domain").and_then(|n| n.as_str()).unwrap_or("");
    if name.is_empty() || value.is_empty() {
      continue;
    }
    if domain.is_empty() || is_kick_domain(domain) {
      map.insert(name.to_string(), value.to_string());
    }
  }
  map
}

fn map_has_xsrf(map: &BTreeMap<String, String>) -> bool {
  map.keys().any(|k| {
    let l = k.to_ascii_lowercase();
    l.contains("xsrf") || l.contains("csrf")
  }) || map.values().any(|v| v.to_ascii_lowercase().contains("xsrf-token"))
}

fn pick_xsrf(map: &BTreeMap<String, String>) -> Option<String> {
  for (k, v) in map {
    let l = k.to_ascii_lowercase();
    if (l.contains("xsrf") || l.contains("csrf")) && !v.is_empty() {
      return Some(
        urlencoding::decode(v)
          .map(|c| c.into_owned())
          .unwrap_or_else(|_| v.clone()),
      );
    }
  }
  None
}

fn looks_logged_in(map: &BTreeMap<String, String>) -> bool {
  map.keys().any(|k| {
    let l = k.to_ascii_lowercase();
    l.contains("session")
      || l.contains("kick_session")
      || l.contains("session_token")
      || l.contains("auth")
      || l == "token"
      || l.contains("laravel")
      || l.contains("sanctum")
      || l.contains("jwt")
      || l.contains("access_token")
      || l.contains("refresh_token")
      || l == "user_id"
      || l.contains("remember")
  }) || (map_has_xsrf(map) && map.len() >= 3)
}

/// CDP WS’ten belirli id’li JSON yanıtı bekle.
async fn cdp_wait_result(
  ws: &mut tokio_tungstenite::WebSocketStream<
    tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
  >,
  expect_id: u64,
  timeout: Duration,
) -> Result<Value> {
  use futures_util::StreamExt;
  use tokio_tungstenite::tungstenite::Message;

  let deadline = tokio::time::Instant::now() + timeout;
  loop {
    let left = deadline.saturating_duration_since(tokio::time::Instant::now());
    if left.is_zero() {
      return Err(anyhow!("CDP yanıt zaman aşımı (id={expect_id})"));
    }
    let msg = tokio::time::timeout(left, ws.next())
      .await
      .map_err(|_| anyhow!("CDP yanıt zaman aşımı (id={expect_id})"))?
      .ok_or_else(|| anyhow!("CDP bağlantısı kapandı"))?
      .context("CDP okuma")?;

    let text = match msg {
      Message::Text(t) => t.to_string(),
      Message::Binary(b) => String::from_utf8_lossy(&b).to_string(),
      _ => continue,
    };
    let v: Value = serde_json::from_str(&text).unwrap_or(json!({}));
    if v.get("method").is_some() && v.get("id").is_none() {
      continue;
    }
    if v.get("id").and_then(|x| x.as_u64()) != Some(expect_id) {
      continue;
    }
    if let Some(err) = v.get("error") {
      return Err(anyhow!("CDP hata id={expect_id}: {err}"));
    }
    return Ok(v);
  }
}

async fn cdp_merge_cookies(
  ws: &mut tokio_tungstenite::WebSocketStream<
    tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
  >,
  map: &mut BTreeMap<String, String>,
  req_id: u64,
) {
  use futures_util::SinkExt;
  use tokio_tungstenite::tungstenite::Message;

  let req = json!({
    "id": req_id,
    "method": "Network.getCookies",
    "params": {
      "urls": [
        "https://kick.com/",
        "https://kick.com",
        "https://www.kick.com/",
        "https://id.kick.com/",
        "https://id.kick.com"
      ]
    }
  });
  if ws.send(Message::Text(req.to_string().into())).await.is_err() {
    return;
  }
  if let Ok(v) = cdp_wait_result(ws, req_id, Duration::from_secs(5)).await {
    let cookies = v
      .pointer("/result/cookies")
      .and_then(|c| c.as_array())
      .cloned()
      .unwrap_or_default();
    for (k, val) in cookies_from_array(&cookies) {
      map.insert(k, val);
    }
  }

  let req2 = json!({ "id": req_id + 1, "method": "Network.getAllCookies" });
  if ws
    .send(Message::Text(req2.to_string().into()))
    .await
    .is_ok()
  {
    if let Ok(v2) = cdp_wait_result(ws, req_id + 1, Duration::from_secs(5)).await {
      let all = v2
        .pointer("/result/cookies")
        .and_then(|c| c.as_array())
        .cloned()
        .unwrap_or_default();
      for (k, val) in cookies_from_array(&all) {
        map.entry(k).or_insert(val);
      }
    }
  }
}

/// Giriş yapılmış ama XSRF yoksa: kick.com’a git + tarayıcı içinde csrf-cookie iste.
/// Not: id.kick.com’da fetch CORS yüzünden başarısız olur — önce mutlaka kick.com’a navigate.
async fn cdp_force_xsrf(
  ws: &mut tokio_tungstenite::WebSocketStream<
    tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
  >,
  map: &mut BTreeMap<String, String>,
) {
  use futures_util::SinkExt;
  use tokio_tungstenite::tungstenite::Message;

  let _ = ws
    .send(Message::Text(
      json!({ "id": 40, "method": "Page.enable" })
        .to_string()
        .into(),
    ))
    .await;
  let _ = cdp_wait_result(ws, 40, Duration::from_secs(3)).await;
  let _ = ws
    .send(Message::Text(
      json!({ "id": 39, "method": "Network.enable" })
        .to_string()
        .into(),
    ))
    .await;
  let _ = cdp_wait_result(ws, 39, Duration::from_secs(3)).await;

  // 1) Ana sayfa — SSO sonrası XSRF burada set edilir
  for (nav_id, url, wait_secs) in [
    (41u64, "https://kick.com/", 4u64),
    (43, "https://kick.com/sanctum/csrf-cookie", 3),
    (45, "https://kick.com/", 3),
  ] {
    let _ = ws
      .send(Message::Text(
        json!({
          "id": nav_id,
          "method": "Page.navigate",
          "params": { "url": url }
        })
        .to_string()
        .into(),
      ))
      .await;
    let _ = cdp_wait_result(ws, nav_id, Duration::from_secs(8)).await;
    tokio::time::sleep(Duration::from_secs(wait_secs)).await;
    cdp_merge_cookies(ws, map, nav_id + 100).await;
    if map_has_xsrf(map) {
      yya_warn!("[kick-cdp] XSRF navigate sonrası bulundu · {url}");
      break;
    }
  }

  // 2) Aynı origin’de sanctum fetch (Cloudflare tarayıcıda geçer)
  let eval = json!({
    "id": 42,
    "method": "Runtime.evaluate",
    "params": {
      "awaitPromise": true,
      "returnByValue": true,
      "expression": r#"(async function(){
        var out = { href: '', cookie: '', xsrf: '', status: 0, err: '' };
        try { out.href = String(location.href || ''); } catch (e) {}
        try {
          var r = await fetch('https://kick.com/sanctum/csrf-cookie', {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Accept': 'application/json, text/plain, */*',
              'X-Requested-With': 'XMLHttpRequest'
            }
          });
          out.status = r.status;
        } catch (e) { out.err = String(e && e.message || e); }
        try {
          await fetch('https://kick.com/', { credentials: 'include' });
        } catch (e) {}
        try { out.cookie = String(document.cookie || ''); } catch (e) {}
        try {
          var m = out.cookie.match(/(?:^|;\s*)(?:XSRF-TOKEN|xsrf-token)=([^;]+)/i);
          if (m) out.xsrf = decodeURIComponent(m[1]);
        } catch (e) {}
        try {
          var meta = document.querySelector('meta[name="csrf-token"]');
          if (meta && meta.content) out.xsrf = out.xsrf || meta.content;
        } catch (e) {}
        return out;
      })()"#
    }
  });
  let _ = ws
    .send(Message::Text(eval.to_string().into()))
    .await;
  if let Ok(v) = cdp_wait_result(ws, 42, Duration::from_secs(15)).await {
    if let Some(val) = v.pointer("/result/result/value") {
      yya_warn!(
        "[kick-cdp] sanctum eval href={} status={} xsrf_len={} err={}",
        val.get("href").and_then(|x| x.as_str()).unwrap_or(""),
        val.get("status").and_then(|x| x.as_u64()).unwrap_or(0),
        val
          .get("xsrf")
          .and_then(|x| x.as_str())
          .map(|s| s.len())
          .unwrap_or(0),
        val.get("err").and_then(|x| x.as_str()).unwrap_or("")
      );
      if let Some(xsrf) = val.get("xsrf").and_then(|x| x.as_str()).filter(|s| !s.is_empty())
      {
        map.insert("XSRF-TOKEN".into(), xsrf.to_string());
      }
      if let Some(cookie) = val.get("cookie").and_then(|c| c.as_str()) {
        for part in cookie.split(';') {
          let part = part.trim();
          if let Some((n, vv)) = part.split_once('=') {
            let n = n.trim();
            if !n.is_empty() {
              map.insert(n.to_string(), vv.trim().to_string());
            }
          }
        }
      }
    }
  }

  cdp_merge_cookies(ws, map, 50).await;

  // Hâlâ yoksa localStorage / sessionStorage tara
  let eval2 = json!({
    "id": 52,
    "method": "Runtime.evaluate",
    "params": {
      "returnByValue": true,
      "expression": r#"(function(){
        var out = { cookie: '', ls: {}, ss: {} };
        try { out.cookie = String(document.cookie || ''); } catch (e) {}
        function scrape(store, dest) {
          try {
            for (var i = 0; i < store.length; i++) {
              var k = store.key(i);
              if (!k) continue;
              var kl = String(k).toLowerCase();
              if (kl.indexOf('token') >= 0 || kl.indexOf('xsrf') >= 0 || kl.indexOf('csrf') >= 0 || kl.indexOf('auth') >= 0 || kl.indexOf('session') >= 0) {
                dest[k] = String(store.getItem(k) || '').slice(0, 4000);
              }
            }
          } catch (e) {}
        }
        scrape(localStorage, out.ls);
        scrape(sessionStorage, out.ss);
        return out;
      })()"#
    }
  });
  let _ = ws
    .send(Message::Text(eval2.to_string().into()))
    .await;
  if let Ok(v) = cdp_wait_result(ws, 52, Duration::from_secs(4)).await {
    if let Some(val) = v.pointer("/result/result/value") {
      if let Some(cookie) = val.get("cookie").and_then(|c| c.as_str()) {
        for part in cookie.split(';') {
          let part = part.trim();
          if let Some((n, vv)) = part.split_once('=') {
            let n = n.trim();
            if !n.is_empty() {
              map.entry(n.to_string()).or_insert_with(|| vv.trim().to_string());
            }
          }
        }
      }
      for key in ["ls", "ss"] {
        if let Some(obj) = val.get(key).and_then(|o| o.as_object()) {
          for (k, v) in obj {
            let Some(s) = v.as_str() else { continue };
            let kl = k.to_ascii_lowercase();
            if (kl.contains("xsrf") || kl.contains("csrf")) && !s.is_empty() {
              map.insert("XSRF-TOKEN".into(), s.to_string());
            }
            if (kl.contains("token") || kl.contains("bearer") || kl.contains("access")) && s.len() > 20
            {
              let token = s
                .trim()
                .trim_start_matches("Bearer ")
                .trim_start_matches("bearer ")
                .trim();
              if token.starts_with('{') {
                if let Ok(j) = serde_json::from_str::<Value>(token) {
                  if let Some(t) = j
                    .get("token")
                    .or_else(|| j.get("access_token"))
                    .or_else(|| j.pointer("/data/token"))
                    .and_then(|x| x.as_str())
                  {
                    map.insert("__bearer".into(), t.to_string());
                  }
                }
              } else if !map.contains_key("__bearer") {
                map.insert("__bearer".into(), token.to_string());
              }
            }
          }
        }
      }
    }
  }

  cdp_merge_cookies(ws, map, 60).await;
  if let Some(x) = pick_xsrf(map) {
    map.insert("XSRF-TOKEN".into(), x);
  }
  yya_warn!(
    "[kick-cdp] force_xsrf bitti · cookies={} xsrf={}",
    map.len(),
    map_has_xsrf(map)
  );
}

async fn cdp_fetch_cookies_on_ws(ws_url: &str) -> Result<BTreeMap<String, String>> {
  use futures_util::SinkExt;
  use tokio_tungstenite::{connect_async, tungstenite::Message};

  let (mut ws, _) = connect_async(ws_url)
    .await
    .context("CDP WebSocket bağlanamadı")?;

  let enable = json!({ "id": 10, "method": "Network.enable" });
  ws.send(Message::Text(enable.to_string().into()))
    .await
    .ok();
  let _ = cdp_wait_result(&mut ws, 10, Duration::from_secs(3)).await;

  let mut map = BTreeMap::new();
  // Sadece oku — login ekranındayken ASLA navigate etme (sürekli yenileme bug’ı)
  cdp_merge_cookies(&mut ws, &mut map, 11).await;

  // document.cookie (navigate yok)
  let eval = json!({
    "id": 16,
    "method": "Runtime.evaluate",
    "params": {
      "returnByValue": true,
      "expression": r#"(function(){
        try { return String(document.cookie || ''); } catch (e) { return ''; }
      })()"#
    }
  });
  let _ = ws
    .send(Message::Text(eval.to_string().into()))
    .await;
  if let Ok(v) = cdp_wait_result(&mut ws, 16, Duration::from_secs(3)).await {
    if let Some(cookie) = v
      .pointer("/result/result/value")
      .and_then(|c| c.as_str())
    {
      for part in cookie.split(';') {
        let part = part.trim();
        if let Some((n, vv)) = part.split_once('=') {
          let n = n.trim();
          if !n.is_empty() {
            map.entry(n.to_string())
              .or_insert_with(|| vv.trim().to_string());
          }
        }
      }
    }
  }

  // Sayfa URL’si (bilgi amaçlı)
  let mut on_login = false;
  let _ = ws
    .send(Message::Text(
      json!({
        "id": 17,
        "method": "Runtime.evaluate",
        "params": {
          "returnByValue": true,
          "expression": "String(location.href||'')"
        }
      })
      .to_string()
      .into(),
    ))
    .await;
  if let Ok(v) = cdp_wait_result(&mut ws, 17, Duration::from_secs(2)).await {
    if let Some(href) = v.pointer("/result/result/value").and_then(|c| c.as_str()) {
      let h = href.to_ascii_lowercase();
      on_login = h.contains("/login")
        || h.contains("/sign")
        || h.contains("id.kick.com")
        || h.contains("/auth");
      yya_warn!("[kick-cdp] page={href} login={on_login}");
    }
  }

  // Giriş cookie’si varsa XSRF yoksa ZORLA al.
  // id.kick.com’da kalsak bile kick.com’a navigate ederiz (CORS yüzünden orada fetch yetmez).
  // Henüz giriş yokken navigate ETME — login yenileme bug’ı.
  if looks_logged_in(&map) && !map_has_xsrf(&map) {
    yya_warn!(
      "[kick-cdp] oturum var, XSRF yok (login_page={on_login}) → kick.com + sanctum zorlanıyor"
    );
    cdp_force_xsrf(&mut ws, &mut map).await;
  } else if looks_logged_in(&map) && map_has_xsrf(&map) {
    if let Some(x) = pick_xsrf(&map) {
      map.insert("XSRF-TOKEN".into(), x);
    }
  }

  // XSRF hâlâ yoksa session_token / access_token’ı bearer olarak dene
  if !map_has_xsrf(&map) && !map.contains_key("__bearer") {
    let mut bearer_candidate: Option<(String, usize)> = None;
    for key in ["session_token", "access_token", "token", "Authorization"] {
      if let Some(v) = map.get(key) {
        let t = v.trim().trim_start_matches("Bearer ").trim().to_string();
        if t.len() > 40 {
          bearer_candidate = Some((t, key.len()));
          yya_warn!("[kick-cdp] bearer adayı: {key}");
          break;
        }
      }
    }
    if let Some((t, _)) = bearer_candidate {
      map.insert("__bearer".into(), t);
    }
  }

  let _ = ws.close(None).await;
  Ok(map)
}

/// Aktif CDP portunu bul (kayıtlı veya yaygın adaylar).
async fn resolve_cdp_targets() -> Result<(u16, Vec<String>)> {
  let mut ports = Vec::new();
  let stored = cdp_port();
  if stored > 0 {
    ports.push(stored);
  }
  for p in [19222u16, 9222, 9333, 9229, 9223, 9224] {
    if !ports.contains(&p) {
      ports.push(p);
    }
  }

  let mut last_err = anyhow!("Edge CDP bulunamadı");
  for port in ports {
    let version_url = format!("http://127.0.0.1:{port}/json/version");
    let list_url = format!("http://127.0.0.1:{port}/json/list");
    let mut ws_urls = Vec::new();

    let mut browser_ws: Option<String> = None;
    if let Ok(v) = http_get_json(&version_url).await {
      if let Some(ws) = v.get("webSocketDebuggerUrl").and_then(|x| x.as_str()) {
        browser_ws = Some(ws.to_string());
      }
    }

    if let Ok(list) = http_get_json(&list_url).await {
      if let Some(arr) = list.as_array() {
        let mut kick_pages = Vec::new();
        let mut other = Vec::new();
        for page in arr {
          let url = page.get("url").and_then(|u| u.as_str()).unwrap_or("");
          let ws = page
            .get("webSocketDebuggerUrl")
            .and_then(|x| x.as_str())
            .unwrap_or("");
          if ws.is_empty() {
            continue;
          }
          if url.starts_with("devtools://") || url == "about:blank" {
            continue;
          }
          if url.contains("kick.com") {
            kick_pages.push(ws.to_string());
          } else {
            other.push(ws.to_string());
          }
        }
        // Önce kick sayfaları (Page.navigate çalışır), browser target en sonda
        ws_urls.extend(kick_pages);
        ws_urls.extend(other);
        if let Some(b) = browser_ws {
          ws_urls.push(b);
        }
      }
    } else if let Some(b) = browser_ws {
      ws_urls.push(b);
    }

    if !ws_urls.is_empty() {
      set_cdp_port(port);
      // sırayı koruyarak tekilleştir
      let mut uniq = Vec::new();
      for u in ws_urls {
        if !uniq.contains(&u) {
          uniq.push(u);
        }
      }
      return Ok((port, uniq));
    }
    last_err = anyhow!("port {port} CDP yanıt vermedi");
  }
  Err(anyhow!(
    "{last_err} — önce «Edge’de Kick’i aç» ile özel giriş penceresini başlatın, o pencerede giriş yapın, sonra «Oturumu otomatik al»"
  ))
}

/// CDP WebSocket üzerinden Kick cookie’lerini çek.
async fn cdp_get_kick_cookies() -> Result<(u16, Vec<(String, String)>)> {
  let (port, ws_urls) = resolve_cdp_targets().await?;
  let mut merged = BTreeMap::new();
  let mut errors = Vec::new();

  for (i, ws_url) in ws_urls.iter().take(6).enumerate() {
    match cdp_fetch_cookies_on_ws(ws_url).await {
      Ok(map) => {
        yya_warn!(
          "[kick-cdp] target#{i} cookies={} logged_in={} xsrf={}",
          map.len(),
          looks_logged_in(&map),
          map_has_xsrf(&map)
        );
        for (k, v) in map {
          merged.insert(k, v); // son gelen (force xsrf) kazansın
        }
        if looks_logged_in(&merged) && map_has_xsrf(&merged) {
          break;
        }
      }
      Err(e) => {
        yya_warn!("[kick-cdp] target#{i} hata: {e:#}");
        errors.push(e.to_string());
      }
    }
  }

  // Hâlâ XSRF yoksa: browser WS üzerinden yeni kick.com sekmesi açıp zorla
  if looks_logged_in(&merged) && !map_has_xsrf(&merged) {
    yya_warn!("[kick-cdp] yeni sekmede XSRF denemesi · port={port}");
    match cdp_xsrf_via_new_tab(port).await {
      Ok(extra) => {
        for (k, v) in extra {
          merged.insert(k, v);
        }
      }
      Err(e) => yya_warn!("[kick-cdp] yeni sekme XSRF: {e:#}"),
    }
  }

  if merged.is_empty() {
    let detail = if errors.is_empty() {
      "Kick çerezi yok".into()
    } else {
      errors.join(" · ")
    };
    return Err(anyhow!(
      "{detail} — açılan özel Edge penceresinde giriş/kod adımlarını tamamlayıp «Oturumu otomatik al»a basın"
    ));
  }

  let names: Vec<&str> = merged.keys().map(|s| s.as_str()).collect();
  yya_warn!(
    "[kick-cdp] birleşik cookies={} names={:?} logged_in={} xsrf={}",
    merged.len(),
    names,
    looks_logged_in(&merged),
    map_has_xsrf(&merged)
  );

  if !looks_logged_in(&merged) {
    return Err(anyhow!(
      "Giriş çerezi henüz yok (cookie: {}) — Edge penceresinde Kick girişini bitirin",
      names.join(", ")
    ));
  }

  // XSRF yoksa ama bearer varsa hazır say — import tarafı yine de XSRF dener
  if !map_has_xsrf(&merged) {
    if merged.contains_key("__bearer")
      || merged.keys().any(|k| {
        let l = k.to_ascii_lowercase();
        l == "session_token" || l == "access_token"
      })
    {
      yya_warn!("[kick-cdp] XSRF yok ama bearer/session_token var — oturum yine de alınacak");
    } else {
      yya_warn!("[kick-cdp] UYARI: oturum var ama XSRF yok — import XSRF tamamlamayı deneyecek");
    }
  }

  Ok((port, merged.into_iter().collect()))
}

/// Browser-level: yeni kick.com sekmesi aç → sanctum → cookie oku → sekmeyi kapat.
async fn cdp_xsrf_via_new_tab(port: u16) -> Result<BTreeMap<String, String>> {
  use futures_util::SinkExt;
  use tokio_tungstenite::{connect_async, tungstenite::Message};

  let version_url = format!("http://127.0.0.1:{port}/json/version");
  let v = http_get_json(&version_url).await?;
  let browser_ws = v
    .get("webSocketDebuggerUrl")
    .and_then(|x| x.as_str())
    .ok_or_else(|| anyhow!("browser WS yok"))?
    .to_string();

  let (mut bws, _) = connect_async(&browser_ws)
    .await
    .context("browser CDP bağlanamadı")?;

  let create = json!({
    "id": 1,
    "method": "Target.createTarget",
    "params": { "url": "https://kick.com/" }
  });
  bws
    .send(Message::Text(create.to_string().into()))
    .await
    .ok();
  let created = cdp_wait_result(&mut bws, 1, Duration::from_secs(8)).await?;
  let target_id = created
    .pointer("/result/targetId")
    .and_then(|x| x.as_str())
    .unwrap_or("")
    .to_string();
  let _ = bws.close(None).await;

  if target_id.is_empty() {
    return Err(anyhow!("Target.createTarget başarısız"));
  }

  tokio::time::sleep(Duration::from_secs(4)).await;

  let list_url = format!("http://127.0.0.1:{port}/json/list");
  let list = http_get_json(&list_url).await?;
  let mut page_ws = None;
  if let Some(arr) = list.as_array() {
    for page in arr {
      let id = page.get("id").and_then(|x| x.as_str()).unwrap_or("");
      let ws = page
        .get("webSocketDebuggerUrl")
        .and_then(|x| x.as_str())
        .unwrap_or("");
      let url = page.get("url").and_then(|u| u.as_str()).unwrap_or("");
      if (!target_id.is_empty() && id == target_id)
        || url.starts_with("https://kick.com")
        || url.starts_with("https://www.kick.com")
      {
        if !ws.is_empty() {
          page_ws = Some(ws.to_string());
          if id == target_id {
            break;
          }
        }
      }
    }
  }

  let page_ws = page_ws.ok_or_else(|| anyhow!("yeni sekme WS bulunamadı"))?;
  let mut map = cdp_fetch_cookies_on_ws(&page_ws).await?;

  if let Ok((mut bws2, _)) = connect_async(&browser_ws).await {
    let _ = bws2
      .send(Message::Text(
        json!({
          "id": 2,
          "method": "Target.closeTarget",
          "params": { "targetId": target_id }
        })
        .to_string()
        .into(),
      ))
      .await;
    let _ = bws2.close(None).await;
  }

  if let Some(x) = pick_xsrf(&map) {
    map.insert("XSRF-TOKEN".into(), x);
  }
  Ok(map)
}

/// Edge sayfa context’inde fetch ile sohbet mesajı gönder (CF JA3 yok).
pub async fn send_chat_via_cdp(
  data_dir: &Path,
  chatroom_id: u64,
  content: &str,
  _cookie_header: &str,
  xsrf: &str,
  bearer: &str,
) -> Result<Value> {
  warm_port_from_disk(data_dir);
  let (port, ws_urls) = resolve_cdp_targets().await?;
  if ws_urls.is_empty() {
    return Err(anyhow!("Edge CDP yok — mesaj için curl kullanılır"));
  }
  set_cdp_port(port);

  let content_json = serde_json::to_string(content)?;
  let xsrf_json = serde_json::to_string(xsrf)?;
  let bearer_json = serde_json::to_string(bearer)?;
  let expr = format!(
    r#"(async () => {{
  const headers = {{
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-XSRF-TOKEN': {xsrf_json}
  }};
  const bearer = {bearer_json};
  if (bearer) headers['Authorization'] = 'Bearer ' + bearer;
  const r = await fetch('https://kick.com/api/v2/messages/send/{chatroom_id}', {{
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify({{ content: {content_json}, type: 'message' }})
  }});
  const t = await r.text();
  return JSON.stringify({{ status: r.status, body: t }});
}})()"#
  );

  use futures_util::SinkExt;
  use tokio_tungstenite::{connect_async, tungstenite::Message};

  let mut last_err = anyhow!("CDP send başarısız");
  for ws_url in ws_urls.iter().take(4) {
    let Ok((mut ws, _)) = connect_async(ws_url).await else {
      continue;
    };
    let _ = ws
      .send(Message::Text(
        json!({ "id": 1, "method": "Network.enable" }).to_string().into(),
      ))
      .await;
    let _ = ws
      .send(Message::Text(
        json!({ "id": 2, "method": "Runtime.enable" }).to_string().into(),
      ))
      .await;
    let eval = json!({
      "id": 10,
      "method": "Runtime.evaluate",
      "params": {
        "expression": expr,
        "awaitPromise": true,
        "returnByValue": true,
        "userGesture": true
      }
    });
    if ws
      .send(Message::Text(eval.to_string().into()))
      .await
      .is_err()
    {
      let _ = ws.close(None).await;
      continue;
    }
    match cdp_wait_result(&mut ws, 10, Duration::from_secs(20)).await {
      Ok(v) => {
        let _ = ws.close(None).await;
        let raw = v
          .pointer("/result/result/value")
          .and_then(|x| x.as_str())
          .unwrap_or("");
        if raw.is_empty() {
          last_err = anyhow!("CDP boş yanıt");
          continue;
        }
        let parsed: Value = serde_json::from_str(raw).unwrap_or(json!({ "raw": raw }));
        let status = parsed.get("status").and_then(|s| s.as_u64()).unwrap_or(0);
        let body = parsed.get("body").and_then(|b| b.as_str()).unwrap_or("");
        if (200..300).contains(&(status as u16)) {
          let body_json: Value =
            serde_json::from_str(body).unwrap_or(json!({ "raw": body }));
          return Ok(body_json);
        }
        last_err = anyhow!("CDP HTTP {status}: {body}");
      }
      Err(e) => {
        let _ = ws.close(None).await;
        last_err = e;
      }
    }
  }
  Err(last_err)
}

/// Edge CDP’den Kick cookie çiftlerini çek.
#[allow(dead_code)]
pub async fn fetch_kick_cookies_via_cdp() -> Result<(u16, Vec<(String, String)>)> {
  cdp_get_kick_cookies().await
}

/// data_dir bilerek çağır (port dosyası + CDP).
pub async fn fetch_kick_cookies_via_cdp_with_data_dir(
  data_dir: &Path,
) -> Result<(u16, Vec<(String, String)>)> {
  warm_port_from_disk(data_dir);
  cdp_get_kick_cookies().await
}

/// Oturum alındıktan sonra özel Edge penceresini kapat.
pub async fn close_kick_browser_cdp(data_dir: &Path) {
  warm_port_from_disk(data_dir);
  let port = cdp_port();
  if port > 0 {
    let version_url = format!("http://127.0.0.1:{port}/json/version");
    if let Ok(v) = http_get_json(&version_url).await {
      if let Some(ws) = v.get("webSocketDebuggerUrl").and_then(|x| x.as_str()) {
        use futures_util::SinkExt;
        use tokio_tungstenite::{connect_async, tungstenite::Message};
        if let Ok((mut sock, _)) = connect_async(ws).await {
          let _ = sock
            .send(Message::Text(
              json!({ "id": 99, "method": "Browser.close" })
                .to_string()
                .into(),
            ))
            .await;
          let _ = sock.close(None).await;
          yya_warn!("[kick-cdp] Browser.close gönderildi · port={port}");
        }
      }
    }
  }

  // Yedek: profil path’li Edge süreçlerini kapat
  let profile = profile_dir(data_dir);
  let profile_s = profile.to_string_lossy().to_string();
  #[cfg(windows)]
  {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    // wmic yerine PowerShell — profil yolunu içeren msedge
    let script = format!(
      "$p = '{}'; Get-CimInstance Win32_Process -Filter \"name='msedge.exe'\" | Where-Object {{ $_.CommandLine -and $_.CommandLine.Contains($p) }} | ForEach-Object {{ Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }}",
      profile_s.replace('\'', "''")
    );
    let mut cmd = Command::new("powershell");
    cmd.args([
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      &script,
    ]);
    cmd.creation_flags(CREATE_NO_WINDOW);
    let _ = cmd.status();
  }
  let _ = std::fs::remove_file(port_file(data_dir));
  CDP_PORT.store(0, Ordering::SeqCst);
}
