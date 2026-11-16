/**
 * İstatistik silme: yalnız seçilen grup silinir, puan ve komutlar korunur, önbellek eski değeri geri yazmaz.
 * Gerçek veritabanı yerine bellek içi SQLite.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../db/index.js', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE economy (id TEXT PRIMARY KEY, platform TEXT NOT NULL, username TEXT NOT NULL, display_name TEXT,
      points INTEGER NOT NULL DEFAULT 100, watch_time_minutes INTEGER NOT NULL DEFAULT 0, messages_count INTEGER NOT NULL DEFAULT 0,
      subs_count INTEGER NOT NULL DEFAULT 0, gifted_subs_count INTEGER NOT NULL DEFAULT 0, tips_amount REAL NOT NULL DEFAULT 0,
      loyalty_tier TEXT NOT NULL DEFAULT 'Çaylak', last_active INTEGER NOT NULL);
    CREATE TABLE bot_settings (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE trivia_scores (username TEXT PRIMARY KEY, total_score INTEGER);
    CREATE TABLE commands (name TEXT PRIMARY KEY, use_count INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE counters (name TEXT PRIMARY KEY, count INTEGER NOT NULL);
    CREATE TABLE stream_events (id TEXT PRIMARY KEY);
  `);
  return { db };
});
vi.mock('../tts/tts.js', () => ({ ttsEngine: { enqueue: () => {} } }));

import { db } from '../../db/index.js';
import { economy } from '../economy/economy.js';
import { istatistikler, istatistikSil } from './istatistik-sil.js';
import { sohbetIstatistik } from './sohbet-istatistik.js';

const mesaj = {
  id: 'm', platform: 'kick', channel: 'k', message: '', timestamp: 0,
  user: { id: 'ali', username: 'ali', displayName: 'ali', badges: [], isMod: false, isSub: false, isVip: false, isBroadcaster: false }
} as any;
const kayit = (id: string) => istatistikler().find((g) => g.id === id)!.kayit;
const satir = () => db.prepare('SELECT points, messages_count m, watch_time_minutes w FROM economy WHERE username = ?').get('ali') as any;

beforeEach(() => {
  economy.tabloyuDegistir(() =>
    db.exec(`DELETE FROM economy; DELETE FROM trivia_scores; DELETE FROM commands; DELETE FROM counters; DELETE FROM stream_events;
      INSERT INTO trivia_scores VALUES ('ali', 50);
      INSERT INTO commands VALUES ('selam', 7);
      INSERT INTO counters VALUES ('olum', 3);
      INSERT INTO stream_events VALUES ('e1');`)
  );
  economy.recordMessage(mesaj);
  sohbetIstatistik.sifirla();
  sohbetIstatistik.ekle('ali', 'ali', 'merhaba');
});

describe('istatistikSil', () => {
  it('kayıt sayılarını verir', () => {
    expect(kayit('trivia')).toBe(1);
    expect(kayit('mesaj')).toBe(1);
    expect(kayit('sohbet')).toBe(1);
    expect(kayit('komut')).toBe(1);
  });

  it('Bil Bakalım skorlarını siler, başka gruba dokunmaz', () => {
    expect(istatistikSil('trivia')).toBe(true);
    expect(kayit('trivia')).toBe(0);
    expect(kayit('komut')).toBe(1);
    expect(kayit('mesaj')).toBe(1);
  });

  it('mesaj sayısı silinince puan kalır, önbellek eski sayıyı geri yazmaz', () => {
    const puan = economy.getUserPoints('ali');
    istatistikSil('mesaj');
    economy.flushAll();
    expect(satir().m).toBe(0);
    expect(satir().points).toBe(puan);
    economy.recordMessage(mesaj);
    economy.flushAll();
    expect(satir().m).toBe(1);
  });

  it('komut sayısı sıfırlanır, komut kalır', () => {
    istatistikSil('komut');
    expect(db.prepare('SELECT use_count c FROM commands').all()).toEqual([expect.objectContaining({ c: 0 })]);
  });

  it('sohbet, sayaç ve olay geçmişi silinir', () => {
    for (const g of ['sohbet', 'sayac', 'olaylar']) {
      istatistikSil(g);
      expect(kayit(g)).toBe(0);
    }
  });

  it('bilinmeyen grup hiçbir şey silmez', () => {
    expect(istatistikSil('economy')).toBe(false);
    expect(kayit('trivia')).toBe(1);
  });
});
