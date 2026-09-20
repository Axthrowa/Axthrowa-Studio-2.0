use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use anyhow::Result;
use serde_json::{json, Value};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ScreenKind {
  Starting,
  Ending,
  Brb,
  Chat,
  Panel,
}

impl ScreenKind {
  pub const ALL: [ScreenKind; 5] = [
    Self::Starting,
    Self::Ending,
    Self::Brb,
    Self::Chat,
    Self::Panel,
  ];

  pub fn parse(s: &str) -> Result<Self, String> {
    match s {
      "starting" | "intro" | "giris" => Ok(Self::Starting),
      "ending" | "outro" | "cikis" => Ok(Self::Ending),
      "brb" | "mola" => Ok(Self::Brb),
      "chat" => Ok(Self::Chat),
      "panel" | "main" => Ok(Self::Panel),
      other => Err(format!("unknown screen: {other}")),
    }
  }

  pub fn as_str(self) -> &'static str {
    match self {
      Self::Starting => "starting",
      Self::Ending => "ending",
      Self::Brb => "brb",
      Self::Chat => "chat",
      Self::Panel => "panel",
    }
  }

  pub fn file_name(self) -> &'static str {
    match self {
      Self::Starting => "settings-starting.json",
      Self::Ending => "settings-ending.json",
      Self::Brb => "settings-brb.json",
      Self::Chat => "settings-chat.json",
      Self::Panel => "settings-panel.json",
    }
  }
}

#[derive(Clone)]
pub struct AppSettings {
  map: HashMap<&'static str, Value>,
}

impl AppSettings {
  pub fn load(root: &Path) -> Self {
    let dir = data_dir(root);
    let _ = fs::create_dir_all(&dir);
    let mut map = HashMap::new();
    for kind in ScreenKind::ALL {
      let path = dir.join(kind.file_name());
      let mut value = if path.exists() {
        fs::read_to_string(&path)
          .ok()
          .and_then(|s| serde_json::from_str(&s).ok())
          .unwrap_or_else(|| defaults(kind))
      } else {
        // migrate legacy files if present
        migrate_legacy(root, kind).unwrap_or_else(|| defaults(kind))
      };
      let had_plaintext = value
        .pointer("/obs/password")
        .and_then(|v| v.as_str())
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false);
      if had_plaintext {
        let _ = crate::secret_store::vault_obs_password(
          value
            .pointer("/obs/password")
            .and_then(|v| v.as_str())
            .unwrap_or(""),
        );
        let disk = crate::secret_store::for_disk(&value);
        let _ = write_atomic(&path, &serde_json::to_string_pretty(&disk).unwrap_or_default());
      }
      crate::secret_store::inject_obs_password(&mut value);
      map.insert(kind.as_str(), value);
    }
    Self { map }
  }

  pub fn get(&self, kind: ScreenKind) -> &Value {
    // Harita `new()` içinde her ekran için dolduruluyor, yani bu yol normalde
    // hiç işlemez. Yine de panik atmıyoruz: burası HTTP istek yolunda ve bir
    // panik tüm sunucuyu (dolayısıyla OBS kaynaklarını) düşürür.
    static BOS: Value = Value::Null;
    self.map.get(kind.as_str()).unwrap_or(&BOS)
  }

  pub fn set(&mut self, kind: ScreenKind, value: Value) {
    self.map.insert(kind.as_str(), value);
  }

  pub fn save(&self, root: &Path) -> Result<()> {
    for kind in ScreenKind::ALL {
      self.save_one(root, kind)?;
    }
    Ok(())
  }

  /// Yalnızca değişen ekranı yazar. Panelde her tuş vuruşunda beş dosya
  /// birden yazılıyordu; kaydetme maliyetini beşte bire indirir.
  pub fn save_one(&self, root: &Path, kind: ScreenKind) -> Result<()> {
    let dir = data_dir(root);
    fs::create_dir_all(&dir)?;
    let Some(v) = self.map.get(kind.as_str()) else {
      return Ok(());
    };
    let disk = crate::secret_store::for_disk(v);
    write_atomic(&dir.join(kind.file_name()), &serde_json::to_string_pretty(&disk)?)
  }
}

/// Önce .tmp'ye yaz, sonra taşı — yazma sırasında çökme yarım JSON bırakmasın.
fn write_atomic(path: &Path, contents: &str) -> Result<()> {
  let tmp = path.with_extension("tmp");
  fs::write(&tmp, contents)?;
  match fs::rename(&tmp, path) {
    Ok(()) => Ok(()),
    Err(_) => {
      // Windows'ta hedef kilitliyse doğrudan yazmayı dene
      let res = fs::write(path, contents);
      let _ = fs::remove_file(&tmp);
      Ok(res?)
    }
  }
}

fn data_dir(root: &Path) -> PathBuf {
  // `root` artık doğrudan yazılabilir depolama kökü (eski `…/app-data`).
  // Geriye dönük: hâlâ `app-data` alt klasörü varsa onu kullan.
  let nested = root.join("app-data");
  if nested.is_dir() {
    nested
  } else {
    root.to_path_buf()
  }
}

fn migrate_legacy(root: &Path, kind: ScreenKind) -> Option<Value> {
  let legacy = match kind {
    ScreenKind::Starting => root.join("obs-settings-data.json"),
    ScreenKind::Ending => root.join("obs-outro-settings-data.json"),
    _ => return None,
  };
  if !legacy.exists() {
    let legacy2 = root.join("legacy").join(legacy.file_name()?);
    if legacy2.exists() {
      return fs::read_to_string(legacy2)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok());
    }
    return None;
  }
  fs::read_to_string(legacy)
    .ok()
    .and_then(|s| serde_json::from_str(&s).ok())
}

pub fn deep_merge(mut base: Value, patch: Value) -> Value {
  match (&mut base, patch) {
    (Value::Object(a), Value::Object(b)) => {
      for (k, v) in b {
        let entry = a.entry(k).or_insert(Value::Null);
        *entry = deep_merge(entry.take(), v);
      }
      base
    }
    (_, p) => p,
  }
}

pub fn defaults(kind: ScreenKind) -> Value {
  let text_styles = json!({
    "eyebrow": { "font": "system", "size": 100, "effect": "none", "anim": "none" },
    "title": { "font": "system", "size": 100, "effect": "none", "anim": "none" },
    "sub": { "font": "system", "size": 100, "effect": "none", "anim": "none" },
    "countdown": { "font": "system", "size": 100, "effect": "none", "anim": "none" },
    "ticker": { "font": "system", "size": 100, "effect": "none", "anim": "none" },
    "credits": { "font": "system", "size": 100, "effect": "none", "anim": "none" }
  });

  match kind {
    ScreenKind::Starting => json!({
      "eyebrow": "YAYIN BAŞLIYOR",
      "title": "Yayın Başlığı Buraya Gelecek",
      "sub": "Sohbete katılın, birlikte eğlenelim",
      "ticker": "",
      "liveText": "CANLI YAYINDA",
      "targetDate": "",
      "accent": "#7c5cff",
      "textColor": "#ffffff",
      "eyebrowColor": "#b39dff",
      "subColor": "#c9cddb",
      "countdownColor": "#ffffff",
      "tickerColor": "#9aa0b4",
      "font": "system",
      "textStyles": text_styles,
      "bgStyle": "mix",
      "bgImage": null,
      "bgVideoPath": null,
      "bgVideoStart": 0,
      "bgVideoEnd": 0,
      "youtubeUrl": "",
      "youtubeStart": 0,
      "youtubeEnd": 0,
      "particles": true,
      "particleTypes": {},
      "particleSizes": {},
      "transparent": false,
      "videoSound": false,
      "videoVolume": 100,
      "logo": null,
      "logoFit": true,
      "logoFrame": true,
      "logoZoom": 100,
      "logoPanX": 0,
      "logoPanY": 0,
      "socials": {
        "twitch": { "enabled": true, "handle": "" },
        "youtube": { "enabled": false, "handle": "" },
        "kick": { "enabled": false, "handle": "" },
        "x": { "enabled": false, "handle": "" },
        "instagram": { "enabled": false, "handle": "" },
        "discord": { "enabled": false, "handle": "" },
        "tiktok": { "enabled": false, "handle": "" }
      },
      "positions": {
        "logo": { "x": 50, "y": 22 },
        "eyebrow": { "x": 50, "y": 36 },
        "title": { "x": 50, "y": 44 },
        "sub": { "x": 50, "y": 52 },
        "countdown": { "x": 50, "y": 64 },
        "socials": { "x": 50, "y": 80 },
        "ticker": { "x": 50, "y": 90 },
        "nowPlaying": { "x": 16, "y": 88 }
      },
      "sizes": { "logo": 100, "eyebrow": 100, "title": 100, "sub": 100, "countdown": 100, "socials": 100, "ticker": 100, "nowPlaying": 100 },
      "visible": { "logo": true, "eyebrow": true, "title": true, "sub": true, "countdown": true, "socials": true, "ticker": true, "nowPlaying": true },
      "nowPlayingEnabled": true,
      "obs": {
        "enabled": false,
        "host": "127.0.0.1",
        "port": 4455,
        "password": "",
        "sceneOnEnd": "",
        "transition": "",
        "transitionMs": 300,
        "micInput": ""
      }
    }),
    ScreenKind::Ending => json!({
      "eyebrow": "YAYIN BİTTİ",
      "title": "İzlediğiniz için teşekkürler!",
      "sub": "Bir sonraki yayında görüşmek üzere",
      "ticker": "",
      "liveText": "YİNE GÖRÜŞÜRÜZ",
      "targetDate": "",
      "accent": "#7c5cff",
      "textColor": "#ffffff",
      "eyebrowColor": "#b39dff",
      "subColor": "#c9cddb",
      "countdownColor": "#ffffff",
      "tickerColor": "#9aa0b4",
      "font": "system",
      "textStyles": text_styles,
      "bgStyle": "mix",
      "bgImage": null,
      "bgVideoPath": null,
      "bgVideoStart": 0,
      "bgVideoEnd": 0,
      "youtubeUrl": "",
      "particles": true,
      "particleTypes": {},
      "particleSizes": {},
      "transparent": false,
      "videoSound": false,
      "videoVolume": 100,
      "logo": null,
      "credits": ["# Destekçiler", "", "# Yeni Aboneler", "", "# Yeni Takipçiler", "", "Teşekkürler!"],
      "creditsSections": [
        { "title": "Destekçiler", "lines": [] },
        { "title": "Yeni Aboneler", "lines": [] },
        { "title": "Yeni Takipçiler", "lines": [] }
      ],
      "creditsEnabled": true,
      "creditsAuto": true,
      "creditsSpeed": 40,
      "creditsSize": 100,
      "endingMinutes": 0,
      "socials": {
        "twitch": { "enabled": true, "handle": "" },
        "youtube": { "enabled": false, "handle": "" },
        "kick": { "enabled": false, "handle": "" },
        "x": { "enabled": false, "handle": "" },
        "instagram": { "enabled": false, "handle": "" },
        "discord": { "enabled": false, "handle": "" },
        "tiktok": { "enabled": false, "handle": "" }
      },
      "positions": {
        "logo": { "x": 50, "y": 18 },
        "eyebrow": { "x": 50, "y": 28 },
        "title": { "x": 50, "y": 36 },
        "sub": { "x": 50, "y": 44 },
        "countdown": { "x": 50, "y": 52 },
        "socials": { "x": 50, "y": 68 },
        "ticker": { "x": 50, "y": 82 },
        "credits": { "x": 50, "y": 90 },
        "nowPlaying": { "x": 16, "y": 88 }
      },
      "sizes": { "logo": 100, "eyebrow": 100, "title": 100, "sub": 100, "countdown": 100, "socials": 100, "ticker": 100, "credits": 100, "nowPlaying": 100 },
      "visible": { "logo": true, "eyebrow": true, "title": true, "sub": true, "countdown": false, "socials": true, "ticker": true, "credits": true, "nowPlaying": true },
      "nowPlayingEnabled": true
    }),
    ScreenKind::Brb => json!({
      "eyebrow": "KISA BİR MOLA",
      "title": "Hemen dönüyorum",
      "sub": "X dakika sonra buradayız",
      "ticker": "",
      "liveText": "BRB",
      "brbMinutes": 5,
      "targetDate": "",
      "accent": "#53fc18",
      "textColor": "#ffffff",
      "eyebrowColor": "#9dffb0",
      "subColor": "#c9cddb",
      "countdownColor": "#ffffff",
      "font": "system",
      "textStyles": text_styles,
      "bgStyle": "dark",
      "bgVideoPath": null,
      "bgAudioPath": null,
      "audioLoop": true,
      "videoSound": false,
      "videoVolume": 70,
      "particles": true,
      "visualizer": true,
      "logo": null,
      "positions": {
        "logo": { "x": 50, "y": 22 },
        "eyebrow": { "x": 50, "y": 36 },
        "title": { "x": 50, "y": 44 },
        "sub": { "x": 50, "y": 52 },
        "countdown": { "x": 50, "y": 64 },
        "visualizer": { "x": 50, "y": 82 },
        "nowPlaying": { "x": 16, "y": 88 }
      },
      "sizes": { "logo": 100, "eyebrow": 100, "title": 100, "sub": 100, "countdown": 100, "visualizer": 100, "nowPlaying": 100 },
      "visible": { "logo": true, "eyebrow": true, "title": true, "sub": true, "countdown": true, "visualizer": true, "nowPlaying": true },
      "nowPlayingEnabled": true,
      "obs": {
        "muteMicOnBrb": true,
        "muteAllExceptMic": true,
        "micInput": "",
        "brbScene": "",
        "returnScene": "",
        "transition": "",
        "transitionMs": 300
      }
    }),
    ScreenKind::Chat => json!({
      "enableKick": true,
      "enableTwitch": true,
      "enableYoutube": true,
      /* Kanal adları boşsa Giriş ekranındaki sosyal hesaplardan otomatik alınır */
      "autoDetect": true,
      "kickSlug": "",
      "chatroomId": null,
      "twitchChannel": "",
      "youtubeChannel": "",
      "youtubeVideoId": "",
      "maxMessages": 60,
      "fontSize": 22,
      "textShadow": true,
      "accent": "#53fc18",
      "bgTransparent": true,
      "showPlatformBadge": true,
      "showUserBadges": true,
      "showTimestamps": false,
      "highlightEvents": true,
      "autoHideMessages": true,
      "messageHideSec": 12,
      "fadeOldMessages": false
    }),
    ScreenKind::Panel => json!({
      "obs": {
        "host": "127.0.0.1",
        "port": 4455,
        "password": "",
        "connected": false
      },
      "snapGrid": 20,
      "serverPort": 8843
    }),
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn parse_accepts_aliases_and_rejects_unknown() {
    assert_eq!(ScreenKind::parse("giris").unwrap(), ScreenKind::Starting);
    assert_eq!(ScreenKind::parse("outro").unwrap(), ScreenKind::Ending);
    assert_eq!(ScreenKind::parse("mola").unwrap(), ScreenKind::Brb);
    assert_eq!(ScreenKind::parse("chat").unwrap(), ScreenKind::Chat);
    assert_eq!(ScreenKind::parse("main").unwrap(), ScreenKind::Panel);
    assert!(ScreenKind::parse("yok").is_err());
    assert!(ScreenKind::parse("").is_err());
  }

  #[test]
  fn all_kinds_have_unique_files_and_defaults() {
    let mut names: Vec<&str> = ScreenKind::ALL.iter().map(|k| k.file_name()).collect();
    names.sort_unstable();
    let before = names.len();
    names.dedup();
    assert_eq!(names.len(), before, "dosya adları benzersiz olmalı");
    for k in ScreenKind::ALL {
      assert!(defaults(k).is_object(), "{} defaults nesne değil", k.as_str());
    }
  }

  #[test]
  fn deep_merge_keeps_untouched_branches() {
    let base = json!({
      "a": 1,
      "nested": { "x": 1, "y": { "deep": true } },
      "list": [1, 2, 3]
    });
    let merged = deep_merge(base, json!({ "nested": { "x": 9 }, "b": "yeni" }));
    assert_eq!(merged["a"], 1);
    assert_eq!(merged["nested"]["x"], 9);
    assert_eq!(merged["nested"]["y"]["deep"], true);
    assert_eq!(merged["b"], "yeni");
    assert_eq!(merged["list"], json!([1, 2, 3]));
  }

  #[test]
  fn deep_merge_replaces_arrays_and_allows_null() {
    let merged = deep_merge(json!({ "list": [1, 2] }), json!({ "list": [9] }));
    assert_eq!(merged["list"], json!([9]));
    // null ile alan temizlenebilmeli (bgVideoPath: null bunu kullanıyor)
    let cleared = deep_merge(json!({ "bgVideoPath": "a.mp4" }), json!({ "bgVideoPath": null }));
    assert!(cleared["bgVideoPath"].is_null());
  }

  #[test]
  fn deep_merge_handles_type_changes() {
    let merged = deep_merge(json!({ "v": { "a": 1 } }), json!({ "v": 5 }));
    assert_eq!(merged["v"], 5);
    let merged2 = deep_merge(json!({ "v": 5 }), json!({ "v": { "a": 1 } }));
    assert_eq!(merged2["v"]["a"], 1);
  }

  #[test]
  fn save_one_roundtrips_and_is_atomic() {
    let root = std::env::temp_dir().join(format!("yayin-settings-{}", std::process::id()));
    let _ = fs::remove_dir_all(&root);
    let mut s = AppSettings::load(&root);
    s.set(ScreenKind::Chat, json!({ "kickSlug": "axthrowa", "maxMessages": 60 }));
    s.save_one(&root, ScreenKind::Chat).unwrap();

    let file = data_dir(&root).join(ScreenKind::Chat.file_name());
    assert!(file.is_file());
    assert!(!file.with_extension("tmp").exists(), "geçici dosya kalmamalı");

    let reloaded = AppSettings::load(&root);
    assert_eq!(reloaded.get(ScreenKind::Chat)["kickSlug"], "axthrowa");
    // Diğer ekranlar varsayılanlarıyla kalmalı
    assert!(reloaded.get(ScreenKind::Starting)["title"].is_string());

    s.set(
      ScreenKind::Panel,
      json!({ "obs": { "host": "127.0.0.1", "password": "plain-secret" } }),
    );
    s.save_one(&root, ScreenKind::Panel).unwrap();
    let panel_file = data_dir(&root).join(ScreenKind::Panel.file_name());
    let on_disk: Value =
      serde_json::from_str(&fs::read_to_string(&panel_file).unwrap()).unwrap();
    assert_eq!(on_disk["obs"]["password"], "");
    assert_eq!(s.get(ScreenKind::Panel)["obs"]["password"], "plain-secret");
    let _ = fs::remove_dir_all(&root);
  }

  #[test]
  fn corrupt_file_falls_back_to_defaults() {
    let root = std::env::temp_dir().join(format!("yayin-corrupt-{}", std::process::id()));
    let _ = fs::remove_dir_all(&root);
    let dir = data_dir(&root);
    fs::create_dir_all(&dir).unwrap();
    fs::write(dir.join(ScreenKind::Brb.file_name()), "{bozuk json").unwrap();
    let s = AppSettings::load(&root);
    assert_eq!(s.get(ScreenKind::Brb)["liveText"], "BRB");
    let _ = fs::remove_dir_all(&root);
  }
}
