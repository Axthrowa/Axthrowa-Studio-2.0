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

/// Ağa giden mesajdan OBS şifrelerini siler (KASAYA YAZMADAN — `for_disk`'in aksine).
///
/// Her derinlikte `obs` nesnesinin `password` alanı boşaltılır: WS anlık görüntüsü
/// ekranları `{starting: {obs: …}, …}` biçiminde, ayar yayınları `{value: {obs: …}}`
/// biçiminde taşır. Dönüş: bir şey değişti mi.
pub fn redact_obs_passwords(value: &mut Value) -> bool {
  let mut changed = false;
  match value {
    Value::Object(map) => {
      for (k, v) in map.iter_mut() {
        if k == "obs" {
          if let Some(obs) = v.as_object_mut() {
            if obs.get("password").and_then(|p| p.as_str()).is_some_and(|p| !p.is_empty()) {
              obs.insert("password".into(), json!(""));
              changed = true;
            }
          }
        }
        changed |= redact_obs_passwords(v);
      }
    }
    Value::Array(items) => {
      for v in items {
        changed |= redact_obs_passwords(v);
      }
    }
    _ => {}
  }
  changed
}

/// Metin olarak serileştirilmiş WS mesajı için: şifre yoksa metin aynen döner (ayrıştırma maliyeti yok).
pub fn redact_obs_passwords_text(text: &str) -> std::borrow::Cow<'_, str> {
  if !text.contains("\"password\"") {
    return std::borrow::Cow::Borrowed(text);
  }
  let Ok(mut v) = serde_json::from_str::<Value>(text) else {
    return std::borrow::Cow::Borrowed(text);
  };
  if redact_obs_passwords(&mut v) {
    std::borrow::Cow::Owned(v.to_string())
  } else {
    std::borrow::Cow::Borrowed(text)
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn ag_mesajindan_obs_sifresi_her_derinlikte_silinir() {
    let mut snap = json!({
      "type": "snapshot",
      "starting": { "obs": { "host": "127.0.0.1", "password": "gizli" }, "title": "x" },
      "brb": { "obs": { "password": "" } },
      "list": [{ "obs": { "password": "gizli2" } }],
      "password": "kok-alan-dokunulmaz"
    });
    assert!(redact_obs_passwords(&mut snap));
    assert_eq!(snap["starting"]["obs"]["password"], "");
    assert_eq!(snap["starting"]["obs"]["host"], "127.0.0.1");
    assert_eq!(snap["starting"]["title"], "x");
    assert_eq!(snap["list"][0]["obs"]["password"], "");
    // Yalnız `obs` altındaki şifre hedeflenir
    assert_eq!(snap["password"], "kok-alan-dokunulmaz");
    assert!(!redact_obs_passwords(&mut snap), "ikinci geçişte değişiklik olmamalı");
  }

  #[test]
  fn metin_mesajinda_sifre_yoksa_aynen_doner() {
    let m = r#"{"type":"nowPlaying","title":"a"}"#;
    assert!(matches!(redact_obs_passwords_text(m), std::borrow::Cow::Borrowed(_)));
    let m = r#"{"type":"settings","value":{"obs":{"password":"p"}}}"#;
    let out = redact_obs_passwords_text(m);
    assert!(!out.contains("\"p\""), "{out}");
  }

  /// Regresyon: `keyring` platform özelliği olmadan derlenince sahte (mock) depoya düşüyor ve her `Entry`
  /// bağımsız oluyordu — yazılan sır bir sonraki okumada YOKTU (OBS parolası, Kick oturumu kayboluyordu).
  #[test]
  fn yazilan_sir_ayri_okumada_kalici() {
    let ad = format!("test.kalicilik.{}", std::process::id());
    assert!(set_secret(&ad, "deger-123"), "yazılamadı");
    assert_eq!(get_secret(&ad).as_deref(), Some("deger-123"), "sır kalıcı değil (mock depo?)");
    delete_secret(&ad);
    assert_eq!(get_secret(&ad), None);
  }
}
