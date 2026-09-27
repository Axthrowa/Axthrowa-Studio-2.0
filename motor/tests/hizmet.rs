//! `hizmet` kipinin stdio protokolü — uçtan uca (gerçek libobs, yalnız sentetik kaynak, yalnız 127.0.0.1).
//!
//! OBS Studio ya da FFmpeg kurulu değilse test atlanır (başarılı sayılır, nedeni yazdırılır).

use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::time::{Duration, Instant};

use serde_json::{json, Value};

fn nerede(ad: &str) -> Option<std::path::PathBuf> {
  let out = Command::new("where").arg(ad).output().ok()?;
  String::from_utf8_lossy(&out.stdout).lines().next().map(|l| std::path::PathBuf::from(l.trim())).filter(|p| p.exists())
}

struct Istemci {
  girdi: std::process::ChildStdin,
  satirlar: mpsc::Receiver<String>,
  tum_cikti: Vec<String>,
  no: u64,
}

impl Istemci {
  fn gonder(&mut self, mut istek: Value) -> Value {
    self.no += 1;
    istek["no"] = json!(self.no);
    writeln!(self.girdi, "{istek}").unwrap();
    self.girdi.flush().unwrap();
    let son = Instant::now() + Duration::from_secs(30);
    loop {
      let satir = self.satirlar.recv_timeout(son.saturating_duration_since(Instant::now())).expect("yanıt gelmedi");
      self.tum_cikti.push(satir.clone());
      let v: Value = serde_json::from_str(&satir).expect("geçerli JSON satırı");
      if v["no"] == json!(self.no) {
        return v;
      }
    }
  }

  fn olay_bekle(&mut self, kosul: impl Fn(&Value) -> bool, sure: Duration) -> bool {
    let son = Instant::now() + sure;
    while let Ok(satir) = self.satirlar.recv_timeout(son.saturating_duration_since(Instant::now())) {
      self.tum_cikti.push(satir.clone());
      if serde_json::from_str::<Value>(&satir).is_ok_and(|v| kosul(&v)) {
        return true;
      }
    }
    false
  }
}

#[test]
fn stdio_protokolu_sentetik_yayin() {
  if !std::path::Path::new(r"C:\Program Files\obs-studio\bin\64bit\obs.dll").exists() && std::env::var_os("YYA_OBS_DIR").is_none() {
    eprintln!("OBS Studio yok — atlandı");
    return;
  }
  let Some(ff) = nerede("ffmpeg") else {
    eprintln!("ffmpeg yok — atlandı");
    return;
  };
  let klasor = std::env::temp_dir().join("yayin-motoru-hizmet-testi");
  std::fs::create_dir_all(&klasor).unwrap();
  let port = TcpListener::bind("127.0.0.1:0").unwrap().local_addr().unwrap().port();
  let anahtar = format!("GIZLI_TEST_ANAHTARI_{port}");
  let mut alici = Command::new(&ff)
    .args(["-hide_banner", "-loglevel", "error", "-listen", "1", "-i"])
    .arg(format!("rtmp://127.0.0.1:{port}/live/{anahtar}"))
    .args(["-c", "copy", "-f", "flv", "-y"])
    .arg(klasor.join("alici.flv"))
    .stdin(Stdio::piped())
    .stdout(Stdio::null())
    .stderr(Stdio::null())
    .spawn()
    .unwrap();
  std::thread::sleep(Duration::from_millis(600));

  let mut motor = Command::new(env!("CARGO_BIN_EXE_yayin-motoru"))
    .arg("hizmet")
    .stdin(Stdio::piped())
    .stdout(Stdio::piped())
    .stderr(Stdio::null())
    .spawn()
    .unwrap();
  let (tx, rx) = mpsc::channel();
  let stdout = motor.stdout.take().unwrap();
  std::thread::spawn(move || {
    for satir in BufReader::new(stdout).lines().map_while(Result::ok) {
      if tx.send(satir).is_err() {
        break;
      }
    }
  });
  let mut c = Istemci { girdi: motor.stdin.take().unwrap(), satirlar: rx, tum_cikti: Vec::new(), no: 0 };
  assert!(c.olay_bekle(|v| v["olay"] == "hazir", Duration::from_secs(10)), "hazır olayı yok");

  // Motor başlamadan komut reddedilir
  let r = c.gonder(json!({"komut": "istatistik"}));
  assert_eq!(r["tamam"], false);

  let gunluk = klasor.join("libobs.log");
  let r = c.gonder(json!({"komut": "baslat", "genislik": 1280, "yukseklik": 720, "fps": 30, "gunluk": gunluk}));
  assert_eq!(r["tamam"], true, "{r}");
  assert!(r["sonuc"]["libobs"].as_str().unwrap().starts_with("32."));

  for istek in [
    json!({"komut": "kaynak.olustur", "id": "renk", "tur": "color_source", "ayarlar": {"color": 4280295456u32, "width": 1280, "height": 720}}),
    json!({"komut": "kaynak.olustur", "id": "yazi", "tur": "text_gdiplus", "ayarlar": {"text": "protokol sınaması"}}),
    json!({"komut": "sahne.olustur", "id": "s1", "tuval": "ana"}),
    json!({"komut": "sahne.ekle", "sahne": "s1", "kaynak": "renk", "donusum": {"sinir": [1280, 720]}}),
    json!({"komut": "sahne.ekle", "sahne": "s1", "kaynak": "yazi", "donusum": {"konum": [40, 40]}}),
    json!({"komut": "kodlayici.video", "id": "v", "tur": "otomatik", "tuval": "ana", "bit_hizi": 2500}),
    json!({"komut": "kodlayici.ses", "id": "a", "bit_hizi": 128}),
    json!({"komut": "cikis.rtmp", "id": "hedef", "sunucu": format!("rtmp://127.0.0.1:{port}/live"), "anahtar": anahtar, "video": "v", "ses": "a"}),
  ] {
    let r = c.gonder(istek.clone());
    assert_eq!(r["tamam"], true, "{istek} → {r}");
  }
  // Geçersiz girdiler açık hata döner
  assert_eq!(c.gonder(json!({"komut": "tuval.olustur", "id": "../x", "genislik": 100, "yukseklik": 100}))["tamam"], false);
  assert_eq!(c.gonder(json!({"komut": "cikis.rtmp", "id": "kotu", "sunucu": "http://x", "video": "v", "ses": "a"}))["tamam"], false);
  assert_eq!(c.gonder(json!({"komut": "uydurma"}))["tamam"], false);

  let r = c.gonder(json!({"komut": "cikis.baslat", "id": "hedef"}));
  assert_eq!(r["tamam"], true, "{r}");
  assert!(c.olay_bekle(|v| v["olay"] == "cikis" && v["id"] == "hedef" && v["durum"] == "canli", Duration::from_secs(15)), "canlı olmadı");

  // Önizleme: ilk istek bağlanır, sonraki PNG döner
  let _ = c.gonder(json!({"komut": "onizleme", "tuval": "ana", "genislik": 320}));
  std::thread::sleep(Duration::from_millis(1500));
  let r = c.gonder(json!({"komut": "onizleme", "tuval": "ana", "genislik": 320}));
  let png = r["sonuc"]["png"].as_str().unwrap_or_else(|| panic!("önizleme PNG yok: {r}"));
  assert!(png.starts_with("iVBORw0KGgo"), "PNG imzası");

  std::thread::sleep(Duration::from_secs(2));
  let r = c.gonder(json!({"komut": "istatistik"}));
  let hedef = r["sonuc"]["cikislar"].as_array().unwrap().iter().find(|x| x["id"] == "hedef").unwrap().clone();
  assert_eq!(hedef["durum"], "canli");
  assert!(hedef["bayt"].as_u64().unwrap() > 100_000, "{hedef}");
  let r = c.gonder(json!({"komut": "tuvaller"}));
  assert_eq!(r["sonuc"][0]["id"], "ana");

  let r = c.gonder(json!({"komut": "cikis.durdur", "id": "hedef"}));
  assert_eq!(r["tamam"], true);
  assert!(c.olay_bekle(|v| v["id"] == "hedef" && v["durum"] == "durduruldu", Duration::from_secs(10)), "durmadı");
  let r = c.gonder(json!({"komut": "kapat"}));
  assert_eq!(r["tamam"], true);
  let son = Instant::now() + Duration::from_secs(15);
  while motor.try_wait().unwrap().is_none() && Instant::now() < son {
    std::thread::sleep(Duration::from_millis(100));
  }
  assert!(motor.try_wait().unwrap().is_some_and(|s| s.success()), "motor temiz çıkmadı");
  let _ = alici.kill();
  let _ = alici.wait();

  // Yayın anahtarı hiçbir protokol satırında ve libobs günlüğünde görünmez
  let hepsi = c.tum_cikti.join("\n");
  assert!(!hepsi.contains(&anahtar), "anahtar protokol çıktısına sızdı");
  let g = std::fs::read_to_string(&gunluk).unwrap_or_default();
  assert!(!g.contains(&anahtar), "anahtar libobs günlüğüne sızdı");
  assert!(!g.contains("[HATA]"), "libobs günlüğünde hata:\n{g}");
}
