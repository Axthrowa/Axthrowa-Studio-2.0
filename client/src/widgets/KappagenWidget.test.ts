import { describe, expect, it } from 'vitest';
import { ucusRotasi } from './KappagenWidget.js';

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
