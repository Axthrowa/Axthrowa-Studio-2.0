//! Kitaplık (assets/…) dosya adlarının doğrulaması.
//!
//! Yükleme ve silme uçları adı istekten alıyor. Eskiden yalnız `/`, `\` ve
//! `..` ayıklanıyordu; Windows'ta `C:dosya.mp3` gibi sürücü önekli bir ad
//! `Path::join` ile kitaplık klasörünü tamamen bırakıp sürücünün çalışma
//! dizinine gidiyordu — hem yazma hem SİLME için. `:` ayrıca NTFS alternatif
//! veri akışı (`ses.mp3:gizli`) açıyordu.

use std::path::{Component, Path};

/// Windows'un ayrılmış aygıt adları (uzantılı hâlleri de aygıta gider).
fn ayrilmis_ad(govde: &str) -> bool {
  let g = govde.trim().to_ascii_uppercase();
  matches!(g.as_str(), "CON" | "PRN" | "AUX" | "NUL")
    || ((g.starts_with("COM") || g.starts_with("LPT"))
      && g.len() == 4
      && g.as_bytes()[3].is_ascii_digit())
}

/// İstekten gelen adı tek bir güvenli dosya adına çevirir; olmuyorsa `None`.
pub fn asset_file_name(raw: &str) -> Option<String> {
  let temiz: String = raw
    .trim()
    .chars()
    .map(|c| {
      if c.is_control() || matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|') {
        '_'
      } else {
        c
      }
    })
    .collect();
  // Windows sondaki nokta/boşluğu sessizce siler: "a.mp3." ile "a.mp3" aynı dosya.
  let temiz = temiz.trim_end_matches(['.', ' ']).to_string();
  if temiz.is_empty() || temiz.chars().count() > 200 {
    return None;
  }
  if ayrilmis_ad(temiz.split('.').next().unwrap_or("")) {
    return None;
  }
  let mut parcalar = Path::new(&temiz).components();
  match (parcalar.next(), parcalar.next()) {
    (Some(Component::Normal(_)), None) => Some(temiz),
    _ => None,
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn normal_adlar_korunur() {
    assert_eq!(asset_file_name("intro video.mp4").as_deref(), Some("intro video.mp4"));
    assert_eq!(asset_file_name("şarkı-1.mp3").as_deref(), Some("şarkı-1.mp3"));
    assert_eq!(asset_file_name("a..b.png").as_deref(), Some("a..b.png"));
  }

  #[test]
  fn klasorden_kacis_engellenir() {
    // Sürücü öneki: eskiden kitaplık klasörünü bırakıyordu
    assert_eq!(asset_file_name("C:gizli.mp3").as_deref(), Some("C_gizli.mp3"));
    assert_eq!(asset_file_name("..\\..\\x.mp3").as_deref(), Some(".._.._x.mp3"));
    assert_eq!(asset_file_name(".."), None);
    assert_eq!(asset_file_name("."), None);
    assert_eq!(asset_file_name(""), None);
    // NTFS alternatif veri akışı
    assert_eq!(asset_file_name("ses.mp3:gizli").as_deref(), Some("ses.mp3_gizli"));
  }

  #[test]
  fn ayrilmis_aygit_adlari_reddedilir() {
    assert_eq!(asset_file_name("CON.mp3"), None);
    assert_eq!(asset_file_name("nul"), None);
    assert_eq!(asset_file_name("com1.png"), None);
    assert!(asset_file_name("console.mp3").is_some());
  }
}
