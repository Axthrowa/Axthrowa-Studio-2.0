-- 005 Enterprise core — onaylı şema genişlemesi
-- 1) user_key → loyalty_users FK (CASCADE)
-- 2) loyalty_users leaderboard indeksleri (points/xp DESC)
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Orphan önleme: ledger/sales/bets satırları için loyalty_users satırı üret
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO loyalty_users (
  channel_id, user_key, user_name, platform, points, xp, messages, watch_sec, last_seen
)
SELECT DISTINCT
  pl.channel_id,
  pl.user_key,
  pl.user_key,
  CASE
    WHEN instr(pl.user_key, ':') > 0 THEN substr(pl.user_key, 1, instr(pl.user_key, ':') - 1)
    ELSE 'local'
  END,
  0, 0, 0, 0, 0
FROM points_ledger pl
WHERE pl.user_key IS NOT NULL AND trim(pl.user_key) != '';

INSERT OR IGNORE INTO loyalty_users (
  channel_id, user_key, user_name, platform, points, xp, messages, watch_sec, last_seen
)
SELECT DISTINCT
  ss.channel_id,
  ss.user_key,
  COALESCE(NULLIF(trim(ss.user_name), ''), ss.user_key),
  CASE
    WHEN instr(ss.user_key, ':') > 0 THEN substr(ss.user_key, 1, instr(ss.user_key, ':') - 1)
    ELSE 'local'
  END,
  0, 0, 0, 0, 0
FROM shop_sales ss
WHERE ss.user_key IS NOT NULL AND trim(ss.user_key) != '';

INSERT OR IGNORE INTO loyalty_users (
  channel_id, user_key, user_name, platform, points, xp, messages, watch_sec, last_seen
)
SELECT DISTINCT
  gr.channel_id,
  gb.user_key,
  COALESCE(NULLIF(trim(gb.user_name), ''), gb.user_key),
  CASE
    WHEN instr(gb.user_key, ':') > 0 THEN substr(gb.user_key, 1, instr(gb.user_key, ':') - 1)
    ELSE 'local'
  END,
  0, 0, 0, 0, 0
FROM game_bets gb
JOIN game_rounds gr ON gr.id = gb.round_id
WHERE gb.user_key IS NOT NULL AND trim(gb.user_key) != '';

-- ---------------------------------------------------------------------------
-- Leaderboard indexing (!top / !leaderboard)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_loyalty_users_points
  ON loyalty_users(channel_id, points DESC);

CREATE INDEX IF NOT EXISTS idx_loyalty_users_xp
  ON loyalty_users(channel_id, xp DESC);

CREATE INDEX IF NOT EXISTS idx_loyalty_users_name
  ON loyalty_users(channel_id, user_name COLLATE NOCASE);

-- ---------------------------------------------------------------------------
-- points_ledger → loyalty_users FK (tablo yeniden kurulum — SQLite ALTER FK yok)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS points_ledger__v5 (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id  TEXT NOT NULL,
  user_key    TEXT NOT NULL,
  delta       INTEGER NOT NULL,
  reason      TEXT NOT NULL,
  ref_id      TEXT,
  ts          INTEGER NOT NULL,
  FOREIGN KEY (channel_id, user_key)
    REFERENCES loyalty_users(channel_id, user_key)
    ON DELETE CASCADE
);

INSERT INTO points_ledger__v5 (id, channel_id, user_key, delta, reason, ref_id, ts)
SELECT id, channel_id, user_key, delta, reason, ref_id, ts
FROM points_ledger
WHERE EXISTS (
  SELECT 1 FROM loyalty_users lu
  WHERE lu.channel_id = points_ledger.channel_id
    AND lu.user_key = points_ledger.user_key
);

DROP TABLE points_ledger;
ALTER TABLE points_ledger__v5 RENAME TO points_ledger;

CREATE INDEX IF NOT EXISTS idx_ledger_user
  ON points_ledger(channel_id, user_key, ts DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_ts
  ON points_ledger(channel_id, ts DESC);

-- ---------------------------------------------------------------------------
-- shop_sales → loyalty_users FK
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shop_sales__v5 (
  id          TEXT PRIMARY KEY NOT NULL,
  channel_id  TEXT NOT NULL,
  user_key    TEXT NOT NULL,
  user_name   TEXT NOT NULL,
  item_id     TEXT NOT NULL,
  item_name   TEXT NOT NULL,
  cost        INTEGER NOT NULL,
  ts          INTEGER NOT NULL,
  FOREIGN KEY (channel_id, user_key)
    REFERENCES loyalty_users(channel_id, user_key)
    ON DELETE CASCADE
);

INSERT INTO shop_sales__v5 (id, channel_id, user_key, user_name, item_id, item_name, cost, ts)
SELECT id, channel_id, user_key, user_name, item_id, item_name, cost, ts
FROM shop_sales
WHERE EXISTS (
  SELECT 1 FROM loyalty_users lu
  WHERE lu.channel_id = shop_sales.channel_id
    AND lu.user_key = shop_sales.user_key
);

DROP TABLE shop_sales;
ALTER TABLE shop_sales__v5 RENAME TO shop_sales;

CREATE INDEX IF NOT EXISTS idx_shop_sales_user
  ON shop_sales(channel_id, user_key, ts DESC);
CREATE INDEX IF NOT EXISTS idx_shop_sales_ts
  ON shop_sales(channel_id, ts DESC);

-- ---------------------------------------------------------------------------
-- game_bets → channel_id + loyalty_users FK (round CASCADE korunur)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS game_bets__v5 (
  id           TEXT PRIMARY KEY NOT NULL,
  round_id     TEXT NOT NULL,
  channel_id   TEXT NOT NULL,
  user_key     TEXT NOT NULL,
  user_name    TEXT NOT NULL,
  amount       INTEGER NOT NULL,
  choice_json  TEXT NOT NULL DEFAULT '{}',
  payout       INTEGER NOT NULL DEFAULT 0,
  ts           INTEGER NOT NULL,
  FOREIGN KEY (round_id) REFERENCES game_rounds(id) ON DELETE CASCADE,
  FOREIGN KEY (channel_id, user_key)
    REFERENCES loyalty_users(channel_id, user_key)
    ON DELETE CASCADE
);

INSERT INTO game_bets__v5 (
  id, round_id, channel_id, user_key, user_name, amount, choice_json, payout, ts
)
SELECT
  gb.id,
  gb.round_id,
  gr.channel_id,
  gb.user_key,
  gb.user_name,
  gb.amount,
  gb.choice_json,
  gb.payout,
  gb.ts
FROM game_bets gb
JOIN game_rounds gr ON gr.id = gb.round_id
WHERE EXISTS (
  SELECT 1 FROM loyalty_users lu
  WHERE lu.channel_id = gr.channel_id
    AND lu.user_key = gb.user_key
);

DROP TABLE game_bets;
ALTER TABLE game_bets__v5 RENAME TO game_bets;

CREATE INDEX IF NOT EXISTS idx_bets_round ON game_bets(round_id);
CREATE INDEX IF NOT EXISTS idx_bets_user ON game_bets(channel_id, user_key, ts DESC);

-- ---------------------------------------------------------------------------
-- moderation_strikes (yeni) + loyalty_users FK
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS moderation_strikes (
  id          TEXT PRIMARY KEY NOT NULL,
  channel_id  TEXT NOT NULL,
  user_key    TEXT NOT NULL,
  reason      TEXT NOT NULL,
  action      TEXT NOT NULL,
  ts          INTEGER NOT NULL,
  expires_at  INTEGER,
  FOREIGN KEY (channel_id, user_key)
    REFERENCES loyalty_users(channel_id, user_key)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_strikes_user
  ON moderation_strikes(channel_id, user_key, ts DESC);

-- ---------------------------------------------------------------------------
-- bot_modules registry
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bot_modules (
  channel_id  TEXT NOT NULL,
  module_id   TEXT NOT NULL,
  enabled     INTEGER NOT NULL DEFAULT 1,
  config_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (channel_id, module_id)
);

-- ---------------------------------------------------------------------------
-- Alert genişletmeleri
-- ---------------------------------------------------------------------------
ALTER TABLE alert_types ADD COLUMN custom_html TEXT;
ALTER TABLE alert_types ADD COLUMN custom_css TEXT;
ALTER TABLE alert_types ADD COLUMN tts_rate REAL NOT NULL DEFAULT 1.0;
ALTER TABLE alert_types ADD COLUMN tts_volume REAL NOT NULL DEFAULT 1.0;

ALTER TABLE alert_variants ADD COLUMN max_amount REAL;
ALTER TABLE alert_variants ADD COLUMN anim_in TEXT;
ALTER TABLE alert_variants ADD COLUMN layout TEXT;
ALTER TABLE alert_variants ADD COLUMN custom_html TEXT;
ALTER TABLE alert_variants ADD COLUMN custom_css TEXT;

ALTER TABLE alert_queue ADD COLUMN variant_id TEXT;
ALTER TABLE alert_queue ADD COLUMN priority INTEGER NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- Goals genişletmeleri
-- ---------------------------------------------------------------------------
ALTER TABLE goals ADD COLUMN start_value REAL NOT NULL DEFAULT 0;
ALTER TABLE goals ADD COLUMN ends_at INTEGER;
ALTER TABLE goals ADD COLUMN gradient_to TEXT;
ALTER TABLE goals ADD COLUMN thickness INTEGER NOT NULL DEFAULT 16;

-- ---------------------------------------------------------------------------
-- Bot settings / filters / loyalty / shop / integrations
-- ---------------------------------------------------------------------------
ALTER TABLE bot_settings ADD COLUMN reply_to_twitch INTEGER NOT NULL DEFAULT 1;
ALTER TABLE bot_settings ADD COLUMN reply_to_youtube INTEGER NOT NULL DEFAULT 1;
ALTER TABLE bot_settings ADD COLUMN reply_delay_ms INTEGER NOT NULL DEFAULT 480;

ALTER TABLE bot_filters ADD COLUMN long_msg_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bot_filters ADD COLUMN long_msg_max INTEGER NOT NULL DEFAULT 300;
ALTER TABLE bot_filters ADD COLUMN strike_window_sec INTEGER NOT NULL DEFAULT 600;
ALTER TABLE bot_filters ADD COLUMN strike_ladder_json TEXT NOT NULL DEFAULT '["warn","delete","timeout","ban"]';

ALTER TABLE loyalty_settings ADD COLUMN sub_multiplier REAL NOT NULL DEFAULT 1.5;
ALTER TABLE loyalty_settings ADD COLUMN tip_points_per_unit INTEGER NOT NULL DEFAULT 100;
ALTER TABLE loyalty_settings ADD COLUMN tip_currency_unit REAL NOT NULL DEFAULT 1.0;

ALTER TABLE loyalty_ranks ADD COLUMN join_message TEXT;

ALTER TABLE shop_items ADD COLUMN stock INTEGER;
ALTER TABLE shop_items ADD COLUMN cooldown_sec INTEGER NOT NULL DEFAULT 0;

ALTER TABLE media_share_queue ADD COLUMN duration_sec INTEGER;

ALTER TABLE integrations ADD COLUMN secrets_json TEXT NOT NULL DEFAULT '{}';

-- Meta bayrak
INSERT INTO app_meta(key, value) VALUES('schema_enterprise_v5', '1')
ON CONFLICT(key) DO UPDATE SET value = excluded.value;
