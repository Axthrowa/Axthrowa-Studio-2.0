//! Ayarlar › Yedekler: listele, şimdi yedekle, geri yükle (sonraki açılışta), eski klasörden taşı.
//! Dosya sistemine dokunduğu için yalnız bu bilgisayardan.

use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::{Arc, OnceLock};

use axum::extract::{ConnectInfo, State};
use axum::http::StatusCode;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::yedek;
use crate::AppState;

type ApiResult = Result<Json<Value>, (StatusCode, String)>;

/// Bu açılışta uygulanan bekleyen işlemin sonucu (panel bir kez gösterir)
pub static SON_UYGULANAN: OnceLock<String> = OnceLock::new();

pub fn router() -> Router<Arc<AppState>> {
  Router::new()
    .route("/api/yedekler", get(api_liste).post(api_yedekle))
    .route("/api/yedekler/geri-yukle", post(api_geri_yukle))
    .route("/api/yedekler/tasi", post(api_tasi))
    .route("/api/yedekler/iptal", post(api_iptal))
}

fn yerel(addr: &SocketAddr) -> Result<(), (StatusCode, String)> {
  if addr.ip().is_loopback() {
    Ok(())
  } else {
    Err((StatusCode::FORBIDDEN, "yalnız bu bilgisayardan".into()))
  }
}

fn durum(state: &AppState) -> Value {
  json!({
    "yedekler": yedek::listele(&state.data_dir),
    "bekleyen": yedek::bekleyen(&state.data_dir),
    "sonUygulanan": SON_UYGULANAN.get(),
    "klasor": yedek::yedek_klasoru(&state.data_dir).to_string_lossy(),
    "sakla": yedek::SAKLA,
  })
}

async fn api_liste(ConnectInfo(addr): ConnectInfo<SocketAddr>, State(state): State<Arc<AppState>>) -> ApiResult {
  yerel(&addr)?;
  Ok(Json(durum(&state)))
}

async fn api_yedekle(ConnectInfo(addr): ConnectInfo<SocketAddr>, State(state): State<Arc<AppState>>) -> ApiResult {
  yerel(&addr)?;
  yedek::yedekle(&state.data_dir, &state.db, yedek::bot_veri_klasoru().as_deref())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("{e:#}")))?;
  Ok(Json(durum(&state)))
}

#[derive(Deserialize)]
struct AdGovde {
  ad: String,
}

async fn api_geri_yukle(
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  State(state): State<Arc<AppState>>,
  Json(g): Json<AdGovde>,
) -> ApiResult {
  yerel(&addr)?;
  if !yedek::ad_gecerli(&g.ad) || !yedek::yedek_klasoru(&state.data_dir).join(&g.ad).is_dir() {
    return Err((StatusCode::BAD_REQUEST, "yedek bulunamadı".into()));
  }
  yedek::isaretle(&state.data_dir, &format!("yedek:{}", g.ad)).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  Ok(Json(durum(&state)))
}

#[derive(Deserialize)]
struct KaynakGovde {
  kaynak: String,
}

async fn api_tasi(
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  State(state): State<Arc<AppState>>,
  Json(g): Json<KaynakGovde>,
) -> ApiResult {
  yerel(&addr)?;
  let kok = PathBuf::from(g.kaynak.trim().trim_matches('"'));
  if !kok.is_absolute() || !yedek::eski_kurulum_mu(&kok) {
    return Err((StatusCode::BAD_REQUEST, "Bu klasörde eski bir Yayın Yönetim Aracı kurulumu (data\\botaxt.db) bulunamadı".into()));
  }
  // Kendi klasörüne taşıma anlamsız (ve kendi verisinin üzerine yazar)
  if state.data_dir.starts_with(&kok) {
    return Err((StatusCode::BAD_REQUEST, "Bu zaten şu anki kurulum".into()));
  }
  yedek::isaretle(&state.data_dir, &format!("tasi:{}", kok.display())).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  Ok(Json(durum(&state)))
}

async fn api_iptal(ConnectInfo(addr): ConnectInfo<SocketAddr>, State(state): State<Arc<AppState>>) -> ApiResult {
  yerel(&addr)?;
  yedek::iptal(&state.data_dir);
  Ok(Json(durum(&state)))
}
