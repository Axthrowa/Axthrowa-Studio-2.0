//! yym_test_yeni_surum — libobs 99.0 için derlenmiş gibi davranır. libobs (obs-module.c `obs_open_module`) ana/ara
//! sürümü kendisinden yeni olan modülü reddeder: MODULE_INCOMPATIBLE_VER → OBS_VERSION_MISMATCH.

#[path = "../ortak.rs"]
mod ortak;

#[no_mangle]
pub extern "C" fn obs_module_ver() -> u32 {
  ortak::api_surumu(99, 0, 0)
}

#[no_mangle]
pub extern "C" fn obs_module_load() -> bool {
  true
}
