import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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
import { muzikHost } from '../muzik/index.js';
import { songRequest } from './songrequest.js';
import { settingsCache } from '../../core/settings-cache.js';
import { KLIP_EN_COK_BEKLEME_MS, klipKarari, parcaAnahtari, type KlipDurumu } from './klip-kapisi.js';

const calan = (ek: Record<string, unknown> = {}) => ({ title: 'Parça', artist: 'X', album: '', albumArt: '', isPlaying: true, progress: 10_000, duration: 200_000, source: 'spotify', updatedAt: 1000, ...ek });

describe('klipKarari', () => {
  const d = (ek: Partial<KlipDurumu> = {}): KlipDurumu => ({
    calan: calan() as any,
    ilkAnahtar: 'Parça|X',
    oncekiIstek: false,
    istekCaliyor: false,
    widgetCanli: true,
    bekleyisMs: 0,
    simdi: 1000,
    ...ek
  });
  it('müzik çalarken bekler, parça sonunda duraklatıp başlar', () => {
    expect(klipKarari(d())).toBe('bekle');
    expect(klipKarari(d({ simdi: 1000 + 188_600 }))).toBe('duraklat-son');
    expect(parcaAnahtari(calan() as any)).toBe('Parça|X');
  });
  it('müzik çalmıyorsa duraklatmadan hemen başlar', () => {
    expect(klipKarari(d({ calan: null }))).toBe('baslat');
    expect(klipKarari(d({ calan: calan({ isPlaying: false }) as any }))).toBe('baslat');
  });
  it('OBS kaynağı kapalıysa müziğe dokunmaz', () => {
    expect(klipKarari(d({ widgetCanli: false, calan: null }))).toBe('bekle');
    expect(klipKarari(d({ widgetCanli: false, bekleyisMs: KLIP_EN_COK_BEKLEME_MS }))).toBe('bekle');
  });
  it('önceki istek varken bekler', () => {
    expect(klipKarari(d({ oncekiIstek: true, calan: null }))).toBe('bekle');
  });
  it('bitiş kaçtıysa yeni parçada durur; istek şarkısına geçiş kesilmez', () => {
    const yeni = calan({ title: 'Başka' }) as any;
    expect(klipKarari(d({ calan: yeni }))).toBe('duraklat');
    expect(klipKarari(d({ calan: yeni, istekCaliyor: true }))).toBe('bekle');
  });
  it('süre sınırı aşılınca bırakılır', () => {
    const ek = { bekleyisMs: KLIP_EN_COK_BEKLEME_MS };
    expect(klipKarari(d({ ...ek, calan: calan({ duration: 0 }) as any }))).toBe('duraklat');
    expect(klipKarari(d({ ...ek, oncekiIstek: true, calan: null }))).toBe('baslat');
  });
});

// Sahte AxthrowA Studio: komutlar ve istekler sırayla kaydedilir
let parca: any = null;
let istekHatasi = false;
const kayit: string[] = [];
let sunucu: http.Server;
beforeAll(async () => {
  sunucu = http.createServer((req, res) => {
    let g = '';
    req.on('data', (c) => (g += c));
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/api/player/status') return res.end(JSON.stringify({ spotify: { connected: true }, ytmd: { connected: false }, source: 'spotify', nowPlaying: parca }));
      const b = g ? JSON.parse(g) : {};
      if (req.url === '/api/player/command') {
        kayit.push(`komut:${b.action}`);
        return res.end('{}');
      }
      if (req.url === '/api/player/request') {
        kayit.push(`istek:${b.query}`);
        if (istekHatasi) {
          res.statusCode = 500;
          return res.end('{}');
        }
        return res.end(JSON.stringify({ title: b.query, artist: '', id: '' }));
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

describe('klip ve istek sırası', () => {
  const m = muzikHost as any;
  const s = songRequest as any;
  const ekle = (id: string, zaman: number, url: string) =>
    db.prepare('INSERT INTO song_queue (id, title, url, duration, requested_by, platform, thumbnail, created_at, is_played) VALUES (?, ?, ?, 180, ?, ?, ?, ?, 0)').run(id, id, url, 'ali', 'kick', '', zaman);
  const klip = (id: string, zaman: number) => ekle(id, zaman, 'https://www.youtube.com/watch?v=aaaaaaaaaaa');
  const sarki = (id: string, zaman: number) => ekle(id, zaman, `spotify-istek:${id}`);
  /** Yoklamayı ve komutların ağ turunu bekler */
  const yenile = async (ek?: Record<string, unknown> | null) => {
    parca = ek === null ? null : { ...calan(), updatedAt: Date.now(), ...ek };
    await m.hariciYokla();
  };
  // Komut zinciri sürdükçe bekler: sabit süre, paralel test yükünde yetmiyordu
  const bitir = async () => {
    for (let n = -1; n !== kayit.length; ) {
      n = kayit.length;
      await new Promise((r) => setTimeout(r, 80));
    }
  };

  beforeEach(async () => {
    db.exec('DELETE FROM song_queue');
    kayit.length = 0;
    s.klipOturumu = false;
    s.klipBekleyis = null;
    s.klipDevam = null;
    s.klipCalan = null;
    s.klipSinirla = null;
    istekHatasi = false;
    s.hariciSiraBekle = 0;
    s.sonBaslatma = 0;
    s.baslatmaOncesi = null;
    await yenile();
  });

  it('müzik sürerken klip gelmez; parça sonunda duraklar, klip çalar, müzik sürer', async () => {
    klip('k1', 1);
    expect(s.klipSirasi()).toBeNull();
    expect(kayit).toEqual([]);

    await yenile({ progress: 199_000 }); // 1 sn kaldı
    expect(s.klipSirasi()?.id).toBe('k1');
    await bitir();
    expect(kayit).toEqual(['komut:pause']);

    await yenile({ progress: 199_000, isPlaying: false });
    expect(s.klipBitti('k1')).toBe(true);
    s.klipKapisi();
    await bitir();
    expect(kayit).toEqual(['komut:pause', 'komut:next', 'komut:play']);
    expect(s.klipSirasi()).toBeNull();
  });

  it('müzik çalmıyorsa hemen başlar, bitince müzik başlatılmaz', async () => {
    await yenile({ isPlaying: false });
    klip('k1', 1);
    expect(s.klipSirasi()?.id).toBe('k1');
    s.klipBitti('k1');
    s.klipKapisi();
    await bitir();
    expect(kayit).toEqual([]);
  });

  it('art arda klipler sırayla çalar, müzik en sonda sürer', async () => {
    await yenile({ progress: 199_000 });
    klip('k1', 1);
    klip('k2', 2);
    expect(s.klipSirasi()?.id).toBe('k1');
    s.klipBitti('k1');
    s.klipKapisi();
    expect(s.klipSirasi()?.id).toBe('k2');
    await bitir();
    expect(kayit).toEqual(['komut:pause']);
    s.klipBitti('k2');
    s.klipKapisi();
    await bitir();
    expect(kayit).toEqual(['komut:pause', 'komut:next', 'komut:play']);
  });

  it('önce şarkı sonra klip: şarkı çalar, klip onun sonunda', async () => {
    sarki('a', 1);
    klip('k1', 2);
    s.klipSirasi();
    await yenile({ progress: 198_000 }); // 2 sn kaldı: istek başlar
    await s.hariciSiraDenetle(Date.now());
    expect(kayit).toEqual(['istek:a']);
    expect(s.klipSirasi()).toBeNull();

    await yenile({ title: 'a', artist: '', progress: 1000 }); // istek çalıyor: kesilmez
    expect(s.klipSirasi()).toBeNull();
    expect(kayit).toEqual(['istek:a']);

    await yenile({ title: 'a', artist: '', progress: 199_500 });
    expect(s.klipSirasi()?.id).toBe('k1');
    await bitir();
    expect(kayit).toEqual(['istek:a', 'komut:pause']);
  });

  it('önce klip sonra şarkı: şarkı klipten önce başlamaz, klip bitince başlar', async () => {
    klip('k1', 1);
    sarki('a', 2);
    s.klipSirasi();
    await yenile({ progress: 198_000 });
    await s.hariciSiraDenetle(Date.now());
    await s.hariciSiraDenetle(Date.now(), true);
    expect(kayit).toEqual([]);

    await yenile({ progress: 199_500 });
    expect(s.klipSirasi()?.id).toBe('k1');
    await bitir();
    s.klipBitti('k1');
    s.klipKapisi();
    await bitir();
    expect(kayit).toEqual(['komut:pause', 'istek:a']);
  });

  it('şarkı-klip-şarkı-klip sırası bozulmaz', async () => {
    sarki('a', 1);
    klip('k1', 2);
    sarki('b', 3);
    klip('k2', 4);
    s.klipSirasi();
    await yenile({ progress: 198_000 });
    await s.hariciSiraDenetle(Date.now());
    await yenile({ title: 'a', artist: '', progress: 199_500 });
    expect(s.klipSirasi()?.id).toBe('k1');
    await bitir();
    s.klipBitti('k1');
    s.klipKapisi();
    await bitir();
    // k2 hazır ama önünde b var
    expect(kayit).toEqual(['istek:a', 'komut:pause', 'istek:b']);
    expect(s.klipSirasi()).toBeNull();
  });

  it('widget çalışmayı keserse müzik serbest kalır', async () => {
    await yenile({ progress: 199_500 });
    klip('k1', 1);
    expect(s.klipSirasi()?.id).toBe('k1');
    await bitir();
    s.sonKlipYoklama = Date.now() - 20_000;
    s.klipKapisi();
    await bitir();
    expect(kayit).toEqual(['komut:pause', 'komut:next', 'komut:play']);
    expect(s.klipOturumu).toBe(false);
  });

  it('klip sonrası istek başlamazsa müzik duraklatılmış kalmaz, istek kuyrukta kalır', async () => {
    klip('k1', 1);
    sarki('a', 2);
    await yenile({ progress: 199_500 });
    expect(s.klipSirasi()?.id).toBe('k1');
    await bitir();
    istekHatasi = true;
    s.klipBitti('k1');
    s.klipKapisi();
    await bitir();
    expect(kayit).toEqual(['komut:pause', 'istek:a', 'komut:next', 'komut:play']);
    expect(db.prepare('SELECT is_played FROM song_queue WHERE id = ?').get('a')).toMatchObject({ is_played: 0 });
  });

  it('oynatıcı bitişi bildirmezse klip gerçek süresi dolunca geçilir; uzun klip kesilmez', async () => {
    await yenile({ isPlaying: false });
    klip('k1', 1);
    klip('k2', 2);
    const sure = vi.spyOn(s, 'youtubeSure').mockResolvedValue(1800);
    try {
      expect(s.klipSirasi()?.id).toBe('k1');
      s.klipKapisi();
      s.klipCalan.baslangic -= 16 * 60_000;
      s.klipCalan.sinir = 0;
      s.klipKapisi();
      await bitir();
      expect(s.klipSirasi()?.id).toBe('k1'); // 30 dk'lık klip 16. dakikada kesilmez
      s.klipCalan.baslangic -= 15 * 60_000;
      s.klipCalan.sinir = 0;
      s.klipKapisi();
      await bitir();
      expect(s.klipSirasi()?.id).toBe('k2');
      s.klipKapisi();
      expect(s.klipCalan.id).toBe('k2'); // sayaç yeni klip için baştan başlar
      sure.mockResolvedValue(0); // süre öğrenilemezse beklenmez
      s.klipCalan.sinir = 0;
      s.klipCalan.baslangic -= 16 * 60_000;
      s.klipKapisi();
      await bitir();
      expect(s.ilkKlip()).toBeNull();
    } finally {
      sure.mockRestore();
    }
  });

  it('süre sınırıyla geçen klip önündeki şarkı yüzünden geri kapanmaz', async () => {
    await yenile({ isPlaying: false, title: 'Başka' });
    sarki('a', 1);
    klip('k1', 2);
    s.klipSirasi();
    s.klipBekleyis.baslangic -= KLIP_EN_COK_BEKLEME_MS;
    expect(s.klipSirasi()?.id).toBe('k1');
    s.klipKapisi();
    expect(s.klipOturumu).toBe(true);
    expect(s.klipSirasi()?.id).toBe('k1');
    expect(kayit).toEqual([]);
  });

  it('sıra daha eski klipteyken !skip çalan parçayı geçer, şarkıyı başlatmaz', async () => {
    klip('k1', 1);
    sarki('a', 2);
    s.klipSirasi();
    await s.spotifyAtla();
    expect(kayit).toEqual(['komut:next']);
  });

  it('sıra klipteyken "şimdi çalıyor" denmez', async () => {
    klip('k1', 1);
    sarki('a', 2);
    s.klipSirasi();
    expect(s.siraYaniti('kim', 'a', true)).toContain('sıraya alındı');
    await bitir();
    expect(kayit).toEqual([]);
    db.exec('DELETE FROM song_queue');
    sarki('b', 3);
    expect(s.siraYaniti('kim', 'b', true)).toContain('şimdi çalıyor');
    await bitir(); // başlatılan istek sonraki teste sızmasın
  });

  it('video kipinde istek sırasını beklerken DJ parçası kesilmez, sıra gelince geçilir', async () => {
    settingsCache.set('sr_hedef', 'video');
    try {
      const dj = { id: 'dj', title: 'DJ', url: 'https://www.youtube.com/watch?v=ddddddddddd', requestedBy: 'Otomatik DJ' };
      s.djParca = dj;
      await yenile({ progress: 1000 });
      klip('k1', 1);
      expect(s.klipSirasi()).toEqual(dj);
      await yenile({ progress: 199_500 });
      expect(s.klipSirasi()?.id).toBe('k1');
      expect(s.djParca).toBeNull();
      await bitir();
    } finally {
      settingsCache.set('sr_hedef', 'spotify');
    }
  });

  it('OBS kaynağı yoksa klip şarkıları tutmaz', async () => {
    klip('k1', 1);
    sarki('a', 2);
    s.sonKlipYoklama = 0;
    await yenile({ progress: 198_000 });
    await s.hariciSiraDenetle(Date.now());
    expect(kayit).toEqual(['istek:a']);
  });

  it('YouTube Music isteği klip sayılmaz', () => {
    ekle('ytm', 1, 'https://music.youtube.com/watch?v=aaaaaaaaaaa');
    expect(s.ilkKlip()).toBeNull();
    klip('k1', 2);
    expect(s.ilkKlip()?.id).toBe('k1');
  });
});
