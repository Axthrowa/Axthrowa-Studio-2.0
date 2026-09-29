//! Yayın Yönetim Aracı — yerel yayın çekirdeği (libobs tabanlı, ayrı süreç).
//!
//!   yayin-motoru bilgi               libobs sürümü, yüklü modüller, kullanılabilir kodlayıcılar (JSON)
//!   yayin-motoru sinama [klasör]     sentetik uçtan uca sınama (yalnız 127.0.0.1 alıcıları)
//!   yayin-motoru remux <girdi> <çıktı>
//!                                    kaydı yeniden kodlamadan başka kaba kopyalar (ilerleme JSON satırları)
//!   yayin-motoru hizmet              stdio üzerinden JSON satır protokolü (panel bu kipi başlatır)
//!   yayin-motoru eklenti-yokla <dll> [veri-klasörü]
//!                                    tek bir OBS eklentisini bu süreçte yükler, sonucu JSON olarak yazar ve çıkar
//!                                    (yalıtılmış uyumluluk yoklaması; eklenti çökerse yalnız bu süreç düşer)
//!
//! Lisans: GPL-2.0-or-later (libobs bu sürece yüklenir). Bkz. LICENSE ve docs/STREAMING_ENGINE_DECISION.md ADR-003.

mod akis;
mod cokme;
mod eklenti;
mod etkilesim;
mod filtre;
mod gecis;
mod motor;
mod multiview;
mod obs;
mod onizleme;
mod protokol;
mod remux;
mod sahne;
mod sanal_kamera;
mod servis;
mod ses;
mod sinama;
mod ui_gorev;

use std::path::PathBuf;
use std::process::ExitCode;

/// Çökmede ya da eksik DLL'de Windows hata penceresi açılmasın: motor arka plan sürecidir (kullanıcı tam ekran oyunda
/// olabilir) ve eklenti hatası panele yazılı olarak bildirilir.
#[cfg(windows)]
fn hata_pencerelerini_kapat() {
  #[link(name = "kernel32")]
  extern "system" {
    fn SetErrorMode(kip: u32) -> u32;
  }
  const SEM_FAILCRITICALERRORS: u32 = 0x0001;
  const SEM_NOGPFAULTERRORBOX: u32 = 0x0002;
  const SEM_NOOPENFILEERRORBOX: u32 = 0x8000;
  unsafe { SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX | SEM_NOOPENFILEERRORBOX) };
}

#[cfg(not(windows))]
fn hata_pencerelerini_kapat() {}

fn main() -> ExitCode {
  hata_pencerelerini_kapat();
  cokme::kur();
  let args: Vec<String> = std::env::args().collect();
  match args.get(1).map(String::as_str) {
    Some("bilgi") => bilgi(),
    Some("eklenti-yokla") => match args.get(2) {
      Some(dll) => eklenti_yokla(dll, args.get(3).map(String::as_str).unwrap_or("")),
      None => {
        eprintln!("kullanım: yayin-motoru eklenti-yokla <dll> [veri-klasörü]");
        ExitCode::from(64)
      }
    },
    Some("sinama") => {
      let klasor = args.get(2).map(PathBuf::from).unwrap_or_else(|| std::env::temp_dir().join("yayin-motoru-sinama"));
      match sinama::calistir(&klasor) {
        Ok(true) => ExitCode::SUCCESS,
        Ok(false) => ExitCode::from(1),
        Err(e) => {
          eprintln!("sınama hatası: {e}");
          ExitCode::from(2)
        }
      }
    }
    Some("olcek-sinama") => match (args.get(2), args.get(3)) {
      (Some(k), Some(medya)) => match sinama::olcek_sinamasi(std::path::Path::new(k), std::path::Path::new(medya)) {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
          eprintln!("ölçek sınaması hatası: {e}");
          ExitCode::from(2)
        }
      },
      _ => ExitCode::from(64),
    },
    Some("remux") => match (args.get(2), args.get(3)) {
      (Some(g), Some(c)) => remux_calistir(std::path::Path::new(g), std::path::Path::new(c)),
      _ => {
        eprintln!("kullanım: yayin-motoru remux <girdi> <çıktı.mp4|.mov|.mkv>");
        ExitCode::from(64)
      }
    },
    Some("hizmet") => match protokol::hizmet() {
      Ok(()) => ExitCode::SUCCESS,
      Err(e) => {
        eprintln!("hizmet hatası: {e}");
        ExitCode::from(2)
      }
    },
    _ => {
      eprintln!("kullanım: yayin-motoru <bilgi | sinama [klasör] | hizmet | eklenti-yokla <dll> [veri]>");
      ExitCode::from(64)
    }
  }
}

/// Remux alt süreci: stdout'a `{"ilerleme": 0.42}` satırları, sonda `{"tamam": true, ...}` ya da `{"hata": "..."}`.
fn remux_calistir(girdi: &std::path::Path, cikti: &std::path::Path) -> ExitCode {
  use std::io::Write;
  let yaz = |v: serde_json::Value| {
    let mut o = std::io::stdout().lock();
    let _ = writeln!(o, "{v}");
    let _ = o.flush();
  };
  let sonuc = obs::ObsKurulumu::bul().and_then(|k| {
    obs::dll_klasoru_ekle(&k.bin)?;
    remux::remux(&k.bin, girdi, cikti, |x| yaz(serde_json::json!({ "ilerleme": (x * 1000.0).round() / 1000.0 })))
  });
  match sonuc {
    Ok(s) => {
      yaz(serde_json::json!({ "tamam": true, "sonuc": s }));
      ExitCode::SUCCESS
    }
    Err(e) => {
      yaz(serde_json::json!({ "hata": e }));
      ExitCode::from(1)
    }
  }
}

/// Yalıtılmış yoklama: libobs + temel modüller + TEK eklenti. Eklentinin yazdığı modül ayarları geçici klasöre gider
/// ve silinir. Sonuç stdout'a tek JSON satırı; libobs günlüğü stderr'e (panel son satırları tanı için saklar).
fn eklenti_yokla(dll: &str, veri: &str) -> ExitCode {
  // Motor çalışma dizinini OBS bin klasörüne taşır: göreli yollar önceden mutlaklaştırılır
  let mutlak = |p: &str| -> String {
    if p.is_empty() {
      return String::new();
    }
    std::path::absolute(p).map(|x| x.to_string_lossy().into_owned()).unwrap_or_else(|_| p.to_string())
  };
  let (dll, veri) = (mutlak(dll), mutlak(veri));
  let gecici = std::env::temp_dir().join(format!("yayin-motoru-yoklama-{}", std::process::id()));
  std::env::set_var("YAYIN_MOTORU_AYAR", &gecici);
  let (tx, _rx) = std::sync::mpsc::channel();
  let sonuc = match motor::Motor::baslat(motor::MotorAyari::yeni(640, 360, 30), tx, Box::new(std::io::stderr())) {
    Ok(mut m) => {
      let istek = eklenti::EklentiIstegi { id: "yoklama".into(), dll: dll.clone(), veri: veri.clone() };
      let s = m.eklentileri_yukle(std::slice::from_ref(&istek), None);
      let v = serde_json::json!({ "libobs": m.surum(), "yoklama": s.first() });
      m.kapat();
      Ok(v)
    }
    Err(e) => Err(e),
  };
  let _ = std::fs::remove_dir_all(&gecici);
  match sonuc {
    Ok(v) => {
      println!("{v}");
      ExitCode::SUCCESS
    }
    Err(e) => {
      println!("{}", serde_json::json!({ "hata": e }));
      ExitCode::from(3)
    }
  }
}

fn bilgi() -> ExitCode {
  let (tx, _rx) = std::sync::mpsc::channel();
  let gunluk = Box::new(std::io::stderr());
  match motor::Motor::baslat(motor::MotorAyari::yeni(1280, 720, 30), tx, gunluk) {
    Ok(m) => {
      let v = serde_json::json!({
        "libobs": m.surum(),
        "moduller": m.moduller(),
        "video_kodlayicilari": m.video_kodlayicilari(),
        "giris_turleri": m.giris_turleri(),
      });
      m.kapat();
      println!("{}", serde_json::to_string_pretty(&v).unwrap_or_default());
      ExitCode::SUCCESS
    }
    Err(e) => {
      eprintln!("motor başlatılamadı: {e}");
      ExitCode::from(2)
    }
  }
}
