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
  let mut yeni = Vec::new();
  for d in &g.dosyalar {
    let girdi = PathBuf::from(d);
    let cikti = cikti_yolu(&girdi, &bicim).map_err(gecersiz)?;
    if !girdi.is_file() {
      return Err(gecersiz(format!("dosya yok: {}", girdi.display())));
    }
    if cikti.exists() {
      return Err((StatusCode::CONFLICT, format!("çıktı zaten var (üzerine yazılmaz): {}", cikti.display())));
    }
    yeni.push(Is { girdi, cikti, durum: Durum::Bekliyor, ilerleme: 0.0, hata: None, sonuc: None });
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
          Some((n, k.isler[n].girdi.clone(), k.isler[n].cikti.clone()))
        }
        None => {
          k.calisiyor = false;
          k.pid = None;
          None
        }
      }
    };
    let Some((n, girdi, cikti)) = sira else { return };
    let sonuc = tek(&exe, n, &girdi, &cikti).await;
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

async fn tek(exe: &Path, n: usize, girdi: &Path, cikti: &Path) -> Result<Value, String> {
  let mut komut = tokio::process::Command::new(exe);
  komut.arg("remux").arg(girdi).arg(cikti).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::null()).kill_on_drop(true);
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
  fn cikti_kurallari() {
    let g = Path::new(r"C:\kayit\a.mkv");
    assert_eq!(cikti_yolu(g, "mp4").unwrap(), PathBuf::from(r"C:\kayit\a.mp4"));
    assert!(cikti_yolu(Path::new("a.mkv"), "mp4").is_err(), "göreli yol");
    assert!(cikti_yolu(Path::new(r"C:\a.exe"), "mp4").is_err(), "kayıt değil");
    assert!(cikti_yolu(g, "avi").is_err(), "bilinmeyen biçim");
    assert!(cikti_yolu(Path::new(r"C:\a.mp4"), "mp4").is_err(), "aynı kap");
  }
}
