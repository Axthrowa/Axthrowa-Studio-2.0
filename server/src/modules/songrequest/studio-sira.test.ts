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

vi.mock('../economy/economy.js', () => ({ economy: { getUser: () => ({ points: 50 }) } }));

import { db } from '../../db/index.js';
import { settingsCache } from '../../core/settings-cache.js';
import { muzikHost } from '../muzik/index.js';
import { songRequest, sirasiGeldi } from './songrequest.js';

// Sahte AxthrowA Studio: Spotify orada bağlı, "şu an çalan" testten ayarlanır
const calan = { title: 'Şarkı A', artist: 'X', isPlaying: true, progress: 10_000, duration: 200_000, source: 'spotify', updatedAt: Date.now() };
const istekler: any[] = [];
const durum = { hata: '', ytmd: false };
let sunucu: http.Server;
beforeAll(async () => {
  sunucu = http.createServer((req, res) => {
    let g = '';
    req.on('data', (c) => (g += c));
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/api/player/status') return res.end(JSON.stringify({ spotify: { connected: !durum.ytmd }, ytmd: { connected: durum.ytmd }, nowPlaying: calan }));
      if (req.url === '/api/player/request') {
        if (durum.hata) {
          res.statusCode = 502;
          return res.end(durum.hata);
        }
        const b = JSON.parse(g);
        istekler.push(b);
        return res.end(JSON.stringify({ ok: true, title: 'Paramparça', artist: 'Teoman', id: 'spotify:track:0123456789abcdefghijkl' }));
      }
      res.statusCode = 404;
      res.end('{}');
    });
  });
  await new Promise<void>((r) => sunucu.listen(0, '127.0.0.1', r));
  process.env.AXBOT_MUZIK_HOST = `http://127.0.0.1:${(sunucu.address() as AddressInfo).port}`;
});
afterAll(() => {
  sunucu.close();
  delete process.env.AXBOT_MUZIK_HOST;
});

const mesaj = { id: 'm', platform: 'kick', channel: 'k', user: { id: 'u', username: 'ali', displayName: 'ali' }, message: '!sr teoman' } as any;

describe('istek güvenlik filtreleri', () => {
  const ayar = (a: Record<string, string>) => Object.entries(a).forEach(([k, v]) => settingsCache.set(k, v));
  const ekle = (id: string, zaman: number, url = 'spotify-istek:x') =>
    db.prepare('INSERT INTO song_queue (id, title, url, duration, requested_by, platform, thumbnail, created_at, is_played) VALUES (?, ?, ?, 180, ?, ?, ?, ?, 0)').run(id, `Şarkı ${id}`, url, 'ali', 'kick', '', zaman);
  const sira = () => (db.prepare('SELECT id FROM song_queue WHERE is_played = 0 ORDER BY created_at ASC').all() as any[]).map((r) => r.id);

  it('engel listesindeki istek reddedilir, kuyruğa girmez', async () => {
    db.exec('DELETE FROM song_queue');
    ayar({ sr_engelli: 'paramparca' });
    expect(await songRequest.handleSongRequest(mesaj, ['Teoman', 'Paramparça'])).toContain('engel listesinde');
    expect(sira()).toEqual([]);
    ayar({ sr_engelli: '' });
  });

  it('puanı yetmeyen izleyici isteyemez, mod muaf', async () => {
    db.exec('DELETE FROM song_queue');
    ayar({ sr_min_puan: '100' });
    expect(await songRequest.handleSongRequest(mesaj, ['a'])).toContain('en az 100 puan');
    const mod = { ...mesaj, user: { ...mesaj.user, isMod: true } };
    await (muzikHost as any).hariciYokla();
    expect(await songRequest.handleSongRequest(mod, ['a'])).not.toContain('puan');
    ayar({ sr_min_puan: '0' });
  });

  it('süre sınırını aşan istek reddedilir, süre bilinmiyorsa geçer', () => {
    ayar({ sr_max_dk: '5' });
    expect((songRequest as any).sureEngeli(mesaj, 301)).toContain('en fazla 5 dk');
    expect((songRequest as any).sureEngeli(mesaj, 300)).toBeNull();
    expect((songRequest as any).sureEngeli(mesaj, 0)).toBeNull();
    ayar({ sr_max_dk: '0' });
  });

  it('sıra değişir, çalan şarkı yerinde kalır', () => {
    db.exec('DELETE FROM song_queue');
    (songRequest as any).currentSong = null;
    ekle('calan', 1, 'https://www.youtube.com/watch?v=aaaaaaaaaaa');
    ekle('b', 2);
    ekle('c', 3);
    expect(songRequest.siraDegistir(['c', 'b', 'calan'])).toBe(true);
    expect(sira()).toEqual(['calan', 'c', 'b']);
  });

  it('engellenen istek kuyruktan çıkar, adı listeye eklenir', async () => {
    expect(songRequest.engelle('c')).toBe(true);
    expect(sira()).toEqual(['calan', 'b']);
    expect(settingsCache.get('sr_engelli')).toBe('Şarkı c');
    expect(songRequest.engelle('yok')).toBe(false);
    ayar({ sr_engelli: '' });
  });

  it('çalan şarkı silinince eski bilgi kalmaz', () => {
    expect(songRequest.getCurrentSong()?.id).toBe('calan');
    songRequest.kaldir('calan');
    expect(songRequest.getCurrentSong()?.id).not.toBe('calan');
    db.exec('DELETE FROM song_queue');
    (songRequest as any).hariciSiraBekle = 0;
    istekler.length = 0;
  });
});

describe('Studio Spotify sırası (bot tarafında)', () => {
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
    expect(istekler).toEqual([{ query: 'teoman', queue: false, spotify_ac: false }]);
    const satir = db.prepare('SELECT title, url FROM song_queue').get() as any;
    expect(satir).toEqual({ title: 'Paramparça — Teoman', url: 'https://open.spotify.com/track/0123456789abcdefghijkl' });
  });

  it('başlatılan istek çalan bilgisine yansımadan sıradaki başlamaz; !sarki gerçek çalanı yazar', async () => {
    db.exec('DELETE FROM song_queue');
    istekler.length = 0;
    const mod = { ...mesaj, user: { ...mesaj.user, isMod: true } };
    (songRequest as any).hariciSiraBekle = 0;
    calan.title = 'Eski';
    calan.progress = 10_000;
    calan.updatedAt = Date.now();
    await (muzikHost as any).hariciYokla();
    await songRequest.handleSongRequest(mod, ['birinci']);
    await songRequest.handleSongRequest(mod, ['ikinci']);
    await new Promise((r) => setTimeout(r, 20));
    // Eski parça bitiyor: birinci başlar; yoklama gecikse de ikinci onu kesmez
    calan.progress = 199_000;
    calan.updatedAt = Date.now();
    await (muzikHost as any).hariciYokla();
    await songRequest.hariciSiraDenetle(Date.now(), false);
    expect(istekler.map((i) => i.query)).toEqual(['birinci']);
    await songRequest.hariciSiraDenetle(Date.now() + 9000, false);
    expect(istekler.map((i) => i.query)).toEqual(['birinci']);
    expect(songRequest.calanYaniti()).toContain('Eski');
    expect(songRequest.calanYaniti()).not.toContain('İsteyen');
    // Oynatıcı isteğe geçti: istekte yazar, isteyen de görünür
    calan.title = 'Paramparça';
    calan.artist = 'Teoman';
    calan.progress = 1000;
    calan.updatedAt = Date.now();
    await (muzikHost as any).hariciYokla();
    expect(songRequest.calanYaniti()).toBe('🎶 Şu anda çalan: "Paramparça — Teoman" (İsteyen: ali)');
    db.exec('DELETE FROM song_queue');
    calan.title = 'Şarkı A';
    calan.artist = 'X';
  });

  it('oynatıcı tepki vermezse sıra 45 sn sonra ilerler', async () => {
    (songRequest as any).baslatmaOncesi = { anahtar: (songRequest as any).calanAnahtari(), zaman: Date.now() - 46_000 };
    expect((songRequest as any).baslatmaBekleniyor(Date.now())).toBe(false);
    (songRequest as any).baslatmaOncesi = { anahtar: (songRequest as any).calanAnahtari(), zaman: Date.now() };
    expect((songRequest as any).baslatmaBekleniyor(Date.now())).toBe(true);
    (songRequest as any).baslatmaOncesi = null;
    (songRequest as any).hariciSiraBekle = 0;
  });

  it('bekleyen istek, çalan istek eşlense de "çalındı" sayılmaz', async () => {
    db.exec('DELETE FROM song_queue');
    const ekle = (id: string, zaman: number, url: string, baslik: string) =>
      db.prepare('INSERT INTO song_queue (id, title, url, duration, requested_by, platform, thumbnail, created_at, is_played) VALUES (?, ?, ?, 0, ?, ?, ?, ?, 0)').run(id, baslik, url, 'ali', 'kick', '', zaman);
    ekle('bekleyen', 1, 'spotify-istek:x', 'x');
    ekle('calan', 2, 'https://open.spotify.com/track/0123456789abcdefghijkl', 'Yeni Şarkı — Y');
    calan.title = 'Yeni Şarkı';
    calan.artist = 'Y';
    calan.progress = 10_000;
    calan.updatedAt = Date.now();
    await (muzikHost as any).hariciYokla();
    expect((db.prepare("SELECT is_played p FROM song_queue WHERE id = 'bekleyen'").get() as any).p).toBe(0);
    calan.title = 'Şarkı A';
    calan.artist = 'X';
    await (muzikHost as any).hariciYokla();
  });

  it('tek bozuk istek üç denemeden sonra sırayı tıkamaz', async () => {
    db.exec('DELETE FROM song_queue');
    const mod = { ...mesaj, user: { ...mesaj.user, isMod: true } };
    durum.hata = 'Spotify 500';
    await songRequest.handleSongRequest(mod, ['bozuk']);
    await new Promise((r) => setTimeout(r, 30));
    for (let i = 0; i < 3; i++) await songRequest.hariciSiraDenetle(Date.now(), true);
    expect((db.prepare('SELECT COUNT(*) n FROM song_queue WHERE is_played = 0').get() as any).n).toBe(0);
    durum.hata = '';
  });

  it('Spotify kapalıyken istek kaybolmaz, sınır aşılınca yeni istek reddedilir', async () => {
    db.exec('DELETE FROM song_queue');
    durum.hata = 'Aktif Spotify cihazı yok — Spotify\'da bir şey çalmaya başlatın';
    await songRequest.handleSongRequest(mesaj, ['birinci']);
    await songRequest.hariciSiraDenetle(Date.now() + 60_000, true);
    expect((db.prepare("SELECT COUNT(*) n FROM song_queue WHERE is_played = 0").get() as any).n).toBe(1);
    await songRequest.handleSongRequest(mesaj, ['ikinci']);
    expect(await songRequest.handleSongRequest(mesaj, ['ucuncu'])).toContain('en fazla 2');
    durum.hata = '';
  });

  it('YouTube Music açıksa istek oraya, video kimliğiyle sırayla gider', async () => {
    db.exec('DELETE FROM song_queue');
    istekler.length = 0;
    durum.ytmd = true;
    calan.source = 'youtube-music';
    calan.progress = 10_000;
    calan.updatedAt = Date.now();
    await (muzikHost as any).hariciYokla();
    expect(muzikHost.hariciHedef()).toBe('ytmd');
    const mod = { ...mesaj, user: { ...mesaj.user, isMod: true } };
    expect(await songRequest.handleSongRequest(mod, ['https://youtu.be/abcdefghijk'])).toContain('sıraya alındı');
    expect(istekler).toEqual([]);
    calan.progress = 199_000;
    calan.updatedAt = Date.now();
    await (muzikHost as any).hariciYokla();
    await songRequest.hariciSiraDenetle(Date.now() + 60_000, false);
    expect(istekler[0]).toMatchObject({ video_id: 'abcdefghijk', queue: false });
    expect((db.prepare('SELECT url FROM song_queue').get() as any).url).toBe('https://music.youtube.com/watch?v=abcdefghijk');
    durum.ytmd = false;
    calan.source = 'spotify';
  });

  it('sirasiGeldi: duraklatılmış çalarda istek hemen çalar, çalarken şarkı sonu beklenir', () => {
    expect(sirasiGeldi(null, 0)).toBe(true);
    expect(sirasiGeldi({ isPlaying: false, progress: 50_000, duration: 200_000, updatedAt: 0 } as any, 0)).toBe(true);
    expect(sirasiGeldi({ isPlaying: false, progress: 199_000, duration: 200_000, updatedAt: 0 } as any, 0)).toBe(true);
    expect(sirasiGeldi({ isPlaying: true, progress: 190_000, duration: 200_000, updatedAt: 1 } as any, 8_001)).toBe(true);
    expect(sirasiGeldi({ isPlaying: true, progress: 50_000, duration: 200_000, updatedAt: 1 } as any, 8_001)).toBe(false);
  });
});

import { calarKapali, spotifyHataYaniti } from './songrequest.js';

describe('!sr çalar kapalıyken', () => {
  it('çalar bağlı değilse istek alınmaz, video kipinde alınır; Spotify cihaz hatası izleyiciye anlaşılır', () => {
    expect(calarKapali({ videoKipi: false, otomatik: false })).toBe(true);
    expect(calarKapali({ videoKipi: true, otomatik: false })).toBe(false);
    expect(calarKapali({ videoKipi: false, otomatik: true })).toBe(false);
    expect(calarKapali({ videoKipi: false, otomatik: false, spotifyApiKapali: true })).toBe(false);
    expect(spotifyHataYaniti('Ali', new Error('Açık Spotify cihazı yok — Spotify uygulamasında bir şey çalmaya başlat.'))).toContain('Spotify şu an açık değil');
  });
});
