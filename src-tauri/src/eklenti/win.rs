//! Windows'a özgü salt-okunur denetimler: Authenticode imzası (WinVerifyTrust) ve sürüm kaynağı
//! (GetFileVersionInfo). İkisi de dosyayı VERİ olarak okur; eklenti kodu çalışmaz.
//!
//! İmza doğrulamasında ağ kullanılmaz (iptal denetimi kapalı, yalnız önbellek): eklenti yöneticisi dosya
//! incelerken dışarıya istek göndermez. Bu yüzden "Geçerli" = zincir bu makinede güvenilir bir köke bağlanıyor ve
//! içerik imzadan sonra değişmemiş; iptal edilmiş sertifika ayrıca denetlenmez (belgelerde yazılı).

use serde::Serialize;
use std::path::Path;

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase", tag = "durum")]
pub enum Imza {
  /// Geçerli imza; imzalayanın ortak adı
  Gecerli { imzalayan: String },
  /// Gömülü imza yok
  Imzasiz,
  /// İmza var ama bu makinede güvenilen bir köke bağlanmıyor (öz-imzalı vb.)
  GuvenilmeyenKok { imzalayan: String },
  /// İçerik imzadan sonra değişmiş — dosya kurcalanmış olabilir
  Bozuk,
  /// Sertifika süresi dolmuş ve zaman damgası yok
  SuresiDolmus { imzalayan: String },
  /// Başka bir nedenle doğrulanamadı (HRESULT)
  Dogrulanamadi { kod: String },
}

impl Imza {
  pub fn imzalayan(&self) -> Option<&str> {
    match self {
      Self::Gecerli { imzalayan } | Self::GuvenilmeyenKok { imzalayan } | Self::SuresiDolmus { imzalayan } => Some(imzalayan),
      _ => None,
    }
  }
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SurumBilgisi {
  pub dosya_surumu: Option<String>,
  pub urun_surumu: Option<String>,
  pub sirket: Option<String>,
  pub aciklama: Option<String>,
  pub urun_adi: Option<String>,
}

#[cfg(windows)]
pub fn imza(yol: &Path) -> Imza {
  use std::os::windows::ffi::OsStrExt;
  use windows::core::{GUID, PCWSTR};
  use windows::Win32::Foundation::{HANDLE, HWND};
  use windows::Win32::Security::Cryptography::{CertGetNameStringW, CERT_NAME_SIMPLE_DISPLAY_TYPE};
  use windows::Win32::Security::WinTrust::{
    WTHelperGetProvSignerFromChain, WTHelperProvDataFromStateData, WinVerifyTrust, WINTRUST_ACTION_GENERIC_VERIFY_V2,
    WINTRUST_DATA, WINTRUST_DATA_0, WINTRUST_FILE_INFO, WTD_CACHE_ONLY_URL_RETRIEVAL, WTD_CHOICE_FILE,
    WTD_REVOCATION_CHECK_NONE, WTD_REVOKE_NONE, WTD_STATEACTION_CLOSE, WTD_STATEACTION_VERIFY, WTD_UI_NONE,
  };

  let genis: Vec<u16> = yol.as_os_str().encode_wide().chain(std::iter::once(0)).collect();
  let mut dosya = WINTRUST_FILE_INFO {
    cbStruct: std::mem::size_of::<WINTRUST_FILE_INFO>() as u32,
    pcwszFilePath: PCWSTR(genis.as_ptr()),
    hFile: HANDLE::default(),
    pgKnownSubject: std::ptr::null_mut(),
  };
  let mut veri = WINTRUST_DATA {
    cbStruct: std::mem::size_of::<WINTRUST_DATA>() as u32,
    dwUIChoice: WTD_UI_NONE,
    fdwRevocationChecks: WTD_REVOKE_NONE,
    dwUnionChoice: WTD_CHOICE_FILE,
    Anonymous: WINTRUST_DATA_0 { pFile: &mut dosya },
    dwStateAction: WTD_STATEACTION_VERIFY,
    dwProvFlags: WTD_CACHE_ONLY_URL_RETRIEVAL | WTD_REVOCATION_CHECK_NONE,
    ..Default::default()
  };
  let mut eylem: GUID = WINTRUST_ACTION_GENERIC_VERIFY_V2;
  // SAFETY: yapılar yığında ve çağrı boyunca yaşıyor; durum verisi aşağıda WTD_STATEACTION_CLOSE ile bırakılır.
  let sonuc = unsafe { WinVerifyTrust(HWND(std::ptr::null_mut()), &mut eylem, &mut veri as *mut _ as *mut _) } as u32;

  // İmzalayan adı: sağlayıcı verisinden ilk imzalayanın zincirindeki yaprak sertifika
  let imzalayan = unsafe {
    let pd = WTHelperProvDataFromStateData(veri.hWVTStateData);
    let mut ad = String::new();
    if !pd.is_null() {
      let sg = WTHelperGetProvSignerFromChain(pd, 0, false, 0);
      if let Some(sg) = sg.as_ref() {
        if sg.csCertChain > 0 && !sg.pasCertChain.is_null() {
          let sert = (*sg.pasCertChain).pCert;
          if !sert.is_null() {
            let mut tampon = [0u16; 256];
            let n = CertGetNameStringW(sert, CERT_NAME_SIMPLE_DISPLAY_TYPE, 0, None, Some(&mut tampon));
            if n > 1 {
              ad = String::from_utf16_lossy(&tampon[..(n as usize - 1)]);
            }
          }
        }
      }
    }
    ad
  };
  veri.dwStateAction = WTD_STATEACTION_CLOSE;
  unsafe {
    WinVerifyTrust(HWND(std::ptr::null_mut()), &mut eylem, &mut veri as *mut _ as *mut _);
  }

  const TRUST_E_NOSIGNATURE: u32 = 0x800B_0100;
  const TRUST_E_SUBJECT_FORM_UNKNOWN: u32 = 0x800B_0003;
  const TRUST_E_BAD_DIGEST: u32 = 0x8009_6010;
  const CERT_E_UNTRUSTEDROOT: u32 = 0x800B_0109;
  const CERT_E_CHAINING: u32 = 0x800B_010A;
  const TRUST_E_EXPLICIT_DISTRUST: u32 = 0x800B_0111;
  const CERT_E_EXPIRED: u32 = 0x800B_0101;
  match sonuc {
    0 => Imza::Gecerli { imzalayan: ad_ya_da_bilinmiyor(imzalayan) },
    TRUST_E_NOSIGNATURE | TRUST_E_SUBJECT_FORM_UNKNOWN => Imza::Imzasiz,
    TRUST_E_BAD_DIGEST => Imza::Bozuk,
    CERT_E_UNTRUSTEDROOT | CERT_E_CHAINING | TRUST_E_EXPLICIT_DISTRUST => {
      Imza::GuvenilmeyenKok { imzalayan: ad_ya_da_bilinmiyor(imzalayan) }
    }
    CERT_E_EXPIRED => Imza::SuresiDolmus { imzalayan: ad_ya_da_bilinmiyor(imzalayan) },
    k => Imza::Dogrulanamadi { kod: format!("0x{k:08X}") },
  }
}

fn ad_ya_da_bilinmiyor(s: String) -> String {
  if s.trim().is_empty() {
    "(adı okunamadı)".into()
  } else {
    s
  }
}

#[cfg(not(windows))]
pub fn imza(_yol: &Path) -> Imza {
  Imza::Dogrulanamadi { kod: "yalnız Windows".into() }
}

#[cfg(windows)]
pub fn surum_bilgisi(yol: &Path) -> SurumBilgisi {
  use std::os::windows::ffi::OsStrExt;
  use windows::core::PCWSTR;
  use windows::Win32::Storage::FileSystem::{GetFileVersionInfoSizeW, GetFileVersionInfoW, VerQueryValueW, VS_FIXEDFILEINFO};

  let genis: Vec<u16> = yol.as_os_str().encode_wide().chain(std::iter::once(0)).collect();
  let mut out = SurumBilgisi::default();
  // SAFETY: GetFileVersionInfo dosyayı veri olarak eşler (LOAD_LIBRARY_AS_DATAFILE); tampon boyutu API'den.
  unsafe {
    let boyut = GetFileVersionInfoSizeW(PCWSTR(genis.as_ptr()), None);
    if boyut == 0 || boyut > 4 * 1024 * 1024 {
      return out;
    }
    let mut tampon = vec![0u8; boyut as usize];
    if GetFileVersionInfoW(PCWSTR(genis.as_ptr()), None, boyut, tampon.as_mut_ptr() as *mut _).is_err() {
      return out;
    }
    let sorgu = |yol: &str| -> Option<(*mut std::ffi::c_void, u32)> {
      let g: Vec<u16> = yol.encode_utf16().chain(std::iter::once(0)).collect();
      let mut p: *mut std::ffi::c_void = std::ptr::null_mut();
      let mut n = 0u32;
      VerQueryValueW(tampon.as_ptr() as *const _, PCWSTR(g.as_ptr()), &mut p, &mut n).as_bool().then_some((p, n))
    };
    if let Some((p, n)) = sorgu("\\") {
      if n as usize >= std::mem::size_of::<VS_FIXEDFILEINFO>() {
        let f = &*(p as *const VS_FIXEDFILEINFO);
        if f.dwSignature == 0xFEEF04BD {
          out.dosya_surumu = Some(format!(
            "{}.{}.{}.{}",
            f.dwFileVersionMS >> 16,
            f.dwFileVersionMS & 0xFFFF,
            f.dwFileVersionLS >> 16,
            f.dwFileVersionLS & 0xFFFF
          ));
        }
      }
    }
    // İlk dil/kod sayfası çifti
    let dil = sorgu("\\VarFileInfo\\Translation").and_then(|(p, n)| {
      (n >= 4).then(|| {
        let d = std::slice::from_raw_parts(p as *const u16, 2);
        format!("{:04x}{:04x}", d[0], d[1])
      })
    });
    let metin = |anahtar: &str| -> Option<String> {
      let d = dil.clone()?;
      let (p, n) = sorgu(&format!("\\StringFileInfo\\{d}\\{anahtar}"))?;
      if n == 0 {
        return None;
      }
      let s = std::slice::from_raw_parts(p as *const u16, n as usize);
      let s = String::from_utf16_lossy(s).trim_end_matches('\0').trim().to_string();
      (!s.is_empty()).then(|| s.chars().take(200).collect())
    };
    out.urun_surumu = metin("ProductVersion");
    out.sirket = metin("CompanyName");
    out.aciklama = metin("FileDescription");
    out.urun_adi = metin("ProductName");
  }
  out
}

#[cfg(not(windows))]
pub fn surum_bilgisi(_yol: &Path) -> SurumBilgisi {
  SurumBilgisi::default()
}

#[cfg(all(test, windows))]
mod tests {
  use super::*;

  #[test]
  fn imzasiz_ve_sistem_dosyasi() {
    // Kendi test eklentimiz imzasız derlenir (varsa)
    let test = Path::new(env!("CARGO_MANIFEST_DIR")).join("../motor/test-eklentileri/target/release/yym_test_kaynak.dll");
    if test.is_file() {
      assert_eq!(imza(&test), Imza::Imzasiz);
    }
    // Olmayan dosya panik atmaz
    let _ = imza(Path::new(r"C:\yok\yok.dll"));
    let s = surum_bilgisi(&Path::new(&std::env::var("SystemRoot").unwrap_or_else(|_| r"C:\Windows".into())).join("System32\\kernel32.dll"));
    assert!(s.dosya_surumu.is_some());
    assert!(s.sirket.as_deref().unwrap_or("").contains("Microsoft"));
  }

  #[test]
  fn obs_kurulu_ise_birinci_taraf_imzasi_okunur() {
    let d = Path::new(r"C:\Program Files\obs-studio\obs-plugins\64bit\obs-ffmpeg.dll");
    if d.is_file() {
      match imza(d) {
        Imza::Gecerli { imzalayan } => assert!(imzalayan.contains("OBS"), "{imzalayan}"),
        diger => panic!("beklenmeyen: {diger:?}"),
      }
    }
  }
}
