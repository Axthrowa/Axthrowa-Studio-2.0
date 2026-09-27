//! Test eklentilerinin ortak parçası: OBS modülü olmak için gereken üç zorunlu dışa aktarım
//! (`obs_module_load` hariç — o her eklentide ayrı) ve obs.dll bağlantısı.
//!
//! Kaynak: libobs/obs-module.h (OBS 32.2.2) — `OBS_DECLARE_MODULE()`: `obs_module_set_pointer`, `obs_module_ver`,
//! `obs_current_module`. libobs `obs_module_load`, `obs_module_set_pointer`, `obs_module_ver` bulamazsa modülü
//! "OBS eklentisi değil" sayar (obs-module.c `load_module_exports`).

use std::ffi::c_void;
use std::sync::atomic::{AtomicPtr, Ordering};

static MODUL: AtomicPtr<c_void> = AtomicPtr::new(std::ptr::null_mut());

/// LIBOBS_API_VER = (ana << 24) | (ara << 16) | yama — obs-config.h
pub const fn api_surumu(ana: u32, ara: u32, yama: u32) -> u32 {
  (ana << 24) | (ara << 16) | yama
}

#[no_mangle]
pub extern "C" fn obs_module_set_pointer(m: *mut c_void) {
  MODUL.store(m, Ordering::SeqCst);
}

#[no_mangle]
pub extern "C" fn obs_current_module() -> *mut c_void {
  MODUL.load(Ordering::SeqCst)
}
