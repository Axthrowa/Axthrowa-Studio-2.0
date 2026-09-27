//! Motor profilleri (OBS "Profile" menüsü) ve yayın ayarları: listele, etkin profili oku, kısmi güncelle, yeni,
//! çoğalt, yeniden adlandır, geç, sil (yedek klasörüne), içe/dışa aktar; kodlayıcı özellikleri (Uzman kip formu) ve
//! kullanılabilir kayıt biçimleri.
//!
//! Profil değişimi motor çalışırken yayın/kayıt yoksa motoru yeniden başlatır (kare hızı değişebilir); yayın ya da
//! kayıt sürerken reddedilir (OBS de etkin çıktı varken profil değiştirmez). Ayar güncellemesi boştaki çıktıları ve
//! kodlayıcıları bırakır; etkin çıktılar yeni ayarı durup yeniden başlayınca alır.

use std::net::SocketAddr;
use std::sync::Arc;

use axum::body::Body;
use axum::extract::{ConnectInfo, Query, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Map, Value};

use super::control_plane::{audit, authorize};
use super::motor_api::{catisma, gecersiz, klasor, kodlayicilari_tazele, komut, motor_calisiyor, motoru_baslat, profili_yukle, BaslatGovdesi};
use crate::motor_profil::{self as prf, Okuma, Profil};
use crate::AppState;

type ApiResult = Result<Json<Value>, (StatusCode, String)>;
type Hata = (StatusCode, String);

pub fn router() -> Router<Arc<AppState>> {
  Router::new()
    .route("/api/motor/profiller", get(api_liste))
    .route("/api/motor/profil", get(api_etkin).post(api_islem))
    .route("/api/motor/profil/disa-aktar", get(api_disa_aktar))
    .route("/api/motor/kodlayici-ozellikleri", get(api_kodlayici_ozellikleri))
}

/// Motor yokken bilinen kayıt biçimleri (motor çalışırken kurulu OBS'in gerçek listesi kullanılır)
const BILINEN_BICIMLER: [&str; 6] = ["mkv", "mp4", "mov", "parcali_mp4", "parcali_mov", "hibrit_mp4"];

fn ad_temizle(ad: &str) -> Result<String, Hata> {
  let a: String = ad.trim().chars().filter(|c| !c.is_control()).take(60).collect();
  if a.is_empty() {
    return Err(gecersiz("ad boş olamaz".into()));
  }
  Ok(a)
}

fn okunan(o: Okuma) -> Result<Profil, Hata> {
  match o {
    Okuma::Tamam(p) => Ok(*p),
    Okuma::Yok => Err((StatusCode::NOT_FOUND, "profil yok".into())),
    Okuma::YeniSurum(s) => Err(catisma(format!("profil daha yeni bir sürümle (v{s}) yazılmış"))),
    Okuma::Bozuk(e) => Err(catisma(format!("profil dosyası bozuk: {e}"))),
  }
}

/// Motorda yayında/kayıtta/tekrarda etkin çıktı var mı
fn etkin_cikis_var(state: &AppState) -> bool {
  let o = state.motor.ozet();
  let o = o.lock();
  o.cikislar.values().any(|v| v.get("durum").and_then(Value::as_str).is_some_and(|d| matches!(d, "baglaniyor" | "canli" | "yeniden_baglaniyor" | "durduruluyor")))
}

async fn api_liste(State(state): State<Arc<AppState>>, ConnectInfo(addr): ConnectInfo<SocketAddr>, headers: HeaderMap) -> ApiResult {
  authorize(&state, &addr, &headers, "broadcast.read").await?;
  let d = klasor(&state);
  let etkin = prf::etkin_kimlik(&d);
  let liste: Vec<Value> = prf::dizin_oku(&d).map(|x| x.liste).unwrap_or_default().into_iter().map(|x| json!({"id": x.id, "ad": x.ad, "etkin": x.id == etkin})).collect();
  Ok(Json(json!({"etkin": etkin, "liste": liste})))
}

async fn api_etkin(State(state): State<Arc<AppState>>, ConnectInfo(addr): ConnectInfo<SocketAddr>, headers: HeaderMap) -> ApiResult {
  authorize(&state, &addr, &headers, "broadcast.read").await?;
  let d = klasor(&state);
  let calisiyor = state.motor.calisiyor().await;
  let profil = if calisiyor { state.motor.ozet().lock().profil.clone() } else { prf::etkin(&d) };
  let (kodlayicilar, bicimler) = if calisiyor {
    let bilgi = state.motor.ozet().lock().bilgi.clone();
    let b = komut(&state, json!({"komut": "kayit.bicimleri"})).await.map(|v| v["bicimler"].clone()).unwrap_or(Value::Null);
    (bilgi["video_kodlayicilari"].clone(), b)
  } else {
    (Value::Null, json!(BILINEN_BICIMLER.iter().map(|b| json!({"ad": b})).collect::<Vec<_>>()))
  };
  Ok(Json(json!({
    "id": prf::etkin_kimlik(&d),
    "profil": profil,
    "calisiyor": calisiyor,
    "videoKodlayicilari": kodlayicilar,
    "kayitBicimleri": bicimler,
    "etkinCikis": etkin_cikis_var(&state),
  })))
}

#[derive(Deserialize)]
struct IslemGovdesi {
  eylem: String,
  #[serde(default)]
  id: Option<String>,
  #[serde(default)]
  ad: Option<String>,
  /// `guncelle`: kısmi profil (yalnız değişen alanlar; null = varsayılana dön)
  #[serde(default)]
  degisim: Option<Map<String, Value>>,
  /// `ice-aktar`: profil JSON'u
  #[serde(default)]
  veri: Option<Value>,
}

async fn api_islem(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<IslemGovdesi>,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, "broadcast.stream").await?;
  let d = klasor(&state);
  let id = || g.id.clone().filter(|x| crate::motor_koleksiyon::gecerli_kimlik(x)).ok_or_else(|| gecersiz("geçerli 'id' gerekli".into()));
  let dizin = || prf::dizin_oku(&d).unwrap_or(prf::Dizin { surum: 1, etkin: prf::VARSAYILAN_KIMLIK.into(), liste: Vec::new() });
  let _ = prf::etkin_kimlik(&d);
  let sonuc = match g.eylem.as_str() {
    "guncelle" => {
      let degisim = g.degisim.clone().ok_or_else(|| gecersiz("'degisim' gerekli".into()))?;
      if Value::Object(degisim.clone()).to_string().len() > 64 * 1024 {
        return Err(gecersiz("değişiklik çok büyük".into()));
      }
      // Etkin olmayan profil: yalnız dosyası güncellenir
      if let Some(hedef) = g.id.clone().filter(|x| *x != prf::etkin_kimlik(&d)) {
        if !crate::motor_koleksiyon::gecerli_kimlik(&hedef) {
          return Err(gecersiz("geçersiz kimlik".into()));
        }
        let once = okunan(prf::profil_oku(&d, &hedef))?;
        let yeni = prf::birlestir(&once, &degisim).map_err(gecersiz)?;
        prf::profil_yaz(&d, &hedef, &yeni).map_err(catisma)?;
        audit(&state, &actor, "MOTOR_PROFILE", json!({"eylem": "guncelle", "id": hedef, "alanlar": degisim.keys().collect::<Vec<_>>()})).await;
        return Ok(Json(json!({"profil": yeni, "bekleyen": false})));
      }
      let calisiyor = state.motor.calisiyor().await;
      let once = if calisiyor { state.motor.ozet().lock().profil.clone() } else { prf::etkin(&d) };
      let yeni = prf::birlestir(&once, &degisim).map_err(gecersiz)?;
      if yeni.fps != once.fps && calisiyor {
        return Err(catisma("kare hızı motor çalışırken değişmez; motoru durdurup değiştirin (ya da profil değiştirin)".into()));
      }
      prf::etkin_yaz(&d, &yeni).map_err(catisma)?;
      if calisiyor {
        state.motor.ozet().lock().profil = yeni.clone();
        if yeni.cikis != once.cikis || yeni.kayit != once.kayit {
          kodlayicilari_tazele(&state).await;
        }
        if yeni.izleme_aygiti != once.izleme_aygiti {
          if let Some(a) = &yeni.izleme_aygiti {
            komut(&state, json!({"komut": "izleme.aygit", "id": a.id, "ad": a.ad})).await?;
          }
        }
      }
      json!({"profil": yeni, "bekleyen": calisiyor && etkin_cikis_var(&state) && (yeni.cikis != once.cikis || yeni.kayit != once.kayit)})
    }
    "yeni" => {
      let ad = ad_temizle(g.ad.as_deref().unwrap_or("Yeni profil"))?;
      let yeni = prf::yeni_kimlik(&dizin(), &ad);
      prf::profil_yaz(&d, &yeni, &Profil { ad, ..Default::default() }).map_err(catisma)?;
      json!({"id": yeni})
    }
    "cogalt" => {
      let kaynak = id()?;
      let mut p = okunan(prf::profil_oku(&d, &kaynak))?;
      p.ad = ad_temizle(g.ad.as_deref().unwrap_or(&format!("{} (kopya)", p.ad)))?;
      let yeni = prf::yeni_kimlik(&dizin(), &p.ad);
      prf::profil_yaz(&d, &yeni, &p).map_err(catisma)?;
      json!({"id": yeni})
    }
    "adlandir" => {
      let hedef = id()?;
      let mut p = okunan(prf::profil_oku(&d, &hedef))?;
      p.ad = ad_temizle(g.ad.as_deref().unwrap_or(""))?;
      prf::profil_yaz(&d, &hedef, &p).map_err(catisma)?;
      if hedef == prf::etkin_kimlik(&d) && state.motor.calisiyor().await {
        state.motor.ozet().lock().profil.ad = p.ad.clone();
      }
      json!({})
    }
    "gec" => {
      let hedef = id()?;
      okunan(prf::profil_oku(&d, &hedef))?;
      let calisiyor = state.motor.calisiyor().await;
      if calisiyor && etkin_cikis_var(&state) {
        return Err(catisma("yayın, kayıt ya da tekrar arabelleği sürerken profil değiştirilemez".into()));
      }
      let dikey = state.motor.ozet().lock().dikey;
      if calisiyor {
        let _ = super::motor_api::kaydet(&state).await;
        state.motor.durdur().await.map_err(catisma)?;
        crate::eklenti::kayit::oturum_bitti(&d);
      }
      let mut dz = dizin();
      dz.etkin = hedef.clone();
      prf::dizin_yaz(&d, &dz).map_err(catisma)?;
      let yeniden = if calisiyor {
        motoru_baslat(&state, &actor, BaslatGovdesi { dikey: Some(dikey), ..Default::default() }).await?;
        true
      } else {
        profili_yukle(&state);
        false
      };
      json!({"etkin": hedef, "motorYenidenBasladi": yeniden})
    }
    "sil" => {
      let hedef = id()?;
      if hedef == prf::etkin_kimlik(&d) {
        return Err(catisma("etkin profil silinemez; önce başka bir profile geçin".into()));
      }
      let yedek = prf::yedekle(&d, &hedef, true).map_err(catisma)?;
      let mut dz = dizin();
      dz.liste.retain(|x| x.id != hedef);
      prf::dizin_yaz(&d, &dz).map_err(catisma)?;
      json!({"yedek": yedek.file_name().map(|f| f.to_string_lossy().into_owned())})
    }
    "ice-aktar" => {
      let veri = g.veri.clone().ok_or_else(|| gecersiz("'veri' gerekli".into()))?;
      let mut p = match prf::cozumle(&veri.to_string()) {
        Okuma::Tamam(p) => *p,
        Okuma::YeniSurum(s) => return Err(catisma(format!("bu profil daha yeni bir sürümden (v{s})"))),
        _ => return Err(gecersiz("geçerli bir profil değil".into())),
      };
      if let Some(a) = &g.ad {
        p.ad = ad_temizle(a)?;
      }
      let yeni = prf::yeni_kimlik(&dizin(), &p.ad);
      prf::profil_yaz(&d, &yeni, &p).map_err(catisma)?;
      json!({"id": yeni})
    }
    e => return Err(gecersiz(format!("bilinmeyen eylem: {e}"))),
  };
  let alanlar: Vec<String> = g.degisim.as_ref().map(|m| m.keys().cloned().collect()).unwrap_or_default();
  audit(&state, &actor, "MOTOR_PROFILE", json!({"eylem": g.eylem, "id": g.id.clone().or_else(|| sonuc["id"].as_str().map(String::from)), "alanlar": alanlar})).await;
  Ok(Json(sonuc))
}

#[derive(Deserialize)]
struct IdSorgusu {
  id: String,
}

async fn api_disa_aktar(State(state): State<Arc<AppState>>, ConnectInfo(addr): ConnectInfo<SocketAddr>, headers: HeaderMap, Query(q): Query<IdSorgusu>) -> Result<Response, Hata> {
  authorize(&state, &addr, &headers, "broadcast.read").await?;
  if !crate::motor_koleksiyon::gecerli_kimlik(&q.id) {
    return Err(gecersiz("geçersiz kimlik".into()));
  }
  let p = okunan(prf::profil_oku(&klasor(&state), &q.id))?;
  // Sır yok: yayın anahtarları Kimlik Yöneticisinde; hedefler yalnız kimlikle
  let metin = serde_json::to_string_pretty(&p).map_err(|e| catisma(e.to_string()))?;
  Ok(
    Response::builder()
      .header(header::CONTENT_TYPE, "application/json; charset=utf-8")
      .header(header::CONTENT_DISPOSITION, format!("attachment; filename=\"profil-{}.json\"", q.id))
      .header(header::CACHE_CONTROL, "no-store")
      .body(Body::from(metin))
      .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response()),
  )
}

#[derive(Deserialize)]
struct TurSorgusu {
  tur: String,
}

/// Kodlayıcı türünün özellik formu (Uzman kip). Motor çalışmalı (türler kurulu OBS'ten).
async fn api_kodlayici_ozellikleri(State(state): State<Arc<AppState>>, ConnectInfo(addr): ConnectInfo<SocketAddr>, headers: HeaderMap, Query(q): Query<TurSorgusu>) -> ApiResult {
  authorize(&state, &addr, &headers, "broadcast.read").await?;
  motor_calisiyor(&state).await?;
  if q.tur.is_empty() || q.tur.len() > 64 || !q.tur.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_') {
    return Err(gecersiz("geçersiz tür".into()));
  }
  let mut v = komut(&state, json!({"komut": "kodlayici.ozellikleri", "tur": q.tur})).await?;
  // Kayıtlı Uzman ayarları formda gösterilsin
  let uzman = state.motor.ozet().lock().profil.cikis.uzman.get(&q.tur).cloned();
  if let (Some(u), Some(a)) = (uzman, v.get_mut("ayarlar").and_then(Value::as_object_mut)) {
    for (k, d) in u {
      a.insert(k, d);
    }
  }
  Ok(Json(v))
}
