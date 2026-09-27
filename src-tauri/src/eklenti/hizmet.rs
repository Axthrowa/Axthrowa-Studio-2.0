//! Kayıt defteri hizmetleri: çözümlemeden kayıt üretme/güncelleme, yeniden değerlendirme, yoklama ve motor yükleme
//! sonuçlarını işleme. Dosya kilidi çağıranındır (`AppState::eklenti_kilidi`).

use super::cozumleme::{Baglam, Cozumleme};
use super::kayit::{simdi, CokmeKaydi, EklentiKaydi, KonumTuru, SonYukleme, OTOMATIK_KARANTINA_ESIGI};
use super::uyumluluk::{api_metni, degerlendir, Yoklama};
use super::win::Imza;

/// Motorun kullandığı libobs'un LIBOBS_API_VER'i ("32.2.2" → 32<<24|2<<16|2). Okunamazsa desteklenen ana sürüm.
pub fn libobs_api(surum: &str) -> u32 {
  let p: Vec<u32> = surum.split('.').filter_map(|x| x.trim().parse().ok()).collect();
  match p.as_slice() {
    [a, b, c, ..] => (a << 24) | (b << 16) | c,
    [a, b] => (a << 24) | (b << 16),
    _ => 32 << 24,
  }
}

/// Motorun kendisinin yüklediği OBS modülleri (motor/src/motor.rs TEMEL_MODULLER + YAKALAMA_MODULLERI).
pub const MOTORUN_MODULLERI: &[&str] = &[
  "image-source", "obs-ffmpeg", "obs-nvenc", "obs-x264", "obs-outputs", "obs-text", "obs-transitions", "obs-filters",
  "win-capture", "win-dshow", "win-wasapi",
];

/// Motorun bilerek yüklemediği OBS modülleri ve nedeni (ADR-003).
pub const MOTORUN_YUKLEMEDIKLERI: &[(&str, &str)] = &[
  ("obs-websocket", "Kullanıcının OBS'iyle aynı portu açar; panel OBS'e zaten bağlanır"),
  ("frontend-tools", "OBS'in Qt arayüzünü ister (betikler, otomatik sahne değiştirici)"),
  ("rtmp-services", "Açılışta obsproject.com'dan servis listesi indirir; motor kendi RTMP servisini kullanır"),
];

/// Birinci taraf modülün motordaki durumu (üçüncü taraf için `None`). Yalnız imzası doğrulanmış modüle uygulanır,
/// böylece ad taklidiyle bir DLL bu kurala sokulamaz.
pub fn motor_notu(c: &Cozumleme) -> Option<String> {
  if !birinci_taraf(c) {
    return None;
  }
  if MOTORUN_MODULLERI.contains(&c.modul.as_str()) {
    return Some("Motor bu modülü kendisi yükler".into());
  }
  MOTORUN_YUKLEMEDIKLERI.iter().find(|(m, _)| *m == c.modul).map(|(_, neden)| format!("Motor bilerek yüklemez: {neden}"))
}

/// OBS ile gelen (birinci taraf) modül: OBS projesinin geçerli imzası. Ada göre karar verilmez.
pub fn birinci_taraf(c: &Cozumleme) -> bool {
  matches!(&c.imza, Imza::Gecerli { imzalayan } if imzalayan.contains("OBS Project"))
}

fn imza_adi(i: &Imza) -> &'static str {
  match i {
    Imza::Gecerli { .. } => "Gecerli",
    Imza::Imzasiz => "Imzasiz",
    Imza::GuvenilmeyenKok { .. } => "GuvenilmeyenKok",
    Imza::Bozuk => "Bozuk",
    Imza::SuresiDolmus { .. } => "SuresiDolmus",
    Imza::Dogrulanamadi { .. } => "Dogrulanamadi",
  }
}

/// Çözümlemeden kayıt üretir; önceki kayıt varsa kullanıcı kararları (etkin, açık onay, karantina, çökmeler,
/// yedekler) korunur. Dosya değiştiyse (SHA farklı) eski yoklama geçersizdir.
pub fn kayit_yap(onceki: Option<&EklentiKaydi>, c: &Cozumleme, konum: KonumTuru, motor_api: u32) -> EklentiKaydi {
  let mut e = onceki.cloned().unwrap_or_else(|| EklentiKaydi { eklendi: simdi(), ..Default::default() });
  if e.sha256 != c.sha256 {
    e.yoklama = None;
    e.gerekli_libobs = None;
    e.turler.clear();
  }
  e.id = c.modul.clone();
  e.ad = c.gorunen_ad();
  e.surum = c.surum();
  e.satici = c.satici();
  e.konum = konum;
  e.dll = c.dosya.clone();
  e.veri = c.veri_klasoru.clone();
  e.sha256 = c.sha256.clone();
  e.boyut = c.boyut;
  e.mimari = c.pe.as_ref().map(|p| format!("{:?}", p.mimari).to_lowercase()).unwrap_or_else(|| "?".into());
  e.imza = imza_adi(&c.imza).into();
  e.imzalayan = c.imza.imzalayan().map(str::to_string);
  e.bagimliliklar = c.bagimliliklar.iter().map(|b| b.ad.clone()).collect();
  e.eksik_bagimliliklar = c.eksik_bagimliliklar(false).into_iter().map(String::from).collect();
  e.on_yuz = c.on_yuz;
  e.qt = c.qt;
  e.tarayici = c.tarayici;
  e.birinci_taraf = birinci_taraf(c);
  e.motor_notu = motor_notu(c);
  e.diller = c.diller.clone();
  degerlendir_kayit(&mut e, c, motor_api);
  e
}

/// Yoklama bu libobs ana/ara sürümüyle mi yapıldı? ("32.2.2" ile 32<<24|2<<16). Sürüm bilinmiyorsa geçerli sayılır.
pub fn yoklama_guncel(y: &Yoklama, motor_api: u32) -> bool {
  if y.libobs.trim().is_empty() {
    return true;
  }
  libobs_api(&y.libobs) & 0xFFFF_0000 == motor_api & 0xFFFF_0000
}

pub fn degerlendir_kayit(e: &mut EklentiKaydi, c: &Cozumleme, motor_api: u32) {
  // OBS güncellendiyse (ana/ara sürüm değişti) eski yoklama "uyumlu" demeye yetmez: statik değerlendirmeye düşülür.
  // Çökme/zaman aşımı sonucu ise sürüm değişse de güvenlik için geçerli kalır.
  let eski = e.yoklama.as_ref().is_some_and(|y| !yoklama_guncel(y, motor_api) && y.sonuc != "cokme" && y.sonuc != "zaman_asimi");
  let yoklama = if eski { None } else { e.yoklama.as_ref() };
  let d = degerlendir(c, yoklama, motor_api, e.karantina.as_deref());
  e.durum = d.durum;
  e.nedenler = d.nedenler;
  if eski {
    let s = e.yoklama.as_ref().map(|y| y.libobs.clone()).unwrap_or_default();
    e.nedenler.insert(0, format!("Son sınama libobs {s} ile yapılmıştı; OBS güncellendi, yeniden sınayın."));
  }
  e.oneri = d.oneri;
  e.son_test_surumu = Some(env!("CARGO_PKG_VERSION").to_string());
}

/// Yalıtılmış yoklama (ya da motorun gerçek yüklemesi) sonucunu işler. Yoklamada çökme de çökme geçmişine yazılır;
/// eşiğe ulaşan eklenti karantinaya alınır.
pub fn yoklama_isle(e: &mut EklentiKaydi, c: &Cozumleme, y: Yoklama, motor_api: u32, asama: &str) {
  if y.sonuc == "cokme" || y.sonuc == "zaman_asimi" {
    e.cokmeler.push(CokmeKaydi { zaman: y.zaman, asama: asama.into(), kod: y.cikis_kodu });
    if e.yukleme_cokmeleri() >= OTOMATIK_KARANTINA_ESIGI && e.karantina.is_none() {
      e.karantina = Some(format!("Yüklenirken {} kez çöktü", e.yukleme_cokmeleri()));
    }
  }
  if y.api_surumu != 0 {
    e.gerekli_libobs = Some(api_metni(y.api_surumu));
  }
  if y.sonuc == "yuklendi" {
    e.turler = y.turler.clone();
  }
  e.son_yukleme = Some(SonYukleme { zaman: y.zaman, sonuc: y.sonuc.clone(), kod: y.cikis_kodu.unwrap_or(0) as i32 });
  e.yoklama = Some(y);
  degerlendir_kayit(e, c, motor_api);
}

/// Kayıttaki dosyayı yeniden çözümler (dosya silinmişse `None`).
pub fn yeniden_cozumle(e: &EklentiKaydi, b: &Baglam) -> Option<Cozumleme> {
  super::cozumleme::cozumle(&e.dll, e.veri.as_deref(), b).ok()
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn obs_guncellenince_eski_yoklama_gecersiz() {
    let y = Yoklama { sonuc: "yuklendi".into(), libobs: "32.2.2".into(), ..Default::default() };
    assert!(yoklama_guncel(&y, (32 << 24) | (2 << 16) | 9), "yama farkı önemsiz");
    assert!(!yoklama_guncel(&y, 33 << 24));
    assert!(!yoklama_guncel(&y, (32 << 24) | (3 << 16)));
    assert!(yoklama_guncel(&Yoklama::default(), 33 << 24));
  }

  #[test]
  fn libobs_surum_metni() {
    assert_eq!(libobs_api("32.2.2"), (32 << 24) | (2 << 16) | 2);
    assert_eq!(libobs_api("31.0"), 31 << 24);
    assert_eq!(libobs_api(""), 32 << 24);
  }

  #[test]
  fn kayit_kullanici_kararlarini_korur_ve_sha_degisince_yoklamayi_sifirlar() {
    let Some(p) = Some(std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../motor/test-eklentileri/target/release/yym_test_kaynak.dll"))
      .filter(|p| p.is_file())
    else {
      return;
    };
    let b = Baglam::bu_makine();
    let c = super::super::cozumleme::cozumle(&p, None, &b).unwrap();
    let mut e = kayit_yap(None, &c, KonumTuru::Yonetilen, 32 << 24);
    assert!(!e.birinci_taraf && e.imza == "Imzasiz");
    e.etkin = true;
    let y = Yoklama { sonuc: "yuklendi".into(), api_surumu: 32 << 24, ..Default::default() };
    yoklama_isle(&mut e, &c, y, (32 << 24) | (2 << 16), "yoklama");
    assert_eq!(e.durum, super::super::uyumluluk::Durum::NativeCompatible);
    assert_eq!(e.gerekli_libobs.as_deref(), Some("32.0"));
    // Aynı dosya: yoklama korunur; farklı SHA: sıfırlanır, etkin kararı kalır
    let e2 = kayit_yap(Some(&e), &c, KonumTuru::Yonetilen, 32 << 24);
    assert!(e2.yoklama.is_some() && e2.etkin);
    let mut c2 = c.clone();
    c2.sha256 = "f".repeat(64);
    let e3 = kayit_yap(Some(&e), &c2, KonumTuru::Yonetilen, 32 << 24);
    assert!(e3.yoklama.is_none() && e3.etkin);
    // İki çökme → karantina
    let mut e4 = e3.clone();
    for _ in 0..2 {
      yoklama_isle(&mut e4, &c2, Yoklama { sonuc: "cokme".into(), cikis_kodu: Some(0xC000_0005), ..Default::default() }, 32 << 24, "yoklama");
    }
    assert!(e4.karantina.is_some());
    assert_eq!(e4.durum, super::super::uyumluluk::Durum::Quarantined);
    assert!(!e4.yuklenecek());
  }
}
