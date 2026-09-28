//! Sentetik uçtan uca sınama (`yayin-motoru sinama`).
//!
//! Kullanıcı kuralı: ekran, pencere, oyun, kamera ya da mikrofon YAKALANMAZ; yalnız sentetik kaynaklar (renk, metin,
//! FFmpeg'in ürettiği test deseni + 440 Hz ton). Yayın yalnız 127.0.0.1'deki yerel FFmpeg alıcılarına gider.
//!
//! Senaryo (prompt §120 "Multistream" + "Multi-canvas"):
//! 1. Yatay (1920×1080) ve dikey (1080×1920) tuval; aynı medya kaynağı iki tuvalde farklı dönüşümle (tek çözme).
//! 2. Yatay kodlayıcı iki hedefe + kayda paylaşılır; dikey tuvalin ayrı kodlayıcısı üçüncü hedefe.
//! 3. Dördüncü hedef kapalı bir porta: başarısız olur, diğerleri etkilenmez.
//! 4. B hedefi yayın sürerken durdurulur → A ve C canlı kalır → B yeniden başlatılır.
//! 5. Alıcı dosyaları ffprobe ile doğrulanır (kare sayısı, çözünürlük, çözme hatası).

use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::mpsc;
use std::time::{Duration, Instant};

use serde::Serialize;
use serde_json::json;

use crate::motor::{CikisDurumu, Donusum, KodlayiciAyari, Motor, MotorAyari, Olay};
use crate::obs::Vec2;

#[derive(Serialize)]
struct Denetim {
  ad: String,
  gecti: bool,
  ayrinti: String,
}

#[derive(Serialize)]
struct DosyaBilgisi {
  kare: u64,
  genislik: u32,
  yukseklik: u32,
  sure_sn: f64,
  cozme_hatasi: usize,
}

fn nerede(ad: &str) -> Option<PathBuf> {
  let out = Command::new("where").arg(ad).output().ok()?;
  String::from_utf8_lossy(&out.stdout).lines().next().map(|l| PathBuf::from(l.trim())).filter(|p| p.exists())
}

fn bos_port() -> u16 {
  TcpListener::bind("127.0.0.1:0").unwrap().local_addr().unwrap().port()
}

fn alici(ff: &Path, port: u16, cikti: &Path) -> Child {
  Command::new(ff)
    .args(["-hide_banner", "-loglevel", "error", "-listen", "1", "-i"])
    .arg(format!("rtmp://127.0.0.1:{port}/live/sinama"))
    .args(["-c", "copy", "-f", "flv", "-y"])
    .arg(cikti)
    .stdin(Stdio::piped())
    .stdout(Stdio::null())
    .stderr(Stdio::null())
    .spawn()
    .expect("ffmpeg alıcısı başlatılamadı")
}

/// Alıcıyı düzgün kapatır: FFmpeg'e `q` (dosyayı sonlandırır), süre sınırıyla bekler, gerekirse sonlandırır.
fn alici_kapat(a: &mut Child, sure: Duration) {
  if let Some(mut girdi) = a.stdin.take() {
    use std::io::Write;
    let _ = girdi.write_all(b"q");
  }
  let bitis = Instant::now() + sure;
  while Instant::now() < bitis {
    if a.try_wait().ok().flatten().is_some() {
      return;
    }
    std::thread::sleep(Duration::from_millis(100));
  }
  let _ = a.kill();
  let _ = a.wait();
}

fn incele(ffprobe: &Path, ff: &Path, dosya: &Path) -> DosyaBilgisi {
  let cikti = Command::new(ffprobe)
    .args(["-v", "error", "-count_frames", "-select_streams", "v:0"])
    .args(["-show_entries", "stream=nb_read_frames,width,height:format=duration", "-of", "json"])
    .arg(dosya)
    .output()
    .ok();
  let v: serde_json::Value =
    cikti.and_then(|o| serde_json::from_slice(&o.stdout).ok()).unwrap_or(serde_json::Value::Null);
  let akis = &v["streams"][0];
  let sayi = |x: &serde_json::Value| x.as_str().and_then(|s| s.parse::<f64>().ok()).or(x.as_f64()).unwrap_or(0.0);
  let hata = Command::new(ff)
    .args(["-v", "error", "-i"])
    .arg(dosya)
    .args(["-f", "null", "-"])
    .output()
    .map(|o| String::from_utf8_lossy(&o.stderr).lines().count())
    .unwrap_or(99);
  DosyaBilgisi {
    kare: sayi(&akis["nb_read_frames"]) as u64,
    genislik: akis["width"].as_u64().unwrap_or(0) as u32,
    yukseklik: akis["height"].as_u64().unwrap_or(0) as u32,
    sure_sn: (sayi(&v["format"]["duration"]) * 10.0).round() / 10.0,
    cozme_hatasi: hata,
  }
}

/// Dosyadaki ses akışı sayısı
fn ses_akisi_sayisi(ffprobe: &Path, dosya: &Path) -> usize {
  Command::new(ffprobe)
    .args(["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0"])
    .arg(dosya)
    .output()
    .map(|o| String::from_utf8_lossy(&o.stdout).lines().filter(|l| !l.trim().is_empty()).count())
    .unwrap_or(0)
}

/// Bu süreçten `port`a açık (ESTABLISHED) TCP bağlantısı sayısı (`netstat -ano`).
fn acik_baglanti(port: u16) -> usize {
  let pid = std::process::id().to_string();
  let hedef = format!("127.0.0.1:{port}");
  Command::new("netstat")
    .args(["-ano", "-p", "tcp"])
    .output()
    .map(|o| {
      String::from_utf8_lossy(&o.stdout)
        .lines()
        .filter(|l| {
          let p: Vec<&str> = l.split_whitespace().collect();
          p.len() >= 5 && p[2] == hedef && p[3] == "ESTABLISHED" && p[4] == pid
        })
        .count()
    })
    .unwrap_or(usize::MAX)
}

/// Dosyadaki sesin ortalama düzeyi (dB, `volumedetect`); ses akışı yoksa `None`.
fn ortalama_ses(ff: &Path, dosya: &Path) -> Option<f64> {
  iz_sesi(ff, dosya, 0)
}

/// `iz`. ses akışının ortalama düzeyi (dB)
fn iz_sesi(ff: &Path, dosya: &Path, iz: usize) -> Option<f64> {
  let esle = format!("0:a:{iz}");
  let o = Command::new(ff).args(["-hide_banner", "-i"]).arg(dosya).args(["-map", &esle, "-af", "volumedetect", "-f", "null", "-"]).output().ok()?;
  let metin = String::from_utf8_lossy(&o.stderr);
  metin.lines().find_map(|l| l.split("mean_volume:").nth(1)).and_then(|v| v.trim().trim_end_matches("dB").trim().parse().ok())
}

fn kare_cikar(ff: &Path, dosya: &Path, png: &Path) {
  let _ = Command::new(ff)
    .args(["-hide_banner", "-loglevel", "error", "-ss", "3", "-i"])
    .arg(dosya)
    .args(["-frames:v", "1", "-vf", "scale=-2:360", "-y"])
    .arg(png)
    .status();
}

fn bekle_durum(motor: &Motor, id: &str, istenen: &[CikisDurumu], sure: Duration) -> Option<CikisDurumu> {
  let son = Instant::now() + sure;
  loop {
    let d = motor.cikis_durumu(id);
    if d.is_some_and(|d| istenen.contains(&d)) || Instant::now() >= son {
      return d;
    }
    std::thread::sleep(Duration::from_millis(50));
  }
}

fn nesne(v: serde_json::Value) -> serde_json::Map<String, serde_json::Value> {
  v.as_object().cloned().unwrap_or_default()
}

#[derive(Default)]
struct Parite {
  gecis_ok: bool,
  gecis: String,
  studyo_ok: bool,
  studyo: String,
  filtre_ok: bool,
  filtre: String,
  kazanc_ok: bool,
  kazanc: String,
  ses_ok: bool,
  ses: String,
  grup_ok: bool,
  grup: String,
  donusum_ok: bool,
  donusum: String,
  silme_ok: bool,
  silme: String,
  kodlayici_ok: bool,
  kodlayici: String,
  tarayici_ok: bool,
  tarayici: String,
  yakalama_ok: bool,
  yakalama: String,
  temizle_ok: bool,
  temizle: String,
  sahne_filtre_ok: bool,
  sahne_filtre: String,
  oge_gecis_ok: bool,
  oge_gecis: String,
  etkilesim_ok: bool,
  etkilesim: String,
  cikis_turu_ok: bool,
  cikis_turu: String,
}

/// Yakalama türlerinde bulunması gereken özellik anahtarları (OBS 32.2.2'de örnek oluşturmadan okunarak gözlendi).
/// Çalışma anı yakalama (oyun, pencere, ekran, uygulama sesi, kamera) bu sınamada yapılmaz — UNVERIFIED.
const YAKALAMA_ANAHTARLARI: &[(&str, &[&str])] = &[
  ("game_capture", &["capture_mode", "window", "priority", "capture_audio", "capture_cursor", "anti_cheat_hook", "hook_rate"]),
  ("window_capture", &["window", "method", "priority", "capture_audio", "cursor", "client_area"]),
  ("monitor_capture", &["method", "monitor_id", "capture_cursor"]),
  ("wasapi_process_output_capture", &["window", "priority"]),
  ("wasapi_input_capture", &["device_id", "use_device_timing"]),
  ("wasapi_output_capture", &["device_id", "use_device_timing"]),
  ("dshow_input", &["video_device_id", "audio_output_mode", "deactivate_when_not_showing"]),
];

/// Tarayıcı kaynağı sınaması için yerel sayfa: mavi zemin, kayan sarı kutu (CSS animasyonu) ve 1 kHz WebAudio tonu
/// (genlik 0,05 ≈ −26 dBFS). Ağ yok; ses yalnız libobs'a yönlendirilir (`reroute_audio`), izleme kapalıdır.
const TARAYICI_HTML: &str = r#"<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;background:#1060c0;overflow:hidden}
#k{position:absolute;top:60px;left:0;width:180px;height:180px;background:#f0c020;animation:y 2s linear infinite}
@keyframes y{from{transform:translateX(0)}to{transform:translateX(700px)}}
</style></head><body><div id="k"></div><script>
try{const c=new AudioContext(),o=c.createOscillator(),g=c.createGain();o.frequency.value=1000;g.gain.value=0.05;o.connect(g).connect(c.destination);o.start();}catch(e){}
document.addEventListener('mousedown',()=>{document.documentElement.style.background=document.body.style.background='#c02020'});
document.addEventListener('keydown',e=>{if(e.key==='g'||e.key==='G'||e.keyCode===71){document.documentElement.style.background=document.body.style.background='#20c040'}});
</script></body></html>"#;

/// PNG'deki (x, y) pikselinin RGB değeri
fn png_pikseli(png: &[u8], x: u32, y: u32) -> Option<[u8; 3]> {
  let mut okuyucu = png::Decoder::new(png).read_info().ok()?;
  let mut tampon = vec![0; okuyucu.output_buffer_size()];
  let bilgi = okuyucu.next_frame(&mut tampon).ok()?;
  let bayt = match bilgi.color_type {
    png::ColorType::Rgba => 4,
    png::ColorType::Rgb => 3,
    _ => return None,
  };
  let i = ((y * bilgi.width + x) * bayt) as usize;
  tampon.get(i..i + 3).map(|p| [p[0], p[1], p[2]])
}

/// Kaynağın tepe seviyesinin (sol) bir süre boyunca ortalaması (dB)
fn tepe_ortalamasi(m: &Motor, kaynak: &str, sure: Duration) -> f32 {
  let son = Instant::now() + sure;
  let mut v = Vec::new();
  while Instant::now() < son {
    if let Some(s) = m.seviyeler().into_iter().find(|s| s.id == kaynak) {
      v.push(s.tepe[0]);
    }
    std::thread::sleep(Duration::from_millis(40));
  }
  if v.is_empty() {
    return crate::ses::SESSIZLIK_DB;
  }
  v.iter().sum::<f32>() / v.len() as f32
}

fn parite(m: &mut Motor, klasor: &Path) -> Parite {
  let _ = std::fs::create_dir_all(klasor);
  let mut p = Parite::default();
  let bekle = |ms: u64| std::thread::sleep(Duration::from_millis(ms));

  // Geçiş: yeni sahneye yumuşak geçiş, tür değişimi (kesme), geri dönüş
  let r = (|| -> Result<String, String> {
    m.sahne_olustur("yatay-2", "ana", "Yatay 2")?;
    m.sahneye_ekle("yatay-2", "yazi", &Donusum { konum: Some(Vec2 { x: 300.0, y: 300.0 }), ..Default::default() })?;
    let tur_var = crate::gecis::gecis_turleri().iter().any(|t| t.id == "cut_transition");
    m.sahneye_gec("yatay-2", true, Some(300))?;
    bekle(700);
    let p1 = m.program_sahnesi("ana");
    m.gecis_ayarla("ana", Some("cut_transition"), Some(0), None)?;
    let p2 = m.program_sahnesi("ana");
    m.sahneye_gec("yatay", true, None)?;
    bekle(200);
    let p3 = m.program_sahnesi("ana");
    let ok = tur_var && p1.as_deref() == Some("yatay-2") && p2.as_deref() == Some("yatay-2") && p3.as_deref() == Some("yatay");
    Ok(format!("{ok}|yumuşak geçiş sonrası {p1:?}, kesmeye geçince {p2:?}, geri {p3:?}, tür={:?}", m.gecis_bilgisi("ana")))
  })();
  (p.gecis_ok, p.gecis) = ayir(r);

  // Studio Mode
  let r = (|| -> Result<String, String> {
    m.studyo_ac("ana")?;
    m.studyo_onizleme("ana", "yatay-2")?;
    let program_once = m.program_sahnesi("ana");
    let _ = m.onizleme_png("studyo-ana", 320);
    bekle(800);
    let png = m.onizleme_png("studyo-ana", 320)?;
    if let Some(b) = &png {
      let _ = std::fs::write(klasor.join("studyo-onizleme.png"), b);
    }
    m.studyo_gecis("ana", true, Some(0))?;
    bekle(200);
    let program_sonra = m.program_sahnesi("ana");
    let onizleme_sonra = m.studyo_durumu("ana").flatten();
    m.sahneye_gec("yatay", false, None)?;
    m.studyo_kapat("ana")?;
    let ok = program_once.as_deref() == Some("yatay")
      && png.is_some()
      && program_sonra.as_deref() == Some("yatay-2")
      && onizleme_sonra.as_deref() == Some("yatay");
    Ok(format!("{ok}|önizlemeye yatay-2 konunca program {program_once:?}; önizleme karesi {}; geçişten sonra program {program_sonra:?}, önizleme (takas) {onizleme_sonra:?}", png.is_some()))
  })();
  (p.studyo_ok, p.studyo) = ayir(r);

  // Video filtreleri
  let r = (|| -> Result<String, String> {
    let turler = crate::filtre::filtre_turleri();
    let var = |id: &str| turler.iter().any(|t| t.id == id);
    m.filtre_ekle("yazi", "f-renk", "color_filter_v2", "Renk düzeltme", &nesne(json!({"opacity": 0.8})))?;
    m.filtre_ekle("yazi", "f-keskin", "sharpness_filter_v2", "Keskinleştir", &nesne(json!({})))?;
    let once: Vec<String> = m.filtre_listesi("yazi")?.into_iter().map(|f| f.id).collect();
    m.filtre_sira("f-keskin", "en_ust")?;
    let sonra: Vec<String> = m.filtre_listesi("yazi")?.into_iter().map(|f| f.id).collect();
    m.filtre_etkin("f-renk", false)?;
    let kapali = m.filtre_listesi("yazi")?.into_iter().find(|f| f.id == "f-renk").map(|f| !f.etkin).unwrap_or(false);
    let oz = m.filtre_ozellikleri("f-renk")?;
    let oz_sayisi = oz["ozellikler"].as_array().map_or(0, |a| a.len());
    m.filtre_sil("f-renk")?;
    m.filtre_sil("f-keskin")?;
    let ok = var("color_filter_v2") && var("gain_filter") && once.len() == 2 && sonra != once && kapali && oz_sayisi > 3 && m.filtre_listesi("yazi")?.is_empty();
    Ok(format!("{ok}|{} filtre türü; sıra {once:?} → {sonra:?}; kapatıldı {kapali}; renk düzeltme {oz_sayisi} özellik", turler.len()))
  })();
  (p.filtre_ok, p.filtre) = ayir(r);

  // Ses filtresi: kazanç −20 dB ölçer seviyesine yansır (ölçer filtre sonrasını ölçer)
  let r = (|| -> Result<String, String> {
    let once = tepe_ortalamasi(m, "medya", Duration::from_millis(1000));
    m.filtre_ekle("medya", "f-kazanc", "gain_filter", "Kazanç", &nesne(json!({"db": -20.0})))?;
    bekle(300);
    let sonra = tepe_ortalamasi(m, "medya", Duration::from_millis(1000));
    m.filtre_sil("f-kazanc")?;
    let fark = once - sonra;
    let ok = once > -40.0 && (15.0..=25.0).contains(&fark);
    Ok(format!("{ok}|tepe ortalaması {once:.1} dB → {sonra:.1} dB (fark {fark:.1} dB)"))
  })();
  (p.kazanc_ok, p.kazanc) = ayir(r);

  // Ses özellikleri (izleme yalnız 'kapalı' — hoparlöre ses verilmez)
  let r = (|| -> Result<String, String> {
    m.kaynak_denge("medya", 0.3)?;
    m.kaynak_mono("medya", true)?;
    m.kaynak_senkron("medya", 120)?;
    m.kaynak_izleme("medya", 0)?;
    let b = m.ses_listesi().into_iter().find(|s| s.id == "medya").ok_or("medya ses listesinde yok")?;
    let red = m.kaynak_senkron("medya", 50_000).is_err() && m.kaynak_denge("medya", 1.5).is_err();
    m.kaynak_mono("medya", false)?;
    m.kaynak_senkron("medya", 0)?;
    m.kaynak_denge("medya", 0.5)?;
    let (aygitlar, secili) = m.izleme_aygitlari();
    let ok = (b.denge - 0.3).abs() < 0.001 && b.mono && b.senkron_ms == 120 && b.izleme == 0 && red && b.medya.is_some() && !aygitlar.is_empty();
    Ok(format!("{ok}|denge {} mono {} senkron {} ms izleme {} medya {:?}; aralık dışı reddedildi {red}; {} izleme aygıtı, seçili {}", b.denge, b.mono, b.senkron_ms, b.izleme, b.medya.as_ref().map(|x| x.durum), aygitlar.len(), secili.id))
  })();
  (p.ses_ok, p.ses) = ayir(r);

  // Gruplar
  let r = (|| -> Result<String, String> {
    m.sahneye_ekle("yatay-2", "arka", &Donusum::default())?;
    let g = m.grup_olustur("yatay-2", "g1", "Grup 1", &["yatay-2/yazi".to_string(), "yatay-2/arka".to_string()])?;
    let icinde: Vec<(String, Option<String>)> = m.sahne_ogeleri("yatay-2")?.into_iter().map(|o| (o.oge, o.ust)).collect();
    let cocuk = icinde.iter().filter(|(_, u)| u.as_deref() == Some(g.as_str())).count();
    m.grup_coz(&g)?;
    let sonra: Vec<(String, Option<String>)> = m.sahne_ogeleri("yatay-2")?.into_iter().map(|o| (o.oge, o.ust)).collect();
    let korundu = ["yatay-2/yazi", "yatay-2/arka"].iter().all(|id| sonra.iter().any(|(o, u)| o == id && u.is_none()));
    // Aynı kaynak ikinci kez: benzersiz öğe kimliği
    let ikinci = m.sahneye_ekle("yatay-2", "yazi", &Donusum::default())?;
    let ok = cocuk == 2 && korundu && !sonra.iter().any(|(o, _)| o == &g) && ikinci == "yatay-2/yazi#2";
    Ok(format!("{ok}|grup {g} içinde {cocuk} öğe; çözülünce {sonra:?}; ikinci ekleme {ikinci}"))
  })();
  (p.grup_ok, p.grup) = ayir(r);

  // Dönüşüm
  let r = (|| -> Result<String, String> {
    m.donustur(
      "yatay-2/yazi",
      &Donusum {
        kirp: Some(crate::obs::Kirp { sol: 10, ust: 5, sag: 0, alt: 0 }),
        hizalama: Some(5),
        kilit: Some(true),
        aci: Some(15.0),
        ..Default::default()
      },
    )?;
    let o = m.sahne_ogeleri("yatay-2")?.into_iter().find(|o| o.oge == "yatay-2/yazi").ok_or("öğe yok")?;
    let ok = o.kirp == [10, 5, 0, 0] && o.hizalama == 5 && o.kilit && (o.aci - 15.0).abs() < 0.01 && o.genislik > 0;
    Ok(format!("{ok}|kırp {:?} hizalama {} kilit {} açı {} kaynak {}×{}", o.kirp, o.hizalama, o.kilit, o.aci, o.genislik, o.yukseklik))
  })();
  (p.donusum_ok, p.donusum) = ayir(r);

  // Sahneye ve gruba filtre (OBS'te sahne/grup filtreleri): sahne karartılınca önizlemede görünür
  let r = (|| -> Result<String, String> {
    m.studyo_ac("ana")?;
    m.studyo_onizleme("ana", "yatay-2")?;
    let _ = m.onizleme_png("studyo-ana", 320);
    bekle(800);
    let piksel = |m: &mut Motor| m.onizleme_png("studyo-ana", 320).ok().flatten().and_then(|b| png_pikseli(&b, 310, 175));
    let once = piksel(m);
    m.filtre_ekle("yatay-2", "f-sahne", "color_filter_v2", "Sahne karartma", &nesne(json!({"brightness": -1.0})))?;
    bekle(700);
    let karanlik = piksel(m);
    let sahne_liste = m.filtre_listesi("yatay-2")?.len();
    m.filtre_sil("f-sahne")?;
    let g = m.grup_olustur("yatay-2", "g2", "Grup 2", &["yatay-2/arka".to_string()])?;
    m.filtre_ekle("g2", "f-grup", "color_filter_v2", "Grup saydamlığı", &nesne(json!({"opacity": 0.5})))?;
    let grup_liste = m.filtre_listesi("g2")?.len();
    m.grup_coz(&g)?;
    let grup_temiz = m.filtre_ozellikleri("f-grup").is_err();
    m.studyo_kapat("ana")?;
    let toplam = |p: Option<[u8; 3]>| p.map(|[r, g, b]| r as u32 + g as u32 + b as u32);
    let ok = toplam(once).is_some_and(|t| t > 60) && toplam(karanlik).is_some_and(|t| t < 20) && sahne_liste == 1 && grup_liste == 1 && grup_temiz;
    Ok(format!("{ok}|sahne pikseli {once:?} → karartma filtresiyle {karanlik:?}; sahne filtresi {sahne_liste}; grup filtresi {grup_liste}, grup çözülünce filtre bırakıldı {grup_temiz}"))
  })();
  (p.sahne_filtre_ok, p.sahne_filtre) = ayir(r);

  // Öğe gösterme/gizleme geçişi
  let r = (|| -> Result<String, String> {
    let bos = serde_json::Map::new();
    m.oge_gecisi("yatay-2/arka", false, Some("fade_transition"), 400, &bos)?;
    m.oge_gecisi("yatay-2/arka", true, Some("cut_transition"), 100, &bos)?;
    let g = m.oge_gecisleri("yatay-2/arka")?;
    let red = m.oge_gecisi("yatay-2/arka", true, Some("boyle-gecis-yok"), 300, &bos).is_err()
      && m.oge_gecisi("yatay-2/arka", true, Some("fade_transition"), 10, &bos).is_err();
    m.donustur("yatay-2/arka", &Donusum { gorunur: Some(false), ..Default::default() })?;
    bekle(900);
    let gizli = m.sahne_ogeleri("yatay-2")?.iter().find(|o| o.oge == "yatay-2/arka").is_some_and(|o| !o.gorunur);
    m.donustur("yatay-2/arka", &Donusum { gorunur: Some(true), ..Default::default() })?;
    m.oge_gecisi("yatay-2/arka", false, None, 0, &bos)?;
    let kaldirildi = m.oge_gecisleri("yatay-2/arka")?["gizle"].is_null();
    let ok = g["gizle"]["tur"] == "fade_transition" && g["gizle"]["sure_ms"] == 400 && g["goster"]["tur"] == "cut_transition" && red && gizli && kaldirildi;
    Ok(format!("{ok}|geçişler {g}; geçersiz tür/süre reddedildi {red}; gizleme geçişle tamamlandı {gizli}; kaldırıldı {kaldirildi}"))
  })();
  (p.oge_gecis_ok, p.oge_gecis) = ayir(r);

  // Canlı önizleme akışı ve seviye olayları (olaylar çağıranda sayılır)
  let _ = m.akis_baslat("ana", 320, 10);
  bekle(1200);
  m.akis_durdur("ana");
  m.seviye_abone(true);
  bekle(400);
  m.seviye_abone(false);
  bekle(200);

  // Tarayıcı kaynağı (OBS'in obs-browser modülü, CEF): Studio Mode önizlemesinde yalnız bu kaynağı içeren bir sahne
  let r = (|| -> Result<String, String> {
    m.modulleri_yukle(crate::motor::TARAYICI_MODULLERI)?;
    if !m.moduller().iter().any(|x| x == "obs-browser") {
      return Err("obs-browser modülü kurulu OBS'te yok".into());
    }
    let html = klasor.join("tarayici-sentetik.html");
    std::fs::write(&html, TARAYICI_HTML).map_err(|e| format!("html: {e}"))?;
    let ayar = json!({
      "is_local_file": true, "local_file": html.to_string_lossy(), "width": 960, "height": 540, "fps": 30,
      "reroute_audio": true, "shutdown": false,
    });
    m.kaynak_olustur("tarayici", "browser_source", "Tarayıcı (sentetik)", &nesne(ayar))?;
    m.kaynak_izleme("tarayici", 0)?;
    m.sahne_olustur("tarayici-s", "ana", "Tarayıcı")?;
    m.sahneye_ekle("tarayici-s", "tarayici", &Donusum { olcek: Some(Vec2 { x: 2.0, y: 2.0 }), ..Default::default() })?;
    m.studyo_ac("ana")?;
    m.studyo_onizleme("ana", "tarayici-s")?;
    let _ = m.onizleme_png("studyo-ana", 320);
    bekle(3500);
    let tepe = tepe_ortalamasi(m, "tarayici", Duration::from_millis(800));
    let k1 = m.onizleme_png("studyo-ana", 320)?;
    bekle(700);
    let k2 = m.onizleme_png("studyo-ana", 320)?;
    if let Some(b) = &k2 {
      let _ = std::fs::write(klasor.join("tarayici-kare.png"), b);
    }
    // Sağ alt köşe hep zemin (mavi); üst şeritteki kutu kayar → iki kare farklı
    let zemin = k2.as_deref().and_then(|b| png_pikseli(b, 300, 170));
    let mavi = zemin.is_some_and(|[r, g, b]| b > 150 && r < 60 && g > 60 && g < 140);
    let farkli = matches!((&k1, &k2), (Some(a), Some(b)) if a != b);
    let ses = m.ses_listesi().into_iter().find(|x| x.id == "tarayici").map(|x| x.izleme);
    // Kaynak durumu: tarayıcı yalnız Studio önizlemesinde → görünüyor ama programda (etkin) değil
    let durum = m.kaynak_durumlari().into_iter().find(|k| k.id == "tarayici");
    let durum_ok = durum.as_ref().is_some_and(|d| d.durum == "hazir" && d.genislik == 960 && d.gorunuyor && !d.etkin && d.ses);
    // Dosyası olmayan görsel: boyut 0 → "bekliyor"
    m.kaynak_olustur("eksik-gorsel", "image_source", "Eksik görsel", &nesne(json!({"file": klasor.join("yok.png").to_string_lossy()})))?;
    let eksik = m.kaynak_durumlari().into_iter().find(|k| k.id == "eksik-gorsel").map(|k| k.durum);
    m.kaynak_sil("eksik-gorsel")?;
    let ok = (-40.0..-12.0).contains(&tepe) && mavi && farkli && ses == Some(0) && durum_ok && eksik == Some("bekliyor");
    Ok(format!(
      "{ok}|WebAudio tonu tepe ortalaması {tepe:.1} dB (beklenen ≈ −26); zemin pikseli {zemin:?}; ardışık kareler farklı {farkli}; mikserde, izleme {ses:?}; durum {:?} (görünüyor, programda değil: {durum_ok}); dosyasız görsel {eksik:?}",
      durum.as_ref().map(|d| (d.durum, d.genislik, d.yukseklik))
    ))
  })();
  (p.tarayici_ok, p.tarayici) = ayir(r);

  // Etkileşim (OBS "Etkileşim" penceresi): kaynağın tek başına görüntüsü + fare/klavye olayları tarayıcıya ulaşır
  let r = (|| -> Result<String, String> {
    let etkilesimsiz = m.etkilesim("arka", &json!({"tur": "odak"})).is_err();
    let t = m.etkilesim_ac("tarayici")?;
    let ad = format!("{}tarayici", crate::etkilesim::ONEK);
    let _ = m.onizleme_png(&ad, 320);
    bekle(900);
    let piksel = |m: &mut Motor| m.onizleme_png(&ad, 320).ok().flatten().and_then(|b| png_pikseli(&b, 300, 170));
    let once = piksel(m);
    m.etkilesim("tarayici", &json!({"tur": "hareket", "x": 480, "y": 500}))?;
    m.etkilesim("tarayici", &json!({"tur": "tik", "dugme": "sol", "x": 480, "y": 500}))?;
    m.etkilesim("tarayici", &json!({"tur": "tik", "dugme": "sol", "x": 480, "y": 500, "birak": true}))?;
    bekle(800);
    let tik = piksel(m);
    m.etkilesim("tarayici", &json!({"tur": "odak", "acik": true}))?;
    m.etkilesim("tarayici", &json!({"tur": "tus", "metin": "g", "vkey": 0x47, "tarama": 0x22}))?;
    m.etkilesim("tarayici", &json!({"tur": "tus", "metin": "g", "vkey": 0x47, "tarama": 0x22, "birak": true}))?;
    bekle(800);
    let tus = piksel(m);
    if let Some(b) = m.onizleme_png(&ad, 320).ok().flatten() {
      let _ = std::fs::write(klasor.join("etkilesim-kare.png"), b);
    }
    m.etkilesim_kapat("tarayici");
    let kapandi = m.onizleme_png(&ad, 320).is_err();
    let mavi = once.is_some_and(|[r, _, b]| b > 150 && r < 60);
    let kirmizi = tik.is_some_and(|[r, g, b]| r > 150 && g < 80 && b < 80);
    let yesil = tus.is_some_and(|[r, g, b]| g > 150 && r < 80 && b < 110);
    let ok = etkilesimsiz && t["genislik"] == 960 && t["yukseklik"] == 540 && mavi && kirmizi && yesil && kapandi;
    Ok(format!("{ok}|etkileşimsiz kaynak reddedildi {etkilesimsiz}; tuval {}×{}; zemin {once:?} → tıklayınca {tik:?} → 'g' tuşunda {tus:?}; kapatılınca tuval kalktı {kapandi}", t["genislik"], t["yukseklik"]))
  })();
  (p.etkilesim_ok, p.etkilesim) = ayir(r);
  let _ = m.studyo_kapat("ana");
  let _ = m.sahne_sil("tarayici-s");
  let _ = m.kaynak_sil("tarayici");

  // Yakalama türleri: özellik formu tür üzerinden okunur, örnek oluşturulmaz (oyuna kanca atılmaz, aygıt açılmaz)
  let r = (|| -> Result<String, String> {
    m.modulleri_yukle(crate::motor::YAKALAMA_MODULLERI)?;
    let mut eksikler = Vec::new();
    let mut sayilar = Vec::new();
    for (tur, anahtarlar) in YAKALAMA_ANAHTARLARI {
      let v = crate::eklenti::kaynak_turu_ozellikleri(tur)?;
      let adlar: Vec<&str> = v["ozellikler"].as_array().into_iter().flatten().filter_map(|o| o["ad"].as_str()).collect();
      sayilar.push(format!("{tur}:{}", adlar.len()));
      eksikler.extend(anahtarlar.iter().filter(|a| !adlar.contains(a)).map(|a| format!("{tur}.{a}")));
    }
    let oyun = crate::eklenti::kaynak_turu_ozellikleri("game_capture")?;
    let kipler: Vec<String> = oyun["ozellikler"]
      .as_array()
      .into_iter()
      .flatten()
      .find(|o| o["ad"] == "capture_mode")
      .and_then(|o| o["liste"]["ogeler"].as_array())
      .map(|a| a.iter().filter_map(|x| x["deger"].as_str().map(String::from)).collect())
      .unwrap_or_default();
    let kaynak_yok = m.kaynak_durumlari().iter().all(|k| !k.tur.contains("capture") && k.tur != "dshow_input");
    let ok = eksikler.is_empty() && kipler == ["any_fullscreen", "window", "hotkey"] && kaynak_yok;
    Ok(format!("{ok}|{}; oyun yakalama kipleri {kipler:?}; eksik {eksikler:?}; yakalama örneği oluşturulmadı {kaynak_yok}", sayilar.join(", ")))
  })();
  (p.yakalama_ok, p.yakalama) = ayir(r);

  // Sahne silme
  let r = (|| -> Result<String, String> {
    let program = m.sahne_sil("yatay").is_err();
    m.sahne_sil("yatay-2")?;
    let kalan_oge = m.sahne_ogeleri("yatay-2").is_err();
    let ok = program && kalan_oge && m.program_sahnesi("ana").as_deref() == Some("yatay");
    Ok(format!("{ok}|programdaki reddedildi {program}; yatay-2 silindi {kalan_oge}"))
  })();
  (p.silme_ok, p.silme) = ayir(r);

  // Konuma göre sıra ve koleksiyon değişimi: sahne grafiği temizlenir (çıktılar sürer), yeni grafik kurulur
  let r = (|| -> Result<String, String> {
    let once: Vec<String> = m.sahne_ogeleri("yatay")?.into_iter().map(|o| o.kaynak).collect();
    m.oge_sira_konumu("yatay/yazi", 0)?;
    let sonra: Vec<String> = m.sahne_ogeleri("yatay")?.into_iter().map(|o| o.kaynak).collect();
    let sira_ok = sonra.first().map(String::as_str) == Some("yazi") && once.first().map(String::as_str) != Some("yazi");
    let cikis_once = m.istatistik().cikislar.iter().filter(|c| c.etkin).count();
    m.sahne_grafigini_temizle();
    let bos = m.kaynak_listesi().is_empty() && m.program_sahnesi("ana").is_none() && m.ses_listesi().is_empty();
    m.kaynak_olustur("yeni-renk", "color_source", "Yeni koleksiyon", &nesne(json!({"color": 0xFF204060_u32, "width": 1920, "height": 1080})))?;
    m.sahne_olustur("yeni-sahne", "ana", "Yeni")?;
    m.sahneye_ekle("yeni-sahne", "yeni-renk", &Donusum::default())?;
    m.sahneye_gec("yeni-sahne", false, None)?;
    bekle(300);
    let cikis_sonra = m.istatistik().cikislar.iter().filter(|c| c.etkin).count();
    let ok = sira_ok && bos && m.program_sahnesi("ana").as_deref() == Some("yeni-sahne") && cikis_once > 0 && cikis_sonra == cikis_once;
    Ok(format!("{ok}|sıra {once:?} → {sonra:?}; temizlendi {bos}; yeni program {:?}; etkin çıktı {cikis_once} → {cikis_sonra}", m.program_sahnesi("ana")))
  })();
  (p.temizle_ok, p.temizle) = ayir(r);

  // Kodlayıcı özellikleri
  let r = (|| -> Result<String, String> {
    let v = crate::eklenti::kodlayici_ozellikleri("obs_x264")?;
    let adlar: Vec<String> = v["ozellikler"].as_array().into_iter().flatten().filter_map(|o| o["ad"].as_str().map(String::from)).collect();
    let ok = ["bitrate", "rate_control", "keyint_sec", "preset"].iter().all(|a| adlar.iter().any(|x| x == a)) && v["ayarlar"]["bitrate"].is_number();
    Ok(format!("{ok}|obs_x264: {} özellik ({:?}…), varsayılan bit hızı {}", adlar.len(), adlar.iter().take(6).collect::<Vec<_>>(), v["ayarlar"]["bitrate"]))
  })();
  (p.kodlayici_ok, p.kodlayici) = ayir(r);

  // RTMP çıktı türünün ağ özellikleri (Ayarlar > Gelişmiş > Ağ): örneksiz okunur
  let r = (|| -> Result<String, String> {
    let v = crate::eklenti::cikis_turu_ozellikleri("rtmp_output")?;
    let adlar: Vec<String> = v["ozellikler"].as_array().into_iter().flatten().filter_map(|o| o["ad"].as_str().map(String::from)).collect();
    let ip_sayisi = v["ozellikler"]
      .as_array()
      .into_iter()
      .flatten()
      .find(|o| o["ad"] == "bind_ip")
      .and_then(|o| o["liste"]["ogeler"].as_array())
      .map_or(0, |a| a.len());
    let ok = ["bind_ip", "new_socket_loop_enabled", "low_latency_mode_enabled"].iter().all(|a| adlar.iter().any(|x| x == a)) && ip_sayisi >= 1;
    Ok(format!("{ok}|rtmp_output: {} özellik, bağlanılacak IP seçeneği {ip_sayisi}", adlar.len()))
  })();
  (p.cikis_turu_ok, p.cikis_turu) = ayir(r);
  p
}

/// Ses akışının örnekleme hızı ve kanal sayısı
fn ses_bicimi(ffprobe: &Path, dosya: &Path) -> (u32, u32) {
  let v: serde_json::Value = Command::new(ffprobe)
    .args(["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=sample_rate,channels", "-of", "json"])
    .arg(dosya)
    .output()
    .ok()
    .and_then(|o| serde_json::from_slice(&o.stdout).ok())
    .unwrap_or(serde_json::Value::Null);
  let a = &v["streams"][0];
  (a["sample_rate"].as_str().and_then(|s| s.parse().ok()).unwrap_or(0), a["channels"].as_u64().unwrap_or(0) as u32)
}

/// Ayrı süreçte (libobs süreç başına bir kez başlar): taban 1920×1080 → çıkış 1280×720 (Lanczos), 44,1 kHz mono ses.
/// Kısa bir MKV kaydı yazar; denetimi ana süreç ffprobe ile yapar.
pub fn olcek_sinamasi(klasor: &Path, medya: &Path) -> Result<(), String> {
  std::fs::create_dir_all(klasor).map_err(|e| format!("klasör: {e}"))?;
  let mut ayar = MotorAyari::yeni(1920, 1080, 30);
  ayar.cikis_genislik = 1280;
  ayar.cikis_yukseklik = 720;
  ayar.olcek = crate::motor::ada_gore(&crate::motor::OLCEK_FILTRELERI, "lanczos", "ölçek")?;
  ayar.ornekleme = 44_100;
  ayar.hoparlor = crate::motor::ada_gore(&crate::motor::HOPARLORLER, "mono", "hoparlör")?;
  let hdr_red = crate::motor::renk_denetimi(2, 4).is_err();
  let (tx, _rx) = mpsc::channel::<Olay>();
  let gunluk = std::fs::File::create(klasor.join("libobs.log")).map_err(|e| format!("günlük: {e}"))?;
  let mut m = Motor::baslat(ayar, tx, Box::new(gunluk))?;
  m.kaynak_olustur("arka", "color_source", "Arka", &nesne(json!({"color": 0xFF804020_u32, "width": 1920, "height": 1080})))?;
  m.kaynak_olustur("medya", "ffmpeg_source", "Medya", &nesne(json!({"is_local_file": true, "local_file": medya.to_string_lossy(), "looping": true})))?;
  m.sahne_olustur("s", "ana", "S")?;
  m.sahneye_ekle("s", "arka", &Donusum::default())?;
  m.sahneye_ekle("s", "medya", &Donusum::default())?;
  m.video_kodlayici("v", "otomatik", "ana", &KodlayiciAyari { bit_hizi_kbps: 3000, anahtar_kare_sn: 2 })?;
  m.ses_kodlayici("a", 128, 0)?;
  m.kayit_cikisi("k", &klasor.join("olcekli.mkv"), None, "v", &["a"])?;
  m.cikis_baslat("k")?;
  std::thread::sleep(Duration::from_secs(4));
  m.cikis_durdur("k")?;
  std::thread::sleep(Duration::from_secs(1));
  let video = m.video_ayari();
  m.kapat();
  println!("{}", json!({"video": video, "hdr_8bit_reddedildi": hdr_red}));
  Ok(())
}

/// "ok|ayrıntı" biçimli sonucu ayırır; hata → (false, hata)
fn ayir(r: Result<String, String>) -> (bool, String) {
  match r {
    Ok(s) => match s.split_once('|') {
      Some((ok, a)) => (ok == "true", a.to_string()),
      None => (false, s),
    },
    Err(e) => (false, format!("hata: {e}")),
  }
}

pub fn calistir(klasor: &Path) -> Result<bool, String> {
  std::fs::create_dir_all(klasor).map_err(|e| format!("klasör: {e}"))?;
  let klasor = klasor.canonicalize().map_err(|e| format!("klasör: {e}"))?;
  let klasor = PathBuf::from(klasor.to_string_lossy().trim_start_matches(r"\\?\"));
  let ff = nerede("ffmpeg").ok_or("ffmpeg bulunamadı (PATH)")?;
  let ffprobe = nerede("ffprobe").ok_or("ffprobe bulunamadı (PATH)")?;

  // 1) Sentetik medya: test deseni + 440 Hz ton (ekran/kamera yok)
  let medya = klasor.join("sentetik.mp4");
  if !medya.exists() {
    let durum = Command::new(&ff)
      .args(["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=60"])
      .args(["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000"])
      .args(["-t", "20", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-y"])
      .arg(&medya)
      .status()
      .map_err(|e| format!("ffmpeg: {e}"))?;
    if !durum.success() {
      return Err("sentetik medya üretilemedi".into());
    }
  }

  // 2) Yerel alıcılar
  let (pa, pb, pc, pe) = (bos_port(), bos_port(), bos_port(), bos_port());
  let kapali_port = bos_port(); // dinleyen yok → bağlantı reddedilir
  let dosya = |ad: &str| klasor.join(ad);
  let mut alicilar = vec![
    alici(&ff, pa, &dosya("hedef-a.flv")),
    alici(&ff, pb, &dosya("hedef-b-1.flv")),
    alici(&ff, pc, &dosya("hedef-c.flv")),
    alici(&ff, pe, &dosya("hedef-e.flv")),
  ];
  std::thread::sleep(Duration::from_millis(800));

  // 3) Motor
  let (olay_tx, olay_rx) = mpsc::channel::<Olay>();
  let gunluk = std::fs::File::create(klasor.join("libobs.log")).map_err(|e| format!("günlük: {e}"))?;
  let baslangic = Instant::now();
  let mut m = Motor::baslat(MotorAyari::yeni(1920, 1080, 60), olay_tx, Box::new(gunluk))?;
  let acilis_ms = baslangic.elapsed().as_millis();
  let kodlayicilar = m.video_kodlayicilari();
  m.tuval_olustur("dikey", "Dikey", 1080, 1920)?;

  m.kaynak_olustur("arka", "color_source", "Arka plan", &nesne(json!({"color": 0xFF2E1E1E_u32, "width": 1920, "height": 1080})))?;
  m.kaynak_olustur("arka-dikey", "color_source", "Arka plan (dikey)", &nesne(json!({"color": 0xFF3A2A10_u32, "width": 1080, "height": 1920})))?;
  m.kaynak_olustur("medya", "ffmpeg_source", "Sentetik medya", &nesne(json!({
    "is_local_file": true, "local_file": medya.to_string_lossy(), "looping": true, "restart_on_activate": false
  })))?;
  m.kaynak_olustur("yazi", "text_gdiplus", "Başlık", &nesne(json!({"text": "Yayın Motoru — sentetik sınama"})))?;

  m.sahne_olustur("yatay", "ana", "Yatay")?;
  m.sahne_olustur("dikey", "dikey", "Dikey")?;
  let d = |x: f32, y: f32, gx: f32, gy: f32| Donusum {
    konum: Some(Vec2 { x, y }),
    sinir: Some(Vec2 { x: gx, y: gy }),
    ..Default::default()
  };
  m.sahneye_ekle("yatay", "arka", &d(0.0, 0.0, 1920.0, 1080.0))?;
  m.sahneye_ekle("yatay", "medya", &d(160.0, 120.0, 1600.0, 900.0))?;
  m.sahneye_ekle("yatay", "yazi", &Donusum { konum: Some(Vec2 { x: 40.0, y: 30.0 }), ..Default::default() })?;
  m.sahneye_ekle("dikey", "arka-dikey", &d(0.0, 0.0, 1080.0, 1920.0))?;
  // Aynı medya kaynağı dikey tuvalde farklı konum ve boyutla (tek çözme, iki tüketici)
  m.sahneye_ekle("dikey", "medya", &d(0.0, 656.0, 1080.0, 608.0))?;
  m.sahneye_ekle("dikey", "yazi", &Donusum { konum: Some(Vec2 { x: 40.0, y: 80.0 }), ..Default::default() })?;

  let v_yatay = m.video_kodlayici("v-yatay", "otomatik", "ana", &KodlayiciAyari { bit_hizi_kbps: 6000, anahtar_kare_sn: 2 })?;
  let v_dikey = m.video_kodlayici("v-dikey", "otomatik", "dikey", &KodlayiciAyari { bit_hizi_kbps: 3500, anahtar_kare_sn: 2 })?;
  m.ses_kodlayici("a-ana", 160, 0)?;
  m.ses_kodlayici("a-iz2", 160, 1)?;
  // Ses izi ayrımı: tonlu medya yalnız 2. ize (maske 0b10) → 1. izi kullanan hedefler sessiz, 2. izdeki hedef tonlu
  m.kaynak_izleri("medya", 0b10)?;

  let sunucu = |p: u16| format!("rtmp://127.0.0.1:{p}/live");
  m.rtmp_cikisi("hedef-a", &sunucu(pa), "sinama", "v-yatay", "a-ana", &Default::default())?;
  m.rtmp_cikisi("hedef-b", &sunucu(pb), "sinama", "v-yatay", "a-ana", &Default::default())?;
  m.rtmp_cikisi("hedef-c", &sunucu(pc), "sinama", "v-dikey", "a-ana", &Default::default())?;
  m.rtmp_cikisi("hedef-d", &sunucu(kapali_port), "sinama", "v-yatay", "a-ana", &Default::default())?;
  // Çok izli kayıt: iz 1 (a-ana) + iz 2 (a-iz2); tonlu medya yalnız 2. izde
  m.kayit_cikisi("kayit", &dosya("kayit.mkv"), None, "v-yatay", &["a-ana", "a-iz2"])?;
  let hibrit = crate::motor::kayit_bicimleri().iter().any(|b| b.ad == "hibrit_mp4");
  if hibrit {
    m.kayit_cikisi("kayit-hibrit", &dosya("kayit-hibrit.mp4"), Some("hibrit_mp4"), "v-yatay", &["a-ana", "a-iz2"])?;
  }
  let ag_e = crate::motor::AgAyari {
    bagla_ip: "127.0.0.1".into(),
    ip_ailesi: "IPv4".into(),
    dusuk_gecikme: true,
    dinamik_bit_hizi: true,
    ..Default::default()
  };
  let ag_red = crate::motor::AgAyari { bagla_ip: "yerel".into(), ..Default::default() }.denetle().is_err();
  m.rtmp_cikisi("hedef-e", &sunucu(pe), "sinama", "v-yatay", "a-iz2", &ag_e)?;
  m.tekrar_cikisi("tekrar", &klasor, 10, "v-yatay", &["a-ana"])?;

  let kayitsiz = std::env::var_os("YYM_SINAMA_KAYITSIZ").is_some();
  for id in ["hedef-a", "hedef-b", "hedef-c", "hedef-e", "kayit", "kayit-hibrit", "tekrar"] {
    if (id == "kayit" && kayitsiz) || (id == "kayit-hibrit" && !hibrit) {
      continue;
    }
    m.cikis_baslat(id)?;
  }
  let d_baslat = m.cikis_baslat("hedef-d");
  let canli = [CikisDurumu::Canli];
  let a_canli = bekle_durum(&m, "hedef-a", &canli, Duration::from_secs(15));
  let b_canli = bekle_durum(&m, "hedef-b", &canli, Duration::from_secs(15));
  let c_canli = bekle_durum(&m, "hedef-c", &canli, Duration::from_secs(15));
  let d_durum = bekle_durum(&m, "hedef-d", &[CikisDurumu::Basarisiz], Duration::from_secs(15));

  // Önizleme: ana ve dikey tuval (ilk istek bağlanır, sonraki kare döner)
  let _ = m.onizleme_png("ana", 480);
  let _ = m.onizleme_png("dikey", 480);
  std::thread::sleep(Duration::from_millis(1500));
  let on_ana = m.onizleme_png("ana", 480)?;
  let on_dikey = m.onizleme_png("dikey", 480)?;
  if let Some(p) = &on_ana {
    let _ = std::fs::write(dosya("onizleme-ana.png"), p);
  }
  if let Some(p) = &on_dikey {
    let _ = std::fs::write(dosya("onizleme-dikey.png"), p);
  }
  // Sahne öğeleri: sıra, taşıma, kaldırma (yalnız dikey sahneden)
  let ogeler_once: Vec<String> = m.sahne_ogeleri("yatay")?.into_iter().map(|o| o.kaynak).collect();
  m.oge_sira("yatay/yazi", "en_alt")?;
  let ogeler_sonra: Vec<String> = m.sahne_ogeleri("yatay")?.into_iter().map(|o| o.kaynak).collect();
  m.oge_sira("yatay/yazi", "en_ust")?;
  m.oge_kaldir("dikey/yazi")?;
  let dikey_ogeler = m.sahne_ogeleri("dikey")?.len();
  let hizalama: Vec<String> =
    m.ozellik_secenekleri("text_gdiplus", "align")?.into_iter().map(|s| s.deger.as_str().unwrap_or("").to_string()).collect();
  std::thread::sleep(Duration::from_millis(5500));
  let tekrar_yolu = m.tekrar_kaydet("tekrar");
  // B yayın sürerken durdurulur
  m.cikis_durdur("hedef-b")?;
  let b_durdu = bekle_durum(&m, "hedef-b", &[CikisDurumu::Durduruldu], Duration::from_secs(10));
  std::thread::sleep(Duration::from_secs(1));
  let b_soket = acik_baglanti(pb);
  let a_soket = acik_baglanti(pa);
  let b_alici_kendiliginden = alicilar.get_mut(1).is_some_and(|a| a.try_wait().ok().flatten().is_some());
  std::thread::sleep(Duration::from_secs(3));
  let ara = m.istatistik();
  let a_ara = m.cikis_durumu("hedef-a");
  let c_ara = m.cikis_durumu("hedef-c");
  let a_etkin = m.cikis_etkin("hedef-a");
  let c_etkin = m.cikis_etkin("hedef-c");
  // B'nin alıcısı: FFmpeg'in RTMP dinleyicisi yayıncı kapanınca her zaman kendiliğinden çıkmıyor (gözlendi) →
  // kısa süre bekle, çıkmadıysa sonlandır; yeni alıcı + yeniden başlatma
  if let Some(eski) = alicilar.get_mut(1) {
    alici_kapat(eski, Duration::from_secs(3));
  }
  alicilar.push(alici(&ff, pb, &dosya("hedef-b-2.flv")));
  std::thread::sleep(Duration::from_millis(800));
  m.cikis_baslat("hedef-b")?;
  let b_yeniden = bekle_durum(&m, "hedef-b", &canli, Duration::from_secs(15));
  std::thread::sleep(Duration::from_secs(6));
  let son = m.istatistik();

  // ── OBS paritesi: geçiş, Studio Mode, filtre, ses ölçer, gruplar, dönüşüm, akış, kodlayıcı özellikleri ──
  let p = parite(&mut m, &dosya("parite"));
  let surum = m.surum();
  let moduller = m.moduller().to_vec();
  m.kapat();

  for mut a in alicilar {
    alici_kapat(&mut a, Duration::from_secs(5));
  }
  // Ölçeklenmiş çıkış + ses ayarları: ayrı süreçte (libobs süreç başına bir kez başlar)
  let olcek_klasoru = dosya("olcek");
  let olcek_cikti = std::env::current_exe()
    .map_err(|e| e.to_string())
    .and_then(|exe| Command::new(exe).arg("olcek-sinama").arg(&olcek_klasoru).arg(&medya).output().map_err(|e| e.to_string()));
  let olcek_json: serde_json::Value = olcek_cikti
    .as_ref()
    .ok()
    .and_then(|o| String::from_utf8_lossy(&o.stdout).lines().rev().find_map(|l| serde_json::from_str(l).ok()))
    .unwrap_or(serde_json::Value::Null);
  let olcekli = incele(&ffprobe, &ff, &olcek_klasoru.join("olcekli.mkv"));
  let (olcek_hz, olcek_kanal) = ses_bicimi(&ffprobe, &olcek_klasoru.join("olcekli.mkv"));
  let tum_olaylar: Vec<Olay> = olay_rx.try_iter().collect();
  // Kare ve seviye olayları çok sayıda ve büyük: rapora yalnız sayıları girer
  let kare_olaylari: Vec<String> = tum_olaylar
    .iter()
    .filter_map(|o| match o {
      Olay::Kare { jpeg, .. } => Some(jpeg.clone()),
      _ => None,
    })
    .collect();
  let seviye_olayi = tum_olaylar.iter().filter(|o| matches!(o, Olay::Seviyeler { .. })).count();
  let olaylar: Vec<Olay> = tum_olaylar.into_iter().filter(|o| matches!(o, Olay::Cikis { .. })).collect();

  let a = incele(&ffprobe, &ff, &dosya("hedef-a.flv"));
  let b1 = incele(&ffprobe, &ff, &dosya("hedef-b-1.flv"));
  let b2 = incele(&ffprobe, &ff, &dosya("hedef-b-2.flv"));
  let c = incele(&ffprobe, &ff, &dosya("hedef-c.flv"));
  let k = incele(&ffprobe, &ff, &dosya("kayit.mkv"));
  let k_izler = ses_akisi_sayisi(&ffprobe, &dosya("kayit.mkv"));
  let (k_iz1, k_iz2) = (iz_sesi(&ff, &dosya("kayit.mkv"), 0), iz_sesi(&ff, &dosya("kayit.mkv"), 1));
  let h = hibrit.then(|| (incele(&ffprobe, &ff, &dosya("kayit-hibrit.mp4")), ses_akisi_sayisi(&ffprobe, &dosya("kayit-hibrit.mp4"))));
  let e = incele(&ffprobe, &ff, &dosya("hedef-e.flv"));
  let ses_a = ortalama_ses(&ff, &dosya("hedef-a.flv"));
  let ses_e = ortalama_ses(&ff, &dosya("hedef-e.flv"));
  let tekrar_bilgi = tekrar_yolu.as_ref().ok().map(|y| incele(&ffprobe, &ff, Path::new(y)));
  kare_cikar(&ff, &dosya("hedef-a.flv"), &dosya("kare-yatay.png"));
  kare_cikar(&ff, &dosya("hedef-c.flv"), &dosya("kare-dikey.png"));

  let mut denetimler = Vec::new();
  let mut ekle = |ad: &str, gecti: bool, ayrinti: String| denetimler.push(Denetim { ad: ad.into(), gecti, ayrinti });
  ekle("donanım kodlayıcı seçildi", v_yatay.contains("nvenc") && v_dikey.contains("nvenc"), format!("{v_yatay} / {v_dikey}"));
  ekle("üç hedef canlıya geçti", [a_canli, b_canli, c_canli].iter().all(|d| *d == Some(CikisDurumu::Canli)), format!("{a_canli:?} {b_canli:?} {c_canli:?}"));
  ekle(
    "kapalı porttaki hedef başarısız, diğerleri etkilenmedi",
    d_durum == Some(CikisDurumu::Basarisiz) || d_baslat.is_err(),
    format!("durum {d_durum:?}, başlatma {:?}", d_baslat.as_ref().err()),
  );
  ekle("B tek başına durdu", b_durdu == Some(CikisDurumu::Durduruldu), format!("{b_durdu:?}"));
  ekle(
    "B durunca motorun B soketi kapandı, A'nınki açık",
    b_soket == 0 && a_soket == 1,
    format!("B'ye açık bağlantı {b_soket}, A'ya {a_soket}; B alıcısı kendiliğinden çıktı mı: {b_alici_kendiliginden}"),
  );
  ekle(
    "B durunca A ve C canlı kaldı",
    a_etkin && c_etkin && a_ara == Some(CikisDurumu::Canli) && c_ara == Some(CikisDurumu::Canli),
    format!("A {a_ara:?}/{a_etkin}, C {c_ara:?}/{c_etkin}"),
  );
  ekle("B yeniden başladı", b_yeniden == Some(CikisDurumu::Canli), format!("{b_yeniden:?}"));
  ekle("A yatay 1920×1080, kesintisiz", a.genislik == 1920 && a.yukseklik == 1080 && a.sure_sn >= 17.0 && a.cozme_hatasi == 0, format!("{}×{} {} sn {} kare, {} hata", a.genislik, a.yukseklik, a.sure_sn, a.kare, a.cozme_hatasi));
  ekle("C dikey 1080×1920", c.genislik == 1080 && c.yukseklik == 1920 && c.sure_sn >= 17.0 && c.cozme_hatasi == 0, format!("{}×{} {} sn {} kare, {} hata", c.genislik, c.yukseklik, c.sure_sn, c.kare, c.cozme_hatasi));
  ekle("B iki parça (durdur/yeniden başlat)", b1.kare > 0 && b2.kare > 0 && b1.cozme_hatasi == 0 && b2.cozme_hatasi == 0, format!("B1 {} sn, B2 {} sn", b1.sure_sn, b2.sure_sn));
  ekle("kayıt paylaşılan kodlayıcıyla yazıldı", k.genislik == 1920 && k.sure_sn >= 17.0 && k.cozme_hatasi == 0, format!("{} sn {} kare", k.sure_sn, k.kare));
  ekle(
    "çok izli kayıt: 2 ses izi, iz 1 sessiz, iz 2 tonlu",
    k_izler == 2 && k_iz1.is_some_and(|v| v < -70.0) && k_iz2.is_some_and(|v| v > -45.0),
    format!("{k_izler} ses akışı; iz 1 ort. {k_iz1:?} dB, iz 2 ort. {k_iz2:?} dB"),
  );
  ekle(
    "hibrit MP4 kaydı (OBS yerel yazıcısı), iki iz",
    h.as_ref().is_some_and(|(b, n)| b.genislik == 1920 && b.sure_sn >= 17.0 && b.cozme_hatasi == 0 && *n == 2),
    match &h {
      Some((b, n)) => format!("{} sn {} kare, {} hata, {n} ses akışı", b.sure_sn, b.kare, b.cozme_hatasi),
      None => "bu OBS sürümünde mp4_output yok".into(),
    },
  );
  ekle(
    "kayıt durumu canlıya geçti (ters sıralı sinyale dayanıklı)",
    ara.cikislar.iter().any(|c| c.id == "kayit" && c.durum == CikisDurumu::Canli),
    format!("{:?}", ara.cikislar.iter().find(|c| c.id == "kayit").map(|c| c.durum)),
  );
  ekle(
    "hedef başına ses izi: 1. iz sessiz, 2. iz tonlu",
    ses_a.is_some_and(|v| v < -70.0) && ses_e.is_some_and(|v| v > -45.0) && e.kare > 0,
    format!("hedef-a (iz 1) ort. {ses_a:?} dB, hedef-e (iz 2) ort. {ses_e:?} dB"),
  );
  ekle(
    "tekrar arabelleği diske yazıldı (son 10 sn)",
    tekrar_bilgi.as_ref().is_some_and(|t| t.sure_sn >= 3.0 && t.sure_sn <= 12.0 && t.cozme_hatasi == 0 && t.genislik == 1920),
    format!("{:?} → {:?}", tekrar_yolu.as_ref().map(|y| Path::new(y).file_name().map(|f| f.to_string_lossy().into_owned())), tekrar_bilgi.as_ref().map(|t| t.sure_sn)),
  );
  ekle(
    "sahne öğesi sırası ve kaldırma",
    ogeler_once.last().map(String::as_str) == Some("yazi") && ogeler_sonra.first().map(String::as_str) == Some("yazi") && dikey_ogeler == 2,
    format!("önce {ogeler_once:?}, en alta taşıyınca {ogeler_sonra:?}, dikeyde kalan {dikey_ogeler}"),
  );
  ekle(
    "özellik seçenekleri (yazı hizalama listesi)",
    ["left", "center", "right"].iter().all(|h| hizalama.iter().any(|x| x == h)),
    format!("{hizalama:?}"),
  );
  let png_boyut = |p: &Option<Vec<u8>>| {
    p.as_ref().filter(|b| b.len() > 24 && b.starts_with(&[0x89, b'P', b'N', b'G'])).map(|b| {
      (u32::from_be_bytes([b[16], b[17], b[18], b[19]]), u32::from_be_bytes([b[20], b[21], b[22], b[23]]))
    })
  };
  ekle(
    "önizleme iki tuvalde çalışıyor",
    png_boyut(&on_ana) == Some((480, 270)) && png_boyut(&on_dikey) == Some((270, 480)),
    format!("ana {:?}, dikey {:?}", png_boyut(&on_ana), png_boyut(&on_dikey)),
  );
  // Parite denetimleri
  ekle("geçiş: sahne değişimi geçişle, program doğru", p.gecis_ok, p.gecis.clone());
  ekle("Studio Mode: önizleme ayrı tuvalde, geçiş programa alır", p.studyo_ok, p.studyo.clone());
  ekle("filtre: video filtreleri eklenir, sıralanır, kapatılır", p.filtre_ok, p.filtre.clone());
  ekle("ses filtresi (kazanç −20 dB) ölçerde görünür", p.kazanc_ok, p.kazanc.clone());
  ekle("ses özellikleri: denge, mono, senkron, izleme", p.ses_ok, p.ses.clone());
  ekle("grup: gruplanır, çözülünce öğe kimlikleri korunur", p.grup_ok, p.grup.clone());
  ekle("öğe dönüşümü: kırpma, hizalama, kilit, döndürme", p.donusum_ok, p.donusum.clone());
  ekle("sahne silme: programdaki silinemez, diğeri silinir", p.silme_ok, p.silme.clone());
  ekle("kodlayıcı özellikleri (Uzman kip) okunur", p.kodlayici_ok, p.kodlayici.clone());
  ekle("tarayıcı kaynağı: yerel sayfa işlenir, WebAudio mikserde", p.tarayici_ok, p.tarayici.clone());
  ekle("yakalama türlerinin özellikleri (örnek oluşturmadan)", p.yakalama_ok, p.yakalama.clone());
  ekle("koleksiyon değişimi: grafik temizlenir, çıktılar sürer", p.temizle_ok, p.temizle.clone());
  ekle("sahneye ve gruba filtre", p.sahne_filtre_ok, p.sahne_filtre.clone());
  ekle("öğe gösterme/gizleme geçişi", p.oge_gecis_ok, p.oge_gecis.clone());
  ekle("etkileşim: tıklama ve tuş tarayıcı kaynağına ulaşır", p.etkilesim_ok, p.etkilesim.clone());
  ekle("RTMP ağ özellikleri (bağlanılacak IP, düşük gecikme)", p.cikis_turu_ok, p.cikis_turu.clone());
  ekle(
    "ağ ayarlı hedef (127.0.0.1'e bağlan, IPv4, düşük gecikme, dinamik bit hızı) yayınladı; geçersiz IP reddedildi",
    e.kare > 0 && e.cozme_hatasi == 0 && ag_red,
    format!("hedef-e {} kare, {} hata; geçersiz IP reddedildi {ag_red}", e.kare, e.cozme_hatasi),
  );
  ekle(
    "ölçeklenmiş çıkış 1280×720 (taban 1920×1080, Lanczos), ses 44,1 kHz mono; HDR + 8 bit reddedildi",
    olcekli.genislik == 1280 && olcekli.yukseklik == 720 && olcekli.kare > 0 && olcekli.cozme_hatasi == 0 && olcek_hz == 44_100 && olcek_kanal == 1
      && olcek_json["video"]["cikis"] == json!([1280, 720]) && olcek_json["hdr_8bit_reddedildi"] == true,
    format!(
      "{}×{} {} kare {} hata; ses {olcek_hz} Hz {olcek_kanal} kanal; motor bildirimi {}; süreç {}",
      olcekli.genislik, olcekli.yukseklik, olcekli.kare, olcekli.cozme_hatasi, olcek_json,
      olcek_cikti.as_ref().map(|o| o.status.to_string()).unwrap_or_else(|e| e.clone())
    ),
  );
  let jpeg_gecerli = kare_olaylari
    .iter()
    .filter(|b| {
      use base64::Engine;
      base64::engine::general_purpose::STANDARD.decode(b.as_bytes()).is_ok_and(|v| v.starts_with(&[0xFF, 0xD8]))
    })
    .count();
  ekle(
    "canlı önizleme akışı JPEG kareleri üretir",
    jpeg_gecerli >= 5 && jpeg_gecerli == kare_olaylari.len(),
    format!("{} kare olayı, {jpeg_gecerli} geçerli JPEG (1,2 sn, 10 kare/sn istendi)", kare_olaylari.len()),
  );
  // 20 Hz'de 400 ms abonelik ≈ 8 olay; koşunun geri kalanında (~30 sn, abone yok) olay gelseydi yüzlerce olurdu
  ekle(
    "seviye olayları yalnız abone varken",
    (3..=12).contains(&seviye_olayi),
    format!("{seviye_olayi} seviye olayı (400 ms abonelik penceresi; tüm koşu ~30 sn)"),
  );
  ekle("istatistik: CPU ve bellek ölçülür", son.cpu >= 0.0 && son.bellek_mb > 50.0, format!("CPU %{:.1}, bellek {:.0} MB, atlanan kare {}", son.cpu, son.bellek_mb, son.atlanan_kare));
  let dusen: i64 = son.cikislar.iter().filter(|c| c.id != "hedef-d").map(|c| c.dusen_kare).sum();
  ekle("düşen kare yok", dusen == 0, format!("çıktılarda düşen {dusen}, geciken işleme karesi {}", son.geciken_kare));

  let hepsi = denetimler.iter().all(|d| d.gecti);
  let rapor = json!({
    "libobs": surum,
    "moduller": moduller,
    "acilis_ms": acilis_ms,
    "video_kodlayicilari": kodlayicilar,
    "denetimler": denetimler,
    "dosyalar": {"hedef-a": a, "hedef-b-1": b1, "hedef-b-2": b2, "hedef-c": c, "kayit": k},
    "ara_istatistik": ara,
    "son_istatistik": son,
    "olay_sayisi": olaylar.len(),
    "olaylar": olaylar,
    "klasor": klasor,
    "sonuc": if hepsi { "GECTI" } else { "KALDI" },
  });
  println!("{}", serde_json::to_string_pretty(&rapor).unwrap_or_default());
  Ok(hepsi)
}
