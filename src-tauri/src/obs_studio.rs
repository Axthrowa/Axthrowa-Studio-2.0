//! Kullanıcının kurulu OBS Studio'suyla bütünleşme.
//!
//! Yayının kendisi (sahneler, kaynaklar, kodlayıcılar, eklentiler) OBS'in kendi arayüzünde yapılır; bu uygulama
//! OBS'e özel tarayıcı dock'ları olarak girer ve obs-websocket üzerinden konuşur. Bu modül:
//! - OBS'in kurulumunu, sürümünü ve çalışıp çalışmadığını bulur,
//! - panel dock'larını OBS'in kullanıcı ayarına yazar (`user.ini` › `[BasicWindow]` › `ExtraBrowserDocks`),
//! - obs-websocket bağlantı bilgisini OBS'in kendi ayarından okur.
//!
//! OBS ayar dosyalarına yalnız OBS kapalıyken yazılır: OBS kapanırken kendi bellekteki hâlini diske yazar ve
//! çalışırken yapılan değişikliği ezer.

use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::{json, Value};

/// Panelin OBS'e eklenebilen dock'ları: (kimlik, OBS'teki başlık). Adres `/dock?id=<kimlik>`.
pub const DOCKLAR: &[(&str, &str)] = &[
  ("sohbet", "YYA · Çoklu Sohbet"),
  ("etkinlik", "YYA · Etkinlik Akışı"),
  ("deste", "YYA · Hızlı Eylemler"),
  ("yayinbilgisi", "YYA · Yayın Bilgisi"),
  ("kontrol", "YYA · Kontrol Merkezi"),
  ("muzik", "YYA · Müzik"),
  ("sesler", "YYA · Ses Paneli"),
  ("panel", "YYA · Panel"),
];

/// İlk kurulumda önerilen dock'lar (geri kalanı OBS Studio sekmesinden eklenir)
pub const ONERILEN: &[&str] = &["sohbet", "etkinlik", "deste", "yayinbilgisi"];

/// Dock'un OBS'teki kalıcı kimliği. Sabit olduğundan yeniden yazınca OBS yerleşimi (DockState) korunur ve
/// dock çoğalmaz.
fn dock_uuid(kimlik: &str) -> String {
  // FNV-1a: kimlikten belirlenimci, UUID biçiminde bir değer
  let mut h: u64 = 0xcbf2_9ce4_8422_2325;
  for b in kimlik.bytes() {
    h ^= b as u64;
    h = h.wrapping_mul(0x0100_0000_01b3);
  }
  format!("79a7a000-{:04x}-4{:03x}-8{:03x}-{:012x}", (h >> 48) & 0xffff, (h >> 36) & 0xfff, (h >> 24) & 0xfff, h & 0xffff_ffff_ffff)
}

pub fn dock_adresi(taban: &str, kimlik: &str) -> String {
  if kimlik == "panel" {
    format!("{taban}/panel?obs=1")
  } else {
    format!("{taban}/dock?id={kimlik}&obs=1")
  }
}

/// `%APPDATA%\obs-studio` (OBS'in kullanıcı ayarları)
pub fn ayar_dizini() -> Option<PathBuf> {
  let appdata = std::env::var_os("APPDATA")?;
  let d = PathBuf::from(appdata).join("obs-studio");
  d.is_dir().then_some(d)
}

/// OBS'in yürütülebilir dosyası mı (ad denetimi): ön yüzden gelen yol diskteki herhangi bir programı başlatmasın.
pub fn obs_exe_mi(path: &Path) -> bool {
  path
    .file_name()
    .and_then(|n| n.to_str())
    .map(|n| matches!(n.to_ascii_lowercase().as_str(), "obs64.exe" | "obs32.exe" | "obs.exe"))
    .unwrap_or(false)
}

/// Aday OBS yolları: kullanıcının verdiği yol (yalnız OBS exe adıysa), kayıt defterindeki kurulum, olağan klasörler.
pub fn aday_yollar(ozel: Option<&str>) -> Vec<PathBuf> {
  let mut out = Vec::new();
  if let Some(p) = ozel.map(str::trim).filter(|s| !s.is_empty()) {
    let p = PathBuf::from(p);
    // Ağ paylaşımı (`\\sunucu\pay\obs64.exe`) reddedilir: ayar/yedek ile uzaktan exe çalıştırılmasın
    if obs_exe_mi(&p) && crate::media::yerel_disk_yolu(&p) {
      out.push(p);
    }
  }
  #[cfg(target_os = "windows")]
  {
    if let Some(kok) = kayit_defteri_kurulumu() {
      out.push(kok.join(r"bin\64bit\obs64.exe"));
    }
    let pf = std::env::var("ProgramFiles").unwrap_or_else(|_| r"C:\Program Files".into());
    let pf86 = std::env::var("ProgramFiles(x86)").unwrap_or_else(|_| r"C:\Program Files (x86)".into());
    let local = std::env::var("LOCALAPPDATA").unwrap_or_default();
    for root in [pf, pf86, local] {
      if root.is_empty() {
        continue;
      }
      out.push(PathBuf::from(&root).join(r"obs-studio\bin\64bit\obs64.exe"));
      out.push(PathBuf::from(&root).join(r"obs-studio\bin\64bit\obs.exe"));
    }
  }
  out
}

/// OBS kurulumu `HKLM\SOFTWARE\OBS Studio` (varsayılan değer = kurulum klasörü)
#[cfg(target_os = "windows")]
fn kayit_defteri_kurulumu() -> Option<PathBuf> {
  use std::os::windows::process::CommandExt;
  const CREATE_NO_WINDOW: u32 = 0x0800_0000;
  let out = std::process::Command::new(crate::sistem_araci::yol("reg.exe"))
    .args(["query", r"HKLM\SOFTWARE\OBS Studio", "/ve"])
    .creation_flags(CREATE_NO_WINDOW)
    .output()
    .ok()?;
  let metin = String::from_utf8_lossy(&out.stdout);
  metin
    .lines()
    .find_map(|l| l.split_once("REG_SZ").map(|(_, v)| v.trim().to_string()))
    .filter(|v| !v.is_empty())
    .map(PathBuf::from)
}

pub fn exe_yolu(ozel: Option<&str>) -> Option<PathBuf> {
  aday_yollar(ozel).into_iter().find(|p| p.is_file())
}

pub fn calisiyor() -> bool {
  #[cfg(target_os = "windows")]
  {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    for ad in ["obs64.exe", "obs.exe"] {
      let out = std::process::Command::new(crate::sistem_araci::yol("tasklist.exe"))
        .args(["/FI", &format!("IMAGENAME eq {ad}"), "/NH"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();
      if let Ok(o) = out {
        if String::from_utf8_lossy(&o.stdout).to_ascii_lowercase().contains(ad) {
          return true;
        }
      }
    }
  }
  false
}

/// OBS'i başlatır: `"already"` zaten açık, `"launched"` başlatıldı. OBS çalışma klasörü olarak kendi `bin\64bit`
/// klasörünü ister (yoksa modülleri bulamaz).
pub fn baslat(ozel: Option<&str>) -> Result<&'static str, String> {
  if calisiyor() {
    return Ok("already");
  }
  let mut son_hata = "OBS Studio bulunamadı — obsproject.com'dan kurun ya da yolunu Ayarlar'da verin".to_string();
  for path in aday_yollar(ozel) {
    if !path.is_file() {
      continue;
    }
    let mut cmd = std::process::Command::new(&path);
    if let Some(dir) = path.parent() {
      cmd.current_dir(dir);
    }
    #[cfg(target_os = "windows")]
    {
      use std::os::windows::process::CommandExt;
      const CREATE_NO_WINDOW: u32 = 0x0800_0000;
      // DETACHED_PROCESS — konsolsuz, uygulama kapanınca OBS düşmesin
      const DETACHED_PROCESS: u32 = 0x0000_0008;
      cmd.creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS);
    }
    match cmd.spawn() {
      Ok(_) => return Ok("launched"),
      Err(e) => son_hata = format!("{}: {e}", path.display()),
    }
  }
  Err(son_hata)
}

// ---------------------------------------------------------------------------------------------------------------
// INI (OBS'in config_t biçimi: `[Bölüm]`, `anahtar=değer`, UTF-8 BOM'lu olabilir)

pub fn ini_oku(metin: &str, bolum: &str, anahtar: &str) -> Option<String> {
  let mut icinde = false;
  for satir in metin.lines() {
    let t = satir.trim().trim_start_matches('\u{feff}');
    if t.starts_with('[') && t.ends_with(']') {
      icinde = &t[1..t.len() - 1] == bolum;
      continue;
    }
    if icinde {
      if let Some((k, v)) = t.split_once('=') {
        if k.trim() == anahtar {
          return Some(v.to_string());
        }
      }
    }
  }
  None
}

/// Değeri yazar (varsa değiştirir, yoksa bölümün sonuna, bölüm de yoksa dosyanın sonuna ekler). Geri kalan her
/// satır ve satır sonu biçimi (CRLF) olduğu gibi kalır.
pub fn ini_yaz(metin: &str, bolum: &str, anahtar: &str, deger: &str) -> String {
  let eol = if metin.contains("\r\n") { "\r\n" } else { "\n" };
  let satirlar: Vec<&str> = if metin.is_empty() { Vec::new() } else { metin.split(eol).collect() };
  let mut out: Vec<String> = Vec::with_capacity(satirlar.len() + 2);
  let mut icinde = false;
  let mut bolum_var = false;
  let mut yazildi = false;
  let yeni = format!("{anahtar}={deger}");
  for satir in satirlar {
    let t = satir.trim().trim_start_matches('\u{feff}');
    if t.starts_with('[') && t.ends_with(']') {
      if icinde && !yazildi {
        // Bölümün sonundaki boş satırların önüne ekle
        let mut bos = Vec::new();
        while out.last().is_some_and(|s| s.trim().is_empty()) {
          bos.push(out.pop().unwrap_or_default());
        }
        out.push(yeni.clone());
        out.extend(bos.into_iter().rev());
        yazildi = true;
      }
      icinde = &t[1..t.len() - 1] == bolum;
      bolum_var |= icinde;
      out.push(satir.to_string());
      continue;
    }
    if icinde && !yazildi {
      if let Some((k, _)) = t.split_once('=') {
        if k.trim() == anahtar {
          out.push(yeni.clone());
          yazildi = true;
          continue;
        }
      }
    }
    out.push(satir.to_string());
  }
  if !yazildi {
    if !bolum_var {
      while out.last().is_some_and(|s| s.is_empty()) {
        out.pop();
      }
      if !out.is_empty() {
        out.push(String::new());
      }
      out.push(format!("[{bolum}]"));
    } else {
      while out.last().is_some_and(|s| s.is_empty()) {
        out.pop();
      }
    }
    out.push(yeni);
    out.push(String::new());
  }
  out.join(eol)
}

// ---------------------------------------------------------------------------------------------------------------
// Sürüm ve dock ayarı

/// `global.ini` › `[General]` › `LastVersion` (LIBOBS_API_VER: ana<<24 | ara<<16 | yama)
pub fn surum(dizin: &Path) -> Option<String> {
  let metin = std::fs::read_to_string(dizin.join("global.ini")).ok()?;
  let v: u64 = ini_oku(&metin, "General", "LastVersion")?.trim().parse().ok()?;
  Some(format!("{}.{}.{}", v >> 24, (v >> 16) & 0xff, v & 0xffff))
}

/// Dock listesini tutan dosya: OBS 31+ `user.ini`, daha eskisi `global.ini`
fn dock_dosyasi(dizin: &Path) -> PathBuf {
  let user = dizin.join("user.ini");
  if user.is_file() {
    user
  } else {
    dizin.join("global.ini")
  }
}

fn docklar_json(metin: &str) -> Vec<Value> {
  ini_oku(metin, "BasicWindow", "ExtraBrowserDocks")
    .and_then(|v| serde_json::from_str::<Vec<Value>>(v.trim()).ok())
    .unwrap_or_default()
}

/// Bizim dock'umuz mu: sabit kimliklerden biri ya da panel adresine giden bir dock
fn bizim_mi(d: &Value, taban: &str) -> bool {
  let uuid = d.get("uuid").and_then(Value::as_str).unwrap_or("");
  let url = d.get("url").and_then(Value::as_str).unwrap_or("");
  DOCKLAR.iter().any(|(k, _)| dock_uuid(k) == uuid) || url.starts_with(&format!("{taban}/dock?")) || url.starts_with(&format!("{taban}/panel"))
}

/// OBS'te kayıtlı bizim dock'larımızın kimlikleri
pub fn ekli_docklar(dizin: &Path) -> Vec<String> {
  let metin = std::fs::read_to_string(dock_dosyasi(dizin)).unwrap_or_default();
  let liste = docklar_json(&metin);
  DOCKLAR
    .iter()
    .filter(|(k, _)| liste.iter().any(|d| d.get("uuid").and_then(Value::as_str) == Some(dock_uuid(k).as_str())))
    .map(|(k, _)| k.to_string())
    .collect()
}

/// Dock listesini yeniden kurar: kullanıcının kendi dock'ları kalır, bizimkiler `secilen` ile değişir.
pub fn docklari_birlestir(mevcut: Vec<Value>, taban: &str, secilen: &[&str]) -> Vec<Value> {
  let mut out: Vec<Value> = mevcut.into_iter().filter(|d| !bizim_mi(d, taban)).collect();
  for (k, baslik) in DOCKLAR {
    if secilen.contains(k) {
      out.push(json!({ "title": baslik, "url": dock_adresi(taban, k), "uuid": dock_uuid(k) }));
    }
  }
  out
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DockSonucu {
  pub dosya: String,
  pub yedek: Option<String>,
  pub ekli: Vec<String>,
}

/// Seçilen dock'ları OBS'e yazar (boş seçim = bizimkileri kaldır). OBS açıksa yazılmaz.
pub fn docklari_yaz(taban: &str, secilen: &[&str]) -> Result<DockSonucu, String> {
  if calisiyor() {
    return Err("OBS açık. Dock'lar OBS kapalıyken yazılabilir (OBS kapanırken kendi ayarını diske yazar ve değişikliği ezer). OBS'i kapatıp yeniden deneyin.".into());
  }
  let dizin = ayar_dizini().ok_or("OBS ayar klasörü (%APPDATA%\\obs-studio) yok — OBS'i en az bir kez açıp kapatın")?;
  let dosya = dock_dosyasi(&dizin);
  let ham = std::fs::read(&dosya).unwrap_or_default();
  let bom = ham.starts_with(&[0xEF, 0xBB, 0xBF]);
  let metin = String::from_utf8_lossy(if bom { &ham[3..] } else { &ham[..] }).into_owned();

  let liste = docklari_birlestir(docklar_json(&metin), taban, secilen);
  let deger = serde_json::to_string(&liste).map_err(|e| e.to_string())?;
  let yeni = ini_yaz(&metin, "BasicWindow", "ExtraBrowserDocks", &deger);

  // İlk değişiklikten önce özgün dosyanın yedeği (sonrakiler yedeği ezmez)
  let yedek_yolu = dosya.with_extension("ini.yya-yedek");
  let yedek = if !yedek_yolu.exists() && !ham.is_empty() {
    std::fs::write(&yedek_yolu, &ham).map_err(|e| format!("Yedek alınamadı: {e}"))?;
    Some(yedek_yolu.display().to_string())
  } else {
    None
  };

  let mut bayt = Vec::with_capacity(yeni.len() + 3);
  if bom || ham.is_empty() {
    bayt.extend_from_slice(&[0xEF, 0xBB, 0xBF]);
  }
  bayt.extend_from_slice(yeni.as_bytes());
  let gecici = dosya.with_extension("ini.yya-gecici");
  std::fs::write(&gecici, &bayt).map_err(|e| format!("{} yazılamadı: {e}", gecici.display()))?;
  std::fs::rename(&gecici, &dosya).map_err(|e| format!("{} yazılamadı: {e}", dosya.display()))?;
  Ok(DockSonucu { dosya: dosya.display().to_string(), yedek, ekli: ekli_docklar(&dizin) })
}

// ---------------------------------------------------------------------------------------------------------------
// obs-websocket

#[derive(Debug, Clone, Default)]
pub struct WebsocketAyari {
  pub etkin: bool,
  pub port: u16,
  pub sifre_gerekli: bool,
  pub sifre: String,
}

/// `plugin_config/obs-websocket/config.json` (obs-websocket 5.x, OBS 28+)
pub fn websocket_ayari() -> Option<WebsocketAyari> {
  let p = ayar_dizini()?.join(r"plugin_config\obs-websocket\config.json");
  websocket_ayari_ayristir(&std::fs::read_to_string(p).ok()?)
}

pub fn websocket_ayari_ayristir(metin: &str) -> Option<WebsocketAyari> {
  let v: Value = serde_json::from_str(metin).ok()?;
  Some(WebsocketAyari {
    etkin: v.get("server_enabled").and_then(Value::as_bool).unwrap_or(false),
    port: v.get("server_port").and_then(Value::as_u64).and_then(|p| u16::try_from(p).ok()).unwrap_or(4455),
    sifre_gerekli: v.get("auth_required").and_then(Value::as_bool).unwrap_or(false),
    sifre: v.get("server_password").and_then(Value::as_str).unwrap_or("").to_string(),
  })
}

pub fn yerel_adres_mi(host: &str) -> bool {
  matches!(host.trim(), "" | "127.0.0.1" | "localhost" | "::1" | "[::1]")
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn ini_degeri_degistirilir_ve_geri_kalan_korunur() {
    let m = "[General]\r\nName=x\r\n\r\n[BasicWindow]\r\nDockState=abc\r\nExtraBrowserDocks=[]\r\nSnap=true\r\n\r\n[Audio]\r\nA=1\r\n";
    let y = ini_yaz(m, "BasicWindow", "ExtraBrowserDocks", "[{\"a\":1}]");
    assert_eq!(y, m.replace("ExtraBrowserDocks=[]", "ExtraBrowserDocks=[{\"a\":1}]"));
    assert_eq!(ini_oku(&y, "BasicWindow", "ExtraBrowserDocks").as_deref(), Some("[{\"a\":1}]"));
    assert_eq!(ini_oku(&y, "General", "ExtraBrowserDocks"), None);
  }

  #[test]
  fn ini_anahtari_yoksa_bolum_sonuna_bolum_yoksa_dosya_sonuna_eklenir() {
    let m = "[BasicWindow]\nDockState=abc\n\n[Audio]\nA=1\n";
    let y = ini_yaz(m, "BasicWindow", "ExtraBrowserDocks", "[]");
    assert_eq!(y, "[BasicWindow]\nDockState=abc\nExtraBrowserDocks=[]\n\n[Audio]\nA=1\n");
    let y = ini_yaz("[Audio]\nA=1\n", "BasicWindow", "ExtraBrowserDocks", "[]");
    assert_eq!(y, "[Audio]\nA=1\n\n[BasicWindow]\nExtraBrowserDocks=[]\n");
    assert_eq!(ini_yaz("", "BasicWindow", "K", "1"), "[BasicWindow]\nK=1\n");
    let y = ini_yaz("[BasicWindow]\nA=1\n", "BasicWindow", "K", "1");
    assert_eq!(y, "[BasicWindow]\nA=1\nK=1\n");
  }

  #[test]
  fn docklar_birlesir_kullanicinin_docklari_kalir_bizimkiler_cogalmaz() {
    let taban = "http://127.0.0.1:8843";
    let kullanici = json!({"title": "Twitch Chat", "url": "https://twitch.tv/popout/x/chat", "uuid": "u-1"});
    let eski_bizim = json!({"title": "Eski", "url": format!("{taban}/dock?id=sohbet"), "uuid": "baska"});
    let liste = docklari_birlestir(vec![kullanici.clone(), eski_bizim], taban, &["sohbet", "deste"]);
    assert_eq!(liste.len(), 3);
    assert_eq!(liste[0], kullanici);
    assert_eq!(liste[1]["url"], format!("{taban}/dock?id=sohbet&obs=1"));
    assert_eq!(liste[1]["uuid"], dock_uuid("sohbet"));
    // Yeniden yazmak çoğaltmaz; boş seçim yalnız bizimkileri kaldırır
    let tekrar = docklari_birlestir(liste.clone(), taban, &["sohbet", "deste"]);
    assert_eq!(tekrar, liste);
    assert_eq!(docklari_birlestir(liste, taban, &[]), vec![kullanici]);
  }

  #[test]
  fn dock_kimlikleri_sabit_tekil_ve_uuid_bicimli() {
    let mut gorulen = std::collections::HashSet::new();
    for (k, _) in DOCKLAR {
      let u = dock_uuid(k);
      assert_eq!(u, dock_uuid(k));
      assert_eq!(u.len(), 36, "{u}");
      assert_eq!(u.matches('-').count(), 4, "{u}");
      assert!(gorulen.insert(u));
    }
    assert!(ONERILEN.iter().all(|o| DOCKLAR.iter().any(|(k, _)| k == o)));
    assert_eq!(dock_adresi("http://h", "panel"), "http://h/panel?obs=1");
  }

  #[test]
  fn websocket_ayari_okunur() {
    let w = websocket_ayari_ayristir(r#"{"auth_required":true,"server_enabled":true,"server_password":"p@ss","server_port":4456}"#).unwrap();
    assert!(w.etkin && w.sifre_gerekli);
    assert_eq!((w.port, w.sifre.as_str()), (4456, "p@ss"));
    assert_eq!(websocket_ayari_ayristir("{}").unwrap().port, 4455);
    assert!(websocket_ayari_ayristir("bozuk").is_none());
  }

  #[test]
  fn yalniz_obs_exe_adlari_kabul_edilir() {
    assert!(obs_exe_mi(Path::new(r"C:\x\obs64.exe")));
    assert!(!obs_exe_mi(Path::new(r"C:\Windows\System32\cmd.exe")));
    assert!(aday_yollar(Some(r"C:\Windows\System32\cmd.exe")).iter().all(|p| obs_exe_mi(p)));
  }

  #[cfg(windows)]
  #[test]
  fn ag_paylasimindaki_obs_reddedilir() {
    let unc = Path::new(r"\\saldirgan\pay\obs64.exe");
    assert!(!aday_yollar(Some(r"\\saldirgan\pay\obs64.exe")).iter().any(|p| p == unc));
    let yerel = Path::new(r"D:\OBS\bin\64bit\obs64.exe");
    assert_eq!(aday_yollar(Some(r"D:\OBS\bin\64bit\obs64.exe")).first().map(|p| p.as_path()), Some(yerel));
  }
}
