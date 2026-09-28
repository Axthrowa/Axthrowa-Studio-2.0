//! obs-websocket 5.x uyumlu sunucu — kendi uygulamamız (plan F10, ADR-005). Protokol: obs-websocket'in yayımlanmış
//! protokol belgesi (rpcVersion 1: Hello/Identify/Identified/Reidentify, Request/RequestResponse, RequestBatch,
//! Event; kimlik doğrulama base64(sha256(base64(sha256(parola + tuz)) + meydan okuma))).
//!
//! Stream Deck, Touch Portal, Streamer.bot gibi araçlar uygulamayı OBS gibi denetleyebilsin diye: sahneler (ana tuval),
//! girişler (ses), sahne öğeleri, filtreler, Studio Mode, kayıt/tekrar/sanal kamera, yayın durumu.
//!
//! Güvenlik: varsayılan KAPALI; yalnız 127.0.0.1'e bağlanır; parola zorunlu (Windows Kimlik Yöneticisi'nde,
//! `obs-websocket.parola`); yayını başlatan/durduran istekler ayrı izinle (`yayin_denetimi`) — kapalıyken 703 döner.
//! Kullanıcının kendi OBS'inin obs-websocket'iyle (4455) çakışmasın diye varsayılan port 4456.

use std::collections::HashMap;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use axum::extract::{ConnectInfo, State};
use axum::http::{HeaderMap, StatusCode};
use axum::routing::{get, post};
use axum::{Json, Router};
use base64::Engine as _;
use futures_util::{SinkExt, StreamExt};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use tokio::sync::broadcast;
use tokio_tungstenite::tungstenite::protocol::frame::coding::CloseCode;
use tokio_tungstenite::tungstenite::protocol::CloseFrame;
use tokio_tungstenite::tungstenite::Message;

use super::control_plane::{audit, authorize};
use super::motor_api::{self, cikis_etkin, klasor, komut, Hata};
use crate::motor_koleksiyon::{ad_esit, OgeTuru};
use crate::AppState;

pub const SURUM: &str = "5.5.0";
pub const RPC_SURUMU: u64 = 1;
const PAROLA_ANAHTARI: &str = "obs-websocket.parola";
const AYAR_DOSYASI: &str = "obs-websocket.json";

// ─── Ayarlar ───────────────────────────────────────────────────────────────

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct Ayar {
  pub etkin: bool,
  pub port: u16,
  /// StartStream / StopStream / ToggleStream izni (gerçek platformlara yayını başlatır/keser)
  pub yayin_denetimi: bool,
}

impl Default for Ayar {
  fn default() -> Self {
    Ayar { etkin: false, port: 4456, yayin_denetimi: false }
  }
}

fn ayar_yolu(state: &AppState) -> PathBuf {
  state.data_dir.join(AYAR_DOSYASI)
}

pub fn ayar_oku(state: &AppState) -> Ayar {
  std::fs::read_to_string(ayar_yolu(state)).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default()
}

fn ayar_yaz(state: &AppState, a: &Ayar) -> Result<(), String> {
  let t = serde_json::to_string_pretty(a).map_err(|e| e.to_string())?;
  std::fs::write(ayar_yolu(state), t).map_err(|e| e.to_string())
}

fn rastgele(bayt: usize) -> String {
  let mut v = Vec::with_capacity(bayt);
  while v.len() < bayt {
    v.extend_from_slice(uuid::Uuid::new_v4().as_bytes());
  }
  v.truncate(bayt);
  base64::engine::general_purpose::STANDARD.encode(v)
}

/// Parola yoksa üretir (Kimlik Yöneticisi'ne). Düz metne sessizce düşülmez: yazılamazsa hata.
fn parola(yenile: bool) -> Result<String, String> {
  if !yenile {
    if let Some(p) = crate::secret_store::get_secret(PAROLA_ANAHTARI).filter(|p| !p.is_empty()) {
      return Ok(p);
    }
  }
  let yeni: String = rastgele(18).chars().filter(|c| c.is_ascii_alphanumeric()).take(16).collect();
  if !crate::secret_store::set_secret(PAROLA_ANAHTARI, &yeni) {
    return Err("parola Kimlik Yöneticisi'ne yazılamadı".into());
  }
  Ok(yeni)
}

/// base64(sha256(base64(sha256(parola + tuz)) + meydan okuma))
pub fn kimlik_dizesi(parola: &str, tuz: &str, meydan: &str) -> String {
  let b64 = |v: &[u8]| base64::engine::general_purpose::STANDARD.encode(v);
  let gizli = b64(&Sha256::digest(format!("{parola}{tuz}").as_bytes()));
  b64(&Sha256::digest(format!("{gizli}{meydan}").as_bytes()))
}

// ─── Sunucu yaşam döngüsü ──────────────────────────────────────────────────

struct Calisan {
  port: u16,
  gorev: tokio::task::AbortHandle,
}

static CALISAN: Mutex<Option<Calisan>> = Mutex::new(None);
static GELEN: AtomicU64 = AtomicU64::new(0);
static GIDEN: AtomicU64 = AtomicU64::new(0);

/// Ayara göre sunucuyu durdurur/başlatır. Dönüş: dinlenen port (kapalıysa None).
pub async fn uygula(state: Arc<AppState>) -> Result<Option<u16>, String> {
  if let Some(c) = CALISAN.lock().take() {
    c.gorev.abort();
  }
  let a = ayar_oku(&state);
  if !a.etkin {
    return Ok(None);
  }
  parola(false)?;
  let dinleyici = tokio::net::TcpListener::bind(("127.0.0.1", a.port)).await.map_err(|e| format!("127.0.0.1:{} dinlenemedi: {e}", a.port))?;
  let port = dinleyici.local_addr().map(|x| x.port()).unwrap_or(a.port);
  let (olaylar, _) = broadcast::channel::<Arc<Value>>(256);
  let tx = olaylar.clone();
  let st = state.clone();
  let gorev = tokio::spawn(async move {
    let izleyici = tokio::spawn(olay_izleyici(st.clone(), tx.clone()));
    loop {
      let Ok((soket, adres)) = dinleyici.accept().await else { break };
      if !adres.ip().is_loopback() {
        continue;
      }
      let st = st.clone();
      let rx = tx.subscribe();
      tokio::spawn(async move {
        if let Err(e) = baglanti(st, soket, rx).await {
          crate::yya_warn!("[obs-websocket] bağlantı: {e}");
        }
      });
    }
    izleyici.abort();
  })
  .abort_handle();
  *CALISAN.lock() = Some(Calisan { port, gorev });
  crate::yya_log!("[obs-websocket] 127.0.0.1:{port} dinleniyor");
  Ok(Some(port))
}

pub fn calisan_port() -> Option<u16> {
  CALISAN.lock().as_ref().map(|c| c.port)
}

// ─── Bağlantı ──────────────────────────────────────────────────────────────

const ABONELIK_TUMU: u64 = 0x7FF;
const AB_SAHNELER: u64 = 1 << 2;
const AB_GIRISLER: u64 = 1 << 3;
const AB_CIKTILAR: u64 = 1 << 6;
const AB_ARAYUZ: u64 = 1 << 10;

fn mesaj(op: u64, d: Value) -> Message {
  GIDEN.fetch_add(1, Ordering::Relaxed);
  Message::Text(json!({"op": op, "d": d}).to_string().into())
}

// El sıkışma geri çağrısının hata türü (ErrorResponse) tungstenite'in imzasıdır; küçültülemez
#[allow(clippy::result_large_err)]
async fn baglanti(state: Arc<AppState>, soket: tokio::net::TcpStream, mut olaylar: broadcast::Receiver<Arc<Value>>) -> Result<(), String> {
  // Alt protokol: obswebsocket.json (msgpack desteklenmez; istemci yalnız onu isterse el sıkışma yine json'dur)
  let geri = |istek: &tokio_tungstenite::tungstenite::handshake::server::Request, mut yanit: tokio_tungstenite::tungstenite::handshake::server::Response| {
    let ister = istek.headers().get("sec-websocket-protocol").and_then(|v| v.to_str().ok()).is_some_and(|v| v.split(',').any(|p| p.trim() == "obswebsocket.json"));
    if ister {
      yanit.headers_mut().insert("sec-websocket-protocol", "obswebsocket.json".parse().unwrap());
    }
    Ok(yanit)
  };
  let ws = tokio_tungstenite::accept_hdr_async(soket, geri).await.map_err(|e| e.to_string())?;
  let (mut gonder, mut al) = ws.split();
  let (tuz, meydan) = (rastgele(32), rastgele(32));
  gonder
    .send(mesaj(0, json!({"obsWebSocketVersion": SURUM, "rpcVersion": RPC_SURUMU, "authentication": {"challenge": meydan, "salt": tuz}})))
    .await
    .map_err(|e| e.to_string())?;
  let kapat = |kod: u16, neden: &str| {
    Message::Close(Some(CloseFrame { code: CloseCode::from(kod), reason: neden.to_string().into() }))
  };
  // Identify (10 sn içinde)
  let ilk = tokio::time::timeout(std::time::Duration::from_secs(10), al.next()).await;
  let Ok(Some(Ok(Message::Text(t)))) = ilk else {
    let _ = gonder.send(kapat(4008, "Identify bekleniyordu")).await;
    return Ok(());
  };
  GELEN.fetch_add(1, Ordering::Relaxed);
  let v: Value = serde_json::from_str(&t).unwrap_or(Value::Null);
  if v["op"] != 1 {
    let _ = gonder.send(kapat(4007, "önce Identify gönderilmeli")).await;
    return Ok(());
  }
  if v["d"]["rpcVersion"].as_u64() != Some(RPC_SURUMU) {
    let _ = gonder.send(kapat(4010, "desteklenmeyen rpcVersion")).await;
    return Ok(());
  }
  let beklenen = kimlik_dizesi(&parola(false)?, &tuz, &meydan);
  if v["d"]["authentication"].as_str() != Some(beklenen.as_str()) {
    let _ = gonder.send(kapat(4009, "kimlik doğrulama başarısız")).await;
    return Ok(());
  }
  let mut abonelik = v["d"]["eventSubscriptions"].as_u64().unwrap_or(ABONELIK_TUMU);
  gonder.send(mesaj(2, json!({"negotiatedRpcVersion": RPC_SURUMU}))).await.map_err(|e| e.to_string())?;

  loop {
    tokio::select! {
      gelen = al.next() => {
        let Some(Ok(m)) = gelen else { break };
        let Message::Text(t) = m else {
          if matches!(m, Message::Close(_)) { break }
          continue;
        };
        GELEN.fetch_add(1, Ordering::Relaxed);
        let v: Value = match serde_json::from_str(&t) {
          Ok(v) => v,
          Err(_) => {
            let _ = gonder.send(kapat(4002, "JSON çözümlenemedi")).await;
            break;
          }
        };
        match v["op"].as_u64() {
          Some(3) => {
            abonelik = v["d"]["eventSubscriptions"].as_u64().unwrap_or(abonelik);
            gonder.send(mesaj(2, json!({"negotiatedRpcVersion": RPC_SURUMU}))).await.map_err(|e| e.to_string())?;
          }
          Some(6) => {
            let d = &v["d"];
            let yanit = istek_yanit(&state, d["requestType"].as_str().unwrap_or(""), d["requestId"].clone(), &d["requestData"]).await;
            gonder.send(mesaj(7, yanit)).await.map_err(|e| e.to_string())?;
          }
          Some(8) => {
            let d = &v["d"];
            let dur = d["haltOnFailure"].as_bool().unwrap_or(false);
            let mut sonuclar = Vec::new();
            for r in d["requests"].as_array().into_iter().flatten().take(100) {
              let y = istek_yanit(&state, r["requestType"].as_str().unwrap_or(""), r["requestId"].clone(), &r["requestData"]).await;
              let basarili = y["requestStatus"]["result"] == true;
              sonuclar.push(y);
              if dur && !basarili {
                break;
              }
            }
            gonder.send(mesaj(9, json!({"requestId": d["requestId"], "results": sonuclar}))).await.map_err(|e| e.to_string())?;
          }
          _ => {
            let _ = gonder.send(kapat(4004, "bilinmeyen op kodu")).await;
            break;
          }
        }
      }
      olay = olaylar.recv() => {
        match olay {
          Ok(o) => {
            if o["eventIntent"].as_u64().unwrap_or(0) & abonelik != 0 {
              gonder.send(mesaj(5, (*o).clone())).await.map_err(|e| e.to_string())?;
            }
          }
          Err(broadcast::error::RecvError::Lagged(_)) => continue,
          Err(_) => break,
        }
      }
    }
  }
  Ok(())
}

// ─── İstekler ──────────────────────────────────────────────────────────────

/// (kod, açıklama)
type Hatali = (u16, String);

const ISTEKLER: &[&str] = &[
  "GetVersion", "GetStats", "GetSceneCollectionList", "GetProfileList", "GetVideoSettings", "GetRecordDirectory",
  "GetSceneList", "GetCurrentProgramScene", "SetCurrentProgramScene", "GetCurrentPreviewScene", "SetCurrentPreviewScene",
  "GetStudioModeEnabled", "SetStudioModeEnabled", "TriggerStudioModeTransition", "GetCurrentSceneTransition",
  "GetInputList", "GetInputMute", "SetInputMute", "ToggleInputMute", "GetInputVolume", "SetInputVolume",
  "GetSceneItemList", "GetSceneItemId", "GetSceneItemEnabled", "SetSceneItemEnabled", "GetSceneItemLocked", "SetSceneItemLocked",
  "GetSourceFilterList", "SetSourceFilterEnabled", "TriggerMediaInputAction", "GetSourceScreenshot",
  "GetStreamStatus", "StartStream", "StopStream", "ToggleStream",
  "GetRecordStatus", "StartRecord", "StopRecord", "ToggleRecord", "PauseRecord", "ResumeRecord", "ToggleRecordPause", "SplitRecordFile",
  "GetReplayBufferStatus", "StartReplayBuffer", "StopReplayBuffer", "ToggleReplayBuffer", "SaveReplayBuffer", "GetLastReplayBufferReplay",
  "GetVirtualCamStatus", "StartVirtualCam", "StopVirtualCam", "ToggleVirtualCam",
];

async fn istek_yanit(state: &AppState, tur: &str, kimlik: Value, veri: &Value) -> Value {
  let sonuc = if tur.is_empty() {
    Err((203, "requestType yok".into()))
  } else if !ISTEKLER.contains(&tur) {
    Err((204, format!("bilinmeyen ya da desteklenmeyen istek: {tur}")))
  } else {
    istek(state, tur, veri).await
  };
  match sonuc {
    Ok(v) => {
      let mut d = json!({"requestType": tur, "requestId": kimlik, "requestStatus": {"result": true, "code": 100}});
      if !v.is_null() {
        d["responseData"] = v;
      }
      d
    }
    Err((kod, aciklama)) => json!({"requestType": tur, "requestId": kimlik, "requestStatus": {"result": false, "code": kod, "comment": aciklama}}),
  }
}

/// Panel hatasını obs-websocket durum koduna çevirir
fn cevir(e: Hata) -> Hatali {
  let kod = match e.0 {
    StatusCode::NOT_FOUND => 600,
    StatusCode::BAD_REQUEST => 400,
    _ if e.1.contains("motor çalışmıyor") => 207,
    _ => 702,
  };
  (kod, e.1)
}

fn alan<'a>(v: &'a Value, ad: &str) -> Result<&'a Value, Hatali> {
  v.get(ad).filter(|x| !x.is_null()).ok_or_else(|| (300, format!("'{ad}' alanı eksik")))
}

fn metin<'a>(v: &'a Value, ad: &str) -> Result<&'a str, Hatali> {
  alan(v, ad)?.as_str().ok_or_else(|| (401, format!("'{ad}' metin olmalı")))
}

fn mantik(v: &Value, ad: &str) -> Result<bool, Hatali> {
  alan(v, ad)?.as_bool().ok_or_else(|| (401, format!("'{ad}' true/false olmalı")))
}

/// Sahne öğesi kimliği: öğe kimliğinden kararlı pozitif sayı (FNV-1a, 31 bit)
pub fn oge_numarasi(oge: &str) -> u64 {
  let mut h: u32 = 0x811c_9dc5;
  for b in oge.bytes() {
    h ^= b as u32;
    h = h.wrapping_mul(0x0100_0193);
  }
  ((h & 0x7FFF_FFFF) as u64).max(1)
}

async fn motor_hazir(state: &AppState) -> Result<(), Hatali> {
  if state.motor.calisiyor().await {
    Ok(())
  } else {
    Err((207, "yayın motoru kapalı".into()))
  }
}

/// Ana tuvalin sahnesi: `sceneName` ya da `sceneUuid` → (kimlik, ad)
fn sahne_bul(state: &AppState, v: &Value) -> Result<(String, String), Hatali> {
  let o = state.motor.ozet();
  let o = o.lock();
  let s = &o.koleksiyon.sahneler;
  let bulunan = if let Some(u) = v.get("sceneUuid").and_then(Value::as_str) {
    s.iter().find(|x| x.id == u)
  } else {
    let ad = metin(v, "sceneName")?;
    s.iter().find(|x| x.ad == ad).or_else(|| s.iter().find(|x| ad_esit(&x.ad, ad)))
  };
  let x = bulunan.filter(|x| x.tuval == "ana").ok_or_else(|| (600, "sahne bulunamadı".to_string()))?;
  Ok((x.id.clone(), x.ad.clone()))
}

/// Giriş (kaynak): `inputName`/`sourceName` ya da `inputUuid`/`sourceUuid` → (kimlik, ad)
fn giris_bul(state: &AppState, v: &Value, onek: &str) -> Result<(String, String), Hatali> {
  let o = state.motor.ozet();
  let o = o.lock();
  let k = &o.koleksiyon.kaynaklar;
  let bulunan = if let Some(u) = v.get(format!("{onek}Uuid")).and_then(Value::as_str) {
    k.iter().find(|x| x.id == u)
  } else {
    let ad = metin(v, &format!("{onek}Name"))?;
    k.iter().find(|x| x.ad == ad).or_else(|| k.iter().find(|x| ad_esit(&x.ad, ad)))
  };
  let x = bulunan.filter(|x| !x.eksik).ok_or_else(|| (600, "giriş bulunamadı".to_string()))?;
  Ok((x.id.clone(), x.ad.clone()))
}

async fn sahne_ogeleri(state: &AppState, sahne: &str) -> Result<Vec<Value>, Hatali> {
  let v = komut(state, json!({"komut": "sahne.ogeler", "sahne": sahne})).await.map_err(cevir)?;
  Ok(v.as_array().cloned().unwrap_or_default())
}

async fn oge_bul(state: &AppState, v: &Value) -> Result<(String, Value), Hatali> {
  let (sahne, _) = sahne_bul(state, v)?;
  let no = alan(v, "sceneItemId")?.as_u64().ok_or_else(|| (401, "'sceneItemId' sayı olmalı".to_string()))?;
  let ogeler = sahne_ogeleri(state, &sahne).await?;
  let o = ogeler.into_iter().find(|o| o["oge"].as_str().is_some_and(|x| oge_numarasi(x) == no)).ok_or_else(|| (600, "sahne öğesi bulunamadı".to_string()))?;
  Ok((sahne, o))
}

fn yayin_etkin(state: &AppState) -> bool {
  motor_api::golive_hedefleri(state).iter().any(|h| motor_api::motor_hedefi_etkin(state, h))
}

fn db(mul: f64) -> f64 {
  if mul <= 0.0 {
    -100.0
  } else {
    (20.0 * mul.log10()).max(-100.0)
  }
}

async fn istek(state: &AppState, tur: &str, v: &Value) -> Result<Value, Hatali> {
  let genel = matches!(tur, "GetVersion" | "GetSceneCollectionList" | "GetProfileList" | "GetRecordDirectory" | "GetVideoSettings");
  if !genel {
    motor_hazir(state).await?;
  }
  match tur {
    "GetVersion" => {
      let libobs = state.motor.ozet().lock().bilgi["libobs"].as_str().unwrap_or("").to_string();
      Ok(json!({
        "obsVersion": if libobs.is_empty() { "unknown".to_string() } else { libobs },
        "obsWebSocketVersion": SURUM, "rpcVersion": RPC_SURUMU, "availableRequests": ISTEKLER,
        "supportedImageFormats": ["png"], "platform": "windows", "platformDescription": "Yayın Yönetim Aracı (obs-websocket uyumlu sunucu)",
      }))
    }
    "GetStats" => {
      let ist = komut(state, json!({"komut": "istatistik"})).await.map_err(cevir)?;
      Ok(json!({
        "cpuUsage": ist["cpu"], "memoryUsage": ist["bellek_mb"], "availableDiskSpace": crate::disk::bos_alan(&motor_api::kayit_klasoru()).map(|b| b as f64 / 1_048_576.0),
        "activeFps": ist["fps"], "averageFrameRenderTime": ist["ortalama_kare_ms"], "renderSkippedFrames": ist["geciken_kare"],
        "renderTotalFrames": ist["toplam_kare"], "outputSkippedFrames": ist["atlanan_kare"], "outputTotalFrames": ist["video_kare"],
        "webSocketSessionIncomingMessages": GELEN.load(Ordering::Relaxed), "webSocketSessionOutgoingMessages": GIDEN.load(Ordering::Relaxed),
      }))
    }
    "GetSceneCollectionList" => {
      let d = crate::motor_koleksiyon::dizin_oku(&klasor(state));
      let (etkin, liste) = match d {
        Some(d) => {
          let ad = d.liste.iter().find(|x| x.id == d.etkin).map(|x| x.ad.clone()).unwrap_or_default();
          (ad, d.liste.iter().map(|x| x.ad.clone()).collect::<Vec<_>>())
        }
        None => (String::new(), Vec::new()),
      };
      Ok(json!({"currentSceneCollectionName": etkin, "sceneCollections": liste}))
    }
    "GetProfileList" => {
      let d = crate::motor_profil::dizin_oku(&klasor(state));
      let (etkin, liste) = match d {
        Some(d) => {
          let ad = d.liste.iter().find(|x| x.id == d.etkin).map(|x| x.ad.clone()).unwrap_or_default();
          (ad, d.liste.iter().map(|x| x.ad.clone()).collect::<Vec<_>>())
        }
        None => ("Varsayılan".to_string(), vec!["Varsayılan".to_string()]),
      };
      Ok(json!({"currentProfileName": etkin, "profiles": liste}))
    }
    "GetVideoSettings" => {
      let p = crate::motor_profil::etkin(&klasor(state));
      Ok(json!({
        "fpsNumerator": p.fps, "fpsDenominator": 1, "baseWidth": p.video.taban[0], "baseHeight": p.video.taban[1],
        "outputWidth": p.video.cikis[0], "outputHeight": p.video.cikis[1],
      }))
    }
    "GetRecordDirectory" => {
      let p = crate::motor_profil::etkin(&klasor(state));
      let d = p.kayit.klasor.map(PathBuf::from).unwrap_or_else(motor_api::kayit_klasoru);
      Ok(json!({"recordDirectory": d}))
    }
    "GetSceneList" => {
      let o = state.motor.ozet();
      let o = o.lock();
      let sahneler: Vec<_> = o.koleksiyon.sahneler.iter().filter(|s| s.tuval == "ana").collect();
      let ad = |id: Option<&String>| id.and_then(|i| sahneler.iter().find(|s| &s.id == i)).map(|s| s.ad.clone());
      let program = o.koleksiyon.program.get("ana");
      let onizleme = o.studyo.get("ana").cloned().flatten();
      // OBS gibi: dizi alttan üste (listede en alttaki sahne sceneIndex 0)
      let liste: Vec<Value> = sahneler.iter().rev().enumerate().map(|(i, s)| json!({"sceneIndex": i, "sceneName": s.ad, "sceneUuid": s.id})).collect();
      Ok(json!({
        "currentProgramSceneName": ad(program), "currentProgramSceneUuid": program,
        "currentPreviewSceneName": ad(onizleme.as_ref()), "currentPreviewSceneUuid": onizleme,
        "scenes": liste,
      }))
    }
    "GetCurrentProgramScene" => {
      let o = state.motor.ozet();
      let o = o.lock();
      let id = o.koleksiyon.program.get("ana").cloned().ok_or((600, "program sahnesi yok".to_string()))?;
      let ad = o.koleksiyon.sahne_ref(&id).map(|s| s.ad.clone()).unwrap_or_default();
      Ok(json!({"sceneName": ad, "sceneUuid": id, "currentProgramSceneName": ad, "currentProgramSceneUuid": id}))
    }
    "SetCurrentProgramScene" => {
      let (id, _) = sahne_bul(state, v)?;
      super::motor_sahne_api::programa_al(state, &id, true, None).await.map_err(cevir)?;
      Ok(Value::Null)
    }
    "GetCurrentPreviewScene" => {
      let o = state.motor.ozet();
      let o = o.lock();
      let Some(on) = o.studyo.get("ana") else { return Err((506, "Studio Mode kapalı".into())) };
      let id = on.clone().ok_or((600, "önizleme sahnesi yok".to_string()))?;
      let ad = o.koleksiyon.sahne_ref(&id).map(|s| s.ad.clone()).unwrap_or_default();
      Ok(json!({"sceneName": ad, "sceneUuid": id, "currentPreviewSceneName": ad, "currentPreviewSceneUuid": id}))
    }
    "SetCurrentPreviewScene" => {
      if !state.motor.ozet().lock().studyo.contains_key("ana") {
        return Err((506, "Studio Mode kapalı".into()));
      }
      let (id, _) = sahne_bul(state, v)?;
      super::motor_sahne_api::studyo_onizleme(state, "ana", &id).await.map_err(cevir)?;
      Ok(Value::Null)
    }
    "GetStudioModeEnabled" => Ok(json!({"studioModeEnabled": state.motor.ozet().lock().studyo.contains_key("ana")})),
    "SetStudioModeEnabled" => {
      let ac = mantik(v, "studioModeEnabled")?;
      let acik = state.motor.ozet().lock().studyo.contains_key("ana");
      if ac && !acik {
        super::motor_sahne_api::studyo_ac(state, "ana").await.map_err(cevir)?;
      } else if !ac && acik {
        super::motor_sahne_api::studyo_kapat(state, "ana").await.map_err(cevir)?;
      }
      Ok(Value::Null)
    }
    "TriggerStudioModeTransition" => {
      if !state.motor.ozet().lock().studyo.contains_key("ana") {
        return Err((506, "Studio Mode kapalı".into()));
      }
      super::motor_sahne_api::studyo_gecisi(state, "ana", false, None).await.map_err(cevir)?;
      Ok(Value::Null)
    }
    "GetCurrentSceneTransition" => {
      let b = komut(state, json!({"komut": "gecis.bilgi", "tuval": "ana"})).await.map_err(cevir)?;
      Ok(json!({
        "transitionName": b["tur"], "transitionUuid": Value::Null, "transitionKind": b["tur"], "transitionFixed": b["tur"] == "cut_transition",
        "transitionDuration": b["sure_ms"], "transitionConfigurable": true, "transitionSettings": Value::Null,
      }))
    }
    "GetInputList" => {
      let tur_suz = v.get("inputKind").and_then(Value::as_str);
      let o = state.motor.ozet();
      let o = o.lock();
      let liste: Vec<Value> = o
        .koleksiyon
        .kaynaklar
        .iter()
        .filter(|k| !k.eksik && tur_suz.is_none_or(|t| t == k.obs_turu || t == crate::motor_obs_ice::surumsuz(&k.obs_turu)))
        .map(|k| json!({"inputName": k.ad, "inputUuid": k.id, "inputKind": k.obs_turu, "unversionedInputKind": crate::motor_obs_ice::surumsuz(&k.obs_turu)}))
        .collect();
      Ok(json!({"inputs": liste}))
    }
    "GetInputMute" => {
      let (id, _) = giris_bul(state, v, "input")?;
      let s = state.motor.ozet().lock().koleksiyon.kaynaklar.iter().find(|k| k.id == id).map(|k| k.ses.sessiz).unwrap_or(false);
      Ok(json!({"inputMuted": s}))
    }
    "SetInputMute" | "ToggleInputMute" => {
      let (id, _) = giris_bul(state, v, "input")?;
      let simdi = state.motor.ozet().lock().koleksiyon.kaynaklar.iter().find(|k| k.id == id).map(|k| k.ses.sessiz).unwrap_or(false);
      let yeni = if tur == "SetInputMute" { mantik(v, "inputMuted")? } else { !simdi };
      super::motor_ses_api::ses_ayarla(state, &id, "sessiz", &json!(yeni)).await.map_err(cevir)?;
      Ok(if tur == "ToggleInputMute" { json!({"inputMuted": yeni}) } else { Value::Null })
    }
    "GetInputVolume" => {
      let (id, _) = giris_bul(state, v, "input")?;
      let m = state.motor.ozet().lock().koleksiyon.kaynaklar.iter().find(|k| k.id == id).map(|k| k.ses.ses as f64).unwrap_or(1.0);
      Ok(json!({"inputVolumeMul": m, "inputVolumeDb": db(m)}))
    }
    "SetInputVolume" => {
      let (id, _) = giris_bul(state, v, "input")?;
      let mul = match (v.get("inputVolumeMul").and_then(Value::as_f64), v.get("inputVolumeDb").and_then(Value::as_f64)) {
        (Some(m), _) if (0.0..=20.0).contains(&m) => m,
        (Some(_), _) => return Err((402, "inputVolumeMul 0–20 olmalı".into())),
        (None, Some(d)) if (-100.0..=26.0).contains(&d) => 10f64.powf(d / 20.0),
        (None, Some(_)) => return Err((402, "inputVolumeDb −100…26 olmalı".into())),
        (None, None) => return Err((300, "inputVolumeMul ya da inputVolumeDb gerekli".into())),
      };
      super::motor_ses_api::ses_ayarla(state, &id, "ses", &json!(mul)).await.map_err(cevir)?;
      Ok(Value::Null)
    }
    "GetSceneItemList" => {
      let (sahne, _) = sahne_bul(state, v)?;
      let ogeler = sahne_ogeleri(state, &sahne).await?;
      let o = state.motor.ozet();
      let o = o.lock();
      let kok: Vec<&Value> = ogeler.iter().filter(|x| x.get("ust").is_none_or(Value::is_null)).collect();
      let liste: Vec<Value> = kok
        .iter()
        .enumerate()
        .map(|(i, x)| {
          let kaynak = x["kaynak"].as_str().unwrap_or("");
          let grup = x["grup"] == true;
          let (ad, tip, tur) = if let Some(k) = o.koleksiyon.kaynaklar.iter().find(|k| k.id == kaynak) {
            (k.ad.clone(), "OBS_SOURCE_TYPE_INPUT", json!(k.obs_turu))
          } else if let Some(s) = o.koleksiyon.sahne_ref(kaynak) {
            (s.ad.clone(), "OBS_SOURCE_TYPE_SCENE", Value::Null)
          } else {
            let ad = o.koleksiyon.sahne_ref(&sahne).and_then(|s| s.ogeler.iter().find(|g| g.tur == OgeTuru::Grup && g.kaynak == kaynak)).map(|g| g.ad.clone()).unwrap_or_else(|| kaynak.to_string());
            (ad, "OBS_SOURCE_TYPE_SCENE", Value::Null)
          };
          json!({
            "sceneItemId": oge_numarasi(x["oge"].as_str().unwrap_or("")), "sceneItemIndex": i, "sourceName": ad, "sourceUuid": kaynak,
            "sourceType": tip, "inputKind": tur, "isGroup": grup, "sceneItemEnabled": x["gorunur"], "sceneItemLocked": x["kilit"],
          })
        })
        .collect();
      Ok(json!({"sceneItems": liste}))
    }
    "GetSceneItemId" => {
      let (sahne, _) = sahne_bul(state, v)?;
      let ad = metin(v, "sourceName")?;
      let atla = v.get("searchOffset").and_then(Value::as_i64).unwrap_or(0).max(0) as usize;
      let ogeler = sahne_ogeleri(state, &sahne).await?;
      let adlar: HashMap<String, String> = {
        let o = state.motor.ozet();
        let o = o.lock();
        o.koleksiyon.kaynaklar.iter().map(|k| (k.id.clone(), k.ad.clone())).chain(o.koleksiyon.sahneler.iter().map(|s| (s.id.clone(), s.ad.clone()))).collect()
      };
      let bulunan = ogeler
        .iter()
        .filter(|x| x["kaynak"].as_str().and_then(|k| adlar.get(k)).is_some_and(|a| a == ad || ad_esit(a, ad)))
        .nth(atla)
        .ok_or((600, "sahnede bu kaynak yok".to_string()))?;
      Ok(json!({"sceneItemId": oge_numarasi(bulunan["oge"].as_str().unwrap_or(""))}))
    }
    "GetSceneItemEnabled" => {
      let (_, o) = oge_bul(state, v).await?;
      Ok(json!({"sceneItemEnabled": o["gorunur"]}))
    }
    "GetSceneItemLocked" => {
      let (_, o) = oge_bul(state, v).await?;
      Ok(json!({"sceneItemLocked": o["kilit"]}))
    }
    "SetSceneItemEnabled" | "SetSceneItemLocked" => {
      let (sahne, o) = oge_bul(state, v).await?;
      let (alan_ad, deger) = if tur == "SetSceneItemEnabled" { ("gorunur", mantik(v, "sceneItemEnabled")?) } else { ("kilit", mantik(v, "sceneItemLocked")?) };
      komut(state, json!({"komut": "oge.donustur", "oge": o["oge"], "donusum": {alan_ad: deger}})).await.map_err(cevir)?;
      motor_api::kaydet_sahneler(state, std::slice::from_ref(&sahne)).await.map_err(cevir)?;
      Ok(Value::Null)
    }
    "GetSourceFilterList" => {
      let (id, _) = giris_bul(state, v, "source").or_else(|_| sahne_bul(state, &json!({"sceneName": v.get("sourceName"), "sceneUuid": v.get("sourceUuid")})))?;
      let o = state.motor.ozet();
      let mut o = o.lock();
      let liste = o.koleksiyon.filtreler_mut(&id).map(|l| l.clone()).unwrap_or_default();
      let f: Vec<Value> = liste
        .iter()
        .enumerate()
        .map(|(i, f)| json!({"filterName": f.ad, "filterKind": f.tur, "filterIndex": i, "filterEnabled": f.etkin, "filterSettings": f.ayarlar}))
        .collect();
      Ok(json!({"filters": f}))
    }
    "SetSourceFilterEnabled" => {
      let (id, _) = giris_bul(state, v, "source")?;
      let ad = metin(v, "filterName")?;
      super::motor_ses_api::filtre_adla_etkin(state, &id, ad, Some(mantik(v, "filterEnabled")?)).await.map_err(cevir)?;
      Ok(Value::Null)
    }
    "TriggerMediaInputAction" => {
      let (id, _) = giris_bul(state, v, "input")?;
      let e = match metin(v, "mediaAction")? {
        "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PLAY" => "oynat",
        "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PAUSE" => "duraklat",
        "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP" => "durdur",
        "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART" => "yeniden",
        x => return Err((400, format!("desteklenmeyen medya eylemi: {x}"))),
      };
      super::motor_ses_api::medya(state, &id, e).await.map_err(cevir)?;
      Ok(Value::Null)
    }
    "GetSourceScreenshot" => {
      // Yalnız ana tuvalin program sahnesi (motor tuval karesini verir; tek kaynak görüntüsü yok)
      let (id, _) = sahne_bul(state, &json!({"sceneName": v.get("sourceName"), "sceneUuid": v.get("sourceUuid")})).map_err(|_| (702, "yalnız program sahnesinin görüntüsü alınabilir".to_string()))?;
      if state.motor.ozet().lock().koleksiyon.program.get("ana") != Some(&id) {
        return Err((702, "yalnız program sahnesinin görüntüsü alınabilir".into()));
      }
      if metin(v, "imageFormat")? != "png" {
        return Err((400, "yalnız png".into()));
      }
      let g = v.get("imageWidth").and_then(Value::as_u64).unwrap_or(480).clamp(64, 960);
      let mut png = Value::Null;
      for _ in 0..10 {
        let r = komut(state, json!({"komut": "onizleme", "tuval": "ana", "genislik": g})).await.map_err(cevir)?;
        if r["png"].is_string() {
          png = r["png"].clone();
          break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(150)).await;
      }
      let b64 = png.as_str().ok_or((702, "kare hazırlanamadı".to_string()))?;
      Ok(json!({"imageData": format!("data:image/png;base64,{b64}")}))
    }
    "GetStreamStatus" => {
      let ist = komut(state, json!({"komut": "istatistik"})).await.map_err(cevir)?;
      let hedefler: Vec<Value> = ist["cikislar"].as_array().into_iter().flatten().filter(|c| c["id"].as_str().is_some_and(|i| i.starts_with("h-"))).cloned().collect();
      let etkin = hedefler.iter().any(|c| c["etkin"] == true);
      let topla = |a: &str| hedefler.iter().filter_map(|c| c[a].as_i64()).sum::<i64>();
      Ok(json!({
        "outputActive": etkin, "outputReconnecting": hedefler.iter().any(|c| c["yeniden_baglaniyor"] == true),
        "outputBytes": topla("bayt"), "outputSkippedFrames": topla("dusen_kare"), "outputTotalFrames": topla("kare"), "outputCongestion": 0.0,
      }))
    }
    "StartStream" | "StopStream" | "ToggleStream" => {
      if !ayar_oku(state).yayin_denetimi {
        return Err((703, "yayını başlatma/durdurma bu uygulamada kapalı (Ayarlar › Uzaktan denetim › yayın denetimine izin ver)".into()));
      }
      let etkin = yayin_etkin(state);
      let baslat = match tur {
        "StartStream" if etkin => return Err((500, "yayın zaten sürüyor".into())),
        "StopStream" if !etkin => return Err((501, "yayın sürmüyor".into())),
        "StartStream" => true,
        "StopStream" => false,
        _ => !etkin,
      };
      if baslat {
        let s = motor_api::golive_baslat(state).await.map_err(cevir)?;
        if !s.is_empty() && motor_api::basarili(&s) == 0 {
          return Err((702, "hiçbir hedef başlatılamadı".into()));
        }
      } else {
        motor_api::golive_durdur(state).await.map_err(cevir)?;
      }
      Ok(if tur == "ToggleStream" { json!({"outputActive": baslat}) } else { Value::Null })
    }
    "GetRecordStatus" => {
      let etkin = cikis_etkin(state, "kayit");
      let d = etkin && motor_api::kayit_duraklatildi(state).await;
      let ist = komut(state, json!({"komut": "istatistik"})).await.unwrap_or(Value::Null);
      let bayt = ist["cikislar"].as_array().and_then(|a| a.iter().find(|c| c["id"] == "kayit")).and_then(|c| c["bayt"].as_u64()).unwrap_or(0);
      Ok(json!({"outputActive": etkin, "outputPaused": d, "outputBytes": bayt}))
    }
    "StartRecord" => {
      if cikis_etkin(state, "kayit") {
        return Err((500, "kayıt zaten sürüyor".into()));
      }
      motor_api::kayit_baslat(state).await.map_err(cevir)?;
      Ok(Value::Null)
    }
    "StopRecord" => {
      if !cikis_etkin(state, "kayit") {
        return Err((501, "kayıt sürmüyor".into()));
      }
      let yol = motor_api::kayit_durdur(state).await.map_err(cevir)?;
      Ok(json!({"outputPath": yol}))
    }
    "ToggleRecord" => {
      let etkin = cikis_etkin(state, "kayit");
      if etkin {
        motor_api::kayit_durdur(state).await.map_err(cevir)?;
      } else {
        motor_api::kayit_baslat(state).await.map_err(cevir)?;
      }
      Ok(json!({"outputActive": !etkin}))
    }
    "PauseRecord" | "ResumeRecord" | "ToggleRecordPause" => {
      if !cikis_etkin(state, "kayit") {
        return Err((501, "kayıt sürmüyor".into()));
      }
      let d = motor_api::kayit_duraklatildi(state).await;
      match tur {
        "PauseRecord" if d => return Err((502, "kayıt zaten duraklatılmış".into())),
        "ResumeRecord" if !d => return Err((503, "kayıt duraklatılmamış".into())),
        _ => {}
      }
      let hedef = match tur {
        "PauseRecord" => Some(true),
        "ResumeRecord" => Some(false),
        _ => None,
      };
      motor_api::kayit_duraklat(state, hedef).await.map_err(cevir)?;
      Ok(Value::Null)
    }
    "SplitRecordFile" => {
      if !cikis_etkin(state, "kayit") {
        return Err((501, "kayıt sürmüyor".into()));
      }
      motor_api::kayit_bol(state).await.map_err(cevir)?;
      Ok(Value::Null)
    }
    "GetReplayBufferStatus" => Ok(json!({"outputActive": cikis_etkin(state, "tekrar")})),
    "StartReplayBuffer" | "StopReplayBuffer" | "ToggleReplayBuffer" => {
      let etkin = cikis_etkin(state, "tekrar");
      let ac = match tur {
        "StartReplayBuffer" if etkin => return Err((500, "tekrar arabelleği zaten açık".into())),
        "StopReplayBuffer" if !etkin => return Err((501, "tekrar arabelleği kapalı".into())),
        "StartReplayBuffer" => true,
        "StopReplayBuffer" => false,
        _ => !etkin,
      };
      if ac {
        motor_api::tekrar_ac(state, None).await.map_err(cevir)?;
      } else {
        motor_api::tekrar_kapat(state).await.map_err(cevir)?;
      }
      Ok(if tur == "ToggleReplayBuffer" { json!({"outputActive": ac}) } else { Value::Null })
    }
    "SaveReplayBuffer" => {
      if !cikis_etkin(state, "tekrar") {
        return Err((501, "tekrar arabelleği kapalı".into()));
      }
      motor_api::tekrar_kaydet(state).await.map_err(cevir)?;
      Ok(Value::Null)
    }
    "GetLastReplayBufferReplay" => {
      let yol = state.motor.ozet().lock().son_tekrar.clone().ok_or((604, "henüz tekrar kaydedilmedi".to_string()))?;
      Ok(json!({"savedReplayPath": yol}))
    }
    "GetVirtualCamStatus" => Ok(json!({"outputActive": cikis_etkin(state, "sanal-kamera")})),
    "StartVirtualCam" | "StopVirtualCam" | "ToggleVirtualCam" => {
      let etkin = cikis_etkin(state, "sanal-kamera");
      let eylem = match tur {
        "StartVirtualCam" if etkin => return Err((500, "sanal kamera zaten açık".into())),
        "StopVirtualCam" if !etkin => return Err((501, "sanal kamera kapalı".into())),
        "StartVirtualCam" => "baslat",
        "StopVirtualCam" => "durdur",
        _ => "degistir",
      };
      let a = motor_api::sanal_kamera(state, eylem, "ana").await.map_err(cevir)?;
      Ok(if tur == "ToggleVirtualCam" { json!({"outputActive": a}) } else { Value::Null })
    }
    x => Err((204, format!("desteklenmeyen istek: {x}"))),
  }
}

// ─── Olaylar ───────────────────────────────────────────────────────────────

fn olay(tur: &str, niyet: u64, veri: Value) -> Arc<Value> {
  Arc::new(json!({"eventType": tur, "eventIntent": niyet, "eventData": veri}))
}

#[derive(Default, PartialEq, Clone)]
struct Anlik {
  program: Option<String>,
  onizleme: Option<Option<String>>,
  kayit: bool,
  kayit_dur: bool,
  tekrar: bool,
  sanal: bool,
  yayin: bool,
  sessiz: HashMap<String, bool>,
}

/// Motor durumunu 300 ms'de bir karşılaştırıp değişiklikleri olay olarak yayar (motor komutu yalnız kayıt sürerken:
/// duraklatma durumu için).
async fn olay_izleyici(state: Arc<AppState>, tx: broadcast::Sender<Arc<Value>>) {
  let mut onceki: Option<Anlik> = None;
  let mut aralik = tokio::time::interval(std::time::Duration::from_millis(300));
  loop {
    aralik.tick().await;
    // İstemci olmasa da durum izlenir: bağlanır bağlanmaz yapılan değişiklik de olay olarak gelsin
    if !state.motor.calisiyor().await {
      onceki = None;
      continue;
    }
    let mut a = {
      let o = state.motor.ozet();
      let o = o.lock();
      Anlik {
        program: o.koleksiyon.program.get("ana").cloned(),
        onizleme: o.studyo.get("ana").cloned(),
        sessiz: o.koleksiyon.kaynaklar.iter().map(|k| (k.id.clone(), k.ses.sessiz)).collect(),
        ..Default::default()
      }
    };
    a.kayit = cikis_etkin(&state, "kayit");
    a.kayit_dur = a.kayit && motor_api::kayit_duraklatildi(&state).await;
    a.tekrar = cikis_etkin(&state, "tekrar");
    a.sanal = cikis_etkin(&state, "sanal-kamera");
    a.yayin = yayin_etkin(&state);
    let Some(p) = onceki.replace(a.clone()) else { continue };
    if p == a {
      continue;
    }
    let sahne_adi = |id: &Option<String>| id.as_ref().and_then(|i| state.motor.ozet().lock().koleksiyon.sahne_ref(i).map(|s| s.ad.clone()));
    if p.program != a.program {
      let _ = tx.send(olay("CurrentProgramSceneChanged", AB_SAHNELER, json!({"sceneName": sahne_adi(&a.program), "sceneUuid": a.program})));
    }
    if p.onizleme.is_some() != a.onizleme.is_some() {
      let _ = tx.send(olay("StudioModeStateChanged", AB_ARAYUZ, json!({"studioModeEnabled": a.onizleme.is_some()})));
    }
    if let (Some(on), true) = (&a.onizleme, p.onizleme != a.onizleme) {
      let _ = tx.send(olay("CurrentPreviewSceneChanged", AB_SAHNELER, json!({"sceneName": sahne_adi(on), "sceneUuid": on})));
    }
    let durum = |etkin: bool| if etkin { "OBS_WEBSOCKET_OUTPUT_STARTED" } else { "OBS_WEBSOCKET_OUTPUT_STOPPED" };
    if p.kayit != a.kayit {
      let yol = if a.kayit { Value::Null } else { json!(state.motor.ozet().lock().son_kayit) };
      let _ = tx.send(olay("RecordStateChanged", AB_CIKTILAR, json!({"outputActive": a.kayit, "outputState": durum(a.kayit), "outputPath": yol})));
    } else if a.kayit && p.kayit_dur != a.kayit_dur {
      let s = if a.kayit_dur { "OBS_WEBSOCKET_OUTPUT_PAUSED" } else { "OBS_WEBSOCKET_OUTPUT_RESUMED" };
      let _ = tx.send(olay("RecordStateChanged", AB_CIKTILAR, json!({"outputActive": true, "outputState": s, "outputPath": Value::Null})));
    }
    if p.tekrar != a.tekrar {
      let _ = tx.send(olay("ReplayBufferStateChanged", AB_CIKTILAR, json!({"outputActive": a.tekrar, "outputState": durum(a.tekrar)})));
    }
    if p.sanal != a.sanal {
      let _ = tx.send(olay("VirtualcamStateChanged", AB_CIKTILAR, json!({"outputActive": a.sanal, "outputState": durum(a.sanal)})));
    }
    if p.yayin != a.yayin {
      let _ = tx.send(olay("StreamStateChanged", AB_CIKTILAR, json!({"outputActive": a.yayin, "outputState": durum(a.yayin)})));
    }
    for (id, s) in &a.sessiz {
      if p.sessiz.get(id).is_some_and(|e| e != s) {
        let ad = state.motor.ozet().lock().koleksiyon.kaynaklar.iter().find(|k| &k.id == id).map(|k| k.ad.clone());
        let _ = tx.send(olay("InputMuteStateChanged", AB_GIRISLER, json!({"inputName": ad, "inputUuid": id, "inputMuted": s})));
      }
    }
  }
}

// ─── Panel uçları ──────────────────────────────────────────────────────────

pub fn router() -> Router<Arc<AppState>> {
  Router::new()
    .route("/api/obs-websocket", get(api_durum).post(api_ayarla))
    .route("/api/obs-websocket/parola", post(api_parola))
}

async fn api_durum(State(state): State<Arc<AppState>>, ConnectInfo(addr): ConnectInfo<SocketAddr>, headers: HeaderMap) -> Result<Json<Value>, Hata> {
  authorize(&state, &addr, &headers, "broadcast.read").await?;
  let a = ayar_oku(&state);
  Ok(Json(json!({
    "etkin": a.etkin, "port": a.port, "yayinDenetimi": a.yayin_denetimi, "calisanPort": calisan_port(),
    "parolaVar": crate::secret_store::get_secret(PAROLA_ANAHTARI).is_some_and(|p| !p.is_empty()),
    "surum": SURUM, "istekSayisi": ISTEKLER.len(),
  })))
}

#[derive(Deserialize)]
struct AyarGovdesi {
  #[serde(default)]
  etkin: Option<bool>,
  #[serde(default)]
  port: Option<u16>,
  #[serde(default)]
  yayin_denetimi: Option<bool>,
  #[serde(default)]
  parola_yenile: bool,
}

async fn api_ayarla(State(state): State<Arc<AppState>>, ConnectInfo(addr): ConnectInfo<SocketAddr>, headers: HeaderMap, Json(g): Json<AyarGovdesi>) -> Result<Json<Value>, Hata> {
  // Uzaktan denetim yüzeyi açılıp kapanır: yalnız bu bilgisayardan
  if !addr.ip().is_loopback() {
    return Err((StatusCode::FORBIDDEN, "yalnız bu bilgisayardan".into()));
  }
  let actor = authorize(&state, &addr, &headers, "broadcast.outputs").await?;
  let mut a = ayar_oku(&state);
  if let Some(e) = g.etkin {
    a.etkin = e;
  }
  if let Some(p) = g.port {
    if p < 1024 {
      return Err((StatusCode::BAD_REQUEST, "port 1024–65535 olmalı".into()));
    }
    a.port = p;
  }
  if let Some(y) = g.yayin_denetimi {
    a.yayin_denetimi = y;
  }
  if g.parola_yenile {
    parola(true).map_err(|e| (StatusCode::CONFLICT, e))?;
  }
  ayar_yaz(&state, &a).map_err(|e| (StatusCode::CONFLICT, e))?;
  let port = uygula(state.clone()).await.map_err(|e| (StatusCode::CONFLICT, e))?;
  audit(&state, &actor, "OBS_WEBSOCKET_SETTINGS", json!({"etkin": a.etkin, "port": a.port, "yayinDenetimi": a.yayin_denetimi, "parolaYenilendi": g.parola_yenile})).await;
  Ok(Json(json!({"ok": true, "calisanPort": port})))
}

/// Parolayı gösterir (yalnız bu bilgisayardan; bağlanacak aracın ayarına girmek için). Denetim kaydına değer yazılmaz.
async fn api_parola(State(state): State<Arc<AppState>>, ConnectInfo(addr): ConnectInfo<SocketAddr>, headers: HeaderMap) -> Result<Json<Value>, Hata> {
  if !addr.ip().is_loopback() {
    return Err((StatusCode::FORBIDDEN, "yalnız bu bilgisayardan".into()));
  }
  let actor = authorize(&state, &addr, &headers, "broadcast.outputs").await?;
  let p = parola(false).map_err(|e| (StatusCode::CONFLICT, e))?;
  audit(&state, &actor, "OBS_WEBSOCKET_PASSWORD_REVEAL", json!({})).await;
  Ok(Json(json!({"parola": p})))
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn kimlik_dizesi_protokol_ornegi() {
    // Aynı girdiler aynı sonucu verir; parola/tuz/meydan okumadan biri değişince değişir
    let a = kimlik_dizesi("supersecretpassword", "lM1GncleQOaCu9lT1yeUZhFYnqhsLLP1G5lAGo3ixaI=", "+IxH4CnCiqpX1rM9scsNynZzbOe4KhDeYcTNS3PDaeY=");
    assert_eq!(a, kimlik_dizesi("supersecretpassword", "lM1GncleQOaCu9lT1yeUZhFYnqhsLLP1G5lAGo3ixaI=", "+IxH4CnCiqpX1rM9scsNynZzbOe4KhDeYcTNS3PDaeY="));
    assert_ne!(a, kimlik_dizesi("baska", "lM1GncleQOaCu9lT1yeUZhFYnqhsLLP1G5lAGo3ixaI=", "+IxH4CnCiqpX1rM9scsNynZzbOe4KhDeYcTNS3PDaeY="));
    assert_eq!(base64::engine::general_purpose::STANDARD.decode(&a).unwrap().len(), 32);
  }

  #[test]
  fn oge_numarasi_kararli_ve_pozitif() {
    assert_eq!(oge_numarasi("s/k"), oge_numarasi("s/k"));
    assert_ne!(oge_numarasi("s/k"), oge_numarasi("s/k#2"));
    assert!(oge_numarasi("") >= 1 && oge_numarasi("x") <= 0x7FFF_FFFF);
  }

  #[test]
  fn db_donusumu() {
    assert_eq!(db(1.0), 0.0);
    assert!((db(0.5) + 6.0206).abs() < 0.01);
    assert_eq!(db(0.0), -100.0);
  }
}
