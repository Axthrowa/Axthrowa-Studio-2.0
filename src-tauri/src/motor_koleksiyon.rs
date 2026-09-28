//! Yayın motoru sahne koleksiyonları — kalıcı, sürümlü, çoklu (OBS "Sahne Koleksiyonu" karşılığı).
//!
//! Bir koleksiyon: kaynaklar (ayarlar, filtreler, ses özellikleri, izler), tuval başına sahneler (sıralı öğeler,
//! gruplar, tam dönüşüm), tuval başına program sahnesi ve geçiş. Motor her başlatıldığında ya da koleksiyon
//! değiştirildiğinde bu kayıttan sahne grafiği yeniden kurulur. Kaynak türü artık yoksa (ör. eklenti kaldırıldı)
//! kayıt **silinmez**: `eksik` olarak korunur ve eklenti geri geldiğinde aynı ayarlarla yeniden kurulur.
//!
//! Dosyalar (`<veri>/motor/`):
//! - `koleksiyonlar.json` — dizin: etkin koleksiyon ve liste
//! - `koleksiyonlar/<kimlik>.json` — koleksiyon (sürüm 2)
//! - `koleksiyon-yedekleri/` — silinen/yedeklenen koleksiyonlar (hiçbir şey kalıcı olarak silinmez)
//! - `sahne-koleksiyonu.json` — sürüm 1 tek dosya: ilk açılışta "Varsayılan" koleksiyona **kopyalanarak** göç eder,
//!   kendisi silinmez ve değiştirilmez (eski sürüme dönülürse o sürüm kendi dosyasını bulur).
//!
//! Kayıtta sır yoktur (yayın anahtarları ve kaynakların parola alanları Kimlik Yöneticisinde).

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

pub const SURUM: u32 = 2;
/// Sürüm 1 tek dosya (göç kaynağı)
pub const DOSYA: &str = "sahne-koleksiyonu.json";
pub const DIZIN: &str = "koleksiyonlar";
pub const DIZIN_DOSYASI: &str = "koleksiyonlar.json";
pub const YEDEK_DIZINI: &str = "koleksiyon-yedekleri";
pub const VARSAYILAN_KIMLIK: &str = "varsayilan";
pub const TUVALLER: [&str; 2] = ["ana", "dikey"];

fn dogru() -> bool {
  true
}

fn tum_izler() -> u32 {
  0x3F
}

fn bir() -> [f32; 2] {
  [1.0, 1.0]
}

fn bir_f() -> f32 {
  1.0
}

fn yarim() -> f32 {
  0.5
}

/// OBS varsayılan hizalaması: sol üst (OBS_ALIGN_LEFT | OBS_ALIGN_TOP)
fn sol_ust() -> u32 {
  5
}

fn varsayilan_ad() -> String {
  "Varsayılan".into()
}

/// Sürüm 1 öğe kaydı (kaynak başına tuval öğesi). Yalnız göç için okunur; sürüm 2'de yazılmaz.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct OgeKaydi {
  pub tuval: String,
  pub konum: [f32; 2],
  #[serde(default)]
  pub sinir: Option<[f32; 2]>,
  #[serde(default = "dogru")]
  pub gorunur: bool,
}

/// Sahne öğesinin dönüşümü (OBS "Edit Transform" alanlarının tamamı).
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Donusum {
  #[serde(default)]
  pub konum: [f32; 2],
  #[serde(default = "bir")]
  pub olcek: [f32; 2],
  /// Sınır kutusu; `sinir_turu` 0 ise yok
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub sinir: Option<[f32; 2]>,
  #[serde(default)]
  pub sinir_turu: i32,
  #[serde(default)]
  pub sinir_hizalama: u32,
  #[serde(default = "sol_ust")]
  pub hizalama: u32,
  #[serde(default)]
  pub aci: f32,
  /// sol, üst, sağ, alt
  #[serde(default)]
  pub kirp: [i32; 4],
  #[serde(default)]
  pub kilit: bool,
  #[serde(default = "dogru")]
  pub gorunur: bool,
  #[serde(default)]
  pub olcek_filtresi: i32,
  #[serde(default)]
  pub karistirma: i32,
}

impl Default for Donusum {
  fn default() -> Self {
    Donusum {
      konum: [0.0, 0.0],
      olcek: bir(),
      sinir: None,
      sinir_turu: 0,
      sinir_hizalama: 0,
      hizalama: sol_ust(),
      aci: 0.0,
      kirp: [0; 4],
      kilit: false,
      gorunur: true,
      olcek_filtresi: 0,
      karistirma: 0,
    }
  }
}

impl Donusum {
  /// Motorun `oge.donustur`/`sahne.ekle` biçimi (tüm alanlar; sınır yoksa tür 0 ile sıfırlanır)
  pub fn motor_json(&self) -> Value {
    let mut d = json!({
      "konum": self.konum, "olcek": self.olcek, "aci": self.aci, "gorunur": self.gorunur,
      "hizalama": self.hizalama, "sinir_turu": self.sinir_turu, "sinir_hizalama": self.sinir_hizalama,
      "kirp": self.kirp, "kilit": self.kilit, "olcek_filtresi": self.olcek_filtresi, "karistirma": self.karistirma,
    });
    if let (Some(s), true) = (self.sinir, self.sinir_turu != 0) {
      d["sinir"] = json!(s);
    }
    d
  }

  /// Motorun `sahne.ogeler` satırından
  pub fn motordan(o: &Value) -> Donusum {
    let cift = |v: Option<&Value>, vars: [f32; 2]| -> [f32; 2] {
      v.and_then(Value::as_array)
        .and_then(|a| Some([a.first()?.as_f64()? as f32, a.get(1)?.as_f64()? as f32]))
        .unwrap_or(vars)
    };
    let tam = |ad: &str, vars: i64| o.get(ad).and_then(Value::as_i64).unwrap_or(vars);
    let kirp = o.get("kirp").and_then(Value::as_array).map(|a| {
      let n = |i: usize| a.get(i).and_then(Value::as_i64).unwrap_or(0) as i32;
      [n(0), n(1), n(2), n(3)]
    });
    let sinir_turu = tam("sinir_turu", 0) as i32;
    Donusum {
      konum: cift(o.get("konum"), [0.0, 0.0]),
      olcek: cift(o.get("olcek"), bir()),
      sinir: (sinir_turu != 0).then(|| cift(o.get("sinir"), [0.0, 0.0])),
      sinir_turu,
      sinir_hizalama: tam("sinir_hizalama", 0) as u32,
      hizalama: tam("hizalama", 5) as u32,
      aci: o.get("aci").and_then(Value::as_f64).unwrap_or(0.0) as f32,
      kirp: kirp.unwrap_or([0; 4]),
      kilit: o.get("kilit").and_then(Value::as_bool).unwrap_or(false),
      gorunur: o.get("gorunur").and_then(Value::as_bool).unwrap_or(true),
      olcek_filtresi: tam("olcek_filtresi", 0) as i32,
      karistirma: tam("karistirma", 0) as i32,
    }
  }
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum OgeTuru {
  #[default]
  Kaynak,
  /// Başka bir sahne kaynak olarak (iç içe sahne)
  Sahne,
  Grup,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Default)]
pub struct SahneOgesi {
  /// Kaynak ya da sahne kimliği; grupta grup kimliği
  pub kaynak: String,
  #[serde(default)]
  pub tur: OgeTuru,
  /// Grup adı (yalnız grupta)
  #[serde(default, skip_serializing_if = "String::is_empty")]
  pub ad: String,
  #[serde(default)]
  pub donusum: Donusum,
  /// Grubun öğeleri (alttan üste)
  #[serde(default, skip_serializing_if = "Vec::is_empty")]
  pub cocuklar: Vec<SahneOgesi>,
  /// Grubun filtreleri (yalnız grupta; OBS'te gruba video filtresi eklenir)
  #[serde(default, skip_serializing_if = "Vec::is_empty")]
  pub filtreler: Vec<FiltreKaydi>,
  /// Öğe gösterilirken / gizlenirken oynatılan geçiş (OBS "Show/Hide Transition")
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub goster_gecisi: Option<GecisKaydi>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub gizle_gecisi: Option<GecisKaydi>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct GecisKaydi {
  pub tur: String,
  pub sure_ms: u32,
  #[serde(default, skip_serializing_if = "Value::is_null")]
  pub ayarlar: Value,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Default)]
pub struct SahneKaydi {
  pub id: String,
  pub ad: String,
  pub tuval: String,
  /// Alttan üste
  #[serde(default)]
  pub ogeler: Vec<SahneOgesi>,
  /// Bu sahneye geçerken kullanılacak geçiş (OBS "Transition Override")
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub gecis: Option<GecisKaydi>,
  /// Sahnenin kendi filtreleri (OBS sahne filtreleri)
  #[serde(default, skip_serializing_if = "Vec::is_empty")]
  pub filtreler: Vec<FiltreKaydi>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct FiltreKaydi {
  pub id: String,
  /// libobs filtre türü
  pub tur: String,
  pub ad: String,
  #[serde(default = "dogru")]
  pub etkin: bool,
  #[serde(default)]
  pub ayarlar: Value,
}

/// Kaynağın ses özellikleri (OBS "Advanced Audio Properties")
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct SesKaydi {
  /// Doğrusal çarpan (1 = 0 dB)
  #[serde(default = "bir_f")]
  pub ses: f32,
  #[serde(default)]
  pub sessiz: bool,
  #[serde(default = "yarim")]
  pub denge: f32,
  #[serde(default)]
  pub mono: bool,
  #[serde(default)]
  pub senkron_ms: i64,
  /// 0 kapalı, 1 yalnız izle (çıkışa gitmez), 2 izle ve çıkışa ver
  #[serde(default)]
  pub izleme: i32,
}

impl Default for SesKaydi {
  fn default() -> Self {
    SesKaydi { ses: 1.0, sessiz: false, denge: 0.5, mono: false, senkron_ms: 0, izleme: 0 }
  }
}

impl SesKaydi {
  pub fn varsayilan_mi(&self) -> bool {
    self == &SesKaydi::default()
  }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct KaynakKaydi {
  pub id: String,
  /// Panel türü (`renk`, `yazi`, `ekran`, `tarayici`, … `eklenti`; OBS'ten içe aktarılan `obs`)
  pub tur: String,
  /// libobs kaynak kimliği (`color_source`, eklentinin kaynak kimliği…)
  pub obs_turu: String,
  pub ad: String,
  #[serde(default)]
  pub ayarlar: Value,
  #[serde(default = "tum_izler")]
  pub izler: u32,
  /// Yalnız sürüm 1 kayıtlarında (göçte sahnelere taşınır)
  #[serde(default, skip_serializing_if = "Vec::is_empty")]
  pub ogeler: Vec<OgeKaydi>,
  /// Son açılışta tür kayıtlı değildi (eklenti yok) → oluşturulmadı ama kayıt korunuyor
  #[serde(default, skip_serializing_if = "std::ops::Not::not")]
  pub eksik: bool,
  /// Parola türündeki ayar alanları: değerleri bu dosyada DEĞİL Kimlik Yöneticisinde
  /// (`motor.kaynak.<id>.<alan>`) durur, kaynak kurulurken motora verilir.
  #[serde(default, skip_serializing_if = "Vec::is_empty")]
  pub gizli_alanlar: Vec<String>,
  #[serde(default, skip_serializing_if = "Vec::is_empty")]
  pub filtreler: Vec<FiltreKaydi>,
  #[serde(default, skip_serializing_if = "SesKaydi::varsayilan_mi")]
  pub ses: SesKaydi,
}

impl KaynakKaydi {
  pub fn yeni(id: &str, tur: &str, obs_turu: &str, ad: &str, ayarlar: Value) -> KaynakKaydi {
    KaynakKaydi {
      id: id.into(),
      tur: tur.into(),
      obs_turu: obs_turu.into(),
      ad: ad.into(),
      ayarlar,
      izler: 0x3F,
      ogeler: Vec::new(),
      eksik: false,
      gizli_alanlar: Vec::new(),
      filtreler: Vec::new(),
      ses: SesKaydi::default(),
    }
  }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct HedefKaydi {
  pub tuval: String,
  #[serde(default)]
  pub iz: u8,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Koleksiyon {
  pub surum: u32,
  #[serde(default = "varsayilan_ad")]
  pub ad: String,
  #[serde(default)]
  pub dikey: bool,
  #[serde(default = "varsayilan_fps")]
  pub fps: u32,
  #[serde(default)]
  pub sayac: u64,
  #[serde(default)]
  pub kaynaklar: Vec<KaynakKaydi>,
  /// Sahne listesi (panelde gösterim sırası); her sahne bir tuvale ait
  #[serde(default)]
  pub sahneler: Vec<SahneKaydi>,
  /// Tuval → program sahnesi
  #[serde(default)]
  pub program: BTreeMap<String, String>,
  /// Tuval → varsayılan geçiş
  #[serde(default)]
  pub gecisler: BTreeMap<String, GecisKaydi>,
  /// Yalnız sürüm 1: tuval → kaynak kimlikleri alttan üste (göçte kullanılır)
  #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
  pub sira: BTreeMap<String, Vec<String>>,
  #[serde(default)]
  pub hedefler: BTreeMap<String, HedefKaydi>,
  #[serde(default = "varsayilan_tekrar")]
  pub tekrar_sn: u32,
  /// Çift ses uyarısında "İkisini de tut" denen çiftler (`uygulama|masaustu` kaynak kimlikleri)
  #[serde(default, skip_serializing_if = "Vec::is_empty")]
  pub cift_ses_tut: Vec<String>,
}

fn varsayilan_fps() -> u32 {
  60
}

fn varsayilan_tekrar() -> u32 {
  30
}

impl Default for Koleksiyon {
  fn default() -> Self {
    Koleksiyon {
      surum: SURUM,
      ad: varsayilan_ad(),
      dikey: false,
      fps: 60,
      sayac: 0,
      kaynaklar: Vec::new(),
      sahneler: Vec::new(),
      program: BTreeMap::new(),
      gecisler: BTreeMap::new(),
      sira: BTreeMap::new(),
      hedefler: BTreeMap::new(),
      tekrar_sn: 30,
      cift_ses_tut: Vec::new(),
    }
  }
}

#[derive(Debug, PartialEq)]
pub enum Okuma {
  Yok,
  Tamam(Koleksiyon),
  /// Daha yeni bir sürümün yazdığı kayıt: okunmaz ve ÜZERİNE YAZILMAZ (veri kaybı olmasın)
  YeniSurum(u32),
  Bozuk(String),
}

/// Kayıt metnini çözümler; sürüm 1 (ve sürümsüz) kayıt bellekte sürüm 2'ye yükseltilir. Bozuk ya da daha yeni
/// sürüm kayıt dosyası olduğu gibi bırakılır.
pub fn cozumle(metin: &str) -> Okuma {
  let v: Value = match serde_json::from_str(metin) {
    Ok(v) => v,
    Err(e) => return Okuma::Bozuk(e.to_string()),
  };
  let surum = v.get("surum").and_then(Value::as_u64).unwrap_or(0) as u32;
  if surum > SURUM {
    return Okuma::YeniSurum(surum);
  }
  match serde_json::from_value::<Koleksiyon>(v) {
    Ok(mut k) => {
      if !(k.fps == 30 || k.fps == 60) {
        k.fps = 60;
      }
      k.tekrar_sn = k.tekrar_sn.clamp(5, 600);
      k.kaynaklar.retain(|x| !x.id.is_empty());
      if surum < 2 {
        k.v1_gocu();
      }
      k.surum = SURUM;
      k.duzelt();
      Okuma::Tamam(k)
    }
    Err(e) => Okuma::Bozuk(e.to_string()),
  }
}

// ─── Dizin ve dosyalar ─────────────────────────────────────────────────────

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct DizinOgesi {
  pub id: String,
  pub ad: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Dizin {
  #[serde(default = "bir_u")]
  pub surum: u32,
  pub etkin: String,
  #[serde(default)]
  pub liste: Vec<DizinOgesi>,
}

fn bir_u() -> u32 {
  1
}

fn dizin_yolu(klasor: &Path) -> PathBuf {
  klasor.join(DIZIN_DOSYASI)
}

pub fn koleksiyon_yolu(klasor: &Path, id: &str) -> PathBuf {
  klasor.join(DIZIN).join(format!("{id}.json"))
}

/// Kimlik: küçük ASCII harf/rakam/tire, 1–48 karakter (dosya adı olarak güvenli)
/// Türkçe kurala uygun küçük harf (I → ı, İ → i); ad eşleştirmede kullanılır ("AYARI" = "ayarı")
pub fn tr_kucuk(s: &str) -> String {
  s.chars().map(|c| match c {
    'I' => 'ı',
    'İ' => 'i',
    c => c,
  }).collect::<String>().to_lowercase()
}

/// Adlar aynı mı (baştaki/sondaki boşluk ve Türkçe büyük/küçük harf farkı yok sayılır)
pub fn ad_esit(a: &str, b: &str) -> bool {
  tr_kucuk(a.trim()) == tr_kucuk(b.trim())
}

pub fn gecerli_kimlik(id: &str) -> bool {
  !id.is_empty() && id.len() <= 48 && id.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
}

/// Önce `.tmp`'ye yazar, sonra taşır: yazma sırasında çökme yarım dosya bırakmaz.
fn atomik_yaz(yol: &Path, metin: &str) -> Result<(), String> {
  if let Some(u) = yol.parent() {
    std::fs::create_dir_all(u).map_err(|e| e.to_string())?;
  }
  let gecici = yol.with_extension("tmp");
  std::fs::write(&gecici, metin).map_err(|e| e.to_string())?;
  if std::fs::rename(&gecici, yol).is_err() {
    std::fs::write(yol, metin).map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(&gecici);
  }
  Ok(())
}

pub fn dizin_oku(klasor: &Path) -> Option<Dizin> {
  let m = std::fs::read_to_string(dizin_yolu(klasor)).ok()?;
  let mut d: Dizin = serde_json::from_str(&m).ok()?;
  d.liste.retain(|x| gecerli_kimlik(&x.id));
  if !d.liste.iter().any(|x| x.id == d.etkin) {
    d.etkin = d.liste.first()?.id.clone();
  }
  Some(d)
}

pub fn dizin_yaz(klasor: &Path, d: &Dizin) -> Result<(), String> {
  atomik_yaz(&dizin_yolu(klasor), &serde_json::to_string_pretty(d).map_err(|e| e.to_string())?)
}

/// Dizin yoksa sürüm 1 dosyasını "Varsayılan" koleksiyona kopyalayarak göç eder (idempotent; v1 dosyasına dokunmaz).
/// Dönüş: göç edilemeyen v1 okuması (bozuk/yeni sürüm) — çağıran karar verir.
fn goc_uygula(klasor: &Path) -> Option<Okuma> {
  if dizin_yolu(klasor).exists() {
    return None;
  }
  let v1 = std::fs::read_to_string(klasor.join(DOSYA)).ok()?;
  match cozumle(&v1) {
    Okuma::Tamam(mut k) => {
      k.ad = varsayilan_ad();
      let yol = koleksiyon_yolu(klasor, VARSAYILAN_KIMLIK);
      if !yol.exists() {
        let metin = serde_json::to_string_pretty(&k).ok()?;
        atomik_yaz(&yol, &metin).ok()?;
      }
      let d = Dizin { surum: 1, etkin: VARSAYILAN_KIMLIK.into(), liste: vec![DizinOgesi { id: VARSAYILAN_KIMLIK.into(), ad: k.ad }] };
      dizin_yaz(klasor, &d).ok()?;
      None
    }
    o => Some(o),
  }
}

/// Etkin koleksiyonun kimliği (dizin yoksa varsayılan)
pub fn etkin_kimlik(klasor: &Path) -> String {
  let _ = goc_uygula(klasor);
  dizin_oku(klasor).map(|d| d.etkin).unwrap_or_else(|| VARSAYILAN_KIMLIK.into())
}

pub fn koleksiyon_oku(klasor: &Path, id: &str) -> Okuma {
  match std::fs::read_to_string(koleksiyon_yolu(klasor, id)) {
    Ok(m) => cozumle(&m),
    Err(_) => Okuma::Yok,
  }
}

/// Etkin koleksiyonu okur (gerekirse sürüm 1'den göç ederek).
pub fn oku(klasor: &Path) -> Okuma {
  if let Some(o) = goc_uygula(klasor) {
    return o;
  }
  koleksiyon_oku(klasor, &etkin_kimlik(klasor))
}

/// Belirli koleksiyonu yazar; daha yeni sürümün kaydının üzerine yazmaz.
pub fn koleksiyon_yaz(klasor: &Path, id: &str, k: &Koleksiyon) -> Result<(), String> {
  if !gecerli_kimlik(id) {
    return Err(format!("geçersiz koleksiyon kimliği: {id}"));
  }
  if let Okuma::YeniSurum(s) = koleksiyon_oku(klasor, id) {
    return Err(format!("sahne koleksiyonu daha yeni bir sürümle (v{s}) yazılmış; üzerine yazılmadı"));
  }
  let mut k = k.clone();
  k.surum = SURUM;
  atomik_yaz(&koleksiyon_yolu(klasor, id), &serde_json::to_string_pretty(&k).map_err(|e| e.to_string())?)?;
  // Dizinde yoksa ekle; ad değiştiyse güncelle
  let mut d = dizin_oku(klasor).unwrap_or(Dizin { surum: 1, etkin: id.into(), liste: Vec::new() });
  match d.liste.iter_mut().find(|x| x.id == id) {
    Some(x) if x.ad != k.ad => x.ad = k.ad.clone(),
    Some(_) => return Ok(()),
    None => d.liste.push(DizinOgesi { id: id.into(), ad: k.ad.clone() }),
  }
  dizin_yaz(klasor, &d)
}

/// Etkin koleksiyonu yazar.
pub fn yaz(klasor: &Path, k: &Koleksiyon) -> Result<(), String> {
  if let Some(Okuma::YeniSurum(s)) = goc_uygula(klasor) {
    return Err(format!("sahne koleksiyonu daha yeni bir sürümle (v{s}) yazılmış; üzerine yazılmadı"));
  }
  koleksiyon_yaz(klasor, &etkin_kimlik(klasor), k)
}

/// Bozuk kayıt dosyasını bir kenara taşır (silmez) ki yeni kayıt başlatılabilsin.
pub fn bozugu_yedekle(klasor: &Path) -> Option<PathBuf> {
  let yol = if dizin_yolu(klasor).exists() { koleksiyon_yolu(klasor, &etkin_kimlik(klasor)) } else { klasor.join(DOSYA) };
  let ad = yol.file_name()?.to_string_lossy().into_owned();
  let hedef = klasor.join(YEDEK_DIZINI).join(format!("{ad}.bozuk-{}", crate::db::chrono_now()));
  std::fs::create_dir_all(hedef.parent()?).ok()?;
  std::fs::rename(&yol, &hedef).ok().map(|_| hedef)
}

/// Koleksiyon dosyasını yedek klasörüne kopyalar (`sil` ise taşır). Dönüş: yedeğin yolu.
pub fn yedekle(klasor: &Path, id: &str, sil: bool) -> Result<PathBuf, String> {
  let yol = koleksiyon_yolu(klasor, id);
  if !yol.is_file() {
    return Err("koleksiyon dosyası yok".into());
  }
  let hedef = klasor.join(YEDEK_DIZINI).join(format!("{id}-{}.json", crate::db::chrono_now()));
  std::fs::create_dir_all(klasor.join(YEDEK_DIZINI)).map_err(|e| e.to_string())?;
  if sil {
    std::fs::rename(&yol, &hedef).map_err(|e| e.to_string())?;
  } else {
    std::fs::copy(&yol, &hedef).map_err(|e| e.to_string())?;
  }
  Ok(hedef)
}

/// Addan dizinde kullanılmayan kimlik üretir (`koleksiyon-2`, …)
pub fn yeni_kimlik(d: &Dizin, ad: &str) -> String {
  // Harf harf eşlenir: "İ".to_lowercase() birleşik nokta işareti (U+0307) üretir
  let taban: String = ad
    .chars()
    .map(|c| match c {
      'ç' | 'Ç' => 'c',
      'ğ' | 'Ğ' => 'g',
      'ı' | 'İ' => 'i',
      'ö' | 'Ö' => 'o',
      'ş' | 'Ş' => 's',
      'ü' | 'Ü' => 'u',
      c if c.is_ascii_alphanumeric() => c.to_ascii_lowercase(),
      _ => '-',
    })
    .collect::<String>()
    .split('-')
    .filter(|p| !p.is_empty())
    .collect::<Vec<_>>()
    .join("-");
  let taban: String = if taban.is_empty() { "koleksiyon".into() } else { taban.chars().take(40).collect() };
  if !d.liste.iter().any(|x| x.id == taban) {
    return taban;
  }
  (2..).map(|n| format!("{taban}-{n}")).find(|k| !d.liste.iter().any(|x| &x.id == k)).unwrap_or(taban)
}

// ─── Koleksiyon işlemleri ──────────────────────────────────────────────────

impl Koleksiyon {
  /// Tek boş sahneli yeni koleksiyon
  pub fn bos(ad: &str, dikey: bool, fps: u32) -> Koleksiyon {
    let mut k = Koleksiyon { ad: ad.into(), dikey, fps, ..Default::default() };
    k.duzelt();
    k
  }

  pub fn kaynak(&mut self, id: &str) -> Option<&mut KaynakKaydi> {
    self.kaynaklar.iter_mut().find(|k| k.id == id)
  }

  pub fn sahne(&mut self, id: &str) -> Option<&mut SahneKaydi> {
    self.sahneler.iter_mut().find(|s| s.id == id)
  }

  pub fn sahne_ref(&self, id: &str) -> Option<&SahneKaydi> {
    self.sahneler.iter().find(|s| s.id == id)
  }

  /// Etkin tuvaller (dikey kapalıysa yalnız ana)
  pub fn tuvaller(&self) -> Vec<&'static str> {
    if self.dikey {
      TUVALLER.to_vec()
    } else {
      vec!["ana"]
    }
  }

  /// Yeni benzersiz kimlik (kaynak, sahne, grup, filtre için ortak sayaç): `<onek><n>`
  pub fn yeni_kimlik(&mut self, onek: &str) -> String {
    loop {
      self.sayac += 1;
      let id = format!("{onek}{}", self.sayac);
      if !self.kimlik_kullanimda(&id) {
        return id;
      }
    }
  }

  pub fn kimlik_kullanimda(&self, id: &str) -> bool {
    fn grupta(o: &[SahneOgesi], id: &str) -> bool {
      o.iter().any(|x| (x.tur == OgeTuru::Grup && (x.kaynak == id || x.filtreler.iter().any(|f| f.id == id))) || grupta(&x.cocuklar, id))
    }
    self.kaynaklar.iter().any(|k| k.id == id || k.filtreler.iter().any(|f| f.id == id))
      || self.sahneler.iter().any(|s| s.id == id || s.filtreler.iter().any(|f| f.id == id) || grupta(&s.ogeler, id))
  }

  /// Tutarlılık: her etkin tuvalde en az bir sahne, geçerli program sahnesi; bilinmeyen kaynağa işaret eden ve
  /// kendini içeren öğeler düşer.
  pub fn duzelt(&mut self) {
    let mut gorulen = BTreeSet::new();
    self.sahneler.retain(|s| !s.id.is_empty() && TUVALLER.contains(&s.tuval.as_str()) && gorulen.insert(s.id.clone()));
    for tv in self.tuvaller() {
      if !self.sahneler.iter().any(|s| s.tuval == tv) {
        let (id, ad) = if tv == "ana" { ("sahne-ana", "Sahne") } else { ("sahne-dikey", "Dikey sahne") };
        let id = if self.kimlik_kullanimda(id) { self.yeni_kimlik("s") } else { id.to_string() };
        self.sahneler.push(SahneKaydi { id, ad: ad.into(), tuval: tv.into(), ogeler: Vec::new(), gecis: None, ..Default::default() });
      }
    }
    for tv in TUVALLER {
      let gecerli = self.program.get(tv).is_some_and(|p| self.sahneler.iter().any(|s| &s.id == p && s.tuval == tv));
      if !gecerli {
        match self.sahneler.iter().find(|s| s.tuval == tv) {
          Some(s) => {
            let id = s.id.clone();
            self.program.insert(tv.into(), id);
          }
          None => {
            self.program.remove(tv);
          }
        }
      }
    }
    let kaynaklar: BTreeSet<String> = self.kaynaklar.iter().map(|k| k.id.clone()).collect();
    let sahneler: BTreeSet<String> = self.sahneler.iter().map(|s| s.id.clone()).collect();
    fn temizle(ogeler: &mut Vec<SahneOgesi>, sahne: &str, kaynaklar: &BTreeSet<String>, sahneler: &BTreeSet<String>) {
      ogeler.retain(|o| match o.tur {
        OgeTuru::Kaynak => kaynaklar.contains(&o.kaynak),
        OgeTuru::Sahne => sahneler.contains(&o.kaynak) && o.kaynak != sahne,
        OgeTuru::Grup => !o.kaynak.is_empty(),
      });
      for o in ogeler.iter_mut().filter(|o| o.tur == OgeTuru::Grup) {
        // Grup içinde grup yok (OBS'te de yok)
        o.cocuklar.retain(|c| c.tur != OgeTuru::Grup);
        temizle(&mut o.cocuklar, sahne, kaynaklar, sahneler);
      }
    }
    for s in &mut self.sahneler {
      let id = s.id.clone();
      temizle(&mut s.ogeler, &id, &kaynaklar, &sahneler);
    }
  }

  /// Sürüm 1 → 2: tuval başına tek sahne ("sahne-ana", "sahne-dikey"); öğeler kaynaklardan sahnelere taşınır.
  fn v1_gocu(&mut self) {
    if !self.sahneler.is_empty() {
      return;
    }
    let dikey_ogesi = self.kaynaklar.iter().any(|k| k.ogeler.iter().any(|o| o.tuval == "dikey"));
    let mut tuvaller = vec!["ana"];
    if self.dikey || dikey_ogesi {
      tuvaller.push("dikey");
    }
    for tv in tuvaller {
      let (id, ad) = if tv == "ana" { ("sahne-ana", "Sahne") } else { ("sahne-dikey", "Dikey sahne") };
      let ogeler: Vec<SahneOgesi> = self
        .kurulum_sirasi(tv)
        .into_iter()
        .filter_map(|r| {
          let o = r.ogeler.iter().find(|o| o.tuval == tv)?;
          Some(SahneOgesi {
            kaynak: r.id.clone(),
            tur: OgeTuru::Kaynak,
            ad: String::new(),
            donusum: Donusum {
              konum: o.konum,
              sinir: o.sinir,
              // v1'de sınır verilen öğe motorda "içe sığdır" ile kuruluyordu
              sinir_turu: if o.sinir.is_some() { 2 } else { 0 },
              gorunur: o.gorunur,
              ..Default::default()
            },
            ..Default::default()
          })
        })
        .collect();
      self.sahneler.push(SahneKaydi { id: id.into(), ad: ad.into(), tuval: tv.into(), ogeler, gecis: None, ..Default::default() });
      self.program.insert(tv.into(), id.into());
    }
    for k in &mut self.kaynaklar {
      k.ogeler.clear();
    }
    self.sira.clear();
  }

  /// Sürüm 1 kurulum sırası: kayıtlı sıra, sonra sıraya girmemiş öğeler (ekleme sırasıyla).
  fn kurulum_sirasi(&self, tuval: &str) -> Vec<&KaynakKaydi> {
    let mut sonuc: Vec<&KaynakKaydi> = Vec::new();
    if let Some(s) = self.sira.get(tuval) {
      for id in s {
        if let Some(k) = self.kaynaklar.iter().find(|k| &k.id == id && k.ogeler.iter().any(|o| o.tuval == tuval)) {
          sonuc.push(k);
        }
      }
    }
    for k in &self.kaynaklar {
      if k.ogeler.iter().any(|o| o.tuval == tuval) && !sonuc.iter().any(|x| x.id == k.id) {
        sonuc.push(k);
      }
    }
    sonuc
  }

  /// Motordan okunan sahne öğeleriyle (motor sırası: kök öğe, ardından grup çocukları; alttan üste) sahnenin
  /// kaydını günceller. Eksik (motorda kurulamamış) kaynakların öğeleri eski konumlarında korunur; grup adları
  /// kayıttan gelir.
  pub fn sahneyi_guncelle(&mut self, sahne: &str, motor_ogeleri: &[Value]) {
    let eksikler: BTreeSet<String> = self.kaynaklar.iter().filter(|k| k.eksik).map(|k| k.id.clone()).collect();
    let sahneler: BTreeSet<String> = self.sahneler.iter().map(|s| s.id.clone()).collect();
    let Some(s) = self.sahne(sahne) else { return };
    let eski = std::mem::take(&mut s.ogeler);
    let grup_adi = |id: &str| -> Option<String> { eski.iter().find(|o| o.tur == OgeTuru::Grup && o.kaynak == id).map(|o| o.ad.clone()) };
    // Motorun bilmediği öğe alanları (geçiş ayarları, grup filtreleri): aynı kaynağın n. görünümünden taşınır
    let mut eski_duz: Vec<&SahneOgesi> = Vec::new();
    for o in &eski {
      eski_duz.push(o);
      eski_duz.extend(o.cocuklar.iter());
    }
    let mut goruldu: BTreeMap<String, usize> = BTreeMap::new();
    let mut tasi = |kayit: &mut SahneOgesi| {
      let n = goruldu.entry(kayit.kaynak.clone()).or_insert(0);
      if let Some(e) = eski_duz.iter().filter(|e| e.kaynak == kayit.kaynak && e.tur == kayit.tur).nth(*n) {
        kayit.filtreler = e.filtreler.clone();
        kayit.goster_gecisi = e.goster_gecisi.clone();
        kayit.gizle_gecisi = e.gizle_gecisi.clone();
      }
      *n += 1;
    };
    let mut kok: Vec<SahneOgesi> = Vec::new();
    for o in motor_ogeleri {
      let Some(kaynak) = o.get("kaynak").and_then(Value::as_str) else { continue };
      let grup = o.get("grup").and_then(Value::as_bool).unwrap_or(false);
      let tur = if grup {
        OgeTuru::Grup
      } else if sahneler.contains(kaynak) {
        OgeTuru::Sahne
      } else {
        OgeTuru::Kaynak
      };
      let mut kayit = SahneOgesi {
        kaynak: kaynak.to_string(),
        tur,
        ad: if grup { grup_adi(kaynak).unwrap_or_else(|| kaynak.to_string()) } else { String::new() },
        donusum: Donusum::motordan(o),
        cocuklar: Vec::new(),
        ..Default::default()
      };
      tasi(&mut kayit);
      match o.get("ust").and_then(Value::as_str) {
        Some(ust) => {
          let gid = ust.rsplit_once('/').map_or(ust, |(_, g)| g);
          if let Some(g) = kok.iter_mut().rev().find(|x| x.tur == OgeTuru::Grup && x.kaynak == gid) {
            g.cocuklar.push(kayit);
          }
        }
        None => kok.push(kayit),
      }
    }
    for (i, o) in eski.iter().enumerate() {
      if o.tur == OgeTuru::Kaynak && eksikler.contains(&o.kaynak) {
        kok.insert(i.min(kok.len()), o.clone());
      }
    }
    if let Some(s) = self.sahne(sahne) {
      s.ogeler = kok;
    }
  }

  /// Filtre sahibinin (kaynak, sahne ya da grup kimliği) filtre listesi
  pub fn filtreler_mut(&mut self, sahip: &str) -> Option<&mut Vec<FiltreKaydi>> {
    fn grup<'a>(o: &'a mut [SahneOgesi], id: &str) -> Option<&'a mut SahneOgesi> {
      o.iter_mut().find(|x| x.tur == OgeTuru::Grup && x.kaynak == id)
    }
    if self.kaynaklar.iter().any(|k| k.id == sahip) {
      return self.kaynak(sahip).map(|k| &mut k.filtreler);
    }
    if self.sahneler.iter().any(|s| s.id == sahip) {
      return self.sahne(sahip).map(|s| &mut s.filtreler);
    }
    self.sahneler.iter_mut().find_map(|s| grup(&mut s.ogeler, sahip)).map(|g| &mut g.filtreler)
  }

  /// Filtrenin sahibi (kaynak, sahne ya da grup kimliği)
  pub fn filtre_sahibi(&self, fid: &str) -> Option<String> {
    let var = |v: &[FiltreKaydi]| v.iter().any(|f| f.id == fid);
    if let Some(k) = self.kaynaklar.iter().find(|k| var(&k.filtreler)) {
      return Some(k.id.clone());
    }
    for s in &self.sahneler {
      if var(&s.filtreler) {
        return Some(s.id.clone());
      }
      if let Some(g) = s.ogeler.iter().find(|o| o.tur == OgeTuru::Grup && var(&o.filtreler)) {
        return Some(g.kaynak.clone());
      }
    }
    None
  }

  /// Sahnede bu kaynağı (ya da grubu) gösteren `n`. öğe (0'dan; kök öğe, ardından grup çocukları — motorun listeleme
  /// sırası). Eksik kaynakların öğeleri motor listesinde olmadığı için sıra numarası değil kaynak + görünüm kullanılır.
  pub fn oge_bul(&self, sahne: &str, kaynak: &str, n: usize) -> Option<&SahneOgesi> {
    let s = self.sahne_ref(sahne)?;
    s.ogeler.iter().flat_map(|o| std::iter::once(o).chain(o.cocuklar.iter())).filter(|o| o.kaynak == kaynak).nth(n)
  }

  pub fn oge_bul_mut(&mut self, sahne: &str, kaynak: &str, n: usize) -> Option<&mut SahneOgesi> {
    let s = self.sahne(sahne)?;
    let mut sayac = 0;
    for o in s.ogeler.iter_mut() {
      if o.kaynak == kaynak {
        if sayac == n {
          return Some(o);
        }
        sayac += 1;
      }
      for c in o.cocuklar.iter_mut() {
        if c.kaynak == kaynak {
          if sayac == n {
            return Some(c);
          }
          sayac += 1;
        }
      }
    }
    None
  }

  /// Sahnede (gruplar dahil) bu kaynağı gösteren öğe sayısı
  pub fn kullanim_sayisi(&self, kaynak: &str) -> usize {
    fn say(o: &[SahneOgesi], k: &str) -> usize {
      o.iter().map(|x| usize::from(x.tur != OgeTuru::Grup && x.kaynak == k) + say(&x.cocuklar, k)).sum()
    }
    self.sahneler.iter().map(|s| say(&s.ogeler, kaynak)).sum()
  }
}

#[cfg(test)]
mod tests {
  #[test]
  fn turkce_ad_eslestirme() {
    assert!(ad_esit("Renk ayarı", "renk AYARI"));
    assert!(ad_esit("İstanbul", "istanbul"));
    assert!(!ad_esit("ayarı", "ayari"));
    assert!(ad_esit(" Kamera ", "KAMERA"));
  }

  use super::*;
  use serde_json::json;

  fn gecici(ad: &str) -> PathBuf {
    let d = std::env::temp_dir().join(format!("yym-koleksiyon-{ad}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&d);
    d
  }

  #[test]
  fn cozumleme_surum_ve_bozuk_kayit() {
    assert!(matches!(cozumle("{bozuk"), Okuma::Bozuk(_)));
    assert_eq!(cozumle(r#"{"surum": 9}"#), Okuma::YeniSurum(9));
    let Okuma::Tamam(k) = cozumle(r#"{"surum":0,"fps":45,"tekrar_sn":9999,"kaynaklar":[{"id":"","tur":"renk","obs_turu":"color_source","ad":"x"}]}"#) else {
      panic!()
    };
    assert_eq!((k.surum, k.fps, k.tekrar_sn), (SURUM, 60, 600));
    assert!(k.kaynaklar.is_empty(), "kimliksiz kaynak atılır");
    // Ana tuvalde bir sahne ve program her zaman var
    assert_eq!(k.sahneler.len(), 1);
    assert_eq!(k.program["ana"], k.sahneler[0].id);
  }

  #[test]
  fn v1_gocu_sira_donusum_ve_eksik_kaynak() {
    let v1 = r#"{"surum":1,"dikey":true,"sayac":4,
      "kaynaklar":[
        {"id":"k1","tur":"renk","obs_turu":"color_source","ad":"Arka","ogeler":[{"tuval":"ana","konum":[0,0],"sinir":[1920,1080]},{"tuval":"dikey","konum":[0,0]}]},
        {"id":"k2","tur":"yazi","obs_turu":"text_gdiplus","ad":"Başlık","izler":3,"ogeler":[{"tuval":"ana","konum":[40,40],"gorunur":false}]},
        {"id":"k3","tur":"eklenti","obs_turu":"yok_tur","ad":"Eklenti","eksik":true,"ogeler":[{"tuval":"ana","konum":[5,5]}]}],
      "sira":{"ana":["k3","k1","k2"]},
      "hedefler":{"h1":{"tuval":"dikey","iz":1}}}"#;
    let Okuma::Tamam(k) = cozumle(v1) else { panic!() };
    assert_eq!(k.surum, 2);
    let ana = k.sahne_ref("sahne-ana").unwrap();
    let sira: Vec<&str> = ana.ogeler.iter().map(|o| o.kaynak.as_str()).collect();
    assert_eq!(sira, ["k3", "k1", "k2"], "sıra ve eksik kaynağın yeri korunur");
    assert_eq!(ana.ogeler[1].donusum.sinir, Some([1920.0, 1080.0]));
    assert_eq!(ana.ogeler[1].donusum.sinir_turu, 2);
    assert!(!ana.ogeler[2].donusum.gorunur);
    assert_eq!(k.sahne_ref("sahne-dikey").unwrap().ogeler.len(), 1);
    assert_eq!(k.program["ana"], "sahne-ana");
    assert_eq!(k.program["dikey"], "sahne-dikey");
    assert!(k.kaynaklar.iter().all(|x| x.ogeler.is_empty()) && k.sira.is_empty());
    assert_eq!(k.kaynaklar[1].izler, 3);
    assert_eq!(k.hedefler["h1"].iz, 1);
    // Yeniden yazılan v2 metni sürüm 1 alanlarını taşımaz
    let metin = serde_json::to_string(&k).unwrap();
    assert!(!metin.contains("\"sira\"") && !metin.contains("\"ogeler\":[{\"tuval\""));
    assert_eq!(cozumle(&metin), Okuma::Tamam(k));
  }

  #[test]
  fn dosya_gocu_v1_dosyasina_dokunmaz_ve_coklu_koleksiyon() {
    let d = gecici("goc");
    std::fs::create_dir_all(&d).unwrap();
    let v1 = r#"{"surum":1,"kaynaklar":[{"id":"k1","tur":"renk","obs_turu":"color_source","ad":"A","ogeler":[{"tuval":"ana","konum":[1,2]}]}]}"#;
    std::fs::write(d.join(DOSYA), v1).unwrap();
    let Okuma::Tamam(k) = oku(&d) else { panic!() };
    assert_eq!(k.sahneler[0].ogeler[0].donusum.konum, [1.0, 2.0]);
    assert_eq!(std::fs::read_to_string(d.join(DOSYA)).unwrap(), v1, "v1 dosyası değişmez");
    assert!(koleksiyon_yolu(&d, VARSAYILAN_KIMLIK).is_file());
    assert_eq!(etkin_kimlik(&d), VARSAYILAN_KIMLIK);
    // İkinci koleksiyon, etkinleştirme, yedekle-sil
    let mut dz = dizin_oku(&d).unwrap();
    let id = yeni_kimlik(&dz, "Oyun Gecesi Ş");
    assert_eq!(id, "oyun-gecesi-s");
    assert_eq!(yeni_kimlik(&dz, "İkinci IŞIK"), "ikinci-isik");
    koleksiyon_yaz(&d, &id, &Koleksiyon::bos("Oyun Gecesi Ş", false, 60)).unwrap();
    dz = dizin_oku(&d).unwrap();
    assert_eq!(dz.liste.len(), 2);
    dz.etkin = id.clone();
    dizin_yaz(&d, &dz).unwrap();
    let Okuma::Tamam(k2) = oku(&d) else { panic!() };
    assert_eq!(k2.ad, "Oyun Gecesi Ş");
    let yedek = yedekle(&d, VARSAYILAN_KIMLIK, true).unwrap();
    assert!(yedek.is_file() && !koleksiyon_yolu(&d, VARSAYILAN_KIMLIK).exists());
    assert_eq!(yeni_kimlik(&dz, "Oyun Gecesi Ş"), "oyun-gecesi-s-2");
    assert!(!gecerli_kimlik("../x") && !gecerli_kimlik("") && gecerli_kimlik("a-1"));
    let _ = std::fs::remove_dir_all(&d);
  }

  #[test]
  fn yeni_surumun_ustune_yazmaz() {
    let d = gecici("yeni");
    let k = Koleksiyon::bos("A", false, 60);
    yaz(&d, &k).unwrap();
    assert_eq!(oku(&d), Okuma::Tamam(k.clone()));
    std::fs::write(koleksiyon_yolu(&d, VARSAYILAN_KIMLIK), r#"{"surum": 7, "gelecek": true}"#).unwrap();
    assert!(yaz(&d, &k).is_err(), "daha yeni sürümün kaydı ezilmemeli");
    assert!(std::fs::read_to_string(koleksiyon_yolu(&d, VARSAYILAN_KIMLIK)).unwrap().contains("gelecek"));
    let _ = std::fs::remove_dir_all(&d);
  }

  #[test]
  fn sahne_guncelleme_gruplar_ic_ice_sahne_ve_eksik_kaynak() {
    let mut k = Koleksiyon::bos("A", false, 60);
    for id in ["a", "b", "c"] {
      k.kaynaklar.push(KaynakKaydi::yeni(id, "renk", "color_source", id, json!({})));
    }
    let mut eksik = KaynakKaydi::yeni("e", "eklenti", "yok", "E", json!({}));
    eksik.eksik = true;
    k.kaynaklar.push(eksik);
    k.sahneler.push(SahneKaydi { id: "s2".into(), ad: "İkinci".into(), tuval: "ana".into(), ogeler: vec![], gecis: None, ..Default::default() });
    let s = k.sahneler[0].id.clone();
    k.sahne(&s).unwrap().ogeler = vec![
      SahneOgesi { kaynak: "e".into(), tur: OgeTuru::Kaynak, ad: String::new(), donusum: Donusum::default(), cocuklar: vec![], ..Default::default() },
      SahneOgesi { kaynak: "g1".into(), tur: OgeTuru::Grup, ad: "Kamera grubu".into(), donusum: Donusum::default(), cocuklar: vec![], ..Default::default() },
    ];
    let motor = [
      json!({"oge": format!("{s}/a"), "kaynak": "a", "konum": [1, 2], "olcek": [2, 2], "kirp": [1, 2, 3, 4], "kilit": true, "grup": false}),
      json!({"oge": format!("{s}/g1"), "kaynak": "g1", "konum": [0, 0], "grup": true}),
      json!({"oge": format!("{s}/b"), "kaynak": "b", "grup": false, "ust": format!("{s}/g1"), "gorunur": false}),
      json!({"oge": format!("{s}/c"), "kaynak": "c", "grup": false, "ust": format!("{s}/g1")}),
      json!({"oge": format!("{s}/s2"), "kaynak": "s2", "grup": false, "sinir_turu": 2, "sinir": [100, 50]}),
    ];
    k.sahneyi_guncelle(&s, &motor);
    let o = &k.sahne_ref(&s).unwrap().ogeler;
    let ozet: Vec<(&str, OgeTuru, usize)> = o.iter().map(|x| (x.kaynak.as_str(), x.tur, x.cocuklar.len())).collect();
    assert_eq!(ozet, [("e", OgeTuru::Kaynak, 0), ("a", OgeTuru::Kaynak, 0), ("g1", OgeTuru::Grup, 2), ("s2", OgeTuru::Sahne, 0)]);
    assert_eq!(o[1].donusum.kirp, [1, 2, 3, 4]);
    assert!(o[1].donusum.kilit);
    assert_eq!(o[2].ad, "Kamera grubu", "grup adı kayıttan");
    assert!(!o[2].cocuklar[0].donusum.gorunur);
    assert_eq!(o[3].donusum.sinir, Some([100.0, 50.0]));
    assert_eq!(k.kullanim_sayisi("b"), 1);
    // Motor biçimine dönüş: sınır türü 0 ise sınır gönderilmez
    let j = Donusum::default().motor_json();
    assert!(j.get("sinir").is_none() && j["sinir_turu"] == 0 && j["hizalama"] == 5);
    // Kendini içeren sahne ve bilinmeyen kaynak düzeltmede düşer
    k.sahne("s2").unwrap().ogeler.push(SahneOgesi { kaynak: "s2".into(), tur: OgeTuru::Sahne, ad: String::new(), donusum: Donusum::default(), cocuklar: vec![], ..Default::default() });
    k.sahne("s2").unwrap().ogeler.push(SahneOgesi { kaynak: "yok".into(), tur: OgeTuru::Kaynak, ad: String::new(), donusum: Donusum::default(), cocuklar: vec![], ..Default::default() });
    k.duzelt();
    assert!(k.sahne_ref("s2").unwrap().ogeler.is_empty());
    assert!(k.kimlik_kullanimda("g1") && !k.kimlik_kullanimda("g2"));
    assert_eq!(k.yeni_kimlik("k"), format!("k{}", k.sayac));
  }
}
