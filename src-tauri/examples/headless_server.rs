//! Geliştirme: yerel HTTP/WS sunucusunu masaüstü penceresi AÇMADAN, geçici bir veri kökle çalıştırır.
//!
//! Arayüzü tarayıcıda denemek için (gerçek kullanıcı verisine dokunmaz):
//!   cargo run --example headless_server -- 18843
//!   node scripts/ui-headless.mjs 18843 1421     (Vite, VITE_API_BASE bu sunucuya ayarlı)
//!
//! OBS'e otomatik bağlanma (STUDIO_HEADLESS_OBS=1 hariç), tepsi, kısayollar ve AxBoT süreci BAŞLATILMAZ (yalnız `server::serve`).

use std::path::PathBuf;

#[tokio::main]
async fn main() {
  axthrowa_studio_lib::secret_store::set_service_override("com.axthrowa.studio.headless");
  axthrowa_studio_lib::tls_saglayicisini_kur();
  let port: u16 =std::env::args().nth(1).and_then(|a| a.parse().ok()).unwrap_or(18843);
  // STUDIO_HEADLESS_KOK: sürüm klasörü dizilimini (yan yana eski sürümler) denemek için kökü değiştirir
  let root: PathBuf = std::env::var_os("STUDIO_HEADLESS_KOK").map(PathBuf::from).unwrap_or_else(|| std::env::temp_dir().join(format!("studio-headless-{port}")));
  std::fs::create_dir_all(root.join("assets")).expect("geçici kök");
  let data_dir = root.join("app-data");
  axthrowa_studio_lib::kutuphane::hazirla(&root, &data_dir, "baslisiz");
  eprintln!("başsız sunucu: http://127.0.0.1:{port}  (veri: {})", data_dir.display());
  let state = tokio::task::spawn_blocking(move || {
    axthrowa_studio_lib::AppState::new(root, data_dir, false, port)
  })
  .await
  .expect("AppState");
  // Windows medya oturumu yalnız okunur (R2 sınaması); STUDIO_HEADLESS_SMTC=0 kapatır
  if std::env::var("STUDIO_HEADLESS_SMTC").as_deref() != Ok("0") {
    tokio::spawn(axthrowa_studio_lib::smtc_poll_loop(state.clone()));
  }
  // STUDIO_HEADLESS_OBS=1: panel ayarındaki OBS bilgisiyle bağlanır (sahne eylemleri sınaması); olay akışı yok
  if std::env::var("STUDIO_HEADLESS_OBS").as_deref() == Ok("1") {
    let st = state.clone();
    tokio::spawn(async move {
      loop {
        if !st.obs.is_connected() && !st.obs.is_connecting() {
          let obs = st.settings.read().get(axthrowa_studio_lib::settings::ScreenKind::Panel).get("obs").cloned().unwrap_or_default();
          let host = obs.get("host").and_then(|v| v.as_str()).unwrap_or("127.0.0.1").to_string();
          let port = obs.get("port").and_then(|v| v.as_u64()).unwrap_or(4455) as u16;
          let sifre = obs.get("password").and_then(|v| v.as_str()).unwrap_or("").to_string();
          if let Err(e) = st.obs.connect(&host, port, &sifre).await {
            eprintln!("OBS bağlantısı: {e}");
          }
        }
        tokio::time::sleep(std::time::Duration::from_secs(5)).await;
      }
    });
  }
  if let Err(e) = axthrowa_studio_lib::server::serve(state).await {
    eprintln!("sunucu hatası: {e:#}");
  }
}
