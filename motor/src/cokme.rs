//! Yakalanmamış istisna kaydı: motor (ya da içine yüklenen bir modül) çökerse, süreç kapanmadan önce istisna kodu ve
//! adresin düştüğü modül (dosya adı + ofset) stderr'e ve libobs günlüğüne yazılır. Panel stderr'in son satırlarını
//! tanılamaya ekler; böylece "hangi eklenti çöktü" sorusu tahminle değil, gözlemle yanıtlanır.
//!
//! Filtre yalnız okur ve yazar; istisnayı işlemez (`EXCEPTION_CONTINUE_SEARCH`): süreç her zamanki gibi sonlanır.

#[cfg(windows)]
mod win {
  use std::ffi::c_void;

  #[repr(C)]
  struct IstisnaKaydi {
    kod: u32,
    bayraklar: u32,
    onceki: *mut IstisnaKaydi,
    adres: *mut c_void,
    parametre_sayisi: u32,
    bilgi: [usize; 15],
  }

  #[repr(C)]
  struct IstisnaIsaretcileri {
    kayit: *mut IstisnaKaydi,
    baglam: *mut c_void,
  }

  type Filtre = unsafe extern "system" fn(*mut IstisnaIsaretcileri) -> i32;

  #[link(name = "kernel32")]
  extern "system" {
    fn SetUnhandledExceptionFilter(f: Option<Filtre>) -> Option<Filtre>;
    fn GetModuleHandleExW(bayraklar: u32, adres: *const c_void, modul: *mut *mut c_void) -> i32;
    fn GetModuleFileNameW(modul: *mut c_void, tampon: *mut u16, boyut: u32) -> u32;
  }

  const GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT: u32 = 0x2;
  const GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS: u32 = 0x4;
  const EXCEPTION_CONTINUE_SEARCH: i32 = 0;

  /// Adresin ait olduğu modülün dosya adı ve modül içi ofset
  pub(super) fn modul_ve_ofset(adres: *const c_void) -> (String, usize) {
    let mut h: *mut c_void = std::ptr::null_mut();
    unsafe {
      if GetModuleHandleExW(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS | GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT, adres, &mut h) == 0 {
        return ("?".into(), adres as usize);
      }
      let mut tampon = [0u16; 520];
      let n = GetModuleFileNameW(h, tampon.as_mut_ptr(), tampon.len() as u32) as usize;
      let yol = String::from_utf16_lossy(&tampon[..n.min(tampon.len())]);
      let ad = yol.rsplit(['\\', '/']).next().unwrap_or(&yol).to_string();
      (ad, (adres as usize).wrapping_sub(h as usize))
    }
  }

  unsafe extern "system" fn filtre(p: *mut IstisnaIsaretcileri) -> i32 {
    let Some(kayit) = p.as_ref().and_then(|p| p.kayit.as_ref()) else {
      return EXCEPTION_CONTINUE_SEARCH;
    };
    let (modul, ofset) = modul_ve_ofset(kayit.adres);
    let satir = format!("[ÇÖKME] istisna 0x{:08X} — modül {modul} +0x{ofset:X}", kayit.kod);
    eprintln!("{satir}");
    crate::obs::gunluge_yaz(&satir);
    EXCEPTION_CONTINUE_SEARCH
  }

  pub(super) fn kur() {
    unsafe { SetUnhandledExceptionFilter(Some(filtre)) };
  }
}

/// Filtreyi kurar (süreç başında bir kez).
pub fn kur() {
  #[cfg(windows)]
  win::kur();
}

#[cfg(all(test, windows))]
mod tests {
  #[test]
  fn kendi_adresimizin_modulu_bulunur() {
    let (ad, ofset) = super::win::modul_ve_ofset(kendi_adresimizin_modulu_bulunur as *const std::ffi::c_void);
    assert!(ad.to_lowercase().ends_with(".exe"), "{ad}");
    assert!(ofset > 0);
  }
}
