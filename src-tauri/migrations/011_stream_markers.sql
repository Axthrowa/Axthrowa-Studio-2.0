-- U6: an işaretleme. Kısayol, deste tuşu ya da sohbetteki !isaret yayının o anını işaretler.
CREATE TABLE IF NOT EXISTS stream_markers (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id   TEXT,
  ts           INTEGER NOT NULL,
  offset_ms    INTEGER,
  scene        TEXT,
  note         TEXT,
  replay_path  TEXT,
  chapter      INTEGER NOT NULL DEFAULT 0,
  via          TEXT,
  FOREIGN KEY (session_id) REFERENCES stream_sessions(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_stream_markers_session ON stream_markers(session_id, ts);
