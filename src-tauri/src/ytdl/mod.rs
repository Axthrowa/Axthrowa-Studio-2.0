//! YouTube arka planlarını yerele indirip yerel video olarak oynatmak.
//!
//! Neden var: arka plan bir YouTube `iframe`'i olduğu sürece videonun başında
//! başlık şeridi ile duraklat ikonu, sonunda da bitiş kartları çıkıyor. Bunlar
//! oynatıcının kendi arayüzü olduğu için dışarıdan ancak örtülebiliyor ya da
//! video erken sarılarak kaçınılabiliyor — ikisi de kusurlu. Video yerel bir
//! dosya olarak `<video>` ile oynatılınca ortada oynatıcı arayüzü kalmıyor,
//! döngü de gerçekten kesintisiz oluyor.
//!
//! İndirmeyi `yt-dlp` yapıyor. Kuruluma gömmek yerine ilk kullanımda
//! indiriyoruz: kurulum dosyası şişmiyor ve YouTube tarafı değişip araç
//! kırıldığında kullanıcı yeni sürüm beklemeden güncelleyebiliyor.

use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use parking_lot::RwLock;
use serde::Serialize;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

/// yt-dlp'nin Windows için tek dosyalık sürümü (~17 MB).
const YTDLP_URL: &str = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";

/// yt-dlp ekibinin kendi ffmpeg derlemesi. Ayrı akışlardaki 1080p görüntü ile
/// sesi tek mp4'te birleştirmek için gerekiyor; olmazsa en fazla 720p'lik
/// birleşik akışlar kalıyor.
const FFMPEG_URL: &str =
  "https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip";

/// İlerleme satırlarını yt-dlp'nin diğer çıktısından ayırmak için ön ek.
const PROGRESS_TAG: &str = "YYAILERLEME";
/// Tamamlanan dosyanın yolunu taşıyan satırın ön eki.
const FILE_TAG: &str = "YYADOSYA";

/// İndirmenin hangi aşamada olduğu. Panel bunu okunabilir metne çeviriyor.
#[derive(Clone, Copy, PartialEq, Eq, Serialize, Debug)]
#[serde(rename_all = "kebab-case")]
pub enum Phase {
  /// Hiç iş yok
  Bos,
  /// yt-dlp / ffmpeg indiriliyor
  Araclar,
  /// Video indiriliyor
  Indiriliyor,
  /// Görüntü ve ses tek dosyada birleştiriliyor
  Birlestiriliyor,
  Bitti,
  Hata,
  Iptal,
}

#[derive(Clone, Serialize, Debug)]
pub struct DownloadState {
  pub phase: Phase,
  pub url: String,
  /// 0..100. Aşama bilinmiyorsa -1.
  pub percent: f64,
  /// Kullanıcıya gösterilecek kısa açıklama (hız/ETA ya da hata metni).
  pub message: String,
  /// İş bitince `assets/videos` altındaki dosya adı.
  pub file: Option<String>,
}

impl Default for DownloadState {
  fn default() -> Self {
    Self {
      phase: Phase::Bos,
      url: String::new(),
      percent: -1.0,
      message: String::new(),
      file: None,
    }
  }
}

pub struct YtdlState {
  durum: RwLock<DownloadState>,
  /// Aynı anda tek indirme: iki iş aynı dosya adına yazmasın.
  mesgul: AtomicBool,
  iptal: AtomicBool,
}

impl Default for YtdlState {
  fn default() -> Self {
    Self::new()
  }
}

impl YtdlState {
  pub fn new() -> Self {
    Self {
      durum: RwLock::new(DownloadState::default()),
      mesgul: AtomicBool::new(false),
      iptal: AtomicBool::new(false),
    }
  }

  pub fn snapshot(&self) -> DownloadState {
    self.durum.read().clone()
  }

  /// Yeri kapmayı dener. Kapabildiyse `true`.
  ///
  /// "Boş mu?" diye sorup sonra ayrı bir adımda başlatmak yarış koşuluydu: iki
  /// eşzamanlı istek de boş görüp ikisi de "başladı" yanıtı alabiliyordu.
  /// Kontrol ile sahiplenme tek atomik adımda olmalı.
  pub fn yer_kap(&self) -> bool {
    self
      .mesgul
      .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
      .is_ok()
  }

  fn yeri_birak(&self) {
    self.mesgul.store(false, Ordering::SeqCst);
  }

  pub fn iptal_et(&self) {
    self.iptal.store(true, Ordering::SeqCst);
  }
}

/// Bir YouTube adresinden 11 karakterlik video kimliğini çıkarır.
///
/// Yalnızca doğrulama için: adresi yt-dlp'ye olduğu gibi veriyoruz ama önce
/// gerçekten bir YouTube bağlantısı olduğundan emin oluyoruz ki kabuk
/// üzerinden rastgele bir hedefe istek yaptırılamasın.
pub fn youtube_id(url: &str) -> Option<String> {
  let temiz = url.trim();
  let parsed = url::Url::parse(temiz).ok()?;
  let host = parsed.host_str()?.trim_start_matches("www.").to_lowercase();
  let gecerli = matches!(
    host.as_str(),
    "youtube.com" | "m.youtube.com" | "music.youtube.com" | "youtu.be" | "youtube-nocookie.com"
  );
  if !gecerli {
    return None;
  }
  let aday = if host == "youtu.be" {
    parsed.path().trim_matches('/').to_string()
  } else if let Some(v) = parsed
    .query_pairs()
    .find(|(k, _)| k == "v")
    .map(|(_, v)| v.to_string())
  {
    v
  } else {
    // /embed/<id>, /shorts/<id>, /live/<id>
    parsed
      .path()
      .rsplit('/')
      .find(|s| !s.is_empty())
      .unwrap_or("")
      .to_string()
  };
  let id: String = aday.chars().take_while(|c| *c != '&' && *c != '?').collect();
  if id.len() == 11 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
    Some(id)
  } else {
    None
  }
}

/// yt-dlp'nin `--progress-template` çıktısındaki yüzdeyi okur.
///
/// Gelen satır `YYAILERLEME 12.3% 1.20MiB/s 00:42` biçiminde. Yüzde yerine
/// `NA` gelebiliyor (boyut bilinmeyen akışlar); o durumda `None` dönüyoruz ki
/// çubuk sıfıra düşüp geri zıplamasın.
pub fn parse_progress(line: &str) -> Option<(f64, String)> {
  let kalan = line.strip_prefix(PROGRESS_TAG)?.trim();
  let mut parcalar = kalan.split_whitespace();
  let yuzde_ham = parcalar.next()?.trim_end_matches('%');
  let yuzde: f64 = yuzde_ham.parse().ok()?;
  let hiz = parcalar.next().unwrap_or("").trim();
  let eta = parcalar.next().unwrap_or("").trim();
  let mut mesaj = String::new();
  if !hiz.is_empty() && hiz != "NA" {
    mesaj.push_str(hiz);
  }
  if !eta.is_empty() && eta != "NA" {
    if !mesaj.is_empty() {
      mesaj.push_str(" — kalan ");
    }
    mesaj.push_str(eta);
  }
  Some((yuzde.clamp(0.0, 100.0), mesaj))
}

fn araclar_dizini(data_dir: &Path) -> PathBuf {
  data_dir.join("tools")
}

/// Ağaçta `ffmpeg.exe` arar (arşiv üst klasör adıyla açılıyor).
fn ffmpeg_bul(dir: &Path) -> Option<PathBuf> {
  let rd = std::fs::read_dir(dir).ok()?;
  for ent in rd.flatten() {
    let p = ent.path();
    if p.is_dir() {
      if let Some(bulunan) = ffmpeg_bul(&p) {
        return Some(bulunan);
      }
    } else if p.file_name().map(|n| n == "ffmpeg.exe").unwrap_or(false) {
      return Some(p);
    }
  }
  None
}

/// PATH üzerinde çalıştırılabilir arar; kullanıcının kendi kurulumu varsa
/// ikinci bir kopya indirmeyelim.
fn path_uzerinde(ad: &str) -> Option<PathBuf> {
  let path = std::env::var_os("PATH")?;
  std::env::split_paths(&path)
    .map(|p| p.join(ad))
    .find(|p| p.is_file())
}

async fn dosya_indir(url: &str, hedef: &Path) -> anyhow::Result<()> {
  use futures_util::StreamExt;

  let res = reqwest::get(url).await?.error_for_status()?;
  if let Some(dir) = hedef.parent() {
    std::fs::create_dir_all(dir)?;
  }
  // Yarım kalan indirme "kurulu" sanılmasın diye önce geçici ada yazıp
  // tamamlanınca taşıyoruz.
  let gecici = hedef.with_extension("indiriliyor");
  let mut dosya = tokio::fs::File::create(&gecici).await?;
  let mut akis = res.bytes_stream();
  while let Some(parca) = akis.next().await {
    use tokio::io::AsyncWriteExt;
    dosya.write_all(&parca?).await?;
  }
  {
    use tokio::io::AsyncWriteExt;
    dosya.flush().await?;
  }
  drop(dosya);
  std::fs::rename(&gecici, hedef)?;
  Ok(())
}

/// yt-dlp yolunu döndürür, yoksa indirir.
async fn ytdlp_hazirla(root: &Path) -> anyhow::Result<PathBuf> {
  if let Some(p) = path_uzerinde("yt-dlp.exe") {
    return Ok(p);
  }
  let hedef = araclar_dizini(root).join("yt-dlp.exe");
  if hedef.is_file() {
    return Ok(hedef);
  }
  dosya_indir(YTDLP_URL, &hedef).await?;
  Ok(hedef)
}

/// İndirmeden, bu makinede hazır ffmpeg'i bulur (PATH ya da uygulamanın araç klasörü).
/// Çoklu yayın yönlendiricisi de bunu kullanır.
pub fn ffmpeg_yolu(data_dir: &Path) -> Option<PathBuf> {
  path_uzerinde("ffmpeg.exe").or_else(|| ffmpeg_bul(&araclar_dizini(data_dir).join("ffmpeg")))
}

/// ffmpeg yolunu döndürür. Bulunamaz/indirilemezse `None`: bu durumda
/// yt-dlp'yi birleşik (en fazla 720p) akışla çalıştırıyoruz — kalite düşük
/// olsa da indirme tamamen başarısız olmasın.
async fn ffmpeg_hazirla(root: &Path) -> Option<PathBuf> {
  if let Some(p) = path_uzerinde("ffmpeg.exe") {
    return Some(p);
  }
  let kok = araclar_dizini(root).join("ffmpeg");
  if let Some(p) = ffmpeg_bul(&kok) {
    return Some(p);
  }
  let zip = araclar_dizini(root).join("ffmpeg.zip");
  dosya_indir(FFMPEG_URL, &zip).await.ok()?;
  std::fs::create_dir_all(&kok).ok()?;
  // Windows 10 1803'ten beri bsdtar (`tar.exe`) sistemde hazır ve zip açıyor;
  // yalnızca bunun için ayrı bir arşiv bağımlılığı eklemeye değmez.
  let mut cmd = Command::new("tar");
  cmd.arg("-xf").arg(&zip).current_dir(&kok);
  pencere_gizle(&mut cmd);
  let cikti = cmd.status().await.ok()?;
  let _ = std::fs::remove_file(&zip);
  if !cikti.success() {
    return None;
  }
  ffmpeg_bul(&kok)
}

#[cfg(windows)]
fn pencere_gizle(cmd: &mut Command) {
  // Yoksa her indirmede siyah bir konsol penceresi açılıp kapanıyor.
  const CREATE_NO_WINDOW: u32 = 0x0800_0000;
  cmd.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
fn pencere_gizle(_cmd: &mut Command) {}

/// İndirmeyi yürütür; durum değiştikçe WebSocket'ten yayınlanır.
///
/// Çağrılmadan önce [`YtdlState::yer_kap`] ile yer kapılmış olmalı; bu işlev
/// bittiğinde yeri bırakır.
pub async fn indir(state: Arc<crate::AppState>, url: String) -> anyhow::Result<()> {
  let ytdl = state.ytdl.clone();
  ytdl.iptal.store(false, Ordering::SeqCst);

  let sonuc = indir_ic(&state, &url).await;

  ytdl.yeri_birak();
  match sonuc {
    Ok(dosya) => {
      guncelle(&state, |d| {
        d.phase = Phase::Bitti;
        d.percent = 100.0;
        d.message = "Video yerele kaydedildi".into();
        d.file = Some(dosya.clone());
      });
      Ok(())
    }
    Err(e) => {
      let iptal = ytdl.iptal.load(Ordering::SeqCst);
      guncelle(&state, |d| {
        d.phase = if iptal { Phase::Iptal } else { Phase::Hata };
        d.percent = -1.0;
        d.message = if iptal {
          "İndirme iptal edildi".into()
        } else {
          e.to_string()
        };
      });
      if iptal {
        Ok(())
      } else {
        Err(e)
      }
    }
  }
}

fn guncelle(state: &crate::AppState, f: impl FnOnce(&mut DownloadState)) {
  let anlik = {
    let mut d = state.ytdl.durum.write();
    f(&mut d);
    d.clone()
  };
  let mut yuk = serde_json::to_value(&anlik).unwrap_or_else(|_| serde_json::json!({}));
  if let Some(o) = yuk.as_object_mut() {
    o.insert("type".into(), serde_json::json!("video-download"));
  }
  state.broadcast_json(&yuk);
}

async fn indir_ic(state: &Arc<crate::AppState>, url: &str) -> anyhow::Result<String> {
  let id = youtube_id(url).ok_or_else(|| anyhow::anyhow!("Geçerli bir YouTube adresi değil"))?;
  let videolar = state.data_dir.join("assets").join("videos");
  std::fs::create_dir_all(&videolar)?;

  guncelle(state, |d| {
    *d = DownloadState {
      phase: Phase::Araclar,
      url: url.to_string(),
      percent: -1.0,
      message: "İndirme aracı hazırlanıyor…".into(),
      file: None,
    };
  });

  let ytdlp = ytdlp_hazirla(&state.data_dir)
    .await
    .map_err(|e| anyhow::anyhow!("yt-dlp indirilemedi: {e}"))?;
  iptal_kontrol(state)?;
  let ffmpeg = ffmpeg_hazirla(&state.data_dir).await;
  iptal_kontrol(state)?;

  guncelle(state, |d| {
    d.phase = Phase::Indiriliyor;
    d.percent = 0.0;
    d.message = "Başlıyor…".into();
  });

  let mut cmd = Command::new(&ytdlp);
  cmd
    .arg("--no-playlist")
    .arg("--no-colors")
    .arg("--newline")
    // Adlar URL'de ve dosya sisteminde sorun çıkarmasın: ASCII'ye indir.
    .arg("--restrict-filenames")
    .arg("--windows-filenames")
    .arg("-N")
    .arg("4")
    .arg("-P")
    .arg(&videolar)
    .arg("-o")
    .arg("%(title).60B-%(id)s.%(ext)s")
    .arg("--progress-template")
    .arg(format!(
      "{PROGRESS_TAG} %(progress._percent_str)s %(progress._speed_str)s %(progress._eta_str)s"
    ))
    .arg("--print")
    .arg(format!("after_move:{FILE_TAG}%(filepath)s"));

  if let Some(ff) = ffmpeg.as_ref().and_then(|p| p.parent()) {
    // 1080p görüntü + ses ayrı akışlarda geliyor, birleştirmek ffmpeg istiyor.
    cmd
      .arg("--ffmpeg-location")
      .arg(ff)
      .arg("--merge-output-format")
      .arg("mp4")
      .arg("-f")
      .arg("bv*[height<=?1080]+ba/b[height<=?1080]/b");
  } else {
    // ffmpeg yoksa yalnızca hazır birleşik akışlar kullanılabilir.
    cmd.arg("-f").arg("b[ext=mp4]/b");
  }

  cmd
    .arg(format!("https://www.youtube.com/watch?v={id}"))
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());
  pencere_gizle(&mut cmd);

  let mut child = cmd.spawn().map_err(|e| anyhow::anyhow!("yt-dlp çalıştırılamadı: {e}"))?;
  // Panik yerine hata: bu görev sunucunun içinde koşuyor.
  let stdout = child
    .stdout
    .take()
    .ok_or_else(|| anyhow::anyhow!("yt-dlp çıktısı okunamadı"))?;
  let stderr = child
    .stderr
    .take()
    .ok_or_else(|| anyhow::anyhow!("yt-dlp hata çıktısı okunamadı"))?;

  let mut satirlar = BufReader::new(stdout).lines();
  let mut hata_satirlari = BufReader::new(stderr).lines();
  // stderr'i paralel topla: boru dolup yt-dlp'yi kilitlemesin.
  let hata_gorevi = tokio::spawn(async move {
    let mut son = String::new();
    while let Ok(Some(l)) = hata_satirlari.next_line().await {
      if l.contains("ERROR") || son.is_empty() {
        son = l;
      }
    }
    son
  });

  let mut dosya_yolu: Option<PathBuf> = None;
  let mut son_yayin = -10.0_f64;

  while let Some(satir) = satirlar.next_line().await? {
    if state.ytdl.iptal.load(Ordering::SeqCst) {
      let _ = child.start_kill();
      anyhow::bail!("iptal");
    }
    if let Some(yol) = satir.trim().strip_prefix(FILE_TAG) {
      dosya_yolu = Some(PathBuf::from(yol.trim()));
      continue;
    }
    if let Some((yuzde, mesaj)) = parse_progress(satir.trim()) {
      // Her satırda yayın yapmak WebSocket'i boğuyor; gözle görülür adımlarda
      // yayınlıyoruz.
      if (yuzde - son_yayin).abs() >= 0.5 || yuzde >= 100.0 {
        son_yayin = yuzde;
        guncelle(state, |d| {
          d.phase = Phase::Indiriliyor;
          d.percent = yuzde;
          d.message = mesaj;
        });
      }
      continue;
    }
    if satir.contains("[Merger]") || satir.contains("[VideoRemuxer]") {
      guncelle(state, |d| {
        d.phase = Phase::Birlestiriliyor;
        d.percent = -1.0;
        d.message = "Görüntü ve ses birleştiriliyor…".into();
      });
    }
  }

  let durum = child.wait().await?;
  let hata_metni = hata_gorevi.await.unwrap_or_default();
  if !durum.success() {
    let ek = if hata_metni.is_empty() {
      String::new()
    } else {
      format!(" — {hata_metni}")
    };
    anyhow::bail!("İndirme başarısız{ek}");
  }

  let yol = dosya_yolu.ok_or_else(|| anyhow::anyhow!("İndirilen dosya bulunamadı"))?;
  let ad = yol
    .file_name()
    .map(|n| n.to_string_lossy().to_string())
    .ok_or_else(|| anyhow::anyhow!("Dosya adı okunamadı"))?;
  Ok(ad)
}

fn iptal_kontrol(state: &crate::AppState) -> anyhow::Result<()> {
  if state.ytdl.iptal.load(Ordering::SeqCst) {
    anyhow::bail!("iptal");
  }
  Ok(())
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn youtube_id_yaygin_bicimleri_tanir() {
    let bekleniyor = Some("dQw4w9WgXcQ".to_string());
    assert_eq!(youtube_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), bekleniyor);
    assert_eq!(youtube_id("https://youtu.be/dQw4w9WgXcQ"), bekleniyor);
    assert_eq!(youtube_id("https://www.youtube.com/embed/dQw4w9WgXcQ"), bekleniyor);
    assert_eq!(youtube_id("https://www.youtube.com/shorts/dQw4w9WgXcQ"), bekleniyor);
    assert_eq!(
      youtube_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123"),
      bekleniyor
    );
  }

  #[test]
  fn youtube_disi_adresleri_reddeder() {
    // Adresi kabuğa veriyoruz; yalnızca YouTube'a izin vermek gerekiyor.
    assert_eq!(youtube_id("https://ornek.com/watch?v=dQw4w9WgXcQ"), None);
    assert_eq!(youtube_id("dosya:///C:/gizli.txt"), None);
    assert_eq!(youtube_id("https://www.youtube.com/watch?v=kisa"), None);
    assert_eq!(youtube_id(""), None);
  }

  #[test]
  fn ilerleme_satirini_okur() {
    let (yuzde, mesaj) = parse_progress("YYAILERLEME 12.3% 1.20MiB/s 00:42").unwrap();
    assert!((yuzde - 12.3).abs() < 1e-6);
    assert_eq!(mesaj, "1.20MiB/s — kalan 00:42");
  }

  #[test]
  fn bilinmeyen_yuzdede_ilerleme_bildirmez() {
    // Boyutu bilinmeyen akışlarda yt-dlp "NA" yazıyor; çubuk sıfıra düşmesin.
    assert!(parse_progress("YYAILERLEME NA NA NA").is_none());
    assert!(parse_progress("[download] Destination: video.mp4").is_none());
  }

  #[test]
  fn yuzde_araliga_sikistirilir() {
    let (yuzde, _) = parse_progress("YYAILERLEME 130.0% 1MiB/s 00:01").unwrap();
    assert_eq!(yuzde, 100.0);
  }
}
