//! Uzak giriş şifreleri argon2id ile saklanır; eski tuzlu SHA-256 kayıtlar ilk girişte yükseltilir.

use sha2::{Digest, Sha256};
use yayin_yonetim_araci_lib::db::botaxt_api::{remote_login, remote_setup};
use yayin_yonetim_araci_lib::AppState;

#[tokio::test]
async fn eski_kayit_calisir_ve_girisle_yukseltilir() {
  yayin_yonetim_araci_lib::secret_store::set_service_override("com.axthrowa.yayin-yonetim-araci.test");
  let root = std::env::temp_dir().join(format!("yayin-uzakgiris-{}", std::process::id()));
  let _ = std::fs::remove_dir_all(&root);
  std::fs::create_dir_all(&root).unwrap();
  let data = root.join("app-data");
  let r = root.clone();
  let state = tokio::task::spawn_blocking(move || AppState::new(r, data, false, 0)).await.unwrap();
  let db = state.db.clone();
  let ozet = || async {
    sqlx::query_scalar::<_, String>("SELECT password_hash FROM remote_users").fetch_one(&db).await.unwrap()
  };

  remote_setup(&db, "yonetici", "dogru-sifre").await.unwrap();
  assert!(ozet().await.starts_with("$argon2id$"), "yeni kayıt argon2id olmalı");
  remote_login(&db, "yonetici", "dogru-sifre").await.unwrap();
  assert!(remote_login(&db, "yonetici", "yanlis-sifre").await.is_err());

  let eski_ozet: String = Sha256::digest(b"tuzdogru-sifre").iter().map(|b| format!("{b:02x}")).collect();
  sqlx::query("UPDATE remote_users SET password_hash = ?").bind(format!("tuz${eski_ozet}")).execute(&db).await.unwrap();
  assert!(remote_login(&db, "yonetici", "yanlis-sifre").await.is_err());
  assert!(ozet().await.starts_with("tuz$"), "yanlış şifre kaydı değiştirmemeli");
  remote_login(&db, "yonetici", "dogru-sifre").await.unwrap();
  assert!(ozet().await.starts_with("$argon2id$"), "eski kayıt girişte yükseltilmeli");
  remote_login(&db, "yonetici", "dogru-sifre").await.unwrap();

  drop(state);
  let _ = std::fs::remove_dir_all(&root);
}
