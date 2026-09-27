//! Eklenti yöneticisi HTTP yüzü (`/api/eklentiler…`).
//!
//! Okuma uzaktan da (izinle) yapılabilir; tarama, içe aktarma, kurulum, sınama, etkinleştirme, karantina, kaldırma ve
//! konum değişikliği **yalnız bu bilgisayardan** yapılır: yerel kod çalıştırılmasına yol açan işlemler uzaktan
//! tetiklenmez. Etkinleştirme sonraki motor başlatmada geçerlidir.

use std::collections::HashMap;
use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::sync::{Arc, OnceLock};

use axum::extract::{ConnectInfo, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::routing::{get, post};
use axum::{Json, Router};
use parking_lot::Mutex;
use serde::Deserialize;
use serde_json::{json, Value};

use super::control_plane::{audit, authorize, Actor};
use crate::eklenti::cozumleme::{self, Baglam, Cozumleme};
use crate::eklenti::kayit::{self, EklentiKaydi, KayitDefteri, Konum, KonumTuru};
use crate::eklenti::paket::{self, Hazirlik};
use crate::eklenti::uyumluluk::{degerlendir, Durum};
use crate::eklenti::{hizmet, kesif, yoklama};
use crate::AppState;

type ApiResult = Result<Json<Value>, (StatusCode, String)>;
type Hata = (StatusCode, String);

pub fn router() -> Router<Arc<AppState>> {
  Router::new()
    .route("/api/eklentiler", get(api_liste))
    .route("/api/eklentiler/tara", post(api_tara))
    .route("/api/eklentiler/ice-aktar", post(api_ice_aktar))
    .route("/api/eklentiler/paket/incele", post(api_paket_incele))
    .route("/api/eklentiler/paket/kur", post(api_paket_kur))
    .route("/api/eklentiler/paket/vazgec", post(api_paket_vazgec))
    .route("/api/eklentiler/etkin", post(api_etkin))
    .route("/api/eklentiler/sina", post(api_sina))
    .route("/api/eklentiler/karantina", post(api_karantina))
    .route("/api/eklentiler/kaldir", post(api_kaldir))
    .route("/api/eklentiler/geri-al", post(api_geri_al))
    .route("/api/eklentiler/konum", post(api_konum))
    .route("/api/eklentiler/gunluk", get(api_gunluk))
}

fn catisma(e: impl Into<String>) -> Hata {
  (StatusCode::CONFLICT, e.into())
}
fn gecersiz(e: impl Into<String>) -> Hata {
  (StatusCode::BAD_REQUEST, e.into())
}

/// Yerel kod çalışmasına yol açabilecek işlemler: izin + yalnız yerel.
async fn yerel_yonetici(state: &AppState, addr: &SocketAddr, headers: &HeaderMap) -> Result<Actor, Hata> {
  let actor = authorize(state, addr, headers, "plugins.manage").await?;
  if !actor.local {
    return Err((StatusCode::FORBIDDEN, "Eklenti işlemleri yalnız bu bilgisayardan yapılabilir".into()));
  }
  Ok(actor)
}

fn yonetilen(state: &AppState) -> PathBuf {
  kayit::klasor(&state.data_dir).join("kurulu")
}
fn yedekler(state: &AppState) -> PathBuf {
  kayit::klasor(&state.data_dir).join("yedek")
}
fn hazirlik_koku(state: &AppState) -> PathBuf {
  kayit::klasor(&state.data_dir).join("hazirlik")
}

fn motor_api(state: &AppState) -> u32 {
  let s = state.motor.ozet().lock().bilgi["libobs"].as_str().unwrap_or("").to_string();
  if s.is_empty() {
    // Motor çalışmıyorsa kurulu OBS'in sürümü (motor aynı obs.dll'i yükler)
    return obs_surumu().map(|v| hizmet::libobs_api(&v)).unwrap_or(32 << 24);
  }
  hizmet::libobs_api(&s)
}

/// Kurulu obs.dll'in sürüm kaynağından "32.2.2"
fn obs_surumu() -> Option<String> {
  let bin = Baglam::bu_makine().obs_bin?;
  crate::eklenti::win::surum_bilgisi(&bin.join("obs.dll")).urun_surumu.or_else(|| {
    crate::eklenti::win::surum_bilgisi(&bin.join("obs.dll")).dosya_surumu.map(|d| d.split('.').take(3).collect::<Vec<_>>().join("."))
  })
}

/// Motorun bu oturumda yüklediği eklentiler ve sonuçları
fn oturum_sonuclari(state: &AppState) -> HashMap<String, String> {
  state
    .motor
    .ozet()
    .lock()
    .eklenti_sonuclari
    .iter()
    .filter_map(|s| Some((s["id"].as_str()?.to_string(), s["sonuc"].as_str().unwrap_or("").to_string())))
    .collect()
}

fn kayit_json(e: &EklentiKaydi, calisiyor: bool, oturum: &HashMap<String, String>) -> Value {
  let mut v = serde_json::to_value(e).unwrap_or(Value::Null);
  v["arayuz"] = json!(if e.motor_notu.is_some() { "ENGINE_MANAGED" } else { e.durum.arayuz() });
  v["etiket"] = json!(e.durum.etiket());
  v["yuklenecek"] = json!(e.yuklenecek());
  let yuklendi = oturum.get(&e.id).is_some_and(|s| s == "yuklendi");
  v["oturumdaYuklu"] = json!(yuklendi);
  // "Sonraki başlatmada" bilgisi: çalışan motordaki durum ile defterdeki karar farklıysa
  let bekleyen = if !calisiyor {
    None
  } else if e.yuklenecek() && !yuklendi {
    Some("Sonraki motor başlatmada yüklenecek")
  } else if !e.yuklenecek() && yuklendi {
    Some("Sonraki motor başlatmada yüklenmeyecek (şu an yüklü)")
  } else {
    None
  };
  v["beklemede"] = json!(bekleyen);
  v
}

async fn api_liste(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
) -> ApiResult {
  authorize(&state, &addr, &headers, "plugins.read").await?;
  let cokme = super::motor_api::cokme_denetle(&state).await;
  let calisiyor = state.motor.calisiyor().await;
  let oturum = oturum_sonuclari(&state);
  let (d, yeni) = kayit::oku(&state.data_dir);
  let bilinen: Vec<Value> = kesif::bilinen_konumlar()
    .into_iter()
    .map(|(tur, yol)| json!({"tur": tur, "yol": yol, "var": yol.is_dir()}))
    .collect();
  Ok(Json(json!({
    "eklentiler": d.eklentiler.iter().map(|e| kayit_json(e, calisiyor, &oturum)).collect::<Vec<_>>(),
    "konumlar": d.konumlar,
    "bilinenKonumlar": bilinen,
    "obsModulDosyasi": kesif::obs_modul_dosyasi().is_some_and(|p| p.is_file()),
    "yonetilenKlasor": yonetilen(&state),
    "sonCokme": d.son_cokme,
    "bekleyenCokme": cokme,
    "motorCalisiyor": calisiyor,
    "guvenliKip": calisiyor && state.motor.ozet().lock().guvenli_kip,
    "obsSurumu": obs_surumu(),
    "defterYeniSurum": yeni,
  })))
}

// ─── Tarama / OBS'ten içe aktarma ─────────────────────────────────────────

#[derive(Deserialize)]
struct TaraGovdesi {
  /// Kullanıcı taramaya izin verdi (salt-okunur; hiçbir dosya değiştirilmez)
  #[serde(default)]
  izin: bool,
}

/// Bir adayın çözümleme özeti (arayüz için; tam çözümleme kayda girer)
fn aday_json(c: &Cozumleme, konum: KonumTuru, api: u32, d: &KayitDefteri, obs_moduller: &[kesif::ObsModulu]) -> Value {
  let e = hizmet::kayit_yap(d.eklentiler.iter().find(|e| e.id == c.modul), c, konum, api);
  let obs = obs_moduller.iter().find(|m| m.module_name == c.modul);
  let mut v = kayit_json(&e, false, &HashMap::new());
  v["kayitli"] = json!(d.eklentiler.iter().any(|x| x.id == c.modul));
  v["obsYoneticisinde"] = json!(obs.map(|m| json!({"etkin": m.enabled, "kaynaklar": m.sources, "ciktilar": m.outputs, "kodlayicilar": m.encoders, "servisler": m.services})));
  v
}

fn obs_eklentisi_mi(dll: &Path) -> bool {
  std::fs::read(dll).ok().and_then(|b| crate::eklenti::pe::ayristir(&b).ok()).is_some_and(|p| p.obs_eklentisi())
}

async fn api_tara(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<TaraGovdesi>,
) -> ApiResult {
  let actor = yerel_yonetici(&state, &addr, &headers).await?;
  if !g.izin {
    return Err((StatusCode::PRECONDITION_REQUIRED, "Tarama izni gerekli (klasörler yalnız okunur)".into()));
  }
  let (d, _) = kayit::oku(&state.data_dir);
  let api = motor_api(&state);
  let mut konumlar: Vec<(KonumTuru, PathBuf)> = kesif::bilinen_konumlar();
  konumlar.extend(d.konumlar.iter().filter(|k| k.etkin).map(|k| (k.tur, k.yol.clone())));
  let sonuc = tokio::task::spawn_blocking(move || {
    let baglam = Baglam::bu_makine();
    let obs_moduller = kesif::obs_modul_dosyasi().map(|p| kesif::obs_modulleri_oku(&p)).unwrap_or_default();
    let mut adaylar = Vec::new();
    let (mut taranan, mut yardimci) = (0usize, 0usize);
    for (tur, yol) in &konumlar {
      for a in kesif::tara(yol, *tur) {
        taranan += 1;
        if !obs_eklentisi_mi(&a.dll) {
          yardimci += 1;
          continue;
        }
        match cozumleme::cozumle(&a.dll, a.veri.as_deref(), &baglam) {
          Ok(c) => adaylar.push(aday_json(&c, a.konum, api, &d, &obs_moduller)),
          Err(e) => adaylar.push(json!({"id": a.modul, "dll": a.dll, "hata": e})),
        }
      }
    }
    (adaylar, taranan, yardimci, obs_moduller.len())
  })
  .await
  .map_err(|e| catisma(e.to_string()))?;
  let (adaylar, taranan, yardimci, obs_modul_sayisi) = sonuc;
  let say = |f: &dyn Fn(&Value) -> bool| adaylar.iter().filter(|a| f(a)).count();
  let sayilar = json!({
    "taranan": taranan,
    "yardimciKitaplik": yardimci,
    "obsEklentisi": adaylar.len(),
    "birinciTaraf": say(&|a| a["birinciTaraf"] == true),
    "ucuncuTaraf": say(&|a| a["birinciTaraf"] != true),
    "obsYoneticisindekiModul": obs_modul_sayisi,
    "durumlar": {
      "COMPATIBLE": say(&|a| a["arayuz"] == "COMPATIBLE"),
      "LIKELY_COMPATIBLE": say(&|a| a["arayuz"] == "LIKELY_COMPATIBLE"),
      "TEST_REQUIRED": say(&|a| a["arayuz"] == "TEST_REQUIRED"),
      "MISSING_DEPENDENCY": say(&|a| a["arayuz"] == "MISSING_DEPENDENCY"),
      "OBS_VERSION_MISMATCH": say(&|a| a["arayuz"] == "OBS_VERSION_MISMATCH"),
      "ARCHITECTURE_MISMATCH": say(&|a| a["arayuz"] == "ARCHITECTURE_MISMATCH"),
      "UNSUPPORTED": say(&|a| a["arayuz"] == "UNSUPPORTED"),
      "BLOCKED": say(&|a| a["arayuz"] == "BLOCKED" || a["arayuz"] == "QUARANTINED"),
      "ENGINE_MANAGED": say(&|a| a["arayuz"] == "ENGINE_MANAGED"),
    },
  });
  audit(&state, &actor, "PLUGIN_SCAN", json!({"taranan": taranan, "eklenti": adaylar.len()})).await;
  Ok(Json(json!({"adaylar": adaylar, "sayilar": sayilar})))
}

#[derive(Deserialize)]
struct IceAktarGovdesi {
  /// İçe aktarılacak DLL yolları (tarama sonucundan)
  dll: Vec<PathBuf>,
}

fn konum_turu(dll: &Path) -> KonumTuru {
  let yol = dll.to_string_lossy().to_lowercase();
  if kesif::programdata_kok().is_some_and(|p| yol.starts_with(&p.to_string_lossy().to_lowercase())) {
    KonumTuru::ProgramData
  } else if kesif::obs_kok().is_some_and(|p| yol.starts_with(&p.to_string_lossy().to_lowercase())) {
    KonumTuru::ObsKurulum
  } else {
    KonumTuru::Ozel
  }
}

/// OBS'ten içe aktarma = başvuru olarak kayda ekleme (dosya kopyalanmaz, OBS klasörüne dokunulmaz, etkinleştirilmez).
async fn api_ice_aktar(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<IceAktarGovdesi>,
) -> ApiResult {
  let actor = yerel_yonetici(&state, &addr, &headers).await?;
  if g.dll.is_empty() || g.dll.len() > 500 {
    return Err(gecersiz("1–500 eklenti seçilmeli"));
  }
  // Yalnız bilinen/eklenmiş konumlardaki DLL'ler kabul edilir (rastgele yol verilemez)
  let (d0, _) = kayit::oku(&state.data_dir);
  let mut izinli: Vec<PathBuf> = kesif::bilinen_konumlar().into_iter().map(|(_, p)| p).collect();
  izinli.extend(d0.konumlar.iter().map(|k| k.yol.clone()));
  for dll in &g.dll {
    let tamam = dll.is_absolute() && izinli.iter().any(|k| dll.starts_with(k)) && dll.extension().is_some_and(|e| e.eq_ignore_ascii_case("dll"));
    if !tamam {
      return Err(gecersiz(format!("izin verilen bir eklenti konumunda değil: {}", dll.display())));
    }
  }
  let api = motor_api(&state);
  let _k = state.eklenti_kilidi.lock().await;
  let (mut d, _) = kayit::oku(&state.data_dir);
  let dll_listesi = g.dll.clone();
  let cozumler = tokio::task::spawn_blocking(move || {
    let b = Baglam::bu_makine();
    let obs_moduller = kesif::obs_modul_dosyasi().map(|p| kesif::obs_modulleri_oku(&p)).unwrap_or_default();
    dll_listesi
      .iter()
      .map(|dll| {
        let modul = dll.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
        let veri = cozumleme::veri_klasoru_tahmini(dll, &modul);
        let obs = obs_moduller.iter().find(|m| m.module_name == modul).cloned();
        (dll.clone(), cozumleme::cozumle(dll, veri.as_deref(), &b), obs)
      })
      .collect::<Vec<_>>()
  })
  .await
  .map_err(|e| catisma(e.to_string()))?;
  let mut eklenen = Vec::new();
  let mut hatalar = Vec::new();
  for (dll, c, obs) in cozumler {
    match c {
      Ok(c) => {
        let konum = konum_turu(&dll);
        let i = d.eklentiler.iter().position(|e| e.id == c.modul);
        let mut e = hizmet::kayit_yap(i.map(|i| &d.eklentiler[i]), &c, konum, api);
        e.obs_etkin = obs.as_ref().map(|m| m.enabled);
        // OBS'in yöneticisindeki tür listesi yalnız bilgi: bizim yoklamamız olmadan "uyumlu" sayılmaz
        match i {
          Some(i) => d.eklentiler[i] = e.clone(),
          None => d.eklentiler.push(e.clone()),
        }
        eklenen.push(json!({"id": e.id, "durum": e.durum.arayuz()}));
      }
      Err(h) => hatalar.push(json!({"dll": dll, "hata": h})),
    }
  }
  kayit::yaz(&state.data_dir, &d).map_err(catisma)?;
  audit(&state, &actor, "PLUGIN_IMPORT", json!({"eklenen": eklenen.len(), "hata": hatalar.len()})).await;
  Ok(Json(json!({"eklenen": eklenen, "hatalar": hatalar})))
}

// ─── Paket kurulumu ────────────────────────────────────────────────────────

fn hazirliklar() -> &'static Mutex<HashMap<String, Hazirlik>> {
  static H: OnceLock<Mutex<HashMap<String, Hazirlik>>> = OnceLock::new();
  H.get_or_init(Default::default)
}

#[derive(Deserialize)]
struct InceleGovdesi {
  yol: PathBuf,
}

async fn api_paket_incele(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<InceleGovdesi>,
) -> ApiResult {
  let actor = yerel_yonetici(&state, &addr, &headers).await?;
  if !g.yol.is_absolute() || !g.yol.exists() {
    return Err(gecersiz("paket yolu mutlak olmalı ve var olmalı"));
  }
  let kok = hazirlik_koku(&state);
  let api = motor_api(&state);
  let (d, _) = kayit::oku(&state.data_dir);
  let yol = g.yol.clone();
  let (h, adaylar) = tokio::task::spawn_blocking(move || -> Result<(Hazirlik, Vec<Value>), String> {
    let h = paket::hazirla(&yol, &kok)?;
    let b = Baglam::bu_makine();
    let adaylar = h
      .adaylar
      .iter()
      .map(|a| match cozumleme::cozumle(&a.dll, a.veri.as_deref(), &b) {
        Ok(c) => {
          let mut v = aday_json(&c, KonumTuru::Yonetilen, api, &d, &[]);
          v["modul"] = json!(a.modul);
          v["yardimcilar"] = json!(a.yardimcilar.iter().filter_map(|p| p.file_name()).map(|n| n.to_string_lossy()).collect::<Vec<_>>());
          v["veriVar"] = json!(a.veri.is_some());
          let mevcut = d.eklentiler.iter().find(|e| e.id == a.modul);
          v["guncelleme"] = json!(mevcut.map(|e| json!({"eskiSurum": e.surum, "konum": e.konum})));
          v
        }
        Err(e) => json!({"modul": a.modul, "hata": e}),
      })
      .collect();
    Ok((h, adaylar))
  })
  .await
  .map_err(|e| catisma(e.to_string()))?
  .map_err(gecersiz)?;
  let yanit = json!({
    "kimlik": h.kimlik,
    "adaylar": adaylar,
    "kurulumProgramlari": h.kurulum_programlari,
    "betikler": h.betikler,
    "digerKitaplik": h.diger_dll,
    "dosyaSayisi": h.dosya_sayisi,
    "uyarilar": {
      "kurulumProgrami": (!h.kurulum_programlari.is_empty()).then_some("Paketteki kurulum programları çalıştırılmaz; yalnız eklenti dosyaları kopyalanır."),
      "betik": (!h.betikler.is_empty()).then_some("OBS betikleri (Lua/Python) OBS'in betik aracını (frontend-tools) gerektirir; motorda desteklenmez."),
    },
  });
  audit(&state, &actor, "PLUGIN_PACKAGE_INSPECT", json!({"aday": h.adaylar.len()})).await;
  hazirliklar().lock().insert(h.kimlik.clone(), h);
  Ok(Json(yanit))
}

#[derive(Deserialize)]
struct KurGovdesi {
  kimlik: String,
  moduller: Vec<String>,
  #[serde(default)]
  etkinlestir: bool,
}

fn hazirligi_temizle(h: &Hazirlik) {
  if h.gecici {
    let _ = std::fs::remove_dir_all(&h.kok);
  }
}

async fn api_paket_kur(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<KurGovdesi>,
) -> ApiResult {
  let actor = yerel_yonetici(&state, &addr, &headers).await?;
  let h = hazirliklar().lock().remove(&g.kimlik).ok_or_else(|| gecersiz("inceleme bulunamadı (süresi dolmuş olabilir)"))?;
  let api = motor_api(&state);
  let (yon, yed) = (yonetilen(&state), yedekler(&state));
  let _k = state.eklenti_kilidi.lock().await;
  let (mut d, _) = kayit::oku(&state.data_dir);
  let mut kurulan = Vec::new();
  let mut hatalar = Vec::new();
  let b = Baglam::bu_makine();
  for m in &g.moduller {
    let Some(a) = h.adaylar.iter().find(|a| &a.modul == m) else {
      hatalar.push(json!({"modul": m, "hata": "pakette yok"}));
      continue;
    };
    // Kurulumdan önce yeniden çözümlenir: mimarisi uymayan ya da OBS eklentisi olmayan dosya kurulmaz
    let c = match cozumleme::cozumle(&a.dll, a.veri.as_deref(), &b) {
      Ok(c) => c,
      Err(e) => {
        hatalar.push(json!({"modul": m, "hata": e}));
        continue;
      }
    };
    let on = degerlendir(&c, None, api, None);
    if matches!(on.durum, Durum::ArchitectureMismatch | Durum::Unsupported | Durum::BlockedForSafety) {
      hatalar.push(json!({"modul": m, "hata": on.nedenler.first().cloned().unwrap_or_default()}));
      continue;
    }
    let i = d.eklentiler.iter().position(|e| &e.id == m);
    let eski_surum = i.and_then(|i| d.eklentiler[i].surum.clone());
    match paket::kur(a, &yon, &yed, eski_surum) {
      Ok((dll, veri, yedek)) => {
        let yeni = match cozumleme::cozumle(&dll, veri.as_deref(), &b) {
          Ok(x) => x,
          Err(e) => {
            hatalar.push(json!({"modul": m, "hata": e}));
            continue;
          }
        };
        let mut e = hizmet::kayit_yap(i.map(|i| &d.eklentiler[i]), &yeni, KonumTuru::Yonetilen, api);
        if let Some(y) = yedek {
          e.onceki_surumler.push(y);
        }
        if g.etkinlestir {
          e.etkin = true;
        }
        match i {
          Some(i) => d.eklentiler[i] = e.clone(),
          None => d.eklentiler.push(e.clone()),
        }
        kurulan.push(json!({"id": e.id, "durum": e.durum.arayuz(), "guncelleme": i.is_some()}));
      }
      Err(e) => hatalar.push(json!({"modul": m, "hata": e})),
    }
  }
  hazirligi_temizle(&h);
  kayit::yaz(&state.data_dir, &d).map_err(catisma)?;
  audit(&state, &actor, "PLUGIN_INSTALL", json!({"kurulan": kurulan.len(), "hata": hatalar.len()})).await;
  Ok(Json(json!({"kurulan": kurulan, "hatalar": hatalar, "yenidenBaslat": state.motor.calisiyor().await})))
}

#[derive(Deserialize)]
struct KimlikGovdesi {
  #[serde(default)]
  kimlik: String,
  #[serde(default)]
  id: String,
  #[serde(default)]
  onay: bool,
}

async fn api_paket_vazgec(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<KimlikGovdesi>,
) -> ApiResult {
  yerel_yonetici(&state, &addr, &headers).await?;
  if let Some(h) = hazirliklar().lock().remove(&g.kimlik) {
    hazirligi_temizle(&h);
  }
  Ok(Json(json!({"ok": true})))
}

// ─── Tek eklenti işlemleri ─────────────────────────────────────────────────

fn bul<'a>(d: &'a mut KayitDefteri, id: &str) -> Result<&'a mut EklentiKaydi, Hata> {
  d.eklentiler.iter_mut().find(|e| e.id == id).ok_or((StatusCode::NOT_FOUND, format!("eklenti yok: {id}")))
}

#[derive(Deserialize)]
struct EtkinGovdesi {
  id: String,
  etkin: bool,
  #[serde(default, rename = "acikOnay")]
  acik_onay: bool,
}

async fn api_etkin(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<EtkinGovdesi>,
) -> ApiResult {
  let actor = yerel_yonetici(&state, &addr, &headers).await?;
  let _k = state.eklenti_kilidi.lock().await;
  let (mut d, _) = kayit::oku(&state.data_dir);
  let e = bul(&mut d, &g.id)?;
  if g.etkin {
    if let Some(n) = &e.motor_notu {
      return Err(catisma(n.clone()));
    }
    if let Some(k) = &e.karantina {
      return Err(catisma(format!("Karantinada: {k}. Önce karantinadan çıkarın.")));
    }
    if !e.durum.yuklenebilir(g.acik_onay || e.acik_onay) {
      let ek = if e.durum.yuklenebilir(true) { " Açık onay gerekli (ön yüze bağlı ya da uyumluluk kipi)." } else { "" };
      return Err(catisma(format!("{}: {}.{ek}", e.durum.etiket(), e.nedenler.first().cloned().unwrap_or_default())));
    }
    e.acik_onay |= g.acik_onay;
  }
  e.etkin = g.etkin;
  let v = json!({"id": e.id, "etkin": e.etkin, "yuklenecek": e.yuklenecek()});
  kayit::yaz(&state.data_dir, &d).map_err(catisma)?;
  audit(&state, &actor, if g.etkin { "PLUGIN_ENABLE" } else { "PLUGIN_DISABLE" }, json!({"id": g.id})).await;
  let calisiyor = state.motor.calisiyor().await;
  Ok(Json(json!({"eklenti": v, "not": calisiyor.then_some("Değişiklik sonraki motor başlatmada geçerli olur")})))
}

async fn api_sina(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<KimlikGovdesi>,
) -> ApiResult {
  let actor = yerel_yonetici(&state, &addr, &headers).await?;
  if !g.onay {
    return Err((
      StatusCode::PRECONDITION_REQUIRED,
      "Onay gerekli: eklentinin kodu ayrı bir süreçte, sizin kullanıcı yetkilerinizle çalıştırılır (sanal alan değildir)".into(),
    ));
  }
  let exe = crate::motor_kopru::exe_yolu().ok_or_else(|| catisma("yayin-motoru.exe bulunamadı"))?;
  let (dll, veri) = {
    let (mut d, _) = kayit::oku(&state.data_dir);
    let e = bul(&mut d, &g.id)?;
    if e.motor_notu.is_some() {
      return Err(catisma(e.motor_notu.clone().unwrap_or_default()));
    }
    (e.dll.clone(), e.veri.clone())
  };
  let y = yoklama::yokla(&exe, &dll, veri.as_deref(), yoklama::VARSAYILAN_SURE).await;
  let api = motor_api(&state);
  let _k = state.eklenti_kilidi.lock().await;
  let (mut d, _) = kayit::oku(&state.data_dir);
  let e = bul(&mut d, &g.id)?;
  let c = hizmet::yeniden_cozumle(e, &Baglam::bu_makine()).ok_or_else(|| catisma("eklenti dosyası artık yok"))?;
  hizmet::yoklama_isle(e, &c, y.clone(), api, "yoklama");
  let v = kayit_json(e, false, &HashMap::new());
  kayit::yaz(&state.data_dir, &d).map_err(catisma)?;
  audit(&state, &actor, "PLUGIN_PROBE", json!({"id": g.id, "sonuc": y.sonuc, "kod": y.cikis_kodu})).await;
  Ok(Json(json!({"yoklama": y, "eklenti": v})))
}

#[derive(Deserialize)]
struct KarantinaGovdesi {
  id: String,
  /// al | cikar
  eylem: String,
  #[serde(default)]
  neden: String,
}

async fn api_karantina(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<KarantinaGovdesi>,
) -> ApiResult {
  let actor = yerel_yonetici(&state, &addr, &headers).await?;
  let api = motor_api(&state);
  let _k = state.eklenti_kilidi.lock().await;
  let (mut d, _) = kayit::oku(&state.data_dir);
  let e = bul(&mut d, &g.id)?;
  match g.eylem.as_str() {
    "al" => {
      let neden: String = g.neden.chars().filter(|c| !c.is_control()).take(200).collect();
      e.karantina = Some(if neden.trim().is_empty() { "Kullanıcı karantinaya aldı".into() } else { neden });
      e.etkin = false;
    }
    "cikar" => e.karantina = None,
    x => return Err(gecersiz(format!("bilinmeyen eylem: {x}"))),
  }
  if let Some(c) = hizmet::yeniden_cozumle(e, &Baglam::bu_makine()) {
    hizmet::degerlendir_kayit(e, &c, api);
  }
  let v = kayit_json(e, false, &HashMap::new());
  kayit::yaz(&state.data_dir, &d).map_err(catisma)?;
  audit(&state, &actor, "PLUGIN_QUARANTINE", json!({"id": g.id, "eylem": g.eylem})).await;
  Ok(Json(json!({"eklenti": v})))
}

async fn api_kaldir(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<KimlikGovdesi>,
) -> ApiResult {
  let actor = yerel_yonetici(&state, &addr, &headers).await?;
  if !g.onay {
    return Err((StatusCode::PRECONDITION_REQUIRED, "Onay gerekli".into()));
  }
  let _k = state.eklenti_kilidi.lock().await;
  let (mut d, _) = kayit::oku(&state.data_dir);
  let i = d.eklentiler.iter().position(|e| e.id == g.id).ok_or((StatusCode::NOT_FOUND, "eklenti yok".to_string()))?;
  let e = d.eklentiler[i].clone();
  let yedek = if e.konum == KonumTuru::Yonetilen {
    // Yönetilen kurulum yedeğe taşınır (kalıcı silinmez); geri almak için yedek klasörü kalır
    Some(paket::kaldir(&e.id, &yonetilen(&state), &yedekler(&state), e.surum.clone()).map_err(catisma)?)
  } else {
    // OBS ya da özel klasördeki başvuru: yalnız kayıttan çıkarılır, dosyaya dokunulmaz
    None
  };
  d.eklentiler.remove(i);
  kayit::yaz(&state.data_dir, &d).map_err(catisma)?;
  audit(&state, &actor, "PLUGIN_UNINSTALL", json!({"id": g.id, "yonetilen": yedek.is_some()})).await;
  Ok(Json(json!({"ok": true, "yedek": yedek, "not": state.motor.calisiyor().await.then_some("Çalışan motorda yüklüyse sonraki başlatmada kalkar")})))
}

async fn api_geri_al(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<KimlikGovdesi>,
) -> ApiResult {
  let actor = yerel_yonetici(&state, &addr, &headers).await?;
  let api = motor_api(&state);
  let _k = state.eklenti_kilidi.lock().await;
  let (mut d, _) = kayit::oku(&state.data_dir);
  let e = bul(&mut d, &g.id)?;
  if e.konum != KonumTuru::Yonetilen {
    return Err(catisma("Yalnız bu uygulamanın kurduğu eklenti geri alınabilir"));
  }
  let y = e.onceki_surumler.pop().ok_or_else(|| catisma("önceki sürüm yedeği yok"))?;
  let simdiki = paket::geri_al(&e.id, &y, &yonetilen(&state), &yedekler(&state), e.surum.clone()).map_err(|x| {
    catisma(x)
  })?;
  let dll = yonetilen(&state).join(&e.id).join("bin").join("64bit").join(format!("{}.dll", e.id));
  let veri = yonetilen(&state).join(&e.id).join("data");
  let c = cozumleme::cozumle(&dll, veri.is_dir().then_some(veri.as_path()), &Baglam::bu_makine()).map_err(catisma)?;
  let mut yeni = hizmet::kayit_yap(Some(e), &c, KonumTuru::Yonetilen, api);
  yeni.onceki_surumler.push(simdiki);
  *e = yeni;
  let v = kayit_json(e, false, &HashMap::new());
  kayit::yaz(&state.data_dir, &d).map_err(catisma)?;
  audit(&state, &actor, "PLUGIN_ROLLBACK", json!({"id": g.id, "surum": y.surum})).await;
  Ok(Json(json!({"eklenti": v})))
}

#[derive(Deserialize)]
struct KonumGovdesi {
  /// ekle | kaldir | etkin
  eylem: String,
  yol: PathBuf,
  #[serde(default)]
  etkin: bool,
}

async fn api_konum(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<KonumGovdesi>,
) -> ApiResult {
  let actor = yerel_yonetici(&state, &addr, &headers).await?;
  let _k = state.eklenti_kilidi.lock().await;
  let (mut d, _) = kayit::oku(&state.data_dir);
  match g.eylem.as_str() {
    "ekle" => {
      if !g.yol.is_absolute() || !g.yol.is_dir() {
        return Err(gecersiz("klasör mutlak yol olmalı ve var olmalı"));
      }
      if d.konumlar.iter().any(|k| k.yol == g.yol) {
        return Err(catisma("bu klasör zaten ekli"));
      }
      if d.konumlar.len() >= 32 {
        return Err(catisma("en çok 32 özel konum"));
      }
      d.konumlar.push(Konum { yol: g.yol.clone(), tur: KonumTuru::Ozel, etkin: true, eklendi: kayit::simdi() });
    }
    "kaldir" => d.konumlar.retain(|k| k.yol != g.yol),
    "etkin" => {
      let k = d.konumlar.iter_mut().find(|k| k.yol == g.yol).ok_or((StatusCode::NOT_FOUND, "konum yok".to_string()))?;
      k.etkin = g.etkin;
    }
    x => return Err(gecersiz(format!("bilinmeyen eylem: {x}"))),
  }
  kayit::yaz(&state.data_dir, &d).map_err(catisma)?;
  audit(&state, &actor, "PLUGIN_LOCATION", json!({"eylem": g.eylem})).await;
  Ok(Json(json!({"konumlar": d.konumlar})))
}

#[derive(Deserialize)]
struct GunlukSorgusu {
  id: String,
}

/// Motorun libobs günlüğünden bu eklentiye ait satırlar (modül adı ya da görünen adı geçen), gizlenmiş.
async fn api_gunluk(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Query(q): Query<GunlukSorgusu>,
) -> ApiResult {
  authorize(&state, &addr, &headers, "plugins.read").await?;
  let (mut d, _) = kayit::oku(&state.data_dir);
  let e = bul(&mut d, &q.id)?.clone();
  let yol = state.data_dir.join("motor").join("motor-libobs.log");
  let satirlar = crate::destek::son_satirlar(&yol, 5000);
  let aranan: Vec<String> = [e.id.to_lowercase(), e.ad.to_lowercase()].into_iter().filter(|s| s.len() >= 3).collect();
  let mut g = crate::destek::Gizleyici::new(Vec::new(), std::env::var("USERPROFILE").ok());
  let secilen: Vec<String> = satirlar
    .iter()
    .filter(|s| {
      let k = s.to_lowercase();
      aranan.iter().any(|a| k.contains(a.as_str()))
    })
    .rev()
    .take(200)
    .map(|s| g.metin(s))
    .collect::<Vec<_>>()
    .into_iter()
    .rev()
    .collect();
  Ok(Json(json!({"id": e.id, "satirlar": secilen})))
}
