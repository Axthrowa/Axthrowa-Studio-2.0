//! Kullanıcı kütüphanesi: logo, video, müzik, ses efekti, arka plan ve parçacık dosyaları.
//!
//! Eskiden her sürüm klasörünün kendi `assets` klasöründeydi; yeni sürüm klasörüne geçince eklenen logolar
//! "kayboluyor", ayarlar ise (veri klasöründe durduğu için) kalıyor ve ekranda logo görünmüyordu. Artık kütüphane
//! veri klasöründe (`<veri>/assets`) durur: sürümden bağımsızdır, yedeklenir. Açılışta şu kaynaklardan, **hiçbir
//! dosyanın üzerine yazmadan ve hiçbir şeyi silmeden** birleştirilir:
//!   1. bu sürümle gelen hazır dosyalar (`<kurulum>/assets`),
//!   2. yan yana duran eski sürüm klasörleri (`AxthrowA-Studio-*/portable/assets`).
//! Her kaynak bir kez birleştirilir: kullanıcı kütüphaneden bir dosyayı sildiyse eski klasörden geri gelmez.

use std::fs;
use std::path::{Path, PathBuf};

const ISARET: &str = ".birlestirilenler";
const KARDES_ONEKI: &str = "AxthrowA-Studio-";

/// `kaynak` altındaki dosyaları `hedef`e kopyalar; var olanlara dokunmaz. Kopyalanan dosya sayısını döndürür.
pub fn birlestir(kaynak: &Path, hedef: &Path) -> usize {
  let Ok(okuma) = fs::read_dir(kaynak) else { return 0 };
  let mut adet = 0;
  for e in okuma.flatten() {
    let p = e.path();
    let ad = e.file_name();
    // İşaret dosyası ve gizli dosyalar taşınmaz
    if ad.to_string_lossy().starts_with('.') {
      continue;
    }
    let h = hedef.join(&ad);
    if p.is_dir() {
      adet += birlestir(&p, &h);
    } else if !h.exists() {
      // Kopya arka planda sürerken sunucu yarım dosya vermesin: gizli adla yaz, bitince adını ver
      let gecici = hedef.join(format!(".{}.kopya", ad.to_string_lossy()));
      if fs::create_dir_all(hedef).is_ok() && fs::copy(&p, &gecici).is_ok() && fs::rename(&gecici, &h).is_ok() {
        adet += 1;
      } else {
        let _ = fs::remove_file(&gecici);
        studio_warn!("[kutuphane] kopyalanamadı: {}", p.display());
      }
    }
  }
  adet
}

/// Kurulum klasörünün yanındaki eski sürüm klasörlerinin `assets` klasörleri (kendisi hariç).
/// Dizilim: `…/AxthrowA-Studio-1.6.15/portable/assets` ya da `…/AxthrowA-Studio-1.6.15/assets`.
pub fn kardes_kutuphaneler(kurulum: &Path) -> Vec<PathBuf> {
  let kendi = fs::canonicalize(kurulum).unwrap_or_else(|_| kurulum.to_path_buf());
  // `…/AxthrowA-Studio-X/portable` ise sürüm klasörü bir üstteki, değilse kurulumun kendisi
  let surum_klasoru = match kendi.file_name().and_then(|n| n.to_str()) {
    Some("portable") => kendi.parent().map(Path::to_path_buf),
    _ => Some(kendi.clone()),
  };
  let Some(ust) = surum_klasoru.as_deref().and_then(Path::parent) else { return Vec::new() };
  let mut bulunan: Vec<PathBuf> = fs::read_dir(ust)
    .into_iter()
    .flatten()
    .flatten()
    .filter(|e| e.file_name().to_string_lossy().starts_with(KARDES_ONEKI) && e.path().is_dir())
    .flat_map(|e| [e.path().join("portable").join("assets"), e.path().join("assets")])
    .filter(|a| a.is_dir() && fs::canonicalize(a).map(|c| !c.starts_with(&kendi)).unwrap_or(true))
    .collect();
  // En yeni sürüm önce: aynı ad çakışırsa yeni olan kazanır
  bulunan.sort();
  bulunan.reverse();
  bulunan
}

fn isaretler(kutuphane: &Path) -> Vec<String> {
  fs::read_to_string(kutuphane.join(ISARET))
    .map(|s| s.lines().map(str::to_string).collect())
    .unwrap_or_default()
}

/// Kütüphaneyi hazırlar (açılışta arka plan iş parçacığında; sunucu beklemez). Kopyalanan toplam dosya sayısını döndürür.
pub fn hazirla(kurulum: &Path, veri: &Path, surum: &str) -> usize {
  let kutuphane = veri.join("assets");
  if fs::create_dir_all(&kutuphane).is_err() {
    studio_warn!("[kutuphane] klasör oluşturulamadı: {}", kutuphane.display());
    return 0;
  }
  let yapilan = isaretler(&kutuphane);
  let mut yeni_isaret = Vec::new();
  let mut toplam = 0;

  // Bu sürümün hazır dosyaları her yeni sürümde bir kez; eski sürümler yolları ile bir kez
  let kaynaklar = std::iter::once((kurulum.join("assets"), format!("surum:{surum}:{}", kurulum.display())))
    .chain(kardes_kutuphaneler(kurulum).into_iter().map(|k| {
      let anahtar = format!("klasor:{}", k.display());
      (k, anahtar)
    }));
  for (kaynak, anahtar) in kaynaklar {
    if yapilan.contains(&anahtar) || !kaynak.is_dir() {
      continue;
    }
    let n = birlestir(&kaynak, &kutuphane);
    if n > 0 {
      studio_log!("[kutuphane] {} dosya aktarıldı: {}", n, kaynak.display());
    }
    toplam += n;
    yeni_isaret.push(anahtar);
  }
  if !yeni_isaret.is_empty() {
    let mut hepsi = yapilan;
    hepsi.extend(yeni_isaret);
    let _ = fs::write(kutuphane.join(ISARET), hepsi.join("\n"));
  }
  toplam
}

#[cfg(test)]
mod tests {
  use super::*;

  fn gecici(ad: &str) -> PathBuf {
    let d = std::env::temp_dir().join(format!("studio-kutuphane-{ad}-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&d).unwrap();
    d
  }

  fn yaz(p: &Path, icerik: &str) {
    fs::create_dir_all(p.parent().unwrap()).unwrap();
    fs::write(p, icerik).unwrap();
  }

  #[test]
  fn birlestir_olanin_ustune_yazmaz_ve_yenileri_ekler() {
    let k = gecici("k");
    let h = gecici("h");
    yaz(&k.join("logos/a.png"), "eski");
    yaz(&k.join("logos/b.png"), "b");
    yaz(&h.join("logos/a.png"), "kullanicinin");
    assert_eq!(birlestir(&k, &h), 1);
    assert_eq!(fs::read_to_string(h.join("logos/a.png")).unwrap(), "kullanicinin");
    assert_eq!(fs::read_to_string(h.join("logos/b.png")).unwrap(), "b");
    assert!(!h.join("logos/.b.png.kopya").exists(), "geçici kopya kalmamalı");
  }

  #[test]
  fn eski_surumun_logosu_yeni_surumde_gorunur_ve_silinen_geri_gelmez() {
    let masaustu = gecici("m");
    // Eski sürüm kullanıcının logosunu taşıyor, yeni sürümde yalnız hazır dosya var
    yaz(&masaustu.join("AxthrowA-Studio-1.6.15/portable/assets/logos/Amblem.png"), "logo");
    yaz(&masaustu.join("AxthrowA-Studio-1.6.15/portable/assets/logos/brand-icon.png"), "hazir");
    yaz(&masaustu.join("AxthrowA-Studio-1.6.17/portable/assets/logos/brand-icon.png"), "hazir");
    let kurulum = masaustu.join("AxthrowA-Studio-1.6.17/portable");
    let veri = gecici("v");

    let n = hazirla(&kurulum, &veri, "1.6.17");
    assert_eq!(n, 2, "brand-icon bir kez, Amblem bir kez");
    assert_eq!(fs::read_to_string(veri.join("assets/logos/Amblem.png")).unwrap(), "logo");

    // Kullanıcı logoyu kütüphaneden sildi: sonraki açılışta eski klasörden geri gelmez
    fs::remove_file(veri.join("assets/logos/Amblem.png")).unwrap();
    assert_eq!(hazirla(&kurulum, &veri, "1.6.17"), 0);
    assert!(!veri.join("assets/logos/Amblem.png").exists());

    // Yeni sürümle gelen hazır dosya yine eklenir, kullanıcının dosyalarına dokunulmaz
    yaz(&masaustu.join("AxthrowA-Studio-1.6.17/portable/assets/logos/yeni-hazir.png"), "y");
    assert_eq!(hazirla(&kurulum, &veri, "1.6.18"), 1);
    assert!(veri.join("assets/logos/yeni-hazir.png").exists());
  }

  #[test]
  fn kardes_listesi_kendini_ve_ilgisiz_klasorleri_dislar() {
    let m = gecici("kardes");
    fs::create_dir_all(m.join("AxthrowA-Studio-1.6.11/portable/assets")).unwrap();
    fs::create_dir_all(m.join("AxthrowA-Studio-1.6.17/portable/assets")).unwrap();
    fs::create_dir_all(m.join("baska-klasor/assets")).unwrap();
    let l = kardes_kutuphaneler(&m.join("AxthrowA-Studio-1.6.17/portable"));
    assert_eq!(l.len(), 1);
    assert!(l[0].to_string_lossy().contains("1.6.11"));
  }
}
