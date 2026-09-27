//! Tuval önizlemesi: motorun kendi ham video çıktı türü (`yym_onizleme`) → küçük RGBA kare → PNG.
//!
//! Neden çıktı türü: libobs ham kareyi CPU'ya yalnız karışımın `raw_active` sayacı artmışsa indirir. Bu sayacı artıran
//! `start_raw_video` iç fonksiyondur (dışa aktarılmaz); `obs_add_raw_video_callback2` ise yalnız ana tuvali kapsar.
//! Ham video çıktısı başlatıldığında libobs sayacı çıktının bağlı olduğu tuval karışımı için kendisi artırır — böylece
//! aynı kod ana ve ek (dikey) tuvalde çalışır.
//!
//! Yalnız istenirken çalışır; `BOSTA_MS` boyunca istek gelmezse durdurulur. Dönüşüm (küçük boyuta RGBA) libobs'un
//! video iş parçacığında yapılır; kodlayıcılar GPU dokusundan beslendiği için yayın yolu etkilenmez.

use std::ffi::{c_char, c_int};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use crate::obs::{self, api, cs, Ptr, Veri};

pub const BOSTA_MS: u128 = 10_000;
const CIKIS_ID: &std::ffi::CStr = c"yym_onizleme";

#[repr(C)]
pub struct VideoScaleInfo {
  format: c_int,
  width: u32,
  height: u32,
  range: c_int,
  colorspace: c_int,
}

#[repr(C)]
pub struct VideoData {
  data: [*mut u8; 8],
  linesize: [u32; 8],
  timestamp: u64,
}

/// `struct obs_output_info` (obs-output.h, OBS 32.2.2) — alan sırası başlıkla aynı.
#[repr(C)]
pub struct OutputInfo {
  id: *const c_char,
  flags: u32,
  get_name: Option<unsafe extern "C" fn(Ptr) -> *const c_char>,
  create: Option<unsafe extern "C" fn(settings: Ptr, output: Ptr) -> Ptr>,
  destroy: Option<unsafe extern "C" fn(Ptr)>,
  start: Option<unsafe extern "C" fn(Ptr) -> bool>,
  stop: Option<unsafe extern "C" fn(Ptr, u64)>,
  raw_video: Option<unsafe extern "C" fn(Ptr, *mut VideoData)>,
  raw_audio: Option<unsafe extern "C" fn(Ptr, Ptr)>,
  encoded_packet: Option<unsafe extern "C" fn(Ptr, Ptr)>,
  update: Option<unsafe extern "C" fn(Ptr, Ptr)>,
  get_defaults: Option<unsafe extern "C" fn(Ptr)>,
  get_properties: Option<unsafe extern "C" fn(Ptr) -> Ptr>,
  unused1: Option<unsafe extern "C" fn(Ptr)>,
  get_total_bytes: Option<unsafe extern "C" fn(Ptr) -> u64>,
  get_dropped_frames: Option<unsafe extern "C" fn(Ptr) -> c_int>,
  type_data: Ptr,
  free_type_data: Option<unsafe extern "C" fn(Ptr)>,
  get_congestion: Option<unsafe extern "C" fn(Ptr) -> f32>,
  get_connect_time_ms: Option<unsafe extern "C" fn(Ptr) -> c_int>,
  encoded_video_codecs: *const c_char,
  encoded_audio_codecs: *const c_char,
  raw_audio2: Option<unsafe extern "C" fn(Ptr, usize, Ptr)>,
  protocols: *const c_char,
}

const OBS_OUTPUT_VIDEO: u32 = 1;
const VIDEO_FORMAT_RGBA: c_int = 6;
const VIDEO_RANGE_FULL: c_int = 2;

#[derive(Default)]
pub(crate) struct Kare {
  pub(crate) genislik: u32,
  pub(crate) yukseklik: u32,
  pub(crate) rgba: Vec<u8>,
  pub(crate) zaman: Option<Instant>,
  /// İki kopya arası en az süre (ms): tek kare isteğinde 250, canlı akışta kare hızına göre
  pub(crate) aralik_ms: u32,
}

/// Çıktı örneğinin verisi (libobs `create` ile döner, `destroy` ile serbest bırakılır).
struct CiktiVerisi {
  cikti: Ptr,
  kare: *const Mutex<Kare>,
}

unsafe extern "C" fn ad(_: Ptr) -> *const c_char {
  c"Yayın Motoru önizleme".as_ptr()
}

unsafe extern "C" fn olustur(ayarlar: Ptr, cikti: Ptr) -> Ptr {
  let adres = obs::cstr((api().obs_data_get_string)(ayarlar, cs("baglam").as_ptr()));
  let kare = usize::from_str_radix(&adres, 16).unwrap_or(0) as *const Mutex<Kare>;
  if kare.is_null() {
    return std::ptr::null_mut();
  }
  Box::into_raw(Box::new(CiktiVerisi { cikti, kare })) as Ptr
}

unsafe extern "C" fn yok_et(veri: Ptr) {
  if !veri.is_null() {
    drop(Box::from_raw(veri as *mut CiktiVerisi));
  }
}

unsafe extern "C" fn baslat(veri: Ptr) -> bool {
  let Some(v) = (veri as *const CiktiVerisi).as_ref() else { return false };
  (api().obs_output_begin_data_capture)(v.cikti, 0)
}

unsafe extern "C" fn durdur(veri: Ptr, _ts: u64) {
  if let Some(v) = (veri as *const CiktiVerisi).as_ref() {
    (api().obs_output_end_data_capture)(v.cikti);
  }
}

unsafe extern "C" fn ham_kare(veri: Ptr, kare: *mut VideoData) {
  let (Some(v), Some(k)) = ((veri as *const CiktiVerisi).as_ref(), kare.as_ref()) else { return };
  let Some(hedef) = v.kare.as_ref() else { return };
  let Ok(mut h) = hedef.lock() else { return };
  // Yarım kare hızı yeter: ikide bir kareyi kopyala
  if h.zaman.is_some_and(|z| z.elapsed().as_millis() < h.aralik_ms.max(30) as u128) {
    return;
  }
  let (g, y) = (h.genislik as usize, h.yukseklik as usize);
  let satir = k.linesize[0] as usize;
  if k.data[0].is_null() || satir < g * 4 {
    return;
  }
  h.rgba.resize(g * y * 4, 0);
  for r in 0..y {
    let kaynak = std::slice::from_raw_parts(k.data[0].add(r * satir), g * 4);
    h.rgba[r * g * 4..(r + 1) * g * 4].copy_from_slice(kaynak);
  }
  h.zaman = Some(Instant::now());
}

/// Çıktı türünü libobs'a kaydeder (`obs_startup`'tan sonra bir kez).
pub fn kaydet() {
  let bilgi = OutputInfo {
    id: CIKIS_ID.as_ptr(),
    flags: OBS_OUTPUT_VIDEO,
    get_name: Some(ad),
    create: Some(olustur),
    destroy: Some(yok_et),
    start: Some(baslat),
    stop: Some(durdur),
    raw_video: Some(ham_kare),
    raw_audio: None,
    encoded_packet: None,
    update: None,
    get_defaults: None,
    get_properties: None,
    unused1: None,
    get_total_bytes: None,
    get_dropped_frames: None,
    type_data: std::ptr::null_mut(),
    free_type_data: None,
    get_congestion: None,
    get_connect_time_ms: None,
    encoded_video_codecs: std::ptr::null(),
    encoded_audio_codecs: std::ptr::null(),
    raw_audio2: None,
    protocols: std::ptr::null(),
  };
  unsafe { (api().obs_register_output_s)(&bilgi as *const OutputInfo as Ptr, std::mem::size_of::<OutputInfo>()) };
}

pub struct Onizleme {
  cikti: Ptr,
  genislik: u32,
  yukseklik: u32,
  kare: Arc<Mutex<Kare>>,
  /// `olustur` geri çağrısına verilen gösterici (Arc'ın bir referansı); çıktı bırakıldıktan sonra geri alınır
  ham: *const Mutex<Kare>,
  pub son_istek: Instant,
}

/// Önizleme boyutu: en uzun kenar `en_fazla` (64–960), en-boy oranı korunur, çift sayıya yuvarlanır.
pub fn boyut(tuval_g: u32, tuval_y: u32, en_fazla: u32) -> (u32, u32) {
  let en_fazla = en_fazla.clamp(64, 960);
  let (g, y) = if tuval_g >= tuval_y {
    (en_fazla, (tuval_y as u64 * en_fazla as u64 / tuval_g.max(1) as u64) as u32)
  } else {
    ((tuval_g as u64 * en_fazla as u64 / tuval_y.max(1) as u64) as u32, en_fazla)
  };
  (g.max(2) & !1, y.max(2) & !1)
}

impl Onizleme {
  pub fn baglan(ad: &str, video: Ptr, tuval_g: u32, tuval_y: u32, en_fazla: u32) -> Result<Onizleme, String> {
    let (genislik, yukseklik) = boyut(tuval_g, tuval_y, en_fazla);
    let kare = Arc::new(Mutex::new(Kare { genislik, yukseklik, aralik_ms: 250, ..Default::default() }));
    let ham = Arc::into_raw(Arc::clone(&kare));
    let ayar = Veri::yeni().yazi("baglam", &format!("{:x}", ham as usize));
    let a = api();
    let ad_c = cs(ad);
    let cikti = unsafe { (a.obs_output_create)(CIKIS_ID.as_ptr(), ad_c.as_ptr(), ayar.0, std::ptr::null_mut()) };
    if cikti.is_null() {
      unsafe { drop(Arc::from_raw(ham)) };
      return Err("önizleme çıktısı oluşturulamadı".into());
    }
    let donusum = VideoScaleInfo {
      format: VIDEO_FORMAT_RGBA,
      width: genislik,
      height: yukseklik,
      range: VIDEO_RANGE_FULL,
      colorspace: obs::VIDEO_CS_709,
    };
    unsafe {
      (a.obs_output_set_media)(cikti, video, (a.obs_get_audio)());
      (a.obs_output_set_video_conversion)(cikti, &donusum as *const VideoScaleInfo as Ptr);
    }
    let o = Onizleme { cikti, genislik, yukseklik, kare, ham, son_istek: Instant::now() };
    if !unsafe { (a.obs_output_start)(cikti) } {
      return Err("önizleme başlatılamadı".into()); // Drop çıktıyı ve Arc'ı serbest bırakır
    }
    Ok(o)
  }

  /// Son kare PNG olarak (henüz kare yoksa `None`).
  pub fn png(&mut self) -> Result<Option<Vec<u8>>, String> {
    self.son_istek = Instant::now();
    let k = self.kare.lock().map_err(|_| "önizleme kilidi")?;
    if k.zaman.is_none() || k.rgba.len() != (self.genislik * self.yukseklik * 4) as usize {
      return Ok(None);
    }
    let mut out = Vec::with_capacity(k.rgba.len() / 4);
    {
      let mut enc = png::Encoder::new(&mut out, self.genislik, self.yukseklik);
      enc.set_color(png::ColorType::Rgba);
      enc.set_depth(png::BitDepth::Eight);
      enc.set_compression(png::Compression::Fast);
      let mut w = enc.write_header().map_err(|e| format!("png: {e}"))?;
      w.write_image_data(&k.rgba).map_err(|e| format!("png: {e}"))?;
    }
    Ok(Some(out))
  }

  /// Canlı akış için kare arabelleği (iş parçacığıyla paylaşılır)
  pub(crate) fn paylasim(&self) -> Arc<Mutex<Kare>> {
    Arc::clone(&self.kare)
  }

  pub(crate) fn aralik(&self, ms: u32) {
    if let Ok(mut k) = self.kare.lock() {
      k.aralik_ms = ms;
    }
  }

  pub fn bosta(&self) -> bool {
    self.son_istek.elapsed().as_millis() > BOSTA_MS
  }
}

impl Drop for Onizleme {
  fn drop(&mut self) {
    let a = api();
    unsafe {
      if (a.obs_output_active)(self.cikti) {
        (a.obs_output_stop)(self.cikti);
        let son = Instant::now() + std::time::Duration::from_secs(3);
        while (a.obs_output_active)(self.cikti) && Instant::now() < son {
          std::thread::sleep(std::time::Duration::from_millis(10));
        }
      }
      (a.obs_output_release)(self.cikti);
      drop(Arc::from_raw(self.ham));
    }
  }
}

// `CiktiVerisi` yalnız libobs iş parçacıklarında okunur; göstericiler çıktı yaşadıkça geçerlidir.
unsafe impl Send for Onizleme {}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn onizleme_boyutu_orani_korur() {
    assert_eq!(boyut(1920, 1080, 480), (480, 270));
    assert_eq!(boyut(1080, 1920, 480), (270, 480));
    assert_eq!(boyut(2560, 1440, 5000), (960, 540), "üst sınır 960");
    let (g, y) = boyut(1366, 768, 481);
    assert!(g % 2 == 0 && y % 2 == 0);
  }

  #[test]
  fn yapi_boyutlari_basliklarla_uyumlu() {
    assert_eq!(std::mem::size_of::<VideoScaleInfo>(), 20);
    assert_eq!(std::mem::size_of::<VideoData>(), 8 * 8 + 8 * 4 + 8);
    // obs_output_info: id + flags(+dolgu) + 14 fonksiyon + type_data + 4 fonksiyon + 2 dize + 1 fonksiyon + 1 dize
    assert_eq!(std::mem::size_of::<OutputInfo>(), 24 * 8);
  }
}
