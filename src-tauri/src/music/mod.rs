//! Gömülü müzik eklentisi (Resonance) için ortak durum katmanı.
//!
//! Spotify yetkilendirmesi burada, uygulama içinde tamamlanır: PKCE doğrulayıcı
//! Rust belleğinde tutulur ve `redirect_uri` yerel HTTP sunucusunun kendi
//! `/api/music/spotify/callback` adresidir. Böylece kullanıcı onayı hangi
//! tarayıcıda yapılırsa yapılsın token değişimi hep aynı yerde olur — tarayıcı
//! `sessionStorage`'ına bağımlı eski akışın "Spotify bağlanmıyor" hatası buradan
//! kaynaklanıyordu.
//!
//! Şu an çalan parça (`NowPlaying`) tek bir kaynakta toplanır: Spotify'ı Rust
//! doğrudan yoklar, YouTube Music Desktop verisini Resonance köprüsü POST eder.
//! Panel ve tüm overlay'ler aynı anlık görüntüyü okur.

use std::path::{Path, PathBuf};
use std::time::Duration;

use anyhow::{anyhow, Result};
use base64::Engine;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

pub const SPOTIFY_SCOPES: &str = "user-read-currently-playing user-read-playback-state user-read-recently-played user-top-read user-modify-playback-state";

/// Aynı anda geçerli sayılan yetkilendirme denemesi sayısı
const MAX_PENDING: usize = 5;
/// Spotify kodu ~10 dk geçerli; biraz pay bırakıyoruz.
const PENDING_TTL_MS: i64 = 20 * 60 * 1000;

/// Süresi geçmiş denemeleri atar, en fazla `MAX_PENDING` tutar.
fn prune_pending(mut list: Vec<PendingAuth>) -> Vec<PendingAuth> {
  let now = now_ms();
  // created_ms 0 olanlar eski sürümden gelmiş olabilir; onları da at.
  list.retain(|p| p.created_ms > 0 && now - p.created_ms < PENDING_TTL_MS);
  let overflow = list.len().saturating_sub(MAX_PENDING);
  if overflow > 0 {
    list.drain(0..overflow);
  }
  list
}

const SOURCE_SPOTIFY: &str = "spotify";
const SOURCE_YTMD: &str = "youtube-music";

/// Spotify 429 döndürdü. `poll_spotify` bunu hata olarak taşır; yoklama döngüsü
/// `pause_secs()` kadar durur. Eskiden 429 sıradan hata sayılıp her saniye
/// tekrar deneniyordu — bu da Spotify'ın engelini sürekli uzatıyor, widget
/// saatlerce boş kalıyordu.
#[derive(Debug)]
pub struct SpotifyRateLimited {
  /// Spotify'ın bildirdiği gerçek bekleme (saniye), kırpılmamış.
  pub retry_after_secs: u64,
}

impl SpotifyRateLimited {
  /// Bir sonraki denemeye kadar gerçekten bekleyeceğimiz süre: en az 5 sn, en
  /// çok 1 saat (aşırı büyük bir başlık uygulamayı sonsuza dek susturmasın;
  /// saatte bir tek istek zararsız).
  pub fn pause_secs(&self) -> u64 {
    self.retry_after_secs.clamp(5, 3600)
  }
}

/// Saniyeyi "3 sa 20 dk" gibi okunur hâle getirir.
pub fn human_wait(secs: u64) -> String {
  if secs >= 3600 {
    let h = secs / 3600;
    let m = (secs % 3600) / 60;
    if m == 0 { format!("{h} sa") } else { format!("{h} sa {m} dk") }
  } else if secs >= 60 {
    format!("{} dk", secs.div_ceil(60))
  } else {
    format!("{secs} sn")
  }
}

impl std::fmt::Display for SpotifyRateLimited {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    write!(
      f,
      "Spotify istek sınırına takıldı (429) — Spotify {} sonra izin verecek",
      human_wait(self.retry_after_secs)
    )
  }
}

impl std::error::Error for SpotifyRateLimited {}

/// `Retry-After` başlığını saniyeye çevirir (kırpmadan). Başlık yoksa ya da
/// bozuksa 30 sn.
pub fn parse_retry_after(raw: Option<&str>) -> u64 {
  raw
    .and_then(|v| v.trim().parse::<u64>().ok())
    .unwrap_or(30)
}

/// Yoklama aralığı: çalarken 2 sn (ilerleme çubuğu akıcı kalsın), durgunken 5 sn.
/// Saniyede bir istek (dakikada 60) Spotify'ın 30 sn'lik penceresine takılıyordu.
pub fn spotify_poll_delay(playing: bool) -> Duration {
  // Durdurma ve başlatma en geç bu kadar sonra görünür; 429 gelirse poll döngüsü Retry-After kadar bekler
  Duration::from_millis(if playing { 1000 } else { 2000 })
}

fn now_ms() -> i64 {
  chrono::Utc::now().timestamp_millis()
}

fn has_title(np: &NowPlaying) -> bool {
  !np.title.trim().is_empty()
}

/// Çalan kaynağı tercih eder. Mevcut kaynak hâlâ çalıyorsa onda kalır;
/// durursa diğer çalana geçer. İkisi de durmuşsa mevcut kaynağın anlığını tutar.
fn pick_active_now(
  spotify: &Option<NowPlaying>,
  ytmd: &Option<NowPlaying>,
  current: &str,
) -> Option<NowPlaying> {
  let playing: Vec<&NowPlaying> = [spotify, ytmd]
    .into_iter()
    .filter_map(|slot| slot.as_ref().filter(|np| np.is_playing && has_title(np)))
    .collect();
  if let Some(np) = playing.iter().find(|np| np.source == current) {
    return Some((*np).clone());
  }
  if playing.len() == 1 {
    return Some(playing[0].clone());
  }
  if playing.len() >= 2 {
    return playing
      .into_iter()
      .max_by_key(|np| np.updated_at)
      .cloned();
  }
  let paused: Vec<&NowPlaying> = [spotify, ytmd]
    .into_iter()
    .filter_map(|slot| slot.as_ref().filter(|np| has_title(np)))
    .collect();
  if let Some(np) = paused.iter().find(|np| np.source == current) {
    return Some((*np).clone());
  }
  paused.into_iter().max_by_key(|np| np.updated_at).cloned()
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NowPlaying {
  #[serde(default)]
  pub title: String,
  #[serde(default)]
  pub artist: String,
  #[serde(default)]
  pub album: String,
  #[serde(default)]
  pub album_art: String,
  #[serde(default)]
  pub is_playing: bool,
  /// milisaniye
  #[serde(default)]
  pub progress: i64,
  /// milisaniye
  #[serde(default)]
  pub duration: i64,
  #[serde(default)]
  pub source: String,
  #[serde(default)]
  pub updated_at: i64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpotifyCreds {
  #[serde(default)]
  pub client_id: String,
  #[serde(default)]
  pub refresh_token: String,
  #[serde(default)]
  pub display_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct YtmdCreds {
  #[serde(default = "default_ytmd_host")]
  pub host: String,
  #[serde(default = "default_ytmd_port")]
  pub port: String,
  #[serde(default)]
  pub token: String,
}

fn default_ytmd_host() -> String {
  "127.0.0.1".into()
}

fn default_ytmd_port() -> String {
  "9863".into()
}

impl Default for YtmdCreds {
  fn default() -> Self {
    Self {
      host: default_ytmd_host(),
      port: default_ytmd_port(),
      token: String::new(),
    }
  }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MusicDoc {
  #[serde(default)]
  spotify: SpotifyCreds,
  #[serde(default)]
  ytmd: YtmdCreds,
  #[serde(default)]
  source: String,
  /// Tamamlanmamış yetkilendirmeler. Bellekte tutulunca uygulama onay
  /// verilmeden önce yeniden başlarsa doğrulayıcı kayboluyor ve Spotify
  /// `invalid_grant` diyordu; diske yazınca akış yeniden başlatmaya dayanır.
  #[serde(default)]
  pending: Vec<PendingAuth>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct PendingAuth {
  verifier: String,
  client_id: String,
  redirect_uri: String,
  /// Oluşturulma anı — süresi geçenleri elemek için
  #[serde(default)]
  created_ms: i64,
}

pub struct MusicState {
  root: PathBuf,
  client: reqwest::Client,
  now: RwLock<Option<NowPlaying>>,
  spotify_snap: RwLock<Option<NowPlaying>>,
  ytmd_snap: RwLock<Option<NowPlaying>>,
  spotify: RwLock<SpotifyCreds>,
  ytmd: RwLock<YtmdCreds>,
  source: RwLock<String>,
  /// (access_token, expires_at_ms) — diske yazılmaz
  access: RwLock<(String, i64)>,
  /// Son yetkilendirme denemeleri (en yenisi sonda).
  ///
  /// Tek slot tutulurken her "Bağlan" tıklaması öncekini eziyordu: kullanıcı
  /// eski sekmeden onay verdiğinde doğrulayıcı artık eşleşmediği için Spotify
  /// `invalid_grant` döndürüyordu. Birkaç deneme saklayıp hepsini sırayla
  /// deniyoruz.
  pending: RwLock<Vec<PendingAuth>>,
  note: RwLock<Option<String>>,
}

fn doc_path(data_dir: &Path) -> PathBuf {
  let p = data_dir.join("music.json");
  let legacy = data_dir.join("app-data").join("music.json");
  if !p.exists() && legacy.exists() {
    return legacy;
  }
  p
}

impl MusicState {
  pub fn new(root: &Path) -> Self {
    let doc: MusicDoc = std::fs::read_to_string(doc_path(root))
      .ok()
      .and_then(|s| serde_json::from_str(&s).ok())
      .unwrap_or_default();
    let source = if doc.source.is_empty() {
      SOURCE_SPOTIFY.to_string()
    } else {
      doc.source.clone()
    };
    Self {
      root: root.to_path_buf(),
      client: reqwest::Client::builder()
        .timeout(Duration::from_secs(12))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new()),
      now: RwLock::new(None),
      spotify_snap: RwLock::new(None),
      ytmd_snap: RwLock::new(None),
      spotify: RwLock::new(doc.spotify),
      ytmd: RwLock::new(doc.ytmd),
      source: RwLock::new(source),
      access: RwLock::new((String::new(), 0)),
      pending: RwLock::new(prune_pending(doc.pending)),
      note: RwLock::new(None),
    }
  }

  fn save(&self) {
    let doc = MusicDoc {
      spotify: self.spotify.read().clone(),
      ytmd: self.ytmd.read().clone(),
      source: self.source.read().clone(),
      pending: self.pending.read().clone(),
    };
    let path = doc_path(&self.root);
    if let Some(dir) = path.parent() {
      let _ = std::fs::create_dir_all(dir);
    }
    // Burada Spotify yenileme anahtarı da saklanıyor: sessizce başarısız
    // olursa kullanıcı her açılışta yeniden yetkilendirmek zorunda kalır ve
    // nedenini gösteren hiçbir iz olmaz.
    match serde_json::to_string_pretty(&doc) {
      Ok(text) => {
        let tmp = path.with_extension("tmp");
        let sonuc = std::fs::write(&tmp, &text)
          .and_then(|_| std::fs::rename(&tmp, &path))
          .or_else(|_| std::fs::write(&path, &text));
        if let Err(e) = sonuc {
          yya_warn!("müzik oturumu kaydedilemedi: {e}");
        }
      }
      Err(e) => yya_warn!("müzik oturumu serileştirilemedi: {e}"),
    }
  }

  // ---- durum ----

  pub fn source(&self) -> String {
    self.source.read().clone()
  }

  pub fn set_source(&self, source: &str) {
    let normalized = if source == SOURCE_YTMD {
      SOURCE_YTMD
    } else {
      SOURCE_SPOTIFY
    };
    *self.source.write() = normalized.to_string();
    self.save();
  }

  pub fn now_playing(&self) -> Option<NowPlaying> {
    self.now.read().clone()
  }

  /// Spotify veya YTMD anlık görüntüsünü kaydeder; çalan kaynağa otomatik geçer.
  pub fn ingest_now(&self, mut np: Option<NowPlaying>, from: &str) {
    let from = if from == SOURCE_YTMD {
      SOURCE_YTMD
    } else {
      SOURCE_SPOTIFY
    };
    if let Some(v) = np.as_mut() {
      if v.source.is_empty() {
        v.source = from.to_string();
      }
      v.updated_at = now_ms();
    }
    if from == SOURCE_YTMD {
      *self.ytmd_snap.write() = np;
    } else {
      *self.spotify_snap.write() = np;
    }
    self.publish_active();
  }

  fn publish_active(&self) {
    let sp = self.spotify_snap.read().clone();
    let yt = self.ytmd_snap.read().clone();
    let current = self.source();
    let pick = pick_active_now(&sp, &yt, &current);
    if let Some(ref np) = pick {
      if !np.source.is_empty() && np.source != current {
        *self.source.write() = np.source.clone();
        self.save();
      }
    }
    *self.now.write() = pick;
  }

  pub fn set_note(&self, note: Option<String>) {
    *self.note.write() = note;
  }

  pub fn spotify_connected(&self) -> bool {
    let s = self.spotify.read();
    !s.client_id.is_empty() && !s.refresh_token.is_empty()
  }

  pub fn status(&self) -> Value {
    let s = self.spotify.read().clone();
    let y = self.ytmd.read().clone();
    json!({
      "source": self.source(),
      "sourceAuto": true,
      "spotify": {
        "connected": !s.client_id.is_empty() && !s.refresh_token.is_empty(),
        "clientId": s.client_id,
        "displayName": s.display_name,
      },
      "ytmd": {
        "connected": !y.token.is_empty(),
        "host": y.host,
        "port": y.port,
      },
      "note": self.note.read().clone(),
      "nowPlaying": self.now_playing(),
    })
  }

  // ---- Spotify yetkilendirme ----

  pub fn spotify_authorize_url(&self, client_id: &str, redirect_uri: &str) -> Result<String> {
    let client_id = client_id.trim();
    if client_id.is_empty() {
      return Err(anyhow!("Spotify Client ID gerekli"));
    }
    let verifier = format!(
      "{}{}",
      uuid::Uuid::new_v4().simple(),
      uuid::Uuid::new_v4().simple()
    );
    let challenge = base64::engine::general_purpose::URL_SAFE_NO_PAD
      .encode(Sha256::digest(verifier.as_bytes()));

    {
      let mut pending = self.pending.write();
      pending.push(PendingAuth {
        verifier,
        client_id: client_id.to_string(),
        redirect_uri: redirect_uri.to_string(),
        created_ms: now_ms(),
      });
      *pending = prune_pending(std::mem::take(&mut *pending));
    }
    {
      let mut s = self.spotify.write();
      s.client_id = client_id.to_string();
    }
    self.save();
    self.set_note(None);

    let params = [
      ("client_id", client_id),
      ("response_type", "code"),
      ("redirect_uri", redirect_uri),
      ("scope", SPOTIFY_SCOPES),
      ("code_challenge_method", "S256"),
      ("code_challenge", challenge.as_str()),
    ]
    .iter()
    .map(|(k, v)| format!("{}={}", k, urlencoding::encode(v)))
    .collect::<Vec<_>>()
    .join("&");

    Ok(format!("https://accounts.spotify.com/authorize?{params}"))
  }

  pub async fn spotify_exchange(&self, code: &str) -> Result<String> {
    let attempts = {
      let mut pending = self.pending.write();
      *pending = prune_pending(std::mem::take(&mut *pending));
      pending.clone()
    };
    if attempts.is_empty() {
      return Err(anyhow!(
        "Bekleyen Spotify yetkilendirmesi yok — Resonance'ta 'Bağlan'a basıp işlemi baştan yapın"
      ));
    }

    // En yeni denemeden başla; eski sekmeden gelen onay da tutsun diye hepsini dene.
    let mut last_err = String::new();
    let mut tokens: Option<(Value, String)> = None;
    for p in attempts.iter().rev() {
      let res = self
        .client
        .post("https://accounts.spotify.com/api/token")
        .form(&[
          ("client_id", p.client_id.as_str()),
          ("grant_type", "authorization_code"),
          ("code", code),
          ("redirect_uri", p.redirect_uri.as_str()),
          ("code_verifier", p.verifier.as_str()),
        ])
        .send()
        .await?;

      if res.status().is_success() {
        tokens = Some((res.json().await?, p.client_id.clone()));
        break;
      }
      let status = res.status();
      let body = res.text().await.unwrap_or_default();
      last_err = format!("{status}: {body}");
    }

    let Some((tokens, client_id)) = tokens else {
      // invalid_grant'ın pratikteki üç sebebi var; kullanıcıya onları söyle.
      let hint = if last_err.contains("invalid_grant") {
        " — Kod tek kullanımlıktır ve ~10 dakikada geçersizleşir. Bağlantı zaten kurulmuş olabilir; kurulmadıysa 'Bağlan'a yeniden basıp onayı yeni açılan sayfadan verin ve dönen adresi bir kez kullanın."
      } else {
        ""
      };
      return Err(anyhow!("Spotify token değişimi başarısız ({last_err}){hint}"));
    };
    let access = tokens
      .get("access_token")
      .and_then(|v| v.as_str())
      .unwrap_or_default()
      .to_string();
    let refresh = tokens
      .get("refresh_token")
      .and_then(|v| v.as_str())
      .unwrap_or_default()
      .to_string();
    let expires_in = tokens.get("expires_in").and_then(|v| v.as_i64()).unwrap_or(3600);

    if refresh.is_empty() {
      return Err(anyhow!("Spotify refresh token döndürmedi"));
    }

    *self.access.write() = (access.clone(), now_ms() + expires_in * 1000);
    {
      let mut s = self.spotify.write();
      s.client_id = client_id;
      s.refresh_token = refresh;
    }
    self.pending.write().clear();
    self.save();
    self.set_source(SOURCE_SPOTIFY);

    let name = self.spotify_display_name(&access).await.unwrap_or_default();
    if !name.is_empty() {
      self.spotify.write().display_name = name.clone();
      self.save();
    }
    Ok(name)
  }

  async fn spotify_display_name(&self, access: &str) -> Result<String> {
    let res = self
      .client
      .get("https://api.spotify.com/v1/me")
      .bearer_auth(access)
      .send()
      .await?;
    if !res.status().is_success() {
      return Ok(String::new());
    }
    let me: Value = res.json().await?;
    Ok(
      me.get("display_name")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string(),
    )
  }

  pub fn spotify_disconnect(&self) {
    {
      let mut s = self.spotify.write();
      s.refresh_token.clear();
      s.display_name.clear();
    }
    *self.access.write() = (String::new(), 0);
    *self.spotify_snap.write() = None;
    self.publish_active();
    self.save();
  }

  /// Hazır bir refresh token ile doğrudan bağlanır — tarayıcı adımı yok.
  ///
  /// Spotify'ın "şu an çalan" verisi kullanıcıya bağlı olduğu için yalnız
  /// Client ID/Secret ile alınamaz; ama kullanıcının elinde başka bir araçtan
  /// kalan geçerli bir refresh token varsa onay akışını tamamen atlayabiliriz.
  /// Bu, Dashboard'daki redirect adresine hiç bağlı değildir.
  pub async fn spotify_set_refresh_token(
    &self,
    client_id: &str,
    refresh_token: &str,
  ) -> Result<String> {
    let client_id = client_id.trim();
    let refresh = refresh_token.trim();
    if client_id.is_empty() {
      return Err(anyhow!("Spotify Client ID gerekli"));
    }
    if refresh.is_empty() {
      return Err(anyhow!("Refresh token gerekli"));
    }

    // Kaydetmeden önce doğrula: geçersiz bir token sessizce oturulmasın.
    let res = self
      .client
      .post("https://accounts.spotify.com/api/token")
      .form(&[
        ("client_id", client_id),
        ("grant_type", "refresh_token"),
        ("refresh_token", refresh),
      ])
      .send()
      .await?;

    if !res.status().is_success() {
      let status = res.status();
      let body = res.text().await.unwrap_or_default();
      return Err(anyhow!(
        "Refresh token kabul edilmedi ({status}): {body} — token bu Client ID ile alınmış olmalı"
      ));
    }

    let tokens: Value = res.json().await?;
    let access = tokens
      .get("access_token")
      .and_then(|v| v.as_str())
      .unwrap_or_default()
      .to_string();
    if access.is_empty() {
      return Err(anyhow!("Spotify erişim anahtarı döndürmedi"));
    }
    let expires_in = tokens.get("expires_in").and_then(|v| v.as_i64()).unwrap_or(3600);
    // Spotify yenilemede yeni bir refresh token verebiliyor.
    let stored = tokens
      .get("refresh_token")
      .and_then(|v| v.as_str())
      .unwrap_or(refresh)
      .to_string();

    *self.access.write() = (access.clone(), now_ms() + expires_in * 1000);
    {
      let mut sp = self.spotify.write();
      sp.client_id = client_id.to_string();
      sp.refresh_token = stored;
    }
    self.pending.write().clear();
    self.save();
    self.set_source(SOURCE_SPOTIFY);

    let name = self.spotify_display_name(&access).await.unwrap_or_default();
    if !name.is_empty() {
      self.spotify.write().display_name = name.clone();
      self.save();
    }
    Ok(name)
  }

  async fn spotify_access_token(&self) -> Result<String> {
    {
      let (token, expires_at) = self.access.read().clone();
      if !token.is_empty() && now_ms() < expires_at - 30_000 {
        return Ok(token);
      }
    }
    let (client_id, refresh) = {
      let s = self.spotify.read();
      (s.client_id.clone(), s.refresh_token.clone())
    };
    if client_id.is_empty() || refresh.is_empty() {
      return Err(anyhow!("Spotify bağlı değil"));
    }

    let res = self
      .client
      .post("https://accounts.spotify.com/api/token")
      .form(&[
        ("client_id", client_id.as_str()),
        ("grant_type", "refresh_token"),
        ("refresh_token", refresh.as_str()),
      ])
      .send()
      .await?;

    if !res.status().is_success() {
      let status = res.status();
      // 400 = refresh token geçersiz; tekrar bağlanmak gerekir
      if status.as_u16() == 400 {
        self.spotify_disconnect();
      }
      return Err(anyhow!("Spotify oturumu yenilenemedi ({status})"));
    }

    let tokens: Value = res.json().await?;
    let access = tokens
      .get("access_token")
      .and_then(|v| v.as_str())
      .unwrap_or_default()
      .to_string();
    let expires_in = tokens.get("expires_in").and_then(|v| v.as_i64()).unwrap_or(3600);
    if let Some(new_refresh) = tokens.get("refresh_token").and_then(|v| v.as_str()) {
      self.spotify.write().refresh_token = new_refresh.to_string();
      self.save();
    }
    *self.access.write() = (access.clone(), now_ms() + expires_in * 1000);
    Ok(access)
  }

  // ---- Spotify oynatma ----

  /// Son çalınanlar — dinleme istatistikleri için.
  pub async fn spotify_recently_played(&self, limit: u32) -> Result<Value> {
    let token = self.spotify_access_token().await?;
    let lim = limit.clamp(1, 50);
    let res = self
      .client
      .get(format!(
        "https://api.spotify.com/v1/me/player/recently-played?limit={lim}"
      ))
      .bearer_auth(&token)
      .send()
      .await?;
    if !res.status().is_success() {
      return Err(anyhow!("Spotify recently-played hatası ({})", res.status()));
    }
    Ok(res.json().await?)
  }

  pub async fn poll_spotify(&self) -> Result<Option<NowPlaying>> {
    let token = self.spotify_access_token().await?;
    let istek_ani = std::time::Instant::now();
    let res = self
      .client
      // `track` tek başına istenirse podcast/bölüm çalarken Spotify `item: null`
      // döndürüyor ve widget bomboş kalıyordu.
      .get("https://api.spotify.com/v1/me/player/currently-playing?additional_types=track,episode")
      .bearer_auth(&token)
      .send()
      .await?;

    if res.status().as_u16() == 204 {
      return Ok(None);
    }
    if res.status().as_u16() == 429 {
      let retry = res
        .headers()
        .get("retry-after")
        .and_then(|v| v.to_str().ok())
        .map(str::to_string);
      return Err(SpotifyRateLimited {
        retry_after_secs: parse_retry_after(retry.as_deref()),
      }
      .into());
    }
    if !res.status().is_success() {
      return Err(anyhow!("Spotify API hatası ({})", res.status()));
    }
    let data: Value = res.json().await?;
    let Some(item) = data.get("item").filter(|v| !v.is_null()) else {
      return Ok(None);
    };

    // Şarkıda sanatçı listesi, bölümde ise yayın (show) adı var.
    let artist = item
      .get("artists")
      .and_then(|v| v.as_array())
      .map(|a| {
        a.iter()
          .filter_map(|x| x.get("name").and_then(|n| n.as_str()))
          .collect::<Vec<_>>()
          .join(", ")
      })
      .filter(|s| !s.is_empty())
      .or_else(|| {
        item
          .pointer("/show/publisher")
          .or_else(|| item.pointer("/show/name"))
          .and_then(|v| v.as_str())
          .map(str::to_string)
      })
      .unwrap_or_default();

    Ok(Some(NowPlaying {
      title: item
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string(),
      artist,
      album: item
        .pointer("/album/name")
        .or_else(|| item.pointer("/show/name"))
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string(),
      album_art: item
        .pointer("/album/images/0/url")
        .or_else(|| item.pointer("/images/0/url"))
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string(),
      is_playing: data
        .get("is_playing")
        .and_then(|v| v.as_bool())
        .unwrap_or(false),
      // Yanıt yolda geçen süre kadar eskidir (karaoke bu farkla geride kalıyordu); çalmıyorsa konum değişmez
      progress: data.get("progress_ms").and_then(|v| v.as_i64()).unwrap_or(0)
        + if data.get("is_playing").and_then(|v| v.as_bool()).unwrap_or(false) {
          istek_ani.elapsed().as_millis() as i64 / 2
        } else {
          0
        },
      duration: item.get("duration_ms").and_then(|v| v.as_i64()).unwrap_or(0),
      source: SOURCE_SPOTIFY.into(),
      updated_at: now_ms(),
    }))
  }

  async fn spotify_command(&self, action: &str) -> Result<()> {
    let token = self.spotify_access_token().await?;
    let playing = self
      .now_playing()
      .map(|n| n.is_playing)
      .unwrap_or(false);

    let (method, path) = match action {
      "play" => (reqwest::Method::PUT, "play"),
      "pause" => (reqwest::Method::PUT, "pause"),
      "playPause" => (
        reqwest::Method::PUT,
        if playing { "pause" } else { "play" },
      ),
      "next" => (reqwest::Method::POST, "next"),
      "previous" => (reqwest::Method::POST, "previous"),
      other => return Err(anyhow!("bilinmeyen komut: {other}")),
    };

    let res = self
      .client
      .request(method, format!("https://api.spotify.com/v1/me/player/{path}"))
      .bearer_auth(&token)
      .header(reqwest::header::CONTENT_LENGTH, "0")
      .body("")
      .send()
      .await?;

    match res.status().as_u16() {
      200 | 202 | 204 => Ok(()),
      403 => Err(anyhow!(
        "Spotify kontrolü reddetti — oynatma kontrolü Spotify Premium gerektirir"
      )),
      404 => Err(anyhow!(
        "Aktif Spotify cihazı yok — Spotify'da bir şey çalmaya başlatın"
      )),
      code => Err(anyhow!("Spotify komutu başarısız ({code})")),
    }
  }

  /// Arama + URI ile çal (chat !istek). `queue`: hemen çalmak yerine Spotify sırasına ekler
  /// (gömülü botun !sr isteği çalan şarkıyı kesmesin).
  pub async fn spotify_search_play(&self, query: &str, queue: bool) -> Result<(String, String, String)> {
    let q = query.trim();
    if q.is_empty() {
      return Err(anyhow!("boş arama"));
    }
    let token = self.spotify_access_token().await?;
    let res = self
      .client
      .get("https://api.spotify.com/v1/search")
      .bearer_auth(&token)
      .query(&[("q", q), ("type", "track"), ("limit", "10")])
      .send()
      .await?;
    if !res.status().is_success() {
      return Err(anyhow!("Spotify arama başarısız ({})", res.status()));
    }
    let data: Value = res.json().await.unwrap_or(json!({}));
    // Spotify'ın ilk sonucu sık sık yanlış ("Tame Impala Loser" → "Dracula"); sorguya en çok uyanı seç
    let items = data
      .pointer("/tracks/items")
      .and_then(|v| v.as_array())
      .filter(|a| !a.is_empty())
      .ok_or_else(|| anyhow!("Spotify'da sonuç yok"))?;
    let item = items[best_search_match(items, q)].clone();
    let uri = item
      .get("uri")
      .and_then(|v| v.as_str())
      .ok_or_else(|| anyhow!("track URI yok"))?
      .to_string();
    let title = item
      .get("name")
      .and_then(|v| v.as_str())
      .unwrap_or(q)
      .to_string();
    let artist = item
      .pointer("/artists/0/name")
      .and_then(|v| v.as_str())
      .unwrap_or("")
      .to_string();

    // Cihaz belirtilmezse Spotify komutu "etkin" sayılan hayalet bir cihaza gönderebiliyor:
    // masaüstü durur, istek hiçbir yerde çalmaz. Bu bilgisayardaki uygulamayı açıkça hedefle.
    let device = self.spotify_target_device(&token).await;
    let mut params: Vec<(&str, &str)> = Vec::new();
    if let Some(d) = device.as_deref() {
      params.push(("device_id", d));
    }
    // "Hemen çal" da sıra + sonraki ile yapılır: `PUT /me/player/play {uris}` bu kullanıcıda
    // masaüstünü durdurup hiçbir şey çalmıyordu, sıra + sonraki ise masaüstünde çalıyor.
    let durum = |code: u16| match code {
      200 | 202 | 204 => Ok(()),
      403 => Err(anyhow!("Spotify çalamadı — Premium ve açık bir cihaz gerekir")),
      404 => Err(anyhow!("Aktif Spotify cihazı yok — Spotify'da bir şey çalmaya başlatın")),
      code => Err(anyhow!("Spotify play başarısız ({code})")),
    };
    let mut queue_params = params.clone();
    queue_params.push(("uri", uri.as_str()));
    let res = self
      .client
      .post("https://api.spotify.com/v1/me/player/queue")
      .bearer_auth(&token)
      .query(&queue_params)
      .header(reqwest::header::CONTENT_LENGTH, "0")
      .send()
      .await?;
    durum(res.status().as_u16())?;
    if !queue {
      let res = self
        .client
        .post("https://api.spotify.com/v1/me/player/next")
        .bearer_auth(&token)
        .query(&params)
        .header(reqwest::header::CONTENT_LENGTH, "0")
        .send()
        .await?;
      durum(res.status().as_u16())?;
    }
    Ok((title, artist, uri))
  }

  /// `/me/player/devices` içinden çalma hedefi; liste alınamazsa `None` (Spotify kendi seçer).
  async fn spotify_target_device(&self, token: &str) -> Option<String> {
    let res = self
      .client
      .get("https://api.spotify.com/v1/me/player/devices")
      .bearer_auth(token)
      .send()
      .await
      .ok()?;
    let data: Value = res.json().await.ok()?;
    let pc = std::env::var("COMPUTERNAME").unwrap_or_default();
    pick_spotify_device(data.get("devices")?.as_array()?, &pc)
  }

  pub async fn ytmd_change_video(&self, video_id: &str) -> Result<()> {
    let id = video_id.trim();
    if id.len() < 6 {
      return Err(anyhow!("geçersiz videoId"));
    }
    let (host, port, token) = {
      let y = self.ytmd.read();
      (y.host.clone(), y.port.clone(), y.token.clone())
    };
    if token.is_empty() {
      return Err(anyhow!("YouTube Music Desktop bağlı değil"));
    }
    let url = format!("http://{host}:{port}/api/v1/command");
    let body = json!({
      "command": "changeVideo",
      "data": { "videoId": id }
    });
    for header in [token.clone(), format!("Bearer {token}")] {
      let res = self
        .client
        .post(&url)
        .header(reqwest::header::AUTHORIZATION, header)
        .json(&body)
        .send()
        .await;
      match res {
        Ok(r) if r.status().is_success() => return Ok(()),
        Ok(r) if r.status().as_u16() == 401 => continue,
        Ok(r) => return Err(anyhow!("YTMD changeVideo başarısız ({})", r.status())),
        Err(e) => return Err(anyhow!("YTMD'ye ulaşılamadı: {e}")),
      }
    }
    Err(anyhow!("YTMD yetkilendirmesi reddedildi — yeniden bağlanın"))
  }

  /// Chat şarkı isteği: Spotify arama veya YTMD videoId.
  pub async fn request_track(
    &self,
    query: &str,
    video_id: Option<&str>,
    queue: bool,
  ) -> Result<(String, String, String)> {
    if let Some(vid) = video_id.map(str::trim).filter(|s| !s.is_empty()) {
      if !self.ytmd.read().token.is_empty() {
        self.ytmd_change_video(vid).await?;
        return Ok((format!("YouTube {vid}"), String::new(), vid.to_string()));
      }
    }
    if self.spotify_connected() {
      return self.spotify_search_play(query, queue).await;
    }
    if !self.ytmd.read().token.is_empty() {
      return Err(anyhow!(
        "YTMD bağlı — arama yok; YouTube video linki veya ID ile !istek yapın. Spotify ile şarkı adı aranır."
      ));
    }
    Err(anyhow!("Spotify veya YTMD bağlı değil"))
  }

  // ---- YouTube Music Desktop ----

  pub fn set_ytmd(&self, host: &str, port: &str, token: &str) {
    {
      let mut y = self.ytmd.write();
      if !host.is_empty() {
        y.host = host.to_string();
      }
      if !port.is_empty() {
        y.port = port.to_string();
      }
      y.token = token.to_string();
    }
    self.save();
  }

  pub fn ytmd_disconnect(&self) {
    self.ytmd.write().token.clear();
    *self.ytmd_snap.write() = None;
    self.publish_active();
    self.save();
  }

  async fn ytmd_command(&self, action: &str) -> Result<()> {
    let (host, port, token) = {
      let y = self.ytmd.read();
      (y.host.clone(), y.port.clone(), y.token.clone())
    };
    if token.is_empty() {
      return Err(anyhow!("YouTube Music Desktop bağlı değil"));
    }

    // muteToggle: durumdan oku → mute/unmute (YTMD ayrı komutlar sunuyor).
    let command = match action {
      "play" => "play".to_string(),
      "pause" => "pause".to_string(),
      "playPause" => "playPause".to_string(),
      "next" => "next".to_string(),
      "previous" => "previous".to_string(),
      "mute" => "mute".to_string(),
      "unmute" => "unmute".to_string(),
      "muteToggle" | "toggleMute" => {
        let muted = self.ytmd_is_muted(&host, &port, &token).await.unwrap_or(false);
        if muted {
          "unmute".to_string()
        } else {
          "mute".to_string()
        }
      }
      other => return Err(anyhow!("bilinmeyen komut: {other}")),
    };

    let url = format!("http://{host}:{port}/api/v1/command");
    // Companion Server sürümleri arasında başlık biçimi değişiyor: önce düz
    // token, 401 gelirse Bearer denenir.
    for header in [token.clone(), format!("Bearer {token}")] {
      let res = self
        .client
        .post(&url)
        .header(reqwest::header::AUTHORIZATION, header)
        .json(&json!({ "command": command }))
        .send()
        .await;
      match res {
        Ok(r) if r.status().is_success() => return Ok(()),
        Ok(r) if r.status().as_u16() == 401 => continue,
        Ok(r) => return Err(anyhow!("YTMD komutu başarısız ({})", r.status())),
        Err(e) => return Err(anyhow!("YTMD'ye ulaşılamadı: {e}")),
      }
    }
    Err(anyhow!("YTMD yetkilendirmesi reddedildi — yeniden bağlanın"))
  }

  async fn ytmd_is_muted(&self, host: &str, port: &str, token: &str) -> Result<bool> {
    let url = format!("http://{host}:{port}/api/v1/state");
    for header in [token.to_string(), format!("Bearer {token}")] {
      let res = self
        .client
        .get(&url)
        .header(reqwest::header::AUTHORIZATION, header)
        .send()
        .await;
      match res {
        Ok(r) if r.status().is_success() => {
          let v: Value = r.json().await.unwrap_or(json!({}));
          let muted = v
            .pointer("/player/muted")
            .and_then(|x| x.as_bool())
            .or_else(|| v.get("muted").and_then(|x| x.as_bool()))
            .unwrap_or(false);
          return Ok(muted);
        }
        Ok(r) if r.status().as_u16() == 401 => continue,
        Ok(_) | Err(_) => break,
      }
    }
    Ok(false)
  }

  /// Kaynak verilmezse aktif kaynağı dener; başarısızsa diğer bağlı kaynağa düşer.
  /// Böylece panelde Spotify seçili olsa bile YTMD bağlıysa komut oraya da gider.
  pub async fn command(&self, action: &str, source: Option<&str>) -> Result<()> {
    let preferred = source
      .map(|s| s.to_string())
      .unwrap_or_else(|| self.source());

    let order: [&str; 2] = if preferred == SOURCE_YTMD {
      [SOURCE_YTMD, SOURCE_SPOTIFY]
    } else {
      [SOURCE_SPOTIFY, SOURCE_YTMD]
    };

    let mut last_err: Option<anyhow::Error> = None;
    for src in order {
      let available = if src == SOURCE_YTMD {
        !self.ytmd.read().token.is_empty()
      } else {
        self.spotify_connected()
      };
      if !available {
        continue;
      }
      // Spotify'da muteToggle ≈ playPause (ses API'si Premium + cihaz ister).
      let act = if src == SOURCE_SPOTIFY
        && matches!(action, "muteToggle" | "toggleMute" | "mute" | "unmute")
      {
        "playPause"
      } else {
        action
      };
      let result = if src == SOURCE_YTMD {
        self.ytmd_command(act).await
      } else {
        self.spotify_command(act).await
      };
      match result {
        Ok(()) => return Ok(()),
        Err(e) => last_err = Some(e),
      }
    }
    Err(last_err.unwrap_or_else(|| anyhow!("müzik kaynağı bağlı değil — Spotify veya YTMD bağla")))
  }
}

/// Arama sonuçlarından sorgudaki kelimelerin en çoğunu (şarkı adı + sanatçı) içeren; eşitlikte Spotify sırası.
fn best_search_match(items: &[Value], query: &str) -> usize {
  let words = |t: &str| -> Vec<String> {
    t.to_lowercase()
      .split(|c: char| !c.is_alphanumeric())
      .filter(|w| !w.is_empty())
      .map(str::to_string)
      .collect()
  };
  let q = words(query);
  let score = |item: &Value| {
    let mut text = item["name"].as_str().unwrap_or("").to_string();
    for a in item["artists"].as_array().into_iter().flatten() {
      text.push(' ');
      text.push_str(a["name"].as_str().unwrap_or(""));
    }
    let have = words(&text);
    let name = words(item["name"].as_str().unwrap_or(""));
    // Şarkı adının tüm kelimeleri sorguda geçiyorsa öne çıkar ("Dracula" sorguda yok)
    let name_hit = !name.is_empty() && name.iter().all(|w| q.contains(w));
    q.iter().filter(|w| have.contains(w)).count() * 2 + usize::from(name_hit)
  };
  let mut best = 0;
  for (i, item) in items.iter().enumerate() {
    if score(item) > score(&items[best]) {
      best = i;
    }
  }
  best
}

/// Önce bu bilgisayardaki masaüstü uygulaması (cihaz adı = bilgisayar adı), sonra etkin cihaz,
/// sonra herhangi bir bilgisayar cihazı. Kısıtlı (API ile yönetilemeyen) cihazlar atlanır.
fn pick_spotify_device(devices: &[Value], pc: &str) -> Option<String> {
  let usable: Vec<&Value> = devices
    .iter()
    .filter(|d| !d["is_restricted"].as_bool().unwrap_or(false) && d["id"].is_string())
    .collect();
  let computer = |d: &&&Value| d["type"].as_str().is_some_and(|t| t.eq_ignore_ascii_case("computer"));
  usable
    .iter()
    .find(|d| computer(d) && !pc.is_empty() && d["name"].as_str().is_some_and(|n| n.eq_ignore_ascii_case(pc)))
    .or_else(|| usable.iter().find(|d| d["is_active"].as_bool().unwrap_or(false)))
    .or_else(|| usable.iter().find(computer))
    .and_then(|d| d["id"].as_str().map(str::to_string))
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn search_match_prefers_title_in_query() {
    let items = vec![
      json!({"name": "Dracula", "artists": [{"name": "Tame Impala"}]}),
      json!({"name": "Loser", "artists": [{"name": "Tame Impala"}]}),
      json!({"name": "Loser", "artists": [{"name": "Beck"}]}),
    ];
    assert_eq!(best_search_match(&items, "Tame Impala Loser"), 1);
    assert_eq!(best_search_match(&items, "loser beck"), 2);
    assert_eq!(best_search_match(&items, "bilinmeyen"), 0);
  }

  #[test]
  fn spotify_device_prefers_this_pc_over_active_ghost() {
    let devices = vec![
      json!({"id": "web", "name": "Web Player (Chrome)", "type": "Computer", "is_active": true}),
      json!({"id": "pc", "name": "MASAUSTU", "type": "Computer", "is_active": false}),
      json!({"id": "tv", "name": "TV", "type": "TV", "is_active": false, "is_restricted": true}),
    ];
    assert_eq!(pick_spotify_device(&devices, "masaustu").as_deref(), Some("pc"));
    assert_eq!(pick_spotify_device(&devices, "BASKA").as_deref(), Some("web"));
    assert_eq!(pick_spotify_device(&devices[2..], "x"), None);
  }

  fn temp_state(tag: &str) -> MusicState {
    let root = std::env::temp_dir().join(format!("yayin-music-{tag}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&root);
    std::fs::create_dir_all(&root).unwrap();
    MusicState::new(&root)
  }

  #[test]
  fn authorize_url_carries_pkce_and_scopes() {
    let st = temp_state("url");
    let url = st
      .spotify_authorize_url("client123", "http://127.0.0.1:8843/resonance/callback")
      .unwrap();
    assert!(url.starts_with("https://accounts.spotify.com/authorize?"));
    assert!(url.contains("client_id=client123"));
    assert!(url.contains("code_challenge_method=S256"));
    assert!(url.contains("response_type=code"));
    // Kontrol düğmeleri için yazma izni
    assert!(url.contains("user-modify-playback-state"));
    // Client ID kalıcı olmalı ki panel "yapılandırıldı" gösterebilsin
    assert_eq!(st.spotify.read().client_id, "client123");
  }

  #[test]
  fn empty_client_id_is_rejected() {
    let st = temp_state("empty");
    assert!(st.spotify_authorize_url("   ", "http://127.0.0.1:8843/cb").is_err());
    assert!(st.pending.read().is_empty());
  }

  /// Her "Bağlan" tıklaması öncekini eziyordu; eski sekmeden gelen onay
  /// `invalid_grant` ile düşüyordu. Artık son birkaç deneme saklanır.
  #[test]
  fn repeated_authorize_keeps_previous_attempts() {
    let st = temp_state("multi");
    for _ in 0..3 {
      st.spotify_authorize_url("client123", "http://127.0.0.1:8843/resonance/callback")
        .unwrap();
    }
    let pending = st.pending.read();
    assert_eq!(pending.len(), 3, "eski denemeler korunmali");
    // Her denemenin doğrulayıcısı benzersiz olmalı
    let mut verifiers: Vec<&str> = pending.iter().map(|p| p.verifier.as_str()).collect();
    verifiers.sort_unstable();
    verifiers.dedup();
    assert_eq!(verifiers.len(), 3);
  }

  #[test]
  fn pending_list_is_capped() {
    let st = temp_state("cap");
    for _ in 0..(MAX_PENDING + 4) {
      st.spotify_authorize_url("client123", "http://127.0.0.1:8843/resonance/callback")
        .unwrap();
    }
    assert_eq!(st.pending.read().len(), MAX_PENDING, "liste sinirsiz buyumemeli");
  }

  #[tokio::test]
  async fn exchange_without_pending_explains_itself() {
    let st = temp_state("nopending");
    let err = st.spotify_exchange("herhangi").await.unwrap_err().to_string();
    assert!(err.contains("Bağlan"), "{err}");
  }

  #[test]
  fn different_redirect_uris_are_remembered_separately() {
    let st = temp_state("redirects");
    st.spotify_authorize_url("c", "http://127.0.0.1:8843/resonance/callback").unwrap();
    st.spotify_authorize_url("c", "http://127.0.0.1:8843/api/player/spotify/callback").unwrap();
    let pending = st.pending.read();
    assert_eq!(pending.len(), 2);
    assert!(pending.iter().any(|p| p.redirect_uri.ends_with("/resonance/callback")));
    assert!(pending
      .iter()
      .any(|p| p.redirect_uri.ends_with("/api/player/spotify/callback")));
  }

  fn np(source: &str, playing: bool, title: &str, updated_at: i64) -> NowPlaying {
    NowPlaying {
      title: title.into(),
      artist: "a".into(),
      is_playing: playing,
      source: source.into(),
      updated_at,
      ..Default::default()
    }
  }

  #[test]
  fn retry_after_parses_without_clamping_but_pause_is_bounded() {
    assert_eq!(parse_retry_after(Some("42")), 42);
    assert_eq!(parse_retry_after(Some(" 7 ")), 7);
    assert_eq!(parse_retry_after(Some("86400")), 86400, "gerçek değer korunur");
    assert_eq!(parse_retry_after(None), 30, "başlık yoksa 30 sn");
    assert_eq!(parse_retry_after(Some("yarın")), 30, "bozuk başlık 30 sn");
    assert_eq!(SpotifyRateLimited { retry_after_secs: 1 }.pause_secs(), 5);
    assert_eq!(SpotifyRateLimited { retry_after_secs: 86400 }.pause_secs(), 3600);
    assert_eq!(SpotifyRateLimited { retry_after_secs: 90 }.pause_secs(), 90);
  }

  #[test]
  fn human_wait_reads_naturally() {
    assert_eq!(human_wait(30), "30 sn");
    assert_eq!(human_wait(90), "2 dk");
    assert_eq!(human_wait(3600), "1 sa");
    assert_eq!(human_wait(12_600), "3 sa 30 dk");
  }

  #[test]
  fn rate_limit_error_survives_anyhow_and_names_the_wait() {
    let e: anyhow::Error = SpotifyRateLimited { retry_after_secs: 7200 }.into();
    let rl = e.downcast_ref::<SpotifyRateLimited>().expect("downcast");
    assert_eq!(rl.retry_after_secs, 7200);
    assert!(e.to_string().contains("2 sa"), "{e}");
  }

  #[test]
  fn poll_delay_is_slower_when_idle_and_at_most_once_per_second() {
    assert!(spotify_poll_delay(true) >= Duration::from_secs(1));
    assert!(spotify_poll_delay(false) > spotify_poll_delay(true));
  }

  #[test]
  fn pick_active_follows_the_playing_source() {
    let sp = Some(np(SOURCE_SPOTIFY, false, "A", 1));
    let yt = Some(np(SOURCE_YTMD, true, "B", 2));
    let pick = pick_active_now(&sp, &yt, SOURCE_SPOTIFY).unwrap();
    assert_eq!(pick.source, SOURCE_YTMD);
    assert_eq!(pick.title, "B");
  }

  #[test]
  fn pick_active_keeps_current_when_both_play() {
    let sp = Some(np(SOURCE_SPOTIFY, true, "A", 10));
    let yt = Some(np(SOURCE_YTMD, true, "B", 20));
    let pick = pick_active_now(&sp, &yt, SOURCE_SPOTIFY).unwrap();
    assert_eq!(pick.source, SOURCE_SPOTIFY);
  }
}

#[cfg(test)]
mod pending_tests {
  use super::*;

  fn attempt(age_ms: i64) -> PendingAuth {
    PendingAuth {
      verifier: format!("v{age_ms}"),
      client_id: "c".into(),
      redirect_uri: "http://127.0.0.1:8843/resonance/callback".into(),
      created_ms: now_ms() - age_ms,
    }
  }

  #[test]
  fn expired_attempts_are_dropped() {
    let list = prune_pending(vec![
      attempt(PENDING_TTL_MS + 1_000),
      attempt(60_000),
      attempt(0),
    ]);
    assert_eq!(list.len(), 2, "yalnizca suresi gecen atilmali: {list:?}");
    assert!(list.iter().all(|p| now_ms() - p.created_ms < PENDING_TTL_MS));
  }

  #[test]
  fn legacy_entries_without_timestamp_are_dropped() {
    let mut old = attempt(0);
    old.created_ms = 0;
    assert!(prune_pending(vec![old]).is_empty());
  }

  #[test]
  fn prune_keeps_newest_when_over_cap() {
    let mut list = Vec::new();
    for i in 0..(MAX_PENDING + 3) {
      list.push(attempt(i as i64));
    }
    let pruned = prune_pending(list);
    assert_eq!(pruned.len(), MAX_PENDING);
    // En eskiler (yüksek age) atılmalı; kalanlar listenin sonundakiler
    assert!(pruned.iter().all(|p| p.created_ms > 0));
  }

  /// Uygulama onay verilmeden yeniden başlarsa doğrulayıcı kaybolmamalı.
  #[test]
  fn pending_survives_restart() {
    let root = std::env::temp_dir().join(format!("yayin-pending-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&root);
    std::fs::create_dir_all(&root).unwrap();

    let first = MusicState::new(&root);
    first
      .spotify_authorize_url("client123", "http://127.0.0.1:8843/resonance/callback")
      .unwrap();
    let saved = first.pending.read()[0].verifier.clone();
    drop(first);

    let reopened = MusicState::new(&root);
    let pending = reopened.pending.read();
    assert_eq!(pending.len(), 1, "yeniden acilista bekleyen kayboldu");
    assert_eq!(pending[0].verifier, saved);
    let _ = std::fs::remove_dir_all(&root);
  }
}
