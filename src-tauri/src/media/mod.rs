use std::fs::File;
#[cfg(test)]
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

use anyhow::{anyhow, Result};
use http::{header, StatusCode};
use http_range::HttpRange;

pub mod paths;

/// Range yanıtlarında tek seferde gönderilecek en büyük parça.
/// Küçük tutmak arama (seek) gecikmesini düşürür, RAM'i korur.
const RANGE_CHUNK: u64 = 4 * 1024 * 1024;
/// Bu boyuta kadar olan dosyalar Range olmadan tamamen gönderilir.
#[cfg(test)]
const FULL_MAX: u64 = 8 * 1024 * 1024;

pub fn mime_for(path: &Path) -> &'static str {
  match path
    .extension()
    .and_then(|e| e.to_str())
    .unwrap_or("")
    .to_lowercase()
    .as_str()
  {
    "mp4" | "m4v" => "video/mp4",
    "webm" => "video/webm",
    "mov" => "video/quicktime",
    "mkv" => "video/x-matroska",
    "avi" => "video/x-msvideo",
    "mp3" => "audio/mpeg",
    "wav" => "audio/wav",
    "ogg" | "oga" => "audio/ogg",
    "opus" => "audio/ogg",
    "flac" => "audio/flac",
    "aac" | "m4a" => "audio/mp4",
    "png" | "apng" => "image/png",
    "jpg" | "jpeg" => "image/jpeg",
    "webp" => "image/webp",
    "gif" => "image/gif",
    "svg" => "image/svg+xml",
    "avif" => "image/avif",
    _ => "application/octet-stream",
  }
}

/// Sunulabilir medya dosyası mı (video / ses / görsel)?
///
/// `/media/file` mutlak yol alır: kullanıcı kitaplık dışındaki bir klasörden de
/// video seçebiliyor. Uzantı sınırı olmadan bu uç diskteki HER dosyayı
/// sunuyordu (tarayıcı çerezleri, anahtarlar, yapılandırmalar).
pub fn is_media_file(path: &Path) -> bool {
  mime_for(path) != "application/octet-stream"
}

/// Yalnız bu makinenin diski: `C:\…` (ve `\\?\C:\…`). UNC (`\\sunucu\…`),
/// `\\?\UNC\…` ve aygıt ad alanı (`\\.\…`) ağ ya da aygıt erişimi demektir.
/// Windows dışında yalnız kökten başlayan yollar.
pub fn yerel_disk_yolu(path: &Path) -> bool {
  use std::path::{Component, Prefix};
  match path.components().next() {
    Some(Component::Prefix(p)) => matches!(p.kind(), Prefix::Disk(_) | Prefix::VerbatimDisk(_)),
    Some(Component::RootDir) => !cfg!(windows),
    _ => false,
  }
}

pub fn sanitize_path(raw: &str) -> Result<PathBuf> {
  let trimmed = raw.trim();
  if trimmed.is_empty() {
    return Err(anyhow!("boş yol"));
  }
  // Query/protocol katmanları çift kodlanmış olabilir — en fazla iki kez çöz.
  let mut decoded = trimmed.to_string();
  for _ in 0..2 {
    match urlencoding::decode(&decoded) {
      Ok(d) => {
        let d = d.into_owned();
        if d == decoded {
          break;
        }
        decoded = d;
      }
      Err(_) => break,
    }
  }
  decoded = percent_encoding::percent_decode_str(decoded.trim_start_matches('/'))
    .decode_utf8_lossy()
    .to_string();

  // NUL / kontrol karakteri enjeksiyonu
  if decoded.chars().any(|c| c == '\0') {
    return Err(anyhow!("geçersiz yol"));
  }

  // Windows ayırıcılarını normalize et
  let decoded = decoded.replace('/', std::path::MAIN_SEPARATOR_STR);
  let path = PathBuf::from(&decoded);

  if path
    .components()
    .any(|c| matches!(c, std::path::Component::ParentDir))
  {
    return Err(anyhow!("path traversal engellendi"));
  }
  if !path.is_absolute() {
    return Err(anyhow!("mutlak yol gerekli: {decoded}"));
  }
  // GÜVENLİK: `\\sunucu\paylasim\x.png` (UNC) yolları reddedilir. `/media/file` GET olduğu için
  // köken denetimine girmez; yayıncının açtığı herhangi bir site `<img src=…?path=\\saldirgan\x>`
  // ile Windows'u saldırgan sunucuya SMB bağlantısı açmaya — NTLM özetini göndermeye — zorlayabiliyordu.
  if !yerel_disk_yolu(&path) {
    return Err(anyhow!("yalnız yerel disk yolları sunulur"));
  }
  // Varlık denetiminden ÖNCE: medya dışı dosyaların var olup olmadığı da
  // dışarıya sızmasın.
  if !is_media_file(&path) {
    return Err(anyhow!("yalnız video / ses / görsel dosyaları sunulur"));
  }
  if !path.is_file() {
    return Err(anyhow!("dosya bulunamadı: {}", path.display()));
  }
  Ok(path)
}

/// Bir Range isteğinin çözümlenmiş hâli — gövde bu plana göre üretilir.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RangePlan {
  pub status: u16,
  /// Dosya içindeki başlangıç offset'i
  pub start: u64,
  /// Gönderilecek bayt sayısı
  pub len: u64,
  /// Dosyanın tam boyutu
  pub total: u64,
  /// 206 ise Content-Range başlığı gerekir
  pub partial: bool,
}

/// Range başlığını dosya boyutuna göre çözümler.
/// Range yoksa **asla** 206 üretmez — `<video>` bunu bozuk sayar.
pub fn plan_range(total: u64, range_header: Option<&str>) -> RangePlan {
  let Some(raw) = range_header.map(str::trim).filter(|s| !s.is_empty()) else {
    // Range yok → 200. Büyük dosyada bile Content-Length tam boyuttur;
    // gövde akış (stream) olarak gönderilir.
    return RangePlan {
      status: 200,
      start: 0,
      len: total,
      total,
      partial: false,
    };
  };

  if total == 0 {
    return RangePlan {
      status: 416,
      start: 0,
      len: 0,
      total,
      partial: false,
    };
  }

  match HttpRange::parse(raw, total) {
    Ok(ranges) if !ranges.is_empty() => {
      let r = ranges[0];
      let start = r.start.min(total.saturating_sub(1));
      // Çok büyük istekleri parçala; tarayıcı kalanını yeni Range ile ister.
      let want = r.length.clamp(1, RANGE_CHUNK);
      let len = want.min(total - start);
      RangePlan {
        status: 206,
        start,
        len,
        total,
        partial: true,
      }
    }
    _ => RangePlan {
      status: 416,
      start: 0,
      len: 0,
      total,
      partial: false,
    },
  }
}

fn base_headers(mime: &str) -> http::response::Builder {
  http::Response::builder()
    .header(header::CONTENT_TYPE, mime)
    .header(header::ACCEPT_RANGES, "bytes")
    // Köken izni sunucunun CORS katmanına bırakılır (yalnız yerel kökenler).
    // Eskiden burada `*` vardı: ziyaret edilen herhangi bir site dosyayı
    // okuyabiliyordu.
    .header(
      header::ACCESS_CONTROL_EXPOSE_HEADERS,
      "content-range, accept-ranges, content-length",
    )
    .header(header::X_CONTENT_TYPE_OPTIONS, "nosniff")
    // SVG doğrudan açılırsa betik çalıştırmasın (bu köken Tauri IPC'ye erişebilir).
    .header(header::CONTENT_SECURITY_POLICY, "sandbox")
    .header(header::CACHE_CONTROL, "public, max-age=3600")
}

/// Plana göre ortak başlıkları kurar (gövde hariç).
pub fn headers_for(path: &Path, plan: &RangePlan) -> http::response::Builder {
  let mut b = base_headers(mime_for(path)).status(
    StatusCode::from_u16(plan.status).unwrap_or(StatusCode::OK),
  );
  if plan.status == 416 {
    b = b.header(header::CONTENT_RANGE, format!("bytes */{}", plan.total));
    return b.header(header::CONTENT_LENGTH, 0);
  }
  b = b.header(header::CONTENT_LENGTH, plan.len);
  if plan.partial {
    let end = plan.start + plan.len.saturating_sub(1);
    b = b.header(
      header::CONTENT_RANGE,
      format!("bytes {}-{}/{}", plan.start, end, plan.total),
    );
  }
  b
}

pub fn file_len(path: &Path) -> Result<u64> {
  Ok(File::open(path)?.metadata()?.len())
}

/// Belleğe alınmış yanıt — yalnızca testler için.
///
/// Eskiden uygulama içi önizleme `stream://` protokolünü kullanıyordu; medya
/// artık tamamen `/media/file` üzerinden akıtıldığı için protokol kaldırıldı.
/// Bu yardımcı, HTTP yolunun da paylaştığı aralık planı ve başlık kurulumunu
/// sınamak için duruyor.
#[cfg(test)]
pub fn stream_file_response(
  path: &Path,
  range_header: Option<&str>,
) -> Result<http::Response<Vec<u8>>> {
  let mut file = File::open(path)?;
  let total = file.metadata()?.len();
  let mut plan = plan_range(total, range_header);

  // Belleğe alma sınırı: Range olmayan dev dosyayı tümüyle okumayalım.
  if !plan.partial && plan.len > FULL_MAX {
    plan.partial = true;
    plan.status = 206;
    plan.len = RANGE_CHUNK.min(total);
  }

  let builder = headers_for(path, &plan);
  if plan.status == 416 || plan.len == 0 {
    return Ok(builder.body(Vec::new())?);
  }

  file.seek(SeekFrom::Start(plan.start))?;
  let mut buf = vec![0u8; plan.len as usize];
  file.read_exact(&mut buf)?;
  Ok(builder.body(buf)?)
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::io::Write;

  #[cfg(windows)]
  #[test]
  fn unc_ve_aygit_yollari_reddedilir() {
    assert!(yerel_disk_yolu(Path::new(r"C:\Videolar\a.mp4")));
    assert!(yerel_disk_yolu(Path::new(r"\\?\C:\Videolar\a.mp4")));
    assert!(!yerel_disk_yolu(Path::new(r"\\saldirgan\pay\a.png")));
    assert!(!yerel_disk_yolu(Path::new(r"\\?\UNC\saldirgan\pay\a.png")));
    assert!(!yerel_disk_yolu(Path::new(r"\\.\pipe\a.png")));
    assert!(!yerel_disk_yolu(Path::new(r"\Videolar\a.mp4")));
    for kotu in [r"\\saldirgan\pay\a.png", "%5C%5Csaldirgan%5Cpay%5Ca.png", "//saldirgan/pay/a.png"] {
      let hata = sanitize_path(kotu).unwrap_err().to_string();
      assert!(hata.contains("yerel disk") || hata.contains("mutlak"), "{kotu}: {hata}");
    }
  }

  fn temp_file(name: &str, bytes: usize) -> PathBuf {
    let dir = std::env::temp_dir().join("yayin-media-test");
    let _ = std::fs::create_dir_all(&dir);
    let path = dir.join(name);
    let mut f = File::create(&path).unwrap();
    let data: Vec<u8> = (0..bytes).map(|i| (i % 251) as u8).collect();
    f.write_all(&data).unwrap();
    f.flush().unwrap();
    path
  }

  #[test]
  fn no_range_never_returns_206_for_small_file() {
    let path = temp_file("small.mp4", 40_000);
    let plan = plan_range(40_000, None);
    assert_eq!(plan.status, 200);
    assert!(!plan.partial);
    assert_eq!(plan.len, 40_000);

    let resp = stream_file_response(&path, None).unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    assert_eq!(resp.body().len(), 40_000);
    assert!(resp.headers().get(header::CONTENT_RANGE).is_none());
  }

  #[test]
  fn range_returns_exact_slice() {
    let path = temp_file("range.mp4", 40_000);
    let resp = stream_file_response(&path, Some("bytes=100-1099")).unwrap();
    assert_eq!(resp.status(), StatusCode::PARTIAL_CONTENT);
    assert_eq!(resp.body().len(), 1000);
    assert_eq!(
      resp.headers().get(header::CONTENT_RANGE).unwrap(),
      "bytes 100-1099/40000"
    );
    // temp_file baytları `i % 251`: 100. bayt 100'dür.
    assert_eq!(resp.body()[0], 100_u8);
  }

  #[test]
  fn open_ended_range_is_capped_but_valid() {
    let plan = plan_range(200 * 1024 * 1024, Some("bytes=0-"));
    assert_eq!(plan.status, 206);
    assert_eq!(plan.start, 0);
    assert_eq!(plan.len, RANGE_CHUNK);
    assert_eq!(plan.total, 200 * 1024 * 1024);
  }

  #[test]
  fn suffix_range_reads_tail() {
    let plan = plan_range(10_000, Some("bytes=-500"));
    assert_eq!(plan.status, 206);
    assert_eq!(plan.start, 9_500);
    assert_eq!(plan.len, 500);
  }

  #[test]
  fn invalid_range_is_416() {
    let plan = plan_range(1_000, Some("bytes=5000-6000"));
    assert_eq!(plan.status, 416);
    let plan2 = plan_range(1_000, Some("çöp"));
    assert_eq!(plan2.status, 416);
  }

  #[test]
  fn empty_range_header_is_treated_as_no_range() {
    let plan = plan_range(1_000, Some("   "));
    assert_eq!(plan.status, 200);
    assert_eq!(plan.len, 1_000);
  }

  #[test]
  fn sanitize_rejects_traversal_and_relative() {
    assert!(sanitize_path("../../etc/passwd").is_err());
    assert!(sanitize_path("relative/file.mp4").is_err());
    assert!(sanitize_path("").is_err());
    assert!(sanitize_path("C:\\yok\\olmayan\\dosya.mp4").is_err());
  }

  #[test]
  fn sanitize_rejects_non_media_files() {
    // Var olan ama medya olmayan dosya: eskiden olduğu gibi sunulurdu.
    for ad in ["gizli.json", "Cookies", "id_rsa", "ayar.ini"] {
      let path = temp_file(ad, 16);
      let encoded = urlencoding::encode(&path.to_string_lossy()).into_owned();
      assert!(sanitize_path(&encoded).is_err(), "engellenmeliydi: {ad}");
    }
    assert!(is_media_file(Path::new("a.MP4")));
    assert!(is_media_file(Path::new("a.png")));
    assert!(!is_media_file(Path::new("a.sqlite")));
  }

  #[test]
  fn media_headers_do_not_open_cors_to_everyone() {
    let plan = plan_range(10, None);
    let resp = headers_for(Path::new("a.mp4"), &plan).body(()).unwrap();
    assert!(resp.headers().get(header::ACCESS_CONTROL_ALLOW_ORIGIN).is_none());
    assert_eq!(resp.headers().get(header::X_CONTENT_TYPE_OPTIONS).unwrap(), "nosniff");
  }

  #[test]
  fn sanitize_accepts_encoded_real_path() {
    let path = temp_file("boşluk lu ad.mp4", 64);
    let encoded = urlencoding::encode(&path.to_string_lossy()).into_owned();
    let out = sanitize_path(&encoded).unwrap();
    assert_eq!(out, path);
  }

  #[test]
  fn mime_covers_common_media() {
    assert_eq!(mime_for(Path::new("a.mp4")), "video/mp4");
    assert_eq!(mime_for(Path::new("a.WEBM")), "video/webm");
    assert_eq!(mime_for(Path::new("a.m4a")), "audio/mp4");
    assert_eq!(mime_for(Path::new("a.apng")), "image/png");
    assert_eq!(mime_for(Path::new("a.xyz")), "application/octet-stream");
  }

  #[test]
  fn large_file_without_range_is_memory_capped() {
    // plan 200 der ama belleğe alma sınırı 206'ya düşürür — yine de geçerli.
    let path = temp_file("big.mp4", (FULL_MAX + 1024) as usize);
    let resp = stream_file_response(&path, None).unwrap();
    assert_eq!(resp.status(), StatusCode::PARTIAL_CONTENT);
    assert!(resp.headers().get(header::CONTENT_RANGE).is_some());
    assert_eq!(resp.body().len() as u64, RANGE_CHUNK.min(FULL_MAX + 1024));
  }
}
