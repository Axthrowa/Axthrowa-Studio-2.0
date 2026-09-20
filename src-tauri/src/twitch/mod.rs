//! Twitch rozet kümeleri.
//!
//! Eski `badges.twitch.tv` ucu kapatıldı (DNS kaydı bile yok), Helix ise
//! uygulama anahtarı istiyor. Twitch'in kendi web istemcisinin kullandığı
//! genel GQL ucu hem küresel hem kanala özel (abone) rozetlerin **orijinal**
//! görsellerini anahtarsız veriyor — YouTube innertube ve Kick Pusher
//! anahtarlarında olduğu gibi burada da onu kullanıyoruz.
//!
//! Tarayıcı bu uca CORS nedeniyle doğrudan gidemediği için istek buradan
//! geçer; kümeler nadiren değiştiğinden bellekte bir saat tutulur.

use std::collections::HashMap;
use std::sync::OnceLock;
use std::time::{Duration, Instant};

use anyhow::{anyhow, Result};
use parking_lot::RwLock;
use serde_json::{json, Value};

const UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
/// Twitch web istemcisinin herkese açık istemci kimliği
const GQL_CLIENT_ID: &str = "kimne78kx3ncx6brgo4mv6wki5h1ko";
const GQL_URL: &str = "https://gql.twitch.tv/gql";
const TTL: Duration = Duration::from_secs(60 * 60);

type Cache = RwLock<HashMap<String, (Instant, Value)>>;

fn cache() -> &'static Cache {
  static C: OnceLock<Cache> = OnceLock::new();
  C.get_or_init(|| RwLock::new(HashMap::new()))
}

fn client() -> Result<&'static reqwest::Client> {
  static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
  if let Some(c) = CLIENT.get() {
    return Ok(c);
  }
  let built = reqwest::Client::builder()
    .user_agent(UA)
    .timeout(Duration::from_secs(15))
    .pool_idle_timeout(Duration::from_secs(60))
    .build()?;
  Ok(CLIENT.get_or_init(|| built))
}

/// `global` ya da sayısal oda kimliği. Başka bir şey kabul edilmez —
/// kullanıcı girdisi doğrudan sorguya yazılmasın.
pub fn normalize_scope(raw: &str) -> Option<String> {
  let s = raw.trim();
  if s.eq_ignore_ascii_case("global") {
    return Some("global".to_string());
  }
  if !s.is_empty() && s.len() <= 20 && s.chars().all(|c| c.is_ascii_digit()) {
    return Some(s.to_string());
  }
  None
}

fn query_for(scope: &str) -> String {
  if scope == "global" {
    "{ badges { setID version imageURL(size: DOUBLE) title } }".to_string()
  } else {
    // scope yalnızca rakamlardan oluşuyor (normalize_scope garanti ediyor)
    format!(
      "{{ user(id: \"{scope}\") {{ broadcastBadges {{ setID version imageURL(size: DOUBLE) title }} }} }}"
    )
  }
}

pub async fn badges(scope_raw: &str) -> Result<Value> {
  let scope = normalize_scope(scope_raw)
    .ok_or_else(|| anyhow!("geçersiz kapsam: 'global' veya oda kimliği bekleniyor"))?;

  if let Some((at, v)) = cache().read().get(&scope) {
    if at.elapsed() < TTL {
      return Ok(v.clone());
    }
  }

  let res = client()?
    .post(GQL_URL)
    .header("Client-ID", GQL_CLIENT_ID)
    .header("Content-Type", "application/json")
    .json(&json!({ "query": query_for(&scope) }))
    .send()
    .await?;
  if !res.status().is_success() {
    return Err(anyhow!("Twitch rozet HTTP {}", res.status()));
  }
  let data: Value = res.json().await?;

  let list = if scope == "global" {
    data.pointer("/data/badges")
  } else {
    data.pointer("/data/user/broadcastBadges")
  };
  let sets = to_badge_sets(list);

  // Kanal yayında değilse boş dönebilir; onu da önbelleğe alıp
  // her mesajda yeniden sormayalım.
  cache().write().insert(scope, (Instant::now(), sets.clone()));
  Ok(sets)
}

/// GQL listesini istemcinin beklediği `badge_sets[set].versions[v]` biçimine çevirir.
fn to_badge_sets(list: Option<&Value>) -> Value {
  let mut out: serde_json::Map<String, Value> = serde_json::Map::new();
  let Some(arr) = list.and_then(|v| v.as_array()) else {
    return json!({ "badge_sets": {} });
  };
  for b in arr {
    let (Some(set_id), Some(version), Some(url)) = (
      b.get("setID").and_then(|v| v.as_str()),
      b.get("version").and_then(|v| v.as_str()),
      b.get("imageURL").and_then(|v| v.as_str()),
    ) else {
      continue;
    };
    if url.is_empty() {
      continue;
    }
    let title = b.get("title").and_then(|v| v.as_str()).unwrap_or(set_id);
    let entry = out
      .entry(set_id.to_string())
      .or_insert_with(|| json!({ "versions": {} }));
    if let Some(versions) = entry.get_mut("versions").and_then(|v| v.as_object_mut()) {
      versions.insert(
        version.to_string(),
        json!({ "image_url_2x": url, "title": title }),
      );
    }
  }
  json!({ "badge_sets": out })
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn scope_accepts_only_global_or_room_id() {
    assert_eq!(normalize_scope("global").as_deref(), Some("global"));
    assert_eq!(normalize_scope(" GLOBAL ").as_deref(), Some("global"));
    assert_eq!(normalize_scope("411377640").as_deref(), Some("411377640"));
    // Sorgu enjeksiyonu ve çöp reddedilir
    assert_eq!(normalize_scope("\") { x } #"), None);
    assert_eq!(normalize_scope("../../etc"), None);
    assert_eq!(normalize_scope("kanal"), None);
    assert_eq!(normalize_scope(""), None);
    assert_eq!(normalize_scope("123456789012345678901"), None);
  }

  #[test]
  fn query_matches_scope() {
    assert!(query_for("global").contains("badges {"));
    assert!(!query_for("global").contains("user("));
    let q = query_for("42");
    assert!(q.contains("user(id: \"42\")"));
    assert!(q.contains("broadcastBadges"));
  }

  #[test]
  fn badge_list_becomes_versioned_sets() {
    let list = json!([
      { "setID": "moderator", "version": "1", "imageURL": "https://cdn/mod2", "title": "Moderator" },
      { "setID": "subscriber", "version": "0", "imageURL": "https://cdn/s0", "title": "Subscriber" },
      { "setID": "subscriber", "version": "12", "imageURL": "https://cdn/s12", "title": "1-Year Subscriber" },
      { "setID": "eksik", "version": "1" },
      { "setID": "bos", "version": "1", "imageURL": "" }
    ]);
    let out = to_badge_sets(Some(&list));
    let sets = out["badge_sets"].as_object().unwrap();
    assert_eq!(sets.len(), 2, "eksik alanlılar elenmeli: {sets:?}");
    assert_eq!(out["badge_sets"]["moderator"]["versions"]["1"]["image_url_2x"], "https://cdn/mod2");
    // Aynı kümenin birden çok sürümü birleşmeli
    let subs = out["badge_sets"]["subscriber"]["versions"].as_object().unwrap();
    assert_eq!(subs.len(), 2);
    assert_eq!(subs["12"]["title"], "1-Year Subscriber");
  }

  #[test]
  fn missing_or_wrong_shape_yields_empty_sets() {
    assert!(to_badge_sets(None)["badge_sets"].as_object().unwrap().is_empty());
    assert!(to_badge_sets(Some(&json!("dizi değil")))["badge_sets"]
      .as_object()
      .unwrap()
      .is_empty());
  }
}
