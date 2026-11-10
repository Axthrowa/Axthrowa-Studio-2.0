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

/// Aynı sürümlerin yayımladığı SHA-256 listeleri (`<özet>  <dosya adı>` satırları).
const YTDLP_OZET_URL: &str = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/SHA2-256SUMS";
const FFMPEG_OZET_URL: &str =
  "https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/checksums.sha256";

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

/// `sha256sum` biçimli listede `ad` dosyasının özeti (küçük harf onaltılık).
fn ozet_bul(liste: &str, ad: &str) -> Option<String> {
  liste.lines().find_map(|satir| {
    let (ozet, dosya) = satir.trim().split_once(char::is_whitespace)?;
    let dosya = dosya.trim().trim_start_matches('*');
    (dosya == ad && ozet.len() == 64 && ozet.bytes().all(|b| b.is_ascii_hexdigit()))
      .then(|| ozet.to_ascii_lowercase())
  })
}

/// İndirir; SHA-256 özeti `ozet_url` listesindekiyle tutmazsa dosyayı siler ve hata döner.
/// İndirilen exe/zip sonra ÇALIŞTIRILDIĞI için bozuk ya da değiştirilmiş dosya kurulmamalı.
async fn dosya_indir(url: &str, ozet_url: &str, hedef: &Path) -> anyhow::Result<()> {
  use futures_util::StreamExt;
  use sha2::{Digest, Sha256};

  let ad = url.rsplit('/').next().unwrap_or_default();
  let liste = reqwest::get(ozet_url).await?.error_for_status()?.text().await?;
  let beklenen = ozet_bul(&liste, ad).ok_or_else(|| anyhow::anyhow!("{ad} için SHA-256 özeti bulunamadı"))?;

  let res = reqwest::get(url).await?.error_for_status()?;
  if let Some(dir) = hedef.parent() {
    std::fs::create_dir_all(dir)?;
  }
  // Yarım kalan indirme "kurulu" sanılmasın diye önce geçici ada yazıp
  // tamamlanınca taşıyoruz.
  let gecici = hedef.with_extension("indiriliyor");
  let mut dosya = tokio::fs::File::create(&gecici).await?;
  let mut akis = res.bytes_stream();
  let mut sha = Sha256::new();
  while let Some(parca) = akis.next().await {
    use tokio::io::AsyncWriteExt;
    let parca = parca?;
    sha.update(&parca);
    dosya.write_all(&parca).await?;
  }
  {
    use tokio::io::AsyncWriteExt;
    dosya.flush().await?;
  }
  drop(dosya);
  let gelen: String = sha.finalize().iter().map(|b| format!("{b:02x}")).collect();
  if gelen != beklenen {
    let _ = std::fs::remove_file(&gecici);
    anyhow::bail!("{ad} SHA-256 tutmadı (beklenen {beklenen}, gelen {gelen}) — dosya kurulmadı");
  }
  std::fs::rename(&gecici, hedef)?;
  Ok(())
}

/// Uygulamanın kendi yt-dlp kopyası bu kadar eskiyse indirmeden önce güncellenir.
/// YouTube sık değişiyor; eski sürüm indirmenin ortasında 403 alabiliyor.
const GUNCELLEME_ARALIGI: std::time::Duration = std::time::Duration::from_secs(3 * 24 * 3600);

/// Kullanılacak yt-dlp ve kendini güncelleyip güncelleyemeyeceği.
struct Ytdlp {
  yol: PathBuf,
  /// Uygulamanın araç klasöründeki resmi tek dosyalık sürüm `-U` ile kendini
  /// günceller. PATH'teki kopya (winget/pip/scoop) bunu yapamaz; ona dokunulmaz.
  guncellenebilir: bool,
}

/// yt-dlp'yi hazırlar. Önce uygulamanın kendi kopyası (güncel tutulabildiği
/// için); o yoksa resmi sürüm indirilir. İndirilemezse PATH'teki kurulum
/// kullanılır — eski olabilir ama hiç yoktan iyidir.
///
/// Eskiden PATH'teki kopya önceydi; winget'in kurduğu sürüm kendini
/// güncelleyemediği için aylarca eski kaldı ve YouTube indirmeyi yarıda 403 ile
/// kesti (2026-10-07, kullanıcı makinesi).
async fn ytdlp_hazirla(root: &Path) -> anyhow::Result<Ytdlp> {
  let hedef = araclar_dizini(root).join("yt-dlp.exe");
  if hedef.is_file() {
    return Ok(Ytdlp { yol: hedef, guncellenebilir: true });
  }
  match dosya_indir(YTDLP_URL, YTDLP_OZET_URL, &hedef).await {
    Ok(()) => Ok(Ytdlp { yol: hedef, guncellenebilir: true }),
    Err(e) => match path_uzerinde("yt-dlp.exe") {
      Some(p) => Ok(Ytdlp { yol: p, guncellenebilir: false }),
      None => Err(e),
    },
  }
}

/// Dosya `aralik`tan daha eskiyse (ya da yaşı okunamıyorsa) `true`.
fn eski_mi(yol: &Path, aralik: std::time::Duration) -> bool {
  std::fs::metadata(yol)
    .and_then(|m| m.modified())
    .ok()
    .and_then(|t| t.elapsed().ok())
    .map(|yas| yas > aralik)
    .unwrap_or(true)
}

/// Kendi kopyamızı `yt-dlp -U` ile günceller. Başarısızlık indirmeyi
/// durdurmaz: eldeki sürümle denemeye devam edilir.
async fn ytdlp_guncelle(ytdlp: &Ytdlp) -> bool {
  if !ytdlp.guncellenebilir {
    return false;
  }
  let mut cmd = Command::new(&ytdlp.yol);
  cmd.arg("-U").stdout(Stdio::null()).stderr(Stdio::null());
  pencere_gizle(&mut cmd);
  let tamam = matches!(
    tokio::time::timeout(std::time::Duration::from_secs(120), cmd.status()).await,
    Ok(Ok(s)) if s.success()
  );
  if tamam {
    // Zaten güncel olsa da bir sonraki denetimi aralığın sonuna ertele.
    if let Ok(f) = std::fs::File::options().append(true).open(&ytdlp.yol) {
      let _ = f.set_modified(std::time::SystemTime::now());
    }
  }
  tamam
}

/// yt-dlp hata metni yeniden denemeye değer mi? YouTube veri akışını yarıda
/// reddettiğinde (403) ya da bağlantı koptuğunda yeni bir deneme imzalı
/// adresleri yeniden aldığı için çoğu zaman geçer; `.part` kaldığı yerden sürer.
pub fn yeniden_denenebilir(hata: &str) -> bool {
  let h = hata.to_lowercase();
  ["403", "forbidden", "http error 5", "timed out", "connection", "incomplete", "fragment"]
    .iter()
    .any(|k| h.contains(k))
}

/// Kullanıcıya gösterilecek hata metni.
pub fn hata_aciklamasi(hata: &str) -> String {
  let h = hata.to_lowercase();
  if h.contains("403") || h.contains("forbidden") {
    "YouTube indirmeyi reddetti (HTTP 403). Birkaç dakika sonra yeniden deneyin; sürerse video \
     bölge ya da yaş kısıtlı olabilir."
      .into()
  } else if h.contains("private video") || h.contains("sign in") {
    "Video gizli ya da oturum açmayı gerektiriyor; indirilemez.".into()
  } else if h.contains("unavailable") {
    "Video kullanılamıyor (kaldırılmış ya da bölgede engelli).".into()
  } else {
    hata.trim().to_string()
  }
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
  dosya_indir(FFMPEG_URL, FFMPEG_OZET_URL, &zip).await.ok()?;
  std::fs::create_dir_all(&kok).ok()?;
  // Windows 10 1803'ten beri bsdtar (`tar.exe`) sistemde hazır ve zip açıyor;
  // yalnızca bunun için ayrı bir arşiv bağımlılığı eklemeye değmez.
  let mut cmd = Command::new(crate::sistem_araci::yol("tar.exe"));
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
  // Liste (`/api/videos`) ve oynatma (`/assets/videos`) kökteki klasöre bakıyor.
  // Eskiden buraya `data_dir` yazılıyordu; taşınabilir kurulumda ikisi farklı
  // klasör olduğu için inen video panelde hiç görünmüyordu.
  let videolar = indirme_klasoru(&state.data_dir);
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
  if eski_mi(&ytdlp.yol, GUNCELLEME_ARALIGI) {
    guncelle(state, |d| d.message = "İndirme aracı güncelleniyor…".into());
    ytdlp_guncelle(&ytdlp).await;
    iptal_kontrol(state)?;
  }
  let ffmpeg = ffmpeg_hazirla(&state.data_dir).await;
  iptal_kontrol(state)?;

  // YouTube yarıda reddederse (403) araç güncellenip `.part` dosyasının
  // kaldığı yerden yeniden denenir. Paralel parça (`-N 4`) kullanılmıyor: bu
  // makinede üç denemenin ikisinde YouTube indirmeyi yarıda kesti (2026-10-07).
  const DENEME_SAYISI: usize = 3;
  let mut son_hata = String::new();
  for sira in 0..DENEME_SAYISI {
    if sira > 0 {
      if !yeniden_denenebilir(&son_hata) {
        break;
      }
      guncelle(state, |d| {
        d.phase = Phase::Araclar;
        d.percent = -1.0;
        d.message = format!(
          "YouTube bağlantıyı kesti, yeniden deneniyor ({}/{})…",
          sira + 1,
          DENEME_SAYISI
        );
      });
      if sira == 1 {
        ytdlp_guncelle(&ytdlp).await;
      }
      tokio::time::sleep(std::time::Duration::from_secs(2 * sira as u64)).await;
      iptal_kontrol(state)?;
    }
    match calistir(state, &ytdlp.yol, ffmpeg.as_deref(), &id, &videolar).await? {
      Ok(ad) => return Ok(ad),
      Err(hata) => son_hata = hata,
    }
  }
  anyhow::bail!("İndirme başarısız — {}", hata_aciklamasi(&son_hata))
}

/// yt-dlp'yi bir kez çalıştırır. Dış `Err`: iptal ya da süreç hatası (yeniden
/// denenmez); iç `Err`: yt-dlp'nin hata metni (yeniden denenebilir).
async fn calistir(
  state: &Arc<crate::AppState>,
  ytdlp: &Path,
  ffmpeg: Option<&Path>,
  id: &str,
  videolar: &Path,
) -> anyhow::Result<Result<String, String>> {
  guncelle(state, |d| {
    d.phase = Phase::Indiriliyor;
    d.percent = 0.0;
    d.message = "Başlıyor…".into();
  });

  let mut cmd = Command::new(ytdlp);
  cmd
    .arg("--no-playlist")
    .arg("--no-colors")
    .arg("--newline")
    // `--print` yt-dlp'yi sessize alıyor; sessizken ilerleme satırı gelmez,
    // çubuk "Başlıyor…"da kalır ve iptal de ancak iş bitince fark edilir.
    .arg("--no-quiet")
    // Sürüm uyarısı hata metninin yerine geçmesin; güncellemeyi biz yapıyoruz.
    .arg("--no-update")
    .arg("--retries")
    .arg("5")
    .arg("--fragment-retries")
    .arg("5")
    // Adlar URL'de ve dosya sisteminde sorun çıkarmasın: ASCII'ye indir.
    .arg("--restrict-filenames")
    .arg("--windows-filenames")
    .arg("-P")
    .arg(videolar)
    .arg("-o")
    .arg("%(title).60B-%(id)s.%(ext)s")
    .arg("--progress-template")
    .arg(format!(
      "{PROGRESS_TAG} %(progress._percent_str)s %(progress._speed_str)s %(progress._eta_str)s"
    ))
    .arg("--print")
    .arg(format!("after_move:{FILE_TAG}%(filepath)s"));

  if let Some(ff) = ffmpeg.and_then(|p| p.parent()) {
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
    return Ok(Err(if hata_metni.is_empty() {
      format!("yt-dlp çıkış kodu {}", durum.code().unwrap_or(-1))
    } else {
      hata_metni
    }));
  }

  let yol = dosya_yolu.ok_or_else(|| anyhow::anyhow!("İndirilen dosya bulunamadı"))?;
  let ad = yol
    .file_name()
    .map(|n| n.to_string_lossy().to_string())
    .ok_or_else(|| anyhow::anyhow!("Dosya adı okunamadı"))?;
  Ok(Ok(ad))
}

/// İndirilen videoların klasörü: panelin listelediği ve sunduğu yer.
pub fn indirme_klasoru(root: &Path) -> PathBuf {
  root.join("assets").join("videos")
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
  fn ozet_listesinden_dogru_dosya_secilir() {
    let a = "a".repeat(64);
    let b = "B".repeat(64);
    let liste = format!("{a}  yt-dlp\n{b}  yt-dlp.exe\nkisa  ffmpeg.zip\n{a} *ffmpeg.zip\n");
    assert_eq!(ozet_bul(&liste, "yt-dlp.exe"), Some("b".repeat(64)));
    assert_eq!(ozet_bul(&liste, "ffmpeg.zip"), Some(a.clone()));
    assert_eq!(ozet_bul(&liste, "yok.exe"), None);
    assert_eq!(ozet_bul("bozuk satir\n", "yt-dlp.exe"), None);
  }

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
  fn bosluklu_yuzdeyi_okur() {
    // yt-dlp yüzdeyi sağa yaslıyor: "  0.5%"
    let (yuzde, mesaj) = parse_progress("YYAILERLEME   0.5%    6.52MiB/s 00:00").unwrap();
    assert!((yuzde - 0.5).abs() < 1e-6);
    assert_eq!(mesaj, "6.52MiB/s — kalan 00:00");
  }

  #[test]
  fn yarida_reddedilen_indirme_yeniden_denenir() {
    // Kullanıcının makinesinde gözlenen gerçek hata metni (2026-10-07).
    assert!(yeniden_denenebilir(
      "ERROR: unable to download video data: HTTP Error 403: Forbidden"
    ));
    assert!(yeniden_denenebilir("ERROR: Read timed out."));
    assert!(!yeniden_denenebilir(
      "ERROR: [youtube] abc: Private video. Sign in if you have been granted access"
    ));
    assert!(!yeniden_denenebilir("ERROR: [youtube] abc: Video unavailable"));
  }

  #[test]
  fn hata_aciklamasi_anlasilir() {
    assert!(
      hata_aciklamasi("ERROR: unable to download video data: HTTP Error 403: Forbidden")
        .contains("403")
    );
    assert!(hata_aciklamasi("ERROR: [youtube] x: Private video. Sign in").contains("gizli"));
    assert_eq!(hata_aciklamasi("  başka hata "), "başka hata");
  }

  #[test]
  fn yeni_dosya_eski_sayilmaz_olmayan_dosya_eski_sayilir() {
    let gecici = std::env::temp_dir().join(format!("yya-ytdl-yas-{}", std::process::id()));
    std::fs::write(&gecici, b"x").unwrap();
    assert!(!eski_mi(&gecici, std::time::Duration::from_secs(3600)));
    let _ = std::fs::remove_file(&gecici);
    assert!(eski_mi(Path::new("C:/yok/yok/yt-dlp.exe"), std::time::Duration::from_secs(3600)));
  }

  #[test]
  fn indirilen_video_listelenen_klasore_yazilir() {
    // `/api/videos` ve `/assets/videos` `root/assets/videos`'a bakıyor.
    let kok = Path::new("C:/YYA");
    assert_eq!(indirme_klasoru(kok), kok.join("assets").join("videos"));
  }

  #[test]
  fn yuzde_araliga_sikistirilir() {
    let (yuzde, _) = parse_progress("YYAILERLEME 130.0% 1MiB/s 00:01").unwrap();
    assert_eq!(yuzde, 100.0);
  }
}
