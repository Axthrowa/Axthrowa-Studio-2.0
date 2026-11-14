-- U7b: yayın raporunda düşen kare. Studio yayını bitirirken OBS'in son sayaçlarını yazar.
CREATE TABLE IF NOT EXISTS stream_session_frames (
  session_id  TEXT PRIMARY KEY NOT NULL,
  dropped     INTEGER NOT NULL,
  total       INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES stream_sessions(id) ON DELETE CASCADE
);
