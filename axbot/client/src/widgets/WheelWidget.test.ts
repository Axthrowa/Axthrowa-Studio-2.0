import { describe, expect, it } from 'vitest';
import { donusFarki, egriNoktalari, ibredekiDilim, tikZamanlari } from './WheelWidget.js';

describe('tikZamanlari', () => {
  it('süre içinde kalır ve durmaya yaklaştıkça seyrekleşir', () => {
    const z = tikZamanlari(2160, 45, 4500);
    expect(z).toHaveLength(48);
    expect(z[z.length - 1]).toBeLessThan(4500);
    expect(z[1] - z[0]).toBeLessThan(z[z.length - 1] - z[z.length - 2]);
    expect(tikZamanlari(36000, 1, 4500)).toHaveLength(160);
  });
});

describe('çark duruşu', () => {
  it('tıklar dönüş eğrisini izler: başta sık, sonda seyrek ve süre içinde', () => {
    const z = tikZamanlari(2160, 45, 8000, 160, 'cubic-bezier(0.22, 0.12, 0.08, 1)');
    expect(z).toHaveLength(48);
    expect(z.every((t, i) => i === 0 || t > z[i - 1])).toBe(true);
    expect(z[z.length - 1]).toBeLessThan(8000);
    expect(z[z.length - 1] - z[z.length - 2]).toBeGreaterThan((z[1] - z[0]) * 5);
  });

  it('ibre hep seçilen dilimde durur, ama dilimin ortasına sabitlenmez', () => {
    for (const n of [2, 5, 8, 13]) {
      let aci = 37;
      const yerler = new Set<number>();
      for (let k = 0; k < 40; k++) {
        const hedef = k % n;
        const sapma = ((k * 7919) % 100) / 100 - 0.5;
        aci += donusFarki(aci, hedef, n, 6, sapma);
        expect(ibredekiDilim(aci, n)).toBe(hedef);
        yerler.add(Math.round(((360 - (aci % 360)) % 360) % (360 / n)));
      }
      expect(yerler.size).toBeGreaterThan(5);
    }
  });

  it('tanınmayan eğri varsayılana düşer', () => {
    expect(egriNoktalari('ease-out')).toEqual([0.22, 0.12, 0.08, 1]);
    expect(egriNoktalari('cubic-bezier(.17,.89,.32,1.05)')).toEqual([0.17, 0.89, 0.32, 1.05]);
  });
});
