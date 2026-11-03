//! Geliştirme: yerel HTTP/WS sunucusunu masaüstü penceresi AÇMADAN, geçici bir veri kökle çalıştırır.
//!
//! Arayüzü tarayıcıda denemek için (gerçek kullanıcı verisine dokunmaz):
//!   cargo run --example headless_server -- 18843
//!   node scripts/ui-headless.mjs 18843 1421     (Vite, VITE_API_BASE bu sunucuya ayarlı)
//!
//! OBS'e otomatik bağlanma, tepsi, kısayollar ve StreamAxT süreci BAŞLATILMAZ (yalnız `server::serve`).

use std::path::PathBuf;

#[tokio::main]
async fn main() {
  yayin_yonetim_araci_lib::secret_store::set_service_override("com.axthrowa.yayin-yonetim-araci.headless");
  yayin_yonetim_araci_lib::tls_saglayicisini_kur();
  let port: u16 =std::env::args().nth(1).and_then(|a| a.parse().ok()).unwrap_or(18843);
  let root: PathBuf = std::env::temp_dir().join(format!("yya-headless-{port}"));
  std::fs::create_dir_all(root.join("assets")).expect("geçici kök");
  let data_dir = root.join("app-data");
  eprintln!("başsız sunucu: http://127.0.0.1:{port}  (veri: {})", data_dir.display());
  let state = tokio::task::spawn_blocking(move || {
    yayin_yonetim_araci_lib::AppState::new(root, data_dir, false, port)
  })
  .await
  .expect("AppState");
  if let Err(e) = yayin_yonetim_araci_lib::server::serve(state).await {
    eprintln!("sunucu hatası: {e:#}");
  }
}
