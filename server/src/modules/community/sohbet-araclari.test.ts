import { describe, it, expect, vi } from 'vitest';

vi.mock('../../db/index.js', () => ({ db: { prepare: () => ({ get: () => undefined, all: () => [], run: () => ({}) }) } }));

import { hatirlatmaKur, HATIRLATMA_KISI_BASI, kisaSure, lurkBasla, lurkBitir, skorKomutu, sureCoz, VARSAYILAN_SKOR } from './sohbet-araclari.js';
import { SohbetIstatistik, sozcukler } from './sohbet-istatistik.js';

describe('süre çözümü (!hatirlat)', () => {
  it('birimli ve birleşik süreler', () => {
    expect(sureCoz('15dk')).toBe(900);
    expect(sureCoz('90sn')).toBe(90);
    expect(sureCoz('1sa30dk')).toBe(5400);
    expect(sureCoz('2saat')).toBe(7200);
    expect(sureCoz('10')).toBe(600); // birimsiz = dakika
  });
  it('anlamsız girdi 0', () => {
    expect(sureCoz('yarın')).toBe(0);
    expect(sureCoz('10dk abc')).toBe(0);
    expect(sureCoz('')).toBe(0);
  });
  it('kısa süre yazımı', () => {
    expect(kisaSure(45)).toBe('45 sn');
    expect(kisaSure(1500)).toBe('25 dk');
    expect(kisaSure(3700)).toBe('1 sa 2 dk');
  });
});

describe('!hatirlat sınırları', () => {
  it('kişi başı sınır, çok kısa ve çok uzun süre reddedilir; süre dolunca gönderir', () => {
    vi.useFakeTimers();
    const gonder = vi.fn();
    expect(hatirlatmaKur('ali', 5, gonder)).toMatch(/en az/);
    expect(hatirlatmaKur('ali', 13 * 3600, gonder)).toMatch(/12 saat/);
    for (let i = 0; i < HATIRLATMA_KISI_BASI; i++) expect(hatirlatmaKur('ali', 60, gonder)).toBeNull();
    expect(hatirlatmaKur('ALI', 60, gonder)).toMatch(/en çok/);
    vi.advanceTimersByTime(60_000);
    expect(gonder).toHaveBeenCalledTimes(HATIRLATMA_KISI_BASI);
    expect(hatirlatmaKur('ali', 60, gonder)).toBeNull(); // dolanlar yer açar
    vi.useRealTimers();
  });
});

describe('!lurk', () => {
  it('dönüşte arka plan süresi, lurk olmayanda null', () => {
    lurkBasla('Veli', 1000);
    expect(lurkBitir('veli', 61_000)).toBe(60);
    expect(lurkBitir('veli', 70_000)).toBeNull();
  });
});

describe('skor tablosu komutu', () => {
  const t = VARSAYILAN_SKOR;
  it('numara ya da ad başıyla; +, -, =', () => {
    expect(skorKomutu(t, '1', '+2')!.takimlar[0].skor).toBe(2);
    expect(skorKomutu(t, '2', '=5')!.takimlar[1].skor).toBe(5);
    expect(skorKomutu({ ...t, takimlar: [{ ad: 'Mavi', renk: '#000000', skor: 1 }, t.takimlar[1]] }, 'mav', '+1')!.takimlar[0].skor).toBe(2);
  });
  it('geçersiz takım ya da işlem null', () => {
    expect(skorKomutu(t, '9', '+1')).toBeNull();
    expect(skorKomutu(t, '1', 'çok')).toBeNull();
  });
});

describe('sohbet istatistikleri', () => {
  it('sözcükler: komut ve link sayılmaz, noktalama atılır', () => {
    expect(sozcukler('!sr deneme')).toEqual([]);
    expect(sozcukler('harika gol!! https://x.com/a KEKW')).toEqual(['harika', 'gol', 'KEKW']);
  });
  it('aynı mesajdaki tekrar bir kez; bulutta dolgu yok; emote sayımı harf duyarlı önce', () => {
    const i = new SohbetIstatistik();
    i.ekle('a', 'A', 'KEKW KEKW KEKW ve gol');
    i.ekle('b', 'B', 'kekw gol');
    i.ekle('a', 'A', 'gol');
    expect(i.say('KEKW')).toBe(1);
    expect(i.say('Kekw')).toBe(2);
    expect(i.bulut().map((x) => x.sozcuk)).toEqual(['gol', 'KEKW']);
    expect(i.enCokYazanlar()[0]).toEqual({ ad: 'A', sayi: 2 });
    expect(i.ozet().mesajSayisi).toBe(3);
    i.sifirla();
    expect(i.ozet().mesajSayisi).toBe(0);
  });
});
