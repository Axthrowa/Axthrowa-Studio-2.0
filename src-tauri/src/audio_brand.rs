//! Windows ses karıştırıcısında WebView2 oturumunu uygulama adı + logosuyla gösterme.
//!
//! Sessiz WASAPI oturumu açılmıyor: bazı sürücülerde başlangıçta ses cihazını
//! kilitleyip uygulamayı bozabiliyor. Yalnızca gerçek (WebView2) oturumları
//! etiketleniyor.

#![cfg(windows)]

use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use std::time::Duration;

use windows::core::{Interface, GUID, HRESULT, PCWSTR};
use windows::Win32::Foundation::CloseHandle;
use windows::Win32::Media::Audio::{
  eConsole, eMultimedia, eRender, IAudioSessionControl, IAudioSessionControl2,
  IAudioSessionManager2, IMMDeviceEnumerator, MMDeviceEnumerator,
};
use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED};
use windows::Win32::System::Diagnostics::ToolHelp::{
  CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
};
use windows::Win32::System::Threading::GetCurrentProcessId;
use windows::Win32::UI::Shell::SetCurrentProcessExplicitAppUserModelID;

static BASLATILDI: OnceLock<()> = OnceLock::new();

const GRUP: GUID = GUID::from_u128(0xA7E1_9B2C_4D5F_8A01_9C3E_F0D1_2B44);
const ICON_BYTES: &[u8] = include_bytes!("../icons/icon.ico");

pub fn start(display_name: &str, icon_path: Option<PathBuf>) {
  if BASLATILDI.set(()).is_err() {
    return;
  }

  let aumid: Vec<u16> = "com.axthrowa.yayin-yonetim-araci\0"
    .encode_utf16()
    .collect();
  unsafe {
    let _ = SetCurrentProcessExplicitAppUserModelID(PCWSTR(aumid.as_ptr()));
  }

  let ad = display_name.to_string();
  let ikon = icon_path
    .filter(|p| p.exists() && uzanti_ico(p))
    .or_else(ikon_dosyasini_hazirla);

  std::thread::Builder::new()
    .name("audio-brand".into())
    .spawn(move || {
      // Pencere / WebView ayağa kalksın; COM yarışını azalt.
      std::thread::sleep(Duration::from_secs(2));
      let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| etiket_dongusu(ad, ikon)));
    })
    .ok();
}

fn uzanti_ico(p: &Path) -> bool {
  p.extension()
    .and_then(|e| e.to_str())
    .map(|e| e.eq_ignore_ascii_case("ico"))
    .unwrap_or(false)
}

fn ikon_dosyasini_hazirla() -> Option<PathBuf> {
  let dir = {
    let base = std::env::var_os("LOCALAPPDATA")?;
    PathBuf::from(base).join("YayinYonetimAraci")
  };
  let _ = std::fs::create_dir_all(&dir);
  let yol = dir.join("app-icon.ico");
  let mevcut_boyut = std::fs::metadata(&yol).map(|m| m.len()).unwrap_or(0);
  if mevcut_boyut != ICON_BYTES.len() as u64 {
    std::fs::write(&yol, ICON_BYTES).ok()?;
  }
  Some(yol)
}

fn etiket_dongusu(display_name: String, icon_path: Option<PathBuf>) {
  unsafe {
    let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
  }

  let bizim_pid = unsafe { GetCurrentProcessId() };
  let ad_wide = genis(&display_name);
  let ikon_wide = icon_path.as_ref().map(|p| genis(&normalize_path(p)));

  loop {
    if let Err(e) = unsafe { oturumlari_etiketle(bizim_pid, &ad_wide, ikon_wide.as_deref()) } {
      yya_warn!("ses oturumu etiketlenemedi: {e}");
    }
    std::thread::sleep(Duration::from_millis(1000));
  }
}

unsafe fn oturumlari_etiketle(
  bizim_pid: u32,
  display_name: &[u16],
  icon_path: Option<&[u16]>,
) -> windows::core::Result<()> {
  let enumerator: IMMDeviceEnumerator =
    CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;

  for role in [eMultimedia, eConsole] {
    let device = match enumerator.GetDefaultAudioEndpoint(eRender, role) {
      Ok(d) => d,
      Err(_) => continue,
    };
    let manager: IAudioSessionManager2 = match device.Activate(CLSCTX_ALL, None) {
      Ok(m) => m,
      Err(_) => continue,
    };
    let sessions = match manager.GetSessionEnumerator() {
      Ok(s) => s,
      Err(_) => continue,
    };
    let count = sessions.GetCount().unwrap_or(0);

    for i in 0..count {
      let control: IAudioSessionControl = match sessions.GetSession(i) {
        Ok(c) => c,
        Err(_) => continue,
      };
      let control2: IAudioSessionControl2 = match control.cast() {
        Ok(c) => c,
        Err(_) => continue,
      };

      // S_OK = sistem sesi → atla. S_FALSE = normal. `.is_ok()` kullanma!
      if control2.IsSystemSoundsSession() == HRESULT(0) {
        continue;
      }
      let pid = match control2.GetProcessId() {
        Ok(p) if p != 0 => p,
        _ => continue,
      };
      if !bizimle_ilgili(pid, bizim_pid) {
        continue;
      }

      let _ = control.SetDisplayName(PCWSTR(display_name.as_ptr()), std::ptr::null());
      if let Some(ikon) = icon_path {
        let _ = control.SetIconPath(PCWSTR(ikon.as_ptr()), std::ptr::null());
      }
      let _ = control.SetGroupingParam(&GRUP, std::ptr::null());
    }
  }

  Ok(())
}

fn bizimle_ilgili(pid: u32, bizim_pid: u32) -> bool {
  if pid == bizim_pid || surec_agacimizda(pid, bizim_pid) {
    return true;
  }
  let mut mevcut = pid;
  for _ in 0..24 {
    if let Some(ad) = surec_exe_adi(mevcut) {
      let a = ad.to_ascii_lowercase();
      if a.starts_with("yayinyonetimaraci") || a.starts_with("yayin-yonetim-araci") {
        return true;
      }
    }
    match ust_surec(mevcut) {
      Some(ust) if ust != 0 && ust != mevcut => mevcut = ust,
      _ => break,
    }
  }
  false
}

fn surec_agacimizda(pid: u32, ata: u32) -> bool {
  if pid == ata {
    return true;
  }
  let mut mevcut = pid;
  for _ in 0..24 {
    match ust_surec(mevcut) {
      Some(ust) if ust == ata => return true,
      Some(ust) if ust == 0 || ust == mevcut => return false,
      Some(ust) => mevcut = ust,
      None => return false,
    }
  }
  false
}

fn ust_surec(pid: u32) -> Option<u32> {
  unsafe {
    let snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0).ok()?;
    let mut entry = PROCESSENTRY32W {
      dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
      ..Default::default()
    };
    if Process32FirstW(snap, &mut entry).is_err() {
      let _ = CloseHandle(snap);
      return None;
    }
    loop {
      if entry.th32ProcessID == pid {
        let parent = entry.th32ParentProcessID;
        let _ = CloseHandle(snap);
        return Some(parent);
      }
      if Process32NextW(snap, &mut entry).is_err() {
        break;
      }
    }
    let _ = CloseHandle(snap);
    None
  }
}

fn surec_exe_adi(pid: u32) -> Option<String> {
  unsafe {
    let snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0).ok()?;
    let mut entry = PROCESSENTRY32W {
      dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
      ..Default::default()
    };
    if Process32FirstW(snap, &mut entry).is_err() {
      let _ = CloseHandle(snap);
      return None;
    }
    loop {
      if entry.th32ProcessID == pid {
        let len = entry
          .szExeFile
          .iter()
          .position(|&c| c == 0)
          .unwrap_or(entry.szExeFile.len());
        let ad = String::from_utf16_lossy(&entry.szExeFile[..len]);
        let _ = CloseHandle(snap);
        return Some(ad);
      }
      if Process32NextW(snap, &mut entry).is_err() {
        break;
      }
    }
    let _ = CloseHandle(snap);
    None
  }
}

fn normalize_path(p: &Path) -> String {
  p.canonicalize()
    .unwrap_or_else(|_| p.to_path_buf())
    .to_string_lossy()
    .trim_start_matches(r"\\?\")
    .to_string()
}

fn genis(s: &str) -> Vec<u16> {
  s.encode_utf16().chain(std::iter::once(0)).collect()
}
