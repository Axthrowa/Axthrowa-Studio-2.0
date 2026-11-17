//! Medya dosyası sunumu ve istemci WebSocket akışı

use super::*;

#[derive(Deserialize)]
pub(super) struct MediaQuery {
  path: String,
}

/// Yol (sembolik bağlar çözülerek) veri ya da kurulum `assets` klasörünün içinde mi?
pub(super) fn medya_kutuphanede(kokler: &[PathBuf], path: &std::path::Path) -> bool {
  let Ok(gercek) = std::fs::canonicalize(path) else { return false };
  kokler
    .iter()
    .filter_map(|k| std::fs::canonicalize(k).ok())
    .any(|k| gercek.starts_with(k))
}

/// Yerel medyayı **akış** olarak servis eder.
///
/// Kritik: Range başlığı yokken asla 206 dönmez — WebView2/Chromium bunu bozuk
/// sayıp `<video>` öğesini hiç başlatmaz (yerel videonun oynamama nedeni buydu).
/// Range yoksa tam boyutlu 200 + akışlı gövde gider; RAM'e alınmaz.
pub(super) async fn api_media_file(
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  State(state): State<Arc<AppState>>,
  Query(q): Query<MediaQuery>,
  headers: HeaderMap,
) -> Result<Response, (StatusCode, String)> {
  let path = media::sanitize_path(&q.path).map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
  // GÜVENLİK: `/media/` herkese açık (LAN'daki OBS kaynakları). Anahtarsız LAN isteği diskteki her
  // medya dosyasını değil, yalnız kütüphane klasörünü okuyabilir.
  if !addr.ip().is_loopback() && !medya_kutuphanede(&[state.data_dir.join("assets"), state.root.join("assets")], &path) {
    let gecerli = match bot_api::extract_bearer(&headers) {
      Some(t) => crate::db::bot_api::remote_auth_full(&state.db, &t).await.is_ok(),
      None => false,
    };
    if !gecerli {
      return Err((StatusCode::NOT_FOUND, "dosya bulunamadı".into()));
    }
  }
  let total = media::file_len(&path).map_err(|e| (StatusCode::NOT_FOUND, e.to_string()))?;
  let range = headers.get(header::RANGE).and_then(|v| v.to_str().ok());
  let plan = media::plan_range(total, range);
  let builder = media::headers_for(&path, &plan);

  if plan.status == 416 || plan.len == 0 {
    return builder
      .body(Body::empty())
      .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()));
  }

  let mut file = tokio::fs::File::open(&path)
    .await
    .map_err(|e| (StatusCode::NOT_FOUND, e.to_string()))?;
  if plan.start > 0 {
    use tokio::io::AsyncSeekExt;
    file
      .seek(std::io::SeekFrom::Start(plan.start))
      .await
      .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  }
  let stream = tokio_util::io::ReaderStream::with_capacity(
    tokio::io::AsyncReadExt::take(file, plan.len),
    64 * 1024,
  );
  builder
    .body(Body::from_stream(stream))
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

pub(super) async fn ws_handler(
  ws: WebSocketUpgrade,
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
) -> impl IntoResponse {
  // GÜVENLİK: `/ws/*` LAN kipinde Bearer istemez (OBS tarayıcı kaynakları başlık gönderemez) ama
  // anlık görüntü ekran ayarlarını — kasadan enjekte edilmiş OBS şifresi dahil — taşıyordu. LAN'daki
  // herhangi bir cihaz şifreyi okuyabiliyordu; HTTP ayar ucu ise LAN'da zaten Bearer istiyor.
  // Aynı bilgisayardaki OBS (loopback) otomasyon için şifreyi almaya devam eder.
  let redact = !addr.ip().is_loopback();
  ws.on_upgrade(move |socket| client_ws(socket, state, redact))
}

pub(super) async fn client_ws(socket: WebSocket, state: Arc<AppState>, redact: bool) {
  let (mut sender, mut receiver) = socket.split();
  let mut rx = state.tx.subscribe();
  // Bu bağlantıya özel yanıtlar (pong) için ayrı kanal — yayın kanalını
  // kirletmeden tek istemciye mesaj göndermeyi sağlar.
  let (direct_tx, mut direct_rx) = tokio::sync::mpsc::channel::<String>(8);

  let snap = {
    let s = state.settings.read();
    let mut v = serde_json::json!({
      "type": "snapshot",
      "starting": s.get(ScreenKind::Starting),
      "ending": s.get(ScreenKind::Ending),
      "brb": s.get(ScreenKind::Brb),
      "chat": s.get(ScreenKind::Chat),
      "panel": s.get(ScreenKind::Panel),
      "nowPlaying": state.music.now_playing(),
    });
    if redact {
      crate::secret_store::redact_obs_passwords(&mut v);
    }
    v.to_string()
  };
  if sender.send(Message::Text(snap.into())).await.is_err() {
    return;
  }

  let send_task = tokio::spawn(async move {
    loop {
      let out = tokio::select! {
        broadcast = rx.recv() => match broadcast {
          Ok(m) => m,
          // Yavaş istemci yayını kaçırdıysa bağlantıyı düşürme, devam et
          Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
          Err(_) => break,
        },
        direct = direct_rx.recv() => match direct {
          Some(m) => m,
          None => break,
        },
      };
      let out = if redact {
        crate::secret_store::redact_obs_passwords_text(&out).into_owned()
      } else {
        out
      };
      if sender.send(Message::Text(out.into())).await.is_err() {
        break;
      }
    }
  });

  while let Some(Ok(msg)) = receiver.next().await {
    match msg {
      Message::Text(text) => {
        // İstemci canlılık yoklaması: yanıtsız kalırsa overlay bağlantıyı
        // ölü sayıp yeniden kuruyor — bu yüzden pong zorunlu.
        let ping = serde_json::from_str::<Value>(&text)
          .ok()
          .and_then(|v| v.get("type").and_then(|t| t.as_str()).map(str::to_string))
          .as_deref()
          == Some("ping");
        if ping
          && direct_tx
            .send(serde_json::json!({ "type": "pong" }).to_string())
            .await
            .is_err()
        {
          break;
        }
      }
      Message::Close(_) => break,
      _ => {}
    }
  }
  send_task.abort();
}

// ─── Bot modülü 1: Profil / Dashboard API ───────────────────────────
