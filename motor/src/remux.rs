//! Yeniden muxlama (OBS "Dosya › Yeniden muxla"): kaydı yeniden kodlamadan başka kaba (MKV → MP4 vb.) kopyalar.
//!
//! Ayrı alt süreç kipinde çalışır (`yayin-motoru remux <girdi> <çıktı>`): uzun kopyalama motorun komut döngüsünü
//! tıkamaz, bozuk bir dosya yüzünden çökse bile motor ve yayın etkilenmez. İlerleme stdout'a JSON satırlarıyla yazılır.
//!
//! FFmpeg kitaplıkları kurulu OBS'in `bin\64bit` klasöründen yüklenir (kendi kopyamızı dağıtmayız). Birkaç yapı alanı
//! doğrudan okunur/yazılır; düzenler FFmpeg 8 (libavformat 62, libavcodec 62) başlıklarından alınmıştır ve sürüm
//! çalışma anında denetlenir — farklı sürümde remux açıkça reddedilir (tahminle yazılmaz).

use std::ffi::{c_char, c_int, c_uint, c_void, CString};
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use serde::Serialize;

type Ptr = *mut c_void;

const DESTEKLENEN_AVFORMAT: u32 = 62;
const DESTEKLENEN_AVCODEC: u32 = 62;
const AVIO_FLAG_WRITE: c_int = 2;
const SEEK_CUR: c_int = 1;
/// AVERROR_EOF = -MKTAG('E','O','F',' ')
const AVERROR_EOF: c_int = -0x2046_4F45;
const AVMEDIA_TYPE_VIDEO: c_int = 0;
const AVMEDIA_TYPE_AUDIO: c_int = 1;

// Yapı alanı konumları (FFmpeg 8, x86-64)
/// AVFormatContext: av_class, iformat, oformat, priv_data, pb (32), ctx_flags (40), nb_streams (44), streams (48)
const FC_PB: usize = 32;
const FC_NB_STREAMS: usize = 44;
const FC_STREAMS: usize = 48;
/// AVStream: av_class, index (8), id (12), codecpar (16), priv_data (24), time_base (32)
const ST_CODECPAR: usize = 16;
const ST_TIME_BASE: usize = 32;
/// AVCodecParameters: codec_type (0), codec_id (4), codec_tag (8)
const CP_CODEC_TYPE: usize = 0;
const CP_CODEC_TAG: usize = 8;
/// AVPacket: buf, pts (8), dts (16), data (24), size (32), stream_index (36), flags, side_data, elems, duration, pos (72)
const PK_STREAM_INDEX: usize = 36;
const PK_POS: usize = 72;

#[repr(C)]
#[derive(Clone, Copy, Debug, PartialEq)]
struct Oran {
  num: c_int,
  den: c_int,
}

struct Ff {
  _kitapliklar: Vec<libloading::Library>,
  avformat_open_input: unsafe extern "C" fn(*mut Ptr, *const c_char, Ptr, Ptr) -> c_int,
  avformat_find_stream_info: unsafe extern "C" fn(Ptr, Ptr) -> c_int,
  avformat_close_input: unsafe extern "C" fn(*mut Ptr),
  avformat_alloc_output_context2: unsafe extern "C" fn(*mut Ptr, Ptr, *const c_char, *const c_char) -> c_int,
  avformat_new_stream: unsafe extern "C" fn(Ptr, Ptr) -> Ptr,
  avformat_write_header: unsafe extern "C" fn(Ptr, Ptr) -> c_int,
  avformat_free_context: unsafe extern "C" fn(Ptr),
  av_read_frame: unsafe extern "C" fn(Ptr, Ptr) -> c_int,
  av_interleaved_write_frame: unsafe extern "C" fn(Ptr, Ptr) -> c_int,
  av_write_trailer: unsafe extern "C" fn(Ptr) -> c_int,
  avio_open: unsafe extern "C" fn(*mut Ptr, *const c_char, c_int) -> c_int,
  avio_closep: unsafe extern "C" fn(*mut Ptr) -> c_int,
  avio_seek: unsafe extern "C" fn(Ptr, i64, c_int) -> i64,
  avcodec_parameters_copy: unsafe extern "C" fn(Ptr, Ptr) -> c_int,
  av_packet_alloc: unsafe extern "C" fn() -> Ptr,
  av_packet_free: unsafe extern "C" fn(*mut Ptr),
  av_packet_unref: unsafe extern "C" fn(Ptr),
  av_packet_rescale_ts: unsafe extern "C" fn(Ptr, Oran, Oran),
  av_strerror: unsafe extern "C" fn(c_int, *mut c_char, usize) -> c_int,
}

fn sembol<T: Copy>(k: &libloading::Library, ad: &[u8]) -> Result<T, String> {
  unsafe { k.get::<T>(ad).map(|s| *s).map_err(|e| format!("{}: {e}", String::from_utf8_lossy(&ad[..ad.len() - 1]))) }
}

impl Ff {
  fn yukle(bin: &Path) -> Result<Ff, String> {
    let ac = |ad: &str| unsafe { libloading::Library::new(bin.join(ad)) }.map_err(|e| format!("{ad} yüklenemedi: {e}"));
    let format = ac("avformat-62.dll")?;
    let codec = ac("avcodec-62.dll")?;
    let util = ac("avutil-60.dll")?;
    let fsurum: unsafe extern "C" fn() -> c_uint = sembol(&format, b"avformat_version\0")?;
    let csurum: unsafe extern "C" fn() -> c_uint = sembol(&codec, b"avcodec_version\0")?;
    let (fs, cs) = unsafe { (fsurum() >> 16, csurum() >> 16) };
    if fs != DESTEKLENEN_AVFORMAT || cs != DESTEKLENEN_AVCODEC {
      return Err(format!(
        "FFmpeg sürümü doğrulanmadı (avformat {fs}, avcodec {cs}; beklenen {DESTEKLENEN_AVFORMAT}/{DESTEKLENEN_AVCODEC})"
      ));
    }
    Ok(Ff {
      avformat_open_input: sembol(&format, b"avformat_open_input\0")?,
      avformat_find_stream_info: sembol(&format, b"avformat_find_stream_info\0")?,
      avformat_close_input: sembol(&format, b"avformat_close_input\0")?,
      avformat_alloc_output_context2: sembol(&format, b"avformat_alloc_output_context2\0")?,
      avformat_new_stream: sembol(&format, b"avformat_new_stream\0")?,
      avformat_write_header: sembol(&format, b"avformat_write_header\0")?,
      avformat_free_context: sembol(&format, b"avformat_free_context\0")?,
      av_read_frame: sembol(&format, b"av_read_frame\0")?,
      av_interleaved_write_frame: sembol(&format, b"av_interleaved_write_frame\0")?,
      av_write_trailer: sembol(&format, b"av_write_trailer\0")?,
      avio_open: sembol(&format, b"avio_open\0")?,
      avio_closep: sembol(&format, b"avio_closep\0")?,
      avio_seek: sembol(&format, b"avio_seek\0")?,
      avcodec_parameters_copy: sembol(&codec, b"avcodec_parameters_copy\0")?,
      av_packet_alloc: sembol(&codec, b"av_packet_alloc\0")?,
      av_packet_free: sembol(&codec, b"av_packet_free\0")?,
      av_packet_unref: sembol(&codec, b"av_packet_unref\0")?,
      av_packet_rescale_ts: sembol(&codec, b"av_packet_rescale_ts\0")?,
      av_strerror: sembol(&util, b"av_strerror\0")?,
      _kitapliklar: vec![format, codec, util],
    })
  }

  fn hata(&self, kod: c_int) -> String {
    let mut tampon = [0 as c_char; 256];
    unsafe { (self.av_strerror)(kod, tampon.as_mut_ptr(), tampon.len()) };
    let metin = unsafe { std::ffi::CStr::from_ptr(tampon.as_ptr()) }.to_string_lossy().into_owned();
    format!("{metin} ({kod})")
  }
}

unsafe fn oku<T: Copy>(p: Ptr, konum: usize) -> T {
  std::ptr::read_unaligned((p as *const u8).add(konum) as *const T)
}

unsafe fn yaz<T>(p: Ptr, konum: usize, deger: T) {
  std::ptr::write_unaligned((p as *mut u8).add(konum) as *mut T, deger)
}

unsafe fn akis(fc: Ptr, i: usize) -> Ptr {
  let dizi: *const Ptr = oku(fc, FC_STREAMS);
  *dizi.add(i)
}

/// Çıktı uzantısı → FFmpeg biçim adı (OBS'in remux çıktılarıyla aynı aile)
pub fn bicim(yol: &Path) -> Option<&'static str> {
  match yol.extension()?.to_str()?.to_ascii_lowercase().as_str() {
    "mp4" => Some("mp4"),
    "mov" => Some("mov"),
    "mkv" => Some("matroska"),
    _ => None,
  }
}

#[derive(Debug, Serialize, PartialEq)]
pub struct RemuxSonucu {
  pub video: usize,
  pub ses: usize,
  pub atlanan_akis: usize,
  pub paket: u64,
  /// Dosya sonuna gelinmeden okuma bitti (yarım/bozuk kayıt): o ana kadarki kısım yazıldı
  pub erken_bitti: bool,
}

/// Girdi dosyasını `cikti`ya yeniden muxlar. Çıktı önce geçici adla yazılır, başarıda yerine taşınır; var olan dosyanın
/// üzerine yazılmaz. `ilerleme` 0–1 arası okunan bayt oranıyla en çok 5 kez/sn çağrılır.
pub fn remux(bin: &Path, girdi: &Path, cikti: &Path, mut ilerleme: impl FnMut(f64)) -> Result<RemuxSonucu, String> {
  let bicim_adi = bicim(cikti).ok_or("çıktı uzantısı .mp4, .mov ya da .mkv olmalı")?;
  if !girdi.is_file() {
    return Err(format!("girdi dosyası yok: {}", girdi.display()));
  }
  if cikti.exists() {
    return Err(format!("çıktı zaten var (üzerine yazılmaz): {}", cikti.display()));
  }
  if std::path::absolute(girdi).ok() == std::path::absolute(cikti).ok() {
    return Err("girdi ve çıktı aynı dosya".into());
  }
  let ff = Ff::yukle(bin)?;
  let boyut = std::fs::metadata(girdi).map(|m| m.len()).unwrap_or(0).max(1);
  let gecici = PathBuf::from(format!("{}.remux-gecici", cikti.display()));
  let _ = std::fs::remove_file(&gecici);
  let g_c = CString::new(girdi.to_string_lossy().as_bytes()).map_err(|_| "geçersiz girdi yolu")?;
  let c_c = CString::new(gecici.to_string_lossy().as_bytes()).map_err(|_| "geçersiz çıktı yolu")?;
  let b_c = CString::new(bicim_adi).unwrap();

  let mut giris: Ptr = std::ptr::null_mut();
  let mut cikis: Ptr = std::ptr::null_mut();
  let mut paket: Ptr = std::ptr::null_mut();
  let mut acildi = false;
  let sonuc = (|| -> Result<RemuxSonucu, String> {
    unsafe {
      let r = (ff.avformat_open_input)(&mut giris, g_c.as_ptr(), std::ptr::null_mut(), std::ptr::null_mut());
      if r < 0 {
        return Err(format!("girdi açılamadı: {}", ff.hata(r)));
      }
      let r = (ff.avformat_find_stream_info)(giris, std::ptr::null_mut());
      if r < 0 {
        return Err(format!("akış bilgisi okunamadı: {}", ff.hata(r)));
      }
      let r = (ff.avformat_alloc_output_context2)(&mut cikis, std::ptr::null_mut(), b_c.as_ptr(), c_c.as_ptr());
      if r < 0 || cikis.is_null() {
        return Err(format!("çıktı oluşturulamadı: {}", ff.hata(r)));
      }
      // Yalnız görüntü ve ses akışları kopyalanır (veri/ek akışları MP4'te çoğunlukla desteklenmez)
      let n: c_uint = oku(giris, FC_NB_STREAMS);
      let mut eslem: Vec<Option<usize>> = vec![None; n as usize];
      let (mut video, mut ses, mut atlanan) = (0, 0, 0);
      let mut yeni = 0usize;
      for (i, e) in eslem.iter_mut().enumerate() {
        let st = akis(giris, i);
        let par: Ptr = oku(st, ST_CODECPAR);
        let tur: c_int = oku(par, CP_CODEC_TYPE);
        if tur != AVMEDIA_TYPE_VIDEO && tur != AVMEDIA_TYPE_AUDIO {
          atlanan += 1;
          continue;
        }
        let ost = (ff.avformat_new_stream)(cikis, std::ptr::null_mut());
        if ost.is_null() {
          return Err("çıktı akışı oluşturulamadı".into());
        }
        let opar: Ptr = oku(ost, ST_CODECPAR);
        let r = (ff.avcodec_parameters_copy)(opar, par);
        if r < 0 {
          return Err(format!("akış parametreleri kopyalanamadı: {}", ff.hata(r)));
        }
        // Kaba özgü kodek etiketi yeni kapta geçersiz olabilir: FFmpeg doğru olanı seçsin
        yaz::<c_uint>(opar, CP_CODEC_TAG, 0);
        if tur == AVMEDIA_TYPE_VIDEO {
          video += 1;
        } else {
          ses += 1;
        }
        *e = Some(yeni);
        yeni += 1;
      }
      if yeni == 0 {
        return Err("kopyalanacak görüntü ya da ses akışı yok".into());
      }
      let pb_yeri = (cikis as *mut u8).add(FC_PB) as *mut Ptr;
      let r = (ff.avio_open)(pb_yeri, c_c.as_ptr(), AVIO_FLAG_WRITE);
      if r < 0 {
        return Err(format!("çıktı dosyası açılamadı: {}", ff.hata(r)));
      }
      acildi = true;
      let r = (ff.avformat_write_header)(cikis, std::ptr::null_mut());
      if r < 0 {
        return Err(format!("çıktı başlığı yazılamadı (kodek bu kapta desteklenmiyor olabilir): {}", ff.hata(r)));
      }
      paket = (ff.av_packet_alloc)();
      if paket.is_null() {
        return Err("bellek yetersiz".into());
      }
      let mut sayac = 0u64;
      let mut son_bildirim = Instant::now();
      let erken_bitti;
      loop {
        let r = (ff.av_read_frame)(giris, paket);
        if r < 0 {
          erken_bitti = r != AVERROR_EOF;
          break;
        }
        let i: c_int = oku(paket, PK_STREAM_INDEX);
        let Some(Some(hedef)) = eslem.get(i as usize).copied() else {
          (ff.av_packet_unref)(paket);
          continue;
        };
        let kaynak_tb: Oran = oku(akis(giris, i as usize), ST_TIME_BASE);
        let hedef_tb: Oran = oku(akis(cikis, hedef), ST_TIME_BASE);
        (ff.av_packet_rescale_ts)(paket, kaynak_tb, hedef_tb);
        yaz::<c_int>(paket, PK_STREAM_INDEX, hedef as c_int);
        yaz::<i64>(paket, PK_POS, -1);
        let r = (ff.av_interleaved_write_frame)(cikis, paket);
        (ff.av_packet_unref)(paket);
        if r < 0 {
          return Err(format!("paket yazılamadı: {}", ff.hata(r)));
        }
        sayac += 1;
        if son_bildirim.elapsed() >= Duration::from_millis(200) {
          son_bildirim = Instant::now();
          let pb: Ptr = oku(giris, FC_PB);
          if !pb.is_null() {
            let konum = (ff.avio_seek)(pb, 0, SEEK_CUR);
            if konum >= 0 {
              ilerleme((konum as f64 / boyut as f64).min(1.0));
            }
          }
        }
      }
      let r = (ff.av_write_trailer)(cikis);
      if r < 0 {
        return Err(format!("dosya sonu yazılamadı: {}", ff.hata(r)));
      }
      Ok(RemuxSonucu { video, ses, atlanan_akis: atlanan, paket: sayac, erken_bitti })
    }
  })();
  unsafe {
    if !paket.is_null() {
      (ff.av_packet_free)(&mut paket);
    }
    if !cikis.is_null() {
      if acildi {
        (ff.avio_closep)((cikis as *mut u8).add(FC_PB) as *mut Ptr);
      }
      (ff.avformat_free_context)(cikis);
    }
    if !giris.is_null() {
      (ff.avformat_close_input)(&mut giris);
    }
  }
  match sonuc {
    Ok(s) => {
      std::fs::rename(&gecici, cikti).map_err(|e| format!("çıktı yerine taşınamadı: {e}"))?;
      ilerleme(1.0);
      Ok(s)
    }
    Err(e) => {
      let _ = std::fs::remove_file(&gecici);
      Err(e)
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn cikti_bicimi() {
    assert_eq!(bicim(Path::new("a.MP4")), Some("mp4"));
    assert_eq!(bicim(Path::new("a.mkv")), Some("matroska"));
    assert_eq!(bicim(Path::new("a.mov")), Some("mov"));
    assert_eq!(bicim(Path::new("a.flv")), None);
    assert_eq!(bicim(Path::new("a")), None);
  }

  #[test]
  fn oran_duzeni() {
    // AVRational iki int: değerle geçirilir (Win64'te tek 8 baytlık yazmaç)
    assert_eq!(std::mem::size_of::<Oran>(), 8);
  }
}
