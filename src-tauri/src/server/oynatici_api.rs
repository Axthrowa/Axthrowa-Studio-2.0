//! Oynatıcı, Spotify/YTMD bağlantısı, overlay yapılandırması, otomasyon kilidi, dış bağlantı

use super::*;

/// K6: Resonance katmanındaki istek şeridi (R6) AxBoT'un kuyruğunu okur; Studio host'unda aynı adresle bota iletilir.
/// Yalnız okuma; AxBoT kapalıysa 502 (şerit çıkmaz, katman seyrek yeniden dener).
pub(super) async fn api_istek_sirasi() -> Result<Json<Value>, (StatusCode, String)> {
  let kapali = |_| (StatusCode::BAD_GATEWAY, "AxBoT kuyruğu okunamadı".to_string());
  let client = reqwest::Client::builder().timeout(std::time::Duration::from_millis(1500)).build().map_err(kapali)?;
  let url = format!("http://127.0.0.1:{}/api/songrequest/queue", crate::axbot::port());
  let r = client.get(url).send().await.map_err(kapali)?;
  if !r.status().is_success() {
    return Err((StatusCode::BAD_GATEWAY, format!("AxBoT kuyruğu: HTTP {}", r.status().as_u16())));
  }
  r.json::<Value>().await.map(Json).map_err(kapali)
}

pub(super) async fn api_now_playing(State(state): State<Arc<AppState>>) -> Json<Value> {
  Json(serde_json::to_value(state.music.now_playing()).unwrap_or(Value::Null))
}

/// Resonance köprüsü buraya yazar (YouTube Music soketi tarayıcıda çalışır).
/// Gövde `null` ise "hiçbir şey çalmıyor" demektir.
pub(super) async fn api_set_now_playing(
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

pub(super) async fn api_player_status(State(state): State<Arc<AppState>>) -> Json<Value> {
  Json(state.music.status())
}

#[derive(Deserialize)]
pub(super) struct SourceBody {
  source: String,
}

pub(super) async fn api_player_source(
  State(state): State<Arc<AppState>>,
  Json(body): Json<SourceBody>,
) -> Json<Value> {
  state.music.set_source(&body.source);
  Json(state.music.status())
}

/// R3: kaynak sırası ve yok sayılan uygulamalar
pub(super) async fn api_player_tercih(State(state): State<Arc<AppState>>, Json(body): Json<crate::music::KaynakTercihi>) -> Json<Value> {
  state.music.set_tercih(body);
  Json(state.music.status())
}

#[derive(Deserialize)]
pub(super) struct CommandBody {
  action: String,
  #[serde(default)]
  source: Option<String>,
}

pub(super) async fn api_player_command(
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
pub(super) struct RequestBody {
  #[serde(default)]
  query: String,
  #[serde(default)]
  video_id: Option<String>,
  /// true: Spotify sırasına ekle (AxBoT !sr), false: hemen çal
  #[serde(default)]
  queue: bool,
  /// AxBoT ayarı: Spotify kapalıysa uygulamayı aç
  #[serde(default)]
  spotify_ac: bool,
}

#[derive(Deserialize)]
pub(super) struct BotGiden {
  metin: String,
}

/// Gömülü bot sohbete yazdığı metni bildirir: sohbetten geri okununca emote duvarı / kombo onu saymaz.
pub(super) async fn api_bot_giden(State(state): State<Arc<AppState>>, Json(b): Json<BotGiden>) -> StatusCode {
  state.emote_combo.bot_gonderdi(&b.metin);
  StatusCode::NO_CONTENT
}

pub(super) async fn api_player_request(
  State(state): State<Arc<AppState>>,
  Json(body): Json<RequestBody>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let (title, artist, id) = state
    .music
    .request_track(&body.query, body.video_id.as_deref(), body.queue, body.spotify_ac)
    .await
    .map_err(|e| (StatusCode::BAD_GATEWAY, e.to_string()))?;
  if !body.queue {
    state.music.istegi_yaz(&title, &artist);
    state.broadcast_json(&serde_json::json!({
      "type": "now-playing",
      "data": state.music.now_playing(),
    }));
  }
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
pub(super) struct AuthorizeBody {
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
pub(super) fn resolve_spotify_redirect(base_url: &str, requested: Option<&str>) -> String {
  let allowed: Vec<String> = SPOTIFY_CALLBACK_PATHS
    .iter()
    .map(|p| format!("{base_url}{p}"))
    .collect();
  match requested.map(str::trim).filter(|r| !r.is_empty()) {
    Some(r) if allowed.iter().any(|a| a == r) => r.to_string(),
    _ => allowed[0].clone(),
  }
}

pub(super) async fn api_spotify_authorize(
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

pub(super) fn overlay_config_path(data_dir: &std::path::Path) -> PathBuf {
  data_dir.join("overlay-configs.json")
}

pub(super) fn read_overlay_configs(root: &std::path::Path) -> Value {
  std::fs::read_to_string(overlay_config_path(root))
    .ok()
    .and_then(|t| serde_json::from_str::<Value>(&t).ok())
    .filter(|v| v.is_object())
    .unwrap_or_else(|| serde_json::json!({}))
}

/// Kimlik dosya adı olarak da kullanılmıyor ama yine de dar tutuyoruz.
pub(super) fn is_valid_overlay_id(id: &str) -> bool {
  !id.is_empty()
    && id.len() <= 64
    && id
      .chars()
      .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

#[derive(Deserialize)]
pub(super) struct OverlayConfigQuery {
  id: String,
}

pub(super) async fn api_get_overlay_config(
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
pub(super) struct OverlayConfigBody {
  id: String,
  data: Value,
}

pub(super) async fn api_put_overlay_config(
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
pub(super) struct OpenExternalBody {
  url: String,
}

#[derive(Deserialize)]
pub(super) struct OtomasyonKilidiBody {
  key: String,
  owner: String,
}

/// Giriş/çıkış bitiş eylemini yalnız BİR görünüm yapsın (OBS sayfası ya da
/// panel) — bkz. `otomasyon_kilidi`. Kilit zehirlenirse eylem engellenmez.
pub(super) async fn api_automation_claim(
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

pub(super) async fn api_automation_release(Json(b): Json<OtomasyonKilidiBody>) -> StatusCode {
  if otomasyon_kilidi::gecerli_anahtar(&b.key) && otomasyon_kilidi::gecerli_sahip(&b.owner) {
    if let Ok(mut k) = otomasyon_kilidi::kilitler().lock() {
      k.birak(&b.key, &b.owner);
    }
  }
  StatusCode::NO_CONTENT
}

#[derive(Deserialize)]
pub(super) struct RefreshTokenBody {
  client_id: String,
  refresh_token: String,
}

/// Hazır refresh token ile bağlanma — onay akışına hiç girmeden.
pub(super) async fn api_spotify_token(
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
pub(super) struct ManualCodeBody {
  /// Yetkilendirme kodu ya da tarayıcının adres çubuğundaki tam dönüş adresi
  value: String,
}

/// Yapıştırılan metinden Spotify yetkilendirme kodunu ayıklar.
///
/// Kullanıcı ya sadece kodu ya da `http://127.0.0.1:8843/...?code=...&state=`
/// biçiminde tam adresi yapıştırabilir; ikisini de kabul ediyoruz. Tarayıcının
/// otomatik açılmasına gerek kalmadan bağlanmanın yolu bu.
pub(super) fn extract_spotify_code(raw: &str) -> Result<String, String> {
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
pub(super) async fn api_spotify_manual(
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
pub(super) fn is_allowed_external(url: &str) -> bool {
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
pub(super) async fn api_open_external(
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
pub(super) struct CallbackQuery {
  pub(super) code: Option<String>,
  pub(super) error: Option<String>,
  #[serde(default)]
  pub(super) state: Option<String>,
}

/// Kök adrese düşen Spotify kodunu karşılar; kod yoksa panele yönlendirir.
///
/// Kullanıcı Dashboard'a `http://127.0.0.1:8843/` gibi kısa bir adres
/// kaydetmişse kod buraya gelir.
pub(super) async fn spotify_code_catch_all(
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
pub(super) async fn spotify_callback_or_app(
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
pub(super) async fn api_spotify_callback(
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

pub(super) fn spotify_callback_page(message: &str, ok: bool) -> Response {
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

pub(super) async fn api_spotify_disconnect(State(state): State<Arc<AppState>>) -> Json<Value> {
  state.music.spotify_disconnect();
  Json(state.music.status())
}

#[derive(Deserialize)]
pub(super) struct RecentlyPlayedQuery {
  #[serde(default = "default_recent_limit")]
  limit: u32,
}

pub(super) fn default_recent_limit() -> u32 {
  50
}

/// Dinleme istatistikleri — host modunda tarayıcıda Spotify token yok;
/// bu yüzden recently-played isteğini Rust üzerinden yapıyoruz.
pub(super) async fn api_spotify_recently_played(
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
pub(super) struct YayinListesiBody {
  baslangic: i64,
  bitis: i64,
  ad: String,
}

/// Y5: yayının Spotify şarkılarından çalma listesi
pub(super) async fn api_spotify_yayin_listesi(
  State(state): State<Arc<AppState>>,
  Json(b): Json<YayinListesiBody>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let ad: String = b.ad.trim().chars().filter(|c| !c.is_control()).take(100).collect();
  if ad.is_empty() || b.bitis <= b.baslangic {
    return Err((StatusCode::BAD_REQUEST, "Liste adı ve yayın aralığı gerekli".into()));
  }
  state.music.spotify_yayin_listesi(b.baslangic, b.bitis, &ad).await.map(Json).map_err(|e| (StatusCode::BAD_GATEWAY, e.to_string()))
}

#[derive(Deserialize)]
pub(super) struct YtmdSessionBody {
  #[serde(default)]
  host: String,
  #[serde(default)]
  port: String,
  #[serde(default)]
  token: String,
}

/// Resonance tarayıcı tarafında YTMD eşleşmesini tamamladıktan sonra token'ı
/// buraya bırakır; böylece panel kontrolleri ve overlay'ler de kullanabilir.
pub(super) async fn api_ytmd_session(
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
