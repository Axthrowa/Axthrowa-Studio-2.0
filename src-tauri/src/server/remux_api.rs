//! Yeniden muxlama kuyruğu (OBS "Dosya › Yeniden muxla"): seçilen kayıtlar sırayla, yeniden kodlanmadan başka kaba
//! (varsayılan MP4) kopyalanır. Her dosya motorun `remux` alt sürecinde işlenir (penceresiz; motor/yayın etkilenmez).
//!
//! Güvenlik: yalnız bu bilgisayardan (dosya yolları yereldir); girdi mutlak yol ve bilinen kayıt uzantısı olmalı;
//! çıktı girdiyle aynı klasörde aynı adla yeni uzantıdadır ve var olan dosyanın üzerine yazılmaz.

use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;

use axum::extract::{ConnectInfo, State};
use axum::http::{HeaderMap, StatusCode};
use axum::routing::{get, post};
use axum::{Json, Router};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::io::AsyncBufReadExt;

use super::control_plane::{audit, authorize};
use super::motor_api::{kayit_klasoru, klasor, Hata};
use crate::AppState;

type ApiResult = Result<Json<Value>, Hata>;

/// OBS kayıtlarında görülen kaplar (girdi)
const GIRDI_UZANTILARI: &[&str] = &["mkv", "flv", "ts", "mov", "mp4", "m4v", "fmp4"];
const CIKTI_BICIMLERI: &[&str] = &["mp4", "mov", "mkv"];

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Durum {
  Bekliyor,
  Suruyor,
  Tamam,
  Hata,
  Iptal,
}

#[derive(Clone, Debug, Serialize)]
pub struct Is {
  pub girdi: PathBuf,
  pub cikti: PathBuf,
  pub durum: Durum,
  pub ilerleme: f64,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub hata: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub sonuc: Option<Value>,
  /// Klip kırpma aralığı (sn); yoksa tüm dosya
  #[serde(skip_serializing_if = "Option::is_none")]
  pub aralik: Option<[f64; 2]>,
}

#[derive(Default)]
struct Kuyruk {
  isler: Vec<Is>,
  calisiyor: bool,
  /// Sürmekte olan alt sürecin kimliği (iptal için)
  pid: Option<u32>,
}

static KUYRUK: Mutex<Kuyruk> = Mutex::new(Kuyruk { isler: Vec::new(), calisiyor: false, pid: None });

pub fn router() -> Router<Arc<AppState>> {
  Router::new()
    .route("/api/motor/klipler", get(api_klipler))
    .route("/api/motor/klip", get(api_klip))
    .route("/api/motor/remux", get(api_durum).post(api_ekle))
    .route("/api/motor/remux/iptal", post(api_iptal))
    .route("/api/motor/remux/temizle", post(api_temizle))
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

fn uzanti(p: &Path) -> String {
  p.extension().and_then(|e| e.to_str()).unwrap_or("").to_ascii_lowercase()
}

/// Girdi ve biçimden çıktı yolu; kurala uymayan girdi reddedilir
pub fn cikti_yolu(girdi: &Path, bicim: &str) -> Result<PathBuf, String> {
  if !girdi.is_absolute() {
    return Err("dosya yolu mutlak olmalı".into());
  }
  if !GIRDI_UZANTILARI.contains(&uzanti(girdi).as_str()) {
    return Err(format!("desteklenmeyen kayıt uzantısı: {}", girdi.display()));
  }
  if !CIKTI_BICIMLERI.contains(&bicim) {
    return Err("çıktı biçimi mp4, mov ya da mkv olmalı".into());
  }
  if uzanti(girdi) == bicim {
    return Err(format!("dosya zaten .{bicim}: {}", girdi.display()));
  }
  Ok(girdi.with_extension(bicim))
}

/// Klip kırpma çıktısı: aynı klasörde `<ad> klip <bas>-<bit>.<biçim>` (saniyeler tam sayıya yuvarlanır)
pub fn klip_yolu(girdi: &Path, bicim: &str, [bas, bit]: [f64; 2]) -> Result<PathBuf, String> {
  if !girdi.is_absolute() {
    return Err("dosya yolu mutlak olmalı".into());
  }
  if !GIRDI_UZANTILARI.contains(&uzanti(girdi).as_str()) {
    return Err(format!("desteklenmeyen kayıt uzantısı: {}", girdi.display()));
  }
  if !CIKTI_BICIMLERI.contains(&bicim) {
    return Err("çıktı biçimi mp4, mov ya da mkv olmalı".into());
  }
  let kok = girdi.file_stem().and_then(|s| s.to_str()).unwrap_or("klip");
  Ok(girdi.with_file_name(format!("{kok} klip {}-{}.{bicim}", bas.floor() as u64, bit.ceil() as u64)))
}

/// Kayıt klasöründeki tek bir dosyanın yolu: ad yalnız dosya adı (klasör ayırıcı, `..` yok) ve bilinen video uzantısı
pub fn klasordeki_dosya(klasor: &Path, ad: &str) -> Option<PathBuf> {
  if ad.is_empty() || ad.len() > 255 || ad.contains(['/', '\\', ':']) || ad.contains("..") {
    return None;
  }
  let p = klasor.join(ad);
  (GIRDI_UZANTILARI.contains(&uzanti(&p).as_str()) && p.is_file()).then_some(p)
}

fn kayit_yeri(state: &AppState) -> PathBuf {
  crate::motor_profil::etkin(&klasor(state)).kayit.klasor.map(PathBuf::from).unwrap_or_else(kayit_klasoru)
}

/// Kayıt klasöründeki son kayıtlar (en yeni önce, en çok 50) — remux penceresinde seçim listesi
fn son_kayitlar(klasor: &Path) -> Vec<Value> {
  let mut v: Vec<(std::time::SystemTime, PathBuf, u64)> = std::fs::read_dir(klasor)
    .into_iter()
    .flatten()
    .flatten()
    .filter_map(|e| {
      let p = e.path();
      let m = e.metadata().ok()?;
      let uygun = m.is_file() && GIRDI_UZANTILARI.contains(&uzanti(&p).as_str()) && uzanti(&p) != "mp4";
      uygun.then_some((m.modified().ok()?, p, m.len()))
    })
    .collect();
  v.sort_by_key(|x| std::cmp::Reverse(x.0));
  v.into_iter().take(50).map(|(_, p, boyut)| json!({"yol": p, "boyut": boyut})).collect()
}

async fn api_durum(State(state): State<Arc<AppState>>, ConnectInfo(addr): ConnectInfo<SocketAddr>, headers: HeaderMap) -> ApiResult {
  yerel(&addr)?;
  authorize(&state, &addr, &headers, "broadcast.read").await?;
  let k = KUYRUK.lock();
  let yer = kayit_yeri(&state);
  Ok(Json(json!({"isler": k.isler, "calisiyor": k.calisiyor, "kayitKlasoru": yer, "kayitlar": son_kayitlar(&yer)})))
}

#[derive(Deserialize)]
struct EkleGovdesi {
  dosyalar: Vec<String>,
  #[serde(default)]
  bicim: Option<String>,
  /// Klip kırpma (Backtrack): [başlangıç, bitiş] sn; yalnız tek dosyayla
  #[serde(default)]
  aralik: Option<[f64; 2]>,
}

async fn api_ekle(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<EkleGovdesi>,
) -> ApiResult {
  yerel(&addr)?;
  let actor = authorize(&state, &addr, &headers, "broadcast.record").await?;
  let exe = crate::motor_kopru::exe_yolu().ok_or((StatusCode::CONFLICT, "yayin-motoru bulunamadı".to_string()))?;
  let bicim = g.bicim.unwrap_or_else(|| "mp4".into());
  if g.dosyalar.is_empty() || g.dosyalar.len() > 100 {
    return Err(gecersiz("1–100 dosya seçin"));
  }
  if let Some([bas, bit]) = g.aralik {
    if g.dosyalar.len() != 1 || !(bas.is_finite() && bit.is_finite() && bas >= 0.0 && bit > bas && bit - bas <= 24.0 * 3600.0) {
      return Err(gecersiz("kırpma: tek dosya ve 0 ≤ başlangıç < bitiş"));
    }
  }
  let mut yeni = Vec::new();
  for d in &g.dosyalar {
    let girdi = PathBuf::from(d);
    // Kırpmada çıktı girdiyle aynı kapta olabilir: ad "<ad> klip <bas>-<bit>"
    let cikti = match g.aralik {
      Some(a) => klip_yolu(&girdi, &bicim, a).map_err(gecersiz)?,
      None => cikti_yolu(&girdi, &bicim).map_err(gecersiz)?,
    };
    if !girdi.is_file() {
      return Err(gecersiz(format!("dosya yok: {}", girdi.display())));
    }
    if cikti.exists() {
      return Err((StatusCode::CONFLICT, format!("çıktı zaten var (üzerine yazılmaz): {}", cikti.display())));
    }
    yeni.push(Is { girdi, cikti, durum: Durum::Bekliyor, ilerleme: 0.0, hata: None, sonuc: None, aralik: g.aralik });
  }
  let baslat = {
    let mut k = KUYRUK.lock();
    for i in &yeni {
      if k.isler.iter().any(|x| x.cikti == i.cikti && matches!(x.durum, Durum::Bekliyor | Durum::Suruyor)) {
        return Err((StatusCode::CONFLICT, format!("zaten kuyrukta: {}", i.girdi.display())));
      }
    }
    k.isler.extend(yeni.iter().cloned());
    !std::mem::replace(&mut k.calisiyor, true)
  };
  if baslat {
    tokio::spawn(isle(exe));
  }
  audit(&state, &actor, "MOTOR_REMUX", json!({"sayi": yeni.len(), "bicim": bicim})).await;
  Ok(Json(json!({"ok": true, "eklenen": yeni.len()})))
}

/// Kuyruktaki bekleyen işleri sırayla işler; iş kalmayınca durur
async fn isle(exe: PathBuf) {
  loop {
    let sira = {
      let mut k = KUYRUK.lock();
      match k.isler.iter().position(|i| i.durum == Durum::Bekliyor) {
        Some(n) => {
          k.isler[n].durum = Durum::Suruyor;
          Some((n, k.isler[n].girdi.clone(), k.isler[n].cikti.clone(), k.isler[n].aralik))
        }
        None => {
          k.calisiyor = false;
          k.pid = None;
          None
        }
      }
    };
    let Some((n, girdi, cikti, aralik)) = sira else { return };
    let sonuc = tek(&exe, n, &girdi, &cikti, aralik).await;
    let mut k = KUYRUK.lock();
    k.pid = None;
    if let Some(i) = k.isler.get_mut(n) {
      if i.durum == Durum::Suruyor {
        match sonuc {
          Ok(v) => {
            i.durum = Durum::Tamam;
            i.ilerleme = 1.0;
            i.sonuc = Some(v);
          }
          Err(e) => {
            i.durum = Durum::Hata;
            i.hata = Some(e);
          }
        }
      }
    }
  }
}

async fn tek(exe: &Path, n: usize, girdi: &Path, cikti: &Path, aralik: Option<[f64; 2]>) -> Result<Value, String> {
  let mut komut = tokio::process::Command::new(exe);
  komut.arg("remux").arg(girdi).arg(cikti);
  if let Some([b, e]) = aralik {
    komut.arg(format!("{b:.3}")).arg(format!("{e:.3}"));
  }
  komut.stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::null()).kill_on_drop(true);
  #[cfg(windows)]
  {
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    komut.creation_flags(CREATE_NO_WINDOW);
  }
  let mut cocuk = komut.spawn().map_err(|e| format!("remux süreci başlatılamadı: {e}"))?;
  KUYRUK.lock().pid = cocuk.id();
  let mut satirlar = tokio::io::BufReader::new(cocuk.stdout.take().ok_or("çıktı yok")?).lines();
  let mut son: Option<Value> = None;
  while let Ok(Some(s)) = satirlar.next_line().await {
    let Ok(v) = serde_json::from_str::<Value>(&s) else { continue };
    if let Some(x) = v["ilerleme"].as_f64() {
      if let Some(i) = KUYRUK.lock().isler.get_mut(n) {
        i.ilerleme = x.clamp(0.0, 1.0);
      }
    } else {
      son = Some(v);
    }
  }
  let _ = cocuk.wait().await;
  match son {
    Some(v) if v["tamam"] == true => Ok(v["sonuc"].clone()),
    Some(v) => Err(v["hata"].as_str().unwrap_or("bilinmeyen hata").to_string()),
    None => Err("remux süreci sonuç vermeden bitti (iptal edildi ya da çöktü)".into()),
  }
}

async fn api_iptal(State(state): State<Arc<AppState>>, ConnectInfo(addr): ConnectInfo<SocketAddr>, headers: HeaderMap) -> ApiResult {
  yerel(&addr)?;
  let actor = authorize(&state, &addr, &headers, "broadcast.record").await?;
  let pid = {
    let mut k = KUYRUK.lock();
    for i in k.isler.iter_mut().filter(|i| matches!(i.durum, Durum::Bekliyor | Durum::Suruyor)) {
      i.durum = Durum::Iptal;
    }
    k.pid.take()
  };
  // Alt süreç sonlandırılır; motorun yazdığı geçici dosya bir sonraki denemede silinir (çıktı adı hiç oluşmaz)
  if let Some(p) = pid {
    #[cfg(windows)]
    {
      let mut k = std::process::Command::new("taskkill");
      k.args(["/PID", &p.to_string(), "/T", "/F"]).stdout(Stdio::null()).stderr(Stdio::null());
      use std::os::windows::process::CommandExt;
      k.creation_flags(0x0800_0000);
      let _ = k.status();
    }
  }
  audit(&state, &actor, "MOTOR_REMUX_CANCEL", json!({})).await;
  Ok(Json(json!({"ok": true})))
}

async fn api_temizle(State(state): State<Arc<AppState>>, ConnectInfo(addr): ConnectInfo<SocketAddr>, headers: HeaderMap) -> ApiResult {
  yerel(&addr)?;
  authorize(&state, &addr, &headers, "broadcast.record").await?;
  KUYRUK.lock().isler.retain(|i| matches!(i.durum, Durum::Bekliyor | Durum::Suruyor));
  Ok(Json(json!({"ok": true})))
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn klip_adi_ve_klasor_disina_cikilmaz() {
    let g = Path::new(r"C:\kayit\Tekrar 1.mkv");
    assert_eq!(klip_yolu(g, "mp4", [4.2, 11.6]).unwrap(), PathBuf::from(r"C:\kayit\Tekrar 1 klip 4-12.mp4"));
    assert!(klip_yolu(Path::new("x.mkv"), "mp4", [0.0, 1.0]).is_err());
    let d = std::env::temp_dir().join(format!("yya-klip-{}", std::process::id()));
    std::fs::create_dir_all(&d).unwrap();
    std::fs::write(d.join("a.mkv"), b"x").unwrap();
    assert_eq!(klasordeki_dosya(&d, "a.mkv"), Some(d.join("a.mkv")));
    for kotu in ["../a.mkv", r"..\a.mkv", "C:a.mkv", "alt/a.mkv", "a.exe", "yok.mkv", ""] {
      assert_eq!(klasordeki_dosya(&d, kotu), None, "{kotu}");
    }
    let _ = std::fs::remove_dir_all(&d);
  }

  #[test]
  fn cikti_kurallari() {
    let g = Path::new(r"C:\kayit\a.mkv");
    assert_eq!(cikti_yolu(g, "mp4").unwrap(), PathBuf::from(r"C:\kayit\a.mp4"));
    assert!(cikti_yolu(Path::new("a.mkv"), "mp4").is_err(), "göreli yol");
    assert!(cikti_yolu(Path::new(r"C:\a.exe"), "mp4").is_err(), "kayıt değil");
    assert!(cikti_yolu(g, "avi").is_err(), "bilinmeyen biçim");
    assert!(cikti_yolu(Path::new(r"C:\a.mp4"), "mp4").is_err(), "aynı kap");
  }
}


/// Klipler (Backtrack): kayıt klasöründeki video dosyaları, en yeni önce (en çok 100)
async fn api_klipler(State(state): State<Arc<AppState>>, ConnectInfo(addr): ConnectInfo<SocketAddr>, headers: HeaderMap) -> ApiResult {
  yerel(&addr)?;
  authorize(&state, &addr, &headers, "broadcast.read").await?;
  let yer = kayit_yeri(&state);
  let mut v: Vec<(std::time::SystemTime, String, u64)> = std::fs::read_dir(&yer)
    .into_iter()
    .flatten()
    .flatten()
    .filter_map(|e| {
      let p = e.path();
      let m = e.metadata().ok()?;
      let uygun = m.is_file() && GIRDI_UZANTILARI.contains(&uzanti(&p).as_str());
      uygun.then_some((m.modified().ok()?, p.file_name()?.to_string_lossy().into_owned(), m.len()))
    })
    .collect();
  v.sort_by_key(|x| std::cmp::Reverse(x.0));
  let klipler: Vec<Value> = v
    .into_iter()
    .take(100)
    .map(|(z, ad, boyut)| {
      let ms = z.duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0);
      json!({"ad": ad, "boyut": boyut, "zaman": ms, "tekrar": ad.starts_with("Tekrar") || ad.starts_with("Replay")})
    })
    .collect();
  Ok(Json(json!({"kayitKlasoru": yer, "klipler": klipler})))
}

#[derive(Deserialize)]
struct KlipSorgusu {
  ad: String,
}

/// Klip önizlemesi: kayıt klasöründeki dosyayı (Range destekli) sunar; yalnız bu bilgisayardan, yalnız dosya adıyla
async fn api_klip(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  axum::extract::Query(q): axum::extract::Query<KlipSorgusu>,
  istek: axum::extract::Request,
) -> Result<axum::response::Response, Hata> {
  yerel(&addr)?;
  authorize(&state, &addr, &headers, "broadcast.read").await?;
  let yol = klasordeki_dosya(&kayit_yeri(&state), &q.ad).ok_or((StatusCode::NOT_FOUND, "klip yok".to_string()))?;
  use tower::ServiceExt;
  let yanit = tower_http::services::ServeFile::new(yol).oneshot(istek).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  Ok(axum::response::IntoResponse::into_response(yanit))
}
