//! Windows sistem araçlarının tam yolu.
//!
//! `Command::new("curl.exe")` gibi çıplak adlar Windows'ta ÖNCE uygulamanın kendi
//! klasöründe aranır (CreateProcess sırası). Taşınabilir klasöre bırakılmış sahte
//! bir `curl.exe` / `taskkill.exe` uygulamanın yetkisiyle çalışırdı. Bu yüzden
//! sistem araçları `%SystemRoot%\System32` altından tam yolla çağrılır; yol
//! bulunamazsa (Windows dışı ya da olağandışı kurulum) çıplak ada düşülür.

use std::path::PathBuf;

/// `ad` (ör. `"taskkill.exe"`) için System32 altındaki tam yol.
pub fn yol(ad: &str) -> PathBuf {
  let goreli = if ad.eq_ignore_ascii_case("powershell.exe") {
    PathBuf::from("WindowsPowerShell").join("v1.0").join(ad)
  } else {
    PathBuf::from(ad)
  };
  std::env::var_os("SystemRoot")
    .map(|kok| PathBuf::from(kok).join("System32").join(&goreli))
    .filter(|p| p.is_file())
    .unwrap_or_else(|| PathBuf::from(ad.trim_end_matches(".exe")))
}

#[cfg(all(test, windows))]
mod tests {
  use super::*;

  #[test]
  fn system32_altindan_tam_yol_verir() {
    for ad in ["taskkill.exe", "tasklist.exe", "netstat.exe", "reg.exe", "curl.exe", "tar.exe", "powershell.exe"] {
      let p = yol(ad);
      assert!(p.is_absolute(), "{ad}: {}", p.display());
      assert!(p.to_string_lossy().to_ascii_lowercase().contains("system32"), "{ad}");
    }
  }
}
