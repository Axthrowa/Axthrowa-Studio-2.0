//! Windows ses karıştırıcısında WebView2 oturumunu uygulama adı + logosuyla gösterme.
//!
//! Sessiz WASAPI oturumu açılmıyor: bazı sürücülerde başlangıçta ses cihazını
//! kilitleyip uygulamayı bozabiliyor. Yalnızca gerçek (WebView2) oturumları
//! etiketleniyor.

#![cfg(windows)]

use std::collections::{HashMap, HashSet};
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

  let aumid: Vec<u16> = "com.axthrowa.studio\0"
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
    PathBuf::from(base).join("AxthrowAStudio")
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

  let mut kararlar = HashMap::new();
  loop {
    if let Err(e) = unsafe { oturumlari_etiketle(bizim_pid, &ad_wide, ikon_wide.as_deref(), &mut kararlar) } {
      studio_warn!("ses oturumu etiketlenemedi: {e}");
    }
    std::thread::sleep(Duration::from_secs(3));
  }
}

unsafe fn oturumlari_etiketle(
  bizim_pid: u32,
  display_name: &[u16],
  icon_path: Option<&[u16]>,
  kararlar: &mut HashMap<u32, bool>,
) -> windows::core::Result<()> {
  let mut tablo = None;
  let mut gorulen = HashSet::new();
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
      gorulen.insert(pid);
      // Sürecin atası değişmez: karar süreç yaşadıkça geçerli, yeniden taranmaz
      let bizim = *kararlar
        .entry(pid)
        .or_insert_with(|| bizimle_ilgili(pid, bizim_pid, tablo.get_or_insert_with(surec_tablosu)));
      if !bizim {
        continue;
      }

      let _ = control.SetDisplayName(PCWSTR(display_name.as_ptr()), std::ptr::null());
      if let Some(ikon) = icon_path {
        let _ = control.SetIconPath(PCWSTR(ikon.as_ptr()), std::ptr::null());
      }
      let _ = control.SetGroupingParam(&GRUP, std::ptr::null());
    }
  }

  kararlar.retain(|pid, _| gorulen.contains(pid));
  Ok(())
}

struct Surec {
  ust: u32,
  ad: String,
}

/// Tüm süreçlerin anlık görüntüsü. Tarama pahalı: yalnız yeni bir oturum süreci görülünce alınır.
fn surec_tablosu() -> HashMap<u32, Surec> {
  let mut tablo = HashMap::new();
  unsafe {
    let Ok(snap) = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) else {
      return tablo;
    };
    let mut entry = PROCESSENTRY32W {
      dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
      ..Default::default()
    };
    if Process32FirstW(snap, &mut entry).is_ok() {
      loop {
        let len = entry.szExeFile.iter().position(|&c| c == 0).unwrap_or(entry.szExeFile.len());
        let ad = String::from_utf16_lossy(&entry.szExeFile[..len]);
        tablo.insert(entry.th32ProcessID, Surec { ust: entry.th32ParentProcessID, ad });
        if Process32NextW(snap, &mut entry).is_err() {
          break;
        }
      }
    }
    let _ = CloseHandle(snap);
  }
  tablo
}

/// Süreç ya da atalarından biri bu uygulama mı (WebView2 alt süreçleri dahil)
fn bizimle_ilgili(pid: u32, bizim_pid: u32, tablo: &HashMap<u32, Surec>) -> bool {
  let mut mevcut = pid;
  for _ in 0..24 {
    if mevcut == bizim_pid {
      return true;
    }
    let Some(s) = tablo.get(&mevcut) else {
      return false;
    };
    let a = s.ad.to_ascii_lowercase();
    if ["axthrowastudio", "axthrowa studio", "axthrowa-studio"].iter().any(|ad| a.starts_with(ad)) {
      return true;
    }
    if s.ust == 0 || s.ust == mevcut {
      return false;
    }
    mevcut = s.ust;
  }
  false
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

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn yalniz_kendi_surec_agacimiz_etiketlenir() {
    let tablo: HashMap<u32, Surec> = [
      (10, Surec { ust: 1, ad: "explorer.exe".into() }),
      (20, Surec { ust: 10, ad: "AxthrowAStudio.exe".into() }),
      (30, Surec { ust: 20, ad: "msedgewebview2.exe".into() }),
      (40, Surec { ust: 10, ad: "Spotify.exe".into() }),
      (50, Surec { ust: 50, ad: "dongu.exe".into() }),
    ]
    .into_iter()
    .map(|(p, s)| (p, s))
    .collect();
    assert!(bizimle_ilgili(30, 999, &tablo), "ad ile ata");
    assert!(bizimle_ilgili(40, 40, &tablo), "kendi kimliğimiz");
    assert!(!bizimle_ilgili(40, 999, &tablo));
    assert!(!bizimle_ilgili(50, 999, &tablo), "kendi kendinin atası: döngü biter");
    assert!(!bizimle_ilgili(77, 999, &tablo), "tabloda yok");
  }
}
