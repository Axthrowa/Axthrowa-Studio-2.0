use std::sync::OnceLock;

use anyhow::{anyhow, Result};
use serde_json::{json, Value};

mod auth;
pub use auth::{
  explain_kick_chat_error, is_kick_rate_limit, kick_chat_send_as_bot, kick_rate_limit_user_msg,
  KickAuth,
};

pub(crate) const UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

pub(crate) fn client() -> Result<&'static reqwest::Client> {
  static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
  if let Some(c) = CLIENT.get() {
    return Ok(c);
  }
  let built = reqwest::Client::builder()
    .user_agent(UA)
    .redirect(reqwest::redirect::Policy::limited(5))
    .timeout(std::time::Duration::from_secs(20))
    .pool_idle_timeout(std::time::Duration::from_secs(60))
    .build()?;
  Ok(CLIENT.get_or_init(|| built))
}

/// "kick.com/axthrowa", "@axthrowa", "axthrowa" → "axthrowa"
pub fn normalize_slug(raw: &str) -> String {
  let s = raw.trim().trim_start_matches('@');
  let s = s
    .rsplit("kick.com/")
    .next()
    .unwrap_or(s)
    .trim_start_matches('/');
  s.split(['/', '?', '&', '#'])
    .next()
    .unwrap_or(s)
    .trim()
    .to_lowercase()
    // Kick adı yalnız harf/rakam/_/-: `\`, `%2f`, satır sonu URL'ye, curl'e ve günlüğe gitmesin
    .chars()
    .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-'))
    .collect()
}

/// HTML/JSON gövdesinden chatroom id'sini kazı — API 403 verdiğinde son çare.
pub fn scrape_chatroom_id(body: &str) -> Option<u64> {
  for marker in [
    "\"chatroom\":{\"id\":",
    "\"chatroom_id\":",
    "\\\"chatroom\\\":{\\\"id\\\":",
  ] {
    let mut from = 0;
    while let Some(rel) = body[from..].find(marker) {
      let start = from + rel + marker.len();
      let digits: String = body[start..]
        .chars()
        .take(24)
        .take_while(|c| c.is_ascii_digit())
        .collect();
      if let Ok(id) = digits.parse::<u64>() {
        if id > 0 {
          return Some(id);
        }
      }
      from = start;
    }
  }
  None
}

/// Kanalın kendi abone rozeti görselleri (`months` → görsel).
/// Kick bunları yalnız kanal uç noktasında veriyor; sohbette abone rozetinin
/// gerçek görselini çizebilmek için gerekli.
fn subscriber_badges_from_json(json: &Value) -> Vec<Value> {
  let Some(arr) = json.get("subscriber_badges").and_then(|v| v.as_array()) else {
    return Vec::new();
  };
  let mut out: Vec<Value> = arr
    .iter()
    .filter_map(|b| {
      let months = b.get("months").and_then(|m| m.as_u64())?;
      let url = b
        .pointer("/badge_image/src")
        .and_then(|u| u.as_str())
        .filter(|u| !u.is_empty())?;
      Some(json!({ "months": months, "url": url }))
    })
    .collect();
  out.sort_by_key(|b| b["months"].as_u64().unwrap_or(0));
  out
}

fn chatroom_from_json(json: &Value) -> Option<u64> {
  json
    .pointer("/chatroom/id")
    .or_else(|| json.pointer("/chatroom_id"))
    .and_then(|v| v.as_u64().or_else(|| v.as_str().and_then(|s| s.parse().ok())))
}

async fn try_endpoint(url: &str, slug: &str) -> Result<(String, Option<Value>)> {
  let c = client()?;
  let res = c
    .get(url)
    .header("User-Agent", UA)
    .header("Accept", "application/json, text/plain, */*")
    .header("Accept-Language", "en-US,en;q=0.9,tr;q=0.8")
    .header("Origin", "https://kick.com")
    .header("Referer", format!("https://kick.com/{slug}"))
    .header("Sec-Fetch-Dest", "empty")
    .header("Sec-Fetch-Mode", "cors")
    .header("Sec-Fetch-Site", "same-origin")
    .header("Sec-Ch-Ua", "\"Google Chrome\";v=\"131\", \"Chromium\";v=\"131\", \"Not_A Brand\";v=\"24\"")
    .header("Sec-Ch-Ua-Mobile", "?0")
    .header("Sec-Ch-Ua-Platform", "\"Windows\"")
    .send()
    .await?;
  let status = res.status();
  let text = res.text().await.unwrap_or_default();
  if status.as_u16() == 403 {
    studio_warn!(
      "[kick] Cloudflare/403 engeli · {url} · gövde_uzunluk={}",
      text.len()
    );
    return Err(anyhow!("HTTP 403 (Cloudflare?)"));
  }
  if status.as_u16() == 404 {
    studio_warn!("[kick] 404 kanal bulunamadı · {url} · slug={slug}");
    return Err(anyhow!("HTTP 404"));
  }
  if !status.is_success() {
    studio_warn!("[kick] HTTP {status} · {url}");
    return Err(anyhow!("HTTP {status}"));
  }
  let parsed = serde_json::from_str::<Value>(&text).ok();
  Ok((text, parsed))
}

/// Windows'ta curl.exe Schannel kullanır — Cloudflare rustls JA3'ü engellerken curl genelde 200 verir.
async fn try_curl(url: &str, slug: &str) -> Result<(String, Option<Value>)> {
  let referer = format!("https://kick.com/{slug}");
  let mut cmd = tokio::process::Command::new(crate::sistem_araci::yol("curl.exe"));
  cmd.args([
    "-sS",
    "-L",
    "--max-time",
    "20",
    "-A",
    UA,
    "-H",
    "Accept: application/json, text/plain, */*",
    "-H",
    "Accept-Language: en-US,en;q=0.9,tr;q=0.8",
    "-H",
    &format!("Referer: {referer}"),
    "-H",
    "Origin: https://kick.com",
    url,
  ]);
  // Her chatroom çözümlemesinde siyah konsol penceresi açılmasın
  #[cfg(windows)]
  {
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    cmd.creation_flags(CREATE_NO_WINDOW);
  }
  let output = cmd
    .output()
    .await
    .map_err(|e| anyhow!("curl.exe başlatılamadı: {e}"))?;

  if !output.status.success() {
    let err = String::from_utf8_lossy(&output.stderr);
    return Err(anyhow!("curl exit {}: {err}", output.status));
  }
  let text = String::from_utf8_lossy(&output.stdout).to_string();
  if text.is_empty() {
    return Err(anyhow!("curl boş gövde"));
  }
  // CF challenge HTML ise reddet
  if text.contains("Just a moment") || text.contains("cf-browser-verification") {
    return Err(anyhow!("curl Cloudflare challenge HTML"));
  }
  studio_log!(
    "[kick] curl.exe OK · {url} · {} bayt",
    text.len()
  );
  let parsed = serde_json::from_str::<Value>(&text).ok();
  Ok((text, parsed))
}

fn pack_chatroom(
  slug: &str,
  chatroom_id: u64,
  parsed: Option<&Value>,
  source: &str,
) -> Value {
  let live = parsed
    .map(|j| {
      j.pointer("/livestream").map(|v| !v.is_null()).unwrap_or(false)
        || j
          .pointer("/livestream/is_live")
          .and_then(|v| v.as_bool())
          .unwrap_or(false)
    })
    .unwrap_or(false);
  let sub_badges = parsed
    .map(subscriber_badges_from_json)
    .unwrap_or_default();
  let user_id = parsed.and_then(|j| {
    j.get("id")
      .and_then(|v| v.as_u64().or_else(|| v.as_str().and_then(|s| s.parse().ok())))
      .or_else(|| {
        j.pointer("/user_id")
          .and_then(|v| v.as_u64().or_else(|| v.as_str().and_then(|s| s.parse().ok())))
      })
      .or_else(|| {
        j.pointer("/user/id")
          .and_then(|v| v.as_u64().or_else(|| v.as_str().and_then(|s| s.parse().ok())))
      })
  });
  let viewers = parsed
    .and_then(|j| j.pointer("/livestream/viewer_count"))
    .and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok())))
    .unwrap_or(0);
  let followers = parsed
    .and_then(|j| j.get("followers_count").or_else(|| j.get("followersCount")))
    .and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok())))
    .unwrap_or(0);
  let playback_url = parsed
    .and_then(|j| j.get("playback_url"))
    .and_then(Value::as_str);
  let stream_title = parsed
    .and_then(|j| j.pointer("/livestream/session_title"))
    .and_then(Value::as_str);
  json!({
    "slug": slug,
    "chatroomId": chatroom_id,
    "userId": user_id,
    "channelId": user_id,
    "live": live,
    "viewers": viewers,
    "followers": followers,
    "playbackUrl": playback_url,
    "streamTitle": stream_title,
    "subscriberBadges": sub_badges,
    "source": source,
  })
}

/// Kick chatroom id'sini sırayla v1 → v2 → kanal sayfası üzerinden çözer.
/// Cloudflare rustls'i engellerse curl.exe (Schannel) yedeklenir.
#[tracing::instrument(name = "kick_kanal_bilgisi", skip_all)]
pub async fn fetch_chatroom(slug: &str) -> Result<Value> {
  let slug = normalize_slug(slug);
  if slug.is_empty() {
    return Err(anyhow!("Kick kullanıcı adı boş"));
  }

  studio_log!("Kick kanal ID aranıyor: {slug}");

  let endpoints = [
    format!("https://kick.com/api/v1/channels/{slug}"),
    format!("https://kick.com/api/v2/channels/{slug}"),
    format!("https://kick.com/{slug}"),
  ];

  let mut last_err = String::new();
  for (i, url) in endpoints.iter().enumerate() {
    let source = if i == 2 { "html" } else { "api" };
    // 1) reqwest (native-tls)
    match try_endpoint(url, &slug).await {
      Ok((body, parsed)) => {
        let id = parsed
          .as_ref()
          .and_then(chatroom_from_json)
          .or_else(|| scrape_chatroom_id(&body));
        if let Some(chatroom_id) = id {
          studio_log!("Bulunan Chatroom ID: {chatroom_id}");
          return Ok(pack_chatroom(
            &slug,
            chatroom_id,
            parsed.as_ref(),
            source,
          ));
        }
        last_err = format!("{url} → chatroom id yok");
        studio_warn!("[kick] {last_err}");
      }
      Err(e) => {
        last_err = format!("{url} → {e}");
        studio_warn!("[kick] reqwest başarısız, curl deneniyor · {last_err}");
        // 2) curl.exe yedek
        match try_curl(url, &slug).await {
          Ok((body, parsed)) => {
            let id = parsed
              .as_ref()
              .and_then(chatroom_from_json)
              .or_else(|| scrape_chatroom_id(&body));
            if let Some(chatroom_id) = id {
              studio_log!("Bulunan Chatroom ID: {chatroom_id} (curl)");
              return Ok(pack_chatroom(
                &slug,
                chatroom_id,
                parsed.as_ref(),
                &format!("{source}+curl"),
              ));
            }
            last_err = format!("curl {url} → chatroom id yok");
            studio_warn!("[kick] {last_err}");
          }
          Err(ce) => {
            last_err = format!("{url} → reqwest:{e} · curl:{ce}");
          }
        }
      }
    }
  }

  Err(anyhow!(
    "Kick chatroom alınamadı ({slug}). Kullanıcı adı doğru mu? [{last_err}]"
  ))
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn slug_normalizes_every_input_shape() {
    assert_eq!(normalize_slug("axthrowa"), "axthrowa");
    assert_eq!(normalize_slug("@Axthrowa"), "axthrowa");
    assert_eq!(normalize_slug(" https://kick.com/AxThrowa "), "axthrowa");
    assert_eq!(normalize_slug("kick.com/axthrowa/videos"), "axthrowa");
    assert_eq!(normalize_slug("axthrowa?tab=chat"), "axthrowa");
    assert_eq!(normalize_slug("   "), "");
    assert_eq!(normalize_slug("my_name-1"), "my_name-1");
    assert_eq!(normalize_slug("..\\..\\x%2f\nsahte"), "x2fsahte");
  }

  #[test]
  fn scrape_finds_chatroom_in_json_and_escaped_html() {
    let plain = r#"{"id":9,"slug":"a","chatroom":{"id":123456,"channel_id":9}}"#;
    assert_eq!(scrape_chatroom_id(plain), Some(123456));

    let escaped = r#"<script>window.data="{\"chatroom\":{\"id\":987654}}"</script>"#;
    assert_eq!(scrape_chatroom_id(escaped), Some(987654));

    let alt = r#"{"chatroom_id":555}"#;
    assert_eq!(scrape_chatroom_id(alt), Some(555));

    assert_eq!(scrape_chatroom_id("chatroom yok"), None);
    // id 0 kabul edilmez
    assert_eq!(scrape_chatroom_id(r#"{"chatroom_id":0}"#), None);
  }

  #[test]
  fn subscriber_badges_are_sorted_and_filtered() {
    let raw = json!({
      "subscriber_badges": [
        { "months": 12, "badge_image": { "src": "https://files.kick.com/sub/12.png" } },
        { "months": 1, "badge_image": { "src": "https://files.kick.com/sub/1.png" } },
        { "months": 3 },
        { "badge_image": { "src": "https://files.kick.com/sub/x.png" } },
        { "months": 6, "badge_image": { "src": "" } }
      ]
    });
    let out = subscriber_badges_from_json(&raw);
    assert_eq!(out.len(), 2, "eksik alanlı rozetler elenmeli: {out:?}");
    assert_eq!(out[0]["months"], 1);
    assert_eq!(out[1]["months"], 12);
    assert_eq!(out[0]["url"], "https://files.kick.com/sub/1.png");

    assert!(subscriber_badges_from_json(&json!({})).is_empty());
  }

  #[test]
  fn chatroom_from_json_accepts_string_ids() {
    assert_eq!(
      chatroom_from_json(&json!({ "chatroom": { "id": 42 } })),
      Some(42)
    );
    assert_eq!(
      chatroom_from_json(&json!({ "chatroom": { "id": "42" } })),
      Some(42)
    );
    assert_eq!(chatroom_from_json(&json!({})), None);
  }
}
