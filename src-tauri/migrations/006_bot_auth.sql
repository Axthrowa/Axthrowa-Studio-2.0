-- Kick bot cookie oturumu (kick_session + XSRF-TOKEN)
CREATE TABLE IF NOT EXISTS bot_auth (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  cookie_header TEXT NOT NULL DEFAULT '',
  xsrf_token    TEXT NOT NULL DEFAULT '',
  bearer_token  TEXT NOT NULL DEFAULT '',
  username      TEXT NOT NULL DEFAULT '',
  user_id       INTEGER NOT NULL DEFAULT 0,
  channel_slug  TEXT NOT NULL DEFAULT '',
  chatroom_id   INTEGER NOT NULL DEFAULT 0,
  config_json   TEXT NOT NULL DEFAULT '{}',
  updated_at    INTEGER NOT NULL DEFAULT 0
);
