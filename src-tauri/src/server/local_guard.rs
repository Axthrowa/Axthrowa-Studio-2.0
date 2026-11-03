//! Yerel sunucu koruması — yayıncının tarayıcısında açık olan yabancı sitelere karşı.
//!
//! Tehdit modeli: sunucu `127.0.0.1:8843`'te dinliyor ve loopback'i güvenilir
//! sayıyor (Bearer yalnız LAN/WAN isteklerinde isteniyor). CORS her kökene açık
//! olduğundan yayıncının ziyaret ettiği HERHANGİ bir web sayfası
//! `fetch("http://127.0.0.1:8843/api/...")` ile ayarları okuyabiliyor, OBS'i
//! yönetebiliyor, yayını başlatıp durdurabiliyor, uzak yönetici hesabı
//! açabiliyordu.
//!
//! Üç katman (AxBoT'daki `local-guard` / `origin-guard` ile aynı model):
//!  1. **Host izin listesi** — DNS yeniden bağlama: saldırgan kendi alan adını
//!     127.0.0.1'e çözdürürse istek `Host: kotu.com:8843` ile gelir.
//!  2. **Köken denetimi** — yazma istekleri (POST/PUT/PATCH/DELETE) ve
//!     WebSocket el sıkışması yabancı kökenden gelemez. CORS tek başına
//!     yetmez: ön kontrolsüz ("basit") istekler sunucuda yine ÇALIŞIR,
//!     tarayıcılar WebSocket'e CORS uygulamaz.
//!  3. **CORS beyaz listesi** — yabancı köken yanıtı okuyamaz (`cors_origin_ok`).
//!
//! Köken başlığı hiç yoksa istek kabul edilir: tarayıcılar çapraz köken yazma
//! isteklerinde ve WebSocket el sıkışmasında Origin'i her zaman gönderir;
//! başlıksız gelenler curl, OBS eklentileri ve sunucudan sunucuya çağrılardır.

use std::net::IpAddr;

use axum::extract::Request;
use axum::http::{header, HeaderMap, HeaderValue, Method, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};

/// Kullanıcının ek olarak izin verdiği ana makine adları (virgülle ayrılmış),
/// ör. tünel ya da `yayin-pc.local`: `YYA_IZINLI_HOSTLAR=yayin-pc.local`.
const EK_HOST_ORTAM: &str = "YYA_IZINLI_HOSTLAR";

/// `"127.0.0.1:8843"` → `"127.0.0.1"`, `"[::1]:8843"` → `"::1"`, büyük/küçük harf duyarsız.
pub fn host_name(host: &str) -> String {
  let h = host.trim().to_ascii_lowercase();
  if let Some(rest) = h.strip_prefix('[') {
    return rest.split(']').next().unwrap_or("").to_string();
  }
  // Tek ':' port ayırıcısıdır; birden çoksa köşeli parantezsiz IPv6'dır.
  if h.matches(':').count() == 1 {
    return h.split(':').next().unwrap_or("").to_string();
  }
  h
}

fn loopback_name(name: &str) -> bool {
  name == "localhost" || name.parse::<IpAddr>().map(|ip| ip.is_loopback()).unwrap_or(false)
}

/// Bu makinenin adı (LAN kipinde OBS `http://MAKINE-ADI:8843` ile bağlanabilir).
fn machine_name() -> Option<String> {
  std::env::var("COMPUTERNAME")
    .or_else(|_| std::env::var("HOSTNAME"))
    .ok()
    .map(|s| s.trim().to_ascii_lowercase())
    .filter(|s| !s.is_empty())
}

fn extra_hosts() -> Vec<String> {
  std::env::var(EK_HOST_ORTAM)
    .unwrap_or_default()
    .split(',')
    .map(host_name)
    .filter(|s| !s.is_empty())
    .collect()
}

/// Host başlığı kabul edilir mi?
///
/// IP adresleri (LAN kipinde bu makinenin IP'si) her zaman kabul: DNS yeniden
/// bağlama bir ALAN ADI gerektirir, IP ile gelen sayfa zaten bu sunucudan
/// yüklenmiştir.
pub fn host_allowed(host: Option<&str>, machine: Option<&str>, extra: &[String]) -> bool {
  let Some(host) = host else {
    // HTTP/1.0 istemcileri Host göndermeyebilir; tarayıcılar her zaman gönderir.
    return true;
  };
  let name = host_name(host);
  if name.is_empty() {
    return true;
  }
  loopback_name(&name)
    || name.parse::<IpAddr>().is_ok()
    || machine.map(|m| m == name).unwrap_or(false)
    || extra.iter().any(|e| e == &name)
}

/// Köken kabul edilir mi?
///
/// * yerel kökenler (localhost / 127.0.0.1 / ::1, her port — gömülü AxBoT,
///   geliştirme sunucuları)
/// * Tauri penceresinin kendi kökeni
/// * isteğin Host'u ile birebir aynı köken (LAN'daki uzak panel / OBS sayfası)
///
/// `null` köken (sandbox'lı iframe, `file://`) GÜVENİLMEZ: kötü niyetli bir
/// sayfa sandbox iframe ile bunu kolayca üretebilir.
pub fn origin_allowed(origin: &str, host: Option<&str>) -> bool {
  let o = origin.trim();
  if o.is_empty() || o.eq_ignore_ascii_case("null") {
    return false;
  }
  let Ok(url) = url::Url::parse(o) else {
    return false;
  };
  if url.scheme() == "tauri" {
    return true;
  }
  if url.scheme() != "http" && url.scheme() != "https" {
    return false;
  }
  let Some(name) = url.host_str().map(host_name) else {
    return false;
  };
  if loopback_name(&name) || name == "tauri.localhost" {
    return true;
  }
  // Aynı köken: Origin'in ana makine + portu Host başlığıyla eşleşmeli.
  let Some(host) = host else {
    return false;
  };
  let port = url.port_or_known_default().unwrap_or(80);
  let host_l = host.trim().to_ascii_lowercase();
  let host_port = if host_l.starts_with('[') {
    host_l.rsplit_once("]:").and_then(|(_, p)| p.parse::<u16>().ok())
  } else if host_l.matches(':').count() == 1 {
    host_l.rsplit_once(':').and_then(|(_, p)| p.parse::<u16>().ok())
  } else {
    None
  }
  .unwrap_or(80);
  host_name(&host_l) == name && host_port == port
}

/// Bu istek köken denetimine tabi mi: yan etkili yöntem veya WebSocket el sıkışması.
pub fn needs_origin_check(method: &Method, headers: &HeaderMap) -> bool {
  let yazma = !matches!(*method, Method::GET | Method::HEAD | Method::OPTIONS);
  let websocket = headers
    .get(header::UPGRADE)
    .and_then(|v| v.to_str().ok())
    .map(|v| v.eq_ignore_ascii_case("websocket"))
    .unwrap_or(false);
  yazma || websocket
}

/// Hangi kararın neden verildiği (test ve günlük için).
#[derive(Debug, PartialEq, Eq)]
pub enum Verdict {
  Allow,
  BadHost,
  BadOrigin,
}

pub fn decide(method: &Method, headers: &HeaderMap, machine: Option<&str>, extra: &[String]) -> Verdict {
  let host = headers.get(header::HOST).and_then(|v| v.to_str().ok());
  if !host_allowed(host, machine, extra) {
    return Verdict::BadHost;
  }
  if needs_origin_check(method, headers) {
    if let Some(origin) = headers.get(header::ORIGIN) {
      let ok = origin.to_str().map(|o| origin_allowed(o, host)).unwrap_or(false);
      if !ok {
        return Verdict::BadOrigin;
      }
    }
  }
  Verdict::Allow
}

/// Axum ara katmanı — tüm isteklerin en dışında çalışır.
pub async fn guard(req: Request, next: Next) -> Response {
  let machine = machine_name();
  let extra = extra_hosts();
  match decide(req.method(), req.headers(), machine.as_deref(), &extra) {
    Verdict::Allow => next.run(req).await,
    Verdict::BadHost => {
      let host = req
        .headers()
        .get(header::HOST)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .chars()
        .take(80)
        .collect::<String>();
      yya_warn!("[güvenlik] izinsiz Host reddedildi: {host} {}", req.uri().path());
      (
        StatusCode::FORBIDDEN,
        format!("Bu adres ({host}) kabul edilmiyor. Tünel/özel ad için {EK_HOST_ORTAM} ortam değişkenine ekleyin."),
      )
        .into_response()
    }
    Verdict::BadOrigin => {
      let origin = req
        .headers()
        .get(header::ORIGIN)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .chars()
        .take(80)
        .collect::<String>();
      yya_warn!(
        "[güvenlik] yabancı köken reddedildi: {origin} → {} {}",
        req.method(),
        req.uri().path()
      );
      (StatusCode::FORBIDDEN, "Yabancı kökenden istek reddedildi").into_response()
    }
  }
}

/// CORS katmanı için köken yüklemi (yabancı köken yanıtı okuyamasın).
pub fn cors_origin_ok(origin: &HeaderValue, parts: &axum::http::request::Parts) -> bool {
  let host = parts.headers.get(header::HOST).and_then(|v| v.to_str().ok());
  origin.to_str().map(|o| origin_allowed(o, host)).unwrap_or(false)
}

#[cfg(test)]
mod tests {
  use super::*;

  fn basliklar(pairs: &[(&str, &str)]) -> HeaderMap {
    let mut h = HeaderMap::new();
    for (k, v) in pairs {
      h.insert(
        axum::http::HeaderName::from_bytes(k.as_bytes()).unwrap(),
        HeaderValue::from_str(v).unwrap(),
      );
    }
    h
  }

  #[test]
  fn host_adi_port_ve_koseli_parantezi_ayiklar() {
    assert_eq!(host_name("127.0.0.1:8843"), "127.0.0.1");
    assert_eq!(host_name("[::1]:8843"), "::1");
    assert_eq!(host_name("LocalHost"), "localhost");
    assert_eq!(host_name("fe80::1"), "fe80::1");
  }

  #[test]
  fn dns_yeniden_baglama_alan_adi_reddedilir() {
    assert!(!host_allowed(Some("kotu.example:8843"), None, &[]));
    assert!(!host_allowed(Some("127.0.0.1.nip.io:8843"), None, &[]));
    assert!(host_allowed(Some("127.0.0.1:8843"), None, &[]));
    assert!(host_allowed(Some("localhost:8843"), None, &[]));
    assert!(host_allowed(Some("[::1]:8843"), None, &[]));
    // LAN kipi: bu makinenin IP'si
    assert!(host_allowed(Some("192.168.1.5:8843"), None, &[]));
    // Makine adı ve kullanıcı eki
    assert!(host_allowed(Some("YAYIN-PC:8843"), Some("yayin-pc"), &[]));
    assert!(host_allowed(Some("tunel.example"), None, &["tunel.example".into()]));
    assert!(host_allowed(None, None, &[]));
  }

  #[test]
  fn yerel_ve_ayni_kokenler_kabul() {
    assert!(origin_allowed("http://127.0.0.1:8843", Some("127.0.0.1:8843")));
    assert!(origin_allowed("http://localhost:3001", Some("127.0.0.1:8843")));
    assert!(origin_allowed("http://tauri.localhost", Some("127.0.0.1:8843")));
    assert!(origin_allowed("tauri://localhost", Some("127.0.0.1:8843")));
    assert!(origin_allowed("http://192.168.1.5:8843", Some("192.168.1.5:8843")));
  }

  #[test]
  fn yabanci_kokenler_reddedilir() {
    assert!(!origin_allowed("https://kotu.example", Some("127.0.0.1:8843")));
    assert!(!origin_allowed("null", Some("127.0.0.1:8843")));
    assert!(!origin_allowed("", Some("127.0.0.1:8843")));
    assert!(!origin_allowed("file://", Some("127.0.0.1:8843")));
    // LAN IP'si ama farklı port: aynı köken değil
    assert!(!origin_allowed("http://192.168.1.5:9999", Some("192.168.1.5:8843")));
    // Rebinding: köken ve Host aynı alan adı olsa da Host katmanı reddeder
    let h = basliklar(&[("host", "kotu.example:8843"), ("origin", "http://kotu.example:8843")]);
    assert_eq!(decide(&Method::POST, &h, None, &[]), Verdict::BadHost);
  }

  #[test]
  fn yazma_ve_websocket_koken_ister_okuma_istemez() {
    let yabanci = basliklar(&[("host", "127.0.0.1:8843"), ("origin", "https://kotu.example")]);
    assert_eq!(decide(&Method::POST, &yabanci, None, &[]), Verdict::BadOrigin);
    assert_eq!(decide(&Method::DELETE, &yabanci, None, &[]), Verdict::BadOrigin);
    // GET yanıtını CORS gizler; burada reddedilmez (OBS/görsel yüklemeleri)
    assert_eq!(decide(&Method::GET, &yabanci, None, &[]), Verdict::Allow);

    let ws = basliklar(&[
      ("host", "127.0.0.1:8843"),
      ("origin", "https://kotu.example"),
      ("upgrade", "websocket"),
    ]);
    assert_eq!(decide(&Method::GET, &ws, None, &[]), Verdict::BadOrigin);

    // Köken yok: curl / sunucudan sunucuya
    let yok = basliklar(&[("host", "127.0.0.1:8843")]);
    assert_eq!(decide(&Method::POST, &yok, None, &[]), Verdict::Allow);

    let yerel = basliklar(&[("host", "127.0.0.1:8843"), ("origin", "http://127.0.0.1:8843")]);
    assert_eq!(decide(&Method::POST, &yerel, None, &[]), Verdict::Allow);
  }
}
