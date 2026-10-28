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
pub(crate) use actions_api::kisayol_eylemi;
mod auth;
mod botaxt;
mod control_plane;
mod destek_api;
mod dosya_adi;
mod local_guard;
pub mod guncelleme_api;
pub mod yedek_api;
mod yayin_bilgisi_api;
mod multistream_api;
mod obs_studio_api;
mod otomasyon_kilidi;
pub mod runtime_api;

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
      yya_warn!("DB init uyarısı: {e:#}");
    }
    yya_log!(
      "SQLite → {}",
      crate::db::db_file(&state.data_dir).display()
    );
    match crate::db::botaxt_api::seed_alerts_if_empty(&state.db, &settings_snap).await {
      Ok(n) if n > 0 => yya_log!("Botaxt alerts seed: {n}"),
      Err(e) => yya_warn!("alerts seed uyarısı: {e:#}"),
      _ => {}
    }
    match crate::db::botaxt_api::seed_widgets_if_empty(&state.db).await {
      Ok(n) if n > 0 => yya_log!("Botaxt widgets seed: {n}"),
      Err(e) => yya_warn!("widgets seed uyarısı: {e:#}"),
      _ => {}
    }
  }

  let port = state.port;
  let root = state.root.clone();
  let dist = root.join("dist");
  let index = dist.join("index.html");
  let has_dist = index.exists();

  // Yalnız yerel kökenler yanıtı okuyabilir (bkz. local_guard). Eskiden
  // `allow_origin(Any)`: ziyaret edilen her site ayarları/dosyaları okuyabiliyordu.
  let cors = CorsLayer::new()
    .allow_origin(AllowOrigin::predicate(local_guard::cors_origin_ok))
    .allow_methods(Any)
    .allow_headers(Any);

  let particles_dir = root.join("assets").join("particles");
  let music_dir = root.join("assets").join("music");
  let sfx_dir = root.join("assets").join("sfx");
  let logos_dir = root.join("assets").join("logos");
  let videos_dir = root.join("assets").join("videos");
  let backgrounds_dir = root.join("assets").join("backgrounds");
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
    .route("/api/kick/bot-session/status", get(api_kick_bot_session_status))
    .route("/api/kick/bot-session/disconnect", post(api_kick_bot_session_disconnect))
    .route("/api/kick/bot-session/ingest", post(api_kick_bot_session_ingest))
    .route("/api/kick/bot-session/refresh-xsrf", post(api_kick_bot_session_refresh_xsrf))
    .route("/api/kick/bot-session/test", post(api_kick_bot_session_test))
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
    .route("/api/player/status", get(api_player_status))
    .route("/api/player/source", post(api_player_source))
    .route("/api/player/command", post(api_player_command))
    .route("/api/player/request", post(api_player_request))
    .route("/api/player/spotify/authorize", post(api_spotify_authorize))
    .route("/api/player/spotify/callback", get(api_spotify_callback))
    .route("/api/player/spotify/disconnect", post(api_spotify_disconnect))
    .route("/api/player/spotify/recently-played", get(api_spotify_recently_played))
    .route("/api/open-external", post(api_open_external))
    .route("/api/automation/claim", post(api_automation_claim))
    .route("/api/automation/release", post(api_automation_release))
    .route("/api/player/spotify/manual", post(api_spotify_manual))
    .route("/api/player/spotify/token", post(api_spotify_token))
    // Botaxt Modül 1 — profil / dashboard / oturum (+ eski /api/botrix alias)
    .route("/api/botaxt/dashboard", get(api_botaxt_dashboard))
    .route("/api/botaxt/sessions", get(api_botaxt_sessions).post(api_botaxt_session_start))
    .route("/api/botaxt/sessions/end", post(api_botaxt_session_end))
    .route("/api/botaxt/metrics", post(api_botaxt_metrics))
    .route("/api/botaxt/events", get(api_botaxt_events).post(api_botaxt_event_log))
    .route("/api/botrix/dashboard", get(api_botaxt_dashboard))
    .route("/api/botrix/sessions", get(api_botaxt_sessions).post(api_botaxt_session_start))
    .route("/api/botrix/sessions/end", post(api_botaxt_session_end))
    .route("/api/botrix/metrics", post(api_botaxt_metrics))
    .route("/api/botrix/events", get(api_botaxt_events).post(api_botaxt_event_log))
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

  // Botaxt Modül 2–8
  let mut api = api
    .merge(botaxt::router())
    .merge(runtime_api::router())
    .merge(multistream_api::router())
    .merge(actions_api::router())
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
      // Yerel sunucuda önbellek kazancı yok ama OBS'te eski paket riski var:
      // tarayıcı kaynağı, uygulama güncellendikten sonra bile eski JS'i
      // çalıştırabiliyordu. Her istekte taze dosya versin.
      .layer(SetResponseHeaderLayer::overriding(
        header::CACHE_CONTROL,
        HeaderValue::from_static("no-store, max-age=0"),
      ))
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
  yya_log!(
    "Overlay HTTP server → http://127.0.0.1:{port} bind={} (dist={has_dist}, resonance={has_resonance})",
    if lan { "0.0.0.0 (LAN/uzak)" } else { "127.0.0.1" }
  );
  if lan {
    yya_log!(
      "Uzak panel: http://<bu-pc-ip>:{port}/remote/login · Bearer token zorunlu (loopback hariç)"
    );
  }
  if has_resonance {
    yya_log!("Resonance → http://127.0.0.1:{port}/resonance/");
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
  Json(patch): Json<Value>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let screen = q.screen.unwrap_or_else(|| "starting".into());
  let kind = ScreenKind::parse(&screen).map_err(|e| (StatusCode::BAD_REQUEST, e))?;
  let merged = {
    let mut s = state.settings.write();
    let current = s.get(kind).clone();
    let merged = crate::settings::deep_merge(current, patch);
    s.set(kind, merged.clone());
    // Disk yazımı başarısızsa ayar yalnızca bellekte kalır ve yeniden
    // açılışta kaybolur; en azından iz bırakalım.
    if let Err(e) = s.save_one(&state.data_dir, kind) {
      yya_warn!("ayar diske yazılamadı ({screen}): {e}");
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

#[derive(Deserialize)]
struct KickQuery {
  slug: String,
}

async fn api_kick_chatroom(
  Query(q): Query<KickQuery>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::kick::fetch_chatroom(&q.slug)
    .await
    .map(Json)
    .map_err(|e| (StatusCode::BAD_GATEWAY, e.to_string()))
}

#[derive(Deserialize)]
struct KickOauthAuthorizeBody {
  #[serde(default, alias = "clientId")]
  client_id: String,
  #[serde(default, alias = "clientSecret")]
  client_secret: Option<String>,
  #[serde(default, alias = "broadcasterSlug")]
  broadcaster_slug: Option<String>,
  #[serde(default)]
  redirect_uri: Option<String>,
}

async fn api_kick_oauth_authorize(
  State(state): State<Arc<AppState>>,
  Json(body): Json<KickOauthAuthorizeBody>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let base = state.base_url();
  let redirect = body
    .redirect_uri
    .as_deref()
    .map(str::trim)
    .filter(|s| !s.is_empty())
    .map(|s| s.to_string())
    .unwrap_or_else(|| format!("{base}/api/kick/oauth/callback"));
  let slug = body.broadcaster_slug.unwrap_or_default();
  let stored_id = state
    .kick_auth
    .status()
    .get("clientId")
    .and_then(|v| v.as_str())
    .unwrap_or("")
    .to_string();
  let client_id = if body.client_id.trim().is_empty() {
    stored_id
  } else {
    body.client_id.clone()
  };
  let secret = body.client_secret.as_deref().unwrap_or("");
  // Tarayıcı açılmadan önce ID+Secret doğrula — invalid_client erken yakalanır
  state
    .kick_auth
    .validate_client_credentials(&client_id, secret)
    .await
    .map_err(|e| (StatusCode::UNAUTHORIZED, e.to_string()))?;
  let url = state
    .kick_auth
    .authorize_url(
      &client_id,
      secret,
      &redirect,
      &slug,
    )
    .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
  Ok(Json(serde_json::json!({
    "url": url,
    "redirectUri": redirect,
    "hint": "Developer Client ID + Client Secret zorunlu. Redirect URI tam olarak bu adres olmalı.",
  })))
}

async fn api_kick_prepare(
  State(state): State<Arc<AppState>>,
  Json(body): Json<KickOauthAuthorizeBody>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let stored_id = state
    .kick_auth
    .status()
    .get("clientId")
    .and_then(|v| v.as_str())
    .unwrap_or("")
    .to_string();
  let client_id = if body.client_id.trim().is_empty() {
    stored_id
  } else {
    body.client_id.clone()
  };
  let secret = body.client_secret.as_deref().unwrap_or("");
  let slug = body.broadcaster_slug.unwrap_or_default();
  let status = state
    .kick_auth
    .prepare(&client_id, secret, &slug)
    .await
    .map_err(|e| (StatusCode::UNAUTHORIZED, e.to_string()))?;
  let listen_slug = status
    .get("broadcasterSlug")
    .and_then(|v| v.as_str())
    .filter(|s| !s.is_empty())
    .map(|s| s.to_string())
    .or_else(|| {
      status
        .get("username")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
    })
    .filter(|s| !s.is_empty())
    .or_else(|| {
      let s = slug.trim();
      if s.is_empty() {
        None
      } else {
        Some(s.to_string())
      }
    });
  if let Some(slug_c) = listen_slug {
    let st = state.clone();
    tokio::spawn(async move {
      match st.kick_chat.connect(st.as_ref().clone(), &slug_c).await {
        Ok(_) => yya_warn!("[kick-api] prepare sonrası sohbet dinleme: {slug_c}"),
        Err(e) => yya_warn!("[kick-api] prepare sohbet: {e:#}"),
      }
    });
  }
  Ok(Json(status))
}

async fn api_kick_oauth_callback(
  State(state): State<Arc<AppState>>,
  Query(q): Query<CallbackQuery>,
) -> Response {
  if let Some(err) = q.error {
    return kick_callback_page(&format!("Kick yetkilendirmeyi reddetti: {err}"), false);
  }
  let Some(code) = q.code else {
    return kick_callback_page("Kick’ten kod gelmedi.", false);
  };
  match state
    .kick_auth
    .exchange_code(&code, q.state.as_deref())
    .await
  {
    Ok(name) => {
      let who = if name.is_empty() {
        String::from("Kick hesabınız")
      } else {
        name.clone()
      };
      // OAuth sonrası: kanal slug ile Pusher sohbet dinlemeyi başlat
      let slug = {
        let st = state.kick_auth.status();
        st.get("broadcasterSlug")
          .and_then(|v| v.as_str())
          .filter(|s| !s.is_empty())
          .map(|s| s.to_string())
          .or_else(|| {
            st.get("username")
              .and_then(|v| v.as_str())
              .filter(|s| !s.is_empty())
              .map(|s| s.to_string())
          })
          .unwrap_or_default()
      };
      if !slug.is_empty() {
        let st = state.clone();
        let slug_c = slug.clone();
        tokio::spawn(async move {
          match st.kick_chat.connect(st.as_ref().clone(), &slug_c).await {
            Ok(_) => {
              yya_warn!("[kick-api] OAuth sonrası sohbet dinleme: {slug_c}");
              st.broadcast_json(&serde_json::json!({
                "type": "kick-chat-status",
                "connected": true,
                "username": slug_c,
                "t": crate::db::chrono_now(),
              }));
            }
            Err(e) => yya_warn!("[kick-api] sohbet auto-connect: {e:#}"),
          }
        });
      }
      state.broadcast_json(&serde_json::json!({
        "type": "auth_success",
        "platform": "kick",
        "username": name,
        "t": crate::db::chrono_now(),
      }));
      kick_callback_page(
        &format!("{who} bağlandı. Bu sekmeyi kapatıp uygulamaya dönebilirsiniz."),
        true,
      )
    }
    Err(e) => kick_callback_page(&e.to_string(), false),
  }
}

fn kick_callback_page(message: &str, ok: bool) -> Response {
  let accent = if ok { "#53fc18" } else { "#f87171" };
  let title = if ok { "Kick bağlandı" } else { "Kick bağlanamadı" };
  let auto_close = if ok { "true" } else { "false" };
  let escaped = message
    .replace('&', "&amp;")
    .replace('<', "&lt;")
    .replace('>', "&gt;");
  let html = format!(
    r#"<!doctype html><html lang="tr"><head><meta charset="utf-8">
<title>Kick SesBot — {title}</title>
<style>
 html,body{{height:100%;margin:0}}
 body{{display:grid;place-items:center;background:radial-gradient(120% 120% at 50% 0%,#171b26 0%,#0b0d13 60%);color:#e7eaf3;font:16px/1.6 "Segoe UI",system-ui,sans-serif}}
 .box{{max-width:30rem;padding:2.5rem;text-align:center}}
 h1{{margin:0 0 .75rem;font-size:1.5rem;color:{accent}}}
 p{{margin:0;color:#a7aec0}}
</style></head><body><div class="box"><h1>{title}</h1><p>{escaped}</p></div>
<script>if({auto_close})setTimeout(function(){{window.close()}},2500)</script>
</body></html>"#
  );
  Response::builder()
    .status(StatusCode::OK)
    .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
    .body(Body::from(html))
    .unwrap_or_else(|_| Response::new(Body::empty()))
}

/// Twitch / YouTube FE OAuth sonrası WS yayını (Kick zaten callback'te).
async fn api_auth_notify_success(
  State(state): State<Arc<AppState>>,
  Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
  let platform = body
    .get("platform")
    .and_then(|v| v.as_str())
    .unwrap_or("unknown");
  let username = body
    .get("username")
    .and_then(|v| v.as_str())
    .unwrap_or("");
  state.broadcast_json(&serde_json::json!({
    "type": "auth_success",
    "platform": platform,
    "username": username,
    "t": crate::db::chrono_now(),
  }));
  Json(serde_json::json!({ "ok": true }))
}

async fn api_kick_oauth_status(State(state): State<Arc<AppState>>) -> Json<Value> {
  let mut st = state.kick_auth.status();
  let chat = state.kick_chat.status_json();
  if let Some(obj) = st.as_object_mut() {
    obj.insert("chatListening".into(), json!(chat.get("connected").and_then(|v| v.as_bool()).unwrap_or(false)));
    obj.insert("chatroomId".into(), chat.get("chatroomId").cloned().unwrap_or(json!(null)));
    obj.insert("chatUsername".into(), chat.get("username").cloned().unwrap_or(json!("")));
  }
  Json(st)
}

async fn api_kick_hub(State(state): State<Arc<AppState>>) -> Json<Value> {
  let mut hub = state.kick_auth.hub_snapshot().await;
  let chat = state.kick_chat.status_json();
  if let Some(obj) = hub.as_object_mut() {
    obj.insert("chat".into(), chat);
    obj.insert(
      "botReady".into(),
      json!(state.kick_auth.is_connected()),
    );
  }
  Json(hub)
}

async fn api_kick_oauth_disconnect(State(state): State<Arc<AppState>>) -> Json<Value> {
  state.kick_auth.disconnect();
  Json(state.kick_auth.status())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct KickChatSendBody {
  text: String,
  #[serde(default)]
  slug: Option<String>,
}

async fn api_kick_chat_send(
  State(state): State<Arc<AppState>>,
  Json(body): Json<KickChatSendBody>,
) -> Result<Json<Value>, (StatusCode, String)> {
  // Sadece resmi Kick API (OAuth) — cookie/CF yolu kullanılmaz
  if !state.kick_auth.is_connected() {
    return Err((
      StatusCode::UNAUTHORIZED,
      "Kick API bağlı değil — Chat Bot’tan OAuth ile bağlan (Client ID + Bağlan)".into(),
    ));
  }
  state
    .kick_auth
    .send_chat(&body.text, body.slug.as_deref())
    .await
    .map(Json)
    .map_err(map_kick_chat_send_err)
}

fn map_kick_chat_send_err(e: anyhow::Error) -> (StatusCode, String) {
  let s = e.to_string();
  if crate::kick::is_kick_rate_limit(&s) {
    (StatusCode::TOO_MANY_REQUESTS, crate::kick::kick_rate_limit_user_msg().into())
  } else {
    (StatusCode::BAD_GATEWAY, s)
  }
}

async fn api_kick_bot_session_status(State(state): State<Arc<AppState>>) -> Json<Value> {
  Json(state.kick_session.status())
}

async fn api_kick_bot_session_disconnect(State(state): State<Arc<AppState>>) -> Json<Value> {
  state.kick_session.disconnect_db(&state.db).await;
  Json(state.kick_session.status())
}

/// Kick login webview top-level sinyal (mixed-content fetch yerine).
async fn api_kick_auth_signal(State(state): State<Arc<AppState>>) -> Response {
  state.broadcast_json(&serde_json::json!({
    "type": "kick-auth-signal",
    "t": chrono::Utc::now().timestamp_millis(),
  }));
  let html = r#"<!doctype html><html><body style="font-family:system-ui;background:#0b0f14;color:#e2e8f0;display:grid;place-items:center;height:100vh;margin:0">
  <div style="text-align:center"><p style="font-size:18px;font-weight:700">Kick oturumu kontrol ediliyor…</p>
  <p style="opacity:.6;font-size:13px">Bu pencereyi kapatmayın — bot paneline dönün.</p></div>
  <script>
    try {
      document.querySelectorAll('video,audio').forEach(function(el){ el.muted=true; el.pause(); });
    } catch(e) {}
    // kick.com anasayfasına dönme — canlı yayın sesi çıkmasın
    setTimeout(function(){ location.replace('about:blank'); }, 600);
  </script>
  </body></html>"#;
  Response::builder()
    .status(StatusCode::OK)
    .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
    .header(header::CACHE_CONTROL, "no-store")
    .body(Body::from(html))
    .unwrap_or_else(|_| Response::new(Body::empty()))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct KickSessionIngestBody {
  #[serde(default)]
  document_cookie: String,
  #[serde(default)]
  bearer: String,
  #[serde(default)]
  username: String,
  #[serde(default)]
  page_url: String,
}

async fn api_kick_bot_session_ingest(
  State(state): State<Arc<AppState>>,
  Json(body): Json<KickSessionIngestBody>,
) -> Result<Json<Value>, (StatusCode, String)> {
  // document.cookie parçala → pairs
  let mut pairs: Vec<(String, String)> = Vec::new();
  for part in body.document_cookie.split(';') {
    let part = part.trim();
    if let Some((n, v)) = part.split_once('=') {
      pairs.push((n.trim().to_string(), v.trim().to_string()));
    }
  }
  // Mevcut HttpOnly jar ile birleştir (cookie_header parse)
  let existing = state.kick_session.snapshot();
  if !existing.cookie_header.is_empty() {
    for part in existing.cookie_header.split(';') {
      let part = part.trim();
      if let Some((n, v)) = part.split_once('=') {
        let n = n.trim().to_string();
        if !pairs.iter().any(|(pn, _)| pn == &n) {
          pairs.push((n, v.trim().to_string()));
        }
      }
    }
  }
  let room = (*state.kick_chat.chatroom_id.read()).unwrap_or(0);
  let slug = state
    .kick_chat
    .status_json()
    .get("username")
    .and_then(|v| v.as_str())
    .unwrap_or("")
    .to_string();
  if !slug.is_empty() || room > 0 {
    state.kick_session.set_channel_meta(&slug, room);
  }
  let _ = body.page_url;
  let status = state
    .kick_session
    .ingest_cookies(
      &pairs,
      Some(&body.document_cookie),
      if body.bearer.is_empty() {
        None
      } else {
        Some(&body.bearer)
      },
      if body.username.is_empty() {
        None
      } else {
        Some(&body.username)
      },
    )
    .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

  if status.get("ready").and_then(|v| v.as_bool()).unwrap_or(false) {
    state.kick_session.clear_session_lost();
    if let Err(e) = state.kick_session.persist_to_db(&state.db).await {
      yya_warn!("[api] bot_auth kayıt: {e:#}");
    }
    state.broadcast_json(&serde_json::json!({
      "type": "kick-bot-session-ready",
      "status": status,
    }));
  }

  Ok(Json(status))
}

#[derive(Deserialize)]
struct KickSessionTestBody {
  #[serde(default = "default_test_msg")]
  text: String,
}

fn default_test_msg() -> String {
  "BotAxT bot oturumu aktif ✓".into()
}

async fn api_kick_bot_session_test(
  State(state): State<Arc<AppState>>,
  Json(body): Json<KickSessionTestBody>,
) -> Result<Json<Value>, (StatusCode, String)> {
  // Resmi Kick API
  if state.kick_auth.is_connected() {
    return state
      .kick_auth
      .send_chat(&body.text, None)
      .await
      .map(Json)
      .map_err(map_kick_chat_send_err);
  }
  Err((
    StatusCode::UNAUTHORIZED,
    "Kick API bağlı değil — OAuth ile bağlan".into(),
  ))
}

async fn api_clear_platform_chats(
  State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let epoch = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map(|d| d.as_millis() as u64)
    .unwrap_or(0);
  {
    let mut s = state.settings.write();
    let current = s.get(ScreenKind::Chat).clone();
    let merged = crate::settings::deep_merge(current, json!({ "clearEpoch": epoch }));
    s.set(ScreenKind::Chat, merged.clone());
    let _ = s.save_one(&state.data_dir, ScreenKind::Chat);
    state.broadcast_json(&json!({
      "type": "settings",
      "screen": "chat",
      "data": merged,
    }));
  }

  let kick_cmd = match state.kick_session.send_message(0, "/clear").await {
    Ok(_) => json!({ "ok": true, "via": "command" }),
    Err(send_err) => match state.kick_session.clear_chat().await {
      Ok(_) => json!({ "ok": true, "via": "api", "commandError": send_err.to_string() }),
      Err(api_err) => json!({
        "ok": false,
        "error": format!("/clear: {send_err}; api: {api_err}")
      }),
    },
  };
  Ok(Json(json!({
    "local": true,
    "kick": kick_cmd.get("ok").and_then(|v| v.as_bool()).unwrap_or(false),
    "kickError": kick_cmd.get("error").cloned(),
  })))
}

async fn api_kick_bot_session_refresh_xsrf(
  State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
  match state.kick_session.fetch_missing_xsrf().await {
    Ok(status) => {
      if status.get("ready").and_then(|v| v.as_bool()).unwrap_or(false) {
        let _ = state.kick_session.resolve_identity().await;
        if let Err(e) = state.kick_session.persist_to_db(&state.db).await {
          yya_warn!("[api] xsrf persist: {e:#}");
        }
        let status = state.kick_session.status();
        state.broadcast_json(&serde_json::json!({
          "type": "kick-bot-session-ready",
          "status": status,
        }));
        Ok(Json(status))
      } else {
        Ok(Json(status))
      }
    }
    Err(e) => Err((StatusCode::BAD_GATEWAY, e.to_string())),
  }
}

#[derive(Deserialize)]
struct YoutubeLiveQuery {
  /// @kanal, kanal URL veya video URL/ID
  q: String,
}

async fn api_youtube_live(
  Query(q): Query<YoutubeLiveQuery>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::youtube_chat::resolve_live_video(&q.q)
    .await
    .map(Json)
    .map_err(|e| (StatusCode::BAD_GATEWAY, e.to_string()))
}

#[derive(Deserialize)]
struct YoutubeChatQuery {
  video_id: String,
  continuation: Option<String>,
}

async fn api_youtube_chat(
  Query(q): Query<YoutubeChatQuery>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::youtube_chat::poll_chat(&q.video_id, q.continuation.as_deref())
    .await
    .map(Json)
    .map_err(|e| (StatusCode::BAD_GATEWAY, e.to_string()))
}

#[derive(Deserialize)]
struct YoutubeEndScreenQuery {
  video_id: String,
}

/// Arka plan videosunun bitiş ekranı gerçekten var mı, varsa hangi saniyede
/// açılıyor. Oynatıcı bunu bilmeden her videodan kör bir pay kesmek zorunda
/// kalıyor, kartı olmayan videolar da boşuna kısalıyordu.
async fn api_youtube_endscreen(
  Query(q): Query<YoutubeEndScreenQuery>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::youtube_chat::end_screen_info(q.video_id.trim())
    .await
    .map(Json)
    .map_err(|e| (StatusCode::BAD_GATEWAY, e.to_string()))
}

#[derive(Deserialize)]
struct TwitchBadgeQuery {
  /// "global" veya kanalın sayısal oda kimliği
  scope: String,
}

/// Twitch rozet kümesi vekili — `badges.twitch.tv` CORS başlığı göndermediği
/// için tarayıcı doğrudan okuyamıyordu ve rozetler yazı olarak kalıyordu.
async fn api_twitch_badges(
  Query(q): Query<TwitchBadgeQuery>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::twitch::badges(&q.scope)
    .await
    .map(Json)
    .map_err(|e| (StatusCode::BAD_GATEWAY, e.to_string()))
}

async fn api_particles(State(state): State<Arc<AppState>>) -> Json<Value> {
  Json(serde_json::json!(list_particle_files(&state.root)))
}

fn list_particle_files(root: &std::path::Path) -> Vec<String> {
  let dir = root.join("assets").join("particles");
  let mut names = Vec::new();
  if let Ok(rd) = std::fs::read_dir(&dir) {
    for ent in rd.flatten() {
      let name = ent.file_name().to_string_lossy().to_string();
      let lower = name.to_lowercase();
      if lower.ends_with(".png") || lower.ends_with(".webp") {
        names.push(name);
      }
    }
  }
  names.sort();
  names
}

async fn api_particle_upload(
  State(state): State<Arc<AppState>>,
  headers: HeaderMap,
  body: axum::body::Bytes,
) -> Result<Json<Value>, (StatusCode, String)> {
  let ctype = headers
    .get(header::CONTENT_TYPE)
    .and_then(|v| v.to_str().ok())
    .unwrap_or("image/png");
  let ext = if ctype.contains("webp") {
    "webp"
  } else if ctype.contains("jpeg") || ctype.contains("jpg") {
    "jpg"
  } else {
    "png"
  };
  let name_hdr = headers
    .get("x-filename")
    .and_then(|v| v.to_str().ok())
    .map(|s| s.to_string());
  let varsayilan = format!("particle-{}.{}", chrono::Utc::now().timestamp_millis(), ext);
  let safe = name_hdr
    .and_then(|n| dosya_adi::asset_file_name(&n))
    .unwrap_or(varsayilan);
  let safe = if safe.to_lowercase().ends_with(".png")
    || safe.to_lowercase().ends_with(".webp")
    || safe.to_lowercase().ends_with(".jpg")
    || safe.to_lowercase().ends_with(".jpeg")
  {
    safe
  } else {
    format!("{safe}.{ext}")
  };
  let dir = state.root.join("assets").join("particles");
  std::fs::create_dir_all(&dir).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  let dest = dir.join(&safe);
  std::fs::write(&dest, &body).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  Ok(Json(serde_json::json!({
    "ok": true,
    "name": safe,
    "files": list_particle_files(&state.root),
  })))
}

#[derive(Deserialize)]
struct ParticleDelete {
  name: String,
}

async fn api_particle_delete(
  State(state): State<Arc<AppState>>,
  Json(body): Json<ParticleDelete>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let Some(name) = dosya_adi::asset_file_name(&body.name) else {
    return Err((StatusCode::BAD_REQUEST, "invalid name".into()));
  };
  let path = state.root.join("assets").join("particles").join(&name);
  if path.is_file() {
    std::fs::remove_file(&path).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  }
  Ok(Json(serde_json::json!({
    "ok": true,
    "files": list_particle_files(&state.root),
  })))
}

async fn api_music(State(state): State<Arc<AppState>>) -> Json<Value> {
  Json(serde_json::json!(list_music_files(&state.root)))
}

fn list_music_files(root: &std::path::Path) -> Vec<String> {
  list_music_files_in(&root.join("assets").join("music"))
}

async fn api_music_upload(
  State(state): State<Arc<AppState>>,
  headers: HeaderMap,
  body: axum::body::Bytes,
) -> Result<Json<Value>, (StatusCode, String)> {
  let ctype = headers
    .get(header::CONTENT_TYPE)
    .and_then(|v| v.to_str().ok())
    .unwrap_or("audio/mpeg");
  let ext = if ctype.contains("wav") {
    "wav"
  } else if ctype.contains("ogg") {
    "ogg"
  } else if ctype.contains("flac") {
    "flac"
  } else if ctype.contains("mp4") || ctype.contains("m4a") || ctype.contains("aac") {
    "m4a"
  } else {
    "mp3"
  };
  let name_hdr = headers
    .get("x-filename")
    .and_then(|v| v.to_str().ok())
    .map(|s| s.to_string());
  let varsayilan = format!("music-{}.{}", chrono::Utc::now().timestamp_millis(), ext);
  let safe = name_hdr
    .and_then(|n| dosya_adi::asset_file_name(&n))
    .unwrap_or(varsayilan);
  let lower = safe.to_lowercase();
  let safe = if lower.ends_with(".mp3")
    || lower.ends_with(".wav")
    || lower.ends_with(".ogg")
    || lower.ends_with(".flac")
    || lower.ends_with(".m4a")
    || lower.ends_with(".aac")
  {
    safe
  } else {
    format!("{safe}.{ext}")
  };
  let dir = state.root.join("assets").join("music");
  std::fs::create_dir_all(&dir).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  let dest = dir.join(&safe);
  std::fs::write(&dest, &body).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  Ok(Json(serde_json::json!({
    "ok": true,
    "name": safe,
    "files": list_music_files(&state.root),
  })))
}

#[derive(Deserialize)]
struct MusicDelete {
  name: String,
}

async fn api_music_delete(
  State(state): State<Arc<AppState>>,
  Json(body): Json<MusicDelete>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let Some(name) = dosya_adi::asset_file_name(&body.name) else {
    return Err((StatusCode::BAD_REQUEST, "invalid name".into()));
  };
  let path = state.root.join("assets").join("music").join(&name);
  if path.is_file() {
    std::fs::remove_file(&path).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  }
  Ok(Json(serde_json::json!({
    "ok": true,
    "files": list_music_files(&state.root),
  })))
}

async fn api_sfx(State(state): State<Arc<AppState>>) -> Json<Value> {
  Json(serde_json::json!(list_sfx_files(&state.root)))
}

fn list_sfx_files(root: &std::path::Path) -> Vec<String> {
  list_music_files_in(&root.join("assets").join("sfx"))
}

fn list_music_files_in(dir: &std::path::Path) -> Vec<String> {
  let mut names = Vec::new();
  if let Ok(rd) = std::fs::read_dir(dir) {
    for ent in rd.flatten() {
      let name = ent.file_name().to_string_lossy().to_string();
      let lower = name.to_lowercase();
      if lower.ends_with(".mp3")
        || lower.ends_with(".wav")
        || lower.ends_with(".ogg")
        || lower.ends_with(".flac")
        || lower.ends_with(".m4a")
        || lower.ends_with(".aac")
      {
        names.push(name);
      }
    }
  }
  names.sort();
  names
}

async fn api_sfx_upload(
  State(state): State<Arc<AppState>>,
  headers: HeaderMap,
  body: axum::body::Bytes,
) -> Result<Json<Value>, (StatusCode, String)> {
  let ctype = headers
    .get(header::CONTENT_TYPE)
    .and_then(|v| v.to_str().ok())
    .unwrap_or("audio/mpeg");
  let ext = if ctype.contains("wav") {
    "wav"
  } else if ctype.contains("ogg") {
    "ogg"
  } else if ctype.contains("flac") {
    "flac"
  } else if ctype.contains("mp4") || ctype.contains("m4a") || ctype.contains("aac") {
    "m4a"
  } else {
    "mp3"
  };
  let name_hdr = headers
    .get("x-filename")
    .and_then(|v| v.to_str().ok())
    .map(|s| s.to_string());
  let varsayilan = format!("sfx-{}.{}", chrono::Utc::now().timestamp_millis(), ext);
  let safe = name_hdr
    .and_then(|n| dosya_adi::asset_file_name(&n))
    .unwrap_or(varsayilan);
  let lower = safe.to_lowercase();
  let safe = if lower.ends_with(".mp3")
    || lower.ends_with(".wav")
    || lower.ends_with(".ogg")
    || lower.ends_with(".flac")
    || lower.ends_with(".m4a")
    || lower.ends_with(".aac")
  {
    safe
  } else {
    format!("{safe}.{ext}")
  };
  let dir = state.root.join("assets").join("sfx");
  std::fs::create_dir_all(&dir).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  let dest = dir.join(&safe);
  std::fs::write(&dest, &body).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  Ok(Json(serde_json::json!({
    "ok": true,
    "name": safe,
    "files": list_sfx_files(&state.root),
  })))
}

#[derive(Deserialize)]
struct SfxDelete {
  name: String,
}

async fn api_sfx_delete(
  State(state): State<Arc<AppState>>,
  Json(body): Json<SfxDelete>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let Some(name) = dosya_adi::asset_file_name(&body.name) else {
    return Err((StatusCode::BAD_REQUEST, "invalid name".into()));
  };
  let path = state.root.join("assets").join("sfx").join(&name);
  if path.is_file() {
    std::fs::remove_file(&path).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  }
  Ok(Json(serde_json::json!({
    "ok": true,
    "files": list_sfx_files(&state.root),
  })))
}

fn list_named_files(dir: &std::path::Path, exts: &[&str]) -> Vec<String> {
  let mut names = Vec::new();
  if let Ok(rd) = std::fs::read_dir(dir) {
    for ent in rd.flatten() {
      let name = ent.file_name().to_string_lossy().to_string();
      let lower = name.to_lowercase();
      if exts.iter().any(|e| lower.ends_with(e)) {
        names.push(name);
      }
    }
  }
  names.sort();
  names
}

async fn api_logos(State(state): State<Arc<AppState>>) -> Json<Value> {
  let dir = state.root.join("assets").join("logos");
  Json(serde_json::json!(list_named_files(
    &dir,
    &[".png", ".jpg", ".jpeg", ".webp", ".gif"]
  )))
}

async fn api_videos(State(state): State<Arc<AppState>>) -> Json<Value> {
  let dir = crate::ytdl::indirme_klasoru(&state.root);
  Json(serde_json::json!(list_named_files(
    &dir,
    &[".mp4", ".webm", ".mov", ".mkv", ".m4v"]
  )))
}

async fn api_backgrounds(State(state): State<Arc<AppState>>) -> Json<Value> {
  let dir = state.root.join("assets").join("backgrounds");
  Json(serde_json::json!(list_named_files(
    &dir,
    &[".png", ".jpg", ".jpeg", ".webp", ".gif", ".apng"]
  )))
}

async fn api_backgrounds_delete(
  State(state): State<Arc<AppState>>,
  Json(body): Json<NamedDelete>,
) -> Result<Json<Value>, (StatusCode, String)> {
  delete_named_asset(&state.root, "backgrounds", &body.name)
}

#[derive(Deserialize)]
struct NamedDelete {
  name: String,
}

async fn api_logos_delete(
  State(state): State<Arc<AppState>>,
  Json(body): Json<NamedDelete>,
) -> Result<Json<Value>, (StatusCode, String)> {
  delete_named_asset(&state.root, "logos", &body.name)
}

async fn api_videos_delete(
  State(state): State<Arc<AppState>>,
  Json(body): Json<NamedDelete>,
) -> Result<Json<Value>, (StatusCode, String)> {
  delete_named_asset(&state.root, "videos", &body.name)
}

#[derive(Deserialize)]
struct VideoDownloadBody {
  url: String,
}

/// YouTube arka planını yerele indirir.
///
/// İş uzun sürdüğü için istek hemen dönüyor; ilerleme WebSocket üzerinden
/// `video-download` iletileriyle akıyor.
async fn api_video_download(
  State(state): State<Arc<AppState>>,
  Json(body): Json<VideoDownloadBody>,
) -> Result<Json<Value>, (StatusCode, String)> {
  if crate::ytdl::youtube_id(&body.url).is_none() {
    return Err((StatusCode::BAD_REQUEST, "Geçerli bir YouTube adresi değil".into()));
  }
  // Kontrol ile sahiplenme tek adımda: iki eşzamanlı istek de "başladı"
  // yanıtı alıp biri sessizce düşmesin.
  if !state.ytdl.yer_kap() {
    return Err((StatusCode::CONFLICT, "Zaten bir indirme sürüyor".into()));
  }
  let arka = state.clone();
  tokio::spawn(async move {
    // Kullanıcıya durum WebSocket'ten gidiyor; burada yalnızca iz bırakıyoruz.
    if let Err(e) = crate::ytdl::indir(arka, body.url).await {
      yya_warn!("video indirme başarısız: {e}");
    }
  });
  Ok(Json(serde_json::json!({ "ok": true })))
}

/// Panel yeniden açıldığında süren işi yakalayabilsin diye anlık durum.
async fn api_video_download_status(State(state): State<Arc<AppState>>) -> Json<Value> {
  Json(serde_json::to_value(state.ytdl.snapshot()).unwrap_or_else(|_| serde_json::json!({})))
}

async fn api_video_download_cancel(State(state): State<Arc<AppState>>) -> Json<Value> {
  state.ytdl.iptal_et();
  Json(serde_json::json!({ "ok": true }))
}

fn delete_named_asset(
  root: &std::path::Path,
  folder: &str,
  name: &str,
) -> Result<Json<Value>, (StatusCode, String)> {
  let Some(name) = dosya_adi::asset_file_name(name) else {
    return Err((StatusCode::BAD_REQUEST, "invalid name".into()));
  };
  let path = root.join("assets").join(folder).join(&name);
  if path.is_file() {
    std::fs::remove_file(&path).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  }
  let exts: &[&str] = match folder {
    "logos" => &[".png", ".jpg", ".jpeg", ".webp", ".gif"],
    "videos" => &[".mp4", ".webm", ".mov", ".mkv", ".m4v"],
    "backgrounds" => &[".png", ".jpg", ".jpeg", ".webp", ".gif", ".apng"],
    _ => &[],
  };
  Ok(Json(serde_json::json!({
    "ok": true,
    "files": list_named_files(&root.join("assets").join(folder), exts),
  })))
}

#[derive(Deserialize)]
struct LibraryImport {
  path: String,
  /// logos | videos | music | backgrounds
  kind: String,
}

async fn api_library_import(
  State(state): State<Arc<AppState>>,
  Json(body): Json<LibraryImport>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let kind = body.kind.to_lowercase();
  let folder = match kind.as_str() {
    "logos" | "logo" => "logos",
    "videos" | "video" => "videos",
    "music" | "audio" => "music",
    "sfx" | "sounds" | "soundboard" => "sfx",
    "backgrounds" | "background" | "bg" => "backgrounds",
    _ => {
      return Err((
        StatusCode::BAD_REQUEST,
        "kind must be logos|videos|music|sfx|backgrounds".into(),
      ))
    }
  };
  let src = media::sanitize_path(&body.path).map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
  if !src.is_file() {
    return Err((StatusCode::BAD_REQUEST, "file not found".into()));
  }
  let fname = src
    .file_name()
    .map(|s| s.to_string_lossy().to_string())
    .unwrap_or_else(|| format!("import-{}", chrono::Utc::now().timestamp_millis()));
  let safe = dosya_adi::asset_file_name(&fname)
    .unwrap_or_else(|| format!("import-{}", chrono::Utc::now().timestamp_millis()));
  let dir = state.root.join("assets").join(folder);
  std::fs::create_dir_all(&dir).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  let dest = dir.join(&safe);
  std::fs::copy(&src, &dest).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  Ok(Json(serde_json::json!({
    "ok": true,
    "name": safe,
    "kind": folder,
  })))
}

// ---------------------------------------------------------------------------
// Gömülü müzik eklentisi
// ---------------------------------------------------------------------------

async fn api_now_playing(State(state): State<Arc<AppState>>) -> Json<Value> {
  Json(serde_json::to_value(state.music.now_playing()).unwrap_or(Value::Null))
}

/// Resonance köprüsü buraya yazar (YouTube Music soketi tarayıcıda çalışır).
/// Gövde `null` ise "hiçbir şey çalmıyor" demektir.
async fn api_set_now_playing(
  State(state): State<Arc<AppState>>,
  Json(body): Json<Value>,
) -> Json<Value> {
  let parsed: Option<crate::music::NowPlaying> = if body.is_null() {
    None
  } else {
    serde_json::from_value(body).ok()
  };
  state.music.ingest_now(parsed, "youtube-music");
  state.broadcast_json(&serde_json::json!({
    "type": "now-playing",
    "data": state.music.now_playing(),
  }));
  Json(serde_json::json!({ "ok": true }))
}

async fn api_player_status(State(state): State<Arc<AppState>>) -> Json<Value> {
  Json(state.music.status())
}

#[derive(Deserialize)]
struct SourceBody {
  source: String,
}

async fn api_player_source(
  State(state): State<Arc<AppState>>,
  Json(body): Json<SourceBody>,
) -> Json<Value> {
  state.music.set_source(&body.source);
  Json(state.music.status())
}

#[derive(Deserialize)]
struct CommandBody {
  action: String,
  #[serde(default)]
  source: Option<String>,
}

async fn api_player_command(
  State(state): State<Arc<AppState>>,
  Json(body): Json<CommandBody>,
) -> Result<Json<Value>, (StatusCode, String)> {
  state
    .music
    .command(&body.action, body.source.as_deref())
    .await
    .map_err(|e| (StatusCode::BAD_GATEWAY, e.to_string()))?;
  // Komut sonrası durumu hemen yokla — bir sonraki 1 sn döngüyü beklemeden
  // pause/play overlay'e yansısın.
  if state.music.spotify_connected() {
    if let Ok(np) = state.music.poll_spotify().await {
      state.music.ingest_now(np, "spotify");
      state.broadcast_json(&serde_json::json!({
        "type": "now-playing",
        "data": state.music.now_playing(),
      }));
    }
  }
  Ok(Json(serde_json::json!({ "ok": true })))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RequestBody {
  #[serde(default)]
  query: String,
  #[serde(default)]
  video_id: Option<String>,
  /// true: Spotify sırasına ekle (StreamAxT !sr), false: hemen çal
  #[serde(default)]
  queue: bool,
}

async fn api_player_request(
  State(state): State<Arc<AppState>>,
  Json(body): Json<RequestBody>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let (title, artist, id) = state
    .music
    .request_track(&body.query, body.video_id.as_deref(), body.queue)
    .await
    .map_err(|e| (StatusCode::BAD_GATEWAY, e.to_string()))?;
  if state.music.spotify_connected() {
    if let Ok(np) = state.music.poll_spotify().await {
      state.music.ingest_now(np, "spotify");
      state.broadcast_json(&serde_json::json!({
        "type": "now-playing",
        "data": state.music.now_playing(),
      }));
    }
  }
  Ok(Json(serde_json::json!({
    "ok": true,
    "title": title,
    "artist": artist,
    "id": id,
  })))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthorizeBody {
  client_id: String,
  /// Kullanıcının Spotify Dashboard'a kaydettiği adres. Verilmezse
  /// `SPOTIFY_CALLBACK_PATHS[0]` kullanılır.
  #[serde(default)]
  redirect_uri: Option<String>,
}

/// Sunucunun Spotify kodunu karşılayabildiği yollar.
///
/// İkisi de aynı işi yapar; hangisi Dashboard'a kayıtlıysa o kullanılabilsin
/// diye iki seçenek var. Kayıtlı olmayan adresle gidilince Spotify
/// "redirect_uri: Not matching configuration" diyip yetkilendirmeyi kesiyordu.
pub const SPOTIFY_CALLBACK_PATHS: [&str; 4] = [
  "/resonance/callback",
  "/callback",
  "/",
  "/api/player/spotify/callback",
];

/// İstenen adresi doğrular; uymuyorsa varsayılana döner.
///
/// Yalnız **gerçekten karşıladığımız** yollar kabul edilir — kod bunlardan
/// birine düşmezse sessizce kaybolurdu. Kullanıcının Dashboard'ında hangisinin
/// kayıtlı olduğunu bilemediğimiz için birkaç seçenek sunuyoruz; kayıtlı
/// olmayan adresle gidilince Spotify "redirect_uri: Not matching
/// configuration" deyip akışı kesiyor.
fn resolve_spotify_redirect(base_url: &str, requested: Option<&str>) -> String {
  let allowed: Vec<String> = SPOTIFY_CALLBACK_PATHS
    .iter()
    .map(|p| format!("{base_url}{p}"))
    .collect();
  match requested.map(str::trim).filter(|r| !r.is_empty()) {
    Some(r) if allowed.iter().any(|a| a == r) => r.to_string(),
    _ => allowed[0].clone(),
  }
}

async fn api_spotify_authorize(
  State(state): State<Arc<AppState>>,
  Json(body): Json<AuthorizeBody>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let base = state.base_url();
  let redirect = resolve_spotify_redirect(&base, body.redirect_uri.as_deref());
  let url = state
    .music
    .spotify_authorize_url(&body.client_id, &redirect)
    .map_err(|e| {
      state.music.set_note(Some(e.to_string()));
      (StatusCode::BAD_REQUEST, e.to_string())
    })?;
  // Onay beklerken kullanıcıya hangi adresin kayıtlı olması gerektiğini hatırlat.
  state.music.set_note(Some(format!(
    "Onay bekleniyor. Spotify Dashboard > Redirect URIs listesinde tam olarak şu adres kayıtlı olmalı: {redirect}"
  )));
  Ok(Json(serde_json::json!({
    "url": url,
    "redirectUri": redirect,
    // Arayüz kullanıcıya hangi adresleri kaydedebileceğini gösterebilsin
    "allowedRedirectUris": SPOTIFY_CALLBACK_PATHS
      .iter()
      .map(|p| format!("{base}{p}"))
      .collect::<Vec<_>>(),
  })))
}

/// OBS Browser Source adresini kısaltmak için yapılandırma deposu.
///
/// Eskiden bütün yapılandırma **ve Spotify refresh token'ı** base64 olarak
/// adrese gömülüyordu: adres binlerce karakter oluyor, üstelik kimlik bilgisi
/// OBS ayar dosyasına ve ekran görüntülerine sızıyordu. Artık yapılandırma
/// burada saklanıyor, adres yalnız kısa bir kimlik taşıyor; oturum zaten
/// uygulamada duruyor.
/// Giriş/Çıkış/Mola ekranlarının okuduğu, o an seçili profilin anahtarı.
pub const ACTIVE_OVERLAY_ID: &str = "aktif";

fn overlay_config_path(data_dir: &std::path::Path) -> PathBuf {
  data_dir.join("overlay-configs.json")
}

fn read_overlay_configs(root: &std::path::Path) -> Value {
  std::fs::read_to_string(overlay_config_path(root))
    .ok()
    .and_then(|t| serde_json::from_str::<Value>(&t).ok())
    .filter(|v| v.is_object())
    .unwrap_or_else(|| serde_json::json!({}))
}

/// Kimlik dosya adı olarak da kullanılmıyor ama yine de dar tutuyoruz.
fn is_valid_overlay_id(id: &str) -> bool {
  !id.is_empty()
    && id.len() <= 64
    && id
      .chars()
      .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

#[derive(Deserialize)]
struct OverlayConfigQuery {
  id: String,
}

async fn api_get_overlay_config(
  State(state): State<Arc<AppState>>,
  Query(q): Query<OverlayConfigQuery>,
) -> Result<Json<Value>, (StatusCode, String)> {
  if !is_valid_overlay_id(&q.id) {
    return Err((StatusCode::BAD_REQUEST, "geçersiz id".into()));
  }
  read_overlay_configs(&state.data_dir)
    .get(&q.id)
    .cloned()
    .map(Json)
    .ok_or_else(|| (StatusCode::NOT_FOUND, "kayıt yok".into()))
}

#[derive(Deserialize)]
struct OverlayConfigBody {
  id: String,
  data: Value,
}

async fn api_put_overlay_config(
  State(state): State<Arc<AppState>>,
  Json(body): Json<OverlayConfigBody>,
) -> Result<Json<Value>, (StatusCode, String)> {
  if !is_valid_overlay_id(&body.id) {
    return Err((StatusCode::BAD_REQUEST, "geçersiz id".into()));
  }
  let mut all = read_overlay_configs(&state.data_dir);
  if let Some(obj) = all.as_object_mut() {
    // Her kayıt aynı zamanda "aktif" olarak yansıtılır: Giriş/Çıkış/Mola
    // ekranları profil kimliğini bilmeden son seçilen temayı okuyabilsin.
    // Yalnızca istemcinin ayrıca yazmasına bel bağlarsak, kullanıcı Müzik
    // sayfasını hiç açmadıysa overlay varsayılan temaya düşüyordu.
    if body.id != ACTIVE_OVERLAY_ID {
      obj.insert(ACTIVE_OVERLAY_ID.to_string(), body.data.clone());
    }
    obj.insert(body.id.clone(), body.data);
  }
  std::fs::create_dir_all(&state.data_dir)
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  std::fs::write(
    overlay_config_path(&state.data_dir),
    serde_json::to_string_pretty(&all)
      .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
  )
  .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  // Overlay'ler yoklamayı beklemesin: tema değişimi anında düşsün.
  state.broadcast_json(&serde_json::json!({ "type": "overlay-config" }));
  Ok(Json(serde_json::json!({ "ok": true, "id": body.id })))
}

#[derive(Deserialize)]
struct OpenExternalBody {
  url: String,
}

#[derive(Deserialize)]
struct OtomasyonKilidiBody {
  key: String,
  owner: String,
}

/// Giriş/çıkış bitiş eylemini yalnız BİR görünüm yapsın (OBS sayfası ya da
/// panel) — bkz. `otomasyon_kilidi`. Kilit zehirlenirse eylem engellenmez.
async fn api_automation_claim(
  Json(b): Json<OtomasyonKilidiBody>,
) -> Result<Json<Value>, (StatusCode, String)> {
  if !otomasyon_kilidi::gecerli_anahtar(&b.key) || !otomasyon_kilidi::gecerli_sahip(&b.owner) {
    return Err((StatusCode::BAD_REQUEST, "geçersiz kilit isteği".to_string()));
  }
  let ok = otomasyon_kilidi::kilitler()
    .lock()
    .map(|mut k| k.talep(&b.key, &b.owner, std::time::Instant::now()))
    .unwrap_or(true);
  Ok(Json(json!({ "ok": ok })))
}

async fn api_automation_release(Json(b): Json<OtomasyonKilidiBody>) -> StatusCode {
  if otomasyon_kilidi::gecerli_anahtar(&b.key) && otomasyon_kilidi::gecerli_sahip(&b.owner) {
    if let Ok(mut k) = otomasyon_kilidi::kilitler().lock() {
      k.birak(&b.key, &b.owner);
    }
  }
  StatusCode::NO_CONTENT
}

#[derive(Deserialize)]
struct RefreshTokenBody {
  client_id: String,
  refresh_token: String,
}

/// Hazır refresh token ile bağlanma — onay akışına hiç girmeden.
async fn api_spotify_token(
  State(state): State<Arc<AppState>>,
  Json(body): Json<RefreshTokenBody>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let name = state
    .music
    .spotify_set_refresh_token(&body.client_id, &body.refresh_token)
    .await
    .map_err(|e| {
      state.music.set_note(Some(e.to_string()));
      (StatusCode::BAD_GATEWAY, e.to_string())
    })?;
  state.broadcast_json(&serde_json::json!({ "type": "player-status" }));
  Ok(Json(serde_json::json!({ "ok": true, "displayName": name })))
}

#[derive(Deserialize)]
struct ManualCodeBody {
  /// Yetkilendirme kodu ya da tarayıcının adres çubuğundaki tam dönüş adresi
  value: String,
}

/// Yapıştırılan metinden Spotify yetkilendirme kodunu ayıklar.
///
/// Kullanıcı ya sadece kodu ya da `http://127.0.0.1:8843/...?code=...&state=`
/// biçiminde tam adresi yapıştırabilir; ikisini de kabul ediyoruz. Tarayıcının
/// otomatik açılmasına gerek kalmadan bağlanmanın yolu bu.
fn extract_spotify_code(raw: &str) -> Result<String, String> {
  let text = raw.trim();
  if text.is_empty() {
    return Err("Kod veya adres boş".into());
  }
  // Spotify hata döndürdüyse kullanıcıya aynen söyle
  if let Some(rest) = text.split("error=").nth(1) {
    if text.contains('?') || text.contains('&') {
      let err = rest.split('&').next().unwrap_or("bilinmeyen");
      return Err(format!("Spotify hata döndürdü: {err}"));
    }
  }
  let candidate = if let Some(rest) = text.split("code=").nth(1) {
    rest.split('&').next().unwrap_or("")
  } else {
    text
  };
  let code = candidate.trim();
  if code.is_empty() {
    return Err("Adreste 'code=' bulunamadı".into());
  }
  if code.contains(char::is_whitespace) || code.len() < 20 {
    return Err("Bu bir yetkilendirme kodu gibi görünmüyor".into());
  }
  Ok(code.to_string())
}

/// Tarayıcı açılamadığında elle bağlanma yolu.
async fn api_spotify_manual(
  State(state): State<Arc<AppState>>,
  Json(body): Json<ManualCodeBody>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let code = extract_spotify_code(&body.value).map_err(|e| (StatusCode::BAD_REQUEST, e))?;
  let name = state.music.spotify_exchange(&code).await.map_err(|e| {
    state.music.set_note(Some(e.to_string()));
    (StatusCode::BAD_GATEWAY, e.to_string())
  })?;
  state.broadcast_json(&serde_json::json!({ "type": "player-status" }));
  Ok(Json(serde_json::json!({ "ok": true, "displayName": name })))
}

/// Yalnız OAuth onay sayfaları açılabilir.
///
/// Bu uç yerel ağa açık bir "tarayıcıda aç" yeteneği; kapsamı dar tutuyoruz ki
/// makinedeki başka bir sayfa buradan rastgele adres açtıramasın.
fn is_allowed_external(url: &str) -> bool {
  const ALLOWED_PREFIXES: [&str; 8] = [
    "https://accounts.spotify.com/",
    "https://accounts.google.com/",
    "https://developer.spotify.com/",
    "https://id.kick.com/",
    "https://kick.com/",
    "https://www.kick.com/",
    "https://id.twitch.tv/",
    "https://twitch.tv/",
  ];
  ALLOWED_PREFIXES.iter().any(|p| url.starts_with(p))
}

/// Resonance iframe'i içinden `window.open` engellendiği için açmayı host yapar.
async fn api_open_external(
  Json(body): Json<OpenExternalBody>,
) -> Result<StatusCode, (StatusCode, String)> {
  let url = body.url.trim();
  if !is_allowed_external(url) {
    return Err((
      StatusCode::BAD_REQUEST,
      "Bu adres bu uçtan açılamaz".to_string(),
    ));
  }
  crate::open_external_url(url).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
  Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
struct CallbackQuery {
  code: Option<String>,
  error: Option<String>,
  #[serde(default)]
  state: Option<String>,
}

/// Kök adrese düşen Spotify kodunu karşılar; kod yoksa panele yönlendirir.
///
/// Kullanıcı Dashboard'a `http://127.0.0.1:8843/` gibi kısa bir adres
/// kaydetmişse kod buraya gelir.
async fn spotify_code_catch_all(
  State(state): State<Arc<AppState>>,
  Query(q): Query<CallbackQuery>,
) -> Response {
  if q.code.is_none() && q.error.is_none() {
    return Response::builder()
      .status(StatusCode::TEMPORARY_REDIRECT)
      .header(header::LOCATION, "/panel")
      .body(Body::empty())
      .unwrap_or_else(|_| Response::new(Body::empty()));
  }
  api_spotify_callback(State(state), Query(q)).await
}

/// `/resonance/callback`: Spotify kodu geldiyse değişimi sunucuda yapar,
/// gelmediyse isteği Resonance arayüzüne bırakır (tarayıcı içi PKCE akışı
/// bu sayfayı kendi tarafında kullanıyor).
async fn spotify_callback_or_app(
  index: PathBuf,
  State(state): State<Arc<AppState>>,
  Query(q): Query<CallbackQuery>,
) -> Response {
  if q.code.is_none() && q.error.is_none() {
    return serve_spa_file(index).await;
  }
  api_spotify_callback(State(state), Query(q)).await
}

/// Spotify onayı buraya döner. Token değişimi burada — yani hangi tarayıcıda
/// onay verildiğinden bağımsız — tamamlanır.
async fn api_spotify_callback(
  State(state): State<Arc<AppState>>,
  Query(q): Query<CallbackQuery>,
) -> Response {
  if let Some(err) = q.error {
    let msg = format!("Spotify yetkilendirmeyi reddetti: {err}");
    state.music.set_note(Some(msg.clone()));
    return spotify_callback_page(&msg, false);
  }
  let Some(code) = q.code else {
    let msg = "Spotify'dan kod gelmedi.".to_string();
    state.music.set_note(Some(msg.clone()));
    return spotify_callback_page(&msg, false);
  };
  match state.music.spotify_exchange(&code).await {
    Ok(name) => {
      state.broadcast_json(&serde_json::json!({ "type": "player-status" }));
      let who = if name.is_empty() {
        String::from("Spotify hesabınız")
      } else {
        name
      };
      spotify_callback_page(
        &format!("{who} bağlandı. Bu sekmeyi kapatıp uygulamaya dönebilirsiniz."),
        true,
      )
    }
    Err(e) => {
      // Sekme kapansa bile panelde görünsün.
      state.music.set_note(Some(e.to_string()));
      spotify_callback_page(&e.to_string(), false)
    }
  }
}

fn spotify_callback_page(message: &str, ok: bool) -> Response {
  let accent = if ok { "#22d3b8" } else { "#f87171" };
  let title = if ok { "Bağlandı" } else { "Bağlanamadı" };
  // Hata durumunda sekme kapanmasın; kullanıcı sebebi okuyamıyordu.
  let auto_close = if ok { "true" } else { "false" };
  let escaped = message
    .replace('&', "&amp;")
    .replace('<', "&lt;")
    .replace('>', "&gt;");
  let html = format!(
    r#"<!doctype html><html lang="tr"><head><meta charset="utf-8">
<title>Resonance — {title}</title>
<style>
 html,body{{height:100%;margin:0}}
 body{{display:grid;place-items:center;background:radial-gradient(120% 120% at 50% 0%,#171b26 0%,#0b0d13 60%);color:#e7eaf3;font:16px/1.6 "Segoe UI",system-ui,sans-serif}}
 .box{{max-width:30rem;padding:2.5rem;text-align:center}}
 h1{{margin:0 0 .75rem;font-size:1.5rem;color:{accent}}}
 p{{margin:0;color:#a7aec0}}
</style></head><body><div class="box"><h1>{title}</h1><p>{escaped}</p></div>
<script>if({auto_close})setTimeout(function(){{window.close()}},2500)</script>
</body></html>"#
  );
  Response::builder()
    .status(StatusCode::OK)
    .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
    .body(Body::from(html))
    .unwrap_or_else(|_| Response::new(Body::empty()))
}

async fn api_spotify_disconnect(State(state): State<Arc<AppState>>) -> Json<Value> {
  state.music.spotify_disconnect();
  Json(state.music.status())
}

#[derive(Deserialize)]
struct RecentlyPlayedQuery {
  #[serde(default = "default_recent_limit")]
  limit: u32,
}

fn default_recent_limit() -> u32 {
  50
}

/// Dinleme istatistikleri — host modunda tarayıcıda Spotify token yok;
/// bu yüzden recently-played isteğini Rust üzerinden yapıyoruz.
async fn api_spotify_recently_played(
  State(state): State<Arc<AppState>>,
  Query(q): Query<RecentlyPlayedQuery>,
) -> Result<Json<Value>, (StatusCode, String)> {
  state
    .music
    .spotify_recently_played(q.limit)
    .await
    .map(Json)
    .map_err(|e| (StatusCode::BAD_GATEWAY, e.to_string()))
}

#[derive(Deserialize)]
struct YtmdSessionBody {
  #[serde(default)]
  host: String,
  #[serde(default)]
  port: String,
  #[serde(default)]
  token: String,
}

/// Resonance tarayıcı tarafında YTMD eşleşmesini tamamladıktan sonra token'ı
/// buraya bırakır; böylece panel kontrolleri ve overlay'ler de kullanabilir.
async fn api_ytmd_session(
  State(state): State<Arc<AppState>>,
  Json(body): Json<YtmdSessionBody>,
) -> Json<Value> {
  if body.token.is_empty() {
    state.music.ytmd_disconnect();
  } else {
    state.music.set_ytmd(&body.host, &body.port, &body.token);
  }
  Json(state.music.status())
}

#[derive(Deserialize)]
struct MediaQuery {
  path: String,
}

/// Yerel medyayı **akış** olarak servis eder.
///
/// Kritik: Range başlığı yokken asla 206 dönmez — WebView2/Chromium bunu bozuk
/// sayıp `<video>` öğesini hiç başlatmaz (yerel videonun oynamama nedeni buydu).
/// Range yoksa tam boyutlu 200 + akışlı gövde gider; RAM'e alınmaz.
async fn api_media_file(
  Query(q): Query<MediaQuery>,
  headers: HeaderMap,
) -> Result<Response, (StatusCode, String)> {
  let path = media::sanitize_path(&q.path).map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
  let total = media::file_len(&path).map_err(|e| (StatusCode::NOT_FOUND, e.to_string()))?;
  let range = headers.get(header::RANGE).and_then(|v| v.to_str().ok());
  let plan = media::plan_range(total, range);
  let builder = media::headers_for(&path, &plan);

  if plan.status == 416 || plan.len == 0 {
    return builder
      .body(Body::empty())
      .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()));
  }

  let mut file = tokio::fs::File::open(&path)
    .await
    .map_err(|e| (StatusCode::NOT_FOUND, e.to_string()))?;
  if plan.start > 0 {
    use tokio::io::AsyncSeekExt;
    file
      .seek(std::io::SeekFrom::Start(plan.start))
      .await
      .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  }
  let stream = tokio_util::io::ReaderStream::with_capacity(
    tokio::io::AsyncReadExt::take(file, plan.len),
    64 * 1024,
  );
  builder
    .body(Body::from_stream(stream))
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

async fn ws_handler(
  ws: WebSocketUpgrade,
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
) -> impl IntoResponse {
  // GÜVENLİK: `/ws/*` LAN kipinde Bearer istemez (OBS tarayıcı kaynakları başlık gönderemez) ama
  // anlık görüntü ekran ayarlarını — kasadan enjekte edilmiş OBS şifresi dahil — taşıyordu. LAN'daki
  // herhangi bir cihaz şifreyi okuyabiliyordu; HTTP ayar ucu ise LAN'da zaten Bearer istiyor.
  // Aynı bilgisayardaki OBS (loopback) otomasyon için şifreyi almaya devam eder.
  let redact = !addr.ip().is_loopback();
  ws.on_upgrade(move |socket| client_ws(socket, state, redact))
}

async fn client_ws(socket: WebSocket, state: Arc<AppState>, redact: bool) {
  let (mut sender, mut receiver) = socket.split();
  let mut rx = state.tx.subscribe();
  // Bu bağlantıya özel yanıtlar (pong) için ayrı kanal — yayın kanalını
  // kirletmeden tek istemciye mesaj göndermeyi sağlar.
  let (direct_tx, mut direct_rx) = tokio::sync::mpsc::channel::<String>(8);

  let snap = {
    let s = state.settings.read();
    let mut v = serde_json::json!({
      "type": "snapshot",
      "starting": s.get(ScreenKind::Starting),
      "ending": s.get(ScreenKind::Ending),
      "brb": s.get(ScreenKind::Brb),
      "chat": s.get(ScreenKind::Chat),
      "panel": s.get(ScreenKind::Panel),
      "nowPlaying": state.music.now_playing(),
    });
    if redact {
      crate::secret_store::redact_obs_passwords(&mut v);
    }
    v.to_string()
  };
  if sender.send(Message::Text(snap.into())).await.is_err() {
    return;
  }

  let send_task = tokio::spawn(async move {
    loop {
      let out = tokio::select! {
        broadcast = rx.recv() => match broadcast {
          Ok(m) => m,
          // Yavaş istemci yayını kaçırdıysa bağlantıyı düşürme, devam et
          Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
          Err(_) => break,
        },
        direct = direct_rx.recv() => match direct {
          Some(m) => m,
          None => break,
        },
      };
      let out = if redact {
        crate::secret_store::redact_obs_passwords_text(&out).into_owned()
      } else {
        out
      };
      if sender.send(Message::Text(out.into())).await.is_err() {
        break;
      }
    }
  });

  while let Some(Ok(msg)) = receiver.next().await {
    match msg {
      Message::Text(text) => {
        // İstemci canlılık yoklaması: yanıtsız kalırsa overlay bağlantıyı
        // ölü sayıp yeniden kuruyor — bu yüzden pong zorunlu.
        let ping = serde_json::from_str::<Value>(&text)
          .ok()
          .and_then(|v| v.get("type").and_then(|t| t.as_str()).map(str::to_string))
          .as_deref()
          == Some("ping");
        if ping
          && direct_tx
            .send(serde_json::json!({ "type": "pong" }).to_string())
            .await
            .is_err()
        {
          break;
        }
      }
      Message::Close(_) => break,
      _ => {}
    }
  }
  send_task.abort();
}

// ─── Botaxt Modül 1: Profil / Dashboard API ───────────────────────────

async fn api_botaxt_dashboard(
  State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::db::profile::dashboard(&state.db)
    .await
    .map(|d| Json(serde_json::to_value(d).unwrap_or(Value::Null)))
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

#[derive(Deserialize)]
struct SessionsQuery {
  #[serde(default = "default_limit")]
  limit: i64,
}

fn default_limit() -> i64 {
  20
}

async fn api_botaxt_sessions(
  State(state): State<Arc<AppState>>,
  Query(q): Query<SessionsQuery>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::db::profile::list_sessions(&state.db, q.limit)
    .await
    .map(|rows| Json(serde_json::json!({ "sessions": rows })))
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

#[derive(Deserialize)]
struct SessionStartBody {
  title: Option<String>,
}

async fn api_botaxt_session_start(
  State(state): State<Arc<AppState>>,
  Json(body): Json<SessionStartBody>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let pool = state.db.clone();
  let title = body.title.clone();
  // SQLite işini runtime'a bırak — handler bloke olmasın
  let session = tokio::task::spawn(async move {
    crate::db::profile::start_session(&pool, title).await
  })
  .await
  .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
  .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

  state.broadcast_json(&serde_json::json!({
    "type": "session",
    "action": "start",
    "session": serde_json::to_value(&session).unwrap_or(Value::Null),
  }));
  Ok(Json(serde_json::to_value(session).unwrap_or(Value::Null)))
}

#[derive(Deserialize)]
struct SessionEndBody {
  session_id: String,
}

async fn api_botaxt_session_end(
  State(state): State<Arc<AppState>>,
  Json(body): Json<SessionEndBody>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let pool = state.db.clone();
  let sid = body.session_id.clone();
  let session = tokio::task::spawn(async move {
    crate::db::profile::end_session(&pool, &sid).await
  })
  .await
  .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
  .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

  state.broadcast_json(&serde_json::json!({
    "type": "session",
    "action": "end",
    "session": serde_json::to_value(&session).unwrap_or(Value::Null),
  }));
  Ok(Json(serde_json::json!({ "session": session })))
}

#[derive(Deserialize)]
struct MetricsBody {
  session_id: String,
  #[serde(default)]
  viewers: i64,
  #[serde(default)]
  chat_rpm: f64,
  #[serde(default)]
  followers: i64,
  #[serde(default)]
  subs: i64,
}

async fn api_botaxt_metrics(
  State(state): State<Arc<AppState>>,
  Json(body): Json<MetricsBody>,
) -> Result<StatusCode, (StatusCode, String)> {
  crate::db::profile::push_metric(
    &state.db,
    &body.session_id,
    body.viewers,
    body.chat_rpm,
    body.followers,
    body.subs,
  )
  .await
  .map(|_| StatusCode::OK)
  .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

#[derive(Deserialize)]
struct EventsQuery {
  #[serde(default = "default_limit")]
  limit: i64,
}

async fn api_botaxt_events(
  State(state): State<Arc<AppState>>,
  Query(q): Query<EventsQuery>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let channel_id = crate::db::default_channel_id(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  let rows: Vec<crate::db::models::EventLog> = sqlx::query_as(
    "SELECT id, session_id, channel_id, kind, platform, user_name, user_id,
            amount, message, meta_json, ts
     FROM events_log WHERE channel_id = ?
     ORDER BY ts DESC LIMIT ?",
  )
  .bind(&channel_id)
  .bind(q.limit.clamp(1, 100))
  .fetch_all(&state.db)
  .await
  .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  Ok(Json(serde_json::json!({ "events": rows })))
}

#[derive(Deserialize)]
struct EventLogBody {
  kind: String,
  #[serde(default = "default_platform")]
  platform: String,
  user_name: String,
  amount: Option<f64>,
  message: Option<String>,
}

fn default_platform() -> String {
  "local".into()
}

async fn api_botaxt_event_log(
  State(state): State<Arc<AppState>>,
  Json(body): Json<EventLogBody>,
) -> Result<StatusCode, (StatusCode, String)> {
  crate::db::profile::log_event(
    &state.db,
    &body.kind,
    &body.platform,
    &body.user_name,
    body.amount,
    body.message.as_deref(),
  )
  .await
  .map(|_| StatusCode::OK)
  .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
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
