/**
 * StreamAxT — sürümlü veritabanı göçleri
 * Developed by AxthrowA
 *
 * Şema şimdiye kadar `CREATE TABLE IF NOT EXISTS` + dağınık
 * `try { ALTER TABLE ... } catch {}` satırlarıyla kuruluyordu. Bu yöntem
 * çalışıyor ama hangi göçün uygulandığı bilinmiyor, sıra garanti edilmiyor
 * ve hata sessizce yutuluyordu.
 *
 * Kurallar:
 *   - YIKICI GÖÇ YOK. Sütun/tablo silinmez, tip değiştirilmez.
 *   - Yalnız `CREATE TABLE IF NOT EXISTS` ve varsayılan değerli
 *     `ALTER TABLE ... ADD COLUMN`.
 *   - Her göç bir kez çalışır, sürümü kaydedilir.
 *   - Bir göç patlarsa sonraki göçler çalışmaz ve hata GÖRÜNÜR olur.
 */
import type { DatabaseSync } from 'node:sqlite';

export interface Gocler {
  version: number;
  name: string;
  up: (db: DatabaseSync) => void;
}

/** Sütun zaten varsa sessizce geç — `ADD COLUMN` idempotent değildir. */
function sutunEkle(db: DatabaseSync, tablo: string, sutun: string, tanim: string): void {
  const mevcut = db.prepare(`PRAGMA table_info("${tablo}")`).all() as Array<{ name: string }>;
  if (mevcut.some((c) => c.name === sutun)) return;
  db.exec(`ALTER TABLE "${tablo}" ADD COLUMN ${sutun} ${tanim};`);
}

export const GOCLER: Gocler[] = [
  {
    version: 1,
    name: 'kv_store — uservar / globalvar kalıcı değişken deposu',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS kv_store (
          scope      TEXT NOT NULL,
          owner      TEXT NOT NULL DEFAULT '',
          key        TEXT NOT NULL,
          value      TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (scope, owner, key)
        );
        CREATE INDEX IF NOT EXISTS idx_kv_scope_owner ON kv_store(scope, owner);
      `);
    }
  },
  {
    version: 2,
    name: 'commands — fiyat, kullanıcı başına bekleme, platform, tetikleyici',
    up(db) {
      // BotRix komut formunda gözlemlenen alanlar (BOTRIX_UI_INVENTORY §6.2)
      sutunEkle(db, 'commands', 'cooldown_mode', "TEXT NOT NULL DEFAULT 'global'");
      sutunEkle(db, 'commands', 'user_cooldown', 'INTEGER NOT NULL DEFAULT 0');
      sutunEkle(db, 'commands', 'cost_points', 'INTEGER NOT NULL DEFAULT 0');
      sutunEkle(db, 'commands', 'min_level', 'INTEGER NOT NULL DEFAULT 0');
      sutunEkle(db, 'commands', 'platforms', "TEXT NOT NULL DEFAULT ''");
      sutunEkle(db, 'commands', 'trigger_type', "TEXT NOT NULL DEFAULT 'command'");
      sutunEkle(db, 'commands', 'access_mode', "TEXT NOT NULL DEFAULT 'always'");
    }
  },
  {
    version: 3,
    name: 'counters — $(count) ve !editcounter için sağlamlaştırma',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS counters (
          name       TEXT PRIMARY KEY,
          count      REAL NOT NULL DEFAULT 0,
          updated_at INTEGER NOT NULL
        );
      `);
      sutunEkle(db, 'counters', 'updated_at', 'INTEGER NOT NULL DEFAULT 0');
    }
  },
  {
    version: 4,
    name: 'economy — XP ve seviye',
    up(db) {
      sutunEkle(db, 'economy', 'xp', 'INTEGER NOT NULL DEFAULT 0');
      sutunEkle(db, 'economy', 'level', 'INTEGER NOT NULL DEFAULT 0');
      sutunEkle(db, 'economy', 'first_seen', 'INTEGER NOT NULL DEFAULT 0');
    }
  },
  {
    version: 5,
    name: 'automod — kural başına ihlal eylemi ve bypass rolleri',
    up(db) {
      // BotRix moderasyon modalında gözlemlenen derinlik
      // (BOTRIX_UI_INVENTORY §6.1): eylem + timeout süresi + özel mesaj +
      // bypass rolleri, her kural için ayrı.
      for (const kural of ['caps', 'emotes', 'links', 'symbols', 'blacklist']) {
        sutunEkle(db, 'automod_settings', `${kural}_action`, "TEXT NOT NULL DEFAULT 'warn'");
        sutunEkle(db, 'automod_settings', `${kural}_timeout`, 'INTEGER NOT NULL DEFAULT 60');
        sutunEkle(db, 'automod_settings', `${kural}_message`, "TEXT NOT NULL DEFAULT ''");
        sutunEkle(db, 'automod_settings', `${kural}_bypass`, "TEXT NOT NULL DEFAULT '[\"mod\",\"broadcaster\"]'");
      }
    }
  }
];

/**
 * Bekleyen göçleri sırayla uygular. Uygulanan sürümler `schema_migrations`
 * tablosuna yazılır; ikinci çalıştırmada hiçbir şey yapılmaz.
 */
export function gocleriUygula(db: DatabaseSync, gocler: Gocler[] = GOCLER): number {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);

  const uygulanan = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as Array<{ version: number }>).map(
      (r) => r.version
    )
  );

  const kaydet = db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)');
  let sayi = 0;

  for (const g of [...gocler].sort((a, b) => a.version - b.version)) {
    if (uygulanan.has(g.version)) continue;
    try {
      g.up(db);
      kaydet.run(g.version, g.name, Date.now());
      sayi++;
      console.log(`[Göç] #${g.version} uygulandı: ${g.name}`);
    } catch (e: any) {
      // Sessizce yutma: göç patlarsa sonraki göçler tutarsız şema üstünde
      // çalışır. Hatayı görünür kıl ve dur.
      console.error(`[Göç] #${g.version} BAŞARISIZ (${g.name}):`, e?.message || e);
      throw e;
    }
  }

  return sayi;
}
