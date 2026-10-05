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
    .route("/api/motor/sihirbaz", axum::routing::post(api_sihirbaz))
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
      // Kare hızı, video ve ses ayarları motorun yeniden başlamasını ister (OBS'te de çıktılar dururken uygulanır)
      let yeniden = calisiyor && yeni.motor_ayari_farkli(&once);
      if yeniden && etkin_cikis_var(&state) {
        return Err(catisma("kare hızı, video ve ses ayarları yayın, kayıt ya da tekrar arabelleği sürerken değişmez; önce çıktıları durdurun".into()));
      }
      prf::etkin_yaz(&d, &yeni).map_err(catisma)?;
      if yeniden {
        let dikey = state.motor.ozet().lock().dikey;
        let _ = super::motor_api::kaydet(&state).await;
        state.motor.durdur().await.map_err(catisma)?;
        crate::eklenti::kayit::oturum_bitti(&d);
        motoru_baslat(&state, &actor, BaslatGovdesi { dikey: Some(dikey), ..Default::default() }).await?;
        audit(&state, &actor, "MOTOR_PROFILE", json!({"eylem": "guncelle", "alanlar": degisim.keys().collect::<Vec<_>>(), "motorYenidenBasladi": true})).await;
        return Ok(Json(json!({"profil": yeni, "bekleyen": false, "motorYenidenBasladi": true})));
      }
      if calisiyor {
        state.motor.ozet().lock().profil = yeni.clone();
        if yeni.cikis != once.cikis || yeni.kayit != once.kayit {
          kodlayicilari_tazele(&state).await;
        }
        if yeni.gercek_tepe != once.gercek_tepe {
          komut(&state, json!({"komut": "olcer.tepe_tipi", "gercek": yeni.gercek_tepe})).await?;
        }
        if yeni.studyo_cogalt != once.studyo_cogalt {
          let acik: Vec<String> = state.motor.ozet().lock().studyo.keys().cloned().collect();
          for t in acik {
            komut(&state, json!({"komut": "studyo.cogalt", "tuval": t, "kip": yeni.studyo_cogalt})).await?;
          }
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

// ─── Otomatik yapılandırma sihirbazı ───────────────────────────────────────

#[derive(Deserialize)]
struct SihirbazGovdesi {
  /// Kullanıcının ölçtüğü yükleme hızı (kbps). Verilmezse bant genişliği önerisi yapılmaz (platforma sınama
  /// bağlantısı izinsiz açılmaz).
  #[serde(default)]
  yukleme_kbps: Option<u32>,
  /// Aynı anda yayın yapılacak hedef sayısı (1–8)
  #[serde(default)]
  hedef_sayisi: Option<u32>,
  /// Sınanacak bit hızı (varsayılan profildeki yatay bit hızı)
  #[serde(default)]
  bit_hizi: Option<u32>,
}

/// Önerilen hedef başı video bit hızı: güvenli kullanım payıyla bütçe − ses − protokol payı; 6000 kbps üst sınır
/// (yaygın 1080p60 değeri; platforma özel sınırlar ayrıca uygulanır). Bütçe yetmezse `None`.
pub(crate) fn onerilen_bit_hizi(yukleme_kbps: u32, hedef: u32, ses_kbps: u32) -> Option<u32> {
  use crate::multistream::policy::{GUVENLI_KULLANIM, PROTOKOL_PAYI};
  let hedef = hedef.clamp(1, 8) as f64;
  let butce = yukleme_kbps as f64 * GUVENLI_KULLANIM / hedef / (1.0 + PROTOKOL_PAYI) - ses_kbps as f64;
  (butce >= 1000.0).then(|| ((butce.min(6000.0) / 100.0).floor() * 100.0) as u32)
}

/// Yerel kodlama sınaması: mevcut program sahnesi seçilen kodlayıcıyla 5 sn geçici dosyaya kaydedilir (yayın yok),
/// atlanan kare oranı ölçülür; oran %2'yi aşarsa sıradaki kodlayıcı denenir. Disk süresi ve (verildiyse) yükleme
/// hızından hedef başı bit hızı önerilir. Profili DEĞİŞTİRMEZ — arayüz "Uygula" ile yazar.
async fn api_sihirbaz(State(state): State<Arc<AppState>>, ConnectInfo(addr): ConnectInfo<SocketAddr>, headers: HeaderMap, Json(g): Json<SihirbazGovdesi>) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, "broadcast.record").await?;
  motor_calisiyor(&state).await?;
  if etkin_cikis_var(&state) {
    return Err(catisma("yayın/kayıt sürerken sınama yapılmaz (ölçüm yanıltıcı olur)".into()));
  }
  let (profil, bilgi) = {
    let o = state.motor.ozet();
    let o = o.lock();
    (o.profil.clone(), o.bilgi.clone())
  };
  let bit_hizi = g.bit_hizi.unwrap_or(profil.cikis.bit_hizi_ana).clamp(500, 50_000);
  // Aday kodlayıcılar: donanım (NVENC/AMF/QSV) önce, sonra x264
  let mut adaylar: Vec<(String, String, bool)> = bilgi["video_kodlayicilari"]
    .as_array()
    .into_iter()
    .flatten()
    .filter(|k| k["kodek"] == "h264")
    .filter_map(|k| Some((k["id"].as_str()?.to_string(), k["ad"].as_str().unwrap_or("").to_string(), k["donanim"].as_bool().unwrap_or(false))))
    .collect();
  adaylar.sort_by_key(|(_, _, d)| !*d);
  adaylar.truncate(3);
  if adaylar.is_empty() {
    return Err(catisma("kurulu OBS'te H.264 kodlayıcı bulunamadı".into()));
  }
  super::motor_api::ses_hazirla(&state, 0).await?;
  let klasor_ = std::env::temp_dir().join("yayin-motoru-sihirbaz");
  let _ = std::fs::create_dir_all(&klasor_);
  let mut sonuclar = Vec::new();
  let mut secilen: Option<(String, f64)> = None;
  for (tur, ad, donanim) in &adaylar {
    let yol = klasor_.join(format!("sinama-{tur}.mkv"));
    let r = async {
      komut(&state, json!({"komut": "kodlayici.video", "id": "sihirbaz-v", "tur": tur, "tuval": "ana", "bit_hizi": bit_hizi, "anahtar_kare_sn": 2})).await?;
      komut(&state, json!({"komut": "cikis.kayit", "id": "sihirbaz", "yol": yol, "video": "sihirbaz-v", "sesler": ["ses-0"]})).await?;
      let once = komut(&state, json!({"komut": "istatistik"})).await?;
      komut(&state, json!({"komut": "cikis.baslat", "id": "sihirbaz"})).await?;
      tokio::time::sleep(std::time::Duration::from_secs(5)).await;
      let sonra = komut(&state, json!({"komut": "istatistik"})).await?;
      komut(&state, json!({"komut": "cikis.durdur", "id": "sihirbaz"})).await?;
      Ok::<_, Hata>((once, sonra))
    }
    .await;
    // Temizlik: çıktı, kodlayıcı, geçici dosya (hata olsa da)
    tokio::time::sleep(std::time::Duration::from_millis(700)).await;
    let _ = komut(&state, json!({"komut": "cikis.sil", "id": "sihirbaz"})).await;
    let _ = komut(&state, json!({"komut": "kodlayici.sil", "id": "sihirbaz-v"})).await;
    let boyut = std::fs::metadata(&yol).map(|m| m.len()).unwrap_or(0);
    let _ = std::fs::remove_file(&yol);
    match r {
      Ok((once, sonra)) => {
        let fark = |a: &str| sonra[a].as_u64().unwrap_or(0).saturating_sub(once[a].as_u64().unwrap_or(0));
        let (atlanan, video, geciken) = (fark("atlanan_kare"), fark("video_kare"), fark("geciken_kare"));
        let oran = if video > 0 { atlanan as f64 / video as f64 } else { 1.0 };
        let gecti = video > 0 && oran <= 0.02 && boyut > 0;
        sonuclar.push(json!({"tur": tur, "ad": ad, "donanim": donanim, "kare": video, "atlanan": atlanan, "geciken": geciken, "oran": oran, "bayt": boyut, "gecti": gecti}));
        if gecti && secilen.is_none() {
          secilen = Some((tur.clone(), oran));
        }
      }
      Err((_, e)) => sonuclar.push(json!({"tur": tur, "ad": ad, "donanim": donanim, "hata": e, "gecti": false})),
    }
    if secilen.is_some() {
      break;
    }
  }
  let _ = std::fs::remove_dir(&klasor_);
  let mut notlar: Vec<String> = Vec::new();
  let hedef = g.hedef_sayisi.unwrap_or(1).clamp(1, 8);
  let oneri_bh = match g.yukleme_kbps {
    Some(u) => {
      let b = onerilen_bit_hizi(u, hedef, profil.cikis.ses_bit_hizi);
      if b.is_none() {
        notlar.push(format!("{u} kbps yükleme {hedef} hedef için yetersiz: hedef sayısını azaltın ya da tek hedefe yayınlayın."));
      }
      b
    }
    None => {
      notlar.push("Yükleme hızı girilmedi: bant genişliğine göre bit hızı önerilmedi (platform sunucusuna izinsiz sınama bağlantısı açılmaz).".into());
      None
    }
  };
  let kayit_dizini = profil.kayit.klasor.as_ref().map(std::path::PathBuf::from).unwrap_or_else(super::motor_api::kayit_klasoru);
  let onerilen = oneri_bh.unwrap_or(bit_hizi);
  let disk_dk = crate::disk::bos_alan(&kayit_dizini).map(|b| crate::multistream::policy::record_minutes(b, onerilen));
  if secilen.is_none() {
    notlar.push("Hiçbir kodlayıcı %2'nin altında atlanan kareyle kodlayamadı: çözünürlük/kare hızını düşürmeyi ya da daha düşük bit hızını deneyin.".into());
  }
  notlar.push("Sınama yalnız bu bilgisayarın kodlama gücünü mevcut sahneyle ölçer; ağ kalitesi ve platform kabulü sınanmadı.".into());
  audit(&state, &actor, "MOTOR_WIZARD", json!({"secilen": secilen.as_ref().map(|s| &s.0), "yukleme": g.yukleme_kbps.is_some()})).await;
  Ok(Json(json!({
    "sonuclar": sonuclar,
    "oneri": {
      "kodlayici": secilen.as_ref().map(|s| s.0.clone()),
      "bit_hizi_ana": oneri_bh,
      "bit_hizi_dikey": oneri_bh,
    },
    "sinananBitHizi": bit_hizi,
    "diskDakika": disk_dk,
    "notlar": notlar,
  })))
}

#[cfg(test)]
mod tests {
  use super::onerilen_bit_hizi;

  #[test]
  fn bant_genisligi_onerisi() {
    // 20 Mbps, 2 hedef: 20000×0,75/2/1,05 − 160 ≈ 6982 → 6000 üst sınır
    assert_eq!(onerilen_bit_hizi(20_000, 2, 160), Some(6000));
    // 10 Mbps, 2 hedef: ≈ 3411 → 3400
    assert_eq!(onerilen_bit_hizi(10_000, 2, 160), Some(3400));
    // 3 Mbps, 3 hedef: bütçe yetmez
    assert_eq!(onerilen_bit_hizi(3_000, 3, 160), None);
    assert_eq!(onerilen_bit_hizi(10_000, 0, 160), onerilen_bit_hizi(10_000, 1, 160));
  }
}
