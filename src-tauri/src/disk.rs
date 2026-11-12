//! Disk alanı (yayın öncesi kontrol ve destek paketi için; salt-okunur).

use std::path::{Path, PathBuf};

/// Yolun bulunduğu birimdeki kullanılabilir alan (bayt). Yol henüz yoksa var olan en yakın üst klasöre bakılır
/// (kayıt klasörü ilk kayıtta oluşturulur). Okunamazsa `None` — "yer var" varsayılmaz.
pub fn bos_alan(yol: &Path) -> Option<u64> {
  let mevcut = var_olan_ust(yol)?;
  bos_alan_os(&mevcut)
}

fn var_olan_ust(yol: &Path) -> Option<PathBuf> {
  let mut p = Some(yol);
  while let Some(x) = p {
    if x.exists() {
      return Some(x.to_path_buf());
    }
    p = x.parent();
  }
  None
}

/// Kullanıcıya gösterilecek birim etiketi ("C:"); tam yol (kullanıcı adı içerebilir) raporlara yazılmaz.
pub fn birim_etiketi(yol: &Path) -> String {
  match yol.components().next() {
    Some(std::path::Component::Prefix(p)) => p.as_os_str().to_string_lossy().trim_end_matches('\\').to_string(),
    _ => "birim".into(),
  }
}

#[cfg(windows)]
fn bos_alan_os(yol: &Path) -> Option<u64> {
  use std::os::windows::ffi::OsStrExt;
  use windows::core::PCWSTR;
  use windows::Win32::Storage::FileSystem::GetDiskFreeSpaceExW;

  let genis: Vec<u16> = yol.as_os_str().encode_wide().chain(std::iter::once(0)).collect();
  let mut bos: u64 = 0;
  // SAFETY: `genis` NUL ile biten geçerli bir UTF-16 dizgisi; çıktı işaretçisi yerel bir u64'e gider.
  unsafe { GetDiskFreeSpaceExW(PCWSTR(genis.as_ptr()), Some(&mut bos), None, None) }.ok()?;
  Some(bos)
}

#[cfg(not(windows))]
fn bos_alan_os(_yol: &Path) -> Option<u64> {
  None
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn olmayan_alt_klasor_ust_birime_duser() {
    let tmp = std::env::temp_dir();
    let a = bos_alan(&tmp);
    let b = bos_alan(&tmp.join("studio-olmayan-klasor").join("alt"));
    assert!(a.is_some());
    assert!(b.is_some());
  }

  #[cfg(windows)]
  #[test]
  fn birim_etiketi_yolu_sizdirmaz() {
    assert_eq!(birim_etiketi(Path::new(r"C:\Users\ad\Videos")), "C:");
    assert_eq!(birim_etiketi(Path::new("goreli/yol")), "birim");
  }
}
