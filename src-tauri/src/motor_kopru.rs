//! Yerel yayın çekirdeğine (`yayin-motoru`, ayrı süreç) köprü.
//!
//! Çekirdek libobs'u yükler ve GPL-2.0-or-later lisanslıdır; panel onu yalnız alt süreç olarak başlatır ve stdio
//! üzerinden JSON satırlarıyla konuşur (bkz. docs/STREAMING_ENGINE_DECISION.md ADR-003). Çekirdek çökerse panel
//! etkilenmez; durum "durdu" olur ve yeniden başlatılabilir (prompt §26).
//!
//! Yayın anahtarı Kimlik Yöneticisinden okunur ve yalnız çekirdeğin stdin'ine yazılır; hiçbir yanıtta, olayda ya da
//! günlükte yer almaz.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;
use std::time::Duration;

use parking_lot::Mutex;
use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, Command};
use tokio::sync::oneshot;

type Bekleyenler = Arc<Mutex<HashMap<u64, oneshot::Sender<Value>>>>;

struct Calisan {
  cocuk: Child,
  girdi: ChildStdin,
  bekleyen: Bekleyenler,
  sonraki: u64,
}

/// Çekirdekten gelen son olaylar, açılış bilgisi ve panelin kurduğu yapı (arayüz yoklaması için).
#[derive(Default)]
pub struct Ozet {
  pub bilgi: Value,
  /// Çalışan motor sürecinin kimliği (GPU payı için)
  pub motor_pid: Option<u32>,
  pub cikislar: HashMap<String, Value>,
  pub son_cikis_kodu: Option<i32>,
  pub dikey: bool,
  /// Yüklenmiş isteğe bağlı modül grupları (`yakalama`, `tarayici`)
  pub yuklu_gruplar: std::collections::HashSet<String>,
  /// Dikey tuval motorda oluşturuldu
  pub dikey_tuval: bool,
  /// Bu motor oturumunda kurulmuş ek tuvaller → boyut (silinen tuval nesnesi oturum sonuna dek kalır; kimliği yeniden
  /// kullanılmaz)
  pub motor_tuvalleri: std::collections::BTreeMap<String, (u32, u32)>,
  /// Studio Mode açık tuvaller → önizlemedeki sahne
  pub studyo: HashMap<String, Option<String>>,
  /// Canlı akış aboneleri: seviye olayları ve tuval başına kare akışı (WebSocket bağlantı sayısı)
  pub seviye_abonesi: usize,
  pub kare_abonesi: HashMap<String, usize>,
  /// Kurulmuş video kodlayıcıları (motor kimliği: `v-ana`, `v-ana-3500`…)
  pub kodlayicilar: std::collections::HashSet<String>,
  /// Bu oturumun profili (başlatmada yüklenir; profil ayarı değişince güncellenir)
  pub profil: crate::motor_profil::Profil,
  /// Ses kodlayıcısı kurulmuş izler (0–5)
  pub ses_izleri: std::collections::HashSet<u8>,
  /// Bu motor oturumunda çıktısı kurulmuş hedefler: kimlik → (tuval, iz, video kodlayıcı kimliği)
  pub hedef_tuval: HashMap<String, (String, u8, String)>,
  /// Motorda kayıtlı kaynak türleri (eklenti türleri dahil)
  pub giris_turleri: Vec<String>,
  pub koleksiyon: crate::motor_koleksiyon::Koleksiyon,
  pub kayit_cikisi_var: bool,
  pub tekrar_cikisi_var: bool,
  /// Dikey tuvalin tekrar arabelleği (`tekrar-dikey`) oluşturuldu
  pub tekrar_dikey_var: bool,
  /// Sanal kameranın hedefi (`ana`, `studyo-ana`, `sahne:<kimlik>`); sahnede kamera durunca sahne tuvali bırakılır
  pub sanal_kamera_hedef: Option<String>,
  pub son_kayit: Option<String>,
  pub son_tekrar: Option<String>,
  /// Motor panel istemeden kapandıysa çıkış kodu (NTSTATUS dahil, işaretsiz). Çökme bekçisi okuyup temizler.
  pub beklenmedik_cikis: Option<i64>,
  /// Bu oturumda üçüncü taraf eklenti yükleme sonuçları (motorun `baslat` yanıtından)
  pub eklenti_sonuclari: Vec<Value>,
  /// Bu oturum güvenli kipte (üçüncü taraf eklentisiz) başlatıldı
  pub guvenli_kip: bool,
}

/// Motorun canlı olayları (ses seviyeleri, önizleme kareleri) — WebSocket abonelerine olduğu gibi (JSON satırı)
/// iletilir. Yavaş abone kare kaçırır, motoru bekletmez.
pub struct CanliKanal(pub tokio::sync::broadcast::Sender<Arc<str>>);

impl Default for CanliKanal {
  fn default() -> Self {
    CanliKanal(tokio::sync::broadcast::channel(32).0)
  }
}

#[derive(Default)]
pub struct MotorKoprusu {
  ic: tokio::sync::Mutex<Option<Calisan>>,
  ozet: Arc<Mutex<Ozet>>,
  canli: CanliKanal,
  /// Her başlatmada artar: canlı abonelikler motor yeniden başlayınca yenilenir
  oturum: std::sync::atomic::AtomicU64,
}

/// Çekirdek exe'sinin yeri: `YYA_MOTOR_EXE` > uygulamanın yanındaki `yayin-motoru.exe` > geliştirme derlemesi.
pub fn exe_yolu() -> Option<PathBuf> {
  if let Some(p) = std::env::var_os("YYA_MOTOR_EXE").map(PathBuf::from) {
    return p.is_file().then_some(p);
  }
  let yaninda = std::env::current_exe().ok()?.parent()?.join("yayin-motoru.exe");
  if yaninda.is_file() {
    return Some(yaninda);
  }
  let gelistirme = Path::new(env!("CARGO_MANIFEST_DIR")).join("..").join("motor").join("target").join("release").join("yayin-motoru.exe");
  gelistirme.is_file().then_some(gelistirme)
}

impl MotorKoprusu {
  pub fn ozet(&self) -> Arc<Mutex<Ozet>> {
    Arc::clone(&self.ozet)
  }

  pub fn canli_abone(&self) -> tokio::sync::broadcast::Receiver<Arc<str>> {
    self.canli.0.subscribe()
  }

  pub fn oturum(&self) -> u64 {
    self.oturum.load(std::sync::atomic::Ordering::Relaxed)
  }

  pub async fn calisiyor(&self) -> bool {
    let mut ic = self.ic.lock().await;
    match ic.as_mut() {
      Some(c) => match c.cocuk.try_wait() {
        Ok(None) => true,
        Ok(Some(durum)) => {
          // Panelin durdurmadığı çıkış: durdur() çocuğu önce kendisi alır, buraya yalnız beklenmedik çıkış düşer
          let mut o = self.ozet.lock();
          o.son_cikis_kodu = durum.code();
          if durum.code() != Some(0) {
            o.beklenmedik_cikis = Some(durum.code().map(|k| k as u32 as i64).unwrap_or(-1));
          }
          drop(o);
          *ic = None;
          false
        }
        Err(_) => false,
      },
      None => false,
    }
  }

  /// Çekirdeği başlatır ve `baslat` komutunu gönderir. Zaten çalışıyorsa hata.
  pub async fn baslat(&self, ayar: Value, veri_klasoru: &Path) -> Result<Value, String> {
    if self.calisiyor().await {
      return Err("motor zaten çalışıyor".into());
    }
    let exe = exe_yolu().ok_or("yayin-motoru.exe bulunamadı (motor derlenmemiş ya da pakette yok)")?;
    std::fs::create_dir_all(veri_klasoru).map_err(|e| e.to_string())?;
    let hata_gunlugu = std::fs::File::create(veri_klasoru.join("motor-stderr.log")).map_err(|e| e.to_string())?;
    let mut cocuk = Command::new(&exe)
      .arg("hizmet")
      .stdin(Stdio::piped())
      .stdout(Stdio::piped())
      .stderr(Stdio::from(hata_gunlugu))
      .kill_on_drop(true)
      .spawn()
      .map_err(|e| format!("motor başlatılamadı: {e}"))?;
    let girdi = cocuk.stdin.take().ok_or("motor stdin yok")?;
    let cikti = cocuk.stdout.take().ok_or("motor stdout yok")?;
    let bekleyen: Bekleyenler = Arc::default();
    {
      let bekleyen = Arc::clone(&bekleyen);
      let ozet = Arc::clone(&self.ozet);
      let canli = self.canli.0.clone();
      tokio::spawn(async move {
        let mut satirlar = BufReader::new(cikti).lines();
        while let Ok(Some(satir)) = satirlar.next_line().await {
          // Canlı olaylar (çok sayıda, büyük) ayrıştırılmadan abonelere
          if satir.starts_with(r#"{"olay":"kare""#) || satir.starts_with(r#"{"olay":"seviyeler""#) {
            let _ = canli.send(Arc::from(satir.as_str()));
            continue;
          }
          let Ok(v) = serde_json::from_str::<Value>(&satir) else { continue };
          if let Some(no) = v.get("no").and_then(Value::as_u64) {
            if let Some(tx) = bekleyen.lock().remove(&no) {
              let _ = tx.send(v);
            }
          } else if v.get("olay").and_then(Value::as_str) == Some("cikis") {
            if let Some(id) = v.get("id").and_then(Value::as_str) {
              ozet.lock().cikislar.insert(id.to_string(), v.clone());
            }
          }
        }
        // Süreç kapandı: bekleyen istekler hata alır (gönderici düşer)
        bekleyen.lock().clear();
      });
    }
    *self.ozet.lock() = Ozet { motor_pid: cocuk.id(), ..Ozet::default() };
    *self.ic.lock().await = Some(Calisan { cocuk, girdi, bekleyen, sonraki: 0 });
    self.oturum.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let mut istek = ayar;
    istek["komut"] = json!("baslat");
    istek["gunluk"] = json!(veri_klasoru.join("motor-libobs.log"));
    match self.komut(istek).await {
      Ok(bilgi) => {
        self.ozet.lock().bilgi = bilgi.clone();
        Ok(bilgi)
      }
      Err(e) => {
        self.zorla_kapat().await;
        Err(e)
      }
    }
  }

  /// Tek komut gönderir ve yanıtını bekler (en çok 30 sn).
  pub async fn komut(&self, mut istek: Value) -> Result<Value, String> {
    let rx = {
      let mut ic = self.ic.lock().await;
      let c = ic.as_mut().ok_or("motor çalışmıyor")?;
      c.sonraki += 1;
      let no = c.sonraki;
      istek["no"] = json!(no);
      let (tx, rx) = oneshot::channel();
      c.bekleyen.lock().insert(no, tx);
      let mut satir = serde_json::to_string(&istek).map_err(|e| e.to_string())?;
      satir.push('\n');
      if let Err(e) = c.girdi.write_all(satir.as_bytes()).await {
        c.bekleyen.lock().remove(&no);
        return Err(format!("motora yazılamadı: {e}"));
      }
      let _ = c.girdi.flush().await;
      rx
    };
    let yanit = tokio::time::timeout(Duration::from_secs(30), rx)
      .await
      .map_err(|_| "motor yanıt vermedi (30 sn)".to_string())?
      .map_err(|_| "motor kapandı".to_string())?;
    if yanit.get("tamam").and_then(Value::as_bool) == Some(true) {
      Ok(yanit.get("sonuc").cloned().unwrap_or(Value::Null))
    } else {
      Err(yanit.get("hata").and_then(Value::as_str).unwrap_or("bilinmeyen motor hatası").to_string())
    }
  }

  /// Düzgün kapatma: `kapat` komutu (çıktılar durur, kayıt sonlandırılır), sonra süreç beklenir.
  pub async fn durdur(&self) -> Result<(), String> {
    if !self.calisiyor().await {
      return Ok(());
    }
    let _ = tokio::time::timeout(Duration::from_secs(20), self.komut(json!({ "komut": "kapat" }))).await;
    let mut ic = self.ic.lock().await;
    if let Some(mut c) = ic.take() {
      match tokio::time::timeout(Duration::from_secs(10), c.cocuk.wait()).await {
        Ok(Ok(durum)) => self.ozet.lock().son_cikis_kodu = durum.code(),
        _ => {
          let _ = c.cocuk.kill().await;
        }
      }
    }
    Ok(())
  }

  /// Başlatma hatasında: süreç kendisi düştüyse (eklenti yüklerken çökme) çıkış kodu saklanır, yoksa öldürülür.
  async fn zorla_kapat(&self) {
    if let Some(mut c) = self.ic.lock().await.take() {
      // Çöken süreç birkaç yüz ms içinde çıkar; yanıt veren (canlı) süreçte bekleme kısa tutulur
      match tokio::time::timeout(Duration::from_millis(1500), c.cocuk.wait()).await {
        Ok(Ok(durum)) => {
          let mut o = self.ozet.lock();
          o.son_cikis_kodu = durum.code();
          if durum.code() != Some(0) {
            o.beklenmedik_cikis = Some(durum.code().map(|k| k as u32 as i64).unwrap_or(-1));
          }
        }
        _ => {
          let _ = c.cocuk.kill().await;
        }
      }
    }
  }
}

// ─── Arayüzden gelen kaynak türleri ─────────────────────────────────────────

/// Kullanıcının seçtiği kaynak türü → libobs kaynak kimliği, ayarları ve yerleşim. Yakalama türleri (`ekran`,
/// `oyun`, `mikrofon`, `masaustu`) yakalama modüllerini gerektirir.
#[derive(Debug, PartialEq)]
pub struct KaynakTanimi {
  pub obs_turu: String,
  pub ayarlar: Value,
  pub yakalama: bool,
  pub ses: bool,
  /// true: tuvale sığdırılır; false: sol üstte doğal boyut
  pub sigdir: bool,
}

const GORSEL_UZANTI: &[&str] = &["png", "jpg", "jpeg", "gif", "bmp", "webp"];
const MEDYA_UZANTI: &[&str] = &["mp4", "mkv", "mov", "webm", "flv", "mp3", "wav", "flac", "ogg", "m4a"];

fn yerel_dosya(deger: &str, uzantilar: &[&str]) -> Result<String, String> {
  let p = Path::new(deger.trim());
  if !p.is_absolute() {
    return Err("dosya yolu mutlak olmalı".into());
  }
  let uz = p.extension().and_then(|e| e.to_str()).map(str::to_ascii_lowercase).unwrap_or_default();
  if !uzantilar.contains(&uz.as_str()) {
    return Err(format!("desteklenmeyen dosya türü: .{uz}"));
  }
  if !p.is_file() {
    return Err("dosya bulunamadı".into());
  }
  Ok(p.to_string_lossy().into_owned())
}

fn yerel_klasor(deger: &str) -> Result<String, String> {
  let p = Path::new(deger.trim());
  if !p.is_absolute() {
    return Err("klasör yolu mutlak olmalı".into());
  }
  if !p.is_dir() {
    return Err("klasör bulunamadı".into());
  }
  Ok(p.to_string_lossy().into_owned())
}

/// `#RRGGBB` → libobs rengi (0xAABBGGRR, opak).
pub fn renk(deger: &str) -> Result<u32, String> {
  let h = deger.trim().trim_start_matches('#');
  if h.len() != 6 || !h.chars().all(|c| c.is_ascii_hexdigit()) {
    return Err("renk #RRGGBB biçiminde olmalı".into());
  }
  let v = u32::from_str_radix(h, 16).map_err(|e| e.to_string())?;
  let (r, g, b) = ((v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff);
  Ok(0xff00_0000 | (b << 16) | (g << 8) | r)
}

/// Tarayıcı kaynağı adresi: http(s), boşluksuz, en çok 2048 karakter, kullanıcı bilgisi (`kullanici:parola@`) yok.
fn web_adresi(d: &str) -> Result<String, String> {
  if d.len() > 2048 || d.chars().any(|c| c.is_whitespace() || c.is_control()) {
    return Err("geçersiz adres".into());
  }
  let govde = d.split_once("://").map(|(_, g)| g).unwrap_or("");
  let yetki = govde.split(['/', '?', '#']).next().unwrap_or("");
  if yetki.is_empty() {
    return Err("adreste sunucu yok".into());
  }
  if yetki.contains('@') {
    return Err("adreste kullanıcı adı/parola olamaz".into());
  }
  Ok(d.to_string())
}

/// Aygıt/pencere seçimi: denetim karakteri içermeyen, makul uzunlukta değer (boşsa `None`).
fn secim(deger: &str) -> Option<&str> {
  let d = deger.trim();
  (!d.is_empty() && d.len() <= 512 && !d.chars().any(char::is_control)).then_some(d)
}

pub fn kaynak_tanimi(tur: &str, deger: &str, genislik: u32, yukseklik: u32) -> Result<KaynakTanimi, String> {
  let t = |obs_turu: &str, ayarlar, yakalama, ses, sigdir| KaynakTanimi { obs_turu: obs_turu.to_string(), ayarlar, yakalama, ses, sigdir };
  Ok(match tur {
    "renk" => t("color_source", json!({"color": renk(deger)?, "width": genislik, "height": yukseklik}), false, false, true),
    "yazi" => {
      let metin: String = deger.chars().filter(|c| !c.is_control() || *c == '\n').take(500).collect();
      if metin.trim().is_empty() {
        return Err("yazı boş olamaz".into());
      }
      t("text_gdiplus", json!({"text": metin}), false, false, false)
    }
    "gorsel" => t("image_source", json!({"file": yerel_dosya(deger, GORSEL_UZANTI)?}), false, false, true),
    // Slayt gösterisi: klasördeki görseller (OBS "Image Slide Show"); ayarlar (süre, geçiş, döngü, rastgele) Özellikler'de
    "slayt" => t(
      "slideshow",
      json!({
        "files": [{"value": yerel_klasor(deger)?, "selected": false, "hidden": false}],
        "slide_time": 5000, "transition": "fade", "transition_speed": 700, "loop": true, "randomize": false,
      }),
      false,
      false,
      true,
    ),
    // Yalnız yerel dosya: ağ adresi kabul edilmez (motor sunucu tarafında URL açmasın)
    "medya" => t(
      "ffmpeg_source",
      json!({"is_local_file": true, "local_file": yerel_dosya(deger, MEDYA_UZANTI)?, "looping": true}),
      false,
      false,
      true,
    ),
    "ekran" => {
      let mut a = json!({"capture_cursor": true});
      if let Some(d) = secim(deger) {
        a["monitor_id"] = json!(d);
      }
      t("monitor_capture", a, true, false, true)
    }
    "pencere" => {
      let pencere = secim(deger).ok_or("pencere seçilmeli")?;
      t("window_capture", json!({"window": pencere, "capture_cursor": true}), true, false, true)
    }
    // Pencere seçilirse "belirli pencere" kipi (eşleşme: başlık, yoksa aynı exe); seçilmezse tam ekran uygulama
    "oyun" => match secim(deger) {
      Some(p) => t("game_capture", json!({"capture_mode": "window", "window": p, "priority": 2}), true, false, true),
      None => t("game_capture", json!({"capture_mode": "any_fullscreen"}), true, false, true),
    },
    // Uygulama sesi (OBS "Application Audio Capture"): yalnız seçilen uygulamanın sesi
    "uygulama_sesi" => {
      let pencere = secim(deger).ok_or("uygulama seçilmeli")?;
      t("wasapi_process_output_capture", json!({"window": pencere, "priority": 2}), true, true, false)
    }
    // Tarayıcı kaynağı: yerel HTML dosyası ya da http(s) adresi. Ses motora yönlendirilir (mikserde görünür,
    // doğrudan hoparlöre gitmez). Adreste kullanıcı adı/parola kabul edilmez.
    "tarayici" => {
      let d = deger.trim();
      let ayar = if d.starts_with("http://") || d.starts_with("https://") {
        json!({"is_local_file": false, "url": web_adresi(d)?})
      } else {
        json!({"is_local_file": true, "local_file": yerel_dosya(d, &["html", "htm"])?})
      };
      let mut a = ayar;
      a["width"] = json!(1920);
      a["height"] = json!(1080);
      a["fps"] = json!(30);
      a["reroute_audio"] = json!(true);
      t("browser_source", a, false, false, false)
    }
    "kamera" => {
      let aygit = secim(deger).ok_or("kamera seçilmeli")?;
      t("dshow_input", json!({"video_device_id": aygit}), true, false, true)
    }
    "mikrofon" => t("wasapi_input_capture", json!({"device_id": secim(deger).unwrap_or("default")}), true, true, false),
    "masaustu" => t("wasapi_output_capture", json!({"device_id": secim(deger).unwrap_or("default")}), true, true, false),
    _ => return Err(format!("bilinmeyen kaynak türü: {tur}")),
  })
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn renk_libobs_bicimine_cevrilir() {
    assert_eq!(renk("#FF0000").unwrap(), 0xff00_00ff);
    assert_eq!(renk("00ff00").unwrap(), 0xff00_ff00);
    assert_eq!(renk("#0000ff").unwrap(), 0xffff_0000);
    assert!(renk("#12345").is_err());
    assert!(renk("red").is_err());
  }

  #[test]
  fn kaynak_tanimi_girdileri_dogrular() {
    let r = kaynak_tanimi("renk", "#101820", 1920, 1080).unwrap();
    assert_eq!(r.obs_turu, "color_source");
    assert_eq!(r.ayarlar["width"], 1920);
    assert!(!r.yakalama);
    // Yazı: denetim karakterleri atılır, uzunluk sınırlı
    let y = kaynak_tanimi("yazi", "Merhaba\u{0007} dünya", 1920, 1080).unwrap();
    assert_eq!(y.ayarlar["text"], "Merhaba dünya");
    assert!(kaynak_tanimi("yazi", "   ", 1920, 1080).is_err());
    // Dosyalar: göreli yol, yanlış uzantı, olmayan dosya reddedilir; ağ adresi kabul edilmez
    assert!(kaynak_tanimi("gorsel", "resim.png", 1920, 1080).is_err());
    assert!(kaynak_tanimi("gorsel", r"C:\Windows\win.ini", 1920, 1080).is_err());
    assert!(kaynak_tanimi("medya", "http://ornek.com/a.mp4", 1920, 1080).is_err());
    assert!(kaynak_tanimi("medya", r"C:\yok\yok.mp4", 1920, 1080).is_err());
    // Yakalama türleri işaretli
    assert!(kaynak_tanimi("ekran", "", 1920, 1080).unwrap().yakalama);
    let m = kaynak_tanimi("mikrofon", "", 1920, 1080).unwrap();
    assert!(m.yakalama && m.ses);
    assert_eq!(m.ayarlar["device_id"], "default");
    // Seçimli türler: seçim zorunlu (pencere, kamera), denetim karakteri reddedilir
    assert!(kaynak_tanimi("pencere", "", 1920, 1080).is_err());
    assert!(kaynak_tanimi("kamera", "a\u{0007}b", 1920, 1080).is_err());
    assert_eq!(kaynak_tanimi("kamera", r"Kamera:\\?\usb#1", 1920, 1080).unwrap().ayarlar["video_device_id"], r"Kamera:\\?\usb#1");
    assert_eq!(kaynak_tanimi("ekran", r"\\?\DISPLAY#1", 1920, 1080).unwrap().ayarlar["monitor_id"], r"\\?\DISPLAY#1");
    assert!(kaynak_tanimi("uydurma", "", 1920, 1080).is_err());
    // Slayt gösterisi: mutlak ve var olan klasör
    let k = std::env::temp_dir();
    let s = kaynak_tanimi("slayt", &k.to_string_lossy(), 1920, 1080).unwrap();
    assert_eq!((s.obs_turu.as_str(), s.ayarlar["files"][0]["value"].as_str()), ("slideshow", Some(k.to_string_lossy().as_ref())));
    assert!(kaynak_tanimi("slayt", "Resimler", 1920, 1080).is_err());
    assert!(kaynak_tanimi("slayt", r"C:\yok\klasor", 1920, 1080).is_err());
    // Tarayıcı: http(s) adresi ya da yerel .html; kimlik bilgili adres reddedilir; ses motora yönlendirilir
    let b = kaynak_tanimi("tarayici", "https://ornek.com/widget?tema=koyu", 1920, 1080).unwrap();
    assert_eq!((b.obs_turu.as_str(), b.ayarlar["is_local_file"].as_bool(), b.ayarlar["reroute_audio"].as_bool()), ("browser_source", Some(false), Some(true)));
    assert!(kaynak_tanimi("tarayici", "https://kisi:parola@ornek.com/", 1920, 1080).is_err());
    assert!(kaynak_tanimi("tarayici", "ftp://ornek.com/a.html", 1920, 1080).is_err());
    assert!(kaynak_tanimi("tarayici", "https://", 1920, 1080).is_err());
    // Oyun: pencere verilirse belirli pencere kipi; uygulama sesi uygulama seçimi ister
    assert_eq!(kaynak_tanimi("oyun", "", 1920, 1080).unwrap().ayarlar["capture_mode"], "any_fullscreen");
    assert_eq!(kaynak_tanimi("oyun", "Oyun:Sinif:oyun.exe", 1920, 1080).unwrap().ayarlar["capture_mode"], "window");
    assert!(kaynak_tanimi("uygulama_sesi", "", 1920, 1080).is_err());
    let u = kaynak_tanimi("uygulama_sesi", "Muzik:Sinif:muzik.exe", 1920, 1080).unwrap();
    assert!(u.ses && u.yakalama && u.obs_turu == "wasapi_process_output_capture");
  }
}
