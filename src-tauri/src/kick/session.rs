//! Kick cookie tabanlı bot oturumu — kick_session + XSRF-TOKEN.
//! Sırlar OS kasasında (keyring); SQLite/JSON yalnızca kanal meta verisi tutar.

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::{anyhow, Result};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::SqlitePool;
use urlencoding::decode as url_decode;

use super::{client, normalize_slug, UA};

const SESSION_FILE: &str = "kick-bot-session.json";

fn now_ms() -> i64 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|d| d.as_millis() as i64)
    .unwrap_or(0)
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct StoredKickBotSession {
  #[serde(default)]
  pub cookie_header: String,
  #[serde(default)]
  pub xsrf_token: String,
  #[serde(default)]
  pub bearer_token: String,
  #[serde(default)]
  pub username: String,
  #[serde(default)]
  pub user_id: u64,
  #[serde(default)]
  pub channel_slug: String,
  #[serde(default)]
  pub chatroom_id: u64,
  #[serde(default)]
  pub updated_at_ms: i64,
}

pub struct KickBotSession {
  path: PathBuf,
  data: RwLock<StoredKickBotSession>,
  session_lost: RwLock<Option<String>>,
}

impl KickBotSession {
  pub fn new(data_dir: &Path) -> Self {
    let _ = std::fs::create_dir_all(data_dir);
    let path = data_dir.join(SESSION_FILE);
    let mut data: StoredKickBotSession = std::fs::read_to_string(&path)
      .ok()
      .and_then(|t| serde_json::from_str(&t).ok())
      .unwrap_or_default();
    Self::migrate_plaintext_secrets(&data);
    Self::overlay_keyring(&mut data);
    let this = Self {
      path,
      data: RwLock::new(data),
      session_lost: RwLock::new(None),
    };
    this.save();
    this
  }

  fn metadata_only(data: &StoredKickBotSession) -> StoredKickBotSession {
    StoredKickBotSession {
      cookie_header: String::new(),
      xsrf_token: String::new(),
      bearer_token: String::new(),
      username: data.username.clone(),
      user_id: data.user_id,
      channel_slug: data.channel_slug.clone(),
      chatroom_id: data.chatroom_id,
      updated_at_ms: data.updated_at_ms,
    }
  }

  fn migrate_plaintext_secrets(data: &StoredKickBotSession) {
    if data.cookie_header.is_empty() && data.xsrf_token.is_empty() && data.bearer_token.is_empty() {
      return;
    }
    let _ = crate::secret_store::vault_kick_secrets(
      &data.cookie_header,
      &data.xsrf_token,
      &data.bearer_token,
    );
  }

  fn overlay_keyring(data: &mut StoredKickBotSession) {
    let (cookie, xsrf, bearer) = crate::secret_store::load_kick_secrets();
    if !cookie.is_empty() {
      data.cookie_header = cookie;
    }
    if !xsrf.is_empty() {
      data.xsrf_token = xsrf;
    }
    if !bearer.is_empty() {
      data.bearer_token = bearer;
    }
  }

  fn vault_ram_secrets(&self) {
    let data = self.data.read().clone();
    Self::migrate_plaintext_secrets(&data);
  }

  fn save(&self) {
    self.vault_ram_secrets();
    let meta = Self::metadata_only(&self.data.read());
    if let Ok(text) = serde_json::to_string_pretty(&meta) {
      let _ = crate::settings::write_atomic(&self.path, &text);
    }
  }

  pub async fn hydrate_from_db(&self, pool: &SqlitePool) -> Result<()> {
    if let Some(mut stored) = crate::db::bot_auth::load(pool).await? {
      Self::migrate_plaintext_secrets(&stored);
      Self::overlay_keyring(&mut stored);
      *self.data.write() = stored;
      *self.session_lost.write() = None;
      yya_log!("[kick-session] bot oturumu yüklendi");
    } else {
      let mut data = self.data.read().clone();
      Self::overlay_keyring(&mut data);
      *self.data.write() = data;
    }
    self.save();
    // Okuma kilidi `.await` boyunca tutulmasın: bu sırada yazmak isteyen başka
    // bir görev çalışan iş parçacığını kilitlerdi.
    let meta = Self::metadata_only(&self.data.read());
    let _ = crate::db::bot_auth::save(pool, &meta).await;
    Ok(())
  }

  pub async fn persist_to_db(&self, pool: &SqlitePool) -> Result<()> {
    self.vault_ram_secrets();
    let data = self.data.read().clone();
    if data.cookie_header.is_empty()
      && data.xsrf_token.is_empty()
      && data.bearer_token.is_empty()
      && data.username.is_empty()
      && data.channel_slug.is_empty()
    {
      crate::db::bot_auth::clear(pool).await?;
    } else {
      crate::db::bot_auth::save(pool, &Self::metadata_only(&data)).await?;
    }
    self.save();
    Ok(())
  }

  pub fn clear_session_lost(&self) {
    *self.session_lost.write() = None;
  }

  pub fn mark_session_lost(&self, reason: &str) {
    yya_warn!("[kick-session] BAĞLANTI KOPTU · {reason}");
    *self.session_lost.write() = Some(reason.to_string());
  }

  pub fn status(&self) -> Value {
    let d = self.data.read();
    let ready = !d.cookie_header.is_empty()
      && (!d.xsrf_token.is_empty() || !d.bearer_token.is_empty());
    let lost = self.session_lost.read().clone();
    json!({
      "connected": ready && lost.is_none(),
      "ready": ready && lost.is_none(),
      "hasCookies": !d.cookie_header.is_empty(),
      "hasXsrf": !d.xsrf_token.is_empty(),
      "hasBearer": !d.bearer_token.is_empty(),
      "username": d.username,
      "userId": d.user_id,
      "channelSlug": d.channel_slug,
      "chatroomId": d.chatroom_id,
      "updatedAtMs": d.updated_at_ms,
      "sessionLost": lost.is_some(),
      "lostReason": lost.unwrap_or_default(),
    })
  }

  /// Cookie ile kick.com’dan XSRF-TOKEN tamamla.
  /// Cloudflare reqwest’i engelleyebilir → curl.exe (Schannel) yedek.
  pub async fn fetch_missing_xsrf(&self) -> Result<Value> {
    // Önce mevcut cookie header’dan çıkar
    if let Some(x) = Self::extract_xsrf_from_cookie_header(&self.snapshot().cookie_header) {
      {
        let mut d = self.data.write();
        d.xsrf_token = x;
        d.updated_at_ms = now_ms();
      }
      self.save();
      return Ok(self.status());
    }

    let sess = self.snapshot();
    if !sess.xsrf_token.is_empty() {
      return Ok(self.status());
    }
    if sess.cookie_header.is_empty() {
      return Err(anyhow!("Cookie yok — önce giriş çerezlerini alın"));
    }

    let urls = [
      "https://kick.com/sanctum/csrf-cookie",
      "https://kick.com/",
      "https://kick.com/api/v1/user",
    ];

    for url in urls {
      if let Some(xsrf) = Self::fetch_xsrf_via_curl(url, &sess.cookie_header).await {
        {
          let mut d = self.data.write();
          d.xsrf_token = xsrf;
          // curl yeni Set-Cookie döndüyse birleştirmek için cookie’ye de ekle
          if !d.cookie_header.to_ascii_lowercase().contains("xsrf-token") {
            d.cookie_header = format!("{}; XSRF-TOKEN={}", d.cookie_header, d.xsrf_token);
          }
          d.updated_at_ms = now_ms();
        }
        *self.session_lost.write() = None;
        self.save();
        yya_warn!("[kick-session] XSRF curl ile alındı · {url}");
        return Ok(self.status());
      }
      if let Some(xsrf) = self.fetch_xsrf_via_reqwest(url, &sess.cookie_header).await {
        {
          let mut d = self.data.write();
          d.xsrf_token = xsrf;
          d.updated_at_ms = now_ms();
        }
        *self.session_lost.write() = None;
        self.save();
        yya_warn!("[kick-session] XSRF reqwest ile alındı · {url}");
        return Ok(self.status());
      }
    }

    Err(anyhow!(
      "XSRF-TOKEN alınamadı — özel Edge penceresinde kick.com ana sayfasını açıp «Oturumu otomatik al»a tekrar basın"
    ))
  }

  fn extract_xsrf_from_cookie_header(header: &str) -> Option<String> {
    for part in header.split(';') {
      let part = part.trim();
      let Some((n, v)) = part.split_once('=') else {
        continue;
      };
      let nl = n.trim().to_ascii_lowercase();
      if nl == "xsrf-token"
        || nl == "xsrf_token"
        || nl == "csrf-token"
        || nl == "csrf_token"
        || nl.ends_with("xsrf-token")
        || nl.contains("xsrf")
      {
        let raw = v.trim();
        if raw.is_empty() {
          continue;
        }
        return Some(
          url_decode(raw)
            .map(|c| c.into_owned())
            .unwrap_or_else(|_| raw.to_string()),
        );
      }
    }
    None
  }

  fn parse_xsrf_from_set_cookie_block(block: &str) -> Option<String> {
    for line in block.lines() {
      let line = line.trim();
      let lower = line.to_ascii_lowercase();
      if !(lower.starts_with("set-cookie:") || lower.contains("xsrf") || lower.contains("csrf")) {
        // set-cookie satırı değilse ama içerikte token olabilir
        if !lower.contains("xsrf-token=") && !lower.contains("csrf-token=") {
          continue;
        }
      }
      let value_part = line
        .split_once(':')
        .map(|(_, v)| v.trim())
        .unwrap_or(line);
      for part in value_part.split(';') {
        let part = part.trim();
        if let Some(v) = part
          .strip_prefix("XSRF-TOKEN=")
          .or_else(|| part.strip_prefix("xsrf-token="))
          .or_else(|| part.strip_prefix("Xsrf-Token="))
          .or_else(|| part.strip_prefix("csrf_token="))
          .or_else(|| part.strip_prefix("CSRF-TOKEN="))
        {
          if !v.is_empty() {
            return Some(
              url_decode(v)
                .map(|c| c.into_owned())
                .unwrap_or_else(|_| v.to_string()),
            );
          }
        }
      }
    }
    // HTML/meta fallback
    if let Some(i) = block.find("XSRF-TOKEN") {
      let slice = &block[i..block.len().min(i + 220)];
      if let Some(eq) = slice.find('=') {
        let rest = &slice[eq + 1..];
        let end = rest
          .find(|c: char| c == '"' || c == '\'' || c == ';' || c.is_whitespace())
          .unwrap_or(rest.len().min(200));
        let raw = rest[..end].trim_matches(|c| c == '"' || c == '\'');
        if !raw.is_empty() {
          return Some(
            url_decode(raw)
              .map(|c| c.into_owned())
              .unwrap_or_else(|_| raw.to_string()),
          );
        }
      }
    }
    if let Some(i) = block.find("csrf-token\" content=\"") {
      let rest = &block[i + "csrf-token\" content=\"".len()..];
      let end = rest.find('"').unwrap_or(rest.len().min(200));
      let raw = &rest[..end];
      if !raw.is_empty() {
        return Some(raw.to_string());
      }
    }
    None
  }

  async fn fetch_xsrf_via_curl(url: &str, cookie_header: &str) -> Option<String> {
    let dir = std::env::temp_dir();
    let hdr = dir.join(format!("yya-kick-hdr-{}.txt", now_ms()));
    let body = dir.join(format!("yya-kick-body-{}.txt", now_ms()));
    let jar = dir.join(format!("yya-kick-jar-{}.txt", now_ms()));

    let mut cmd = tokio::process::Command::new(crate::sistem_araci::yol("curl.exe"));
    cmd.args([
      "-sS",
      "-L",
      "--max-time",
      "25",
      "-D",
      hdr.to_str()?,
      "-o",
      body.to_str()?,
      "-c",
      jar.to_str()?,
      "-b",
      cookie_header,
      "-A",
      UA,
      "-H",
      "Accept: application/json, text/html, */*",
      "-H",
      "Accept-Language: en-US,en;q=0.9,tr;q=0.8",
      "-H",
      "Origin: https://kick.com",
      "-H",
      "Referer: https://kick.com/",
      "-H",
      "X-Requested-With: XMLHttpRequest",
      url,
    ]);
    #[cfg(windows)]
    {
      const CREATE_NO_WINDOW: u32 = 0x0800_0000;
      cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let output = cmd.output().await.ok()?;
    let hdr_text = std::fs::read_to_string(&hdr).unwrap_or_default();
    let body_text = std::fs::read_to_string(&body).unwrap_or_default();
    let jar_text = std::fs::read_to_string(&jar).unwrap_or_default();
    let err = String::from_utf8_lossy(&output.stderr).to_string();
    let _ = std::fs::remove_file(&hdr);
    let _ = std::fs::remove_file(&body);
    let _ = std::fs::remove_file(&jar);

    // Netscape cookie jar satırından XSRF
    for line in jar_text.lines() {
      if line.starts_with('#') || line.trim().is_empty() {
        continue;
      }
      let cols: Vec<&str> = line.split('\t').collect();
      if cols.len() >= 7 {
        let name = cols[5];
        let val = cols[6];
        let nl = name.to_ascii_lowercase();
        if (nl.contains("xsrf") || nl.contains("csrf")) && !val.is_empty() {
          return Some(
            url_decode(val)
              .map(|c| c.into_owned())
              .unwrap_or_else(|_| val.to_string()),
          );
        }
      }
    }

    Self::parse_xsrf_from_set_cookie_block(&hdr_text)
      .or_else(|| Self::parse_xsrf_from_set_cookie_block(&body_text))
      .or_else(|| Self::parse_xsrf_from_set_cookie_block(&err))
  }

  async fn fetch_xsrf_via_reqwest(&self, url: &str, cookie_header: &str) -> Option<String> {
    let c = client().ok()?;
    let res = c
      .get(url)
      .header("Accept", "text/html,application/json")
      .header("User-Agent", UA)
      .header("Cookie", cookie_header)
      .header("Origin", "https://kick.com")
      .header("Referer", "https://kick.com/")
      .send()
      .await
      .ok()?;
    let mut header_blob = String::new();
    for val in res.headers().get_all(reqwest::header::SET_COOKIE) {
      if let Ok(s) = val.to_str() {
        header_blob.push_str("set-cookie: ");
        header_blob.push_str(s);
        header_blob.push('\n');
      }
    }
    let body = res.text().await.unwrap_or_default();
    header_blob.push_str(&body);
    Self::parse_xsrf_from_set_cookie_block(&header_blob)
  }

  /// Cookie ile giriş yapan bot kullanıcı adını çöz (isteğe bağlı).
  pub async fn resolve_identity(&self) -> Result<Value> {
    let sess = self.snapshot();
    if sess.cookie_header.is_empty() {
      return Ok(self.status());
    }
    let c = client()?;
    let mut req = c
      .get("https://kick.com/api/v1/user")
      .header("Accept", "application/json")
      .header("User-Agent", UA)
      .header("Origin", "https://kick.com")
      .header("Referer", "https://kick.com/")
      .header("Cookie", &sess.cookie_header);
    if !sess.xsrf_token.is_empty() {
      req = req.header("X-XSRF-TOKEN", &sess.xsrf_token);
    }
    if !sess.bearer_token.is_empty() {
      req = req.header("Authorization", format!("Bearer {}", sess.bearer_token));
    }
    let res = req.send().await?;
    if !res.status().is_success() {
      yya_warn!("[kick-session] identity HTTP {}", res.status());
      return Ok(self.status());
    }
    let body: Value = res.json().await.unwrap_or(json!({}));
    let username = body
      .pointer("/user/username")
      .or_else(|| body.get("username"))
      .or_else(|| body.pointer("/data/username"))
      .and_then(|v| v.as_str())
      .unwrap_or("")
      .trim()
      .to_string();
    let user_id = body
      .pointer("/user/id")
      .or_else(|| body.get("id"))
      .and_then(|v| {
        v.as_u64()
          .or_else(|| v.as_i64().map(|n| n as u64))
          .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
      })
      .unwrap_or(0);
    if !username.is_empty() {
      let mut d = self.data.write();
      d.username = username;
      if user_id > 0 {
        d.user_id = user_id;
      }
      d.updated_at_ms = now_ms();
    }
    self.save();
    Ok(self.status())
  }

  pub fn disconnect(&self) {
    crate::secret_store::clear_kick_secrets();
    *self.data.write() = StoredKickBotSession::default();
    *self.session_lost.write() = None;
    self.save();
  }

  pub async fn disconnect_db(&self, pool: &SqlitePool) {
    self.disconnect();
    let _ = crate::db::bot_auth::clear(pool).await;
  }

  pub fn snapshot(&self) -> StoredKickBotSession {
    self.data.read().clone()
  }

  pub fn set_channel_meta(&self, slug: &str, chatroom_id: u64) {
    let mut d = self.data.write();
    let s = normalize_slug(slug);
    if !s.is_empty() {
      d.channel_slug = s;
    }
    if chatroom_id > 0 {
      d.chatroom_id = chatroom_id;
    }
    d.updated_at_ms = now_ms();
    drop(d);
    self.save();
  }

  /// Cookie listesi + opsiyonel document.cookie / localStorage bearer.
  pub fn ingest_cookies(
    &self,
    pairs: &[(String, String)],
    document_cookie: Option<&str>,
    bearer: Option<&str>,
    username_hint: Option<&str>,
  ) -> Result<Value> {
    let mut map: std::collections::BTreeMap<String, String> = std::collections::BTreeMap::new();
    for (n, v) in pairs {
      if !n.is_empty() {
        map.insert(n.clone(), v.clone());
      }
    }
    if let Some(dc) = document_cookie {
      for part in dc.split(';') {
        let part = part.trim();
        if part.is_empty() {
          continue;
        }
        if let Some((n, v)) = part.split_once('=') {
          let n = n.trim();
          if !n.is_empty() && !map.contains_key(n) {
            map.insert(n.to_string(), v.trim().to_string());
          }
        }
      }
    }

    let cookie_header = map
      .iter()
      .filter(|(k, _)| !k.starts_with("__"))
      .map(|(k, v)| format!("{k}={v}"))
      .collect::<Vec<_>>()
      .join("; ");

    let xsrf_raw = map
      .get("XSRF-TOKEN")
      .or_else(|| map.get("xsrf-token"))
      .or_else(|| map.get("Xsrf-Token"))
      .or_else(|| map.get("csrf_token"))
      .or_else(|| map.get("CSRF-TOKEN"))
      .cloned()
      .unwrap_or_default();
    let mut xsrf_token = url_decode(&xsrf_raw)
      .map(|c| c.into_owned())
      .unwrap_or(xsrf_raw);
    if xsrf_token.is_empty() {
      if let Some(x) = Self::extract_xsrf_from_cookie_header(&cookie_header) {
        xsrf_token = x;
      }
    }

    let bearer_from_map = map
      .get("__bearer")
      .cloned()
      .filter(|s| !s.is_empty())
      .or_else(|| {
        // Kick session_token bazen JWT/bearer gibi kullanılabilir
        for key in ["session_token", "sessionToken", "access_token", "token"] {
          if let Some(v) = map.get(key) {
            let t = v.trim();
            if t.len() > 40 && (t.contains('.') || t.starts_with("eyJ")) {
              return Some(t.to_string());
            }
          }
        }
        None
      });

    let has_session = map.keys().any(|k| {
      let l = k.to_lowercase();
      l.contains("kick_session")
        || l == "session_token"
        || l.contains("session")
        || l.contains("auth")
        || l == "token"
        || l.contains("laravel_session")
    });

    if cookie_header.is_empty() {
      return Err(anyhow!("Cookie yakalanamadı — Kick’e giriş yapın"));
    }
    // XSRF yoksa yine de kaydet — async fetch ayrı komutta tamamlanır
    if xsrf_token.is_empty() && !has_session {
      return Err(anyhow!(
        "Oturum çerezi yok — Edge’de giriş yapıp Cookie satırını yapıştırın"
      ));
    }
    if xsrf_token.is_empty() {
      yya_warn!("[kick-session] XSRF yok — oturum kaydedildi, XSRF sonra tamamlanacak");
    }

    {
      let mut d = self.data.write();
      // Mevcut oturumu zayıf/eksik cookie ile silme
      if !cookie_header.is_empty() {
        d.cookie_header = cookie_header;
      }
      // XSRF boş geldiyse eski XSRF’i koru (poll sırasında kaybolmasın)
      if !xsrf_token.is_empty() {
        d.xsrf_token = xsrf_token;
      }
      if let Some(b) = bearer
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .or(bearer_from_map)
      {
        d.bearer_token = b;
      }
      if let Some(u) = username_hint.map(str::trim).filter(|s| !s.is_empty()) {
        d.username = u.to_string();
      }
      d.updated_at_ms = now_ms();
    }
    *self.session_lost.write() = None;
    self.save();
    Ok(self.status())
  }

  /// Mesaj gönder — Cloudflare rustls JA3’ü engeller.
  /// Sıra: 1) curl.exe (Schannel, Botrix benzeri gerçek tarayıcı TLS)
  ///       2) Edge CDP fetch (özel profil açıksa)
  ///       3) reqwest yedek
  pub async fn send_message(&self, chatroom_id: u64, content: &str) -> Result<Value> {
    let content = content.trim();
    if content.is_empty() {
      return Err(anyhow!("boş mesaj"));
    }
    if content.chars().count() > 500 {
      return Err(anyhow!("mesaj 500 karakteri aşamaz"));
    }
    let sess = self.snapshot();
    if sess.cookie_header.is_empty() {
      return Err(anyhow!(
        "Kick bot oturumu yok — Bot sekmesinden Edge’de giriş yapın"
      ));
    }
    if sess.xsrf_token.is_empty() && sess.bearer_token.is_empty() {
      return Err(anyhow!(
        "XSRF veya Bearer yok — Edge’de kick.com açıp «Oturumu otomatik al»"
      ));
    }
    let room = if chatroom_id > 0 {
      chatroom_id
    } else {
      sess.chatroom_id
    };
    if room == 0 {
      return Err(anyhow!("chatroom_id yok — önce Kick sohbeti bağla"));
    }

    let url_v2 = format!("https://kick.com/api/v2/messages/send/{room}");
    let body_v2 = json!({ "content": content, "type": "message" });
    let body_v1 = json!({ "message": content, "chatroom_id": room });

    // 1) curl — Cloudflare rustls engelini aşar (v2 + v1)
    for (url, body) in [
      (url_v2.as_str(), &body_v2),
      (
        "https://kick.com/api/v1/chat-messages",
        &body_v1,
      ),
    ] {
      match Self::send_via_curl(
        url,
        body,
        &sess.cookie_header,
        &sess.xsrf_token,
        &sess.bearer_token,
      )
      .await
      {
        Ok(v) => {
          *self.session_lost.write() = None;
          yya_log!("[kick-session] mesaj OK · curl · room={room} · {url}");
          return Ok(json!({ "ok": true, "via": "curl", "response": v }));
        }
        Err(e) => yya_warn!("[kick-session] curl send ({url}): {e:#}"),
      }
    }

    // 2) Edge CDP — gerçek tarayıcı context
    if let Some(data_dir) = self.path.parent() {
      match super::browser_cdp::send_chat_via_cdp(
        data_dir,
        room,
        content,
        &sess.cookie_header,
        &sess.xsrf_token,
        &sess.bearer_token,
      )
      .await
      {
        Ok(v) => {
          *self.session_lost.write() = None;
          yya_log!("[kick-session] mesaj OK · cdp · room={room}");
          return Ok(json!({ "ok": true, "via": "cdp", "response": v }));
        }
        Err(e) => yya_warn!("[kick-session] cdp send: {e:#}"),
      }
    }

    // 3) reqwest yedek (çoğu makinede CF 403)
    let c = client()?;
    let urls = [
      url_v2.clone(),
      "https://kick.com/api/v1/chat-messages".to_string(),
    ];
    let bodies = [body_v2, body_v1];
    let mut last_err = String::new();
    for (i, url) in urls.iter().enumerate() {
      let body = &bodies[i.min(bodies.len() - 1)];
      let mut req = c
        .post(url)
        .header("Accept", "application/json")
        .header("Content-Type", "application/json")
        .header("User-Agent", UA)
        .header("Origin", "https://kick.com")
        .header("Referer", "https://kick.com/")
        .header("Cookie", &sess.cookie_header);
      if !sess.xsrf_token.is_empty() {
        req = req.header("X-XSRF-TOKEN", &sess.xsrf_token);
      }
      if !sess.bearer_token.is_empty() {
        req = req.header("Authorization", format!("Bearer {}", sess.bearer_token));
      }
      let res = req.json(body).send().await?;
      let status = res.status();
      let text = res.text().await.unwrap_or_default();
      if status.is_success() {
        let parsed: Value = serde_json::from_str(&text).unwrap_or(json!({ "raw": text }));
        *self.session_lost.write() = None;
        yya_log!("[kick-session] mesaj OK · reqwest · room={room}");
        return Ok(json!({ "ok": true, "via": "reqwest", "response": parsed }));
      }
      last_err = format!("{url} → HTTP {status}: {text}");
      let code = status.as_u16();
      // CF 403 = TLS parmak izi; çerezler bozulmuş olmayabilir — oturumu DÜŞÜRME
      if code == 403 {
        yya_warn!(
          "[kick-session] reqwest Cloudflare 403 · curl/CDP dene · xsrf_len={} cookie_len={}",
          sess.xsrf_token.len(),
          sess.cookie_header.len()
        );
        continue;
      }
      if code == 401 || code == 419 || text.to_lowercase().contains("csrf") {
        self.mark_session_lost("CSRF veya oturum hatası — yeniden giriş gerekli");
        return Err(anyhow!("Kick CSRF/oturum hatası ({code}): {text}"));
      }
    }
    Err(anyhow!(
      "Kick mesaj gönderilemedi (Cloudflare/API). OAuth bağlıysa o kullanılır; değilse Edge’de tekrar «Oturumu otomatik al». Son hata: {last_err}"
    ))
  }

  async fn send_via_curl(
    url: &str,
    body: &Value,
    cookie_header: &str,
    xsrf: &str,
    bearer: &str,
  ) -> Result<Value> {
    let dir = std::env::temp_dir();
    let stamp = now_ms();
    let body_file = dir.join(format!("yya-kick-send-{stamp}.json"));
    let out_file = dir.join(format!("yya-kick-send-out-{stamp}.txt"));
    let hdr_file = dir.join(format!("yya-kick-send-hdr-{stamp}.txt"));
    std::fs::write(&body_file, body.to_string()).map_err(|e| anyhow!("body yazılamadı: {e}"))?;

    let body_path = body_file.to_string_lossy().replace('\\', "/");
    let hdr_path = hdr_file.to_string_lossy().replace('\\', "/");
    let out_path = out_file.to_string_lossy().replace('\\', "/");

    // Tüm -H / -b bayrakları URL'den önce olmalı
    let mut args: Vec<String> = vec![
      "-sS".into(),
      "-L".into(),
      "--max-time".into(),
      "25".into(),
      "-X".into(),
      "POST".into(),
      "-D".into(),
      hdr_path,
      "-o".into(),
      out_path,
      "-A".into(),
      UA.into(),
      "-H".into(),
      "Accept: application/json".into(),
      "-H".into(),
      "Content-Type: application/json".into(),
      "-H".into(),
      "Origin: https://kick.com".into(),
      "-H".into(),
      "Referer: https://kick.com/".into(),
      "-b".into(),
      cookie_header.to_string(),
    ];
    if !xsrf.is_empty() {
      args.push("-H".into());
      args.push(format!("X-XSRF-TOKEN: {xsrf}"));
    }
    if !bearer.is_empty() {
      args.push("-H".into());
      args.push(format!("Authorization: Bearer {bearer}"));
    }
    args.push("-d".into());
    args.push(format!("@{body_path}"));
    args.push(url.to_string());

    let mut cmd = tokio::process::Command::new(crate::sistem_araci::yol("curl.exe"));
    cmd.args(&args);
    #[cfg(windows)]
    {
      const CREATE_NO_WINDOW: u32 = 0x0800_0000;
      cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let output = cmd
      .output()
      .await
      .map_err(|e| anyhow!("curl.exe başlatılamadı: {e}"))?;
    let hdr = std::fs::read_to_string(&hdr_file).unwrap_or_default();
    let text = std::fs::read_to_string(&out_file).unwrap_or_default();
    let _ = std::fs::remove_file(&body_file);
    let _ = std::fs::remove_file(&out_file);
    let _ = std::fs::remove_file(&hdr_file);
    if !output.status.success() && text.is_empty() {
      let err = String::from_utf8_lossy(&output.stderr);
      return Err(anyhow!("curl exit {}: {err}", output.status));
    }
    // -L sonrası son HTTP satırı
    let code = hdr
      .lines()
      .rfind(|l| l.starts_with("HTTP/"))
      .and_then(|l| l.split_whitespace().nth(1))
      .and_then(|s| s.parse::<u16>().ok())
      .unwrap_or(0);
    if (200..300).contains(&code) {
      return Ok(serde_json::from_str(&text).unwrap_or(json!({ "raw": text })));
    }
    if text.contains("Just a moment") || text.contains("cf-browser-verification") {
      return Err(anyhow!("curl Cloudflare challenge HTML"));
    }
    Err(anyhow!("curl HTTP {code}: {text}"))
  }

  /// Kick sohbet geçmişini platform tarafında temizler (moderatör oturumu).
  pub async fn clear_chat(&self) -> Result<Value> {
    let sess = self.snapshot();
    if sess.cookie_header.is_empty() || (sess.xsrf_token.is_empty() && sess.bearer_token.is_empty())
    {
      return Err(anyhow!("Kick bot oturumu yok"));
    }
    let slug = normalize_slug(&sess.channel_slug);
    let room = sess.chatroom_id;
    if slug.is_empty() && room == 0 {
      return Err(anyhow!("kanal / chatroom yok"));
    }
    let c = client()?;
    let urls = {
      let mut u = Vec::new();
      if room > 0 {
        u.push(format!("https://kick.com/api/v2/chatrooms/{room}/clear"));
        u.push(format!("https://kick.com/api/v1/chatrooms/{room}/clear"));
      }
      if !slug.is_empty() {
        u.push(format!("https://kick.com/api/v2/channels/{slug}/chatroom/clear"));
      }
      u
    };
    let mut last_err = "Kick clear API yanıt vermedi".to_string();
    for url in urls {
      let mut req = c
        .post(&url)
        .header("Accept", "application/json")
        .header("Content-Type", "application/json")
        .header("User-Agent", UA)
        .header("Origin", "https://kick.com")
        .header("Referer", format!("https://kick.com/{}", slug))
        .header("Cookie", &sess.cookie_header);
      if !sess.xsrf_token.is_empty() {
        req = req.header("X-XSRF-TOKEN", &sess.xsrf_token);
      }
      if !sess.bearer_token.is_empty() {
        req = req.header("Authorization", format!("Bearer {}", sess.bearer_token));
      }
      let res = match req.json(&json!({})).send().await {
        Ok(r) => r,
        Err(e) => {
          last_err = e.to_string();
          continue;
        }
      };
      let status = res.status();
      let text = res.text().await.unwrap_or_default();
      if status.is_success() {
        yya_log!("[kick-session] chat clear OK · {url}");
        return Ok(json!({ "ok": true, "url": url }));
      }
      last_err = format!("HTTP {status}: {text}");
      yya_warn!("[kick-session] clear FAIL · {url} · {last_err}");
    }
    Err(anyhow!(last_err))
  }
}
