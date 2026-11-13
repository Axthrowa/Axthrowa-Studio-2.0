import { describe, it, expect } from 'vitest';
import { sayacIlerlet } from './gunluk-sinir.js';

describe('B9 günlük yapay zekâ sınırı', () => {
  it('sınıra kadar izin verir, sonra durur; ertesi gün sıfırlanır', () => {
    let s = null as Parameters<typeof sayacIlerlet>[0];
    const izinler: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      const r = sayacIlerlet(s, 3, '2026-11-13');
      s = r.sayac;
      izinler.push(r.izin);
    }
    expect(izinler).toEqual([true, true, true, false]);
    expect(s).toEqual({ gun: '2026-11-13', sayi: 3 });
    expect(sayacIlerlet(s, 3, '2026-11-14')).toEqual({ sayac: { gun: '2026-11-14', sayi: 1 }, izin: true });
  });

  it('0 sınırsızdır', () => {
    expect(sayacIlerlet({ gun: '2026-11-13', sayi: 9999 }, 0, '2026-11-13').izin).toBe(true);
  });
});
