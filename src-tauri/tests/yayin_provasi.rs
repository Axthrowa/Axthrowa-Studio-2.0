//! Otomatik yayın provası (T4): "başlat, uyarı, mola, bitir" gerçek OBS ve gerçek bot OLMADAN.
//!
//! Test içinde sahte bir obs-websocket 5 sunucusu (el sıkışma + istek/yanıt) ve sahte AxBoT uyarı denetimi açılır;
//! Studio'nun HTTP sunucusu eylem kayıt defterinden senaryoyu yürütür. Denetlenen: OBS'e giden isteklerin sırası
//! ve parametresi, onay kuralları, denetim günlüğü. Görüntü/ses yok; gerçek yayın, sohbet ya da uyarı tetiklenmez.

use std::net::TcpListener;
use std::sync::{Arc, Mutex};

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use serde_json::{json, Value};

fn free_port() -> u16 {
  TcpListener::bind("127.0.0.1:0").unwrap().local_addr().unwrap().port()
}

type Kayit = Arc<Mutex<Vec<Value>>>;

/// obs-websocket 5 protokolünün provaya yeten kadarı: Hello → Identify → Identified, istek → başarılı yanıt
async fn sahte_obs_oturumu(mut ws: WebSocket, kayit: Kayit) {
  let hello = json!({"op": 0, "d": {"obsWebSocketVersion": "5.5.0", "rpcVersion": 1}});
  if ws.send(Message::Text(hello.to_string().into())).await.is_err() {
    return;
  }
  while let Some(Ok(m)) = ws.recv().await {
    let Message::Text(t) = m else { continue };
    let v: Value = serde_json::from_str(&t).unwrap_or(Value::Null);
    let cevap = match v["op"].as_i64() {
      Some(1) => json!({"op": 2, "d": {"negotiatedRpcVersion": 1}}),
      Some(6) => {
        let d = &v["d"];
        let tur = d["requestType"].as_str().unwrap_or("").to_string();
        let veri = match tur.as_str() {
          "GetVersion" => json!({
            "obsVersion": "32.0.0", "obsWebSocketVersion": "5.5.0", "rpcVersion": 1,
            "availableRequests": [], "supportedImageFormats": [], "platform": "windows", "platformDescription": "sahte"
          }),
          _ => {
            kayit.lock().unwrap().push(json!({"tur": tur, "veri": d["requestData"]}));
            Value::Null
          }
        };
        let mut yanit = json!({"requestType": tur, "requestId": d["requestId"], "requestStatus": {"result": true, "code": 100}});
        if !veri.is_null() {
          yanit["responseData"] = veri;
        }
        json!({"op": 7, "d": yanit})
      }
      _ => continue,
    };
    if ws.send(Message::Text(cevap.to_string().into())).await.is_err() {
      return;
    }
  }
}

#[tokio::test(flavor = "multi_thread")]
async fn yayin_provasi_baslat_uyari_mola_bitir() {
  // Sahte OBS
  let obs_istekleri: Kayit = Arc::default();
  let k = obs_istekleri.clone();
  let obs = axum::Router::new().route(
    "/",
    axum::routing::any(move |yukselt: WebSocketUpgrade| {
      let k = k.clone();
      async move { yukselt.on_upgrade(move |ws| sahte_obs_oturumu(ws, k)) }
    }),
  );
  let obs_dinleyici = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
  let obs_port = obs_dinleyici.local_addr().unwrap().port();
  tokio::spawn(async move { axum::serve(obs_dinleyici, obs).await.unwrap() });

  // Sahte AxBoT uyarı denetimi
  let bot_istekleri: Kayit = Arc::default();
  let k = bot_istekleri.clone();
  let bot = axum::Router::new().route(
    "/api/alerts/control",
    axum::routing::post(move |axum::Json(govde): axum::Json<Value>| {
      let k = k.clone();
      async move {
        k.lock().unwrap().push(govde);
        axum::Json(json!({"state": {"paused": false, "version": 1}}))
      }
    }),
  );
  let bot_dinleyici = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
  let bot_port = bot_dinleyici.local_addr().unwrap().port();
  tokio::spawn(async move { axum::serve(bot_dinleyici, bot).await.unwrap() });
  // Bu test kendi sürecinde çalışır (ayrı test dosyası); 2021 sürümünde set_var güvenli
  std::env::set_var("AXBOT_PORT", bot_port.to_string());

  // Studio sunucusu (geçici veri kökü, ayrı kasa adı)
  axthrowa_studio_lib::secret_store::set_service_override("com.axthrowa.studio.test");
  let port = free_port();
  let root = std::env::temp_dir().join(format!("studio-prova-{port}"));
  let _ = std::fs::remove_dir_all(&root);
  std::fs::create_dir_all(root.join("assets")).unwrap();
  let (r2, veri) = (root.clone(), root.join("app-data"));
  let state = tokio::task::spawn_blocking(move || axthrowa_studio_lib::AppState::new(r2, veri, false, port)).await.unwrap();
  state.obs.connect("127.0.0.1", obs_port, "").await.expect("sahte OBS'e bağlanmalı");
  tokio::spawn(async move {
    let _ = axthrowa_studio_lib::server::serve(state).await;
  });
  let base = format!("http://127.0.0.1:{port}");
  let c = reqwest::Client::builder().timeout(std::time::Duration::from_secs(10)).build().unwrap();
  for _ in 0..50 {
    if c.get(format!("{base}/api/actions")).send().await.is_ok() {
      break;
    }
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;
  }

  let liste: Value = c.get(format!("{base}/api/actions")).send().await.unwrap().json().await.unwrap();
  let bul = |id: &str| liste["actions"].as_array().unwrap().iter().find(|a| a["id"] == id).unwrap().clone();
  assert_eq!(bul("stream.start")["available"], true, "OBS bağlıyken yayın başlatılabilir görünmeli");
  assert_eq!(bul("scene.switch")["available"], true);

  let calistir = |govde: Value| {
    let (c, url) = (c.clone(), format!("{base}/api/actions/run"));
    async move { c.post(url).json(&govde).send().await.unwrap() }
  };

  // Onaysız başlatma ve bitirme OBS'e gitmez
  assert_eq!(calistir(json!({"id": "stream.start"})).await.status(), 428);
  assert_eq!(calistir(json!({"id": "stream.stop"})).await.status(), 428);
  assert!(obs_istekleri.lock().unwrap().is_empty(), "onaysız eylem OBS'e gitmemeli");

  // Senaryo
  for govde in [
    json!({"id": "stream.start", "confirm": true}),
    json!({"id": "alert.skip"}),
    json!({"id": "scene.switch", "params": {"scene": "Mola"}}),
    json!({"id": "stream.stop", "confirm": true}),
  ] {
    let r = calistir(govde.clone()).await;
    assert!(r.status().is_success(), "{govde}: {}", r.text().await.unwrap_or_default());
  }

  let obs = obs_istekleri.lock().unwrap().clone();
  let turler: Vec<&str> = obs.iter().map(|i| i["tur"].as_str().unwrap()).collect();
  assert_eq!(turler, ["StartStream", "SetCurrentProgramScene", "StopStream"], "{obs:?}");
  assert_eq!(obs[1]["veri"]["sceneName"], "Mola");
  let bot = bot_istekleri.lock().unwrap().clone();
  assert_eq!(bot.len(), 1);
  assert_eq!(bot[0]["action"], "skip");

  // Denetim günlüğü: dört eylem de başarılı kayıtlı
  let d: Value = c.get(format!("{base}/api/audit?limit=50", )).send().await.unwrap().json().await.unwrap();
  let detay = |r: &Value| serde_json::from_str::<Value>(r["detail_json"].as_str().unwrap_or("{}")).unwrap_or(Value::Null);
  for eylem in ["stream.start", "alert.skip", "scene.switch", "stream.stop"] {
    let ad = format!("ACTION:{eylem}");
    assert!(
      d["items"].as_array().unwrap().iter().any(|r| r["action"] == ad.as_str() && detay(r)["ok"] == true),
      "{ad} günlükte yok"
    );
  }
  let _ = std::fs::remove_dir_all(&root);
}
