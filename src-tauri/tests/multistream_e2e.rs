//! Çoklu yayın uçtan uca: gerçek FFmpeg süreçleriyle, gerçek platform OLMADAN.
//!
//! Kaynak: FFmpeg `testsrc2` + sinüs (OBS yerine) → yönlendiricinin alıcısı.
//! Hedefler: yerel FFmpeg RTMP dinleyicileri (dosyaya yazar).
//! Senaryo: A baştan başlar ve yayın sürerken tek başına durdurulur; B geç katılır.
//! FFmpeg bulunamazsa test açıklamayla atlanır (CI'da FFmpeg yoksa).

use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;
use std::time::Duration;

use tokio::process::Command;
use tokio::sync::broadcast;
use axthrowa_studio_lib::multistream::config::{DestinationConfig, Platform};
use axthrowa_studio_lib::multistream::state::DestState;
use axthrowa_studio_lib::multistream::{MemoryStore, Router};

fn ffmpeg() -> Option<PathBuf> {
  let out = std::process::Command::new("where").arg("ffmpeg").output().ok()?;
  let s = String::from_utf8_lossy(&out.stdout);
  s.lines().next().map(|l| PathBuf::from(l.trim())).filter(|p| p.exists())
}

fn free_port() -> u16 {
  TcpListener::bind("127.0.0.1:0").unwrap().local_addr().unwrap().port()
}

fn listener(ff: &Path, port: u16, out: &Path) -> tokio::process::Child {
  Command::new(ff)
    .args(["-hide_banner", "-loglevel", "error", "-listen", "1", "-i"])
    .arg(format!("rtmp://127.0.0.1:{port}/live/test"))
    .args(["-c", "copy", "-f", "flv", "-y"])
    .arg(out)
    .stdin(Stdio::null())
    .stdout(Stdio::null())
    .stderr(Stdio::null())
    .kill_on_drop(true)
    .spawn()
    .unwrap()
}

/// (kare sayısı, çözme hatası satırı)
fn inspect(ff: &Path, file: &Path) -> (u64, usize) {
  let probe = ff.with_file_name("ffprobe.exe");
  let frames = std::process::Command::new(&probe)
    .args(["-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0"])
    .arg(file)
    .output()
    .ok()
    .and_then(|o| String::from_utf8_lossy(&o.stdout).trim().parse::<u64>().ok())
    .unwrap_or(0);
  let errors = std::process::Command::new(ff)
    .args(["-v", "error", "-i"])
    .arg(file)
    .args(["-f", "null", "-"])
    .output()
    .map(|o| String::from_utf8_lossy(&o.stderr).lines().count())
    .unwrap_or(99);
  (frames, errors)
}

fn dest(id: &str, port: u16) -> DestinationConfig {
  DestinationConfig {
    id: id.into(),
    name: format!("Hedef {id}"),
    platform: Platform::Custom,
    server: format!("rtmp://127.0.0.1:{port}/live"),
    enabled: true,
  }
}

#[tokio::test]
async fn tek_kodlama_iki_hedef_bagimsiz_baslat_durdur() {
  let Some(ff) = ffmpeg() else {
    eprintln!("FFmpeg bulunamadı — uçtan uca çoklu yayın testi atlandı");
    return;
  };
  let dir = std::env::temp_dir().join(format!("studio-ms-{}", free_port()));
  std::fs::create_dir_all(&dir).unwrap();
  let (pa, pb) = (free_port(), free_port());
  let (fa, fb) = (dir.join("a.flv"), dir.join("b.flv"));
  let mut la = listener(&ff, pa, &fa);
  let mut lb = listener(&ff, pb, &fb);

  let (tx, _) = broadcast::channel(64);
  let keys = Arc::new(MemoryStore::default());
  let router = Arc::new(Router::new(tx, keys));
  router.set_ffmpeg(Some(ff.clone()));
  router.load(vec![dest("a", pa), dest("b", pb)]);
  router.set_key("a", "test");
  router.set_key("b", "test");

  let (server, key) = router.start_session().expect("oturum");
  router.start_destination("a").expect("A başlamalı");
  tokio::time::sleep(Duration::from_millis(600)).await;

  // Sentetik kaynak: 9 sn, 30 fps, 2 sn anahtar kare (OBS'in yayın ayarına benzer)
  let mut source = Command::new(&ff)
    .args(["-hide_banner", "-loglevel", "error", "-re"])
    .args(["-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30"])
    .args(["-f", "lavfi", "-i", "sine=frequency=440"])
    .args(["-c:v", "libx264", "-preset", "veryfast", "-g", "60", "-pix_fmt", "yuv420p"])
    .args(["-c:a", "aac", "-b:a", "128k", "-t", "9", "-f", "flv"])
    .arg(format!("{server}/{key}"))
    .stdin(Stdio::null())
    .stdout(Stdio::null())
    .stderr(Stdio::null())
    .kill_on_drop(true)
    .spawn()
    .unwrap();

  tokio::time::sleep(Duration::from_secs(3)).await;
  let snap = router.snapshot();
  let a = snap.destinations.iter().find(|d| d.id == "a").unwrap();
  assert_eq!(a.state, DestState::Live, "A canlı olmalı: {:?} / {:?}", a.state, a.last_error);

  // B geç katılır
  router.start_destination("b").expect("B başlamalı");
  tokio::time::sleep(Duration::from_secs(2)).await;

  // A yayın sürerken tek başına durdurulur; B devam eder
  router.stop_destination("a").unwrap();
  tokio::time::sleep(Duration::from_millis(1500)).await;
  let snap = router.snapshot();
  let a = snap.destinations.iter().find(|d| d.id == "a").unwrap();
  let b = snap.destinations.iter().find(|d| d.id == "b").unwrap();
  assert_eq!(a.state, DestState::Stopped);
  assert_eq!(b.state, DestState::Live, "B, A durunca etkilenmemeli: {:?}", b.last_error);

  let _ = source.wait().await;
  tokio::time::sleep(Duration::from_secs(2)).await;
  router.stop_session();
  tokio::time::sleep(Duration::from_secs(1)).await;
  let _ = tokio::time::timeout(Duration::from_secs(5), la.wait()).await;
  let _ = tokio::time::timeout(Duration::from_secs(5), lb.wait()).await;
  let _ = la.kill().await;
  let _ = lb.kill().await;

  let (a_frames, a_err) = inspect(&ff, &fa);
  let (b_frames, b_err) = inspect(&ff, &fb);
  eprintln!("A: {a_frames} kare, {a_err} hata · B: {b_frames} kare, {b_err} hata");
  assert!(a_frames >= 60, "A en az 2 sn almalıydı: {a_frames}");
  // B, kaynağın bitişine kadar kesintisiz almalı; zarif kapanış son kareleri korur (eskiden ~yarısı kayboluyordu)
  assert!(b_frames >= 120, "B geç katılıp akışın sonuna kadar almalıydı: {b_frames}");
  assert!(a_frames < 270, "A durdurulduktan sonra veri almamalı: {a_frames}");
  assert_eq!(a_err, 0, "A çözülemiyor");
  assert_eq!(b_err, 0, "B (geç katılan) çözülemiyor — dizi başlığı/anahtar kare kuralı bozuk");
  let _ = std::fs::remove_dir_all(&dir);
}

#[tokio::test]
async fn dusen_hedef_digerini_etkilemez_ve_geri_baglanir() {
  let Some(ff) = ffmpeg() else {
    eprintln!("FFmpeg bulunamadı — kaos testi atlandı");
    return;
  };
  let dir = std::env::temp_dir().join(format!("studio-ms-kaos-{}", free_port()));
  std::fs::create_dir_all(&dir).unwrap();
  let (pa, pb) = (free_port(), free_port());
  let (fa, fb) = (dir.join("a.flv"), dir.join("b.flv"));
  let mut la = listener(&ff, pa, &fa);
  // B'nin sunucusu başta YOK (platform kesintisi)

  let (tx, _) = broadcast::channel(64);
  let router = Arc::new(Router::new(tx, Arc::new(MemoryStore::default())));
  router.set_ffmpeg(Some(ff.clone()));
  router.load(vec![dest("a", pa), dest("b", pb)]);
  router.set_key("a", "test");
  router.set_key("b", "gizli-anahtar-XYZ");
  let (server, key) = router.start_session().unwrap();
  router.start_destination("a").unwrap();
  router.start_destination("b").unwrap();

  let mut source = Command::new(&ff)
    .args(["-hide_banner", "-loglevel", "error", "-re"])
    .args(["-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30"])
    .args(["-f", "lavfi", "-i", "sine=frequency=440"])
    .args(["-c:v", "libx264", "-preset", "veryfast", "-g", "60", "-pix_fmt", "yuv420p"])
    .args(["-c:a", "aac", "-t", "14", "-f", "flv"])
    .arg(format!("{server}/{key}"))
    .stdin(Stdio::null())
    .stdout(Stdio::null())
    .stderr(Stdio::null())
    .kill_on_drop(true)
    .spawn()
    .unwrap();

  // B'nin ilk denemesi başarısız olana kadar bekle (yayıncı önce girişi yokluyor)
  let mut s = router.snapshot();
  for _ in 0..30 {
    tokio::time::sleep(Duration::from_millis(500)).await;
    s = router.snapshot();
    if s.destinations.iter().find(|d| d.id == "b").unwrap().failures >= 1 {
      break;
    }
  }
  let a = s.destinations.iter().find(|d| d.id == "a").unwrap().clone();
  let b = s.destinations.iter().find(|d| d.id == "b").unwrap().clone();
  assert_eq!(a.state, DestState::Live, "A, B'nin hatasından etkilenmemeli");
  assert!(
    matches!(b.state, DestState::Reconnecting | DestState::Connecting),
    "B yeniden bağlanmaya çalışmalı: {:?}",
    b.state
  );
  assert!(b.failures >= 1);
  if let Some(err) = &b.last_error {
    assert!(!err.contains("gizli-anahtar-XYZ"), "hata metninde anahtar görünüyor: {err}");
  }
  let json = serde_json::to_string(&s).unwrap();
  assert!(!json.contains("gizli-anahtar-XYZ"), "anlık görüntüde anahtar var");

  // Platform geri geldi → B kendiliğinden bağlanmalı
  let mut lb = listener(&ff, pb, &fb);
  let mut live = false;
  for _ in 0..30 {
    tokio::time::sleep(Duration::from_millis(500)).await;
    let s = router.snapshot();
    if s.destinations.iter().find(|d| d.id == "b").unwrap().state == DestState::Live {
      live = true;
      break;
    }
  }
  assert!(live, "B sunucu gelince yeniden bağlanmalıydı");

  let _ = source.wait().await;
  tokio::time::sleep(Duration::from_secs(1)).await;
  router.stop_session();
  let _ = tokio::time::timeout(Duration::from_secs(6), la.wait()).await;
  let _ = tokio::time::timeout(Duration::from_secs(6), lb.wait()).await;
  let _ = la.kill().await;
  let _ = lb.kill().await;
  let (a_frames, a_err) = inspect(&ff, &fa);
  let (b_frames, b_err) = inspect(&ff, &fb);
  eprintln!("kaos — A: {a_frames} kare, {a_err} hata · B: {b_frames} kare, {b_err} hata");
  assert!(a_frames >= 380, "A kesintisiz almalıydı: {a_frames}");
  assert!(b_frames >= 30 && b_err == 0, "B yeniden bağlandıktan sonra çözülebilir akış almalıydı");
  let _ = std::fs::remove_dir_all(&dir);
}
