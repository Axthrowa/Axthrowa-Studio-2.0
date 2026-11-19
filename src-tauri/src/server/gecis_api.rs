//! Geçiş efektleri (stinger) galerisi: `/api/gecisler`.
//!
//! Dokuz özgün stinger (VP9 alfa WebM, 1920×1080, 60 kare/sn) uygulamanın içine gömülü gelir
//! (`src-tauri/gecisler`, üretici: `scripts/stinger`). "OBS'e uygula" videoyu veri klasörüne yazar,
//! OBS'teki Stinger geçişinin dosyasını ve geçiş noktasını (ms) ayarlar ve o geçişi etkin yapar.
//! obs-websocket yeni geçiş OLUŞTURAMAZ: OBS'te en az bir Stinger geçişi bulunmalıdır.

use std::net::SocketAddr;
use std::sync::Arc;

use axum::extract::{ConnectInfo, Path, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};

use super::control_plane::{audit, authorize};
use crate::AppState;

type ApiResult = Result<Json<Value>, (StatusCode, String)>;

/// (kimlik, video, önizleme)
const DOSYALAR: &[(&str, &[u8], &[u8])] = &[
  ("neon-supurme", include_bytes!("../../gecisler/neon-supurme.webm") as &[u8], include_bytes!("../../gecisler/neon-supurme.webp") as &[u8]),
  ("murekkep", include_bytes!("../../gecisler/murekkep.webm") as &[u8], include_bytes!("../../gecisler/murekkep.webp") as &[u8]),
  ("panjur", include_bytes!("../../gecisler/panjur.webm") as &[u8], include_bytes!("../../gecisler/panjur.webp") as &[u8]),
  ("isik-hizi", include_bytes!("../../gecisler/isik-hizi.webm") as &[u8], include_bytes!("../../gecisler/isik-hizi.webp") as &[u8]),
  ("glitch", include_bytes!("../../gecisler/glitch.webm") as &[u8], include_bytes!("../../gecisler/glitch.webp") as &[u8]),
  ("iris", include_bytes!("../../gecisler/iris.webm") as &[u8], include_bytes!("../../gecisler/iris.webp") as &[u8]),
  ("serit", include_bytes!("../../gecisler/serit.webm") as &[u8], include_bytes!("../../gecisler/serit.webp") as &[u8]),
  ("dalga", include_bytes!("../../gecisler/dalga.webm") as &[u8], include_bytes!("../../gecisler/dalga.webp") as &[u8]),
  ("piksel", include_bytes!("../../gecisler/piksel.webm") as &[u8], include_bytes!("../../gecisler/piksel.webp") as &[u8]),
];

const MANIFEST: &str = include_str!("../../gecisler/gecisler.json");

pub fn router() -> Router<Arc<AppState>> {
  Router::new()
    .route("/api/gecisler", get(api_liste))
    .route("/api/gecisler/uygula", post(api_uygula))
    .route("/api/gecisler/{id}/video", get(api_video))
    .route("/api/gecisler/{id}/onizleme", get(api_onizleme))
}

fn bul(id: &str) -> Option<&'static (&'static str, &'static [u8], &'static [u8])> {
  DOSYALAR.iter().find(|(k, _, _)| *k == id)
}

/// Manifestteki geçiş noktası (ms)
fn nokta_ms(id: &str) -> Option<u32> {
  let m: Value = serde_json::from_str(MANIFEST).ok()?;
  m.as_array()?
    .iter()
    .find(|g| g.get("id").and_then(Value::as_str) == Some(id))?
    .get("noktaMs")?
    .as_u64()
    .map(|n| n as u32)
}

fn medya(govde: &'static [u8], tur: &'static str) -> Response {
  ([(header::CONTENT_TYPE, tur), (header::CACHE_CONTROL, "public, max-age=86400")], govde).into_response()
}

async fn api_video(Path(id): Path<String>) -> Result<Response, StatusCode> {
  bul(&id).map(|(_, v, _)| medya(v, "video/webm")).ok_or(StatusCode::NOT_FOUND)
}

async fn api_onizleme(Path(id): Path<String>) -> Result<Response, StatusCode> {
  bul(&id).map(|(_, _, o)| medya(o, "image/webp")).ok_or(StatusCode::NOT_FOUND)
}

/// Galeri + OBS'teki Stinger geçişleri (OBS kapalıysa `stingerler: null`)
async fn api_liste(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
) -> ApiResult {
  authorize(&state, &addr, &headers, "broadcast.read").await?;
  let gecisler: Value = serde_json::from_str(MANIFEST).unwrap_or_else(|_| json!([]));
  let (stingerler, hata) = if state.obs.is_connected() {
    match state.obs.stinger_gecisleri().await {
      Ok(l) => (json!(l), Value::Null),
      Err(e) => (Value::Null, json!(e)),
    }
  } else {
    (Value::Null, json!("OBS bağlı değil"))
  };
  Ok(Json(json!({ "gecisler": gecisler, "obsBagli": state.obs.is_connected(), "stingerler": stingerler, "hata": hata })))
}

#[derive(Deserialize)]
struct UygulaGovde {
  id: String,
  /// OBS'teki Stinger geçişinin adı; boşsa ilki
  #[serde(default)]
  gecis: Option<String>,
}

async fn api_uygula(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<UygulaGovde>,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, "scene.edit").await?;
  let (id, video, _) = bul(&g.id).ok_or((StatusCode::NOT_FOUND, "Böyle bir geçiş yok".to_string()))?;
  let nokta = nokta_ms(id).ok_or((StatusCode::INTERNAL_SERVER_ERROR, "Geçiş noktası okunamadı".to_string()))?;
  if !state.obs.is_connected() {
    return Err((StatusCode::CONFLICT, "OBS bağlı değil".into()));
  }
  // OBS dosya yolu ister: video veri klasörüne yazılır (aynı boyuttaysa yeniden yazılmaz)
  let dizin = state.data_dir.join("gecisler");
  std::fs::create_dir_all(&dizin).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Klasör açılamadı: {e}")))?;
  let yol = dizin.join(format!("{id}.webm"));
  let ayni = std::fs::metadata(&yol).map(|m| m.len() == video.len() as u64).unwrap_or(false);
  if !ayni {
    std::fs::write(&yol, video).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Video yazılamadı: {e}")))?;
  }
  let yol_metni = yol.to_string_lossy().replace('\\', "/");
  let ad = g.gecis.as_deref().map(str::trim).filter(|s| !s.is_empty());
  let gecis = state
    .obs
    .stinger_ayarla(ad, &yol_metni, nokta)
    .await
    .map_err(|e| (StatusCode::BAD_GATEWAY, e))?;
  audit(&state, &actor, "GECIS:stinger", json!({ "id": id, "gecis": gecis })).await;
  Ok(Json(json!({ "gecis": gecis, "yol": yol_metni, "noktaMs": nokta })))
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn manifest_ve_dosyalar_eslesir() {
    let m: Value = serde_json::from_str(MANIFEST).unwrap();
    let liste = m.as_array().unwrap();
    assert_eq!(liste.len(), DOSYALAR.len());
    for g in liste {
      let id = g["id"].as_str().unwrap();
      let (_, v, o) = bul(id).expect(id);
      // WebM (EBML) ve WebP imzaları
      assert_eq!(&v[..4], &[0x1A, 0x45, 0xDF, 0xA3]);
      assert_eq!(&o[8..12], b"WEBP");
      let n = nokta_ms(id).unwrap();
      assert!(n > 0 && (n as u64) < g["sureMs"].as_u64().unwrap());
    }
  }
}
