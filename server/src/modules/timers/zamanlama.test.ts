/**
 * AxBoT — zamanlayıcı kararları testleri
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import { aralikMs, baslangicZamani, gonderilmeli, mesajlariAyikla, minSatir } from './zamanlama.js';

const DK = 60_000;
const k = (o: Partial<{ aralikDk: number; minSatir: number; yalnizYayinda: boolean }> = {}) => ({
  id: 't',
  aralikDk: 15,
  minSatir: 5,
  yalnizYayinda: false,
  ...o
});

describe('gonderilmeli', () => {
  it('süre dolunca ve satır şartı sağlanınca', () => {
    expect(gonderilmeli(k(), { son: 0, satir: 5, sira: 0 }, 15 * DK, null)).toBe(true);
    expect(gonderilmeli(k(), { son: 0, satir: 5, sira: 0 }, 15 * DK - 1, null)).toBe(false);
  });

  it('satır yetersizse beklenir ama şart dolduğu AN gönderilir (tam tur beklenmez)', () => {
    const d = { son: 0, satir: 3, sira: 0 };
    expect(gonderilmeli(k(), d, 16 * DK, null)).toBe(false);
    d.satir = 5; // 16. dakikada iki mesaj daha geldi
    expect(gonderilmeli(k(), d, 16 * DK + 1000, null)).toBe(true);
  });

  it('yalnız yayında: kapalıyken yazmaz; durum bilinmiyorsa engellemez', () => {
    const d = { son: 0, satir: 9, sira: 0 };
    expect(gonderilmeli(k({ yalnizYayinda: true }), d, 20 * DK, false)).toBe(false);
    expect(gonderilmeli(k({ yalnizYayinda: true }), d, 20 * DK, true)).toBe(true);
    expect(gonderilmeli(k({ yalnizYayinda: true }), d, 20 * DK, null)).toBe(true);
  });

  it('min satır 0 = sohbet sessiz olsa da yazar', () => {
    expect(gonderilmeli(k({ minSatir: 0 }), { son: 0, satir: 0, sira: 0 }, 15 * DK, null)).toBe(true);
  });
});

describe('doğrulama', () => {
  it('geçersiz süre ve satır güvenli değere oturur (mesaj seli olmaz)', () => {
    expect(aralikMs('abc')).toBe(15 * DK);
    expect(aralikMs(0)).toBe(1 * DK);
    expect(aralikMs(-5)).toBe(1 * DK);
    expect(aralikMs(1e9)).toBe(1440 * DK);
    expect(minSatir('x')).toBe(5);
    expect(minSatir(-1)).toBe(0);
  });

  it('başlangıç: yakın son çalışmadan devam, eskiyse şimdiden', () => {
    expect(baslangicZamani(1000, 15, 1000 + 5 * DK)).toBe(1000);
    expect(baslangicZamani(1000, 15, 1000 + 20 * DK)).toBe(1000 + 20 * DK);
    expect(baslangicZamani(null, 15, 7)).toBe(7);
  });

  it('mesajlar: JSON, düz metin, boşlar', () => {
    expect(mesajlariAyikla('["a"," ","b"]')).toEqual(['a', 'b']);
    expect(mesajlariAyikla('düz mesaj')).toEqual(['düz mesaj']);
    expect(mesajlariAyikla(['x', '', null])).toEqual(['x']);
    expect(mesajlariAyikla('')).toEqual([]);
  });
});
