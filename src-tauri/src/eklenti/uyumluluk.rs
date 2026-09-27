//! Uyumluluk sınıflandırması (saf). Girdi: statik çözümleme + (varsa) yalıtılmış yoklama sonucu + karantina.
//! Ad ile özel durum YOKTUR: her karar dosyanın kendisinden ya da gözlenen davranışından çıkar.
//!
//! "Muhtemelen uyumlu" (statik denetim geçti, hiç yüklenmedi) ile "uyumlu" (yalıtılmış süreçte yüklendi, türlerini
//! kaydetti, çökmedi) ayrı durumlardır; arayüz ikisini aynı göstermez.

use serde::{Deserialize, Serialize};

use super::cozumleme::Cozumleme;
use super::pe::Mimari;
use super::win::Imza;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, PartialOrd, Ord, Hash)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Durum {
  /// Yalıtılmış süreçte yüklendi, türlerini kaydetti; ön yüz bağımlılığı yok
  NativeCompatible,
  /// Statik denetimler geçti; henüz yüklenerek sınanmadı
  LikelyCompatible,
  /// Eski ana libobs sürümü için derlenmiş: libobs yükler ama ikili arayüz değişmiş olabilir
  CompatibilityModeRequired,
  /// OBS'in Qt ön yüzüne bağlı: dock/menü/araç bölümleri bizim motorda çalışmaz
  FrontendDependent,
  /// Daha yeni libobs için derlenmiş (libobs reddeder)
  ObsVersionMismatch,
  /// x64 değil
  ArchitectureMismatch,
  /// Bulunamayan DLL var
  DependencyMissing,
  /// OBS eklentisi değil / desteklenmeyen biçim
  Unsupported,
  /// Kullanıcı ya da çökme bekçisi karantinaya aldı (yeniden sınanıp çıkarılabilir)
  Quarantined,
  /// Yoklamada çöktü/yanıt vermedi ya da içeriği imzadan sonra değişmiş
  BlockedForSafety,
  /// Karar verilemedi (dosya okunamadı vb.)
  Unverified,
}

impl Durum {
  /// Motor bu durumdaki eklentiyi yükleyebilir mi? `acik_onay`: kullanıcı "yine de yükle" dedi.
  pub fn yuklenebilir(self, acik_onay: bool) -> bool {
    match self {
      Self::NativeCompatible | Self::LikelyCompatible => true,
      Self::CompatibilityModeRequired | Self::FrontendDependent => acik_onay,
      _ => false,
    }
  }

  pub fn etiket(self) -> &'static str {
    match self {
      Self::NativeCompatible => "Uyumlu (sınandı)",
      Self::LikelyCompatible => "Muhtemelen uyumlu (sınanmadı)",
      Self::CompatibilityModeRequired => "Uyumluluk kipi gerekli",
      Self::FrontendDependent => "OBS ön yüzüne bağlı",
      Self::ObsVersionMismatch => "OBS sürümü uyuşmuyor",
      Self::ArchitectureMismatch => "Mimari uyuşmuyor",
      Self::DependencyMissing => "Bağımlılık eksik",
      Self::Unsupported => "Desteklenmiyor",
      Self::Quarantined => "Karantinada",
      Self::BlockedForSafety => "Güvenlik için engellendi",
      Self::Unverified => "Doğrulanmadı",
    }
  }

  /// İstem §51'deki arayüz durumu. `FrontendDependent`, `CompatibilityModeRequired` ve `Unverified` kullanıcı
  /// açısından aynı adımı ister: yalıtılmış süreçte sınama (ve gerekirse açık onay) → TEST_REQUIRED.
  pub fn arayuz(self) -> &'static str {
    match self {
      Self::NativeCompatible => "COMPATIBLE",
      Self::LikelyCompatible => "LIKELY_COMPATIBLE",
      Self::CompatibilityModeRequired | Self::FrontendDependent | Self::Unverified => "TEST_REQUIRED",
      Self::DependencyMissing => "MISSING_DEPENDENCY",
      Self::ObsVersionMismatch => "OBS_VERSION_MISMATCH",
      Self::ArchitectureMismatch => "ARCHITECTURE_MISMATCH",
      Self::Unsupported => "UNSUPPORTED",
      Self::Quarantined => "QUARANTINED",
      Self::BlockedForSafety => "BLOCKED",
    }
  }
}

/// Yalıtılmış yoklamanın sonucu (motorun `eklenti-yokla` kipi).
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Yoklama {
  /// yuklendi | acilamadi | eksik_disa | surum | baslatilamadi | cokme | zaman_asimi | hata
  pub sonuc: String,
  /// obs_module_ver() dönüşü (0 = okunamadı)
  pub api_surumu: u32,
  pub turler: Vec<KayitliTur>,
  pub ad: String,
  pub aciklama: String,
  pub yazar: String,
  pub sure_ms: u64,
  /// Süreç çıkış kodu (çökmede NTSTATUS)
  pub cikis_kodu: Option<i64>,
  pub ayrinti: String,
  /// Yoklamanın yapıldığı libobs sürümü
  pub libobs: String,
  /// Unix saniye
  pub zaman: i64,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct KayitliTur {
  pub id: String,
  /// kaynak | filtre | gecis | sahne | cikis | kodlayici | servis
  pub tur: String,
  pub ad: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Degerlendirme {
  pub durum: Durum,
  pub etiket: &'static str,
  /// §51 arayüz durumu (COMPATIBLE, TEST_REQUIRED, QUARANTINED…)
  pub arayuz: &'static str,
  /// Neden bu durum (kullanıcıya gösterilir; en önemli önce)
  pub nedenler: Vec<String>,
  /// Kullanıcının yapabileceği bir sonraki adım
  pub oneri: String,
}

pub fn api_metni(v: u32) -> String {
  format!("{}.{}", (v >> 24) & 0xFF, (v >> 16) & 0xFF)
}

fn d(durum: Durum, nedenler: Vec<String>, oneri: &str) -> Degerlendirme {
  Degerlendirme { durum, etiket: durum.etiket(), arayuz: durum.arayuz(), nedenler, oneri: oneri.to_string() }
}

/// `motor_api`: motorun kullandığı libobs'un LIBOBS_API_VER değeri.
pub fn degerlendir(c: &Cozumleme, y: Option<&Yoklama>, motor_api: u32, karantina: Option<&str>) -> Degerlendirme {
  if let Some(neden) = karantina {
    return d(
      Durum::Quarantined,
      vec![format!("Karantinada: {neden}")],
      "Güncellenmiş sürümü kurun ya da yeniden sınayıp karantinadan çıkarın.",
    );
  }
  if c.imza == Imza::Bozuk {
    return d(
      Durum::BlockedForSafety,
      vec!["Dosyanın içeriği imzalandıktan sonra değişmiş; kurcalanmış olabilir.".into()],
      "Eklentiyi güvenilir kaynağından yeniden edinin.",
    );
  }
  let Some(pe) = &c.pe else {
    return d(
      Durum::Unsupported,
      vec![format!("Geçerli bir Windows kitaplığı değil ({})", c.pe_hatasi.as_deref().unwrap_or("?"))],
      "Dosyanın doğru olduğundan emin olun.",
    );
  };
  if pe.net {
    return d(Durum::Unsupported, vec![".NET derlemesi; OBS eklentisi yerel (C/C++) kitaplık olmalı.".into()], "");
  }
  if pe.mimari != Mimari::X64 {
    let m = match pe.mimari {
      Mimari::X86 => "32 bit (x86)",
      Mimari::Arm64 => "ARM64",
      _ => "bilinmeyen mimari",
    };
    return d(
      Durum::ArchitectureMismatch,
      vec![format!("{m} için derlenmiş; motor 64 bit (x64) çalışır.")],
      "Eklentinin 64 bit Windows sürümünü edinin.",
    );
  }
  let eksik_disa = pe.eksik_zorunlu();
  if !pe.obs_eklentisi() || !eksik_disa.is_empty() {
    let neden = if pe.obs_eklentisi() {
      format!("OBS modülü için gereken dışa aktarım(lar) yok: {}", eksik_disa.join(", "))
    } else {
      "obs_module_load dışa aktarımı yok; bu dosya bir OBS eklentisi değil (yardımcı kitaplık olabilir).".into()
    };
    return d(Durum::Unsupported, vec![neden], "");
  }
  let eksik = c.eksik_bagimliliklar(false);
  if !eksik.is_empty() {
    return d(
      Durum::DependencyMissing,
      vec![format!("Bulunamayan kitaplık: {}", eksik.join(", "))],
      "Eklentinin kurulum belgelerindeki ek bileşeni (ör. Visual C++ çalışma zamanı ya da birlikte gelen DLL'ler) kurun.",
    );
  }
  let mut notlar = Vec::new();
  let gecikmeli = c.eksik_bagimliliklar(true);
  if !gecikmeli.is_empty() {
    notlar.push(format!("Gecikmeli yüklenen kitaplık bulunamadı: {} (ilgili özellik kullanılınca hata verebilir)", gecikmeli.join(", ")));
  }
  match &c.imza {
    Imza::Imzasiz => notlar.push("İmzasız: yayıncısı doğrulanamıyor.".into()),
    Imza::GuvenilmeyenKok { imzalayan } => notlar.push(format!("İmzalı ({imzalayan}) ama sertifika bu bilgisayarda güvenilir değil.")),
    Imza::SuresiDolmus { imzalayan } => notlar.push(format!("İmza sertifikasının ({imzalayan}) süresi dolmuş.")),
    Imza::Dogrulanamadi { kod } => notlar.push(format!("İmza doğrulanamadı ({kod}).")),
    _ => {}
  }
  let on_yuz_notu = || {
    let mut v = Vec::new();
    if c.on_yuz {
      v.push("OBS ön yüz API'sine bağlı (obs-frontend-api): menü, dock ve araç öğeleri bizim motorda çalışmaz.".to_string());
    }
    if c.qt {
      v.push("Qt'ye bağlı: kendi pencere/dock arayüzü kurar.".to_string());
    }
    v
  };

  if let Some(y) = y {
    let mut n = Vec::new();
    match y.sonuc.as_str() {
      "cokme" | "zaman_asimi" => {
        let kod = y.cikis_kodu.map(|k| format!(" (çıkış kodu 0x{:08X})", k as u32)).unwrap_or_default();
        let ne = if y.sonuc == "cokme" { "yüklenirken çöktü" } else { "yüklenirken yanıt vermedi" };
        n.push(format!("Yalıtılmış yoklamada süreç {ne}{kod}."));
        n.extend(notlar);
        return d(Durum::BlockedForSafety, n, "Eklentinin güncel sürümünü kurun; motor bu eklentiyi yüklemez.");
      }
      "surum" => {
        n.push(format!("libobs {} için derlenmiş; motor libobs {} kullanıyor.", api_metni(y.api_surumu), api_metni(motor_api)));
        return d(Durum::ObsVersionMismatch, n, "OBS'i güncelleyin ya da eklentinin bu OBS sürümüne uygun olanını kurun.");
      }
      "acilamadi" => {
        n.push(format!("Windows kitaplığı açamadı{}.", if y.ayrinti.is_empty() { String::new() } else { format!(": {}", y.ayrinti) }));
        return d(Durum::DependencyMissing, n, "Eklentinin ek bileşenlerini kurun.");
      }
      "eksik_disa" => {
        return d(Durum::Unsupported, vec!["libobs gerekli dışa aktarımları bulamadı.".into()], "");
      }
      "baslatilamadi" => {
        n.push("obs_module_load başarısız döndü; eklenti bu ortamda çalışmayı reddetti.".into());
        n.extend(on_yuz_notu());
        let durum = if c.on_yuz || c.qt { Durum::FrontendDependent } else { Durum::Unsupported };
        return d(durum, n, "Eklentinin gereksinimlerini (donanım, OBS ön yüzü) belgelerinden kontrol edin.");
      }
      "yuklendi" => {
        let turler = y.turler.len();
        n.push(format!("Yalıtılmış süreçte yüklendi; {turler} tür kaydetti."));
        n.extend(on_yuz_notu());
        n.extend(notlar);
        let ana = (y.api_surumu >> 24) & 0xFF;
        if y.api_surumu != 0 && ana < (motor_api >> 24) & 0xFF {
          n.insert(0, format!("Eski libobs {} için derlenmiş; motor {}. İkili arayüz değişmiş olabilir.", api_metni(y.api_surumu), api_metni(motor_api)));
          return d(Durum::CompatibilityModeRequired, n, "Açık onayla yüklenebilir; sorun çıkarsa eklentinin güncel sürümünü kurun.");
        }
        if c.on_yuz || c.qt {
          return d(Durum::FrontendDependent, n, "Kaynak/filtre türleri kullanılabilir; ön yüz özellikleri çalışmaz. Açık onayla yüklenir.");
        }
        return d(Durum::NativeCompatible, n, "Etkinleştirilebilir; bir sonraki motor başlatmada yüklenir.");
      }
      diger => {
        n.push(format!("Yoklama tamamlanamadı ({diger}): {}", y.ayrinti));
        return d(Durum::Unverified, n, "Yeniden sınayın.");
      }
    }
  }

  let mut n = vec!["Statik denetimler geçti (x64, OBS dışa aktarımları, bağımlılıklar); henüz yüklenerek sınanmadı.".to_string()];
  n.extend(on_yuz_notu());
  n.extend(notlar);
  if c.on_yuz || c.qt {
    return d(Durum::FrontendDependent, n, "Yalıtılmış süreçte sınayın; kaynak türleri varsa açık onayla yüklenebilir.");
  }
  d(Durum::LikelyCompatible, n, "Yalıtılmış süreçte sınayın ya da etkinleştirin (sonraki motor başlatmada yüklenir).")
}

#[cfg(test)]
mod tests {
  use super::super::cozumleme::{Bagimlilik, BagimlilikYeri, Cozumleme};
  use super::super::pe::{Mimari, PeBilgisi};
  use super::super::win::{Imza, SurumBilgisi};
  use super::*;

  const MOTOR: u32 = (32 << 24) | (2 << 16) | 2;

  fn cozum(mimari: Mimari, disa: &[&str], eksik: &[&str], on_yuz: bool) -> Cozumleme {
    Cozumleme {
      dosya: "x.dll".into(),
      modul: "x".into(),
      boyut: 1,
      sha256: "0".repeat(64),
      pe: Some(PeBilgisi {
        mimari,
        makine: 0,
        dll: true,
        pe32_arti: true,
        disa_aktarimlar: disa.iter().map(|s| s.to_string()).collect(),
        ice_aktarimlar: vec![],
        gecikmeli: vec![],
        imza_blogu: false,
        net: false,
      }),
      pe_hatasi: None,
      imza: Imza::Imzasiz,
      surum_bilgisi: SurumBilgisi::default(),
      veri_klasoru: None,
      manifest: None,
      diller: vec![],
      bagimliliklar: eksik
        .iter()
        .map(|a| Bagimlilik { ad: a.to_string(), yer: BagimlilikYeri::Eksik, gecikmeli: false, uzerinden: None })
        .collect(),
      on_yuz,
      qt: false,
      tarayici: false,
    }
  }

  const OBS: [&str; 3] = ["obs_module_load", "obs_module_set_pointer", "obs_module_ver"];

  fn yok(sonuc: &str, api: u32) -> Yoklama {
    Yoklama { sonuc: sonuc.into(), api_surumu: api, turler: vec![KayitliTur::default()], ..Default::default() }
  }

  #[test]
  fn statik_kararlar() {
    assert_eq!(degerlendir(&cozum(Mimari::X86, &OBS, &[], false), None, MOTOR, None).durum, Durum::ArchitectureMismatch);
    assert_eq!(degerlendir(&cozum(Mimari::X64, &["baska"], &[], false), None, MOTOR, None).durum, Durum::Unsupported);
    let e = degerlendir(&cozum(Mimari::X64, &OBS, &["yok.dll"], false), None, MOTOR, None);
    assert_eq!(e.durum, Durum::DependencyMissing);
    assert!(e.nedenler[0].contains("yok.dll"), "eksik DLL adıyla söylenmeli");
    let l = degerlendir(&cozum(Mimari::X64, &OBS, &[], false), None, MOTOR, None);
    assert_eq!(l.durum, Durum::LikelyCompatible);
    assert!(l.nedenler.iter().any(|x| x.contains("İmzasız")), "imzasızlık dürüstçe söylenir");
    assert_eq!(degerlendir(&cozum(Mimari::X64, &OBS, &[], true), None, MOTOR, None).durum, Durum::FrontendDependent);
    let mut bozuk = cozum(Mimari::X64, &OBS, &[], false);
    bozuk.imza = Imza::Bozuk;
    assert_eq!(degerlendir(&bozuk, None, MOTOR, None).durum, Durum::BlockedForSafety);
    let q = degerlendir(&cozum(Mimari::X64, &OBS, &[], false), None, MOTOR, Some("çöktü"));
    assert_eq!((q.durum, q.arayuz), (Durum::Quarantined, "QUARANTINED"));
    assert_eq!(degerlendir(&cozum(Mimari::X64, &OBS, &[], true), None, MOTOR, None).arayuz, "TEST_REQUIRED");
  }

  #[test]
  fn yoklama_kararlari_ve_surum() {
    let c = cozum(Mimari::X64, &OBS, &[], false);
    assert_eq!(degerlendir(&c, Some(&yok("yuklendi", 32 << 24)), MOTOR, None).durum, Durum::NativeCompatible);
    assert_eq!(degerlendir(&c, Some(&yok("yuklendi", 31 << 24)), MOTOR, None).durum, Durum::CompatibilityModeRequired);
    let s = degerlendir(&c, Some(&yok("surum", 99 << 24)), MOTOR, None);
    assert_eq!(s.durum, Durum::ObsVersionMismatch);
    assert!(s.nedenler[0].contains("99.0") && s.nedenler[0].contains("32.2"), "{:?}", s.nedenler);
    let mut cokme = yok("cokme", 0);
    cokme.cikis_kodu = Some(0xC000_0005u32 as i64);
    let k = degerlendir(&c, Some(&cokme), MOTOR, None);
    assert_eq!(k.durum, Durum::BlockedForSafety);
    assert!(k.nedenler[0].contains("0xC0000005"));
    assert_eq!(degerlendir(&cozum(Mimari::X64, &OBS, &[], true), Some(&yok("yuklendi", 32 << 24)), MOTOR, None).durum, Durum::FrontendDependent);
  }

  #[test]
  fn yukleme_politikasi() {
    assert!(Durum::NativeCompatible.yuklenebilir(false));
    assert!(Durum::LikelyCompatible.yuklenebilir(false));
    assert!(!Durum::FrontendDependent.yuklenebilir(false) && Durum::FrontendDependent.yuklenebilir(true));
    assert!(!Durum::CompatibilityModeRequired.yuklenebilir(false));
    for d in [
      Durum::ObsVersionMismatch,
      Durum::ArchitectureMismatch,
      Durum::DependencyMissing,
      Durum::Unsupported,
      Durum::Quarantined,
      Durum::BlockedForSafety,
      Durum::Unverified,
    ] {
      assert!(!d.yuklenebilir(true), "{d:?} açık onayla bile yüklenmemeli");
    }
  }
}
