//! Y11: planlı yayını Discord sunucusunda etkinlik (Guild Scheduled Event, dış konum) olarak açar.
//! Bot token'ı yalnız Kimlik Yöneticisinde durur; hiçbir yanıtta dönmez. Tüm uçlar yalnız bu bilgisayardan çağrılır.
//! Botun sunucuda "Etkinlikleri Yönet" (MANAGE_EVENTS) izni olmalı.

use std::net::SocketAddr;
use std::sync::Arc;

use axum::extract::{ConnectInfo, State};
use axum::http::{HeaderMap, StatusCode};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};

use super::control_plane::{audit, authorize};
use crate::AppState;

type Hata = (StatusCode, String);
type ApiResult = Result<Json<Value>, Hata>;

const API: &str = "https://discord.com/api/v10";
const TOKEN_ANAHTARI: &str = "discord.bot_token";
const SUNUCU_ANAHTARI: &str = "discord.guild_id";
const PERM: &str = "settings.write";

pub fn router() -> Router<Arc<AppState>> {
  Router::new()
    .route("/api/discord/etkinlik/durum", get(api_durum))
    .route("/api/discord/etkinlik/ayar", post(api_ayar))
    .route("/api/discord/etkinlik", post(api_ekle))
    .route("/api/discord/etkinlik/sil", post(api_sil))
}

fn yerel(addr: &SocketAddr) -> Result<(), Hata> {
  if addr.ip().is_loopback() {
    Ok(())
  } else {
    Err((StatusCode::FORBIDDEN, "yalnız bu bilgisayardan".into()))
  }
}

fn bad(m: impl Into<String>) -> Hata {
  (StatusCode::BAD_REQUEST, m.into())
}

fn durum() -> Value {
  json!({
    "tokenVar": crate::secret_store::get_secret(TOKEN_ANAHTARI).is_some(),
    "sunucuId": crate::secret_store::get_secret(SUNUCU_ANAHTARI).unwrap_or_default(),
  })
}

/// Discord kar tanesi kimliği: 17–20 rakam
pub fn kimlik_gecerli(s: &str) -> bool {
  (17..=20).contains(&s.len()) && s.bytes().all(|b| b.is_ascii_digit())
}

fn istemci() -> reqwest::Client {
  reqwest::Client::builder()
    .timeout(std::time::Duration::from_secs(15))
    .build()
    .unwrap_or_else(|_| reqwest::Client::new())
}

/// Discord yanıtını hataya çevirir; token asla mesaja girmez
async fn discord_cevabi(r: reqwest::Result<reqwest::Response>) -> Result<Value, Hata> {
  let r = r.map_err(|e| (StatusCode::BAD_GATEWAY, format!("Discord'a ulaşılamadı: {}", e.without_url())))?;
  let kod = r.status();
  if kod == reqwest::StatusCode::NO_CONTENT {
    return Ok(Value::Null);
  }
  let v: Value = r.json().await.unwrap_or(Value::Null);
  if kod.is_success() {
    return Ok(v);
  }
  let neden = match kod.as_u16() {
    401 => "bot token'ı geçersiz".to_string(),
    403 => "botun bu sunucuda 'Etkinlikleri Yönet' izni yok".to_string(),
    404 => "sunucu bulunamadı ya da bot sunucuda değil".to_string(),
    _ => v["message"].as_str().unwrap_or("bilinmeyen hata").chars().take(160).collect(),
  };
  Err((StatusCode::BAD_GATEWAY, format!("Discord {}: {neden}", kod.as_u16())))
}

fn kimlikler() -> Result<(String, String), Hata> {
  let token = crate::secret_store::get_secret(TOKEN_ANAHTARI).ok_or_else(|| bad("Discord bot token'ı girilmemiş"))?;
  let sunucu = crate::secret_store::get_secret(SUNUCU_ANAHTARI).ok_or_else(|| bad("Discord sunucu kimliği girilmemiş"))?;
  Ok((token, sunucu))
}

async fn api_durum(ConnectInfo(addr): ConnectInfo<SocketAddr>) -> ApiResult {
  yerel(&addr)?;
  Ok(Json(durum()))
}

#[derive(Deserialize)]
struct AyarGovdesi {
  #[serde(default)]
  token: Option<String>,
  #[serde(default, rename = "sunucuId")]
  sunucu_id: Option<String>,
  #[serde(default)]
  sil: bool,
}

/// Token ve sunucu kaydedilir; ikisi de varsa sunucu okunarak sınanır (yalnız okuma, Discord'da bir şey değişmez)
async fn api_ayar(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<AyarGovdesi>,
) -> ApiResult {
  yerel(&addr)?;
  let actor = authorize(&state, &addr, &headers, PERM).await?;
  if g.sil {
    crate::secret_store::delete_secret(TOKEN_ANAHTARI);
    crate::secret_store::delete_secret(SUNUCU_ANAHTARI);
    audit(&state, &actor, "DISCORD_TOKEN_DELETE", json!({})).await;
    return Ok(Json(durum()));
  }
  if let Some(s) = g.sunucu_id.as_deref().map(str::trim) {
    if !kimlik_gecerli(s) {
      return Err(bad("Sunucu kimliği 17–20 haneli bir sayı olmalı (Discord'da sunucuya sağ tık → Sunucu ID'sini kopyala)"));
    }
    if !crate::secret_store::set_secret(SUNUCU_ANAHTARI, s) {
      return Err((StatusCode::INTERNAL_SERVER_ERROR, "Sunucu kimliği kaydedilemedi".into()));
    }
  }
  if let Some(t) = g.token.as_deref().map(str::trim).filter(|t| !t.is_empty()) {
    if t.len() > 200 || t.chars().any(char::is_whitespace) {
      return Err(bad("Bot token'ı biçimi geçersiz"));
    }
    if !crate::secret_store::set_secret(TOKEN_ANAHTARI, t) {
      return Err((StatusCode::INTERNAL_SERVER_ERROR, "Token kaydedilemedi".into()));
    }
    audit(&state, &actor, "DISCORD_TOKEN_SET", json!({})).await;
  }
  let mut v = durum();
  if let Ok((token, sunucu)) = kimlikler() {
    let r = istemci().get(format!("{API}/guilds/{sunucu}")).header("Authorization", format!("Bot {token}")).send().await;
    match discord_cevabi(r).await {
      Ok(s) => v["sunucuAdi"] = s["name"].clone(),
      Err((_, m)) => v["hata"] = json!(m),
    }
  }
  Ok(Json(v))
}

#[derive(Deserialize)]
pub struct EtkinlikGovdesi {
  pub baslik: String,
  /// RFC 3339 başlangıç
  pub zaman: String,
  #[serde(rename = "sureDk")]
  pub sure_dk: i64,
  /// Dış konum: yayın adresi (ör. https://twitch.tv/kanal)
  pub konum: String,
  #[serde(default)]
  pub aciklama: String,
}

/// Discord `POST /guilds/{id}/scheduled-events` gövdesi: dış etkinlik (entity_type 3) için konum ve bitiş zorunlu,
/// gizlilik yalnız GUILD_ONLY (2). Ad 1–100, açıklama en çok 1000, konum en çok 100 karakter.
pub fn etkinlik_govdesi(g: &EtkinlikGovdesi, simdi: chrono::DateTime<chrono::Utc>) -> Result<Value, String> {
  let bas = chrono::DateTime::parse_from_rfc3339(&g.zaman).map_err(|_| "başlangıç zamanı geçersiz")?.with_timezone(&chrono::Utc);
  if bas <= simdi {
    return Err("Discord geçmiş zamanlı etkinlik kabul etmez".into());
  }
  let sure = g.sure_dk.clamp(30, 1440);
  let ad: String = g.baslik.trim().chars().take(100).collect();
  let konum: String = g.konum.trim().chars().take(100).collect();
  if konum.is_empty() {
    return Err("konum (yayın adresi) boş".into());
  }
  let mut v = json!({
    "name": if ad.is_empty() { "Yayın".to_string() } else { ad },
    "privacy_level": 2,
    "entity_type": 3,
    "entity_metadata": { "location": konum },
    "scheduled_start_time": bas.to_rfc3339_opts(chrono::SecondsFormat::Secs, true),
    "scheduled_end_time": (bas + chrono::Duration::minutes(sure)).to_rfc3339_opts(chrono::SecondsFormat::Secs, true),
  });
  let aciklama: String = g.aciklama.trim().chars().take(1000).collect();
  if !aciklama.is_empty() {
    v["description"] = json!(aciklama);
  }
  Ok(v)
}

async fn api_ekle(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<EtkinlikGovdesi>,
) -> ApiResult {
  yerel(&addr)?;
  let actor = authorize(&state, &addr, &headers, PERM).await?;
  let govde = etkinlik_govdesi(&g, chrono::Utc::now()).map_err(bad)?;
  let (token, sunucu) = kimlikler()?;
  let r = istemci()
    .post(format!("{API}/guilds/{sunucu}/scheduled-events"))
    .header("Authorization", format!("Bot {token}"))
    .json(&govde)
    .send()
    .await;
  let v = discord_cevabi(r).await?;
  let id = v["id"].as_str().unwrap_or_default().to_string();
  audit(&state, &actor, "DISCORD_EVENT_CREATE", json!({"id": id, "ad": govde["name"]})).await;
  Ok(Json(json!({ "id": id })))
}

#[derive(Deserialize)]
struct SilGovdesi {
  id: String,
}

async fn api_sil(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<SilGovdesi>,
) -> ApiResult {
  yerel(&addr)?;
  let actor = authorize(&state, &addr, &headers, PERM).await?;
  if !kimlik_gecerli(&g.id) {
    return Err(bad("etkinlik kimliği geçersiz"));
  }
  let (token, sunucu) = kimlikler()?;
  let r = istemci()
    .delete(format!("{API}/guilds/{sunucu}/scheduled-events/{}", g.id))
    .header("Authorization", format!("Bot {token}"))
    .send()
    .await;
  // Discord'da elle silinmişse (404) Studio'dan silinmesi engellenmez
  if !matches!(&r, Ok(c) if c.status() == reqwest::StatusCode::NOT_FOUND) {
    discord_cevabi(r).await?;
  }
  audit(&state, &actor, "DISCORD_EVENT_DELETE", json!({"id": g.id})).await;
  Ok(Json(json!({ "tamam": true })))
}

#[cfg(test)]
mod tests {
  use super::*;

  fn g(zaman: &str, sure: i64, baslik: &str) -> EtkinlikGovdesi {
    EtkinlikGovdesi { baslik: baslik.into(), zaman: zaman.into(), sure_dk: sure, konum: "https://twitch.tv/kanal".into(), aciklama: String::new() }
  }

  #[test]
  fn govde_dis_etkinlik_ve_bitis() {
    let simdi = chrono::DateTime::parse_from_rfc3339("2026-11-16T10:00:00Z").unwrap().with_timezone(&chrono::Utc);
    let v = etkinlik_govdesi(&g("2026-11-20T17:00:00.000Z", 90, " Oyun "), simdi).unwrap();
    assert_eq!(v["entity_type"], 3);
    assert_eq!(v["privacy_level"], 2);
    assert_eq!(v["name"], "Oyun");
    assert_eq!(v["entity_metadata"]["location"], "https://twitch.tv/kanal");
    assert_eq!(v["scheduled_start_time"], "2026-11-20T17:00:00Z");
    assert_eq!(v["scheduled_end_time"], "2026-11-20T18:30:00Z");
    assert!(v.get("description").is_none());
    assert_eq!(etkinlik_govdesi(&g("2026-11-20T17:00:00Z", 1, ""), simdi).unwrap()["name"], "Yayın");
    assert!(etkinlik_govdesi(&g("2026-11-15T17:00:00Z", 60, "x"), simdi).is_err());
    assert!(etkinlik_govdesi(&g("yarın", 60, "x"), simdi).is_err());
  }

  #[test]
  fn kimlik_denetimi() {
    assert!(kimlik_gecerli("123456789012345678"));
    assert!(!kimlik_gecerli("12345"));
    assert!(!kimlik_gecerli("12345678901234567a"));
  }
}
