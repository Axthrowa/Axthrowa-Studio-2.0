/** BOT-1: eylem kitaplığı, kuyruklar, kabul kuralı (sahte Studio'ya karşı) */
import http from 'node:http';
import fs from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const zaman: string[] = [];
const sesli = vi.hoisted(() => ({ calistir: vi.fn(async (e: any) => (zaman.push(`pano:${e.ogeId ?? e.tur}`), 'tamam')) }));
const host = vi.hoisted(() => ({ adres: '' }));
vi.mock('../sesli/sesli.js', () => ({ sesliKomutlar: sesli }));
vi.mock('../muzik/index.js', () => ({ muzikHost: { hariciAdres: () => host.adres } }));

import { eventBus } from '../../core/event-bus.js';
import { kuralDuzelt } from './kural.js';
import { Otomasyon } from './otomasyon.js';

const FIKSTUR = JSON.parse(fs.readFileSync(new URL('../../../../../tests/fixtures/otomasyon-abone-isik.json', import.meta.url), 'utf8'));
const studio: Array<{ t: number; govde: any }> = [];
let sunucu: http.Server;
let m: Otomasyon;
const mesajlar: string[] = [];
eventBus.on('bot_message', (p: any) => mesajlar.push(p.message));

beforeAll(async () => {
  sunucu = http.createServer((req, res) => {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => {
      if (req.url === '/api/actions/run') {
        const govde = JSON.parse(b);
        studio.push({ t: Date.now(), govde });
        zaman.push(govde.id);
        res.setHeader('Content-Type', 'application/json');
        return res.end('{"ok":true}');
      }
      res.end(`yanit:${decodeURIComponent(req.url ?? '')}`);
    });
  });
  await new Promise<void>((r) => sunucu.listen(0, '127.0.0.1', r));
  host.adres = `http://127.0.0.1:${(sunucu.address() as any).port}`;
});
afterAll(() => sunucu.close());
beforeEach(() => {
  m = new Otomasyon();
  m.kaydet([], []);
  studio.length = 0;
  zaman.length = 0;
  mesajlar.length = 0;
});

const k = (id: string, eylemler: any[], ek: any = {}) => ({ id, ad: id, beklemeSn: 0, tetik: { tur: 'takip' }, kosullar: [], eylemler, ...ek });

describe('BOT-1 kabul: abone → ışık aç, ses çal, 5 sn sonra kapat', () => {
  it('fikstür kuralı Studio çağrılarını sırayla ve 5 sn arayla yapar', async () => {
    expect(m.kaydet([FIKSTUR.kural]).ok).toBe(true);
    await m.olay({ tur: 'abone', kullanici: 'ali', platform: 'kick' });
    expect(zaman).toEqual(['filter.enable', 'pano:pano-abone-sesi', 'filter.disable']);
    expect(studio.map((s) => s.govde)).toEqual(FIKSTUR.studioCagrilari);
    const ara = studio[1].t - studio[0].t;
    expect(ara).toBeGreaterThanOrEqual(4900);
    expect(ara).toBeLessThan(7000);
  }, 15_000);
});

describe('BOT-1 eylemleri', () => {
  it('doğrulama: HTTP sunucusuna izleyici değeri giremez, dönüşüm alan ister, dal derinliği sınırlı', () => {
    expect(kuralDuzelt(k('a', [{ tur: 'http', adres: 'https://{mesaj}/x' }])).ok).toBe(false);
    expect(kuralDuzelt(k('a', [{ tur: 'http', adres: 'https://ornek.com/x?a={mesaj}' }])).ok).toBe(true);
    expect(kuralDuzelt(k('a', [{ tur: 'obs_donusum', kaynak: 'Kamera' }])).ok).toBe(false);
    const dal = (ic: any[]) => ({ tur: 'rastgele_dal', yuzde: 50, evet: ic, hayir: [] });
    const sohbet = { tur: 'sohbet', metin: 'x' };
    expect(kuralDuzelt(k('a', [dal([dal([sohbet])])])).ok).toBe(true);
    expect(kuralDuzelt(k('a', [dal([dal([dal([sohbet])])])])).ok).toBe(false);
  });

  it('kaydet: bilinmeyen kuyruk ve olmayan hedef kural reddedilir', () => {
    expect(m.kaydet([k('a', [{ tur: 'sohbet', metin: 'x' }], { kuyruk: 'Yok' })], []).ok).toBe(false);
    expect(m.kaydet([k('a', [{ tur: 'kural_calistir', kuralId: 'yok' }])]).ok).toBe(false);
  });

  it('HTTP yanıtı {yanit} olur, adresteki değer kodlanır; değişkenler yazılır', async () => {
    m.kaydet([
      k('h', [
        { tur: 'http', yontem: 'GET', adres: `${host.adres}/kanca?ad={kullanici}` },
        { tur: 'sohbet', metin: '{yanit}' },
        { tur: 'degisken', hedef: 'sayac', ad: 'takipler', islem: 'ekle', deger: '2' },
        { tur: 'degisken', hedef: 'kanal', ad: 'son_takip', islem: 'ayarla', deger: '{kullanici}' }
      ])
    ]);
    await m.olay({ tur: 'takip', kullanici: 'a&b' });
    expect(mesajlar).toEqual(['yanit:/kanca?ad=a&b']);
    const { kvOku, sayacAl } = await import('../../core/variables/store.js');
    expect(sayacAl('takipler')).toBe(2);
    expect(kvOku('global', '', 'son_takip')).toBe('a&b');
  });

  it('rastgele dal olasılığa göre seçer; başka kural çalışır, döngü durur', async () => {
    const r = vi.spyOn(Math, 'random');
    m.kaydet([
      k('d', [{ tur: 'rastgele_dal', yuzde: 50, evet: [{ tur: 'sohbet', metin: 'evet' }], hayir: [{ tur: 'kural_calistir', kuralId: 'b' }] }]),
      k('b', [{ tur: 'sohbet', metin: 'b' }, { tur: 'kural_calistir', kuralId: 'd' }], { etkin: false })
    ]);
    r.mockReturnValue(0.1);
    await m.olay({ tur: 'takip' });
    r.mockReturnValue(0.9);
    await m.olay({ tur: 'takip' }, Date.now() + 600_000);
    r.mockRestore();
    expect(mesajlar).toEqual(['evet', 'b']);
    expect(m.gunlukOku()[0].mesaj).toContain('Döngü');
  });

  it('kuyruk: ayniAnda 1 sıralı, 2 paralel; dolu kuyruk olayı atar', async () => {
    const adim = (ad: string) => [{ tur: 'sohbet', metin: `${ad}-bas` }, { tur: 'bekle', saniye: 1 }, { tur: 'sohbet', metin: `${ad}-son` }];
    const kur = (ayniAnda: number, enCokBekleyen = 20, n = 2) =>
      (m = new Otomasyon()).kaydet(Array.from({ length: n }, (_, i) => k(`q${i}`, adim(`q${i}`), { kuyruk: 'Işık' })), [{ ad: 'Işık', ayniAnda, enCokBekleyen }]);
    kur(1);
    await m.olay({ tur: 'takip' });
    expect(mesajlar).toEqual(['q0-bas', 'q0-son', 'q1-bas', 'q1-son']);
    mesajlar.length = 0;
    kur(2);
    await m.olay({ tur: 'takip' });
    expect(mesajlar).toEqual(['q0-bas', 'q1-bas', 'q0-son', 'q1-son']);
    mesajlar.length = 0;
    kur(1, 1, 3);
    await m.olay({ tur: 'takip' });
    expect(mesajlar).toHaveLength(4);
    expect(m.gunlukOku().some((g) => g.mesaj.includes('dolu'))).toBe(true);
  }, 15_000);
});
