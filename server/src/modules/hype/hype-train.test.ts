import { describe, it, expect, afterEach } from 'vitest';
import { hypeTreni } from './hype-train.js';

describe('hypeTreni.olay — test uyarıları', () => {
  afterEach(() => hypeTreni.sifirla());

  it('isTest olayı gerçek treni değiştirmez', () => {
    hypeTreni.sifirla();
    expect(hypeTreni.olay('tip', { username: 'a', amount: 500, isTest: true })).toBe(0);
    expect(hypeTreni.durum()).toMatchObject({ aktif: false, seviye: 1, puan: 0 });
  });

  it('gerçek olay treni başlatır', () => {
    hypeTreni.sifirla();
    expect(hypeTreni.olay('tip', { username: 'a', amount: 500 })).toBeGreaterThan(0);
    expect(hypeTreni.durum().aktif).toBe(true);
  });
});
