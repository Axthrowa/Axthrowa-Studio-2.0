//! Destek paketi ucu (`POST /api/destek/paket`): sırları ayıklanmış tek JSON dosyası uygulama veri klasörüne yazılır.
//! Hiçbir yere gönderilmez; kullanıcı dosyayı açıp içeriğini görebilir, isterse kendisi paylaşır. Yalnız bu
//! bilgisayardan (yerel yayıncı) oluşturulabilir. Gizleme kuralları `crate::destek`'te.

use std::net::SocketAddr;
use std::sync::Arc;

use axum::extract::{ConnectInfo, State};
use axum::http::{HeaderMap, StatusCode};
use axum::routing::post;
use axum::{Json, Router};
use serde_json::{json, Value};

use super::control_plane::{audit, authorize};
use crate::destek::{son_satirlar, Gizleyici};
use crate::settings::ScreenKind;
use crate::AppState;

type ApiResult = Result<Json<Value>, (StatusCode, String)>;

pub fn router() -> Router<Arc<AppState>> {
  Router::new().route("/api/destek/paket", post(api_paket))
}

async fn api_paket(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, "admin.support").await?;
  if !actor.local {
    return Err((StatusCode::FORBIDDEN, "Destek paketi yalnız bu bilgisayardan oluşturulabilir".into()));
  }
  let (mut paket, bolumler) = topla(&state).await;

  // Bilinen sırlar: hedeflerin yayın anahtarları ve OBS parolası (yalnız bellekte, maskeleme için)
  let mut sirlar: Vec<String> =
    state.multistream.configs().iter().filter_map(|c| state.multistream.key_for(&c.id)).collect();
  let (_, _, obs_parola, _) = crate::hotkeys::obs_cfg_from_settings(&state);
  sirlar.push(obs_parola);
  let kullanici = std::env::var("USERPROFILE").ok();
  let mut g = Gizleyici::new(sirlar, kullanici);
  g.deger(&mut paket);
  paket["gizleme"] = json!({
    "gizlenenDeger": g.sayac,
    "kurallar": [
      "parola/token/anahtar/çerez/oturum adlı alanların değeri [gizli]",
      "yayın anahtarları ve OBS parolası geçtiği her yerde ***",
      "rtmp(s) adreslerinin yolu atıldı",
      "belirteç görünümlü uzun dizgiler [gizli?]",
      "kullanıcı klasörü %USERPROFILE%"
    ]
  });

  let dizin = state.data_dir.join("destek");
  std::fs::create_dir_all(&dizin).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("klasör: {e}")))?;
  let ad = format!("destek-paketi-{}.json", chrono::Local::now().format("%Y%m%d-%H%M%S"));
  let yol = dizin.join(&ad);
  let metin = serde_json::to_string_pretty(&paket).unwrap_or_default();
  let gecici = dizin.join(format!("{ad}.yaziliyor"));
  std::fs::write(&gecici, &metin)
    .and_then(|_| std::fs::rename(&gecici, &yol))
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("yazılamadı: {e}")))?;
  audit(&state, &actor, "SUPPORT_BUNDLE", json!({"bolumler": bolumler.len(), "gizlenen": g.sayac})).await;
  Ok(Json(json!({
    "yol": yol,
    "klasor": dizin,
    "boyut": metin.len(),
    "gizlenen": g.sayac,
    "bolumler": bolumler,
  })))
}

/// Paketin gizlenmemiş hâli (yalnız bellekte) ve bölüm adları.
async fn bot_ozeti() -> Value {
  let adres = format!("http://127.0.0.1:{}/api/durum-ozeti", crate::streamaxt::port());
  let istemci = match reqwest::Client::builder().timeout(std::time::Duration::from_secs(2)).build() {
    Ok(i) => i,
    Err(e) => return json!({"hata": e.to_string()}),
  };
  match istemci.get(&adres).send().await {
    Ok(y) if y.status().is_success() => y.json::<Value>().await.unwrap_or_else(|e| json!({"hata": e.to_string()})),
    Ok(y) => json!({"hata": format!("HTTP {}", y.status())}),
    Err(_) => json!({"hata": "AxBoT'a ulaşılamadı (kapalı olabilir)"}),
  }
}

async fn topla(state: &Arc<AppState>) -> (Value, Vec<&'static str>) {
  let mut p = json!({
    "bicim": "yya-destek-paketi",
    "surum": 1,
    "olusturuldu": chrono::Local::now().to_rfc3339(),
    "uygulama": {
      "surum": env!("CARGO_PKG_VERSION"),
      "isletimSistemi": std::env::consts::OS,
      "mimari": std::env::consts::ARCH,
    },
  });
  let mut bolumler = vec!["uygulama"];

  let profil = tokio::task::spawn_blocking(crate::multistream::obs_profile::read_current).await.ok().flatten();
  p["obs"] = json!({ "bagli": state.obs.is_connected(), "profilKodlayici": profil });
  bolumler.push("obs");


  p["cokluYayin"] = serde_json::to_value(state.multistream.snapshot()).unwrap_or(Value::Null);
  bolumler.push("cokluYayin");

  let (bulgular, _) = super::multistream_api::build_preflight(state).await;
  p["onKontrol"] = serde_json::to_value(bulgular).unwrap_or(Value::Null);
  bolumler.push("onKontrol");

  let ayarlar = {
    let s = state.settings.read();
    let mut m = serde_json::Map::new();
    for k in ScreenKind::ALL {
      m.insert(k.as_str().into(), s.get(k).clone());
    }
    Value::Object(m)
  };
  p["ayarlar"] = ayarlar;
  bolumler.push("ayarlar");

  // Denetim: yalnız ne ve ne zaman (ayrıntı alanı pakete girmez)
  p["denetim"] = match crate::db::audit::recent(&state.db, 100).await {
    Ok(rows) => json!(rows.iter().map(|r| json!({"ts": r.ts, "kim": r.actor, "eylem": r.action})).collect::<Vec<_>>()),
    Err(e) => json!({"hata": e.to_string()}),
  };
  bolumler.push("denetim");

  // AxBoT: hangi OBS katmanı bağlı / koptu, hangi platform bağlı (sırsız özet; bot kapalıysa not düşülür)
  p["bot"] = bot_ozeti().await;
  bolumler.push("bot");

  let mut gunluk = serde_json::Map::new();
  gunluk.insert("axthrowa.log".into(), json!(son_satirlar(&state.data_dir.join("logs").join("axthrowa.log"), 200)));
  gunluk.insert("hotkey-hatalari.log".into(), json!(son_satirlar(&state.data_dir.join("hotkey-hatalari.log"), 100)));
  if let Some(d) = crate::streamaxt::find_dir() {
    gunluk.insert("streamaxt.log".into(), json!(son_satirlar(&d.join("streamaxt.log"), 100)));
  }
  p["gunlukler"] = Value::Object(gunluk);
  bolumler.push("gunlukler");
  (p, bolumler)
}
