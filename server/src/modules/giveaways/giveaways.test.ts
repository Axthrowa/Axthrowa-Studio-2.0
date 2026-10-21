/**
 * Çekiliş: kazanan sayısı, katılım süresi, abone bileti alt sınırı. Bellek içi SQLite.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../db/index.js', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE giveaways (id TEXT PRIMARY KEY, title TEXT NOT NULL, keyword TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1,
      sub_bonus_multiplier REAL NOT NULL DEFAULT 2.0, cost_points INTEGER NOT NULL DEFAULT 0, winner TEXT, winner_platform TEXT,
      created_at INTEGER NOT NULL, closed_at INTEGER, duration_minutes INTEGER DEFAULT 10, winner_count INTEGER DEFAULT 1,
      max_entries INTEGER DEFAULT 0, follower_only INTEGER DEFAULT 0, sub_only INTEGER DEFAULT 0, min_watch_minutes INTEGER DEFAULT 0);
    CREATE TABLE giveaway_entries (id TEXT PRIMARY KEY, giveaway_id TEXT NOT NULL, username TEXT NOT NULL, platform TEXT NOT NULL,
      tickets INTEGER NOT NULL DEFAULT 1, entered_at INTEGER NOT NULL);
  `);
  return { db };
});
vi.mock('../economy/economy.js', () => ({ economy: { getUser: () => ({ points: 0, watch_time_minutes: 0 }), removePoints: () => 0 } }));

import { db } from '../../db/index.js';
import { giveaway, kazananlariSec } from './giveaways.js';

const mesaj = (ad: string, isSub = false) =>
  ({ platform: 'kick', channel: 'k', user: { username: ad, displayName: ad, isSub, isMod: false, isVip: false, isBroadcaster: false } }) as any;
const ayarla = (alanlar: string) => db.exec(`UPDATE giveaways SET ${alanlar} WHERE is_active = 1`);

beforeEach(() => {
  db.exec('DELETE FROM giveaways; DELETE FROM giveaway_entries;');
  giveaway.createGiveaway('Hediye', '!katil', 2, 0);
  ayarla('duration_minutes = 0');
});

describe('çekiliş', () => {
  it('"kazanan sayısı" kadar farklı kişi çekilir', () => {
    ayarla('winner_count = 3');
    for (const ad of ['a', 'b', 'c', 'd', 'e']) giveaway.handleJoin(mesaj(ad));
    const w = giveaway.pickWinner()!;
    expect(w.winners).toHaveLength(3);
    expect(new Set(w.winners).size).toBe(3);
    expect(w.winner).toBe(w.winners.join(', '));
  });

  it('düşük abone çarpanında abone yine bilet alır; yalnız abone çekilişi çökmez', () => {
    ayarla('sub_only = 1, sub_bonus_multiplier = 0.3');
    expect(giveaway.handleJoin(mesaj('abone', true))).toContain('1 bilet');
    expect(giveaway.pickWinner()?.winners).toEqual(['abone']);
  });

  it('katılım süresi dolunca yeni katılım alınmaz, çekiliş yine çekilebilir', () => {
    giveaway.handleJoin(mesaj('erken'));
    ayarla(`duration_minutes = 5, created_at = ${Date.now() - 6 * 60_000}`);
    expect(giveaway.handleJoin(mesaj('gec'))).toContain('süresi doldu');
    expect(giveaway.pickWinner()?.winners).toEqual(['erken']);
  });
});

describe('kazananlariSec', () => {
  it('bilet ağırlığına uyar ve katılımcıdan fazla kazanan istenirse hepsini verir', () => {
    const k = [{ ad: 'az', tickets: 1 }, { ad: 'cok', tickets: 3 }];
    expect(kazananlariSec(k, 1, () => 0.5)[0].ad).toBe('cok'); // 0.5×4=2 → 2. kişinin aralığı
    expect(kazananlariSec(k, 1, () => 0.1)[0].ad).toBe('az');
    expect(kazananlariSec(k, 5).map((x) => x.ad).sort()).toEqual(['az', 'cok']);
  });
});
