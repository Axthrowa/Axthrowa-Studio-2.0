import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

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
import { songRequest, sirasiGeldi } from './songrequest.js';

// Sahte Yayın Yönetim Aracı: Spotify orada bağlı, "şu an çalan" testten ayarlanır
const calan = { title: 'Şarkı A', artist: 'X', isPlaying: true, progress: 10_000, duration: 200_000, source: 'spotify', updatedAt: Date.now() };
const istekler: any[] = [];
let sunucu: http.Server;
beforeAll(async () => {
  sunucu = http.createServer((req, res) => {
    let g = '';
    req.on('data', (c) => (g += c));
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/api/player/status') return res.end(JSON.stringify({ spotify: { connected: true }, nowPlaying: calan }));
      if (req.url === '/api/player/request') {
        const b = JSON.parse(g);
        istekler.push(b);
        return res.end(JSON.stringify({ ok: true, title: 'Paramparça', artist: 'Teoman', id: 'spotify:track:0123456789abcdefghijkl' }));
      }
      res.statusCode = 404;
      res.end('{}');
    });
  });
  await new Promise<void>((r) => sunucu.listen(0, '127.0.0.1', r));
  process.env.STREAMAXT_MUZIK_HOST = `http://127.0.0.1:${(sunucu.address() as AddressInfo).port}`;
});
afterAll(() => {
  sunucu.close();
  delete process.env.STREAMAXT_MUZIK_HOST;
});

const mesaj = { id: 'm', platform: 'kick', channel: 'k', user: { id: 'u', username: 'ali', displayName: 'ali' }, message: '!sr teoman' } as any;

describe('YYA Spotify sırası (bot tarafında)', () => {
  it('çalan şarkı kesilmez; bitmek üzereyken sıradaki istek başlar', async () => {
    await (muzikHost as any).hariciYokla();
    const yanit = await songRequest.handleSongRequest(mesaj, ['teoman']);
    expect(yanit).toContain('sıraya alındı');
    await new Promise((r) => setTimeout(r, 50));
    expect(istekler).toEqual([]); // çalan şarkı kesilmedi

    calan.progress = 198_500;
    calan.updatedAt = Date.now();
    await (muzikHost as any).hariciYokla();
    await songRequest.hariciSiraDenetle(Date.now(), false);
    expect(istekler).toEqual([{ query: 'teoman', queue: false }]);
    const satir = db.prepare('SELECT title, url FROM song_queue').get() as any;
    expect(satir).toEqual({ title: 'Paramparça — Teoman', url: 'https://open.spotify.com/track/0123456789abcdefghijkl' });
  });

  it('sirasiGeldi: duraklatılmış şarkının ortasında beklenir', () => {
    expect(sirasiGeldi(null, 0)).toBe(true);
    expect(sirasiGeldi({ isPlaying: false, progress: 50_000, duration: 200_000, updatedAt: 0 } as any, 0)).toBe(false);
    expect(sirasiGeldi({ isPlaying: false, progress: 199_000, duration: 200_000, updatedAt: 0 } as any, 0)).toBe(true);
    expect(sirasiGeldi({ isPlaying: true, progress: 190_000, duration: 200_000, updatedAt: 1 } as any, 8_001)).toBe(true);
    expect(sirasiGeldi({ isPlaying: true, progress: 50_000, duration: 200_000, updatedAt: 1 } as any, 8_001)).toBe(false);
  });
});
