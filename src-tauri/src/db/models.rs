//! SQLite satır modelleri — enterprise şema (005 dahil).

use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Channel {
  pub id: String,
  pub slug: String,
  pub display_name: String,
  pub platforms_json: String,
  pub created_at: i64,
  pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct StreamSession {
  pub id: String,
  pub channel_id: String,
  pub started_at: i64,
  pub ended_at: Option<i64>,
  pub title: Option<String>,
  pub category: Option<String>,
  pub peak_viewers: i64,
  pub avg_viewers: f64,
  pub new_followers: i64,
  pub new_subs: i64,
  pub tips_total: f64,
  pub chat_messages: i64,
  pub duration_sec: Option<i64>,
  pub notes: Option<String>,
  pub vod_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct EventLog {
  pub id: String,
  pub session_id: Option<String>,
  pub channel_id: String,
  pub kind: String,
  pub platform: String,
  pub user_name: String,
  pub user_id: Option<String>,
  pub amount: Option<f64>,
  pub message: Option<String>,
  pub meta_json: String,
  pub ts: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardSnapshot {
  pub channel_id: String,
  pub channel_name: String,
  pub active_session: Option<StreamSession>,
  pub viewers: i64,
  pub chat_rpm: f64,
  pub session_followers: i64,
  pub session_subs: i64,
  pub session_chat: i64,
  pub active_chatters: i64,
  pub session_viewers: i64,
  pub loyalty_users: i64,
  pub commands: i64,
  pub recent_events: Vec<EventLog>,
  pub sessions: Vec<StreamSession>,
  pub eski_panel_aktarildi: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AlertType {
  pub id: String,
  pub channel_id: String,
  pub enabled: i64,
  pub label: String,
  pub template: String,
  pub duration_ms: i64,
  pub volume: f64,
  pub media_path: Option<String>,
  pub sound_path: Option<String>,
  pub font_family: Option<String>,
  pub font_size: i64,
  pub text_color: String,
  pub accent_color: String,
  pub anim_in: String,
  pub anim_out: String,
  pub tts_enabled: i64,
  pub tts_lang: String,
  pub min_amount: f64,
  pub layout: String,
  pub sort_order: i64,
  pub custom_html: Option<String>,
  pub custom_css: Option<String>,
  pub tts_rate: f64,
  pub tts_volume: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AlertQueueItem {
  pub id: String,
  pub channel_id: String,
  pub type_id: String,
  pub variant_id: Option<String>,
  pub payload_json: String,
  pub status: String,
  pub priority: i64,
  pub created_at: i64,
  pub played_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AlertVariant {
  pub id: String,
  pub channel_id: String,
  pub type_id: String,
  pub name: String,
  pub min_amount: f64,
  pub max_amount: Option<f64>,
  pub enabled: i64,
  pub template: String,
  pub media_path: Option<String>,
  pub sound_path: Option<String>,
  pub duration_ms: i64,
  pub volume: f64,
  pub anim_in: Option<String>,
  pub layout: Option<String>,
  pub custom_html: Option<String>,
  pub custom_css: Option<String>,
  pub sort_order: i64,
  pub extras_json: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct WidgetInstance {
  pub id: String,
  pub channel_id: String,
  pub kind: String,
  pub name: String,
  pub obs_path: String,
  pub config_json: String,
  pub enabled: i64,
  pub schema_version: i64,
  pub sort_order: i64,
  pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Goal {
  pub id: String,
  pub channel_id: String,
  pub widget_id: Option<String>,
  pub kind: String,
  pub name: String,
  pub current_value: f64,
  pub target_value: f64,
  pub start_value: f64,
  pub ends_at: Option<i64>,
  pub color: String,
  pub gradient_to: Option<String>,
  pub thickness: i64,
  pub enabled: i64,
  pub layout: String,
  pub show_percent: i64,
  pub schema_version: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BotSettings {
  pub channel_id: String,
  pub enabled: i64,
  pub bot_name: String,
  pub prefix: String,
  pub reply_to_kick: i64,
  pub reply_to_twitch: i64,
  pub reply_to_youtube: i64,
  pub reply_to_overlay: i64,
  pub reply_delay_ms: i64,
  pub extras_json: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BotCommand {
  pub id: String,
  pub channel_id: String,
  pub name: String,
  pub aliases_json: String,
  pub response: String,
  pub enabled: i64,
  pub cooldown_sec: i64,
  pub user_cooldown_sec: i64,
  pub min_level: i64,
  pub cost_points: i64,
  pub platforms_json: String,
  pub live_only: i64,
  pub count_uses: i64,
  pub extras_json: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BotTimer {
  pub id: String,
  pub channel_id: String,
  pub name: String,
  pub message: String,
  pub enabled: i64,
  pub interval_sec: i64,
  pub min_chat_lines: i64,
  pub last_fired_at: Option<i64>,
  pub lines_since: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BotFilters {
  pub channel_id: String,
  pub caps_enabled: i64,
  pub caps_min_len: i64,
  pub caps_ratio: f64,
  pub long_msg_enabled: i64,
  pub long_msg_max: i64,
  pub links_enabled: i64,
  pub symbols_enabled: i64,
  pub symbols_max: i64,
  pub blacklist_json: String,
  pub action: String,
  pub timeout_sec: i64,
  pub exempt_level: i64,
  pub strike_window_sec: i64,
  pub strike_ladder_json: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct LoyaltySettings {
  pub channel_id: String,
  pub points_name: String,
  pub points_per_interval: i64,
  pub interval_sec: i64,
  pub points_per_message: i64,
  pub initial_points: i64,
  pub sub_multiplier: f64,
  pub tip_points_per_unit: i64,
  pub tip_currency_unit: f64,
  pub ignored_users_json: String,
  pub extras_json: String,
  pub last_tick_at: Option<i64>,
  pub tick_enabled: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct LoyaltyUser {
  pub channel_id: String,
  pub user_key: String,
  pub user_name: String,
  pub platform: String,
  pub points: i64,
  pub xp: i64,
  pub rank_id: Option<String>,
  pub messages: i64,
  pub watch_sec: i64,
  pub last_seen: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ShopItem {
  pub id: String,
  pub channel_id: String,
  pub name: String,
  pub cost: i64,
  pub response: String,
  pub enabled: i64,
  pub alert: i64,
  pub stock: Option<i64>,
  pub cooldown_sec: i64,
  pub trigger_kind: String,
  pub trigger_json: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ShopSale {
  pub id: String,
  pub channel_id: String,
  pub user_key: String,
  pub user_name: String,
  pub item_id: String,
  pub item_name: String,
  pub cost: i64,
  pub ts: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct GameSettings {
  pub channel_id: String,
  pub config_json: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct GameRound {
  pub id: String,
  pub channel_id: String,
  pub game: String,
  pub status: String,
  pub pot: i64,
  pub config_json: String,
  pub result_json: String,
  pub started_at: i64,
  pub settled_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Integration {
  pub channel_id: String,
  pub provider: String,
  pub enabled: i64,
  pub config_json: String,
  pub secrets_json: String,
  pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SoundboardPad {
  pub id: String,
  pub channel_id: String,
  pub name: String,
  pub file_path: String,
  pub hotkey: Option<String>,
  pub volume: f64,
  pub sort_order: i64,
}

