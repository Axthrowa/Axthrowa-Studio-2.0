//! Eklenti kaydı. Arka plan servisleri (OBS, sohbet) ortak bir yüzle kaydedilir; yeni bir platform
//! (YouTube, TikTok…) ana kurulum koduna dokunmadan `varsayilan()` listesine bir satırla eklenir.
//!
//! Servislerin kendisi yerinde kalır (`obs_client`, `bot`): eklenti yalnız onları başlatır ve
//! uygulama olaylarını iletir.

use tauri::{AppHandle, Manager};

use crate::AppState;

/// Eklentilere iletilen uygulama olayları
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EklentiOlayi {
  /// OBS yayın çıkışı açıldı / kapandı
  YayinDurumu { acik: bool },
}

pub trait AxthrowaPlugin: Send + Sync {
  fn name(&self) -> &'static str;
  /// Açılışta bir kez çağrılır. Uzun süren iş kendi görevini başlatır, burada beklenmez.
  fn initialize(&self, app: &AppHandle) -> Result<(), String>;
  fn on_event(&self, _app: &AppHandle, _olay: &EklentiOlayi) {}
}

#[derive(Default)]
pub struct PluginRegistry {
  eklentiler: Vec<Box<dyn AxthrowaPlugin>>,
}

impl PluginRegistry {
  pub fn new() -> Self {
    Self::default()
  }

  pub fn kaydet(mut self, eklenti: impl AxthrowaPlugin + 'static) -> Self {
    self.eklentiler.push(Box::new(eklenti));
    self
  }

  /// Hepsini başlatır; biri başlayamazsa günlüğe yazılır, diğerleri yine başlar.
  pub fn baslat(&self, app: &AppHandle) {
    for e in &self.eklentiler {
      let _s = tracing::info_span!("eklenti_baslat", ad = e.name()).entered();
      match e.initialize(app) {
        Ok(()) => log::info!(target: "eklenti", "{} başlatıldı", e.name()),
        Err(hata) => log::error!(target: "eklenti", "{} başlatılamadı: {hata}", e.name()),
      }
    }
  }

  pub fn yayinla(&self, app: &AppHandle, olay: &EklentiOlayi) {
    for e in &self.eklentiler {
      e.on_event(app, olay);
    }
  }

  pub fn adlar(&self) -> Vec<&'static str> {
    self.eklentiler.iter().map(|e| e.name()).collect()
  }
}

/// Uygulamanın eklentileri. Yeni platform: `AxthrowaPlugin`ı uygulayan bir yapı yaz, buraya `.kaydet(…)`.
pub fn varsayilan() -> PluginRegistry {
  PluginRegistry::new().kaydet(ObsEklentisi).kaydet(SohbetEklentisi)
}

/// Olay kaydı kurulmuşsa (kurulum sonrası) eklentilere iletir
pub fn yayinla(app: &AppHandle, olay: EklentiOlayi) {
  if let Some(kayit) = app.try_state::<PluginRegistry>() {
    kayit.yayinla(app, &olay);
  }
}

/// OBS WebSocket: açılışta kendiliğinden bağlanır, kopunca yeniden dener (`obs_client::autoconnect_loop`)
pub struct ObsEklentisi;

impl AxthrowaPlugin for ObsEklentisi {
  fn name(&self) -> &'static str {
    "obs"
  }
  fn initialize(&self, app: &AppHandle) -> Result<(), String> {
    tauri::async_runtime::spawn(crate::obs_client::autoconnect_loop(app.clone()));
    Ok(())
  }
}

/// Kick (Pusher) + Twitch (IRC) sohbet dinleyicileri, komut motoru ve zamanlayıcılar (`bot::spawn_bot_runtime`)
pub struct SohbetEklentisi;

impl AxthrowaPlugin for SohbetEklentisi {
  fn name(&self) -> &'static str {
    "sohbet"
  }
  fn initialize(&self, app: &AppHandle) -> Result<(), String> {
    let state = app.try_state::<AppState>().ok_or("uygulama durumu hazır değil")?;
    crate::bot::spawn_bot_runtime(state.inner().clone());
    Ok(())
  }
}

