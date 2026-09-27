//! Windows: uygulama bildirimini (manifest) exe'ye gömer. Windows 10 uyumluluğu bildirilmezse `GetVersionEx` Windows 8
//! döndürür ve OBS'in tarayıcı kaynağı (CEF/Chromium) başlatılırken sürüm denetiminde süreç durur.

fn main() {
  println!("cargo:rerun-if-changed=kaynaklar/yayin-motoru.manifest");
  let hedef_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
  let hedef_env = std::env::var("CARGO_CFG_TARGET_ENV").unwrap_or_default();
  if hedef_os == "windows" && hedef_env == "msvc" {
    let yol = std::path::Path::new(&std::env::var("CARGO_MANIFEST_DIR").unwrap()).join("kaynaklar").join("yayin-motoru.manifest");
    println!("cargo:rustc-link-arg-bins=/MANIFEST:EMBED");
    println!("cargo:rustc-link-arg-bins=/MANIFESTINPUT:{}", yol.display());
  }
}
