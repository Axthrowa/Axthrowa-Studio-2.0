//! Kasa adı geçersiz kılması süreç genelidir; bu yüzden kendi test ikilisinde (ayrı süreç) sınanır.

use axthrowa_studio_lib::secret_store::{delete_secret, get_secret, set_secret, set_service_override};

const GERCEK: &str = "com.axthrowa.studio";

#[test]
fn gecersiz_kilma_gercek_kasaya_dokunmaz() {
  set_service_override("com.axthrowa.studio.yalitim-testi");
  // Benzersiz anahtar: gerçek kasadaki hiçbir kayıt okunmaz.
  let ad = format!("test.yalitim.{}", std::process::id());
  assert!(set_secret(&ad, "deger"), "yazılamadı");
  let gercek = keyring::Entry::new(GERCEK, &ad).unwrap().get_password();
  let yalitilmis = get_secret(&ad);
  delete_secret(&ad);
  assert!(matches!(gercek, Err(keyring::Error::NoEntry)), "sır gerçek kasaya yazıldı");
  assert_eq!(yalitilmis.as_deref(), Some("deger"));
}

/// Test ve örnekler normal kitaplığa bağlanır (`cfg!(test)` yanlış): AppState (ayarlar → kasa)
/// kurmadan önce kasayı yalıtmalılar.
#[test]
fn appstate_kuran_test_ve_ornekler_kasayi_once_yalitir() {
  let kok = env!("CARGO_MANIFEST_DIR");
  let mut denetlenen = 0;
  for klasor in ["tests", "examples"] {
    for dosya in std::fs::read_dir(format!("{kok}/{klasor}")).unwrap() {
      let yol = dosya.unwrap().path();
      let kaynak = std::fs::read_to_string(&yol).unwrap();
      // Parçalı: bu dosya kendini eşleştirmesin.
      let Some(kurulum) = kaynak.find(concat!("AppState", "::new(")) else {
        continue;
      };
      let yalitim = kaynak.find("secret_store::set_service_override(");
      assert!(yalitim.is_some_and(|y| y < kurulum), "{} kasayı yalıtmıyor", yol.display());
      denetlenen += 1;
    }
  }
  assert!(denetlenen >= 4, "beklenen dosyalar bulunamadı: {denetlenen}");
}
