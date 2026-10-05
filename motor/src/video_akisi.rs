//! Canlı önizleme video akışı (H.264): tuval GPU'da donanım kodlayıcıyla (NVENC; yoksa x264) düşük gecikmeli olarak
//! önizleme boyutuna kodlanır, paketler yerel bir TCP bağlantısından panele akar; panel ikili WebSocket iletisiyle
//! arayüze iletir, arayüz tarayıcının donanım çözücüsüyle (WebCodecs) tuvale çizer. JPEG akışına göre kare hızı tuvalin
//! kendi hızıdır (60), görüntü önizlemenin gerçek piksel boyutundadır ve kodlama işlemciye yük getirmez.
//!
//! Bağlantı yalnız 127.0.0.1'de, motor açılışında üretilen rastgele anahtarla kabul edilir (anahtar yalnız stdio
//! protokolünden panele gider). Bir istemci düştüğünde diğerleri etkilenmez; istemci yetişemezse paket düşer.
//!
//! Çerçeve biçimi (küçük endian): `u32 uzunluk` + `u8 tuval adı uzunluğu` + tuval adı + `u8 bayrak (1 = anahtar kare)`
//! + `u16 genişlik` + `u16 yükseklik` + `i64 pts (µs)` + Annex B H.264 (anahtar karede SPS/PPS başta).

use std::ffi::{c_char, c_int};
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::mpsc::{sync_channel, Receiver, SyncSender, TrySendError};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use crate::obs::{self, api, cs, Ptr, Veri};
use crate::onizleme::OutputInfo;

const CIKIS_ID: &std::ffi::CStr = c"yym_canli_h264";
const OBS_OUTPUT_VIDEO: u32 = 1;
const OBS_OUTPUT_ENCODED: u32 = 1 << 2;
/// `enum obs_scale_type`: OBS_SCALE_BICUBIC
const OLCEK_BIKUBIK: c_int = 2;

/// `struct encoder_packet` (obs-encoder.h, OBS 32) — yalnız okunan alanlara kadar
#[repr(C)]
struct KodPaketi {
  data: *mut u8,
  size: usize,
  pts: i64,
  dts: i64,
  timebase_num: i32,
  timebase_den: i32,
  tur: c_int,
  keyframe: bool,
  dts_usec: i64,
  sys_dts_usec: i64,
  priority: c_int,
  drop_priority: c_int,
  track_idx: usize,
  encoder: Ptr,
}

/// Çıktı örneğinin verisi: hangi tuval, hangi boyut, paketlerin gideceği kanal
struct CiktiVerisi {
  cikti: Ptr,
  tuval: String,
  genislik: u16,
  yukseklik: u16,
  kanal: SyncSender<Vec<u8>>,
}

unsafe extern "C" fn ad(_: Ptr) -> *const c_char {
  c"Yayın Motoru canlı önizleme (H.264)".as_ptr()
}

unsafe extern "C" fn olustur(ayarlar: Ptr, cikti: Ptr) -> Ptr {
  let adres = obs::cstr((api().obs_data_get_string)(ayarlar, cs("baglam").as_ptr()));
  let p = usize::from_str_radix(&adres, 16).unwrap_or(0) as *mut CiktiVerisi;
  if p.is_null() {
    return std::ptr::null_mut();
  }
  // Panel tarafı veriyi hazırladı; libobs çıktı göstericisi burada yazılır
  (*p).cikti = cikti;
  p as Ptr
}

unsafe extern "C" fn yok_et(_veri: Ptr) {
  // Veri `VideoAkisi` tarafından sahiplenilir (Drop'ta serbest bırakılır)
}

unsafe extern "C" fn baslat(veri: Ptr) -> bool {
  let Some(v) = (veri as *const CiktiVerisi).as_ref() else { return false };
  let a = api();
  if !(a.obs_output_can_begin_data_capture)(v.cikti, 0) || !(a.obs_output_initialize_encoders)(v.cikti, 0) {
    return false;
  }
  (a.obs_output_begin_data_capture)(v.cikti, 0)
}

unsafe extern "C" fn durdur(veri: Ptr, _ts: u64) {
  if let Some(v) = (veri as *const CiktiVerisi).as_ref() {
    (api().obs_output_end_data_capture)(v.cikti);
  }
}

unsafe extern "C" fn paket(veri: Ptr, p: Ptr) {
  let (Some(v), Some(p)) = ((veri as *const CiktiVerisi).as_ref(), (p as *const KodPaketi).as_ref()) else { return };
  if p.data.is_null() || p.size == 0 {
    return;
  }
  let govde = std::slice::from_raw_parts(p.data, p.size);
  let mut basliklar: &[u8] = &[];
  if p.keyframe && !p.encoder.is_null() {
    let (mut e, mut n): (*mut u8, usize) = (std::ptr::null_mut(), 0);
    if (api().obs_encoder_get_extra_data)(p.encoder, &mut e, &mut n) && !e.is_null() && n > 0 {
      basliklar = std::slice::from_raw_parts(e, n);
    }
  }
  let pts_us = if p.timebase_den > 0 { p.pts.saturating_mul(1_000_000 * p.timebase_num as i64) / p.timebase_den as i64 } else { p.pts };
  let cerceve = cerceve_kur(&v.tuval, p.keyframe, v.genislik, v.yukseklik, pts_us, basliklar, govde);
  // İstemci yetişemiyorsa bu paket düşer (anahtar kareyi bekleyerek toparlanır)
  if let Err(TrySendError::Full(_)) = v.kanal.try_send(cerceve) {}
}

/// Çerçeve: u32 uzunluk + u8 ad uzunluğu + ad + u8 bayrak + u16 g + u16 y + i64 pts + veri
pub fn cerceve_kur(tuval: &str, anahtar: bool, g: u16, y: u16, pts_us: i64, basliklar: &[u8], govde: &[u8]) -> Vec<u8> {
  let ad = &tuval.as_bytes()[..tuval.len().min(255)];
  let ic = 1 + ad.len() + 1 + 2 + 2 + 8 + basliklar.len() + govde.len();
  let mut v = Vec::with_capacity(4 + ic);
  v.extend_from_slice(&(ic as u32).to_le_bytes());
  v.push(ad.len() as u8);
  v.extend_from_slice(ad);
  v.push(anahtar as u8);
  v.extend_from_slice(&g.to_le_bytes());
  v.extend_from_slice(&y.to_le_bytes());
  v.extend_from_slice(&pts_us.to_le_bytes());
  v.extend_from_slice(basliklar);
  v.extend_from_slice(govde);
  v
}

/// Çıktı türünü libobs'a kaydeder (`obs_startup`'tan sonra bir kez).
pub fn kaydet() {
  let bilgi = OutputInfo::kodlanmis(CIKIS_ID.as_ptr(), OBS_OUTPUT_VIDEO | OBS_OUTPUT_ENCODED, ad, olustur, yok_et, baslat, durdur, paket, c"h264".as_ptr());
  unsafe { (api().obs_register_output_s)(&bilgi as *const OutputInfo as Ptr, std::mem::size_of::<OutputInfo>()) };
}

/// 128 bit rastgele anahtar (Windows CNG)
#[cfg(windows)]
fn rastgele_anahtar() -> String {
  #[link(name = "bcrypt")]
  extern "system" {
    fn BCryptGenRandom(alg: Ptr, buf: *mut u8, len: u32, flags: u32) -> i32;
  }
  let mut b = [0u8; 16];
  // BCRYPT_USE_SYSTEM_PREFERRED_RNG
  unsafe { BCryptGenRandom(std::ptr::null_mut(), b.as_mut_ptr(), 16, 2) };
  b.iter().map(|x| format!("{x:02x}")).collect()
}

#[cfg(not(windows))]
fn rastgele_anahtar() -> String {
  format!("{:032x}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0))
}

/// Yerel paket sunucusu: tek dinleyici, bağlanan her istemciye tüm çerçeveler
pub struct PaketSunucusu {
  pub port: u16,
  pub anahtar: String,
  kanal: SyncSender<Vec<u8>>,
}

impl PaketSunucusu {
  pub fn baslat() -> Result<PaketSunucusu, String> {
    let dinleyici = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = dinleyici.local_addr().map_err(|e| e.to_string())?.port();
    let anahtar = rastgele_anahtar();
    let istemciler: Arc<Mutex<Vec<TcpStream>>> = Arc::new(Mutex::new(Vec::new()));
    let (kanal, al): (SyncSender<Vec<u8>>, Receiver<Vec<u8>>) = sync_channel(240);
    {
      let (istemciler, anahtar) = (Arc::clone(&istemciler), anahtar.clone());
      std::thread::Builder::new()
        .name("video-kabul".into())
        .spawn(move || {
          for s in dinleyici.incoming().flatten() {
            if !s.peer_addr().is_ok_and(|a| a.ip().is_loopback()) {
              continue;
            }
            let _ = s.set_read_timeout(Some(Duration::from_secs(3)));
            if anahtar_dogru(&s, &anahtar) {
              let _ = s.set_nodelay(true);
              let _ = s.set_write_timeout(Some(Duration::from_millis(500)));
              if let Ok(mut l) = istemciler.lock() {
                l.push(s);
              }
            }
          }
        })
        .map_err(|e| e.to_string())?;
    }
    {
      let istemciler = Arc::clone(&istemciler);
      std::thread::Builder::new()
        .name("video-gonder".into())
        .spawn(move || {
          for c in al {
            if let Ok(mut l) = istemciler.lock() {
              l.retain_mut(|s| s.write_all(&c).is_ok());
            }
          }
        })
        .map_err(|e| e.to_string())?;
    }
    Ok(PaketSunucusu { port, anahtar, kanal })
  }
}

/// İlk satır anahtar olmalı (`<anahtar>\n`)
fn anahtar_dogru(mut s: &TcpStream, anahtar: &str) -> bool {
  let mut b = [0u8; 64];
  let mut n = 0;
  while n < b.len() {
    match s.read(&mut b[n..n + 1]) {
      Ok(1) if b[n] == b'\n' => break,
      Ok(1) => n += 1,
      _ => return false,
    }
  }
  &b[..n] == anahtar.as_bytes()
}

/// Bir tuvalin süren kodlayıcı + çıktı çifti
pub struct VideoAkisi {
  kodlayici: Ptr,
  cikti: Ptr,
  veri: *mut CiktiVerisi,
  pub genislik: u32,
  pub yukseklik: u32,
  pub tur: String,
}

unsafe impl Send for VideoAkisi {}

/// Önizleme boyutuna göre bit hızı (yerel bağlantı: kalite öncelikli), kbps
pub fn bit_hizi(g: u32, y: u32, fps: u32) -> i64 {
  let bps = g as f64 * y as f64 * fps.max(1) as f64 * 0.12;
  ((bps / 1000.0) as i64).clamp(2_000, 40_000)
}

impl VideoAkisi {
  pub fn baslat(sunucu: &PaketSunucusu, tuval: &str, video: Ptr, kodlayicilar: &[String], g: u32, y: u32, fps: u32) -> Result<VideoAkisi, String> {
    let a = api();
    let tur = ["obs_nvenc_h264_tex", "obs_x264"].into_iter().find(|t| kodlayicilar.iter().any(|k| k == t)).ok_or("kullanılabilir H.264 kodlayıcı yok")?;
    let mut ayar = Veri::yeni()
      .yazi("rate_control", "CBR")
      .tamsayi("bitrate", bit_hizi(g, y, fps))
      .tamsayi("keyint_sec", 1)
      .yazi("profile", "high");
    ayar = if tur.contains("nvenc") {
      // En düşük gecikme: B karesiz, ileri bakışsız
      ayar.yazi("preset", "p2").yazi("tune", "ull").tamsayi("bf", 0).mantiksal("lookahead", false)
    } else {
      ayar.yazi("preset", "ultrafast").yazi("tune", "zerolatency")
    };
    let (tur_c, ad_c) = (cs(tur), cs(&format!("canli-{tuval}")));
    let kodlayici = unsafe { (a.obs_video_encoder_create)(tur_c.as_ptr(), ad_c.as_ptr(), ayar.0, std::ptr::null_mut()) };
    if kodlayici.is_null() {
      return Err("canlı önizleme kodlayıcısı oluşturulamadı".into());
    }
    unsafe {
      (a.obs_encoder_set_scaled_size)(kodlayici, g, y);
      (a.obs_encoder_set_gpu_scale_type)(kodlayici, OLCEK_BIKUBIK);
      (a.obs_encoder_set_video)(kodlayici, video);
    }
    let veri = Box::into_raw(Box::new(CiktiVerisi {
      cikti: std::ptr::null_mut(),
      tuval: tuval.to_string(),
      genislik: g.min(u16::MAX as u32) as u16,
      yukseklik: y.min(u16::MAX as u32) as u16,
      kanal: sunucu.kanal.clone(),
    }));
    let ayar_c = Veri::yeni().yazi("baglam", &format!("{:x}", veri as usize));
    let cikti = unsafe { (a.obs_output_create)(CIKIS_ID.as_ptr(), ad_c.as_ptr(), ayar_c.0, std::ptr::null_mut()) };
    if cikti.is_null() {
      unsafe {
        (a.obs_encoder_release)(kodlayici);
        drop(Box::from_raw(veri));
      }
      return Err("canlı önizleme çıktısı oluşturulamadı".into());
    }
    unsafe { (a.obs_output_set_video_encoder)(cikti, kodlayici) };
    let v = VideoAkisi { kodlayici, cikti, veri, genislik: g, yukseklik: y, tur: tur.to_string() };
    if !unsafe { (a.obs_output_start)(cikti) } {
      return Err("canlı önizleme başlatılamadı".into()); // Drop serbest bırakır
    }
    Ok(v)
  }
}

impl Drop for VideoAkisi {
  fn drop(&mut self) {
    let a = api();
    unsafe {
      if (a.obs_output_active)(self.cikti) {
        (a.obs_output_stop)(self.cikti);
        let son = std::time::Instant::now() + Duration::from_secs(3);
        while (a.obs_output_active)(self.cikti) && std::time::Instant::now() < son {
          std::thread::sleep(Duration::from_millis(10));
        }
      }
      (a.obs_output_release)(self.cikti);
      (a.obs_encoder_release)(self.kodlayici);
      drop(Box::from_raw(self.veri));
    }
  }
}

impl crate::motor::Motor {
  /// Tuvalin canlı video akışını başlatır ya da boyutu değişmişse yeniden kurar. Dönüş: bağlantı bilgisi.
  pub fn video_baslat(&mut self, tuval: &str, genislik: u32, yukseklik: u32) -> Result<serde_json::Value, String> {
    if self.video_sunucusu.is_none() {
      self.video_sunucusu = Some(PaketSunucusu::baslat()?);
    }
    let video = self.tuval_videosu(tuval)?;
    let (tg, ty) = self.tuval_boyutu_motor(tuval)?;
    let (g, y) = video_boyutu(tg, ty, genislik, yukseklik);
    if self.video_akislari.get(tuval).is_some_and(|v| v.genislik != g || v.yukseklik != y) {
      self.video_akislari.remove(tuval);
    }
    if !self.video_akislari.contains_key(tuval) {
      let kodlayicilar: Vec<String> = self.video_kodlayicilari().into_iter().map(|k| k.id).collect();
      let fps = self.ana.fps;
      let s = self.video_sunucusu.as_ref().unwrap();
      let v = VideoAkisi::baslat(s, tuval, video, &kodlayicilar, g, y, fps)?;
      self.video_akislari.insert(tuval.to_string(), v);
    }
    let s = self.video_sunucusu.as_ref().unwrap();
    let v = &self.video_akislari[tuval];
    Ok(serde_json::json!({"port": s.port, "anahtar": s.anahtar, "genislik": v.genislik, "yukseklik": v.yukseklik, "kodlayici": v.tur}))
  }

  pub fn video_durdur(&mut self, tuval: &str) {
    self.video_akislari.remove(tuval);
  }

  pub(crate) fn video_akislarini_kapat(&mut self) {
    self.video_akislari.clear();
  }
}

/// İstenen boyut (en-boy tuvale uyarlanır): tuvalden büyük olmaz, çift sayı, en az 64
pub fn video_boyutu(tuval_g: u32, tuval_y: u32, istenen_g: u32, istenen_y: u32) -> (u32, u32) {
  let (tg, ty) = (tuval_g.max(2) as f64, tuval_y.max(2) as f64);
  let olcek = (istenen_g.max(64) as f64 / tg).min(istenen_y.max(64) as f64 / ty).min(1.0);
  let g = ((tg * olcek) as u32).max(64) & !1;
  let y = ((ty * olcek) as u32).max(64) & !1;
  (g, y)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn cerceve_duzeni() {
    let c = cerceve_kur("ana", true, 1280, 720, 1_000_000, &[0, 0, 0, 1, 0x67], &[0, 0, 0, 1, 0x65, 9]);
    let uzunluk = u32::from_le_bytes(c[0..4].try_into().unwrap()) as usize;
    assert_eq!(uzunluk, c.len() - 4);
    assert_eq!(&c[4..8], &[3, b'a', b'n', b'a']);
    assert_eq!(c[8], 1);
    assert_eq!(u16::from_le_bytes([c[9], c[10]]), 1280);
    assert_eq!(u16::from_le_bytes([c[11], c[12]]), 720);
    assert_eq!(i64::from_le_bytes(c[13..21].try_into().unwrap()), 1_000_000);
    assert_eq!(&c[21..], &[0, 0, 0, 1, 0x67, 0, 0, 0, 1, 0x65, 9]);
  }

  #[test]
  fn boyut_ve_bit_hizi() {
    assert_eq!(video_boyutu(1920, 1080, 1600, 1200), (1600, 900));
    assert_eq!(video_boyutu(1920, 1080, 4000, 3000), (1920, 1080), "tuvalden büyük olmaz");
    assert_eq!(video_boyutu(1080, 1920, 500, 500), (280, 500));
    assert!(bit_hizi(1280, 720, 60) >= 6_000 && bit_hizi(1920, 1080, 60) <= 40_000);
  }
}
