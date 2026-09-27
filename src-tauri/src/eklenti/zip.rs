//! Eklenti paketleri için en küçük, savunmacı ZIP açıcı (yalnız "stored" ve "deflate").
//!
//! Reddedilenler: şifreli girdi, klasör dışına çıkan yol (`..`, mutlak yol, sürücü harfi, alternatif veri akışı),
//! 20 000'den fazla girdi, 1 GB'tan büyük toplam açılmış boyut, bildirilen boyuttan büyük açılan girdi (zip
//! bombası), CRC uyuşmazlığı. ZIP64 desteklenmez (eklenti paketleri 4 GB'ı aşmaz). Hiçbir dosya çalıştırılmaz.

use std::io::Read;
use std::path::{Component, Path, PathBuf};

pub const AZAMI_GIRDI: usize = 20_000;
pub const AZAMI_TOPLAM: u64 = 1024 * 1024 * 1024;

fn u16_(b: &[u8], o: usize) -> Result<u16, String> {
  b.get(o..o + 2).map(|x| u16::from_le_bytes([x[0], x[1]])).ok_or_else(|| "zip kısa".to_string())
}
fn u32_(b: &[u8], o: usize) -> Result<u32, String> {
  b.get(o..o + 4).map(|x| u32::from_le_bytes([x[0], x[1], x[2], x[3]])).ok_or_else(|| "zip kısa".to_string())
}

/// Zip içindeki adı hedef klasör altında güvenli göreli yola çevirir; kaçış girişiminde hata.
pub fn guvenli_yol(ad: &str) -> Result<PathBuf, String> {
  let ad = ad.replace('\\', "/");
  if ad.starts_with('/') || ad.contains(':') {
    return Err(format!("güvensiz yol: {ad}"));
  }
  let mut p = PathBuf::new();
  for c in Path::new(&ad).components() {
    match c {
      Component::Normal(x) => p.push(x),
      Component::CurDir => {}
      _ => return Err(format!("güvensiz yol: {ad}")),
    }
  }
  if p.as_os_str().is_empty() {
    return Err("boş yol".into());
  }
  Ok(p)
}

/// `zip` baytlarını `hedef` altına açar; açılan dosyaların göreli yollarını döner.
pub fn ac(zip: &[u8], hedef: &Path) -> Result<Vec<PathBuf>, String> {
  // Merkezi dizin sonu (EOCD): en fazla 64 KB yorum
  let bas = zip.len().saturating_sub(22 + 65_535);
  let eocd = (bas..zip.len().saturating_sub(21))
    .rev()
    .find(|&i| zip[i..i + 4] == [0x50, 0x4B, 0x05, 0x06])
    .ok_or("zip değil (merkezi dizin sonu yok)")?;
  let girdi_sayisi = u16_(zip, eocd + 10)? as usize;
  let cd_ofs = u32_(zip, eocd + 16)? as usize;
  if girdi_sayisi == 0xFFFF || cd_ofs == 0xFFFF_FFFF {
    return Err("ZIP64 desteklenmiyor".into());
  }
  if girdi_sayisi > AZAMI_GIRDI {
    return Err(format!("çok fazla girdi ({girdi_sayisi})"));
  }
  let mut o = cd_ofs;
  let mut toplam: u64 = 0;
  let mut acilan = Vec::new();
  for _ in 0..girdi_sayisi {
    if u32_(zip, o)? != 0x0201_4B50 {
      return Err("merkezi dizin bozuk".into());
    }
    let bayrak = u16_(zip, o + 8)?;
    let yontem = u16_(zip, o + 10)?;
    let crc = u32_(zip, o + 16)?;
    let sikisik = u32_(zip, o + 20)? as usize;
    let acik = u32_(zip, o + 24)? as u64;
    let ad_uz = u16_(zip, o + 28)? as usize;
    let ek_uz = u16_(zip, o + 30)? as usize;
    let yorum_uz = u16_(zip, o + 32)? as usize;
    let yerel = u32_(zip, o + 42)? as usize;
    let ad_b = zip.get(o + 46..o + 46 + ad_uz).ok_or("ad kısa")?;
    // 11. bit: UTF-8 ad; değilse CP437 — Türkçe olmayan adlar için kayıpsız yeterli
    let ad = String::from_utf8_lossy(ad_b).into_owned();
    o += 46 + ad_uz + ek_uz + yorum_uz;

    if ad.ends_with('/') {
      std::fs::create_dir_all(hedef.join(guvenli_yol(&ad)?)).map_err(|e| e.to_string())?;
      continue;
    }
    if bayrak & 1 != 0 {
      return Err(format!("şifreli girdi desteklenmiyor: {ad}"));
    }
    let goreli = guvenli_yol(&ad)?;
    toplam += acik;
    if toplam > AZAMI_TOPLAM {
      return Err("açılmış boyut 1 GB sınırını aşıyor".into());
    }
    if u32_(zip, yerel)? != 0x0403_4B50 {
      return Err(format!("yerel başlık bozuk: {ad}"));
    }
    let veri_ofs = yerel + 30 + u16_(zip, yerel + 26)? as usize + u16_(zip, yerel + 28)? as usize;
    let ham = zip.get(veri_ofs..veri_ofs + sikisik).ok_or_else(|| format!("veri kısa: {ad}"))?;
    let icerik = match yontem {
      0 => ham.to_vec(),
      8 => {
        let mut v = Vec::with_capacity(acik.min(64 * 1024 * 1024) as usize);
        // Bildirilen boyuttan fazlası okunmaz (zip bombası)
        flate2::read::DeflateDecoder::new(ham).take(acik + 1).read_to_end(&mut v).map_err(|e| format!("açılamadı ({ad}): {e}"))?;
        v
      }
      y => return Err(format!("desteklenmeyen sıkıştırma ({y}): {ad}")),
    };
    if icerik.len() as u64 != acik {
      return Err(format!("boyut uyuşmuyor: {ad}"));
    }
    let mut c = flate2::Crc::new();
    c.update(&icerik);
    if c.sum() != crc {
      return Err(format!("CRC uyuşmuyor: {ad}"));
    }
    let tam = hedef.join(&goreli);
    if let Some(u) = tam.parent() {
      std::fs::create_dir_all(u).map_err(|e| e.to_string())?;
    }
    std::fs::write(&tam, &icerik).map_err(|e| format!("yazılamadı ({ad}): {e}"))?;
    acilan.push(goreli);
  }
  Ok(acilan)
}

#[cfg(test)]
pub(crate) mod tests {
  use super::*;
  use std::io::Write;

  /// Sınama için zip üretir: (ad, içerik, sıkıştır mı)
  pub(crate) fn zip_yap(girdiler: &[(&str, &[u8], bool)]) -> Vec<u8> {
    let mut out = Vec::new();
    let mut merkez = Vec::new();
    for (ad, icerik, sik) in girdiler {
      let mut c = flate2::Crc::new();
      c.update(icerik);
      let veri = if *sik {
        let mut e = flate2::write::DeflateEncoder::new(Vec::new(), flate2::Compression::default());
        e.write_all(icerik).unwrap();
        e.finish().unwrap()
      } else {
        icerik.to_vec()
      };
      let ofs = out.len() as u32;
      let yontem: u16 = if *sik { 8 } else { 0 };
      out.extend_from_slice(&0x0403_4B50u32.to_le_bytes());
      out.extend_from_slice(&[20, 0, 0, 0]);
      out.extend_from_slice(&yontem.to_le_bytes());
      out.extend_from_slice(&[0; 4]);
      out.extend_from_slice(&c.sum().to_le_bytes());
      out.extend_from_slice(&(veri.len() as u32).to_le_bytes());
      out.extend_from_slice(&(icerik.len() as u32).to_le_bytes());
      out.extend_from_slice(&(ad.len() as u16).to_le_bytes());
      out.extend_from_slice(&0u16.to_le_bytes());
      out.extend_from_slice(ad.as_bytes());
      out.extend_from_slice(&veri);
      merkez.extend_from_slice(&0x0201_4B50u32.to_le_bytes());
      merkez.extend_from_slice(&[20, 0, 20, 0, 0, 0]);
      merkez.extend_from_slice(&yontem.to_le_bytes());
      merkez.extend_from_slice(&[0; 4]);
      merkez.extend_from_slice(&c.sum().to_le_bytes());
      merkez.extend_from_slice(&(veri.len() as u32).to_le_bytes());
      merkez.extend_from_slice(&(icerik.len() as u32).to_le_bytes());
      merkez.extend_from_slice(&(ad.len() as u16).to_le_bytes());
      merkez.extend_from_slice(&[0; 12]);
      merkez.extend_from_slice(&ofs.to_le_bytes());
      merkez.extend_from_slice(ad.as_bytes());
    }
    let cd = out.len() as u32;
    out.extend_from_slice(&merkez);
    out.extend_from_slice(&0x0605_4B50u32.to_le_bytes());
    out.extend_from_slice(&[0; 4]);
    out.extend_from_slice(&(girdiler.len() as u16).to_le_bytes());
    out.extend_from_slice(&(girdiler.len() as u16).to_le_bytes());
    out.extend_from_slice(&(merkez.len() as u32).to_le_bytes());
    out.extend_from_slice(&cd.to_le_bytes());
    out.extend_from_slice(&[0, 0]);
    out
  }

  fn gecici(ad: &str) -> PathBuf {
    let d = std::env::temp_dir().join(format!("yya-zip-{ad}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&d);
    d
  }

  #[test]
  fn ac_ve_icerik() {
    let d = gecici("ok");
    let z = zip_yap(&[("eklenti/bin/64bit/a.dll", b"MZ....", true), ("eklenti/data/locale/tr-TR.ini", b"A=B", false)]);
    let a = ac(&z, &d).unwrap();
    assert_eq!(a.len(), 2);
    assert_eq!(std::fs::read(d.join("eklenti/bin/64bit/a.dll")).unwrap(), b"MZ....");
    let _ = std::fs::remove_dir_all(&d);
  }

  #[test]
  fn kacis_ve_bozukluk_reddedilir() {
    let d = gecici("kotu");
    for kotu in ["../disari.dll", "/mutlak.dll", "C:/Windows/x.dll", "a/../../b.dll", "a:ads.dll"] {
      assert!(ac(&zip_yap(&[(kotu, b"x", false)]), &d).is_err(), "{kotu}");
    }
    assert!(!d.parent().unwrap().join("disari.dll").exists());
    let mut z = zip_yap(&[("a.txt", b"merhaba", false)]);
    let i = z.windows(7).position(|w| w == b"merhaba").unwrap();
    z[i] = b'M';
    assert!(ac(&z, &d).unwrap_err().contains("CRC"));
    assert!(ac(b"dosya degil", &d).is_err());
    let _ = std::fs::remove_dir_all(&d);
  }
}
