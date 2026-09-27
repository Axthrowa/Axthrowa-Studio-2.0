//! Geliştirme: OBS istemcimizi (obs_client) çalışan OBS'e karşı **yalnız okuma** çağrılarıyla sınar.
//!
//!   cargo run --example obs_probe
//!
//! Bağlan → sahne listesi → ses girişleri → tuvaller → ses ölçerleri → bağlantıyı kapat. Hiçbir yazma isteği
//! gönderilmez (sahne, ses, yayın, kayıt değişmez; ölçer yalnız bu bağlantının olay aboneliğidir). OBS WebSocket parolası obs-websocket'in yapılandırma dosyasından okunur ve
//! YAZDIRILMAZ.

use std::sync::Arc;

use yayin_yonetim_araci_lib::obs_client::ObsClientState;

fn obs_ws_yapilandirma() -> Option<(u16, String)> {
  let yol = std::path::PathBuf::from(std::env::var("APPDATA").ok()?)
    .join("obs-studio")
    .join("plugin_config")
    .join("obs-websocket")
    .join("config.json");
  let v: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(yol).ok()?).ok()?;
  let port = v.get("server_port").and_then(|p| p.as_u64()).unwrap_or(4455) as u16;
  let parola = if v.get("auth_required").and_then(|a| a.as_bool()).unwrap_or(false) {
    v.get("server_password").and_then(|p| p.as_str()).unwrap_or("").to_string()
  } else {
    String::new()
  };
  Some((port, parola))
}

#[tokio::main]
async fn main() {
  let Some((port, parola)) = obs_ws_yapilandirma() else {
    eprintln!("obs-websocket yapılandırması okunamadı");
    std::process::exit(2);
  };
  let obs = Arc::new(ObsClientState::new());
  if let Err(e) = obs.connect("127.0.0.1", port, &parola).await {
    eprintln!("bağlanamadı: {e}");
    std::process::exit(1);
  }
  println!("bağlandı: {}", obs.is_connected());
  match obs.scene_snapshot().await {
    Ok(s) => println!("sahneler: {} (program: {}), yayında: {}", s.scenes.len(), s.current_scene, s.streaming),
    Err(e) => println!("sahne listesi HATA: {e}"),
  }
  match obs.inputs().await {
    Ok(g) => println!("girişler: {} (susturulmuş: {})", g.len(), g.iter().filter(|i| i.muted).count()),
    Err(e) => println!("girişler HATA: {e}"),
  }
  match obs.canvases().await {
    Ok(t) => {
      for c in t {
        println!(
          "tuval: {} {}×{}@{:.0} ana={} ses={} sağlayıcı={:?} sahne-geçişi={}",
          c.name, c.width, c.height, c.fps, c.main, c.mix_audio, c.provider, c.scene_switch_supported
        );
      }
    }
    Err(e) => println!("tuvaller HATA: {e}"),
  }
  // Ses ölçerleri: ilk çağrı aboneliği açar, ardından OBS 50 ms'de bir seviye gönderir
  let _ = obs.meters().await;
  tokio::time::sleep(std::time::Duration::from_millis(600)).await;
  match obs.meters().await {
    Ok((l, yas)) => {
      println!("ölçerler: {} giriş, son ölçüm {} ms önce", l.len(), yas);
      for g in l {
        println!("  {:<28} tepe {:>7.1} dBFS  ort {:>7.1} dBFS", g.name, g.peak_db, g.magnitude_db);
      }
    }
    Err(e) => println!("ölçerler HATA: {e}"),
  }
  // İstek kesilince abonelik kendiliğinden kapanmalı (10 sn boşta + en çok 1 sn denetim aralığı)
  if std::env::args().any(|a| a == "--bosta") {
    println!("ölçer aboneliği açık: {}", obs.meters_active());
    tokio::time::sleep(std::time::Duration::from_millis(12_000)).await;
    println!("12 sn istek yokken abonelik açık: {}", obs.meters_active());
  }
  obs.disconnect();
  println!("bağlantı kapatıldı");
}
