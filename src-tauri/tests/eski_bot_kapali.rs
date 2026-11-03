//! Sohbet botu StreamAxT: uygulama sohbetten yan etki üretmemeli. Filtre Kick ceza kaydı
//! açmamalı, `!buy` puan düşüp ekrana uyarı yollamamalı. Sohbet sayımı sürmeli.

use std::sync::Arc;

use yayin_yonetim_araci_lib::bot::integrations::ChatInbound;
use yayin_yonetim_araci_lib::bot::pipeline::handle_inbound;
use yayin_yonetim_araci_lib::AppState;

fn mesaj(text: &str) -> ChatInbound {
  ChatInbound {
    platform: "kick".into(),
    user_key: "kick:ali".into(),
    user_name: "ali".into(),
    text: text.into(),
    kind: "chat".into(),
    amount: None,
    badges: vec![],
    is_mod: false,
    is_vip: false,
    is_sub: false,
    color: None,
    raw_id: "m1".into(),
  }
}

#[tokio::test]
async fn sohbet_filtre_ve_market_calistirmaz() {
  yayin_yonetim_araci_lib::secret_store::set_service_override("com.axthrowa.yayin-yonetim-araci.test");
  let root = std::env::temp_dir().join(format!("yayin-eskibot-{}", std::process::id()));
  let _ = std::fs::remove_dir_all(&root);
  std::fs::create_dir_all(&root).unwrap();
  let data = root.join("app-data");
  let r = root.clone();
  let state = tokio::task::spawn_blocking(move || AppState::new(r, data, false, 0)).await.unwrap();
  let db = state.db.clone();
  let kanal = yayin_yonetim_araci_lib::db::default_channel_id(&db).await.unwrap();

  // Bağlantı filtresi AÇIK, ali'nin 1000 puanı, 50 puanlık market öğesi
  sqlx::query("INSERT OR REPLACE INTO bot_filters(channel_id, links_enabled) VALUES(?, 1)")
    .bind(&kanal).execute(&db).await.unwrap();
  sqlx::query(
    "INSERT INTO loyalty_users(channel_id, user_key, user_name, platform, points, xp, messages, watch_sec, last_seen)
     VALUES(?, 'kick:ali', 'ali', 'kick', 1000, 0, 0, 0, 0)",
  )
  .bind(&kanal).execute(&db).await.unwrap();
  sqlx::query(
    "INSERT INTO shop_items(id, channel_id, name, cost, response, enabled, alert, trigger_kind, trigger_json, stock, cooldown_sec)
     VALUES('s1', ?, 'selam', 50, 'x', 1, 1, 'chat', '{}', -1, 0)",
  )
  .bind(&kanal).execute(&db).await.unwrap();

  let state = Arc::new(state);
  handle_inbound(state.clone(), mesaj("bakın https://kotu.example")).await.unwrap();
  handle_inbound(state.clone(), mesaj("!buy selam")).await.unwrap();

  let say = |sql: &'static str| {
    let db = db.clone();
    async move { sqlx::query_scalar::<_, i64>(sql).fetch_one(&db).await.unwrap() }
  };
  assert_eq!(say("SELECT COUNT(*) FROM moderation_strikes").await, 0, "filtre ceza kaydı açtı");
  assert_eq!(say("SELECT COUNT(*) FROM shop_sales").await, 0, "!buy satış yaptı");
  assert_eq!(say("SELECT points FROM loyalty_users WHERE user_key = 'kick:ali'").await, 1000, "puan değişti");
  // Sohbet sayımı (pano istatistikleri) sürer
  assert_eq!(say("SELECT messages FROM loyalty_users WHERE user_key = 'kick:ali'").await, 2);

  drop(state);
  let _ = std::fs::remove_dir_all(&root);
}
