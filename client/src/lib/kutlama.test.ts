import { describe, expect, it, vi } from 'vitest';

vi.mock('canvas-confetti', () => ({ default: Object.assign(vi.fn(), { shapeFromText: vi.fn() }) }));

import { KUTLAMA_SECENEKLERI, kutlamaPlani, olayKutlamasi } from './kutlama';

describe('kutlama planı', () => {
  it('konfeti tek atış, ekranın tam ortasından ve her yöne', () => {
    const p = kutlamaPlani('konfeti');
    expect(p).toHaveLength(1);
    expect(p[0].secenek.origin).toEqual({ x: 0.5, y: 0.5 });
    expect(p[0].secenek.spread).toBe(360);
  });

  it('havai fişek art arda birkaç patlamadır, ilki ve sonuncusu ortada', () => {
    const p = kutlamaPlani('havaiFisek');
    expect(p.length).toBeGreaterThan(3);
    expect(p[0].secenek.origin).toEqual({ x: 0.5, y: 0.5 });
    expect(p.at(-1)!.secenek.origin).toEqual({ x: 0.5, y: 0.5 });
    expect(p.at(-1)!.gecikmeMs).toBeGreaterThan(p[0].gecikmeMs);
  });

  it('her seçenek en az bir atış üretir, bilinmeyen tür konfetiye düşer', () => {
    for (const s of KUTLAMA_SECENEKLERI) expect(kutlamaPlani(s.value).length).toBeGreaterThan(0);
    expect(kutlamaPlani('yok-boyle-bir-sey')).toEqual(kutlamaPlani('konfeti'));
  });

  it('rastgele, sabit türlerden birini seçer', () => {
    expect(kutlamaPlani('rastgele', 1, () => 0)).toEqual(kutlamaPlani('konfeti'));
    expect(kutlamaPlani('rastgele', 1, () => 0.999)).toEqual(kutlamaPlani('yagmur'));
  });

  it('güç parçacık sayısını ölçekler', () => {
    const tam = kutlamaPlani('konfeti', 1)[0].secenek.particleCount!;
    const yari = kutlamaPlani('konfeti', 0.5)[0].secenek.particleCount!;
    expect(yari).toBeLessThan(tam);
  });

  it('takip küçük konfeti, 100 ve üstü bağış havai fişek', () => {
    expect(olayKutlamasi('follow', 0, 'havaiFisek')).toEqual({ tur: 'konfeti', guc: 0.55 });
    expect(olayKutlamasi('tip', 100, 'konfeti')).toEqual({ tur: 'havaiFisek', guc: 1 });
    expect(olayKutlamasi('tip', 50, 'yildiz')).toEqual({ tur: 'yildiz', guc: 1 });
  });
});
