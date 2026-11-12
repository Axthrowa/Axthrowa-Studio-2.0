//! Geliştirme: yerel HTTP/WS sunucusunu masaüstü penceresi AÇMADAN, geçici bir veri kökle çalıştırır.
//!
//! Arayüzü tarayıcıda denemek için (gerçek kullanıcı verisine dokunmaz):
//!   cargo run --example headless_server -- 18843
//!   node scripts/ui-headless.mjs 18843 1421     (Vite, VITE_API_BASE bu sunucuya ayarlı)
//!
//! OBS'e otomatik bağlanma, tepsi, kısayollar ve AxBoT süreci BAŞLATILMAZ (yalnız `server::serve`).

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
  if let Err(e) = axthrowa_studio_lib::server::serve(state).await {
    eprintln!("sunucu hatası: {e:#}");
  }
}
