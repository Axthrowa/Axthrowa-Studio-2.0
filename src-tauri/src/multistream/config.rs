//! Hedef yapılandırması (saf): doğrulama, ön ayarlar, sır maskeleme.
//!
//! Yayın anahtarı yapılandırmada TUTULMAZ — Windows Kimlik Yöneticisinde (`key_name`) saklanır; API yalnız
//! `hasKey` döner. Sunucu adresine yanlışlıkla anahtar yapıştırılmasını da yakalarız: ayar dosyası ve WebSocket
//! anlık görüntüsü paylaşılıyor, anahtar oraya düşmemeli.

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, Hash)]
#[serde(rename_all = "lowercase")]
pub enum Platform {
  Twitch,
  Kick,
  Youtube,
  Custom,
}

impl Platform {
  pub fn parse(s: &str) -> Option<Self> {
    match s.trim().to_ascii_lowercase().as_str() {
      "twitch" => Some(Self::Twitch),
      "kick" => Some(Self::Kick),
      "youtube" => Some(Self::Youtube),
      "custom" | "rtmp" | "ozel" => Some(Self::Custom),
      _ => None,
    }
  }

  pub fn label(self) -> &'static str {
    match self {
      Self::Twitch => "Twitch",
      Self::Kick => "Kick",
      Self::Youtube => "YouTube",
      Self::Custom => "Özel RTMP",
    }
  }

  /// Önerilen sunucu adresi (kullanıcı değiştirebilir). Kick hesap başına sunucu verdiği için boş.
  pub fn preset_server(self) -> Option<&'static str> {
    match self {
      Self::Twitch => Some("rtmps://live.twitch.tv:443/app"),
      Self::Youtube => Some("rtmps://a.rtmps.youtube.com:443/live2"),
      Self::Kick | Self::Custom => None,
    }
  }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DestinationConfig {
  pub id: String,
  pub name: String,
  pub platform: Platform,
  /// Anahtarsız sunucu adresi (`rtmps://…/app`)
  pub server: String,
  pub enabled: bool,
}

/// Kimlik Yöneticisindeki anahtar adı.
pub fn key_name(id: &str) -> String {
  format!("multistream.key.{id}")
}

/// Sırrın yapılandırmadaki başvurusu (değer değil): `secure://<platform>/<hedef>/stream-key`
pub fn secure_ref(platform: Platform, id: &str) -> String {
  let p = match platform {
    Platform::Twitch => "twitch",
    Platform::Kick => "kick",
    Platform::Youtube => "youtube",
    Platform::Custom => "custom",
  };
  format!("secure://{p}/{id}/stream-key")
}

/// Bağlantı sınaması için sunucu adresinden ana makine ve bağlantı noktası (rtmp 1935, rtmps 443)
pub fn host_port(server: &str) -> Option<(String, u16)> {
  let s = server.trim();
  let (sema, geri) = s.split_once("://")?;
  let varsayilan = match sema.to_ascii_lowercase().as_str() {
    "rtmp" => 1935,
    "rtmps" => 443,
    _ => return None,
  };
  let yetki = geri.split('/').next()?;
  if yetki.is_empty() || yetki.contains('@') {
    return None;
  }
  let (host, port) = match yetki.rsplit_once(':') {
    Some((h, p)) if !h.contains(']') || h.ends_with(']') => (h.trim_matches(['[', ']']).to_string(), p.parse().ok()?),
    _ => (yetki.trim_matches(['[', ']']).to_string(), varsayilan),
  };
  (!host.is_empty()).then_some((host, port))
}

/// Anahtara benzeyen yol parçası: Twitch `live_…`, Kick `sk_…`, YouTube `xxxx-xxxx-xxxx-xxxx(-xxxx)`.
fn looks_like_key(segment: &str) -> bool {
  let s = segment.trim();
  if s.starts_with("live_") || s.starts_with("sk_") {
    return true;
  }
  let parts: Vec<&str> = s.split('-').collect();
  parts.len() >= 4 && parts.iter().all(|p| p.len() == 4 && p.chars().all(|c| c.is_ascii_alphanumeric()))
}

/// Yapılandırmayı doğrular; hata metni kullanıcıya gösterilir (anahtar içermez).
pub fn validate(cfg: &DestinationConfig) -> Result<(), String> {
  if !is_valid_id(&cfg.id) {
    return Err("Geçersiz hedef kimliği".into());
  }
  let name = cfg.name.trim();
  if name.is_empty() || name.chars().count() > 60 {
    return Err("Hedef adı 1-60 karakter olmalı".into());
  }
  let server = cfg.server.trim();
  let url = url::Url::parse(server).map_err(|_| "Sunucu adresi geçersiz".to_string())?;
  match url.scheme() {
    "rtmp" | "rtmps" => {}
    _ => return Err("Sunucu adresi rtmp:// ya da rtmps:// ile başlamalı".into()),
  }
  if url.host_str().unwrap_or("").is_empty() {
    return Err("Sunucu adresinde ana makine yok".into());
  }
  if url.query().is_some() || url.fragment().is_some() || !url.username().is_empty() || url.password().is_some() {
    return Err("Sunucu adresi sorgu, parça ya da kullanıcı bilgisi içeremez".into());
  }
  let segments: Vec<&str> = url.path_segments().map(|s| s.filter(|p| !p.is_empty()).collect()).unwrap_or_default();
  if segments.iter().any(|s| looks_like_key(s)) {
    return Err("Sunucu adresinde yayın anahtarı var gibi görünüyor — anahtarı ayrı alana yazın".into());
  }
  if segments.len() > 3 {
    return Err("Sunucu adresi çok uzun (anahtar ayrı alana yazılmalı)".into());
  }
  // Kick yalnız RTMPS kabul ediyor (resmi yardım, 2026-09-25)
  if cfg.platform == Platform::Kick && url.scheme() != "rtmps" {
    return Err("Kick yalnız rtmps:// sunucu adresi kabul eder".into());
  }
  Ok(())
}

pub fn is_valid_id(id: &str) -> bool {
  !id.is_empty() && id.len() <= 40 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

/// Yayıncıya verilecek tam adres (bellekte kurulur, hiçbir yere yazılmaz).
pub fn publish_url(server: &str, key: &str) -> String {
  format!("{}/{}", server.trim().trim_end_matches('/'), key.trim())
}

/// Metindeki sırları maskeler (FFmpeg hata satırları tam adresi ve anahtarı içerebilir).
pub fn redact(text: &str, secrets: &[&str]) -> String {
  let mut out = text.to_string();
  for s in secrets {
    let s = s.trim();
    if s.len() >= 4 {
      out = out.replace(s, "***");
    }
  }
  out
}

/// Ayar dalından hedef listesini okur; bozuk kayıtları atlar.
pub fn parse_list(v: &Value) -> Vec<DestinationConfig> {
  v.get("destinations")
    .and_then(|d| d.as_array())
    .map(|arr| {
      arr
        .iter()
        .filter_map(|x| serde_json::from_value::<DestinationConfig>(x.clone()).ok())
        .filter(|c| validate(c).is_ok())
        .collect()
    })
    .unwrap_or_default()
}

#[cfg(test)]
mod tests {
  use super::*;
  use serde_json::json;

  fn cfg(platform: Platform, server: &str) -> DestinationConfig {
    DestinationConfig {
      id: "d1".into(),
      name: "Ana".into(),
      platform,
      server: server.into(),
      enabled: true,
    }
  }

  #[test]
  fn gecerli_adresler() {
    assert!(validate(&cfg(Platform::Twitch, "rtmps://live.twitch.tv:443/app")).is_ok());
    assert!(validate(&cfg(Platform::Youtube, "rtmp://a.rtmp.youtube.com/live2")).is_ok());
    assert!(validate(&cfg(Platform::Kick, "rtmps://abc.global-contribute.live-video.net:443/app")).is_ok());
    assert!(validate(&cfg(Platform::Custom, "rtmp://127.0.0.1:1935/live")).is_ok());
  }

  #[test]
  fn anahtar_sunucu_alanina_yapistirilirsa_reddedilir() {
    for adres in [
      "rtmps://live.twitch.tv/app/live_123456_AbCdEf",
      "rtmps://x.live-video.net/app/sk_us-west-2_abcdef",
      "rtmp://a.rtmp.youtube.com/live2/ab12-cd34-ef56-gh78-ij90",
      "rtmp://h/app?key=1",
    ] {
      assert!(validate(&cfg(Platform::Custom, adres)).is_err(), "{adres}");
    }
  }

  #[test]
  fn sema_ve_kick_rtmps_kurali() {
    assert!(validate(&cfg(Platform::Custom, "http://x/app")).is_err());
    assert!(validate(&cfg(Platform::Custom, "srt://x:9000")).is_err());
    assert!(validate(&cfg(Platform::Kick, "rtmp://x.live-video.net/app")).is_err());
  }

  #[test]
  fn ad_ve_kimlik() {
    let mut c = cfg(Platform::Custom, "rtmp://h/app");
    c.name = "   ".into();
    assert!(validate(&c).is_err());
    c.name = "x".into();
    c.id = "../kaçış".into();
    assert!(validate(&c).is_err());
  }

  #[test]
  fn maskeleme_ve_adres() {
    let url = publish_url("rtmps://live.twitch.tv:443/app/", "live_1_x");
    assert_eq!(url, "rtmps://live.twitch.tv:443/app/live_1_x");
    let hata = format!("[tls] {url}: Connection refused");
    let m = redact(&hata, &[&url, "live_1_x"]);
    assert!(!m.contains("live_1_x"), "{m}");
  }

  #[test]
  fn ayardan_liste_bozuklari_atlar() {
    let v = json!({"destinations": [
      {"id": "a", "name": "Twitch", "platform": "twitch", "server": "rtmps://live.twitch.tv:443/app", "enabled": true},
      {"id": "b", "name": "Bozuk", "platform": "twitch", "server": "ftp://x", "enabled": true},
      {"id": "c", "platform": "kick"}
    ]});
    let l = parse_list(&v);
    assert_eq!(l.len(), 1);
    assert_eq!(l[0].id, "a");
  }

  #[test]
  fn guvenli_basvuru_ve_sunucu_ayristirma() {
    assert_eq!(secure_ref(Platform::Twitch, "t1"), "secure://twitch/t1/stream-key");
    assert_eq!(host_port("rtmps://live.twitch.tv:443/app"), Some(("live.twitch.tv".into(), 443)));
    assert_eq!(host_port("rtmp://127.0.0.1/live"), Some(("127.0.0.1".into(), 1935)));
    assert_eq!(host_port("rtmps://a.rtmp.youtube.com/live2"), Some(("a.rtmp.youtube.com".into(), 443)));
    assert_eq!(host_port("http://x/y"), None);
    assert_eq!(host_port("rtmp://kisi:parola@x/y"), None);
    assert_eq!(host_port("rtmp:///y"), None);
  }

}
