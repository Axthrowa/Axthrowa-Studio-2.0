//! Kurulu OBS Studio ile bütünleşme uçları (`/api/obs-studio/*`): kurulum durumu, OBS'i başlatma, panel
//! dock'larını OBS'e yazma ve obs-websocket bağlantı bilgisini OBS'in kendi ayarından alma.
//!
//! OBS'in dosyalarına dokunan ya da süreç başlatan uçlar yalnız bu bilgisayardan çağrılabilir.

use std::net::SocketAddr;
use std::sync::Arc;

use axum::extract::{ConnectInfo, State};
use axum::http::{HeaderMap, StatusCode};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};

use super::control_plane::{audit, authorize};
use crate::obs_studio;
use crate::settings::ScreenKind;
use crate::AppState;

type Hata = (StatusCode, String);
type ApiResult = Result<Json<Value>, Hata>;

pub fn router() -> Router<Arc<AppState>> {
  Router::new()
    .route("/api/obs-studio", get(api_durum))
    .route("/api/obs-studio/launch", post(api_baslat))
    .route("/api/obs-studio/docks", post(api_docklar))
    .route("/api/obs-studio/websocket/import", post(api_websocket_al))
}

fn yerel(addr: &SocketAddr) -> Result<(), Hata> {
  if addr.ip().is_loopback() {
    Ok(())
  } else {
    Err((StatusCode::FORBIDDEN, "yalnız bu bilgisayardan".into()))
  }
}

fn taban(state: &AppState) -> String {
  format!("http://127.0.0.1:{}", state.port)
}

/// Ayarlarda kullanıcının verdiği OBS yolu (Ayarlar › OBS yolu)
fn ozel_yol(state: &AppState) -> Option<String> {
  let (_, _, _, obs) = crate::hotkeys::obs_cfg_from_settings(state);
  obs.get("exePath").and_then(Value::as_str).map(str::to_string).filter(|s| !s.trim().is_empty())
}

async fn api_durum(State(state): State<Arc<AppState>>, ConnectInfo(addr): ConnectInfo<SocketAddr>, headers: HeaderMap) -> ApiResult {
  authorize(&state, &addr, &headers, "broadcast.read").await?;
  let ozel = ozel_yol(&state);
  let taban = taban(&state);
  let durum = tokio::task::spawn_blocking(move || {
    let exe = obs_studio::exe_yolu(ozel.as_deref());
    let dizin = obs_studio::ayar_dizini();
    let ekli = dizin.as_deref().map(obs_studio::ekli_docklar).unwrap_or_default();
    let ws = obs_studio::websocket_ayari();
    json!({
      "kurulu": exe.is_some(),
      "exe": exe.map(|p| p.display().to_string()),
      "ayarDizini": dizin.as_ref().map(|p| p.display().to_string()),
      "surum": dizin.as_deref().and_then(obs_studio::surum),
      "calisiyor": obs_studio::calisiyor(),
      // Şifrenin kendisi istemciye gönderilmez
      "websocket": ws.map(|w| json!({ "etkin": w.etkin, "port": w.port, "sifreGerekli": w.sifre_gerekli })),
      "docklar": obs_studio::DOCKLAR.iter().map(|(k, baslik)| json!({
        "kimlik": k,
        "baslik": baslik,
        "url": obs_studio::dock_adresi(&taban, k),
        "ekli": ekli.iter().any(|e| e == k),
        "onerilen": obs_studio::ONERILEN.contains(k),
      })).collect::<Vec<_>>(),
    })
  })
  .await
  .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  let mut durum = durum;
  durum["bagli"] = json!(state.obs.is_connected());
  Ok(Json(durum))
}

async fn api_baslat(State(state): State<Arc<AppState>>, ConnectInfo(addr): ConnectInfo<SocketAddr>, headers: HeaderMap) -> ApiResult {
  yerel(&addr)?;
  let actor = authorize(&state, &addr, &headers, "broadcast.stream").await?;
  let ozel = ozel_yol(&state);
  let sonuc = tokio::task::spawn_blocking(move || obs_studio::baslat(ozel.as_deref()))
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .map_err(|e| (StatusCode::NOT_FOUND, e))?;
  audit(&state, &actor, "OBS_STUDIO_LAUNCH", json!({ "sonuc": sonuc })).await;
  Ok(Json(json!({ "sonuc": sonuc })))
}

#[derive(Deserialize)]
struct DockGovdesi {
  /// Eklenecek dock kimlikleri; listede olmayan bizim dock'larımız kaldırılır
  docklar: Vec<String>,
}

async fn api_docklar(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(govde): Json<DockGovdesi>,
) -> ApiResult {
  yerel(&addr)?;
  let actor = authorize(&state, &addr, &headers, "settings.write").await?;
  let mut secilen: Vec<&'static str> = Vec::new();
  for k in &govde.docklar {
    let (kimlik, _) = obs_studio::DOCKLAR
      .iter()
      .find(|(d, _)| d == k)
      .ok_or_else(|| (StatusCode::BAD_REQUEST, format!("Bilinmeyen dock: {k}")))?;
    if !secilen.contains(kimlik) {
      secilen.push(kimlik);
    }
  }
  let taban = taban(&state);
  let sonuc = tokio::task::spawn_blocking(move || obs_studio::docklari_yaz(&taban, &secilen))
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .map_err(|e| (StatusCode::CONFLICT, e))?;
  audit(&state, &actor, "OBS_STUDIO_DOCKS", json!({ "docklar": sonuc.ekli })).await;
  Ok(Json(serde_json::to_value(sonuc).unwrap_or(Value::Null)))
}

/// obs-websocket'in portunu ve şifresini OBS'in kendi ayarından panelin OBS bağlantısına yazar, sonra yeniden
/// bağlanır. Şifre yanıtta dönmez.
async fn api_websocket_al(State(state): State<Arc<AppState>>, ConnectInfo(addr): ConnectInfo<SocketAddr>, headers: HeaderMap) -> ApiResult {
  yerel(&addr)?;
  let actor = authorize(&state, &addr, &headers, "settings.write").await?;
  let ws = tokio::task::spawn_blocking(obs_studio::websocket_ayari)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "OBS'in obs-websocket ayarı bulunamadı (OBS 28+ gerekir; OBS'i bir kez açın)".to_string()))?;
  if !ws.etkin {
    return Err((
      StatusCode::CONFLICT,
      "OBS'te WebSocket sunucusu kapalı: OBS › Araçlar › WebSocket Sunucu Ayarları › \"WebSocket sunucusunu etkinleştir\"".into(),
    ));
  }
  let yama = json!({ "obs": { "host": "127.0.0.1", "port": ws.port, "password": if ws.sifre_gerekli { ws.sifre.clone() } else { String::new() } } });
  let birlesik = {
    let mut s = state.settings.write();
    let birlesik = crate::settings::deep_merge(s.get(ScreenKind::Panel).clone(), yama);
    s.set(ScreenKind::Panel, birlesik.clone());
    if let Err(e) = s.save_one(&state.data_dir, ScreenKind::Panel) {
      studio_warn!("ayar diske yazılamadı (panel): {e}");
    }
    birlesik
  };
  state.broadcast_json(&json!({ "type": "settings", "screen": "panel", "data": birlesik }));
  // Bilgi geçici bir bağlantıyla sınanır; kalıcı bağlantıyı (olay akışıyla birlikte) kendiliğinden bağlanma
  // döngüsü yeni bilgiyle hemen kurar.
  let sifre = Some(ws.sifre.as_str()).filter(|s| ws.sifre_gerekli && !s.is_empty());
  let baglanti = match tokio::time::timeout(std::time::Duration::from_secs(5), obws::Client::connect("127.0.0.1", ws.port, sifre)).await {
    Ok(Ok(_)) => Ok(()),
    Ok(Err(e)) => Err(format!("OBS'e bağlanılamadı (OBS açık mı?): {e}")),
    Err(_) => Err("OBS 5 sn içinde yanıt vermedi (OBS açık mı?)".to_string()),
  };
  state.obs.yeniden_baglan();
  audit(&state, &actor, "OBS_STUDIO_WS_IMPORT", json!({ "port": ws.port, "bagli": baglanti.is_ok() })).await;
  Ok(Json(json!({ "port": ws.port, "sifreGerekli": ws.sifre_gerekli, "bagli": baglanti.is_ok(), "hata": baglanti.err() })))
}
