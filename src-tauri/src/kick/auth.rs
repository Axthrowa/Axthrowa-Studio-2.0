//! Kick resmi OAuth 2.1 PKCE + chat:write — BotAxT yanıtları için.
//! Token: `{data_dir}/kick-oauth.json`

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::{anyhow, Result};
use base64::Engine;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

use super::{client, fetch_chatroom, normalize_slug, UA};

const SCOPES: &str =
  "chat:write user:read channel:read events:subscribe moderation:ban moderation:chat_message:manage";
const TOKEN_FILE: &str = "kick-oauth.json";
const PENDING_TTL_MS: i64 = 15 * 60 * 1000;
/// Kick `/public/v1/chat` — Botrix gibi tek kuyruk, ~1 mesaj/sn.
const KICK_CHAT_MIN_GAP_MS: i64 = 1200;
const KICK_CHAT_MAX_429: u32 = 3;
const KICK_CHAT_RETRY_CAP_MS: u64 = 8000;

fn now_ms() -> i64 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|d| d.as_millis() as i64)
    .unwrap_or(0)
}

/// Yapıştırma hatalarını temizle: tırnak, BOM, sıfır genişlik, satır sonu.
fn sanitize_credential(raw: &str) -> String {
  raw
    .trim()
    .trim_matches(|c: char| c == '"' || c == '\'' || c == '`' || c == '\u{feff}' || c == '\u{200b}')
    .trim()
    .replace(['\r', '\n', '\t'], "")
}

/// Kick Developer Client ID: UUID, ULID (26 Crockford) veya uzun app id.
/// Kullanıcı adı / kısa slug reddedilir.
fn looks_like_kick_client_id(id: &str) -> bool {
  let id = id.trim();
  if id.len() < 16 {
    return false;
  }
  // Klasik UUID
  if id.contains('-') {
    let hexish = id.chars().filter(|c| c.is_ascii_hexdigit()).count();
    return id.len() >= 32 && hexish >= 28;
  }
  // ULID / Kick app id: 01M2BA2Z5ZTSTX6JX578F3ZZBC (Crockford Base32, 26+)
  let alnum = id
    .chars()
    .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-');
  if !alnum {
    return false;
  }
  if id.len() >= 22 {
    return true;
  }
  // 16–21: yalnızca hex/uzun rastgele id; kısa username (AxthrowA) değil
  let letters = id.chars().filter(|c| c.is_ascii_alphabetic()).count();
  let digits = id.chars().filter(|c| c.is_ascii_digit()).count();
  digits >= 4 && letters >= 4
}

/// Kick Public Chat API:
/// `type=bot` → token sahibinin kanalına uygulama botu yazar (broadcaster yok sayılır).
/// `type=user` → token sahibinin kullanıcı adı yazar; `broadcaster_user_id` hedef kanal.
/// Yayıncı OAuth + aynı kanal → bot. BotAxT OAuth + farklı yayın kanalı → user.
pub fn kick_chat_send_as_bot(oauth_username: &str, target_slug: &str) -> bool {
  let oauth = super::normalize_slug(oauth_username);
  let target = super::normalize_slug(target_slug);
  target.is_empty() || oauth.is_empty() || oauth == target
}

pub fn explain_kick_chat_error(status: u16, body: &str, as_bot: bool) -> String {
  let low = body.to_ascii_lowercase();
  if as_bot
    && (status == 500
      || status == 404
      || low.contains("channel not found")
      || low.contains("not found"))
  {
    return format!(
      "Kick uygulama botu yazamadı ({status}). kick.com/settings/developer → uygulamanızı düzenle → \
       «Create a BOT for this account» (BotAxT). type=user yayıncı hesabından yazar; bu yüzden kendi adınız görünüyordu. \
       BotAxT kullanıcı adıyla göndermek için Kick’te BotAxT ile girip Bağlan’a basın; yayın kanalını ayrı yazın."
    );
  }
  if status == 403 {
    return format!(
      "Kick sohbet yazma reddedildi (403). Bot hesabı kanalda moderatör olmalı veya yayıncı chat:write vermeli. {body}"
    );
  }
  if status == 429 {
    return kick_rate_limit_user_msg().to_string();
  }
  format!("{status}: {body}")
}

pub fn is_kick_rate_limit(msg: &str) -> bool {
  let l = msg.to_ascii_lowercase();
  l.contains("429") || l.contains("rate limit") || l.contains("hız limiti") || l.contains("hiz limiti")
}

pub fn kick_rate_limit_user_msg() -> &'static str {
  "Kick sohbet hız limiti. BotAxT mesajları sıraya alır; birkaç saniye bekleyin. \
   Yayın sohbetinde /mod BotAxT verin (Botrix’te botrixlive nasıl mod ise)."
}

fn parse_retry_after_ms(headers: &reqwest::header::HeaderMap) -> u64 {
  if let Some(v) = headers
    .get("retry-after")
    .and_then(|h| h.to_str().ok())
    .map(str::trim)
  {
    if let Ok(sec) = v.parse::<u64>() {
      return (sec.saturating_mul(1000)).clamp(800, KICK_CHAT_RETRY_CAP_MS);
    }
  }
  2000
}

struct ChatSendGate {
  last_ms: i64,
}

fn map_token_error(status: reqwest::StatusCode, body: &str) -> String {
  let lower = body.to_ascii_lowercase();
  if lower.contains("invalid_client") {
    return format!(
      "{status}: Client ID veya Client Secret hatalı (invalid_client). \
       kick.com/settings/developer → uygulamanızın Client ID (UUID) + Client Secret çiftini \
       birebir yapıştırın. Secret yenilediyseniz eski secret çalışmaz. \
       Redirect URI: http://127.0.0.1:8843/api/kick/oauth/callback"
    );
  }
  format!("{status}: {body}")
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct StoredKick {
  client_id: String,
  #[serde(default)]
  client_secret: String,
  #[serde(default)]
  access_token: String,
  #[serde(default)]
  refresh_token: String,
  #[serde(default)]
  expires_at_ms: i64,
  /// Client-credentials (Kick sitesi oturumuna bağlı değil).
  #[serde(default)]
  app_access_token: String,
  #[serde(default)]
  app_expires_at_ms: i64,
  #[serde(default)]
  username: String,
  #[serde(default)]
  user_id: u64,
  /// Mesajın gideceği yayıncı (genelde kendi kanalın)
  #[serde(default)]
  broadcaster_user_id: u64,
  #[serde(default)]
  broadcaster_slug: String,
}

#[derive(Clone)]
struct PendingAuth {
  verifier: String,
  state: String,
  client_id: String,
  client_secret: String,
  redirect_uri: String,
  broadcaster_slug: String,
  created_ms: i64,
}

pub struct KickAuth {
  path: PathBuf,
  data: RwLock<StoredKick>,
  pending: RwLock<Vec<PendingAuth>>,
  send_gate: tokio::sync::Mutex<ChatSendGate>,
}

impl KickAuth {
  pub fn new(data_dir: &Path) -> Self {
    let _ = std::fs::create_dir_all(data_dir);
    let path = data_dir.join(TOKEN_FILE);
    // eski konum
    let legacy = data_dir.join("app-data").join(TOKEN_FILE);
    let data = load_file(&path)
      .or_else(|| load_file(&legacy))
      .unwrap_or_default();
    Self {
      path,
      data: RwLock::new(data),
      pending: RwLock::new(Vec::new()),
      send_gate: tokio::sync::Mutex::new(ChatSendGate { last_ms: 0 }),
    }
  }

  fn save(&self) {
    let data = self.data.read().clone();
    if let Ok(text) = serde_json::to_string_pretty(&data) {
      let _ = std::fs::write(&self.path, text);
    }
  }

  pub fn status(&self) -> Value {
    let d = self.data.read();
    let has_user = !d.access_token.is_empty() || !d.refresh_token.is_empty();
    let has_app = !d.app_access_token.is_empty()
      || (!d.client_id.is_empty() && !d.client_secret.is_empty());
    let connected = has_user || has_app;
    let send_as_bot = kick_chat_send_as_bot(&d.username, &d.broadcaster_slug);
    json!({
      "connected": connected,
      "ready": connected,
      "username": d.username,
      "userId": d.user_id,
      "broadcasterUserId": d.broadcaster_user_id,
      "broadcasterSlug": d.broadcaster_slug,
      "sendAs": if send_as_bot { "bot" } else { "user" },
      "clientId": d.client_id,
      "hasSecret": !d.client_secret.is_empty(),
      "hasUserToken": has_user,
      "hasAppToken": has_app,
      "via": if has_user { "kick-oauth" } else { "kick-app" },
      "scopes": SCOPES,
    })
  }

  pub fn has_app_credentials(&self) -> bool {
    let d = self.data.read();
    !d.client_id.is_empty() && !d.client_secret.is_empty()
  }

  /// Kullanıcı Kick.com’dan çıksa da Client ID+Secret veya kayıtlı token varsa bot hazır.
  pub fn is_connected(&self) -> bool {
    let d = self.data.read();
    !d.access_token.is_empty()
      || !d.refresh_token.is_empty()
      || !d.app_access_token.is_empty()
      || (!d.client_id.is_empty() && !d.client_secret.is_empty())
  }

  pub fn disconnect(&self) {
    {
      let mut d = self.data.write();
      d.access_token.clear();
      d.refresh_token.clear();
      d.expires_at_ms = 0;
      d.app_access_token.clear();
      d.app_expires_at_ms = 0;
      d.username.clear();
      d.user_id = 0;
      // client_id / secret / slug kalır — tarayıcıya tekrar girmeden hazırlanır
    }
    self.save();
    self.pending.write().clear();
  }

  /// Token değişiminden önce Client ID+Secret doğrula (client_credentials).
  pub async fn validate_client_credentials(
    &self,
    client_id: &str,
    client_secret: &str,
  ) -> Result<()> {
    let client_id = sanitize_credential(client_id);
    let mut secret = sanitize_credential(client_secret);
    if secret.is_empty() {
      secret = sanitize_credential(&self.data.read().client_secret);
    }
    if client_id.is_empty() || secret.is_empty() {
      return Err(anyhow!("Client ID ve Client Secret gerekli"));
    }
    if !looks_like_kick_client_id(&client_id) {
      return Err(anyhow!(
        "Client ID çok kısa («{client_id}»). Kick kullanıcı adı değil — Developer Client ID kullanın"
      ));
    }
    let c = client()?;
    let form = [
      ("grant_type", "client_credentials"),
      ("client_id", client_id.as_str()),
      ("client_secret", secret.as_str()),
    ];
    let res = c
      .post("https://id.kick.com/oauth/token")
      .header("Content-Type", "application/x-www-form-urlencoded")
      .form(&form)
      .send()
      .await?;
    if res.status().is_success() {
      // Doğrulandı — kaydet ki sonraki authorize ile aynı olsun
      {
        let mut d = self.data.write();
        d.client_id = client_id;
        d.client_secret = secret;
      }
      self.save();
      return Ok(());
    }
    let status = res.status();
    let body = res.text().await.unwrap_or_default();
    let lower = body.to_ascii_lowercase();
    // Bazı uygulamalarda client_credentials kapalı olabilir; o durumda authorize’a izin ver
    if lower.contains("unauthorized_client")
      || lower.contains("unsupported_grant")
      || lower.contains("invalid_grant")
      || lower.contains("invalid_request")
    {
      yya_warn!("[kick-oauth] client_credentials ön-kontrol atlandı: {status} {body}");
      {
        let mut d = self.data.write();
        d.client_id = client_id;
        d.client_secret = secret;
      }
      self.save();
      return Ok(());
    }
    Err(anyhow!("{}", map_token_error(status, &body)))
  }

  pub fn authorize_url(
    &self,
    client_id: &str,
    client_secret: &str,
    redirect_uri: &str,
    broadcaster_slug: &str,
  ) -> Result<String> {
    let client_id = sanitize_credential(client_id);
    if client_id.is_empty() {
      return Err(anyhow!("Kick Client ID gerekli (Developer uygulaması UUID)"));
    }
    if !looks_like_kick_client_id(&client_id) {
      return Err(anyhow!(
        "Client ID çok kısa («{client_id}»). Kick kullanıcı adı değil — \
         kick.com/settings/developer → Client ID (ULID/UUID) kopyalayın"
      ));
    }
    let redirect_uri = redirect_uri.trim();
    if redirect_uri.is_empty() {
      return Err(anyhow!("redirect_uri gerekli"));
    }
    let stored_secret = self.data.read().client_secret.clone();
    let secret = {
      let s = sanitize_credential(client_secret);
      if !s.is_empty() {
        s
      } else {
        sanitize_credential(&stored_secret)
      }
    };
    if secret.is_empty() {
      return Err(anyhow!(
        "Kick Client Secret gerekli — Developer uygulamasındaki secret’ı girin"
      ));
    }
    if secret == client_id {
      return Err(anyhow!(
        "Client Secret, Client ID ile aynı — Secret alanına Developer’daki Client Secret’ı yapıştırın"
      ));
    }
    let verifier = format!(
      "{}{}",
      uuid::Uuid::new_v4().simple(),
      uuid::Uuid::new_v4().simple()
    );
    let challenge = base64::engine::general_purpose::URL_SAFE_NO_PAD
      .encode(Sha256::digest(verifier.as_bytes()));
    let state = uuid::Uuid::new_v4().simple().to_string();

    {
      let mut pending = self.pending.write();
      pending.retain(|p| now_ms() - p.created_ms < PENDING_TTL_MS);
      pending.push(PendingAuth {
        verifier,
        state: state.clone(),
        client_id: client_id.clone(),
        client_secret: secret.clone(),
        redirect_uri: redirect_uri.to_string(),
        broadcaster_slug: normalize_slug(broadcaster_slug),
        created_ms: now_ms(),
      });
    }
    {
      let mut d = self.data.write();
      d.client_id = client_id.clone();
      d.client_secret = secret;
      let slug = normalize_slug(broadcaster_slug);
      if !slug.is_empty() {
        d.broadcaster_slug = slug;
      }
    }
    self.save();

    // Kick docs: state zorunlu. 127.0.0.1 kullanılıyorsa Next.js ilk
    // 127.0.0.1’i localhost’a çevirir — redirect_uri’den ÖNCE sacrificial redirect=127.0.0.1
    Ok(build_kick_authorize_url(
      &client_id,
      redirect_uri,
      &challenge,
      &state,
    ))
  }

  pub async fn exchange_code(&self, code: &str, state: Option<&str>) -> Result<String> {
    let code = code.trim();
    if code.is_empty() {
      return Err(anyhow!("authorization code boş"));
    }
    let attempts = {
      let mut pending = self.pending.write();
      pending.retain(|p| now_ms() - p.created_ms < PENDING_TTL_MS);
      let all = pending.clone();
      if let Some(st) = state.map(str::trim).filter(|s| !s.is_empty()) {
        let matched: Vec<_> = all.into_iter().filter(|p| p.state == st).collect();
        if !matched.is_empty() {
          matched
        } else {
          // state eşleşmezse yine de dene (eski tarayıcı oturumu)
          pending.clone()
        }
      } else {
        all
      }
    };
    if attempts.is_empty() {
      return Err(anyhow!(
        "Bekleyen Kick yetkilendirmesi yok — panelde Bağlan’a yeniden basın"
      ));
    }

    let c = client()?;
    let mut last_err = String::new();
    let mut tokens: Option<(Value, PendingAuth)> = None;
    for p in attempts.iter().rev() {
      if p.client_secret.is_empty() {
        last_err = "client_secret boş".into();
        continue;
      }
      let form = [
        ("grant_type", "authorization_code"),
        ("client_id", p.client_id.as_str()),
        ("client_secret", p.client_secret.as_str()),
        ("redirect_uri", p.redirect_uri.as_str()),
        ("code_verifier", p.verifier.as_str()),
        ("code", code),
      ];
      let res = c
        .post("https://id.kick.com/oauth/token")
        .header("Content-Type", "application/x-www-form-urlencoded")
        .form(&form)
        .send()
        .await?;
      if res.status().is_success() {
        tokens = Some((res.json().await?, p.clone()));
        break;
      }
      let status = res.status();
      let body = res.text().await.unwrap_or_default();
      last_err = map_token_error(status, &body);
    }
    let Some((tokens, pending)) = tokens else {
      return Err(anyhow!("Kick token değişimi başarısız ({last_err})"));
    };

    self.apply_tokens(&tokens, &pending.client_id, &pending.client_secret)?;
    let slug = pending.broadcaster_slug.clone();
    let _ = self.refresh_profile().await;
    if !slug.is_empty() {
      let _ = self.resolve_broadcaster(&slug).await;
    } else {
      let _ = self.fetch_my_channel().await;
    }
    // Webhook Developer panelinde tanımlıysa event aboneliği
    let _ = self.subscribe_events().await;
    self.pending.write().clear();
    Ok(self.data.read().username.clone())
  }

  fn apply_tokens(&self, tokens: &Value, client_id: &str, client_secret: &str) -> Result<()> {
    let access = tokens
      .get("access_token")
      .and_then(|v| v.as_str())
      .unwrap_or_default()
      .to_string();
    if access.is_empty() {
      return Err(anyhow!("Kick access_token yok"));
    }
    let refresh = tokens
      .get("refresh_token")
      .and_then(|v| v.as_str())
      .unwrap_or_default()
      .to_string();
    let expires_in = tokens.get("expires_in").and_then(|v| v.as_i64()).unwrap_or(3600);
    {
      let mut d = self.data.write();
      d.client_id = client_id.to_string();
      if !client_secret.is_empty() {
        d.client_secret = client_secret.to_string();
      }
      d.access_token = access;
      if !refresh.is_empty() {
        d.refresh_token = refresh;
      }
      d.expires_at_ms = now_ms() + (expires_in - 60).max(60) * 1000;
    }
    self.save();
    Ok(())
  }

  async fn ensure_access_token(&self) -> Result<String> {
    self.token_inner(false).await
  }

  async fn force_refresh_access_token(&self) -> Result<String> {
    self.token_inner(true).await
  }

  async fn token_inner(&self, force_refresh: bool) -> Result<String> {
    let (access, exp, refresh, client_id, secret) = {
      let d = self.data.read();
      (
        d.access_token.clone(),
        d.expires_at_ms,
        d.refresh_token.clone(),
        d.client_id.clone(),
        d.client_secret.clone(),
      )
    };
    if !force_refresh && !access.is_empty() && now_ms() < exp {
      return Ok(access);
    }
    if refresh.is_empty() || client_id.is_empty() {
      return Err(anyhow!(
        "Kick kullanıcı izni yok — Client ID+Secret kayıtlıysa bot yine de çalışır"
      ));
    }
    if secret.is_empty() {
      return Err(anyhow!(
        "Kick Client Secret eksik — Developer secret’ı kaydedip yeniden bağlanın"
      ));
    }
    let c = client()?;
    let form = [
      ("grant_type", "refresh_token"),
      ("client_id", client_id.as_str()),
      ("client_secret", secret.as_str()),
      ("refresh_token", refresh.as_str()),
    ];
    let res = c
      .post("https://id.kick.com/oauth/token")
      .header("Content-Type", "application/x-www-form-urlencoded")
      .form(&form)
      .send()
      .await?;
    if !res.status().is_success() {
      let status = res.status();
      let body = res.text().await.unwrap_or_default();
      let lower = body.to_ascii_lowercase();
      if lower.contains("invalid_grant") || lower.contains("invalid_token") {
        {
          let mut d = self.data.write();
          d.access_token.clear();
          d.refresh_token.clear();
          d.expires_at_ms = 0;
        }
        self.save();
      }
      return Err(anyhow!("Kick token yenileme başarısız ({})", map_token_error(status, &body)));
    }
    let tokens: Value = res.json().await?;
    self.apply_tokens(&tokens, &client_id, &secret)?;
    Ok(self.data.read().access_token.clone())
  }

  async fn ensure_app_access_token(&self) -> Result<String> {
    let (token, exp, client_id, secret) = {
      let d = self.data.read();
      (
        d.app_access_token.clone(),
        d.app_expires_at_ms,
        d.client_id.clone(),
        d.client_secret.clone(),
      )
    };
    if !token.is_empty() && now_ms() < exp {
      return Ok(token);
    }
    if client_id.is_empty() || secret.is_empty() {
      return Err(anyhow!("Kick Client ID ve Client Secret gerekli"));
    }
    let c = client()?;
    let form = [
      ("grant_type", "client_credentials"),
      ("client_id", client_id.as_str()),
      ("client_secret", secret.as_str()),
    ];
    let res = c
      .post("https://id.kick.com/oauth/token")
      .header("Content-Type", "application/x-www-form-urlencoded")
      .form(&form)
      .send()
      .await?;
    if !res.status().is_success() {
      let status = res.status();
      let body = res.text().await.unwrap_or_default();
      return Err(anyhow!(
        "Kick uygulama tokenı alınamadı ({})",
        map_token_error(status, &body)
      ));
    }
    let tokens: Value = res.json().await?;
    let access = tokens
      .get("access_token")
      .and_then(|v| v.as_str())
      .unwrap_or_default()
      .to_string();
    if access.is_empty() {
      return Err(anyhow!("Kick uygulama access_token yok"));
    }
    let expires_in = tokens.get("expires_in").and_then(|v| v.as_i64()).unwrap_or(7200);
    {
      let mut d = self.data.write();
      d.app_access_token = access.clone();
      d.app_expires_at_ms = now_ms() + (expires_in - 60).max(60) * 1000;
    }
    self.save();
    Ok(access)
  }

  /// Açılış / periyodik: kullanıcı tokenını yenile, yoksa uygulama tokenı al.
  /// Kick.com tarayıcı çıkışı gerekmez.
  pub async fn warmup(&self) -> Value {
    if self.has_app_credentials() {
      if let Err(e) = self.ensure_app_access_token().await {
        yya_warn!("[kick-oauth] uygulama tokenı: {e:#}");
      }
    }
    let has_refresh = !self.data.read().refresh_token.is_empty();
    if has_refresh {
      match self.force_refresh_access_token().await {
        Ok(_) => {
          let _ = self.refresh_profile().await;
        }
        Err(e) => {
          yya_warn!("[kick-oauth] kullanıcı tokenı yenilenemedi: {e:#} — uygulama tokenı ile devam");
        }
      }
    }
    self.status()
  }

  pub async fn prepare(
    &self,
    client_id: &str,
    client_secret: &str,
    broadcaster_slug: &str,
  ) -> Result<Value> {
    self
      .validate_client_credentials(client_id, client_secret)
      .await?;
    let slug = super::normalize_slug(broadcaster_slug);
    if !slug.is_empty() {
      {
        let mut d = self.data.write();
        d.broadcaster_slug = slug;
      }
      self.save();
    }
    self.ensure_app_access_token().await?;
    Ok(self.warmup().await)
  }

  async fn refresh_profile(&self) -> Result<()> {
    let token = self.ensure_access_token().await?;
    let c = client()?;
    let res = c
      .get("https://api.kick.com/public/v1/users")
      .bearer_auth(&token)
      .send()
      .await?;
    if !res.status().is_success() {
      return Ok(());
    }
    let body: Value = res.json().await.unwrap_or(json!({}));
    // { data: [ { user_id, name, ... } ] } veya { data: { ... } }
    let user = body
      .pointer("/data/0")
      .or_else(|| body.pointer("/data"))
      .cloned()
      .unwrap_or(json!({}));
    let user_id = user
      .get("user_id")
      .or_else(|| user.get("id"))
      .and_then(|v| v.as_u64().or_else(|| v.as_str().and_then(|s| s.parse().ok())))
      .unwrap_or(0);
    let name = user
      .get("name")
      .or_else(|| user.get("username"))
      .and_then(|v| v.as_str())
      .unwrap_or("")
      .to_string();
    {
      let mut d = self.data.write();
      if !name.is_empty() {
        d.username = name.clone();
      }
      if user_id > 0 {
        d.user_id = user_id;
        let oauth = super::normalize_slug(&d.username);
        let keep_other_channel =
          !d.broadcaster_slug.is_empty() && d.broadcaster_slug != oauth;
        if d.broadcaster_user_id == 0 && !keep_other_channel {
          d.broadcaster_user_id = user_id;
        }
      }
    }
    self.save();
    Ok(())
  }

  pub async fn resolve_broadcaster(&self, slug: &str) -> Result<u64> {
    let slug = normalize_slug(slug);
    if slug.is_empty() {
      return Err(anyhow!("slug boş"));
    }
    // 1) Resmi Kick API
    if let Ok(ch) = self.fetch_channel_by_slug(&slug).await {
      let id = ch
        .get("broadcaster_user_id")
        .and_then(|v| v.as_u64().or_else(|| v.as_str().and_then(|s| s.parse().ok())))
        .unwrap_or(0);
      if id > 0 {
        {
          let mut d = self.data.write();
          d.broadcaster_user_id = id;
          d.broadcaster_slug = slug.clone();
        }
        self.save();
        return Ok(id);
      }
    }
    // 2) Yedek: public scrape
    let info = fetch_chatroom(&slug).await?;
    let id = info
      .get("userId")
      .or_else(|| info.get("channelId"))
      .and_then(|v| v.as_u64())
      .unwrap_or(0);
    let id = if id > 0 {
      id
    } else {
      resolve_user_id_for_slug(&slug).await.unwrap_or(0)
    };
    if id == 0 {
      return Err(anyhow!("Kick broadcaster user id bulunamadı ({slug})"));
    }
    {
      let mut d = self.data.write();
      d.broadcaster_user_id = id;
      d.broadcaster_slug = slug;
    }
    self.save();
    Ok(id)
  }

  /// `GET /public/v1/channels?slug=`
  pub async fn fetch_channel_by_slug(&self, slug: &str) -> Result<Value> {
    let token = match self.ensure_access_token().await {
      Ok(t) => t,
      Err(_) => self.ensure_app_access_token().await?,
    };
    let slug = normalize_slug(slug);
    let c = client()?;
    let url = format!(
      "https://api.kick.com/public/v1/channels?slug={}",
      urlencoding::encode(&slug)
    );
    let res = c.get(&url).bearer_auth(&token).send().await?;
    let status = res.status();
    let body: Value = res.json().await.unwrap_or(json!({}));
    if !status.is_success() {
      return Err(anyhow!("Kick channels API {status}: {body}"));
    }
    body
      .pointer("/data/0")
      .cloned()
      .or_else(|| body.get("data").and_then(|d| d.as_array()).and_then(|a| a.first().cloned()))
      .ok_or_else(|| anyhow!("Kick kanal bulunamadı ({slug})"))
  }

  /// OAuth kullanıcısının kanal özeti (API).
  pub async fn fetch_my_channel(&self) -> Result<Value> {
    let token = match self.ensure_access_token().await {
      Ok(t) => t,
      Err(_) => self.ensure_app_access_token().await?,
    };
    let c = client()?;
    let res = c
      .get("https://api.kick.com/public/v1/channels")
      .bearer_auth(&token)
      .send()
      .await?;
    let status = res.status();
    let body: Value = res.json().await.unwrap_or(json!({}));
    if !status.is_success() {
      return Err(anyhow!("Kick my channel {status}: {body}"));
    }
    let ch = body
      .pointer("/data/0")
      .cloned()
      .or_else(|| body.get("data").and_then(|d| d.as_array()).and_then(|a| a.first().cloned()))
      .unwrap_or(json!({}));
    if let Some(slug) = ch.get("slug").and_then(|s| s.as_str()) {
      let slug = normalize_slug(slug);
      let bid = ch
        .get("broadcaster_user_id")
        .and_then(|v| v.as_u64().or_else(|| v.as_str().and_then(|s| s.parse().ok())))
        .unwrap_or(0);
      {
        let mut d = self.data.write();
        let oauth = super::normalize_slug(&d.username);
        let keep_other_channel =
          !d.broadcaster_slug.is_empty() && d.broadcaster_slug != oauth;
        if !keep_other_channel {
          if !slug.is_empty() {
            d.broadcaster_slug = slug;
          }
          if bid > 0 {
            d.broadcaster_user_id = bid;
          }
        }
      }
      self.save();
    }
    Ok(ch)
  }

  /// Kullanıcı adı / slug → user_id (channels API).
  pub async fn resolve_user_id(&self, name: &str) -> Result<u64> {
    let slug = normalize_slug(name);
    if slug.is_empty() {
      return Err(anyhow!("kullanıcı adı boş"));
    }
    let ch = self.fetch_channel_by_slug(&slug).await?;
    ch.get("broadcaster_user_id")
      .and_then(|v| v.as_u64().or_else(|| v.as_str().and_then(|s| s.parse().ok())))
      .filter(|id| *id > 0)
      .ok_or_else(|| anyhow!("Kick kullanıcı id bulunamadı ({slug})"))
  }

  /// Resmi moderasyon: timeout (dakika) veya kalıcı ban.
  pub async fn moderation_ban(
    &self,
    target_username: &str,
    duration_min: Option<u64>,
    reason: &str,
  ) -> Result<Value> {
    let token = self.ensure_access_token().await?;
    let broadcaster = {
      let d = self.data.read();
      if d.broadcaster_user_id > 0 {
        d.broadcaster_user_id
      } else {
        d.user_id
      }
    };
    if broadcaster == 0 {
      return Err(anyhow!("Kick broadcaster yok — OAuth ile bağlan"));
    }
    let user_id = self.resolve_user_id(target_username).await?;
    let mut body = json!({
      "broadcaster_user_id": broadcaster,
      "user_id": user_id,
      "reason": reason.chars().take(100).collect::<String>(),
    });
    if let Some(mins) = duration_min {
      body
        .as_object_mut()
        .unwrap()
        .insert("duration".into(), json!(mins.clamp(1, 10080)));
    }
    let c = client()?;
    let res = c
      .post("https://api.kick.com/public/v1/moderation/bans")
      .bearer_auth(&token)
      .header("Content-Type", "application/json")
      .json(&body)
      .send()
      .await?;
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    if !status.is_success() {
      return Err(anyhow!("Kick moderation ban {status}: {text}"));
    }
    Ok(serde_json::from_str(&text).unwrap_or(json!({ "ok": true })))
  }

  pub async fn moderation_unban(&self, target_username: &str) -> Result<Value> {
    let token = self.ensure_access_token().await?;
    let broadcaster = {
      let d = self.data.read();
      if d.broadcaster_user_id > 0 {
        d.broadcaster_user_id
      } else {
        d.user_id
      }
    };
    let user_id = self.resolve_user_id(target_username).await?;
    let c = client()?;
    let res = c
      .delete("https://api.kick.com/public/v1/moderation/bans")
      .bearer_auth(&token)
      .header("Content-Type", "application/json")
      .json(&json!({
        "broadcaster_user_id": broadcaster,
        "user_id": user_id,
      }))
      .send()
      .await?;
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    if !status.is_success() {
      return Err(anyhow!("Kick unban {status}: {text}"));
    }
    Ok(serde_json::from_str(&text).unwrap_or(json!({ "ok": true })))
  }

  pub async fn delete_chat_message(&self, message_id: &str) -> Result<()> {
    let message_id = message_id.trim();
    if message_id.is_empty() {
      return Err(anyhow!("message_id boş"));
    }
    let token = self.ensure_access_token().await?;
    let c = client()?;
    let res = c
      .delete(format!(
        "https://api.kick.com/public/v1/chat/{}",
        urlencoding::encode(message_id)
      ))
      .bearer_auth(&token)
      .send()
      .await?;
    let status = res.status();
    if status.is_success() || status.as_u16() == 204 {
      return Ok(());
    }
    let text = res.text().await.unwrap_or_default();
    Err(anyhow!("Kick mesaj silme {status}: {text}"))
  }

  /// Webhook URL Kick Developer panelinde tanımlı olmalı (localhost çalışmaz).
  pub async fn subscribe_events(&self) -> Result<Value> {
    let token = self.ensure_access_token().await?;
    let broadcaster = {
      let d = self.data.read();
      if d.broadcaster_user_id > 0 {
        d.broadcaster_user_id
      } else {
        d.user_id
      }
    };
    let events = [
      ("chat.message.sent", 1),
      ("channel.followed", 1),
      ("channel.subscription.new", 1),
      ("channel.subscription.renewal", 1),
      ("channel.subscription.gifts", 1),
      ("livestream.status.updated", 1),
      ("moderation.banned", 1),
      ("kicks.gifted", 1),
    ]
    .iter()
    .map(|(name, ver)| json!({ "name": name, "version": ver }))
    .collect::<Vec<_>>();
    let body = json!({
      "broadcaster_user_id": broadcaster,
      "events": events,
      "method": "webhook",
    });
    let c = client()?;
    let res = c
      .post("https://api.kick.com/public/v1/events/subscriptions")
      .bearer_auth(&token)
      .header("Content-Type", "application/json")
      .json(&body)
      .send()
      .await?;
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    let parsed: Value = serde_json::from_str(&text).unwrap_or(json!({ "raw": text }));
    if !status.is_success() {
      // Yerel masaüstü için webhook genelde yok — soft fail
      yya_warn!("[kick-api] event subscribe {status}: {text}");
      return Ok(json!({ "ok": false, "status": status.as_u16(), "response": parsed }));
    }
    Ok(json!({ "ok": true, "response": parsed }))
  }

  /// Bot hub: API profil + kanal.
  pub async fn hub_snapshot(&self) -> Value {
    let mut status = self.status();
    if !self.is_connected() {
      return status;
    }
    match self.fetch_my_channel().await {
      Ok(ch) => {
        if let Some(obj) = status.as_object_mut() {
          obj.insert("channel".into(), ch);
        }
        // slug/id güncellendi — status’u yeniden oku, kanalı koru
        let channel = status.get("channel").cloned();
        status = self.status();
        if let (Some(obj), Some(ch)) = (status.as_object_mut(), channel) {
          obj.insert("channel".into(), ch);
        }
      }
      Err(e) => yya_warn!("[kick-api] hub channel: {e:#}"),
    }
    status
  }

  /// BotAxT satırını Kick chat’e gönder (tek kuyruk, 429 bekleyip yeniden dener).
  pub async fn send_chat(&self, text: &str, slug_hint: Option<&str>) -> Result<Value> {
    let content = text.trim();
    if content.is_empty() {
      return Err(anyhow!("boş mesaj"));
    }
    if content.chars().count() > 500 {
      return Err(anyhow!("mesaj 500 karakteri aşamaz"));
    }

    let user_token = self.ensure_access_token().await.ok();
    let app_token = self.ensure_app_access_token().await.ok();
    if user_token.is_none() && app_token.is_none() {
      return Err(anyhow!(
        "Kick API hazır değil. Chatbot’a Client ID + Secret yazıp kaydedin. \
         Kick.com tarayıcı oturumu açık tutmanız gerekmez; token uygulamada saklanır."
      ));
    }

    let stored = self.data.read().clone();
    let target_slug = slug_hint
      .map(normalize_slug)
      .filter(|s| !s.is_empty())
      .or_else(|| {
        if stored.broadcaster_slug.is_empty() {
          None
        } else {
          Some(stored.broadcaster_slug.clone())
        }
      })
      .unwrap_or_else(|| super::normalize_slug(&stored.username));
    let as_bot = kick_chat_send_as_bot(&stored.username, &target_slug);

    let mut broadcaster = stored.broadcaster_user_id;
    if !target_slug.is_empty() && (target_slug != stored.broadcaster_slug || broadcaster == 0)
    {
      broadcaster = self.resolve_broadcaster(&target_slug).await.unwrap_or(broadcaster);
    }
    if broadcaster == 0 {
      broadcaster = self.data.read().user_id;
    }
    if !as_bot && broadcaster == 0 && user_token.is_some() {
      return Err(anyhow!(
        "Kick kanal kimliği yok — yayıncı Kick kullanıcı adını yazıp sohbeti bağlayın"
      ));
    }

    let bot_body = json!({ "content": content, "type": "bot" });
    let user_body = json!({
      "broadcaster_user_id": broadcaster,
      "content": content,
      "type": "user",
    });

    // Uygulama tokenı Kick.com çıkışından etkilenmez. Kullanıcı tokenı yedek (401/403).
    let mut attempts: Vec<(String, Value, &'static str, bool)> = Vec::new();
    if as_bot {
      if let Some(t) = &app_token {
        attempts.push((t.clone(), bot_body.clone(), "bot", true));
      }
      if let Some(t) = &user_token {
        attempts.push((t.clone(), bot_body.clone(), "bot", false));
      }
    } else if let Some(t) = &user_token {
      attempts.push((t.clone(), user_body.clone(), "user", false));
    } else if let Some(t) = &app_token {
      attempts.push((t.clone(), bot_body.clone(), "bot", true));
    }

    let c = client()?;
    let mut gate = self.send_gate.lock().await;
    let mut last_err = String::new();

    for (mut token, body, send_type, via_app) in attempts {
      let mut rate_tries = 0u32;
      let mut refreshed = false;
      loop {
        let elapsed = now_ms() - gate.last_ms;
        let need = KICK_CHAT_MIN_GAP_MS - elapsed;
        if need > 0 {
          tokio::time::sleep(std::time::Duration::from_millis(need as u64)).await;
        }
        gate.last_ms = now_ms();

        let res = c
          .post("https://api.kick.com/public/v1/chat")
          .bearer_auth(&token)
          .header("Accept", "application/json")
          .header("Content-Type", "application/json")
          .json(&body)
          .send()
          .await?;
        let status = res.status();
        let retry_ms = parse_retry_after_ms(res.headers());
        let text_body = res.text().await.unwrap_or_default();
        if status.is_success() {
          let parsed: Value = serde_json::from_str(&text_body).unwrap_or(json!({ "raw": text_body }));
          yya_log!(
            "[kick-api] chat OK · type={send_type} · channel={target_slug} · via={}",
            if via_app { "app" } else { "user" }
          );
          return Ok(json!({
            "ok": true,
            "via": if via_app { "kick-app" } else { "kick-api" },
            "sendAs": send_type,
            "channel": target_slug,
            "oauthUser": stored.username,
            "response": parsed
          }));
        }

        last_err = explain_kick_chat_error(status.as_u16(), &text_body, send_type == "bot");
        yya_warn!("[kick-api] chat fail · {last_err}");

        if status.as_u16() == 429 {
          rate_tries += 1;
          if rate_tries > KICK_CHAT_MAX_429 {
            return Err(anyhow!(kick_rate_limit_user_msg()));
          }
          tokio::time::sleep(std::time::Duration::from_millis(retry_ms)).await;
          continue;
        }

        if status.as_u16() == 401 && !via_app && !refreshed {
          if let Ok(new_token) = self.force_refresh_access_token().await {
            token = new_token;
            refreshed = true;
            continue;
          }
        }

        // 429 değilse diğer token’a geç (401/403/500). 429’da yukarıda return/continue.
        break;
      }
    }
    Err(anyhow!("Kick API chat gönderilemedi ({last_err})"))
  }
}

fn load_file(path: &Path) -> Option<StoredKick> {
  let text = std::fs::read_to_string(path).ok()?;
  serde_json::from_str(&text).ok()
}

async fn resolve_user_id_for_slug(slug: &str) -> Option<u64> {
  let c = client().ok()?;
  for url in [
    format!("https://kick.com/api/v2/channels/{slug}"),
    format!("https://kick.com/api/v1/channels/{slug}"),
  ] {
    let Ok(res) = c
      .get(&url)
      .header("User-Agent", UA)
      .header("Accept", "application/json, text/plain, */*")
      .header("Accept-Language", "en-US,en;q=0.9,tr;q=0.8")
      .header("Origin", "https://kick.com")
      .header("Referer", format!("https://kick.com/{slug}"))
      .send()
      .await
    else {
      continue;
    };
    if !res.status().is_success() {
      yya_warn!(
        "[kick] resolve_user_id HTTP {} · {url}",
        res.status()
      );
      continue;
    }
    let Ok(j) = res.json::<Value>().await else {
      continue;
    };
    if let Some(id) = j
      .get("id")
      .and_then(|v| v.as_u64().or_else(|| v.as_str().and_then(|s| s.parse().ok())))
    {
      if id > 0 {
        return Some(id);
      }
    }
    if let Some(id) = j
      .pointer("/user_id")
      .and_then(|v| v.as_u64().or_else(|| v.as_str().and_then(|s| s.parse().ok())))
    {
      if id > 0 {
        return Some(id);
      }
    }
  }
  // Official API with no auth may fail; try public v1 channels?skip
  None
}

/// Kick OAuth authorize URL — docs: state zorunlu; 127.0.0.1 için sacrificial redirect.
pub fn build_kick_authorize_url(
  client_id: &str,
  redirect_uri: &str,
  code_challenge: &str,
  state: &str,
) -> String {
  let scope = urlencoding::encode(SCOPES);
  let mut parts: Vec<String> = Vec::with_capacity(8);
  parts.push("response_type=code".to_string());
  parts.push(format!("client_id={}", urlencoding::encode(client_id)));
  // Next.js bug: ilk 127.0.0.1 → localhost; redirect_uri bozulmasın diye önce sacrificial param
  if redirect_uri.contains("127.0.0.1") {
    parts.push("redirect=127.0.0.1".to_string());
  }
  parts.push(format!(
    "redirect_uri={}",
    urlencoding::encode(redirect_uri)
  ));
  parts.push(format!("scope={scope}"));
  parts.push(format!(
    "code_challenge={}",
    urlencoding::encode(code_challenge)
  ));
  parts.push("code_challenge_method=S256".to_string());
  parts.push(format!("state={}", urlencoding::encode(state)));
  format!("https://id.kick.com/oauth/authorize?{}", parts.join("&"))
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn authorize_url_includes_state_and_sacrificial_redirect() {
    let url = build_kick_authorize_url(
      "11111111-2222-3333-4444-555555555555",
      "http://127.0.0.1:8843/api/kick/oauth/callback",
      "challengeABC",
      "stateXYZ",
    );
    assert!(url.contains("state=stateXYZ"), "{url}");
    assert!(url.contains("redirect=127.0.0.1"), "{url}");
    assert!(
      url.find("redirect=127.0.0.1").unwrap() < url.find("redirect_uri=").unwrap(),
      "sacrificial redirect must precede redirect_uri: {url}"
    );
    assert!(url.contains("code_challenge=challengeABC"), "{url}");
    assert!(url.contains("code_challenge_method=S256"), "{url}");
  }

  #[test]
  fn kick_client_id_accepts_ulid_and_uuid_rejects_username() {
    assert!(looks_like_kick_client_id("01M2BA2Z5ZTSTX6JX578F3ZZBC"));
    assert!(looks_like_kick_client_id("11111111-2222-3333-4444-555555555555"));
    assert!(!looks_like_kick_client_id("AxthrowA"));
    assert!(!looks_like_kick_client_id("kick"));
    assert_eq!(
      sanitize_credential("  \"01M2BA2Z5ZTSTX6JX578F3ZZBC\" \n"),
      "01M2BA2Z5ZTSTX6JX578F3ZZBC"
    );
  }

  #[test]
  fn authorize_url_skips_sacrificial_for_localhost() {
    let url = build_kick_authorize_url(
      "cid",
      "http://localhost:8843/api/kick/oauth/callback",
      "ch",
      "st",
    );
    assert!(!url.contains("redirect=127.0.0.1"), "{url}");
    assert!(url.contains("state=st"), "{url}");
  }

  #[test]
  fn send_as_bot_when_oauth_is_the_channel() {
    assert!(kick_chat_send_as_bot("AxthrowA", "axthrowa"));
    assert!(kick_chat_send_as_bot("botaxt", ""));
    assert!(kick_chat_send_as_bot("", "axthrowa"));
  }

  #[test]
  fn send_as_user_when_bot_oauth_targets_streamer() {
    assert!(!kick_chat_send_as_bot("BotAxT", "axthrowa"));
    assert!(!kick_chat_send_as_bot("botaxt", "kick.com/AxthrowA"));
  }

  #[test]
  fn bot_send_error_explains_create_bot() {
    let msg = explain_kick_chat_error(500, r#"{"data":"Channel not found"}"#, true);
    assert!(msg.contains("Create a BOT"), "{msg}");
    assert!(msg.contains("type=user"), "{msg}");
  }

  #[test]
  fn rate_limit_error_is_detected() {
    assert!(is_kick_rate_limit("429: {\"message\":\"Rate limit exceeded\"}"));
    assert!(is_kick_rate_limit(kick_rate_limit_user_msg()));
    let msg = explain_kick_chat_error(429, r#"{"data":{},"message":"Rate limit exceeded"}"#, true);
    assert!(is_kick_rate_limit(&msg), "{msg}");
  }

  #[test]
  fn retry_after_header_seconds() {
    let mut h = reqwest::header::HeaderMap::new();
    h.insert(reqwest::header::RETRY_AFTER, "4".parse().unwrap());
    assert_eq!(parse_retry_after_ms(&h), 4000);
  }

  #[test]
  fn status_connected_with_only_client_credentials() {
    let dir = std::env::temp_dir().join(format!("yya-kick-auth-{}", std::process::id()));
    let _ = std::fs::create_dir_all(&dir);
    let auth = KickAuth::new(&dir);
    {
      let mut d = auth.data.write();
      d.client_id = "01TESTCLIENTIDTOKENXX".into();
      d.client_secret = "secret".into();
    }
    let st = auth.status();
    assert_eq!(st.get("connected").and_then(|v| v.as_bool()), Some(true));
    assert_eq!(st.get("hasAppToken").and_then(|v| v.as_bool()), Some(true));
    assert_eq!(st.get("hasUserToken").and_then(|v| v.as_bool()), Some(false));
    let _ = std::fs::remove_dir_all(&dir);
  }
}
