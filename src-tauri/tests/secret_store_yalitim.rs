//! Kasa adı geçersiz kılması süreç genelidir; bu yüzden kendi test ikilisinde (ayrı süreç) sınanır.

use yayin_yonetim_araci_lib::secret_store::{delete_secret, get_secret, set_secret, set_service_override};

const GERCEK: &str = "com.axthrowa.yayin-yonetim-araci";

#[test]
fn gecersiz_kilma_gercek_kasaya_dokunmaz() {
  set_service_override("com.axthrowa.yayin-yonetim-araci.yalitim-testi");
  // Benzersiz anahtar: gerçek kasadaki hiçbir kayıt okunmaz.
  let ad = format!("test.yalitim.{}", std::process::id());
  assert!(set_secret(&ad, "deger"), "yazılamadı");
  let gercek = keyring::Entry::new(GERCEK, &ad).unwrap().get_password();
  let yalitilmis = get_secret(&ad);
  delete_secret(&ad);
  assert!(matches!(gercek, Err(keyring::Error::NoEntry)), "sır gerçek kasaya yazıldı");
  assert_eq!(yalitilmis.as_deref(), Some("deger"));
}

/// Başsız düzenek, AppState (ayarlar → kasa) kurulmadan önce kasayı yalıtmalı.
#[test]
fn bassiz_ornek_kasayi_once_yalitir() {
  let kaynak = include_str!("../examples/headless_server.rs");
  let yalitim = kaynak.find("secret_store::set_service_override(").expect("örnek kasayı yalıtmıyor");
  assert!(yalitim < kaynak.find("AppState::new").unwrap());
}
