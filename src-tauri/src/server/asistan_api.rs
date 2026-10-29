//! Asistan köprüsü: metin komutu (`asistan::coz`) → eylem kayıt defterinin tek yürütme yolu (`calistir`).
//! İzin, onay ve denetim günlüğü (`ACTION:<id>`, `via: "asistan"`) bütün denetleyicilerle aynıdır.
//!
//!   POST /api/asistan  {"metin": "sahneyi oyun yap", "onay": false}
//!   Tauri: invoke("asistan_komut", { metin, onay })
//!
//! Onay isteyen eylemlerde (yayını durdurmak, sohbeti temizlemek) ilk çağrı 428 döner; arayüz sorup `onay: true`
//! ile yeniden gönderir. Asistan kendi kendine onay vermez.

use std::net::SocketAddr;
use std::sync::Arc;

use axum::extract::{ConnectInfo, State};
use axum::http::{HeaderMap, StatusCode};
use axum::routing::post;
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};

use super::actions_api::calistir;
use super::control_plane::{authorize, Actor};
use crate::asistan::{self, Baglam, Niyet};
use crate::{actions, AppState};

type Hata = (StatusCode, String);

pub fn router() -> Router<Arc<AppState>> {
  Router::new().route("/api/asistan", post(api_asistan))
}

#[derive(Deserialize)]
struct Govde {
  metin: String,
  #[serde(default)]
  onay: bool,
}

/// OBS bağlıysa gerçek sahne ve ses girişi adları (eşleştirme bunlarla yapılır)
async fn baglam(state: &AppState) -> Baglam {
  if !state.obs.is_connected() {
    return Baglam::default();
  }
  let sahneler = state.obs.scene_snapshot().await.map(|s| s.scenes).unwrap_or_default();
  let girisler = state.obs.inputs().await.map(|g| g.into_iter().map(|i| i.name).collect()).unwrap_or_default();
  Baglam { sahneler, girisler }
}

fn cozulemedi(e: String) -> Hata {
  (StatusCode::UNPROCESSABLE_ENTITY, e)
}

async fn api_asistan(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<Govde>,
) -> Result<Json<Value>, Hata> {
  if g.metin.chars().count() > 300 {
    return Err((StatusCode::BAD_REQUEST, "Komut çok uzun".into()));
  }
  let niyet = asistan::coz(&g.metin, &baglam(&state).await).map_err(cozulemedi)?;
  // İzin çözülen niyete göre: sahne değiştirme izni olan, sohbeti temizleyemez
  let actor = authorize(&state, &addr, &headers, izin(&niyet)).await?;
  yurut(&state, niyet, g.onay, &actor).await.map(Json)
}

fn izin(n: &Niyet) -> &'static str {
  match n {
    Niyet::Eylem { id, .. } => actions::find(id).map(|s| s.perm).unwrap_or("*"),
    Niyet::SohbetiTemizle => "chat.moderate",
  }
}

async fn yurut(state: &AppState, niyet: Niyet, onay: bool, actor: &Actor) -> Result<Value, Hata> {
  match niyet {
    Niyet::Eylem { id, params } => {
      let spec = actions::find(id).ok_or((StatusCode::INTERNAL_SERVER_ERROR, format!("Kayıtsız eylem: {id}")))?;
      let sonuc = calistir(state, spec, &params, onay, actor, Some("asistan")).await?;
      Ok(json!({ "ok": true, "eylem": id, "aciklama": spec.label, "params": params, "sonuc": sonuc }))
    }
    Niyet::SohbetiTemizle => {
      if !onay {
        return Err((StatusCode::PRECONDITION_REQUIRED, "Onay gerekli: Sohbeti temizle".into()));
      }
      let sonuc = super::sohbeti_temizle(state).await;
      super::control_plane::audit(state, actor, "ACTION:chat.clear", json!({ "via": "asistan" })).await;
      Ok(json!({ "ok": true, "eylem": "chat.clear", "aciklama": "Sohbeti temizle", "sonuc": sonuc }))
    }
  }
}

/// Masaüstü arayüzünden (yerel yayıncı)
#[tauri::command]
pub async fn asistan_komut(state: tauri::State<'_, AppState>, metin: String, onay: bool) -> Result<Value, String> {
  let niyet = asistan::coz(&metin, &baglam(&state).await)?;
  let actor = Actor { name: "yerel".into(), local: true };
  yurut(&state, niyet, onay, &actor).await.map_err(|(_, e)| e)
}
