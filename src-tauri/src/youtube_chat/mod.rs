use std::collections::HashMap;
use std::sync::OnceLock;
use std::time::{Duration, Instant};

use anyhow::{anyhow, Result};
use parking_lot::RwLock;
use serde_json::{json, Value};

const UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
/// YouTube WEB istemci anahtarı (innertube genel anahtar)
const INNERTUBE_KEY: &str = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";

/// Tek bir paylaşılan client — her istekte yeni TLS havuzu kurmak pahalıydı.
fn client() -> Result<&'static reqwest::Client> {
  static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
  if let Some(c) = CLIENT.get() {
    return Ok(c);
  }
  let built = reqwest::Client::builder()
    .user_agent(UA)
    .redirect(reqwest::redirect::Policy::limited(8))
    .timeout(std::time::Duration::from_secs(15))
    .pool_idle_timeout(std::time::Duration::from_secs(60))
    .build()?;
  Ok(CLIENT.get_or_init(|| built))
}

pub fn is_video_id(s: &str) -> bool {
  s.len() == 11 && s.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

fn take_video_id_at(s: &str, start: usize) -> Option<String> {
  if start > s.len() || !s.is_char_boundary(start) {
    return None;
  }
  let id: String = s[start..]
    .chars()
    .take(11)
    .take_while(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
    .collect();
  if is_video_id(&id) {
    Some(id)
  } else {
    None
  }
}

pub fn extract_video_id(input: &str) -> Option<String> {
  let s = input.trim();
  if s.is_empty() {
    return None;
  }
  if is_video_id(s) {
    return Some(s.to_string());
  }
  for marker in ["?v=", "&v=", "youtu.be/", "/live/", "/embed/", "/shorts/", "/watch/"] {
    if let Some(pos) = s.find(marker) {
      if let Some(id) = take_video_id_at(s, pos + marker.len()) {
        return Some(id);
      }
    }
  }
  None
}

pub fn normalize_handle(channel: &str) -> String {
  let s = channel.trim().trim_start_matches('@');
  if let Some(rest) = s.split("youtube.com/").nth(1) {
    let part = rest
      .trim_start_matches("c/")
      .trim_start_matches("user/")
      .trim_start_matches("channel/")
      .trim_start_matches('@')
      .split(['/', '?', '&', '#'])
      .next()
      .unwrap_or("");
    return part.trim_start_matches('@').to_string();
  }
  s.split(['/', '?', '&', '#']).next().unwrap_or(s).to_string()
}

/// Kanal canlı yayın videoId'sini bul
pub async fn resolve_live_video(channel_or_url: &str) -> Result<Value> {
  if let Some(id) = extract_video_id(channel_or_url) {
    return Ok(json!({ "videoId": id, "source": "direct" }));
  }
  let handle = normalize_handle(channel_or_url);
  if handle.is_empty() {
    return Err(anyhow!("YouTube kanal veya video boş"));
  }
  let c = client()?;
  let url = if handle.starts_with("UC") && handle.len() >= 20 {
    format!("https://www.youtube.com/channel/{handle}/live")
  } else {
    format!("https://www.youtube.com/@{handle}/live")
  };
  let res = c
    .get(&url)
    .header("Accept-Language", "en-US,en;q=0.9")
    .send()
    .await?;
  let final_url = res.url().to_string();
  let html = res.text().await?;
  if let Some(id) = extract_video_id(&final_url) {
    return Ok(json!({ "videoId": id, "source": "redirect", "url": final_url, "live": true }));
  }
  // Yayın gerçekten canlı mı? "/live" sayfası kapalıyken de bir videoId basabiliyor.
  let live_now = html.contains("\"isLive\":true") || html.contains("\"isLiveContent\":true");
  for needle in ["\"videoId\":\"", "watch?v="] {
    let mut from = 0;
    while let Some(rel) = html[from..].find(needle) {
      let start = from + rel + needle.len();
      if let Some(id) = take_video_id_at(&html, start) {
        return Ok(json!({
          "videoId": id,
          "source": "html",
          "url": final_url,
          "live": live_now,
        }));
      }
      from = start;
    }
  }
  Err(anyhow!(
    "Canlı yayın bulunamadı — kanal yayında mı / video ID doğru mu?"
  ))
}

/* ------------------------------------------------------- bitiş ekranları */

/// Bitiş ekranı bilgisi nadiren değişir; aynı video tekrar açıldığında
/// izleme sayfasını yeniden indirmeye gerek yok.
const ENDSCREEN_TTL: Duration = Duration::from_secs(6 * 60 * 60);

type EndScreenCache = RwLock<HashMap<String, (Instant, Value)>>;

fn endscreen_cache() -> &'static EndScreenCache {
  static C: OnceLock<EndScreenCache> = OnceLock::new();
  C.get_or_init(|| RwLock::new(HashMap::new()))
}

/// `open` konumundaki `{` ile başlayan dengeli JSON nesnesini döndürür.
/// Metin içindeki süslü parantezler ve kaçışlı tırnaklar sayılmaz.
fn balanced_object(s: &str, open: usize) -> Option<&str> {
  let bytes = s.as_bytes();
  if bytes.get(open) != Some(&b'{') {
    return None;
  }
  let mut depth = 0usize;
  let mut in_str = false;
  let mut escaped = false;
  for (i, &b) in bytes.iter().enumerate().skip(open) {
    if in_str {
      if escaped {
        escaped = false;
      } else if b == b'\\' {
        escaped = true;
      } else if b == b'"' {
        in_str = false;
      }
      continue;
    }
    match b {
      b'"' => in_str = true,
      b'{' => depth += 1,
      b'}' => {
        depth -= 1;
        if depth == 0 {
          return s.get(open..=i);
        }
      }
      _ => {}
    }
  }
  None
}

/// `"anahtar":"123"` biçimindeki ilk sayıyı okur.
fn quoted_number(hay: &str, key: &str) -> Option<u64> {
  let needle = format!("\"{key}\":\"");
  let pos = hay.find(&needle)?;
  hay[pos + needle.len()..]
    .chars()
    .take_while(char::is_ascii_digit)
    .collect::<String>()
    .parse()
    .ok()
}

/// Bitiş ekranındaki **en erken** öğe. Her öğenin kendi `startMs` değeri var;
/// perde onlardan ilki belirdiğinde açılmış sayılır.
fn earliest_start_ms(obj: &str) -> Option<u64> {
  const KEY: &str = "\"startMs\":\"";
  let mut best: Option<u64> = None;
  let mut rest = obj;
  while let Some(pos) = rest.find(KEY) {
    rest = &rest[pos + KEY.len()..];
    if let Ok(v) = rest
      .chars()
      .take_while(char::is_ascii_digit)
      .collect::<String>()
      .parse::<u64>()
    {
      best = Some(best.map_or(v, |b| b.min(v)));
    }
  }
  best
}

/// Videonun bitiş ekranı (end screen) var mı, varsa kaçıncı saniyede açılıyor.
///
/// Bitiş ekranı öğeleri oynatıcının kendi içinde çiziliyor: ne bir oynatıcı
/// parametresiyle kapatılabiliyor ne de çapraz köken kısıtı yüzünden CSS ile
/// gizlenebiliyor. Tek çare o bölgeye girmemek — ama bunun için de bölgenin
/// nerede başladığını bilmek gerekiyor. İzleme sayfasının içine gömülü
/// `ytInitialPlayerResponse` bunu tam olarak söylüyor; öğe yoksa alan da yok.
/// Böylece her videodan kör bir pay kesmek yerine yalnızca gerçekten kart
/// olan videolarda, tam kartın başladığı saniyeye kadar oynatabiliyoruz.
pub async fn end_screen_info(video_id: &str) -> Result<Value> {
  if !is_video_id(video_id) {
    return Err(anyhow!("Geçersiz YouTube video kimliği"));
  }
  if let Some((at, cached)) = endscreen_cache().read().get(video_id) {
    if at.elapsed() < ENDSCREEN_TTL {
      return Ok(cached.clone());
    }
  }

  let html = client()?
    .get(format!("https://www.youtube.com/watch?v={video_id}"))
    .header("Accept-Language", "en-US,en;q=0.9")
    .send()
    .await?
    .text()
    .await?;

  // Sayfa gerçekten oynatıcı verisi taşıyor mu? Taşımıyorsa (bot duvarı,
  // ağ vekili, hata sayfası) "kart yok" demek yanlış olur — hata dönüp
  // çağıranın eski kör pay davranışına düşmesini sağlıyoruz.
  if !html.contains("ytInitialPlayerResponse") {
    return Err(anyhow!("YouTube izleme sayfası okunamadı"));
  }

  const MARK: &str = "\"endscreen\":{\"endscreenRenderer\":";
  let start_ms = html
    .find(MARK)
    .and_then(|i| balanced_object(&html, i + MARK.len()))
    .and_then(earliest_start_ms);

  let info = json!({
    "videoId": video_id,
    "hasEndScreen": start_ms.is_some(),
    "startSec": start_ms.map(|ms| ms as f64 / 1000.0),
    "lengthSeconds": quoted_number(&html, "lengthSeconds"),
  });
  endscreen_cache()
    .write()
    .insert(video_id.to_string(), (Instant::now(), info.clone()));
  Ok(info)
}

fn innertube_context() -> Value {
  json!({
    "client": {
      "hl": "tr",
      "gl": "TR",
      "clientName": "WEB",
      "clientVersion": "2.20240401.00.00"
    }
  })
}

async fn bootstrap_continuation(video_id: &str) -> Result<String> {
  let c = client()?;
  let url = format!("https://www.youtube.com/live_chat?is_popout=1&v={video_id}");
  let html = c
    .get(&url)
    .header("Accept-Language", "en-US,en;q=0.9")
    .send()
    .await?
    .text()
    .await?;

  let marker = "\"continuation\":\"";
  let mut search_from = 0;
  while let Some(rel) = html[search_from..].find(marker) {
    let start = search_from + rel + marker.len();
    if let Some(end_rel) = html[start..].find('"') {
      let token = &html[start..start + end_rel];
      if token.len() > 40 && !token.contains(' ') && !token.contains('\\') {
        return Ok(token.to_string());
      }
    }
    search_from = start;
  }
  Err(anyhow!(
    "YouTube sohbeti açılamadı — yayın canlı değil veya sohbet kapalı"
  ))
}

/// Bir chat sayfası çeker. `continuation` yoksa/geçersizse yeniden bootstrap eder.
pub async fn poll_chat(video_id: &str, continuation: Option<&str>) -> Result<Value> {
  let vid = extract_video_id(video_id).unwrap_or_else(|| video_id.trim().to_string());
  if !is_video_id(&vid) {
    return Err(anyhow!("Geçersiz YouTube videoId"));
  }
  let had_token = continuation.map(|c| !c.trim().is_empty()).unwrap_or(false);
  let cont = match continuation {
    Some(c) if !c.trim().is_empty() => c.trim().to_string(),
    _ => bootstrap_continuation(&vid).await?,
  };

  match fetch_page(&vid, &cont).await {
    Ok(v) => Ok(v),
    // Süresi dolan continuation → bir kez tazeleyip tekrar dene.
    Err(e) if had_token => {
      let fresh = bootstrap_continuation(&vid)
        .await
        .map_err(|_| anyhow!("YouTube sohbeti yenilenemedi: {e}"))?;
      fetch_page(&vid, &fresh).await
    }
    Err(e) => Err(e),
  }
}

async fn fetch_page(vid: &str, cont: &str) -> Result<Value> {
  let c = client()?;
  let url =
    format!("https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key={INNERTUBE_KEY}");
  let body = json!({ "context": innertube_context(), "continuation": cont });
  let res = c
    .post(&url)
    .header("Content-Type", "application/json")
    .header("Accept-Language", "en-US,en;q=0.9")
    .json(&body)
    .send()
    .await?;
  if !res.status().is_success() {
    return Err(anyhow!("YouTube chat HTTP {}", res.status()));
  }
  let data: Value = res.json().await?;

  let live = data
    .pointer("/continuationContents/liveChatContinuation")
    .ok_or_else(|| anyhow!("YouTube sohbeti sona erdi"))?;

  let mut next_cont: Option<String> = None;
  // Sunucunun önerdiği bekleme süresi — sabit 2 sn yerine bunu kullan.
  let mut poll_ms: u64 = 2500;

  if let Some(arr) = live.get("continuations").and_then(|v| v.as_array()) {
    for item in arr {
      for key in [
        "/invalidationContinuationData",
        "/timedContinuationData",
        "/reloadContinuationData",
        "/liveChatReplayContinuationData",
      ] {
        let Some(node) = item.pointer(key) else { continue };
        if let Some(c) = node.get("continuation").and_then(|v| v.as_str()) {
          next_cont = Some(c.to_string());
          if let Some(ms) = node.get("timeoutMs").and_then(|v| v.as_u64()) {
            poll_ms = ms.clamp(1_000, 10_000);
          }
          break;
        }
      }
      if next_cont.is_some() {
        break;
      }
    }
  }

  let mut messages: Vec<Value> = Vec::new();
  if let Some(actions) = live.get("actions").and_then(|v| v.as_array()) {
    for action in actions {
      if let Some(m) = parse_action(action) {
        messages.push(m);
      }
    }
  }

  Ok(json!({
    "videoId": vid,
    "continuation": next_cont.unwrap_or_else(|| cont.to_string()),
    "pollMs": poll_ms,
    "messages": messages,
  }))
}

/// Metin, üyelik ve superchat mesajlarını tek biçime indirger.
fn parse_action(action: &Value) -> Option<Value> {
  let item = action.pointer("/addChatItemAction/item")?;

  let (r, kind, amount) = if let Some(r) = item.get("liveChatTextMessageRenderer") {
    (r, "chat", None)
  } else if let Some(r) = item.get("liveChatPaidMessageRenderer") {
    let amt = r
      .pointer("/purchaseAmountText/simpleText")
      .and_then(|v| v.as_str())
      .map(str::to_string);
    (r, "superchat", amt)
  } else if let Some(r) = item.get("liveChatMembershipItemRenderer") {
    (r, "membership", None)
  } else {
    // Tanımadığımız bir öğe türüyse mesaj yok.
    let r = item.get("liveChatPaidStickerRenderer")?;
    let amt = r
      .pointer("/purchaseAmountText/simpleText")
      .and_then(|v| v.as_str())
      .map(str::to_string);
    (r, "sticker", amt)
  };

  let id = r.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
  let user = r
    .pointer("/authorName/simpleText")
    .and_then(|v| v.as_str())
    .unwrap_or("user")
    .to_string();

  // Üyelik olaylarında metin `headerSubtext` içinde gelir.
  let mut parts = message_parts(r.get("message"));
  if parts.is_empty() {
    parts = message_parts(r.get("headerSubtext"));
  }
  let text = plain_text(&parts);
  if text.is_empty() && kind == "chat" {
    return None;
  }

  let badges = author_badges(r);

  let timestamp = r
    .get("timestampUsec")
    .and_then(|v| v.as_str())
    .and_then(|s| s.parse::<u64>().ok())
    .map(|us| us / 1000);

  Some(json!({
    "id": id,
    "user": user,
    "text": text,
    "parts": parts,
    "platform": "youtube",
    "kind": kind,
    "amount": amount,
    "badges": badges,
    "ts": timestamp,
    "color": "#ff4444",
  }))
}

/// Yazar rozetlerini `{ label, url?, icon? }` biçimine indirger.
///
/// YouTube iki tür rozet döndürür: üyelik rozetleri özel görsel taşır,
/// moderatör/sahip/doğrulanmış rozetleri ise yalnız bir simge adı verir.
fn author_badges(renderer: &Value) -> Vec<Value> {
  let Some(arr) = renderer.get("authorBadges").and_then(|v| v.as_array()) else {
    return Vec::new();
  };
  arr
    .iter()
    .filter_map(|b| {
      let r = b.get("liveChatAuthorBadgeRenderer")?;
      let label = r
        .pointer("/accessibility/accessibilityData/label")
        .and_then(|v| v.as_str())
        .or_else(|| r.pointer("/tooltip").and_then(|v| v.as_str()))
        .unwrap_or("")
        .to_string();

      // Üyelik rozeti: kanalın kendi görseli
      let url = r
        .pointer("/customThumbnail/thumbnails")
        .and_then(|v| v.as_array())
        .and_then(|thumbs| {
          thumbs
            .iter()
            .max_by_key(|t| t.get("width").and_then(|w| w.as_u64()).unwrap_or(0))
            .and_then(|t| t.get("url").and_then(|u| u.as_str()))
        })
        .map(str::to_string);

      // Sistem rozeti: MODERATOR / OWNER / VERIFIED
      let icon = r
        .pointer("/icon/iconType")
        .and_then(|v| v.as_str())
        .map(|s| s.to_lowercase());

      if label.is_empty() && url.is_none() && icon.is_none() {
        return None;
      }
      Some(json!({ "label": label, "url": url, "icon": icon }))
    })
    .collect()
}

/// En büyük emoji görselini seçer (sohbet katmanı yükseltilebilir yazı boyu kullanıyor).
fn best_emoji_url(emoji: &Value) -> Option<String> {
  let thumbs = emoji.pointer("/image/thumbnails")?.as_array()?;
  thumbs
    .iter()
    .max_by_key(|t| t.get("width").and_then(|w| w.as_u64()).unwrap_or(0))
    .and_then(|t| t.get("url").and_then(|u| u.as_str()))
    .map(str::to_string)
}

/// Mesajı `{type:"text"|"emote"}` parçalarına ayırır.
///
/// Eskiden özel emoji'ler `:kısayol:` metnine düşürülüyordu; yayında
/// görsel yerine düz yazı görünmesinin nedeni buydu.
fn message_parts(message: Option<&Value>) -> Vec<Value> {
  let Some(msg) = message else {
    return Vec::new();
  };
  if let Some(s) = msg.get("simpleText").and_then(|v| v.as_str()) {
    if s.trim().is_empty() {
      return Vec::new();
    }
    return vec![json!({ "type": "text", "text": s })];
  }

  let mut parts: Vec<Value> = Vec::new();
  let mut buf = String::new();
  let flush = |buf: &mut String, parts: &mut Vec<Value>| {
    if !buf.is_empty() {
      parts.push(json!({ "type": "text", "text": buf.clone() }));
      buf.clear();
    }
  };

  if let Some(runs) = msg.get("runs").and_then(|v| v.as_array()) {
    for run in runs {
      if let Some(t) = run.get("text").and_then(|v| v.as_str()) {
        buf.push_str(t);
        continue;
      }
      let Some(emoji) = run.get("emoji") else { continue };
      let label = emoji
        .pointer("/shortcuts/0")
        .and_then(|v| v.as_str())
        .or_else(|| emoji.get("emojiId").and_then(|v| v.as_str()))
        .unwrap_or("")
        .to_string();
      let custom = emoji
        .get("isCustomEmoji")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

      match (custom, best_emoji_url(emoji)) {
        // Özel kanal emoji'si → görsel
        (true, Some(url)) => {
          flush(&mut buf, &mut parts);
          parts.push(json!({ "type": "emote", "url": url, "name": label }));
        }
        // Standart emoji zaten Unicode karakter; yazı olarak doğru görünür
        _ => buf.push_str(&label),
      }
    }
  }
  flush(&mut buf, &mut parts);
  parts
}

/// Parçalardan düz metin — arama, kopyalama ve boş mesaj kontrolü için.
fn plain_text(parts: &[Value]) -> String {
  let mut out = String::new();
  for p in parts {
    match p.get("type").and_then(|t| t.as_str()) {
      Some("text") => out.push_str(p.get("text").and_then(|t| t.as_str()).unwrap_or("")),
      Some("emote") => {
        out.push_str(p.get("name").and_then(|t| t.as_str()).unwrap_or(""));
      }
      _ => {}
    }
  }
  out.trim().to_string()
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn video_id_from_every_url_shape() {
    let cases = [
      ("dQw4w9WgXcQ", "dQw4w9WgXcQ"),
      ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
      ("https://youtu.be/dQw4w9WgXcQ?t=30", "dQw4w9WgXcQ"),
      ("https://www.youtube.com/live/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
      ("https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
      ("https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
      ("https://m.youtube.com/watch?a=1&v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
    ];
    for (input, want) in cases {
      assert_eq!(extract_video_id(input).as_deref(), Some(want), "girdi: {input}");
    }
    assert_eq!(extract_video_id("@kanaladi"), None);
    assert_eq!(extract_video_id(""), None);
  }

  /// Kısaltılmış ama gerçek izleme sayfasıyla aynı biçimde bir parça:
  /// perde üç öğe taşıyor ve her öğenin kendi `startMs` değeri var.
  const ENDSCREEN_SAMPLE: &str = concat!(
    r##"{"videoDetails":{"lengthSeconds":"213"},"##,
    r##""endscreen":{"endscreenRenderer":{"elements":["##,
    r##"{"endscreenElementRenderer":{"style":"CHANNEL","title":{"simpleText":"a}b\"c"},"##,
    r##""startMs":"205000","endMs":"212040"}},"##,
    r##"{"endscreenElementRenderer":{"style":"VIDEO","startMs":"201451","endMs":"212040"}}"##,
    r##"],"startMs":"201451"}},"##,
    r##""playerConfig":{"startMs":"1"}}"##
  );

  #[test]
  fn endscreen_start_reads_earliest_element() {
    let mark = "\"endscreen\":{\"endscreenRenderer\":";
    let at = ENDSCREEN_SAMPLE.find(mark).unwrap() + mark.len();
    let obj = balanced_object(ENDSCREEN_SAMPLE, at).expect("dengeli nesne");
    // Perde dışındaki `playerConfig.startMs` sızmamalı, en erken öğe kazanmalı.
    assert_eq!(earliest_start_ms(obj), Some(201_451));
    assert_eq!(quoted_number(ENDSCREEN_SAMPLE, "lengthSeconds"), Some(213));
  }

  #[test]
  fn balanced_object_ignores_braces_inside_strings() {
    let s = r#"x{"a":"}{\"","b":{"c":1}}y"#;
    let at = s.find('{').unwrap();
    assert_eq!(balanced_object(s, at), Some(r#"{"a":"}{\"","b":{"c":1}}"#));
  }

  #[test]
  fn missing_endscreen_means_no_cards() {
    let html = r#"{"videoDetails":{"lengthSeconds":"600"},"playerConfig":{}}"#;
    assert!(html.find("\"endscreen\":{\"endscreenRenderer\":").is_none());
  }

  #[test]
  fn handle_normalizes_all_channel_forms() {
    assert_eq!(normalize_handle("@axthrowa"), "axthrowa");
    assert_eq!(normalize_handle("axthrowa"), "axthrowa");
    assert_eq!(normalize_handle("https://youtube.com/@axthrowa"), "axthrowa");
    assert_eq!(normalize_handle("https://www.youtube.com/@axthrowa/live"), "axthrowa");
    assert_eq!(normalize_handle("https://www.youtube.com/c/axthrowa"), "axthrowa");
    assert_eq!(
      normalize_handle("https://www.youtube.com/channel/UC1234567890abcdefghij"),
      "UC1234567890abcdefghij"
    );
    assert_eq!(normalize_handle("   "), "");
  }

  #[test]
  fn take_video_id_handles_utf8_boundaries() {
    // Panik yerine None dönmeli (Türkçe karakterli HTML'de indeks kayması)
    let s = "şğüöç";
    assert_eq!(take_video_id_at(s, 1), None);
    assert_eq!(take_video_id_at(s, 999), None);
  }

  #[test]
  fn standard_emoji_stays_text() {
    let msg = json!({
      "runs": [
        { "text": "merhaba " },
        { "emoji": { "emojiId": "😀" } },
        { "text": " dünya" }
      ]
    });
    let parts = message_parts(Some(&msg));
    assert_eq!(parts.len(), 1, "unicode emoji ayrı parça olmamalı: {parts:?}");
    assert_eq!(parts[0]["text"], "merhaba 😀 dünya");
    assert_eq!(plain_text(&parts), "merhaba 😀 dünya");

    assert!(message_parts(None).is_empty());
    let simple = message_parts(Some(&json!({ "simpleText": "tek" })));
    assert_eq!(simple[0]["text"], "tek");
  }

  #[test]
  fn custom_emoji_becomes_image_part() {
    let msg = json!({
      "runs": [
        { "text": "bak " },
        { "emoji": {
            "emojiId": "abc/def",
            "shortcuts": [":_kek:"],
            "isCustomEmoji": true,
            "image": { "thumbnails": [
              { "url": "https://yt3.ggpht.com/kek/s24", "width": 24 },
              { "url": "https://yt3.ggpht.com/kek/s48", "width": 48 }
            ]}
        }},
        { "text": " bunu" }
      ]
    });
    let parts = message_parts(Some(&msg));
    assert_eq!(parts.len(), 3, "{parts:?}");
    assert_eq!(parts[0]["text"], "bak ");
    assert_eq!(parts[1]["type"], "emote");
    // En büyük küçük resim seçilmeli
    assert_eq!(parts[1]["url"], "https://yt3.ggpht.com/kek/s48");
    assert_eq!(parts[1]["name"], ":_kek:");
    assert_eq!(parts[2]["text"], " bunu");
    assert_eq!(plain_text(&parts), "bak :_kek: bunu");
  }

  #[test]
  fn custom_emoji_without_image_falls_back_to_text() {
    let msg = json!({
      "runs": [{ "emoji": { "shortcuts": [":yok:"], "isCustomEmoji": true } }]
    });
    let parts = message_parts(Some(&msg));
    assert_eq!(parts.len(), 1);
    assert_eq!(parts[0]["type"], "text");
    assert_eq!(parts[0]["text"], ":yok:");
  }

  #[test]
  fn parse_action_reads_text_and_superchat() {
    let text_action = json!({
      "addChatItemAction": { "item": { "liveChatTextMessageRenderer": {
        "id": "abc",
        "authorName": { "simpleText": "Ali" },
        "message": { "runs": [{ "text": "selam" }] },
        "timestampUsec": "1700000000000000"
      }}}
    });
    let m = parse_action(&text_action).unwrap();
    assert_eq!(m["user"], "Ali");
    assert_eq!(m["text"], "selam");
    assert_eq!(m["parts"][0]["text"], "selam");
    assert_eq!(m["kind"], "chat");
    assert_eq!(m["ts"], 1_700_000_000_000u64);

    let sc = json!({
      "addChatItemAction": { "item": { "liveChatPaidMessageRenderer": {
        "id": "sc1",
        "authorName": { "simpleText": "Veli" },
        "message": { "simpleText": "destek" },
        "purchaseAmountText": { "simpleText": "₺50,00" }
      }}}
    });
    let m2 = parse_action(&sc).unwrap();
    assert_eq!(m2["kind"], "superchat");
    assert_eq!(m2["amount"], "₺50,00");

    // Bilinmeyen tip sessizce atlanır
    assert!(parse_action(&json!({ "addChatItemAction": { "item": { "başka": {} } } })).is_none());
    assert!(parse_action(&json!({})).is_none());
  }

  #[test]
  fn author_badges_carry_image_or_icon() {
    let r = json!({
      "authorBadges": [
        { "liveChatAuthorBadgeRenderer": {
            "icon": { "iconType": "MODERATOR" },
            "accessibility": { "accessibilityData": { "label": "Moderatör" } }
        }},
        { "liveChatAuthorBadgeRenderer": {
            "customThumbnail": { "thumbnails": [
              { "url": "https://yt3.ggpht.com/uye/s16", "width": 16 },
              { "url": "https://yt3.ggpht.com/uye/s32", "width": 32 }
            ]},
            "tooltip": "Üye (1 yıl)"
        }},
        { "liveChatAuthorBadgeRenderer": {} }
      ]
    });
    let badges = author_badges(&r);
    assert_eq!(badges.len(), 2, "boş rozet elenmeli: {badges:?}");
    assert_eq!(badges[0]["icon"], "moderator");
    assert_eq!(badges[0]["label"], "Moderatör");
    assert!(badges[0]["url"].is_null());
    assert_eq!(badges[1]["url"], "https://yt3.ggpht.com/uye/s32");
    assert_eq!(badges[1]["label"], "Üye (1 yıl)");

    assert!(author_badges(&json!({})).is_empty());
  }

  #[test]
  fn membership_uses_header_subtext() {
    let a = json!({
      "addChatItemAction": { "item": { "liveChatMembershipItemRenderer": {
        "id": "m1",
        "authorName": { "simpleText": "Ayşe" },
        "headerSubtext": { "runs": [{ "text": "Üye oldu" }] }
      }}}
    });
    let m = parse_action(&a).unwrap();
    assert_eq!(m["kind"], "membership");
    assert_eq!(m["text"], "Üye oldu");
  }
}
