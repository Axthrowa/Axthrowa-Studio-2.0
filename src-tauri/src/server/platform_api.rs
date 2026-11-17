//! Kick, YouTube ve Twitch uçları; şarkı sözü vekili ve sohbet temizleme

use super::*;

#[derive(Deserialize)]
pub(super) struct KickQuery {
  slug: String,
}

#[derive(Deserialize)]
pub(super) struct SozSorgusu {
  ara: Option<String>,
  id: Option<String>,
}

/// Söz kaynağı NetEase tarayıcıdan sorulamaz (CORS). Hedef sabit, yalnız arama metni ve sayısal kimlik geçer.
pub(super) fn soz_adresi(q: &SozSorgusu) -> Option<reqwest::Url> {
  if let Some(id) = q.id.as_deref().filter(|i| !i.is_empty() && i.len() <= 20 && i.bytes().all(|b| b.is_ascii_digit())) {
    return reqwest::Url::parse_with_params("https://music.163.com/api/song/lyric", &[("id", id), ("lv", "1"), ("yv", "1")]).ok();
  }
  let ara = q.ara.as_deref().map(str::trim).filter(|a| !a.is_empty())?;
  let ara: String = ara.chars().take(200).collect();
  reqwest::Url::parse_with_params("https://music.163.com/api/search/get", &[("s", ara.as_str()), ("type", "1"), ("limit", "8")]).ok()
}

pub(super) async fn api_player_sozler(Query(q): Query<SozSorgusu>) -> Response {
  let Some(hedef) = soz_adresi(&q) else {
    return (StatusCode::BAD_REQUEST, "ara ya da id gerekli").into_response();
  };
  let istek = reqwest::Client::new()
    .get(hedef)
    .header(header::USER_AGENT, "Mozilla/5.0")
    .header(header::REFERER, "https://music.163.com/")
    .timeout(std::time::Duration::from_secs(8))
    .send();
  match istek.await {
    Ok(r) if r.status().is_success() => match r.bytes().await {
      Ok(b) => ([(header::CONTENT_TYPE, "application/json")], b).into_response(),
      Err(_) => StatusCode::BAD_GATEWAY.into_response(),
    },
    _ => StatusCode::BAD_GATEWAY.into_response(),
  }
}

#[cfg(test)]
mod soz_testleri {
  use super::{soz_adresi, SozSorgusu};

  #[test]
  fn yalniz_sabit_hedef_ve_sayisal_kimlik() {
    let a = soz_adresi(&SozSorgusu { ara: None, id: Some("123".into()) }).unwrap();
    assert_eq!(a.host_str(), Some("music.163.com"));
    assert!(a.query().unwrap().contains("id=123"));
    assert!(soz_adresi(&SozSorgusu { ara: None, id: Some("1/../x".into()) }).is_none());
    assert!(soz_adresi(&SozSorgusu { ara: Some("  ".into()), id: None }).is_none());
    let b = soz_adresi(&SozSorgusu { ara: Some("a&b=c".into()), id: None }).unwrap();
    assert_eq!(b.path(), "/api/search/get");
    assert!(b.query().unwrap().contains("s=a%26b%3Dc"));
  }
}

pub(super) async fn api_kick_chatroom(
  Query(q): Query<KickQuery>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::kick::fetch_chatroom(&q.slug)
    .await
    .map(Json)
    .map_err(|e| (StatusCode::BAD_GATEWAY, e.to_string()))
}

#[derive(Deserialize)]
pub(super) struct KickOauthAuthorizeBody {
  #[serde(default, alias = "clientId")]
  client_id: String,
  #[serde(default, alias = "clientSecret")]
  client_secret: Option<String>,
  #[serde(default, alias = "broadcasterSlug")]
  broadcaster_slug: Option<String>,
  #[serde(default)]
  redirect_uri: Option<String>,
}

pub(super) async fn api_kick_oauth_authorize(
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

pub(super) async fn api_kick_prepare(
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
        Ok(_) => studio_warn!("[kick-api] prepare sonrası sohbet dinleme: {slug_c}"),
        Err(e) => studio_warn!("[kick-api] prepare sohbet: {e:#}"),
      }
    });
  }
  Ok(Json(status))
}

pub(super) async fn api_kick_oauth_callback(
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
              studio_warn!("[kick-api] OAuth sonrası sohbet dinleme: {slug_c}");
              st.broadcast_json(&serde_json::json!({
                "type": "kick-chat-status",
                "connected": true,
                "username": slug_c,
                "t": crate::db::chrono_now(),
              }));
            }
            Err(e) => studio_warn!("[kick-api] sohbet auto-connect: {e:#}"),
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

pub(super) fn kick_callback_page(message: &str, ok: bool) -> Response {
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
pub(super) async fn api_auth_notify_success(
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

pub(super) async fn api_kick_oauth_status(State(state): State<Arc<AppState>>) -> Json<Value> {
  let mut st = state.kick_auth.status();
  let chat = state.kick_chat.status_json();
  if let Some(obj) = st.as_object_mut() {
    obj.insert("chatListening".into(), json!(chat.get("connected").and_then(|v| v.as_bool()).unwrap_or(false)));
    obj.insert("chatroomId".into(), chat.get("chatroomId").cloned().unwrap_or(json!(null)));
    obj.insert("chatUsername".into(), chat.get("username").cloned().unwrap_or(json!("")));
  }
  Json(st)
}

pub(super) async fn api_kick_hub(State(state): State<Arc<AppState>>) -> Json<Value> {
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

pub(super) async fn api_kick_oauth_disconnect(State(state): State<Arc<AppState>>) -> Json<Value> {
  state.kick_auth.disconnect();
  Json(state.kick_auth.status())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct KickChatSendBody {
  text: String,
  #[serde(default)]
  slug: Option<String>,
}

pub(super) async fn api_kick_chat_send(
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

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct KickModBody {
  action: String,
  user: String,
  #[serde(default)]
  minutes: Option<u64>,
  #[serde(default)]
  reason: Option<String>,
}

pub(super) async fn api_kick_moderation(
  State(state): State<Arc<AppState>>,
  Json(body): Json<KickModBody>,
) -> Result<Json<Value>, (StatusCode, String)> {
  if !state.kick_auth.is_connected() {
    return Err((
      StatusCode::UNAUTHORIZED,
      "Kick API bağlı değil — Chat Bot’tan OAuth ile bağlan".into(),
    ));
  }
  let user = body.user.trim().trim_start_matches('@').to_string();
  if user.is_empty() {
    return Err((StatusCode::BAD_REQUEST, "kullanıcı gerekli".into()));
  }
  let reason = body.reason.unwrap_or_else(|| "Moderasyon".into());
  let result = match body.action.to_ascii_lowercase().as_str() {
    "timeout" | "to" => {
      let mins = body.minutes.unwrap_or(5).max(1);
      state.kick_auth.moderation_ban(&user, Some(mins), &reason).await
    }
    "ban" => state.kick_auth.moderation_ban(&user, None, &reason).await,
    "unban" => state.kick_auth.moderation_unban(&user).await,
    _ => return Err((StatusCode::BAD_REQUEST, "action: timeout, ban veya unban".into())),
  };
  result.map(Json).map_err(map_kick_chat_send_err)
}

pub(super) fn map_kick_chat_send_err(e: anyhow::Error) -> (StatusCode, String) {
  let s = e.to_string();
  if crate::kick::is_kick_rate_limit(&s) {
    (StatusCode::TOO_MANY_REQUESTS, crate::kick::kick_rate_limit_user_msg().into())
  } else {
    (StatusCode::BAD_GATEWAY, s)
  }
}

/// Kick login webview top-level sinyal (mixed-content fetch yerine).
pub(super) async fn api_kick_auth_signal(State(state): State<Arc<AppState>>) -> Response {
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

pub(super) async fn api_clear_platform_chats(
  State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
  Ok(Json(sohbeti_temizle(&state).await))
}

/// Sohbet katmanını sıfırlar ve Kick sohbetini platformda temizler (`/clear`). Panel düğmesi ve asistan kullanır.
pub(crate) async fn sohbeti_temizle(state: &AppState) -> Value {
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

  let kick = botta_kick_temizle().await;
  json!({
    "local": true,
    "kick": kick.is_ok(),
    "kickError": kick.err(),
  })
}

/// Kick'i bot temizler: oturumu ve `/clear` + tek tek silme mantığı orada.
pub(super) async fn botta_kick_temizle() -> Result<(), String> {
  let url = format!("http://127.0.0.1:{}/api/chat/clear-platforms", crate::axbot::port());
  let yanit = crate::kick::client()
    .map_err(|e| e.to_string())?
    .post(url)
    .timeout(std::time::Duration::from_secs(60))
    .json(&json!({ "platforms": ["kick"] }))
    .send()
    .await
    .map_err(|e| format!("Bota ulaşılamadı: {e}"))?;
  let d: Value = yanit.json().await.map_err(|e| e.to_string())?;
  kick_temizleme_sonucu(&d)
}

pub(super) fn kick_temizleme_sonucu(d: &Value) -> Result<(), String> {
  let k = &d["sonuclar"]["kick"];
  if k["ok"].as_bool() == Some(true) {
    Ok(())
  } else {
    Err(k["hata"].as_str().or(d["hata"].as_str()).unwrap_or("Kick sohbeti temizlenemedi").to_string())
  }
}

#[cfg(test)]
mod kick_temizleme_testleri {
  use super::*;

  #[test]
  fn bot_yaniti_okunur() {
    assert!(kick_temizleme_sonucu(&json!({ "sonuclar": { "kick": { "ok": true } } })).is_ok());
    assert_eq!(
      kick_temizleme_sonucu(&json!({ "sonuclar": { "kick": { "ok": false, "hata": "Bağlı değil." } } })),
      Err("Bağlı değil.".to_string())
    );
    assert_eq!(kick_temizleme_sonucu(&json!({ "hata": "seçilmedi" })), Err("seçilmedi".to_string()));
  }
}

#[derive(Deserialize)]
pub(super) struct YoutubeLiveQuery {
  /// @kanal, kanal URL veya video URL/ID
  q: String,
}

pub(super) async fn api_youtube_live(
  Query(q): Query<YoutubeLiveQuery>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::youtube_chat::resolve_live_video(&q.q)
    .await
    .map(Json)
    .map_err(|e| (StatusCode::BAD_GATEWAY, e.to_string()))
}

#[derive(Deserialize)]
pub(super) struct YoutubeChatQuery {
  video_id: String,
  continuation: Option<String>,
}

pub(super) async fn api_youtube_chat(
  Query(q): Query<YoutubeChatQuery>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::youtube_chat::poll_chat(&q.video_id, q.continuation.as_deref())
    .await
    .map(Json)
    .map_err(|e| (StatusCode::BAD_GATEWAY, e.to_string()))
}

#[derive(Deserialize)]
pub(super) struct YoutubeEndScreenQuery {
  video_id: String,
}

/// Arka plan videosunun bitiş ekranı gerçekten var mı, varsa hangi saniyede
/// açılıyor. Oynatıcı bunu bilmeden her videodan kör bir pay kesmek zorunda
/// kalıyor, kartı olmayan videolar da boşuna kısalıyordu.
pub(super) async fn api_youtube_endscreen(
  Query(q): Query<YoutubeEndScreenQuery>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::youtube_chat::end_screen_info(q.video_id.trim())
    .await
    .map(Json)
    .map_err(|e| (StatusCode::BAD_GATEWAY, e.to_string()))
}

#[derive(Deserialize)]
pub(super) struct TwitchBadgeQuery {
  /// "global" veya kanalın sayısal oda kimliği
  scope: String,
}

/// Twitch rozet kümesi vekili — `badges.twitch.tv` CORS başlığı göndermediği
/// için tarayıcı doğrudan okuyamıyordu ve rozetler yazı olarak kalıyordu.
pub(super) async fn api_twitch_badges(
  Query(q): Query<TwitchBadgeQuery>,
) -> Result<Json<Value>, (StatusCode, String)> {
  crate::twitch::badges(&q.scope)
    .await
    .map(Json)
    .map_err(|e| (StatusCode::BAD_GATEWAY, e.to_string()))
}
