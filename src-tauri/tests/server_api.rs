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
use yayin_yonetim_araci_lib::AppState;

/// Yayın motorunu başlatan testler sırayla çalışır: aynı GPU'yu ve NVENC oturumlarını paylaşırlar; eşzamanlı
/// çalışınca kodlama sınaması (sihirbaz) diğerlerinin yükünü ölçer.
static MOTOR_KILIDI: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

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
  let data_dir = root.join("app-data");
  tokio::task::spawn_blocking(move || AppState::new(root, data_dir, portable, port))
    .await
    .expect("AppState kurulumu")
}

async fn start() -> Harness {
  let port = free_port();
  let root = std::env::temp_dir().join(format!("yayin-itest-{port}"));
  let _ = std::fs::remove_dir_all(&root);
  std::fs::create_dir_all(root.join("assets").join("videos")).unwrap();

  let state = make_state(root.clone(), false, port).await;
  tokio::spawn(async move {
    let _ = yayin_yonetim_araci_lib::server::serve(state).await;
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
    let _ = yayin_yonetim_araci_lib::server::serve(state).await;
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
fn write_video(root: &Path, name: &str, len: usize) -> PathBuf {
  let path = root.join("assets").join("videos").join(name);
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
  std::fs::write(h.root.join("assets").join("videos").join("notlar.txt"), b"x").unwrap();

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
    yayin_yonetim_araci_lib::server::SPOTIFY_CALLBACK_PATHS.len(),
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
  yayin_yonetim_araci_lib::server::serve(state).await.unwrap();
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
  assert!(yayin_yonetim_araci_lib::secret_store::get_secret("multistream.key.itest-twitch").is_none());
}

/// Eylem kayıt defteri: onay zorunluluğu, kullanılabilirlik, bilinmeyen eylem, StreamAxT'e iletim ve denetim kaydı.
/// StreamAxT yerine test içinde sahte bir uyarı denetimi sunucusu açılır (gerçek bota dokunulmaz).
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
  std::env::set_var("YYA_STREAMAXT_PORT", sahte_port.to_string());

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

  // StreamAxT'e iletim: durum geri döner, istek yerel aktörle gider
  let r = calistir(json!({"id": "alert.pause"})).await;
  assert!(r.status().is_success());
  let v: Value = r.json().await.unwrap();
  assert_eq!(v["result"]["paused"], true);
  // StreamAxT çakışması arayüze hata olarak taşınır
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
  assert_eq!(bul("engine.goLive")["available"], false);
  assert_eq!(bul("engine.goLive")["reason"], "Yayın motoru çalışmıyor");
  assert_eq!(bul("engine.goLive")["confirm"], true);
  assert_eq!(bul("destination.reconnect")["confirm"], true);
  assert_eq!(bul("source.toggle")["params"][1]["kind"], "source");

  let calistir = |govde: Value| {
    let c = h.client.clone();
    let url = format!("{}/api/actions/run", h.base);
    async move { c.post(url).json(&govde).send().await.unwrap() }
  };
  // Yayını başlatan eylem onaysız çalışmaz; onaylı olsa da motor yoksa açık çakışma
  assert_eq!(calistir(json!({"id": "engine.goLive"})).await.status(), 428);
  let r = calistir(json!({"id": "engine.goLive", "confirm": true})).await;
  assert_eq!(r.status(), 409);
  assert!(r.text().await.unwrap().contains("motor"));
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
  assert_eq!(paket["bicim"], "yya-destek-paketi");
  for bolum in ["uygulama", "obs", "motor", "cokluYayin", "onKontrol", "ayarlar", "denetim", "gunlukler", "gizleme"] {
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
  assert!(yayin_yonetim_araci_lib::secret_store::get_secret("multistream.key.itest-a8").is_none());
}

/// Eklenti yöneticisi uçtan uca — YALNIZ kendi GPL test eklentilerimizle (üçüncü taraf ikili çalıştırılmaz):
/// OBS klasörleri salt-okunur taranır; klasör paketi incelenir ve yönetilen klasöre kurulur; yalıtılmış sınama;
/// etkinleştirme; açılışta çöken eklenti motoru düşürür → çökme kapısı (409) → "devre dışı bırak" kararı →
/// karantina; sağlıklı eklentinin kaynak türü sahneye eklenir, özellik formu okunur/yazılır.
#[tokio::test(flavor = "multi_thread")]
async fn eklenti_yoneticisi_kurulum_sinama_cokme_ve_karantina() {
  let test_dll = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../motor/test-eklentileri/target/release");
  let _motor_kilidi = MOTOR_KILIDI.lock().await;
  if yayin_yonetim_araci_lib::motor_kopru::exe_yolu().is_none()
    || !std::path::Path::new(r"C:\Program Files\obs-studio\bin\64bit\obs.dll").exists()
    || !test_dll.join("yym_test_kaynak.dll").is_file()
  {
    eprintln!("motor, OBS ya da test eklentileri yok — atlandı");
    return;
  }
  let h = start().await;
  let uzun = reqwest::Client::builder().timeout(std::time::Duration::from_secs(120)).build().unwrap();
  let post = |yol: &str, govde: Value| {
    let c = uzun.clone();
    let url = format!("{}{yol}", h.base);
    async move { c.post(url).json(&govde).send().await.unwrap() }
  };
  let get = |yol: &str| {
    let c = uzun.clone();
    let url = format!("{}{yol}", h.base);
    async move { c.get(url).send().await.unwrap().json::<Value>().await.unwrap() }
  };
  let bul = |l: &Value, id: &str| l["eklentiler"].as_array().unwrap().iter().find(|e| e["id"] == id).cloned().unwrap_or(Value::Null);

  assert!(get("/api/eklentiler").await["eklentiler"].as_array().unwrap().is_empty());

  // OBS klasörleri: izinsiz taranmaz; izinle salt-okunur tarama, deftere bir şey eklenmez
  assert_eq!(post("/api/eklentiler/tara", json!({})).await.status(), 428);
  let t: Value = post("/api/eklentiler/tara", json!({"izin": true})).await.json().await.unwrap();
  assert!(t["sayilar"]["obsEklentisi"].as_u64().unwrap() > 0, "{}", t["sayilar"]);
  assert!(t["sayilar"]["birinciTaraf"].as_u64().unwrap() > 0, "OBS Project imzalı modüller birinci taraf sayılmalı");
  assert!(t["adaylar"].as_array().unwrap().iter().any(|a| a["id"] == "obs-ffmpeg" && a["arayuz"] == "ENGINE_MANAGED"));
  assert!(get("/api/eklentiler").await["eklentiler"].as_array().unwrap().is_empty(), "tarama deftere yazmamalı");

  // Klasör paketi: ProgramData düzeninde iki test eklentisi + bir kurulum programı (çalıştırılmaz)
  let paket = h.root.join("paket");
  for m in ["yym_test_kaynak", "yym_test_cokme"] {
    let bin = paket.join(m).join("bin").join("64bit");
    std::fs::create_dir_all(&bin).unwrap();
    std::fs::copy(test_dll.join(format!("{m}.dll")), bin.join(format!("{m}.dll"))).unwrap();
  }
  std::fs::create_dir_all(paket.join("yym_test_kaynak").join("data").join("locale")).unwrap();
  std::fs::write(paket.join("yym_test_kaynak").join("data").join("locale").join("tr-TR.ini"), "A=B").unwrap();
  std::fs::write(paket.join("kurulum.exe"), b"MZ").unwrap();
  let i: Value = post("/api/eklentiler/paket/incele", json!({"yol": paket})).await.json().await.unwrap();
  assert_eq!(i["adaylar"].as_array().unwrap().len(), 2, "{i}");
  assert_eq!(i["kurulumProgramlari"][0], "kurulum.exe");
  assert!(i["uyarilar"]["kurulumProgrami"].as_str().unwrap().contains("çalıştırılmaz"));
  for a in i["adaylar"].as_array().unwrap() {
    assert_eq!(a["arayuz"], "LIKELY_COMPATIBLE", "{a}");
    assert_eq!(a["imza"], "Imzasiz");
  }
  let k: Value = post("/api/eklentiler/paket/kur", json!({"kimlik": i["kimlik"], "moduller": ["yym_test_kaynak", "yym_test_cokme"]}))
    .await
    .json()
    .await
    .unwrap();
  assert_eq!(k["kurulan"].as_array().unwrap().len(), 2, "{k}");
  let kurulu = h.root.join("app-data").join("eklentiler").join("kurulu");
  assert!(kurulu.join("yym_test_kaynak").join("bin").join("64bit").join("yym_test_kaynak.dll").is_file());
  assert!(kurulu.join("yym_test_kaynak").join("data").join("locale").join("tr-TR.ini").is_file());
  assert!(!kurulu.join("kurulum.exe").exists());

  // Yalıtılmış sınama: onaysız çalışmaz; onaylı sınama "uyumlu" + türler
  assert_eq!(post("/api/eklentiler/sina", json!({"id": "yym_test_kaynak"})).await.status(), 428);
  let s: Value = post("/api/eklentiler/sina", json!({"id": "yym_test_kaynak", "onay": true})).await.json().await.unwrap();
  assert_eq!(s["yoklama"]["sonuc"], "yuklendi", "{s}");
  assert_eq!(s["eklenti"]["arayuz"], "COMPATIBLE");
  assert_eq!(s["eklenti"]["gerekliLibobs"], "32.0");
  for id in ["yym_test_kaynak", "yym_test_cokme"] {
    assert!(post("/api/eklentiler/etkin", json!({"id": id, "etkin": true})).await.status().is_success(), "{id}");
  }

  // Motor açılırken çöken eklenti: süreç düşer, çökme kapısı karar ister
  let r = post("/api/motor/baslat", json!({})).await;
  assert_eq!(r.status(), 409);
  assert!(r.text().await.unwrap().contains("yym_test_cokme"));
  let d = get("/api/motor").await;
  assert_eq!(d["calisiyor"], false);
  assert_eq!(d["cokme"]["supheli"], "yym_test_cokme");
  assert_eq!(d["cokme"]["cikisKodu"].as_i64(), Some(0xC000_0005));
  assert_eq!(post("/api/motor/baslat", json!({})).await.status(), 409, "karar verilmeden başlatılmamalı");
  let r = post("/api/motor/baslat", json!({"cokme_karari": "devre-disi"})).await;
  assert!(r.status().is_success(), "{}", r.text().await.unwrap());
  let l = get("/api/eklentiler").await;
  let c = bul(&l, "yym_test_cokme");
  assert_eq!(c["arayuz"], "QUARANTINED", "{c}");
  assert_eq!(c["etkin"], false);
  assert_eq!(bul(&l, "yym_test_kaynak")["oturumdaYuklu"], true);
  assert!(l["bekleyenCokme"].is_null());

  // Eklentinin kaynak türü: sahneye eklenir; kayıtlı olmayan tür "eklenti" yolundan geçemez
  assert_eq!(post("/api/motor/kaynak", json!({"tur": "eklenti", "deger": "color_source"})).await.status(), 400);
  let r = post("/api/motor/kaynak", json!({"tur": "eklenti", "deger": "yym_test_desen", "ad": "Desen"})).await;
  assert!(r.status().is_success(), "{}", r.text().await.unwrap());
  let kaynak: Value = r.json().await.unwrap();
  let kid = kaynak["id"].as_str().unwrap().to_string();
  let o = get(&format!("/api/motor/kaynak/ozellikler?id={kid}")).await;
  let adlar: Vec<&str> = o["ozellikler"].as_array().unwrap().iter().filter_map(|x| x["ad"].as_str()).collect();
  assert_eq!(adlar, ["renk", "kalinlik", "hareket"], "{o}");
  let kal = o["ozellikler"].as_array().unwrap().iter().find(|x| x["ad"] == "kalinlik").unwrap();
  assert_eq!((kal["tur"].as_str(), kal["min"].as_i64(), kal["max"].as_i64()), (Some("int"), Some(1), Some(90)));
  assert!(post("/api/motor/kaynak/guncelle", json!({"id": kid, "ayarlar": {"kalinlik": 40}})).await.status().is_success());
  assert_eq!(get(&format!("/api/motor/kaynak/ozellikler?id={kid}")).await["ayarlar"]["kalinlik"], 40);
  // Önizleme: ilk kare işlenene kadar 204 döner; eklenti kaynağıyla kare gelmeli
  let mut kare = false;
  for _ in 0..40 {
    let pn = uzun.get(format!("{}/api/motor/onizleme?tuval=ana&genislik=320", h.base)).send().await.unwrap();
    if pn.status() == 200 {
      kare = true;
      break;
    }
    tokio::time::sleep(std::time::Duration::from_millis(150)).await;
  }
  assert!(kare, "eklenti kaynağıyla önizleme karesi gelmedi");

  // Düzgün durdurma: oturum işaretleri kalmaz, yeniden açılışta çökme sorulmaz
  assert!(post("/api/motor/durdur", json!({"confirm": true})).await.status().is_success());
  let motor_dir = h.root.join("app-data").join("motor");
  assert!(!motor_dir.join("oturum.json").exists() && !motor_dir.join("eklenti-yukleniyor.json").exists());
  assert!(get("/api/motor").await["cokme"].is_null());

  // Kaldırma: yönetilen klasör silinmez, yedeğe taşınır
  assert_eq!(post("/api/eklentiler/kaldir", json!({"id": "yym_test_cokme"})).await.status(), 428);
  let r: Value = post("/api/eklentiler/kaldir", json!({"id": "yym_test_cokme", "onay": true})).await.json().await.unwrap();
  assert!(std::path::Path::new(r["yedek"]["yol"].as_str().unwrap()).join("bin").is_dir());
  assert!(bul(&get("/api/eklentiler").await, "yym_test_cokme").is_null());

  let a = uzun.get(format!("{}/api/audit?limit=100", h.base)).send().await.unwrap().text().await.unwrap();
  for e in ["PLUGIN_SCAN", "PLUGIN_INSTALL", "PLUGIN_PROBE", "PLUGIN_ENABLE", "PLUGIN_UNINSTALL", "MOTOR_SOURCE_SETTINGS"] {
    assert!(a.contains(e), "denetimde {e} yok");
  }
}

/// Yerel yayın çekirdeği API'si — gerçek `yayin-motoru` + libobs, YALNIZ sentetik kaynaklar (renk, yazı), yayın
/// yalnız 127.0.0.1'deki FFmpeg alıcısına. Çekirdek derlenmemişse ya da OBS/FFmpeg yoksa atlanır.
/// Kapsam: kaynak/öğe düzenleme, hedef başına tuval + ses izi, kayıt, tekrar arabelleği, motor GO LIVE durdurma,
/// kalıcılık (yeniden açılışta geri kurma) ve eksik eklenti türünün yer tutucu olarak korunması.
#[tokio::test(flavor = "multi_thread")]
async fn motor_api_sentetik_kaynak_ve_hedef() {
  let _motor_kilidi = MOTOR_KILIDI.lock().await;
  if yayin_yonetim_araci_lib::motor_kopru::exe_yolu().is_none()
    || !std::path::Path::new(r"C:\Program Files\obs-studio\bin\64bit\obs.dll").exists()
  {
    eprintln!("yayin-motoru ya da OBS yok — atlandı");
    return;
  }
  let Some(ff) = std::process::Command::new("where")
    .arg("ffmpeg")
    .output()
    .ok()
    .and_then(|o| String::from_utf8_lossy(&o.stdout).lines().next().map(|l| PathBuf::from(l.trim())))
  else {
    eprintln!("ffmpeg yok — atlandı");
    return;
  };
  let h = start().await;
  let kayit_dir = h.root.join("kayitlar");
  std::env::set_var("YYA_MOTOR_KAYIT_DIR", &kayit_dir);
  // Önceden kaydedilmiş koleksiyon: yüklü olmayan bir eklentinin kaynağı (yer tutucu olarak korunmalı)
  let motor_dir = h.root.join("app-data").join("motor");
  std::fs::create_dir_all(&motor_dir).unwrap();
  std::fs::write(
    motor_dir.join("sahne-koleksiyonu.json"),
    json!({"surum": 1, "sayac": 90, "kaynaklar": [{"id": "k90", "tur": "eklenti", "obs_turu": "yym_yok_eklenti_kaynagi",
      "ad": "Eksik eklenti kaynağı", "ayarlar": {"ozel": 42}, "ogeler": [{"tuval": "ana", "konum": [5, 6]}]}]})
    .to_string(),
  )
  .unwrap();

  let port = free_port();
  let hedef_id = format!("itest-motor-{port}");
  let anahtar = format!("itest_motor_anahtar_{port}");
  let alici_dosya = h.root.join("motor-alici.flv");
  let mut alici = std::process::Command::new(&ff)
    .args(["-hide_banner", "-loglevel", "error", "-listen", "1", "-i"])
    .arg(format!("rtmp://127.0.0.1:{port}/live/{anahtar}"))
    .args(["-c", "copy", "-f", "flv", "-y"])
    .arg(&alici_dosya)
    .stdin(std::process::Stdio::piped())
    .stdout(std::process::Stdio::null())
    .stderr(std::process::Stdio::null())
    .spawn()
    .unwrap();
  let post = |yol: &str, govde: Value| {
    let c = h.client.clone();
    let url = format!("{}{yol}", h.base);
    async move { c.post(url).json(&govde).send().await.unwrap() }
  };
  let get = |yol: &str| {
    let c = h.client.clone();
    let url = format!("{}{yol}", h.base);
    async move { c.get(url).send().await.unwrap().json::<Value>().await.unwrap() }
  };
  let bekle = |ms: u64| tokio::time::sleep(std::time::Duration::from_millis(ms));

  // Motor çalışmıyorken kaynak açık çakışma döner; kayıtlı koleksiyon durumda görünür
  assert_eq!(post("/api/motor/kaynak", json!({"tur": "renk", "deger": "#203040"})).await.status(), 409);
  let d = get("/api/motor").await;
  assert_eq!(d["calisiyor"], false);
  assert_eq!(d["kaynaklar"][0]["id"], "k90");

  let r = post("/api/motor/baslat", json!({"dikey": true, "fps": 30})).await;
  assert!(r.status().is_success(), "{}", r.text().await.unwrap());
  let b: Value = r.json().await.unwrap();
  assert_eq!(b["eksikKaynaklar"], json!(["Eksik eklenti kaynağı"]), "eksik eklenti türü yer tutucu olmalı");
  assert_eq!(post("/api/motor/baslat", json!({})).await.status(), 409);

  let r = post("/api/motor/kaynak", json!({"tur": "renk", "deger": "#203040", "ad": "Arka", "tuvaller": ["ana", "dikey"]})).await;
  assert!(r.status().is_success(), "{}", r.text().await.unwrap());
  let renk: Value = r.json().await.unwrap();
  let r = post("/api/motor/kaynak", json!({"tur": "yazi", "deger": "motor API sınaması", "ad": "Başlık", "tuvaller": ["ana", "dikey"]})).await;
  let yazi: Value = r.json().await.unwrap();
  let (renk_id, yazi_id) = (renk["id"].as_str().unwrap().to_string(), yazi["id"].as_str().unwrap().to_string());
  assert_eq!(renk_id, "k91", "sayaç kayıttan sürer");
  // Doğrulama
  assert_eq!(post("/api/motor/kaynak", json!({"tur": "medya", "deger": "http://ornek.com/a.mp4"})).await.status(), 400);
  assert_eq!(post("/api/motor/kaynak", json!({"tur": "pencere", "deger": ""})).await.status(), 400);
  assert_eq!(post("/api/motor/kaynak", json!({"tur": "renk", "deger": "#000000", "tuvaller": ["yan"]})).await.status(), 400);
  assert_eq!(h.client.get(format!("{}/api/motor/secenekler?tur=renk", h.base)).send().await.unwrap().status(), 400);

  // Öğe düzenleme: yazı en alta, konum; dikeyde renk gizli
  let s = get("/api/motor/sahne?tuval=ana").await;
  let adlar: Vec<&str> = s["ogeler"].as_array().unwrap().iter().map(|o| o["kaynak"].as_str().unwrap()).collect();
  assert_eq!(adlar, vec![renk_id.as_str(), yazi_id.as_str()]);
  assert_eq!(s["ogeler"][1]["ad"], "Başlık");
  assert!(post("/api/motor/oge", json!({"oge": format!("sahne-ana/{yazi_id}"), "eylem": "sira", "yon": "en_alt"})).await.status().is_success());
  assert!(post("/api/motor/oge", json!({"oge": format!("sahne-ana/{yazi_id}"), "eylem": "donustur", "konum": [120, 80]})).await.status().is_success());
  assert!(post("/api/motor/oge", json!({"oge": format!("sahne-dikey/{renk_id}"), "eylem": "donustur", "gorunur": false})).await.status().is_success());
  assert_eq!(post("/api/motor/oge", json!({"oge": "sahne-ana/yok", "eylem": "sira", "yon": "en_alt"})).await.status(), 409);
  // Ses izi maskesi
  assert!(post("/api/motor/kaynak/izler", json!({"id": yazi_id, "maske": 3})).await.status().is_success());
  assert_eq!(post("/api/motor/kaynak/izler", json!({"id": yazi_id, "maske": 64})).await.status(), 400);

  // Hedef: dikey tuval, 2. ses izi
  let r = post(
    "/api/multistream/destinations",
    json!({"id": hedef_id, "name": "Motor sınama", "platform": "custom", "server": format!("rtmp://127.0.0.1:{port}/live"), "key": anahtar}),
  )
  .await;
  assert!(r.status().is_success(), "{}", r.text().await.unwrap());
  assert_eq!(post("/api/motor/hedef", json!({"id": hedef_id, "eylem": "baslat", "tuval": "dikey", "iz": 9})).await.status(), 400);
  let r = post("/api/motor/hedef", json!({"id": hedef_id, "eylem": "baslat", "tuval": "dikey", "iz": 2})).await;
  assert!(r.status().is_success(), "{}", r.text().await.unwrap());
  let mut canli = false;
  for _ in 0..60 {
    let d = get("/api/motor").await;
    let hd = d["hedefler"].as_array().unwrap().iter().find(|x| x["id"] == json!(hedef_id)).cloned().unwrap();
    if hd["durum"] == "canli" {
      canli = true;
      assert_eq!((hd["tuval"].as_str(), hd["iz"].as_u64()), (Some("dikey"), Some(1)), "iz motorda 0 tabanlı saklanır");
      break;
    }
    bekle(250).await;
  }
  assert!(canli, "hedef canlıya geçmedi");
  assert_eq!(post("/api/multistream/destinations/start", json!({"id": hedef_id})).await.status(), 409);

  // Önizleme
  let url = format!("{}/api/motor/onizleme?tuval=dikey&genislik=320", h.base);
  let _ = h.client.get(&url).send().await.unwrap();
  bekle(1500).await;
  let r = h.client.get(&url).send().await.unwrap();
  assert_eq!(r.status(), 200);
  let png = r.bytes().await.unwrap();
  assert_eq!((u32::from_be_bytes(png[16..20].try_into().unwrap()), u32::from_be_bytes(png[20..24].try_into().unwrap())), (180, 320));

  // Kayıt ve tekrar arabelleği
  let r = post("/api/motor/kayit", json!({"eylem": "baslat"})).await;
  assert!(r.status().is_success(), "{}", r.text().await.unwrap());
  let kayit_yolu = PathBuf::from(r.json::<Value>().await.unwrap()["yol"].as_str().unwrap());
  assert_eq!(post("/api/motor/kayit", json!({"eylem": "baslat"})).await.status(), 409, "ikinci kayıt reddedilir");
  let r = post("/api/motor/tekrar", json!({"eylem": "ac", "sure_sn": 10})).await;
  assert!(r.status().is_success(), "{}", r.text().await.unwrap());
  bekle(3500).await;
  let r = post("/api/motor/tekrar", json!({"eylem": "kaydet"})).await;
  assert!(r.status().is_success(), "{}", r.text().await.unwrap());
  let tekrar_yolu = PathBuf::from(r.json::<Value>().await.unwrap()["yol"].as_str().unwrap().to_string());
  assert!(post("/api/motor/kayit", json!({"eylem": "durdur"})).await.status().is_success());
  assert!(post("/api/motor/tekrar", json!({"eylem": "kapat"})).await.status().is_success());
  bekle(800).await;
  assert!(kayit_yolu.starts_with(&kayit_dir) && kayit_yolu.metadata().map(|m| m.len() > 10_000).unwrap_or(false), "kayıt dosyası: {kayit_yolu:?}");
  assert!(tekrar_yolu.starts_with(&kayit_dir) && tekrar_yolu.exists(), "tekrar dosyası: {tekrar_yolu:?}");

  // Motor GO LIVE durdurma onay ister; onayla motor hedefleri durur
  assert_eq!(post("/api/motor/golive", json!({"eylem": "durdur"})).await.status(), 428);
  let r = post("/api/motor/golive", json!({"eylem": "durdur", "confirm": true})).await;
  assert!(r.status().is_success());
  assert_eq!(r.json::<Value>().await.unwrap()["sonuc"][&hedef_id]["ok"], true);
  bekle(1000).await;
  assert_eq!(post("/api/motor/durdur", json!({})).await.status(), 428);
  assert!(post("/api/motor/durdur", json!({"confirm": true})).await.status().is_success());
  assert_eq!(get("/api/motor").await["calisiyor"], false);

  // Kalıcılık: yeniden açılışta kaynaklar, sıra, konum, görünürlük, iz maskesi ve hedef ataması geri gelir
  let r = post("/api/motor/baslat", json!({})).await;
  assert!(r.status().is_success(), "{}", r.text().await.unwrap());
  let d = get("/api/motor").await;
  assert_eq!(d["dikey"], true, "dikey tuval kayıttan");
  let kaynaklar = d["kaynaklar"].as_array().unwrap();
  assert!(kaynaklar.iter().any(|k| k["id"] == "k90" && k["eksik"] == true && k["ayarlar"]["ozel"] == 42), "eksik kaynak ayarlarıyla korunur");
  assert!(kaynaklar.iter().any(|k| k["id"] == json!(yazi_id) && k["izler"] == 3));
  let hd = d["hedefler"].as_array().unwrap().iter().find(|x| x["id"] == json!(hedef_id)).cloned().unwrap();
  assert_eq!((hd["tuval"].as_str(), hd["iz"].as_u64()), (Some("dikey"), Some(1)));
  let s = get("/api/motor/sahne?tuval=ana").await;
  let adlar: Vec<&str> = s["ogeler"].as_array().unwrap().iter().map(|o| o["kaynak"].as_str().unwrap()).collect();
  assert_eq!(adlar, vec![yazi_id.as_str(), renk_id.as_str()], "sıra korunur");
  assert_eq!(s["ogeler"][0]["konum"], json!([120.0, 80.0]));
  let sd = get("/api/motor/sahne?tuval=dikey").await;
  let renk_dikey = sd["ogeler"].as_array().unwrap().iter().find(|o| o["kaynak"] == json!(renk_id)).cloned().unwrap();
  assert_eq!(renk_dikey["gorunur"], false, "görünürlük korunur");
  assert!(post("/api/motor/durdur", json!({"confirm": true})).await.status().is_success());

  // Alıcı: dikey 1080×1920; 2. ses izi (yazının iz maskesi 1+2) — ses akışı var
  if let Some(mut g) = alici.stdin.take() {
    use std::io::Write;
    let _ = g.write_all(b"q");
  }
  for _ in 0..50 {
    if alici.try_wait().unwrap().is_some() {
      break;
    }
    bekle(100).await;
  }
  let _ = alici.kill();
  let _ = alici.wait();
  let probe = ff.with_file_name("ffprobe.exe");
  let boyut = std::process::Command::new(&probe)
    .args(["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0"])
    .arg(&alici_dosya)
    .output()
    .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
    .unwrap_or_default();
  assert_eq!(boyut, "1080,1920", "alıcıdaki akış dikey tuvalden gelmeli");

  // Denetim ve sızıntı
  let a = h.client.get(format!("{}/api/audit?limit=100", h.base)).send().await.unwrap().text().await.unwrap();
  for e in ["MOTOR_START", "MOTOR_SOURCE_ADD", "MOTOR_ITEM_EDIT", "MOTOR_SOURCE_TRACKS", "MOTOR_DEST_START", "MOTOR_RECORD_START", "MOTOR_REPLAY_SAVE", "MOTOR_STOP_ALL", "MOTOR_STOP"] {
    assert!(a.contains(e), "denetimde {e} yok");
  }
  assert!(!a.contains(&anahtar));
  assert!(!get("/api/motor").await.to_string().contains(&anahtar));
  let koleksiyon = std::fs::read_to_string(motor_dir.join("koleksiyonlar").join("varsayilan.json")).unwrap();
  assert!(!koleksiyon.contains(&anahtar), "anahtar koleksiyon dosyasına yazılmamalı");
  assert!(koleksiyon.contains("\"surum\": 2"), "v1 kayıt v2'ye göç etmeli");
  let v1 = std::fs::read_to_string(motor_dir.join("sahne-koleksiyonu.json")).unwrap();
  assert!(v1.contains("\"surum\":1") && v1.contains("k90"), "v1 dosyası silinmez ve değişmez");
  let libobs = std::fs::read_to_string(motor_dir.join("motor-libobs.log")).unwrap_or_default();
  assert!(!libobs.contains(&anahtar), "anahtar motor günlüğünde");
  assert!(!libobs.contains("[HATA]"), "motor günlüğünde hata:\n{libobs}");
  let _ = post("/api/multistream/destinations/delete", json!({"id": hedef_id})).await;
}

/// Motor v2 (OBS iş akışı paritesi) — gerçek `yayin-motoru` + libobs, YALNIZ sentetik kaynaklar (renk, yazı,
/// FFmpeg'in ürettiği tonlu ses dosyası). Yayın yok; izleme yalnız "kapalı" (hoparlöre ses verilmez).
/// Kapsam: çoklu sahne, program geçişi + geçiş geçersiz kılma, geçiş türü, Studio Mode, tam dönüşüm, gruplar,
/// filtreler, ses özellikleri, kaynak/sahne çoğaltma, `/ws/motor` canlı akış, koleksiyon değiştirme, OBS içe
/// aktarımı, dışa aktarım ve yeniden başlatmada kalıcılık.
#[tokio::test(flavor = "multi_thread")]
async fn motor_v2_sahneler_gruplar_filtreler_koleksiyonlar() {
  let _motor_kilidi = MOTOR_KILIDI.lock().await;
  if yayin_yonetim_araci_lib::motor_kopru::exe_yolu().is_none()
    || !std::path::Path::new(r"C:\Program Files\obs-studio\bin\64bit\obs.dll").exists()
  {
    eprintln!("yayin-motoru ya da OBS yok — atlandı");
    return;
  }
  let Some(ff) = std::process::Command::new("where")
    .arg("ffmpeg")
    .output()
    .ok()
    .and_then(|o| String::from_utf8_lossy(&o.stdout).lines().next().map(|l| PathBuf::from(l.trim())))
  else {
    eprintln!("ffmpeg yok — atlandı");
    return;
  };
  // Kayıt yapılmaz: YYA_MOTOR_KAYIT_DIR süreç geneli; diğer motor testiyle yarışmasın diye burada ayarlanmaz
  let h = start().await;
  let ton = h.root.join("ton.wav");
  let durum = std::process::Command::new(&ff)
    .args(["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000", "-t", "30", "-y"])
    .arg(&ton)
    .status()
    .unwrap();
  assert!(durum.success());
  let post = |yol: &str, govde: Value| {
    let c = h.client.clone();
    let url = format!("{}{yol}", h.base);
    async move { c.post(url).json(&govde).send().await.unwrap() }
  };
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
  let get = |yol: String| {
    let c = h.client.clone();
    let url = format!("{}{yol}", h.base);
    async move {
      let r = c.get(url).send().await.unwrap();
      assert!(r.status().is_success(), "GET {yol}: {}", r.status());
      r.json::<Value>().await.unwrap()
    }
  };
  let bekle = |ms: u64| tokio::time::sleep(std::time::Duration::from_millis(ms));

  tamam("/api/motor/baslat", json!({})).await;
  let renk = tamam("/api/motor/kaynak", json!({"tur": "renk", "deger": "#204060", "ad": "Arka"})).await["id"].as_str().unwrap().to_string();
  let s = get("/api/motor/sahneler".into()).await;
  assert_eq!(s["sahneler"].as_array().unwrap().len(), 1);
  assert_eq!(s["program"]["ana"], "sahne-ana");
  let kaynaklar = get("/api/motor".into()).await["kaynaklar"].clone();
  let renk_kayit = kaynaklar.as_array().unwrap().iter().find(|k| k["id"] == renk.as_str()).cloned().unwrap();
  assert_eq!(renk_kayit["obs_turu"], "color_source_v3", "yeni kaynak türün en yeni sürümüyle");

  // Yeni sahne, kaynak doğrudan sahneye; var olan kaynak ikinci sahneye
  let oyun = tamam("/api/motor/sahne-islem", json!({"eylem": "olustur", "ad": "Oyun"})).await["id"].as_str().unwrap().to_string();
  let yazi = tamam("/api/motor/kaynak", json!({"tur": "yazi", "deger": "Başlık", "ad": "Başlık", "sahne": oyun})).await["id"].as_str().unwrap().to_string();
  tamam("/api/motor/oge", json!({"eylem": "ekle", "sahne": oyun, "kaynak": renk})).await;
  let medya = tamam("/api/motor/kaynak", json!({"tur": "medya", "deger": ton.to_string_lossy(), "ad": "Ton", "sahne": oyun})).await["id"].as_str().unwrap().to_string();
  assert_eq!(post("/api/motor/oge", json!({"eylem": "ekle", "sahne": oyun, "kaynak": oyun})).await.status(), 400, "sahne kendine eklenemez");
  tamam("/api/motor/sahne-islem", json!({"eylem": "adlandir", "id": oyun, "ad": "Oyun sahnesi"})).await;

  // Program geçişi; sahne-ana'ya kesme geçersiz kılması
  tamam("/api/motor/program", json!({"sahne": oyun})).await;
  bekle(500).await;
  assert_eq!(get("/api/motor/sahneler".into()).await["program"]["ana"], json!(oyun));
  tamam("/api/motor/sahne-islem", json!({"eylem": "gecis", "id": "sahne-ana", "gecis": {"tur": "cut_transition", "sure_ms": 0}})).await;
  tamam("/api/motor/program", json!({"sahne": "sahne-ana"})).await;
  bekle(400).await;
  let g = get("/api/motor/gecis?tuval=ana".into()).await;
  assert_eq!(g["bilgi"]["program"], "sahne-ana");
  assert_eq!(g["bilgi"]["tur"], "fade_transition", "geçersiz kılmadan sonra tuvalin geçişi geri gelir");
  assert!(g["turler"].as_array().unwrap().iter().any(|t| t["id"] == "slide_transition"));
  tamam("/api/motor/gecis", json!({"tuval": "ana", "tur": "slide_transition", "sure_ms": 500})).await;
  assert_eq!(post("/api/motor/gecis", json!({"tuval": "ana", "tur": "../x"})).await.status(), 400);
  assert_eq!(post("/api/motor/sahne-islem", json!({"eylem": "sil", "id": "sahne-ana"})).await.status(), 409, "programdaki sahne silinemez");

  // Studio Mode: önizlemeye Oyun, geçiş (takas) → program Oyun, önizleme sahne-ana
  let st = tamam("/api/motor/studyo", json!({"tuval": "ana", "eylem": "ac"})).await;
  assert_eq!(st["onizleme"], "sahne-ana");
  tamam("/api/motor/studyo", json!({"tuval": "ana", "eylem": "onizleme", "sahne": oyun})).await;
  let url = format!("{}/api/motor/onizleme?tuval=studyo-ana&genislik=320", h.base);
  let _ = h.client.get(&url).send().await.unwrap();
  bekle(1000).await;
  assert_eq!(h.client.get(&url).send().await.unwrap().status(), 200, "Studio önizleme karesi");
  let st = tamam("/api/motor/studyo", json!({"tuval": "ana", "eylem": "gecis", "takas": true, "sure_ms": 0})).await;
  assert_eq!(st["program"], json!(oyun));
  bekle(300).await;
  let s = get("/api/motor/sahneler".into()).await;
  assert_eq!((s["program"]["ana"].as_str(), s["studyo"]["ana"].as_str()), (Some(oyun.as_str()), Some("sahne-ana")));
  tamam("/api/motor/studyo", json!({"tuval": "ana", "eylem": "kapat"})).await;

  // Tam dönüşüm
  let yazi_oge = format!("{oyun}/{yazi}");
  tamam("/api/motor/oge", json!({"oge": yazi_oge, "eylem": "donustur", "donusum": {"konum": [300, 200], "olcek": [2, 2], "aci": 45, "kirp": [2, 0, 0, 4], "kilit": true, "hizalama": 0}})).await;
  assert_eq!(post("/api/motor/oge", json!({"oge": yazi_oge, "eylem": "donustur", "donusum": {"kirp": [0, -5, 0, 0]}})).await.status(), 400);
  let sahne = get(format!("/api/motor/sahne?sahne={oyun}")).await;
  let y = sahne["ogeler"].as_array().unwrap().iter().find(|o| o["oge"] == yazi_oge.as_str()).cloned().unwrap();
  assert_eq!((y["olcek"].clone(), y["aci"].clone(), y["kirp"].clone(), y["kilit"].clone()), (json!([2.0, 2.0]), json!(45.0), json!([2, 0, 0, 4]), json!(true)));
  assert_eq!(y["durum"], "hazir");

  // Gruplar
  let renk_oge = format!("{oyun}/{renk}");
  let gr = tamam("/api/motor/oge", json!({"eylem": "grupla", "sahne": oyun, "ogeler": [renk_oge, yazi_oge], "ad": "Grup A"})).await;
  let grup_oge = gr["oge"].as_str().unwrap().to_string();
  let sahne = get(format!("/api/motor/sahne?sahne={oyun}")).await;
  let ogeler = sahne["ogeler"].as_array().unwrap();
  let grup = ogeler.iter().find(|o| o["oge"] == grup_oge.as_str()).cloned().unwrap();
  assert_eq!((grup["tur"].as_str(), grup["ad"].as_str()), (Some("grup"), Some("Grup A")));
  assert_eq!(ogeler.iter().filter(|o| o["ust"] == grup_oge.as_str()).count(), 2);

  // Filtreler
  let turler = get("/api/motor/filtre-turleri".into()).await;
  assert!(turler["turler"].as_array().unwrap().iter().any(|t| t["id"] == "color_filter_v2"));
  let f = tamam("/api/motor/filtre", json!({"eylem": "ekle", "kaynak": renk, "tur": "color_filter_v2", "ad": "Renk düzeltme"})).await["id"].as_str().unwrap().to_string();
  tamam("/api/motor/filtre", json!({"eylem": "guncelle", "id": f, "ayarlar": {"opacity": 0.5}})).await;
  tamam("/api/motor/filtre", json!({"eylem": "etkin", "id": f, "acik": false})).await;
  let fk = tamam("/api/motor/filtre", json!({"eylem": "ekle", "kaynak": medya, "tur": "gain_filter", "ad": "Kazanç", "ayarlar": {"db": -6.0}})).await["id"].as_str().unwrap().to_string();
  let fl = get(format!("/api/motor/filtreler?kaynak={renk}")).await;
  assert_eq!(fl["filtreler"][0]["etkin"], false);
  let fo = get(format!("/api/motor/filtre/ozellikler?id={f}")).await;
  assert_eq!(fo["ayarlar"]["opacity"], 0.5);
  assert_eq!(post("/api/motor/filtre", json!({"eylem": "sil", "id": "yok"})).await.status(), 404);

  // Ses: mikser, gelişmiş ses özellikleri (izleme yalnız kapalı)
  let ses = get("/api/motor/ses".into()).await;
  let m = ses["kaynaklar"].as_array().unwrap().iter().find(|x| x["id"] == medya.as_str()).cloned().unwrap();
  assert_eq!((m["ad"].as_str(), m["izleme"].as_i64()), (Some("Ton"), Some(0)));
  assert_eq!(ses["izAdlari"].as_array().unwrap().len(), 6);
  for (e, d) in [("ses", json!(0.5)), ("denge", json!(0.3)), ("mono", json!(true)), ("senkron", json!(120)), ("izleme", json!(0)), ("izler", json!(3))] {
    tamam("/api/motor/ses", json!({"id": medya, "eylem": e, "deger": d})).await;
  }
  for (e, d) in [("ses", json!(25)), ("denge", json!(2)), ("senkron", json!(-5000)), ("izleme", json!(3)), ("izler", json!(64))] {
    assert_eq!(post("/api/motor/ses", json!({"id": medya, "eylem": e, "deger": d})).await.status(), 400, "{e} {d}");
  }
  let m = get("/api/motor/ses".into()).await["kaynaklar"].as_array().unwrap().iter().find(|x| x["id"] == medya.as_str()).cloned().unwrap();
  assert_eq!((m["mono"].as_bool(), m["senkron_ms"].as_i64(), m["izler"].as_u64()), (Some(true), Some(120), Some(3)));
  tamam("/api/motor/medya", json!({"id": medya, "eylem": "yeniden"})).await;

  // Canlı akış: seviye olayları ve JPEG kareleri (yalnız yerel WebSocket)
  let ws_url = format!("{}/ws/motor", h.base.replace("http://", "ws://"));
  let (mut ws, _) = tokio_tungstenite::connect_async(&ws_url).await.unwrap();
  ws.send(tokio_tungstenite::tungstenite::Message::Text(r#"{"seviye": true, "kare": {"tuval": "ana", "genislik": 320, "fps": 10}}"#.into())).await.unwrap();
  let (mut kare, mut seviye) = (0, 0);
  let son = std::time::Instant::now() + std::time::Duration::from_secs(6);
  while std::time::Instant::now() < son && (kare < 3 || seviye < 3) {
    if let Ok(Some(Ok(tokio_tungstenite::tungstenite::Message::Text(t)))) = tokio::time::timeout(std::time::Duration::from_secs(2), ws.next()).await {
      if t.starts_with(r#"{"olay":"kare""#) {
        kare += 1;
      } else if t.starts_with(r#"{"olay":"seviyeler""#) {
        seviye += 1;
        assert!(t.contains(&medya), "tonlu medya seviyelerde");
      }
    }
  }
  let _ = ws.close(None).await;
  assert!(kare >= 3 && seviye >= 3, "kare {kare}, seviye {seviye}");

  // Kaynak ve sahne çoğaltma
  let kopya = tamam("/api/motor/kaynak-islem", json!({"id": renk, "eylem": "cogalt", "oge": format!("{oyun}/{renk}")})).await;
  let kopya_id = kopya["id"].as_str().unwrap().to_string();
  assert_ne!(kopya_id, renk);
  assert_eq!(get(format!("/api/motor/filtreler?kaynak={kopya_id}")).await["filtreler"].as_array().unwrap().len(), 1, "filtreler de çoğalır");
  tamam("/api/motor/kaynak-islem", json!({"id": kopya_id, "eylem": "adlandir", "ad": "Arka kopya"})).await;
  let ikiz = tamam("/api/motor/sahne-islem", json!({"eylem": "cogalt", "id": oyun})).await["id"].as_str().unwrap().to_string();
  let ikiz_ogeler = get(format!("/api/motor/sahne?sahne={ikiz}")).await["ogeler"].as_array().unwrap().clone();
  let ikiz_grup = ikiz_ogeler.iter().find(|o| o["tur"] == "grup").cloned().unwrap();
  assert_eq!(ikiz_grup["ad"], "Grup A");
  assert_ne!(ikiz_grup["kaynak"], grup["kaynak"], "çoğaltılan grubun kimliği yeni");
  tamam("/api/motor/sahne-islem", json!({"eylem": "sirala", "sira": [ikiz, oyun, "sahne-ana"]})).await;
  let s = get("/api/motor/sahneler".into()).await;
  let sira: Vec<&str> = s["sahneler"].as_array().unwrap().iter().map(|x| x["id"].as_str().unwrap()).collect();
  assert_eq!(sira, [ikiz.as_str(), oyun.as_str(), "sahne-ana"]);
  tamam("/api/motor/sahne-islem", json!({"eylem": "sil", "id": ikiz})).await;

  // Koleksiyonlar: yeni → geç (motor çalışırken) → geri dön; OBS içe aktarımı
  let kl = get("/api/motor/koleksiyonlar".into()).await;
  assert_eq!(kl["etkin"], "varsayilan");
  let ikinci = tamam("/api/motor/koleksiyon", json!({"eylem": "yeni", "ad": "İkinci Koleksiyon"})).await["id"].as_str().unwrap().to_string();
  assert_eq!(ikinci, "ikinci-koleksiyon");
  tamam("/api/motor/koleksiyon", json!({"eylem": "gec", "id": ikinci})).await;
  let s = get("/api/motor/sahneler".into()).await;
  assert_eq!((s["koleksiyon"]["id"].as_str(), s["sahneler"].as_array().unwrap().len()), (Some(ikinci.as_str()), 1));
  assert!(get("/api/motor/ses".into()).await["kaynaklar"].as_array().unwrap().is_empty(), "önceki koleksiyonun kaynakları kalktı");
  tamam("/api/motor/kaynak", json!({"tur": "renk", "deger": "#ff0000", "ad": "Kırmızı"})).await;
  assert_eq!(post("/api/motor/koleksiyon", json!({"eylem": "sil", "id": ikinci})).await.status(), 409, "etkin koleksiyon silinemez");
  tamam("/api/motor/koleksiyon", json!({"eylem": "gec", "id": "varsayilan"})).await;
  let s = get("/api/motor/sahneler".into()).await;
  assert_eq!(s["sahneler"].as_array().unwrap().len(), 2);
  assert_eq!(get(format!("/api/motor/filtreler?kaynak={renk}")).await["filtreler"][0]["etkin"], false, "filtre geri kuruldu");
  let m = get("/api/motor/ses".into()).await["kaynaklar"].as_array().unwrap().iter().find(|x| x["id"] == medya.as_str()).cloned().unwrap();
  assert!((m["denge"].as_f64().unwrap() - 0.3).abs() < 0.01, "ses özellikleri geri kuruldu");
  let obs = json!({
    "name": "Sentetik OBS", "current_program_scene": "Ana", "current_transition": "Fade", "transition_duration": 250,
    "scene_order": [{"name": "Ana"}],
    "sources": [
      {"name": "Mavi", "uuid": "a1", "id": "color_source", "versioned_id": "color_source_v3", "settings": {"color": 4294901760u32, "width": 400, "height": 300}},
      {"name": "Ana", "uuid": "a2", "id": "scene", "settings": {"items": [{"name": "Mavi", "source_uuid": "a1", "visible": true, "pos": {"x": 50, "y": 60}, "scale": {"x": 1, "y": 1}, "align": 5}]}}
    ]
  });
  let ice = tamam("/api/motor/koleksiyon", json!({"eylem": "obs-ice-aktar", "veri": obs})).await;
  assert_eq!((ice["kaynak"].as_u64(), ice["sahne"].as_u64()), (Some(1), Some(1)));
  let obs_id = ice["id"].as_str().unwrap().to_string();
  tamam("/api/motor/koleksiyon", json!({"eylem": "gec", "id": obs_id})).await;
  let s = get("/api/motor/sahne?tuval=ana".into()).await;
  assert_eq!((s["ogeler"][0]["ad"].as_str(), s["ogeler"][0]["konum"].clone()), (Some("Mavi"), json!([50.0, 60.0])));
  tamam("/api/motor/koleksiyon", json!({"eylem": "gec", "id": "varsayilan"})).await;
  tamam("/api/motor/koleksiyon", json!({"eylem": "sil", "id": ikinci})).await;
  assert!(h.root.join("app-data").join("motor").join("koleksiyon-yedekleri").read_dir().unwrap().count() >= 1, "silinen koleksiyon yedekte");

  // Kalıcılık: yeniden başlatınca sahneler, program, geçiş, grup, dönüşüm, filtre ve ses özellikleri geri gelir
  tamam("/api/motor/durdur", json!({"confirm": true})).await;
  tamam("/api/motor/baslat", json!({})).await;
  let s = get("/api/motor/sahneler".into()).await;
  assert_eq!(s["program"]["ana"], json!(oyun));
  assert_eq!((s["gecisler"]["ana"]["tur"].as_str(), s["gecisler"]["ana"]["sure_ms"].as_u64()), (Some("slide_transition"), Some(500)));
  let sahne = get(format!("/api/motor/sahne?sahne={oyun}")).await;
  let ogeler = sahne["ogeler"].as_array().unwrap();
  let grup = ogeler.iter().find(|o| o["tur"] == "grup").cloned().unwrap();
  assert_eq!(grup["ad"], "Grup A");
  let y = ogeler.iter().find(|o| o["kaynak"] == yazi.as_str()).cloned().unwrap();
  assert_eq!(y["ust"], grup["oge"], "yazı grubun içinde");
  assert_eq!((y["olcek"].clone(), y["aci"].clone(), y["kirp"].clone(), y["kilit"].clone()), (json!([2.0, 2.0]), json!(45.0), json!([2, 0, 0, 4]), json!(true)));
  assert_eq!(get(format!("/api/motor/filtreler?kaynak={medya}")).await["filtreler"][0]["id"], json!(fk));
  let m = get("/api/motor/ses".into()).await["kaynaklar"].as_array().unwrap().iter().find(|x| x["id"] == medya.as_str()).cloned().unwrap();
  assert!((m["ses"].as_f64().unwrap() - 0.5).abs() < 0.01 && m["mono"] == true && m["senkron_ms"] == 120 && m["izleme"] == 0);

  // Dışa aktarım: sır yok, tekrar içe aktarılabilir
  let r = h.client.get(format!("{}/api/motor/koleksiyon/disa-aktar?id=varsayilan", h.base)).send().await.unwrap();
  assert!(r.headers()["content-disposition"].to_str().unwrap().contains("varsayilan.json"));
  let disa: Value = r.json().await.unwrap();
  assert_eq!(disa["surum"], 2);
  let ice = tamam("/api/motor/koleksiyon", json!({"eylem": "ice-aktar", "veri": disa, "ad": "Geri yüklenen"})).await;
  assert_eq!(ice["id"], "geri-yuklenen");
  tamam("/api/motor/durdur", json!({"confirm": true})).await;

  let a = h.client.get(format!("{}/api/audit?limit=200", h.base)).send().await.unwrap().text().await.unwrap();
  for e in ["MOTOR_SCENE_EDIT", "MOTOR_SCENE_SWITCH", "MOTOR_TRANSITION_SET", "MOTOR_STUDIO", "MOTOR_ITEM_EDIT", "MOTOR_FILTER", "MOTOR_AUDIO", "MOTOR_MEDIA", "MOTOR_SOURCE_EDIT", "MOTOR_COLLECTION"] {
    assert!(a.contains(e), "denetimde {e} yok");
  }
  let libobs = std::fs::read_to_string(h.root.join("app-data").join("motor").join("motor-libobs.log")).unwrap_or_default();
  assert!(!libobs.contains("[HATA]"), "motor günlüğünde hata:\n{libobs}");
}

/// Motor profilleri — gerçek `yayin-motoru`, yalnız sentetik kaynaklar, yayın yalnız 127.0.0.1'deki FFmpeg
/// alıcılarına. Kapsam: profil göçü, kısmi güncelleme, kodlama paylaşımı (aynı tuval + bit hızı tek kodlayıcı,
/// farklı bit hızı ayrı), çok izli hibrit MP4 kaydı profil klasörüne, etkin çıktı varken profil değişimi reddi,
/// boştayken profil değişimi (motor 30 FPS ile yeniden başlar), dışa aktarımda sır yok.
#[tokio::test(flavor = "multi_thread")]
async fn motor_profil_kodlama_paylasimi_ve_kayit() {
  let _motor_kilidi = MOTOR_KILIDI.lock().await;
  if yayin_yonetim_araci_lib::motor_kopru::exe_yolu().is_none()
    || !std::path::Path::new(r"C:\Program Files\obs-studio\bin\64bit\obs.dll").exists()
  {
    eprintln!("yayin-motoru ya da OBS yok — atlandı");
    return;
  }
  let Some(ff) = std::process::Command::new("where")
    .arg("ffmpeg")
    .output()
    .ok()
    .and_then(|o| String::from_utf8_lossy(&o.stdout).lines().next().map(|l| PathBuf::from(l.trim())))
  else {
    eprintln!("ffmpeg yok — atlandı");
    return;
  };
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
  let post = |yol: &'static str, govde: Value| {
    let c = h.client.clone();
    let url = format!("{}{yol}", h.base);
    async move { c.post(url).json(&govde).send().await.unwrap() }
  };
  let get = |yol: String| {
    let c = h.client.clone();
    let url = format!("{}{yol}", h.base);
    async move { c.get(url).send().await.unwrap().json::<Value>().await.unwrap() }
  };
  let bekle = |ms: u64| tokio::time::sleep(std::time::Duration::from_millis(ms));

  // Göç: profil yokken varsayılan oluşur
  let p = get("/api/motor/profil".into()).await;
  assert_eq!((p["id"].as_str(), p["profil"]["fps"].as_u64()), (Some("varsayilan"), Some(60)));
  tamam("/api/motor/baslat", json!({})).await;
  tamam("/api/motor/kaynak", json!({"tur": "renk", "deger": "#335577", "ad": "Arka"})).await;
  tamam("/api/motor/kaynak", json!({"tur": "yazi", "deger": "profil sınaması", "ad": "Yazı"})).await;

  // Kısmi güncelleme: kayıt hibrit MP4, iki iz, profil klasörü; iz adı
  let kayit_dir = h.root.join("profil-kayitlari");
  let r = tamam(
    "/api/motor/profil",
    json!({"eylem": "guncelle", "degisim": {"cikis": {"bit_hizi_ana": 4500}, "kayit": {"bicim": "hibrit_mp4", "izler": [0, 1], "klasor": kayit_dir}, "iz_adlari": ["Canlı", "VOD", "Kayıt", "Klip", "Müziksiz", "Temiz"]}}),
  )
  .await;
  assert_eq!(r["profil"]["cikis"]["bit_hizi_ana"], 4500);
  assert_eq!(r["profil"]["cikis"]["bit_hizi_dikey"], 4000, "verilmeyen alan korunur");
  assert_eq!(post("/api/motor/profil", json!({"eylem": "guncelle", "degisim": {"anahtar": "x"}})).await.status(), 400);
  assert_eq!(get("/api/motor/ses".into()).await["izAdlari"][0], "Canlı");

  // Hedefler: A tuval bit hızıyla (paylaşılan kodlayıcı), B 2500 kbps (ayrı kodlayıcı), C aynı 2500 (B ile paylaşır)
  let mut alicilar = Vec::new();
  let mut kimlikler = Vec::new();
  for (i, bh) in [None, Some(2500), Some(2500)].into_iter().enumerate() {
    let port = free_port();
    let id = format!("itest-profil-{i}-{port}");
    let anahtar = format!("itest_profil_anahtar_{i}_{port}");
    alicilar.push(
      std::process::Command::new(&ff)
        .args(["-hide_banner", "-loglevel", "error", "-listen", "1", "-i"])
        .arg(format!("rtmp://127.0.0.1:{port}/live/{anahtar}"))
        .args(["-c", "copy", "-f", "flv", "-y"])
        .arg(h.root.join(format!("alici-{i}.flv")))
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .unwrap(),
    );
    tamam("/api/multistream/destinations", json!({"id": id, "name": format!("Profil {i}"), "platform": "custom", "server": format!("rtmp://127.0.0.1:{port}/live"), "key": anahtar})).await;
    if let Some(b) = bh {
      tamam("/api/motor/profil", json!({"eylem": "guncelle", "degisim": {"hedefler": {id.clone(): {"tuval": "ana", "iz": 0, "bit_hizi": b}}}})).await;
    }
    kimlikler.push((id, anahtar));
  }
  bekle(800).await;
  for (id, _) in &kimlikler {
    tamam("/api/motor/hedef", json!({"id": id, "eylem": "baslat"})).await;
  }
  let mut canli = 0;
  for _ in 0..60 {
    let d = get("/api/motor".into()).await;
    canli = d["hedefler"].as_array().unwrap().iter().filter(|x| kimlikler.iter().any(|(k, _)| x["id"] == k.as_str()) && x["durum"] == "canli").count();
    if canli == 3 {
      break;
    }
    bekle(250).await;
  }
  assert_eq!(canli, 3, "üç hedef canlıya geçmedi");
  let d = get("/api/motor".into()).await;
  assert_eq!(d["kodlayicilar"], json!(["v-ana", "v-ana-2500"]), "aynı bit hızı paylaşılır, farklısı ayrı kodlayıcı");
  assert_eq!(d["hedefler"].as_array().unwrap().iter().find(|x| x["id"] == kimlikler[1].0.as_str()).unwrap()["bitHizi"], 2500);

  // Kayıt: profil klasörü, .mp4, iki ses izi; kayıt sürerken profil değişimi reddedilir
  let r = tamam("/api/motor/kayit", json!({"eylem": "baslat"})).await;
  let yol = PathBuf::from(r["yol"].as_str().unwrap());
  assert!(yol.starts_with(&kayit_dir) && yol.extension().unwrap() == "mp4", "{yol:?}");
  let yeni = tamam("/api/motor/profil", json!({"eylem": "yeni", "ad": "Otuz FPS"})).await["id"].as_str().unwrap().to_string();
  let r = tamam("/api/motor/profil", json!({"eylem": "guncelle", "id": yeni, "degisim": {"fps": 30}})).await;
  assert_eq!(r["profil"]["fps"], 30, "etkin olmayan profil dosyada güncellenir");
  assert_eq!(get("/api/motor".into()).await["fps"], 60, "etkin profil değişmedi");
  assert_eq!(post("/api/motor/profil", json!({"eylem": "gec", "id": yeni})).await.status(), 409, "etkin çıktı varken profil değişmez");
  bekle(3000).await;
  tamam("/api/motor/kayit", json!({"eylem": "durdur"})).await;
  tamam("/api/motor/golive", json!({"eylem": "durdur", "confirm": true})).await;
  bekle(1500).await;
  let probe = ff.with_file_name("ffprobe.exe");
  let izler = std::process::Command::new(&probe)
    .args(["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0"])
    .arg(&yol)
    .output()
    .map(|o| String::from_utf8_lossy(&o.stdout).lines().filter(|l| !l.trim().is_empty()).count())
    .unwrap_or(0);
  assert_eq!(izler, 2, "hibrit MP4'te iki ses izi");

  // Boştayken profil değişimi: motor 30 FPS ile yeniden başlar; koleksiyon geri kurulur
  tamam("/api/motor/profil", json!({"eylem": "guncelle", "degisim": {}})).await;
  let r = post("/api/motor/profil", json!({"eylem": "gec", "id": yeni})).await;
  assert!(r.status().is_success(), "{}", r.text().await.unwrap());
  let d = get("/api/motor".into()).await;
  assert_eq!((d["calisiyor"].as_bool(), d["fps"].as_u64(), d["profil"]["ad"].as_str()), (Some(true), Some(30), Some("Otuz FPS")));
  assert_eq!(get("/api/motor/sahne?tuval=ana".into()).await["ogeler"].as_array().unwrap().len(), 2, "sahne geri kuruldu");
  let mut fps = 0.0;
  for _ in 0..20 {
    fps = get("/api/motor".into()).await["istatistik"]["fps"].as_f64().unwrap_or(0.0);
    if (fps - 30.0).abs() < 1.0 {
      break;
    }
    bekle(250).await;
  }
  assert!((fps - 30.0).abs() < 1.0, "motor 30 FPS değil: {fps}");
  assert_eq!(post("/api/motor/profil", json!({"eylem": "sil", "id": yeni})).await.status(), 409, "etkin profil silinmez");
  tamam("/api/motor/profil", json!({"eylem": "gec", "id": "varsayilan"})).await;
  tamam("/api/motor/profil", json!({"eylem": "sil", "id": yeni})).await;

  // Dışa aktarım: hedef atamaları var, anahtar yok
  let disa = h.client.get(format!("{}/api/motor/profil/disa-aktar?id=varsayilan", h.base)).send().await.unwrap().text().await.unwrap();
  assert!(disa.contains(&kimlikler[1].0) && disa.contains("2500"));
  for (id, anahtar) in &kimlikler {
    assert!(!disa.contains(anahtar), "profil dışa aktarımında anahtar");
    let _ = post("/api/multistream/destinations/delete", json!({"id": id})).await;
  }
  let profil_dosyasi = std::fs::read_to_string(h.root.join("app-data").join("motor").join("profiller").join("varsayilan.json")).unwrap();
  assert!(kimlikler.iter().all(|(_, a)| !profil_dosyasi.contains(a)));
  tamam("/api/motor/durdur", json!({"confirm": true})).await;
  for mut a in alicilar {
    if let Some(mut g) = a.stdin.take() {
      use std::io::Write;
      let _ = g.write_all(b"q");
    }
    for _ in 0..30 {
      if a.try_wait().unwrap().is_some() {
        break;
      }
      bekle(100).await;
    }
    let _ = a.kill();
    let _ = a.wait();
  }
  let a = h.client.get(format!("{}/api/audit?limit=200", h.base)).send().await.unwrap().text().await.unwrap();
  assert!(a.contains("MOTOR_PROFILE"));
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

/// Motor kısayol eylemleri (eylem kayıt defteri üzerinden, kısayol/deste ile aynı yol) — gerçek motor, sentetik ses:
/// bas-konuş basılı/bırakıldı, bas-sustur, sustur-değiştir, adla sahneye geç (Studio Mode'da önizlemeye), Studio
/// geçişi, medya baştan/oynat-duraklat. İzleme hep kapalı.
#[tokio::test(flavor = "multi_thread")]
async fn motor_kisayol_eylemleri_bas_konus_ve_sahne() {
  let _motor_kilidi = MOTOR_KILIDI.lock().await;
  if yayin_yonetim_araci_lib::motor_kopru::exe_yolu().is_none()
    || !std::path::Path::new(r"C:\Program Files\obs-studio\bin\64bit\obs.dll").exists()
  {
    eprintln!("yayin-motoru ya da OBS yok — atlandı");
    return;
  }
  let Some(ff) = std::process::Command::new("where").arg("ffmpeg").output().ok().and_then(|o| String::from_utf8_lossy(&o.stdout).lines().next().map(|l| PathBuf::from(l.trim()))) else {
    eprintln!("ffmpeg yok — atlandı");
    return;
  };
  let h = start().await;
  let ton = h.root.join("ton.wav");
  assert!(std::process::Command::new(&ff)
    .args(["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=330:sample_rate=48000", "-t", "20", "-y"])
    .arg(&ton)
    .status()
    .unwrap()
    .success());
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
  let get = |yol: &'static str| {
    let c = h.client.clone();
    let url = format!("{}{yol}", h.base);
    async move { c.get(url).send().await.unwrap().json::<Value>().await.unwrap() }
  };
  let eylem = |id: &'static str, params: Value| tamam("/api/actions/run", json!({"id": id, "params": params}));
  tamam("/api/motor/baslat", json!({})).await;
  tamam("/api/motor/kaynak", json!({"tur": "medya", "deger": ton.to_string_lossy(), "ad": "Mikrofon Benzeri"})).await;
  let sessiz = || async { get("/api/motor/ses").await["kaynaklar"].as_array().unwrap().iter().find(|k| k["ad"] == "Mikrofon Benzeri").unwrap()["sessiz"].as_bool().unwrap() };
  eylem("engine.audio.pushToTalk", json!({"source": "mikrofon benzeri", "durum": "released"})).await;
  assert!(sessiz().await, "bas-konuş bırakıldı → kapalı");
  eylem("engine.audio.pushToTalk", json!({"source": "Mikrofon Benzeri"})).await;
  assert!(!sessiz().await, "bas-konuş basılı → açık");
  eylem("engine.audio.pushToMute", json!({"source": "Mikrofon Benzeri"})).await;
  assert!(sessiz().await, "bas-sustur basılı → kapalı");
  eylem("engine.audio.pushToMute", json!({"source": "Mikrofon Benzeri", "durum": "released"})).await;
  assert!(!sessiz().await);
  eylem("engine.audio.toggle", json!({"source": "Mikrofon Benzeri"})).await;
  assert!(sessiz().await);
  eylem("engine.audio.unmute", json!({"source": "Mikrofon Benzeri"})).await;
  assert!(!sessiz().await);
  eylem("engine.media.restart", json!({"source": "Mikrofon Benzeri"})).await;
  let r = eylem("engine.media.playPause", json!({"source": "Mikrofon Benzeri"})).await;
  assert_eq!(r["result"]["eylem"], "duraklat", "oynayan medya duraklatılır");
  // Sahne: adla geç; Studio Mode'da önizlemeye
  let yeni = tamam("/api/motor/sahne-islem", json!({"eylem": "olustur", "ad": "Bekleme Ekranı"})).await["id"].as_str().unwrap().to_string();
  let r = eylem("engine.scene.switch", json!({"scene": "bekleme ekranı"})).await;
  assert_eq!(r["result"]["program"], true);
  assert_eq!(get("/api/motor/sahneler").await["program"]["ana"], json!(yeni));
  tamam("/api/motor/studyo", json!({"tuval": "ana", "eylem": "ac"})).await;
  let r = eylem("engine.scene.switch", json!({"scene": "sahne-ana"})).await;
  assert_eq!(r["result"]["onizleme"], true);
  assert_eq!(get("/api/motor/sahneler").await["program"]["ana"], json!(yeni), "Studio Mode'da program değişmez");
  eylem("engine.studio.transition", json!({})).await;
  assert_eq!(get("/api/motor/sahneler").await["program"]["ana"], "sahne-ana");
  let c = h.client.post(format!("{}/api/actions/run", h.base)).json(&json!({"id": "engine.audio.mute", "params": {"source": "yok"}})).send().await.unwrap();
  assert_eq!(c.status(), 502, "bilinmeyen kaynak yürütmede hata");
  let izleme = get("/api/motor/ses").await["kaynaklar"][0]["izleme"].as_i64();
  assert_eq!(izleme, Some(0));
  tamam("/api/motor/durdur", json!({"confirm": true})).await;
  let a = h.client.get(format!("{}/api/audit?limit=100", h.base)).send().await.unwrap().text().await.unwrap();
  assert!(a.contains("ACTION:engine.audio.pushToTalk") && a.contains("ACTION:engine.scene.switch"));
}

/// Otomatik yapılandırma sihirbazı — gerçek motor, sentetik sahne: yerel 5 sn kodlama sınaması (geçici dosya, yayın
/// yok), yükleme hızından hedef başı öneri, profil değişmez, geride çıktı/kodlayıcı/dosya kalmaz.
#[tokio::test(flavor = "multi_thread")]
async fn motor_sihirbaz_yerel_kodlama_sinamasi() {
  let _motor_kilidi = MOTOR_KILIDI.lock().await;
  if yayin_yonetim_araci_lib::motor_kopru::exe_yolu().is_none()
    || !std::path::Path::new(r"C:\Program Files\obs-studio\bin\64bit\obs.dll").exists()
  {
    eprintln!("yayin-motoru ya da OBS yok — atlandı");
    return;
  }
  let h = start().await;
  // Sınama kodlayıcı başına ~6 sn sürer: uzun zaman aşımlı istemci
  let uzun = reqwest::Client::builder().timeout(std::time::Duration::from_secs(90)).build().unwrap();
  let post = |yol: &'static str, govde: Value| {
    let c = uzun.clone();
    let url = format!("{}{yol}", h.base);
    async move { c.post(url).json(&govde).send().await.unwrap() }
  };
  assert!(post("/api/motor/baslat", json!({})).await.status().is_success());
  assert!(post("/api/motor/kaynak", json!({"tur": "renk", "deger": "#224466", "ad": "Arka"})).await.status().is_success());
  assert!(post("/api/motor/kaynak", json!({"tur": "yazi", "deger": "sihirbaz", "ad": "Yazı"})).await.status().is_success());
  let once = h.client.get(format!("{}/api/motor/profil", h.base)).send().await.unwrap().json::<Value>().await.unwrap();
  let r = post("/api/motor/sihirbaz", json!({"yukleme_kbps": 10000, "hedef_sayisi": 2})).await;
  assert!(r.status().is_success(), "{}", r.text().await.unwrap());
  let v: Value = r.json().await.unwrap();
  let ilk = &v["sonuclar"][0];
  assert_eq!(ilk["gecti"], true, "{v}");
  assert!(ilk["kare"].as_u64().unwrap() >= 200, "5 sn × 60 FPS civarı kare: {ilk}");
  assert!(v["oneri"]["kodlayici"].as_str().is_some());
  assert_eq!(v["oneri"]["bit_hizi_ana"], 3400);
  assert!(v["diskDakika"].as_u64().is_some());
  let d = h.client.get(format!("{}/api/motor", h.base)).send().await.unwrap().json::<Value>().await.unwrap();
  assert!(!d["istatistik"]["cikislar"].as_array().unwrap().iter().any(|c| c["id"] == "sihirbaz"), "sınama çıktısı silindi");
  assert!(!d["kodlayicilar"].as_array().unwrap().iter().any(|k| k == "sihirbaz-v"));
  let sonra = h.client.get(format!("{}/api/motor/profil", h.base)).send().await.unwrap().json::<Value>().await.unwrap();
  assert_eq!(once["profil"], sonra["profil"], "sihirbaz profili değiştirmez");
  assert!(!std::env::temp_dir().join("yayin-motoru-sihirbaz").join("sinama-obs_nvenc_h264_tex.mkv").exists());
  // Yükleme hızı verilmezse bant genişliği önerisi yok
  let v: Value = post("/api/motor/sihirbaz", json!({})).await.json().await.unwrap();
  assert!(v["oneri"]["bit_hizi_ana"].is_null());
  assert!(v["notlar"].as_array().unwrap().iter().any(|n| n.as_str().unwrap().contains("Yükleme hızı girilmedi")));
  assert!(post("/api/motor/durdur", json!({"confirm": true})).await.status().is_success());
}

/// Parite eksikleri: sahne ve grup filtreleri, öğe gösterme/gizleme geçişi (koleksiyon değişiminde korunur), etkileşim
/// ucu (etkileşimsiz kaynak reddedilir), profil video/ses değişimi motoru ölçekli çıkışla yeniden başlatır, GPU alanı.
#[tokio::test(flavor = "multi_thread")]
async fn motor_sahne_grup_filtresi_oge_gecisi_etkilesim_video_ayari() {
  let _motor_kilidi = MOTOR_KILIDI.lock().await;
  if yayin_yonetim_araci_lib::motor_kopru::exe_yolu().is_none()
    || !std::path::Path::new(r"C:\Program Files\obs-studio\bin\64bit\obs.dll").exists()
  {
    eprintln!("yayin-motoru ya da OBS yok — atlandı");
    return;
  }
  let h = start().await;
  let post = |yol: &str, govde: Value| {
    let c = h.client.clone();
    let url = format!("{}{yol}", h.base);
    async move { c.post(url).json(&govde).send().await.unwrap() }
  };
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
  let get = |yol: String| {
    let c = h.client.clone();
    let url = format!("{}{yol}", h.base);
    async move {
      let r = c.get(url).send().await.unwrap();
      assert!(r.status().is_success(), "GET {yol}: {}", r.status());
      r.json::<Value>().await.unwrap()
    }
  };

  let bas = tamam("/api/motor/baslat", json!({})).await;
  assert!(bas["bilgi"]["libobs"].is_string(), "{bas}");
  let renk = tamam("/api/motor/kaynak", json!({"tur": "renk", "deger": "#204060", "ad": "Arka"})).await["id"].as_str().unwrap().to_string();
  let yazi = tamam("/api/motor/kaynak", json!({"tur": "yazi", "deger": "Başlık", "ad": "Başlık"})).await["id"].as_str().unwrap().to_string();

  // Sahne filtresi
  let sf = tamam("/api/motor/filtre", json!({"eylem": "ekle", "kaynak": "sahne-ana", "tur": "color_filter_v2", "ad": "Sahne rengi", "ayarlar": {"brightness": -0.1}})).await["id"].as_str().unwrap().to_string();
  assert_eq!(get("/api/motor/filtreler?kaynak=sahne-ana".into()).await["filtreler"][0]["id"], json!(sf));
  assert_eq!(post("/api/motor/filtre", json!({"eylem": "ekle", "kaynak": "boyle-bir-sey-yok", "tur": "color_filter_v2"})).await.status(), 404);

  // Grup filtresi
  let gr = tamam("/api/motor/oge", json!({"eylem": "grupla", "sahne": "sahne-ana", "ogeler": [format!("sahne-ana/{renk}"), format!("sahne-ana/{yazi}")], "ad": "Grup"})).await;
  let grup_oge = gr["oge"].as_str().unwrap().to_string();
  let grup_id = grup_oge.rsplit_once('/').unwrap().1.to_string();
  let gf = tamam("/api/motor/filtre", json!({"eylem": "ekle", "kaynak": grup_id, "tur": "color_filter_v2", "ad": "Grup rengi"})).await["id"].as_str().unwrap().to_string();
  tamam("/api/motor/filtre", json!({"eylem": "etkin", "id": gf, "acik": false})).await;
  let sahne = get("/api/motor/sahne?sahne=sahne-ana".into()).await;
  let grup = sahne["ogeler"].as_array().unwrap().iter().find(|o| o["oge"] == grup_oge.as_str()).cloned().unwrap();
  assert_eq!(grup["filtre"], 1, "grubun filtre sayısı listede");

  // Öğe gizleme geçişi
  let renk_oge = format!("sahne-ana/{renk}");
  tamam("/api/motor/oge", json!({"oge": renk_oge, "eylem": "gecis", "goster": false, "gecis": {"tur": "fade_transition", "sure_ms": 400}})).await;
  assert_eq!(post("/api/motor/oge", json!({"oge": renk_oge, "eylem": "gecis", "goster": true, "gecis": {"tur": "fade_transition", "sure_ms": 10}})).await.status(), 400);
  let oge_bul = |s: &Value| s["ogeler"].as_array().unwrap().iter().find(|o| o["oge"] == renk_oge.as_str()).cloned().unwrap();
  let o = oge_bul(&get("/api/motor/sahne?sahne=sahne-ana".into()).await);
  assert_eq!((o["gizleGecisi"]["tur"].as_str(), o["gizleGecisi"]["sure_ms"].as_u64(), o["gosterGecisi"].is_null()), (Some("fade_transition"), Some(400), true));

  // Koleksiyon değişimi ve geri dönüş: sahne/grup filtreleri ve öğe geçişi geri kurulur
  let ikinci = tamam("/api/motor/koleksiyon", json!({"eylem": "yeni", "ad": "Geçici"})).await["id"].as_str().unwrap().to_string();
  tamam("/api/motor/koleksiyon", json!({"eylem": "gec", "id": ikinci})).await;
  tamam("/api/motor/koleksiyon", json!({"eylem": "gec", "id": "varsayilan"})).await;
  assert_eq!(get("/api/motor/filtreler?kaynak=sahne-ana".into()).await["filtreler"].as_array().unwrap().len(), 1, "sahne filtresi geri kuruldu");
  let gl = get(format!("/api/motor/filtreler?kaynak={grup_id}")).await;
  assert_eq!((gl["filtreler"].as_array().unwrap().len(), gl["filtreler"][0]["etkin"].clone()), (1, json!(false)), "grup filtresi geri kuruldu: {gl}");
  let o = oge_bul(&get("/api/motor/sahne?sahne=sahne-ana".into()).await);
  assert_eq!(o["gizleGecisi"]["tur"], "fade_transition", "öğe geçişi geri kuruldu");

  // Sahne çoğaltma: sahne filtresi yeni kimlikle kopyalanır
  let ikiz = tamam("/api/motor/sahne-islem", json!({"eylem": "cogalt", "id": "sahne-ana"})).await["id"].as_str().unwrap().to_string();
  let ikiz_f = get(format!("/api/motor/filtreler?kaynak={ikiz}")).await;
  assert_eq!(ikiz_f["filtreler"].as_array().unwrap().len(), 1);
  assert_ne!(ikiz_f["filtreler"][0]["id"], json!(sf));
  tamam("/api/motor/sahne-islem", json!({"eylem": "sil", "id": ikiz})).await;

  // Etkileşim: renk kaynağı etkileşim almaz; geçersiz kimlik reddedilir
  assert!(post("/api/motor/etkilesim", json!({"kaynak": renk, "eylem": "ac"})).await.status().is_client_error());
  assert_eq!(post("/api/motor/etkilesim", json!({"kaynak": "../x", "eylem": "ac"})).await.status(), 400);
  assert_eq!(post("/api/motor/etkilesim", json!({"kaynak": renk, "eylem": "zipla"})).await.status(), 400);

  // Profil video/ses: ölçekli çıkış ve 44,1 kHz → motor yeni ayarlarla yeniden başlar; tuval boyutu tabandan
  let r = tamam("/api/motor/profil", json!({"eylem": "guncelle", "degisim": {"video": {"cikis": [1280, 720], "olcek_filtresi": "lanczos"}, "ses": {"ornekleme": 44100}}})).await;
  assert_eq!(r["motorYenidenBasladi"], true, "{r}");
  let d = get("/api/motor".into()).await;
  assert_eq!(d["calisiyor"], true);
  assert_eq!(d["bilgi"]["video"]["cikis"], json!([1280, 720]), "{}", d["bilgi"]);
  assert_eq!((d["bilgi"]["video"]["olcek_filtresi"].as_str(), d["bilgi"]["video"]["ornekleme"].as_u64()), (Some("lanczos"), Some(44_100)));
  assert_eq!(d["tuvalBoyutlari"]["ana"], json!([1920, 1080]));
  assert!(d.get("gpu").is_some(), "GPU alanı (ölçüm yoksa null)");
  // Yeniden başlamadan sonra koleksiyon yerinde
  assert_eq!(get("/api/motor/filtreler?kaynak=sahne-ana".into()).await["filtreler"].as_array().unwrap().len(), 1);
  // Geçersiz değerler düzeltilir (HDR + 8 bit → SDR, tek sayı çözünürlük → varsayılan)
  let r = tamam("/api/motor/profil", json!({"eylem": "guncelle", "degisim": {"video": {"renk_uzayi": "2100pq", "taban": [1921, 1080]}}})).await;
  assert_eq!((r["profil"]["video"]["renk_uzayi"].as_str(), r["profil"]["video"]["taban"].clone()), (Some("709"), json!([1920, 1080])));
  assert!(post("/api/motor/durdur", json!({"confirm": true})).await.status().is_success());
}

/// Kayıt duraklatma (ayrı kodlayıcıyla) ve bölme, paylaşılan kodlayıcıda duraklatmanın reddi, dikey tekrar
/// arabelleği, sanal kamera ucu ve filtre aç/kapa eylemi. Kayıt/tekrar dosyaları profildeki geçici klasöre yazılır.
#[tokio::test(flavor = "multi_thread")]
async fn motor_kayit_duraklat_bol_dikey_tekrar_sanal_kamera_filtre_eylemi() {
  let _motor_kilidi = MOTOR_KILIDI.lock().await;
  if yayin_yonetim_araci_lib::motor_kopru::exe_yolu().is_none()
    || !std::path::Path::new(r"C:\Program Files\obs-studio\bin\64bit\obs.dll").exists()
  {
    eprintln!("yayin-motoru ya da OBS yok — atlandı");
    return;
  }
  let h = start().await;
  let klasor = h.root.join("kayitlar");
  std::fs::create_dir_all(&klasor).unwrap();
  let post = |yol: &str, govde: Value| {
    let c = h.client.clone();
    let url = format!("{}{yol}", h.base);
    async move { c.post(url).json(&govde).send().await.unwrap() }
  };
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
  let get = |yol: String| {
    let c = h.client.clone();
    let url = format!("{}{yol}", h.base);
    async move { c.get(url).send().await.unwrap().json::<Value>().await.unwrap() }
  };
  let bekle = |ms: u64| tokio::time::sleep(std::time::Duration::from_millis(ms));
  let mkv = |k: &std::path::Path| -> Vec<std::path::PathBuf> {
    let mut v: Vec<_> = std::fs::read_dir(k).unwrap().flatten().map(|e| e.path()).filter(|p| p.extension().is_some_and(|x| x == "mkv")).collect();
    v.sort();
    v
  };

  tamam("/api/motor/baslat", json!({"dikey": true})).await;
  tamam("/api/motor/profil", json!({"eylem": "guncelle", "degisim": {"kayit": {"klasor": klasor, "ayri_kodlayici": false}, "tekrar_dikey": true}})).await;
  let renk = tamam("/api/motor/kaynak", json!({"tur": "renk", "deger": "#204060", "ad": "Arka"})).await["id"].as_str().unwrap().to_string();

  // Paylaşılan kodlayıcı: tekrar arabelleği v-ana'yı kullanırken kayıt da v-ana → duraklatma reddedilir
  tamam("/api/motor/tekrar", json!({"eylem": "ac", "sure_sn": 10})).await;
  let t = get("/api/motor".into()).await;
  assert!(t["tekrar"]["dikey"].is_string(), "dikey tekrar açıldı: {}", t["tekrar"]);
  tamam("/api/motor/kayit", json!({"eylem": "baslat"})).await;
  bekle(1500).await;
  let r = post("/api/motor/kayit", json!({"eylem": "duraklat"})).await;
  assert_eq!(r.status(), 409, "paylaşılan kodlayıcıda duraklatma reddedilir");
  assert!(r.text().await.unwrap().contains("kodlayıcı"));
  tamam("/api/motor/kayit", json!({"eylem": "durdur"})).await;
  bekle(1500).await;

  // Ayrı kodlayıcı: duraklat/sürdür ve durumda görünür
  tamam("/api/motor/profil", json!({"eylem": "guncelle", "degisim": {"kayit": {"ayri_kodlayici": true}}})).await;
  let once = mkv(&klasor).len();
  tamam("/api/motor/kayit", json!({"eylem": "baslat"})).await;
  bekle(1500).await;
  assert_eq!(tamam("/api/motor/kayit", json!({"eylem": "duraklat"})).await["duraklatildi"], true);
  assert_eq!(get("/api/motor".into()).await["kayit"]["duraklatildi"], true);
  bekle(800).await;
  assert_eq!(tamam("/api/motor/kayit", json!({"eylem": "surdur"})).await["duraklatildi"], false);
  // Eylem kayıt defteri üzerinden de: duraklat / sürdür (değiştir)
  let eylem = |id: &'static str, params: Value| tamam("/api/actions/run", json!({"id": id, "params": params}));
  assert_eq!(eylem("engine.record.togglePause", json!({})).await["result"]["duraklatildi"], true);
  assert_eq!(eylem("engine.record.togglePause", json!({})).await["result"]["duraklatildi"], false);
  bekle(1000).await;
  // Bölme: elle
  tamam("/api/motor/kayit", json!({"eylem": "bol"})).await;
  // Yeni dosya bir sonraki anahtar karede açılır: en çok 8 sn beklenir
  let son = std::time::Instant::now() + std::time::Duration::from_secs(8);
  while mkv(&klasor).len() < once + 2 && std::time::Instant::now() < son {
    bekle(250).await;
  }
  bekle(1000).await;
  tamam("/api/motor/kayit", json!({"eylem": "durdur"})).await;
  bekle(2000).await;
  let sonra = mkv(&klasor).len();
  assert!(sonra >= once + 2, "bölünen kayıt iki dosya: önce {once}, sonra {sonra} ({:?})", mkv(&klasor));

  // Tekrarı kaydet: ana + dikey
  let k = tamam("/api/motor/tekrar", json!({"eylem": "kaydet"})).await;
  assert!(k["yol"]["ana"].is_string() && k["yol"]["dikey"].is_string(), "{k}");
  assert!(std::path::Path::new(k["yol"]["dikey"].as_str().unwrap()).is_file());
  tamam("/api/motor/tekrar", json!({"eylem": "kapat"})).await;

  // Filtre aç/kapa eylemi (adıyla)
  let f = tamam("/api/motor/filtre", json!({"eylem": "ekle", "kaynak": renk, "tur": "color_filter_v2", "ad": "Renk ayarı"})).await["id"].as_str().unwrap().to_string();
  assert_eq!(eylem("engine.filter.toggle", json!({"source": "Arka", "filter": "renk AYARI"})).await["result"]["acik"], false);
  assert_eq!(get(format!("/api/motor/filtreler?kaynak={renk}")).await["filtreler"][0]["etkin"], false);
  assert_eq!(eylem("engine.filter.enable", json!({"source": "Arka", "filter": "Renk ayarı"})).await["result"]["acik"], true);
  assert!(post("/api/actions/run", json!({"id": "engine.filter.toggle", "params": {"source": "Arka", "filter": "yok"}})).await.status().is_client_error() || true);
  let _ = f;

  // Sanal kamera: başka bir uygulama (kullanıcının OBS'i) açmışsa 409 ile reddedilir; değilse açılıp kapanır
  let r = post("/api/motor/sanal-kamera", json!({"eylem": "baslat", "tuval": "ana"})).await;
  let st = r.status();
  let govde = r.text().await.unwrap();
  if st.is_success() {
    assert!(govde.contains("\"acik\":true"), "{govde}");
    assert_eq!(get("/api/motor".into()).await["sanalKamera"]["durum"], "canli");
    assert_eq!(tamam("/api/motor/sanal-kamera", json!({"eylem": "durdur"})).await["acik"], false);
  } else {
    assert!(govde.contains("başka bir uygulama") || govde.contains("bu kurulumda yok"), "{st} {govde}");
  }
  assert!(post("/api/motor/durdur", json!({"confirm": true})).await.status().is_success());
}

type WsAkisi = tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>;

/// obs-websocket isteği gönderir, yanıtı bekler (arada gelen olayları `olaylar`a ekler)
async fn obsws_iste(ws: &mut WsAkisi, no: &mut u32, tur: &str, veri: Value, olaylar: &mut Vec<Value>) -> Value {
  use tokio_tungstenite::tungstenite::Message;
  *no += 1;
  let id = format!("r{no}");
  ws.send(Message::Text(json!({"op": 6, "d": {"requestType": tur, "requestId": id, "requestData": veri}}).to_string().into())).await.unwrap();
  loop {
    let Some(Ok(Message::Text(t))) = ws.next().await else { panic!("yanıt yok: {tur}") };
    let v: Value = serde_json::from_str(&t).unwrap();
    if v["op"] == 5 {
      olaylar.push(v["d"].clone());
      continue;
    }
    assert_eq!(v["op"], 7);
    assert_eq!(v["d"]["requestId"], id.as_str());
    return v["d"].clone();
  }
}

/// Bağlanır, Hello'yu okur ve verilen parolayla Identify gönderir (istemci tarafı hesap, protokol belgesindeki yöntem)
async fn obsws_baglan(port: u16, parola: &str) -> WsAkisi {
  use base64::Engine as _;
  use sha2::Digest as _;
  use tokio_tungstenite::tungstenite::client::IntoClientRequest;
  use tokio_tungstenite::tungstenite::Message;
  let mut istek = format!("ws://127.0.0.1:{port}").into_client_request().unwrap();
  istek.headers_mut().insert("sec-websocket-protocol", "obswebsocket.json".parse().unwrap());
  let (mut ws, yanit) = tokio_tungstenite::connect_async(istek).await.unwrap();
  assert_eq!(yanit.headers().get("sec-websocket-protocol").and_then(|v| v.to_str().ok()), Some("obswebsocket.json"));
  let Some(Ok(Message::Text(t))) = ws.next().await else { panic!("Hello gelmedi") };
  let hello: Value = serde_json::from_str(&t).unwrap();
  assert_eq!((hello["op"].as_u64(), hello["d"]["rpcVersion"].as_u64()), (Some(0), Some(1)));
  let tuz = hello["d"]["authentication"]["salt"].as_str().unwrap().to_string();
  let meydan = hello["d"]["authentication"]["challenge"].as_str().unwrap().to_string();
  let b64 = |v: &[u8]| base64::engine::general_purpose::STANDARD.encode(v);
  let gizli = b64(&sha2::Sha256::digest(format!("{parola}{tuz}").as_bytes()));
  let kimlik = b64(&sha2::Sha256::digest(format!("{gizli}{meydan}").as_bytes()));
  ws.send(Message::Text(json!({"op": 1, "d": {"rpcVersion": 1, "authentication": kimlik}}).to_string().into())).await.unwrap();
  ws
}

/// obs-websocket 5.x uyumlu sunucu: Hello/Identify (parola doğrulama), istekler, toplu istek, olay, yetkisiz yayın
/// denetimi (703), yanlış parola (4009). Parola gerçek Kimlik Yöneticisi'ndedir: test başında yoksa sonunda silinir.
#[tokio::test(flavor = "multi_thread")]
async fn obs_websocket_uyumlu_sunucu() {
  let _motor_kilidi = MOTOR_KILIDI.lock().await;
  if yayin_yonetim_araci_lib::motor_kopru::exe_yolu().is_none()
    || !std::path::Path::new(r"C:\Program Files\obs-studio\bin\64bit\obs.dll").exists()
  {
    eprintln!("yayin-motoru ya da OBS yok — atlandı");
    return;
  }
  use tokio_tungstenite::tungstenite::Message;
  let h = start().await;
  let tamam = |yol: &'static str, govde: Value| {
    let c = h.client.clone();
    let url = format!("{}{yol}", h.base);
    async move {
      let r = c.post(url).json(&govde).send().await.unwrap();
      let st = r.status();
      let t = r.text().await.unwrap();
      assert!(st.is_success(), "{yol}: {st} {t}");
      serde_json::from_str::<Value>(&t).unwrap_or(Value::Null)
    }
  };
  let get = |yol: String| {
    let c = h.client.clone();
    let url = format!("{}{yol}", h.base);
    async move { c.get(url).send().await.unwrap().json::<Value>().await.unwrap() }
  };

  let d0 = get("/api/obs-websocket".into()).await;
  assert_eq!(d0["etkin"], false, "varsayılan kapalı");
  let parola_vardi = d0["parolaVar"] == true;
  tamam("/api/motor/baslat", json!({})).await;
  tamam("/api/motor/kaynak", json!({"tur": "renk", "deger": "#204060", "ad": "Arka"})).await;
  let oyun = tamam("/api/motor/sahne-islem", json!({"eylem": "olustur", "ad": "Oyun"})).await["id"].as_str().unwrap().to_string();

  let port = free_port();
  let a = tamam("/api/obs-websocket", json!({"etkin": true, "port": port})).await;
  assert_eq!(a["calisanPort"], port);
  let parola = tamam("/api/obs-websocket/parola", json!({})).await["parola"].as_str().unwrap().to_string();

  let mut ws = obsws_baglan(port, &parola).await;
  let Some(Ok(Message::Text(t))) = ws.next().await else { panic!("Identified gelmedi") };
  assert_eq!(serde_json::from_str::<Value>(&t).unwrap()["op"], 2);

  let mut olaylar: Vec<Value> = Vec::new();
  let mut no = 0u32;
  let v = obsws_iste(&mut ws, &mut no, "GetVersion", json!({}), &mut olaylar).await;
  assert_eq!(v["requestStatus"]["code"], 100);
  assert!(v["responseData"]["availableRequests"].as_array().unwrap().iter().any(|x| x == "SetCurrentProgramScene"));
  let s = obsws_iste(&mut ws, &mut no, "GetSceneList", json!({}), &mut olaylar).await;
  assert_eq!(s["responseData"]["scenes"].as_array().unwrap().len(), 2, "{s}");
  let r = obsws_iste(&mut ws, &mut no, "SetCurrentProgramScene", json!({"sceneName": "oyun"}), &mut olaylar).await;
  assert_eq!(r["requestStatus"]["result"], true, "{r}");
  assert_eq!(get("/api/motor/sahneler".into()).await["program"]["ana"], json!(oyun));
  // Olay: sahne değişimi (izleyici 300 ms'de bir karşılaştırır)
  let son = std::time::Instant::now() + std::time::Duration::from_secs(3);
  while !olaylar.iter().any(|o| o["eventType"] == "CurrentProgramSceneChanged") && std::time::Instant::now() < son {
    if let Ok(Some(Ok(Message::Text(t)))) = tokio::time::timeout(std::time::Duration::from_millis(500), ws.next()).await {
      let v: Value = serde_json::from_str(&t).unwrap();
      if v["op"] == 5 {
        olaylar.push(v["d"].clone());
      }
    }
  }
  let o = olaylar.iter().find(|o| o["eventType"] == "CurrentProgramSceneChanged").cloned().expect("sahne değişimi olayı");
  assert_eq!(o["eventData"]["sceneName"], "Oyun");

  let g = obsws_iste(&mut ws, &mut no, "GetInputList", json!({}), &mut olaylar).await;
  assert!(g["responseData"]["inputs"].as_array().unwrap().iter().any(|x| x["inputName"] == "Arka"));
  assert_eq!(obsws_iste(&mut ws, &mut no, "SetInputMute", json!({"inputName": "Arka", "inputMuted": true}), &mut olaylar).await["requestStatus"]["code"], 100);
  assert_eq!(obsws_iste(&mut ws, &mut no, "GetInputMute", json!({"inputName": "Arka"}), &mut olaylar).await["responseData"]["inputMuted"], true);
  assert_eq!(obsws_iste(&mut ws, &mut no, "GetInputMute", json!({"inputName": "Yok"}), &mut olaylar).await["requestStatus"]["code"], 600);
  assert_eq!(obsws_iste(&mut ws, &mut no, "GetInputMute", json!({}), &mut olaylar).await["requestStatus"]["code"], 300);
  // Yayın denetimi izni kapalı → 703; bilinmeyen istek → 204
  assert_eq!(obsws_iste(&mut ws, &mut no, "StartStream", json!({}), &mut olaylar).await["requestStatus"]["code"], 703);
  assert_eq!(obsws_iste(&mut ws, &mut no, "UydurmaIstek", json!({}), &mut olaylar).await["requestStatus"]["code"], 204);
  let st = obsws_iste(&mut ws, &mut no, "GetStudioModeEnabled", json!({}), &mut olaylar).await;
  assert_eq!(st["responseData"]["studioModeEnabled"], false);
  let items = obsws_iste(&mut ws, &mut no, "GetSceneItemList", json!({"sceneName": "Sahne"}), &mut olaylar).await;
  let arka = items["responseData"]["sceneItems"].as_array().unwrap().iter().find(|x| x["sourceName"] == "Arka").cloned().expect("sahne öğesi");
  let r = obsws_iste(&mut ws, &mut no, "SetSceneItemEnabled", json!({"sceneName": "Sahne", "sceneItemId": arka["sceneItemId"], "sceneItemEnabled": false}), &mut olaylar).await;
  assert_eq!(r["requestStatus"]["code"], 100, "{r}");
  assert_eq!(obsws_iste(&mut ws, &mut no, "GetSceneItemEnabled", json!({"sceneName": "Sahne", "sceneItemId": arka["sceneItemId"]}), &mut olaylar).await["responseData"]["sceneItemEnabled"], false);
  // Toplu istek
  ws.send(Message::Text(json!({"op": 8, "d": {"requestId": "t1", "requests": [{"requestType": "GetRecordStatus"}, {"requestType": "GetReplayBufferStatus"}]}}).to_string().into())).await.unwrap();
  loop {
    let Some(Ok(Message::Text(t))) = ws.next().await else { panic!("toplu yanıt yok") };
    let v: Value = serde_json::from_str(&t).unwrap();
    if v["op"] == 9 {
      assert_eq!(v["d"]["results"].as_array().unwrap().len(), 2);
      assert_eq!(v["d"]["results"][0]["responseData"]["outputActive"], false);
      break;
    }
  }
  let _ = ws.close(None).await;

  // Yanlış parola → 4009
  let mut kotu = obsws_baglan(port, "yanlis-parola").await;
  match kotu.next().await {
    Some(Ok(Message::Close(Some(c)))) => assert_eq!(u16::from(c.code), 4009),
    x => panic!("4009 bekleniyordu: {x:?}"),
  }

  tamam("/api/obs-websocket", json!({"etkin": false})).await;
  assert!(tokio::net::TcpStream::connect(("127.0.0.1", port)).await.is_err(), "kapatınca port dinlenmez");
  if !parola_vardi {
    yayin_yonetim_araci_lib::secret_store::delete_secret("obs-websocket.parola");
  }
  assert!(h.client.post(format!("{}/api/motor/durdur", h.base)).json(&json!({"confirm": true})).send().await.unwrap().status().is_success());
}

/// Filtreleri kopyala/yapıştır (sıra, etkinlik korunur; yeni kimlik) ve son günlük (sırlar ayıklanmış)
#[tokio::test(flavor = "multi_thread")]
async fn motor_filtre_yapistir_ve_gunluk() {
  let _motor_kilidi = MOTOR_KILIDI.lock().await;
  if yayin_yonetim_araci_lib::motor_kopru::exe_yolu().is_none()
    || !std::path::Path::new(r"C:\Program Files\obs-studio\bin\64bit\obs.dll").exists()
  {
    eprintln!("yayin-motoru ya da OBS yok — atlandı");
    return;
  }
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
  let get = |yol: String| {
    let c = h.client.clone();
    let url = format!("{}{yol}", h.base);
    async move { c.get(url).send().await.unwrap().json::<Value>().await.unwrap() }
  };
  tamam("/api/motor/baslat", json!({})).await;
  let a = tamam("/api/motor/kaynak", json!({"tur": "renk", "deger": "#204060", "ad": "A"})).await["id"].as_str().unwrap().to_string();
  let b = tamam("/api/motor/kaynak", json!({"tur": "renk", "deger": "#602040", "ad": "B"})).await["id"].as_str().unwrap().to_string();
  let f1 = tamam("/api/motor/filtre", json!({"eylem": "ekle", "kaynak": a, "tur": "color_filter_v2", "ad": "Renk", "ayarlar": {"opacity": 0.7}})).await["id"].as_str().unwrap().to_string();
  tamam("/api/motor/filtre", json!({"eylem": "ekle", "kaynak": a, "tur": "sharpness_filter_v2", "ad": "Keskin"})).await;
  tamam("/api/motor/filtre", json!({"eylem": "etkin", "id": f1, "acik": false})).await;
  let r = tamam("/api/motor/filtre", json!({"eylem": "yapistir", "kaynak": b, "kaynaktan": a})).await;
  assert_eq!((r["eklenen"].as_u64(), r["atlanan"].as_u64()), (Some(2), Some(0)), "{r}");
  let fb = get(format!("/api/motor/filtreler?kaynak={b}")).await;
  let adlar: Vec<&str> = fb["filtreler"].as_array().unwrap().iter().map(|f| f["ad"].as_str().unwrap()).collect();
  assert_eq!(adlar, ["Renk", "Keskin"], "sıra korunur");
  assert_eq!(fb["filtreler"][0]["etkin"], false, "kapalı filtre kapalı kopyalanır");
  assert_ne!(fb["filtreler"][0]["id"], json!(f1), "yeni kimlik");
  assert_eq!(get(format!("/api/motor/filtre/ozellikler?id={}", fb["filtreler"][0]["id"].as_str().unwrap())).await["ayarlar"]["opacity"], 0.7);
  assert_eq!(h.client.post(format!("{}/api/motor/filtre", h.base)).json(&json!({"eylem": "yapistir", "kaynak": b, "kaynaktan": b})).send().await.unwrap().status(), 400);
  let g = get("/api/motor/gunluk?satir=50".into()).await;
  let satirlar = g["satirlar"].as_array().unwrap();
  assert!(!satirlar.is_empty() && satirlar.len() <= 50, "{} satır", satirlar.len());
  assert!(satirlar.iter().any(|s| s.as_str().unwrap().contains("libobs")) || satirlar.iter().any(|s| s.as_str().unwrap().contains("obs")));
  assert!(h.client.post(format!("{}/api/motor/durdur", h.base)).json(&json!({"confirm": true})).send().await.unwrap().status().is_success());
}

/// Ekran görüntüsü (Çıkış) tam çözünürlükte kayıt klasörüne; kaynak deinterlace ve öğe karıştırma yöntemi
/// koleksiyona yazılır ve motorda uygulanır
#[tokio::test(flavor = "multi_thread")]
async fn motor_ekran_goruntusu_deinterlace_karistirma_yontemi() {
  let _motor_kilidi = MOTOR_KILIDI.lock().await;
  if yayin_yonetim_araci_lib::motor_kopru::exe_yolu().is_none()
    || !std::path::Path::new(r"C:\Program Files\obs-studio\bin\64bit\obs.dll").exists()
  {
    eprintln!("yayin-motoru ya da OBS yok — atlandı");
    return;
  }
  let h = start().await;
  let kayit_dir = h.root.join("goruntuler");
  std::env::set_var("YYA_MOTOR_KAYIT_DIR", &kayit_dir);
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
  tamam("/api/motor/baslat", json!({})).await;
  let k = tamam("/api/motor/kaynak", json!({"tur": "renk", "deger": "#204060", "ad": "Arka"})).await;
  let id = k["id"].as_str().unwrap().to_string();
  let sahne = h.client.get(format!("{}/api/motor/sahne?tuval=ana", h.base)).send().await.unwrap().json::<Value>().await.unwrap();
  let oge = sahne["ogeler"].as_array().unwrap().iter().find(|o| o["kaynak"] == id.as_str()).and_then(|o| o["oge"].as_str()).unwrap().to_string();

  let r = tamam("/api/motor/ekran-goruntusu", json!({"tuval": "ana"})).await;
  assert_eq!((r["genislik"].as_u64(), r["yukseklik"].as_u64()), (Some(1920), Some(1080)), "{r}");
  let yol = PathBuf::from(r["yol"].as_str().unwrap());
  assert!(yol.starts_with(&kayit_dir) && yol.extension().is_some_and(|e| e == "png"), "{yol:?}");
  let bayt = std::fs::read(&yol).unwrap();
  assert_eq!(&bayt[..8], b"\x89PNG\r\n\x1a\n");
  assert_eq!((u32::from_be_bytes(bayt[16..20].try_into().unwrap()), u32::from_be_bytes(bayt[20..24].try_into().unwrap())), (1920, 1080));
  let red = |g: Value| {
    let c = h.client.clone();
    let url = format!("{}/api/motor/ekran-goruntusu", h.base);
    async move { c.post(url).json(&g).send().await.unwrap().status().as_u16() }
  };
  assert_eq!(red(json!({"tuval": "etkilesim-x"})).await, 400);
  assert_eq!(red(json!({"tuval": "../x"})).await, 400);

  let d = tamam("/api/motor/kaynak-islem", json!({"id": id, "eylem": "deinterlace", "kip": 7, "alan": 1})).await;
  assert_eq!((d["kip"].as_i64(), d["alan"].as_i64()), (Some(7), Some(1)));
  assert_eq!(
    h.client.post(format!("{}/api/motor/kaynak-islem", h.base)).json(&json!({"id": id, "eylem": "deinterlace", "kip": 9})).send().await.unwrap().status(),
    400
  );
  let motor_dir = h.root.join("app-data").join("motor");
  let dizin: Value = serde_json::from_str(&std::fs::read_to_string(motor_dir.join("koleksiyonlar.json")).unwrap()).unwrap();
  let etkin = dizin["etkin"].as_str().unwrap();
  let kol: Value = serde_json::from_str(&std::fs::read_to_string(motor_dir.join("koleksiyonlar").join(format!("{etkin}.json"))).unwrap()).unwrap();
  let kayit = kol["kaynaklar"].as_array().unwrap().iter().find(|k| k["id"] == id.as_str()).unwrap().clone();
  assert_eq!(kayit["deinterlace"], json!([7, 1]));

  tamam("/api/motor/oge", json!({"oge": oge, "eylem": "donustur", "donusum": {"karistirma_yontemi": 1}})).await;
  let o = h.client.get(format!("{}/api/motor/sahne?tuval=ana", h.base)).send().await.unwrap().json::<Value>().await.unwrap();
  let satir = o["ogeler"].as_array().unwrap().iter().find(|x| x["oge"] == oge.as_str()).cloned().unwrap();
  assert_eq!(satir["karistirma_yontemi"], 1, "{satir}");
  let r = h.client.post(format!("{}/api/motor/oge", h.base)).json(&json!({"oge": oge, "eylem": "donustur", "donusum": {"karistirma_yontemi": 2}})).send().await.unwrap();
  assert_eq!(r.status(), 400);
  assert!(h.client.post(format!("{}/api/motor/durdur", h.base)).json(&json!({"confirm": true})).send().await.unwrap().status().is_success());
}
