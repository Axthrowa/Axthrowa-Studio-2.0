//! Günlük makroları. Eskiden yalnız geliştirme derlemesinde ekrana yazılıyordu: dağıtılan sürümde 155 günlük
//! satırının hiçbiri kaydedilmiyordu. Artık `log` üzerinden `tauri-plugin-log`a gider (`data/logs/axthrowa.log`,
//! döndürmeli; belirteç benzeri sözcükler gizlenir — bkz. lib.rs `gunluk_eklentisi`).

#[macro_export]
macro_rules! yya_log {
  ($($arg:tt)*) => {{
    log::info!($($arg)*);
  }};
}

#[macro_export]
macro_rules! yya_warn {
  ($($arg:tt)*) => {{
    log::warn!($($arg)*);
  }};
}
