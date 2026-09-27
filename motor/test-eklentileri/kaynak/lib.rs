//! yym_test_kaynak — sağlıklı test eklentisi: bir giriş kaynağı ("yym_test_desen", CPU'da üretilen renkli çizgili
//! desen, eşzamansız video) ve bir video filtresi ("yym_test_filtre", görüntüyü değiştirmeden geçirir) kaydeder.
//! Özellikleri (renk, çizgi kalınlığı, hareket) OBS özellik API'siyle bildirir; panelin genel özellik formu bununla
//! sınanır. Ağ, dosya ya da kayıt defteri erişimi yoktur.

#![allow(clippy::missing_safety_doc)]

#[path = "../ortak.rs"]
mod ortak;

use std::ffi::{c_char, c_void};
use std::sync::atomic::{AtomicBool, AtomicI64, Ordering};
use std::sync::Arc;
use std::thread::JoinHandle;
use std::time::Duration;

type Ptr = *mut c_void;

#[repr(C)]
#[derive(Clone, Copy)]
struct KaynakBilgisi {
  id: *const c_char,
  tur: i32,
  cikti_bayraklari: u32,
  get_name: Option<unsafe extern "C" fn(Ptr) -> *const c_char>,
  create: Option<unsafe extern "C" fn(Ptr, Ptr) -> Ptr>,
  destroy: Option<unsafe extern "C" fn(Ptr)>,
  get_width: Option<unsafe extern "C" fn(Ptr) -> u32>,
  get_height: Option<unsafe extern "C" fn(Ptr) -> u32>,
  get_defaults: Option<unsafe extern "C" fn(Ptr)>,
  get_properties: Option<unsafe extern "C" fn(Ptr) -> Ptr>,
  update: Option<unsafe extern "C" fn(Ptr, Ptr)>,
  activate: Option<unsafe extern "C" fn(Ptr)>,
  deactivate: Option<unsafe extern "C" fn(Ptr)>,
  show: Option<unsafe extern "C" fn(Ptr)>,
  hide: Option<unsafe extern "C" fn(Ptr)>,
  video_tick: Option<unsafe extern "C" fn(Ptr, f32)>,
  video_render: Option<unsafe extern "C" fn(Ptr, Ptr)>,
}

/// struct obs_source_frame (obs.h, 32.2.2) — 224 bayt
#[repr(C)]
struct Kare {
  data: [*mut u8; 8],
  linesize: [u32; 8],
  width: u32,
  height: u32,
  timestamp: u64,
  format: i32,
  color_matrix: [f32; 16],
  full_range: bool,
  max_luminance: u16,
  color_range_min: [f32; 3],
  color_range_max: [f32; 3],
  flip: bool,
  flags: u8,
  trc: u8,
  refs: i32,
  prev_frame: bool,
}

const OBS_SOURCE_TYPE_INPUT: i32 = 0;
const OBS_SOURCE_TYPE_FILTER: i32 = 1;
const OBS_SOURCE_VIDEO: u32 = 1 << 0;
const OBS_SOURCE_ASYNC: u32 = 1 << 2;
const VIDEO_FORMAT_BGRA: i32 = 7;

#[link(name = "obs", kind = "raw-dylib")]
extern "C" {
  fn obs_register_source_s(info: *const KaynakBilgisi, size: usize);
  fn obs_source_output_video(source: Ptr, frame: *const Kare);
  fn obs_source_skip_video_filter(filter: Ptr);
  fn obs_data_get_int(data: Ptr, name: *const c_char) -> i64;
  fn obs_data_set_default_int(data: Ptr, name: *const c_char, val: i64);
  fn obs_properties_create() -> Ptr;
  fn obs_properties_add_color(props: Ptr, name: *const c_char, desc: *const c_char) -> Ptr;
  fn obs_properties_add_int(props: Ptr, name: *const c_char, desc: *const c_char, min: i32, max: i32, step: i32) -> Ptr;
  fn obs_properties_add_bool(props: Ptr, name: *const c_char, desc: *const c_char) -> Ptr;
  fn obs_data_get_bool(data: Ptr, name: *const c_char) -> bool;
  fn obs_data_set_default_bool(data: Ptr, name: *const c_char, val: bool);
  fn os_gettime_ns() -> u64;
}

macro_rules! c {
  ($s:literal) => {
    concat!($s, "\0").as_ptr() as *const c_char
  };
}

const GENISLIK: u32 = 320;
const YUKSEKLIK: u32 = 180;

struct Desen {
  kaynak: usize,
  renk: Arc<AtomicI64>,
  kalinlik: Arc<AtomicI64>,
  hareket: Arc<AtomicBool>,
  dur: Arc<AtomicBool>,
  is: Option<JoinHandle<()>>,
}

fn ayarlari_oku(d: &Desen, ayar: Ptr) {
  unsafe {
    d.renk.store(obs_data_get_int(ayar, c!("renk")), Ordering::Relaxed);
    d.kalinlik.store(obs_data_get_int(ayar, c!("kalinlik")).clamp(1, 90), Ordering::Relaxed);
    d.hareket.store(obs_data_get_bool(ayar, c!("hareket")), Ordering::Relaxed);
  }
}

unsafe extern "C" fn desen_adi(_: Ptr) -> *const c_char {
  c!("YYM test deseni")
}

unsafe extern "C" fn desen_olustur(ayar: Ptr, kaynak: Ptr) -> Ptr {
  let mut d = Box::new(Desen {
    kaynak: kaynak as usize,
    renk: Arc::default(),
    kalinlik: Arc::default(),
    hareket: Arc::default(),
    dur: Arc::default(),
    is: None,
  });
  ayarlari_oku(&d, ayar);
  let (renk, kalinlik, hareket, dur, k) = (d.renk.clone(), d.kalinlik.clone(), d.hareket.clone(), d.dur.clone(), d.kaynak);
  d.is = Some(std::thread::spawn(move || {
    let mut tampon = vec![0u8; (GENISLIK * YUKSEKLIK * 4) as usize];
    let mut kayma = 0u32;
    while !dur.load(Ordering::Relaxed) {
      // OBS renk özelliği 0xAABBGGRR tutar; BGRA kare için bileşenler ayrılır
      let r = renk.load(Ordering::Relaxed) as u32;
      let (kr, kg, kb) = ((r & 0xFF) as u8, ((r >> 8) & 0xFF) as u8, ((r >> 16) & 0xFF) as u8);
      let kal = kalinlik.load(Ordering::Relaxed).max(1) as u32;
      for y in 0..YUKSEKLIK {
        for x in 0..GENISLIK {
          let i = ((y * GENISLIK + x) * 4) as usize;
          let cizgi = ((x + kayma) / kal).is_multiple_of(2);
          let (b, g, rr) = if cizgi { (kb, kg, kr) } else { (kb / 4, kg / 4, kr / 4) };
          tampon[i..i + 4].copy_from_slice(&[b, g, rr, 255]);
        }
      }
      let mut kare: Kare = unsafe { std::mem::zeroed() };
      kare.data[0] = tampon.as_mut_ptr();
      kare.linesize[0] = GENISLIK * 4;
      kare.width = GENISLIK;
      kare.height = YUKSEKLIK;
      kare.format = VIDEO_FORMAT_BGRA;
      kare.full_range = true;
      unsafe {
        kare.timestamp = os_gettime_ns();
        // libobs kareyi kopyalar; tampon bir sonraki turda yeniden kullanılabilir
        obs_source_output_video(k as Ptr, &kare);
      }
      if hareket.load(Ordering::Relaxed) {
        kayma = (kayma + 4) % (kal * 2);
      }
      std::thread::sleep(Duration::from_millis(100));
    }
  }));
  Box::into_raw(d) as Ptr
}

unsafe extern "C" fn desen_yok_et(veri: Ptr) {
  if veri.is_null() {
    return;
  }
  let mut d = Box::from_raw(veri as *mut Desen);
  d.dur.store(true, Ordering::Relaxed);
  if let Some(is) = d.is.take() {
    let _ = is.join();
  }
}

unsafe extern "C" fn desen_varsayilan(ayar: Ptr) {
  obs_data_set_default_int(ayar, c!("renk"), 0xFF_CC_66_33);
  obs_data_set_default_int(ayar, c!("kalinlik"), 20);
  obs_data_set_default_bool(ayar, c!("hareket"), true);
}

unsafe extern "C" fn desen_ozellikleri(_: Ptr) -> Ptr {
  let p = obs_properties_create();
  obs_properties_add_color(p, c!("renk"), c!("Renk"));
  obs_properties_add_int(p, c!("kalinlik"), c!("Çizgi kalınlığı (px)"), 1, 90, 1);
  obs_properties_add_bool(p, c!("hareket"), c!("Hareket etsin"));
  p
}

unsafe extern "C" fn desen_guncelle(veri: Ptr, ayar: Ptr) {
  if let Some(d) = (veri as *const Desen).as_ref() {
    ayarlari_oku(d, ayar);
  }
}

unsafe extern "C" fn filtre_adi(_: Ptr) -> *const c_char {
  c!("YYM test filtresi (geçirgen)")
}

unsafe extern "C" fn filtre_olustur(_ayar: Ptr, kaynak: Ptr) -> Ptr {
  kaynak
}

unsafe extern "C" fn filtre_yok_et(_: Ptr) {}

unsafe extern "C" fn filtre_ciz(veri: Ptr, _efekt: Ptr) {
  obs_source_skip_video_filter(veri);
}

fn bos_bilgi(id: *const c_char, tur: i32, bayrak: u32) -> KaynakBilgisi {
  KaynakBilgisi {
    id,
    tur,
    cikti_bayraklari: bayrak,
    get_name: None,
    create: None,
    destroy: None,
    get_width: None,
    get_height: None,
    get_defaults: None,
    get_properties: None,
    update: None,
    activate: None,
    deactivate: None,
    show: None,
    hide: None,
    video_tick: None,
    video_render: None,
  }
}

#[no_mangle]
pub extern "C" fn obs_module_ver() -> u32 {
  ortak::api_surumu(32, 0, 0)
}

#[no_mangle]
pub extern "C" fn obs_module_name() -> *const c_char {
  c!("YYM test kaynağı")
}

#[no_mangle]
pub extern "C" fn obs_module_description() -> *const c_char {
  c!("Eklenti uyumluluk düzeneği için test kaynağı ve geçirgen filtre")
}

#[no_mangle]
pub extern "C" fn obs_module_author() -> *const c_char {
  c!("Yayın Yönetim Aracı")
}

#[no_mangle]
pub extern "C" fn obs_module_load() -> bool {
  let mut desen = bos_bilgi(c!("yym_test_desen"), OBS_SOURCE_TYPE_INPUT, OBS_SOURCE_VIDEO | OBS_SOURCE_ASYNC);
  desen.get_name = Some(desen_adi);
  desen.create = Some(desen_olustur);
  desen.destroy = Some(desen_yok_et);
  desen.get_defaults = Some(desen_varsayilan);
  desen.get_properties = Some(desen_ozellikleri);
  desen.update = Some(desen_guncelle);

  let mut filtre = bos_bilgi(c!("yym_test_filtre"), OBS_SOURCE_TYPE_FILTER, OBS_SOURCE_VIDEO);
  filtre.get_name = Some(filtre_adi);
  filtre.create = Some(filtre_olustur);
  filtre.destroy = Some(filtre_yok_et);
  filtre.video_render = Some(filtre_ciz);
  unsafe {
    obs_register_source_s(&desen, std::mem::size_of::<KaynakBilgisi>());
    obs_register_source_s(&filtre, std::mem::size_of::<KaynakBilgisi>());
  }
  true
}

#[cfg(test)]
mod tests {
  #[test]
  fn kare_duzeni_obs_ile_ayni() {
    // struct obs_source_frame, x64: 8×8 + 8×4 + 4+4 + 8 + 4 + 64 + 1(+1) + 2 + 12 + 12 + 3(+1) + 4 + 1(+7) = 224
    assert_eq!(std::mem::size_of::<super::Kare>(), 224);
    assert_eq!(std::mem::offset_of!(super::Kare, timestamp), 104);
    assert_eq!(std::mem::offset_of!(super::Kare, format), 112);
    assert_eq!(std::mem::offset_of!(super::Kare, refs), 212);
    // obs_source_info'nun ilk 17 alanı: kimlik + tür + bayraklar + 14 işlev işaretçisi
    assert_eq!(std::mem::size_of::<super::KaynakBilgisi>(), 16 + 14 * 8);
  }
}
