//! Motor sahneleri: sahne listesi, sahne işlemleri (oluştur, adlandır, çoğalt, sil, sırala, geçiş geçersiz kılma),
//! program sahnesine geçiş, geçişler, Studio Mode, sahne öğeleri (sıra, dönüşüm, gruplar) ve kaynak işlemleri
//! (adlandır, çoğalt). Her uç: izin → yürütme → koleksiyona yazma → denetim günlüğü.

use std::collections::HashSet;
use std::net::SocketAddr;
use std::sync::Arc;

use axum::extract::{ConnectInfo, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Map, Value};

use super::control_plane::{audit, authorize};
use super::motor_api::{
  catisma, filtreleri_kur, gecersiz, kaydet, kaydet_sahneler, kaynak_kur, klasor, komut, koleksiyonu_yaz, motor_calisiyor, oge_kur,
  tuval_boyutu,
};
use crate::motor_koleksiyon::{self as kol, Donusum, GecisKaydi, KaynakKaydi, OgeTuru, Okuma, SahneKaydi, SahneOgesi};
use crate::AppState;

type ApiResult = Result<Json<Value>, (StatusCode, String)>;
type Hata = (StatusCode, String);

pub fn router() -> Router<Arc<AppState>> {
  Router::new()
    .route("/api/motor/sahneler", get(api_sahneler))
    .route("/api/motor/sahne-islem", post(api_sahne_islem))
    .route("/api/motor/program", post(api_program))
    .route("/api/motor/gecis", get(api_gecis).post(api_gecis_ayarla))
    .route("/api/motor/gecis/ozellikler", get(api_gecis_ozellikleri))
    .route("/api/motor/gecis/guncelle", post(api_gecis_guncelle))
    .route("/api/motor/studyo", post(api_studyo))
    .route("/api/motor/gecis-listesi", post(api_gecis_listesi))
    .route("/api/motor/multiview", post(api_multiview))
    .route("/api/motor/kaynak-tuvali", post(api_kaynak_tuvali))
    .route("/api/motor/oge", post(api_oge))
    .route("/api/motor/kaynak-islem", post(api_kaynak_islem))
    .route("/api/motor/tuval", post(api_tuval))
}

pub const VARSAYILAN_GECIS: &str = "fade_transition";
pub const VARSAYILAN_SURE_MS: u32 = 300;

fn bulunamadi(e: String) -> Hata {
  (StatusCode::NOT_FOUND, e)
}

/// Sahne adı: boş değil, denetim karakteri yok, en çok 80 karakter
fn ad_temizle(ad: &str) -> Result<String, Hata> {
  let a: String = ad.trim().chars().filter(|c| !c.is_control()).take(80).collect();
  if a.is_empty() {
    return Err(gecersiz("ad boş olamaz".into()));
  }
  Ok(a)
}

fn gecis_dogrula(g: &GecisKaydi) -> Result<(), Hata> {
  if g.tur.is_empty() || g.tur.len() > 64 || !g.tur.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_') {
    return Err(gecersiz("geçersiz geçiş türü".into()));
  }
  if g.sure_ms > 20_000 {
    return Err(gecersiz("geçiş süresi en çok 20 sn".into()));
  }
  Ok(())
}

/// Öğe kimliğinin sahnesi: `sahne/kaynak#2` → `sahne`
fn oge_sahnesi(oge: &str) -> &str {
  oge.rsplit_once('/').map_or("", |(s, _)| s)
}

// ─── Sahne listesi ─────────────────────────────────────────────────────────

async fn api_sahneler(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
) -> ApiResult {
  authorize(&state, &addr, &headers, "broadcast.read").await?;
  let calisiyor = state.motor.calisiyor().await;
  let dizin = klasor(&state);
  let k = if calisiyor {
    Some(state.motor.ozet().lock().koleksiyon.clone())
  } else {
    match kol::oku(&dizin) {
      Okuma::Tamam(k) => Some(*k),
      _ => None,
    }
  };
  let turler = if calisiyor { komut(&state, json!({"komut": "gecis.turleri"})).await.map(|v| v["turler"].clone()).unwrap_or(Value::Null) } else { Value::Null };
  let studyo: Map<String, Value> = if calisiyor {
    state.motor.ozet().lock().studyo.iter().map(|(t, s)| (t.clone(), json!(s))).collect()
  } else {
    Map::new()
  };
  let Some(k) = k else {
    return Ok(Json(json!({"calisiyor": calisiyor, "sahneler": [], "program": {}, "studyo": studyo, "gecisler": {}, "gecisTurleri": turler})));
  };
  let sahneler: Vec<Value> = k
    .sahneler
    .iter()
    .map(|s| json!({"id": s.id, "ad": s.ad, "tuval": s.tuval, "ogeSayisi": s.ogeler.len(), "gecis": s.gecis, "etkinTuval": k.tuval_etkin(&s.tuval), "multiview": !s.multiview_gizli, "bagli": s.bagli}))
    .collect();
  let gecisler: Map<String, Value> = k
    .tuvaller()
    .iter()
    .map(|t| {
      let g = k.gecisler.get(t).cloned().unwrap_or(GecisKaydi { tur: VARSAYILAN_GECIS.into(), sure_ms: VARSAYILAN_SURE_MS, ayarlar: Value::Null });
      ((*t).to_string(), json!({"tur": g.tur, "sure_ms": g.sure_ms}))
    })
    .collect();
  Ok(Json(json!({
    "calisiyor": calisiyor,
    "koleksiyon": {"id": kol::etkin_kimlik(&dizin), "ad": k.ad},
    "sahneler": sahneler,
    "program": k.program,
    "studyo": studyo,
    "gecisler": gecisler,
    "gecisTurleri": turler,
    "dikey": k.dikey,
    "tuvaller": tuval_listesi(&k, &state),
    "adliGecisler": adli_gecis_listesi(&k),
    "hizliGecisler": k.hizli_gecisler,
    "seciliGecis": k.secili_gecis,
  })))
}

// ─── Sahne işlemleri ───────────────────────────────────────────────────────

#[derive(Deserialize)]
struct SahneIslemi {
  eylem: String,
  #[serde(default)]
  id: Option<String>,
  #[serde(default)]
  ad: Option<String>,
  #[serde(default)]
  tuval: Option<String>,
  #[serde(default)]
  sira: Option<Vec<String>>,
  /// `gecis` eylemi: geçiş geçersiz kılma (null = kaldır)
  #[serde(default)]
  gecis: Option<GecisKaydi>,
  /// `multiview` eylemi: sahne Multiview'da gösterilsin mi
  #[serde(default)]
  acik: Option<bool>,
  /// `bagla` eylemi: diğer tuvaldeki bağlı sahne (null/yok = bağı kaldır)
  #[serde(default)]
  hedef: Option<String>,
}

/// Grup kimliklerini (çoğaltılan sahnede) yeniler
/// Çoğaltılan öğelerde grup ve grup filtresi kimlikleri yenilenir (kimlikler koleksiyonda benzersiz)
fn gruplari_yenile(ogeler: &mut [SahneOgesi], k: &mut kol::Koleksiyon) {
  for o in ogeler.iter_mut() {
    if o.tur == OgeTuru::Grup {
      o.kaynak = k.yeni_kimlik("g");
      for f in &mut o.filtreler {
        f.id = k.yeni_kimlik("f");
      }
    }
  }
}

async fn api_sahne_islem(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<SahneIslemi>,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, "scene.edit").await?;
  motor_calisiyor(&state).await?;
  let id = || g.id.clone().ok_or_else(|| gecersiz("'id' gerekli".into()));
  let sonuc = match g.eylem.as_str() {
    "olustur" => {
      let tuval = g.tuval.clone().unwrap_or_else(|| "ana".into());
      tuval_boyutu(&tuval).ok_or_else(|| gecersiz(format!("tuval yok: {tuval}")))?;
      let ad = ad_temizle(g.ad.as_deref().unwrap_or("Sahne"))?;
      let yeni = {
        let o = state.motor.ozet();
        let mut o = o.lock();
        if !o.koleksiyon.tuval_etkin(&tuval) {
          return Err(gecersiz(format!("tuval etkin değil: {tuval}")));
        }
        o.koleksiyon.yeni_kimlik("s")
      };
      komut(&state, json!({"komut": "sahne.olustur", "id": yeni, "tuval": tuval, "ad": ad})).await?;
      state.motor.ozet().lock().koleksiyon.sahneler.push(SahneKaydi { id: yeni.clone(), ad, tuval, ogeler: Vec::new(), gecis: None, ..Default::default() });
      koleksiyonu_yaz(&state)?;
      json!({"id": yeni})
    }
    "adlandir" => {
      let id = id()?;
      let ad = ad_temizle(g.ad.as_deref().unwrap_or(""))?;
      komut(&state, json!({"komut": "sahne.adlandir", "id": id, "ad": ad})).await?;
      state.motor.ozet().lock().koleksiyon.sahne(&id).ok_or_else(|| bulunamadi("sahne yok".into()))?.ad = ad;
      koleksiyonu_yaz(&state)?;
      json!({})
    }
    "sil" => {
      let id = id()?;
      let (tuval, program) = {
        let o = state.motor.ozet();
        let o = o.lock();
        let s = o.koleksiyon.sahne_ref(&id).ok_or_else(|| bulunamadi("sahne yok".into()))?;
        if o.koleksiyon.sahneler.iter().filter(|x| x.tuval == s.tuval).count() <= 1 {
          return Err(catisma("tuvalin son sahnesi silinemez".into()));
        }
        (s.tuval.clone(), o.koleksiyon.program.get(&s.tuval).cloned())
      };
      if program.as_deref() == Some(id.as_str()) {
        return Err(catisma("programdaki sahne silinemez; önce başka bir sahneye geçin".into()));
      }
      komut(&state, json!({"komut": "sahne.sil", "id": id})).await?;
      {
        let o = state.motor.ozet();
        let mut o = o.lock();
        o.koleksiyon.sahneler.retain(|s| s.id != id);
        for s in o.koleksiyon.sahneler.iter_mut().filter(|s| s.bagli.as_deref() == Some(id.as_str())) {
          s.bagli = None;
        }
        if o.studyo.get(&tuval).and_then(|x| x.as_deref()) == Some(id.as_str()) {
          o.studyo.insert(tuval.clone(), None);
        }
      }
      // Bu sahneyi kaynak olarak kullanan öğeler motorda da kalktı: tüm sahneler eşitlenir
      kaydet(&state).await?;
      json!({})
    }
    "cogalt" => {
      let id = id()?;
      let (yeni, kayit) = {
        let o = state.motor.ozet();
        let mut o = o.lock();
        let kaynak = o.koleksiyon.sahne_ref(&id).cloned().ok_or_else(|| bulunamadi("sahne yok".into()))?;
        let yeni = o.koleksiyon.yeni_kimlik("s");
        let mut ogeler = kaynak.ogeler.clone();
        gruplari_yenile(&mut ogeler, &mut o.koleksiyon);
        let ad = match &g.ad {
          Some(a) => ad_temizle(a)?,
          None => format!("{} (kopya)", kaynak.ad).chars().take(80).collect(),
        };
        // Sahne filtreleri de çoğalır (OBS gibi), yeni kimliklerle
        let mut filtreler = kaynak.filtreler.clone();
        for f in &mut filtreler {
          f.id = o.koleksiyon.yeni_kimlik("f");
        }
        (yeni.clone(), SahneKaydi { id: yeni, ad, tuval: kaynak.tuval, ogeler, gecis: kaynak.gecis, filtreler, multiview_gizli: kaynak.multiview_gizli, bagli: None })
      };
      komut(&state, json!({"komut": "sahne.olustur", "id": yeni, "tuval": kayit.tuval, "ad": kayit.ad})).await?;
      filtreleri_kur(&state, &yeni, &kayit.filtreler).await?;
      let eksikler: HashSet<String> = state.motor.ozet().lock().koleksiyon.kaynaklar.iter().filter(|r| r.eksik).map(|r| r.id.clone()).collect();
      for o in &kayit.ogeler {
        oge_kur(&state, &yeni, o, &eksikler).await?;
      }
      state.motor.ozet().lock().koleksiyon.sahneler.push(kayit);
      kaydet_sahneler(&state, std::slice::from_ref(&yeni)).await?;
      json!({"id": yeni})
    }
    "sirala" => {
      let sira = g.sira.clone().ok_or_else(|| gecersiz("'sira' gerekli".into()))?;
      {
        let o = state.motor.ozet();
        let mut o = o.lock();
        let mut eski = std::mem::take(&mut o.koleksiyon.sahneler);
        let mut yeni = Vec::with_capacity(eski.len());
        for sid in &sira {
          if let Some(i) = eski.iter().position(|s| &s.id == sid) {
            yeni.push(eski.remove(i));
          }
        }
        yeni.extend(eski);
        o.koleksiyon.sahneler = yeni;
      }
      koleksiyonu_yaz(&state)?;
      json!({})
    }
    "bagla" => {
      let id = id()?;
      let o = state.motor.ozet();
      let mut o = o.lock();
      let tuval = o.koleksiyon.sahne_ref(&id).ok_or_else(|| bulunamadi("sahne yok".into()))?.tuval.clone();
      if let Some(h) = &g.hedef {
        let ht = o.koleksiyon.sahne_ref(h).ok_or_else(|| bulunamadi("bağlanacak sahne yok".into()))?.tuval.clone();
        if ht == tuval {
          return Err(gecersiz("bağlı sahne diğer tuvalde olmalı".into()));
        }
      }
      o.koleksiyon.sahne(&id).ok_or_else(|| bulunamadi("sahne yok".into()))?.bagli = g.hedef.clone();
      drop(o);
      koleksiyonu_yaz(&state)?;
      json!({"bagli": g.hedef})
    }
    "multiview" => {
      let id = id()?;
      let acik = g.acik.ok_or_else(|| gecersiz("'acik' gerekli".into()))?;
      state.motor.ozet().lock().koleksiyon.sahne(&id).ok_or_else(|| bulunamadi("sahne yok".into()))?.multiview_gizli = !acik;
      koleksiyonu_yaz(&state)?;
      json!({"acik": acik})
    }
    "gecis" => {
      let id = id()?;
      if let Some(gc) = &g.gecis {
        gecis_dogrula(gc)?;
      }
      state.motor.ozet().lock().koleksiyon.sahne(&id).ok_or_else(|| bulunamadi("sahne yok".into()))?.gecis = g.gecis.clone();
      koleksiyonu_yaz(&state)?;
      json!({})
    }
    e => return Err(gecersiz(format!("bilinmeyen eylem: {e}"))),
  };
  audit(&state, &actor, "MOTOR_SCENE_EDIT", json!({"eylem": g.eylem, "id": g.id.clone().or_else(|| sonuc["id"].as_str().map(String::from))})).await;
  Ok(Json(sonuc))
}

// ─── Program ve geçişler ───────────────────────────────────────────────────

#[derive(Deserialize)]
struct ProgramGovdesi {
  sahne: String,
  /// false: anında (kesme)
  #[serde(default = "dogru")]
  gecis: bool,
  #[serde(default)]
  sure_ms: Option<u32>,
}

fn dogru() -> bool {
  true
}

/// Sahneyi programa alır; sahnenin geçiş geçersiz kılması varsa o geçişle (bitince tuvalin geçişi geri gelir).
pub(crate) async fn programa_al(state: &AppState, sahne: &str, gecis: bool, sure_ms: Option<u32>) -> Result<String, Hata> {
  motor_calisiyor(state).await?;
  let (tuval, ozel, varsayilan) = {
    let o = state.motor.ozet();
    let o = o.lock();
    let s = o.koleksiyon.sahne_ref(sahne).ok_or_else(|| bulunamadi(format!("sahne yok: {sahne}")))?;
    if !o.koleksiyon.tuval_etkin(&s.tuval) {
      return Err(catisma("sahnenin tuvali etkin değil".into()));
    }
    (s.tuval.clone(), s.gecis.clone(), o.koleksiyon.gecisler.get(&s.tuval).cloned())
  };
  match (&ozel, gecis) {
    (Some(g), true) => {
      komut(state, json!({"komut": "gecis.ayarla", "tuval": tuval, "tur": g.tur, "sure_ms": g.sure_ms})).await?;
      komut(state, json!({"komut": "sahne.etkinlestir", "id": sahne, "gecis": true, "sure_ms": g.sure_ms})).await?;
      // Geçersiz kılma yalnız bu geçiş için: süre dolunca tuvalin geçişi geri yüklenir
      let geri = varsayilan.unwrap_or(GecisKaydi { tur: VARSAYILAN_GECIS.into(), sure_ms: VARSAYILAN_SURE_MS, ayarlar: Value::Null });
      let bekle = std::time::Duration::from_millis(g.sure_ms as u64 + 150);
      let motor = std::sync::Arc::clone(&state.motor);
      let tv = tuval.clone();
      tokio::spawn(async move {
        tokio::time::sleep(bekle).await;
        let mut istek = json!({"komut": "gecis.ayarla", "tuval": tv, "tur": geri.tur, "sure_ms": geri.sure_ms});
        if geri.ayarlar.is_object() {
          istek["ayarlar"] = geri.ayarlar;
        }
        let _ = motor.komut(istek).await;
      });
    }
    _ => {
      let mut istek = json!({"komut": "sahne.etkinlestir", "id": sahne, "gecis": gecis});
      if let Some(s) = sure_ms {
        istek["sure_ms"] = json!(s.min(20_000));
      }
      komut(state, istek).await?;
    }
  }
  state.motor.ozet().lock().koleksiyon.program.insert(tuval.clone(), sahne.to_string());
  koleksiyonu_yaz(state)?;
  bagli_esi_programa(state, sahne).await;
  Ok(tuval)
}

/// Bağlı sahne: eşi diğer tuvalde programda değilse o da geçişle programa alınır (tek atlama — döngü olmaz).
/// Diğer tuval kapalıysa ya da eş bulunamazsa sessizce geçilir; hata ana geçişi bozmaz.
pub(crate) async fn bagli_esi_programa(state: &AppState, sahne: &str) {
  let es = {
    let o = state.motor.ozet();
    let o = o.lock();
    o.koleksiyon
      .sahne_ref(sahne)
      .and_then(|s| s.bagli.clone())
      .filter(|b| o.koleksiyon.sahne_ref(b).is_some_and(|e| o.koleksiyon.tuval_etkin(&e.tuval) && o.koleksiyon.program.get(&e.tuval) != Some(b)))
  };
  let Some(es) = es else { return };
  let tuval = state.motor.ozet().lock().koleksiyon.sahne_ref(&es).map(|e| e.tuval.clone());
  if let Some(t) = tuval {
    if komut(state, json!({"komut": "sahne.etkinlestir", "id": es, "gecis": true})).await.is_ok() {
      state.motor.ozet().lock().koleksiyon.program.insert(t, es);
      let _ = koleksiyonu_yaz(state);
    }
  }
}

async fn api_program(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<ProgramGovdesi>,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, "scene.switch").await?;
  let tuval = programa_al(&state, &g.sahne, g.gecis, g.sure_ms).await?;
  audit(&state, &actor, "MOTOR_SCENE_SWITCH", json!({"sahne": g.sahne, "tuval": tuval, "gecis": g.gecis})).await;
  Ok(Json(json!({"ok": true, "tuval": tuval})))
}

#[derive(Deserialize)]
struct TuvalSorgusu {
  #[serde(default)]
  tuval: Option<String>,
}

fn tuval_al(t: Option<String>) -> Result<String, Hata> {
  let t = t.unwrap_or_else(|| "ana".into());
  tuval_boyutu(&t).ok_or_else(|| gecersiz(format!("tuval yok: {t}")))?;
  Ok(t)
}

/// Yerleşik + kullanıcı geçişleri (dock listesi sırası)
fn adli_gecis_listesi(k: &kol::Koleksiyon) -> Vec<Value> {
  kol::YERLESIK_GECISLER
    .iter()
    .map(|(id, ad, tur)| json!({"id": id, "ad": ad, "tur": tur, "yerlesik": true}))
    .chain(k.adli_gecisler.iter().map(|g| json!({"id": g.id, "ad": g.ad, "tur": g.tur, "yerlesik": false})))
    .collect()
}

/// Hızlı geçiş (OBS Studio Mode "Quick Transitions"): önizleme verilen geçiş ve süreyle programa alınır; geçiş bitince
/// tuvalin kendi geçişi geri kurulur (dock'taki seçim değişmez). Çağrı, geçiş süresi + pay kadar bekleyip geri kurar.
pub(crate) async fn hizli_gecis(state: &AppState, tuval: &str, tur: &str, ayarlar: &Value, sure_ms: u32, onceki: Option<GecisKaydi>) -> Result<Value, Hata> {
  let mut istek = json!({"komut": "gecis.ayarla", "tuval": tuval, "tur": tur, "sure_ms": sure_ms});
  if ayarlar.is_object() {
    istek["ayarlar"] = ayarlar.clone();
  }
  komut(state, istek).await?;
  let sonuc = studyo_gecisi(state, tuval, false, Some(sure_ms)).await;
  if sonuc.is_ok() {
    tokio::time::sleep(std::time::Duration::from_millis(u64::from(sure_ms) + 250)).await;
  }
  let g = onceki.unwrap_or(GecisKaydi { tur: VARSAYILAN_GECIS.into(), sure_ms: VARSAYILAN_SURE_MS, ayarlar: Value::Null });
  let mut geri = json!({"komut": "gecis.ayarla", "tuval": tuval, "tur": g.tur, "sure_ms": g.sure_ms});
  if g.ayarlar.is_object() {
    geri["ayarlar"] = g.ayarlar;
  }
  let _ = komut(state, geri).await;
  sonuc.map(|program| json!({"program": program}))
}

/// Kısayol eylemi: adlandırılmış geçişi (ad ya da kimlik) hızlı geçiş olarak oynatır. Süre: bu geçiş için tanımlı ilk
/// hızlı geçiş düğmesininki, yoksa tuvalin süresi.
pub(crate) async fn hizli_gecis_adla(state: &AppState, gecis: &str) -> Result<Value, Hata> {
  motor_calisiyor(state).await?;
  let (tur, ayarlar, sure, onceki) = {
    let o = state.motor.ozet();
    let o = o.lock();
    let k = &o.koleksiyon;
    let id = kol::YERLESIK_GECISLER
      .iter()
      .find(|(i, ad, _)| *i == gecis || kol::ad_esit(ad, gecis))
      .map(|(i, _, _)| i.to_string())
      .or_else(|| k.adli_gecisler.iter().find(|g| g.id == gecis || kol::ad_esit(&g.ad, gecis)).map(|g| g.id.clone()))
      .ok_or_else(|| bulunamadi(format!("geçiş yok: {gecis}")))?;
    let (_, tur, ayarlar) = k.adli_gecis(&id).ok_or_else(|| bulunamadi("geçiş yok".into()))?;
    let sure = k.hizli_gecisler.iter().find(|h| h.gecis == id).map(|h| h.sure_ms).or_else(|| k.gecisler.get("ana").map(|g| g.sure_ms)).unwrap_or(VARSAYILAN_SURE_MS);
    (tur, ayarlar, sure, k.gecisler.get("ana").cloned())
  };
  hizli_gecis(state, "ana", &tur, &ayarlar, sure, onceki).await
}

#[derive(Deserialize)]
struct GecisListesiGovdesi {
  eylem: String,
  #[serde(default)]
  id: Option<String>,
  #[serde(default)]
  ad: Option<String>,
  #[serde(default)]
  tur: Option<String>,
  #[serde(default)]
  tuval: Option<String>,
  /// `hizli-ekle`: adlandırılmış geçiş kimliği
  #[serde(default)]
  gecis: Option<String>,
  #[serde(default)]
  sure_ms: Option<u32>,
}

/// Adlandırılmış geçişler ve hızlı geçişler: ekle, sil, adlandır, seç (tuvalin geçişi olur), hızlı ekle/sil
async fn api_gecis_listesi(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<GecisListesiGovdesi>,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, "scene.edit").await?;
  motor_calisiyor(&state).await?;
  let id = || g.id.clone().ok_or_else(|| gecersiz("kimlik gerekli".into()));
  let yerlesik = |id: &str| kol::YERLESIK_GECISLER.iter().any(|(y, _, _)| *y == id);
  let sonuc = match g.eylem.as_str() {
    "ekle" => {
      let ad = ad_temizle(g.ad.as_deref().unwrap_or(""))?;
      let tur = g.tur.clone().unwrap_or_default();
      gecis_dogrula(&GecisKaydi { tur: tur.clone(), sure_ms: 0, ayarlar: Value::Null })?;
      let turler = komut(&state, json!({"komut": "gecis.turleri"})).await?;
      if !turler["turler"].as_array().is_some_and(|a| a.iter().any(|t| t["id"] == tur.as_str())) {
        return Err(gecersiz(format!("geçiş türü bu motorda yok: {tur}")));
      }
      let o = state.motor.ozet();
      let mut o = o.lock();
      if o.koleksiyon.adli_gecisler.len() >= 64 {
        return Err(gecersiz("en çok 64 geçiş".into()));
      }
      let yeni = o.koleksiyon.yeni_kimlik("g");
      o.koleksiyon.adli_gecisler.push(kol::AdliGecis { id: yeni.clone(), ad, tur, ayarlar: Value::Null });
      json!({"id": yeni})
    }
    "sil" => {
      let id = id()?;
      if yerlesik(&id) {
        return Err(gecersiz("yerleşik geçiş kaldırılamaz".into()));
      }
      let o = state.motor.ozet();
      let mut o = o.lock();
      let n = o.koleksiyon.adli_gecisler.len();
      o.koleksiyon.adli_gecisler.retain(|a| a.id != id);
      if o.koleksiyon.adli_gecisler.len() == n {
        return Err(bulunamadi("geçiş yok".into()));
      }
      // Etkin geçiş olduğu gibi kalır (tür/ayar); yalnız liste bağı ve onu kullanan hızlı geçişler düşer
      o.koleksiyon.hizli_gecisler.retain(|h| h.gecis != id);
      o.koleksiyon.secili_gecis.retain(|_, v| *v != id);
      json!({})
    }
    "adlandir" => {
      let id = id()?;
      let ad = ad_temizle(g.ad.as_deref().unwrap_or(""))?;
      let o = state.motor.ozet();
      let mut o = o.lock();
      let a = o.koleksiyon.adli_gecisler.iter_mut().find(|a| a.id == id).ok_or_else(|| bulunamadi("geçiş yok (yerleşik geçişler adlandırılamaz)".into()))?;
      a.ad = ad;
      json!({})
    }
    "sec" => {
      let id = id()?;
      let tuval = tuval_al(g.tuval.clone())?;
      let (tur, ayarlar, sure) = {
        let o = state.motor.ozet();
        let o = o.lock();
        let (_, tur, ayarlar) = o.koleksiyon.adli_gecis(&id).ok_or_else(|| bulunamadi("geçiş yok".into()))?;
        (tur, ayarlar, o.koleksiyon.gecisler.get(&tuval).map_or(VARSAYILAN_SURE_MS, |p| p.sure_ms))
      };
      let mut istek = json!({"komut": "gecis.ayarla", "tuval": tuval, "tur": tur, "sure_ms": sure});
      if ayarlar.is_object() {
        istek["ayarlar"] = ayarlar.clone();
      }
      komut(&state, istek).await?;
      let o = state.motor.ozet();
      let mut o = o.lock();
      o.koleksiyon.gecisler.insert(tuval.clone(), GecisKaydi { tur, sure_ms: sure, ayarlar });
      o.koleksiyon.secili_gecis.insert(tuval, id);
      json!({})
    }
    "hizli-ekle" => {
      let gecis = g.gecis.clone().ok_or_else(|| gecersiz("geçiş gerekli".into()))?;
      let sure = g.sure_ms.unwrap_or(VARSAYILAN_SURE_MS);
      if sure > 20_000 {
        return Err(gecersiz("geçiş süresi en çok 20 sn".into()));
      }
      let o = state.motor.ozet();
      let mut o = o.lock();
      if o.koleksiyon.adli_gecis(&gecis).is_none() {
        return Err(bulunamadi("geçiş yok".into()));
      }
      if o.koleksiyon.hizli_gecisler.len() >= 16 {
        return Err(gecersiz("en çok 16 hızlı geçiş".into()));
      }
      let yeni = o.koleksiyon.yeni_kimlik("h");
      o.koleksiyon.hizli_gecisler.push(kol::HizliGecis { id: yeni.clone(), gecis, sure_ms: sure });
      json!({"id": yeni})
    }
    "hizli-sil" => {
      let id = id()?;
      let o = state.motor.ozet();
      let mut o = o.lock();
      let n = o.koleksiyon.hizli_gecisler.len();
      o.koleksiyon.hizli_gecisler.retain(|h| h.id != id);
      if o.koleksiyon.hizli_gecisler.len() == n {
        return Err(bulunamadi("hızlı geçiş yok".into()));
      }
      json!({})
    }
    e => return Err(gecersiz(format!("bilinmeyen eylem: {e}"))),
  };
  koleksiyonu_yaz(&state)?;
  audit(&state, &actor, "MOTOR_TRANSITION_LIST", json!({"eylem": g.eylem, "id": g.id})).await;
  Ok(Json(sonuc))
}

#[derive(Deserialize)]
struct KaynakTuvaliGovdesi {
  id: String,
  /// ac | kapat
  eylem: String,
}

/// Sahne/kaynak projektörü: kaynağın kendi tuvalini açar (canlı kare adı `kaynak-<kimlik>`) ya da kapatır
async fn api_kaynak_tuvali(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<KaynakTuvaliGovdesi>,
) -> ApiResult {
  authorize(&state, &addr, &headers, "broadcast.read").await?;
  motor_calisiyor(&state).await?;
  if !kol::gecerli_kimlik(&g.id) {
    return Err(gecersiz("geçersiz kimlik".into()));
  }
  match g.eylem.as_str() {
    "ac" => Ok(Json(komut(&state, json!({"komut": "kaynak_tuvali.ac", "id": g.id})).await?)),
    "kapat" => {
      komut(&state, json!({"komut": "kaynak_tuvali.kapat", "id": g.id})).await?;
      Ok(Json(json!({"ok": true})))
    }
    e => Err(gecersiz(format!("bilinmeyen eylem: {e}"))),
  }
}

#[derive(Deserialize)]
struct MultiviewGovdesi {
  #[serde(default)]
  tuval: Option<String>,
  /// ac (yeniden kurar) | kapat
  eylem: String,
}

/// Multiview: tuvalin ilk 8 sahnesi (koleksiyon sırasıyla) + önizleme + program. Dönüş: canlı kare tuvali ve hücre
/// düzeni (sahne adlarıyla); panel etiketleri ve çerçeveleri bu düzene göre çizer.
async fn api_multiview(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<MultiviewGovdesi>,
) -> ApiResult {
  authorize(&state, &addr, &headers, "broadcast.read").await?;
  motor_calisiyor(&state).await?;
  let tuval = tuval_al(g.tuval)?;
  match g.eylem.as_str() {
    "ac" => {
      let (sahneler, adlar): (Vec<String>, Vec<(String, String)>) = {
        let o = state.motor.ozet();
        let o = o.lock();
        let s: Vec<_> = o.koleksiyon.sahneler.iter().filter(|s| s.tuval == tuval && !s.multiview_gizli).take(8).collect();
        (s.iter().map(|x| x.id.clone()).collect(), s.iter().map(|x| (x.id.clone(), x.ad.clone())).collect())
      };
      let mut r = komut(&state, json!({"komut": "multiview.ac", "tuval": tuval, "sahneler": sahneler})).await?;
      for h in r["hucreler"].as_array_mut().into_iter().flatten() {
        if let Some(ad) = h["sahne"].as_str().and_then(|id| adlar.iter().find(|(i, _)| i == id)).map(|(_, a)| a.clone()) {
          h["ad"] = json!(ad);
        }
      }
      Ok(Json(r))
    }
    "kapat" => {
      komut(&state, json!({"komut": "multiview.kapat", "tuval": tuval})).await?;
      Ok(Json(json!({"ok": true})))
    }
    e => Err(gecersiz(format!("bilinmeyen eylem: {e}"))),
  }
}

async fn api_gecis(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Query(q): Query<TuvalSorgusu>,
) -> ApiResult {
  authorize(&state, &addr, &headers, "broadcast.read").await?;
  motor_calisiyor(&state).await?;
  let tuval = tuval_al(q.tuval)?;
  let bilgi = komut(&state, json!({"komut": "gecis.bilgi", "tuval": tuval})).await?;
  let turler = komut(&state, json!({"komut": "gecis.turleri"})).await?;
  Ok(Json(json!({"tuval": tuval, "bilgi": bilgi, "turler": turler["turler"]})))
}

#[derive(Deserialize)]
struct GecisGovdesi {
  #[serde(default)]
  tuval: Option<String>,
  tur: String,
  #[serde(default)]
  sure_ms: Option<u32>,
}

async fn api_gecis_ayarla(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<GecisGovdesi>,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, "scene.edit").await?;
  motor_calisiyor(&state).await?;
  let tuval = tuval_al(g.tuval.clone())?;
  let onceki = state.motor.ozet().lock().koleksiyon.gecisler.get(&tuval).cloned();
  // Aynı tür: ayarlar korunur (yalnız süre değişir)
  let ayarlar = onceki.as_ref().filter(|o| o.tur == g.tur).map(|o| o.ayarlar.clone()).unwrap_or(Value::Null);
  let kayit = GecisKaydi { tur: g.tur.clone(), sure_ms: g.sure_ms.unwrap_or(onceki.as_ref().map_or(VARSAYILAN_SURE_MS, |o| o.sure_ms)), ayarlar };
  gecis_dogrula(&kayit)?;
  let mut istek = json!({"komut": "gecis.ayarla", "tuval": tuval, "tur": kayit.tur, "sure_ms": kayit.sure_ms});
  if kayit.ayarlar.is_object() {
    istek["ayarlar"] = kayit.ayarlar.clone();
  }
  komut(&state, istek).await?;
  {
    let o = state.motor.ozet();
    let mut o = o.lock();
    // Tür değişti: artık adlandırılmış bir geçiş seçili değil (yalnız süre değiştiyse seçim kalır)
    if onceki.as_ref().is_none_or(|p| p.tur != kayit.tur) {
      o.koleksiyon.secili_gecis.remove(&tuval);
    }
    o.koleksiyon.gecisler.insert(tuval.clone(), kayit.clone());
  }
  koleksiyonu_yaz(&state)?;
  audit(&state, &actor, "MOTOR_TRANSITION_SET", json!({"tuval": tuval, "tur": kayit.tur, "sureMs": kayit.sure_ms})).await;
  Ok(Json(json!({"ok": true})))
}

async fn api_gecis_ozellikleri(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Query(q): Query<TuvalSorgusu>,
) -> ApiResult {
  authorize(&state, &addr, &headers, "broadcast.read").await?;
  motor_calisiyor(&state).await?;
  let tuval = tuval_al(q.tuval)?;
  Ok(Json(komut(&state, json!({"komut": "gecis.ozellikler", "tuval": tuval})).await?))
}

#[derive(Deserialize)]
struct GecisAyarGovdesi {
  #[serde(default)]
  tuval: Option<String>,
  ayarlar: Map<String, Value>,
}

async fn api_gecis_guncelle(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<GecisAyarGovdesi>,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, "scene.edit").await?;
  motor_calisiyor(&state).await?;
  let tuval = tuval_al(g.tuval.clone())?;
  if Value::Object(g.ayarlar.clone()).to_string().len() > 16 * 1024 {
    return Err(gecersiz("ayarlar çok büyük".into()));
  }
  komut(&state, json!({"komut": "gecis.guncelle", "tuval": tuval, "ayarlar": g.ayarlar})).await?;
  {
    let o = state.motor.ozet();
    let mut o = o.lock();
    let tur = komut_disi_tur(&o.koleksiyon, &tuval);
    let k = o.koleksiyon.gecisler.entry(tuval.clone()).or_insert(GecisKaydi { tur, sure_ms: VARSAYILAN_SURE_MS, ayarlar: json!({}) });
    if !k.ayarlar.is_object() {
      k.ayarlar = json!({});
    }
    if let Some(m) = k.ayarlar.as_object_mut() {
      for (a, v) in &g.ayarlar {
        m.insert(a.clone(), v.clone());
      }
    }
    // Seçili adlandırılmış geçişin ayarları da güncellenir (bir sonraki seçimde aynı ayarlarla gelsin)
    let yeni = k.ayarlar.clone();
    if let Some(id) = o.koleksiyon.secili_gecis.get(&tuval).cloned() {
      if let Some(a) = o.koleksiyon.adli_gecisler.iter_mut().find(|a| a.id == id) {
        a.ayarlar = yeni;
      }
    }
  }
  koleksiyonu_yaz(&state)?;
  audit(&state, &actor, "MOTOR_TRANSITION_SETTINGS", json!({"tuval": tuval, "alanlar": g.ayarlar.keys().collect::<Vec<_>>()})).await;
  Ok(Json(json!({"ok": true})))
}

fn komut_disi_tur(k: &kol::Koleksiyon, tuval: &str) -> String {
  k.gecisler.get(tuval).map(|g| g.tur.clone()).unwrap_or_else(|| VARSAYILAN_GECIS.into())
}

// ─── Studio Mode ───────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct StudyoGovdesi {
  #[serde(default)]
  tuval: Option<String>,
  eylem: String,
  #[serde(default)]
  sahne: Option<String>,
  #[serde(default)]
  sure_ms: Option<u32>,
  /// Geçişten sonra önizleme ile program yer değiştirsin (OBS "Swap Preview/Program")
  #[serde(default)]
  takas: bool,
  /// `hizli`: hızlı geçiş kimliği
  #[serde(default)]
  hizli: Option<String>,
  /// `tbar`: 0–1 arası T-bar konumu; `birak` true ise kullanıcı bıraktı
  #[serde(default)]
  konum: Option<f32>,
  #[serde(default)]
  birak: bool,
}

/// Studio Mode geçişi: önizlemedeki sahne programa alınır. Dönüş: yeni program sahnesi.
pub(crate) async fn studyo_gecisi(state: &AppState, tuval: &str, takas: bool, sure_ms: Option<u32>) -> Result<Option<String>, Hata> {
  motor_calisiyor(state).await?;
  let mut istek = json!({"komut": "studyo.gecis", "tuval": tuval, "takas": takas});
  if let Some(s) = sure_ms {
    istek["sure_ms"] = json!(s.min(20_000));
  }
  komut(state, istek).await?;
  let bilgi = komut(state, json!({"komut": "gecis.bilgi", "tuval": tuval})).await?;
  let program = bilgi["program"].as_str().map(String::from);
  {
    let o = state.motor.ozet();
    let mut o = o.lock();
    if let Some(p) = &program {
      o.koleksiyon.program.insert(tuval.to_string(), p.clone());
    }
    o.studyo.insert(tuval.to_string(), bilgi["studyo"].as_str().map(String::from));
  }
  koleksiyonu_yaz(state)?;
  if let Some(p) = &program {
    bagli_esi_programa(state, p).await;
  }
  Ok(program)
}

/// Studio Mode'u açar; önizleme başlangıçta program sahnesi (OBS gibi). Dönüş: önizlemedeki sahne
pub(crate) async fn studyo_ac(state: &AppState, tuval: &str) -> Result<Option<String>, Hata> {
  motor_calisiyor(state).await?;
  komut(state, json!({"komut": "studyo.ac", "tuval": tuval})).await?;
  let kip = state.motor.ozet().lock().profil.studyo_cogalt;
  komut(state, json!({"komut": "studyo.cogalt", "tuval": tuval, "kip": kip})).await?;
  let program = state.motor.ozet().lock().koleksiyon.program.get(tuval).cloned();
  if let Some(p) = &program {
    komut(state, json!({"komut": "studyo.onizleme", "tuval": tuval, "sahne": p})).await?;
  }
  state.motor.ozet().lock().studyo.insert(tuval.to_string(), program.clone());
  Ok(program)
}

pub(crate) async fn studyo_kapat(state: &AppState, tuval: &str) -> Result<(), Hata> {
  motor_calisiyor(state).await?;
  komut(state, json!({"komut": "studyo.kapat", "tuval": tuval})).await?;
  state.motor.ozet().lock().studyo.remove(tuval);
  Ok(())
}

pub(crate) async fn studyo_onizleme(state: &AppState, tuval: &str, sahne: &str) -> Result<(), Hata> {
  if !state.motor.ozet().lock().studyo.contains_key(tuval) {
    return Err(catisma("Studio Mode kapalı".into()));
  }
  komut(state, json!({"komut": "studyo.onizleme", "tuval": tuval, "sahne": sahne})).await?;
  state.motor.ozet().lock().studyo.insert(tuval.to_string(), Some(sahne.to_string()));
  Ok(())
}

async fn api_studyo(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<StudyoGovdesi>,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, "scene.switch").await?;
  motor_calisiyor(&state).await?;
  let tuval = tuval_al(g.tuval.clone())?;
  let sonuc = match g.eylem.as_str() {
    "ac" => json!({"onizleme": studyo_ac(&state, &tuval).await?}),
    "kapat" => {
      studyo_kapat(&state, &tuval).await?;
      json!({})
    }
    "onizleme" => {
      let sahne = g.sahne.clone().ok_or_else(|| gecersiz("'sahne' gerekli".into()))?;
      studyo_onizleme(&state, &tuval, &sahne).await?;
      json!({"onizleme": sahne})
    }
    "gecis" => {
      let program = studyo_gecisi(&state, &tuval, g.takas, g.sure_ms).await?;
      json!({"program": program})
    }
    "hizli" => {
      let id = g.hizli.clone().ok_or_else(|| gecersiz("hızlı geçiş kimliği gerekli".into()))?;
      let (tur, ayarlar, sure, onceki) = {
        let o = state.motor.ozet();
        let o = o.lock();
        let h = o.koleksiyon.hizli_gecisler.iter().find(|h| h.id == id).cloned().ok_or_else(|| bulunamadi("hızlı geçiş yok".into()))?;
        let (_, tur, ayarlar) = o.koleksiyon.adli_gecis(&h.gecis).ok_or_else(|| bulunamadi("hızlı geçişin geçişi silinmiş".into()))?;
        (tur, ayarlar, h.sure_ms, o.koleksiyon.gecisler.get(&tuval).cloned())
      };
      hizli_gecis(&state, &tuval, &tur, &ayarlar, sure, onceki).await?
    }
    "tbar" => {
      let konum = g.konum.filter(|k| k.is_finite() && (0.0..=1.0).contains(k)).ok_or_else(|| gecersiz("konum 0–1 olmalı".into()))?;
      let r = komut(&state, json!({"komut": "studyo.tbar", "tuval": tuval, "konum": konum, "birak": g.birak})).await?;
      let etkin = r["etkin"].as_bool().unwrap_or(false);
      if !etkin {
        if let Some(p) = r["program"].as_str() {
          state.motor.ozet().lock().koleksiyon.program.insert(tuval.clone(), p.to_string());
          koleksiyonu_yaz(&state)?;
        }
      }
      // Sürükleme sırasında her adım denetim kaydına yazılmaz; yalnız bırakma
      if !g.birak {
        return Ok(Json(json!({"etkin": etkin, "program": r["program"]})));
      }
      json!({"etkin": etkin, "program": r["program"]})
    }
    e => return Err(gecersiz(format!("bilinmeyen eylem: {e}"))),
  };
  audit(&state, &actor, "MOTOR_STUDIO", json!({"tuval": tuval, "eylem": g.eylem, "sahne": g.sahne})).await;
  Ok(Json(sonuc))
}

// ─── Sahne öğeleri ─────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct OgeGovdesi {
  #[serde(default)]
  oge: String,
  eylem: String,
  #[serde(default)]
  yon: Option<String>,
  /// `sira`: listedeki hedef konum (0 = en alt)
  #[serde(default)]
  konum_sira: Option<usize>,
  /// Eski biçim dönüşüm alanları
  #[serde(default)]
  konum: Option<[f32; 2]>,
  #[serde(default)]
  sinir: Option<[f32; 2]>,
  #[serde(default)]
  gorunur: Option<bool>,
  /// Tam dönüşüm (kısmi olabilir)
  #[serde(default)]
  donusum: Option<Map<String, Value>>,
  #[serde(default)]
  sahne: Option<String>,
  #[serde(default)]
  kaynak: Option<String>,
  #[serde(default)]
  ogeler: Option<Vec<String>>,
  #[serde(default)]
  grup: Option<String>,
  #[serde(default)]
  ad: Option<String>,
  /// `gecis`: true = gösterme, false = gizleme geçişi
  #[serde(default)]
  goster: Option<bool>,
  /// `gecis`: `{tur, sure_ms, ayarlar?}`; null = geçişi kaldır
  #[serde(default)]
  gecis: Option<Value>,
}

/// Dönüşüm alanlarını doğrular ve motor biçimine çevirir (yalnız verilen alanlar)
fn donusum_dogrula(d: &Map<String, Value>) -> Result<Value, Hata> {
  let mut out = Map::new();
  let cift = |v: &Value, sinir: f64| -> Result<Value, Hata> {
    let a = v.as_array().filter(|a| a.len() == 2).ok_or_else(|| gecersiz("çift değer [x, y] olmalı".into()))?;
    let x: Vec<f64> = a.iter().map(|n| n.as_f64().unwrap_or(f64::NAN)).collect();
    if x.iter().any(|n| !n.is_finite() || n.abs() > sinir) {
      return Err(gecersiz("değer aralık dışında".into()));
    }
    Ok(json!(x))
  };
  for (ad, v) in d {
    let deger = match ad.as_str() {
      "konum" => cift(v, 65_536.0)?,
      "olcek" => cift(v, 1_000.0)?,
      "sinir" => {
        let c = cift(v, 65_536.0)?;
        if c.as_array().is_some_and(|a| a.iter().any(|n| n.as_f64().unwrap_or(0.0) <= 0.0)) {
          return Err(gecersiz("sınır pozitif olmalı".into()));
        }
        c
      }
      "aci" => json!(v.as_f64().filter(|a| a.is_finite()).ok_or_else(|| gecersiz("açı sayı olmalı".into()))?.rem_euclid(360.0)),
      "gorunur" | "kilit" => json!(v.as_bool().ok_or_else(|| gecersiz(format!("{ad} true/false olmalı")))?),
      "hizalama" | "sinir_hizalama" => json!(v.as_u64().filter(|x| *x <= 15).ok_or_else(|| gecersiz(format!("{ad} 0–15 olmalı")))?),
      "sinir_turu" | "olcek_filtresi" | "karistirma" => json!(v.as_u64().filter(|x| *x <= 6).ok_or_else(|| gecersiz(format!("{ad} 0–6 olmalı")))?),
      "karistirma_yontemi" => json!(v.as_u64().filter(|x| *x <= 1).ok_or_else(|| gecersiz("karıştırma yöntemi 0–1 olmalı".into()))?),
      "kirp" => {
        let a = v.as_array().filter(|a| a.len() == 4).ok_or_else(|| gecersiz("kırpma [sol, üst, sağ, alt] olmalı".into()))?;
        let n: Vec<i64> = a.iter().map(|x| x.as_i64().unwrap_or(-1)).collect();
        if n.iter().any(|x| !(0..=16_384).contains(x)) {
          return Err(gecersiz("kırpma 0–16384 olmalı".into()));
        }
        json!(n)
      }
      _ => return Err(gecersiz(format!("bilinmeyen dönüşüm alanı: {ad}"))),
    };
    out.insert(ad.clone(), deger);
  }
  Ok(Value::Object(out))
}

async fn api_oge(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<OgeGovdesi>,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, "scene.edit").await?;
  motor_calisiyor(&state).await?;
  let mut sahne = oge_sahnesi(&g.oge).to_string();
  let mut sonuc = json!({"ok": true});
  match g.eylem.as_str() {
    "sira" => {
      let mut istek = json!({"komut": "oge.sira", "oge": g.oge, "yon": g.yon.clone().unwrap_or_default()});
      if let Some(k) = g.konum_sira {
        istek["konum"] = json!(k);
      }
      komut(&state, istek).await?;
    }
    "kaldir" => {
      komut(&state, json!({"komut": "oge.kaldir", "oge": g.oge})).await?;
    }
    "donustur" => {
      let mut d = g.donusum.clone().unwrap_or_default();
      if let Some(k) = g.konum {
        d.insert("konum".into(), json!(k));
      }
      if let Some(s) = g.sinir {
        d.insert("sinir".into(), json!(s));
      }
      if let Some(v) = g.gorunur {
        d.insert("gorunur".into(), json!(v));
      }
      let d = donusum_dogrula(&d)?;
      komut(&state, json!({"komut": "oge.donustur", "oge": g.oge, "donusum": d})).await?;
    }
    "ekle" => {
      // Var olan kaynağı ya da aynı tuvaldeki başka bir sahneyi sahneye ekler (OBS "Add Existing")
      sahne = g.sahne.clone().ok_or_else(|| gecersiz("'sahne' gerekli".into()))?;
      let kaynak = g.kaynak.clone().ok_or_else(|| gecersiz("'kaynak' gerekli".into()))?;
      {
        let o = state.motor.ozet();
        let o = o.lock();
        let hedef = o.koleksiyon.sahne_ref(&sahne).ok_or_else(|| bulunamadi("sahne yok".into()))?;
        if let Some(ic) = o.koleksiyon.sahne_ref(&kaynak) {
          if ic.id == sahne || ic.tuval != hedef.tuval {
            return Err(gecersiz("sahne kendisine ya da başka tuvaldeki sahneye eklenemez".into()));
          }
        } else if !o.koleksiyon.kaynaklar.iter().any(|k| k.id == kaynak && !k.eksik) {
          return Err(bulunamadi("kaynak yok".into()));
        }
      }
      let d = match &g.donusum {
        Some(d) => donusum_dogrula(d)?,
        None => Donusum { konum: [40.0, 40.0], ..Default::default() }.motor_json(),
      };
      let v = komut(&state, json!({"komut": "sahne.ekle", "sahne": sahne, "kaynak": kaynak, "donusum": d})).await?;
      sonuc["oge"] = v["oge"].clone();
    }
    "grupla" => {
      sahne = g.sahne.clone().ok_or_else(|| gecersiz("'sahne' gerekli".into()))?;
      let ogeler = g.ogeler.clone().unwrap_or_default();
      if ogeler.is_empty() {
        return Err(gecersiz("gruplanacak öğe seçilmedi".into()));
      }
      let ad = ad_temizle(g.ad.as_deref().unwrap_or("Grup"))?;
      let gid = state.motor.ozet().lock().koleksiyon.yeni_kimlik("g");
      let v = komut(&state, json!({"komut": "grup.olustur", "sahne": sahne, "id": gid, "ad": ad, "ogeler": ogeler})).await?;
      kaydet_sahneler(&state, std::slice::from_ref(&sahne)).await?;
      grup_adi_yaz(&state, &sahne, &gid, &ad);
      koleksiyonu_yaz(&state)?;
      sonuc["oge"] = v["oge"].clone();
    }
    "grubu-coz" => {
      komut(&state, json!({"komut": "grup.coz", "oge": g.oge})).await?;
    }
    "gruba-ekle" => {
      let grup = g.grup.clone().ok_or_else(|| gecersiz("'grup' gerekli".into()))?;
      komut(&state, json!({"komut": "grup.ekle", "grup": grup, "oge": g.oge})).await?;
    }
    "gruptan-cikar" => {
      komut(&state, json!({"komut": "grup.cikar", "oge": g.oge})).await?;
    }
    "gecis" => {
      // Öğe gösterme/gizleme geçişi (OBS "Show/Hide Transition")
      let goster = g.goster.ok_or_else(|| gecersiz("'goster' gerekli".into()))?;
      let gecis: Option<kol::GecisKaydi> = match g.gecis.clone() {
        None | Some(Value::Null) => None,
        Some(v) => Some(serde_json::from_value(v).map_err(|e| gecersiz(format!("geçiş: {e}")))?),
      };
      if let Some(x) = &gecis {
        if !(50..=20_000).contains(&x.sure_ms) {
          return Err(gecersiz("süre 50–20000 ms olmalı".into()));
        }
        if x.ayarlar.to_string().len() > 32 * 1024 {
          return Err(gecersiz("ayarlar çok büyük".into()));
        }
      }
      // Öğenin kayıttaki yeri: aynı kaynağın motor listesindeki kaçıncı görünümü
      let liste = komut(&state, json!({"komut": "sahne.ogeler", "sahne": sahne})).await?;
      let satirlar = liste.as_array().cloned().unwrap_or_default();
      let konum = satirlar.iter().position(|x| x["oge"] == g.oge.as_str()).ok_or_else(|| bulunamadi("öğe yok".into()))?;
      let kaynak = satirlar[konum]["kaynak"].as_str().unwrap_or("").to_string();
      let n = satirlar[..konum].iter().filter(|x| x["kaynak"] == kaynak.as_str()).count();
      let mut istek = json!({"komut": "oge.gecis", "oge": g.oge, "goster": goster});
      if let Some(x) = &gecis {
        istek["tur"] = json!(x.tur);
        istek["sure_ms"] = json!(x.sure_ms);
        istek["ayarlar"] = if x.ayarlar.is_object() { x.ayarlar.clone() } else { json!({}) };
      }
      komut(&state, istek).await?;
      kaydet_sahneler(&state, std::slice::from_ref(&sahne)).await?;
      {
        let o = state.motor.ozet();
        let mut o = o.lock();
        if let Some(kayit) = o.koleksiyon.oge_bul_mut(&sahne, &kaynak, n) {
          if goster {
            kayit.goster_gecisi = gecis;
          } else {
            kayit.gizle_gecisi = gecis;
          }
        }
      }
      koleksiyonu_yaz(&state)?;
    }
    "grup-adlandir" => {
      let ad = ad_temizle(g.ad.as_deref().unwrap_or(""))?;
      let gid = g.oge.rsplit_once('/').map_or(g.oge.as_str(), |(_, x)| x).to_string();
      grup_adi_yaz(&state, &sahne, &gid, &ad);
      koleksiyonu_yaz(&state)?;
    }
    e => return Err(gecersiz(format!("bilinmeyen eylem: {e}"))),
  }
  if !sahne.is_empty() {
    kaydet_sahneler(&state, std::slice::from_ref(&sahne)).await?;
  }
  audit(&state, &actor, "MOTOR_ITEM_EDIT", json!({"oge": g.oge, "eylem": g.eylem, "sahne": sahne})).await;
  Ok(Json(sonuc))
}

fn grup_adi_yaz(state: &AppState, sahne: &str, gid: &str, ad: &str) {
  let o = state.motor.ozet();
  let mut o = o.lock();
  if let Some(s) = o.koleksiyon.sahne(sahne) {
    if let Some(x) = s.ogeler.iter_mut().find(|x| x.tur == OgeTuru::Grup && x.kaynak == gid) {
      x.ad = ad.to_string();
    }
  }
}

// ─── Kaynak işlemleri ──────────────────────────────────────────────────────

#[derive(Deserialize)]
struct KaynakIslemi {
  id: String,
  eylem: String,
  #[serde(default)]
  ad: Option<String>,
  /// `cogalt`: kopya bu öğenin sahnesine, aynı dönüşümle, en üste eklenir
  #[serde(default)]
  oge: Option<String>,
  /// `deinterlace`: kip 0–8 (0 kapalı) ve alan sırası 0 üst / 1 alt
  #[serde(default)]
  kip: Option<i32>,
  #[serde(default)]
  alan: Option<i32>,
  /// `renk`: `#rrggbb` ya da boş (etiketi kaldırır)
  #[serde(default)]
  renk: Option<String>,
}

async fn api_kaynak_islem(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<KaynakIslemi>,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, "scene.edit").await?;
  motor_calisiyor(&state).await?;
  let sonuc = match g.eylem.as_str() {
    "adlandir" => {
      let ad = ad_temizle(g.ad.as_deref().unwrap_or(""))?;
      komut(&state, json!({"komut": "kaynak.adlandir", "id": g.id, "ad": ad})).await?;
      state.motor.ozet().lock().koleksiyon.kaynak(&g.id).ok_or_else(|| bulunamadi("kaynak yok".into()))?.ad = ad;
      koleksiyonu_yaz(&state)?;
      json!({})
    }
    "cogalt" => {
      let (yeni, asil) = {
        let o = state.motor.ozet();
        let mut o = o.lock();
        let asil = o.koleksiyon.kaynaklar.iter().find(|k| k.id == g.id).cloned().ok_or_else(|| bulunamadi("kaynak yok".into()))?;
        if asil.eksik {
          return Err(catisma("eksik (eklentisi olmayan) kaynak çoğaltılamaz".into()));
        }
        let yeni = o.koleksiyon.yeni_kimlik("k");
        let mut kopya: KaynakKaydi = asil.clone();
        kopya.id = yeni.clone();
        kopya.ad = match &g.ad {
          Some(a) => ad_temizle(a)?,
          None => format!("{} 2", asil.ad).chars().take(60).collect(),
        };
        for f in kopya.filtreler.iter_mut() {
          f.id = o.koleksiyon.yeni_kimlik("f");
        }
        (kopya, asil)
      };
      // Parola alanları Kimlik Yöneticisinde yeni kimlikle kopyalanır (düz metne düşmez)
      for alan in &asil.gizli_alanlar {
        if let Some(v) = crate::secret_store::get_secret(&format!("motor.kaynak.{}.{alan}", asil.id)) {
          if !crate::secret_store::set_secret(&format!("motor.kaynak.{}.{alan}", yeni.id), &v) {
            return Err(catisma("parola Kimlik Yöneticisine yazılamadı".into()));
          }
        }
      }
      if !kaynak_kur(&state, &yeni).await? {
        return Err(catisma("kaynak türü bu motorda yok".into()));
      }
      state.motor.ozet().lock().koleksiyon.kaynaklar.push(yeni.clone());
      let mut oge = Value::Null;
      if let Some(o) = &g.oge {
        let sahne = oge_sahnesi(o).to_string();
        let satirlar = komut(&state, json!({"komut": "sahne.ogeler", "sahne": sahne})).await?;
        let d = satirlar.as_array().and_then(|a| a.iter().find(|x| x["oge"] == o.as_str())).map(Donusum::motordan).unwrap_or_default();
        let v = komut(&state, json!({"komut": "sahne.ekle", "sahne": sahne, "kaynak": yeni.id, "donusum": d.motor_json()})).await?;
        oge = v["oge"].clone();
        kaydet_sahneler(&state, &[sahne]).await?;
      } else {
        koleksiyonu_yaz(&state)?;
      }
      json!({"id": yeni.id, "oge": oge})
    }
    "renk" => {
      let renk = match g.renk.as_deref().map(str::trim).filter(|r| !r.is_empty()) {
        None => None,
        Some(r) if r.len() == 7 && r.starts_with('#') && r[1..].bytes().all(|b| b.is_ascii_hexdigit()) => Some(r.to_ascii_lowercase()),
        Some(_) => return Err(gecersiz("renk #rrggbb biçiminde olmalı".into())),
      };
      state.motor.ozet().lock().koleksiyon.kaynak(&g.id).ok_or_else(|| bulunamadi("kaynak yok".into()))?.renk = renk.clone();
      koleksiyonu_yaz(&state)?;
      json!({"renk": renk})
    }
    "deinterlace" => {
      let kip = g.kip.unwrap_or(0);
      let alan = g.alan.unwrap_or(0);
      if !(0..=8).contains(&kip) || !(0..=1).contains(&alan) {
        return Err(gecersiz("deinterlace kipi 0–8, alan sırası 0–1 olmalı".into()));
      }
      if state.motor.ozet().lock().koleksiyon.kaynak(&g.id).is_none() {
        return Err(bulunamadi("kaynak yok".into()));
      }
      komut(&state, json!({"komut": "kaynak.deinterlace", "id": g.id, "kip": kip, "alan": alan})).await?;
      if let Some(k) = state.motor.ozet().lock().koleksiyon.kaynak(&g.id) {
        k.deinterlace = [kip, alan];
      }
      koleksiyonu_yaz(&state)?;
      json!({"kip": kip, "alan": alan})
    }
    e => return Err(gecersiz(format!("bilinmeyen eylem: {e}"))),
  };
  audit(&state, &actor, "MOTOR_SOURCE_EDIT", json!({"id": g.id, "eylem": g.eylem})).await;
  Ok(Json(sonuc))
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn donusum_dogrulama() {
    let d = |v: Value| donusum_dogrula(v.as_object().unwrap());
    assert!(d(json!({"konum": [10, 20], "olcek": [1.5, 1.5], "aci": 370, "kirp": [0, 10, 0, 0], "kilit": true, "hizalama": 5})).is_ok());
    assert_eq!(d(json!({"aci": -90})).unwrap()["aci"], 270.0);
    assert!(d(json!({"konum": [1]})).is_err());
    assert!(d(json!({"sinir": [0, 10]})).is_err());
    assert!(d(json!({"kirp": [0, -1, 0, 0]})).is_err());
    assert!(d(json!({"hizalama": 16})).is_err());
    assert!(d(json!({"olcek": [1e9, 1]})).is_err());
    assert!(d(json!({"bilinmeyen": 1})).is_err());
    assert_eq!(oge_sahnesi("s3/k2#2"), "s3");
    assert!(ad_temizle("  \u{7}  ").is_err());
    assert!(gecis_dogrula(&GecisKaydi { tur: "fade_transition".into(), sure_ms: 300, ayarlar: Value::Null }).is_ok());
    assert!(gecis_dogrula(&GecisKaydi { tur: "../x".into(), sure_ms: 300, ayarlar: Value::Null }).is_err());
  }
}

// ─── Ek tuvaller (OBS 32 "Canvases") ─────────────────────────────────────────

/// Etkin tuvaller: kimlik, ad, taban boyutu, ek mi
fn tuval_listesi(k: &kol::Koleksiyon, state: &AppState) -> Vec<Value> {
  let p = state.motor.ozet().lock().profil.clone();
  k.tuvaller()
    .iter()
    .map(|t| match k.ek_tuval(t) {
      Some(e) => json!({"id": e.id, "ad": e.ad, "genislik": e.genislik, "yukseklik": e.yukseklik, "ek": true}),
      None => {
        let (g, y) = p.tuval_boyutu(t);
        json!({"id": t, "ad": if t == "ana" { "Yatay" } else { "Dikey" }, "genislik": g, "yukseklik": y, "ek": false})
      }
    })
    .collect()
}

#[derive(Deserialize)]
struct TuvalGovdesi {
  eylem: String,
  #[serde(default)]
  id: Option<String>,
  #[serde(default)]
  ad: Option<String>,
  #[serde(default)]
  genislik: Option<u32>,
  #[serde(default)]
  yukseklik: Option<u32>,
}

fn tuval_adi(ad: Option<&str>) -> Result<String, Hata> {
  let ad = ad.unwrap_or("").trim();
  if ad.is_empty() || ad.chars().count() > 40 || ad.chars().any(char::is_control) {
    return Err(gecersiz("tuval adı 1–40 karakter olmalı".into()));
  }
  Ok(ad.to_string())
}

/// `ekle` (ad, genişlik, yükseklik) · `adlandir` (id, ad) · `boyut` (id, genişlik, yükseklik; motor yeniden başlayınca
/// uygulanır) · `sil` (id; o tuvalde yayın/sanal kamera sürerken reddedilir)
async fn api_tuval(State(state): State<Arc<AppState>>, ConnectInfo(addr): ConnectInfo<SocketAddr>, headers: HeaderMap, Json(g): Json<TuvalGovdesi>) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, "scene.edit").await?;
  motor_calisiyor(&state).await?;
  let boyut = || -> Result<(u32, u32), Hata> {
    let (w, h) = (g.genislik.unwrap_or(0), g.yukseklik.unwrap_or(0));
    if !kol::ek_tuval_boyutu_gecerli(w, h) {
      return Err(gecersiz("boyut 16–8192 arası çift sayı olmalı".into()));
    }
    Ok((w, h))
  };
  let ek_id = || -> Result<String, Hata> {
    let id = g.id.clone().unwrap_or_default();
    if !kol::ek_tuval_kimligi(&id) || state.motor.ozet().lock().koleksiyon.ek_tuval(&id).is_none() {
      return Err(bulunamadi(format!("ek tuval yok: {id}")));
    }
    Ok(id)
  };
  let sonuc = match g.eylem.as_str() {
    "ekle" => {
      let ad = tuval_adi(g.ad.as_deref())?;
      let (w, h) = boyut()?;
      let id = {
        let o = state.motor.ozet();
        let o = o.lock();
        if o.koleksiyon.ek_tuvaller.len() >= kol::EN_COK_EK_TUVAL {
          return Err(catisma(format!("en çok {} ek tuval", kol::EN_COK_EK_TUVAL)));
        }
        let kullanilan: std::collections::BTreeSet<String> = o.motor_tuvalleri.keys().cloned().collect();
        o.koleksiyon.yeni_ek_tuval_kimligi(&kullanilan)
      };
      komut(&state, json!({"komut": "tuval.olustur", "id": id, "ad": ad, "genislik": w, "yukseklik": h})).await?;
      let sahne = {
        let o = state.motor.ozet();
        let mut o = o.lock();
        o.motor_tuvalleri.insert(id.clone(), (w, h));
        o.koleksiyon.ek_tuvaller.push(kol::EkTuval { id: id.clone(), ad: ad.clone(), genislik: w, yukseklik: h });
        // Tuvalin ilk sahnesi ve program kaydı
        o.koleksiyon.duzelt();
        o.koleksiyon.sahneler.iter().find(|s| s.tuval == id).cloned().ok_or_else(|| catisma("tuval sahnesi kurulamadı".into()))?
      };
      komut(&state, json!({"komut": "sahne.olustur", "id": sahne.id, "tuval": id, "ad": sahne.ad})).await?;
      komut(&state, json!({"komut": "sahne.etkinlestir", "id": sahne.id, "gecis": false})).await?;
      koleksiyonu_yaz(&state)?;
      audit(&state, &actor, "MOTOR_CANVAS_ADD", json!({"id": id, "genislik": w, "yukseklik": h})).await;
      json!({"id": id, "sahne": sahne.id})
    }
    "adlandir" => {
      let id = ek_id()?;
      let ad = tuval_adi(g.ad.as_deref())?;
      for t in state.motor.ozet().lock().koleksiyon.ek_tuvaller.iter_mut().filter(|t| t.id == id) {
        t.ad = ad.clone();
      }
      koleksiyonu_yaz(&state)?;
      json!({"id": id})
    }
    "boyut" => {
      let id = ek_id()?;
      let (w, h) = boyut()?;
      let yeniden = {
        let o = state.motor.ozet();
        let mut o = o.lock();
        for t in o.koleksiyon.ek_tuvaller.iter_mut().filter(|t| t.id == id) {
          (t.genislik, t.yukseklik) = (w, h);
        }
        o.motor_tuvalleri.get(&id).is_some_and(|b| *b != (w, h))
      };
      koleksiyonu_yaz(&state)?;
      // libobs tuvali yeniden boyutlandırılamaz: yeni boyut motor yeniden başlatılınca uygulanır
      json!({"id": id, "motorYenidenBaslamali": yeniden})
    }
    "sil" => {
      let id = ek_id()?;
      let canli: Vec<String> = {
        let o = state.motor.ozet();
        let o = o.lock();
        let mut v: Vec<String> = o.hedef_tuval.iter().filter(|(_, (t, _, _))| *t == id).map(|(h, _)| format!("h-{h}")).collect();
        if o.sanal_kamera_hedef.as_deref().is_some_and(|s| s == id || s == format!("studyo-{id}")) {
          v.push("sanal-kamera".into());
        }
        v
      };
      if let Some(c) = canli.iter().find(|c| super::motor_api::cikis_etkin(&state, c)) {
        return Err(catisma(format!("bu tuvalde çıktı sürüyor ({c}); önce durdurun")));
      }
      kaydet(&state).await?;
      komut(&state, json!({"komut": "tuval.bosalt", "id": id})).await?;
      {
        let o = state.motor.ozet();
        let mut o = o.lock();
        o.studyo.remove(&id);
        o.koleksiyon.ek_tuvali_kaldir(&id);
      }
      koleksiyonu_yaz(&state)?;
      audit(&state, &actor, "MOTOR_CANVAS_REMOVE", json!({"id": id})).await;
      json!({"id": id})
    }
    e => return Err(gecersiz(format!("bilinmeyen eylem: {e}"))),
  };
  Ok(Json(sonuc))
}
