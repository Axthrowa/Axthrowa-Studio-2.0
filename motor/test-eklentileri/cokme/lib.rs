//! yym_test_cokme — `obs_module_load` içinde geçersiz adrese yazar (erişim ihlali, 0xC0000005). Çökme bekçisi,
//! "şüpheli eklenti" tespiti, güvenli kip ve karantina bununla sınanır. Yalnız test düzeneğinde yüklenir.

#[path = "../ortak.rs"]
mod ortak;

#[no_mangle]
pub extern "C" fn obs_module_ver() -> u32 {
  ortak::api_surumu(32, 0, 0)
}

#[no_mangle]
pub extern "C" fn obs_module_name() -> *const std::ffi::c_char {
  c"YYM test: açılışta çöken eklenti".as_ptr()
}

#[no_mangle]
pub extern "C" fn obs_module_load() -> bool {
  // Bilerek: yüklemede süreç düşer. `black_box` derleyicinin bu yazmayı atmasını engeller.
  let adres = std::hint::black_box(0x10usize) as *mut u32;
  unsafe { std::ptr::write_volatile(adres, 1) };
  true
}
