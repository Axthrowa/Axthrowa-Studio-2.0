//! Yayın çekirdeği: libobs üzerinde tuval, sahne, kaynak, kodlayıcı ve çıktı yönetimi.
//!
//! Model (docs/STREAMING_ENGINE_DECISION.md ADR-003):
//! - **Tuval**: ana tuval libobs'un ana video karışımıdır; ek tuvaller (`obs_canvas_create`) kendi çözünürlüğünde işler.
//! - **Kaynak** küreseldir; aynı kaynak birden çok tuvalin sahnesine farklı dönüşümle eklenir → tek yakalama / tek
//!   çözme, çok tüketici (prompt §31).
//! - **Kodlayıcı** bir tuvalin videosuna bağlanır; aynı kodlayıcıyı kullanan çıktılar kodlanmış paketi paylaşır (§44),
//!   farklı profil isteyen hedefe ayrı kodlayıcı verilir (§46).
//! - **Çıktı** (RTMP hedefi ya da kayıt) bağımsızdır: biri durur ya da koparsa diğerleri etkilenmez (§43, §50).

use std::collections::{BTreeMap, HashMap};
use std::path::{Path, PathBuf};
use std::sync::mpsc::Sender;
use std::sync::{Arc, Mutex};

use serde::Serialize;

use crate::obs::{self, api, cs, cstr, ObsKurulumu, Ptr, Vec2, Veri, VideoInfo};
use crate::onizleme::Onizleme;

/// Çıktı kimliği → (durum, son durma kodu); sinyal geri çağrılarıyla paylaşılır.
type DurumTablosu = Arc<Mutex<HashMap<String, (CikisDurumu, Option<i64>)>>>;

/// Çıktı durumu (prompt §41'deki durum makinesinin çekirdek tarafı).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CikisDurumu {
  Hazir,
  Baglaniyor,
  Canli,
  YenidenBaglaniyor,
  Durduruluyor,
  Durduruldu,
  Basarisiz,
}

/// Çekirdekten dışarı akan olaylar (protokolde `{"olay": …}` satırları).
#[derive(Clone, Debug, Serialize)]
#[serde(tag = "olay", rename_all = "snake_case")]
pub enum Olay {
  Cikis {
    id: String,
    durum: CikisDurumu,
    #[serde(skip_serializing_if = "Option::is_none")]
    kod: Option<i64>,
  },
  /// Ses ölçerleri (yalnız abone varken, 20 Hz)
  Seviyeler { seviyeler: Vec<crate::ses::Seviye> },
  /// Canlı önizleme karesi (JPEG, base64; yalnız akış açıkken)
  Kare { tuval: String, jpeg: String },
}

#[derive(Clone, Debug, Serialize)]
pub struct KodlayiciTuru {
  pub id: String,
  pub ad: String,
  pub kodek: String,
  pub donanim: bool,
}

#[derive(Clone, Debug, Serialize)]
pub struct CikisIstatistigi {
  pub id: String,
  pub tur: &'static str,
  pub durum: CikisDurumu,
  pub etkin: bool,
  pub yeniden_baglaniyor: bool,
  pub bayt: u64,
  pub kare: i64,
  pub dusen_kare: i64,
  pub baglanti_ms: i64,
  /// Kayıt duraklatılmış (yalnız kayıt çıktısı)
  #[serde(skip_serializing_if = "std::ops::Not::not")]
  pub duraklatildi: bool,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub son_hata: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub son_kod: Option<i64>,
}

#[derive(Clone, Debug, Serialize)]
pub struct OgeBilgisi {
  pub oge: String,
  pub kaynak: String,
  pub konum: [f32; 2],
  pub olcek: [f32; 2],
  /// Sınır kutusu (tuvale sığdırma); sınır yoksa `None`
  pub sinir: Option<[f32; 2]>,
  pub gorunur: bool,
  pub aci: f32,
  /// OBS_ALIGN_* bitleri (sol 1, sağ 2, üst 4, alt 8; 0 = orta)
  pub hizalama: u32,
  /// `enum obs_bounds_type` (0 yok, 1 uzat, 2 içe sığdır, 3 dışa sığdır, 4 genişliğe, 5 yüksekliğe, 6 yalnız en çok)
  pub sinir_turu: i32,
  pub sinir_hizalama: u32,
  /// sol, üst, sağ, alt (px)
  pub kirp: [i32; 4],
  pub kilit: bool,
  pub olcek_filtresi: i32,
  pub karistirma: i32,
  /// 0 varsayılan, 1 sRGB kapalı (OBS "Blending Method")
  pub karistirma_yontemi: i32,
  /// Kaynağın kendi boyutu (dönüşümsüz)
  pub genislik: u32,
  pub yukseklik: u32,
  pub grup: bool,
  /// Bir grubun içindeyse grup öğesinin kimliği
  #[serde(skip_serializing_if = "Option::is_none")]
  pub ust: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct Secenek {
  pub ad: String,
  pub deger: serde_json::Value,
}

#[derive(Clone, Debug, Serialize)]
pub struct TuvalBilgisi {
  pub id: String,
  pub genislik: u32,
  pub yukseklik: u32,
  pub ana: bool,
  pub sahneler: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct Istatistik {
  pub fps: f64,
  pub ortalama_kare_ms: f64,
  pub toplam_kare: u32,
  pub geciken_kare: u32,
  /// Kodlama için atlanan kareler (kodlayıcı yetişemedi)
  pub atlanan_kare: u32,
  pub video_kare: u32,
  /// Motor sürecinin CPU kullanımı (% , tüm çekirdekler 100'e ölçekli — libobs os_cpu_usage_info)
  pub cpu: f64,
  pub bellek_mb: f64,
  pub cikislar: Vec<CikisIstatistigi>,
}

pub(crate) struct Kanvas {
  /// Ek tuvalde `obs_canvas_t`; ana tuvalde NULL (libobs'un ana karışımı kullanılır)
  pub(crate) ptr: Ptr,
  pub(crate) genislik: u32,
  pub(crate) yukseklik: u32,
}

impl Kanvas {
  pub(crate) fn video(&self) -> Ptr {
    unsafe {
      if self.ptr.is_null() {
        (api().obs_get_video)()
      } else {
        (api().obs_canvas_get_video)(self.ptr)
      }
    }
  }
}

pub(crate) struct Sahne {
  pub(crate) ptr: Ptr,
  pub(crate) kanvas: String,
}

struct Kodlayici {
  ptr: Ptr,
}

/// Sinyal geri çağrılarına verilen bağlam (çıktı yaşadıkça bellekte kalır).
struct CikisBaglami {
  id: String,
  durumlar: DurumTablosu,
  olay: Sender<Olay>,
}

struct Cikis {
  ptr: Ptr,
  servis: Ptr,
  tur: &'static str,
  baglam: *mut CikisBaglami,
}

/// Ek tuvaller için bayraklar: kaynakları etkinleştirir, sahne referansı tutar, kaydedilmez. Ses karışımı yalnız ana
/// tuvalden gelir (aynı kaynak iki tuvalde olsa da ses bir kez karışır).
const EK_TUVAL_BAYRAKLARI: u32 = obs::CANVAS_ACTIVATE | obs::CANVAS_SCENE_REF | obs::CANVAS_EPHEMERAL;

const SINYALLER: [&str; 6] = ["starting", "start", "stopping", "stop", "reconnect", "reconnect_success"];

/// Varsayılan modül kümesi: yalnız sentetik kaynaklar, kodlayıcılar ve çıktılar. Yakalama modülleri (`win-capture`,
/// `win-dshow`, `win-wasapi`) ayrıca istenir. Hiç yüklenmeyenler: `obs-websocket` (kullanıcının OBS'iyle port
/// çakışır), `frontend-tools` (OBS arayüzü gerektirir), `rtmp-services` (ağdan güncelleme indirir; yerine `yym_rtmp`),
/// üçüncü taraf eklentiler (SE.Live vb.).
pub const TEMEL_MODULLER: &[&str] = &[
  "image-source",
  "obs-ffmpeg",
  "obs-nvenc",
  "obs-x264",
  "obs-outputs",
  "obs-text",
  "obs-transitions",
  "obs-filters",
];
pub const YAKALAMA_MODULLERI: &[&str] = &["win-capture", "win-dshow", "win-wasapi"];
/// Tarayıcı kaynağı (OBS'in kendi obs-browser modülü, CEF). İsteğe bağlı: ilk yüklemede CEF yardımcı süreçleri
/// (`obs-browser-page.exe`) bu motorun alt süreçleri olarak başlar ve motor kapanınca çıkar.
pub const TARAYICI_MODULLERI: &[&str] = &["obs-browser"];

#[derive(Clone, Debug, Serialize)]
pub struct KaynakDurumu {
  pub id: String,
  /// libobs kaynak türü (ör. `game_capture`)
  pub tur: String,
  pub ad: String,
  pub genislik: u32,
  pub yukseklik: u32,
  pub goruntu: bool,
  pub ses: bool,
  /// programda (yayına/kayda giden karışımda)
  pub etkin: bool,
  /// herhangi bir görünümde (önizleme dahil)
  pub gorunuyor: bool,
  pub durum: &'static str,
  /// fare/klavye etkileşimi alır (tarayıcı kaynağı vb.)
  pub etkilesim: bool,
}

/// Kayıt biçimi: libobs çıktı türü ve (varsa) FFmpeg muxer ayarı.
#[derive(Clone, Copy, Debug, Serialize)]
pub struct KayitBicimi {
  pub ad: &'static str,
  pub uzanti: &'static str,
  pub cikis: &'static str,
  #[serde(skip)]
  pub muxer: &'static str,
  pub aciklama: &'static str,
}

/// OBS'in kayıt biçimleriyle aynı seçenekler (parçalı biçimler OBS'in kullandığı movflags ile). Hibrit MP4, OBS'in
/// yerel `mp4_output` çıktısıdır; kurulu sürümde kayıtlı değilse listelenmez.
pub const KAYIT_BICIMLERI: &[KayitBicimi] = &[
  KayitBicimi { ad: "mkv", uzanti: "mkv", cikis: "ffmpeg_muxer", muxer: "", aciklama: "Matroska — kesintide dosya kurtarılabilir" },
  KayitBicimi { ad: "mp4", uzanti: "mp4", cikis: "ffmpeg_muxer", muxer: "", aciklama: "MPEG-4 — kesintide dosya bozulabilir" },
  KayitBicimi { ad: "mov", uzanti: "mov", cikis: "ffmpeg_muxer", muxer: "", aciklama: "QuickTime" },
  KayitBicimi {
    ad: "parcali_mp4",
    uzanti: "mp4",
    cikis: "ffmpeg_muxer",
    muxer: "movflags=frag_keyframe+empty_moov+delay_moov",
    aciklama: "Parçalı MP4 — kesintide o ana kadarki kısım okunur",
  },
  KayitBicimi {
    ad: "parcali_mov",
    uzanti: "mov",
    cikis: "ffmpeg_muxer",
    muxer: "movflags=frag_keyframe+empty_moov+delay_moov",
    aciklama: "Parçalı MOV",
  },
  KayitBicimi { ad: "hibrit_mp4", uzanti: "mp4", cikis: "mp4_output", muxer: "", aciklama: "Hibrit MP4 (OBS yerel yazıcısı)" },
];

pub fn kayit_bicimi(ad: &str) -> Result<KayitBicimi, String> {
  KAYIT_BICIMLERI.iter().find(|b| b.ad == ad).copied().ok_or_else(|| format!("bilinmeyen kayıt biçimi: {ad}"))
}

/// Kurulu libobs'ta kullanılabilen kayıt biçimleri
pub fn kayit_bicimleri() -> Vec<KayitBicimi> {
  let cikislar = crate::eklenti::kayitli_turler("cikis");
  KAYIT_BICIMLERI.iter().filter(|b| cikislar.iter().any(|c| c == b.cikis)).copied().collect()
}

/// Motor ayarları (ana tuval). Taban çözünürlük sahnelerin koordinat uzayıdır; çıkış çözünürlüğü kodlayıcılara giden
/// (ölçeklenmiş) boyuttur (OBS Ayarlar > Video). Renk ve ses ayarları tüm tuvallere uygulanır.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct MotorAyari {
  pub genislik: u32,
  pub yukseklik: u32,
  pub fps: u32,
  pub cikis_genislik: u32,
  pub cikis_yukseklik: u32,
  /// `enum obs_scale_type`
  pub olcek: std::ffi::c_int,
  /// `enum video_format`
  pub bicim: std::ffi::c_int,
  /// `enum video_colorspace`
  pub renk_uzayi: std::ffi::c_int,
  /// `enum video_range_type`
  pub aralik: std::ffi::c_int,
  pub ornekleme: u32,
  /// `enum speaker_layout`
  pub hoparlor: std::ffi::c_int,
}

impl MotorAyari {
  /// Varsayılanlar: çıkış = taban, bikübik, NV12, Rec. 709, kısmi aralık, 48 kHz stereo (OBS varsayılanları)
  pub fn yeni(genislik: u32, yukseklik: u32, fps: u32) -> Self {
    MotorAyari {
      genislik,
      yukseklik,
      fps,
      cikis_genislik: genislik,
      cikis_yukseklik: yukseklik,
      olcek: obs::OBS_SCALE_BICUBIC,
      bicim: obs::VIDEO_FORMAT_NV12,
      renk_uzayi: obs::VIDEO_CS_709,
      aralik: obs::VIDEO_RANGE_PARTIAL,
      ornekleme: 48_000,
      hoparlor: obs::SPEAKERS_STEREO,
    }
  }

  /// Aynı renk/ses ayarlarıyla başka boyutta tuval (ek tuvaller: çıkış = taban)
  pub fn boyutla(self, genislik: u32, yukseklik: u32) -> Self {
    MotorAyari { genislik, yukseklik, cikis_genislik: genislik, cikis_yukseklik: yukseklik, ..self }
  }
}

/// Ayar adları ↔ libobs sayıları (protokol ve bilgi çıktısı için)
pub const OLCEK_FILTRELERI: [(&str, std::ffi::c_int); 4] = [("bilinear", 3), ("bicubic", 2), ("lanczos", 4), ("area", 5)];
pub const RENK_BICIMLERI: [(&str, std::ffi::c_int); 6] = [("nv12", 2), ("i420", 1), ("i444", 10), ("p010", 18), ("i010", 17), ("bgra", 7)];
pub const RENK_UZAYLARI: [(&str, std::ffi::c_int); 5] = [("601", 1), ("709", 2), ("srgb", 3), ("2100pq", 4), ("2100hlg", 5)];
pub const RENK_ARALIKLARI: [(&str, std::ffi::c_int); 2] = [("kismi", 1), ("tam", 2)];
pub const HOPARLORLER: [(&str, std::ffi::c_int); 7] = [("mono", 1), ("stereo", 2), ("2.1", 3), ("4.0", 4), ("4.1", 5), ("5.1", 6), ("7.1", 8)];

pub fn ada_gore(tablo: &[(&str, std::ffi::c_int)], ad: &str, alan: &str) -> Result<std::ffi::c_int, String> {
  tablo.iter().find(|(a, _)| *a == ad).map(|(_, d)| *d).ok_or_else(|| {
    let gecerli: Vec<&str> = tablo.iter().map(|(a, _)| *a).collect();
    format!("geçersiz {alan}: {ad} (geçerli: {})", gecerli.join(", "))
  })
}

pub fn ad_bul(tablo: &[(&'static str, std::ffi::c_int)], d: std::ffi::c_int) -> &'static str {
  tablo.iter().find(|(_, x)| *x == d).map(|(a, _)| *a).unwrap_or("?")
}

/// Renk ayarlarının tutarlılığı: HDR renk uzayları (2100) 10 bit biçim ister; 10 bit biçim SDR'de de çalışır (OBS
/// de izin verir). HDR + 8 bit ise libobs sessizce yanlış renk üretir → reddedilir.
pub fn renk_denetimi(bicim: std::ffi::c_int, uzay: std::ffi::c_int) -> Result<(), String> {
  let hdr = uzay == 4 || uzay == 5;
  let on_bit = bicim == 18 || bicim == 17;
  if hdr && !on_bit {
    return Err("HDR renk uzayı (Rec. 2100) 10 bit renk biçimi ister (P010 ya da I010)".into());
  }
  Ok(())
}

pub struct Motor {
  pub(crate) kurulum: ObsKurulumu,
  pub(crate) ana: MotorAyari,
  pub(crate) yuklu_moduller: Vec<String>,
  pub(crate) kanvaslar: BTreeMap<String, Kanvas>,
  pub(crate) sahneler: BTreeMap<String, Sahne>,
  pub(crate) kaynaklar: BTreeMap<String, Ptr>,
  pub(crate) ogeler: BTreeMap<String, Ptr>,
  kodlayicilar: BTreeMap<String, Kodlayici>,
  cikislar: BTreeMap<String, Cikis>,
  pub(crate) durumlar: DurumTablosu,
  pub(crate) olay: Sender<Olay>,
  pub(crate) onizlemeler: HashMap<String, Onizleme>,
  /// Bu oturumda yüklenmeye çalışılan üçüncü taraf eklentiler ve sonuçları
  pub(crate) ucuncu_taraf: Vec<crate::eklenti::EklentiSonucu>,
  /// Tuval → program geçişi (kanal 0'daki geçiş kaynağı)
  pub(crate) gecisler: HashMap<String, crate::gecis::Gecis>,
  /// Tuval → Studio Mode önizleme tuvali
  pub(crate) studyo: HashMap<String, crate::gecis::Studyo>,
  /// Studio Mode "Sahneyi çoğalt": tuval → programdaki özel kopya sahne ve asıl sahnenin kimliği
  pub(crate) program_kopyalari: HashMap<String, (Ptr, String)>,
  pub(crate) filtreler: BTreeMap<String, crate::filtre::Filtre>,
  /// Grup kimliği → sahnesi
  pub(crate) gruplar: BTreeMap<String, String>,
  pub(crate) ses: crate::ses::SesDurumu,
  pub(crate) akislar: HashMap<String, crate::akis::Akis>,
  /// libobs CPU ölçer (`os_cpu_usage_info_t`)
  pub(crate) cpu: Ptr,
  /// Kaynak → etkileşim penceresinin önizleme tuvali (bkz. `etkilesim.rs`)
  pub(crate) etkilesim_tuvalleri: HashMap<String, Kanvas>,
  pub(crate) multiviewler: HashMap<String, crate::multiview::Multiview>,
  pub(crate) kaynak_tuvalleri: HashMap<String, Kanvas>,
  pub(crate) sigdirilmis: HashMap<String, crate::multiview::Sigdirilmis>,
  /// Sanal kameranın görüntü aldığı tuval adı (kaynağı kapanırken kamera önce durdurulur)
  pub(crate) sanal_kamera_kaynagi: Option<String>,
  /// Çıktı → son duraklat/sürdür zamanı (art arda geçişleri aralamak için)
  pub(crate) duraklatma_zamani: HashMap<String, std::time::Instant>,
}

pub(crate) fn video_bilgisi(ayar: MotorAyari, grafik: &std::ffi::CStr) -> VideoInfo {
  VideoInfo {
    graphics_module: grafik.as_ptr(),
    fps_num: ayar.fps,
    fps_den: 1,
    base_width: ayar.genislik,
    base_height: ayar.yukseklik,
    output_width: ayar.cikis_genislik,
    output_height: ayar.cikis_yukseklik,
    output_format: ayar.bicim,
    adapter: 0,
    gpu_conversion: true,
    colorspace: ayar.renk_uzayi,
    range: ayar.aralik,
    scale_type: ayar.olcek,
  }
}

/// Çözünürlük ve kare hızı sınırları (libobs 16K'ya kadar izin verir; biz makul üst sınır koyarız).
pub fn gecerli_boyut(genislik: u32, yukseklik: u32, fps: u32) -> Result<(), String> {
  if !(16..=7680).contains(&genislik) || !(16..=7680).contains(&yukseklik) {
    return Err(format!("geçersiz çözünürlük {genislik}×{yukseklik}"));
  }
  if !genislik.is_multiple_of(2) || !yukseklik.is_multiple_of(2) {
    return Err("çözünürlük çift sayı olmalı (NV12)".into());
  }
  if !(1..=240).contains(&fps) {
    return Err(format!("geçersiz kare hızı {fps}"));
  }
  Ok(())
}

/// Kimlikler protokolden gelir; günlüğe/sinyal adlarına güvenle girebilmeleri için sınırlanır.
pub fn gecerli_kimlik(id: &str) -> Result<(), String> {
  if id.is_empty() || id.len() > 64 || !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.') {
    return Err(format!("geçersiz kimlik: {id:?}"));
  }
  Ok(())
}

/// Yardımcı programlar (`obs-ffmpeg-mux.exe`, `obs-nvenc-test.exe`…) libobs'ta **çalışan exe'nin klasöründe** aranır.
/// Kurulu OBS'ten motorun klasörüne kopyalanır (boyut farklıysa güncellenir); Program Files'a yazılmaz.
fn yardimcilari_hazirla(kurulum: &ObsKurulumu) -> Result<(), String> {
  let hedef = std::env::current_exe()
    .map_err(|e| format!("exe yolu: {e}"))?
    .parent()
    .map(Path::to_path_buf)
    .ok_or("exe klasörü yok")?;
  for ad in ["obs-ffmpeg-mux.exe", "obs-nvenc-test.exe", "obs-amf-test.exe", "obs-qsv-test.exe"] {
    let kaynak = kurulum.bin.join(ad);
    let varis = hedef.join(ad);
    let Ok(km) = std::fs::metadata(&kaynak) else { continue };
    let guncel = std::fs::metadata(&varis).map(|m| m.len() == km.len()).unwrap_or(false);
    if !guncel {
      std::fs::copy(&kaynak, &varis).map_err(|e| format!("{ad} kopyalanamadı: {e}"))?;
    }
  }
  // Yardımcıların DLL bağımlılıkları (avformat…) OBS bin klasöründe
  let yol = std::env::var_os("PATH").unwrap_or_default();
  let mut parcalar = vec![kurulum.bin.clone()];
  parcalar.extend(std::env::split_paths(&yol));
  if let Ok(yeni) = std::env::join_paths(parcalar) {
    std::env::set_var("PATH", yeni);
  }
  Ok(())
}

/// libobs yerel ayarı: kaynak/filtre/geçiş adları ve özellik etiketleri OBS'in kendi çevirilerinden gelir (çevirisi
/// olmayan eklentide libobs en-US metnine düşer). `YAYIN_MOTORU_DIL` ile değiştirilebilir (ör. `en-US`).
fn yerel_ayar() -> String {
  std::env::var("YAYIN_MOTORU_DIL")
    .ok()
    .filter(|d| !d.is_empty() && d.len() <= 16 && d.chars().all(|c| c.is_ascii_alphanumeric() || c == '-'))
    .unwrap_or_else(|| "tr-TR".into())
}

fn ayar_klasoru() -> PathBuf {
  // Yalıtılmış eklenti yoklaması kendi geçici klasörünü verir: sınanan eklentinin yazdığı modül ayarları motorun
  // gerçek ayarlarına karışmaz.
  if let Some(d) = std::env::var_os("YAYIN_MOTORU_AYAR") {
    return PathBuf::from(d);
  }
  std::env::var_os("LOCALAPPDATA")
    .map(PathBuf::from)
    .unwrap_or_else(std::env::temp_dir)
    .join("yayin-motoru")
}

impl Motor {
  /// libobs'u yükler, videoyu/sesi başlatır, kendi servisimizi kaydeder ve temel modülleri yükler.
  pub fn baslat(ana: MotorAyari, olay: Sender<Olay>, gunluk: Box<dyn std::io::Write + Send>) -> Result<Motor, String> {
    gecerli_boyut(ana.genislik, ana.yukseklik, ana.fps)?;
    gecerli_boyut(ana.cikis_genislik, ana.cikis_yukseklik, ana.fps)?;
    renk_denetimi(ana.bicim, ana.renk_uzayi)?;
    if ana.ornekleme != 44_100 && ana.ornekleme != 48_000 {
      return Err(format!("geçersiz örnekleme hızı: {} (44100 ya da 48000)", ana.ornekleme));
    }
    let kurulum = ObsKurulumu::bul()?;
    let a = obs::Api::yukle(&kurulum)?;
    obs::gunlugu_yonlendir(a, gunluk);
    yardimcilari_hazirla(&kurulum)?;
    // libobs efekt dosyalarını çalışma dizinine göre "../../data/libobs/" altında arar
    std::env::set_current_dir(&kurulum.bin).map_err(|e| format!("çalışma dizini: {e}"))?;

    let ayar = ayar_klasoru().join("eklenti-ayarlari");
    std::fs::create_dir_all(&ayar).map_err(|e| format!("ayar klasörü: {e}"))?;
    let ayar_c = cs(&ayar.to_string_lossy().replace('\\', "/"));
    unsafe {
      if !(a.obs_startup)(cs(&yerel_ayar()).as_ptr(), ayar_c.as_ptr(), std::ptr::null_mut()) {
        return Err("obs_startup başarısız".into());
      }
      let mut ovi = video_bilgisi(ana, c"libobs-d3d11");
      let sonuc = (a.obs_reset_video)(&mut ovi);
      if sonuc != obs::OBS_VIDEO_SUCCESS {
        (a.obs_shutdown)();
        return Err(format!("video başlatılamadı (kod {sonuc})"));
      }
      let oai = obs::AudioInfo { samples_per_sec: ana.ornekleme, speakers: ana.hoparlor };
      if !(a.obs_reset_audio)(&oai) {
        (a.obs_shutdown)();
        return Err("ses başlatılamadı".into());
      }
    }
    crate::servis::kaydet();
    crate::onizleme::kaydet();
    crate::ui_gorev::kur();

    let mut motor = Motor {
      kurulum,
      ana,
      yuklu_moduller: Vec::new(),
      kanvaslar: BTreeMap::new(),
      sahneler: BTreeMap::new(),
      kaynaklar: BTreeMap::new(),
      ogeler: BTreeMap::new(),
      kodlayicilar: BTreeMap::new(),
      cikislar: BTreeMap::new(),
      durumlar: Arc::new(Mutex::new(HashMap::new())),
      olay,
      onizlemeler: HashMap::new(),
      ucuncu_taraf: Vec::new(),
      gecisler: HashMap::new(),
      program_kopyalari: HashMap::new(),
      studyo: HashMap::new(),
      filtreler: BTreeMap::new(),
      gruplar: BTreeMap::new(),
      ses: crate::ses::SesDurumu::default(),
      akislar: HashMap::new(),
      cpu: unsafe { (api().os_cpu_usage_info_start)() },
      etkilesim_tuvalleri: HashMap::new(),
      multiviewler: HashMap::new(),
      kaynak_tuvalleri: HashMap::new(),
      sigdirilmis: HashMap::new(),
      sanal_kamera_kaynagi: None,
      duraklatma_zamani: HashMap::new(),
    };
    motor.ses.baslat(motor.olay.clone());
    motor.kanvaslar.insert(
      "ana".into(),
      Kanvas { ptr: std::ptr::null_mut(), genislik: ana.genislik, yukseklik: ana.yukseklik },
    );
    motor.modulleri_yukle(TEMEL_MODULLER)?;
    Ok(motor)
  }

  /// Adı verilen modülleri yükler (zaten yüklüyse atlar). Bulunamayan modül hata değil, rapor edilir.
  pub fn modulleri_yukle(&mut self, adlar: &[&str]) -> Result<Vec<String>, String> {
    let a = api();
    let mut yuklenen = Vec::new();
    for ad in adlar {
      if self.yuklu_moduller.iter().any(|m| m == ad) {
        continue;
      }
      let dll = self.kurulum.eklentiler.join(format!("{ad}.dll"));
      if !dll.is_file() {
        continue;
      }
      let veri = format!("{}/", obs::obs_yolu(&self.kurulum.veri.join("obs-plugins").join(ad).to_string_lossy()));
      let mut modul: Ptr = std::ptr::null_mut();
      let (dll_c, veri_c) = (cs(&obs::obs_yolu(&dll.to_string_lossy())), cs(&veri));
      unsafe {
        if (a.obs_open_module)(&mut modul, dll_c.as_ptr(), veri_c.as_ptr()) != obs::MODULE_SUCCESS || modul.is_null() {
          return Err(format!("modül açılamadı: {ad}"));
        }
        if !(a.obs_init_module)(modul) {
          return Err(format!("modül başlatılamadı: {ad}"));
        }
      }
      // Yalnız bu modülün post_load'u: obs_post_load_modules önceden yüklenenleri de yeniden çağırırdı
      crate::eklenti::modul_post_load(modul);
      self.yuklu_moduller.push((*ad).to_string());
      yuklenen.push((*ad).to_string());
    }
    Ok(yuklenen)
  }

  /// Etkinleştirilmiş üçüncü taraf eklentileri yükler; her biri için sonuç döner (biri başarısız olsa da diğerleri
  /// denenir). `isaret`: yükleme sürerken var olan dosya (çökme teşhisi).
  pub fn eklentileri_yukle(
    &mut self,
    istekler: &[crate::eklenti::EklentiIstegi],
    isaret: Option<&Path>,
  ) -> Vec<crate::eklenti::EklentiSonucu> {
    let mut sonuclar = Vec::new();
    for istek in istekler {
      if self.ucuncu_taraf.iter().any(|s| s.id == istek.id && s.sonuc == "yuklendi") {
        continue;
      }
      let (s, _) = crate::eklenti::yukle(istek, isaret);
      sonuclar.push(s.clone());
      self.ucuncu_taraf.push(s);
    }
    sonuclar
  }

  pub fn ucuncu_taraf(&self) -> &[crate::eklenti::EklentiSonucu] {
    &self.ucuncu_taraf
  }

  pub fn kaynak_ozellikleri(&self, id: &str) -> Result<serde_json::Value, String> {
    let k = *self.kaynaklar.get(id).ok_or_else(|| format!("kaynak yok: {id}"))?;
    crate::eklenti::ozellikler(k)
  }

  pub fn kaynak_guncelle(&self, id: &str, ayarlar: &serde_json::Map<String, serde_json::Value>) -> Result<(), String> {
    let k = *self.kaynaklar.get(id).ok_or_else(|| format!("kaynak yok: {id}"))?;
    crate::eklenti::guncelle(k, ayarlar)
  }

  /// Özellikler › Varsayılanlar: kaynağın tüm ayarlarını türünün varsayılanlarına döndürür
  pub fn kaynak_varsayilanlar(&self, id: &str) -> Result<(), String> {
    let k = *self.kaynaklar.get(id).ok_or_else(|| format!("kaynak yok: {id}"))?;
    unsafe {
      let bos = (api().obs_data_create)();
      (api().obs_source_reset_settings)(k, bos);
      (api().obs_data_release)(bos);
    }
    Ok(())
  }

  /// Etkin video/ses ayarları (panelin gösterdiği ve doğruladığı değerler)
  pub fn video_ayari(&self) -> serde_json::Value {
    let a = self.ana;
    serde_json::json!({
      "taban": [a.genislik, a.yukseklik],
      "cikis": [a.cikis_genislik, a.cikis_yukseklik],
      "fps": a.fps,
      "olcek_filtresi": ad_bul(&OLCEK_FILTRELERI, a.olcek),
      "renk_bicimi": ad_bul(&RENK_BICIMLERI, a.bicim),
      "renk_uzayi": ad_bul(&RENK_UZAYLARI, a.renk_uzayi),
      "renk_araligi": ad_bul(&RENK_ARALIKLARI, a.aralik),
      "ornekleme": a.ornekleme,
      "hoparlor": ad_bul(&HOPARLORLER, a.hoparlor),
    })
  }

  pub fn surum(&self) -> String {
    unsafe { cstr((api().obs_get_version_string)()) }
  }

  pub fn moduller(&self) -> &[String] {
    &self.yuklu_moduller
  }

  /// Kullanılabilir video kodlayıcıları (§39: yalnız gerçekten kayıtlı olanlar; donanımsız NVENC kaydolmaz).
  pub fn video_kodlayicilari(&self) -> Vec<KodlayiciTuru> {
    let a = api();
    let mut liste = Vec::new();
    for i in 0.. {
      let mut id: *const std::ffi::c_char = std::ptr::null();
      if !unsafe { (a.obs_enum_encoder_types)(i, &mut id) } {
        break;
      }
      if unsafe { (a.obs_get_encoder_type)(id) } != obs::OBS_ENCODER_VIDEO {
        continue;
      }
      let kimlik = unsafe { cstr(id) };
      let ad = unsafe { cstr((a.obs_encoder_get_display_name)(id)) };
      let kodek = unsafe { cstr((a.obs_get_encoder_codec)(id)) };
      let donanim = ["nvenc", "amf", "qsv", "texture"].iter().any(|k| kimlik.contains(k));
      // Eski adlar (jim_*, *_cuda, ffmpeg_*nvenc) yeni NVENC kodlayıcısına yönlenir; listede yinelemesin
      let uyumluluk = kimlik.starts_with("jim_") || kimlik.ends_with("_cuda") || kimlik.starts_with("ffmpeg_") && kimlik.contains("nvenc");
      if !uyumluluk {
        liste.push(KodlayiciTuru { id: kimlik, ad, kodek, donanim });
      }
    }
    liste
  }

  pub fn giris_turleri(&self) -> Vec<String> {
    let mut liste = Vec::new();
    for i in 0.. {
      let mut id: *const std::ffi::c_char = std::ptr::null();
      if !unsafe { (api().obs_enum_input_types)(i, &mut id) } {
        break;
      }
      liste.push(unsafe { cstr(id) });
    }
    liste
  }

  /// Ek tuval oluşturur (ör. dikey 1080×1920). Kare hızı ana tuvalinkini izler.
  pub fn tuval_olustur(&mut self, id: &str, ad: &str, genislik: u32, yukseklik: u32) -> Result<(), String> {
    gecerli_kimlik(id)?;
    gecerli_boyut(genislik, yukseklik, self.ana.fps)?;
    if self.kanvaslar.contains_key(id) {
      return Err(format!("tuval zaten var: {id}"));
    }
    let mut ovi = video_bilgisi(self.ana.boyutla(genislik, yukseklik), c"libobs-d3d11");
    let ad_c = cs(ad);
    let ptr = unsafe { (api().obs_canvas_create)(ad_c.as_ptr(), &mut ovi, EK_TUVAL_BAYRAKLARI) };
    if ptr.is_null() {
      return Err(format!("tuval oluşturulamadı: {id}"));
    }
    self.kanvaslar.insert(id.into(), Kanvas { ptr, genislik, yukseklik });
    Ok(())
  }

  /// Ek tuvalin sahne grafiğini boşaltır (panel tuvali silerken): Studio Mode, Multiview ve sanal kamera hedefi
  /// kapanır, geçiş boşaltılır, tuvalin sahneleri silinir. Tuval nesnesi ve kodlayıcıları motor oturumu boyunca kalır
  /// (bağlı çıktılar varken serbest bırakmak güvenli değil); boş tuval siyah kare işler.
  pub fn tuval_bosalt(&mut self, id: &str) -> Result<(), String> {
    if id == "ana" || !self.kanvaslar.contains_key(id) {
      return Err(format!("boşaltılacak ek tuval yok: {id}"));
    }
    if self.studyo.contains_key(id) {
      self.studyo_kapat(id)?;
    }
    self.multiview_kapat(id);
    self.sanal_kamera_tuvali_kapaniyor(id);
    if let Some(g) = self.gecisler.get(id) {
      unsafe {
        (api().obs_transition_force_stop)(g.ptr);
        (api().obs_transition_set)(g.ptr, std::ptr::null_mut());
      }
    }
    Self::kopyayi_birak(self.program_kopyalari.remove(id));
    let sahneler: Vec<String> = self.sahneler.iter().filter(|(_, s)| s.kanvas == id).map(|(k, _)| k.clone()).collect();
    for s in sahneler {
      self.sahne_sil(&s)?;
    }
    Ok(())
  }

  pub fn tuvaller(&self) -> Vec<TuvalBilgisi> {
    self
      .kanvaslar
      .iter()
      .map(|(id, k)| TuvalBilgisi {
        id: id.clone(),
        genislik: k.genislik,
        yukseklik: k.yukseklik,
        ana: k.ptr.is_null(),
        sahneler: self.sahneler.iter().filter(|(_, s)| &s.kanvas == id).map(|(sid, _)| sid.clone()).collect(),
      })
      .collect()
  }

  /// Tuvalin tam çözünürlükte tek karesi PNG dosyasına (OBS "Ekran görüntüsü (Çıkış)"). Dönüş: (genişlik, yükseklik)
  pub fn ekran_goruntusu(&mut self, tuval: &str, yol: &Path) -> Result<(u32, u32), String> {
    if !yol.is_absolute() || yol.extension().and_then(|e| e.to_str()).map(str::to_ascii_lowercase).as_deref() != Some("png") {
      return Err("ekran görüntüsü yolu mutlak ve .png olmalı".into());
    }
    let (video, g, y) = {
      let k = if let Some(t) = tuval.strip_prefix("studyo-") {
        &self.studyo.get(t).ok_or("Studio Mode kapalı")?.kanvas
      } else {
        self.kanvaslar.get(tuval).ok_or_else(|| format!("tuval yok: {tuval}"))?
      };
      (k.video(), k.genislik & !1, k.yukseklik & !1)
    };
    let png = kare_yakala(&format!("ekran-{tuval}"), video, g, y)?;
    std::fs::write(yol, png).map_err(|e| format!("dosya yazılamadı: {e}"))?;
    Ok((g, y))
  }

  /// Tek bir sahnenin ya da kaynağın ekran görüntüsü (OBS sahne/kaynak bağlam menüsü "Ekran görüntüsü"): kaynak kendi
  /// boyutunda (sahne tuvalinin boyutunda) geçici özel bir tuvalde işlenir; programı ve önizlemeyi etkilemez.
  pub fn kaynak_ekran_goruntusu(&mut self, id: &str, yol: &Path) -> Result<(u32, u32), String> {
    if !yol.is_absolute() || yol.extension().and_then(|e| e.to_str()).map(str::to_ascii_lowercase).as_deref() != Some("png") {
      return Err("ekran görüntüsü yolu mutlak ve .png olmalı".into());
    }
    let (kaynak, g, y) = if let Some(s) = self.sahneler.get(id) {
      let k = self.kanvaslar.get(&s.kanvas).ok_or("sahnenin tuvali yok")?;
      (unsafe { (api().obs_scene_get_source)(s.ptr) }, k.genislik, k.yukseklik)
    } else {
      let k = *self.kaynaklar.get(id).ok_or_else(|| format!("kaynak ya da sahne yok: {id}"))?;
      (k, unsafe { (api().obs_source_get_width)(k) }, unsafe { (api().obs_source_get_height)(k) })
    };
    if g == 0 || y == 0 {
      return Err("kaynağın görüntüsü yok (boyutu 0)".into());
    }
    let (g, y) = (g.max(16).div_ceil(2) * 2, y.max(16).div_ceil(2) * 2);
    gecerli_boyut(g, y, self.ana.fps)?;
    let mut ovi = video_bilgisi(self.ana.boyutla(g, y), c"libobs-d3d11");
    let ad = cs(&format!("Ekran görüntüsü ({id})"));
    let tuval = unsafe { (api().obs_canvas_create_private)(ad.as_ptr(), &mut ovi, obs::CANVAS_PREVIEW) };
    if tuval.is_null() {
      return Err("geçici tuval oluşturulamadı".into());
    }
    unsafe { (api().obs_canvas_set_channel)(tuval, 0, kaynak) };
    let video = unsafe { (api().obs_canvas_get_video)(tuval) };
    let sonuc = kare_yakala(&format!("ekran-k-{id}"), video, g, y);
    unsafe {
      (api().obs_canvas_set_channel)(tuval, 0, std::ptr::null_mut());
      (api().obs_canvas_remove)(tuval);
      (api().obs_canvas_release)(tuval);
    }
    std::fs::write(yol, sonuc?).map_err(|e| format!("dosya yazılamadı: {e}"))?;
    Ok((g, y))
  }

  /// Kaynağın deinterlace kipi (0 kapalı, 1 at, 2 retro, 3 karıştır, 4 karıştır 2x, 5 doğrusal, 6 doğrusal 2x,
  /// 7 yadif, 8 yadif 2x) ve alan sırası (0 üst, 1 alt) — OBS "Deinterlacing" (yakalama kartları)
  pub fn kaynak_deinterlace(&mut self, id: &str, kip: i32, alan: i32) -> Result<(), String> {
    let k = *self.kaynaklar.get(id).ok_or_else(|| format!("kaynak yok: {id}"))?;
    if !(0..=8).contains(&kip) || !(0..=1).contains(&alan) {
      return Err("deinterlace kipi 0–8, alan sırası 0–1 olmalı".into());
    }
    unsafe {
      (api().obs_source_set_deinterlace_mode)(k, kip);
      (api().obs_source_set_deinterlace_field_order)(k, alan);
    }
    Ok(())
  }

  pub fn kaynak_deinterlace_oku(&self, id: &str) -> Result<(i32, i32), String> {
    let k = *self.kaynaklar.get(id).ok_or_else(|| format!("kaynak yok: {id}"))?;
    Ok(unsafe { ((api().obs_source_get_deinterlace_mode)(k), (api().obs_source_get_deinterlace_field_order)(k)) })
  }

  /// Tuvalin son önizleme karesi (PNG). İlk istekte bağlanır ve `None` döner (kare hazırlanıyor).
  pub fn onizleme_png(&mut self, tuval: &str, en_fazla: u32) -> Result<Option<Vec<u8>>, String> {
    self.bosta_onizlemeleri_kapat();
    if !self.onizlemeler.contains_key(tuval) {
      let k = if let Some(t) = tuval.strip_prefix("studyo-") {
        &self.studyo.get(t).ok_or("Studio Mode kapalı")?.kanvas
      } else if let Some(k) = tuval.strip_prefix(crate::etkilesim::ONEK) {
        self.etkilesim_tuvalleri.get(k).ok_or("etkileşim penceresi açık değil")?
      } else if let Some(k) = tuval.strip_prefix(crate::multiview::ONEK) {
        &self.multiviewler.get(k).ok_or("multiview açık değil")?.kanvas
      } else if let Some(k) = tuval.strip_prefix(crate::multiview::KAYNAK_ONEK) {
        self.kaynak_tuvalleri.get(k).ok_or("projektör tuvali açık değil")?
      } else if let Some(k) = tuval.strip_prefix(crate::multiview::SIGDIR_ONEK) {
        &self.sigdirilmis.get(k).ok_or("sanal kamera kaynak tuvali açık değil")?.kanvas
      } else {
        self.kanvaslar.get(tuval).ok_or_else(|| format!("tuval yok: {tuval}"))?
      };
      let o = Onizleme::baglan(&format!("onizleme-{tuval}"), k.video(), k.genislik, k.yukseklik, en_fazla)?;
      self.onizlemeler.insert(tuval.into(), o);
      return Ok(None);
    }
    self.onizlemeler.get_mut(tuval).map_or(Ok(None), Onizleme::png)
  }

  /// İstenmeyen önizlemeleri keser (dönüşüm maliyeti yalnız izlenirken ödensin).
  pub fn bosta_onizlemeleri_kapat(&mut self) {
    // Canlı akışı açık tuvallerin önizlemesi boşta sayılmaz
    let akislar = &self.akislar;
    self.onizlemeler.retain(|t, o| akislar.contains_key(t) || !o.bosta());
  }

  /// Tuvale bağlı sahne oluşturur; tuvalin ilk sahnesiyse etkinleştirir.
  pub fn sahne_olustur(&mut self, id: &str, kanvas: &str, ad: &str) -> Result<(), String> {
    gecerli_kimlik(id)?;
    if self.sahneler.contains_key(id) {
      return Err(format!("sahne zaten var: {id}"));
    }
    let k = self.kanvaslar.get(kanvas).ok_or_else(|| format!("tuval yok: {kanvas}"))?;
    let ad_c = cs(ad);
    let ptr = unsafe {
      if k.ptr.is_null() {
        (api().obs_scene_create)(ad_c.as_ptr())
      } else {
        (api().obs_canvas_scene_create)(k.ptr, ad_c.as_ptr())
      }
    };
    if ptr.is_null() {
      return Err(format!("sahne oluşturulamadı: {id}"));
    }
    let ilk = !self.sahneler.values().any(|s| s.kanvas == kanvas);
    self.sahneler.insert(id.into(), Sahne { ptr, kanvas: kanvas.into() });
    if ilk {
      self.sahne_etkinlestir(id)?;
    }
    Ok(())
  }

  /// Sahneyi kendi tuvalinin programına alır (ana tuvalde `obs_set_output_source`, ek tuvalde kanal 0).
  /// Kanal 0 artık sahne değil tuvalin geçişidir (bkz. `gecis.rs`); bu işlev kesmeyle (anında) geçer.
  pub fn sahne_etkinlestir(&mut self, id: &str) -> Result<(), String> {
    self.sahneye_gec(id, false, None)
  }

  /// Küresel kaynak oluşturur (`color_source`, `ffmpeg_source`, `text_gdiplus`, `image_source`…).
  pub fn kaynak_olustur(&mut self, id: &str, tur: &str, ad: &str, ayarlar: &serde_json::Map<String, serde_json::Value>) -> Result<(), String> {
    gecerli_kimlik(id)?;
    if self.kaynaklar.contains_key(id) {
      return Err(format!("kaynak zaten var: {id}"));
    }
    let veri = Veri::yeni().json(ayarlar);
    let (tur_c, ad_c) = (cs(tur), cs(ad));
    let ptr = unsafe { (api().obs_source_create)(tur_c.as_ptr(), ad_c.as_ptr(), veri.0, std::ptr::null_mut()) };
    if ptr.is_null() {
      return Err(format!("kaynak oluşturulamadı: {tur} (modül yüklü mü?)"));
    }
    self.kaynaklar.insert(id.into(), ptr);
    self.olcer_bagla(id);
    Ok(())
  }

  /// Kaynağı tüm sahnelerden çıkarır ve serbest bırakır.
  pub fn kaynak_sil(&mut self, id: &str) -> Result<(), String> {
    self.etkilesim_kapat(id);
    self.kaynak_tuvali_kapat(id);
    self.sigdirilmis_kapat(id);
    if !self.kaynaklar.contains_key(id) {
      return Err(format!("kaynak yok: {id}"));
    }
    self.olcer_birak(id);
    self.kaynak_filtrelerini_birak(Some(id));
    let k = self.kaynaklar.remove(id).unwrap();
    let ogeler: Vec<String> = self.ogeler.keys().filter(|o| crate::sahne::oge_kaynagi(o) == id).cloned().collect();
    for o in ogeler {
      if let Some(p) = self.ogeler.remove(&o) {
        unsafe { (api().obs_sceneitem_remove)(p) };
      }
    }
    unsafe {
      (api().obs_source_remove)(k);
      (api().obs_source_release)(k);
    }
    Ok(())
  }

  fn oge_bilgisi(&self, p: Ptr, ust: Option<String>) -> Option<OgeBilgisi> {
    let (oge_id, _) = self.ogeler.iter().find(|(_, v)| **v == p)?;
    let a = api();
    let (mut konum, mut olcek, mut sinir) = (Vec2::default(), Vec2::default(), Vec2::default());
    let mut kirp = obs::Kirp::default();
    unsafe {
      (a.obs_sceneitem_get_pos)(p, &mut konum);
      (a.obs_sceneitem_get_scale)(p, &mut olcek);
      (a.obs_sceneitem_get_bounds)(p, &mut sinir);
      (a.obs_sceneitem_get_crop)(p, &mut kirp);
      let sinir_turu = (a.obs_sceneitem_get_bounds_type)(p);
      let kaynak = (a.obs_sceneitem_get_source)(p);
      Some(OgeBilgisi {
        oge: oge_id.clone(),
        kaynak: crate::sahne::oge_kaynagi(oge_id).to_string(),
        konum: [konum.x, konum.y],
        olcek: [olcek.x, olcek.y],
        sinir: (sinir_turu != 0).then_some([sinir.x, sinir.y]),
        gorunur: (a.obs_sceneitem_visible)(p),
        aci: (a.obs_sceneitem_get_rot)(p),
        hizalama: (a.obs_sceneitem_get_alignment)(p),
        sinir_turu,
        sinir_hizalama: (a.obs_sceneitem_get_bounds_alignment)(p),
        kirp: [kirp.sol, kirp.ust, kirp.sag, kirp.alt],
        kilit: (a.obs_sceneitem_locked)(p),
        olcek_filtresi: (a.obs_sceneitem_get_scale_filter)(p),
        karistirma: (a.obs_sceneitem_get_blending_mode)(p),
        karistirma_yontemi: (a.obs_sceneitem_get_blending_method)(p),
        genislik: (a.obs_source_get_width)(kaynak),
        yukseklik: (a.obs_source_get_height)(kaynak),
        grup: (a.obs_sceneitem_is_group)(p),
        ust,
      })
    }
  }

  /// Sahnedeki öğeler alttan üste (libobs sırası); grup çocukları grubun hemen ardından (`ust` dolu).
  /// Yalnız bu motorun oluşturduğu öğeler.
  pub fn sahne_ogeleri(&self, sahne: &str) -> Result<Vec<OgeBilgisi>, String> {
    let s = self.sahneler.get(sahne).ok_or_else(|| format!("sahne yok: {sahne}"))?;
    let mut liste = Vec::new();
    for p in crate::sahne::sahne_ogeleri_ham(s.ptr) {
      let Some(o) = self.oge_bilgisi(p, None) else { continue };
      let grup = o.grup.then(|| o.oge.clone());
      liste.push(o);
      if let Some(g) = grup {
        for c in crate::sahne::grup_ogeleri_ham(p) {
          if let Some(co) = self.oge_bilgisi(c, Some(g.clone())) {
            liste.push(co);
          }
        }
      }
    }
    Ok(liste)
  }

  /// Öğe sırası: `yukari`, `asagi`, `en_ust`, `en_alt`.
  pub fn oge_sira(&mut self, oge: &str, yon: &str) -> Result<(), String> {
    let p = *self.ogeler.get(oge).ok_or_else(|| format!("öğe yok: {oge}"))?;
    let hareket = match yon {
      "yukari" => 0,
      "asagi" => 1,
      "en_ust" => 2,
      "en_alt" => 3,
      _ => return Err(format!("geçersiz yön: {yon}")),
    };
    unsafe { (api().obs_sceneitem_set_order)(p, hareket) };
    Ok(())
  }

  /// Öğeyi bulunduğu listede (sahne ya da grup) `konum`a taşır: 0 = en alt.
  pub fn oge_sira_konumu(&mut self, oge: &str, konum: usize) -> Result<(), String> {
    let p = *self.ogeler.get(oge).ok_or_else(|| format!("öğe yok: {oge}"))?;
    unsafe { (api().obs_sceneitem_set_order_position)(p, konum.min(10_000) as i32) };
    Ok(())
  }

  /// Sahne grafiğini (Studio Mode, sahneler, gruplar, kaynaklar, filtreler, ölçerler) temizler; tuvaller, geçişler,
  /// kodlayıcılar ve çıktılar kalır. Sahne koleksiyonu değiştirilirken kullanılır: çıktılar sürüyorsa yeni koleksiyon
  /// kurulana dek program boş kare verir.
  pub fn sahne_grafigini_temizle(&mut self) {
    let a = api();
    self.etkilesimleri_kapat();
    self.multiviewleri_kapat();
    self.kaynak_tuvallerini_kapat();
    let tuvaller: Vec<String> = self.studyo.keys().cloned().collect();
    for t in tuvaller {
      let _ = self.studyo_kapat(&t);
    }
    for g in self.gecisler.values() {
      unsafe {
        (a.obs_transition_force_stop)(g.ptr);
        (a.obs_transition_set)(g.ptr, std::ptr::null_mut());
      }
    }
    for (_, k) in std::mem::take(&mut self.program_kopyalari) {
      Self::kopyayi_birak(Some(k));
    }
    let ids: Vec<String> = self.kaynaklar.keys().cloned().collect();
    for id in &ids {
      self.olcer_birak(id);
    }
    self.kaynak_filtrelerini_birak(None);
    self.gruplar.clear();
    self.ogeler.clear();
    for (_, s) in std::mem::take(&mut self.sahneler) {
      unsafe {
        (a.obs_source_remove)((a.obs_scene_get_source)(s.ptr));
        (a.obs_scene_release)(s.ptr);
      }
    }
    for (_, k) in std::mem::take(&mut self.kaynaklar) {
      unsafe {
        (a.obs_source_remove)(k);
        (a.obs_source_release)(k);
      }
    }
  }

  /// Öğeyi yalnız o sahneden kaldırır (kaynak başka sahnelerde yaşamaya devam eder).
  pub fn oge_kaldir(&mut self, oge: &str) -> Result<(), String> {
    let p = *self.ogeler.get(oge).ok_or_else(|| format!("öğe yok: {oge}"))?;
    // Grup kaldırılınca çocukları da gider: eşlemeden önce düşürülür (işaretçileri geçersizleşir)
    if unsafe { (api().obs_sceneitem_is_group)(p) } {
      for c in crate::sahne::grup_ogeleri_ham(p) {
        if let Some(id) = self.ogeler.iter().find(|(_, v)| **v == c).map(|(k, _)| k.clone()) {
          self.ogeler.remove(&id);
        }
      }
      self.gruplar.remove(crate::sahne::oge_kaynagi(oge));
    }
    self.ogeler.remove(oge);
    unsafe { (api().obs_sceneitem_remove)(p) };
    Ok(())
  }

  /// Kaynağın ses izleri (bit maskesi, 6 iz: 0x01–0x3F).
  pub fn kaynak_izleri(&mut self, id: &str, maske: u32) -> Result<(), String> {
    let k = *self.kaynaklar.get(id).ok_or_else(|| format!("kaynak yok: {id}"))?;
    if maske > 0x3F {
      return Err("iz maskesi 0–63 olmalı (6 iz)".into());
    }
    unsafe { (api().obs_source_set_audio_mixers)(k, maske) };
    Ok(())
  }

  pub fn kaynak_izleri_oku(&self, id: &str) -> Option<u32> {
    self.kaynaklar.get(id).map(|k| unsafe { (api().obs_source_get_audio_mixers)(*k) })
  }

  /// Bir kaynak türünün liste özelliğinin seçenekleri (ör. kamera `video_device_id`, pencere `window`,
  /// ekran `monitor_id`). Yalnız okur; kaynak oluşturmaz.
  pub fn ozellik_secenekleri(&self, tur: &str, ozellik: &str) -> Result<Vec<Secenek>, String> {
    let a = api();
    let (tur_c, oz_c) = (cs(tur), cs(ozellik));
    let props = unsafe { (a.obs_get_source_properties)(tur_c.as_ptr()) };
    if props.is_null() {
      return Err(format!("kaynak türü yok ya da özelliği yok: {tur}"));
    }
    let sonuc = unsafe {
      let p = (a.obs_properties_get)(props, oz_c.as_ptr());
      if p.is_null() {
        Err(format!("özellik yok: {ozellik}"))
      } else {
        let bicim = (a.obs_property_list_format)(p);
        let mut v = Vec::new();
        for i in 0..(a.obs_property_list_item_count)(p).min(500) {
          let ad = cstr((a.obs_property_list_item_name)(p, i));
          let deger = match bicim {
            obs::OBS_COMBO_FORMAT_STRING => serde_json::Value::String(cstr((a.obs_property_list_item_string)(p, i))),
            obs::OBS_COMBO_FORMAT_INT => serde_json::Value::from((a.obs_property_list_item_int)(p, i)),
            _ => continue,
          };
          v.push(Secenek { ad, deger });
        }
        Ok(v)
      }
    };
    unsafe { (a.obs_properties_destroy)(props) };
    sonuc
  }

  pub fn kaynak_listesi(&self) -> Vec<String> {
    self.kaynaklar.keys().cloned().collect()
  }

  /// Kaynak durumları. `bekliyor`: görüntü kaynağı ama boyutu 0 (oyun/pencere henüz bulunmadı, kamera yok, sayfa
  /// yüklenmedi). Ses aygıtının takılı olup olmadığını libobs genel olarak bildirmez → ses kaynağı için `hazir`
  /// yalnız "oluşturuldu" demektir.
  pub fn kaynak_durumlari(&self) -> Vec<KaynakDurumu> {
    let a = api();
    self
      .kaynaklar
      .iter()
      .map(|(id, &k)| unsafe {
        let bayrak = (a.obs_source_get_output_flags)(k);
        let (g, y) = ((a.obs_source_get_width)(k), (a.obs_source_get_height)(k));
        let goruntu = bayrak & obs::OBS_SOURCE_VIDEO != 0;
        KaynakDurumu {
          id: id.clone(),
          tur: cstr((a.obs_source_get_id)(k)),
          ad: cstr((a.obs_source_get_name)(k)),
          genislik: g,
          yukseklik: y,
          goruntu,
          ses: bayrak & obs::OBS_SOURCE_AUDIO != 0,
          etkin: (a.obs_source_active)(k),
          gorunuyor: (a.obs_source_showing)(k),
          durum: if goruntu && (g == 0 || y == 0) { "bekliyor" } else { "hazir" },
          etkilesim: bayrak & obs::OBS_SOURCE_INTERACTION != 0,
        }
      })
      .collect()
  }

  pub fn kaynak_sessiz(&mut self, id: &str, sessiz: bool) -> Result<(), String> {
    let k = *self.kaynaklar.get(id).ok_or_else(|| format!("kaynak yok: {id}"))?;
    unsafe { (api().obs_source_set_muted)(k, sessiz) };
    Ok(())
  }

  pub fn kaynak_ses_seviyesi(&mut self, id: &str, carpan: f32) -> Result<(), String> {
    let k = *self.kaynaklar.get(id).ok_or_else(|| format!("kaynak yok: {id}"))?;
    if !(0.0..=4.0).contains(&carpan) {
      return Err("ses çarpanı 0–4 aralığında olmalı".into());
    }
    unsafe { (api().obs_source_set_volume)(k, carpan) };
    Ok(())
  }

  /// Kaynağı sahneye ekler ve dönüşümü uygular. Öğe kimliği `sahne/kaynak`.
  pub fn sahneye_ekle(&mut self, sahne: &str, kaynak: &str, donusum: &Donusum) -> Result<String, String> {
    if sahne == kaynak {
      return Err("sahne kendi içine eklenemez".into());
    }
    let s = self.sahneler.get(sahne).ok_or_else(|| format!("sahne yok: {sahne}"))?.ptr;
    // Kaynak ya da başka bir sahne (sahne kaynağı)
    let k = self.kaynak_ya_da_sahne(kaynak).ok_or_else(|| format!("kaynak yok: {kaynak}"))?;
    let oge = unsafe { (api().obs_scene_add)(s, k) };
    if oge.is_null() {
      return Err("kaynak sahneye eklenemedi (iç içe sahne döngüsü olabilir)".into());
    }
    let oge_id = self.yeni_oge_kimligi(sahne, kaynak);
    self.ogeler.insert(oge_id.clone(), oge);
    self.donustur(&oge_id, donusum)?;
    Ok(oge_id)
  }

  pub fn donustur(&mut self, oge_id: &str, d: &Donusum) -> Result<(), String> {
    let oge = *self.ogeler.get(oge_id).ok_or_else(|| format!("öğe yok: {oge_id}"))?;
    let a = api();
    unsafe {
      if let Some(p) = d.konum {
        (a.obs_sceneitem_set_pos)(oge, &p);
      }
      if let Some(o) = d.olcek {
        (a.obs_sceneitem_set_scale)(oge, &o);
      }
      if let Some(sinir) = d.sinir {
        (a.obs_sceneitem_set_bounds_type)(oge, d.sinir_turu.unwrap_or(obs::OBS_BOUNDS_SCALE_INNER));
        (a.obs_sceneitem_set_bounds)(oge, &sinir);
      } else if let Some(t) = d.sinir_turu {
        (a.obs_sceneitem_set_bounds_type)(oge, t.clamp(0, 6));
      }
      if let Some(h) = d.hizalama {
        (a.obs_sceneitem_set_alignment)(oge, h & 0xF);
      }
      if let Some(h) = d.sinir_hizalama {
        (a.obs_sceneitem_set_bounds_alignment)(oge, h & 0xF);
      }
      if let Some(k) = d.kirp {
        (a.obs_sceneitem_set_crop)(oge, &k);
      }
      if let Some(k) = d.kilit {
        (a.obs_sceneitem_set_locked)(oge, k);
      }
      if let Some(f) = d.olcek_filtresi {
        (a.obs_sceneitem_set_scale_filter)(oge, f.clamp(0, 6));
      }
      if let Some(y) = d.karistirma_yontemi {
        (a.obs_sceneitem_set_blending_method)(oge, y.clamp(0, 1));
      }
      if let Some(b) = d.karistirma {
        (a.obs_sceneitem_set_blending_mode)(oge, b.clamp(0, 6));
      }
      if let Some(aci) = d.aci {
        (a.obs_sceneitem_set_rot)(oge, aci);
      }
      if let Some(g) = d.gorunur {
        (a.obs_sceneitem_set_visible)(oge, g);
      }
    }
    Ok(())
  }

  /// Tuvale bağlı video kodlayıcı. `tur` "otomatik" ise önce NVENC H.264, yoksa x264.
  pub fn video_kodlayici(&mut self, id: &str, tur: &str, kanvas: &str, ayar: &KodlayiciAyari) -> Result<String, String> {
    self.video_kodlayici_ek(id, tur, kanvas, ayar, &serde_json::Map::new())
  }

  /// `ek`: Uzman kipte kullanıcının verdiği kodlayıcı ayarları (libobs anahtarlarıyla); temel ayarların üzerine yazılır.
  pub fn video_kodlayici_ek(
    &mut self,
    id: &str,
    tur: &str,
    kanvas: &str,
    ayar: &KodlayiciAyari,
    ek: &serde_json::Map<String, serde_json::Value>,
  ) -> Result<String, String> {
    gecerli_kimlik(id)?;
    if self.kodlayicilar.contains_key(id) {
      return Err(format!("kodlayıcı zaten var: {id}"));
    }
    let video = self.kanvaslar.get(kanvas).ok_or_else(|| format!("tuval yok: {kanvas}"))?.video();
    let turler = self.video_kodlayicilari();
    let secilen = if tur == "otomatik" {
      ["obs_nvenc_h264_tex", "obs_x264"]
        .into_iter()
        .find(|t| turler.iter().any(|k| k.id == *t))
        .ok_or("kullanılabilir H.264 kodlayıcı yok")?
        .to_string()
    } else if turler.iter().any(|k| k.id == tur) {
      tur.to_string()
    } else {
      return Err(format!("kodlayıcı bu sistemde yok: {tur}"));
    };
    let mut veri = Veri::yeni()
      .yazi("rate_control", "CBR")
      .tamsayi("bitrate", ayar.bit_hizi_kbps as i64)
      .tamsayi("keyint_sec", ayar.anahtar_kare_sn as i64)
      .yazi("profile", "high");
    veri = if secilen.contains("nvenc") {
      veri.yazi("preset", "p5").yazi("tune", "hq").tamsayi("bf", 2)
    } else {
      veri.yazi("preset", "veryfast")
    };
    veri = veri.json(ek);
    let (tur_c, ad_c) = (cs(&secilen), cs(id));
    let ptr = unsafe { (api().obs_video_encoder_create)(tur_c.as_ptr(), ad_c.as_ptr(), veri.0, std::ptr::null_mut()) };
    if ptr.is_null() {
      return Err(format!("kodlayıcı oluşturulamadı: {secilen}"));
    }
    unsafe { (api().obs_encoder_set_video)(ptr, video) };
    self.kodlayicilar.insert(id.into(), Kodlayici { ptr });
    Ok(secilen)
  }

  /// AAC ses kodlayıcı; `iz` libobs karıştırıcı dizini (0–5).
  pub fn ses_kodlayici(&mut self, id: &str, bit_hizi_kbps: u32, iz: usize) -> Result<(), String> {
    gecerli_kimlik(id)?;
    if iz > 5 {
      return Err("ses izi 0–5 olmalı".into());
    }
    let veri = Veri::yeni().tamsayi("bitrate", bit_hizi_kbps as i64);
    let ad_c = cs(id);
    let ptr = unsafe {
      (api().obs_audio_encoder_create)(c"ffmpeg_aac".as_ptr(), ad_c.as_ptr(), veri.0, iz, std::ptr::null_mut())
    };
    if ptr.is_null() {
      return Err("AAC kodlayıcı oluşturulamadı".into());
    }
    unsafe { (api().obs_encoder_set_audio)(ptr, (api().obs_get_audio)()) };
    self.kodlayicilar.insert(id.into(), Kodlayici { ptr });
    Ok(())
  }

  /// Kodlayıcıyı bırakır (ayar değişince yeniden kurulsun diye). Etkin (bir çıktı kullanıyor) kodlayıcı bırakılmaz;
  /// kullanan çıktılar önce silinmelidir.
  pub fn kodlayici_sil(&mut self, id: &str) -> Result<(), String> {
    let k = self.kodlayicilar.get(id).ok_or_else(|| format!("kodlayıcı yok: {id}"))?;
    if unsafe { (api().obs_encoder_active)(k.ptr) } {
      return Err("kodlayıcı kullanımda (etkin çıktı var)".into());
    }
    let k = self.kodlayicilar.remove(id).unwrap();
    unsafe { (api().obs_encoder_release)(k.ptr) };
    Ok(())
  }

  fn kodlayici(&self, id: &str) -> Result<Ptr, String> {
    self.kodlayicilar.get(id).map(|k| k.ptr).ok_or_else(|| format!("kodlayıcı yok: {id}"))
  }

  /// RTMP/RTMPS hedefi. Anahtar yalnız servis nesnesinde tutulur; günlüğe ve yanıtlara yazılmaz.
  pub fn rtmp_cikisi(&mut self, id: &str, sunucu: &str, anahtar: &str, video: &str, ses: &str, ag: &AgAyari) -> Result<(), String> {
    gecerli_kimlik(id)?;
    ag.denetle()?;
    let s = sunucu.trim().to_ascii_lowercase();
    if !(s.starts_with("rtmp://") || s.starts_with("rtmps://")) {
      return Err("sunucu rtmp:// ya da rtmps:// ile başlamalı".into());
    }
    let (v, a) = (self.kodlayici(video)?, self.kodlayici(ses)?);
    let ayar = Veri::yeni().yazi("server", sunucu.trim()).yazi("key", anahtar);
    let ad_c = cs(id);
    let servis = unsafe { (api().obs_service_create)(crate::servis::SERVIS_ID.as_ptr(), ad_c.as_ptr(), ayar.0, std::ptr::null_mut()) };
    if servis.is_null() {
      return Err("servis oluşturulamadı".into());
    }
    drop(ayar);
    // obs-outputs rtmp-stream ayar anahtarları (OBS Ayarlar > Gelişmiş > Ağ)
    let cikis_ayari = Veri::yeni()
      .yazi("bind_ip", &ag.bagla_ip)
      .yazi("ip_family", &ag.ip_ailesi)
      .mantiksal("new_socket_loop_enabled", ag.yeni_soket_dongusu)
      .mantiksal("low_latency_mode_enabled", ag.dusuk_gecikme)
      .mantiksal("dyn_bitrate", ag.dinamik_bit_hizi);
    let ptr = unsafe { (api().obs_output_create)(c"rtmp_output".as_ptr(), ad_c.as_ptr(), cikis_ayari.0, std::ptr::null_mut()) };
    if ptr.is_null() {
      unsafe { (api().obs_service_release)(servis) };
      return Err("RTMP çıktısı oluşturulamadı (obs-outputs yüklü mü?)".into());
    }
    unsafe {
      (api().obs_output_set_service)(ptr, servis);
      (api().obs_output_set_video_encoder)(ptr, v);
      (api().obs_output_set_audio_encoder)(ptr, a, 0);
      // OBS: en çok deneme 0 = yeniden bağlanma kapalı
      let (deneme, gecikme) = if ag.yeniden_baglan { (ag.en_cok_deneme, ag.deneme_gecikmesi_sn) } else { (0, 0) };
      (api().obs_output_set_reconnect_settings)(ptr, deneme as std::ffi::c_int, gecikme as std::ffi::c_int);
    }
    self.cikis_ekle(id, ptr, servis, "rtmp");
    Ok(())
  }

  /// Kayıt çıktısı; yayın kodlayıcısını paylaşabilir (§52). `bicim` (bkz. [`KAYIT_BICIMLERI`]) verilmezse uzantıdan
  /// (mkv/mp4/mov). Birden çok ses kodlayıcısı = çok izli kayıt (sırası dosyadaki ses akışı sırası).
  pub fn kayit_cikisi(&mut self, id: &str, yol: &Path, bicim: Option<&str>, video: &str, sesler: &[&str]) -> Result<(), String> {
    self.kayit_cikisi_bolmeli(id, yol, bicim, video, sesler, &KayitBolme::default())
  }

  /// Kayıt çıktısı + bölme (OBS "Otomatik dosya bölme"): süre/boyut sınırında ya da elle (`kayit_bol`) yeni dosyaya
  /// geçer. Yeni dosyalar ilk dosyanın klasöründe, ilk dosya adı + tarih-saat biçimiyle adlanır. Bölme her zaman
  /// etkinleştirilir (sınırlar 0 ise yalnız elle bölünür); OBS'in muxer'ı zaman damgalarını her dosyada sıfırlar.
  pub fn kayit_cikisi_bolmeli(&mut self, id: &str, yol: &Path, bicim: Option<&str>, video: &str, sesler: &[&str], bolme: &KayitBolme) -> Result<(), String> {
    gecerli_kimlik(id)?;
    if bolme.sure_sn > 24 * 3600 || bolme.boyut_mb > 1024 * 1024 {
      return Err("bölme sınırı: en çok 24 saat / 1 TB".into());
    }
    if !yol.is_absolute() {
      return Err("kayıt yolu mutlak olmalı".into());
    }
    if sesler.len() > 6 {
      return Err("en çok 6 ses izi kaydedilebilir".into());
    }
    let uzanti = yol.extension().and_then(|e| e.to_str()).map(str::to_ascii_lowercase).unwrap_or_default();
    let b = kayit_bicimi(bicim.unwrap_or(&uzanti))?;
    if b.uzanti != uzanti {
      return Err(format!("'{}' biçimi .{} uzantısı ister", b.ad, b.uzanti));
    }
    if !crate::eklenti::kayitli_turler("cikis").iter().any(|t| t == b.cikis) {
      return Err(format!("bu OBS sürümünde '{}' kayıt biçimi yok ({} çıktısı kayıtlı değil)", b.ad, b.cikis));
    }
    let v = self.kodlayici(video)?;
    let klasor = yol.parent().map(|p| p.to_string_lossy().into_owned()).unwrap_or_default();
    let govde = yol.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_else(|| "Kayit".into());
    let mut ayar = Veri::yeni()
      .yazi("path", &yol.to_string_lossy())
      .yazi("directory", &klasor)
      .yazi("format", &format!("{} %CCYY-%MM-%DD %hh-%mm-%ss", govde.replace('%', "%%")))
      .yazi("extension", b.uzanti)
      .mantiksal("allow_spaces", true)
      .mantiksal("allow_overwrite", false)
      .mantiksal("split_file", true)
      .mantiksal("reset_timestamps", true)
      .tamsayi("max_time_sec", bolme.sure_sn as i64)
      .tamsayi("max_size_mb", bolme.boyut_mb as i64);
    if !b.muxer.is_empty() {
      ayar = ayar.yazi("muxer_settings", b.muxer);
    }
    let (ad_c, tur_c) = (cs(id), cs(b.cikis));
    let ptr = unsafe { (api().obs_output_create)(tur_c.as_ptr(), ad_c.as_ptr(), ayar.0, std::ptr::null_mut()) };
    if ptr.is_null() {
      return Err("kayıt çıktısı oluşturulamadı (obs-ffmpeg yüklü mü?)".into());
    }
    unsafe { (api().obs_output_set_video_encoder)(ptr, v) };
    for (i, s) in sesler.iter().enumerate() {
      let a = self.kodlayici(s)?;
      unsafe { (api().obs_output_set_audio_encoder)(ptr, a, i) };
    }
    self.cikis_ekle(id, ptr, std::ptr::null_mut(), "kayit");
    Ok(())
  }

  /// Tekrar arabelleği (`replay_buffer`): son `sure_sn` saniye bellekte tutulur, `tekrar_kaydet` diske yazar.
  /// Kodlayıcıları yayınla paylaşabilir.
  pub fn tekrar_cikisi(&mut self, id: &str, klasor: &Path, sure_sn: u32, video: &str, sesler: &[&str]) -> Result<(), String> {
    gecerli_kimlik(id)?;
    if !klasor.is_absolute() {
      return Err("tekrar klasörü mutlak olmalı".into());
    }
    if !(5..=600).contains(&sure_sn) {
      return Err("tekrar süresi 5–600 sn olmalı".into());
    }
    let v = self.kodlayici(video)?;
    let ayar = Veri::yeni()
      .yazi("directory", &klasor.to_string_lossy())
      .yazi("format", "Tekrar %CCYY-%MM-%DD %hh-%mm-%ss")
      .yazi("extension", "mkv")
      .mantiksal("allow_spaces", true)
      .tamsayi("max_time_sec", sure_sn as i64)
      .tamsayi("max_size_mb", 1024);
    let ad_c = cs(id);
    let ptr = unsafe { (api().obs_output_create)(c"replay_buffer".as_ptr(), ad_c.as_ptr(), ayar.0, std::ptr::null_mut()) };
    if ptr.is_null() {
      return Err("tekrar arabelleği oluşturulamadı (obs-ffmpeg yüklü mü?)".into());
    }
    unsafe { (api().obs_output_set_video_encoder)(ptr, v) };
    for (i, s) in sesler.iter().enumerate() {
      let a = self.kodlayici(s)?;
      unsafe { (api().obs_output_set_audio_encoder)(ptr, a, i) };
    }
    self.cikis_ekle(id, ptr, std::ptr::null_mut(), "tekrar");
    Ok(())
  }

  /// Tekrar arabelleğini diske yazar ve dosya yolunu döndürür (en çok 8 sn bekler).
  pub fn tekrar_kaydet(&mut self, id: &str) -> Result<String, String> {
    let c = self.cikislar.get(id).ok_or_else(|| format!("çıktı yok: {id}"))?;
    if c.tur != "tekrar" {
      return Err("bu çıktı tekrar arabelleği değil".into());
    }
    if !unsafe { (api().obs_output_active)(c.ptr) } {
      return Err("tekrar arabelleği çalışmıyor".into());
    }
    let ph = unsafe { (api().obs_output_get_proc_handler)(c.ptr) };
    let son_yol = |ph: Ptr| -> String {
      let mut cd = obs::Calldata::bos();
      let mut p: *const std::ffi::c_char = std::ptr::null();
      unsafe {
        (api().proc_handler_call)(ph, c"get_last_replay".as_ptr(), &mut cd);
        (api().calldata_get_string)(&cd, c"path".as_ptr(), &mut p);
        cstr(p)
      }
    };
    let once = son_yol(ph);
    let mut cd = obs::Calldata::bos();
    unsafe { (api().proc_handler_call)(ph, c"save".as_ptr(), &mut cd) };
    let bitis = std::time::Instant::now() + std::time::Duration::from_secs(8);
    while std::time::Instant::now() < bitis {
      // Yol birkaç adımda güncellenir (UI görevi); dosya gerçekten oluşunca dönülür
      let yol = son_yol(ph);
      if !yol.is_empty() && yol != once && Path::new(&yol).is_file() {
        return Ok(yol);
      }
      std::thread::sleep(std::time::Duration::from_millis(100));
    }
    Err("tekrar kaydedilemedi (8 sn içinde dosya oluşmadı)".into())
  }

  fn kayit_ptr(&self, id: &str) -> Result<Ptr, String> {
    let c = self.cikislar.get(id).ok_or_else(|| format!("çıktı yok: {id}"))?;
    if c.tur != "kayit" {
      return Err("bu çıktı kayıt değil".into());
    }
    if !unsafe { (api().obs_output_active)(c.ptr) } {
      return Err("kayıt çalışmıyor".into());
    }
    Ok(c.ptr)
  }

  /// Kaydı duraklatır / sürdürür (OBS "Duraklat"). Kodlayıcı ya da biçim desteklemiyorsa hata döner.
  pub fn kayit_duraklat(&mut self, id: &str, duraklat: bool) -> Result<bool, String> {
    let p = self.kayit_ptr(id)?;
    let a = api();
    unsafe {
      if !(a.obs_output_can_pause)(p) {
        return Err("bu kayıt duraklatılamaz (kodlayıcı/biçim desteklemiyor)".into());
      }
      // libobs duraklatmayı kodlayıcıda uygular: kodlayıcı başka bir etkin çıktıyla (yayın) paylaşılıyorsa o da
      // duraklardı. OBS de bu durumda duraklatmaya izin vermez → kayıt ayrı kodlayıcıyla kurulmalı.
      if duraklat && self.kodlayici_paylasiliyor(id) {
        return Err("kayıt yayınla aynı kodlayıcıyı paylaşıyor; duraklatma yayını da durdururdu (kayda ayrı kodlayıcı gerekir)".into());
      }
      if (a.obs_output_paused)(p) == duraklat {
        return Ok(duraklat);
      }
      // Art arda geçişler libobs'un kayıt hattını kilitliyor (gözlendi: sürdürmenin hemen ardından duraklatınca
      // bölme ve durdurma yanıt vermez). Önceki geçişten bu yana en az ARALIK geçmeden yenisi yapılmaz; erken gelen
      // istek kalan süreyi bekler ve tek bir çağrı yapılır.
      const ARALIK: std::time::Duration = std::time::Duration::from_millis(600);
      if let Some(t) = self.duraklatma_zamani.get(id) {
        let gecen = t.elapsed();
        if gecen < ARALIK {
          std::thread::sleep(ARALIK - gecen);
        }
      }
      let oldu = (a.obs_output_pause)(p, duraklat);
      self.duraklatma_zamani.insert(id.to_string(), std::time::Instant::now());
      if !oldu {
        return Err(if duraklat { "kayıt duraklatılamadı" } else { "kayıt sürdürülemedi" }.into());
      }
      Ok((a.obs_output_paused)(p))
    }
  }

  /// Çıktının kodlayıcılarından biri başka bir etkin çıktı tarafından da kullanılıyor mu
  pub(crate) fn kodlayici_paylasiliyor(&self, id: &str) -> bool {
    let a = api();
    let kodlayicilar = |p: Ptr| -> Vec<Ptr> {
      let mut v = vec![unsafe { (a.obs_output_get_video_encoder)(p) }];
      for i in 0..6 {
        v.push(unsafe { (a.obs_output_get_audio_encoder)(p, i) });
      }
      v.retain(|x| !x.is_null());
      v
    };
    let Some(c) = self.cikislar.get(id) else { return false };
    let bizim = kodlayicilar(c.ptr);
    self
      .cikislar
      .iter()
      .filter(|(k, o)| *k != id && unsafe { (a.obs_output_active)(o.ptr) })
      .any(|(_, o)| kodlayicilar(o.ptr).iter().any(|x| bizim.contains(x)))
  }

  /// Kaydı yeni dosyaya böler (OBS "Kayıt dosyasını böl"); yeni dosya bir sonraki anahtar karede başlar.
  pub fn kayit_bol(&mut self, id: &str) -> Result<(), String> {
    let p = self.kayit_ptr(id)?;
    let ph = unsafe { (api().obs_output_get_proc_handler)(p) };
    let mut cd = obs::Calldata::bos();
    let cagrildi = unsafe { (api().proc_handler_call)(ph, c"split_file".as_ptr(), &mut cd) };
    if !cagrildi {
      return Err("bu kayıt biçimi elle bölmeyi desteklemiyor".into());
    }
    let mut etkin = true;
    // calldata_get_bool başlıkta satır içi; dışa aktarılan calldata_get_data ile 1 bayt okunur
    unsafe { (api().calldata_get_data)(&cd, c"split_file_enabled".as_ptr(), &mut etkin as *mut bool as Ptr, std::mem::size_of::<bool>()) };
    if !etkin {
      return Err("kayıtta bölme etkin değil".into());
    }
    Ok(())
  }

  pub(crate) fn cikislar_var(&self, id: &str) -> bool {
    self.cikislar.contains_key(id)
  }

  /// Servissiz çıktıyı durum/istatistik tablosuna kaydeder (sanal kamera vb.)
  pub(crate) fn cikis_kaydet(&mut self, id: &str, ptr: Ptr, tur: &'static str) {
    self.cikis_ekle(id, ptr, std::ptr::null_mut(), tur);
  }

  fn cikis_ekle(&mut self, id: &str, ptr: Ptr, servis: Ptr, tur: &'static str) {
    let baglam = Box::into_raw(Box::new(CikisBaglami {
      id: id.into(),
      durumlar: Arc::clone(&self.durumlar),
      olay: self.olay.clone(),
    }));
    unsafe {
      let sh = (api().obs_output_get_signal_handler)(ptr);
      for (ad, cb) in SINYALLER.iter().zip(SINYAL_CB) {
        (api().signal_handler_connect)(sh, cs(ad).as_ptr(), cb, baglam as Ptr);
      }
    }
    self.durumlar.lock().unwrap().insert(id.into(), (CikisDurumu::Hazir, None));
    self.cikislar.insert(id.into(), Cikis { ptr, servis, tur, baglam });
  }

  pub fn cikis_baslat(&mut self, id: &str) -> Result<(), String> {
    let c = self.cikislar.get(id).ok_or_else(|| format!("çıktı yok: {id}"))?;
    if unsafe { (api().obs_output_active)(c.ptr) } {
      return Ok(());
    }
    // Kayıt çıktısı alt süreç başlatır; açık RTMP soketlerini devralmasın (bkz. obs::soketleri_devralinamaz_yap)
    obs::soketleri_devralinamaz_yap();
    if !unsafe { (api().obs_output_start)(c.ptr) } {
      let hata = unsafe { cstr((api().obs_output_get_last_error)(c.ptr)) };
      self.durumlar.lock().unwrap().insert(id.into(), (CikisDurumu::Basarisiz, None));
      return Err(if hata.is_empty() { format!("çıktı başlatılamadı: {id}") } else { obs::gizle(&hata) });
    }
    Ok(())
  }

  /// Tek çıktıyı durdurur; diğerleri ve paylaşılan kodlayıcı çalışmayı sürdürür.
  pub fn cikis_durdur(&mut self, id: &str) -> Result<(), String> {
    let c = self.cikislar.get(id).ok_or_else(|| format!("çıktı yok: {id}"))?;
    unsafe { (api().obs_output_stop)(c.ptr) };
    Ok(())
  }

  /// Çıktıyı siler (etkinse önce durdurur). Kodlayıcılar ve diğer çıktılar etkilenmez.
  pub fn cikis_sil(&mut self, id: &str) -> Result<(), String> {
    let c = self.cikislar.remove(id).ok_or_else(|| format!("çıktı yok: {id}"))?;
    let a = api();
    unsafe {
      if (a.obs_output_active)(c.ptr) {
        (a.obs_output_stop)(c.ptr);
        let son = std::time::Instant::now() + std::time::Duration::from_secs(5);
        while (a.obs_output_active)(c.ptr) && std::time::Instant::now() < son {
          std::thread::sleep(std::time::Duration::from_millis(20));
        }
        if (a.obs_output_active)(c.ptr) {
          (a.obs_output_force_stop)(c.ptr);
        }
      }
      let sh = (a.obs_output_get_signal_handler)(c.ptr);
      for (ad, cb) in SINYALLER.iter().zip(SINYAL_CB) {
        (a.signal_handler_disconnect)(sh, cs(ad).as_ptr(), cb, c.baglam as Ptr);
      }
      (a.obs_output_release)(c.ptr);
      if !c.servis.is_null() {
        (a.obs_service_release)(c.servis);
      }
      drop(Box::from_raw(c.baglam));
    }
    self.durumlar.lock().unwrap().remove(id);
    Ok(())
  }

  pub fn cikis_etkin(&self, id: &str) -> bool {
    self.cikislar.get(id).is_some_and(|c| unsafe { (api().obs_output_active)(c.ptr) })
  }

  /// Araçlar › Altyazı (OBS "Captions"): metin CEA-608 altyazısı olarak etkin yayın çıktılarının (verilmişse yalnız
  /// `hedefler`in) video paketlerine gömülür (libobs `obs_output_output_caption_text2`; H.264/HEVC). Konuşma tanıma
  /// yoktur — metin panelden, kısayoldan ya da otomasyondan gelir. Dönüş: altyazının gittiği çıktılar.
  pub fn altyazi_gonder(&self, metin: &str, sure_sn: f64, hedefler: &[String]) -> Result<Vec<String>, String> {
    let metin = cea608_metni(metin);
    if metin.is_empty() {
      return Err("altyazı metni boş".into());
    }
    if !(0.5..=30.0).contains(&sure_sn) {
      return Err("altyazı süresi 0,5–30 sn olmalı".into());
    }
    let c = cs(&metin);
    let mut giden: Vec<String> = Vec::new();
    for (id, cikis) in &self.cikislar {
      if cikis.tur != "rtmp" || (!hedefler.is_empty() && !hedefler.contains(id)) {
        continue;
      }
      if unsafe { (api().obs_output_active)(cikis.ptr) } {
        unsafe { (api().obs_output_output_caption_text2)(cikis.ptr, c.as_ptr(), sure_sn) };
        giden.push(id.clone());
      }
    }
    if giden.is_empty() {
      return Err("altyazının gideceği etkin yayın yok".into());
    }
    giden.sort();
    Ok(giden)
  }

  pub fn cikis_durumu(&self, id: &str) -> Option<CikisDurumu> {
    self.durumlar.lock().unwrap().get(id).map(|d| d.0)
  }

  pub fn istatistik(&self) -> Istatistik {
    let a = api();
    let durumlar = self.durumlar.lock().unwrap().clone();
    let cikislar = self
      .cikislar
      .iter()
      .map(|(id, c)| unsafe {
        let hata = cstr((a.obs_output_get_last_error)(c.ptr));
        let (durum, son_kod) = durumlar.get(id).copied().unwrap_or((CikisDurumu::Hazir, None));
        CikisIstatistigi {
          id: id.clone(),
          tur: c.tur,
          durum,
          etkin: (a.obs_output_active)(c.ptr),
          yeniden_baglaniyor: (a.obs_output_reconnecting)(c.ptr),
          bayt: (a.obs_output_get_total_bytes)(c.ptr),
          kare: (a.obs_output_get_total_frames)(c.ptr) as i64,
          dusen_kare: (a.obs_output_get_frames_dropped)(c.ptr) as i64,
          baglanti_ms: (a.obs_output_get_connect_time_ms)(c.ptr) as i64,
          duraklatildi: c.tur == "kayit" && (a.obs_output_paused)(c.ptr),
          son_hata: (!hata.is_empty()).then(|| obs::gizle(&hata)),
          son_kod,
        }
      })
      .collect();
    unsafe {
      Istatistik {
        fps: (a.obs_get_active_fps)(),
        ortalama_kare_ms: (a.obs_get_average_frame_time_ns)() as f64 / 1e6,
        toplam_kare: (a.obs_get_total_frames)(),
        geciken_kare: (a.obs_get_lagged_frames)(),
        atlanan_kare: (a.video_output_get_skipped_frames)((a.obs_get_video)()),
        video_kare: (a.video_output_get_total_frames)((a.obs_get_video)()),
        cpu: if self.cpu.is_null() { 0.0 } else { (a.os_cpu_usage_info_query)(self.cpu) },
        bellek_mb: (a.os_get_proc_resident_size)() as f64 / 1_048_576.0,
        cikislar,
      }
    }
  }

  /// Her şeyi ters sırada serbest bırakır ve libobs'u kapatır.
  pub fn kapat(mut self) {
    self.etkilesimleri_kapat();
    self.multiviewleri_kapat();
    self.kaynak_tuvallerini_kapat();
    let a = api();
    // Akışlar ve ses ölçerleri önce: iş parçacıkları libobs nesnelerine dokunmayı bıraksın
    self.akislari_kapat();
    self.sesi_kapat();
    self.onizlemeler.clear();
    let ids: Vec<String> = self.cikislar.keys().cloned().collect();
    for id in &ids {
      if let Some(c) = self.cikislar.get(id) {
        unsafe { (a.obs_output_stop)(c.ptr) };
      }
    }
    // Zarif durma için kısa bekleme; hâlâ etkinse zorla
    let son = std::time::Instant::now() + std::time::Duration::from_secs(5);
    while std::time::Instant::now() < son && ids.iter().any(|id| self.cikis_etkin(id)) {
      std::thread::sleep(std::time::Duration::from_millis(50));
    }
    for (_, c) in std::mem::take(&mut self.cikislar) {
      unsafe {
        if (a.obs_output_active)(c.ptr) {
          (a.obs_output_force_stop)(c.ptr);
        }
        let sh = (a.obs_output_get_signal_handler)(c.ptr);
        for (ad, cb) in SINYALLER.iter().zip(SINYAL_CB) {
          (a.signal_handler_disconnect)(sh, cs(ad).as_ptr(), cb, c.baglam as Ptr);
        }
        (a.obs_output_release)(c.ptr);
        if !c.servis.is_null() {
          (a.obs_service_release)(c.servis);
        }
        drop(Box::from_raw(c.baglam));
      }
    }
    for (_, k) in std::mem::take(&mut self.kodlayicilar) {
      unsafe { (a.obs_encoder_release)(k.ptr) };
    }
    self.gecisleri_kapat();
    unsafe { (a.obs_set_output_source)(0, std::ptr::null_mut()) };
    self.kaynak_filtrelerini_birak(None);
    self.gruplar.clear();
    let ek_tuvaller: Vec<Ptr> =
      std::mem::take(&mut self.kanvaslar).into_values().map(|k| k.ptr).filter(|p| !p.is_null()).collect();
    for &k in &ek_tuvaller {
      unsafe { (a.obs_canvas_set_channel)(k, 0, std::ptr::null_mut()) };
    }
    self.ogeler.clear();
    // Tuvaller (ana tuval dahil, SCENE_REF) sahnelere kendi referansını tutar: önce `remove` ile tuvalden çıkar,
    // sonra kendi referansımızı bırak. Yoksa obs_shutdown aynı sahneyi ikinci kez yok eder ("double destroy").
    for (_, s) in std::mem::take(&mut self.sahneler) {
      unsafe {
        (a.obs_source_remove)((a.obs_scene_get_source)(s.ptr));
        (a.obs_scene_release)(s.ptr);
      }
    }
    for (_, k) in std::mem::take(&mut self.kaynaklar) {
      unsafe {
        (a.obs_source_remove)(k);
        (a.obs_source_release)(k);
      }
    }
    // Tuvaller en son: sahneleri tuvale bağlı; `remove` tuvalin tuttuğu referansları bırakır
    for k in ek_tuvaller {
      unsafe {
        (a.obs_canvas_remove)(k);
        (a.obs_canvas_release)(k);
      }
    }
    if !self.cpu.is_null() {
      unsafe { (a.os_cpu_usage_info_destroy)(self.cpu) };
    }
    unsafe { (a.obs_shutdown)() };
  }
}

/// Sahne öğesi dönüşümü (tüm alanlar isteğe bağlı).
#[derive(Clone, Copy, Debug, Default)]
pub struct Donusum {
  pub konum: Option<Vec2>,
  pub olcek: Option<Vec2>,
  pub sinir: Option<Vec2>,
  pub aci: Option<f32>,
  pub gorunur: Option<bool>,
  pub hizalama: Option<u32>,
  /// Verilmezse ve `sinir` varsa içe sığdır (2); 0 sınırı kaldırır
  pub sinir_turu: Option<i32>,
  pub sinir_hizalama: Option<u32>,
  pub kirp: Option<obs::Kirp>,
  pub kilit: Option<bool>,
  pub olcek_filtresi: Option<i32>,
  pub karistirma: Option<i32>,
  pub karistirma_yontemi: Option<i32>,
}

#[derive(Clone, Copy, Debug)]
pub struct KodlayiciAyari {
  pub bit_hizi_kbps: u32,
  pub anahtar_kare_sn: u32,
}

// ─── Sinyaller ───────────────────────────────────────────────────────────

/// Sinyal adından yeni durum. "stop" kodu 0 ise temiz durma, değilse başarısızlık.
pub fn sinyal_durumu(sinyal: &str, kod: Option<i64>) -> Option<CikisDurumu> {
  Some(match sinyal {
    "starting" => CikisDurumu::Baglaniyor,
    "start" | "reconnect_success" => CikisDurumu::Canli,
    "reconnect" => CikisDurumu::YenidenBaglaniyor,
    "stopping" => CikisDurumu::Durduruluyor,
    "stop" if kod.unwrap_or(0) == 0 => CikisDurumu::Durduruldu,
    "stop" => CikisDurumu::Basarisiz,
    _ => return None,
  })
}

/// Önceki duruma göre geçiş. libobs sinyalleri farklı iş parçacıklarından gelir ve sıraları her zaman korunmaz:
/// `ffmpeg_muxer`'da `start`, `starting`'den ÖNCE gözlendi. Bu yüzden canlı bir çıktı "bağlanıyor"a, durmuş bir çıktı
/// "durduruluyor"a geri düşmez.
pub fn gecis(onceki: CikisDurumu, sinyal: &str, kod: Option<i64>) -> Option<CikisDurumu> {
  use CikisDurumu::*;
  let yeni = sinyal_durumu(sinyal, kod)?;
  let geri_dusme = match yeni {
    Baglaniyor => matches!(onceki, Canli | YenidenBaglaniyor),
    Durduruluyor => matches!(onceki, Durduruldu | Basarisiz),
    _ => false,
  };
  (!geri_dusme && yeni != onceki).then_some(yeni)
}

unsafe fn sinyal_isle(sinyal: &str, veri: Ptr, cd: *mut obs::Calldata) {
  let Some(b) = (veri as *const CikisBaglami).as_ref() else { return };
  let kod = if sinyal == "stop" { obs::calldata_int(cd, "code") } else { None };
  let Ok(mut d) = b.durumlar.lock() else { return };
  let onceki = d.get(&b.id).map_or(CikisDurumu::Hazir, |x| x.0);
  if let Some(durum) = gecis(onceki, sinyal, kod) {
    d.insert(b.id.clone(), (durum, kod));
    // Olay kilit altında gönderilir: olay sırası durum sırasıyla aynı kalır
    let _ = b.olay.send(Olay::Cikis { id: b.id.clone(), durum, kod });
  }
}

macro_rules! sinyal_fn {
  ($ad:ident, $sinyal:literal) => {
    unsafe extern "C" fn $ad(veri: Ptr, cd: *mut obs::Calldata) {
      sinyal_isle($sinyal, veri, cd);
    }
  };
}
sinyal_fn!(sinyal_starting, "starting");
sinyal_fn!(sinyal_start, "start");
sinyal_fn!(sinyal_stopping, "stopping");
sinyal_fn!(sinyal_stop, "stop");
sinyal_fn!(sinyal_reconnect, "reconnect");
sinyal_fn!(sinyal_reconnect_success, "reconnect_success");

const SINYAL_CB: [obs::SignalCb; 6] =
  [sinyal_starting, sinyal_start, sinyal_stopping, sinyal_stop, sinyal_reconnect, sinyal_reconnect_success];



/// Kayıt bölme sınırları (0 = o sınır kapalı; ikisi de 0 ise yalnız elle bölünür)
#[derive(Clone, Debug, Default, PartialEq, serde::Deserialize)]
#[serde(default)]
pub struct KayitBolme {
  pub sure_sn: u32,
  pub boyut_mb: u32,
}

/// RTMP çıktısının ağ ayarları (OBS Ayarlar > Gelişmiş > Ağ ve Yeniden bağlanma). Varsayılanlar OBS'inkiler.
#[derive(Clone, Debug, PartialEq, serde::Deserialize)]
#[serde(default)]
pub struct AgAyari {
  /// "default" ya da yerel bir IP adresi
  pub bagla_ip: String,
  /// "IPv4+IPv6", "IPv4", "IPv6"
  pub ip_ailesi: String,
  pub yeni_soket_dongusu: bool,
  pub dusuk_gecikme: bool,
  pub dinamik_bit_hizi: bool,
  pub yeniden_baglan: bool,
  pub deneme_gecikmesi_sn: u32,
  pub en_cok_deneme: u32,
}

impl Default for AgAyari {
  fn default() -> Self {
    AgAyari {
      bagla_ip: "default".into(),
      ip_ailesi: "IPv4+IPv6".into(),
      yeni_soket_dongusu: false,
      dusuk_gecikme: false,
      dinamik_bit_hizi: false,
      yeniden_baglan: true,
      deneme_gecikmesi_sn: 2,
      en_cok_deneme: 25,
    }
  }
}

impl AgAyari {
  pub fn denetle(&self) -> Result<(), String> {
    if self.bagla_ip != "default" && self.bagla_ip.parse::<std::net::IpAddr>().is_err() {
      return Err(format!("geçersiz bağlanılacak IP: {}", self.bagla_ip));
    }
    if !["IPv4+IPv6", "IPv4", "IPv6"].contains(&self.ip_ailesi.as_str()) {
      return Err(format!("geçersiz IP ailesi: {}", self.ip_ailesi));
    }
    if !(1..=30).contains(&self.deneme_gecikmesi_sn) || self.en_cok_deneme > 10_000 {
      return Err("yeniden bağlanma: gecikme 1–30 sn, en çok deneme 0–10000".into());
    }
    Ok(())
  }
}

/// Videodan tek kare PNG (en çok 3 sn bekler); geçici önizleme çıktısı sonra kapanır
fn kare_yakala(ad: &str, video: Ptr, g: u32, y: u32) -> Result<Vec<u8>, String> {
  let mut o = Onizleme::baglan_boyutlu(ad, video, g, y)?;
  let bitis = std::time::Instant::now() + std::time::Duration::from_secs(3);
  loop {
    if let Some(b) = o.png()? {
      return Ok(b);
    }
    if std::time::Instant::now() > bitis {
      return Err("kare alınamadı".into());
    }
    std::thread::sleep(std::time::Duration::from_millis(40));
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn sinyaller_durum_makinesine_eslenir() {
    assert_eq!(sinyal_durumu("starting", None), Some(CikisDurumu::Baglaniyor));
    assert_eq!(sinyal_durumu("start", None), Some(CikisDurumu::Canli));
    assert_eq!(sinyal_durumu("reconnect", None), Some(CikisDurumu::YenidenBaglaniyor));
    assert_eq!(sinyal_durumu("reconnect_success", None), Some(CikisDurumu::Canli));
    assert_eq!(sinyal_durumu("stop", Some(0)), Some(CikisDurumu::Durduruldu));
    assert_eq!(sinyal_durumu("stop", Some(-2)), Some(CikisDurumu::Basarisiz), "bağlanamadı");
    assert_eq!(sinyal_durumu("stop", Some(-5)), Some(CikisDurumu::Basarisiz), "bağlantı koptu");
    assert_eq!(sinyal_durumu("activate", None), None);
  }

  #[test]
  fn ters_sirali_sinyaller_geriye_dusurmez() {
    use CikisDurumu::*;
    // ffmpeg_muxer: start → starting (gözlenen sıra)
    assert_eq!(gecis(Hazir, "start", None), Some(Canli));
    assert_eq!(gecis(Canli, "starting", None), None);
    // yeniden bağlanırken gelen gecikmiş "starting" de yok sayılır
    assert_eq!(gecis(YenidenBaglaniyor, "starting", None), None);
    // durduktan sonra gelen gecikmiş "stopping"
    assert_eq!(gecis(Durduruldu, "stopping", None), None);
    // olağan akış ve yeniden başlatma
    assert_eq!(gecis(Durduruldu, "starting", None), Some(Baglaniyor));
    assert_eq!(gecis(Baglaniyor, "start", None), Some(Canli));
    assert_eq!(gecis(Canli, "reconnect", None), Some(YenidenBaglaniyor));
    assert_eq!(gecis(YenidenBaglaniyor, "reconnect_success", None), Some(Canli));
    assert_eq!(gecis(Canli, "stop", Some(-5)), Some(Basarisiz));
    // aynı duruma tekrar geçiş olay üretmez
    assert_eq!(gecis(Canli, "start", None), None);
  }

  #[test]
  fn boyut_ve_kimlik_dogrulamasi() {
    assert!(gecerli_boyut(1920, 1080, 60).is_ok());
    assert!(gecerli_boyut(1080, 1920, 30).is_ok());
    assert!(gecerli_boyut(1921, 1080, 60).is_err(), "NV12 çift boyut ister");
    assert!(gecerli_boyut(0, 1080, 60).is_err());
    assert!(gecerli_boyut(1920, 1080, 0).is_err());
    assert!(gecerli_kimlik("twitch-1").is_ok());
    assert!(gecerli_kimlik("").is_err());
    assert!(gecerli_kimlik("a b").is_err());
    assert!(gecerli_kimlik("../x").is_err());
  }

  #[test]
  fn olay_json_bicimi() {
    let o = Olay::Cikis { id: "twitch".into(), durum: CikisDurumu::YenidenBaglaniyor, kod: None };
    assert_eq!(serde_json::to_string(&o).unwrap(), r#"{"olay":"cikis","id":"twitch","durum":"yeniden_baglaniyor"}"#);
  }
}

/// CEA-608 karakter kümesinde olmayan Türkçe harfler en yakın Latin harfine çevrilir (ç, ö, ü kümede var); satır sonu ve
/// denetim karakterleri boşluk olur; en çok 128 bayt (libobs altyazı satırını `CAPTION_LINE_BYTES` = 128 baytta keser;
/// karakter ortasından kesilmesin diye sınır burada uygulanır).
pub fn cea608_metni(s: &str) -> String {
  let d: String = s
    .chars()
    .map(|c| match c {
      'ş' => 's',
      'Ş' => 'S',
      'ğ' => 'g',
      'Ğ' => 'G',
      'ı' => 'i',
      'İ' => 'I',
      c if c.is_control() => ' ',
      c => c,
    })
    .collect();
  let mut sonuc = String::new();
  for c in d.split_whitespace().collect::<Vec<_>>().join(" ").chars() {
    if sonuc.len() + c.len_utf8() > 128 {
      break;
    }
    sonuc.push(c);
  }
  sonuc
}

#[cfg(test)]
mod altyazi_testleri {
  #[test]
  fn cea608_metni_turkce_ve_sinir() {
    assert_eq!(super::cea608_metni("  Şimdi\nyağmur  ılık; İyi geceler "), "Simdi yagmur ilik; Iyi geceler");
    assert_eq!(super::cea608_metni("çöü ÇÖÜ"), "çöü ÇÖÜ");
    assert_eq!(super::cea608_metni(&"a".repeat(300)).len(), 128);
    assert_eq!(super::cea608_metni(&"ç".repeat(100)).len(), 128, "çok baytlı karakter bölünmez");
    assert_eq!(super::cea608_metni("\u{0}\t"), "");
  }
}
