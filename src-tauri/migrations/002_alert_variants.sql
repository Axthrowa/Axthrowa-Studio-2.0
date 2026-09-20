-- Alert varyantları (min tutar / alternatif medya)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS alert_variants (
  id            TEXT PRIMARY KEY NOT NULL,
  channel_id    TEXT NOT NULL,
  type_id       TEXT NOT NULL,
  name          TEXT NOT NULL,
  min_amount    REAL NOT NULL DEFAULT 0,
  enabled       INTEGER NOT NULL DEFAULT 1,
  template      TEXT NOT NULL DEFAULT '',
  media_path    TEXT,
  sound_path    TEXT,
  duration_ms   INTEGER NOT NULL DEFAULT 6000,
  volume        REAL NOT NULL DEFAULT 0.8,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  extras_json   TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_alert_variants_type
  ON alert_variants(channel_id, type_id, min_amount DESC);
