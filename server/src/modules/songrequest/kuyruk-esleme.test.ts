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

import axios from 'axios';
import { db } from '../../db/index.js';
import { settingsCache } from '../../core/settings-cache.js';
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

  it('kuyruk boşken Otomatik DJ önceki kliplerden çalar, yeni istek gelince ona geçer', () => {
    settingsCache.set('sr_hedef', 'video');
    ekle('g1', 'Eski 1', 'https://www.youtube.com/watch?v=aaaaaaaaaaa', 1);
    ekle('g2', 'Eski 2', 'https://www.youtube.com/watch?v=bbbbbbbbbbb', 2);
    db.exec('UPDATE song_queue SET is_played = 1');
    const dj = songRequest.klipSirasi()!;
    expect(dj.requestedBy).toBe('Otomatik DJ');
    expect(songRequest.klipSirasi()!.id).toBe(dj.id); // biri bitene kadar aynı parça
    expect(songRequest.klipBitti(dj.id)).toBe(true);
    expect(songRequest.klipSirasi()!.url).not.toBe(dj.url); // art arda aynısı gelmez
    ekle('yeni', 'İstek', 'https://www.youtube.com/watch?v=ccccccccccc', 3);
    expect(songRequest.klipSirasi()!.id).toBe('yeni');
    settingsCache.set('sr_hedef', 'spotify');
  });

  it('Spotify kipinde DJ eski klip çalmaz; !klip istek kipten bağımsız klip sırasına girer', async () => {
    settingsCache.set('sr_hedef', 'spotify');
    ekle('g1', 'Eski', 'https://www.youtube.com/watch?v=aaaaaaaaaaa', 1);
    db.exec('UPDATE song_queue SET is_played = 1');
    expect(songRequest.klipSirasi()).toBeNull();
    vi.spyOn(axios, 'get').mockRejectedValue(new Error('ağ yok'));
    const mesaj = { platform: 'kick', channel: 'k', user: { username: 'a', displayName: 'A' } } as any;
    expect(await songRequest.handleSongRequest(mesaj, [], { klip: true })).toContain('!klip');
    expect(await songRequest.handleSongRequest(mesaj, ['https://youtu.be/ccccccccccc'], { klip: true })).toContain('🎬');
    expect(songRequest.klipSirasi()?.url).toContain('ccccccccccc');
  });

  it("AxthrowA Studio'dan gelen çalan şarkı (kimliksiz) başlıkla eşlenir", () => {
    ekle('a', 'Birinci — X', 'https://open.spotify.com/track/aaaaaaaaaaaaaaaaaaaaaa', 1);
    ekle('b', 'Paramparça — Teoman', 'https://open.spotify.com/track/bbbbbbbbbbbbbbbbbbbbbb', 2);
    (muzikHost as any).calaniGuncelle(
      { title: 'Paramparça', artist: 'Teoman', album: '', albumArt: '', isPlaying: true, progress: 0, duration: 1, source: 'spotify', updatedAt: 1 },
      'spotify'
    );
    expect(acik()).toEqual(['b']);
  });

  it('kısa başlık, onunla başlayan isteği "çalıyor" saymaz; bekleyen istek açık kalır', () => {
    // YYA kipinde istek ancak çalmaya başlayınca çözülür: çalanla eşleşmeyen çözülmüş istek bitmiştir
    ekle('a', 'Birinci — X', 'https://open.spotify.com/track/aaaaaaaaaaaaaaaaaaaaaa', 1);
    ekle('b', 'Hey Jude — Beatles', 'https://open.spotify.com/track/bbbbbbbbbbbbbbbbbbbbbb', 2);
    ekle('c', 'teoman', 'spotify-istek:teoman', 3);
    (muzikHost as any).calaniGuncelle(
      { title: 'Hey', artist: 'Y', album: '', albumArt: '', isPlaying: true, progress: 0, duration: 1, source: 'spotify', updatedAt: 2 },
      'spotify'
    );
    expect(acik()).toEqual(['c']);
  });
});
