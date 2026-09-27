//! Motor profilleri (OBS "Profile"): teknik yapılandırma — kare hızı, çıkış/kodlayıcı, kayıt biçimi ve izleri,
//! tekrar arabelleği, adlandırılmış ses karışımları (iz adları), hedef atamaları (tuval, iz, bit hızı), izleme
//! aygıtı. Sahne yapısı profilde DEĞİLDİR (sahne koleksiyonunda).
//!
//! Dosyalar (`<veri>/motor/`): `profiller.json` (dizin) + `profiller/<kimlik>.json`; silinen profil
//! `profil-yedekleri/`'ne taşınır. İlk açılışta "Varsayılan" profil etkin koleksiyonun eski alanlarından (fps,
//! tekrar süresi, hedef atamaları) KOPYALANARAK oluşturulur; koleksiyondaki alanlar geriye uyumluluk için kalır.
//! Profilde sır yoktur: yayın anahtarları Kimlik Yöneticisinde, hedefler yalnız kimlikle anılır.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use crate::motor_koleksiyon::{gecerli_kimlik, Koleksiyon};

pub const SURUM: u32 = 1;
pub const DIZIN: &str = "profiller";
pub const DIZIN_DOSYASI: &str = "profiller.json";
pub const YEDEK_DIZINI: &str = "profil-yedekleri";
pub const VARSAYILAN_KIMLIK: &str = "varsayilan";

/// OBS'te izler numaralıdır; panel her ize bir karışım adı verir (Yayın, VOD, Kayıt, Klip, Müziksiz, Temiz)
pub const VARSAYILAN_IZ_ADLARI: [&str; 6] = ["Yayın", "VOD", "Kayıt", "Klip", "Müziksiz", "Temiz"];

fn varsayilan_ad() -> String {
  "Varsayılan".into()
}
fn fps60() -> u32 {
  60
}
fn otuz() -> u32 {
  30
}
fn iz_adlari() -> Vec<String> {
  VARSAYILAN_IZ_ADLARI.iter().map(|s| s.to_string()).collect()
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct CikisAyari {
  /// basit | gelismis | uzman (arayüzün gösterdiği alanlar; motor her kipte aynı ayarları kullanır)
  #[serde(default = "basit")]
  pub kip: String,
  /// "otomatik" (NVENC varsa o, yoksa x264) ya da libobs kodlayıcı kimliği
  #[serde(default = "otomatik")]
  pub kodlayici: String,
  #[serde(default = "bh_ana")]
  pub bit_hizi_ana: u32,
  #[serde(default = "bh_dikey")]
  pub bit_hizi_dikey: u32,
  #[serde(default = "iki")]
  pub anahtar_kare_sn: u32,
  #[serde(default = "ses_bh")]
  pub ses_bit_hizi: u32,
  /// Uzman kip: kodlayıcı türüne göre libobs ayarları (temel ayarların üzerine yazılır)
  #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
  pub uzman: BTreeMap<String, Map<String, Value>>,
}

fn basit() -> String {
  "basit".into()
}
fn otomatik() -> String {
  "otomatik".into()
}
fn bh_ana() -> u32 {
  6000
}
fn bh_dikey() -> u32 {
  4000
}
fn iki() -> u32 {
  2
}
fn ses_bh() -> u32 {
  160
}

impl Default for CikisAyari {
  fn default() -> Self {
    CikisAyari { kip: basit(), kodlayici: otomatik(), bit_hizi_ana: 6000, bit_hizi_dikey: 4000, anahtar_kare_sn: 2, ses_bit_hizi: 160, uzman: BTreeMap::new() }
  }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct KayitAyari {
  /// mkv | mp4 | mov | parcali_mp4 | parcali_mov | hibrit_mp4 (motorun `kayit.bicimleri`)
  #[serde(default = "mkv")]
  pub bicim: String,
  /// Kaydedilecek ses izleri (0 tabanlı, en çok 6); dosyada bu sırayla
  #[serde(default = "ilk_iz")]
  pub izler: Vec<u8>,
  /// Boşsa `%USERPROFILE%\Videos\Yayin Motoru`
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub klasor: Option<String>,
}

fn mkv() -> String {
  "mkv".into()
}
fn ilk_iz() -> Vec<u8> {
  vec![0]
}

impl Default for KayitAyari {
  fn default() -> Self {
    KayitAyari { bicim: mkv(), izler: ilk_iz(), klasor: None }
  }
}

/// Hedef atama: hangi tuval, hangi ses izi (karışım), isteğe bağlı bit hızı (yoksa tuvalin bit hızı — kodlayıcı
/// paylaşılır; farklıysa o hedef için ayrı kodlayıcı)
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct HedefAtamasi {
  pub tuval: String,
  #[serde(default)]
  pub iz: u8,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub bit_hizi: Option<u32>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct IzlemeAygiti {
  pub id: String,
  pub ad: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Profil {
  pub surum: u32,
  #[serde(default = "varsayilan_ad")]
  pub ad: String,
  #[serde(default = "fps60")]
  pub fps: u32,
  #[serde(default)]
  pub cikis: CikisAyari,
  #[serde(default)]
  pub kayit: KayitAyari,
  #[serde(default = "otuz")]
  pub tekrar_sn: u32,
  #[serde(default = "iz_adlari")]
  pub iz_adlari: Vec<String>,
  #[serde(default)]
  pub hedefler: BTreeMap<String, HedefAtamasi>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub izleme_aygiti: Option<IzlemeAygiti>,
}

impl Default for Profil {
  fn default() -> Self {
    Profil {
      surum: SURUM,
      ad: varsayilan_ad(),
      fps: 60,
      cikis: CikisAyari::default(),
      kayit: KayitAyari::default(),
      tekrar_sn: 30,
      iz_adlari: iz_adlari(),
      hedefler: BTreeMap::new(),
      izleme_aygiti: None,
    }
  }
}

impl Profil {
  /// Koleksiyonun eski (v1/v2) profil alanlarından
  pub fn koleksiyondan(k: &Koleksiyon) -> Profil {
    Profil {
      fps: k.fps,
      tekrar_sn: k.tekrar_sn,
      hedefler: k.hedefler.iter().map(|(id, h)| (id.clone(), HedefAtamasi { tuval: h.tuval.clone(), iz: h.iz, bit_hizi: None })).collect(),
      ..Default::default()
    }
  }

  /// Değerleri geçerli aralığa çeker (bozuk/elle düzenlenmiş dosyaya karşı)
  pub fn duzelt(&mut self) {
    self.surum = SURUM;
    if !(self.fps == 30 || self.fps == 60) {
      self.fps = 60;
    }
    self.tekrar_sn = self.tekrar_sn.clamp(5, 600);
    let c = &mut self.cikis;
    if !["basit", "gelismis", "uzman"].contains(&c.kip.as_str()) {
      c.kip = basit();
    }
    if c.kodlayici.is_empty() || c.kodlayici.len() > 64 || !c.kodlayici.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_') {
      c.kodlayici = otomatik();
    }
    c.bit_hizi_ana = c.bit_hizi_ana.clamp(200, 100_000);
    c.bit_hizi_dikey = c.bit_hizi_dikey.clamp(200, 100_000);
    c.anahtar_kare_sn = c.anahtar_kare_sn.clamp(1, 10);
    c.ses_bit_hizi = c.ses_bit_hizi.clamp(32, 512);
    let k = &mut self.kayit;
    k.izler.retain(|i| *i < 6);
    k.izler.dedup();
    k.izler.truncate(6);
    if k.izler.is_empty() {
      k.izler = ilk_iz();
    }
    if !["mkv", "mp4", "mov", "parcali_mp4", "parcali_mov", "hibrit_mp4"].contains(&k.bicim.as_str()) {
      k.bicim = mkv();
    }
    if k.klasor.as_deref().is_some_and(|d| d.trim().is_empty() || !Path::new(d).is_absolute()) {
      k.klasor = None;
    }
    self.iz_adlari.resize(6, String::new());
    for (i, a) in self.iz_adlari.iter_mut().enumerate() {
      let t: String = a.trim().chars().filter(|c| !c.is_control()).take(24).collect();
      *a = if t.is_empty() { VARSAYILAN_IZ_ADLARI[i].to_string() } else { t };
    }
    self.hedefler.retain(|id, h| !id.is_empty() && (h.tuval == "ana" || h.tuval == "dikey"));
    for h in self.hedefler.values_mut() {
      h.iz = h.iz.min(5);
      h.bit_hizi = h.bit_hizi.map(|b| b.clamp(200, 100_000));
    }
  }

  /// Tuvalin varsayılan bit hızı
  pub fn tuval_bit_hizi(&self, tuval: &str) -> u32 {
    if tuval == "dikey" {
      self.cikis.bit_hizi_dikey
    } else {
      self.cikis.bit_hizi_ana
    }
  }

  /// Hedefin kullanacağı video kodlayıcısının kimliği ve bit hızı. Aynı tuval + aynı bit hızı → aynı kodlayıcı
  /// (kodlama paylaşımı); farklı bit hızı → `v-<tuval>-<kbps>` (o bit hızını isteyen hedefler arasında paylaşılır).
  pub fn hedef_kodlayicisi(&self, tuval: &str, bit_hizi: Option<u32>) -> (String, u32) {
    let taban = self.tuval_bit_hizi(tuval);
    match bit_hizi {
      Some(b) if b != taban => (format!("v-{tuval}-{b}"), b),
      _ => (format!("v-{tuval}"), taban),
    }
  }

  /// Kodlayıcı türüne göre Uzman kip ek ayarları (yalnız kip "uzman" iken uygulanır)
  pub fn uzman_ayarlari(&self, tur: &str) -> Map<String, Value> {
    if self.cikis.kip != "uzman" {
      return Map::new();
    }
    self.cikis.uzman.get(tur).cloned().unwrap_or_default()
  }
}

#[derive(Debug, PartialEq)]
pub enum Okuma {
  Yok,
  Tamam(Box<Profil>),
  YeniSurum(u32),
  Bozuk(String),
}

pub fn cozumle(metin: &str) -> Okuma {
  let v: Value = match serde_json::from_str(metin) {
    Ok(v) => v,
    Err(e) => return Okuma::Bozuk(e.to_string()),
  };
  let surum = v.get("surum").and_then(Value::as_u64).unwrap_or(0) as u32;
  if surum > SURUM {
    return Okuma::YeniSurum(surum);
  }
  match serde_json::from_value::<Profil>(v) {
    Ok(mut p) => {
      p.duzelt();
      Okuma::Tamam(Box::new(p))
    }
    Err(e) => Okuma::Bozuk(e.to_string()),
  }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct DizinOgesi {
  pub id: String,
  pub ad: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Dizin {
  #[serde(default)]
  pub surum: u32,
  pub etkin: String,
  #[serde(default)]
  pub liste: Vec<DizinOgesi>,
}

fn dizin_yolu(klasor: &Path) -> PathBuf {
  klasor.join(DIZIN_DOSYASI)
}

pub fn profil_yolu(klasor: &Path, id: &str) -> PathBuf {
  klasor.join(DIZIN).join(format!("{id}.json"))
}

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

pub fn profil_oku(klasor: &Path, id: &str) -> Okuma {
  match std::fs::read_to_string(profil_yolu(klasor, id)) {
    Ok(m) => cozumle(&m),
    Err(_) => Okuma::Yok,
  }
}

pub fn profil_yaz(klasor: &Path, id: &str, p: &Profil) -> Result<(), String> {
  if !gecerli_kimlik(id) {
    return Err(format!("geçersiz profil kimliği: {id}"));
  }
  if let Okuma::YeniSurum(s) = profil_oku(klasor, id) {
    return Err(format!("profil daha yeni bir sürümle (v{s}) yazılmış; üzerine yazılmadı"));
  }
  let mut p = p.clone();
  p.duzelt();
  atomik_yaz(&profil_yolu(klasor, id), &serde_json::to_string_pretty(&p).map_err(|e| e.to_string())?)?;
  let mut d = dizin_oku(klasor).unwrap_or(Dizin { surum: 1, etkin: id.into(), liste: Vec::new() });
  match d.liste.iter_mut().find(|x| x.id == id) {
    Some(x) if x.ad != p.ad => x.ad = p.ad.clone(),
    Some(_) => return Ok(()),
    None => d.liste.push(DizinOgesi { id: id.into(), ad: p.ad.clone() }),
  }
  dizin_yaz(klasor, &d)
}

/// Etkin profil kimliği; profil yoksa koleksiyondan "Varsayılan" oluşturulur (göç).
pub fn etkin_kimlik(klasor: &Path) -> String {
  if let Some(d) = dizin_oku(klasor) {
    return d.etkin;
  }
  let p = match crate::motor_koleksiyon::oku(klasor) {
    crate::motor_koleksiyon::Okuma::Tamam(k) => Profil::koleksiyondan(&k),
    _ => Profil::default(),
  };
  let _ = profil_yaz(klasor, VARSAYILAN_KIMLIK, &p);
  VARSAYILAN_KIMLIK.into()
}

/// Etkin profil (okunamazsa varsayılanlar; bozuk dosyaya dokunulmaz)
pub fn etkin(klasor: &Path) -> Profil {
  match profil_oku(klasor, &etkin_kimlik(klasor)) {
    Okuma::Tamam(p) => *p,
    _ => Profil::default(),
  }
}

pub fn etkin_yaz(klasor: &Path, p: &Profil) -> Result<(), String> {
  profil_yaz(klasor, &etkin_kimlik(klasor), p)
}

pub fn yedekle(klasor: &Path, id: &str, sil: bool) -> Result<PathBuf, String> {
  let yol = profil_yolu(klasor, id);
  if !yol.is_file() {
    return Err("profil dosyası yok".into());
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

pub fn yeni_kimlik(d: &Dizin, ad: &str) -> String {
  let kd = crate::motor_koleksiyon::Dizin { surum: 1, etkin: d.etkin.clone(), liste: d.liste.iter().map(|x| crate::motor_koleksiyon::DizinOgesi { id: x.id.clone(), ad: x.ad.clone() }).collect() };
  crate::motor_koleksiyon::yeni_kimlik(&kd, ad)
}

/// Kısmi güncelleme: yalnız verilen alanlar (JSON birleştirme), sonra doğrulama. Bilinmeyen alan reddedilir.
pub fn birlestir(p: &Profil, parca: &Map<String, Value>) -> Result<Profil, String> {
  const ALANLAR: [&str; 8] = ["ad", "fps", "cikis", "kayit", "tekrar_sn", "iz_adlari", "hedefler", "izleme_aygiti"];
  if let Some(a) = parca.keys().find(|k| !ALANLAR.contains(&k.as_str())) {
    return Err(format!("bilinmeyen profil alanı: {a}"));
  }
  let mut v = serde_json::to_value(p).map_err(|e| e.to_string())?;
  fn birles(hedef: &mut Value, kaynak: &Value) {
    match (hedef, kaynak) {
      (Value::Object(h), Value::Object(k)) => {
        for (a, d) in k {
          // null: alanı kaldır (varsayılana dön) — ör. bir hedef atamasını silmek
          if d.is_null() {
            h.remove(a);
            continue;
          }
          // Hedef atamaları ve uzman ayarları tek tek birleşir; diğer nesneler de alan alan
          birles(h.entry(a.clone()).or_insert(Value::Null), d);
        }
      }
      (h, k) => *h = k.clone(),
    }
  }
  birles(&mut v, &Value::Object(parca.clone()));
  let mut yeni: Profil = serde_json::from_value(v).map_err(|e| format!("profil alanı geçersiz: {e}"))?;
  yeni.duzelt();
  Ok(yeni)
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::motor_koleksiyon::HedefKaydi;
  use serde_json::json;

  fn gecici(ad: &str) -> PathBuf {
    let d = std::env::temp_dir().join(format!("yym-profil-{ad}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&d);
    d
  }

  #[test]
  fn koleksiyondan_goc_ve_duzeltme() {
    let d = gecici("goc");
    let mut k = Koleksiyon::bos("A", true, 30);
    k.tekrar_sn = 45;
    k.hedefler.insert("twitch".into(), HedefKaydi { tuval: "dikey".into(), iz: 1 });
    crate::motor_koleksiyon::yaz(&d, &k).unwrap();
    let p = etkin(&d);
    assert_eq!((p.fps, p.tekrar_sn, p.hedefler["twitch"].tuval.as_str(), p.hedefler["twitch"].iz), (30, 45, "dikey", 1));
    assert_eq!(p.iz_adlari[1], "VOD");
    assert!(profil_yolu(&d, VARSAYILAN_KIMLIK).is_file());
    // Bozuk değerler aralığa çekilir
    let Okuma::Tamam(b) = cozumle(r#"{"surum":1,"fps":45,"tekrar_sn":1,"cikis":{"kip":"x","kodlayici":"../x","bit_hizi_ana":1},"kayit":{"bicim":"avi","izler":[9,9],"klasor":"göreli"},"iz_adlari":["","  Oyun  "]}"#) else { panic!() };
    assert_eq!((b.fps, b.tekrar_sn, b.cikis.kip.as_str(), b.cikis.kodlayici.as_str(), b.cikis.bit_hizi_ana), (60, 5, "basit", "otomatik", 200));
    assert_eq!((b.kayit.bicim.as_str(), b.kayit.izler.clone(), b.kayit.klasor.clone()), ("mkv", vec![0], None));
    assert_eq!((b.iz_adlari[0].as_str(), b.iz_adlari[1].as_str(), b.iz_adlari.len()), ("Yayın", "Oyun", 6));
    assert_eq!(cozumle(r#"{"surum":5}"#), Okuma::YeniSurum(5));
    let _ = std::fs::remove_dir_all(&d);
  }

  #[test]
  fn kodlama_paylasimi_ve_uzman_ayarlari() {
    let mut p = Profil::default();
    assert_eq!(p.hedef_kodlayicisi("ana", None), ("v-ana".into(), 6000));
    assert_eq!(p.hedef_kodlayicisi("ana", Some(6000)), ("v-ana".into(), 6000), "aynı bit hızı → paylaşılan kodlayıcı");
    assert_eq!(p.hedef_kodlayicisi("ana", Some(3500)), ("v-ana-3500".into(), 3500));
    assert_eq!(p.hedef_kodlayicisi("dikey", None), ("v-dikey".into(), 4000));
    p.cikis.uzman.insert("obs_x264".into(), json!({"preset": "fast"}).as_object().cloned().unwrap());
    assert!(p.uzman_ayarlari("obs_x264").is_empty(), "uzman ayarı yalnız uzman kipte");
    p.cikis.kip = "uzman".into();
    assert_eq!(p.uzman_ayarlari("obs_x264")["preset"], "fast");
  }

  #[test]
  fn kismi_guncelleme() {
    let p = Profil::default();
    let y = birlestir(&p, json!({"cikis": {"bit_hizi_ana": 8000}, "hedefler": {"yt": {"tuval": "ana", "iz": 2, "bit_hizi": 9000}}, "iz_adlari": ["A", "B", "C", "D", "E", "F"]}).as_object().unwrap()).unwrap();
    assert_eq!((y.cikis.bit_hizi_ana, y.cikis.bit_hizi_dikey, y.cikis.kodlayici.as_str()), (8000, 4000, "otomatik"));
    assert_eq!(y.hedefler["yt"].bit_hizi, Some(9000));
    assert_eq!(y.iz_adlari[5], "F");
    assert!(birlestir(&p, json!({"anahtar": "x"}).as_object().unwrap()).is_err(), "bilinmeyen alan (sır alanı yok)");
    let z = birlestir(&y, json!({"hedefler": {"yt": null}, "kayit": {"klasor": null}}).as_object().unwrap()).unwrap();
    assert!(z.hedefler.is_empty(), "null atamayı kaldırır");
    assert!(birlestir(&p, json!({"fps": "hızlı"}).as_object().unwrap()).is_err());
  }

  #[test]
  fn coklu_profil_ve_yedek() {
    let d = gecici("coklu");
    let _ = etkin_kimlik(&d);
    let dz = dizin_oku(&d).unwrap();
    let id = yeni_kimlik(&dz, "Oyun 1080p");
    profil_yaz(&d, &id, &Profil { ad: "Oyun 1080p".into(), fps: 30, ..Default::default() }).unwrap();
    let mut dz = dizin_oku(&d).unwrap();
    assert_eq!(dz.liste.len(), 2);
    dz.etkin = id.clone();
    dizin_yaz(&d, &dz).unwrap();
    assert_eq!(etkin(&d).fps, 30);
    assert!(yedekle(&d, VARSAYILAN_KIMLIK, true).unwrap().is_file());
    let _ = std::fs::remove_dir_all(&d);
  }
}
