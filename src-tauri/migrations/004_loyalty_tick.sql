-- Sadakat izleme tick + bits olay geçmişi
-- sqlx migrasyonları bir kez çalışır; SQLite ADD COLUMN bu yüzden güvenli.
PRAGMA foreign_keys = ON;

ALTER TABLE loyalty_settings ADD COLUMN last_tick_at INTEGER;
ALTER TABLE loyalty_settings ADD COLUMN tick_enabled INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS recent_bits (
  id          TEXT PRIMARY KEY NOT NULL,
  channel_id  TEXT NOT NULL,
  user_name   TEXT NOT NULL,
  user_key    TEXT NOT NULL,
  amount      REAL NOT NULL DEFAULT 0,
  message     TEXT,
  ts          INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recent_bits_ts
  ON recent_bits(channel_id, ts DESC);
