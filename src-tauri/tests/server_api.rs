//! Gerçek HTTP sunucusunu ayağa kaldırıp uçtan uca zorlar.
//!
//! GUI'yi açmadan çalışır (Akıllı Uygulama Denetimi masaüstü exe'sini
//! engellediğinde tek doğrulama yolu budur) ve şu davranışları kilitler:
//!   * Ayar okuma/yazma/derin birleştirme, eşzamanlı yazma altında
//!   * Yerel video akışı: Range olmadan **asla 206** — videonun oynamama nedeni
//!   * WebSocket anlık görüntü, yayın ve ping/pong
//!   * Kötü girdiler sunucuyu düşürmemeli

use std::net::TcpListener;
use std::path::{Path, PathBuf};

use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use axthrowa_studio_lib::AppState;

struct Harness {
  base: String,
  root: PathBuf,
  client: reqwest::Client,
}

impl Drop for Harness {
  fn drop(&mut self) {
    let _ = std::fs::remove_dir_all(&self.root);
  }
}

fn free_port() -> u16 {
  TcpListener::bind("127.0.0.1:0")
    .expect("port")
    .local_addr()
    .expect("addr")
    .port()
}

async fn make_state(root: PathBuf, portable: bool, port: u16) -> AppState {
  axthrowa_studio_lib::secret_store::set_service_override("com.axthrowa.studio.test");
  let data_dir = root.join("app-data");
  tokio::task::spawn_blocking(move || AppState::new(root, data_dir, portable, port))
    .await
    .expect("AppState kurulumu")
}

async fn start() -> Harness {
  let port = free_port();
  let root = std::env::temp_dir().join(format!("yayin-itest-{port}"));
  let _ = std::fs::remove_dir_all(&root);
  std::fs::create_dir_all(videolar(&root)).unwrap();

  let state = make_state(root.clone(), false, port).await;
  tokio::spawn(async move {
    let _ = axthrowa_studio_lib::server::serve(state).await;
  });

  let base = format!("http://127.0.0.1:{port}");
  let client = reqwest::Client::builder()
    .timeout(std::time::Duration::from_secs(10))
    .build()
    .unwrap();

  // Dinlemeye başlamasını bekle
  for _ in 0..100 {
    if client.get(format!("{base}/api/health")).send().await.is_ok() {
      return Harness { base, root, client };
    }
    tokio::time::sleep(std::time::Duration::from_millis(50)).await;
  }
  panic!("sunucu {port} portunda açılmadı");
}

/// Resonance kurulu bir kök ile sunucu başlatır (callback rotası ona bağlı).
async fn start_with_resonance() -> Harness {
  let h = start().await;
  let dist = h.root.join("resonance").join("dist");
  std::fs::create_dir_all(&dist).unwrap();
  std::fs::write(dist.join("index.html"), "<html><body>resonance-test-app</body></html>").unwrap();
  // Sunucu dist'i açılışta çözüyor; dosyayı yazdıktan sonra yeniden başlat.
  restart(h).await
}

/// Aynı kök ve portla sunucuyu yeniden ayağa kaldırır.
async fn restart(h: Harness) -> Harness {
  let root = h.root.clone();
  let client = h.client.clone();
  std::mem::forget(h); // Drop kökü silmesin
  let port = free_port();
  let state = make_state(root.clone(), false, port).await;
  tokio::spawn(async move {
    let _ = axthrowa_studio_lib::server::serve(state).await;
  });
  let base = format!("http://127.0.0.1:{port}");
  for _ in 0..100 {
    if client.get(format!("{base}/api/health")).send().await.is_ok() {
      return Harness { base, root, client };
    }
    tokio::time::sleep(std::time::Duration::from_millis(50)).await;
  }
  panic!("sunucu yeniden başlamadı");
}

/// Oynatılabilir olması gerekmez; testler yalnız bayt/başlık semantiğine bakar.
/// Kütüphane sürüm klasöründe değil veri klasöründe (`<veri>/assets`, bkz. `kutuphane.rs`)
fn videolar(root: &Path) -> PathBuf {
  root.join("app-data").join("assets").join("videos")
}

fn write_video(root: &Path, name: &str, len: usize) -> PathBuf {
  let path = videolar(root).join(name);
  let data: Vec<u8> = (0..len).map(|i| (i % 251) as u8).collect();
  std::fs::write(&path, data).unwrap();
  path
}

#[tokio::test]
async fn health_and_server_info() {
  let h = start().await;
  let res = h.client.get(format!("{}/api/health", h.base)).send().await.unwrap();
  assert!(res.status().is_success());
  assert_eq!(res.text().await.unwrap(), "ok");

  let info: Value = h
    .client
    .get(format!("{}/api/server", h.base))
    .send()
    .await
    .unwrap()
    .json()
    .await
    .unwrap();
  assert!(info["overlays"]["chat"].as_str().unwrap().ends_with("/chat?obs=1"));
}

#[tokio::test]
async fn settings_roundtrip_and_deep_merge() {
  let h = start().await;

  let before: Value = h
    .client
    .get(format!("{}/api/settings?screen=starting", h.base))
    .send()
    .await
    .unwrap()
    .json()
    .await
    .unwrap();
  assert!(before["positions"]["title"].is_object(), "varsayılanlar yüklenmeli");

  // Patch yalnız verilen dalı değiştirmeli
  let merged: Value = h
    .client
    .post(format!("{}/api/settings/patch?screen=starting", h.base))
    .json(&json!({ "positions": { "title": { "x": 12 } }, "yeniAlan": "değer" }))
    .send()
    .await
    .unwrap()
    .json()
    .await
    .unwrap();
  assert_eq!(merged["positions"]["title"]["x"], 12);
  assert_eq!(merged["positions"]["title"]["y"], before["positions"]["title"]["y"]);
  assert!(merged["positions"]["logo"].is_object(), "diğer dallar korunmalı");
  assert_eq!(merged["yeniAlan"], "değer");

  // Diske yazılmış olmalı
  let disk = std::fs::read_to_string(h.root.join("app-data").join("settings-starting.json")).unwrap();
  assert!(disk.contains("yeniAlan"));

  // Tam POST yerine koyar
  let res = h
    .client
    .post(format!("{}/api/settings?screen=chat", h.base))
    .json(&json!({ "kickSlug": "axthrowa" }))
    .send()
    .await
    .unwrap();
  assert!(res.status().is_success());
  let chat: Value = h
    .client
    .get(format!("{}/api/settings?screen=chat", h.base))
    .send()
    .await
    .unwrap()
    .json()
    .await
    .unwrap();
  assert_eq!(chat["kickSlug"], "axthrowa");
  assert!(chat.get("maxMessages").is_none(), "POST tam değişim olmalı");
}

#[tokio::test]
async fn concurrent_writes_never_corrupt_state() {
  let h = start().await;

  let mut tasks = Vec::new();
  for i in 0..64 {
    let client = h.client.clone();
    let base = h.base.clone();
    tasks.push(tokio::spawn(async move {
      client
        .post(format!("{base}/api/settings/patch?screen=brb"))
        .json(&json!({ "sayac": i, "derin": { format!("k{i}"): i } }))
        .send()
        .await
        .map(|r| r.status().as_u16())
    }));
  }
  for t in tasks {
    assert_eq!(t.await.unwrap().unwrap(), 200);
  }

  let final_state: Value = h
    .client
    .get(format!("{}/api/settings?screen=brb", h.base))
    .send()
    .await
    .unwrap()
    .json()
    .await
    .unwrap();
  // 64 patch'in tamamı derin birleştirmeyle birikmeli
  let deep = final_state["derin"].as_object().expect("derin nesne");
  assert_eq!(deep.len(), 64, "eşzamanlı patch'ler kayboldu: {}", deep.len());
  assert!(final_state["liveText"].is_string(), "varsayılanlar silinmemeli");

  // Diskteki JSON geçerli kalmalı (atomik yazma)
  let disk = std::fs::read_to_string(h.root.join("app-data").join("settings-brb.json")).unwrap();
  serde_json::from_str::<Value>(&disk).expect("disk JSON'u bozulmuş");
}

#[tokio::test]
async fn local_video_is_served_without_bogus_206() {
  let h = start().await;
  // 4 MiB — eski kod bu boyutta Range'siz istekte 206 dönüyordu ve
  // WebView videoyu hiç başlatmıyordu.
  let name = "test klip ： özel.webm";
  write_video(&h.root, name, 4 * 1024 * 1024);
  let url = format!(
    "{}/assets/videos/{}",
    h.base,
    urlencoding::encode(name)
  );

  let res = h.client.get(&url).send().await.unwrap();
  assert_eq!(res.status(), 200, "Range yokken 200 dönmeli, 206 değil");
  assert_eq!(
    res.headers().get("accept-ranges").and_then(|v| v.to_str().ok()),
    Some("bytes"),
    "tarayıcı arama yapabilmek için Accept-Ranges görmeli"
  );
  let body = res.bytes().await.unwrap();
  assert_eq!(body.len(), 4 * 1024 * 1024);

  // Kısmi istek
  let res = h
    .client
    .get(&url)
    .header("Range", "bytes=1024-2047")
    .send()
    .await
    .unwrap();
  assert_eq!(res.status(), 206);
  assert_eq!(
    res.headers().get("content-range").unwrap().to_str().unwrap(),
    format!("bytes 1024-2047/{}", 4 * 1024 * 1024)
  );
  let part = res.bytes().await.unwrap();
  assert_eq!(part.len(), 1024);
  assert_eq!(part[0], (1024 % 251) as u8);
}

#[tokio::test]
async fn media_file_endpoint_streams_and_blocks_traversal() {
  let h = start().await;
  let path = write_video(&h.root, "mutlak.mp4", 3 * 1024 * 1024);
  let url = format!(
    "{}/media/file?path={}",
    h.base,
    urlencoding::encode(&path.to_string_lossy())
  );

  let res = h.client.get(&url).send().await.unwrap();
  assert_eq!(res.status(), 200);
  assert_eq!(
    res.headers().get("content-type").unwrap().to_str().unwrap(),
    "video/mp4"
  );
  assert_eq!(res.bytes().await.unwrap().len(), 3 * 1024 * 1024);

  let res = h
    .client
    .get(&url)
    .header("Range", "bytes=0-")
    .send()
    .await
    .unwrap();
  assert_eq!(res.status(), 206);
  let len = res.bytes().await.unwrap().len();
  assert!(len > 0 && len <= 4 * 1024 * 1024, "parça boyutu: {len}");

  // Medya olmayan dosya mutlak yolla bile sunulmamalı (eskiden sunuluyordu)
  let gizli = h.root.join("gizli-ayar.json");
  std::fs::write(&gizli, b"{\"token\":\"x\"}").unwrap();
  let res = h
    .client
    .get(format!(
      "{}/media/file?path={}",
      h.base,
      urlencoding::encode(&gizli.to_string_lossy())
    ))
    .send()
    .await
    .unwrap();
  assert_eq!(res.status(), 400, "medya dışı dosya sunuldu");

  // Dizin dışına çıkma engellenmeli
  for bad in ["../../../Windows/win.ini", "video.mp4", ""] {
    let res = h
      .client
      .get(format!(
        "{}/media/file?path={}",
        h.base,
        urlencoding::encode(bad)
      ))
      .send()
      .await
      .unwrap();
    assert_eq!(res.status(), 400, "engellenmeliydi: {bad}");
  }
}

#[tokio::test]
async fn websocket_snapshot_broadcast_and_pong() {
  let h = start().await;
  let ws_url = format!("{}/ws/overlay-sync", h.base.replace("http", "ws"));

  let (mut socket, _) = tokio_tungstenite::connect_async(&ws_url).await.unwrap();

  // 1) İlk anlık görüntü
  let first = next_json(&mut socket).await;
  assert_eq!(first["type"], "snapshot");
  assert!(first["starting"].is_object());
  assert!(first["chat"].is_object());

  // 2) Canlılık yoklaması yanıtlanmalı — yoksa overlay bağlantıyı ölü sayıyor
  socket
    .send(tokio_tungstenite::tungstenite::Message::Text(
      json!({ "type": "ping" }).to_string().into(),
    ))
    .await
    .unwrap();
  let pong = next_json(&mut socket).await;
  assert_eq!(pong["type"], "pong");

  // 3) HTTP üzerinden yapılan değişiklik WebSocket'e düşmeli
  h.client
    .post(format!("{}/api/settings/patch?screen=chat", h.base))
    .json(&json!({ "maxMessages": 123 }))
    .send()
    .await
    .unwrap();

  let evt = next_json(&mut socket).await;
  assert_eq!(evt["type"], "settings");
  assert_eq!(evt["screen"], "chat");
  assert_eq!(evt["data"]["maxMessages"], 123);
}

#[tokio::test]
async fn many_websocket_clients_all_receive_broadcast() {
  let h = start().await;
  let ws_url = format!("{}/ws/overlay-sync", h.base.replace("http", "ws"));

  let mut sockets = Vec::new();
  for _ in 0..24 {
    let (mut s, _) = tokio_tungstenite::connect_async(&ws_url).await.unwrap();
    let snap = next_json(&mut s).await;
    assert_eq!(snap["type"], "snapshot");
    sockets.push(s);
  }

  h.client
    .post(format!("{}/api/settings/patch?screen=ending", h.base))
    .json(&json!({ "yayinTesti": 7 }))
    .send()
    .await
    .unwrap();

  for (i, s) in sockets.iter_mut().enumerate() {
    let evt = next_json(s).await;
    assert_eq!(evt["type"], "settings", "istemci {i} yayını almadı");
    assert_eq!(evt["data"]["yayinTesti"], 7);
  }
}

#[tokio::test]
async fn hostile_input_does_not_take_the_server_down() {
  let h = start().await;

  let bad_requests: Vec<(String, u16)> = vec![
    (format!("{}/api/settings?screen=yokboyle", h.base), 400),
    (format!("{}/api/settings?screen=", h.base), 400),
    (format!("{}/api/youtube/chat?video_id=kısa", h.base), 502),
  ];
  for (url, want) in bad_requests {
    let res = h.client.get(&url).send().await.unwrap();
    assert_eq!(res.status().as_u16(), want, "{url}");
  }

  // Bozuk JSON gövdesi
  let res = h
    .client
    .post(format!("{}/api/settings?screen=chat", h.base))
    .header("Content-Type", "application/json")
    .body("{bu json değil")
    .send()
    .await
    .unwrap();
  assert!(res.status().is_client_error(), "beklenen 4xx, gelen {}", res.status());

  // Çok büyük ama geçerli gövde
  let big: String = "x".repeat(256 * 1024);
  let res = h
    .client
    .post(format!("{}/api/settings/patch?screen=panel", h.base))
    .json(&json!({ "buyuk": big }))
    .send()
    .await
    .unwrap();
  assert!(res.status().is_success());

  // Sunucu hâlâ sağlıklı
  let res = h.client.get(format!("{}/api/health", h.base)).send().await.unwrap();
  assert!(res.status().is_success(), "kötü girdiler sunucuyu düşürdü");
}

#[tokio::test]
async fn library_listings_are_arrays_and_reflect_disk() {
  let h = start().await;
  for kind in ["videos", "music", "logos", "backgrounds", "particles"] {
    let list: Value = h
      .client
      .get(format!("{}/api/{kind}", h.base))
      .send()
      .await
      .unwrap()
      .json()
      .await
      .unwrap();
    assert!(list.is_array(), "{kind} dizi değil");
  }

  write_video(&h.root, "a.mp4", 16);
  write_video(&h.root, "b.webm", 16);
  // Videolar arasına video olmayan bir dosya bırak — listeye sızmamalı
  std::fs::write(videolar(&h.root).join("notlar.txt"), b"x").unwrap();

  let list: Vec<String> = h
    .client
    .get(format!("{}/api/videos", h.base))
    .send()
    .await
    .unwrap()
    .json()
    .await
    .unwrap();
  assert_eq!(list, vec!["a.mp4".to_string(), "b.webm".to_string()]);
}

#[tokio::test]
async fn sustained_load_stays_correct() {
  let h = start().await;
  write_video(&h.root, "yuk.mp4", 2 * 1024 * 1024);

  let mut tasks = Vec::new();
  for i in 0..48 {
    let client = h.client.clone();
    let base = h.base.clone();
    tasks.push(tokio::spawn(async move {
      let mut ok = 0usize;
      for _ in 0..8 {
        let r = match i % 3 {
          0 => client.get(format!("{base}/api/settings?screen=starting")).send().await,
          1 => client.get(format!("{base}/api/videos")).send().await,
          _ => {
            client
              .get(format!("{base}/assets/videos/yuk.mp4"))
              .header("Range", "bytes=0-65535")
              .send()
              .await
          }
        };
        if let Ok(res) = r {
          if res.status().is_success() {
            ok += 1;
          }
          let _ = res.bytes().await;
        }
      }
      ok
    }));
  }

  let mut total = 0usize;
  for t in tasks {
    total += t.await.unwrap();
  }
  assert_eq!(total, 48 * 8, "yük altında {total}/384 istek başarılı");

  let res = h.client.get(format!("{}/api/health", h.base)).send().await.unwrap();
  assert!(res.status().is_success());
}

/// Gömülü müzik eklentisi: köprü yazar, panel/overlay okur, WS haber alır.
#[tokio::test]
async fn now_playing_is_shared_between_bridge_panel_and_overlays() {
  let h = start().await;
  let ws_url = format!("{}/ws/overlay-sync", h.base.replace("http", "ws"));
  let (mut socket, _) = tokio_tungstenite::connect_async(&ws_url).await.unwrap();
  let snap = next_json(&mut socket).await;
  assert_eq!(snap["type"], "snapshot");
  assert!(snap["nowPlaying"].is_null(), "başlangıçta çalan bir şey yok");

  // Boşken uç `null` dönmeli — overlay bunu "gizle" olarak yorumlar
  let empty: Value = h
    .client
    .get(format!("{}/api/now-playing", h.base))
    .send()
    .await
    .unwrap()
    .json()
    .await
    .unwrap();
  assert!(empty.is_null());

  // Resonance köprüsünün yazdığı gibi
  let res = h
    .client
    .post(format!("{}/api/now-playing", h.base))
    .json(&json!({
      "title": "Kalbim Ege'de Kaldı",
      "artist": "Barış Manço",
      "albumArt": "http://x/cover.jpg",
      "isPlaying": true,
      "progress": 42_000,
      "duration": 210_000,
      "source": "youtube-music"
    }))
    .send()
    .await
    .unwrap();
  assert!(res.status().is_success());

  let evt = next_json(&mut socket).await;
  assert_eq!(evt["type"], "now-playing");
  assert_eq!(evt["data"]["title"], "Kalbim Ege'de Kaldı");

  let np: Value = h
    .client
    .get(format!("{}/api/now-playing", h.base))
    .send()
    .await
    .unwrap()
    .json()
    .await
    .unwrap();
  assert_eq!(np["artist"], "Barış Manço");
  assert_eq!(np["isPlaying"], true);
  assert!(np["updatedAt"].as_i64().unwrap() > 0, "zaman damgası eklenmeli");

  let status: Value = h
    .client
    .get(format!("{}/api/player/status", h.base))
    .send()
    .await
    .unwrap()
    .json()
    .await
    .unwrap();
  assert_eq!(status["nowPlaying"]["title"], "Kalbim Ege'de Kaldı");
  assert_eq!(status["spotify"]["connected"], false);
  assert_eq!(status["ytmd"]["connected"], false);

  // Parça bitince köprü `null` gönderir
  h.client
    .post(format!("{}/api/now-playing", h.base))
    .json(&Value::Null)
    .send()
    .await
    .unwrap();
  let cleared: Value = h
    .client
    .get(format!("{}/api/now-playing", h.base))
    .send()
    .await
    .unwrap()
    .json()
    .await
    .unwrap();
  assert!(cleared.is_null());
}

#[tokio::test]
async fn player_source_and_credentials_persist() {
  let h = start().await;

  let status: Value = h
    .client
    .post(format!("{}/api/player/source", h.base))
    .json(&json!({ "source": "youtube-music" }))
    .send()
    .await
    .unwrap()
    .json()
    .await
    .unwrap();
  assert_eq!(status["source"], "youtube-music");

  let status: Value = h
    .client
    .post(format!("{}/api/player/ytmd/session", h.base))
    .json(&json!({ "host": "127.0.0.1", "port": "9863", "token": "tok-123" }))
    .send()
    .await
    .unwrap()
    .json()
    .await
    .unwrap();
  assert_eq!(status["ytmd"]["connected"], true);

  // Diske yazılmalı: uygulama yeniden açıldığında tekrar eşleşme istemesin
  let disk = std::fs::read_to_string(h.root.join("app-data").join("music.json")).unwrap();
  assert!(disk.contains("tok-123"), "YTMD oturumu kalıcı değil: {disk}");
  assert!(disk.contains("youtube-music"));
}

#[tokio::test]
async fn spotify_authorize_url_is_pkce_and_loopback() {
  let h = start().await;

  let body: Value = h
    .client
    .post(format!("{}/api/player/spotify/authorize", h.base))
    .json(&json!({ "clientId": "abc123" }))
    .send()
    .await
    .unwrap()
    .json()
    .await
    .unwrap();

  let url = body["url"].as_str().unwrap();
  assert!(url.starts_with("https://accounts.spotify.com/authorize?"));
  assert!(url.contains("code_challenge_method=S256"));
  assert!(url.contains("client_id=abc123"));
  // Spotify yalnız loopback adreslerinde düz http kabul ediyor; "localhost"
  // artık reddediliyor — kayıp bağlantının asıl sebebi buydu.
  let redirect = body["redirectUri"].as_str().unwrap();
  assert!(redirect.starts_with("http://127.0.0.1:"), "{redirect}");
  // Varsayılan, .env.example'da belgelenen ve kullanıcıların Dashboard'a
  // kaydettiği adres olmalı
  assert!(redirect.ends_with("/resonance/callback"), "{redirect}");
  assert!(url.contains(&urlencoding::encode(redirect).to_string()));
  // Arayüz seçenekleri kullanıcıya gösterebilsin; sayı sunucudaki listeyle
  // aynı olmalı (sabit bir sayı yazmak listeyi büyütünce testi kırıyordu).
  let allowed = body["allowedRedirectUris"].as_array().unwrap();
  assert_eq!(
    allowed.len(),
    axthrowa_studio_lib::server::SPOTIFY_CALLBACK_PATHS.len(),
    "{allowed:?}"
  );
  // Her seçenek bizim sunucumuza işaret etmeli
  for a in allowed {
    assert!(a.as_str().unwrap().starts_with(&h.base), "{a}");
  }
  // Kontrol düğmeleri için yazma izni istenmiş olmalı
  assert!(url.contains("user-modify-playback-state"));

  // Client ID boşsa net hata
  let res = h
    .client
    .post(format!("{}/api/player/spotify/authorize", h.base))
    .json(&json!({ "clientId": "  " }))
    .send()
    .await
    .unwrap();
  assert_eq!(res.status(), 400);

  // Kod olmadan gelen callback sunucuyu düşürmemeli
  let res = h
    .client
    .get(format!("{}/api/player/spotify/callback?error=access_denied", h.base))
    .send()
    .await
    .unwrap();
  assert!(res.status().is_success());
  assert!(res.text().await.unwrap().contains("access_denied"));
}

/// Spotify "redirect_uri: Not matching configuration" hatasının kaynağı:
/// Dashboard'da kayıtlı olmayan adresle gidilmesi. İstemci hangisini
/// kaydettiyse onu seçebilmeli, yabancı adres ise asla kullanılmamalı.
#[tokio::test]
async fn spotify_redirect_uri_is_selectable_but_allowlisted() {
  let h = start().await;

  let ask = |redirect: Option<&str>| {
    let client = h.client.clone();
    let base = h.base.clone();
    let body = match redirect {
      Some(r) => json!({ "clientId": "abc123", "redirectUri": r }),
      None => json!({ "clientId": "abc123" }),
    };
    async move {
      client
        .post(format!("{base}/api/player/spotify/authorize"))
        .json(&body)
        .send()
        .await
        .unwrap()
        .json::<Value>()
        .await
        .unwrap()
    }
  };

  // İzinli iki yol da aynen kullanılmalı
  for path in ["/resonance/callback", "/api/player/spotify/callback"] {
    let want = format!("{}{path}", h.base);
    let body = ask(Some(&want)).await;
    assert_eq!(body["redirectUri"].as_str().unwrap(), want, "{path}");
    assert!(body["url"].as_str().unwrap().contains(&urlencoding::encode(&want).to_string()));
  }

  // Yabancı adrese yetkilendirme kodu gönderilmemeli
  for bad in ["https://evil.example/steal", "http://127.0.0.1:1/resonance/callback"] {
    let body = ask(Some(bad)).await;
    let used = body["redirectUri"].as_str().unwrap();
    assert_ne!(used, bad);
    assert!(used.starts_with(&h.base), "{used}");
  }
}

/// `/resonance/callback` hem uygulamayı hem Spotify dönüşünü karşılar.
#[tokio::test]
async fn resonance_callback_serves_app_without_code() {
  let h = start_with_resonance().await;

  // Kod yoksa Resonance arayüzü gelmeli
  let res = h
    .client
    .get(format!("{}/resonance/callback", h.base))
    .send()
    .await
    .unwrap();
  assert!(res.status().is_success());
  assert!(res.text().await.unwrap().contains("resonance-test-app"));

  // Hata parametresi geldiyse sunucu kendi sonuç sayfasını göstermeli
  let res = h
    .client
    .get(format!("{}/resonance/callback?error=access_denied", h.base))
    .send()
    .await
    .unwrap();
  assert!(res.status().is_success());
  let body = res.text().await.unwrap();
  assert!(body.contains("access_denied"), "{body}");
  assert!(!body.contains("resonance-test-app"));
}

/// Bitiş ekranı sorgusu — arka plan videosunun boşuna kısalmamasının dayanağı.
///
/// Perdenin gerçekten nerede başladığını bilmezsek her videodan körlemesine
/// 20 sn kesmek zorunda kalıyoruz. Ağ yoksa test sessizce geçer; asıl
/// ayrıştırma mantığı `youtube_chat` birim testlerinde sabitli.
#[tokio::test]
async fn youtube_endscreen_probe_reports_real_cards() {
  let h = start().await;

  // Geçersiz kimlikle ağa hiç çıkılmamalı
  for bad in ["kisa", "on-bir-degil-bu", ""] {
    let res = h
      .client
      .get(format!("{}/api/youtube/endscreen?video_id={bad}", h.base))
      .send()
      .await
      .unwrap();
    assert_eq!(res.status(), 502, "kimlik: {bad}");
  }

  let url = format!("{}/api/youtube/endscreen?video_id=dQw4w9WgXcQ", h.base);
  let Ok(res) = h.client.get(&url).send().await else {
    eprintln!("ağ yok — canlı bitiş ekranı sorgusu atlandı");
    return;
  };
  if !res.status().is_success() {
    eprintln!("YouTube'a ulaşılamadı ({}) — atlandı", res.status());
    return;
  }

  let info: Value = res.json().await.unwrap();
  assert_eq!(info["hasEndScreen"], true, "bu videoda bitiş ekranı var: {info}");
  let start = info["startSec"].as_f64().expect("perde başlangıcı");
  let len = info["lengthSeconds"].as_f64().expect("süre");
  assert!(start > 0.0 && start < len, "perde {start}, süre {len}");
  // Perde videonun sonuna yakın açılmalı; başına düşen bir değer ayrıştırmanın
  // yanlış `startMs` yakaladığını gösterir.
  assert!(start > len * 0.5, "perde çok erken: {start}/{len}");

  // İkinci çağrı önbellekten gelmeli — aynı yanıt, yeni indirme yok.
  let again: Value = h.client.get(&url).send().await.unwrap().json().await.unwrap();
  assert_eq!(again, info);
}

#[tokio::test]
async fn player_command_without_connection_fails_loudly() {
  let h = start().await;
  let res = h
    .client
    .post(format!("{}/api/player/command", h.base))
    .json(&json!({ "action": "next" }))
    .send()
    .await
    .unwrap();
  assert_eq!(res.status(), 502);
  assert!(res.text().await.unwrap().contains("bağlı değil"));
}

async fn next_json<S>(socket: &mut S) -> Value
where
  S: StreamExt<Item = Result<tokio_tungstenite::tungstenite::Message, tokio_tungstenite::tungstenite::Error>>
    + Unpin,
{
  let deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(10);
  loop {
    let msg = tokio::time::timeout_at(deadline, socket.next())
      .await
      .expect("WebSocket mesajı zaman aşımına uğradı")
      .expect("akış kapandı")
      .expect("WebSocket hatası");
    if let tokio_tungstenite::tungstenite::Message::Text(t) = msg {
      return serde_json::from_str(&t).expect("geçersiz JSON");
    }
  }
}

/// Geliştirme yardımcısı: gerçek `cikti\portable` klasörünü kök alarak
/// sunucuyu 8843'te açık tutar; arayüz tarayıcıda doğrulanabilsin diye.
/// Uygulama zaten çalışıyorsa `SMOKE_PORT` ile başka bir porta alınabilir.
/// Normal test koşusunda çalışmaz.
///     cargo test --release --test server_api -- --ignored serve_portable --nocapture
#[tokio::test]
#[ignore]
async fn serve_portable() {
  let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
    .parent()
    .unwrap()
    .join("cikti")
    .join("portable");
  let port: u16 = std::env::var("SMOKE_PORT")
    .ok()
    .and_then(|v| v.parse().ok())
    .unwrap_or(8843);
  let state = make_state(root.clone(), true, port).await;
  println!("kök: {}", root.display());
  println!("panel: http://127.0.0.1:{port}/panel");
  axthrowa_studio_lib::server::serve(state).await.unwrap();
}

/// Hazır refresh token yolu: geçersiz token sessizce kaydedilmemeli.
#[tokio::test]
async fn refresh_token_path_validates_before_saving() {
  let h = start().await;

  // Boş alanlar net hata vermeli
  for body in [
    json!({ "clientId": "", "refreshToken": "abc" }),
    json!({ "clientId": "abc", "refreshToken": "   " }),
  ] {
    let res = h
      .client
      .post(format!("{}/api/player/spotify/token", h.base))
      .json(&body)
      .send()
      .await
      .unwrap();
    assert!(res.status().is_client_error() || res.status().as_u16() == 502, "{body}");
  }

  // Uydurma token Spotify tarafından reddedilir; bağlantı kurulmuş sayılmamalı
  let res = h
    .client
    .post(format!("{}/api/player/spotify/token", h.base))
    .json(&json!({ "clientId": "abc123", "refreshToken": "gecersiz-token-testi" }))
    .send()
    .await
    .unwrap();
  assert!(!res.status().is_success());

  let status: Value = h
    .client
    .get(format!("{}/api/player/status", h.base))
    .send()
    .await
    .unwrap()
    .json()
    .await
    .unwrap();
  assert_eq!(status["spotify"]["connected"], false, "gecersiz token baglandi sayildi");
}

/// Spotify hataları panelde görünsün: onay tarayıcıda verildiği için
/// mesaj aksi halde kaybolup "bağlanmıyor" olarak kalıyordu.
#[tokio::test]
async fn spotify_failures_are_recorded_in_status() {
  let h = start().await;

  // Reddedilen onay
  let res = h
    .client
    .get(format!("{}/api/player/spotify/callback?error=access_denied", h.base))
    .send()
    .await
    .unwrap();
  assert!(res.status().is_success());
  let page = res.text().await.unwrap();
  assert!(page.contains("access_denied"));
  // Hata sayfası kendini kapatmamalı
  assert!(page.contains("if(false)"), "hata sayfasi otomatik kapaniyor");

  let status: Value = h
    .client
    .get(format!("{}/api/player/status", h.base))
    .send()
    .await
    .unwrap()
    .json()
    .await
    .unwrap();
  let note = status["note"].as_str().unwrap_or("");
  assert!(note.contains("access_denied"), "not kaydedilmedi: {note}");

  // Authorize sonrası not, kaydedilmesi gereken adresi söylemeli
  h.client
    .post(format!("{}/api/player/spotify/authorize", h.base))
    .json(&json!({ "clientId": "abc123" }))
    .send()
    .await
    .unwrap();
  let status: Value = h
    .client
    .get(format!("{}/api/player/status", h.base))
    .send()
    .await
    .unwrap()
    .json()
    .await
    .unwrap();
  let note = status["note"].as_str().unwrap_or("");
  assert!(note.contains("/resonance/callback"), "adres ipucu yok: {note}");
}

/// Yayıncının tarayıcısında açık bir yabancı site yerel API'yi yönetememeli.
///
/// Eskiden CORS her kökene açıktı ve Host denetlenmiyordu: herhangi bir web
/// sayfası ayarları okuyup değiştirebiliyor, WebSocket'ten canlı veriyi
/// dinleyebiliyordu.
#[tokio::test]
async fn foreign_sites_cannot_drive_the_local_api() {
  let h = start().await;
  let patch = format!("{}/api/settings/patch?screen=starting", h.base);

  // 1) Yabancı kökenden yazma → 403 ve ayar değişmez
  let res = h
    .client
    .post(&patch)
    .header("Origin", "https://kotu.example")
    .json(&json!({ "saldiri": "evet" }))
    .send()
    .await
    .unwrap();
  assert_eq!(res.status(), 403);
  let s: Value = h
    .client
    .get(format!("{}/api/settings?screen=starting", h.base))
    .send()
    .await
    .unwrap()
    .json()
    .await
    .unwrap();
  assert!(s.get("saldiri").is_none(), "yabancı köken ayarı değiştirdi");

  // 2) Yerel köken (panelin kendisi) yazabilir
  let res = h
    .client
    .post(&patch)
    .header("Origin", h.base.as_str())
    .json(&json!({ "yerel": "evet" }))
    .send()
    .await
    .unwrap();
  assert!(res.status().is_success());

  // 3) Yabancı köken yanıtı okuyamaz: CORS izni verilmez
  let res = h
    .client
    .get(format!("{}/api/settings?screen=panel", h.base))
    .header("Origin", "https://kotu.example")
    .send()
    .await
    .unwrap();
  assert!(res.headers().get("access-control-allow-origin").is_none());
  let res = h
    .client
    .get(format!("{}/api/settings?screen=panel", h.base))
    .header("Origin", "http://localhost:3001")
    .send()
    .await
    .unwrap();
  assert_eq!(
    res.headers().get("access-control-allow-origin").unwrap(),
    "http://localhost:3001"
  );

  // 4) DNS yeniden bağlama: yabancı alan adıyla gelen Host reddedilir
  let res = h
    .client
    .get(format!("{}/api/settings?screen=panel", h.base))
    .header("Host", "kotu.example:8843")
    .send()
    .await
    .unwrap();
  assert_eq!(res.status(), 403);

  // 5) Yabancı kökenden WebSocket el sıkışması reddedilir
  use tokio_tungstenite::tungstenite::client::IntoClientRequest;
  let ws_url = format!("{}/ws/overlay-sync", h.base.replace("http", "ws"));
  let mut req = ws_url.as_str().into_client_request().unwrap();
  req
    .headers_mut()
    .insert("Origin", "https://kotu.example".parse().unwrap());
  assert!(tokio_tungstenite::connect_async(req).await.is_err());
  let mut req = ws_url.as_str().into_client_request().unwrap();
  req.headers_mut().insert("Origin", h.base.parse().unwrap());
  assert!(tokio_tungstenite::connect_async(req).await.is_ok());
}

/// Çoklu yayın API'si: hedef ekleme/doğrulama/silme, anahtarın hiçbir yanıta ve denetim kaydına düşmemesi,
/// onaysız "hepsini bitir"in reddedilmesi.
#[tokio::test]
async fn multistream_api_keys_never_leak_and_actions_are_audited() {
  let h = start().await;
  let gizli = format!("live_{}_TESTANAHTAR", free_port());

  let s: Value = h.client.get(format!("{}/api/multistream", h.base)).send().await.unwrap().json().await.unwrap();
  assert_eq!(s["destinations"].as_array().unwrap().len(), 0);
  assert_eq!(s["presets"].as_array().unwrap().len(), 4);

  // Anahtar sunucu alanına yapıştırılırsa reddedilir
  let res = h
    .client
    .post(format!("{}/api/multistream/destinations", h.base))
    .json(&json!({"name": "Twitch", "platform": "twitch", "server": format!("rtmps://live.twitch.tv/app/{gizli}")}))
    .send()
    .await
    .unwrap();
  assert_eq!(res.status(), 400);

  let res = h
    .client
    .post(format!("{}/api/multistream/destinations", h.base))
    .json(&json!({"id": "itest-twitch", "name": "Twitch", "platform": "twitch", "server": "rtmps://live.twitch.tv:443/app", "key": gizli}))
    .send()
    .await
    .unwrap();
  assert!(res.status().is_success());
  let body = res.text().await.unwrap();
  assert!(!body.contains(&gizli), "yanıtta anahtar var");
  let s: Value = serde_json::from_str(&body).unwrap();
  let d = &s["destinations"][0];
  assert_eq!(d["hasKey"], true);
  assert_eq!(d["state"], "ready");

  // Ayar dosyasına anahtar yazılmamalı
  let disk = std::fs::read_to_string(h.root.join("app-data").join("settings-panel.json")).unwrap();
  assert!(disk.contains("itest-twitch") && !disk.contains(&gizli));

  // Onaysız oturum kapatma reddedilir
  let res = h
    .client
    .post(format!("{}/api/multistream/session/stop", h.base))
    .json(&json!({}))
    .send()
    .await
    .unwrap();
  assert_eq!(res.status(), 400);

  // Kontrol listesi çalışır (OBS bağlı değil uyarısı beklenir)
  let p: Value = h.client.get(format!("{}/api/multistream/preflight", h.base)).send().await.unwrap().json().await.unwrap();
  assert!(p["findings"].as_array().unwrap().iter().any(|f| f["id"] == "system.obs"));

  // Denetim günlüğü: eylem var, anahtar yok
  let a = h.client.get(format!("{}/api/audit", h.base)).send().await.unwrap().text().await.unwrap();
  assert!(a.contains("MULTISTREAM_DEST_ADD"));
  assert!(!a.contains(&gizli), "denetim kaydında anahtar var");

  // Silme anahtarı da Kimlik Yöneticisinden kaldırır
  let res = h
    .client
    .post(format!("{}/api/multistream/destinations/delete", h.base))
    .json(&json!({"id": "itest-twitch"}))
    .send()
    .await
    .unwrap();
  assert!(res.status().is_success());
  assert!(axthrowa_studio_lib::secret_store::get_secret("multistream.key.itest-twitch").is_none());
}

/// Eylem kayıt defteri: onay zorunluluğu, kullanılabilirlik, bilinmeyen eylem, AxBoT'a iletim ve denetim kaydı.
/// AxBoT yerine test içinde sahte bir uyarı denetimi sunucusu açılır (gerçek bota dokunulmaz).
#[tokio::test(flavor = "multi_thread")]
async fn action_registry_enforces_confirmation_availability_and_audit() {
  use std::sync::{Arc, Mutex};
  let alinan: Arc<Mutex<Vec<Value>>> = Arc::new(Mutex::new(Vec::new()));
  let kayit = alinan.clone();
  let sahte = axum::Router::new().route(
    "/api/alerts/control",
    axum::routing::post(move |axum::Json(govde): axum::Json<Value>| {
      let kayit = kayit.clone();
      async move {
        let eylem = govde["action"].as_str().unwrap_or("").to_string();
        kayit.lock().unwrap().push(govde);
        if eylem == "skip" {
          (axum::http::StatusCode::CONFLICT, axum::Json(json!({"error": "Başka biri az önce değiştirdi"})))
        } else {
          (axum::http::StatusCode::OK, axum::Json(json!({"state": {"paused": eylem == "pause", "version": 7}})))
        }
      }
    }),
  );
  let dinleyici = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
  let sahte_port = dinleyici.local_addr().unwrap().port();
  tokio::spawn(async move { axum::serve(dinleyici, sahte).await.unwrap() });
  // Bu değişkeni yalnız eylem iletimi ve ön kontrolün çapraz sohbet sorgusu okur (2021 sürümünde set_var güvenli)
  std::env::set_var("AXBOT_PORT", sahte_port.to_string());

  let h = start().await;
  let liste: Value = h.client.get(format!("{}/api/actions", h.base)).send().await.unwrap().json().await.unwrap();
  let eylemler = liste["actions"].as_array().unwrap();
  assert!(eylemler.len() >= 18);
  let bul = |id: &str| eylemler.iter().find(|a| a["id"] == id).unwrap().clone();
  assert_eq!(bul("scene.switch")["available"], false, "OBS bağlı değilken sahne eylemi kullanılabilir görünmemeli");
  assert_eq!(bul("scene.switch")["reason"], "OBS bağlı değil");
  assert_eq!(bul("destination.stop")["available"], false);
  assert_eq!(bul("stream.stop")["confirm"], true);
  // OBS'e bağlı değilken salt-okunur OBS uçları açık çakışma döner (boş liste uydurmaz)
  for yol in ["/api/obs/canvases", "/api/obs/meters"] {
    let r = h.client.get(format!("{}{yol}", h.base)).send().await.unwrap();
    assert_eq!(r.status(), 409, "{yol}");
  }

  let calistir = |govde: Value| {
    let c = h.client.clone();
    let url = format!("{}/api/actions/run", h.base);
    async move { c.post(url).json(&govde).send().await.unwrap() }
  };
  // Onaysız yayın durdurma reddedilir (OBS'e hiç gidilmez)
  assert_eq!(calistir(json!({"id": "stream.stop"})).await.status(), 428);
  // Bilinmeyen eylem ve eksik parametre
  assert_eq!(calistir(json!({"id": "uydurma"})).await.status(), 404);
  assert_eq!(calistir(json!({"id": "scene.switch", "params": {}})).await.status(), 400);
  // Bileşen yoksa açık çakışma
  let r = calistir(json!({"id": "scene.switch", "params": {"scene": "Oyun"}})).await;
  assert_eq!(r.status(), 409);
  assert!(r.text().await.unwrap().contains("OBS"));
  assert_eq!(calistir(json!({"id": "destination.start", "params": {"id": "yok"}})).await.status(), 409);

  // AxBoT'a iletim: durum geri döner, istek yerel aktörle gider
  let r = calistir(json!({"id": "alert.pause"})).await;
  assert!(r.status().is_success());
  let v: Value = r.json().await.unwrap();
  assert_eq!(v["result"]["paused"], true);
  // AxBoT çakışması arayüze hata olarak taşınır
  let r = calistir(json!({"id": "alert.skip"})).await;
  assert_eq!(r.status(), 502);
  assert!(r.text().await.unwrap().contains("değiştirdi"));
  {
    let a = alinan.lock().unwrap();
    assert_eq!(a.len(), 2);
    assert_eq!(a[0]["action"], "pause");
    assert_eq!(a[0]["actor"], "yerel");
    assert!(a[0].get("version").is_none(), "hızlı eylem sürüm göndermemeli");
  }

  // Denetim günlüğü: yürütülen iki eylem (başarılı + başarısız), reddedilenler yürütülmediği için yok
  let d: Value = h.client.get(format!("{}/api/audit?limit=20", h.base)).send().await.unwrap().json().await.unwrap();
  let kayitlar: Vec<&Value> = d["items"].as_array().unwrap().iter().filter(|r| r["action"].as_str().unwrap_or("").starts_with("ACTION:")).collect();
  assert_eq!(kayitlar.len(), 2, "{kayitlar:?}");
  let detay = |r: &Value| serde_json::from_str::<Value>(r["detail_json"].as_str().unwrap_or("{}")).unwrap_or(Value::Null);
  assert!(kayitlar.iter().any(|r| r["action"] == "ACTION:alert.pause" && detay(r)["ok"] == true));
  assert!(kayitlar.iter().any(|r| r["action"] == "ACTION:alert.skip" && detay(r)["ok"] == false));
}

/// Denetim düzlemi eklemeleri: yeni kayıt defteri eylemlerinin onay/kullanılabilirlik kuralları ve sırları ayıklanmış
/// destek paketi (yayın anahtarı, token alanı, rtmp yolu, kullanıcı klasörü pakete girmez).
#[tokio::test(flavor = "multi_thread")]
async fn eylem_eklemeleri_ve_destek_paketi_sir_sizdirmaz() {
  let h = start().await;
  let gizli = format!("live_{}_A8TESTANAHTAR", free_port());
  let res = h
    .client
    .post(format!("{}/api/multistream/destinations", h.base))
    .json(&json!({"id": "itest-a8", "name": "Twitch", "platform": "twitch", "server": "rtmps://live.twitch.tv:443/app", "key": gizli}))
    .send()
    .await
    .unwrap();
  assert!(res.status().is_success());
  let res = h
    .client
    .post(format!("{}/api/settings/patch?screen=starting", h.base))
    .json(&json!({"deneme": {"apiToken": "tok-A8-sadece-test", "baslik": "Merhaba"}}))
    .send()
    .await
    .unwrap();
  assert!(res.status().is_success());

  let liste: Value = h.client.get(format!("{}/api/actions", h.base)).send().await.unwrap().json().await.unwrap();
  let eylemler = liste["actions"].as_array().unwrap();
  let bul = |id: &str| eylemler.iter().find(|a| a["id"] == id).unwrap_or_else(|| panic!("{id} yok")).clone();
  assert_eq!(bul("stream.start")["available"], false);
  assert_eq!(bul("stream.start")["reason"], "OBS bağlı değil");
  assert_eq!(bul("stream.start")["confirm"], true);
  assert_eq!(bul("record.togglePause")["requires"], "obs");
  assert_eq!(bul("destination.reconnect")["confirm"], true);
  assert_eq!(bul("source.toggle")["params"][1]["kind"], "source");

  let calistir = |govde: Value| {
    let c = h.client.clone();
    let url = format!("{}/api/actions/run", h.base);
    async move { c.post(url).json(&govde).send().await.unwrap() }
  };
  // Yayını başlatan eylem onaysız çalışmaz; onaylı olsa da OBS bağlı değilse açık çakışma. Eski `engine.*`
  // kimliği OBS eylemine gider.
  assert_eq!(calistir(json!({"id": "engine.goLive"})).await.status(), 428);
  let r = calistir(json!({"id": "engine.goLive", "confirm": true})).await;
  assert_eq!(r.status(), 409);
  assert!(r.text().await.unwrap().contains("OBS"));
  assert_eq!(calistir(json!({"id": "audio.volume", "params": {"input": "Müzik", "delta": 0}})).await.status(), 400);
  assert_eq!(calistir(json!({"id": "source.toggle", "params": {"scene": "Oyun"}})).await.status(), 400);
  assert_eq!(calistir(json!({"id": "destination.reconnect", "confirm": true, "params": {"id": "itest-a8"}})).await.status(), 409);

  // Destek paketi
  let r = h.client.post(format!("{}/api/destek/paket", h.base)).send().await.unwrap();
  assert!(r.status().is_success(), "{}", r.status());
  let v: Value = r.json().await.unwrap();
  let yol = std::path::PathBuf::from(v["yol"].as_str().unwrap());
  assert!(yol.starts_with(h.root.join("app-data")), "{yol:?}");
  let metin = std::fs::read_to_string(&yol).unwrap();
  let paket: Value = serde_json::from_str(&metin).unwrap();
  assert_eq!(paket["bicim"], "studio-destek-paketi");
  for bolum in ["uygulama", "obs", "cokluYayin", "onKontrol", "ayarlar", "denetim", "gunlukler", "gizleme"] {
    assert!(!paket[bolum].is_null(), "{bolum} bölümü yok");
  }
  assert!(!metin.contains(&gizli), "yayın anahtarı pakette");
  assert!(!metin.contains("tok-A8-sadece-test"), "token alanı pakette");
  assert!(!metin.contains("/app\""), "rtmp yolu pakette");
  assert_eq!(paket["ayarlar"]["starting"]["deneme"]["apiToken"], "[gizli]");
  assert_eq!(paket["ayarlar"]["starting"]["deneme"]["baslik"], "Merhaba");
  if let Ok(ev) = std::env::var("USERPROFILE") {
    // JSON metninde ters bölü kaçışlıdır (C:\\Users\\…)
    let kacisli = ev.replace('\\', "\\\\").to_lowercase();
    assert!(!metin.to_lowercase().contains(&kacisli), "kullanıcı klasörü pakette");
  }
  assert!(paket["gizleme"]["gizlenenDeger"].as_u64().unwrap() >= 2);
  let a = h.client.get(format!("{}/api/audit", h.base)).send().await.unwrap().text().await.unwrap();
  assert!(a.contains("SUPPORT_BUNDLE"));
  assert!(!a.contains(&gizli));

  let res = h
    .client
    .post(format!("{}/api/multistream/destinations/delete", h.base))
    .json(&json!({"id": "itest-a8"}))
    .send()
    .await
    .unwrap();
  assert!(res.status().is_success());
  assert!(axthrowa_studio_lib::secret_store::get_secret("multistream.key.itest-a8").is_none());
}

/// Çoklu yayın anahtarı: göster (yalnız yerel, önbelleksiz, denetimde değer yok), sil, bağlantı sınaması (yalnız
/// TCP; 127.0.0.1'de açık ve kapalı bağlantı noktası), durumda `secure://` başvurusu.
#[tokio::test(flavor = "multi_thread")]
async fn multistream_anahtar_goster_sil_ve_baglanti_sinamasi() {
  let h = start().await;
  let dinleyici = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
  let acik = dinleyici.local_addr().unwrap().port();
  let kapali = free_port();
  let id = format!("itest-sir-{acik}");
  let anahtar = format!("itest_sir_anahtar_{acik}");
  let post = |yol: &'static str, govde: Value| {
    let c = h.client.clone();
    let url = format!("{}{yol}", h.base);
    async move { c.post(url).json(&govde).send().await.unwrap() }
  };
  let r = post("/api/multistream/destinations", json!({"id": id, "name": "Sır sınaması", "platform": "custom", "server": format!("rtmp://127.0.0.1:{acik}/live"), "key": anahtar})).await;
  assert!(r.status().is_success());
  let durum = h.client.get(format!("{}/api/multistream", h.base)).send().await.unwrap().text().await.unwrap();
  assert!(durum.contains(&format!("secure://custom/{id}/stream-key")), "başvuru durumda");
  assert!(!durum.contains(&anahtar), "anahtar durumda yok");
  // Bağlantı sınaması: açık port
  let t: Value = post("/api/multistream/destinations/test", json!({"id": id})).await.json().await.unwrap();
  assert_eq!(t["ok"], true, "{t}");
  assert!(t["not"].as_str().unwrap().contains("yayın gönderilmedi"));
  // Göster: değer döner, önbelleğe alınmaz
  let r = post("/api/multistream/destinations/reveal", json!({"id": id})).await;
  assert_eq!(r.headers()["cache-control"], "no-store");
  assert_eq!(r.json::<Value>().await.unwrap()["key"], json!(anahtar));
  // Kapalı port: başarısız
  let r = post("/api/multistream/destinations", json!({"id": id, "name": "Sır sınaması", "platform": "custom", "server": format!("rtmp://127.0.0.1:{kapali}/live")})).await;
  assert!(r.status().is_success(), "anahtar verilmeden güncelleme mevcut anahtarı korur");
  let t: Value = post("/api/multistream/destinations/test", json!({"id": id})).await.json().await.unwrap();
  assert_eq!(t["ok"], false, "{t}");
  assert_eq!(post("/api/multistream/destinations/reveal", json!({"id": id})).await.json::<Value>().await.unwrap()["key"], json!(anahtar));
  // Anahtarı sil: hedef kalır, gösterilecek anahtar yok
  assert!(post("/api/multistream/destinations/key-delete", json!({"id": id})).await.status().is_success());
  assert_eq!(post("/api/multistream/destinations/reveal", json!({"id": id})).await.status(), 404);
  let d: Value = h.client.get(format!("{}/api/multistream", h.base)).send().await.unwrap().json().await.unwrap();
  let hedef = d["destinations"].as_array().unwrap().iter().find(|x| x["id"] == json!(id)).cloned().unwrap();
  assert_eq!(hedef["hasKey"], false);
  let a = h.client.get(format!("{}/api/audit?limit=100", h.base)).send().await.unwrap().text().await.unwrap();
  assert!(a.contains("MULTISTREAM_KEY_REVEAL") && a.contains("MULTISTREAM_KEY_DELETE") && a.contains("MULTISTREAM_DEST_TEST"));
  assert!(!a.contains(&anahtar), "denetimde anahtar değeri yok");
  let _ = post("/api/multistream/destinations/delete", json!({"id": id})).await;
  drop(dinleyici);
}


/// Güncelleme denetimi: adres tanımlı değilse ağ isteği yok; yerel sahte bildirimle sürüm karşılaştırılır; dış http reddedilir
#[tokio::test(flavor = "multi_thread")]
async fn guncelleme_denetimi_yerel_bildirim() {
  let h = start().await;
  let tamam = |yol: &'static str, govde: Value| {
    let c = h.client.clone();
    let url = format!("{}{yol}", h.base);
    async move {
      let r = c.post(url).json(&govde).send().await.unwrap();
      let st = r.status();
      let t = r.text().await.unwrap();
      assert!(st.is_success(), "{yol} {govde}: {st} {t}");
      serde_json::from_str::<Value>(&t).unwrap_or(Value::Null)
    }
  };
  assert_eq!(tamam("/api/guncelleme/denetle", json!({})).await["tanimli"], false);
  // Yerel sahte bildirim sunucusu (tek bağlantı başına sabit yanıt)
  let dinleyici = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
  let port = dinleyici.local_addr().unwrap().port();
  tokio::spawn(async move {
    loop {
      let Ok((mut s, _)) = dinleyici.accept().await else { break };
      tokio::spawn(async move {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        let mut b = [0u8; 2048];
        let _ = s.read(&mut b).await;
        let govde = r#"{"surum":"99.0.0","sayfa":"https://ornek.com/indir","notlar":"Sınama"}"#;
        let yanit = format!("HTTP/1.1 200 OK\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{govde}", govde.len());
        let _ = s.write_all(yanit.as_bytes()).await;
      });
    }
  });
  let r = h.client.post(format!("{}/api/guncelleme", h.base)).json(&json!({"adres": "http://ornek.com/x.json"})).send().await.unwrap();
  assert_eq!(r.status(), 400, "dış adreste düz http");
  tamam("/api/guncelleme", json!({"adres": format!("http://127.0.0.1:{port}/guncelleme.json")})).await;
  let d = tamam("/api/guncelleme/denetle", json!({})).await;
  assert_eq!((d["tanimli"].as_bool(), d["son"].as_str(), d["yeniVar"].as_bool(), d["sayfa"].as_str()), (Some(true), Some("99.0.0"), Some(true), Some("https://ornek.com/indir")), "{d}");
}

/// Yayın bilgisi: Kick bağlı değilken hiçbir ağ isteği yapılmaz; gövde doğrulanır, onaysız güncelleme 428 ile reddedilir
#[tokio::test(flavor = "multi_thread")]
async fn yayin_bilgisi_kick_bagli_degilken() {
  let h = start().await;
  let post = |yol: &'static str, govde: Value| {
    let c = h.client.clone();
    let url = format!("{}{yol}", h.base);
    async move { c.post(url).json(&govde).send().await.unwrap().status().as_u16() }
  };
  let d: Value = h.client.get(format!("{}/api/yayin-bilgisi", h.base)).send().await.unwrap().json().await.unwrap();
  assert_eq!((d["kick"]["bagli"].as_bool(), d["kick"]["yazabilir"].as_bool()), (Some(false), Some(false)), "{d}");
  assert_eq!(post("/api/yayin-bilgisi/oku", json!({})).await, 409);
  assert_eq!(post("/api/yayin-bilgisi", json!({"confirm": true})).await, 400, "alan yok");
  assert_eq!(post("/api/yayin-bilgisi", json!({"baslik": "  ", "confirm": true})).await, 400);
  assert_eq!(post("/api/yayin-bilgisi", json!({"baslik": "Sınama başlığı"})).await, 428, "onaysız");
  assert_eq!(post("/api/yayin-bilgisi", json!({"baslik": "Sınama başlığı", "confirm": true})).await, 409, "yazma izni yok");
  let k = |q: &str| h.client.get(format!("{}/api/yayin-bilgisi/kategoriler?q={q}", h.base)).send();
  assert_eq!(k("a").await.unwrap().status(), 400);
  assert_eq!(k("Just%20Chatting").await.unwrap().status(), 409);
}
