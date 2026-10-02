//! Yardım › Güncellemeleri denetle. Uygulamanın kendi dağıtım sunucusu yoktur: kullanıcı bir güncelleme bildirimi
//! adresi tanımlar (JSON: `{"surum": "1.2.0", "sayfa": "https://…", "notlar": "…"}`). Denetim yalnız kullanıcı
//! istediğinde yapılır; hiçbir şey indirilmez ya da çalıştırılmaz — yalnız sürüm karşılaştırılır ve sayfa bağlantısı
//! gösterilir. Adres https olmalı (sınama için yalnız 127.0.0.1/localhost'ta http). Yanıt en çok 64 KB, 8 sn.

use std::net::SocketAddr;
use std::sync::Arc;

use axum::extract::{ConnectInfo, State};
use axum::http::{HeaderMap, StatusCode};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::control_plane::{audit, authorize};
use super::motor_api::Hata;
use crate::AppState;

type ApiResult = Result<Json<Value>, Hata>;

const DOSYA: &str = "guncelleme.json";
const EN_COK_BAYT: usize = 64 * 1024;

#[derive(Default, Serialize, Deserialize)]
struct Ayar {
  #[serde(default)]
  adres: String,
}

pub fn router() -> Router<Arc<AppState>> {
  Router::new()
    .route("/api/guncelleme", get(api_ayar).post(api_ayarla))
    .route("/api/guncelleme/denetle", post(api_denetle))
}

/// Dışarıya istek yaptıran uçlar yalnız bu bilgisayardan (uzak istemci adresi değiştirip sunucuya istek attıramasın)
fn yerel(addr: &SocketAddr) -> Result<(), Hata> {
  if addr.ip().is_loopback() {
    Ok(())
  } else {
    Err((StatusCode::FORBIDDEN, "yalnız bu bilgisayardan".into()))
  }
}

fn gecersiz(e: impl Into<String>) -> Hata {
  (StatusCode::BAD_REQUEST, e.into())
}

/// https ya da yalnız yerel adreste http
pub fn adres_gecerli(adres: &str) -> bool {
  let Ok(u) = url::Url::parse(adres.trim()) else { return false };
  match u.scheme() {
    "https" => u.host_str().is_some(),
    "http" => matches!(u.host_str(), Some("127.0.0.1") | Some("localhost") | Some("[::1]")),
    _ => false,
  }
}

/// "1.10.2" > "1.9.9": sayısal parça karşılaştırması (önde `v` olabilir; sayı olmayan parça 0)
pub fn surum_buyuk(yeni: &str, mevcut: &str) -> bool {
  let parca = |s: &str| -> Vec<u64> { s.trim().trim_start_matches(['v', 'V']).split(['.', '-', '+']).take(3).map(|p| p.parse().unwrap_or(0)).collect() };
  let (a, b) = (parca(yeni), parca(mevcut));
  for i in 0..3 {
    let (x, y) = (a.get(i).copied().unwrap_or(0), b.get(i).copied().unwrap_or(0));
    if x != y {
      return x > y;
    }
  }
  false
}

fn oku(state: &AppState) -> Ayar {
  std::fs::read_to_string(state.data_dir.join(DOSYA)).ok().and_then(|m| serde_json::from_str(&m).ok()).unwrap_or_default()
}

async fn api_ayar(State(state): State<Arc<AppState>>, ConnectInfo(addr): ConnectInfo<SocketAddr>, headers: HeaderMap) -> ApiResult {
  authorize(&state, &addr, &headers, "broadcast.read").await?;
  Ok(Json(json!({"adres": oku(&state).adres, "surum": env!("CARGO_PKG_VERSION")})))
}

async fn api_ayarla(State(state): State<Arc<AppState>>, ConnectInfo(addr): ConnectInfo<SocketAddr>, headers: HeaderMap, Json(g): Json<Ayar>) -> ApiResult {
  yerel(&addr)?;
  let actor = authorize(&state, &addr, &headers, "broadcast.read").await?;
  let adres = g.adres.trim().to_string();
  if !adres.is_empty() && !adres_gecerli(&adres) {
    return Err(gecersiz("adres https olmalı (yerel sınama için yalnız 127.0.0.1'de http)"));
  }
  let metin = serde_json::to_string_pretty(&Ayar { adres: adres.clone() }).map_err(|e| gecersiz(e.to_string()))?;
  std::fs::write(state.data_dir.join(DOSYA), metin).map_err(|e| (StatusCode::CONFLICT, e.to_string()))?;
  audit(&state, &actor, "UPDATE_CHECK_URL", json!({"tanimli": !adres.is_empty()})).await;
  Ok(Json(json!({"ok": true})))
}

async fn api_denetle(State(state): State<Arc<AppState>>, ConnectInfo(addr): ConnectInfo<SocketAddr>, headers: HeaderMap) -> ApiResult {
  yerel(&addr)?;
  authorize(&state, &addr, &headers, "broadcast.read").await?;
  let mevcut = env!("CARGO_PKG_VERSION");
  let adres = oku(&state).adres;
  if adres.is_empty() {
    return Ok(Json(json!({"tanimli": false, "mevcut": mevcut})));
  }
  if !adres_gecerli(&adres) {
    return Err(gecersiz("kayıtlı adres geçersiz"));
  }
  let istemci = reqwest::Client::builder()
    .timeout(std::time::Duration::from_secs(8))
    .redirect(reqwest::redirect::Policy::limited(3))
    .build()
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  let yanit = istemci.get(&adres).send().await.map_err(|e| (StatusCode::BAD_GATEWAY, format!("bildirim okunamadı: {e}")))?;
  if !yanit.status().is_success() {
    return Err((StatusCode::BAD_GATEWAY, format!("bildirim adresi {} döndü", yanit.status())));
  }
  let bayt = yanit.bytes().await.map_err(|e| (StatusCode::BAD_GATEWAY, e.to_string()))?;
  if bayt.len() > EN_COK_BAYT {
    return Err((StatusCode::BAD_GATEWAY, "bildirim çok büyük".into()));
  }
  let v: Value = serde_json::from_slice(&bayt).map_err(|_| (StatusCode::BAD_GATEWAY, "bildirim JSON değil".to_string()))?;
  let son = v["surum"].as_str().ok_or((StatusCode::BAD_GATEWAY, "bildirimde 'surum' yok".to_string()))?.chars().take(32).collect::<String>();
  // Sayfa yalnız https ise gösterilir (javascript:/file: bağlantısı verilmez)
  let sayfa = v["sayfa"].as_str().filter(|s| url::Url::parse(s).is_ok_and(|u| u.scheme() == "https")).map(String::from);
  let notlar = v["notlar"].as_str().map(|s| s.chars().take(2000).collect::<String>());
  Ok(Json(json!({"tanimli": true, "mevcut": mevcut, "son": son, "yeniVar": surum_buyuk(&son, mevcut), "sayfa": sayfa, "notlar": notlar})))
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn adres_ve_surum() {
    assert!(adres_gecerli("https://ornek.com/guncelleme.json"));
    assert!(adres_gecerli("http://127.0.0.1:9000/x.json"));
    assert!(!adres_gecerli("http://ornek.com/x.json"), "dış adreste düz http");
    assert!(!adres_gecerli("file:///C:/x.json"));
    assert!(!adres_gecerli("javascript:alert(1)"));
    assert!(surum_buyuk("1.10.0", "1.9.9"));
    assert!(surum_buyuk("v2.0", "1.99.99"));
    assert!(!surum_buyuk("1.0.0", "1.0.0"));
    assert!(!surum_buyuk("0.9", "1.0.0"));
    assert!(surum_buyuk("1.0.1-beta", "1.0.0"));
  }
}
