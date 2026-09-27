//! Motor sesi ve filtreleri: ses mikseri (her ses kaynağı ayrı kanal), gelişmiş ses özellikleri, izleme aygıtı,
//! çift ses uyarısı, filtreler (ses + video), medya denetimi, kaynak durumları, tür özellikleri ve canlı akış
//! (`/ws/motor`: ses seviyeleri ve önizleme kareleri; yalnız yerel).

use std::net::SocketAddr;
use std::sync::Arc;

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{ConnectInfo, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use serde_json::{json, Map, Value};

use super::control_plane::{audit, authorize};
use super::motor_api::{gecersiz, komut, koleksiyonu_yaz, modul_grubu_yukle, motor_calisiyor, tuval_boyutu};
use crate::motor_koleksiyon::{FiltreKaydi, KaynakKaydi};
use crate::AppState;

type ApiResult = Result<Json<Value>, (StatusCode, String)>;
type Hata = (StatusCode, String);

pub fn router() -> Router<Arc<AppState>> {
  Router::new()
    .route("/api/motor/ses", get(api_ses).post(api_ses_ayarla))
    .route("/api/motor/izleme-aygiti", post(api_izleme_aygiti))
    .route("/api/motor/cift-ses", post(api_cift_ses))
    .route("/api/motor/filtre-turleri", get(api_filtre_turleri))
    .route("/api/motor/filtreler", get(api_filtreler))
    .route("/api/motor/filtre", post(api_filtre))
    .route("/api/motor/filtre/ozellikler", get(api_filtre_ozellikleri))
    .route("/api/motor/medya", post(api_medya))
    .route("/api/motor/kaynak-durumlari", get(api_kaynak_durumlari))
    .route("/api/motor/tur-ozellikleri", get(api_tur_ozellikleri))
    .route("/ws/motor", get(ws_motor))
}

fn bulunamadi(e: String) -> Hata {
  (StatusCode::NOT_FOUND, e)
}

/// Uygulamaya ait sesi yakalayan kaynak mı (oyun/pencere yakalamada "sesi yakala" açık ya da uygulama sesi)
fn uygulama_sesi_mi(k: &KaynakKaydi) -> bool {
  match k.obs_turu.as_str() {
    "wasapi_process_output_capture" => true,
    "game_capture" | "window_capture" => k.ayarlar.get("capture_audio").and_then(Value::as_bool).unwrap_or(false),
    _ => false,
  }
}

/// Çift ses uyarıları: uygulama sesini yakalayan kaynak + masaüstü sesi aynı izlerde, ikisi de açık. Kullanıcının
/// "ikisini de tut" dediği çiftler hariç. Masaüstü sesi o uygulamayı zaten içerdiği için yayında ses iki kez duyulur.
pub(crate) fn cift_ses_uyarilari(k: &crate::motor_koleksiyon::Koleksiyon) -> Vec<Value> {
  let masaustu: Vec<&KaynakKaydi> = k.kaynaklar.iter().filter(|x| x.obs_turu == "wasapi_output_capture" && !x.eksik && !x.ses.sessiz).collect();
  let mut v = Vec::new();
  for u in k.kaynaklar.iter().filter(|x| uygulama_sesi_mi(x) && !x.eksik && !x.ses.sessiz && k.kullanim_sayisi(&x.id) > 0) {
    for d in &masaustu {
      let ortak = u.izler & d.izler;
      let anahtar = format!("{}|{}", u.id, d.id);
      if ortak != 0 && !k.cift_ses_tut.contains(&anahtar) {
        let izler: Vec<u32> = (0..6).filter(|i| ortak & (1 << i) != 0).map(|i| i + 1).collect();
        v.push(json!({"uygulama": u.id, "uygulamaAdi": u.ad, "masaustu": d.id, "masaustuAdi": d.ad, "izler": izler}));
      }
    }
  }
  v
}

// ─── Mikser ────────────────────────────────────────────────────────────────

async fn api_ses(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
) -> ApiResult {
  authorize(&state, &addr, &headers, "broadcast.read").await?;
  motor_calisiyor(&state).await?;
  let liste = komut(&state, json!({"komut": "ses.listesi"})).await?;
  let durumlar = komut(&state, json!({"komut": "kaynak.durumlari"})).await.unwrap_or(Value::Null);
  let izleme = komut(&state, json!({"komut": "izleme.aygitlari"})).await.unwrap_or(Value::Null);
  let o = state.motor.ozet();
  let o = o.lock();
  let kaynaklar: Vec<Value> = liste["kaynaklar"]
    .as_array()
    .cloned()
    .unwrap_or_default()
    .into_iter()
    .map(|mut x| {
      let id = x["id"].as_str().unwrap_or("").to_string();
      if let Some(k) = o.koleksiyon.kaynaklar.iter().find(|r| r.id == id) {
        x["ad"] = json!(k.ad);
        x["tur"] = json!(k.tur);
        x["obsTuru"] = json!(k.obs_turu);
        x["filtre"] = json!(k.filtreler.len());
        x["sahnede"] = json!(o.koleksiyon.kullanim_sayisi(&id) > 0);
      }
      if let Some(d) = durumlar["kaynaklar"].as_array().and_then(|a| a.iter().find(|d| d["id"] == id.as_str())) {
        x["etkin"] = d["etkin"].clone();
        x["goruntu"] = d["goruntu"].clone();
      }
      x
    })
    .collect();
  Ok(Json(json!({
    "kaynaklar": kaynaklar,
    "izlemeAygitlari": izleme["aygitlar"],
    "izlemeSecili": izleme["secili"],
    "izAdlari": o.profil.iz_adlari,
    "ciftSes": cift_ses_uyarilari(&o.koleksiyon),
  })))
}

#[derive(Deserialize)]
struct SesGovdesi {
  id: String,
  eylem: String,
  deger: Value,
}

fn kayda_isle(state: &AppState, id: &str, f: impl FnOnce(&mut KaynakKaydi)) {
  if let Some(k) = state.motor.ozet().lock().koleksiyon.kaynak(id) {
    f(k);
  }
}

/// Ses ayarını uygular ve koleksiyona işler. Ses çarpanı 0–20 (+26 dB, OBS'in üst sınırı), senkron −950…20000 ms
/// (OBS'in aralığı), izleme 0 kapalı / 1 yalnız izle / 2 izle ve çıkışa ver.
pub(crate) async fn ses_ayarla(state: &AppState, id: &str, eylem: &str, deger: &Value) -> Result<(), Hata> {
  motor_calisiyor(state).await?;
  if !state.motor.ozet().lock().koleksiyon.kaynaklar.iter().any(|k| k.id == id && !k.eksik) {
    return Err(bulunamadi("kaynak yok".into()));
  }
  let sayi = || deger.as_f64().filter(|x| x.is_finite()).ok_or_else(|| gecersiz("'deger' sayı olmalı".into()));
  let mantik = || deger.as_bool().ok_or_else(|| gecersiz("'deger' true/false olmalı".into()));
  match eylem {
    "ses" => {
      let c = sayi()?;
      if !(0.0..=20.0).contains(&c) {
        return Err(gecersiz("ses çarpanı 0–20 olmalı".into()));
      }
      komut(state, json!({"komut": "kaynak.ses", "id": id, "carpan": c})).await?;
      kayda_isle(state, id, |k| k.ses.ses = c as f32);
    }
    "sessiz" => {
      let b = mantik()?;
      komut(state, json!({"komut": "kaynak.sessiz", "id": id, "sessiz": b})).await?;
      kayda_isle(state, id, |k| k.ses.sessiz = b);
    }
    "denge" => {
      let d = sayi()?;
      if !(0.0..=1.0).contains(&d) {
        return Err(gecersiz("denge 0–1 olmalı".into()));
      }
      komut(state, json!({"komut": "kaynak.denge", "id": id, "deger": d})).await?;
      kayda_isle(state, id, |k| k.ses.denge = d as f32);
    }
    "mono" => {
      let b = mantik()?;
      komut(state, json!({"komut": "kaynak.mono", "id": id, "acik": b})).await?;
      kayda_isle(state, id, |k| k.ses.mono = b);
    }
    "senkron" => {
      let ms = sayi()? as i64;
      if !(-950..=20_000).contains(&ms) {
        return Err(gecersiz("senkron kaydırma −950…20000 ms olmalı".into()));
      }
      komut(state, json!({"komut": "kaynak.senkron", "id": id, "ms": ms})).await?;
      kayda_isle(state, id, |k| k.ses.senkron_ms = ms);
    }
    "izleme" => {
      let t = deger.as_i64().filter(|t| (0..=2).contains(t)).ok_or_else(|| gecersiz("izleme 0, 1 ya da 2 olmalı".into()))?;
      komut(state, json!({"komut": "kaynak.izleme", "id": id, "tur": t})).await?;
      kayda_isle(state, id, |k| k.ses.izleme = t as i32);
    }
    "izler" => {
      let m = deger.as_u64().filter(|m| *m <= 0x3F).ok_or_else(|| gecersiz("iz maskesi 0–63 olmalı".into()))? as u32;
      komut(state, json!({"komut": "kaynak.izler", "id": id, "maske": m})).await?;
      kayda_isle(state, id, |k| k.izler = m);
    }
    e => return Err(gecersiz(format!("bilinmeyen ses eylemi: {e}"))),
  }
  koleksiyonu_yaz(state)
}

async fn api_ses_ayarla(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<SesGovdesi>,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, "audio.control").await?;
  ses_ayarla(&state, &g.id, &g.eylem, &g.deger).await?;
  audit(&state, &actor, "MOTOR_AUDIO", json!({"id": g.id, "eylem": g.eylem, "deger": g.deger})).await;
  Ok(Json(json!({"ok": true})))
}

#[derive(Deserialize)]
struct IzlemeGovdesi {
  id: String,
  ad: String,
}

async fn api_izleme_aygiti(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<IzlemeGovdesi>,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, "audio.control").await?;
  motor_calisiyor(&state).await?;
  if g.id.len() > 512 || g.ad.len() > 256 || g.id.chars().chain(g.ad.chars()).any(char::is_control) {
    return Err(gecersiz("geçersiz aygıt".into()));
  }
  komut(&state, json!({"komut": "izleme.aygit", "id": g.id, "ad": g.ad})).await?;
  audit(&state, &actor, "MOTOR_MONITOR_DEVICE", json!({"ad": g.ad})).await;
  Ok(Json(json!({"ok": true})))
}

#[derive(Deserialize)]
struct CiftSesGovdesi {
  uygulama: String,
  masaustu: String,
  /// ikisini-tut | masaustunu-kapat
  karar: String,
}

async fn api_cift_ses(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<CiftSesGovdesi>,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, "audio.control").await?;
  motor_calisiyor(&state).await?;
  match g.karar.as_str() {
    "ikisini-tut" => {
      {
        let o = state.motor.ozet();
        let mut o = o.lock();
        let anahtar = format!("{}|{}", g.uygulama, g.masaustu);
        if !o.koleksiyon.cift_ses_tut.contains(&anahtar) {
          o.koleksiyon.cift_ses_tut.push(anahtar);
        }
      }
      koleksiyonu_yaz(&state)?;
    }
    "masaustunu-kapat" => {
      ses_ayarla(&state, &g.masaustu, "sessiz", &json!(true)).await?;
    }
    e => return Err(gecersiz(format!("bilinmeyen karar: {e}"))),
  }
  audit(&state, &actor, "MOTOR_DUPLICATE_AUDIO", json!({"uygulama": g.uygulama, "masaustu": g.masaustu, "karar": g.karar})).await;
  Ok(Json(json!({"ok": true})))
}

// ─── Filtreler ─────────────────────────────────────────────────────────────

async fn api_filtre_turleri(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
) -> ApiResult {
  authorize(&state, &addr, &headers, "broadcast.read").await?;
  motor_calisiyor(&state).await?;
  Ok(Json(komut(&state, json!({"komut": "filtre.turleri"})).await?))
}

#[derive(Deserialize)]
struct KaynakSorgusu {
  kaynak: String,
}

async fn api_filtreler(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Query(q): Query<KaynakSorgusu>,
) -> ApiResult {
  authorize(&state, &addr, &headers, "broadcast.read").await?;
  motor_calisiyor(&state).await?;
  let motor = komut(&state, json!({"komut": "filtre.listesi", "kaynak": q.kaynak})).await?;
  // Motorda kurulamamış (türü olmayan) filtreler de kayıttan gösterilir
  let kayit: Vec<FiltreKaydi> = state.motor.ozet().lock().koleksiyon.kaynaklar.iter().find(|k| k.id == q.kaynak).map(|k| k.filtreler.clone()).unwrap_or_default();
  let motordakiler = motor["filtreler"].as_array().cloned().unwrap_or_default();
  let eksik: Vec<Value> = kayit
    .iter()
    .filter(|f| !motordakiler.iter().any(|m| m["id"] == f.id.as_str()))
    .map(|f| json!({"id": f.id, "tur": f.tur, "ad": f.ad, "etkin": f.etkin, "eksik": true}))
    .collect();
  Ok(Json(json!({"filtreler": motordakiler, "eksikler": eksik})))
}

#[derive(Deserialize)]
struct FiltreGovdesi {
  eylem: String,
  #[serde(default)]
  id: Option<String>,
  #[serde(default)]
  kaynak: Option<String>,
  #[serde(default)]
  tur: Option<String>,
  #[serde(default)]
  ad: Option<String>,
  #[serde(default)]
  ayarlar: Option<Map<String, Value>>,
  #[serde(default)]
  yon: Option<String>,
  #[serde(default)]
  acik: Option<bool>,
}

/// Filtrenin sahibi kaynak (kayıttan)
fn filtre_sahibi(k: &crate::motor_koleksiyon::Koleksiyon, fid: &str) -> Option<String> {
  k.kaynaklar.iter().find(|x| x.filtreler.iter().any(|f| f.id == fid)).map(|x| x.id.clone())
}

async fn api_filtre(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<FiltreGovdesi>,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, "scene.edit").await?;
  motor_calisiyor(&state).await?;
  let fid = || g.id.clone().ok_or_else(|| gecersiz("'id' gerekli".into()));
  let sahip = |fid: &str| filtre_sahibi(&state.motor.ozet().lock().koleksiyon, fid).ok_or_else(|| bulunamadi("filtre yok".into()));
  let mut sonuc = json!({"ok": true});
  match g.eylem.as_str() {
    "ekle" => {
      let kaynak = g.kaynak.clone().ok_or_else(|| gecersiz("'kaynak' gerekli".into()))?;
      let tur = g.tur.clone().ok_or_else(|| gecersiz("'tur' gerekli".into()))?;
      let ad: String = g.ad.clone().unwrap_or_else(|| tur.clone()).trim().chars().filter(|c| !c.is_control()).take(80).collect();
      let ayarlar = Value::Object(g.ayarlar.clone().unwrap_or_default());
      if ayarlar.to_string().len() > 32 * 1024 {
        return Err(gecersiz("ayarlar çok büyük".into()));
      }
      let yeni = {
        let o = state.motor.ozet();
        let mut o = o.lock();
        if !o.koleksiyon.kaynaklar.iter().any(|k| k.id == kaynak && !k.eksik) {
          return Err(bulunamadi("kaynak yok".into()));
        }
        o.koleksiyon.yeni_kimlik("f")
      };
      komut(&state, json!({"komut": "filtre.ekle", "kaynak": kaynak, "id": yeni, "tur": tur, "ad": ad, "ayarlar": ayarlar})).await?;
      if let Some(k) = state.motor.ozet().lock().koleksiyon.kaynak(&kaynak) {
        k.filtreler.push(FiltreKaydi { id: yeni.clone(), tur, ad, etkin: true, ayarlar });
      }
      sonuc["id"] = json!(yeni);
    }
    "sil" => {
      let id = fid()?;
      let k = sahip(&id)?;
      komut(&state, json!({"komut": "filtre.sil", "id": id})).await?;
      if let Some(x) = state.motor.ozet().lock().koleksiyon.kaynak(&k) {
        x.filtreler.retain(|f| f.id != id);
      }
    }
    "sira" => {
      let id = fid()?;
      let k = sahip(&id)?;
      let yon = g.yon.clone().ok_or_else(|| gecersiz("'yon' gerekli".into()))?;
      komut(&state, json!({"komut": "filtre.sira", "id": id, "yon": yon})).await?;
      // Motorun gerçek sırası kayda yansıtılır
      let liste = komut(&state, json!({"komut": "filtre.listesi", "kaynak": k})).await?;
      let sira: Vec<String> = liste["filtreler"].as_array().into_iter().flatten().filter_map(|f| f["id"].as_str().map(String::from)).collect();
      if let Some(x) = state.motor.ozet().lock().koleksiyon.kaynak(&k) {
        x.filtreler.sort_by_key(|f| sira.iter().position(|s| s == &f.id).unwrap_or(usize::MAX));
      }
    }
    "etkin" => {
      let id = fid()?;
      let k = sahip(&id)?;
      let acik = g.acik.ok_or_else(|| gecersiz("'acik' gerekli".into()))?;
      komut(&state, json!({"komut": "filtre.etkin", "id": id, "acik": acik})).await?;
      if let Some(f) = state.motor.ozet().lock().koleksiyon.kaynak(&k).and_then(|x| x.filtreler.iter_mut().find(|f| f.id == id)) {
        f.etkin = acik;
      }
    }
    "adlandir" => {
      let id = fid()?;
      let k = sahip(&id)?;
      let ad: String = g.ad.clone().unwrap_or_default().trim().chars().filter(|c| !c.is_control()).take(80).collect();
      if ad.is_empty() {
        return Err(gecersiz("ad boş olamaz".into()));
      }
      komut(&state, json!({"komut": "filtre.adlandir", "id": id, "ad": ad})).await?;
      if let Some(f) = state.motor.ozet().lock().koleksiyon.kaynak(&k).and_then(|x| x.filtreler.iter_mut().find(|f| f.id == id)) {
        f.ad = ad;
      }
    }
    "guncelle" => {
      let id = fid()?;
      let k = sahip(&id)?;
      let ayarlar = g.ayarlar.clone().ok_or_else(|| gecersiz("'ayarlar' gerekli".into()))?;
      if Value::Object(ayarlar.clone()).to_string().len() > 32 * 1024 {
        return Err(gecersiz("ayarlar çok büyük".into()));
      }
      komut(&state, json!({"komut": "filtre.guncelle", "id": id, "ayarlar": ayarlar})).await?;
      if let Some(f) = state.motor.ozet().lock().koleksiyon.kaynak(&k).and_then(|x| x.filtreler.iter_mut().find(|f| f.id == id)) {
        if !f.ayarlar.is_object() {
          f.ayarlar = json!({});
        }
        if let Some(m) = f.ayarlar.as_object_mut() {
          for (a, v) in ayarlar {
            m.insert(a, v);
          }
        }
      }
    }
    e => return Err(gecersiz(format!("bilinmeyen eylem: {e}"))),
  }
  koleksiyonu_yaz(&state)?;
  audit(&state, &actor, "MOTOR_FILTER", json!({"eylem": g.eylem, "id": g.id.clone().or_else(|| sonuc["id"].as_str().map(String::from)), "tur": g.tur})).await;
  Ok(Json(sonuc))
}

#[derive(Deserialize)]
struct IdSorgusu {
  id: String,
}

async fn api_filtre_ozellikleri(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Query(q): Query<IdSorgusu>,
) -> ApiResult {
  authorize(&state, &addr, &headers, "broadcast.read").await?;
  motor_calisiyor(&state).await?;
  Ok(Json(komut(&state, json!({"komut": "filtre.ozellikler", "id": q.id})).await?))
}

// ─── Medya, durumlar, tür özellikleri ──────────────────────────────────────

#[derive(Deserialize)]
struct MedyaGovdesi {
  id: String,
  eylem: String,
}

pub(crate) async fn medya(state: &AppState, id: &str, eylem: &str) -> Result<(), Hata> {
  motor_calisiyor(state).await?;
  if !matches!(eylem, "oynat" | "duraklat" | "yeniden" | "durdur") {
    return Err(gecersiz(format!("bilinmeyen medya eylemi: {eylem}")));
  }
  komut(state, json!({"komut": "medya", "id": id, "eylem": eylem})).await?;
  Ok(())
}

async fn api_medya(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<MedyaGovdesi>,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, "scene.switch").await?;
  medya(&state, &g.id, &g.eylem).await?;
  audit(&state, &actor, "MOTOR_MEDIA", json!({"id": g.id, "eylem": g.eylem})).await;
  Ok(Json(json!({"ok": true})))
}

async fn api_kaynak_durumlari(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
) -> ApiResult {
  authorize(&state, &addr, &headers, "broadcast.read").await?;
  motor_calisiyor(&state).await?;
  Ok(Json(komut(&state, json!({"komut": "kaynak.durumlari"})).await?))
}

#[derive(Deserialize)]
struct TurSorgusu {
  tur: String,
}

/// Kaynak türünün özellik formu ve varsayılanları (örnek oluşturmadan). Pencere/aygıt listeleri içerebilir →
/// düzenleme yetkisi ister.
async fn api_tur_ozellikleri(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Query(q): Query<TurSorgusu>,
) -> ApiResult {
  authorize(&state, &addr, &headers, "scene.edit").await?;
  motor_calisiyor(&state).await?;
  if q.tur.is_empty() || q.tur.len() > 64 || !q.tur.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_') {
    return Err(gecersiz("geçersiz tür".into()));
  }
  match q.tur.as_str() {
    "browser_source" => modul_grubu_yukle(&state, "tarayici").await?,
    t if t.starts_with("wasapi_") || t.ends_with("_capture") || t == "dshow_input" => modul_grubu_yukle(&state, "yakalama").await?,
    _ => {}
  }
  Ok(Json(komut(&state, json!({"komut": "kaynak.tur_ozellikleri", "tur": q.tur})).await?))
}

// ─── Canlı akış (WebSocket) ────────────────────────────────────────────────

/// `/ws/motor`: ses seviyeleri ve önizleme kareleri. Yalnız bu bilgisayardan (loopback): kareler ekran görüntüsüdür.
/// İstemci mesajları: `{"seviye": true|false}`, `{"kare": {"tuval": "ana", "genislik": 640, "fps": 10}}` ya da
/// `{"kare": null}`. Motor ancak en az bir abone varken seviye/kare üretir.
async fn ws_motor(ws: WebSocketUpgrade, State(state): State<Arc<AppState>>, ConnectInfo(addr): ConnectInfo<SocketAddr>) -> Response {
  if !addr.ip().is_loopback() {
    return (StatusCode::FORBIDDEN, "canlı motor akışı yalnız yerel").into_response();
  }
  ws.on_upgrade(move |s| motor_ws(s, state))
}

#[derive(Default, Clone, PartialEq, Debug)]
struct Abonelik {
  seviye: bool,
  kare: Option<(String, u32, u32)>,
}

async fn abone_ol(state: &AppState, a: &Abonelik) {
  if a.seviye {
    let ilk = {
      let o = state.motor.ozet();
      let mut o = o.lock();
      o.seviye_abonesi += 1;
      o.seviye_abonesi == 1
    };
    if ilk {
      let _ = state.motor.komut(json!({"komut": "seviye.abone", "acik": true})).await;
    }
  }
  if let Some((t, g, f)) = &a.kare {
    state.motor.ozet().lock().kare_abonesi.entry(t.clone()).and_modify(|n| *n += 1).or_insert(1);
    // Son abonenin boyutu/hızı geçerli (motor tuval başına tek akış tutar)
    let _ = state.motor.komut(json!({"komut": "akis.baslat", "tuval": t, "genislik": g, "fps": f})).await;
  }
}

async fn abonelikten_cik(state: &AppState, a: &Abonelik) {
  if a.seviye {
    let son = {
      let o = state.motor.ozet();
      let mut o = o.lock();
      o.seviye_abonesi = o.seviye_abonesi.saturating_sub(1);
      o.seviye_abonesi == 0
    };
    if son {
      let _ = state.motor.komut(json!({"komut": "seviye.abone", "acik": false})).await;
    }
  }
  if let Some((t, _, _)) = &a.kare {
    let son = {
      let o = state.motor.ozet();
      let mut o = o.lock();
      let n = o.kare_abonesi.entry(t.clone()).or_insert(1);
      *n = n.saturating_sub(1);
      *n == 0
    };
    if son {
      let _ = state.motor.komut(json!({"komut": "akis.durdur", "tuval": t})).await;
    }
  }
}

/// İstemci mesajını aboneliğe çevirir (geçersiz alanlar yok sayılır)
fn abonelik_isle(onceki: &Abonelik, m: &str) -> Abonelik {
  let mut a = onceki.clone();
  let Ok(v) = serde_json::from_str::<Value>(m) else { return a };
  if let Some(b) = v.get("seviye").and_then(Value::as_bool) {
    a.seviye = b;
  }
  if let Some(k) = v.get("kare") {
    a.kare = k.as_object().and_then(|k| {
      let t = k.get("tuval")?.as_str()?.to_string();
      tuval_boyutu(t.strip_prefix("studyo-").unwrap_or(&t))?;
      let g = k.get("genislik").and_then(Value::as_u64).unwrap_or(640).clamp(160, 1280) as u32;
      let f = k.get("fps").and_then(Value::as_u64).unwrap_or(10).clamp(1, 15) as u32;
      Some((t, g, f))
    });
  }
  a
}

/// Kare satırının tuvali: `{"olay":"kare","tuval":"ana",…`
fn kare_tuvali(satir: &str) -> Option<&str> {
  let geri = satir.strip_prefix(r#"{"olay":"kare","tuval":""#)?;
  geri.split('"').next()
}

async fn motor_ws(socket: WebSocket, state: Arc<AppState>) {
  let (mut gonder, mut al) = socket.split();
  let mut olaylar = state.motor.canli_abone();
  let mut abonelik = Abonelik::default();
  let mut oturum = state.motor.oturum();
  let mut tik = tokio::time::interval(std::time::Duration::from_secs(2));
  loop {
    tokio::select! {
      m = al.next() => match m {
        Some(Ok(Message::Text(t))) => {
          let yeni = abonelik_isle(&abonelik, &t);
          if yeni != abonelik {
            abonelikten_cik(&state, &abonelik).await;
            abone_ol(&state, &yeni).await;
            abonelik = yeni;
          }
        }
        Some(Ok(Message::Close(_))) | None | Some(Err(_)) => break,
        _ => {}
      },
      o = olaylar.recv() => match o {
        Ok(satir) => {
          let gerekli = if satir.starts_with(r#"{"olay":"seviyeler""#) {
            abonelik.seviye
          } else {
            kare_tuvali(&satir).is_some_and(|t| abonelik.kare.as_ref().is_some_and(|(k, _, _)| k == t))
          };
          if gerekli && gonder.send(Message::Text(satir.to_string().into())).await.is_err() {
            break;
          }
        }
        Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
        Err(_) => break,
      },
      _ = tik.tick() => {
        // Motor yeniden başladıysa (sayaçlar sıfırlandı) abonelik yenilenir
        let simdi = state.motor.oturum();
        if simdi != oturum {
          oturum = simdi;
          abone_ol(&state, &abonelik).await;
        }
      }
    }
  }
  abonelikten_cik(&state, &abonelik).await;
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::motor_koleksiyon::{Koleksiyon, OgeTuru, SahneOgesi};

  #[test]
  fn abonelik_ve_kare_tuvali() {
    let a = abonelik_isle(&Abonelik::default(), r#"{"seviye": true, "kare": {"tuval": "studyo-ana", "genislik": 5000, "fps": 99}}"#);
    assert!(a.seviye);
    assert_eq!(a.kare, Some(("studyo-ana".into(), 1280, 15)));
    assert_eq!(abonelik_isle(&a, r#"{"kare": {"tuval": "yan"}}"#).kare, None, "bilinmeyen tuval");
    assert_eq!(abonelik_isle(&a, r#"{"kare": null}"#).kare, None);
    assert_eq!(abonelik_isle(&a, "bozuk"), a);
    assert_eq!(kare_tuvali(r#"{"olay":"kare","tuval":"dikey","jpeg":"..."}"#), Some("dikey"));
    assert_eq!(kare_tuvali(r#"{"olay":"seviyeler"}"#), None);
  }

  #[test]
  fn cift_ses_uyarisi() {
    let mut k = Koleksiyon::bos("A", false, 60);
    let mut oyun = KaynakKaydi::yeni("o", "oyun", "game_capture", "Oyun", json!({"capture_audio": true}));
    oyun.izler = 0b11;
    let mut masa = KaynakKaydi::yeni("m", "masaustu", "wasapi_output_capture", "Masaüstü", json!({}));
    masa.izler = 0b10;
    k.kaynaklar = vec![oyun, masa];
    let s = k.sahneler[0].id.clone();
    k.sahne(&s).unwrap().ogeler.push(SahneOgesi { kaynak: "o".into(), tur: OgeTuru::Kaynak, ad: String::new(), donusum: Default::default(), cocuklar: vec![] });
    let u = cift_ses_uyarilari(&k);
    assert_eq!(u.len(), 1);
    assert_eq!(u[0]["izler"], json!([2]));
    // Ortak iz yoksa uyarı yok; "ikisini de tut" denmişse yok; sesi yakalanmıyorsa yok
    k.kaynak("m").unwrap().izler = 0b100;
    assert!(cift_ses_uyarilari(&k).is_empty());
    k.kaynak("m").unwrap().izler = 0b10;
    k.cift_ses_tut.push("o|m".into());
    assert!(cift_ses_uyarilari(&k).is_empty());
    k.cift_ses_tut.clear();
    k.kaynak("o").unwrap().ayarlar = json!({"capture_audio": false});
    assert!(cift_ses_uyarilari(&k).is_empty());
  }
}
