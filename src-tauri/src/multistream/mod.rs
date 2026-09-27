//! Output Router — tek kodlama → çok hedef (`docs/MULTISTREAM_ARCHITECTURE.md`).
//!
//! ```text
//! OBS ──rtmp://127.0.0.1:<port>/live/<anahtar>──► FFmpeg alıcı ──FLV──► çoğaltıcı ──► FFmpeg yayıncı × N ──► platformlar
//! ```
//!
//! - Görüntü OBS'te bir kez kodlanır; burada yeniden kodlama yok (`-c copy`).
//! - Her hedefin kendi süreci, kuyruğu ve durum makinesi var; biri düşerse diğerleri etkilenmez.
//! - Geç katılan / yeniden bağlanan hedef dizi başlıklarını alır ve ilk anahtar kareden başlar.
//! - Yayın anahtarları Kimlik Yöneticisinde; hiçbir anlık görüntüye, günlüğe ya da hata metnine girmez.
//! - Güvenlik notu: FFmpeg'in dinleme kipi yayın anahtarını DOĞRULAMAZ; alıcının korunması yalnız loopback'e
//!   bağlanması ve her oturumda rastgele port kullanmasıdır (yerelde ölçüldü, 2026-09-25).

pub mod config;
pub mod flv;
pub mod obs_profile;
pub mod policy;
pub mod progress;
pub mod state;

use std::collections::{HashMap, VecDeque};
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use std::time::{Duration, Instant};

use parking_lot::RwLock;
use serde::Serialize;
use serde_json::json;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;
use tokio::sync::{broadcast, mpsc, watch};

use config::{DestinationConfig, Platform};
use flv::{Parser, Tag, Timeline, DEFAULT_HEADER, TAG_SCRIPT, TAG_VIDEO};
use progress::{Progress, ProgressReader};
use state::{DestEvent, DestState};

// ─── Anahtar deposu ──────────────────────────────────────────────────────

/// Sır deposu arayüzü (docs/SECRET_STORAGE_ARCHITECTURE.md): store (`set`), get, replace, delete, has. Değerler
/// yalnız işletim sisteminin kimlik deposunda; yazılamazsa `false` döner ve çağıran hata verir — düz metne düşülmez.
/// Eklentilere ve uzak istemcilere bu arayüz açılmaz.
pub trait KeyStore: Send + Sync {
  fn get(&self, id: &str) -> Option<String>;
  /// Yeni değer yazar (varsa üzerine)
  fn set(&self, id: &str, key: &str) -> bool;
  fn delete(&self, id: &str);
  fn has(&self, id: &str) -> bool {
    self.get(id).is_some_and(|k| !k.trim().is_empty())
  }
  /// Yalnız var olan sırrı değiştirir (yoksa `false`)
  fn replace(&self, id: &str, key: &str) -> bool {
    self.has(id) && self.set(id, key)
  }
}

/// Windows Kimlik Yöneticisi (keyring).
pub struct KeyringStore;

impl KeyStore for KeyringStore {
  fn get(&self, id: &str) -> Option<String> {
    crate::secret_store::get_secret(&config::key_name(id))
  }
  fn set(&self, id: &str, key: &str) -> bool {
    crate::secret_store::set_secret(&config::key_name(id), key)
  }
  fn delete(&self, id: &str) {
    crate::secret_store::delete_secret(&config::key_name(id))
  }
}

/// Bellek içi depo (testler).
#[derive(Default)]
pub struct MemoryStore(RwLock<HashMap<String, String>>);

impl KeyStore for MemoryStore {
  fn get(&self, id: &str) -> Option<String> {
    self.0.read().get(id).cloned()
  }
  fn set(&self, id: &str, key: &str) -> bool {
    self.0.write().insert(id.to_string(), key.to_string());
    true
  }
  fn delete(&self, id: &str) {
    self.0.write().remove(id);
  }
}

// ─── Paylaşılan durum ────────────────────────────────────────────────────

struct DestRuntime {
  cfg: DestinationConfig,
  state: DestState,
  failures: u32,
  progress: Option<Progress>,
  last_progress: Option<Instant>,
  dropped_total: u64,
  dropped_recent: u64,
  last_error: Option<String>,
  retry_at: Option<Instant>,
  stop_tx: Option<watch::Sender<bool>>,
  /// Yayıncı görevi. Durdurulan görev zarif kapanışta ~3 sn daha yaşar; o sürede aynı hedef yeniden başlatılırsa
  /// eski görevin `RemoveSink`'i yenisinin çıkışını siler ve platforma iki bağlantı gider — bu yüzden bitmeden
  /// yeni görev açılmaz.
  worker: Option<tokio::task::JoinHandle<()>>,
}

impl DestRuntime {
  fn new(cfg: DestinationConfig) -> Self {
    let state = if cfg.enabled { DestState::Ready } else { DestState::Disabled };
    Self {
      cfg,
      state,
      failures: 0,
      progress: None,
      last_progress: None,
      dropped_total: 0,
      dropped_recent: 0,
      last_error: None,
      retry_at: None,
      stop_tx: None,
      worker: None,
    }
  }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum IngestState {
  /// OBS'in bağlanması bekleniyor
  Listening,
  /// Kaynak akıyor
  Receiving,
}

struct Session {
  port: u16,
  key: String,
  ingest: IngestState,
  started_at: Instant,
  bytes_in: u64,
  source_since: Option<Instant>,
  stop_tx: watch::Sender<bool>,
  cmd_tx: mpsc::Sender<Cmd>,
}

#[derive(Default)]
struct Shared {
  dests: Vec<DestRuntime>,
  session: Option<Session>,
  log: VecDeque<String>,
}

impl Shared {
  fn dest_mut(&mut self, id: &str) -> Option<&mut DestRuntime> {
    self.dests.iter_mut().find(|d| d.cfg.id == id)
  }
  fn note(&mut self, line: String) {
    if self.log.len() >= 50 {
      self.log.pop_front();
    }
    self.log.push_back(line);
  }
}

// ─── Dışarıya verilen görünüm ────────────────────────────────────────────

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DestView {
  pub id: String,
  pub name: String,
  pub platform: Platform,
  pub platform_label: &'static str,
  pub server: String,
  pub enabled: bool,
  pub has_key: bool,
  /// Sırrın başvurusu (değer değil): `secure://<platform>/<hedef>/stream-key`
  pub key_ref: String,
  pub state: DestState,
  pub failures: u32,
  pub progress: Option<Progress>,
  pub dropped_total: u64,
  pub last_error: Option<String>,
  pub retry_in_secs: Option<u64>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SessionView {
  pub port: u16,
  /// OBS'e yazılacak sunucu (anahtarsız)
  pub server: String,
  pub ingest: IngestState,
  pub uptime_secs: u64,
  pub bytes_in: u64,
  pub source_secs: Option<u64>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
  pub session: Option<SessionView>,
  pub destinations: Vec<DestView>,
  pub ffmpeg: Option<String>,
  pub log: Vec<String>,
}

// ─── Çoğaltıcı komutları ─────────────────────────────────────────────────

enum Cmd {
  SourceStarted,
  SourceBytes(Vec<u8>),
  SourceEnded,
  AddSink { id: String, tx: mpsc::Sender<Arc<Vec<u8>>> },
  RemoveSink { id: String },
}

struct Sink {
  tx: mpsc::Sender<Arc<Vec<u8>>>,
  timeline: Timeline,
  /// Kuyruk taştı: bir sonraki anahtar kareye kadar atla
  awaiting_key: bool,
}

/// Hedef başına kuyruk (parça sayısı); 30 fps + ses için ≈ 8-10 sn.
const SINK_QUEUE: usize = 600;

// ─── Router ──────────────────────────────────────────────────────────────

pub struct Router {
  shared: Arc<RwLock<Shared>>,
  events: broadcast::Sender<String>,
  keys: Arc<dyn KeyStore>,
  ffmpeg: RwLock<Option<PathBuf>>,
}

fn gizle(cmd: &mut Command) {
  #[cfg(windows)]
  {
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    cmd.creation_flags(CREATE_NO_WINDOW);
  }
  #[cfg(not(windows))]
  let _ = cmd;
}

fn rastgele_anahtar() -> String {
  uuid::Uuid::new_v4().simple().to_string()
}

fn bos_port() -> std::io::Result<u16> {
  Ok(std::net::TcpListener::bind("127.0.0.1:0")?.local_addr()?.port())
}

impl Router {
  pub fn new(events: broadcast::Sender<String>, keys: Arc<dyn KeyStore>) -> Self {
    Self {
      shared: Arc::new(RwLock::new(Shared::default())),
      events,
      keys,
      ffmpeg: RwLock::new(None),
    }
  }

  pub fn set_ffmpeg(&self, path: Option<PathBuf>) {
    *self.ffmpeg.write() = path;
  }

  pub fn ffmpeg(&self) -> Option<PathBuf> {
    self.ffmpeg.read().clone()
  }

  /// Hedef listesini ayardan yükler; çalışan hedeflerin durumu korunur.
  pub fn load(&self, list: Vec<DestinationConfig>) {
    let mut sh = self.shared.write();
    let mut yeni = Vec::with_capacity(list.len());
    for cfg in list {
      if let Some(pos) = sh.dests.iter().position(|d| d.cfg.id == cfg.id) {
        let mut d = sh.dests.remove(pos);
        if !cfg.enabled && d.state != DestState::Disabled && !d.state.is_active() {
          d.state = DestState::Disabled;
        } else if cfg.enabled && d.state == DestState::Disabled {
          d.state = DestState::Ready;
        }
        d.cfg = cfg;
        yeni.push(d);
      } else {
        yeni.push(DestRuntime::new(cfg));
      }
    }
    // Listeden çıkarılan ama çalışan hedef durdurulur
    for d in sh.dests.drain(..) {
      if let Some(tx) = d.stop_tx {
        let _ = tx.send(true);
      }
    }
    sh.dests = yeni;
  }

  pub fn configs(&self) -> Vec<DestinationConfig> {
    self.shared.read().dests.iter().map(|d| d.cfg.clone()).collect()
  }

  /// Hedefin yayın anahtarı (yalnız yayın çekirdeğine iletmek için; arayüze dönmez).
  pub fn key_for(&self, id: &str) -> Option<String> {
    self.keys.get(id).filter(|k| !k.trim().is_empty())
  }

  pub fn set_key(&self, id: &str, key: &str) -> bool {
    self.keys.set(id, key.trim())
  }

  pub fn delete_key(&self, id: &str) {
    self.keys.delete(id);
  }

  pub fn snapshot(&self) -> Snapshot {
    let sh = self.shared.read();
    let now = Instant::now();
    Snapshot {
      session: sh.session.as_ref().map(|s| SessionView {
        port: s.port,
        server: format!("rtmp://127.0.0.1:{}/live", s.port),
        ingest: s.ingest,
        uptime_secs: now.duration_since(s.started_at).as_secs(),
        bytes_in: s.bytes_in,
        source_secs: s.source_since.map(|t| now.duration_since(t).as_secs()),
      }),
      destinations: sh
        .dests
        .iter()
        .map(|d| DestView {
          id: d.cfg.id.clone(),
          name: d.cfg.name.clone(),
          platform: d.cfg.platform,
          platform_label: d.cfg.platform.label(),
          server: d.cfg.server.clone(),
          enabled: d.cfg.enabled,
          has_key: self.keys.has(&d.cfg.id),
          key_ref: config::secure_ref(d.cfg.platform, &d.cfg.id),
          state: d.state,
          failures: d.failures,
          progress: d.progress.clone(),
          dropped_total: d.dropped_total,
          last_error: d.last_error.clone(),
          retry_in_secs: d.retry_at.map(|t| t.saturating_duration_since(now).as_secs()),
        })
        .collect(),
      ffmpeg: self.ffmpeg().map(|p| p.display().to_string()),
      log: sh.log.iter().cloned().collect(),
    }
  }

  /// OBS'e verilecek alıcı bilgisi (sunucu, anahtar) — yalnız yerel API'den.
  pub fn ingest_target(&self) -> Option<(String, String)> {
    let sh = self.shared.read();
    sh.session.as_ref().map(|s| (format!("rtmp://127.0.0.1:{}/live", s.port), s.key.clone()))
  }

  fn emit(&self) {
    let snap = self.snapshot();
    let _ = self.events.send(json!({ "type": "multistream", "data": snap }).to_string());
  }

  pub fn session_active(&self) -> bool {
    self.shared.read().session.is_some()
  }

  /// Alıcıyı başlatır (OBS bu adrese yayın yapacak). Zaten açıksa aynı oturumu döndürür.
  pub fn start_session(self: &Arc<Self>) -> Result<(String, String), String> {
    if let Some(t) = self.ingest_target() {
      return Ok(t);
    }
    let ffmpeg = self.ffmpeg().ok_or("FFmpeg bulunamadı")?;
    let port = bos_port().map_err(|e| format!("port ayrılamadı: {e}"))?;
    let key = rastgele_anahtar();
    let (stop_tx, stop_rx) = watch::channel(false);
    let (cmd_tx, cmd_rx) = mpsc::channel::<Cmd>(512);
    {
      let mut sh = self.shared.write();
      sh.session = Some(Session {
        port,
        key: key.clone(),
        ingest: IngestState::Listening,
        started_at: Instant::now(),
        bytes_in: 0,
        source_since: None,
        stop_tx,
        cmd_tx: cmd_tx.clone(),
      });
      sh.note(format!("Alıcı açıldı: 127.0.0.1:{port}"));
    }
    tokio::spawn(dispatcher(self.shared.clone(), cmd_rx));
    tokio::spawn(ingest_loop(self.clone(), ffmpeg, port, key.clone(), cmd_tx, stop_rx.clone()));
    tokio::spawn(health_loop(self.clone(), stop_rx));
    self.emit();
    Ok((format!("rtmp://127.0.0.1:{port}/live"), key))
  }

  /// Her şeyi durdurur (onaylı "hepsini bitir").
  pub fn stop_session(&self) {
    let mut sh = self.shared.write();
    for d in sh.dests.iter_mut() {
      if let Some(tx) = d.stop_tx.take() {
        let _ = tx.send(true);
      }
      if d.state.is_active() {
        d.state = DestState::Stopped;
      }
      d.retry_at = None;
    }
    if let Some(s) = sh.session.take() {
      let _ = s.stop_tx.send(true);
      sh.note("Oturum kapatıldı".into());
    }
    drop(sh);
    self.emit();
  }

  /// Bir hedefi başlatır (yayın sürerken de).
  pub fn start_destination(self: &Arc<Self>, id: &str) -> Result<(), String> {
    let ffmpeg = self.ffmpeg().ok_or("FFmpeg bulunamadı")?;
    let key = self.keys.get(id).ok_or("Bu hedefin yayın anahtarı kayıtlı değil")?;
    let cmd_tx = {
      let sh = self.shared.read();
      sh.session.as_ref().map(|s| s.cmd_tx.clone()).ok_or("Önce çoklu yayın oturumu açılmalı")?
    };
    let (stop_tx, stop_rx) = watch::channel(false);
    let cfg = {
      let mut sh = self.shared.write();
      let d = sh.dest_mut(id).ok_or("Hedef bulunamadı")?;
      if d.state == DestState::Disabled {
        return Err("Hedef kapalı".into());
      }
      if d.state.is_active() {
        return Ok(());
      }
      if d.worker.as_ref().is_some_and(|w| !w.is_finished()) {
        return Err("Hedef hâlâ kapanıyor; birkaç saniye sonra yeniden deneyin".into());
      }
      d.state = state::transition(d.state, DestEvent::Start, d.failures);
      d.failures = 0;
      d.last_error = None;
      d.progress = None;
      d.stop_tx = Some(stop_tx);
      let cfg = d.cfg.clone();
      sh.note(format!("{} başlatıldı", cfg.name));
      cfg
    };
    let gorev = tokio::spawn(dest_worker(self.clone(), ffmpeg, cfg, key, cmd_tx, stop_rx));
    self.with_dest(id, |d| d.worker = Some(gorev));
    self.emit();
    Ok(())
  }

  /// Hedefi yeniden bağlar: durdurur, eski yayıncı görevinin bitmesini bekler (en çok 8 sn), yeniden başlatır.
  pub async fn reconnect_destination(self: &Arc<Self>, id: &str) -> Result<(), String> {
    self.stop_destination(id)?;
    // Görev tutamağı yerinde kalır (alınırsa bu arada gelen başka bir "başlat" eski görevi göremez)
    let bitti = |r: &Self| {
      r.shared.read().dests.iter().find(|d| d.cfg.id == id).is_none_or(|d| d.worker.as_ref().is_none_or(|w| w.is_finished()))
    };
    let son = Instant::now() + Duration::from_secs(8);
    while !bitti(self) {
      if Instant::now() >= son {
        return Err("Eski bağlantı kapanmadı; yeniden bağlanılamadı".into());
      }
      tokio::time::sleep(Duration::from_millis(100)).await;
    }
    self.start_destination(id)
  }

  /// Bir hedefi durdurur; diğerleri sürer.
  pub fn stop_destination(&self, id: &str) -> Result<(), String> {
    let mut sh = self.shared.write();
    let d = sh.dest_mut(id).ok_or("Hedef bulunamadı")?;
    if let Some(tx) = d.stop_tx.take() {
      let _ = tx.send(true);
    }
    d.state = state::transition(d.state, DestEvent::Stop, d.failures);
    d.retry_at = None;
    let name = d.cfg.name.clone();
    sh.note(format!("{name} durduruldu"));
    drop(sh);
    self.emit();
    Ok(())
  }

  fn with_dest(&self, id: &str, f: impl FnOnce(&mut DestRuntime)) {
    let mut sh = self.shared.write();
    if let Some(d) = sh.dest_mut(id) {
      f(d);
    }
  }
}

// ─── Görevler ────────────────────────────────────────────────────────────

/// Alıcı: OBS bağlandıkça FFmpeg dinleyicisini (yeniden) açar, FLV baytlarını çoğaltıcıya verir.
async fn ingest_loop(
  router: Arc<Router>,
  ffmpeg: PathBuf,
  port: u16,
  key: String,
  cmd_tx: mpsc::Sender<Cmd>,
  mut stop_rx: watch::Receiver<bool>,
) {
  let url = format!("rtmp://127.0.0.1:{port}/live/{key}");
  while !*stop_rx.borrow() {
    let mut cmd = Command::new(&ffmpeg);
    cmd
      .args(["-hide_banner", "-loglevel", "error", "-listen", "1", "-i", &url])
      .args(["-c", "copy", "-map", "0", "-f", "flv", "pipe:1"])
      .stdin(Stdio::null())
      .stdout(Stdio::piped())
      .stderr(Stdio::null())
      .kill_on_drop(true);
    gizle(&mut cmd);
    let mut child = match cmd.spawn() {
      Ok(c) => c,
      Err(e) => {
        router.shared.write().note(format!("Alıcı başlatılamadı: {e}"));
        tokio::select! {
          _ = tokio::time::sleep(Duration::from_secs(2)) => {}
          _ = stop_rx.changed() => {}
        }
        continue;
      }
    };
    let Some(mut out) = child.stdout.take() else {
      continue;
    };
    let mut started = false;
    let mut buf = vec![0u8; 64 * 1024];
    loop {
      tokio::select! {
        n = out.read(&mut buf) => {
          match n {
            Ok(0) | Err(_) => break,
            Ok(n) => {
              if !started {
                started = true;
                let _ = cmd_tx.send(Cmd::SourceStarted).await;
                {
                  let mut sh = router.shared.write();
                  if let Some(s) = sh.session.as_mut() {
                    s.ingest = IngestState::Receiving;
                    s.source_since = Some(Instant::now());
                  }
                  sh.note("OBS'ten görüntü geliyor".into());
                }
                router.emit();
              }
              if let Some(s) = router.shared.write().session.as_mut() {
                s.bytes_in += n as u64;
              }
              if cmd_tx.send(Cmd::SourceBytes(buf[..n].to_vec())).await.is_err() {
                break;
              }
            }
          }
        }
        _ = stop_rx.changed() => {
          let _ = child.kill().await;
          break;
        }
      }
    }
    let _ = child.kill().await;
    if started {
      let _ = cmd_tx.send(Cmd::SourceEnded).await;
      {
        let mut sh = router.shared.write();
        if let Some(s) = sh.session.as_mut() {
          s.ingest = IngestState::Listening;
          s.source_since = None;
        }
        sh.note("OBS yayını kesildi; yeniden bağlanması bekleniyor".into());
      }
      router.emit();
    }
    tokio::select! {
      _ = tokio::time::sleep(Duration::from_millis(300)) => {}
      _ = stop_rx.changed() => {}
    }
  }
}

fn encode(tag: &Tag, ts: u32) -> Vec<u8> {
  let mut v = Vec::with_capacity(tag.data.len() + 15);
  tag.encode_with_ts(ts, &mut v);
  v
}

/// Çoğaltıcı: tek tüketici döngüsü; kilit yalnız düşürme istatistiği için alınır.
async fn dispatcher(shared: Arc<RwLock<Shared>>, mut rx: mpsc::Receiver<Cmd>) {
  let mut parser = Parser::default();
  let mut header: [u8; 9] = DEFAULT_HEADER;
  let mut meta: Option<Tag> = None;
  let mut vseq: Option<Tag> = None;
  let mut aseq: Option<Tag> = None;
  let mut sinks: HashMap<String, Sink> = HashMap::new();

  while let Some(cmd) = rx.recv().await {
    match cmd {
      Cmd::SourceStarted => {
        parser = Parser::default();
      }
      Cmd::SourceEnded => {
        for s in sinks.values_mut() {
          s.timeline.resume();
        }
      }
      Cmd::AddSink { id, tx } => {
        let mut init = header.to_vec();
        init.extend_from_slice(&[0, 0, 0, 0]);
        for t in [&meta, &vseq, &aseq].into_iter().flatten() {
          t.encode_with_ts(0, &mut init);
        }
        let _ = tx.try_send(Arc::new(init));
        sinks.insert(
          id,
          Sink {
            tx,
            timeline: Timeline::default(),
            awaiting_key: false,
          },
        );
      }
      Cmd::RemoveSink { id } => {
        sinks.remove(&id);
      }
      Cmd::SourceBytes(bytes) => {
        let tags = match parser.push(&bytes) {
          Ok(t) => t,
          Err(_) => {
            parser = Parser::default();
            continue;
          }
        };
        if let Some(h) = parser.header() {
          header = h;
        }
        for tag in tags {
          if tag.kind == TAG_SCRIPT {
            meta = Some(tag.clone());
            continue;
          }
          if tag.is_sequence_header() {
            if tag.kind == TAG_VIDEO {
              vseq = Some(tag.clone());
            } else {
              aseq = Some(tag.clone());
            }
            // Çalışan hedefler de almalı (kodlayıcı yayın ortasında yeniden yapılandırılabilir)
            let mut kapali = Vec::new();
            for (id, s) in sinks.iter_mut() {
              let ts = s.timeline.map(tag.ts).unwrap_or(0);
              if let Err(mpsc::error::TrySendError::Closed(_)) = s.tx.try_send(Arc::new(encode(&tag, ts))) {
                kapali.push(id.clone());
              }
            }
            for id in kapali {
              sinks.remove(&id);
            }
            continue;
          }
          let key = tag.is_keyframe();
          let mut kapali = Vec::new();
          let mut dusen = Vec::new();
          for (id, s) in sinks.iter_mut() {
            if !s.timeline.is_anchored() {
              if key {
                s.timeline.anchor(tag.ts);
              } else {
                continue;
              }
            }
            if s.awaiting_key {
              if key {
                s.awaiting_key = false;
              } else {
                continue;
              }
            }
            let Some(ts) = s.timeline.map(tag.ts) else {
              continue;
            };
            match s.tx.try_send(Arc::new(encode(&tag, ts))) {
              Ok(()) => {}
              Err(mpsc::error::TrySendError::Full(_)) => {
                // Yavaş hedef diğerlerini bekletmez: bir sonraki anahtar kareye kadar atla
                s.awaiting_key = true;
                dusen.push(id.clone());
              }
              Err(mpsc::error::TrySendError::Closed(_)) => kapali.push(id.clone()),
            }
          }
          for id in kapali {
            sinks.remove(&id);
          }
          if !dusen.is_empty() {
            let mut sh = shared.write();
            for id in dusen {
              if let Some(d) = sh.dest_mut(&id) {
                d.dropped_total += 1;
                d.dropped_recent += 1;
              }
            }
          }
        }
      }
    }
  }
}

/// Hedef işçisi: yayıncı sürecini çalıştırır, düşerse geri çekilmeyle yeniden dener.
async fn dest_worker(
  router: Arc<Router>,
  ffmpeg: PathBuf,
  cfg: DestinationConfig,
  key: String,
  cmd_tx: mpsc::Sender<Cmd>,
  mut stop_rx: watch::Receiver<bool>,
) {
  let url = config::publish_url(&cfg.server, &key);
  let secrets = [url.clone(), key.clone()];
  let id = cfg.id.clone();

  loop {
    if *stop_rx.borrow() {
      break;
    }
    let mut cmd = Command::new(&ffmpeg);
    cmd
      .args(["-hide_banner", "-loglevel", "warning", "-nostats", "-progress", "pipe:1"])
      .args(["-probesize", "262144", "-analyzeduration", "1000000", "-f", "flv", "-i", "pipe:0", "-c", "copy", "-map", "0"])
      .args(["-f", "flv", "-flvflags", "no_duration_filesize", &url])
      .stdin(Stdio::piped())
      .stdout(Stdio::piped())
      .stderr(Stdio::piped())
      .kill_on_drop(true);
    gizle(&mut cmd);
    let mut child = match cmd.spawn() {
      Ok(c) => c,
      Err(e) => {
        router.with_dest(&id, |d| {
          d.last_error = Some(format!("yayıncı başlatılamadı: {e}"));
          d.state = DestState::Failed;
        });
        router.emit();
        break;
      }
    };
    let (sink_tx, mut sink_rx) = mpsc::channel::<Arc<Vec<u8>>>(SINK_QUEUE);
    if cmd_tx.send(Cmd::AddSink { id: id.clone(), tx: sink_tx }).await.is_err() {
      let _ = child.kill().await;
      router.with_dest(&id, |d| d.state = DestState::Stopped);
      router.emit();
      break;
    }

    // Yazıcı: çoğaltıcı → yayıncı stdin
    let mut stdin = child.stdin.take();
    let writer = tokio::spawn(async move {
      while let Some(chunk) = sink_rx.recv().await {
        let Some(w) = stdin.as_mut() else { break };
        if w.write_all(&chunk).await.is_err() {
          break;
        }
      }
    });

    // İlerleme: yayıncı stdout (-progress)
    let prog_router = router.clone();
    let prog_id = id.clone();
    let stdout = child.stdout.take();
    let progress_task = tokio::spawn(async move {
      let Some(out) = stdout else { return };
      let mut lines = BufReader::new(out).lines();
      let mut reader = ProgressReader::default();
      while let Ok(Some(line)) = lines.next_line().await {
        if let Some(p) = reader.feed(&line) {
          let mut changed = false;
          prog_router.with_dest(&prog_id, |d| {
            let frames_up = p.frames > d.progress.as_ref().map(|x| x.frames).unwrap_or(0) || p.frames > 0;
            if frames_up {
              let healthy = state::healthy(p.speed, d.dropped_recent);
              let before = d.state;
              d.state = state::transition(d.state, DestEvent::Progress { healthy }, d.failures);
              if d.state == DestState::Live {
                d.failures = 0;
              }
              changed = before != d.state;
            }
            d.last_progress = Some(Instant::now());
            d.progress = Some(p);
          });
          if changed {
            prog_router.emit();
          }
        }
      }
    });

    // Hata satırları (maskelenmiş son satır)
    let stderr = child.stderr.take();
    let secrets_err = secrets.clone();
    let err_router = router.clone();
    let err_id = id.clone();
    let stderr_task = tokio::spawn(async move {
      let Some(err) = stderr else { return };
      let mut lines = BufReader::new(err).lines();
      while let Ok(Some(line)) = lines.next_line().await {
        let t = line.trim();
        if t.is_empty() {
          continue;
        }
        let refs: Vec<&str> = secrets_err.iter().map(String::as_str).collect();
        let clean: String = config::redact(t, &refs).chars().take(300).collect();
        err_router.with_dest(&err_id, |d| d.last_error = Some(clean));
      }
    });

    let stopped = tokio::select! {
      _ = child.wait() => false,
      _ = stop_rx.changed() => true,
    };
    let _ = cmd_tx.send(Cmd::RemoveSink { id: id.clone() }).await;
    if stopped {
      // Zarif kapanış: girişi kapat (EOF) → FFmpeg arabelleği boşaltıp yayını düzgün bitirir. Doğrudan
      // öldürmek son ~2 sn'yi kesiyordu (uçtan uca testte ölçüldü).
      writer.abort();
      let _ = tokio::time::timeout(Duration::from_secs(3), child.wait()).await;
    }
    let _ = child.kill().await;
    writer.abort();
    progress_task.abort();
    let _ = tokio::time::timeout(Duration::from_millis(500), stderr_task).await;

    if stopped || *stop_rx.borrow() {
      router.with_dest(&id, |d| {
        if d.state != DestState::Disabled {
          d.state = DestState::Stopped;
        }
        d.retry_at = None;
      });
      router.emit();
      break;
    }

    // Beklenmedik çıkış → yeniden bağlan (ya da tükenince Failed)
    let (next, failures) = {
      let mut sh = router.shared.write();
      let Some(d) = sh.dest_mut(&id) else { break };
      d.state = state::transition(d.state, DestEvent::ProcessExited, d.failures);
      d.failures += 1;
      let f = d.failures;
      let s = d.state;
      if s == DestState::Reconnecting {
        d.retry_at = Some(Instant::now() + Duration::from_secs(state::backoff_secs(f)));
      }
      let name = d.cfg.name.clone();
      sh.note(format!("{name}: bağlantı koptu ({f}. deneme)"));
      (s, f)
    };
    router.emit();
    if next != DestState::Reconnecting {
      break;
    }
    tokio::select! {
      _ = tokio::time::sleep(Duration::from_secs(state::backoff_secs(failures))) => {}
      _ = stop_rx.changed() => {
        router.with_dest(&id, |d| { d.state = DestState::Stopped; d.retry_at = None; });
        router.emit();
        break;
      }
    }
    router.with_dest(&id, |d| {
      d.state = state::transition(d.state, DestEvent::RetryDue, d.failures);
      d.retry_at = None;
    });
    router.emit();
  }
  router.with_dest(&id, |d| d.stop_tx = None);
}

/// Sağlık zamanlayıcısı: ilerlemesi kesilen hedef Uyarı'ya geçer; oturum açıkken saniyede bir anlık görüntü yayar.
async fn health_loop(router: Arc<Router>, mut stop_rx: watch::Receiver<bool>) {
  let mut tick = 0u64;
  loop {
    tokio::select! {
      _ = tokio::time::sleep(Duration::from_secs(1)) => {}
      _ = stop_rx.changed() => break,
    }
    tick += 1;
    {
      let mut sh = router.shared.write();
      let source_live = sh.session.as_ref().map(|s| s.ingest == IngestState::Receiving).unwrap_or(false);
      for d in sh.dests.iter_mut() {
        if matches!(d.state, DestState::Live) && source_live {
          let stale = d.last_progress.map(|t| t.elapsed() > Duration::from_secs(8)).unwrap_or(true);
          if stale {
            d.state = DestState::Warning;
          }
        }
        if tick.is_multiple_of(5) {
          d.dropped_recent = 0;
        }
      }
    }
    router.emit();
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  fn cfg(id: &str, enabled: bool) -> DestinationConfig {
    DestinationConfig {
      id: id.into(),
      name: id.to_uppercase(),
      platform: Platform::Custom,
      server: "rtmp://127.0.0.1:1/live".into(),
      enabled,
    }
  }

  #[test]
  fn yukleme_durumlari_ve_anlik_goruntu_anahtar_sizdirmaz() {
    let (tx, _) = broadcast::channel(8);
    let keys = Arc::new(MemoryStore::default());
    let r = Router::new(tx, keys.clone());
    r.load(vec![cfg("a", true), cfg("b", false)]);
    r.set_key("a", "gizli-anahtar-123");
    let s = r.snapshot();
    assert_eq!(s.destinations[0].state, DestState::Ready);
    assert_eq!(s.destinations[1].state, DestState::Disabled);
    assert!(s.destinations[0].has_key && !s.destinations[1].has_key);
    let json = serde_json::to_string(&s).unwrap();
    assert!(!json.contains("gizli-anahtar-123"), "anahtar anlık görüntüye sızdı");
    // Yeniden yüklemede açma/kapama
    r.load(vec![cfg("a", false), cfg("b", true)]);
    let s = r.snapshot();
    assert_eq!(s.destinations[0].state, DestState::Disabled);
    assert_eq!(s.destinations[1].state, DestState::Ready);
  }

  #[tokio::test]
  async fn oturumsuz_ya_da_anahtarsiz_hedef_baslamaz() {
    let (tx, _) = broadcast::channel(8);
    let r = Arc::new(Router::new(tx, Arc::new(MemoryStore::default())));
    r.set_ffmpeg(Some(PathBuf::from("ffmpeg")));
    r.load(vec![cfg("a", true)]);
    assert!(r.start_destination("a").unwrap_err().contains("anahtar"));
    r.set_key("a", "k");
    assert!(r.start_destination("a").unwrap_err().contains("oturum"));
  }

  fn avc(frame: u8, packet: u8, ts: u32) -> Tag {
    Tag::new(TAG_VIDEO, ts, vec![(frame << 4) | 7, packet, 0, 0, 0, 0xAB])
  }

  /// Hedefe giden parçaları FLV olarak çözer → (zaman damgası, anahtar kare mi) listesi (dizi başlıkları hariç).
  fn alinan(rx: &mut mpsc::Receiver<Arc<Vec<u8>>>) -> Vec<(u32, bool)> {
    let mut akis = Vec::new();
    while let Ok(p) = rx.try_recv() {
      akis.extend_from_slice(&p);
    }
    let mut parser = Parser::default();
    parser
      .push(&akis)
      .expect("hedefe giden akış geçerli FLV olmalı")
      .into_iter()
      .filter(|t| !t.is_sequence_header())
      .map(|t| (t.ts, t.is_keyframe()))
      .collect()
  }

  /// Yavaş hedef diğerlerini bekletmez: kuyruğu dolunca bir sonraki anahtar kareye kadar atlanır (yarım GOP
  /// gönderilip çözücü bozulmasın), düşme sayılır; hızlı hedef her kareyi alır.
  #[tokio::test]
  async fn yavas_hedef_anahtar_kareye_kadar_atlanir_digeri_etkilenmez() {
    let (ev, _) = broadcast::channel(8);
    let r = Router::new(ev, Arc::new(MemoryStore::default()));
    r.load(vec![cfg("yavas", true), cfg("hizli", true)]);
    let (cmd_tx, cmd_rx) = mpsc::channel(64);
    let calisan = tokio::spawn(dispatcher(r.shared.clone(), cmd_rx));

    // Yavaş hedefin kuyruğu 3 parça: açılış başlığı + dizi başlığı + ilk anahtar kare onu doldurur
    let (yavas_tx, mut yavas_rx) = mpsc::channel::<Arc<Vec<u8>>>(3);
    let (hizli_tx, mut hizli_rx) = mpsc::channel::<Arc<Vec<u8>>>(1000);
    cmd_tx.send(Cmd::AddSink { id: "yavas".into(), tx: yavas_tx }).await.unwrap();
    cmd_tx.send(Cmd::AddSink { id: "hizli".into(), tx: hizli_tx }).await.unwrap();

    let parca = |tags: &[Tag], basliklu: bool| {
      let mut v = Vec::new();
      if basliklu {
        v.extend_from_slice(&DEFAULT_HEADER);
        v.extend_from_slice(&[0, 0, 0, 0]);
      }
      for t in tags {
        t.encode_with_ts(t.ts, &mut v);
      }
      v
    };
    cmd_tx.send(Cmd::SourceStarted).await.unwrap();
    let ilk = [avc(1, 0, 0), avc(1, 1, 0), avc(2, 1, 33), avc(2, 1, 66), avc(1, 1, 2000), avc(2, 1, 2033)];
    cmd_tx.send(Cmd::SourceBytes(parca(&ilk, true))).await.unwrap();
    tokio::time::sleep(Duration::from_millis(100)).await;

    // Yavaş hedef: yalnız ilk anahtar kare sığdı; 2000'deki anahtar kare de kuyruk doluyken geldi
    let yavas_ilk = alinan(&mut yavas_rx);
    assert_eq!(yavas_ilk, vec![(0, true)], "kuyruk dolu iken ara kare gönderilmemeli");

    // Kuyruk boşaldı: yavaş hedef bir sonraki ANAHTAR karede, ara kare kaçırmadan devam eder
    let ikinci = [avc(2, 1, 2066), avc(1, 1, 4000), avc(2, 1, 4033)];
    cmd_tx.send(Cmd::SourceBytes(parca(&ikinci, false))).await.unwrap();
    tokio::time::sleep(Duration::from_millis(100)).await;
    let yavas_sonra: Vec<(u32, bool)> = {
      let mut v = Vec::new();
      while let Ok(p) = yavas_rx.try_recv() {
        // Açılış başlığı ilk partide tüketildi; sonraki parçalar düz etiket — başlık ekleyip çöz
        let mut akis = DEFAULT_HEADER.to_vec();
        akis.extend_from_slice(&[0, 0, 0, 0]);
        akis.extend_from_slice(&p);
        let mut parser = Parser::default();
        v.extend(parser.push(&akis).unwrap().into_iter().map(|t| (t.ts, t.is_keyframe())));
      }
      v
    };
    assert_eq!(yavas_sonra, vec![(4000, true), (4033, false)], "anahtar karede yeniden başlamalı");

    // Hızlı hedef her kareyi aldı
    let hizli = alinan(&mut hizli_rx);
    assert_eq!(
      hizli.iter().map(|x| x.0).collect::<Vec<_>>(),
      vec![0, 33, 66, 2000, 2033, 2066, 4000, 4033]
    );

    let s = r.snapshot();
    let dusen = |id: &str| s.destinations.iter().find(|d| d.id == id).unwrap().dropped_total;
    assert_eq!(dusen("yavas"), 2, "33 (kuyruk dolu) ve 2000 (hâlâ dolu) sayılmalı");
    assert_eq!(dusen("hizli"), 0);

    drop(cmd_tx);
    calisan.await.unwrap();
  }
}
