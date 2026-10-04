//! Yayın bilgisi dock'u (OBS 30+ "Stream Information"/"Edit Stream Info" karşılığı): bağlı Kick kanalının yayın
//! başlığı, kategorisi ve etiketleri okunur ve — yalnız kullanıcı açıkça onaylayınca — güncellenir
//! (`PATCH /public/v1/channels`, `channel:write`). Twitch/YouTube için bu uygulamada OAuth bağlantısı yoktur; arayüz
//! bunu söyler. Dışarıya istek yaptıran uçlar yalnız bu bilgisayardan çağrılabilir.

use std::net::SocketAddr;
use std::sync::Arc;

use axum::extract::{ConnectInfo, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};

use super::control_plane::{audit, authorize};
use super::motor_api::Hata;
use crate::AppState;

type ApiResult = Result<Json<Value>, Hata>;

/// Kick belgesi: `custom_tags` en çok 10 öğe
const EN_COK_ETIKET: usize = 10;

pub fn router() -> Router<Arc<AppState>> {
  Router::new()
    .route("/api/yayin-bilgisi", get(api_durum).post(api_guncelle))
    .route("/api/yayin-bilgisi/oku", post(api_oku))
    .route("/api/yayin-bilgisi/kategoriler", get(api_kategoriler))
}

fn yerel(addr: &SocketAddr) -> Result<(), Hata> {
  if addr.ip().is_loopback() {
    Ok(())
  } else {
    Err((StatusCode::FORBIDDEN, "yalnız bu bilgisayardan".into()))
  }
}

fn kick_hatasi(e: anyhow::Error) -> Hata {
  (StatusCode::BAD_GATEWAY, e.to_string())
}

#[derive(Debug, Default, Deserialize)]
pub struct GuncellemeGovdesi {
  #[serde(default)]
  pub baslik: Option<String>,
  #[serde(default)]
  pub kategori_id: Option<u64>,
  #[serde(default)]
  pub etiketler: Option<Vec<String>>,
  #[serde(default)]
  pub confirm: bool,
}

/// Kick `PATCH /public/v1/channels` gövdesi (resmi belge: stream_title en az 1 karakter, category_id ≥ 1, custom_tags en
/// çok 10; en az bir alan). Başlık/etiket uzunluk sınırı belgede yok — uydurulmaz, Kick 400 dönerse hata gösterilir.
pub fn kanal_govdesi(g: &GuncellemeGovdesi) -> Result<Value, String> {
  let mut v = serde_json::Map::new();
  if let Some(b) = &g.baslik {
    let b = b.trim();
    if b.is_empty() {
      return Err("başlık boş olamaz".into());
    }
    v.insert("stream_title".into(), json!(b));
  }
  if let Some(k) = g.kategori_id {
    if k == 0 {
      return Err("kategori kimliği geçersiz".into());
    }
    v.insert("category_id".into(), json!(k));
  }
  if let Some(e) = &g.etiketler {
    let e: Vec<String> = e.iter().map(|x| x.trim().to_string()).filter(|x| !x.is_empty()).collect();
    if e.len() > EN_COK_ETIKET {
      return Err(format!("en çok {EN_COK_ETIKET} etiket"));
    }
    v.insert("custom_tags".into(), json!(e));
  }
  if v.is_empty() {
    return Err("değiştirilecek alan yok".into());
  }
  Ok(Value::Object(v))
}

/// Ağsız durum: hangi platform bağlı, yazma izni var mı
async fn api_durum(State(state): State<Arc<AppState>>, ConnectInfo(addr): ConnectInfo<SocketAddr>, headers: HeaderMap) -> ApiResult {
  authorize(&state, &addr, &headers, "broadcast.read").await?;
  let s = state.kick_auth.status();
  Ok(Json(json!({
    "kick": {
      "bagli": s["hasUserToken"].as_bool().unwrap_or(false),
      "yazabilir": s["canWriteChannel"].as_bool().unwrap_or(false),
      "kanal": s["broadcasterSlug"],
    },
    // Bu uygulamada yayın bilgisi için OAuth bağlantısı olmayan platformlar (dürüst durum)
    "desteklenmeyen": ["Twitch", "YouTube"],
  })))
}

/// Kanaldaki geçerli başlık/kategori (Kick API'sinden okunur; hiçbir şey değiştirilmez)
async fn api_oku(State(state): State<Arc<AppState>>, ConnectInfo(addr): ConnectInfo<SocketAddr>, headers: HeaderMap) -> ApiResult {
  yerel(&addr)?;
  authorize(&state, &addr, &headers, "broadcast.read").await?;
  if !state.kick_auth.is_connected() {
    return Err((StatusCode::CONFLICT, "Kick bağlı değil".into()));
  }
  let ch = state.kick_auth.fetch_my_channel().await.map_err(kick_hatasi)?;
  Ok(Json(json!({
    "baslik": ch["stream_title"],
    "kategori": {"id": ch["category"]["id"], "ad": ch["category"]["name"]},
    "kanal": ch["slug"],
  })))
}

#[derive(Deserialize)]
struct KategoriSorgusu {
  q: String,
}

async fn api_kategoriler(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Query(s): Query<KategoriSorgusu>,
) -> ApiResult {
  yerel(&addr)?;
  authorize(&state, &addr, &headers, "broadcast.read").await?;
  let q = s.q.trim();
  if q.chars().count() < 2 || q.chars().count() > 64 {
    return Err((StatusCode::BAD_REQUEST, "arama 2–64 karakter olmalı".into()));
  }
  if !state.kick_auth.is_connected() {
    return Err((StatusCode::CONFLICT, "Kick bağlı değil".into()));
  }
  let liste = state.kick_auth.search_categories(q).await.map_err(kick_hatasi)?;
  Ok(Json(json!({"kategoriler": liste})))
}

/// Kanal bilgisini günceller: herkese açık kanal değiştiği için açık onay (`confirm: true`) şarttır
async fn api_guncelle(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<GuncellemeGovdesi>,
) -> ApiResult {
  yerel(&addr)?;
  let actor = authorize(&state, &addr, &headers, "broadcast.stream").await?;
  let govde = kanal_govdesi(&g).map_err(|e| (StatusCode::BAD_REQUEST, e))?;
  if !g.confirm {
    return Err((StatusCode::PRECONDITION_REQUIRED, "Onay gerekli: Kick kanal bilgisi herkese açık olarak değişir".into()));
  }
  if !state.kick_auth.can_write_channel() {
    return Err((StatusCode::CONFLICT, "Kick bağlantısında channel:write izni yok — Kick'i yeniden bağlayın".into()));
  }
  state.kick_auth.update_channel(&govde).await.map_err(kick_hatasi)?;
  let alanlar: Vec<&String> = govde.as_object().map(|o| o.keys().collect()).unwrap_or_default();
  audit(&state, &actor, "STREAM_INFO_UPDATE", json!({"platform": "kick", "alanlar": alanlar})).await;
  Ok(Json(json!({"ok": true})))
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn kanal_govdesi_dogrular() {
    let g = |b: Option<&str>, k: Option<u64>, e: Option<Vec<&str>>| GuncellemeGovdesi {
      baslik: b.map(String::from),
      kategori_id: k,
      etiketler: e.map(|v| v.into_iter().map(String::from).collect()),
      confirm: true,
    };
    assert_eq!(kanal_govdesi(&g(Some("  Akşam yayını "), Some(15), None)).unwrap(), json!({"stream_title": "Akşam yayını", "category_id": 15}));
    assert_eq!(kanal_govdesi(&g(None, None, Some(vec!["türkçe", " ", "fps"]))).unwrap(), json!({"custom_tags": ["türkçe", "fps"]}));
    assert!(kanal_govdesi(&g(Some("   "), None, None)).is_err());
    assert!(kanal_govdesi(&g(None, Some(0), None)).is_err());
    assert!(kanal_govdesi(&g(None, None, Some(vec!["a"; 11]))).is_err());
    assert!(kanal_govdesi(&g(None, None, None)).is_err());
  }
}
