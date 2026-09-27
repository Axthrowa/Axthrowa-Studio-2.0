//! Sahne koleksiyonları (OBS "Scene Collection" menüsünün karşılığı): listele, yeni, çoğalt, yeniden adlandır, geç,
//! sil (yedek klasörüne taşır — kalıcı silme yok), yedekle, içe/dışa aktar, OBS'ten içe aktar.
//!
//! Geçiş motor çalışırken yapılabilir: sahne grafiği temizlenir ve yeni koleksiyon kurulur; çıktılar (yayın/kayıt)
//! sürer — kurulum süresince program boş kare verir. OBS'ten içe aktarma yalnız yerel ve yalnız kullanıcı istediğinde
//! OBS'in koleksiyon klasörünü okur (dosyalara yazılmaz).

use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use axum::body::Body;
use axum::extract::{ConnectInfo, Query, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};

use super::control_plane::{audit, authorize};
use super::motor_api::{catisma, gecersiz, kaydet, klasor, komut, koleksiyonu_kur};
use crate::motor_koleksiyon::{self as kol, Koleksiyon, Okuma};
use crate::AppState;

type ApiResult = Result<Json<Value>, (StatusCode, String)>;
type Hata = (StatusCode, String);

pub fn router() -> Router<Arc<AppState>> {
  Router::new()
    .route("/api/motor/koleksiyonlar", get(api_liste))
    .route("/api/motor/koleksiyon", post(api_islem))
    .route("/api/motor/koleksiyon/disa-aktar", get(api_disa_aktar))
}

fn bulunamadi(e: String) -> Hata {
  (StatusCode::NOT_FOUND, e)
}

fn ad_temizle(ad: &str) -> Result<String, Hata> {
  let a: String = ad.trim().chars().filter(|c| !c.is_control()).take(60).collect();
  if a.is_empty() {
    return Err(gecersiz("ad boş olamaz".into()));
  }
  Ok(a)
}

fn okunan(o: Okuma) -> Result<Koleksiyon, Hata> {
  match o {
    Okuma::Tamam(k) => Ok(k),
    Okuma::Yok => Err(bulunamadi("koleksiyon yok".into())),
    Okuma::YeniSurum(s) => Err(catisma(format!("koleksiyon daha yeni bir sürümle (v{s}) yazılmış"))),
    Okuma::Bozuk(e) => Err(catisma(format!("koleksiyon dosyası bozuk: {e}"))),
  }
}

/// OBS'in sahne koleksiyonu klasörü (`%APPDATA%\obs-studio\basic\scenes`)
fn obs_koleksiyon_klasoru() -> Option<PathBuf> {
  std::env::var_os("APPDATA").map(|a| PathBuf::from(a).join("obs-studio").join("basic").join("scenes"))
}

async fn api_liste(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
) -> ApiResult {
  authorize(&state, &addr, &headers, "broadcast.read").await?;
  let d = klasor(&state);
  let etkin = kol::etkin_kimlik(&d);
  let dizin = kol::dizin_oku(&d);
  let liste: Vec<Value> = dizin
    .map(|x| x.liste)
    .unwrap_or_default()
    .into_iter()
    .map(|x| {
      let yol = kol::koleksiyon_yolu(&d, &x.id);
      let degisti = std::fs::metadata(&yol).ok().and_then(|m| m.modified().ok()).and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|t| t.as_millis() as u64);
      let (sahne, kaynak) = match kol::koleksiyon_oku(&d, &x.id) {
        Okuma::Tamam(k) => (Some(k.sahneler.len()), Some(k.kaynaklar.len())),
        _ => (None, None),
      };
      json!({"id": x.id, "ad": x.ad, "sahne": sahne, "kaynak": kaynak, "degistirilme": degisti, "etkin": x.id == etkin})
    })
    .collect();
  Ok(Json(json!({"etkin": etkin, "liste": liste})))
}

#[derive(Deserialize)]
struct IslemGovdesi {
  eylem: String,
  #[serde(default)]
  id: Option<String>,
  #[serde(default)]
  ad: Option<String>,
  /// `ice-aktar`: bu uygulamanın koleksiyon JSON'u; `obs-ice-aktar`: OBS koleksiyon JSON'u
  #[serde(default)]
  veri: Option<Value>,
  /// `obs-ice-aktar`: OBS koleksiyon klasöründeki dosya adı (yalnız ad; yol değil)
  #[serde(default)]
  dosya: Option<String>,
}

/// Motor çalışıyorsa etkin koleksiyonu değiştirir: kaydet → temizle → kur. Çalışmıyorsa yalnız dizini günceller.
pub(crate) async fn koleksiyona_gec(state: &AppState, id: &str) -> Result<(), Hata> {
  let d = klasor(state);
  let yeni = okunan(kol::koleksiyon_oku(&d, id))?;
  let calisiyor = state.motor.calisiyor().await;
  if calisiyor {
    kaydet(state).await?;
    komut(state, json!({"komut": "temizle"})).await?;
    {
      let o = state.motor.ozet();
      let mut o = o.lock();
      o.studyo.clear();
      // Önceki koleksiyonun ayarları (dikey, fps, hedefler, tekrar) motor oturumu boyunca geçerli kalır
      o.koleksiyon.kaynaklar.clear();
      o.koleksiyon.sahneler.clear();
    }
  }
  let mut dz = kol::dizin_oku(&d).ok_or_else(|| catisma("koleksiyon dizini yok".into()))?;
  dz.etkin = id.to_string();
  kol::dizin_yaz(&d, &dz).map_err(catisma)?;
  if calisiyor {
    let dikey = state.motor.ozet().lock().dikey;
    let mut k = yeni;
    // Tuval yapısı motor oturumuna bağlı: dikey tuval açık oturumda yeni koleksiyon da dikey sahnelerini kurar
    k.dikey = k.dikey || dikey;
    k.duzelt();
    let kurulan = koleksiyonu_kur(state, k).await?;
    state.motor.ozet().lock().koleksiyon = kurulan;
    kaydet(state).await?;
  }
  Ok(())
}

async fn api_islem(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<IslemGovdesi>,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, "scene.edit").await?;
  let d = klasor(&state);
  let id = || g.id.clone().filter(|x| kol::gecerli_kimlik(x)).ok_or_else(|| gecersiz("geçerli 'id' gerekli".into()));
  // Etkin koleksiyonun güncel hâli motorda: işlem öncesi diske yazılsın
  if state.motor.calisiyor().await {
    let _ = kaydet(&state).await;
  }
  let dizin = || kol::dizin_oku(&d).unwrap_or(kol::Dizin { surum: 1, etkin: kol::VARSAYILAN_KIMLIK.into(), liste: Vec::new() });
  let sonuc = match g.eylem.as_str() {
    "yeni" => {
      let ad = ad_temizle(g.ad.as_deref().unwrap_or("Yeni koleksiyon"))?;
      let (dikey, fps) = match kol::oku(&d) {
        Okuma::Tamam(k) => (k.dikey, k.fps),
        _ => (false, 60),
      };
      let yeni = kol::yeni_kimlik(&dizin(), &ad);
      kol::koleksiyon_yaz(&d, &yeni, &Koleksiyon::bos(&ad, dikey, fps)).map_err(catisma)?;
      json!({"id": yeni})
    }
    "cogalt" => {
      let kaynak = id()?;
      let mut k = okunan(kol::koleksiyon_oku(&d, &kaynak))?;
      k.ad = ad_temizle(g.ad.as_deref().unwrap_or(&format!("{} (kopya)", k.ad)))?;
      let yeni = kol::yeni_kimlik(&dizin(), &k.ad);
      kol::koleksiyon_yaz(&d, &yeni, &k).map_err(catisma)?;
      json!({"id": yeni})
    }
    "adlandir" => {
      let hedef = id()?;
      let ad = ad_temizle(g.ad.as_deref().unwrap_or(""))?;
      let mut k = okunan(kol::koleksiyon_oku(&d, &hedef))?;
      k.ad = ad.clone();
      if hedef == kol::etkin_kimlik(&d) && state.motor.calisiyor().await {
        state.motor.ozet().lock().koleksiyon.ad = ad;
        k = state.motor.ozet().lock().koleksiyon.clone();
      }
      kol::koleksiyon_yaz(&d, &hedef, &k).map_err(catisma)?;
      json!({})
    }
    "gec" => {
      let hedef = id()?;
      koleksiyona_gec(&state, &hedef).await?;
      json!({"etkin": hedef})
    }
    "sil" => {
      let hedef = id()?;
      if hedef == kol::etkin_kimlik(&d) {
        return Err(catisma("etkin koleksiyon silinemez; önce başka bir koleksiyona geçin".into()));
      }
      let yedek = kol::yedekle(&d, &hedef, true).map_err(catisma)?;
      let mut dz = dizin();
      dz.liste.retain(|x| x.id != hedef);
      kol::dizin_yaz(&d, &dz).map_err(catisma)?;
      json!({"yedek": yedek.file_name().map(|f| f.to_string_lossy().into_owned())})
    }
    "yedekle" => {
      let hedef = id()?;
      let yedek = kol::yedekle(&d, &hedef, false).map_err(catisma)?;
      json!({"yedek": yedek.file_name().map(|f| f.to_string_lossy().into_owned())})
    }
    "ice-aktar" => {
      let veri = g.veri.clone().ok_or_else(|| gecersiz("'veri' gerekli".into()))?;
      let metin = veri.to_string();
      if metin.len() > 20 * 1024 * 1024 {
        return Err(gecersiz("koleksiyon çok büyük".into()));
      }
      let mut k = match kol::cozumle(&metin) {
        Okuma::Tamam(k) => k,
        Okuma::YeniSurum(s) => return Err(catisma(format!("bu koleksiyon daha yeni bir sürümden (v{s})"))),
        _ => return Err(gecersiz("geçerli bir koleksiyon değil".into())),
      };
      if let Some(a) = &g.ad {
        k.ad = ad_temizle(a)?;
      }
      // İçe aktarılan kayıtta Kimlik Yöneticisi başvuruları bu makinede yok: parola alanları boş kalır
      let yeni = kol::yeni_kimlik(&dizin(), &k.ad);
      kol::koleksiyon_yaz(&d, &yeni, &k).map_err(catisma)?;
      json!({"id": yeni})
    }
    "obs-listesi" => {
      if !addr.ip().is_loopback() {
        return Err((StatusCode::FORBIDDEN, "yalnız bu bilgisayardan".into()));
      }
      let mut dosyalar: Vec<Value> = Vec::new();
      if let Some(k) = obs_koleksiyon_klasoru() {
        for e in std::fs::read_dir(&k).into_iter().flatten().flatten() {
          let p = e.path();
          if p.extension().is_some_and(|x| x.eq_ignore_ascii_case("json")) {
            let boyut = e.metadata().map(|m| m.len()).unwrap_or(0);
            dosyalar.push(json!({"dosya": p.file_name().map(|f| f.to_string_lossy().into_owned()), "boyut": boyut}));
          }
        }
      }
      json!({"dosyalar": dosyalar})
    }
    "obs-ice-aktar" => {
      let obs: Value = match (&g.veri, &g.dosya) {
        (Some(v), _) => v.clone(),
        (None, Some(dosya)) => {
          if !addr.ip().is_loopback() {
            return Err((StatusCode::FORBIDDEN, "yalnız bu bilgisayardan".into()));
          }
          obs_dosyasi_oku(dosya)?
        }
        _ => return Err(gecersiz("'veri' ya da 'dosya' gerekli".into())),
      };
      let kayitli = state.motor.ozet().lock().giris_turleri.clone();
      let ad = match &g.ad {
        Some(a) => ad_temizle(a)?,
        None => ad_temizle(&format!("OBS: {}", obs["name"].as_str().unwrap_or("koleksiyon")))?,
      };
      let (k, r) = crate::motor_obs_ice::cevir(&obs, &ad, &kayitli).map_err(gecersiz)?;
      let yeni = kol::yeni_kimlik(&dizin(), &ad);
      kol::koleksiyon_yaz(&d, &yeni, &k).map_err(catisma)?;
      json!({"id": yeni, "kaynak": r.kaynak, "sahne": r.sahne, "grup": r.grup, "filtre": r.filtre, "notlar": r.notlar})
    }
    e => return Err(gecersiz(format!("bilinmeyen eylem: {e}"))),
  };
  audit(&state, &actor, "MOTOR_COLLECTION", json!({"eylem": g.eylem, "id": g.id.clone().or_else(|| sonuc["id"].as_str().map(String::from))})).await;
  Ok(Json(sonuc))
}

/// OBS koleksiyon klasöründen tek dosya: yalnız dosya adı kabul edilir (klasör dışına çıkılamaz), en çok 20 MB.
fn obs_dosyasi_oku(dosya: &str) -> Result<Value, Hata> {
  if dosya.contains(['/', '\\', ':']) || dosya.contains("..") || !dosya.to_ascii_lowercase().ends_with(".json") {
    return Err(gecersiz("geçersiz dosya adı".into()));
  }
  let k = obs_koleksiyon_klasoru().ok_or_else(|| catisma("OBS klasörü bulunamadı".into()))?;
  let yol: &Path = &k.join(dosya);
  let boyut = std::fs::metadata(yol).map_err(|_| bulunamadi("dosya yok".into()))?.len();
  if boyut > 20 * 1024 * 1024 {
    return Err(gecersiz("dosya çok büyük".into()));
  }
  let metin = std::fs::read_to_string(yol).map_err(|e| catisma(e.to_string()))?;
  serde_json::from_str(&metin).map_err(|e| gecersiz(format!("JSON okunamadı: {e}")))
}

#[derive(Deserialize)]
struct IdSorgusu {
  id: String,
}

async fn api_disa_aktar(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Query(q): Query<IdSorgusu>,
) -> Result<Response, Hata> {
  authorize(&state, &addr, &headers, "broadcast.read").await?;
  if !kol::gecerli_kimlik(&q.id) {
    return Err(gecersiz("geçersiz kimlik".into()));
  }
  let d = klasor(&state);
  if q.id == kol::etkin_kimlik(&d) && state.motor.calisiyor().await {
    let _ = kaydet(&state).await;
  }
  let k = okunan(kol::koleksiyon_oku(&d, &q.id))?;
  // Sır yok: parola alanlarının yalnız adları var (değerleri Kimlik Yöneticisinde)
  let metin = serde_json::to_string_pretty(&k).map_err(|e| catisma(e.to_string()))?;
  Ok(
    Response::builder()
      .header(header::CONTENT_TYPE, "application/json; charset=utf-8")
      .header(header::CONTENT_DISPOSITION, format!("attachment; filename=\"{}.json\"", q.id))
      .header(header::CACHE_CONTROL, "no-store")
      .body(Body::from(metin))
      .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response()),
  )
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn obs_dosya_adi_dogrulama() {
    assert!(obs_dosyasi_oku("../x.json").is_err());
    assert!(obs_dosyasi_oku("C:\\x.json").is_err());
    assert!(obs_dosyasi_oku("a/b.json").is_err());
    assert!(obs_dosyasi_oku("x.txt").is_err());
  }
}
