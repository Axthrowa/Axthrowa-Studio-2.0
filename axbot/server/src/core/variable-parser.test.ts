/**
 * Eski biçim şablon çözücü: aynı türden birden çok kalıp ve cüzdan adıyla puan okuma.
 * Gerçek veritabanı yerine bellek içi SQLite.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db/index.js', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE economy (id TEXT PRIMARY KEY, platform TEXT NOT NULL, username TEXT NOT NULL, display_name TEXT,
      points INTEGER NOT NULL DEFAULT 100, watch_time_minutes INTEGER NOT NULL DEFAULT 0, messages_count INTEGER NOT NULL DEFAULT 0,
      subs_count INTEGER NOT NULL DEFAULT 0, gifted_subs_count INTEGER NOT NULL DEFAULT 0, tips_amount REAL NOT NULL DEFAULT 0,
      loyalty_tier TEXT NOT NULL DEFAULT 'Çaylak', last_active INTEGER NOT NULL);
    CREATE TABLE bot_settings (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE counters (name TEXT PRIMARY KEY, count INTEGER NOT NULL, updated_at INTEGER);
    CREATE TABLE commands (name TEXT PRIMARY KEY, use_count INTEGER NOT NULL DEFAULT 0);
  `);
  return { db };
});
vi.mock('../modules/tts/tts.js', () => ({ ttsEngine: { enqueue: () => {} } }));

import { db } from '../db/index.js';
import { economy } from '../modules/economy/economy.js';
import { parseVariables } from './variable-parser.js';

const mesaj = (platform: string, ad: string) =>
  ({
    id: 'm', platform, channel: 'kanal', message: '', timestamp: 0,
    user: { id: ad, username: ad, displayName: ad, badges: [], isMod: false, isSub: false, isVip: false, isBroadcaster: false }
  }) as any;
const coz = (sablon: string, m = mesaj('kick', 'ali')) => parseVariables(sablon, { message: m });
const sayac = (ad: string) => (db.prepare('SELECT count FROM counters WHERE name = ?').get(ad) as { count: number }).count;

beforeEach(() => {
  economy.tabloyuDegistir(() => db.exec('DELETE FROM economy; DELETE FROM counters'));
});

describe('aynı türden birden çok kalıp', () => {
  it('iki sayaç da artar', async () => {
    expect(await coz('{count:aa} ve {count:bb}')).toBe('1 ve 1');
    expect(sayac('aa')).toBe(1);
    expect(sayac('bb')).toBe(1);
  });

  it('iki seçim de çözülür', async () => {
    expect(await coz('$(choose a|a) ve $(choose b|b) ve {choose:c}')).toBe('a ve b ve c');
  });

  it('iki koşul ve iki hesap da çözülür', async () => {
    expect(await coz('{if:1>0:e:h} {if:1<0:e:h}')).toBe('e h');
    expect(await coz('{math:1+1} ve {math:2+2}')).toBe('2 ve 4');
  });

  it('$& kalıbı döngüyü sonsuza sokmaz, metin olarak kalır', async () => {
    expect(await coz('{choose:$&} {if:1>0:$&:x}')).toBe('$& $&');
  });
});

describe('{puan}', () => {
  it("YouTube'daki Ali kendi cüzdanını görür, Kick'teki Ali'ninkini değil", async () => {
    economy.getUser('kick', 'ali', 'ali');
    economy.addPoints('ali', 900);
    economy.getUser('youtube', 'ali', 'ali');
    expect(await coz('{puan}', mesaj('kick', 'ali'))).toBe('1000');
    expect(await coz('{puan}', mesaj('youtube', 'ali'))).toBe('100');
  });

  it('henüz diske yazılmamış mesaj puanını da gösterir', async () => {
    economy.recordMessage(mesaj('kick', 'veli'));
    economy.recordMessage(mesaj('kick', 'veli'));
    expect(await coz('$(points)', mesaj('kick', 'veli'))).toBe('104');
  });
});
