//! Giriş/çıkış bitiş otomasyonu için süreçler arası kilit.
//!
//! Bitiş eylemi (oyun sahnesine geç / yayını kapat) hem OBS tarayıcı
//! kaynağındaki sayfada hem panelde (önizleme + izleyici) tetiklenebiliyor.
//! Bunlar ayrı süreçler (OBS CEF ve panel WebView) ve birbirinden habersizdi:
//! çıkışta `StopStream` iki kez gidiyor, ikincisi hata verip panelde
//! "otomatik kapat kapalı" gibi yanıltıcı bildirim çıkıyordu.
//!
//! Kural: aynı anahtar için ilk talep eden sahip eylemi yapar; `SURE` içinde
//! başka sahipten gelen talep reddedilir. Eylem başarısız olursa sahip kilidi
//! bırakır ve öteki görünüm üstlenebilir. Kilit bellektedir (uygulama
//! yeniden başlarsa sıfırlanır — bitiş zaten tek seferlik bir olaydır).

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

/// Aynı bitişi iki görünüm birkaç saniye arayla görür; 90 sn bol.
pub const SURE: Duration = Duration::from_secs(90);

#[derive(Default)]
pub struct Kilitler {
  kayitlar: HashMap<String, (Instant, String)>,
}

impl Kilitler {
  /// Talep kabul edildiyse `true` (eylemi bu sahip yapar).
  pub fn talep(&mut self, anahtar: &str, sahip: &str, simdi: Instant) -> bool {
    self
      .kayitlar
      .retain(|_, (zaman, _)| simdi.saturating_duration_since(*zaman) < SURE);
    match self.kayitlar.get(anahtar) {
      Some((_, mevcut)) if mevcut != sahip => false,
      _ => {
        self
          .kayitlar
          .insert(anahtar.to_string(), (simdi, sahip.to_string()));
        true
      }
    }
  }

  /// Yalnız sahibi bırakabilir.
  pub fn birak(&mut self, anahtar: &str, sahip: &str) -> bool {
    match self.kayitlar.get(anahtar) {
      Some((_, mevcut)) if mevcut == sahip => {
        self.kayitlar.remove(anahtar);
        true
      }
      _ => false,
    }
  }
}

pub fn kilitler() -> &'static Mutex<Kilitler> {
  static K: OnceLock<Mutex<Kilitler>> = OnceLock::new();
  K.get_or_init(|| Mutex::new(Kilitler::default()))
}

/// Yalnız bilinen iki bitiş anahtarı — uç rastgele anahtar biriktiremesin.
pub fn gecerli_anahtar(anahtar: &str) -> bool {
  matches!(anahtar, "starting-end" | "ending-end")
}

pub fn gecerli_sahip(sahip: &str) -> bool {
  !sahip.is_empty()
    && sahip.len() <= 64
    && sahip.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn ilk_talep_eden_kazanir_digeri_reddedilir() {
    let mut k = Kilitler::default();
    let t = Instant::now();
    assert!(k.talep("ending-end", "obs", t));
    assert!(!k.talep("ending-end", "panel", t + Duration::from_secs(2)));
    // Aynı sahip yeniden isteyebilir (aynı görünümde iki tetik)
    assert!(k.talep("ending-end", "obs", t + Duration::from_secs(3)));
  }

  #[test]
  fn anahtarlar_birbirinden_bagimsiz() {
    let mut k = Kilitler::default();
    let t = Instant::now();
    assert!(k.talep("starting-end", "obs", t));
    assert!(k.talep("ending-end", "panel", t));
  }

  #[test]
  fn basarisiz_sahip_birakinca_oteki_ustlenir() {
    let mut k = Kilitler::default();
    let t = Instant::now();
    assert!(k.talep("ending-end", "obs", t));
    assert!(!k.birak("ending-end", "panel"), "sahibi olmayan bırakamaz");
    assert!(k.birak("ending-end", "obs"));
    assert!(k.talep("ending-end", "panel", t + Duration::from_secs(1)));
  }

  #[test]
  fn sure_dolunca_yeni_talep_kabul_edilir() {
    let mut k = Kilitler::default();
    let t = Instant::now();
    assert!(k.talep("ending-end", "obs", t));
    assert!(k.talep("ending-end", "panel", t + SURE + Duration::from_secs(1)));
  }

  #[test]
  fn girdi_dogrulamasi() {
    assert!(gecerli_anahtar("starting-end") && gecerli_anahtar("ending-end"));
    assert!(!gecerli_anahtar("x") && !gecerli_anahtar(""));
    assert!(gecerli_sahip("3f2a-bc19"));
    assert!(!gecerli_sahip("") && !gecerli_sahip("a b") && !gecerli_sahip(&"a".repeat(65)));
  }
}
