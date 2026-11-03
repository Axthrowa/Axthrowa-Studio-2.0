/**
 * AxBoT — uyarı varyantı seçim testleri
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import { varyantSec, VARSAYILAN_VARYANT, type UyariVaryanti } from './variant-select.js';

const V = (ek: Partial<UyariVaryanti>): UyariVaryanti =>
  ({ ...VARSAYILAN_VARYANT, id: ek.ad || 'v', eventType: 'tip', ...ek } as UyariVaryanti);

describe('varyantSec — eşik önceliği', () => {
  it('varyant yoksa null döner (preset kullanılır)', () => {
    expect(varyantSec([], 100)).toBeNull();
  });

  it('eşiği tutmayan varyant seçilmez', () => {
    const v = [V({ ad: 'buyuk', minDeger: 500 })];
    expect(varyantSec(v, 100)).toBeNull();
    expect(varyantSec(v, 500)?.ad).toBe('buyuk');
  });

  it('EN YÜKSEK eşiği tutan kazanır', () => {
    // 1000₺ bağış "0+" varyantına düşmemeli
    const v = [
      V({ ad: 'kucuk', minDeger: 0 }),
      V({ ad: 'orta', minDeger: 100 }),
      V({ ad: 'buyuk', minDeger: 500 })
    ];
    expect(varyantSec(v, 50)?.ad).toBe('kucuk');
    expect(varyantSec(v, 150)?.ad).toBe('orta');
    expect(varyantSec(v, 1000)?.ad).toBe('buyuk');
  });

  it('tam eşikte o kademe seçilir', () => {
    const v = [V({ ad: 'kucuk', minDeger: 0 }), V({ ad: 'orta', minDeger: 100 })];
    expect(varyantSec(v, 100)?.ad).toBe('orta');
    expect(varyantSec(v, 99)?.ad).toBe('kucuk');
  });

  it('pasif varyant hiç seçilmez', () => {
    const v = [V({ ad: 'kapali', minDeger: 500, aktif: false }), V({ ad: 'acik', minDeger: 0 })];
    expect(varyantSec(v, 1000)?.ad).toBe('acik');
  });

  it('hepsi pasifse null', () => {
    expect(varyantSec([V({ ad: 'a', aktif: false })], 10)).toBeNull();
  });
});

describe('varyantSec — ağırlıklı seçim', () => {
  it('aynı eşikte ağırlığa göre seçer', () => {
    const v = [
      V({ ad: 'nadir', minDeger: 0, agirlik: 1 }),
      V({ ad: 'sik', minDeger: 0, agirlik: 9 })
    ];
    // rastgele=0.95 -> toplam 10, 9.5 kalan: 'nadir'(1) düşülür 8.5>0,
    // 'sik'(9) düşülür -0.5<=0 -> 'sik'
    expect(varyantSec(v, 0, () => 0.95)?.ad).toBe('sik');
    // rastgele=0.05 -> 0.5 kalan, 'nadir' düşülünce -0.5 -> 'nadir'
    expect(varyantSec(v, 0, () => 0.05)?.ad).toBe('nadir');
  });

  it('tek aday varsa doğrudan onu verir', () => {
    expect(varyantSec([V({ ad: 'tek' })], 0, () => 0.99)?.ad).toBe('tek');
  });

  it('ağırlıklar sıfırsa yine bir tane seçer', () => {
    const v = [V({ ad: 'a', agirlik: 0 }), V({ ad: 'b', agirlik: 0 })];
    expect(varyantSec(v, 0, () => 0.5)).not.toBeNull();
  });

  it('dağılım ağırlıkla orantılı', () => {
    const v = [V({ ad: 'a', agirlik: 1 }), V({ ad: 'b', agirlik: 3 })];
    let a = 0;
    for (let i = 0; i < 1000; i++) {
      if (varyantSec(v, 0, () => i / 1000)?.ad === 'a') a++;
    }
    // ~%25 beklenir
    expect(a).toBeGreaterThan(200);
    expect(a).toBeLessThan(300);
  });
});

describe('varyantSec — bozuk veri', () => {
  it('negatif değer sıfır sayılır', () => {
    expect(varyantSec([V({ ad: 'a', minDeger: 0 })], -50)?.ad).toBe('a');
  });

  it('sayı olmayan değerde çökmez', () => {
    expect(varyantSec([V({ ad: 'a', minDeger: 0 })], NaN)?.ad).toBe('a');
  });

  it('eşiği bozuk varyantı 0 sayar', () => {
    const v = [V({ ad: 'a', minDeger: NaN as any })];
    expect(varyantSec(v, 10)?.ad).toBe('a');
  });
});
