//! Aynı anda tek uygulama örneği.
//!
//! İkinci başlatma 8843 portunu bağlayamaz; HTTP ölür, arayüz yarım kalır.
//! Mutex ile ikinci örneği engelleyip mevcut pencereyi öne getiriyoruz.

#![cfg(windows)]

use windows::core::PCWSTR;
use windows::Win32::Foundation::{CloseHandle, GetLastError, ERROR_ALREADY_EXISTS};
use windows::Win32::System::Threading::CreateMutexW;
use windows::Win32::UI::WindowsAndMessaging::{
  FindWindowW, SetForegroundWindow, ShowWindow, SW_RESTORE,
};

/// `true` = bu süreç devam etsin. `false` = zaten çalışıyor, çık.
pub fn claim() -> bool {
  let name: Vec<u16> = "Local\\YayinYonetimAraci_SingleInstance\0"
    .encode_utf16()
    .collect();
  unsafe {
    let handle = match CreateMutexW(None, true, PCWSTR(name.as_ptr())) {
      Ok(h) => h,
      Err(_) => return true,
    };
    if GetLastError() == ERROR_ALREADY_EXISTS {
      one_getir();
      let _ = CloseHandle(handle);
      return false;
    }
    // HANDLE Copy'dir; Drop CloseHandle çağırmaz. Kasten kapatmıyoruz —
    // süreç bitince OS mutex'i bırakır. Kapatırsak ikinci örnek açılır.
    let _ = handle;
    true
  }
}

fn one_getir() {
  let title: Vec<u16> = "Yayın Yönetim Aracı\0".encode_utf16().collect();
  unsafe {
    // Sınıf adı bilinmiyor; başlıkla bul.
    if let Ok(hwnd) = FindWindowW(PCWSTR::null(), PCWSTR(title.as_ptr())) {
      let _ = ShowWindow(hwnd, SW_RESTORE);
      let _ = SetForegroundWindow(hwnd);
    }
  }
}
