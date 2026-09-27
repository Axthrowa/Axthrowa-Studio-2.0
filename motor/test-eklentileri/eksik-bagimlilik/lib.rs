//! yym_test_eksik_bagimlilik — var olmayan bir DLL'e (yym-olmayan-kutuphane.dll) bağlanır. Windows yükleyicisi
//! içe aktarımları LoadLibrary anında çözdüğü için modül hiç açılamaz (libobs: MODULE_FAILED_TO_OPEN). Statik
//! çözümleyici eksik bağımlılığı ADIYLA göstermeli.

#[path = "../ortak.rs"]
mod ortak;

#[link(name = "yym-olmayan-kutuphane", kind = "raw-dylib")]
extern "C" {
  fn yym_olmayan_islev() -> i32;
}

#[no_mangle]
pub extern "C" fn obs_module_ver() -> u32 {
  ortak::api_surumu(32, 0, 0)
}

#[no_mangle]
pub extern "C" fn obs_module_load() -> bool {
  // İçe aktarım tablosunda kalması için başvurulur; çalışma anında bu dala hiç gelinmez (modül açılamaz)
  if std::env::var_os("YYM_TEST_ASLA_TANIMLI_DEGIL").is_some() {
    return unsafe { yym_olmayan_islev() } == 0;
  }
  true
}
