/**
 * StreamAxT — Hype Treni hesapları (B3)
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import { HYPE_VARSAYILAN, olayPuani, seviyeHedefi, seviyeIlerlet } from './hype-math.js';

describe('seviyeHedefi', () => {
  it('kademeli büyür', () => {
    expect(seviyeHedefi(1, 500, 1.5)).toBe(500);
    expect(seviyeHedefi(2, 500, 1.5)).toBe(750);
    expect(seviyeHedefi(3, 500, 1.5)).toBe(1125);
  });
});

describe('olayPuani', () => {
  const a = HYPE_VARSAYILAN;
  it('abone / hediye (adetli) / bağış (tutarlı) / KICKs / takip', () => {
    expect(olayPuani('sub', {}, a)).toBe(100);
    expect(olayPuani('gift_sub', { count: 5 }, a)).toBe(500);
    expect(olayPuani('tip', { amount: 25 }, a)).toBe(250);
    expect(olayPuani('kicks', { amount: 40 }, a)).toBe(40);
    // Takip varsayılan olarak treni beslemez (yalnız abone/hediye/bağış/KICKs)
    expect(olayPuani('follow', {}, a)).toBe(0);
    expect(olayPuani('follow', {}, { ...a, fromFollow: true })).toBe(5);
  });
  it('panelde seçilmeyen olay treni beslemez', () => {
    expect(olayPuani('sub', {}, { ...a, fromSub: false })).toBe(0);
    expect(olayPuani('gift_sub', { count: 3 }, { ...a, fromGift: false })).toBe(0);
    expect(olayPuani('tip', { amount: 10 }, { ...a, fromTip: false })).toBe(0);
    expect(olayPuani('kicks', { amount: 10 }, { ...a, fromKicks: false })).toBe(0);
  });
  it('bilinmeyen olay puan vermez', () => {
    expect(olayPuani('raid', { viewers: 100 }, a)).toBe(0);
  });
});

describe('seviyeIlerlet', () => {
  it('hedef aşılınca seviye atlar, artan puan devreder', () => {
    const r = seviyeIlerlet(1, 450, 100, HYPE_VARSAYILAN);
    expect(r).toEqual({ seviye: 2, puan: 50, atladi: true });
  });
  it('tek seferde birden çok seviye atlanabilir', () => {
    const r = seviyeIlerlet(1, 0, 500 + 750 + 10, HYPE_VARSAYILAN);
    expect(r.seviye).toBe(3);
    expect(r.puan).toBe(10);
  });
  it('en üst seviyede puan hedefi aşmaz', () => {
    const r = seviyeIlerlet(10, 0, 10_000_000, HYPE_VARSAYILAN);
    expect(r.seviye).toBe(10);
    expect(r.puan).toBe(seviyeHedefi(10, 500, 1.5));
  });
});
