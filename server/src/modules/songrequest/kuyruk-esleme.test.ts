import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../db/index.js', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE song_queue (id TEXT PRIMARY KEY, title TEXT, url TEXT, duration INTEGER, requested_by TEXT, platform TEXT,
      thumbnail TEXT, created_at INTEGER, is_played INTEGER DEFAULT 0);
    CREATE TABLE bot_settings (key TEXT PRIMARY KEY, value TEXT);
  `);
  return { db };
});

import { db } from '../../db/index.js';
import { muzikHost } from '../muzik/index.js';
import { songRequest } from './songrequest.js';

const ekle = (id: string, title: string, url: string, t: number) =>
  db.prepare('INSERT INTO song_queue (id, title, url, duration, requested_by, platform, created_at) VALUES (?, ?, ?, 180, ?, ?, ?)').run(id, title, url, 'ali', 'kick', t);
const acik = () => (db.prepare('SELECT id FROM song_queue WHERE is_played = 0 ORDER BY created_at').all() as Array<{ id: string }>).map((r) => r.id);

beforeEach(() => db.exec('DELETE FROM song_queue'));

describe('şarkı kuyruğu eşleme', () => {
  it('klip widget kuyruğun başındaki Spotify isteğine takılmaz', () => {
    ekle('s1', 'Eski — Sanatçı', 'https://open.spotify.com/track/0123456789abcdefghijkl', 1);
    ekle('y1', 'Klip', 'https://www.youtube.com/watch?v=abcdefghijk', 2);
    expect(songRequest.ilkKlip()?.id).toBe('y1');
    expect(songRequest.klipBitti('s1')).toBe(false);
    expect(songRequest.klipBitti('y1')).toBe(true);
    expect(acik()).toEqual(['s1']);
  });

  it("Yayın Yönetim Aracı'ndan gelen çalan şarkı (kimliksiz) başlıkla eşlenir", () => {
    ekle('a', 'Birinci — X', 'https://open.spotify.com/track/aaaaaaaaaaaaaaaaaaaaaa', 1);
    ekle('b', 'Paramparça — Teoman', 'https://open.spotify.com/track/bbbbbbbbbbbbbbbbbbbbbb', 2);
    (muzikHost as any).calaniGuncelle(
      { title: 'Paramparça', artist: 'Teoman', album: '', albumArt: '', isPlaying: true, progress: 0, duration: 1, source: 'spotify', updatedAt: 1 },
      'spotify'
    );
    expect(acik()).toEqual(['b']);
  });
});
