//! T8: cihaz eşleştirme. Bu bilgisayardaki panel tek kullanımlık, 60 sn geçerli bir kod üretir; telefon kodu
//! `/api/bot/remote/eslestirme/tamamla` ile bir kez kullanır ve yalnız seçilen izinleri taşıyan kendi anahtarını alır.
//! Cihaz yönetici olamaz: ayarlara, yayın anahtarına ve OBS şifresine giden uçlar (`perm_checked_path` dışı) 403 döner.
//! Kod üretme, cihaz listesi ve iptal yalnız loopback'ten.

use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;

use axum::extract::{ConnectInfo, State};
use axum::http::StatusCode;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde_json::{json, Value};

use super::bot_api::{simdi_ms, GIRIS_DENEMELERI};
use super::control_plane::{audit, Actor};
use crate::db::bot_api::{cihaz_ekle, cihaz_izinlerini_suz, cihaz_sil, cihazlar};
use crate::AppState;

type ApiResult = Result<Json<Value>, (StatusCode, String)>;

pub const KOD_OMRU_MS: u64 = 60_000;
const EN_COK_BEKLEYEN: usize = 10;

/// Bekleyen kodlar: kod → (izinler, bitiş). Bellekte; uygulama kapanınca hepsi düşer.
#[derive(Default)]
pub struct Kodlar(HashMap<String, (Vec<String>, u64)>);

impl Kodlar {
  pub fn uret(&mut self, izinler: Vec<String>, simdi: u64) -> String {
    self.0.retain(|_, (_, bitis)| *bitis > simdi);
    if self.0.len() >= EN_COK_BEKLEYEN {
      // En eskisi düşer: panel art arda kod üretirse tablo büyümesin
      if let Some(k) = self.0.iter().min_by_key(|(_, (_, b))| *b).map(|(k, _)| k.clone()) {
        self.0.remove(&k);
      }
    }
    // 64 bit rastgele (uuid v4'ten); 60 sn ve adres başına deneme sınırıyla tahmin edilemez
    let kod = uuid::Uuid::new_v4().simple().to_string()[..16].to_string();
    self.0.insert(kod.clone(), (izinler, simdi + KOD_OMRU_MS));
    kod
  }

  /// Kodu tüketir: geçerliyse izinleri döner, her durumda kod silinir (tek kullanım)
  pub fn kullan(&mut self, kod: &str, simdi: u64) -> Option<Vec<String>> {
    let (izinler, bitis) = self.0.remove(kod)?;
    (bitis > simdi).then_some(izinler)
  }
}

static KODLAR: std::sync::LazyLock<parking_lot::Mutex<Kodlar>> = std::sync::LazyLock::new(Default::default);

pub fn router() -> Router<Arc<AppState>> {
  Router::new()
    .route("/api/bot/remote/eslestirme", post(api_baslat))
    .route("/api/bot/remote/eslestirme/tamamla", post(api_tamamla))
    .route("/api/bot/remote/cihazlar", get(api_liste))
    .route("/api/bot/remote/cihazlar/sil", post(api_sil))
}

fn yerel_mi(addr: &SocketAddr) -> Result<(), (StatusCode, String)> {
  if addr.ip().is_loopback() {
    Ok(())
  } else {
    Err((StatusCode::FORBIDDEN, "Yalnız bu bilgisayardaki panelden".into()))
  }
}

fn yerel() -> Actor {
  Actor { name: "yerel".into(), local: true }
}

/// Cihaz adı: görünür karakterler, en çok 40
pub fn cihaz_adi(ham: &str) -> String {
  let a: String = ham.chars().filter(|c| !c.is_control() && *c != ':').take(40).collect();
  let a = a.trim();
  if a.is_empty() { "Telefon".into() } else { a.into() }
}

async fn api_baslat(ConnectInfo(addr): ConnectInfo<SocketAddr>, State(state): State<Arc<AppState>>, Json(body): Json<Value>) -> ApiResult {
  yerel_mi(&addr)?;
  let izinler = cihaz_izinlerini_suz(&body["izinler"]);
  if izinler.is_empty() {
    return Err((StatusCode::BAD_REQUEST, "En az bir izin seçin".into()));
  }
  let kod = KODLAR.lock().uret(izinler.clone(), simdi_ms());
  audit(&state, &yerel(), "REMOTE:pair_start", json!({ "izinler": izinler })).await;
  Ok(Json(json!({ "kod": kod, "gecerlilikSn": KOD_OMRU_MS / 1000, "izinler": izinler })))
}

async fn api_tamamla(ConnectInfo(addr): ConnectInfo<SocketAddr>, State(state): State<Arc<AppState>>, Json(body): Json<Value>) -> ApiResult {
  let ip = addr.ip();
  if GIRIS_DENEMELERI.lock().engelli(ip, simdi_ms()) {
    return Err((StatusCode::TOO_MANY_REQUESTS, "Çok fazla hatalı deneme; biraz sonra tekrar deneyin".into()));
  }
  let kod = body["kod"].as_str().unwrap_or("").trim().to_ascii_lowercase();
  let Some(izinler) = KODLAR.lock().kullan(&kod, simdi_ms()) else {
    GIRIS_DENEMELERI.lock().basarisiz(ip, simdi_ms());
    return Err((StatusCode::UNAUTHORIZED, "Kod geçersiz ya da süresi doldu".into()));
  };
  let ad = cihaz_adi(body["cihaz"].as_str().unwrap_or(""));
  let sonuc = cihaz_ekle(&state.db, &ad, &izinler)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Cihaz kaydedilemedi: {e}")))?;
  audit(&state, &Actor { name: format!("cihaz:{ad}"), local: false }, "REMOTE:pair_done", json!({ "izinler": izinler, "adres": ip.to_string() })).await;
  Ok(Json(sonuc))
}

async fn api_liste(ConnectInfo(addr): ConnectInfo<SocketAddr>, State(state): State<Arc<AppState>>) -> ApiResult {
  yerel_mi(&addr)?;
  let l = cihazlar(&state.db).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  Ok(Json(json!({ "cihazlar": l })))
}

async fn api_sil(ConnectInfo(addr): ConnectInfo<SocketAddr>, State(state): State<Arc<AppState>>, Json(body): Json<Value>) -> ApiResult {
  yerel_mi(&addr)?;
  let id = body["id"].as_str().unwrap_or("");
  let silindi = cihaz_sil(&state.db, id).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  if !silindi {
    return Err((StatusCode::NOT_FOUND, "Cihaz bulunamadı".into()));
  }
  audit(&state, &yerel(), "REMOTE:device_revoke", json!({ "id": id })).await;
  Ok(Json(json!({ "ok": true })))
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn kod_tek_kullanimlik_ve_60_sn() {
    let mut k = Kodlar::default();
    let a = k.uret(vec!["scene.switch".into()], 1_000);
    assert_eq!(a.len(), 16);
    assert_eq!(k.kullan(&a, 2_000), Some(vec!["scene.switch".to_string()]));
    assert_eq!(k.kullan(&a, 2_000), None, "ikinci kullanım reddedilir");
    let b = k.uret(vec!["scene.switch".into()], 1_000);
    assert_eq!(k.kullan(&b, 1_000 + KOD_OMRU_MS), None, "süresi dolan kod reddedilir");
  }

  #[test]
  fn bekleyen_kod_siniri_ve_ad() {
    let mut k = Kodlar::default();
    for _ in 0..25 {
      k.uret(vec![], 0);
    }
    assert!(k.0.len() <= EN_COK_BEKLEYEN);
    assert_eq!(cihaz_adi("  "), "Telefon");
    assert_eq!(cihaz_adi("Pixel:8\u{0007}"), "Pixel8");
  }

  #[test]
  fn cihaza_tehlikeli_izin_verilmez() {
    let l = cihaz_izinlerini_suz(&json!(["*", "settings.write", "broadcast.outputs", "users", "scene.switch", "scene.switch"]));
    assert_eq!(l, vec!["scene.switch".to_string()]);
  }
}
