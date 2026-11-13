/** B7: önceki sahneye dönüş, rastgele kip, kural sırası, gerçek "Çalıştır". */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../db/index.js', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE bot_settings (key TEXT PRIMARY KEY, value TEXT); CREATE TABLE channels (platform TEXT, channel_name TEXT, is_active INTEGER);');
  return { db };
});
const ag = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('axios', () => ({ default: ag }));
vi.mock('../muzik/index.js', () => ({ muzikHost: { hariciAdres: () => 'http://127.0.0.1:18843' } }));

import { eventBus } from '../../core/event-bus.js';
import { Otomasyon } from './otomasyon.js';

const sahneler = () => ag.post.mock.calls.map((c) => c[1].params.scene);
const mesajlar: string[] = [];
eventBus.on('bot_message', (p: any) => mesajlar.push(p.message));
let m: Otomasyon;
beforeEach(() => {
  m = new Otomasyon();
  ag.get.mockReset().mockResolvedValue({ data: { currentScene: 'Oyun' } });
  ag.post.mockReset().mockResolvedValue({ data: {} });
  mesajlar.length = 0;
});
afterEach(() => vi.useRealTimers());

const raid = {
  id: 'r', ad: 'Raid sahnesi', tetik: { tur: 'baskin', enAz: 0 }, kosullar: [], beklemeSn: 5,
  eylemler: [{ tur: 'obs_sahne', sahne: 'Raid' }, { tur: 'bekle', saniye: 10 }, { tur: 'obs_sahne', sahne: '{onceki_sahne}' }],
};

describe('B7 otomasyon', () => {
  it('Raid gelince sahneyi değiştir, 10 sn sonra önceki sahneye dön ("Çalıştır")', async () => {
    vi.useFakeTimers();
    const is = m.calistir(raid);
    await vi.advanceTimersByTimeAsync(0);
    expect(sahneler()).toEqual(['Raid']);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await is).toEqual({ ok: true, mesaj: '3 eylem çalıştı' });
    expect(sahneler()).toEqual(['Raid', 'Oyun']);
  });

  it('önceki sahne okunamazsa geri dönüş hata verir', async () => {
    ag.get.mockRejectedValue(new Error('OBS bağlı değil'));
    const r = await m.calistir({ ...raid, eylemler: [raid.eylemler[0], raid.eylemler[2]] });
    expect(r.ok).toBe(false);
    expect(r.mesaj).toContain('Önceki sahne bilinmiyor');
  });

  it('rastgele kip tek eylem çalıştırır', async () => {
    const r = await m.calistir({ ...raid, kip: 'rastgele', eylemler: [{ tur: 'sohbet', metin: 'a' }, { tur: 'sohbet', metin: 'b' }] });
    expect(r.ok).toBe(true);
    expect(mesajlar).toHaveLength(1);
  });

  it('sıralı kural bekleme içindeki olayı atmaz, sonra çalıştırır', async () => {
    vi.useFakeTimers();
    m.kaydet([{ ...raid, sira: true, eylemler: [{ tur: 'sohbet', metin: 'Hoş geldin {kullanici}' }] }]);
    void m.olay({ tur: 'baskin', kullanici: 'ali', miktar: 3 });
    void m.olay({ tur: 'baskin', kullanici: 'veli', miktar: 3 });
    await vi.advanceTimersByTimeAsync(0);
    expect(mesajlar).toEqual(['Hoş geldin ali']);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(mesajlar).toEqual(['Hoş geldin ali', 'Hoş geldin veli']);
  });
});
