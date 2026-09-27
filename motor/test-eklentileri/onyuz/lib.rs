//! yym_test_onyuz — OBS ön yüz API'sine (obs-frontend-api.dll) bağlanır; araç menüsü öğesi ekleyen eklentiler gibi.
//! Bizim motorumuzda OBS'in Qt ön yüzü yoktur: ön yüz işlevleri geri çağrı olmadan "no callbacks" günlüğüyle boş
//! döner (frontend/api/obs-frontend-api.cpp `callbacks_valid_`). Sınıflandırma FRONTEND_DEPENDENT olmalı.

#[path = "../ortak.rs"]
mod ortak;

use std::ffi::c_void;

#[link(name = "obs-frontend-api", kind = "raw-dylib")]
extern "C" {
  fn obs_frontend_get_current_scene() -> *mut c_void;
}

#[no_mangle]
pub extern "C" fn obs_module_ver() -> u32 {
  ortak::api_surumu(32, 0, 0)
}

#[no_mangle]
pub extern "C" fn obs_module_load() -> bool {
  // Gerçek ön yüz eklentileri burada dock/menü kurar; test yalnız bağımlılığı taşır
  if std::env::var_os("YYM_TEST_ASLA_TANIMLI_DEGIL").is_some() {
    return !unsafe { obs_frontend_get_current_scene() }.is_null();
  }
  true
}
