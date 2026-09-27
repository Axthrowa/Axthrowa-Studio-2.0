//! Salt-okunur PE (Windows DLL) ayrıştırıcı — eklenti dosyası HİÇ yüklenmeden (LoadLibrary yok, kod çalışmaz)
//! mimari, dışa aktarımlar, içe aktarımlar (gecikmeli dahil) ve gömülü imza bloğunun varlığı okunur.
//!
//! OBS de aynısını yapar: libobs `get_plugin_info` (util/platform-windows.c) dosyayı eşleyip dışa aktarım
//! tablosunda `obs_module_load` arar; bulamazsa "OBS eklentisi değil" der. Biz ayrıca mimariyi ve bağımlılıkları
//! okuruz ki uyumsuz dosya motor sürecine hiç girmesin.
//!
//! Bozuk/kötü niyetli dosyaya karşı: her okuma sınır denetimli; sayılar üst sınırlı; hata panik değil `Err`.

use serde::Serialize;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Mimari {
  X64,
  X86,
  Arm64,
  Diger,
}

impl Mimari {
  fn makineden(m: u16) -> Self {
    match m {
      0x8664 => Self::X64,
      0x014c => Self::X86,
      0xAA64 => Self::Arm64,
      _ => Self::Diger,
    }
  }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PeBilgisi {
  pub mimari: Mimari,
  pub makine: u16,
  /// IMAGE_FILE_DLL bayrağı
  pub dll: bool,
  /// PE32+ (64 bit isteğe bağlı başlık)
  pub pe32_arti: bool,
  /// Dışa aktarılan adlar (sıralı)
  pub disa_aktarimlar: Vec<String>,
  /// İçe aktarılan DLL adları (küçük harf, sıralı, tekil) — normal + gecikmeli
  pub ice_aktarimlar: Vec<String>,
  /// Yalnız gecikmeli yüklenenler (ilk çağrıda yüklenir; eksikse açılışta değil kullanımda patlar)
  pub gecikmeli: Vec<String>,
  /// Gömülü Authenticode bloğu var mı (doğrulama ayrı: `imza` modülü)
  pub imza_blogu: bool,
  /// .NET derlemesi (CLR başlığı) — OBS eklentisi olamaz
  pub net: bool,
}

const AZAMI_BOLUM: usize = 96;
const AZAMI_AD: usize = 20_000;
const AZAMI_ICE: usize = 2_000;

struct Okuyucu<'a> {
  b: &'a [u8],
}

impl<'a> Okuyucu<'a> {
  fn u16(&self, o: usize) -> Result<u16, String> {
    self.b.get(o..o + 2).map(|x| u16::from_le_bytes([x[0], x[1]])).ok_or_else(|| format!("dosya kısa (@{o:#x})"))
  }
  fn u32(&self, o: usize) -> Result<u32, String> {
    self
      .b
      .get(o..o + 4)
      .map(|x| u32::from_le_bytes([x[0], x[1], x[2], x[3]]))
      .ok_or_else(|| format!("dosya kısa (@{o:#x})"))
  }
  /// NUL ile biten ASCII ad (en çok 512 bayt)
  fn ad(&self, o: usize) -> Result<String, String> {
    let dilim = self.b.get(o..).ok_or("ad dosya dışında")?;
    let son = dilim.iter().take(512).position(|c| *c == 0).ok_or("ad sonlanmamış")?;
    Ok(String::from_utf8_lossy(&dilim[..son]).into_owned())
  }
}

#[derive(Clone, Copy)]
struct Bolum {
  sanal: u32,
  sanal_boyut: u32,
  ham: u32,
  ham_boyut: u32,
}

fn rva_ofset(bolumler: &[Bolum], rva: u32) -> Option<usize> {
  bolumler.iter().find_map(|s| {
    let uzunluk = s.sanal_boyut.max(s.ham_boyut);
    (rva >= s.sanal && rva < s.sanal.saturating_add(uzunluk))
      .then(|| (rva - s.sanal) as usize + s.ham as usize)
      .filter(|o| rva - s.sanal < s.ham_boyut && *o < usize::MAX)
  })
}

pub fn ayristir(b: &[u8]) -> Result<PeBilgisi, String> {
  let r = Okuyucu { b };
  if b.get(0..2) != Some(b"MZ") {
    return Err("PE değil (MZ imzası yok)".into());
  }
  let nt = r.u32(0x3C)? as usize;
  if b.get(nt..nt + 4) != Some(b"PE\0\0") {
    return Err("PE değil (PE imzası yok)".into());
  }
  let dosya = nt + 4;
  let makine = r.u16(dosya)?;
  let bolum_sayisi = r.u16(dosya + 2)? as usize;
  let ist_boyut = r.u16(dosya + 16)? as usize;
  let ozellikler = r.u16(dosya + 18)?;
  let ist = dosya + 20;
  let sihir = r.u16(ist)?;
  let pe32_arti = match sihir {
    0x20B => true,
    0x10B => false,
    s => return Err(format!("bilinmeyen isteğe bağlı başlık ({s:#x})")),
  };
  let (dizin_sayisi_ofs, dizin_ofs) = if pe32_arti { (ist + 108, ist + 112) } else { (ist + 92, ist + 96) };
  let dizin_sayisi = (r.u32(dizin_sayisi_ofs)? as usize).min(16);
  let dizin = |i: usize| -> Result<(u32, u32), String> {
    if i >= dizin_sayisi {
      return Ok((0, 0));
    }
    Ok((r.u32(dizin_ofs + i * 8)?, r.u32(dizin_ofs + i * 8 + 4)?))
  };

  if bolum_sayisi > AZAMI_BOLUM {
    return Err(format!("bölüm sayısı olağandışı ({bolum_sayisi})"));
  }
  let bolum_ofs = ist + ist_boyut;
  let mut bolumler = Vec::with_capacity(bolum_sayisi);
  for i in 0..bolum_sayisi {
    let o = bolum_ofs + i * 40;
    bolumler.push(Bolum { sanal_boyut: r.u32(o + 8)?, sanal: r.u32(o + 12)?, ham_boyut: r.u32(o + 16)?, ham: r.u32(o + 20)? });
  }

  // Dışa aktarımlar (dizin 0)
  let mut disa = Vec::new();
  let (e_rva, e_boyut) = dizin(0)?;
  if e_rva != 0 && e_boyut != 0 {
    if let Some(e) = rva_ofset(&bolumler, e_rva) {
      let ad_sayisi = (r.u32(e + 24)? as usize).min(AZAMI_AD);
      let adlar_rva = r.u32(e + 32)?;
      if let Some(adlar) = rva_ofset(&bolumler, adlar_rva) {
        for i in 0..ad_sayisi {
          let ad_rva = r.u32(adlar + i * 4)?;
          if let Some(o) = rva_ofset(&bolumler, ad_rva) {
            disa.push(r.ad(o)?);
          }
        }
      }
    }
  }
  disa.sort();
  disa.dedup();

  // İçe aktarımlar (dizin 1): IMAGE_IMPORT_DESCRIPTOR, 20 bayt, sıfırla biter
  let mut ice = Vec::new();
  let (i_rva, _) = dizin(1)?;
  if i_rva != 0 {
    if let Some(mut o) = rva_ofset(&bolumler, i_rva) {
      for _ in 0..AZAMI_ICE {
        let ad_rva = r.u32(o + 12)?;
        let ilk = r.u32(o + 16)?;
        if ad_rva == 0 && ilk == 0 {
          break;
        }
        if let Some(a) = rva_ofset(&bolumler, ad_rva) {
          ice.push(r.ad(a)?.to_lowercase());
        }
        o += 20;
      }
    }
  }
  // Gecikmeli içe aktarımlar (dizin 13): IMAGE_DELAYLOAD_DESCRIPTOR, 32 bayt; ad RVA'sı 4. baytta
  let mut gecikmeli = Vec::new();
  let (g_rva, _) = dizin(13)?;
  if g_rva != 0 {
    if let Some(mut o) = rva_ofset(&bolumler, g_rva) {
      for _ in 0..AZAMI_ICE {
        let oznitelik = r.u32(o)?;
        let ad_rva = r.u32(o + 4)?;
        if ad_rva == 0 {
          break;
        }
        // Eski (VC6) biçimde adresler RVA değil VA'dır; bu durumda atlanır
        if oznitelik & 1 == 1 {
          if let Some(a) = rva_ofset(&bolumler, ad_rva) {
            gecikmeli.push(r.ad(a)?.to_lowercase());
          }
        }
        o += 32;
      }
    }
  }
  gecikmeli.sort();
  gecikmeli.dedup();
  ice.extend(gecikmeli.iter().cloned());
  ice.sort();
  ice.dedup();

  // Güvenlik dizini (4): RVA değil DOSYA ofsetidir
  let (s_ofs, s_boyut) = dizin(4)?;
  let imza_blogu = s_ofs != 0 && s_boyut >= 8 && (s_ofs as usize).saturating_add(s_boyut as usize) <= b.len();
  let (clr, _) = dizin(14)?;

  Ok(PeBilgisi {
    mimari: Mimari::makineden(makine),
    makine,
    dll: ozellikler & 0x2000 != 0,
    pe32_arti,
    disa_aktarimlar: disa,
    ice_aktarimlar: ice,
    gecikmeli,
    imza_blogu,
    net: clr != 0,
  })
}

/// libobs'un eklenti sayması için zorunlu dışa aktarımlar (obs-module.c `load_module_exports`).
pub const ZORUNLU_DISA: [&str; 3] = ["obs_module_load", "obs_module_set_pointer", "obs_module_ver"];

impl PeBilgisi {
  pub fn obs_eklentisi(&self) -> bool {
    self.disa_aktarimlar.iter().any(|x| x == "obs_module_load")
  }

  pub fn eksik_zorunlu(&self) -> Vec<&'static str> {
    ZORUNLU_DISA.iter().copied().filter(|z| !self.disa_aktarimlar.iter().any(|x| x == z)).collect()
  }

  pub fn ice_aktarir(&self, dll: &str) -> bool {
    self.ice_aktarimlar.iter().any(|x| x == dll)
  }
}

#[cfg(test)]
pub(crate) mod tests {
  use super::*;

  /// Sınama için en küçük PE: tek bölüm, isteğe bağlı olarak dışa aktarım ve içe aktarım tabloları.
  pub(crate) fn kucuk_pe(makine: u16, disa: &[&str], ice: &[&str]) -> Vec<u8> {
    const BOLUM_RVA: u32 = 0x1000;
    const BOLUM_HAM: u32 = 0x200;
    let mut veri = vec![0u8; 0x800];
    // Bölüm içeriği: [dışa aktarım dizini 40 B][ad işaretçileri][içe aktarım tanımlayıcıları][adlar]
    let yaz_ad = |veri: &mut Vec<u8>, imlec: &mut usize, s: &str| -> u32 {
      let rva = BOLUM_RVA + *imlec as u32;
      veri[*imlec..*imlec + s.len()].copy_from_slice(s.as_bytes());
      *imlec += s.len() + 1;
      rva
    };
    let mut imlec = 0x300usize;
    let disa_rva = BOLUM_RVA;
    let isaretci_ofs = 40usize;
    let mut ad_rvalari = Vec::new();
    for a in disa {
      ad_rvalari.push(yaz_ad(&mut veri, &mut imlec, a));
    }
    veri[24..28].copy_from_slice(&(disa.len() as u32).to_le_bytes());
    veri[32..36].copy_from_slice(&(BOLUM_RVA + isaretci_ofs as u32).to_le_bytes());
    for (i, r) in ad_rvalari.iter().enumerate() {
      veri[isaretci_ofs + i * 4..isaretci_ofs + i * 4 + 4].copy_from_slice(&r.to_le_bytes());
    }
    let ice_ofs = 0x100usize;
    for (i, dll) in ice.iter().enumerate() {
      let r = yaz_ad(&mut veri, &mut imlec, dll);
      let o = ice_ofs + i * 20;
      veri[o + 12..o + 16].copy_from_slice(&r.to_le_bytes());
      veri[o + 16..o + 20].copy_from_slice(&1u32.to_le_bytes());
    }

    let mut b = vec![0u8; BOLUM_HAM as usize];
    b[0..2].copy_from_slice(b"MZ");
    b[0x3C..0x40].copy_from_slice(&0x80u32.to_le_bytes());
    b[0x80..0x84].copy_from_slice(b"PE\0\0");
    let f = 0x84;
    b[f..f + 2].copy_from_slice(&makine.to_le_bytes());
    b[f + 2..f + 4].copy_from_slice(&1u16.to_le_bytes());
    b[f + 16..f + 18].copy_from_slice(&240u16.to_le_bytes());
    b[f + 18..f + 20].copy_from_slice(&0x2022u16.to_le_bytes());
    let o = f + 20;
    b[o..o + 2].copy_from_slice(&0x20Bu16.to_le_bytes());
    b[o + 108..o + 112].copy_from_slice(&16u32.to_le_bytes());
    if !disa.is_empty() {
      b[o + 112..o + 116].copy_from_slice(&disa_rva.to_le_bytes());
      b[o + 116..o + 120].copy_from_slice(&40u32.to_le_bytes());
    }
    if !ice.is_empty() {
      b[o + 120..o + 124].copy_from_slice(&(BOLUM_RVA + ice_ofs as u32).to_le_bytes());
      b[o + 124..o + 128].copy_from_slice(&((ice.len() as u32 + 1) * 20).to_le_bytes());
    }
    let s = o + 240;
    b[s..s + 5].copy_from_slice(b".data");
    b[s + 8..s + 12].copy_from_slice(&(veri.len() as u32).to_le_bytes());
    b[s + 12..s + 16].copy_from_slice(&BOLUM_RVA.to_le_bytes());
    b[s + 16..s + 20].copy_from_slice(&(veri.len() as u32).to_le_bytes());
    b[s + 20..s + 24].copy_from_slice(&BOLUM_HAM.to_le_bytes());
    b.extend_from_slice(&veri);
    b
  }

  #[test]
  fn kucuk_pe_ayristirilir() {
    let b = kucuk_pe(0x8664, &["obs_module_ver", "obs_module_load", "obs_module_set_pointer"], &["OBS.dll", "KERNEL32.dll"]);
    let p = ayristir(&b).unwrap();
    assert_eq!(p.mimari, Mimari::X64);
    assert!(p.dll && p.pe32_arti && !p.imza_blogu && !p.net);
    assert_eq!(p.disa_aktarimlar, ["obs_module_load", "obs_module_set_pointer", "obs_module_ver"]);
    assert_eq!(p.ice_aktarimlar, ["kernel32.dll", "obs.dll"]);
    assert!(p.obs_eklentisi() && p.eksik_zorunlu().is_empty());
  }

  #[test]
  fn mimari_ve_eksik_disa_aktarim() {
    let p = ayristir(&kucuk_pe(0x014c, &["obs_module_load"], &[])).unwrap();
    assert_eq!(p.mimari, Mimari::X86);
    assert_eq!(p.eksik_zorunlu(), ["obs_module_set_pointer", "obs_module_ver"]);
    let p = ayristir(&kucuk_pe(0xAA64, &[], &[])).unwrap();
    assert_eq!(p.mimari, Mimari::Arm64);
    assert!(!p.obs_eklentisi());
  }

  #[test]
  fn bozuk_girdi_panik_yerine_hata() {
    assert!(ayristir(b"").is_err());
    assert!(ayristir(b"MZ").is_err());
    let mut b = kucuk_pe(0x8664, &["a"], &["b.dll"]);
    b.truncate(0x100);
    assert!(ayristir(&b).is_err());
    // Rastgele baytlar: hiçbir girdi panik atmamalı
    let mut tohum = 0x1234_5678u32;
    for _ in 0..300 {
      let mut v = kucuk_pe(0x8664, &["obs_module_load"], &["obs.dll"]);
      for _ in 0..8 {
        tohum = tohum.wrapping_mul(1_103_515_245).wrapping_add(12345);
        let i = (tohum as usize) % v.len();
        v[i] = (tohum >> 16) as u8;
      }
      let _ = ayristir(&v);
    }
  }

  #[cfg(windows)]
  #[test]
  fn gercek_sistem_dll() {
    let yol = std::path::Path::new(&std::env::var("SystemRoot").unwrap_or_else(|_| r"C:\Windows".into()))
      .join("System32")
      .join("kernel32.dll");
    let p = ayristir(&std::fs::read(yol).unwrap()).unwrap();
    assert_eq!(p.mimari, Mimari::X64);
    assert!(p.disa_aktarimlar.iter().any(|x| x == "LoadLibraryW"));
    assert!(!p.obs_eklentisi());
  }
}
