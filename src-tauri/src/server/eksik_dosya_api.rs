//! Eksik dosyalar (OBS "Sahne Koleksiyonu › Eksik dosyaları denetle"): etkin koleksiyonda diskte bulunmayan medya,
//! görsel, slayt ve yerel tarayıcı sayfası yollarını listeler; yeni yol yazar ya da bir klasörde aynı adlı dosyaları
//! arar. Yalnız bu bilgisayardan (yollar yereldir); yeni yol mutlak olmalı ve diskte bulunmalı.

use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use axum::extract::{ConnectInfo, State};
use axum::http::{HeaderMap, StatusCode};
use axum::routing::get;
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};

use super::control_plane::{audit, authorize};
use super::motor_api::{komut, koleksiyonu_yaz, motor_calisiyor, Hata};
use crate::motor_koleksiyon as kol;
use crate::AppState;

type ApiResult = Result<Json<Value>, Hata>;

pub fn router() -> Router<Arc<AppState>> {
  Router::new().route("/api/motor/eksik-dosyalar", get(api_liste).post(api_islem))
}

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

fn eksikler(state: &AppState) -> Vec<kol::EksikDosya> {
  let o = state.motor.ozet();
  let o = o.lock();
  kol::eksik_dosyalar(&o.koleksiyon, |p| p.exists())
}

async fn api_liste(State(state): State<Arc<AppState>>, ConnectInfo(addr): ConnectInfo<SocketAddr>, headers: HeaderMap) -> ApiResult {
  yerel(&addr)?;
  authorize(&state, &addr, &headers, "broadcast.read").await?;
  motor_calisiyor(&state).await?;
  Ok(Json(json!({"eksikler": eksikler(&state)})))
}

#[derive(Deserialize)]
struct Govde {
  /// duzelt | ara
  eylem: String,
  #[serde(default)]
  kaynak: Option<String>,
  #[serde(default)]
  alan: Option<String>,
  #[serde(default)]
  yol: Option<String>,
  #[serde(default)]
  klasor: Option<String>,
}

async fn api_islem(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<Govde>,
) -> ApiResult {
  yerel(&addr)?;
  match g.eylem.as_str() {
    "ara" => {
      authorize(&state, &addr, &headers, "broadcast.read").await?;
      motor_calisiyor(&state).await?;
      let klasor = PathBuf::from(g.klasor.unwrap_or_default());
      if !klasor.is_absolute() || !klasor.is_dir() {
        return Err(gecersiz("klasör mutlak ve var olmalı"));
      }
      // Klasörde ara: eksik dosyanın adı bu klasörde varsa öneri (klasör içine inilmez)
      let oneriler: Vec<Value> = eksikler(&state)
        .into_iter()
        .filter_map(|e| {
          let ad = Path::new(&e.yol).file_name()?;
          let aday = klasor.join(ad);
          aday.exists().then(|| json!({"kaynak": e.kaynak, "alan": e.alan, "yol": aday}))
        })
        .collect();
      Ok(Json(json!({"oneriler": oneriler})))
    }
    "duzelt" => {
      let actor = authorize(&state, &addr, &headers, "scene.edit").await?;
      motor_calisiyor(&state).await?;
      let (kaynak, alan) = (g.kaynak.unwrap_or_default(), g.alan.unwrap_or_default());
      let yol = PathBuf::from(g.yol.unwrap_or_default());
      if !yol.is_absolute() || !yol.exists() {
        return Err(gecersiz("yeni yol mutlak ve diskte var olmalı"));
      }
      let yol_metni = yol.to_string_lossy().replace('\\', "/");
      let gonder = {
        let o = state.motor.ozet();
        let mut o = o.lock();
        let k = o.koleksiyon.kaynak(&kaynak).ok_or((StatusCode::NOT_FOUND, "kaynak yok".to_string()))?;
        if !kol::dosya_yolunu_yaz(&mut k.ayarlar, &alan, &yol_metni) {
          return Err(gecersiz(format!("bilinmeyen alan: {alan}")));
        }
        // Motora yalnız değişen üst alan gider (slaytta tüm liste)
        let ust = if alan.starts_with("files/") { "files" } else { alan.as_str() };
        (k.eksik, json!({ ust: k.ayarlar[ust].clone() }))
      };
      // Eklentisi olmayan (eksik) kaynak motorda yok: yalnız kayıt güncellenir
      if !gonder.0 {
        komut(&state, json!({"komut": "kaynak.guncelle", "id": kaynak, "ayarlar": gonder.1})).await?;
      }
      koleksiyonu_yaz(&state)?;
      audit(&state, &actor, "MOTOR_MISSING_FILE_FIX", json!({"kaynak": kaynak, "alan": alan})).await;
      Ok(Json(json!({"ok": true, "kalan": eksikler(&state).len()})))
    }
    e => Err(gecersiz(format!("bilinmeyen eylem: {e}"))),
  }
}
