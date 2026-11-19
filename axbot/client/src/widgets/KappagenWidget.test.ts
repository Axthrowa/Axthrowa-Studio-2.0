import { describe, expect, it } from 'vitest';
import { ekranSiniri, girisTuru, guvenliGorsel, ucusKareleri, ucusRotasi, yerAc } from './KappagenWidget.js';

describe('ucusRotasi', () => {
  it('ekran dışından girer, başka bir kenardan çıkar', () => {
    const kenar = (x: number, y: number) => (y < 0 ? 'ust' : x > 100 ? 'sag' : y > 100 ? 'alt' : x < 0 ? 'sol' : 'ic');
    for (let i = 0; i < 500; i++) {
      const r = ucusRotasi();
      const giris = kenar(r.x, r.y);
      const cikis = kenar(r.x + r.dx, r.y + r.dy);
      expect(giris).not.toBe('ic');
      expect(cikis).not.toBe('ic');
      expect(cikis).not.toBe(giris);
    }
  });
});

describe('ucusKareleri', () => {
  const plan = { x0: 0, y0: 0, x1: 1000, y1: 500, donus: 90, sure: 5000, boyut: 64, patlama: false, giris: 'zoom' as const, girisMs: 300 };

  it('ekran kartında akabilsin: CSS değişkeni, yüzde ya da vw yok; yalnız transform ve opaklık', () => {
    for (const k of ucusKareleri(plan)) {
      expect(Object.keys(k).sort()).toEqual(['offset', 'opacity', 'transform']);
      expect(String(k.transform)).not.toMatch(/var\(|%|vw|vh/);
      expect(String(k.transform)).toMatch(/^translate3d\(/);
    }
  });

  it('giriş uçuşun içinde: yakınlaşma ölçekle başlar, girişten sonra tam boy ve opak', () => {
    const k = ucusKareleri(plan);
    expect(k[0]).toMatchObject({ opacity: 0, offset: 0 });
    expect(String(k[0].transform)).toContain('scale(0.3)');
    expect(k[1].offset).toBeCloseTo(300 / 5000);
    expect(k[1]).toMatchObject({ opacity: 1 });
    expect(k.at(-1)).toMatchObject({ opacity: 1, offset: 1 });
    // merkez → sol üst köşe: bitişte (1000-32, 500-32)
    expect(String(k.at(-1)!.transform)).toContain('translate3d(968.0px, 468.0px, 0) rotate(90.0deg)');
  });

  it('giriş yoksa ilk kare tam görünür; patlama sonda söner', () => {
    const yok = ucusKareleri({ ...plan, giris: 'none' });
    expect(yok[0]).toMatchObject({ opacity: 1 });
    expect(yok).toHaveLength(2);
    const patlama = ucusKareleri({ ...plan, patlama: true });
    expect(patlama.at(-1)).toMatchObject({ opacity: 0 });
    expect(patlama.at(-2)).toMatchObject({ opacity: 1, offset: 0.85 });
  });

  it('kareler sıralı (Web Animations offset artmalı)', () => {
    for (const p of [plan, { ...plan, patlama: true }, { ...plan, sure: 400 }]) {
      const o = ucusKareleri(p).map((k) => Number(k.offset));
      expect([...o].sort((a, b) => a - b)).toEqual(o);
    }
  });
});

describe('yerAc', () => {
  it('normal emote dolu ekranda düşer, eskiyi silmez', () => {
    expect(yerAc(12, 12, 3, false)).toEqual({ kabul: 0, sondur: 0 });
    expect(yerAc(10, 12, 3, false)).toEqual({ kabul: 2, sondur: 0 });
  });
  it('patlama yer açar, en çok sınır kadar', () => {
    expect(yerAc(12, 12, 4, true)).toEqual({ kabul: 4, sondur: 4 });
    expect(yerAc(5, 12, 40, true)).toEqual({ kabul: 12, sondur: 5 });
  });
});

describe('ayar yardımcıları', () => {
  it('ekran sınırı 5 ile 60 arasında', () => {
    expect(ekranSiniri(2)).toBe(5);
    expect(ekranSiniri(500)).toBe(60);
    expect(ekranSiniri('abc')).toBe(12);
  });
  it('giriş türü: ağır efektler yakınlaşmaya düşer', () => {
    expect(girisTuru('none')).toBe('none');
    expect(girisTuru('fadeUp')).toBe('fade');
    expect(girisTuru('flipX')).toBe('zoom');
    expect(girisTuru(undefined)).toBe('zoom');
  });
  it('yalnız bilinen emote sunucuları', () => {
    expect(guvenliGorsel('https://cdn.7tv.app/emote/ABC123/2x.webp')).toBeTruthy();
    expect(guvenliGorsel('https://cdn.betterttv.net/emote/5f1b0186cf6d2144653d2970/2x')).toBeTruthy();
    expect(guvenliGorsel('https://ornek.com/x.gif')).toBeUndefined();
    expect(guvenliGorsel('javascript:alert(1)')).toBeUndefined();
  });
});
