//! Aynı anda tek uygulama örneği.
//!
//! İkinci başlatma 8843 portunu bağlayamaz; HTTP ölür, arayüz yarım kalır.
//! Mutex ile ikinci örneği engelleyip mevcut pencereyi öne getiriyoruz.

#![cfg(windows)]

use windows::core::PCWSTR;
use windows::Win32::Foundation::{CloseHandle, GetLastError, ERROR_ALREADY_EXISTS};
use windows::Win32::System::Threading::CreateMutexW;
use windows::Win32::UI::WindowsAndMessaging::{
  FindWindowW, MessageBoxW, SetForegroundWindow, ShowWindow, MB_ICONWARNING, MB_OK, SW_RESTORE,
};

/// Eski adla kurulu sürümün kilidi. Ad değişince kilit de değişti: iki sürüm birlikte açılabiliyordu,
/// eski pencere yeni sunucuya bağlanıp eski sürüm numarasını gösteriyor, sayfaları yüklenemiyordu.
const ESKI_KILIT: &str = "Local\\YayinYonetimAraci_SingleInstance\0";

/// `true` = bu süreç devam etsin. `false` = zaten çalışıyor, çık.
pub fn claim() -> bool {
  if kilit_var("Local\\AxthrowAStudio_SingleInstance\0") {
    one_getir();
    return false;
  }
  if kilit_var(ESKI_KILIT) {
    let baslik: Vec<u16> = "AxthrowA Studio\0".encode_utf16().collect();
    let metin: Vec<u16> = "Yayın Yönetim Aracı'nın eski sürümü hâlâ açık (görev çubuğunun sağındaki simgeye de bak).\n\nÖnce onu kapat, sonra AxthrowA Studio'yu yeniden aç.\0"
      .encode_utf16()
      .collect();
    unsafe {
      let _ = MessageBoxW(None, PCWSTR(metin.as_ptr()), PCWSTR(baslik.as_ptr()), MB_OK | MB_ICONWARNING);
    }
    return false;
  }
  true
}

/// Kilidi alır; başka süreç tutuyorsa `true`.
fn kilit_var(ad: &str) -> bool {
  let name: Vec<u16> = ad.encode_utf16().collect();
  unsafe {
    let handle = match CreateMutexW(None, true, PCWSTR(name.as_ptr())) {
      Ok(h) => h,
      Err(_) => return false,
    };
    if GetLastError() == ERROR_ALREADY_EXISTS {
      let _ = CloseHandle(handle);
      return true;
    }
    // HANDLE Copy'dir; Drop CloseHandle çağırmaz. Kasten kapatmıyoruz —
    // süreç bitince OS mutex'i bırakır. Kapatırsak ikinci örnek açılır.
    let _ = handle;
    false
  }
}

fn one_getir() {
  let title: Vec<u16> = "AxthrowA Studio\0".encode_utf16().collect();
  unsafe {
    // Sınıf adı bilinmiyor; başlıkla bul.
    if let Ok(hwnd) = FindWindowW(PCWSTR::null(), PCWSTR(title.as_ptr())) {
      let _ = ShowWindow(hwnd, SW_RESTORE);
      let _ = SetForegroundWindow(hwnd);
    }
  }
}
