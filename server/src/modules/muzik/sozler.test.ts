/**
 * StreamAxT — şarkı sözü yardımcıları testleri
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import { baslikTemizle, etkinSatir, lrcAyikla } from './sozler.js';

describe('lrcAyikla', () => {
  it('zamanlı satırlar, çoklu zaman, boş satır', () => {
    const l = lrcAyikla('[ar:x]\n[00:01.50]Bir\n[00:05.00][00:20.00]Nakarat\n[00:10.00]\nsaçma');
    expect(l).toEqual([
      { time: 1.5, text: 'Bir' },
      { time: 5, text: 'Nakarat' },
      { time: 20, text: 'Nakarat' }
    ]);
  });
});

describe('etkinSatir', () => {
  const l = [{ time: 2, text: 'a' }, { time: 5, text: 'b' }, { time: 9, text: 'c' }];
  it('ilerlemeye göre satır', () => {
    expect(etkinSatir(l, 0)).toBe(-1);
    expect(etkinSatir(l, 2)).toBe(0);
    expect(etkinSatir(l, 7.9)).toBe(1);
    expect(etkinSatir(l, 100)).toBe(2);
  });
});

describe('baslikTemizle', () => {
  it('gürültüyü atar', () => {
    expect(baslikTemizle('Teoman - Paramparça (Official Video)')).toBe('Teoman - Paramparça');
    expect(baslikTemizle('Song [MV] feat. Biri')).toBe('Song');
    expect(baslikTemizle('Şarkı (Remastered 2011)')).toBe('Şarkı');
  });
});
