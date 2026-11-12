//! Widget instance CRUD — config_json + OBS URL + enterprise seed kataloğu.

use anyhow::{Context, Result};
use serde_json::{json, Value};
use sqlx::SqlitePool;

use crate::db::chrono_now;
use crate::db::default_channel_id;
use crate::db::models::WidgetInstance;
use crate::media::paths;

const WIDGET_SELECT: &str = "SELECT id, channel_id, kind, name, obs_path, config_json, enabled,
            schema_version, sort_order, updated_at
     FROM widget_instances";

/// Seed şema sürümü — config alanları değişince artır (upgrade merge tetikler).
pub const WIDGET_CONFIG_SCHEMA: i64 = 6;

/// Mantıksal grup: panelde ADIM 2 için.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WidgetGroup {
  GoalsTrackers,
  PhysicsVisuals,
  ChatEvents,
  Gamification,
  MediaTts,
  Utility,
}

impl WidgetGroup {
  pub fn as_str(self) -> &'static str {
    match self {
      Self::GoalsTrackers => "goals_trackers",
      Self::PhysicsVisuals => "physics_visuals",
      Self::ChatEvents => "chat_events",
      Self::Gamification => "gamification",
      Self::MediaTts => "media_tts",
      Self::Utility => "utility",
    }
  }

  pub fn label_tr(self) -> &'static str {
    match self {
      Self::GoalsTrackers => "Hedefler ve Sayaçlar",
      Self::PhysicsVisuals => "Fizik ve Görsel",
      Self::ChatEvents => "Sohbet ve Olaylar",
      Self::Gamification => "Oyunlaştırma",
      Self::MediaTts => "Medya ve TTS",
      Self::Utility => "Yayın Sonu",
    }
  }
}

#[derive(Debug, Clone)]
pub struct WidgetSeedDef {
  pub kind: &'static str,
  pub name: &'static str,
  pub group: WidgetGroup,
  pub sort_order: i64,
  /// OBS Browser Source yolu — `/widgets/{kind}?obs=1` (BrowserRouter + HTTP)
  pub obs_path: &'static str,
  pub config: Value,
}

/// 17 enterprise widget — varsayılan `config_json` ile.
pub fn enterprise_widget_catalog() -> Vec<WidgetSeedDef> {
  raw_enterprise_catalog()
    .into_iter()
    .map(|mut def| {
      def.config = merge_universal_props(def.kind, def.config);
      def
    })
    .collect()
}

/// Master Overlay evrensel layout (1920×1080 referans).
fn master_layout_defaults(kind: &str) -> Value {
  match kind {
    "chat" => json!({
      "enabled": true,
      "position_x": 1440, "position_y": 40,
      "width": 460, "height": 1000, "z_index": 40
    }),
    "goal" => json!({
      "enabled": true,
      "position_x": 360, "position_y": 820,
      "width": 1200, "height": 140, "z_index": 45
    }),
    "cup" => json!({
      "enabled": true,
      "position_x": 24, "position_y": 560,
      "width": 400, "height": 480, "z_index": 25
    }),
    "emotewall" => json!({
      "enabled": true,
      "position_x": 0, "position_y": 0,
      "width": 1920, "height": 1080, "z_index": 2
    }),
    "kicksubs" => json!({
      "enabled": true,
      "position_x": 40, "position_y": 120,
      "width": 360, "height": 380, "z_index": 42
    }),
    "activity" => json!({
      "enabled": true,
      "position_x": 24, "position_y": 40,
      "width": 360, "height": 420, "z_index": 30
    }),
    "poll" => json!({
      "enabled": false,
      "position_x": 40, "position_y": 80,
      "width": 520, "height": 460, "z_index": 55
    }),
    "subathon" => json!({
      "enabled": false,
      "position_x": 700, "position_y": 40,
      "width": 520, "height": 140, "z_index": 32
    }),
    "viewers" => json!({
      "enabled": false,
      "position_x": 40, "position_y": 40,
      "width": 280, "height": 80, "z_index": 28
    }),
    "labels" => json!({
      "enabled": false,
      "position_x": 400, "position_y": 20,
      "width": 1120, "height": 56, "z_index": 27
    }),
    "emotecombo" => json!({
      "enabled": false,
      "position_x": 660, "position_y": 200,
      "width": 600, "height": 200, "z_index": 45
    }),
    "shoutout" => json!({
      "enabled": false,
      "position_x": 560, "position_y": 360,
      "width": 800, "height": 280, "z_index": 60
    }),
    "wheel" => json!({
      "enabled": false,
      "position_x": 560, "position_y": 140,
      "width": 800, "height": 800, "z_index": 70
    }),
    "raffles" => json!({
      "enabled": false,
      "position_x": 560, "position_y": 160,
      "width": 800, "height": 640, "z_index": 65
    }),
    "hypetrain" => json!({
      "enabled": false,
      "position_x": 480, "position_y": 40,
      "width": 960, "height": 120, "z_index": 50
    }),
    "songrequest" => json!({
      "enabled": false,
      "position_x": 40, "position_y": 900,
      "width": 420, "height": 140, "z_index": 38
    }),
    "tts" => json!({
      "enabled": false,
      "position_x": 700, "position_y": 880,
      "width": 520, "height": 100, "z_index": 36
    }),
    "credits" => json!({
      "enabled": false,
      "position_x": 0, "position_y": 0,
      "width": 1920, "height": 1080, "z_index": 100
    }),
    _ => json!({
      "enabled": true,
      "position_x": 0, "position_y": 0,
      "width": 1920, "height": 1080, "z_index": 10
    }),
  }
}

fn merge_universal_props(kind: &str, mut config: Value) -> Value {
  if !config.is_object() {
    config = json!({});
  }
  let obj = config.as_object_mut().unwrap();
  if let Some(defs) = master_layout_defaults(kind).as_object() {
    for (k, v) in defs {
      obj.entry(k.clone()).or_insert_with(|| v.clone());
    }
  }
  // Legacy alias senkronu
  if !obj.contains_key("posX") {
    if let Some(x) = obj.get("position_x").cloned() {
      obj.insert("posX".into(), x);
    }
  }
  if !obj.contains_key("posY") {
    if let Some(y) = obj.get("position_y").cloned() {
      obj.insert("posY".into(), y);
    }
  }
  if !obj.contains_key("scale") {
    obj.insert("scale".into(), json!(1));
  }
  obj.insert("schema".into(), json!(WIDGET_CONFIG_SCHEMA));
  config
}

fn raw_enterprise_catalog() -> Vec<WidgetSeedDef> {
  vec![
    // ── Grup 1: Hedefler ve Sayaçlar ──────────────────────────────
    WidgetSeedDef {
      kind: "goal",
      name: "Dinamik Hedef Barı",
      group: WidgetGroup::GoalsTrackers,
      sort_order: 10,
      obs_path: "/widgets/goal?obs=1",
      config: json!({
        "schema": WIDGET_CONFIG_SCHEMA,
        "metric": "followers",
        "metrics": ["followers", "subs", "tips", "kick"],
        "layout": "bar",
        "layouts": ["bar", "circle", "minimal"],
        "title": "Takipçi Hedefi",
        "startValue": 0,
        "current": 0,
        "target": 100,
        "colorFrom": "#3ECFCF",
        "colorTo": "#FF8A5B",
        "glowIntensity": 1,
        "volume": 72,
        "thickness": 18,
        "showPercent": true,
        "showValue": true,
        "showMilestones": true,
        "showBackground": true,
        "valuePrefix": "",
        "valueSuffix": "",
        "decimals": 0,
        "fontFamily": "Outfit",
        "fontSize": 22,
        "opacity": 1,
        "width": 720,
        "height": 140,
        "sfxEnabled": true,
        "sfxPreset": "success",
        "sfxPresets": ["none", "chime", "coin", "boom", "levelup", "sparkle", "success"],
        "sfxOnComplete": "preset:success",
        "sfxUrl": "",
        "triggerCreditsOnComplete": true,
        "triggerEmoteBurstOnComplete": true,
        "posX": 0,
        "posY": 0,
        "scale": 1,
        "rotateDeg": 0,
        "customCss": ""
      }),
    },
    WidgetSeedDef {
      kind: "subathon",
      name: "Subathon Sayaç",
      group: WidgetGroup::GoalsTrackers,
      sort_order: 20,
      obs_path: "/widgets/subathon?obs=1",
      config: json!({
        "schema": WIDGET_CONFIG_SCHEMA,
        "custom_title": "Subathon",
        "secondsRemaining": 3600,
        "time_per_follow": 120,
        "time_per_sub": 300,
        "time_per_donation": 60,
        "time_per_kick": 180,
        "secondsPerFollow": 120,
        "secondsPerSub": 300,
        "secondsPerTip": 60,
        "secondsPerKick": 180,
        "tipUnit": 1.0,
        "currency": "TRY",
        "autoFreezeWhenZero": true,
        "scale": 1,
        "theme": "neon",
        "themes": ["neon", "minimal", "cyberpunk"],
        "custom_bg_url": "",
        "font_family": "JetBrains Mono",
        "fontFamily": "JetBrains Mono",
        "fontSize": 48,
        "primary_color": "#22d3ee",
        "color": "#FFFFFF",
        "accent": "#FF8A5B",
        "background_opacity": 35,
        "showEndsAt": false,
        "endsAt": "",
        "opacity": 1
      }),
    },
    WidgetSeedDef {
      kind: "viewers",
      name: "İzleyici Sayacı",
      group: WidgetGroup::GoalsTrackers,
      sort_order: 30,
      obs_path: "/widgets/viewers?obs=1",
      config: json!({
        "schema": WIDGET_CONFIG_SCHEMA,
        "platforms": ["kick", "twitch"],
        "mode": "sum",
        "prefix": "",
        "suffix": " izleyici",
        "fontFamily": "Outfit",
        "fontSize": 42,
        "color": "#F1F5F9",
        "pulseOnChange": true,
        "opacity": 1
      }),
    },
    WidgetSeedDef {
      kind: "kicksubs",
      name: "Kick Aboneler",
      group: WidgetGroup::GoalsTrackers,
      sort_order: 15,
      obs_path: "/widgets/kicksubs?obs=1",
      config: json!({
        "schema": WIDGET_CONFIG_SCHEMA,
        "custom_title": "Kick Aboneler",
        "layout": "list",
        "layouts": ["list", "combined", "alert"],
        "theme": "kick",
        "themes": ["kick", "neon", "glass", "minimal", "cyber"],
        "maxItems": 6,
        "showTitle": true,
        "showMonths": true,
        "showGifted": true,
        "showSessionCount": true,
        "showGoal": false,
        "goalStart": 0,
        "goalCurrent": 0,
        "goalTarget": 50,
        "listTemplate": "{user} · {months} ay{gift}",
        "alertTemplate": "{user} abone oldu{gift}",
        "alertDurationMs": 4500,
        "fontFamily": "Outfit",
        "fontSize": 16,
        "accent": "#53fc18",
        "color": "#F4F4F5",
        "opacity": 1,
        "sfxEnabled": true,
        "sfxPreset": "chime",
        "sfxOnSub": "preset:chime",
        "volume": 65,
        "posX": 24,
        "posY": 40,
        "scale": 1,
        "customCss": ""
      }),
    },
    WidgetSeedDef {
      kind: "labels",
      name: "Yayın Etiketleri",
      group: WidgetGroup::GoalsTrackers,
      sort_order: 40,
      obs_path: "/widgets/labels?obs=1",
      config: json!({
        "schema": WIDGET_CONFIG_SCHEMA,
        "items": [
          { "id": "latest_sub", "label": "Son Abone", "source": "latest_sub", "value": "—" },
          { "id": "top_tipper", "label": "En Çok Bağış", "source": "top_tipper", "value": "—" },
          { "id": "latest_follow", "label": "Son Takipçi", "source": "latest_follow", "value": "—" }
        ],
        "marquee": false,
        "marqueeSpeed": 40,
        "separator": "  ·  ",
        "fontFamily": "Outfit",
        "fontSize": 20,
        "color": "#E2E8F0",
        "labelColor": "#94A3B8",
        "opacity": 1
      }),
    },
    // ── Grup 2: Fizik ve Görsel ───────────────────────────────────
    WidgetSeedDef {
      kind: "emotewall",
      name: "Emote Wall",
      group: WidgetGroup::PhysicsVisuals,
      sort_order: 50,
      obs_path: "/widgets/emotewall?obs=1",
      config: json!({
        "schema": WIDGET_CONFIG_SCHEMA,
        "maxOnScreen": 40,
        "minSize": 32,
        "maxSize": 96,
        "lifetimeMs": 6000,
        "spawnFrom": "chat",
        "physics": "bounce",
        "physicsModes": ["bounce", "float", "explode"],
        "gravity": 0.55,
        "burstOnHypeLevel": true,
        "burstCount": 24,
        "listenGoalComplete": true,
        "sfxEnabled": true,
        "sfxPreset": "sparkle",
        "sfxPresets": ["none", "chime", "coin", "boom", "levelup", "sparkle", "success"],
        "sfxUrl": "",
        "posX": 0,
        "posY": 0,
        "scale": 1,
        "rotateDeg": 0,
        "customCss": "",
        "minigameEnabled": false,
        "minigamePopCommand": "!patlat",
        "balloonCount": 8
      }),
    },
    WidgetSeedDef {
      kind: "emotecombo",
      name: "Emote Combo",
      group: WidgetGroup::PhysicsVisuals,
      sort_order: 60,
      obs_path: "/widgets/emotecombo?obs=1",
      config: json!({
        "schema": WIDGET_CONFIG_SCHEMA,
        "threshold": 2,
        "windowMs": 5000,
        "burstScale": 1.6,
        "showCount": true,
        "soundEnabled": false,
        "scale": 1,
        "opacity": 1
      }),
    },
    WidgetSeedDef {
      kind: "cup",
      name: "Tip / Bit Kupası",
      group: WidgetGroup::PhysicsVisuals,
      sort_order: 70,
      obs_path: "/widgets/cup?obs=1",
      config: json!({
        "schema": WIDGET_CONFIG_SCHEMA,
        "engine": "matter",
        "vessel": "cup",
        "vessels": ["cup", "box", "jar", "blackhole"],
        "cupWidth": 280,
        "cupHeight": 320,
        "maxBodies": 120,
        "spawnOn": ["tip", "sub", "cheer"],
        "bodyKinds": ["coin", "gem", "logo"],
        "gravity": 1.0,
        "weightFromAmount": true,
        "smallTipThreshold": 10,
        "bigTipThreshold": 100,
        "smallTipCount": 12,
        "bigTipScale": 2.2,
        "sfxEnabled": true,
        "sfxPreset": "coin",
        "sfxPresets": ["none", "chime", "coin", "boom", "levelup", "sparkle", "success"],
        "sfxOnDrop": "preset:coin",
        "sfxUrl": "",
        "posX": 0,
        "posY": 0,
        "scale": 1,
        "rotateDeg": 0,
        "customCss": "",
        "opacity": 1
      }),
    },
    // ── Grup 3: Sohbet ve Olaylar ─────────────────────────────────
    WidgetSeedDef {
      kind: "chat",
      name: "Chat Overlay",
      group: WidgetGroup::ChatEvents,
      sort_order: 80,
      obs_path: "/widgets/chat?obs=1",
      config: json!({
        "schema": WIDGET_CONFIG_SCHEMA,
        "theme": "boxed",
        "themes": ["boxed", "clean", "transparent", "bubbles", "streamline", "side", "neon", "glitch"],
        "messageAnim": "slide",
        "messageAnims": ["slide", "fade", "pop"],
        "direction": "bottom",
        "maxMessages": 16,
        "hideOldMessages": true,
        "hideAfterMs": 12000,
        "hideAfterSec": 12,
        "showBadges": true,
        "showPlatform": true,
        "showEmotes": true,
        "textShadow": true,
        "highlightMentions": true,
        "ignoreBots": false,
        "mentionUser": "",
        "lineGap": 8,
        "fontSize": 20,
        "font_family": "Outfit",
        "fontFamily": "Outfit",
        "primary_color": "#53fc18",
        "nameColor": "",
        "messageColor": "#e5e7eb",
        "bgColor": "rgba(8,12,20,0.55)",
        "background_opacity": 55,
        "accent": "#53fc18",
        "animationMs": 280,
        "opacity": 1,
        "sentimentEnabled": true,
        "hypeWaveEnabled": true,
        "hypeLetter": "W",
        "hypeThreshold": 8,
        "hypeWindowMs": 4000,
        "sfxEnabled": false,
        "sfxPreset": "sparkle",
        "sfxPresets": ["none", "chime", "coin", "boom", "levelup", "sparkle", "success"],
        "sfxUrl": "",
        "posX": 0,
        "posY": 0,
        "scale": 1,
        "rotateDeg": 0,
        "customCss": ""
      }),
    },
    WidgetSeedDef {
      kind: "activity",
      name: "Activity Feed",
      group: WidgetGroup::ChatEvents,
      sort_order: 90,
      obs_path: "/widgets/activity?obs=1",
      config: json!({
        "schema": WIDGET_CONFIG_SCHEMA,
        "maxItems": 12,
        "showFollow": true,
        "showSub": true,
        "showRaid": true,
        "showTip": true,
        "showCheer": true,
        "anim": "slide",
        "fontSize": 16,
        "opacity": 1
      }),
    },
    WidgetSeedDef {
      kind: "shoutout",
      name: "Shoutout (SO)",
      group: WidgetGroup::ChatEvents,
      sort_order: 100,
      obs_path: "/widgets/shoutout?obs=1",
      config: json!({
        "schema": WIDGET_CONFIG_SCHEMA,
        "command": "!so",
        "durationMs": 8000,
        "showAvatar": true,
        "showLastGame": true,
        "animIn": "fade-up",
        "animOut": "fade",
        "opacity": 1
      }),
    },
    // ── Grup 4: Oyunlaştırma ──────────────────────────────────────
    WidgetSeedDef {
      kind: "wheel",
      name: "Fortune Wheel",
      group: WidgetGroup::Gamification,
      sort_order: 110,
      obs_path: "/widgets/wheel?obs=1",
      config: json!({
        "schema": WIDGET_CONFIG_SCHEMA,
        "command": "!cark",
        "spinDurationMs": 5500,
        "slices": [
          { "label": "VIP", "color": "#3ecfcf" },
          { "label": "Ban", "color": "#EF4444" },
          { "label": "100 Puan", "color": "#ff8a5b" },
          { "label": "Tekrar", "color": "#334155" },
          { "label": "SFX", "color": "#F59E0B" },
          { "label": "Jackpot", "color": "#EC4899" }
        ],
        "segments": [
          { "label": "VIP", "color": "#3ecfcf", "weight": 1 },
          { "label": "Ban", "color": "#EF4444", "weight": 1 },
          { "label": "100 Puan", "color": "#ff8a5b", "weight": 2 },
          { "label": "Tekrar", "color": "#334155", "weight": 1 },
          { "label": "SFX", "color": "#F59E0B", "weight": 1 },
          { "label": "Jackpot", "color": "#EC4899", "weight": 1 }
        ],
        "showResultMs": 4000,
        "sfxEnabled": true,
        "sfxPreset": "boom",
        "sfxPresets": ["none", "chime", "coin", "boom", "levelup", "sparkle", "success"],
        "sfxOnStop": "preset:boom",
        "sfxUrl": "",
        "posX": 0,
        "posY": 0,
        "scale": 1,
        "rotateDeg": 0,
        "customCss": "",
        "opacity": 1
      }),
    },
    WidgetSeedDef {
      kind: "poll",
      name: "Anketler",
      group: WidgetGroup::Gamification,
      sort_order: 120,
      obs_path: "/widgets/poll?obs=1",
      config: json!({
        "schema": WIDGET_CONFIG_SCHEMA,
        "question": "Bugün ne oynayalım?",
        "options": ["Evet", "Hayır", "Valorant", "Just Chatting"],
        "command": "!oy",
        "voteCommand": "!oy",
        "durationSec": 60,
        "maxOptions": 6,
        "showPercent": true,
        "showVoteCommands": true,
        "barStyle": "gradient",
        "colorFrom": "#3ecfcf",
        "colorTo": "#ff8a5b",
        "opacity": 1,
        "sfxEnabled": true,
        "sfxPreset": "chime",
        "sfxPresets": ["none", "chime", "coin", "boom", "levelup", "sparkle", "success"],
        "sfxOnEnd": "preset:chime",
        "sfxUrl": "",
        "posX": 0,
        "posY": 0,
        "scale": 1,
        "rotateDeg": 0,
        "customCss": ""
      }),
    },
    WidgetSeedDef {
      kind: "raffles",
      name: "Çekilişler",
      group: WidgetGroup::Gamification,
      sort_order: 130,
      obs_path: "/widgets/raffles?obs=1",
      config: json!({
        "schema": WIDGET_CONFIG_SCHEMA,
        "joinCommand": "!katil",
        "maxVisibleEntrants": 40,
        "revealEffect": "burst",
        "autoCloseSec": 0,
        "opacity": 1
      }),
    },
    WidgetSeedDef {
      kind: "hypetrain",
      name: "Hype Train",
      group: WidgetGroup::Gamification,
      sort_order: 140,
      obs_path: "/widgets/hypetrain?obs=1",
      config: json!({
        "schema": WIDGET_CONFIG_SCHEMA,
        "windowSec": 300,
        "pointsPerSub": 10,
        "pointsPerTip": 5,
        "levels": [50, 120, 250, 500],
        "showTrain": true,
        "theme": "neon",
        "themes": ["neon", "minimal", "cyberpunk"],
        "custom_bg_url": "",
        "burstEmoteWallOnLevel": true,
        "sfxEnabled": true,
        "sfxPreset": "levelup",
        "sfxPresets": ["none", "chime", "coin", "boom", "levelup", "sparkle", "success"],
        "sfxOnLevel": "preset:levelup",
        "sfxUrl": "",
        "posX": 0,
        "posY": 0,
        "scale": 1,
        "rotateDeg": 0,
        "customCss": "",
        "opacity": 1
      }),
    },
    // ── Grup 5: Medya ve TTS ──────────────────────────────────────
    WidgetSeedDef {
      kind: "songrequest",
      name: "Song Request",
      group: WidgetGroup::MediaTts,
      sort_order: 150,
      obs_path: "/widgets/songrequest?obs=1",
      config: json!({
        "schema": WIDGET_CONFIG_SCHEMA,
        "command": "!sr",
        "requestCommand": "!sr",
        "volume": 70,
        "show_video": false,
        "sources": ["youtube", "local"],
        "allowYoutube": true,
        "allowSpotify": false,
        "showQueue": true,
        "maxQueue": 25,
        "showProgress": true,
        "showThumbnail": true,
        "opacity": 1
      }),
    },
    WidgetSeedDef {
      kind: "tts",
      name: "Cloud / Standart TTS",
      group: WidgetGroup::MediaTts,
      sort_order: 160,
      obs_path: "/widgets/tts?obs=1",
      config: json!({
        "schema": WIDGET_CONFIG_SCHEMA,
        "engine": "standard",
        "engines": ["standard", "cloud"],
        "lang": "tr-TR",
        "volume": 0.85,
        "readTips": true,
        "readSubs": true,
        "readChat": false,
        "minTipAmount": 0,
        "opacity": 1
      }),
    },
    // ── Grup 6: Yayın Sonu ────────────────────────────────────────
    WidgetSeedDef {
      kind: "credits",
      name: "Movie Credits",
      group: WidgetGroup::Utility,
      sort_order: 170,
      obs_path: "/widgets/credits?obs=1",
      config: json!({
        "schema": WIDGET_CONFIG_SCHEMA,
        "sections": ["followers", "subscribers", "tippers", "raiders"],
        "title": "Teşekkürler",
        "footer_message": "İzlediğiniz için teşekkürler!",
        "closingMessage": "İzlediğiniz için teşekkürler!",
        "scroll_speed": 5,
        "speedSec": 40,
        "custom_entries": [
          { "role": "Özel Sponsor", "name": "Ahmet" },
          { "role": "Moderatör", "name": "Axthrowa" }
        ],
        "fontFamily": "Outfit",
        "titleSize": 36,
        "lineSize": 22,
        "autoPlayOnGoalComplete": true,
        "sfxEnabled": true,
        "sfxPreset": "success",
        "sfxPresets": ["none", "chime", "coin", "boom", "levelup", "sparkle", "success"],
        "sfxUrl": "",
        "posX": 0,
        "posY": 0,
        "scale": 1,
        "rotateDeg": 0,
        "customCss": "",
        "opacity": 1
      }),
    },
  ]
}

/// Katalogun API / panel için JSON özeti.
pub fn catalog_as_json() -> Value {
  Value::Array(
    enterprise_widget_catalog()
      .into_iter()
      .map(|w| {
        json!({
          "kind": w.kind,
          "name": w.name,
          "group": w.group.as_str(),
          "groupLabel": w.group.label_tr(),
          "sort_order": w.sort_order,
          "obs_path": w.obs_path,
          "defaultConfig": w.config,
        })
      })
      .collect(),
  )
}

/// Eksik `kind` satırlarını varsayılan config ile ekler (mevcut config’e dokunmaz).
pub async fn seed_default_widgets(pool: &SqlitePool) -> Result<usize> {
  let channel_id = default_channel_id(pool).await?;
  let now = chrono_now();
  let mut inserted = 0usize;

  for def in enterprise_widget_catalog() {
    let exists: i64 = sqlx::query_scalar(
      "SELECT COUNT(*) FROM widget_instances WHERE channel_id = ? AND kind = ?",
    )
    .bind(&channel_id)
    .bind(def.kind)
    .fetch_one(pool)
    .await?;
    if exists > 0 {
      continue;
    }

    let id = format!("seed_{}", def.kind);
    let config_json = def.config.to_string();

    let r = sqlx::query(
      "INSERT INTO widget_instances(
         id, channel_id, kind, name, obs_path, config_json, enabled,
         schema_version, sort_order, updated_at
       ) VALUES(?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO NOTHING",
    )
    .bind(&id)
    .bind(&channel_id)
    .bind(def.kind)
    .bind(def.name)
    .bind(def.obs_path)
    .bind(&config_json)
    .bind(1_i64)
    .bind(WIDGET_CONFIG_SCHEMA)
    .bind(def.sort_order)
    .bind(now)
    .execute(pool)
    .await?;

    if r.rows_affected() > 0 {
      inserted += 1;
    } else {
      // seed_* id dolu ama kind yoksa yeni uuid ile dene
      let alt_id = uuid::Uuid::new_v4().to_string();
      let r2 = sqlx::query(
        "INSERT INTO widget_instances(
           id, channel_id, kind, name, obs_path, config_json, enabled,
           schema_version, sort_order, updated_at
         ) VALUES(?,?,?,?,?,?,?,?,?,?)",
      )
      .bind(&alt_id)
      .bind(&channel_id)
      .bind(def.kind)
      .bind(def.name)
      .bind(def.obs_path)
      .bind(&config_json)
      .bind(1_i64)
      .bind(WIDGET_CONFIG_SCHEMA)
      .bind(def.sort_order)
      .bind(now)
      .execute(pool)
      .await?;
      if r2.rows_affected() > 0 {
        inserted += 1;
      }
    }

    // Mevcut satırların eski hash OBS yolunu path'e çevir
    let _ = sqlx::query(
      "UPDATE widget_instances SET obs_path = ?, updated_at = ?
       WHERE channel_id = ? AND kind = ? AND (obs_path LIKE '%#%' OR obs_path NOT LIKE '/widgets/%')",
    )
    .bind(def.obs_path)
    .bind(now)
    .bind(&channel_id)
    .bind(def.kind)
    .execute(pool)
    .await;
  }

  let upgraded = upgrade_widget_configs(pool).await.unwrap_or(0);
  let mut patched = patch_subathon_configs(pool).await.unwrap_or(0);
  patched += patch_goal_layout(pool).await.unwrap_or(0);
  patched += patch_chat_widget_configs(pool).await.unwrap_or(0);
  patched += patch_kicksubs_widget_configs(pool).await.unwrap_or(0);
  Ok(inserted + upgraded + patched)
}

/// Eski Subathon config — "Tema İsmi" / eksik custom_title / time_per_* birleştirme.
pub async fn patch_subathon_configs(pool: &SqlitePool) -> Result<usize> {
  let channel_id = default_channel_id(pool).await?;
  let now = chrono_now();
  let rows: Vec<(String, String)> = sqlx::query_as(
    "SELECT id, config_json FROM widget_instances WHERE channel_id = ? AND kind = 'subathon'",
  )
  .bind(&channel_id)
  .fetch_all(pool)
  .await?;

  let mut n = 0usize;
  for (id, config_json) in rows {
    let mut cfg: Value = serde_json::from_str(&config_json).unwrap_or_else(|_| json!({}));
    let Some(obj) = cfg.as_object_mut() else {
      continue;
    };
    let mut changed = false;

    let bad_title = |s: &str| {
      let l = s.trim().to_lowercase();
      l.is_empty() || l == "tema ismi" || l == "tema ismi" || l.contains("tema ismi")
    };

    let custom = obj
      .get("custom_title")
      .and_then(|v| v.as_str())
      .unwrap_or("");
    if bad_title(custom) {
      obj.insert("custom_title".into(), json!("Subathon"));
      changed = true;
    }
    if obj.contains_key("title") {
      obj.remove("title");
      changed = true;
    }

    let pairs = [
      ("time_per_follow", "secondsPerFollow", 120),
      ("time_per_sub", "secondsPerSub", 300),
      ("time_per_donation", "secondsPerTip", 60),
      ("time_per_kick", "secondsPerKick", 180),
    ];
    for (primary, legacy, default) in pairs {
      if !obj.contains_key(primary) {
        let v = obj
          .get(legacy)
          .and_then(|x| x.as_i64().or_else(|| x.as_f64().map(|f| f as i64)))
          .unwrap_or(default);
        obj.insert(primary.into(), json!(v));
        changed = true;
      }
    }
    if obj.get("scale").is_none() {
      obj.insert("scale".into(), json!(1));
      changed = true;
    }

    if !changed {
      continue;
    }
    let merged = cfg.to_string();
    sqlx::query("UPDATE widget_instances SET config_json = ?, updated_at = ? WHERE id = ?")
      .bind(&merged)
      .bind(now)
      .bind(&id)
      .execute(pool)
      .await?;
    n += 1;
  }
  Ok(n)
}

/// Kick Aboneler — layout/tema temizliği + dağınık eski alanlar.
pub async fn patch_kicksubs_widget_configs(pool: &SqlitePool) -> Result<usize> {
  let channel_id = default_channel_id(pool).await?;
  let now = chrono_now();
  let rows: Vec<(String, String)> = sqlx::query_as(
    "SELECT id, config_json FROM widget_instances WHERE channel_id = ? AND kind IN ('kicksubs','kick-subs','kick_subs')",
  )
  .bind(&channel_id)
  .fetch_all(pool)
  .await?;

  let layouts = json!(["list", "combined", "alert"]);
  let themes = json!(["kick", "neon", "glass", "minimal", "cyber"]);

  let mut n = 0usize;
  for (id, config_json) in rows {
    let mut cfg: Value = serde_json::from_str(&config_json).unwrap_or_else(|_| json!({}));
    let Some(obj) = cfg.as_object_mut() else {
      continue;
    };
    let mut changed = false;

    let layout = obj
      .get("layout")
      .and_then(|v| v.as_str())
      .unwrap_or("list");
    if layout == "ticker" || layout.is_empty() {
      obj.insert("layout".into(), json!("list"));
      changed = true;
    }
    let layouts_len = obj
      .get("layouts")
      .and_then(|v| v.as_array())
      .map(|a| a.len())
      .unwrap_or(0);
    if layouts_len != 3 || obj.get("layouts").and_then(|v| v.as_array()).map(|a| a.iter().any(|x| x.as_str() == Some("ticker"))).unwrap_or(false) {
      obj.insert("layouts".into(), layouts.clone());
      changed = true;
    }
    if obj.get("themes").and_then(|v| v.as_array()).map(|a| a.len()).unwrap_or(0) < 3 {
      obj.insert("themes".into(), themes.clone());
      changed = true;
    }
    if obj.get("theme").and_then(|v| v.as_str()).unwrap_or("").is_empty() {
      obj.insert("theme".into(), json!("kick"));
      changed = true;
    }
    if obj.get("showGoal").is_none() {
      obj.insert("showGoal".into(), json!(false));
      changed = true;
    }
    if obj.get("maxItems").is_none() {
      obj.insert("maxItems".into(), json!(6));
      changed = true;
    }
    if obj.get("listTemplate").is_none() {
      obj.insert("listTemplate".into(), json!("{user} · {months} ay{gift}"));
      changed = true;
    }
    if obj.get("alertTemplate").is_none() {
      obj.insert("alertTemplate".into(), json!("{user} abone oldu{gift}"));
      changed = true;
    }
    for key in ["direction", "animation", "sessionCount"] {
      if obj.remove(key).is_some() {
        changed = true;
      }
    }

    if !changed {
      continue;
    }
    let merged = cfg.to_string();
    sqlx::query("UPDATE widget_instances SET config_json = ?, updated_at = ? WHERE id = ?")
      .bind(&merged)
      .bind(now)
      .bind(&id)
      .execute(pool)
      .await?;
    n += 1;
  }
  Ok(n)
}

/// Chat overlay — hazır temalar + gizleme / emote / gölge alanları.
pub async fn patch_chat_widget_configs(pool: &SqlitePool) -> Result<usize> {
  let channel_id = default_channel_id(pool).await?;
  let now = chrono_now();
  let rows: Vec<(String, String)> = sqlx::query_as(
    "SELECT id, config_json FROM widget_instances WHERE channel_id = ? AND kind = 'chat'",
  )
  .bind(&channel_id)
  .fetch_all(pool)
  .await?;

  let full_themes = json!([
    "boxed",
    "clean",
    "transparent",
    "bubbles",
    "streamline",
    "side",
    "neon",
    "glitch"
  ]);

  let mut n = 0usize;
  for (id, config_json) in rows {
    let mut cfg: Value = serde_json::from_str(&config_json).unwrap_or_else(|_| json!({}));
    let Some(obj) = cfg.as_object_mut() else {
      continue;
    };
    let mut changed = false;

    let themes_len = obj
      .get("themes")
      .and_then(|v| v.as_array())
      .map(|a| a.len())
      .unwrap_or(0);
    if themes_len < 5 {
      obj.insert("themes".into(), full_themes.clone());
      changed = true;
    }
    if obj.get("showEmotes").is_none() {
      obj.insert("showEmotes".into(), json!(true));
      changed = true;
    }
    if obj.get("textShadow").is_none() {
      obj.insert("textShadow".into(), json!(true));
      changed = true;
    }
    if obj.get("hideOldMessages").is_none() {
      let ms = obj
        .get("hideAfterMs")
        .and_then(|v| v.as_i64())
        .unwrap_or(0);
      obj.insert("hideOldMessages".into(), json!(ms > 0));
      changed = true;
    }
    if obj.get("direction").is_none() {
      obj.insert("direction".into(), json!("bottom"));
      changed = true;
    }
    if obj.get("lineGap").is_none() {
      obj.insert("lineGap".into(), json!(8));
      changed = true;
    }
    if obj.get("highlightMentions").is_none() {
      obj.insert("highlightMentions".into(), json!(true));
      changed = true;
    }

    if !changed {
      continue;
    }
    let merged = cfg.to_string();
    sqlx::query("UPDATE widget_instances SET config_json = ?, updated_at = ? WHERE id = ?")
      .bind(&merged)
      .bind(now)
      .bind(&id)
      .execute(pool)
      .await?;
    n += 1;
  }
  Ok(n)
}

/// Dar / alta sıkışmış hedef bar layout'unu önizlemede görünür hale getir.
pub async fn patch_goal_layout(pool: &SqlitePool) -> Result<usize> {
  let channel_id = default_channel_id(pool).await?;
  let now = chrono_now();
  let rows: Vec<(String, String)> = sqlx::query_as(
    "SELECT id, config_json FROM widget_instances WHERE channel_id = ? AND kind IN ('goal','goals')",
  )
  .bind(&channel_id)
  .fetch_all(pool)
  .await?;

  let mut n = 0usize;
  for (id, config_json) in rows {
    let mut cfg: Value = serde_json::from_str(&config_json).unwrap_or_else(|_| json!({}));
    let Some(obj) = cfg.as_object_mut() else {
      continue;
    };
    let mut changed = false;

    let h = obj.get("height").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let y = obj
      .get("position_y")
      .or_else(|| obj.get("posY"))
      .and_then(|v| v.as_f64())
      .unwrap_or(0.0);
    let w = obj.get("width").and_then(|v| v.as_f64()).unwrap_or(0.0);

    if h < 100.0 {
      obj.insert("height".into(), json!(140));
      changed = true;
    }
    if w < 400.0 {
      obj.insert("width".into(), json!(1200));
      changed = true;
    }
    if y > 900.0 || y < 0.0 {
      obj.insert("position_y".into(), json!(820));
      obj.insert("posY".into(), json!(820));
      changed = true;
    }
    // current'ı zorla doldurma — canlı/0 değerlerin üzerine yazıyordu
    if !obj.contains_key("showMilestones") {
      obj.insert("showMilestones".into(), json!(true));
      changed = true;
    }
    if !obj.contains_key("showBackground") {
      obj.insert("showBackground".into(), json!(true));
      changed = true;
    }
    if !obj.contains_key("position_x") && !obj.contains_key("posX") {
      obj.insert("position_x".into(), json!(360));
      obj.insert("posX".into(), json!(360));
      changed = true;
    }

    if !changed {
      continue;
    }
    let merged = cfg.to_string();
    sqlx::query("UPDATE widget_instances SET config_json = ?, updated_at = ? WHERE id = ?")
      .bind(&merged)
      .bind(now)
      .bind(&id)
      .execute(pool)
      .await?;
    n += 1;
  }
  Ok(n)
}

/// Eski satırlara eksik config anahtarlarını katalogdan birleştir (mevcut değerlerin üstüne yazmaz).
pub async fn upgrade_widget_configs(pool: &SqlitePool) -> Result<usize> {
  let channel_id = default_channel_id(pool).await?;
  let now = chrono_now();
  let mut n = 0usize;

  for def in enterprise_widget_catalog() {
    let row: Option<(String, String, i64)> = sqlx::query_as(
      "SELECT id, config_json, schema_version FROM widget_instances WHERE channel_id = ? AND kind = ?",
    )
    .bind(&channel_id)
    .bind(def.kind)
    .fetch_optional(pool)
    .await?;

    let Some((id, config_json, schema_ver)) = row else {
      continue;
    };
    if schema_ver >= WIDGET_CONFIG_SCHEMA {
      continue;
    }

    let mut cur: Value = serde_json::from_str(&config_json).unwrap_or_else(|_| json!({}));
    if !cur.is_object() {
      cur = json!({});
    }
    let obj = cur.as_object_mut().unwrap();
    if let Some(def_obj) = def.config.as_object() {
      for (k, v) in def_obj {
        if !obj.contains_key(k) {
          obj.insert(k.clone(), v.clone());
        }
      }
    }
    obj.insert("schema".into(), json!(WIDGET_CONFIG_SCHEMA));
    let merged = Value::Object(obj.clone()).to_string();

    let r = sqlx::query(
      "UPDATE widget_instances SET config_json = ?, schema_version = ?, updated_at = ? WHERE id = ?",
    )
    .bind(&merged)
    .bind(WIDGET_CONFIG_SCHEMA)
    .bind(now)
    .bind(&id)
    .execute(pool)
    .await?;
    if r.rows_affected() > 0 {
      n += 1;
    }
  }

  Ok(n)
}

pub async fn list_widgets(pool: &SqlitePool) -> Result<Vec<WidgetInstance>> {
  let channel_id = default_channel_id(pool).await?;
  let rows = sqlx::query_as(&format!(
    "{WIDGET_SELECT} WHERE channel_id = ? ORDER BY sort_order, name"
  ))
  .bind(&channel_id)
  .fetch_all(pool)
  .await?;
  Ok(rows)
}

pub async fn get_widget(pool: &SqlitePool, id: &str) -> Result<Option<WidgetInstance>> {
  let row = sqlx::query_as(&format!("{WIDGET_SELECT} WHERE id = ?"))
    .bind(id)
    .fetch_optional(pool)
    .await?;
  Ok(row)
}

pub async fn upsert_widget(
  pool: &SqlitePool,
  body: &Value,
  app_root: &std::path::Path,
  http_base: &str,
) -> Result<WidgetInstance> {
  let channel_id = default_channel_id(pool).await?;
  let id = body
    .get("id")
    .and_then(|v| v.as_str())
    .map(str::to_string)
    .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
  let kind = body
    .get("kind")
    .and_then(|v| v.as_str())
    .unwrap_or("custom")
    .to_string();
  let name = body
    .get("name")
    .and_then(|v| v.as_str())
    .unwrap_or("Widget")
    .to_string();
  let obs_path = body
    .get("obs_path")
    .and_then(|v| v.as_str())
    .unwrap_or("/")
    .to_string();

  let mut config = body
    .get("config")
    .cloned()
    .or_else(|| body.get("config_json").cloned())
    .unwrap_or(json!({}));
  if let Some(s) = config.as_str() {
    config = serde_json::from_str(s).unwrap_or(json!({}));
  }
  if let Some(obj) = config.as_object_mut() {
    for key in ["mediaPath", "media_path", "soundPath", "sound_path", "imageUrl", "videoUrl"] {
      if let Some(Value::String(p)) = obj.get(key).cloned() {
        if let Ok(n) = paths::normalize_for_storage(&p, app_root, http_base) {
          obj.insert(key.to_string(), json!(n));
        }
      }
    }
  }
  let enabled = body.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true);
  // config.enabled ↔ DB
  if let Some(obj) = config.as_object_mut() {
    obj.insert("enabled".into(), json!(enabled));
  }
  let config_json = config.to_string();
  let enabled = enabled as i64;
  let schema_version = body
    .get("schema_version")
    .and_then(|v| v.as_i64())
    .unwrap_or(WIDGET_CONFIG_SCHEMA);
  let sort_order = body
    .get("sort_order")
    .and_then(|v| v.as_i64())
    .unwrap_or(0);
  let now = chrono_now();

  sqlx::query(
    "INSERT INTO widget_instances(
       id, channel_id, kind, name, obs_path, config_json, enabled,
       schema_version, sort_order, updated_at
     ) VALUES(?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       kind=excluded.kind, name=excluded.name, obs_path=excluded.obs_path,
       config_json=excluded.config_json, enabled=excluded.enabled,
       schema_version=excluded.schema_version, sort_order=excluded.sort_order,
       updated_at=excluded.updated_at",
  )
  .bind(&id)
  .bind(&channel_id)
  .bind(&kind)
  .bind(&name)
  .bind(&obs_path)
  .bind(&config_json)
  .bind(enabled)
  .bind(schema_version)
  .bind(sort_order)
  .bind(now)
  .execute(pool)
  .await?;

  get_widget(pool, &id)
    .await?
    .context("widget yazıldı ama okunamadı")
}

pub async fn delete_widget(pool: &SqlitePool, id: &str) -> Result<bool> {
  let r = sqlx::query("DELETE FROM widget_instances WHERE id = ?")
    .bind(id)
    .execute(pool)
    .await?;
  Ok(r.rows_affected() > 0)
}

pub async fn patch_widget_config(
  pool: &SqlitePool,
  id: &str,
  patch: &Value,
  app_root: &std::path::Path,
  http_base: &str,
) -> Result<WidgetInstance> {
  let cur = get_widget(pool, id)
    .await?
    .context("widget bulunamadı")?;
  let mut cfg: Value = serde_json::from_str(&cur.config_json).unwrap_or(json!({}));
  if let (Some(base), Some(p)) = (cfg.as_object_mut(), patch.as_object()) {
    for (k, v) in p {
      base.insert(k.clone(), v.clone());
    }
  } else {
    cfg = patch.clone();
  }
  let enabled_flag = patch
    .get("enabled")
    .and_then(|v| v.as_bool())
    .unwrap_or(cur.enabled != 0);
  // config.enabled ↔ DB enabled senkron
  if let Some(obj) = cfg.as_object_mut() {
    obj.insert("enabled".into(), json!(enabled_flag));
  }
  let body = json!({
    "id": cur.id,
    "kind": cur.kind,
    "name": cur.name,
    "obs_path": cur.obs_path,
    "config": cfg,
    "enabled": enabled_flag,
    "schema_version": cur.schema_version.max(WIDGET_CONFIG_SCHEMA),
    "sort_order": cur.sort_order,
  });
  upsert_widget(pool, &body, app_root, http_base).await
}

/// OBS Browser Source URL'si — path tabanlı (`/widgets/chat?obs=1`).
pub fn obs_browser_url(http_base: &str, widget: &WidgetInstance) -> String {
  let base = http_base.trim_end_matches('/');
  let mut path = if widget.obs_path.starts_with('/') {
    widget.obs_path.clone()
  } else {
    format!("/{}", widget.obs_path)
  };
  // Eski hash URL → path
  if let Some(rest) = path.strip_prefix("/#") {
    path = if rest.starts_with('/') {
      rest.to_string()
    } else {
      format!("/{rest}")
    };
  }
  if !path.starts_with("/widgets/") && !path.starts_with("/overlay/") && !path.is_empty() {
    // kind fallback
    let kind = widget.kind.trim();
    if !kind.is_empty() {
      path = format!("/widgets/{kind}");
    }
  }
  // query'siz path + obs=1
  let path_only = path.split('?').next().unwrap_or(path.as_str());
  format!("{base}{path_only}?obs=1")
}

pub fn enrich_widget(http_base: &str, w: &WidgetInstance) -> Value {
  let mut v = serde_json::to_value(w).unwrap_or(json!({}));
  if let Some(obj) = v.as_object_mut() {
    obj.insert("obs_url".into(), json!(obs_browser_url(http_base, w)));
    if let Ok(cfg) = serde_json::from_str::<Value>(&w.config_json) {
      obj.insert("config".into(), cfg);
    }
    if let Some(def) = enterprise_widget_catalog()
      .into_iter()
      .find(|d| d.kind == w.kind)
    {
      obj.insert("group".into(), json!(def.group.as_str()));
      obj.insert("groupLabel".into(), json!(def.group.label_tr()));
    }
  }
  v
}

/// Widget `goal` current artır.
/// `tips_only`: true ise yalnızca bağış metrikli hedefler (webhook); false = test/manuel.
/// Dönüş: (widget_id, new_current, target, completed)
pub async fn bump_goal_widget_current(
  pool: &SqlitePool,
  amount: f64,
  tips_only: bool,
) -> Result<Vec<(String, f64, f64, bool)>> {
  let channel_id = default_channel_id(pool).await?;
  let rows: Vec<(String, String)> = sqlx::query_as(
    "SELECT id, config_json FROM widget_instances
     WHERE channel_id = ? AND kind IN ('goal','goals') AND enabled = 1
     ORDER BY sort_order LIMIT 8",
  )
  .bind(&channel_id)
  .fetch_all(pool)
  .await?;

  let now = chrono_now();
  let mut out = Vec::new();
  for (id, config_json) in rows {
    let mut cfg: Value = serde_json::from_str(&config_json).unwrap_or(json!({}));
    let metric = cfg
      .get("metric")
      .or_else(|| cfg.get("goalType"))
      .and_then(|v| v.as_str())
      .unwrap_or("followers")
      .to_ascii_lowercase();
    let is_tip = matches!(
      metric.as_str(),
      "tips" | "tip" | "donation" | "donate" | "bağış" | "bagis"
    );
    if tips_only && !is_tip {
      continue;
    }
    let cur = cfg
      .get("current")
      .and_then(|v| v.as_f64())
      .unwrap_or(0.0);
    let target = cfg
      .get("target")
      .and_then(|v| v.as_f64())
      .unwrap_or(100.0)
      .max(1.0);
    let new_cur = cur + amount;
    let completed = cur < target && new_cur >= target;
    if let Some(obj) = cfg.as_object_mut() {
      obj.insert("current".into(), json!(new_cur));
    }
    sqlx::query(
      "UPDATE widget_instances SET config_json = ?, updated_at = ? WHERE id = ?",
    )
    .bind(cfg.to_string())
    .bind(now)
    .bind(&id)
    .execute(pool)
    .await?;
    out.push((id, new_cur, target, completed));
  }
  Ok(out)
}

/// Olay türüne uyan hedef çubuklarını bir artırır (takipçi barı yalnız takipte).
pub async fn bump_goal_for_event(
  pool: &SqlitePool,
  event_kind: &str,
  amount: f64,
) -> Result<Vec<(String, f64, f64, bool)>> {
  let want: &[&str] = match event_kind {
    "follow" => &["followers", "follower", "follow", "takip", "takipci", "takipçi"],
    "sub" => &["subs", "sub", "subscribers", "subscriber", "abone"],
    "raid" => &["raids", "raid"],
    _ => return Ok(vec![]),
  };
  let channel_id = default_channel_id(pool).await?;
  let rows: Vec<(String, String)> = sqlx::query_as(
    "SELECT id, config_json FROM widget_instances
     WHERE channel_id = ? AND kind IN ('goal','goals') AND enabled = 1
     ORDER BY sort_order LIMIT 8",
  )
  .bind(&channel_id)
  .fetch_all(pool)
  .await?;

  let now = chrono_now();
  let mut out = Vec::new();
  for (id, config_json) in rows {
    let mut cfg: Value = serde_json::from_str(&config_json).unwrap_or(json!({}));
    let metric = cfg
      .get("metric")
      .or_else(|| cfg.get("goalType"))
      .and_then(|v| v.as_str())
      .unwrap_or("followers")
      .to_ascii_lowercase();
    if !want.iter().any(|m| *m == metric) {
      continue;
    }
    let cur = cfg.get("current").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let target = cfg.get("target").and_then(|v| v.as_f64()).unwrap_or(100.0).max(1.0);
    let new_cur = cur + amount;
    let completed = cur < target && new_cur >= target;
    if let Some(obj) = cfg.as_object_mut() {
      obj.insert("current".into(), json!(new_cur));
    }
    sqlx::query("UPDATE widget_instances SET config_json = ?, updated_at = ? WHERE id = ?")
      .bind(cfg.to_string())
      .bind(now)
      .bind(&id)
      .execute(pool)
      .await?;
    out.push((id, new_cur, target, completed));
  }
  Ok(out)
}
