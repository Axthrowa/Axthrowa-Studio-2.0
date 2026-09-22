/**
 * StreamAxT — etkileşim sistemleri testleri
 * Developed by AxthrowA
 *
 * Yalnız saf fonksiyonlar; motor sınıfları veritabanı açtığı için
 * buradan yüklenmez.
 */
import { describe, it, expect } from 'vitest';
import { odulDagit, secenekBul, type TahminBahsi } from './prediction-math.js';
import { sirala, type KuyrukKaydi } from './queue-order.js';
import { kisiBasiPuan, VARSAYILAN_DUSUS } from './drop-math.js';

// ---- Tahminler --------------------------------------------------------------

const B = (kullanici: string, secenekIndex: number, puan: number): TahminBahsi => ({
  kullanici,
  gorunenAd: kullanici,
  secenekIndex,
  puan
});

describe('odulDagit', () => {
  it('kazananlar havuzu payları oranında bölüşür', () => {
    // Havuz 300: ali 100 (kazanan), veli 200 (kaybeden) -> ali hepsini alır
    const r = odulDagit([B('ali', 0, 100), B('veli', 1, 200)], 0);
    expect(r).toEqual([{ kullanici: 'ali', kazanc: 300 }]);
  });

  it('iki kazanan oranlı bölüşür', () => {
    // Havuz 400: ali 100, ayse 100 kazanan; veli 200 kaybeden
    const r = odulDagit([B('ali', 0, 100), B('ayse', 0, 100), B('veli', 1, 200)], 0);
    expect(r.find((x) => x.kullanici === 'ali')?.kazanc).toBe(200);
    expect(r.find((x) => x.kullanici === 'ayse')?.kazanc).toBe(200);
  });

  it('KAZANAN YOKSA herkese iade — puan buharlaşmaz', () => {
    const bahisler = [B('ali', 0, 100), B('veli', 1, 50)];
    const r = odulDagit(bahisler, 2);
    expect(r).toEqual([
      { kullanici: 'ali', kazanc: 100 },
      { kullanici: 'veli', kazanc: 50 }
    ]);
  });

  it('yuvarlama artığı kaybolmaz', () => {
    // Havuz 100, üç kazanan eşit -> 33+33+33 = 99, 1 artık
    const r = odulDagit([B('a', 0, 10), B('b', 0, 10), B('c', 0, 10), B('d', 1, 70)], 0);
    expect(r.reduce((t, x) => t + x.kazanc, 0)).toBe(100);
  });

  it('boş bahis listesi boş sonuç verir', () => {
    expect(odulDagit([], 0)).toEqual([]);
  });

  it('toplam dağıtılan havuzu aşmaz', () => {
    const bahisler = [B('a', 0, 137), B('b', 0, 41), B('c', 1, 993)];
    const havuz = 137 + 41 + 993;
    expect(odulDagit(bahisler, 0).reduce((t, x) => t + x.kazanc, 0)).toBe(havuz);
  });
});

describe('secenekBul', () => {
  const s = ['Evet', 'Hayır', 'Belki'];

  it('tam adı bulur (harf duyarsız)', () => {
    expect(secenekBul(s, 'evet')).toBe(0);
    expect(secenekBul(s, 'Evet')).toBe(0);
  });

  it('Türkçe noktasız ı sorununu aşar', () => {
    // 'HAYIR'.toLowerCase() === 'hayir' ama 'Hayır'.toLowerCase() === 'hayır'
    expect(secenekBul(s, 'HAYIR')).toBe(1);
    expect(secenekBul(s, 'hayır')).toBe(1);
    // Türkçe klavyesi olmayan izleyici de eşleşsin
    expect(secenekBul(s, 'hayir')).toBe(1);
  });

  it('1 tabanlı numarayla bulur', () => {
    expect(secenekBul(s, '1')).toBe(0);
    expect(secenekBul(s, '3')).toBe(2);
  });

  it('baştan eşleşmeyle bulur', () => {
    expect(secenekBul(s, 'bel')).toBe(2);
  });

  it('aralık dışı numarayı reddeder', () => {
    expect(secenekBul(s, '0')).toBe(-1);
    expect(secenekBul(s, '9')).toBe(-1);
  });

  it('bilinmeyen girdide -1', () => {
    expect(secenekBul(s, 'zzz')).toBe(-1);
    expect(secenekBul(s, '')).toBe(-1);
  });
});

// ---- Kuyruk -----------------------------------------------------------------

const K = (ad: string, katilma: number, oncelikli = false): KuyrukKaydi => ({
  kullanici: ad,
  gorunenAd: ad,
  platform: 'kick',
  katilma,
  oncelikli
});

describe('kuyruk sirala', () => {
  it('öncelik kapalıyken katılma sırası korunur', () => {
    const r = sirala([K('c', 300), K('a', 100, true), K('b', 200)], false);
    expect(r.map((x) => x.kullanici)).toEqual(['a', 'b', 'c']);
  });

  it('öncelik açıkken abone/VIP öne geçer', () => {
    const r = sirala([K('a', 100), K('b', 200, true), K('c', 300)], true);
    expect(r.map((x) => x.kullanici)).toEqual(['b', 'a', 'c']);
  });

  it('öncelikliler kendi aralarında adil — katılma sırasıyla', () => {
    const r = sirala([K('geç', 300, true), K('erken', 100, true), K('normal', 50)], true);
    expect(r.map((x) => x.kullanici)).toEqual(['erken', 'geç', 'normal']);
  });

  it('boş kuyruk boş döner', () => {
    expect(sirala([], true)).toEqual([]);
  });

  it('kaynağı değiştirmez', () => {
    const kaynak = [K('b', 200), K('a', 100)];
    sirala(kaynak, true);
    expect(kaynak.map((x) => x.kullanici)).toEqual(['b', 'a']);
  });
});

// ---- Puan düşüşü ------------------------------------------------------------

describe('kisiBasiPuan', () => {
  const A = (ek = {}) => ({ ...VARSAYILAN_DUSUS, ...ek });

  it('bölüşüm kipinde katılan sayısına böler', () => {
    expect(kisiBasiPuan(A({ toplamPuan: 1000, paylasim: 'bolusum' }), 4)).toBe(250);
    expect(kisiBasiPuan(A({ toplamPuan: 1000, paylasim: 'bolusum' }), 3)).toBe(333);
  });

  it('sabit kipte kontenjana böler — az katılan fazla almaz', () => {
    expect(kisiBasiPuan(A({ toplamPuan: 1000, maksKisi: 20, paylasim: 'sabit' }), 5)).toBe(50);
  });

  it('sabit kipte kontenjan yoksa katılana böler', () => {
    expect(kisiBasiPuan(A({ toplamPuan: 100, maksKisi: 0, paylasim: 'sabit' }), 4)).toBe(25);
  });

  it('kimse katılmazsa sıfır', () => {
    expect(kisiBasiPuan(A(), 0)).toBe(0);
  });

  it('puan sıfırsa sıfır', () => {
    expect(kisiBasiPuan(A({ toplamPuan: 0 }), 10)).toBe(0);
  });
});
