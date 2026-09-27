//! Yerel eklenti kayıt defteri (`<veri>/eklentiler/kayit.json`, sürümlü) ve motor çökme bekçisi.
//!
//! Kayıt defteri, hangi eklentinin nerede olduğunu, son çözümleme/yoklama sonucunu, kullanıcının etkinleştirip
//! etkinleştirmediğini, çökme geçmişini ve karantinayı tutar. Etkinleştirme "sonraki motor başlatmada" geçerlidir:
//! çalışan süreçten yerel kod güvenle boşaltılamaz (libobs modül boşaltmayı desteklemez), sahte "anında kapat" yok.
//!
//! Çökme bekçisi iki işaret dosyası kullanır (`<veri>/motor/`):
//! - `oturum.json` — panel motoru başlatırken yazar, düzgün durdurunca siler. Motor kapalıyken hâlâ duruyorsa
//!   önceki oturum temiz bitmemiştir.
//! - `eklenti-yukleniyor.json` — motor her üçüncü taraf eklentiyi yüklemeden önce yazar, bitince siler. Duruyorsa
//!   süreç o eklentinin `obs_module_load`'unda düşmüştür: şüpheli ADIYLA bilinir.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::uyumluluk::{Durum, KayitliTur, Yoklama};

pub const SURUM: u32 = 1;
/// Aynı eklenti yüklenirken bu kadar çökme olursa kendiliğinden karantinaya alınır.
pub const OTOMATIK_KARANTINA_ESIGI: usize = 2;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum KonumTuru {
  /// Bu uygulamanın kurduğu (kendi klasörümüz; güncelleme/geri alma/kaldırma yalnız burada)
  #[default]
  Yonetilen,
  /// OBS kurulum klasörü (obs-plugins\64bit) — salt-okunur başvuru
  ObsKurulum,
  /// %ProgramData%\obs-studio\plugins — salt-okunur başvuru
  ProgramData,
  /// Kullanıcının eklediği klasör — salt-okunur başvuru
  Ozel,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CokmeKaydi {
  pub zaman: i64,
  /// yukleme | calisma | yoklama
  pub asama: String,
  pub kod: Option<i64>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SonYukleme {
  pub zaman: i64,
  pub sonuc: String,
  pub kod: i32,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Yedek {
  pub surum: Option<String>,
  pub yol: PathBuf,
  pub zaman: i64,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct EklentiKaydi {
  /// libobs modül adı (DLL adı uzantısız). libobs aynı adlı iki modülü ayırt edemez; kimlik de odur.
  pub id: String,
  pub ad: String,
  pub surum: Option<String>,
  pub satici: Option<String>,
  pub konum: KonumTuru,
  pub dll: PathBuf,
  pub veri: Option<PathBuf>,
  pub sha256: String,
  pub boyut: u64,
  pub mimari: String,
  /// Gecerli | Imzasiz | GuvenilmeyenKok | Bozuk | SuresiDolmus | Dogrulanamadi
  pub imza: String,
  pub imzalayan: Option<String>,
  /// Yoklamadan: eklentinin derlendiği libobs sürümü ("32.0")
  pub gerekli_libobs: Option<String>,
  pub bagimliliklar: Vec<String>,
  pub eksik_bagimliliklar: Vec<String>,
  pub on_yuz: bool,
  pub qt: bool,
  pub tarayici: bool,
  pub birinci_taraf: bool,
  pub turler: Vec<KayitliTur>,
  pub durum: Durum,
  pub nedenler: Vec<String>,
  pub oneri: String,
  pub yoklama: Option<Yoklama>,
  /// Kullanıcı etkinleştirdi: sonraki motor başlatmada yüklenir
  pub etkin: bool,
  /// Ön yüze bağlı / uyumluluk kipi gereken eklenti için "yine de yükle"
  pub acik_onay: bool,
  /// En son hangi uygulama sürümüyle çözümlendi/sınandı
  pub son_test_surumu: Option<String>,
  pub son_yukleme: Option<SonYukleme>,
  pub cokmeler: Vec<CokmeKaydi>,
  /// Karantina nedeni (varsa yüklenmez)
  pub karantina: Option<String>,
  pub eklendi: i64,
  pub onceki_surumler: Vec<Yedek>,
  /// OBS'in kendi eklenti yöneticisinde etkin mi (modules.json) — bilgi amaçlı
  pub obs_etkin: Option<bool>,
  pub diller: Vec<String>,
  /// Birinci taraf modülü motor kendisi yönetiyor ya da bilerek yüklemiyor (neden). Bu durumda kayıttan yüklenmez:
  /// aynı modülü iki kez açmak türleri iki kez kaydeder.
  pub motor_notu: Option<String>,
}

impl Default for EklentiKaydi {
  fn default() -> Self {
    Self {
      id: String::new(),
      ad: String::new(),
      surum: None,
      satici: None,
      konum: KonumTuru::default(),
      dll: PathBuf::new(),
      veri: None,
      sha256: String::new(),
      boyut: 0,
      mimari: String::new(),
      imza: String::new(),
      imzalayan: None,
      gerekli_libobs: None,
      bagimliliklar: Vec::new(),
      eksik_bagimliliklar: Vec::new(),
      on_yuz: false,
      qt: false,
      tarayici: false,
      birinci_taraf: false,
      turler: Vec::new(),
      durum: Durum::Unverified,
      nedenler: Vec::new(),
      oneri: String::new(),
      yoklama: None,
      etkin: false,
      acik_onay: false,
      son_test_surumu: None,
      son_yukleme: None,
      cokmeler: Vec::new(),
      karantina: None,
      eklendi: 0,
      onceki_surumler: Vec::new(),
      obs_etkin: None,
      diller: Vec::new(),
      motor_notu: None,
    }
  }
}

impl EklentiKaydi {
  /// Motor bu eklentiyi bir sonraki başlatmada yükleyecek mi?
  pub fn yuklenecek(&self) -> bool {
    self.etkin
      && self.karantina.is_none()
      && self.motor_notu.is_none()
      && self.dll.is_file()
      && self.durum.yuklenebilir(self.acik_onay)
  }

  pub fn yukleme_cokmeleri(&self) -> usize {
    self.cokmeler.iter().filter(|c| c.asama == "yukleme" || c.asama == "yoklama").count()
  }
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Konum {
  pub yol: PathBuf,
  pub tur: KonumTuru,
  pub etkin: bool,
  pub eklendi: i64,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Cokme {
  pub zaman: i64,
  /// Yükleme sırasında düşülen eklenti (işaret dosyasından)
  pub supheli: Option<String>,
  /// yukleme | calisma
  pub asama: String,
  pub cikis_kodu: Option<i64>,
  /// O oturumda yüklenmiş üçüncü taraf eklentiler
  pub yuklu: Vec<String>,
  /// Panel açıkken gözlendi mi (çıkış kodu biliniyor). Gözlenmeyen (panel de kapalıyken olan) ve şüphelisi olmayan
  /// kapanış eklentiye yüklenmez: panelin kendisi kapanmış olabilir — kullanıcıya soru sorulmaz.
  pub gozlendi: bool,
  pub cozuldu: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct KayitDefteri {
  pub surum: u32,
  pub eklentiler: Vec<EklentiKaydi>,
  pub konumlar: Vec<Konum>,
  pub son_cokme: Option<Cokme>,
}

impl Default for KayitDefteri {
  fn default() -> Self {
    Self { surum: SURUM, eklentiler: Vec::new(), konumlar: Vec::new(), son_cokme: None }
  }
}

pub fn simdi() -> i64 {
  std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs() as i64).unwrap_or(0)
}

pub fn klasor(veri_dizini: &Path) -> PathBuf {
  veri_dizini.join("eklentiler")
}

fn dosya(veri_dizini: &Path) -> PathBuf {
  klasor(veri_dizini).join("kayit.json")
}

/// Okur. Yoksa boş defter. Daha yeni sürümün yazdığı defter okunur ama `yeni_surum` döner (üzerine yazılmaz);
/// bozuk dosya kenara alınır (`.bozuk-<zaman>`) ve boş defterle devam edilir — kayıt kaybolmaz.
pub fn oku(veri_dizini: &Path) -> (KayitDefteri, bool) {
  let yol = dosya(veri_dizini);
  let Ok(metin) = std::fs::read_to_string(&yol) else {
    return (KayitDefteri::default(), false);
  };
  match serde_json::from_str::<KayitDefteri>(metin.trim_start_matches('\u{feff}')) {
    Ok(d) => {
      let yeni = d.surum > SURUM;
      (d, yeni)
    }
    Err(_) => {
      let _ = std::fs::rename(&yol, yol.with_extension(format!("json.bozuk-{}", simdi())));
      (KayitDefteri::default(), false)
    }
  }
}

pub fn yaz(veri_dizini: &Path, d: &KayitDefteri) -> Result<(), String> {
  let (_, yeni) = oku(veri_dizini);
  if yeni {
    return Err("Kayıt defteri uygulamanın daha yeni bir sürümüyle yazılmış; üzerine yazılmadı".into());
  }
  let k = klasor(veri_dizini);
  std::fs::create_dir_all(&k).map_err(|e| format!("klasör: {e}"))?;
  let yol = dosya(veri_dizini);
  let gecici = yol.with_extension("json.yaziliyor");
  let metin = serde_json::to_string_pretty(d).map_err(|e| e.to_string())?;
  std::fs::write(&gecici, metin).and_then(|_| std::fs::rename(&gecici, &yol)).map_err(|e| format!("yazılamadı: {e}"))
}

// ─── Çökme bekçisi ────────────────────────────────────────────────────────

pub fn oturum_dosyasi(motor_dizini: &Path) -> PathBuf {
  motor_dizini.join("oturum.json")
}

pub fn isaret_dosyasi(motor_dizini: &Path) -> PathBuf {
  motor_dizini.join("eklenti-yukleniyor.json")
}

/// Motor başlatılırken: hangi üçüncü taraf eklentilerle başlatıldığı yazılır.
pub fn oturum_baslat(motor_dizini: &Path, eklentiler: &[String]) {
  let _ = std::fs::create_dir_all(motor_dizini);
  let _ = std::fs::write(oturum_dosyasi(motor_dizini), json!({"zaman": simdi(), "eklentiler": eklentiler}).to_string());
}

/// Düzgün durdurmada (ve eklenti yükleme sonuçları geldikten sonra işaret dosyası temizliğinde) çağrılır.
pub fn oturum_bitti(motor_dizini: &Path) {
  let _ = std::fs::remove_file(oturum_dosyasi(motor_dizini));
  let _ = std::fs::remove_file(isaret_dosyasi(motor_dizini));
}

/// Motor çalışmıyorken çağrılır: önceki oturum temiz bitmediyse çökme kaydını döndürür ve işaretleri temizler.
/// `gozlendi`: çıkışı panel gördü (çıkış kodu elde); aksi hâlde panel de kapalıyken olmuştur.
pub fn cokme_bul(motor_dizini: &Path, cikis_kodu: Option<i64>, gozlendi: bool) -> Option<Cokme> {
  let oturum = std::fs::read_to_string(oturum_dosyasi(motor_dizini)).ok()?;
  let o: Value = serde_json::from_str(&oturum).unwrap_or(Value::Null);
  let isaret: Option<Value> =
    std::fs::read_to_string(isaret_dosyasi(motor_dizini)).ok().and_then(|t| serde_json::from_str(&t).ok());
  let supheli = isaret.as_ref().and_then(|v| v.get("id")).and_then(Value::as_str).map(str::to_string);
  let yuklu = o
    .get("eklentiler")
    .and_then(Value::as_array)
    .map(|a| a.iter().filter_map(|x| x.as_str().map(str::to_string)).collect())
    .unwrap_or_default();
  oturum_bitti(motor_dizini);
  Some(Cokme {
    zaman: simdi(),
    asama: if supheli.is_some() { "yukleme".into() } else { "calisma".into() },
    supheli,
    cikis_kodu,
    yuklu,
    gozlendi,
    cozuldu: false,
  })
}

/// Çökmeyi deftere işler: şüpheli eklentinin geçmişine yazılır; yüklemede eşik kadar çökene karantina.
/// Üçüncü taraf eklenti yoksa kullanıcıya soru sorulmaz (çözülmüş sayılır) — eklentisiz çökme eklenti sorunu değildir.
pub fn cokme_isle(d: &mut KayitDefteri, mut c: Cokme) {
  if let Some(id) = &c.supheli {
    if let Some(e) = d.eklentiler.iter_mut().find(|e| &e.id == id) {
      e.cokmeler.push(CokmeKaydi { zaman: c.zaman, asama: "yukleme".into(), kod: c.cikis_kodu });
      if e.yukleme_cokmeleri() >= OTOMATIK_KARANTINA_ESIGI && e.karantina.is_none() {
        e.karantina = Some(format!("Motor bu eklentiyi yüklerken {} kez çöktü", e.yukleme_cokmeleri()));
        e.durum = Durum::Quarantined;
      }
    }
  } else if c.gozlendi {
    for id in &c.yuklu {
      if let Some(e) = d.eklentiler.iter_mut().find(|e| &e.id == id) {
        e.cokmeler.push(CokmeKaydi { zaman: c.zaman, asama: "calisma".into(), kod: c.cikis_kodu });
      }
    }
  }
  if c.supheli.is_none() && (c.yuklu.is_empty() || !c.gozlendi) {
    c.cozuldu = true;
  }
  d.son_cokme = Some(c);
}

/// Çökme istemine verilen karar. Dönüş: bu başlatmada güvenli kip mi (üçüncü taraf eklenti yüklenmez).
pub fn cokme_karari(d: &mut KayitDefteri, karar: &str) -> Result<bool, String> {
  let Some(c) = d.son_cokme.as_mut().filter(|c| !c.cozuldu) else {
    return Ok(karar == "guvenli");
  };
  let guvenli = match karar {
    "normal" => false,
    "guvenli" => true,
    "devre-disi" => {
      let id = c.supheli.clone().ok_or("şüpheli eklenti yok (çökme yükleme sırasında olmadı)")?;
      if let Some(e) = d.eklentiler.iter_mut().find(|e| e.id == id) {
        e.etkin = false;
        e.karantina.get_or_insert_with(|| "Motor bu eklentiyi yüklerken çöktü; kullanıcı devre dışı bıraktı".into());
        e.durum = Durum::Quarantined;
      }
      false
    }
    k => return Err(format!("bilinmeyen karar: {k}")),
  };
  if let Some(c) = d.son_cokme.as_mut() {
    c.cozuldu = true;
  }
  Ok(guvenli)
}

#[cfg(test)]
mod tests {
  use super::*;

  fn gecici(ad: &str) -> PathBuf {
    let d = std::env::temp_dir().join(format!("yya-kayit-{ad}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&d);
    std::fs::create_dir_all(&d).unwrap();
    d
  }

  #[test]
  fn yazma_okuma_bozuk_ve_yeni_surum() {
    let d = gecici("rt");
    assert_eq!(oku(&d).0, KayitDefteri::default());
    let mut k = KayitDefteri::default();
    k.eklentiler.push(EklentiKaydi { id: "a".into(), etkin: true, ..Default::default() });
    yaz(&d, &k).unwrap();
    assert_eq!(oku(&d).0.eklentiler[0].id, "a");
    // Daha yeni sürüm: okunur ama üzerine yazılmaz
    std::fs::write(dosya(&d), json!({"surum": 99, "eklentiler": []}).to_string()).unwrap();
    assert!(oku(&d).1);
    assert!(yaz(&d, &k).is_err());
    // Bozuk: kenara alınır, boş defterle devam
    std::fs::write(dosya(&d), "{bozuk").unwrap();
    assert_eq!(oku(&d).0, KayitDefteri::default());
    assert!(std::fs::read_dir(klasor(&d)).unwrap().flatten().any(|e| e.file_name().to_string_lossy().contains("bozuk-")));
    let _ = std::fs::remove_dir_all(&d);
  }

  #[test]
  fn cokme_bekcisi_supheliyi_bulur_ve_iki_cokmede_karantinaya_alir() {
    let d = gecici("cokme");
    let motor = d.join("motor");
    // Temiz oturum: çökme yok
    oturum_baslat(&motor, &["x".into()]);
    oturum_bitti(&motor);
    assert!(cokme_bul(&motor, Some(0), true).is_none());

    let mut k = KayitDefteri::default();
    k.eklentiler.push(EklentiKaydi { id: "cokuk".into(), etkin: true, durum: Durum::LikelyCompatible, ..Default::default() });
    for tur in 1..=2 {
      oturum_baslat(&motor, &["cokuk".into()]);
      std::fs::write(isaret_dosyasi(&motor), r#"{"id":"cokuk","dll":"c.dll"}"#).unwrap();
      let c = cokme_bul(&motor, Some(0xC000_0005), true).unwrap();
      assert_eq!(c.supheli.as_deref(), Some("cokuk"));
      assert_eq!(c.asama, "yukleme");
      assert!(!oturum_dosyasi(&motor).exists() && !isaret_dosyasi(&motor).exists(), "işaretler temizlenmeli");
      cokme_isle(&mut k, c);
      assert_eq!(k.eklentiler[0].karantina.is_some(), tur == 2, "{tur}. çökme");
    }
    assert!(!k.eklentiler[0].yuklenecek());
    assert!(!k.son_cokme.as_ref().unwrap().cozuldu);
    assert!(!cokme_karari(&mut k, "normal").unwrap());
    assert!(k.son_cokme.as_ref().unwrap().cozuldu);
    let _ = std::fs::remove_dir_all(&d);
  }

  #[test]
  fn cokme_karari_devre_disi_ve_eklentisiz_cokme() {
    let mut k = KayitDefteri::default();
    k.eklentiler.push(EklentiKaydi { id: "s".into(), etkin: true, durum: Durum::NativeCompatible, ..Default::default() });
    cokme_isle(&mut k, Cokme { supheli: Some("s".into()), asama: "yukleme".into(), yuklu: vec!["s".into()], gozlendi: true, ..Default::default() });
    assert!(cokme_karari(&mut k, "uydurma").is_err());
    assert!(!cokme_karari(&mut k, "devre-disi").unwrap());
    assert!(!k.eklentiler[0].etkin && k.eklentiler[0].karantina.is_some());
    // Eklentisiz çökmede soru sorulmaz
    let mut bos = KayitDefteri::default();
    cokme_isle(&mut bos, Cokme { asama: "calisma".into(), ..Default::default() });
    assert!(bos.son_cokme.unwrap().cozuldu);
    // Güvenli kip kararı tek seferlik bilgi döner
    let mut k2 = KayitDefteri::default();
    cokme_isle(&mut k2, Cokme { asama: "calisma".into(), yuklu: vec!["a".into()], gozlendi: true, ..Default::default() });
    assert!(!k2.son_cokme.as_ref().unwrap().cozuldu, "gözlenen çalışma çökmesi eklenti yüklüyken sorulur");
    assert!(cokme_karari(&mut k2, "guvenli").unwrap());
    // Gözlenmeyen (panel de kapalıyken) şüphelisiz kapanış sorulmaz
    let mut k3 = KayitDefteri::default();
    cokme_isle(&mut k3, Cokme { asama: "calisma".into(), yuklu: vec!["a".into()], gozlendi: false, ..Default::default() });
    assert!(k3.son_cokme.unwrap().cozuldu);
  }
}
