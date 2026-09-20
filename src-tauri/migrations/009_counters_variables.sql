-- Sayaçlar ve kalıcı değişkenler — BotRix komut değişkenleri için.
--
-- $(count) / $(getcounter) / $(setcounter) ve !editcounter sayaçları,
-- $(uservar) / $(globalvar) ise kullanıcı ve kanal düzeyinde kalıcı
-- değerleri kullanır. Değerler metin olarak saklanır: BotRix de öyle yapıyor
-- ve JSON yardımcıları ($(json ...)) aynı alanı okuyor.

CREATE TABLE IF NOT EXISTS bot_counters (
  channel_id TEXT NOT NULL,
  name       TEXT NOT NULL,
  value      REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (channel_id, name)
);

CREATE TABLE IF NOT EXISTS bot_variables (
  channel_id TEXT NOT NULL,
  scope      TEXT NOT NULL,            -- 'user' | 'global'
  owner      TEXT NOT NULL DEFAULT '', -- scope='user' ise kullanıcı anahtarı
  key        TEXT NOT NULL,
  value      TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (channel_id, scope, owner, key)
);

-- $(uservarlist) / $(globalvarlist) bu sırayla okuyor.
CREATE INDEX IF NOT EXISTS idx_bot_variables_liste
  ON bot_variables(channel_id, scope, owner, key);
