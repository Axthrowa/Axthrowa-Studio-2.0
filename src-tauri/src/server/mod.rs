use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;

use axum::body::Body;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{ConnectInfo, Query, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use serde_json::{json, Value};
use axum::http::HeaderValue;
use tower_http::cors::{AllowOrigin, Any, CorsLayer};
use tower_http::set_header::SetResponseHeaderLayer;
use tower_http::services::{ServeDir, ServeFile};

use crate::media;
use crate::settings::ScreenKind;
use crate::AppState;

mod actions_api;
pub mod asistan_api;
pub(crate) use actions_api::{kisayol_eylemi, kisayol_kaydi};
mod auth;
mod bot_api;
mod eski_widgetlar;
mod control_plane;
mod destek_api;
mod dosya_adi;
mod eslestirme;
mod gecis_api;
mod local_guard;
pub mod guncelleme_api;
pub mod yedek_api;
mod yayin_bilgisi_api;
mod discord_api;
mod multistream_api;
mod obs_studio_api;
mod otomasyon_kilidi;
pub mod runtime_api;
mod platform_api;
use platform_api::*;
pub(crate) use platform_api::sohbeti_temizle;
mod kutuphane_api;
use kutuphane_api::*;
mod oynatici_api;
use oynatici_api::*;
pub use oynatici_api::{ACTIVE_OVERLAY_ID, SPOTIFY_CALLBACK_PATHS};
mod medya_ws;
use medya_ws::*;
mod bot_oturum_api;
use bot_oturum_api::*;

fn resolve_resonance_dist(root: &std::path::Path) -> Option<PathBuf> {
  let mut candidates = vec![
    root.join("resonance").join("dist"),
    root.join("resources").join("resonance").join("dist"),
  ];
  if let Some(parent) = root.parent() {
    candidates.push(parent.join("resonance").join("dist"));
    candidates.push(parent.join("resources").join("resonance").join("dist"));
  }
  // Dev: cargo target → proje kökü
  if let Ok(cwd) = std::env::current_dir() {
    candidates.push(cwd.join("resonance").join("dist"));
  }
  candidates.into_iter().find(|p| p.join("index.html").exists())
}

pub async fn serve(state: AppState) -> anyhow::Result<()> {
  // Yedek: AppState::new zaten seed etti; burada idempotent (boşsa doldur)
  {
    let settings_snap = state.settings.read().clone();
    if let Err(e) = crate::db::init(&state.db, &settings_snap).await {
      studio_warn!("DB init uyarısı: {e:#}");
    }
    studio_log!(
      "SQLite → {}",
      crate::db::db_file(&state.data_dir).display()
    );
    match crate::db::bot_api::seed_alerts_if_empty(&state.db, &settings_snap).await {
      Ok(n) if n > 0 => studio_log!("Bot alerts seed: {n}"),
      Err(e) => studio_warn!("alerts seed uyarısı: {e:#}"),
      _ => {}
    }
    match crate::db::bot_api::seed_widgets_if_empty(&state.db).await {
      Ok(n) if n > 0 => studio_log!("Bot widgets seed: {n}"),
      Err(e) => studio_warn!("widgets seed uyarısı: {e:#}"),
      _ => {}
    }
  }

  let port = state.port;
  let root = state.root.clone();
  // Kullanıcı kütüphanesi (logo, video, müzik…) sürüm klasöründe değil veri klasöründe durur: sürüm değişince kaybolmaz
  let kutuphane = state.data_dir.clone();
  let dist = root.join("dist");
  let index = dist.join("index.html");
  let has_dist = index.exists();

  // Yalnız yerel kökenler yanıtı okuyabilir (bkz. local_guard). Eskiden
  // `allow_origin(Any)`: ziyaret edilen her site ayarları/dosyaları okuyabiliyordu.
  let cors = CorsLayer::new()
    .allow_origin(AllowOrigin::predicate(local_guard::cors_origin_ok))
    .allow_methods(Any)
    .allow_headers(Any);

  let particles_dir = kutuphane.join("assets").join("particles");
  let music_dir = kutuphane.join("assets").join("music");
  let sfx_dir = kutuphane.join("assets").join("sfx");
  let logos_dir = kutuphane.join("assets").join("logos");
  let videos_dir = kutuphane.join("assets").join("videos");
  let backgrounds_dir = kutuphane.join("assets").join("backgrounds");
  let resonance_dist = resolve_resonance_dist(&root);
  let has_resonance = resonance_dist
    .as_ref()
    .map(|p| p.join("index.html").exists())
    .unwrap_or(false);
  let _ = std::fs::create_dir_all(&particles_dir);
  let _ = std::fs::create_dir_all(&music_dir);
  let _ = std::fs::create_dir_all(&sfx_dir);
  let _ = std::fs::create_dir_all(&logos_dir);
  let _ = std::fs::create_dir_all(&videos_dir);
  let _ = std::fs::create_dir_all(&backgrounds_dir);

  let api = Router::new()
    .route("/api/health", get(|| async { "ok" }))
    .route("/api/server", get(api_server))
    .route("/api/settings", get(api_get_settings).post(api_post_settings))
    .route("/api/settings/patch", post(api_patch_settings))
    .route("/api/kick/chatroom", get(api_kick_chatroom))
    .route("/api/kick/oauth/authorize", post(api_kick_oauth_authorize))
    .route("/api/kick/prepare", post(api_kick_prepare))
    .route("/api/kick/oauth/callback", get(api_kick_oauth_callback))
    .route("/api/kick/oauth/status", get(api_kick_oauth_status))
    .route("/api/kick/oauth/disconnect", post(api_kick_oauth_disconnect))
    .route("/api/kick/hub", get(api_kick_hub))
    .route("/api/auth/notify-success", post(api_auth_notify_success))
    .route("/api/kick/chat/send", post(api_kick_chat_send))
    .route("/api/kick/moderation", post(api_kick_moderation))
    .route("/api/chat/clear-platforms", post(api_clear_platform_chats))
    .route("/api/kick/auth-signal", get(api_kick_auth_signal))
    .route("/api/youtube/live", get(api_youtube_live))
    .route("/api/youtube/chat", get(api_youtube_chat))
    .route("/api/youtube/endscreen", get(api_youtube_endscreen))
    .route("/api/twitch/badges", get(api_twitch_badges))
    .route("/api/particles", get(api_particles).post(api_particle_upload))
    .route("/api/particles/delete", post(api_particle_delete))
    .route("/api/music", get(api_music).post(api_music_upload))
    .route("/api/music/delete", post(api_music_delete))
    .route("/api/sfx", get(api_sfx).post(api_sfx_upload))
    .route("/api/sfx/delete", post(api_sfx_delete))
    .route("/api/logos", get(api_logos))
    .route("/api/logos/delete", post(api_logos_delete))
    .route("/api/videos", get(api_videos))
    .route("/api/videos/delete", post(api_videos_delete))
    .route(
      "/api/videos/download",
      get(api_video_download_status).post(api_video_download),
    )
    .route("/api/videos/download/cancel", post(api_video_download_cancel))
    .route("/api/backgrounds", get(api_backgrounds))
    .route("/api/backgrounds/delete", post(api_backgrounds_delete))
    .route("/api/library/import", post(api_library_import))
    // Gömülü müzik eklentisi — tüm ekranların paylaştığı tek "şu an çalan"
    .route("/api/now-playing", get(api_now_playing).post(api_set_now_playing))
    .route("/api/songrequest/queue", get(api_istek_sirasi))
    .route("/api/player/status", get(api_player_status))
    .route("/api/player/sozler", get(api_player_sozler))
    .route("/api/player/source", post(api_player_source))
    .route("/api/player/tercih", post(api_player_tercih))
    .route("/api/player/command", post(api_player_command))
    .route("/api/player/request", post(api_player_request))
    .route("/api/bot/giden", post(api_bot_giden))
    .route("/api/player/spotify/authorize", post(api_spotify_authorize))
    .route("/api/player/spotify/callback", get(api_spotify_callback))
    .route("/api/player/spotify/disconnect", post(api_spotify_disconnect))
    .route("/api/player/spotify/recently-played", get(api_spotify_recently_played))
    .route("/api/player/spotify/yayin-listesi", post(api_spotify_yayin_listesi))
    .route("/api/open-external", post(api_open_external))
    .route("/api/automation/claim", post(api_automation_claim))
    .route("/api/automation/release", post(api_automation_release))
    .route("/api/player/spotify/manual", post(api_spotify_manual))
    .route("/api/player/spotify/token", post(api_spotify_token))
    // Bot modülü 1 — profil / dashboard / oturum
    .route("/api/bot/dashboard", get(api_bot_dashboard))
    .route("/api/bot/sessions", get(api_bot_sessions).post(api_bot_session_start))
    .route("/api/bot/sessions/end", post(api_bot_session_end))
    .route("/api/bot/sessions/report", get(api_bot_session_report))
    .route("/api/bot/markers", get(api_bot_markers))
    .route("/api/klip/kare", get(api_klip_kare))
    .route("/api/klip/dikey", post(api_klip_dikey))
    .route("/api/altyazi", post(api_altyazi))
    .route("/api/bot/metrics", post(api_bot_metrics))
    .route("/api/bot/events", get(api_bot_events).post(api_bot_event_log))
    // Spotify kodunun düşebileceği kısa yollar. Kullanıcı Dashboard'a
    // hangisini kaydettiyse o kullanılabilsin diye birden çok seçenek var.
    .route("/", get(spotify_code_catch_all))
    .route("/callback", get(spotify_code_catch_all))
    .route("/api/overlay-config", get(api_get_overlay_config).post(api_put_overlay_config))
    .route("/api/player/ytmd/session", post(api_ytmd_session))
    .route("/media/file", get(api_media_file))
    .route("/ws/overlay-sync", get(ws_handler))
    // Parçacıklar /assets/particles — dist JS/CSS /assets/*.js ile çakışmasın
    .nest_service("/assets/particles", ServeDir::new(&particles_dir))
    .nest_service("/assets/music", ServeDir::new(&music_dir))
    .nest_service("/assets/sfx", ServeDir::new(&sfx_dir))
    .nest_service("/assets/logos", ServeDir::new(&logos_dir))
    .nest_service("/assets/videos", ServeDir::new(&videos_dir))
    .nest_service("/assets/backgrounds", ServeDir::new(&backgrounds_dir));

  // Bot modülü 2–8
  let mut api = api
    .merge(bot_api::router())
    .merge(eski_widgetlar::router())
    .merge(runtime_api::router())
    .merge(multistream_api::router())
    .merge(discord_api::router())
    .merge(actions_api::router())
    .merge(gecis_api::router())
    .merge(eslestirme::router())
    .merge(asistan_api::router())
    .merge(destek_api::router())
    .merge(guncelleme_api::router())
    .merge(yedek_api::router())
    .merge(obs_studio_api::router())
    .merge(yayin_bilgisi_api::router());

  if let Some(res_dist) = resonance_dist {
    let resonance_index = res_dist.join("index.html");
    if resonance_index.exists() {
      // Kullanıcıların Spotify Dashboard'a çoğunlukla kaydettiği adres bu
      // (.env.example de bunu gösteriyor). Kod buraya düşerse token değişimini
      // sunucuda tamamla; kod yoksa isteği Resonance arayüzüne bırak.
      let idx = resonance_index.clone();
      api = api
        .route(
          "/resonance/callback",
          get(move |state, query| spotify_callback_or_app(idx.clone(), state, query)),
        )
        .nest_service(
          "/resonance",
          ServeDir::new(res_dist).fallback(ServeFile::new(resonance_index)),
        )
        .layer(SetResponseHeaderLayer::overriding(
          header::CACHE_CONTROL,
          HeaderValue::from_static("no-store, max-age=0"),
        ));
    }
  }

  let bind_host = auth::resolve_bind_host(&state);
  let state_arc = Arc::new(state);
  let api = api.with_state(state_arc.clone());

  let app = if has_dist {
    // /starting → index.html; istemci HashRouter'a yönlendirir
    let index_path = index.clone();
    let spa = Router::new()
      .route("/starting", get({ let p = index_path.clone(); move || serve_spa_file(p.clone()) }))
      .route("/ending", get({ let p = index_path.clone(); move || serve_spa_file(p.clone()) }))
      .route("/brb", get({ let p = index_path.clone(); move || serve_spa_file(p.clone()) }))
      .route("/chat", get({ let p = index_path.clone(); move || serve_spa_file(p.clone()) }))
      .route("/panel", get({ let p = index_path.clone(); move || serve_spa_file(p.clone()) }))
      .route("/remote", get({ let p = index_path.clone(); move || serve_spa_file(p.clone()) }))
      .route("/remote/login", get({ let p = index_path.clone(); move || serve_spa_file(p.clone()) }));
    api
      .merge(spa)
      .fallback_service(ServeDir::new(&dist).fallback(ServeFile::new(&index)))
      .layer(axum::middleware::from_fn(onbellek_basligi))
      .layer(cors)
  } else {
    api.fallback(get(dev_vite_proxy)).layer(cors)
  };

  // LAN/WAN: Bearer; loopback (Tauri webview) serbest
  let app = app.layer(axum::middleware::from_fn_with_state(
    state_arc.clone(),
    auth::require_bearer_outside_loopback,
  ));
  // En dış katman: yabancı Host (DNS yeniden bağlama) ve yabancı kökenden
  // yazma / WebSocket istekleri hiçbir işleyiciye ulaşmasın.
  let app = app.layer(axum::middleware::from_fn(local_guard::guard));

  let addr = SocketAddr::from((bind_host, port));
  let listener = tokio::net::TcpListener::bind(addr).await?;
  let lan = bind_host == [0, 0, 0, 0];
  studio_log!(
    "Overlay HTTP server → http://127.0.0.1:{port} bind={} (dist={has_dist}, resonance={has_resonance})",
    if lan { "0.0.0.0 (LAN/uzak)" } else { "127.0.0.1" }
  );
  if lan {
    studio_log!(
      "Uzak panel: http://<bu-pc-ip>:{port}/remote/login · Bearer token zorunlu (loopback hariç)"
    );
  }
  if has_resonance {
    studio_log!("Resonance → http://127.0.0.1:{port}/resonance/");
  }
  axum::serve(
    listener,
    app.into_make_service_with_connect_info::<SocketAddr>(),
  )
  .await?;
  Ok(())
}

async fn serve_spa_file(path: PathBuf) -> Response {
  match tokio::fs::read(&path).await {
    Ok(bytes) => Response::builder()
      .status(StatusCode::OK)
      .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
      // OBS'in gömülü tarayıcısı "no-cache"i revalidasyon sayıp eski kopyayı
      // sunabiliyor; uygulama güncellendiğinde kaynak eski koda takılı kalıyordu.
      .header(header::CACHE_CONTROL, "no-store, max-age=0")
      .header(header::PRAGMA, "no-cache")
      .body(Body::from(bytes))
      .unwrap_or_else(|_| Response::new(Body::empty())),
    Err(_) => Response::builder()
      .status(StatusCode::NOT_FOUND)
      .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
      .body(Body::from("index.html bulunamadı — portable klasöründe dist/ olmalı"))
      .unwrap_or_else(|_| Response::new(Body::empty())),
  }
}

async fn dev_vite_proxy(uri: axum::http::Uri) -> Response {
  let path = uri.path_and_query().map(|p| p.as_str()).unwrap_or("/");
  let target = format!("http://127.0.0.1:1420{path}");
  match reqwest::get(&target).await {
    Ok(res) => {
      let status = StatusCode::from_u16(res.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
      let mut builder = Response::builder().status(status);
      if let Some(ct) = res.headers().get(header::CONTENT_TYPE) {
        builder = builder.header(header::CONTENT_TYPE, ct);
      }
      let bytes = res.bytes().await.unwrap_or_default();
      builder.body(Body::from(bytes)).unwrap_or_else(|_| Response::new(Body::empty()))
    }
    Err(_) => Response::builder()
      .status(StatusCode::SERVICE_UNAVAILABLE)
      .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
      .body(Body::from(
        "Vite dev sunucusu (1420) kapalı. `npm run tauri:dev` ile başlatın.",
      ))
      .unwrap_or_else(|_| Response::new(Body::empty())),
  }
}

async fn api_server(State(state): State<Arc<AppState>>) -> Json<Value> {
  let overlays = state.overlay_urls();
  let bind = auth::resolve_bind_host(&state);
  let lan = bind == [0, 0, 0, 0];
  Json(serde_json::json!({
    "port": state.port,
    "baseUrl": state.base_url(),
    "bindLan": lan,
    "remoteLoginUrl": format!("{}/remote/login", state.base_url()),
    "overlays": overlays,
    "resonance": {
      "app": overlays.resonance,
      "overlay": overlays.resonance_overlay,
    }
  }))
}

#[derive(Deserialize)]
struct ScreenQuery {
  screen: Option<String>,
}

async fn api_get_settings(
  State(state): State<Arc<AppState>>,
  Query(q): Query<ScreenQuery>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let screen = q.screen.unwrap_or_else(|| "starting".into());
  let kind = ScreenKind::parse(&screen).map_err(|e| (StatusCode::BAD_REQUEST, e))?;
  Ok(Json(state.settings.read().get(kind).clone()))
}

async fn api_post_settings(
  State(state): State<Arc<AppState>>,
  Query(q): Query<ScreenQuery>,
  Json(body): Json<Value>,
) -> Result<StatusCode, (StatusCode, String)> {
  let screen = q.screen.unwrap_or_else(|| "starting".into());
  let kind = ScreenKind::parse(&screen).map_err(|e| (StatusCode::BAD_REQUEST, e))?;
  {
    let mut s = state.settings.write();
    s.set(kind, body.clone());
    s.save_one(&state.data_dir, kind)
      .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  }
  state.broadcast_json(&serde_json::json!({
    "type": "settings",
    "screen": screen,
    "data": body,
  }));
  Ok(StatusCode::OK)
}

async fn api_patch_settings(
  State(state): State<Arc<AppState>>,
  Query(q): Query<ScreenQuery>,
  Json(mut patch): Json<Value>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let screen = q.screen.unwrap_or_else(|| "starting".into());
  let kind = ScreenKind::parse(&screen).map_err(|e| (StatusCode::BAD_REQUEST, e))?;
  let merged = {
    let mut s = state.settings.write();
    let current = s.get(kind).clone();
    crate::settings::deste_kilidi(&current, &mut patch)
      .map_err(|rev| (StatusCode::CONFLICT, format!("Deste başka bir pencerede değişti (sürüm {rev}); yeniden yükleyin")))?;
    let merged = crate::settings::deep_merge(current, patch);
    s.set(kind, merged.clone());
    // Disk yazımı başarısızsa ayar yalnızca bellekte kalır ve yeniden
    // açılışta kaybolur; en azından iz bırakalım.
    if let Err(e) = s.save_one(&state.data_dir, kind) {
      studio_warn!("ayar diske yazılamadı ({screen}): {e}");
    }
    merged
  };
  state.broadcast_json(&serde_json::json!({
    "type": "settings",
    "screen": screen,
    "data": merged,
  }));
  Ok(Json(merged))
}

#[cfg(test)]
mod tests {
  use super::*;

  const BASE: &str = "http://127.0.0.1:8843";

  #[test]
  fn active_key_is_a_valid_id() {
    // Yansıtma çalışsın diye ayrılmış anahtar kural dışı olmamalı
    assert!(is_valid_overlay_id(ACTIVE_OVERLAY_ID));
  }

  #[test]
  fn overlay_ids_are_restricted() {
    assert!(is_valid_overlay_id("varsayilan"));
    assert!(is_valid_overlay_id("profile-1_ABC"));
    assert!(!is_valid_overlay_id(""));
    assert!(!is_valid_overlay_id("../../etc/passwd"));
    assert!(!is_valid_overlay_id("bosluk var"));
    assert!(!is_valid_overlay_id(&"x".repeat(65)));
  }

  #[test]
  fn manual_code_accepts_bare_code_and_full_url() {
    let code = "AQD9v_longenough_authorization_code_x";
    assert_eq!(extract_spotify_code(code).unwrap(), code);
    assert_eq!(extract_spotify_code(&format!("  {code}  ")).unwrap(), code);
    assert_eq!(
      extract_spotify_code(&format!(
        "http://127.0.0.1:8843/resonance/callback?code={code}&state=abc"
      ))
      .unwrap(),
      code
    );
    // Sondaki parametre yoksa da çalışmalı
    assert_eq!(
      extract_spotify_code(&format!("http://127.0.0.1:8843/resonance/callback?code={code}"))
        .unwrap(),
      code
    );
  }

  #[test]
  fn manual_code_reports_useful_errors() {
    assert!(extract_spotify_code("").is_err());
    assert!(extract_spotify_code("   ").is_err());
    // Çok kısa / boşluklu metin kod değildir
    assert!(extract_spotify_code("kisa").is_err());
    assert!(extract_spotify_code("iki kelime uzun uzun uzun uzun").is_err());
    // Spotify'ın hata dönüşü aynen aktarılmalı
    let err = extract_spotify_code(
      "http://127.0.0.1:8843/resonance/callback?error=access_denied&state=x",
    )
    .unwrap_err();
    assert!(err.contains("access_denied"), "{err}");
    // code= var ama boş
    assert!(extract_spotify_code("http://x/cb?code=&state=1").is_err());
  }

  #[test]
  fn external_open_is_limited_to_oauth_pages() {
    assert!(is_allowed_external(
      "https://accounts.spotify.com/authorize?client_id=x&response_type=code"
    ));
    assert!(is_allowed_external("https://developer.spotify.com/dashboard"));
    assert!(is_allowed_external(
      "https://id.twitch.tv/oauth2/authorize?client_id=x"
    ));
    assert!(is_allowed_external(
      "https://accounts.google.com/o/oauth2/v2/auth?client_id=x"
    ));
    assert!(is_allowed_external(
      "https://id.kick.com/oauth/authorize?client_id=x"
    ));
    for bad in [
      "https://evil.example/",
      "http://accounts.spotify.com/authorize",
      "https://accounts.spotify.com.evil.example/",
      "https://developer.spotify.com.evil.example/",
      "file:///C:/Windows/System32/calc.exe",
      "",
    ] {
      assert!(!is_allowed_external(bad), "gecmemeliydi: {bad}");
    }
  }

  #[test]
  fn redirect_defaults_to_documented_path() {
    // .env.example bu adresi gösteriyor; kullanıcıların Dashboard'a kaydettiği de bu.
    assert_eq!(
      resolve_spotify_redirect(BASE, None),
      "http://127.0.0.1:8843/resonance/callback"
    );
    assert_eq!(resolve_spotify_redirect(BASE, Some("   ")), resolve_spotify_redirect(BASE, None));
  }

  #[test]
  fn both_registered_paths_are_accepted() {
    for path in SPOTIFY_CALLBACK_PATHS {
      let want = format!("{BASE}{path}");
      assert_eq!(resolve_spotify_redirect(BASE, Some(&want)), want, "{path} kabul edilmeli");
    }
  }

  #[test]
  fn foreign_redirect_is_never_used() {
    // Saldırgan kontrolündeki adrese yetkilendirme kodu göndermeyelim
    for bad in [
      "https://evil.example/steal",
      "http://127.0.0.1:9999/resonance/callback",
      "http://127.0.0.1:8843/../etc",
      "http://127.0.0.1:8843evil.example/x",
    ] {
      let out = resolve_spotify_redirect(BASE, Some(bad));
      assert_ne!(out, bad, "izinsiz adres kullanildi: {bad}");
      assert!(out.starts_with(BASE), "{out}");
    }
  }

  #[test]
  fn every_offered_path_is_accepted() {
    // Sunulan her yol gerçekten karşılanıyor olmalı
    for path in SPOTIFY_CALLBACK_PATHS {
      let want = format!("{BASE}{path}");
      assert_eq!(resolve_spotify_redirect(BASE, Some(&want)), want, "{path}");
    }
  }

  #[test]
  fn unhandled_path_falls_back() {
    // Karşılamadığımız bir yol kabul edilmemeli; kod kaybolurdu
    let out = resolve_spotify_redirect(BASE, Some("http://127.0.0.1:8843/rastgele/yol"));
    assert_eq!(out, format!("{BASE}/resonance/callback"));
  }

  #[test]
  fn redirect_follows_the_actual_port() {
    let base = "http://127.0.0.1:9000";
    assert_eq!(
      resolve_spotify_redirect(base, None),
      "http://127.0.0.1:9000/resonance/callback"
    );
    // Başka porttaki aynı yol reddedilmeli
    assert_ne!(
      resolve_spotify_redirect(base, Some("http://127.0.0.1:8843/resonance/callback")),
      "http://127.0.0.1:8843/resonance/callback"
    );
  }
}

/// Vite'in içeriğe göre adlandırdığı dosya mı (`/assets/ad-XXXXXXXX.js`). Kullanıcı klasörleri (`/assets/music/…`) değil.
fn degismez_varlik_mi(yol: &str) -> bool {
  let Some(ad) = yol.strip_prefix("/assets/") else { return false };
  let Some((govde, _)) = ad.rsplit_once('.') else { return false };
  let b = govde.as_bytes();
  !ad.contains('/')
    && b.len() > 9
    && b[b.len() - 9] == b'-'
    && b[b.len() - 8..].iter().all(|c| c.is_ascii_alphanumeric() || *c == b'_' || *c == b'-')
}

/// OBS tarayıcı kaynağı güncellemeden sonra eski JS'i çalıştırabiliyordu: index.html ve API her istekte taze.
/// Paket dosyalarının adı içerik değişince değişir; onlar önbellekten gelir, overlay ve panel daha hızlı açılır.
async fn onbellek_basligi(req: axum::extract::Request, next: axum::middleware::Next) -> Response {
  let degismez = degismez_varlik_mi(req.uri().path());
  let mut r = next.run(req).await;
  // Olmayan dosyaya index.html döner: o önbelleğe girmesin
  let html = r.headers().get(header::CONTENT_TYPE).is_some_and(|v| v.as_bytes().starts_with(b"text/html"));
  let deger = if degismez && r.status().is_success() && !html {
    "public, max-age=31536000, immutable"
  } else {
    "no-store, max-age=0"
  };
  r.headers_mut().insert(header::CACHE_CONTROL, HeaderValue::from_static(deger));
  r
}

#[cfg(test)]
mod onbellek_testleri {
  use super::{degismez_varlik_mi, onbellek_basligi};
  use axum::{http::{header, Request}, response::IntoResponse, routing::get, Router};
  use tower::ServiceExt;

  async fn onbellek_degeri(icerik_turu: &'static str, yol: &str) -> String {
    let app = Router::new()
      .fallback(get(move || async move { ([(header::CONTENT_TYPE, icerik_turu)], "x").into_response() }))
      .layer(axum::middleware::from_fn(onbellek_basligi));
    let r = app.oneshot(Request::get(yol).body(axum::body::Body::empty()).unwrap()).await.unwrap();
    r.headers()[header::CACHE_CONTROL].to_str().unwrap().to_string()
  }

  #[tokio::test]
  async fn eksik_paket_dosyasi_yerine_gelen_html_onbellege_girmez() {
    let yol = "/assets/index-BgLx5yHd.js";
    assert_eq!(onbellek_degeri("text/html; charset=utf-8", yol).await, "no-store, max-age=0");
    assert_eq!(onbellek_degeri("text/javascript", yol).await, "public, max-age=31536000, immutable");
    assert_eq!(onbellek_degeri("application/json", "/api/durum").await, "no-store, max-age=0");
  }

  #[test]
  fn yalniz_icerige_gore_adlanan_paket_dosyalari_degismez() {
    assert!(degismez_varlik_mi("/assets/index-BgLx5yHd.js"));
    assert!(degismez_varlik_mi("/assets/kickAuth-DMT_V--2.js"));
    assert!(degismez_varlik_mi("/assets/open-sans-latin-400-normal-Bk63H6sG.woff2"));
    assert!(!degismez_varlik_mi("/index.html"));
    assert!(!degismez_varlik_mi("/assets/logo.png"));
    assert!(!degismez_varlik_mi("/assets/music/sarki-abcdefgh.mp3"));
    assert!(!degismez_varlik_mi("/widgets/index-BgLx5yHd.js"));
  }
}

#[cfg(test)]
mod medya_lan_testleri {
  use super::medya_kutuphanede;

  #[test]
  fn yalniz_kutuphane_icindeki_dosya_gecer() {
    let kok = std::env::temp_dir().join(format!("medya-lan-{}", std::process::id()));
    let assets = kok.join("assets").join("sfx");
    std::fs::create_dir_all(&assets).unwrap();
    let ic = assets.join("a.mp3");
    let dis = kok.join("ozel.mp3");
    std::fs::write(&ic, b"x").unwrap();
    std::fs::write(&dis, b"x").unwrap();
    let kokler = [kok.join("assets")];
    assert!(medya_kutuphanede(&kokler, &ic));
    assert!(!medya_kutuphanede(&kokler, &dis), "kütüphane dışı dosya LAN'a açılmaz");
    let _ = std::fs::remove_dir_all(&kok);
  }
}
