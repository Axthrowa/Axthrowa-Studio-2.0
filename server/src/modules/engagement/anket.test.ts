import { describe, it, expect, vi } from 'vitest';

vi.mock('../../db/index.js', () => ({ db: { prepare: () => ({ get: () => undefined, all: () => [], run: () => ({}) }) } }));

import { anketKomutuCoz, anketSonucMetni } from './anket.js';

const coz = (metin: string) => anketKomutuCoz(metin.split(/\s+/));

describe('!anketac komutu', () => {
  it('soru ve seçenekleri | ile ayırır, süre varsayılan 60 sn', () => {
    expect(coz('Hangi oyun? | Valorant | CS2')).toEqual({ soru: 'Hangi oyun?', secenekler: ['Valorant', 'CS2'], sure: 60 });
  });

  it('ilk sözcük süre olabilir: saniye ya da dakika', () => {
    expect(coz('90 Soru | A | B')).toMatchObject({ soru: 'Soru', sure: 90 });
    expect(coz('2dk Soru | A | B')).toMatchObject({ soru: 'Soru', sure: 120 });
    expect(coz('45sn Soru | A | B')).toMatchObject({ sure: 45 });
  });

  it('sayıyla başlayan soru, süre sanılmaz (yalnız sayı sözcüğü süre)', () => {
    expect(coz('2026 en iyi oyun? | A | B')).toMatchObject({ soru: '2026 en iyi oyun?', sure: 60 });
    expect(coz('3D mi 2D mi? | 3D | 2D')).toMatchObject({ soru: '3D mi 2D mi?', sure: 60 });
  });

  it('virgüllü biçim: süre, soru, seçenekler', () => {
    expect(coz('60, Hangi oyun?, Valorant, CS2, LoL')).toEqual({ soru: 'Hangi oyun?', secenekler: ['Valorant', 'CS2', 'LoL'], sure: 60 });
    expect(coz('2dk, Soru, A, B')).toMatchObject({ sure: 120 });
    expect(coz('Soru, A, B')).toEqual({ soru: 'Soru', secenekler: ['A', 'B'], sure: 60 });
  });

  it('iki seçenekten azsa kullanım gösterilir', () => {
    expect('hata' in coz('Soru | Tek')).toBe(true);
    expect('hata' in coz('Sadece soru')).toBe(true);
  });
});

describe('anket sonucu duyurusu', () => {
  it('kazanan, oy ve yüzde', () => {
    expect(anketSonucMetni({ title: 'Oyun', options: ['A', 'B'], oylar: [5, 3] })).toContain('🏆 A (5 oy, %63, toplam 8)');
  });
  it('beraberlik ve hiç oy yok', () => {
    expect(anketSonucMetni({ title: 'Oyun', options: ['A', 'B'], oylar: [2, 2] })).toContain('berabere — A / B');
    expect(anketSonucMetni({ title: 'Oyun', options: ['A', 'B'], oylar: [0, 0] })).toContain('hiç oy gelmedi');
  });
});

describe('süre dolan anketin sonucu', () => {
  it('yalnız son 1 dakikada bittiyse duyurulur (bot kapalıyken dolan eski anket sessiz)', async () => {
    const { sonucDuyurulmali } = await import('./anket-kapatici.js');
    expect(sonucDuyurulmali(100_000, 130_000)).toBe(true);
    expect(sonucDuyurulmali(100_000, 100_000 + 24 * 3600_000)).toBe(false);
  });
  it('Discord ve bağlı olmayan platformlar hariç', async () => {
    const { yayinSohbetleri } = await import('./anket-kapatici.js');
    const bagli: Record<string, boolean> = { kick: true, twitch: false, discord: true, youtube: true };
    const pm = { getAllStatuses: () => bagli, getPlatform: (ad: string) => ({ isConnected: () => bagli[ad] }) };
    expect(yayinSohbetleri(pm)).toEqual(['kick', 'youtube']);
  });
});

describe('düz sohbet mesajından oy', () => {
  const siklar = ['Valorant', 'CS2', 'İzle sadece'];
  it('yalnız numara ya da şıkkın adı oy sayılır', async () => {
    const { anketOyuCoz } = await import('./anket.js');
    expect(anketOyuCoz('2', siklar)).toBe(1);
    expect(anketOyuCoz(' valorant ', siklar)).toBe(0);
    expect(anketOyuCoz('izle sadece', siklar)).toBe(2);
    expect(anketOyuCoz('4', siklar)).toBeNull();
    expect(anketOyuCoz('0', siklar)).toBeNull();
    expect(anketOyuCoz('bence valorant', siklar)).toBeNull();
    expect(anketOyuCoz('', siklar)).toBeNull();
  });
});
