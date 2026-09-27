//! Hedef durum makinesi (saf).
//!
//! Bir hedefin hatası diğerlerini ASLA etkilemez; her hedef kendi durumunu taşır.
//! Ayrıntı: `docs/MULTISTREAM_ARCHITECTURE.md` §2.

use serde::Serialize;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum DestState {
  /// Kullanıcı kapattı; GO LIVE ile başlamaz
  Disabled,
  /// Yapılandırma geçerli, başlatılmayı bekliyor
  Ready,
  /// Yayıncı süreci başladı, henüz ilerleme yok
  Connecting,
  /// İlerleme akıyor
  Live,
  /// Canlı ama sağlık bozuk
  Warning,
  /// Süreç düştü; geri çekilmeyle yeniden deneniyor
  Reconnecting,
  /// Denemeler tükendi; kullanıcı eylemi gerekir
  Failed,
  /// Kullanıcı durdurdu
  Stopped,
}

impl DestState {
  /// Yayıncı süreci çalışıyor ya da çalışmaya çalışıyor mu?
  pub fn is_active(self) -> bool {
    matches!(self, DestState::Connecting | DestState::Live | DestState::Warning | DestState::Reconnecting)
  }
}

/// Durumu değiştiren olaylar.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DestEvent {
  Enable,
  Disable,
  Start,
  /// Yayıncıdan ilk / düzenli ilerleme geldi
  Progress { healthy: bool },
  /// Yayıncı süreci bitti (hata ya da bağlantı kopması)
  ProcessExited,
  /// Yeniden deneme zamanı geldi
  RetryDue,
  Stop,
}

/// Ardışık başarısızlık sınırı; aşılınca `Failed`.
pub const MAX_FAILURES: u32 = 10;

/// Geçiş kuralı. `failures`: ardışık başarısız deneme sayısı (Live olunca sıfırlanır).
pub fn transition(state: DestState, ev: DestEvent, failures: u32) -> DestState {
  use DestEvent as E;
  use DestState as S;
  match (state, ev) {
    (_, E::Disable) => S::Disabled,
    (S::Disabled, E::Enable) => S::Ready,
    (S::Disabled, _) => S::Disabled,
    (_, E::Stop) => S::Stopped,
    (S::Ready | S::Stopped | S::Failed, E::Start) => S::Connecting,
    (S::Connecting | S::Live | S::Warning, E::Progress { healthy }) => {
      if healthy {
        S::Live
      } else {
        S::Warning
      }
    }
    (S::Connecting | S::Live | S::Warning, E::ProcessExited) => {
      if failures + 1 >= MAX_FAILURES {
        S::Failed
      } else {
        S::Reconnecting
      }
    }
    (S::Reconnecting, E::RetryDue) => S::Connecting,
    (s, _) => s,
  }
}

/// Üstel geri çekilme: ilk deneme 1 sn, sonra 2, 4, 8, 16, 32, 60, 60… saniye.
pub fn backoff_secs(failures: u32) -> u64 {
  match failures {
    0 => 1,
    n => (1u64 << n.min(6)).min(60),
  }
}

/// Yayıncı ilerlemesinden sağlık kararı.
///
/// `speed` < 0.97 → yayıncı kaynak hızının gerisinde (ağ yetersiz); kuyrukta düşürülen paket varsa da uyarı.
pub fn healthy(speed: Option<f64>, dropped_recent: u64) -> bool {
  let hiz_iyi = speed.map(|s| s >= 0.97).unwrap_or(true);
  hiz_iyi && dropped_recent == 0
}

#[cfg(test)]
mod tests {
  use super::*;
  use DestEvent as E;
  use DestState as S;

  #[test]
  fn temel_yasam_dongusu() {
    let mut s = S::Disabled;
    s = transition(s, E::Enable, 0);
    assert_eq!(s, S::Ready);
    s = transition(s, E::Start, 0);
    assert_eq!(s, S::Connecting);
    s = transition(s, E::Progress { healthy: true }, 0);
    assert_eq!(s, S::Live);
    s = transition(s, E::Progress { healthy: false }, 0);
    assert_eq!(s, S::Warning);
    s = transition(s, E::Progress { healthy: true }, 0);
    assert_eq!(s, S::Live);
    s = transition(s, E::Stop, 0);
    assert_eq!(s, S::Stopped);
    // Durdurulmuş hedef yayın sürerken yeniden başlatılabilir (§86)
    assert_eq!(transition(s, E::Start, 0), S::Connecting);
  }

  #[test]
  fn kopma_yeniden_baglanma_ve_tukenme() {
    let s = transition(S::Live, E::ProcessExited, 0);
    assert_eq!(s, S::Reconnecting);
    assert_eq!(transition(s, E::RetryDue, 1), S::Connecting);
    assert_eq!(transition(S::Connecting, E::ProcessExited, MAX_FAILURES - 1), S::Failed);
    assert_eq!(transition(S::Failed, E::Start, 0), S::Connecting);
  }

  #[test]
  fn kapali_hedef_baslamaz_ve_ilerleme_yok_sayilir() {
    assert_eq!(transition(S::Disabled, E::Start, 0), S::Disabled);
    assert_eq!(transition(S::Disabled, E::Progress { healthy: true }, 0), S::Disabled);
    assert_eq!(transition(S::Stopped, E::Progress { healthy: true }, 0), S::Stopped);
    assert_eq!(transition(S::Live, E::Disable, 0), S::Disabled);
  }

  #[test]
  fn geri_cekilme_sinirli() {
    assert_eq!(backoff_secs(0), 1);
    assert_eq!(backoff_secs(1), 2);
    assert_eq!(backoff_secs(2), 4);
    assert_eq!(backoff_secs(5), 32);
    assert_eq!(backoff_secs(6), 60);
    assert_eq!(backoff_secs(50), 60);
  }

  #[test]
  fn saglik_karari() {
    assert!(healthy(Some(1.0), 0));
    assert!(healthy(None, 0));
    assert!(!healthy(Some(0.9), 0));
    assert!(!healthy(Some(1.0), 3));
  }
}
