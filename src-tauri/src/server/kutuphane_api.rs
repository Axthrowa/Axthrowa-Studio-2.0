//! Kullanıcı kütüphanesi: parçacık, müzik, efekt, logo, video, arka plan yükleme/silme ve içe aktarma

use super::*;

pub(super) async fn api_particles(State(state): State<Arc<AppState>>) -> Json<Value> {
  Json(serde_json::json!(list_particle_files(&state.data_dir)))
}

pub(super) fn list_particle_files(root: &std::path::Path) -> Vec<String> {
  let dir = root.join("assets").join("particles");
  let mut names = Vec::new();
  if let Ok(rd) = std::fs::read_dir(&dir) {
    for ent in rd.flatten() {
      let name = ent.file_name().to_string_lossy().to_string();
      let lower = name.to_lowercase();
      if lower.ends_with(".png") || lower.ends_with(".webp") {
        names.push(name);
      }
    }
  }
  names.sort();
  names
}

pub(super) async fn api_particle_upload(
  State(state): State<Arc<AppState>>,
  headers: HeaderMap,
  body: axum::body::Bytes,
) -> Result<Json<Value>, (StatusCode, String)> {
  let ctype = headers
    .get(header::CONTENT_TYPE)
    .and_then(|v| v.to_str().ok())
    .unwrap_or("image/png");
  let ext = if ctype.contains("webp") {
    "webp"
  } else if ctype.contains("jpeg") || ctype.contains("jpg") {
    "jpg"
  } else {
    "png"
  };
  let name_hdr = headers
    .get("x-filename")
    .and_then(|v| v.to_str().ok())
    .map(|s| s.to_string());
  let varsayilan = format!("particle-{}.{}", chrono::Utc::now().timestamp_millis(), ext);
  let safe = name_hdr
    .and_then(|n| dosya_adi::asset_file_name(&n))
    .unwrap_or(varsayilan);
  let safe = if safe.to_lowercase().ends_with(".png")
    || safe.to_lowercase().ends_with(".webp")
    || safe.to_lowercase().ends_with(".jpg")
    || safe.to_lowercase().ends_with(".jpeg")
  {
    safe
  } else {
    format!("{safe}.{ext}")
  };
  let dir = state.data_dir.join("assets").join("particles");
  std::fs::create_dir_all(&dir).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  let dest = dir.join(&safe);
  std::fs::write(&dest, &body).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  Ok(Json(serde_json::json!({
    "ok": true,
    "name": safe,
    "files": list_particle_files(&state.data_dir),
  })))
}

#[derive(Deserialize)]
pub(super) struct ParticleDelete {
  name: String,
}

pub(super) async fn api_particle_delete(
  State(state): State<Arc<AppState>>,
  Json(body): Json<ParticleDelete>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let Some(name) = dosya_adi::asset_file_name(&body.name) else {
    return Err((StatusCode::BAD_REQUEST, "invalid name".into()));
  };
  let path = state.data_dir.join("assets").join("particles").join(&name);
  if path.is_file() {
    std::fs::remove_file(&path).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  }
  Ok(Json(serde_json::json!({
    "ok": true,
    "files": list_particle_files(&state.data_dir),
  })))
}

pub(super) async fn api_music(State(state): State<Arc<AppState>>) -> Json<Value> {
  Json(serde_json::json!(list_music_files(&state.data_dir)))
}

pub(super) fn list_music_files(root: &std::path::Path) -> Vec<String> {
  list_music_files_in(&root.join("assets").join("music"))
}

pub(super) async fn api_music_upload(
  State(state): State<Arc<AppState>>,
  headers: HeaderMap,
  body: axum::body::Bytes,
) -> Result<Json<Value>, (StatusCode, String)> {
  let ctype = headers
    .get(header::CONTENT_TYPE)
    .and_then(|v| v.to_str().ok())
    .unwrap_or("audio/mpeg");
  let ext = if ctype.contains("wav") {
    "wav"
  } else if ctype.contains("ogg") {
    "ogg"
  } else if ctype.contains("flac") {
    "flac"
  } else if ctype.contains("mp4") || ctype.contains("m4a") || ctype.contains("aac") {
    "m4a"
  } else {
    "mp3"
  };
  let name_hdr = headers
    .get("x-filename")
    .and_then(|v| v.to_str().ok())
    .map(|s| s.to_string());
  let varsayilan = format!("music-{}.{}", chrono::Utc::now().timestamp_millis(), ext);
  let safe = name_hdr
    .and_then(|n| dosya_adi::asset_file_name(&n))
    .unwrap_or(varsayilan);
  let lower = safe.to_lowercase();
  let safe = if lower.ends_with(".mp3")
    || lower.ends_with(".wav")
    || lower.ends_with(".ogg")
    || lower.ends_with(".flac")
    || lower.ends_with(".m4a")
    || lower.ends_with(".aac")
  {
    safe
  } else {
    format!("{safe}.{ext}")
  };
  let dir = state.data_dir.join("assets").join("music");
  std::fs::create_dir_all(&dir).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  let dest = dir.join(&safe);
  std::fs::write(&dest, &body).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  Ok(Json(serde_json::json!({
    "ok": true,
    "name": safe,
    "files": list_music_files(&state.data_dir),
  })))
}

#[derive(Deserialize)]
pub(super) struct MusicDelete {
  name: String,
}

pub(super) async fn api_music_delete(
  State(state): State<Arc<AppState>>,
  Json(body): Json<MusicDelete>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let Some(name) = dosya_adi::asset_file_name(&body.name) else {
    return Err((StatusCode::BAD_REQUEST, "invalid name".into()));
  };
  let path = state.data_dir.join("assets").join("music").join(&name);
  if path.is_file() {
    std::fs::remove_file(&path).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  }
  Ok(Json(serde_json::json!({
    "ok": true,
    "files": list_music_files(&state.data_dir),
  })))
}

pub(super) async fn api_sfx(State(state): State<Arc<AppState>>) -> Json<Value> {
  Json(serde_json::json!(list_sfx_files(&state.data_dir)))
}

pub(super) fn list_sfx_files(root: &std::path::Path) -> Vec<String> {
  list_music_files_in(&root.join("assets").join("sfx"))
}

pub(super) fn list_music_files_in(dir: &std::path::Path) -> Vec<String> {
  let mut names = Vec::new();
  if let Ok(rd) = std::fs::read_dir(dir) {
    for ent in rd.flatten() {
      let name = ent.file_name().to_string_lossy().to_string();
      let lower = name.to_lowercase();
      if lower.ends_with(".mp3")
        || lower.ends_with(".wav")
        || lower.ends_with(".ogg")
        || lower.ends_with(".flac")
        || lower.ends_with(".m4a")
        || lower.ends_with(".aac")
      {
        names.push(name);
      }
    }
  }
  names.sort();
  names
}

pub(super) async fn api_sfx_upload(
  State(state): State<Arc<AppState>>,
  headers: HeaderMap,
  body: axum::body::Bytes,
) -> Result<Json<Value>, (StatusCode, String)> {
  let ctype = headers
    .get(header::CONTENT_TYPE)
    .and_then(|v| v.to_str().ok())
    .unwrap_or("audio/mpeg");
  let ext = if ctype.contains("wav") {
    "wav"
  } else if ctype.contains("ogg") {
    "ogg"
  } else if ctype.contains("flac") {
    "flac"
  } else if ctype.contains("mp4") || ctype.contains("m4a") || ctype.contains("aac") {
    "m4a"
  } else {
    "mp3"
  };
  let name_hdr = headers
    .get("x-filename")
    .and_then(|v| v.to_str().ok())
    .map(|s| s.to_string());
  let varsayilan = format!("sfx-{}.{}", chrono::Utc::now().timestamp_millis(), ext);
  let safe = name_hdr
    .and_then(|n| dosya_adi::asset_file_name(&n))
    .unwrap_or(varsayilan);
  let lower = safe.to_lowercase();
  let safe = if lower.ends_with(".mp3")
    || lower.ends_with(".wav")
    || lower.ends_with(".ogg")
    || lower.ends_with(".flac")
    || lower.ends_with(".m4a")
    || lower.ends_with(".aac")
  {
    safe
  } else {
    format!("{safe}.{ext}")
  };
  let dir = state.data_dir.join("assets").join("sfx");
  std::fs::create_dir_all(&dir).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  let dest = dir.join(&safe);
  std::fs::write(&dest, &body).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  Ok(Json(serde_json::json!({
    "ok": true,
    "name": safe,
    "files": list_sfx_files(&state.data_dir),
  })))
}

#[derive(Deserialize)]
pub(super) struct SfxDelete {
  name: String,
}

pub(super) async fn api_sfx_delete(
  State(state): State<Arc<AppState>>,
  Json(body): Json<SfxDelete>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let Some(name) = dosya_adi::asset_file_name(&body.name) else {
    return Err((StatusCode::BAD_REQUEST, "invalid name".into()));
  };
  let path = state.data_dir.join("assets").join("sfx").join(&name);
  if path.is_file() {
    std::fs::remove_file(&path).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  }
  Ok(Json(serde_json::json!({
    "ok": true,
    "files": list_sfx_files(&state.data_dir),
  })))
}

pub(super) fn list_named_files(dir: &std::path::Path, exts: &[&str]) -> Vec<String> {
  let mut names = Vec::new();
  if let Ok(rd) = std::fs::read_dir(dir) {
    for ent in rd.flatten() {
      let name = ent.file_name().to_string_lossy().to_string();
      let lower = name.to_lowercase();
      if exts.iter().any(|e| lower.ends_with(e)) {
        names.push(name);
      }
    }
  }
  names.sort();
  names
}

pub(super) async fn api_logos(State(state): State<Arc<AppState>>) -> Json<Value> {
  let dir = state.data_dir.join("assets").join("logos");
  Json(serde_json::json!(list_named_files(
    &dir,
    &[".png", ".jpg", ".jpeg", ".webp", ".gif"]
  )))
}

pub(super) async fn api_videos(State(state): State<Arc<AppState>>) -> Json<Value> {
  let dir = crate::ytdl::indirme_klasoru(&state.data_dir);
  Json(serde_json::json!(list_named_files(
    &dir,
    &[".mp4", ".webm", ".mov", ".mkv", ".m4v"]
  )))
}

pub(super) async fn api_backgrounds(State(state): State<Arc<AppState>>) -> Json<Value> {
  let dir = state.data_dir.join("assets").join("backgrounds");
  Json(serde_json::json!(list_named_files(
    &dir,
    &[".png", ".jpg", ".jpeg", ".webp", ".gif", ".apng"]
  )))
}

pub(super) async fn api_backgrounds_delete(
  State(state): State<Arc<AppState>>,
  Json(body): Json<NamedDelete>,
) -> Result<Json<Value>, (StatusCode, String)> {
  delete_named_asset(&state.data_dir, "backgrounds", &body.name)
}

#[derive(Deserialize)]
pub(super) struct NamedDelete {
  name: String,
}

pub(super) async fn api_logos_delete(
  State(state): State<Arc<AppState>>,
  Json(body): Json<NamedDelete>,
) -> Result<Json<Value>, (StatusCode, String)> {
  delete_named_asset(&state.data_dir, "logos", &body.name)
}

pub(super) async fn api_videos_delete(
  State(state): State<Arc<AppState>>,
  Json(body): Json<NamedDelete>,
) -> Result<Json<Value>, (StatusCode, String)> {
  delete_named_asset(&state.data_dir, "videos", &body.name)
}

#[derive(Deserialize)]
pub(super) struct VideoDownloadBody {
  url: String,
}

/// YouTube arka planını yerele indirir.
///
/// İş uzun sürdüğü için istek hemen dönüyor; ilerleme WebSocket üzerinden
/// `video-download` iletileriyle akıyor.
pub(super) async fn api_video_download(
  State(state): State<Arc<AppState>>,
  Json(body): Json<VideoDownloadBody>,
) -> Result<Json<Value>, (StatusCode, String)> {
  if crate::ytdl::youtube_id(&body.url).is_none() {
    return Err((StatusCode::BAD_REQUEST, "Geçerli bir YouTube adresi değil".into()));
  }
  // Kontrol ile sahiplenme tek adımda: iki eşzamanlı istek de "başladı"
  // yanıtı alıp biri sessizce düşmesin.
  if !state.ytdl.yer_kap() {
    return Err((StatusCode::CONFLICT, "Zaten bir indirme sürüyor".into()));
  }
  let arka = state.clone();
  tokio::spawn(async move {
    // Kullanıcıya durum WebSocket'ten gidiyor; burada yalnızca iz bırakıyoruz.
    if let Err(e) = crate::ytdl::indir(arka, body.url).await {
      studio_warn!("video indirme başarısız: {e}");
    }
  });
  Ok(Json(serde_json::json!({ "ok": true })))
}

/// Panel yeniden açıldığında süren işi yakalayabilsin diye anlık durum.
pub(super) async fn api_video_download_status(State(state): State<Arc<AppState>>) -> Json<Value> {
  Json(serde_json::to_value(state.ytdl.snapshot()).unwrap_or_else(|_| serde_json::json!({})))
}

pub(super) async fn api_video_download_cancel(State(state): State<Arc<AppState>>) -> Json<Value> {
  state.ytdl.iptal_et();
  Json(serde_json::json!({ "ok": true }))
}

pub(super) fn delete_named_asset(
  root: &std::path::Path,
  folder: &str,
  name: &str,
) -> Result<Json<Value>, (StatusCode, String)> {
  let Some(name) = dosya_adi::asset_file_name(name) else {
    return Err((StatusCode::BAD_REQUEST, "invalid name".into()));
  };
  let path = root.join("assets").join(folder).join(&name);
  if path.is_file() {
    std::fs::remove_file(&path).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  }
  let exts: &[&str] = match folder {
    "logos" => &[".png", ".jpg", ".jpeg", ".webp", ".gif"],
    "videos" => &[".mp4", ".webm", ".mov", ".mkv", ".m4v"],
    "backgrounds" => &[".png", ".jpg", ".jpeg", ".webp", ".gif", ".apng"],
    _ => &[],
  };
  Ok(Json(serde_json::json!({
    "ok": true,
    "files": list_named_files(&root.join("assets").join(folder), exts),
  })))
}

#[derive(Deserialize)]
pub(super) struct LibraryImport {
  path: String,
  /// logos | videos | music | backgrounds
  kind: String,
}

pub(super) async fn api_library_import(
  State(state): State<Arc<AppState>>,
  Json(body): Json<LibraryImport>,
) -> Result<Json<Value>, (StatusCode, String)> {
  let kind = body.kind.to_lowercase();
  let folder = match kind.as_str() {
    "logos" | "logo" => "logos",
    "videos" | "video" => "videos",
    "music" | "audio" => "music",
    "sfx" | "sounds" | "soundboard" => "sfx",
    "backgrounds" | "background" | "bg" => "backgrounds",
    _ => {
      return Err((
        StatusCode::BAD_REQUEST,
        "kind must be logos|videos|music|sfx|backgrounds".into(),
      ))
    }
  };
  let src = media::sanitize_path(&body.path).map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
  if !src.is_file() {
    return Err((StatusCode::BAD_REQUEST, "file not found".into()));
  }
  let fname = src
    .file_name()
    .map(|s| s.to_string_lossy().to_string())
    .unwrap_or_else(|| format!("import-{}", chrono::Utc::now().timestamp_millis()));
  let safe = dosya_adi::asset_file_name(&fname)
    .unwrap_or_else(|| format!("import-{}", chrono::Utc::now().timestamp_millis()));
  let dir = state.data_dir.join("assets").join(folder);
  std::fs::create_dir_all(&dir).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  let dest = dir.join(&safe);
  std::fs::copy(&src, &dest).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  Ok(Json(serde_json::json!({
    "ok": true,
    "name": safe,
    "kind": folder,
  })))
}

// ---------------------------------------------------------------------------
// Gömülü müzik eklentisi
// ---------------------------------------------------------------------------
