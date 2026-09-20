//! Hassas sırlar — Windows Credential Manager / macOS Keychain / Linux Secret Service.
//! Çerez, XSRF ve OBS şifresi diske veya SQLite’a düz metin yazılmaz.

use anyhow::{anyhow, Result};
use serde_json::{json, Value};

const SERVICE: &str = "com.axthrowa.yayin-yonetim-araci";

fn service_name() -> &'static str {
  if cfg!(test) {
    "com.axthrowa.yayin-yonetim-araci.test"
  } else {
    SERVICE
  }
}

pub const KICK_COOKIE: &str = "kick.cookie_header";
pub const KICK_XSRF: &str = "kick.xsrf_token";
pub const KICK_BEARER: &str = "kick.bearer_token";
pub const OBS_PASSWORD: &str = "obs.websocket.password";

fn entry(key: &str) -> Result<keyring::Entry> {
  keyring::Entry::new(service_name(), key).map_err(|e| anyhow!("keyring: {e}"))
}

pub fn set_secret(key: &str, value: &str) -> bool {
  let Ok(item) = entry(key) else {
    return false;
  };
  item.set_password(value).is_ok()
}

pub fn get_secret(key: &str) -> Option<String> {
  entry(key).ok()?.get_password().ok().filter(|s| !s.is_empty())
}

pub fn delete_secret(key: &str) {
  if let Ok(item) = entry(key) {
    let _ = item.delete_credential();
  }
}

pub fn vault_kick_secrets(cookie: &str, xsrf: &str, bearer: &str) -> bool {
  let mut ok = true;
  if !cookie.is_empty() {
    ok &= set_secret(KICK_COOKIE, cookie);
  }
  if !xsrf.is_empty() {
    ok &= set_secret(KICK_XSRF, xsrf);
  }
  if !bearer.is_empty() {
    ok &= set_secret(KICK_BEARER, bearer);
  }
  ok
}

pub fn load_kick_secrets() -> (String, String, String) {
  (
    get_secret(KICK_COOKIE).unwrap_or_default(),
    get_secret(KICK_XSRF).unwrap_or_default(),
    get_secret(KICK_BEARER).unwrap_or_default(),
  )
}

pub fn clear_kick_secrets() {
  delete_secret(KICK_COOKIE);
  delete_secret(KICK_XSRF);
  delete_secret(KICK_BEARER);
}

pub fn vault_obs_password(password: &str) -> bool {
  let pw = password.trim();
  if pw.is_empty() {
    return true;
  }
  set_secret(OBS_PASSWORD, pw)
}

pub fn load_obs_password() -> String {
  get_secret(OBS_PASSWORD).unwrap_or_default()
}

pub fn clear_obs_password() {
  delete_secret(OBS_PASSWORD);
}

/// Bellekteki ayardan OBS şifresini kasaya alır; verilen kopyada alanı boşaltır.
pub fn vault_and_strip_obs_password(value: &mut Value) {
  if let Some(obs) = value.get_mut("obs").and_then(|v| v.as_object_mut()) {
    if let Some(pw) = obs
      .get("password")
      .and_then(|v| v.as_str())
      .map(|s| s.to_string())
    {
      let _ = vault_obs_password(&pw);
    }
    obs.insert("password".into(), json!(""));
  }
}

/// Kasadaki OBS şifresini ayar nesnesine geri yazar (bellek / API).
pub fn inject_obs_password(value: &mut Value) {
  let pw = load_obs_password();
  if pw.is_empty() {
    return;
  }
  if let Some(obs) = value.get_mut("obs").and_then(|v| v.as_object_mut()) {
    let current = obs
      .get("password")
      .and_then(|v| v.as_str())
      .unwrap_or("")
      .trim()
      .to_string();
    if current.is_empty() {
      obs.insert("password".into(), json!(pw));
    }
  }
}

/// Disk kopyası — sır yok.
pub fn for_disk(value: &Value) -> Value {
  let mut disk = value.clone();
  vault_and_strip_obs_password(&mut disk);
  disk
}
