/**
 * AxBoT — Bağış Kupası kuralları testleri
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import { dusenAdet, kupaAyari } from './kupa.js';

describe('Bağış Kupası', () => {
  const varsayilan = kupaAyari({});
  it('varsayılan: bağış, abone, hediye, KICKs düşer; takip düşmez', () => {
    expect(dusenAdet('tip', { amount: 5 }, varsayilan)).toBe(1);
    expect(dusenAdet('sub', {}, varsayilan)).toBe(1);
    expect(dusenAdet('kicks', { amount: 100 }, varsayilan)).toBe(1);
    expect(dusenAdet('follow', {}, varsayilan)).toBe(0);
  });
  it('hediye abonelik adet kadar (en çok 20)', () => {
    expect(dusenAdet('gift_sub', { count: 5 }, varsayilan)).toBe(5);
    expect(dusenAdet('gift_sub', { count: 500 }, varsayilan)).toBe(20);
    expect(dusenAdet('gift_sub', {}, varsayilan)).toBe(1);
  });
  it('panelde kapatılan olay ve eşik altı düşmez', () => {
    const a = kupaAyari({ fromSub: false, minTipAmount: 10, minKicks: '50' });
    expect(dusenAdet('sub', {}, a)).toBe(0);
    expect(dusenAdet('tip', { amount: 9.99 }, a)).toBe(0);
    expect(dusenAdet('tip', { amount: 10 }, a)).toBe(1);
    expect(dusenAdet('kicks', { amount: 49 }, a)).toBe(0);
  });
  it('kapasite sınırlı', () => {
    expect(kupaAyari({ maxItems: 99999 }).maxItems).toBe(300);
    expect(kupaAyari({ maxItems: 1 }).maxItems).toBe(5);
  });
});
