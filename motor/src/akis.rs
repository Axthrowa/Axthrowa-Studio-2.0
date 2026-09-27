//! Canlı önizleme akışı: tuvalin küçültülmüş karesi JPEG olarak `kare` olayıyla akar (yalnız açıkken, en çok 15 kare/sn).
//! Kodlama ayrı iş parçacığında; libobs yalnız ham kareyi ortak arabelleğe kopyalar (bkz. `onizleme.rs`).

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use base64::Engine;

use crate::motor::{Motor, Olay};

pub struct Akis {
  dur: Arc<AtomicBool>,
  is: Option<JoinHandle<()>>,
}

/// RGBA → JPEG (kalite 1–100)
pub fn jpeg(rgba: &[u8], genislik: u32, yukseklik: u32, kalite: u8) -> Result<Vec<u8>, String> {
  let mut out = Vec::with_capacity(rgba.len() / 10);
  let enc = jpeg_encoder::Encoder::new(&mut out, kalite.clamp(1, 100));
  enc
    .encode(rgba, genislik as u16, yukseklik as u16, jpeg_encoder::ColorType::Rgba)
    .map_err(|e| format!("jpeg: {e}"))?;
  Ok(out)
}

impl Motor {
  /// Akışı başlatır (zaten açıksa kare hızını günceller). İlk çağrıda önizleme çıktısı bağlanır.
  pub fn akis_baslat(&mut self, tuval: &str, genislik: u32, fps: u32) -> Result<(), String> {
    let fps = fps.clamp(1, 15);
    self.akis_durdur(tuval);
    // Önizleme çıktısını bağla (ilk istek karesiz döner)
    let _ = self.onizleme_png(tuval, genislik)?;
    let o = self.onizlemeler.get(tuval).ok_or("önizleme bağlanamadı")?;
    o.aralik(1000 / fps);
    let kare = o.paylasim();
    let dur = Arc::new(AtomicBool::new(false));
    let (d, olay, t) = (dur.clone(), self.olay.clone(), tuval.to_string());
    let is = std::thread::spawn(move || {
      let aralik = Duration::from_millis(1000 / fps as u64);
      let mut son: Option<Instant> = None;
      while !d.load(Ordering::Relaxed) {
        let bas = Instant::now();
        let hazir = match kare.lock() {
          Ok(k) if k.zaman.is_some() && k.zaman != son && k.rgba.len() == (k.genislik * k.yukseklik * 4) as usize => {
            son = k.zaman;
            Some(jpeg(&k.rgba, k.genislik, k.yukseklik, 70))
          }
          _ => None,
        };
        if let Some(Ok(j)) = hazir {
          let b64 = base64::engine::general_purpose::STANDARD.encode(j);
          if olay.send(Olay::Kare { tuval: t.clone(), jpeg: b64 }).is_err() {
            break;
          }
        }
        if let Some(kalan) = aralik.checked_sub(bas.elapsed()) {
          std::thread::sleep(kalan);
        }
      }
    });
    self.akislar.insert(tuval.to_string(), Akis { dur, is: Some(is) });
    Ok(())
  }

  pub fn akis_durdur(&mut self, tuval: &str) {
    if let Some(mut a) = self.akislar.remove(tuval) {
      a.dur.store(true, Ordering::Relaxed);
      if let Some(is) = a.is.take() {
        let _ = is.join();
      }
      if let Some(o) = self.onizlemeler.get(tuval) {
        o.aralik(250);
      }
    }
  }

  pub(crate) fn akislari_kapat(&mut self) {
    let t: Vec<String> = self.akislar.keys().cloned().collect();
    for x in t {
      self.akis_durdur(&x);
    }
  }
}

#[cfg(test)]
mod tests {
  #[test]
  fn jpeg_kodlanir() {
    let (g, y) = (64u32, 36u32);
    let mut rgba = vec![0u8; (g * y * 4) as usize];
    for (i, p) in rgba.chunks_mut(4).enumerate() {
      p.copy_from_slice(&[(i % 255) as u8, 80, 160, 255]);
    }
    let j = super::jpeg(&rgba, g, y, 70).unwrap();
    assert_eq!(&j[..2], &[0xFF, 0xD8], "JPEG SOI");
    assert!(j.len() < rgba.len());
  }
}
