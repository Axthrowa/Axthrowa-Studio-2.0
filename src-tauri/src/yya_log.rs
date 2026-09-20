//! Üretimde stdout/stderr sızıntısını kesen geliştirme günlüğü.

#[macro_export]
macro_rules! yya_log {
  ($($arg:tt)*) => {{
    if cfg!(debug_assertions) {
      println!($($arg)*);
    }
  }};
}

#[macro_export]
macro_rules! yya_warn {
  ($($arg:tt)*) => {{
    if cfg!(debug_assertions) {
      eprintln!($($arg)*);
    }
  }};
}
