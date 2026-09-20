-- Yerel Botaxt — Modül 1+ şema (sqlx migrate)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_meta (
  key   TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS channels (
  id             TEXT PRIMARY KEY NOT NULL,
  slug           TEXT NOT NULL,
  display_name   TEXT NOT NULL,
  platforms_json TEXT NOT NULL DEFAULT '{}',
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS stream_sessions (
  id             TEXT PRIMARY KEY NOT NULL,
  channel_id     TEXT NOT NULL,
  started_at     INTEGER NOT NULL,
  ended_at       INTEGER,
  title          TEXT,
  category       TEXT,
  peak_viewers   INTEGER NOT NULL DEFAULT 0,
  avg_viewers    REAL NOT NULL DEFAULT 0,
  new_followers  INTEGER NOT NULL DEFAULT 0,
  new_subs       INTEGER NOT NULL DEFAULT 0,
  tips_total     REAL NOT NULL DEFAULT 0,
  chat_messages  INTEGER NOT NULL DEFAULT 0,
  duration_sec   INTEGER,
  notes          TEXT,
  vod_url        TEXT,
  FOREIGN KEY (channel_id) REFERENCES channels(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_channel
  ON stream_sessions(channel_id, started_at DESC);

CREATE TABLE IF NOT EXISTS stream_metrics_samples (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT NOT NULL,
  ts          INTEGER NOT NULL,
  viewers     INTEGER NOT NULL DEFAULT 0,
  chat_rpm    REAL NOT NULL DEFAULT 0,
  followers   INTEGER NOT NULL DEFAULT 0,
  subs        INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (session_id) REFERENCES stream_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_metrics_session_ts
  ON stream_metrics_samples(session_id, ts);

CREATE TABLE IF NOT EXISTS events_log (
  id           TEXT PRIMARY KEY NOT NULL,
  session_id   TEXT,
  channel_id   TEXT NOT NULL,
  kind         TEXT NOT NULL,
  platform     TEXT NOT NULL,
  user_name    TEXT NOT NULL,
  user_id      TEXT,
  amount       REAL,
  message      TEXT,
  meta_json    TEXT NOT NULL DEFAULT '{}',
  ts           INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES stream_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_events_ts ON events_log(channel_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_events_kind ON events_log(kind, ts DESC);

CREATE TABLE IF NOT EXISTS alert_types (
  id            TEXT NOT NULL,
  channel_id    TEXT NOT NULL,
  enabled       INTEGER NOT NULL DEFAULT 1,
  label         TEXT NOT NULL,
  template      TEXT NOT NULL,
  duration_ms   INTEGER NOT NULL DEFAULT 6000,
  volume        REAL NOT NULL DEFAULT 0.8,
  media_path    TEXT,
  sound_path    TEXT,
  font_family   TEXT,
  font_size     INTEGER NOT NULL DEFAULT 32,
  text_color    TEXT NOT NULL DEFAULT '#FFFFFF',
  accent_color  TEXT NOT NULL DEFAULT '#3ECFCF',
  anim_in       TEXT NOT NULL DEFAULT 'fade',
  anim_out      TEXT NOT NULL DEFAULT 'fade',
  tts_enabled   INTEGER NOT NULL DEFAULT 0,
  tts_lang      TEXT NOT NULL DEFAULT 'tr-TR',
  min_amount    REAL NOT NULL DEFAULT 0,
  layout        TEXT NOT NULL DEFAULT 'banner',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (channel_id, id)
);

CREATE TABLE IF NOT EXISTS alert_queue (
  id           TEXT PRIMARY KEY NOT NULL,
  channel_id   TEXT NOT NULL,
  type_id      TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  created_at   INTEGER NOT NULL,
  played_at    INTEGER
);

CREATE TABLE IF NOT EXISTS widget_instances (
  id           TEXT PRIMARY KEY NOT NULL,
  channel_id   TEXT NOT NULL,
  kind         TEXT NOT NULL,
  name         TEXT NOT NULL,
  obs_path     TEXT NOT NULL,
  config_json  TEXT NOT NULL DEFAULT '{}',
  enabled      INTEGER NOT NULL DEFAULT 1,
  updated_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS goals (
  id             TEXT PRIMARY KEY NOT NULL,
  channel_id     TEXT NOT NULL,
  widget_id      TEXT,
  kind           TEXT NOT NULL,
  name           TEXT NOT NULL,
  current_value  REAL NOT NULL DEFAULT 0,
  target_value   REAL NOT NULL DEFAULT 100,
  color          TEXT NOT NULL DEFAULT '#3ECFCF',
  enabled        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS media_share_queue (
  id           TEXT PRIMARY KEY NOT NULL,
  channel_id   TEXT NOT NULL,
  user_key     TEXT NOT NULL,
  user_name    TEXT NOT NULL,
  url          TEXT NOT NULL,
  media_type   TEXT NOT NULL,
  cost_points  INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'queued',
  created_at   INTEGER NOT NULL,
  played_at    INTEGER
);

CREATE TABLE IF NOT EXISTS bot_settings (
  channel_id        TEXT PRIMARY KEY NOT NULL,
  enabled           INTEGER NOT NULL DEFAULT 1,
  bot_name          TEXT NOT NULL DEFAULT 'Bot',
  prefix            TEXT NOT NULL DEFAULT '!',
  reply_to_kick     INTEGER NOT NULL DEFAULT 1,
  reply_to_overlay  INTEGER NOT NULL DEFAULT 1,
  extras_json       TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS bot_commands (
  id                 TEXT PRIMARY KEY NOT NULL,
  channel_id         TEXT NOT NULL,
  name               TEXT NOT NULL,
  aliases_json       TEXT NOT NULL DEFAULT '[]',
  response           TEXT NOT NULL,
  enabled            INTEGER NOT NULL DEFAULT 1,
  cooldown_sec       INTEGER NOT NULL DEFAULT 5,
  user_cooldown_sec  INTEGER NOT NULL DEFAULT 0,
  min_level          INTEGER NOT NULL DEFAULT 0,
  cost_points        INTEGER NOT NULL DEFAULT 0,
  platforms_json     TEXT NOT NULL DEFAULT '["kick","twitch"]',
  live_only          INTEGER NOT NULL DEFAULT 0,
  count_uses         INTEGER NOT NULL DEFAULT 0,
  extras_json        TEXT NOT NULL DEFAULT '{}',
  UNIQUE(channel_id, name)
);

CREATE TABLE IF NOT EXISTS bot_timers (
  id              TEXT PRIMARY KEY NOT NULL,
  channel_id      TEXT NOT NULL,
  name            TEXT NOT NULL,
  message         TEXT NOT NULL,
  enabled         INTEGER NOT NULL DEFAULT 1,
  interval_sec    INTEGER NOT NULL DEFAULT 300,
  min_chat_lines  INTEGER NOT NULL DEFAULT 0,
  last_fired_at   INTEGER,
  lines_since     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bot_filters (
  channel_id      TEXT PRIMARY KEY NOT NULL,
  caps_enabled    INTEGER NOT NULL DEFAULT 0,
  caps_min_len    INTEGER NOT NULL DEFAULT 8,
  caps_ratio      REAL NOT NULL DEFAULT 0.7,
  links_enabled   INTEGER NOT NULL DEFAULT 0,
  symbols_enabled INTEGER NOT NULL DEFAULT 0,
  symbols_max     INTEGER NOT NULL DEFAULT 12,
  blacklist_json  TEXT NOT NULL DEFAULT '[]',
  action          TEXT NOT NULL DEFAULT 'delete',
  timeout_sec     INTEGER NOT NULL DEFAULT 60,
  exempt_level    INTEGER NOT NULL DEFAULT 500
);

CREATE TABLE IF NOT EXISTS bot_cooldowns (
  channel_id  TEXT NOT NULL,
  scope_key   TEXT NOT NULL,
  until_ts    INTEGER NOT NULL,
  PRIMARY KEY (channel_id, scope_key)
);

CREATE TABLE IF NOT EXISTS loyalty_settings (
  channel_id           TEXT PRIMARY KEY NOT NULL,
  points_name          TEXT NOT NULL DEFAULT 'Coin',
  points_per_interval  INTEGER NOT NULL DEFAULT 10,
  interval_sec         INTEGER NOT NULL DEFAULT 600,
  points_per_message   INTEGER NOT NULL DEFAULT 1,
  initial_points       INTEGER NOT NULL DEFAULT 0,
  ignored_users_json   TEXT NOT NULL DEFAULT '[]',
  extras_json          TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS loyalty_users (
  channel_id  TEXT NOT NULL,
  user_key    TEXT NOT NULL,
  user_name   TEXT NOT NULL,
  platform    TEXT NOT NULL,
  points      INTEGER NOT NULL DEFAULT 0,
  xp          INTEGER NOT NULL DEFAULT 0,
  rank_id     TEXT,
  messages    INTEGER NOT NULL DEFAULT 0,
  watch_sec   INTEGER NOT NULL DEFAULT 0,
  last_seen   INTEGER NOT NULL,
  PRIMARY KEY (channel_id, user_key)
);

CREATE TABLE IF NOT EXISTS loyalty_ranks (
  id          TEXT PRIMARY KEY NOT NULL,
  channel_id  TEXT NOT NULL,
  name        TEXT NOT NULL,
  min_xp      INTEGER NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS shop_items (
  id            TEXT PRIMARY KEY NOT NULL,
  channel_id    TEXT NOT NULL,
  name          TEXT NOT NULL,
  cost          INTEGER NOT NULL,
  response      TEXT NOT NULL DEFAULT '',
  enabled       INTEGER NOT NULL DEFAULT 1,
  alert         INTEGER NOT NULL DEFAULT 1,
  trigger_kind  TEXT NOT NULL DEFAULT 'chat',
  trigger_json  TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS shop_sales (
  id          TEXT PRIMARY KEY NOT NULL,
  channel_id  TEXT NOT NULL,
  user_key    TEXT NOT NULL,
  user_name   TEXT NOT NULL,
  item_id     TEXT NOT NULL,
  item_name   TEXT NOT NULL,
  cost        INTEGER NOT NULL,
  ts          INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS points_ledger (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id  TEXT NOT NULL,
  user_key    TEXT NOT NULL,
  delta       INTEGER NOT NULL,
  reason      TEXT NOT NULL,
  ref_id      TEXT,
  ts          INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ledger_user
  ON points_ledger(channel_id, user_key, ts DESC);

CREATE TABLE IF NOT EXISTS game_settings (
  channel_id   TEXT PRIMARY KEY NOT NULL,
  config_json  TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS game_rounds (
  id           TEXT PRIMARY KEY NOT NULL,
  channel_id   TEXT NOT NULL,
  game         TEXT NOT NULL,
  status       TEXT NOT NULL,
  pot          INTEGER NOT NULL DEFAULT 0,
  config_json  TEXT NOT NULL DEFAULT '{}',
  result_json  TEXT NOT NULL DEFAULT '{}',
  started_at   INTEGER NOT NULL,
  settled_at   INTEGER
);

CREATE TABLE IF NOT EXISTS game_bets (
  id           TEXT PRIMARY KEY NOT NULL,
  round_id     TEXT NOT NULL,
  user_key     TEXT NOT NULL,
  user_name    TEXT NOT NULL,
  amount       INTEGER NOT NULL,
  choice_json  TEXT NOT NULL DEFAULT '{}',
  payout       INTEGER NOT NULL DEFAULT 0,
  ts           INTEGER NOT NULL,
  FOREIGN KEY (round_id) REFERENCES game_rounds(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS integrations (
  channel_id   TEXT NOT NULL,
  provider     TEXT NOT NULL,
  enabled      INTEGER NOT NULL DEFAULT 0,
  config_json  TEXT NOT NULL DEFAULT '{}',
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (channel_id, provider)
);

CREATE TABLE IF NOT EXISTS soundboard_pads (
  id           TEXT PRIMARY KEY NOT NULL,
  channel_id   TEXT NOT NULL,
  name         TEXT NOT NULL,
  file_path    TEXT NOT NULL,
  hotkey       TEXT,
  volume       REAL NOT NULL DEFAULT 0.8,
  sort_order   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS remote_users (
  id               TEXT PRIMARY KEY NOT NULL,
  channel_id       TEXT NOT NULL,
  username         TEXT NOT NULL,
  password_hash    TEXT NOT NULL,
  role             TEXT NOT NULL DEFAULT 'editor',
  permissions_json TEXT NOT NULL DEFAULT '[]',
  enabled          INTEGER NOT NULL DEFAULT 1,
  created_at       INTEGER NOT NULL,
  UNIQUE(channel_id, username)
);

CREATE TABLE IF NOT EXISTS remote_sessions (
  token        TEXT PRIMARY KEY NOT NULL,
  user_id      TEXT NOT NULL,
  expires_at   INTEGER NOT NULL,
  created_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  ip_hint      TEXT,
  FOREIGN KEY (user_id) REFERENCES remote_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id   TEXT NOT NULL,
  actor        TEXT NOT NULL,
  action       TEXT NOT NULL,
  detail_json  TEXT NOT NULL DEFAULT '{}',
  ts           INTEGER NOT NULL
);
