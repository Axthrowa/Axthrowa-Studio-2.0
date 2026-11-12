import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MuzikHost } from './muzik.js';

// Sahte AxthrowA Studio host'u: Spotify orada bağlı
let sunucu: http.Server;
let kok = '';
const gelen: any[] = [];

let npKaynak = 'spotify';
let ytmd = false;

beforeAll(async () => {
  sunucu = http.createServer((req, res) => {
    let govde = '';
    req.on('data', (c) => (govde += c));
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/api/player/status') {
        return res.end(JSON.stringify({
          spotify: { connected: !ytmd },
          ytmd: { connected: ytmd },
          nowPlaying: { title: 'Paramparça', artist: 'Teoman', isPlaying: true, progress: 1000, duration: 200000, source: npKaynak, updatedAt: 5 }
        }));
      }
      if (req.url === '/api/player/request') {
        gelen.push(JSON.parse(govde));
        return res.end(JSON.stringify({ ok: true, title: 'Paramparça', artist: 'Teoman', id: 'spotify:track:0123456789abcdefghijkl' }));
      }
      res.statusCode = 404;
      res.end('{}');
    });
  });
  await new Promise<void>((r) => sunucu.listen(0, '127.0.0.1', r));
  kok = `http://127.0.0.1:${(sunucu.address() as AddressInfo).port}`;
});
afterAll(() => sunucu.close());

const depo = { oku: () => '', yaz: () => {} };

describe('harici müzik host (AxthrowA Studio)', () => {
  it('çalan şarkıyı okur ve !sr isteğini sıraya ekletir', async () => {
    const h = new MuzikHost(depo, () => {}, () => kok);
    expect(h.spotifyKullanilabilir()).toBe(false);
    await (h as any).hariciYokla();
    expect(h.spotifyKullanilabilir()).toBe(true);
    expect(h.simdiCalan()?.title).toBe('Paramparça');
    const p = await h.hariciIstek('teoman paramparça', true);
    expect(p.uri).toBe('spotify:track:0123456789abcdefghijkl');
    expect(gelen[0]).toEqual({ query: 'teoman paramparça', queue: true });
  });

  it('yalnız yerel adres kabul edilir', async () => {
    const h = new MuzikHost(depo, () => {}, () => 'http://kotu.example:8843');
    await (h as any).hariciYokla();
    expect(h.spotifyKullanilabilir()).toBe(false);
  });

  it('YouTube Music kaydını Spotify yuvasına yazmaz', async () => {
    npKaynak = 'youtube-music';
    ytmd = true;
    const h = new MuzikHost(depo, () => {}, () => kok);
    await (h as any).hariciYokla();
    expect((h as any).ytmdCalan?.title).toBe('Paramparça');
    expect((h as any).calan).toBeNull();
    npKaynak = 'spotify';
    ytmd = false;
  });
});
