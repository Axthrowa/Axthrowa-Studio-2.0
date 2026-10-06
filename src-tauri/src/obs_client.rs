//! OBS WebSocket v5 için kalıcı Rust istemcisi ve Tauri köprüsü.

use std::sync::atomic::{AtomicBool, AtomicI64, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;

use futures_util::StreamExt;
use obws::events::Event as ObsEvent;
use obws::requests::inputs::InputId;
use obws::requests::EventSubscription;
use obws::requests::scene_items::SetEnabled;
use obws::requests::scenes::SceneId;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::settings::{AppSettings, ScreenKind};
use crate::AppState;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ObsConnectionStatus {
  pub connected: bool,
  pub connecting: bool,
  pub host: String,
  pub port: u16,
  pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ObsSceneSnapshot {
  pub scenes: Vec<String>,
  pub current_scene: String,
  pub streaming: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ObsSourceInfo {
  pub name: String,
  pub kind: String,
  pub visible: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ObsInputInfo {
  pub name: String,
  pub kind: String,
  pub muted: bool,
}

/// OBS tuvali (obs-websocket 5.7 `GetCanvasList`) — salt-okunur keşif.
#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ObsCanvasInfo {
  pub name: String,
  pub uuid: String,
  pub main: bool,
  pub width: u32,
  pub height: u32,
  pub fps: f64,
  pub mix_audio: bool,
  pub ephemeral: bool,
  /// Tuvali oluşturan bilinen eklenti (adından); bilinmiyorsa `None`
  pub provider: Option<&'static str>,
  /// Bu uygulama bu tuvalde program sahnesini değiştirebilir mi (obs-websocket yalnız ana tuvalde izin verir)
  pub scene_switch_supported: bool,
}

/// Tuval adından sağlayıcı eklenti. SE.Live tuvallerini "🚀 SE.Live: <ad>" biçiminde yayımlar
/// (kullanıcının OBS'inde gözlemlendi, 2026-09-26).
pub fn canvas_provider(name: &str) -> Option<&'static str> {
  let n = name.to_lowercase();
  if n.contains("se.live") {
    Some("SE.Live")
  } else if n.contains("aitum") || n.contains("vertical canvas") {
    Some("Aitum Vertical")
  } else {
    None
  }
}

/// Giriş ses seviyesi (obs-websocket `InputVolumeMeters`): kanalların en yükseği, dBFS.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ObsInputLevel {
  pub name: String,
  /// Tepe değeri (peak), dBFS; sessizlik `METER_FLOOR_DB`
  pub peak_db: f32,
  /// Ortalama büyüklük (magnitude), dBFS
  pub magnitude_db: f32,
}

pub const METER_FLOOR_DB: f32 = -100.0;
/// Bu kadar süre ölçer isteği gelmezse yüksek hacimli abonelik kapatılır.
const METER_IDLE_MS: i64 = 10_000;

/// Doğrusal genlik (obs-websocket "Mul") → dBFS. 0, negatif ve sayı olmayan değerler sessizlik sayılır.
pub fn mul_to_db(mul: f32) -> f32 {
  if !mul.is_finite() || mul <= 0.0 {
    return METER_FLOOR_DB;
  }
  (20.0 * mul.log10()).clamp(METER_FLOOR_DB, 20.0)
}

/// Kanal başına `[magnitude, peak, inputPeak]` üçlülerini tek seviyeye indirger (kanalların en yükseği).
pub fn summarize_levels(name: String, channels: &[[f32; 3]]) -> ObsInputLevel {
  let peak = channels.iter().map(|c| c[1]).fold(0.0f32, f32::max);
  let magnitude = channels.iter().map(|c| c[0]).fold(0.0f32, f32::max);
  ObsInputLevel { name, peak_db: mul_to_db(peak), magnitude_db: mul_to_db(magnitude) }
}

struct ObsConnection {
  client: Option<Arc<obws::Client>>,
  host: String,
  port: u16,
  last_error: Option<String>,
}

pub struct ObsClientState {
  inner: RwLock<ObsConnection>,
  connected: AtomicBool,
  connecting: AtomicBool,
  last_automation_ms: AtomicI64,
  sequence_gen: AtomicU64,
  meters: RwLock<Vec<ObsInputLevel>>,
  meters_updated_ms: AtomicI64,
  meter_demand_ms: AtomicI64,
  meters_on: AtomicBool,
  /// Kendiliğinden bağlanma döngüsünü beklemeden uyandırır (bağlantı bilgisi değişince)
  uyandir: tokio::sync::Notify,
}

impl Default for ObsClientState {
  fn default() -> Self {
    Self::new()
  }
}

impl ObsClientState {
  pub fn new() -> Self {
    Self {
      inner: RwLock::new(ObsConnection {
        client: None,
        host: "127.0.0.1".into(),
        port: 4455,
        last_error: None,
      }),
      connected: AtomicBool::new(false),
      connecting: AtomicBool::new(false),
      last_automation_ms: AtomicI64::new(0),
      sequence_gen: AtomicU64::new(0),
      meters: RwLock::new(Vec::new()),
      meters_updated_ms: AtomicI64::new(0),
      meter_demand_ms: AtomicI64::new(0),
      meters_on: AtomicBool::new(false),
      uyandir: tokio::sync::Notify::new(),
    }
  }

  /// Açık bağlantıyı kapatır ve kendiliğinden bağlanma döngüsünü hemen yeniden denemeye uyandırır.
  pub fn yeniden_baglan(&self) {
    self.disconnect();
    self.uyandir.notify_one();
  }

  pub fn status(&self) -> ObsConnectionStatus {
    let inner = self.inner.read();
    ObsConnectionStatus {
      connected: self.connected.load(Ordering::SeqCst),
      connecting: self.connecting.load(Ordering::SeqCst),
      host: inner.host.clone(),
      port: inner.port,
      last_error: inner.last_error.clone(),
    }
  }

  pub async fn connect(&self, host: &str, port: u16, password: &str) -> Result<(), String> {
    let host = host.trim();
    if host.is_empty() {
      return Err("OBS host boş olamaz".into());
    }
    self.connecting.store(true, Ordering::SeqCst);
    self.connected.store(false, Ordering::SeqCst);
    {
      let mut inner = self.inner.write();
      inner.client = None;
      inner.host = host.to_string();
      inner.port = port;
      inner.last_error = None;
    }

    let result = obws::Client::connect(
      host,
      port,
      Some(password.trim()).filter(|value| !value.is_empty()),
    )
    .await
    .map(Arc::new)
    .map_err(|error| format!("OBS bağlantısı kurulamadı: {error}"));

    self.connecting.store(false, Ordering::SeqCst);
    match result {
      Ok(client) => {
        // Bağlantı kurulmuş olsa bile ilk isteği doğrulayarak ölü soketi state'e koyma.
        if let Err(error) = client
          .general()
          .version()
          .await
        {
          let message = format!("OBS bağlantısı doğrulanamadı: {error}");
          self.set_error(&message);
          return Err(message);
        }
        self.inner.write().client = Some(client);
        self.connected.store(true, Ordering::SeqCst);
        Ok(())
      }
      Err(error) => {
        self.set_error(&error);
        Err(error)
      }
    }
  }

  pub fn is_connected(&self) -> bool {
    self.connected.load(Ordering::SeqCst)
  }

  pub fn is_connecting(&self) -> bool {
    self.connecting.load(Ordering::SeqCst)
  }

  /// Kalıcı bağlantıyı döndürür; yoksa (ya da başka bir adrese bağlıysa) bağlanır.
  ///
  /// Kısayollar eskiden her tuşta yeni bir `obws::Client::connect` kuruyordu (TCP +
  /// WebSocket el sıkışması + kimlik doğrulama, ağdaki OBS'te yüzlerce ms). Artık
  /// uygulamanın tek kalıcı bağlantısı paylaşılıyor.
  pub async fn ensure_connected(
    &self,
    host: &str,
    port: u16,
    password: &str,
  ) -> Result<Arc<obws::Client>, String> {
    {
      let inner = self.inner.read();
      if same_target(self.is_connected(), &inner.host, inner.port, host, port) {
        if let Some(c) = inner.client.clone() {
          return Ok(c);
        }
      }
    }
    // Başka bir görev (otomatik bağlanma / arayüz) şu an bağlanıyorsa onu bekle.
    for _ in 0..50 {
      if !self.is_connecting() {
        break;
      }
      tokio::time::sleep(Duration::from_millis(100)).await;
    }
    {
      let inner = self.inner.read();
      if same_target(self.is_connected(), &inner.host, inner.port, host, port) {
        if let Some(c) = inner.client.clone() {
          return Ok(c);
        }
      }
    }
    self.connect(host, port, password).await?;
    self.client()
  }

  pub fn disconnect(&self) {
    self.inner.write().client = None;
    self.connected.store(false, Ordering::SeqCst);
    self.connecting.store(false, Ordering::SeqCst);
  }

  fn client(&self) -> Result<Arc<obws::Client>, String> {
    self
      .inner
      .read()
      .client
      .clone()
      .ok_or_else(|| "OBS bağlı değil".to_string())
  }

  /// Etkin yayın servisi (tür + ayarlar). Ayarlar kullanıcının yayın anahtarını içerir — çağıran saklamalı,
  /// asla günlüğe ya da istemciye yazmamalı.
  pub async fn stream_service(&self) -> Result<(String, serde_json::Value), String> {
    let client = self.client()?;
    let s = client
      .config()
      .stream_service_settings::<serde_json::Value>()
      .await
      .map_err(|e| e.to_string())?;
    Ok((s.r#type, s.settings))
  }

  pub async fn set_stream_service(&self, kind: &str, settings: &serde_json::Value) -> Result<(), String> {
    let client = self.client()?;
    client
      .config()
      .set_stream_service_settings(kind, settings)
      .await
      .map_err(|e| e.to_string())
  }

  fn set_error(&self, error: &str) {
    let mut inner = self.inner.write();
    inner.last_error = Some(error.to_string());
    inner.client = None;
    self.connected.store(false, Ordering::SeqCst);
  }

  pub async fn scene_snapshot(&self) -> Result<ObsSceneSnapshot, String> {
    let client = self.client()?;
    let result: Result<ObsSceneSnapshot, String> = async {
      let list = client.scenes().list().await.map_err(|error| error.to_string())?;
      let streaming = client
        .streaming()
        .status()
        .await
        .map(|status| status.active)
        .unwrap_or(false);
      let current_scene = list
        .current_program_scene
        .map(|scene| scene.name)
        .unwrap_or_default();
      let scenes = list.scenes.into_iter().map(|scene| scene.id.name).collect();
      Ok(ObsSceneSnapshot {
        scenes,
        current_scene,
        streaming,
      })
    }
    .await;
    if let Err(ref error) = result {
      self.set_error(error);
    }
    result
  }

  pub async fn set_scene(&self, scene_name: &str) -> Result<(), String> {
    let client = self.client()?;
    client
      .scenes()
      .set_current_program_scene(scene_name)
      .await
      .map_err(|error| {
        let message = format!("OBS sahnesi değiştirilemedi: {error}");
        self.set_error(&message);
        message
      })
  }

  pub async fn sources(&self, scene_name: &str) -> Result<Vec<ObsSourceInfo>, String> {
    let client = self.client()?;
    let items = client
      .scene_items()
      .list(SceneId::Name(scene_name))
      .await
      .map_err(|error| format!("OBS kaynakları alınamadı: {error}"))?;
    let mut output = Vec::with_capacity(items.len());
    for item in items {
      let visible = client
        .scene_items()
        .enabled(SceneId::Name(scene_name), item.id)
        .await
        .unwrap_or(false);
      output.push(ObsSourceInfo {
        name: item.source_name,
        kind: item.input_kind.unwrap_or_else(|| format!("{:?}", item.source_type)),
        visible,
      });
    }
    Ok(output)
  }

  pub async fn set_source_visible(
    &self,
    scene_name: &str,
    source_name: &str,
    visible: bool,
  ) -> Result<(), String> {
    let client = self.client()?;
    let items = client
      .scene_items()
      .list(SceneId::Name(scene_name))
      .await
      .map_err(|error| format!("OBS kaynakları alınamadı: {error}"))?;
    let item = items
      .into_iter()
      .find(|item| item.source_name.eq_ignore_ascii_case(source_name))
      .ok_or_else(|| format!("Kaynak bulunamadı: {source_name}"))?;
    client
      .scene_items()
      .set_enabled(SetEnabled {
        scene: SceneId::Name(scene_name),
        item_id: item.id,
        enabled: visible,
      })
      .await
      .map_err(|error| format!("OBS kaynağı değiştirilemedi: {error}"))
  }

  pub async fn inputs(&self) -> Result<Vec<ObsInputInfo>, String> {
    let client = self.client()?;
    let inputs = client
      .inputs()
      .list(None)
      .await
      .map_err(|error| format!("OBS ses girişleri alınamadı: {error}"))?;
    let mut output = Vec::with_capacity(inputs.len());
    for input in inputs {
      let Ok(muted) = client
        .inputs()
        .muted(InputId::Name(input.id.name.as_str()))
        .await
      else {
        continue;
      };
      output.push(ObsInputInfo {
        name: input.id.name,
        kind: input.unversioned_kind,
        muted,
      });
    }
    Ok(output)
  }

  pub async fn set_muted(&self, input_name: &str, muted: bool) -> Result<(), String> {
    let client = self.client()?;
    client
      .inputs()
      .set_muted(InputId::Name(input_name), muted)
      .await
      .map_err(|error| format!("OBS ses durumu değiştirilemedi: {error}"))
  }

  /// Kaydı duraklatır (`Some(true)`), sürdürür (`Some(false)`) ya da değiştirir (`None`). Dönen: duraklatıldı mı.
  pub async fn set_record_paused(&self, pause: Option<bool>) -> Result<bool, String> {
    let client = self.client()?;
    let rec = client.recording();
    let sonuc = match pause {
      Some(true) => rec.pause().await.map(|_| true),
      Some(false) => rec.resume().await.map(|_| false),
      None => rec.toggle_pause().await,
    };
    sonuc.map_err(|error| format!("OBS kaydı duraklatılamadı/sürdürülemedi (kayıt açık mı?): {error}"))
  }

  /// Kayıt dosyasını böler (OBS'te "Otomatik dosya bölme" açık olmalı).
  pub async fn split_recording(&self) -> Result<(), String> {
    let client = self.client()?;
    client
      .recording()
      .split_file()
      .await
      .map_err(|error| format!("Kayıt dosyası bölünemedi (OBS Ayarlar → Çıkış → Kayıt → Otomatik dosya bölme): {error}"))
  }

  /// Sanal kamera: `Some(true)` başlat, `Some(false)` durdur, `None` değiştir. Dönen: açık mı.
  pub async fn set_virtualcam(&self, on: Option<bool>) -> Result<bool, String> {
    let client = self.client()?;
    let vc = client.virtual_cam();
    let sonuc = match on {
      Some(true) => vc.start().await.map(|_| true),
      Some(false) => vc.stop().await.map(|_| false),
      None => vc.toggle().await,
    };
    sonuc.map_err(|error| format!("OBS sanal kamerası değiştirilemedi: {error}"))
  }

  /// Kaynağın filtresini açar/kapatır; `acik: None` değiştirir. Dönen: filtre açık mı.
  pub async fn set_filter_enabled(&self, source: &str, filter: &str, acik: Option<bool>) -> Result<bool, String> {
    use obws::requests::{filters::SetEnabled, sources::SourceId};
    let client = self.client()?;
    let hedef = match acik {
      Some(a) => a,
      None => {
        !client
          .filters()
          .get(SourceId::Name(source), filter)
          .await
          .map_err(|error| format!("«{source}» kaynağında «{filter}» filtresi bulunamadı: {error}"))?
          .enabled
      }
    };
    client
      .filters()
      .set_enabled(SetEnabled { source: SourceId::Name(source), filter, enabled: hedef })
      .await
      .map_err(|error| format!("Filtre değiştirilemedi: {error}"))?;
    Ok(hedef)
  }

  /// Studio Mode'da önizlemeyi programa alır; `gecis` verilirse önce o geçiş seçilir (hızlı geçiş).
  pub async fn studio_transition(&self, gecis: Option<&str>) -> Result<(), String> {
    let client = self.client()?;
    if !client.ui().studio_mode_enabled().await.map_err(|e| e.to_string())? {
      return Err("OBS'te Studio Mode kapalı".into());
    }
    if let Some(g) = gecis {
      client
        .transitions()
        .set_current(g)
        .await
        .map_err(|error| format!("«{g}» adlı geçiş yok: {error}"))?;
    }
    client
      .transitions()
      .trigger()
      .await
      .map_err(|error| format!("Studio Mode geçişi yapılamadı: {error}"))
  }

  /// CEA-608 altyazı satırını yayına gönderir (yayın açık olmalı).
  pub async fn send_caption(&self, text: &str) -> Result<(), String> {
    let client = self.client()?;
    client
      .streaming()
      .send_caption(text)
      .await
      .map_err(|error| format!("Altyazı gönderilemedi (yayın açık mı?): {error}"))
  }

  /// Medya kaynağı: `"yeniden"` baştan oynatır, `"degistir"` oynat/duraklat. Dönen: uygulanan eylem.
  pub async fn media_action(&self, input: &str, eylem: &str) -> Result<&'static str, String> {
    use obws::common::MediaAction;
    use obws::responses::media_inputs::MediaState;
    let client = self.client()?;
    let (eylem, ad) = match eylem {
      "yeniden" => (MediaAction::Restart, "yeniden"),
      _ => {
        let durum = client
          .media_inputs()
          .status(InputId::Name(input))
          .await
          .map_err(|error| format!("«{input}» medya kaynağı değil ya da yok: {error}"))?;
        match durum.state {
          MediaState::Playing | MediaState::Opening | MediaState::Buffering => (MediaAction::Pause, "duraklat"),
          MediaState::Paused => (MediaAction::Play, "oynat"),
          _ => (MediaAction::Restart, "yeniden"),
        }
      }
    };
    client
      .media_inputs()
      .trigger_action(InputId::Name(input), eylem)
      .await
      .map_err(|error| format!("Medya eylemi uygulanamadı: {error}"))?;
    Ok(ad)
  }

  /// Giriş ses seviyeleri ve son ölçümün yaşı (ms). İlk çağrı yüksek hacimli `InputVolumeMeters` aboneliğini
  /// açar (OBS her 50 ms'de tüm girişleri gönderir); `METER_IDLE_MS` boyunca istek gelmezse abonelik kapanır.
  /// Yalnız okuma: OBS'te hiçbir ayar değişmez.
  pub async fn meters(self: &Arc<Self>) -> Result<(Vec<ObsInputLevel>, i64), String> {
    let client = self.client()?;
    let now = crate::db::chrono_now();
    self.meter_demand_ms.store(now, Ordering::SeqCst);
    if self.meters_on.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_ok() {
      // Akışı abonelikten önce al: ilk ölçüm kaçmasın
      let events = match client.events() {
        Ok(e) => e,
        Err(e) => {
          self.meters_on.store(false, Ordering::SeqCst);
          return Err(format!("OBS olay akışı alınamadı: {e}"));
        }
      };
      if let Err(e) = client.reidentify(EventSubscription::ALL | EventSubscription::INPUT_VOLUME_METERS).await {
        self.meters_on.store(false, Ordering::SeqCst);
        return Err(format!("OBS ses ölçer aboneliği açılamadı: {e}"));
      }
      tokio::spawn(Arc::clone(self).meter_pump(client, events));
    }
    let updated = self.meters_updated_ms.load(Ordering::SeqCst);
    let age = if updated == 0 { -1 } else { now - updated };
    Ok((self.meters.read().clone(), age))
  }

  /// Ölçer aboneliği şu an açık mı (tanılama / test).
  pub fn meters_active(&self) -> bool {
    self.meters_on.load(Ordering::SeqCst)
  }

  async fn meter_pump(self: Arc<Self>, client: Arc<obws::Client>, events: obws::events::EventStream) {
    let mut events = std::pin::pin!(events);
    let mut tick = tokio::time::interval(Duration::from_secs(1));
    loop {
      tokio::select! {
        ev = events.next() => match ev {
          Some(ObsEvent::InputVolumeMeters { inputs }) => {
            let list = inputs.into_iter().map(|m| summarize_levels(m.name, &m.levels)).collect();
            *self.meters.write() = list;
            self.meters_updated_ms.store(crate::db::chrono_now(), Ordering::SeqCst);
          }
          Some(_) => {}
          None => break, // bağlantı kapandı; yeni bağlantıda abonelik yeniden açılır
        },
        _ = tick.tick() => {
          if crate::db::chrono_now() - self.meter_demand_ms.load(Ordering::SeqCst) > METER_IDLE_MS {
            let _ = client.reidentify(EventSubscription::ALL).await;
            break;
          }
        }
      }
    }
    self.meters.write().clear();
    self.meters_updated_ms.store(0, Ordering::SeqCst);
    self.meters_on.store(false, Ordering::SeqCst);
  }

  /// OBS tuvalleri (obs-websocket 5.7+). Eski OBS'te istek bilinmez → açıklayıcı hata.
  pub async fn canvases(&self) -> Result<Vec<ObsCanvasInfo>, String> {
    let client = self.client()?;
    let list = client
      .canvases()
      .list()
      .await
      .map_err(|e| format!("OBS tuvalleri okunamadı (obs-websocket 5.7 / OBS 32.1+ gerekir): {e}"))?;
    Ok(
      list
        .into_iter()
        .map(|c| {
          let v = c.video_settings;
          let main = c.flags.contains(obws::responses::canvases::CanvasFlags::MAIN);
          ObsCanvasInfo {
            provider: canvas_provider(&c.id.name),
            name: c.id.name,
            uuid: c.id.uuid.to_string(),
            main,
            width: v.base_width,
            height: v.base_height,
            fps: if v.fps_denominator > 0 { v.fps_numerator as f64 / v.fps_denominator as f64 } else { 0.0 },
            mix_audio: c.flags.contains(obws::responses::canvases::CanvasFlags::MIX_AUDIO),
            ephemeral: c.flags.contains(obws::responses::canvases::CanvasFlags::EPHEMERAL),
            scene_switch_supported: main,
          }
        })
        .collect(),
    )
  }

  /// Kaydı başlatır / durdurur (eylem kayıt defteri). Durum zaten istenen hâldeyse hata sayılmaz.
  pub async fn set_recording(&self, on: bool) -> Result<(), String> {
    let client = self.client()?;
    let sonuc = if on {
      client.recording().start().await.map(|_| ())
    } else {
      client.recording().stop().await.map(|_| ())
    };
    match sonuc {
      Ok(()) => Ok(()),
      Err(error) => {
        let message = error.to_string();
        let lower = message.to_ascii_lowercase();
        let zaten = if on { lower.contains("already") || lower.contains("active") } else { lower.contains("not") && lower.contains("active") };
        if zaten {
          Ok(())
        } else {
          Err(format!("OBS kaydı {}: {message}", if on { "başlatılamadı" } else { "durdurulamadı" }))
        }
      }
    }
  }

  /// Tekrar arabelleğini kaydeder. Arabellek kapalıysa açıklayıcı hata (OBS'te açılması gerekir).
  pub async fn save_replay(&self) -> Result<(), String> {
    let client = self.client()?;
    let etkin = client
      .replay_buffer()
      .status()
      .await
      .map_err(|error| format!("Tekrar arabelleği durumu okunamadı: {error}"))?;
    if !etkin {
      return Err("Tekrar arabelleği kapalı — OBS'te açın (Ayarlar → Çıkış → Tekrar Arabelleği)".into());
    }
    client
      .replay_buffer()
      .save()
      .await
      .map_err(|error| format!("Tekrar kaydedilemedi: {error}"))
  }

  pub async fn toggle_stream(&self) -> Result<bool, String> {
    let client = self.client()?;
    client
      .streaming()
      .toggle()
      .await
      .map_err(|error| format!("OBS yayın durumu değiştirilemedi: {error}"))
  }

  pub async fn start_stream(&self) -> Result<(), String> {
    let client = self.client()?;
    match client.streaming().start().await {
      Ok(()) => Ok(()),
      Err(error) => {
        let message = error.to_string();
        let lower = message.to_ascii_lowercase();
        if lower.contains("already") || lower.contains("active") {
          Ok(())
        } else {
          Err(format!("OBS yayını başlatılamadı: {message}"))
        }
      }
    }
  }

  pub async fn stop_stream(&self) -> Result<(), String> {
    let client = self.client()?;
    match client.streaming().stop().await {
      Ok(()) => Ok(()),
      Err(error) => {
        let message = error.to_string();
        let lower = message.to_ascii_lowercase();
        if lower.contains("not") && (lower.contains("active") || lower.contains("running")) {
          Ok(())
        } else {
          Err(format!("OBS yayını durdurulamadı: {message}"))
        }
      }
    }
  }

  pub fn begin_sequence(&self) -> u64 {
    self.sequence_gen.fetch_add(1, Ordering::SeqCst) + 1
  }

  pub fn sequence_is(&self, gen: u64) -> bool {
    self.sequence_gen.load(Ordering::SeqCst) == gen
  }

  pub fn trigger_from_settings(
    self: &Arc<Self>,
    settings: &Arc<RwLock<AppSettings>>,
    event: ObsAutomationEvent,
  ) {
    let config = {
      let settings = settings.read();
      serde_json::from_value::<ObsAutomationConfig>(
        settings
          .get(ScreenKind::Panel)
          .pointer("/obs/automation")
          .cloned()
          .unwrap_or_default(),
      )
      .ok()
    };
    let Some(config) = config.filter(|config| config.matches(event)) else {
      return;
    };
    let now = crate::db::chrono_now();
    let cooldown_ms = i64::from(config.cooldown_sec.max(1)) * 1000;
    let previous = self.last_automation_ms.load(Ordering::SeqCst);
    if now - previous < cooldown_ms {
      return;
    }
    if self
      .last_automation_ms
      .compare_exchange(previous, now, Ordering::SeqCst, Ordering::SeqCst)
      .is_err()
    {
      return;
    }
    let obs = Arc::clone(self);
    tauri::async_runtime::spawn(async move {
      let result = match config.action.as_str() {
        "source" => {
          obs
            .set_source_visible(&config.scene_name, &config.source_name, true)
            .await
        }
        _ => obs.set_scene(&config.scene_name).await,
      };
      if let Err(error) = result {
        obs.set_error(&format!("OBS otomasyonu: {error}"));
      }
    });
  }
}

#[derive(Clone, Copy)]
pub enum ObsAutomationEvent {
  Donation(f64),
  Combo(u32),
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct ObsAutomationConfig {
  enabled: bool,
  donation_threshold: f64,
  combo_threshold: u32,
  action: String,
  scene_name: String,
  source_name: String,
  cooldown_sec: u32,
}

impl Default for ObsAutomationConfig {
  fn default() -> Self {
    Self {
      enabled: false,
      donation_threshold: 1000.0,
      combo_threshold: 10,
      action: "scene".into(),
      scene_name: String::new(),
      source_name: String::new(),
      cooldown_sec: 30,
    }
  }
}

impl ObsAutomationConfig {
  fn matches(&self, event: ObsAutomationEvent) -> bool {
    if !self.enabled || self.scene_name.trim().is_empty() {
      return false;
    }
    match event {
      ObsAutomationEvent::Donation(amount) => {
        self.donation_threshold > 0.0 && amount >= self.donation_threshold
      }
      ObsAutomationEvent::Combo(count) => {
        self.combo_threshold > 0 && count >= self.combo_threshold
      }
    }
  }
}

#[tauri::command]
pub async fn connect_obs(
  app: AppHandle,
  state: State<'_, AppState>,
  host: String,
  port: u16,
  password: String,
) -> Result<ObsConnectionStatus, String> {
  state.obs.connect(&host, port, &password).await?;
  spawn_obs_event_pump(Arc::clone(&state.obs), app);
  Ok(state.obs.status())
}

#[tauri::command]
pub fn obs_get_status(state: State<'_, AppState>) -> ObsConnectionStatus {
  state.obs.status()
}

#[tauri::command]
pub fn obs_disconnect(state: State<'_, AppState>) -> ObsConnectionStatus {
  state.obs.disconnect();
  state.obs.status()
}

#[tauri::command]
pub async fn obs_get_scenes(state: State<'_, AppState>) -> Result<ObsSceneSnapshot, String> {
  state.obs.scene_snapshot().await
}

#[tauri::command]
pub async fn obs_set_scene(
  state: State<'_, AppState>,
  scene_name: String,
) -> Result<(), String> {
  state.obs.set_scene(&scene_name).await
}

#[tauri::command]
pub async fn obs_get_sources(
  state: State<'_, AppState>,
  scene_name: String,
) -> Result<Vec<ObsSourceInfo>, String> {
  state.obs.sources(&scene_name).await
}

#[tauri::command]
pub async fn obs_toggle_source(
  state: State<'_, AppState>,
  scene_name: String,
  source_name: String,
  visible: bool,
) -> Result<(), String> {
  state
    .obs
    .set_source_visible(&scene_name, &source_name, visible)
    .await
}

#[tauri::command]
pub async fn obs_get_inputs(state: State<'_, AppState>) -> Result<Vec<ObsInputInfo>, String> {
  state.obs.inputs().await
}

#[tauri::command]
pub async fn obs_toggle_mute(
  state: State<'_, AppState>,
  input_name: String,
  muted: bool,
) -> Result<(), String> {
  state.obs.set_muted(&input_name, muted).await
}

#[tauri::command]
pub async fn obs_toggle_stream(state: State<'_, AppState>) -> Result<bool, String> {
  state.obs.toggle_stream().await
}

#[derive(Debug, Clone, PartialEq)]
struct StreamSequencePlan {
  starting: String,
  live: String,
  ending: String,
  start_hold: Duration,
  end_hold: Duration,
  /// Rust zamanlayıcısı bekleme sonunda sahneyi kendisi geçirsin mi?
  /// Kural video/hedef saat/elle ise karar overlay'dedir; burada geçirmek
  /// kullanıcının seçtiği kuralı ezerdi.
  start_auto: bool,
  end_auto: bool,
}

/// Bir ekranın bitiş kuralının Rust sekansına etkisi.
#[derive(Debug, PartialEq)]
pub(crate) struct RuleHold {
  /// Rust'ın zamanlayıcıyla geçiş yapmasına izin var mı
  pub auto: bool,
  /// Kuralda seçilen süre (dakika); yoksa eski `startHoldMin`/`endHoldMin`
  pub minutes: Option<f64>,
}

/// `obs.endRules[screen]` → Rust zamanlayıcısı için karar (saf, test edilir).
///
/// Yalnız **süreye** dayanan kurallar (`minutes`, `minutesOrMediaEnd`) Rust
/// zamanlayıcısını çalıştırır; ikincisinde video önce biterse overlay Rust'ın
/// görevini iptal eder. Video, hedef saat ve elle kurallarında Rust zaman
/// sayamaz ya da kullanıcı kendi geçer, o yüzden zamanlayıcı kapalı kalır.
/// Kural yoksa/null/geçersizse eski davranış: zamanlayıcı açık.
pub(crate) fn rule_hold(end_rules: Option<&serde_json::Value>, screen: &str) -> RuleHold {
  let legacy = RuleHold { auto: true, minutes: None };
  let Some(rule) = end_rules.and_then(|r| r.get(screen)).filter(|r| r.is_object()) else {
    return legacy;
  };
  match rule.get("mode").and_then(|m| m.as_str()) {
    Some("minutes") | Some("minutesOrMediaEnd") => RuleHold {
      auto: true,
      minutes: rule
        .get("minutes")
        .and_then(|m| m.as_f64())
        .filter(|m| *m > 0.0),
    },
    Some("mediaEnd") | Some("mediaLoops") | Some("targetDate") | Some("manual") => {
      RuleHold { auto: false, minutes: None }
    }
    // Bilinmeyen mod: kullanıcıyı sessiz bırakmak yerine eski davranış.
    _ => legacy,
  }
}

fn json_text(value: &serde_json::Value, pointer: &str) -> String {
  value
    .pointer(pointer)
    .and_then(|item| {
      item
        .as_str()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .or_else(|| item.as_u64().filter(|n| *n > 0).map(|n| n.to_string()))
        .or_else(|| item.as_i64().filter(|n| *n > 0).map(|n| n.to_string()))
        .or_else(|| item.as_f64().filter(|n| *n > 0.0).map(|n| n.to_string()))
    })
    .unwrap_or_default()
}

fn first_text(settings: &AppSettings, pointers: &[&str]) -> String {
  for kind in [ScreenKind::Panel, ScreenKind::Starting, ScreenKind::Ending] {
    let value = settings.get(kind);
    for pointer in pointers {
      let text = json_text(value, pointer);
      if !text.is_empty() {
        return text;
      }
    }
  }
  String::new()
}

fn minutes_to_hold(raw: &str, default_min: u64) -> Duration {
  let parsed = raw.parse::<f64>().unwrap_or(0.0);
  let minutes = if parsed > 0.0 { parsed } else { default_min as f64 };
  Duration::from_secs_f64((minutes * 60.0).clamp(5.0, 60.0 * 60.0))
}

fn read_stream_plan(settings: &AppSettings) -> StreamSequencePlan {
  let starting = first_text(
    settings,
    &["/obs/sceneMap/starting", "/obs/startingScene"],
  );
  let live = first_text(
    settings,
    &["/obs/sceneMap/game", "/obs/sceneOnEnd", "/obs/returnScene"],
  );
  let ending = first_text(
    settings,
    &[
      "/obs/sceneMap/ending",
      "/obs/endingScene",
      "/obs/endingEndScene",
    ],
  );
  let mut start_raw = first_text(settings, &["/obs/startHoldMin", "/startHoldMin"]);
  let mut end_raw = first_text(settings, &["/obs/endHoldMin", "/endingMinutes"]);

  // Kullanıcı bir bitiş kuralı seçtiyse süre ve otomatik geçiş ondan gelir.
  let end_rules = [ScreenKind::Panel, ScreenKind::Starting, ScreenKind::Ending]
    .into_iter()
    .find_map(|kind| {
      settings
        .get(kind)
        .pointer("/obs/endRules")
        .filter(|v| v.is_object())
        .cloned()
    });
  let start_rule = rule_hold(end_rules.as_ref(), "starting");
  let end_rule = rule_hold(end_rules.as_ref(), "ending");
  if let Some(m) = start_rule.minutes {
    start_raw = m.to_string();
  }
  if let Some(m) = end_rule.minutes {
    end_raw = m.to_string();
  }

  StreamSequencePlan {
    starting,
    live,
    ending,
    start_hold: minutes_to_hold(&start_raw, 5),
    end_hold: minutes_to_hold(&end_raw, 2),
    start_auto: start_rule.auto,
    end_auto: end_rule.auto,
  }
}

fn emit_stream_state(app: &AppHandle, output_active: bool) {
  let t = crate::db::chrono_now();
  let _ = app.emit(
    "obs-stream-state",
    json!({
      "outputActive": output_active,
      "t": t,
    }),
  );
  if let Some(state) = app.try_state::<AppState>() {
    state.broadcast_json(&json!({
      "type": "obs-stream-state",
      "outputActive": output_active,
      "t": t,
    }));
  }
}

/// Mevcut bağlantı istenen hedefle aynı mı (bağlıysa, adres ve port eşitse).
pub(crate) fn same_target(connected: bool, cur_host: &str, cur_port: u16, host: &str, port: u16) -> bool {
  connected && cur_port == port && cur_host.trim().eq_ignore_ascii_case(host.trim())
}

/// Hata metni ağ/bağlantı kaynaklı mı (yeniden bağlanıp bir kez daha denemeye değer)?
/// Anlamsal hatalar ("kaynak yok", "sahne yok") yeniden denenmez.
pub(crate) fn is_transport_error(msg: &str) -> bool {
  let m = msg.to_lowercase();
  [
    "connection",
    "disconnect",
    "closed",
    "broken pipe",
    "reset by peer",
    "timed out",
    "timeout",
    "websocket",
    "channel",
    "bağlı değil",
    "bağlantı",
    "handshake",
  ]
  .iter()
  .any(|k| m.contains(k))
}

/// Uygulama açılınca ve bağlantı koptukça OBS'e kendiliğinden bağlanır.
///
/// Bağlantı eskiden yalnızca panel penceresi açıkken arayüz kodundan kuruluyordu;
/// her açılışta elle "Kaydet"e basmak gerekiyordu ve pencere kapalıyken (tepsi)
/// kısayollar hiç bağlantı bulamıyordu. Bilgi (adres/şifre) ayar dosyalarından okunur.
pub async fn autoconnect_loop(app: AppHandle) {
  tokio::time::sleep(Duration::from_millis(1500)).await;
  let mut backoff = 0u32;
  loop {
    if let Some(state) = app.try_state::<AppState>() {
      if !state.obs.is_connected() && !state.obs.is_connecting() {
        let (host, mut port, mut password, _) = crate::hotkeys::obs_cfg_from_settings(&state);
        // Panelde şifre girilmemişse ve OBS bu bilgisayardaysa bilgiyi OBS'in kendi obs-websocket ayarından al
        if password.trim().is_empty() && crate::obs_studio::yerel_adres_mi(&host) {
          if let Some(ws) = tokio::task::spawn_blocking(crate::obs_studio::websocket_ayari).await.ok().flatten().filter(|w| w.etkin) {
            port = ws.port;
            if ws.sifre_gerekli {
              password = ws.sifre;
            }
          }
        }
        match state.obs.connect(&host, port, &password).await {
          Ok(()) => {
            spawn_obs_event_pump(Arc::clone(&state.obs), app.clone());
            backoff = 0;
          }
          Err(_) => backoff = (backoff + 1).min(4),
        }
      }
    }
    // Başarısızlıkta 5, 10, 15, 20, 25 sn: kapalı OBS'i saniyede bir yoklamayalım.
    let bekle = tokio::time::sleep(Duration::from_secs(5 * (backoff.max(1)) as u64));
    match app.try_state::<AppState>() {
      Some(state) => {
        tokio::select! {
          _ = bekle => {}
          _ = state.obs.uyandir.notified() => backoff = 0,
        }
      }
      None => bekle.await,
    }
  }
}

fn spawn_obs_event_pump(obs: Arc<ObsClientState>, app: AppHandle) {
  tauri::async_runtime::spawn(async move {
    let client = match obs.client() {
      Ok(client) => client,
      Err(_) => return,
    };
    let Ok(events) = client.events() else {
      return;
    };
    let mut events = std::pin::pin!(events);
    while let Some(event) = events.next().await {
      if let ObsEvent::StreamStateChanged { active, .. } = event {
        emit_stream_state(&app, active);
      }
    }
  });
}

#[tauri::command]
pub async fn obs_start_stream_sequence(
  app: AppHandle,
  state: State<'_, AppState>,
) -> Result<ObsSceneSnapshot, String> {
  let plan = {
    let settings = state.settings.read();
    read_stream_plan(&settings)
  };
  if !plan.starting.is_empty() {
    state.obs.set_scene(&plan.starting).await?;
  }
  state.obs.start_stream().await?;
  emit_stream_state(&app, true);
  let _ = app.emit(
    "obs-sequence",
    json!({
      "phase": "starting",
      "holdMs": plan.start_hold.as_millis(),
      "nextScene": plan.live,
    }),
  );
  let gen = state.obs.begin_sequence();
  // Kural video/hedef saat/elle ise geçişi overlay ya da kullanıcı yapar;
  // Rust zamanlayıcısı kurulmaz (kurulsa seçilen kuralı ezerdi).
  if plan.start_auto {
    let obs = Arc::clone(&state.obs);
    let live = plan.live.clone();
    let hold = plan.start_hold;
    tauri::async_runtime::spawn(async move {
      tokio::time::sleep(hold).await;
      if !obs.sequence_is(gen) {
        return;
      }
      if !live.is_empty() {
        let _ = obs.set_scene(&live).await;
      }
    });
  }
  state.obs.scene_snapshot().await
}

/// Bekleyen Rust sekansını iptal eder.
///
/// Overlay kendi bitiş eylemini (sahne geçişi / yayın kapatma) yapmadan önce
/// çağırır: aynı işi iki taraf birbirinden habersiz yaparsa iki kez sahne
/// değiştirir ya da kullanıcının seçtiği kuralı zamanlayıcı ezerdi.
#[tauri::command]
pub fn obs_cancel_sequence(state: State<'_, AppState>) {
  let _ = state.obs.begin_sequence();
}

#[tauri::command]
pub async fn obs_stop_stream_sequence(
  app: AppHandle,
  state: State<'_, AppState>,
) -> Result<ObsSceneSnapshot, String> {
  let plan = {
    let settings = state.settings.read();
    read_stream_plan(&settings)
  };
  let gen = state.obs.begin_sequence();
  if !plan.ending.is_empty() {
    state.obs.set_scene(&plan.ending).await?;
  }
  let _ = app.emit(
    "obs-sequence",
    json!({
      "phase": "ending",
      "holdMs": plan.end_hold.as_millis(),
    }),
  );
  if plan.end_auto {
    let obs = Arc::clone(&state.obs);
    let app2 = app.clone();
    let hold = plan.end_hold;
    tauri::async_runtime::spawn(async move {
      tokio::time::sleep(hold).await;
      if !obs.sequence_is(gen) {
        return;
      }
      let _ = obs.stop_stream().await;
      emit_stream_state(&app2, false);
    });
  }
  state.obs.scene_snapshot().await
}

#[cfg(test)]
mod rule_hold_tests {
  use super::*;
  use serde_json::json;

  #[test]
  fn kural_yoksa_eski_davranis_zamanlayici_acik() {
    assert_eq!(rule_hold(None, "starting"), RuleHold { auto: true, minutes: None });
    let bos = json!({});
    assert_eq!(rule_hold(Some(&bos), "starting"), RuleHold { auto: true, minutes: None });
  }

  #[test]
  fn null_kural_eski_davranis() {
    // Panel sıfırlamayı anahtarı silerek değil null yazarak yapıyor.
    let r = json!({ "starting": null });
    assert_eq!(rule_hold(Some(&r), "starting"), RuleHold { auto: true, minutes: None });
  }

  #[test]
  fn sure_kurali_zamanlayiciyi_kuraldaki_dakikayla_calistirir() {
    let r = json!({ "ending": { "mode": "minutes", "minutes": 7.5 } });
    assert_eq!(rule_hold(Some(&r), "ending"), RuleHold { auto: true, minutes: Some(7.5) });
    let o = json!({ "starting": { "mode": "minutesOrMediaEnd", "minutes": 3 } });
    assert_eq!(rule_hold(Some(&o), "starting"), RuleHold { auto: true, minutes: Some(3.0) });
  }

  #[test]
  fn sure_kuralinda_dakika_yoksa_eski_sureye_dusulur() {
    let r = json!({ "starting": { "mode": "minutes" } });
    assert_eq!(rule_hold(Some(&r), "starting"), RuleHold { auto: true, minutes: None });
    let sifir = json!({ "starting": { "mode": "minutes", "minutes": 0 } });
    assert_eq!(rule_hold(Some(&sifir), "starting").minutes, None);
  }

  #[test]
  fn video_hedef_saat_ve_elle_kurallarinda_zamanlayici_kapali() {
    // Rust video süresini ya da hedef saati bilemez; kullanıcının seçtiği
    // kuralı bir zamanlayıcı ezmemeli.
    for mode in ["mediaEnd", "mediaLoops", "targetDate", "manual"] {
      let r = json!({ "starting": { "mode": mode, "minutes": 5 } });
      assert_eq!(
        rule_hold(Some(&r), "starting"),
        RuleHold { auto: false, minutes: None },
        "{mode}"
      );
    }
  }

  #[test]
  fn bilinmeyen_mod_eski_davranis() {
    let r = json!({ "starting": { "mode": "uydurma" } });
    assert_eq!(rule_hold(Some(&r), "starting"), RuleHold { auto: true, minutes: None });
  }

  #[test]
  fn ekranlar_birbirinden_bagimsiz() {
    let r = json!({ "starting": { "mode": "manual" } });
    assert!(!rule_hold(Some(&r), "starting").auto);
    // Çıkış için kural yok → eski davranış
    assert!(rule_hold(Some(&r), "ending").auto);
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn automation_thresholds_are_enforced() {
    let config = ObsAutomationConfig {
      enabled: true,
      scene_name: "Hype".into(),
      ..Default::default()
    };
    assert!(!config.matches(ObsAutomationEvent::Donation(999.0)));
    assert!(config.matches(ObsAutomationEvent::Donation(1000.0)));
    assert!(!config.matches(ObsAutomationEvent::Combo(9)));
    assert!(config.matches(ObsAutomationEvent::Combo(10)));
  }

  #[test]
  fn disabled_or_targetless_automation_never_runs() {
    assert!(!ObsAutomationConfig::default().matches(ObsAutomationEvent::Donation(5000.0)));
    let config = ObsAutomationConfig {
      enabled: true,
      scene_name: String::new(),
      ..Default::default()
    };
    assert!(!config.matches(ObsAutomationEvent::Combo(100)));
  }

  #[test]
  fn stream_hold_uses_defaults_and_minutes() {
    assert_eq!(minutes_to_hold("", 5), Duration::from_secs(300));
    assert_eq!(minutes_to_hold("2", 5), Duration::from_secs(120));
    assert_eq!(minutes_to_hold("0", 2), Duration::from_secs(120));
  }
}

#[cfg(test)]
mod kalici_baglanti_testleri {
  use super::{is_transport_error, same_target};

  #[test]
  fn ayni_hedef_yalniz_bagliyken_ve_adres_port_esitse() {
    assert!(same_target(true, "192.168.1.109", 4455, "192.168.1.109", 4455));
    assert!(same_target(true, " OBS.lan ", 4455, "obs.LAN", 4455), "boşluk/büyük-küçük harf önemsiz");
    assert!(!same_target(false, "a", 1, "a", 1), "bağlı değilse asla aynı sayılmaz");
    assert!(!same_target(true, "a", 1, "b", 1));
    assert!(!same_target(true, "a", 1, "a", 2));
  }

  #[test]
  fn ag_hatalari_yeniden_denenir_anlamsal_hatalar_denenmez() {
    for m in [
      "OBS bağlantı: failed to execute the handshake with obs-websocket",
      "sahne: the connection was closed",
      "kaynaklar: Broken pipe",
      "OBS bağlı değil",
      "timed out",
      "channel closed",
    ] {
      assert!(is_transport_error(m), "{m}");
    }
    for m in [
      "«Kamera» «Oyun» sahnesinde yok",
      "sahne atanmamış",
      "mikrofon kaynağı seçilmemiş",
      "kaynak seçilmemiş",
    ] {
      assert!(!is_transport_error(m), "{m}");
    }
  }
}

#[cfg(test)]
mod tuval_tests {
  use super::{canvas_provider, mul_to_db, summarize_levels, METER_FLOOR_DB};

  #[test]
  fn ses_seviyesi_dbfs_donusumu() {
    assert_eq!(mul_to_db(1.0), 0.0);
    assert!((mul_to_db(0.5) - (-6.0206)).abs() < 0.001);
    assert_eq!(mul_to_db(0.0), METER_FLOOR_DB);
    assert_eq!(mul_to_db(-1.0), METER_FLOOR_DB);
    assert_eq!(mul_to_db(f32::NAN), METER_FLOOR_DB);
    assert_eq!(mul_to_db(1e-9), METER_FLOOR_DB, "çok küçük değer taban altına inmez");
    assert_eq!(mul_to_db(1e6), 20.0, "kırpılma üst sınırda kalır");
    // Kanalların en yükseği; boş giriş sessizlik
    let l = summarize_levels("Mikrofon".into(), &[[0.1, 0.25, 0.3], [0.2, 0.5, 0.6]]);
    assert!((l.peak_db - mul_to_db(0.5)).abs() < 1e-6);
    assert!((l.magnitude_db - mul_to_db(0.2)).abs() < 1e-6);
    assert_eq!(summarize_levels("Boş".into(), &[]).peak_db, METER_FLOOR_DB);
  }

  #[test]
  fn tuval_saglayicisi_adindan_taninir() {
    assert_eq!(canvas_provider("🚀 SE.Live: Vertical"), Some("SE.Live"));
    assert_eq!(canvas_provider("Aitum Vertical"), Some("Aitum Vertical"));
    assert_eq!(canvas_provider("Main"), None);
    assert_eq!(canvas_provider("Dikey"), None);
  }
}
