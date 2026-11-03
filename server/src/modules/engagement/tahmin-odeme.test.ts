/**
 * Tahmin ödemesi: ödeme ile kapanış kaydı birlikte yazılır, yarıda kalırsa tekrar denemede
 * kimseye iki kez ödenmez. Gerçek veritabanı yerine bellek içi SQLite.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../db/index.js', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE economy (id TEXT PRIMARY KEY, platform TEXT NOT NULL, username TEXT NOT NULL, display_name TEXT,
      points INTEGER NOT NULL DEFAULT 100, watch_time_minutes INTEGER NOT NULL DEFAULT 0, messages_count INTEGER NOT NULL DEFAULT 0,
      subs_count INTEGER NOT NULL DEFAULT 0, gifted_subs_count INTEGER NOT NULL DEFAULT 0, tips_amount REAL NOT NULL DEFAULT 0,
      loyalty_tier TEXT NOT NULL DEFAULT 'Çaylak', last_active INTEGER NOT NULL);
    CREATE TABLE bot_settings (key TEXT PRIMARY KEY, value TEXT);
  `);
  return { db };
});
vi.mock('../tts/tts.js', () => ({ ttsEngine: { enqueue: () => {} } }));

import { db } from '../../db/index.js';
import { economy } from '../economy/economy.js';
import { tahminler } from './predictions.js';

const diskteki = (ad: string) =>
  (db.prepare('SELECT points FROM economy WHERE username = ?').get(ad) as { points: number }).points;
const kaydiBozTetigi = () =>
  db.exec("CREATE TRIGGER boz BEFORE UPDATE ON predictions BEGIN SELECT RAISE(ABORT, 'disk hatası'); END");

beforeEach(() => {
  economy.tabloyuDegistir(() => db.exec('DELETE FROM economy; DELETE FROM predictions; DELETE FROM prediction_bets'));
  for (const ad of ['ali', 'veli']) {
    economy.getUser('kick', ad, ad);
    economy.addPoints(ad, 900);
  }
  tahminler.olustur('Kim kazanır?', ['A', 'B']);
  tahminler.bahisKoy('ali', 'ali', 'A', 100);
  tahminler.bahisKoy('veli', 'veli', 'B', 100);
});
afterEach(() => {
  db.exec('DROP TRIGGER IF EXISTS boz');
});

describe('sonuçlandırma', () => {
  it('kayıt yazılamazsa ödeme geri alınır, tekrar denemede tek kez ödenir', () => {
    kaydiBozTetigi();
    expect(tahminler.sonuclandir('A').ok).toBe(false);
    expect(economy.getUserPoints('ali')).toBe(900);
    expect(diskteki('ali')).toBe(900);
    expect(tahminler.aktif()).not.toBeNull();

    db.exec('DROP TRIGGER boz');
    expect(tahminler.sonuclandir('A').ok).toBe(true);
    expect(economy.getUserPoints('ali')).toBe(1100);
    expect(diskteki('ali')).toBe(1100);
    expect(economy.getUserPoints('veli')).toBe(900);
    expect(tahminler.aktif()).toBeNull();
  });
});

describe('iptal', () => {
  it('kayıt yazılamazsa iade geri alınır, tekrar denemede tek kez iade edilir', () => {
    kaydiBozTetigi();
    expect(tahminler.iptal().ok).toBe(false);
    expect(economy.getUserPoints('ali')).toBe(900);

    db.exec('DROP TRIGGER boz');
    expect(tahminler.iptal()).toEqual({ ok: true, iade: 200 });
    expect(economy.getUserPoints('ali')).toBe(1000);
    expect(diskteki('veli')).toBe(1000);
  });
});
