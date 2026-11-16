import { describe, expect, it, vi } from 'vitest';

vi.mock('canvas-confetti', () => ({ default: Object.assign(vi.fn(), { shapeFromText: vi.fn() }) }));

import { EKRAN_EFEKTLERI, KUTLAMA_SECENEKLERI, kutlamaPlani, olayEfekti } from './kutlama';

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

  it('her konfeti seçeneği en az bir atış üretir, ekran efektleri hiç; bilinmeyen tür konfetiye düşer', () => {
    for (const s of KUTLAMA_SECENEKLERI) expect(kutlamaPlani(s.value).length > 0).toBe(!EKRAN_EFEKTLERI.includes(s.value));
    expect(kutlamaPlani('yok-boyle-bir-sey')).toEqual(kutlamaPlani('konfeti'));
  });

  it('rastgele, sabit türlerden birini seçer', () => {
    expect(kutlamaPlani('rastgele', 1, () => 0)).toEqual(kutlamaPlani('konfeti'));
    expect(kutlamaPlani('rastgele', 1, () => 0.999)).toEqual(kutlamaPlani('emoji'));
    for (let i = 0; i < 20; i++) expect(kutlamaPlani('rastgele', 1, () => i / 20).length).toBeGreaterThan(0);
  });

  it('güç parçacık sayısını ölçekler', () => {
    const tam = kutlamaPlani('konfeti', 1)[0].secenek.particleCount!;
    const yari = kutlamaPlani('konfeti', 0.5)[0].secenek.particleCount!;
    expect(yari).toBeLessThan(tam);
  });

  it('varsayılan: takip küçük konfeti, 100 ve üstü bağış havai fişek, gerisi genel efekt', () => {
    expect(olayEfekti('follow', 0, { celebration: 'havaiFisek' })).toEqual({ tur: 'konfeti', guc: 0.55 });
    expect(olayEfekti('tip', 100, { celebration: 'konfeti' })).toEqual({ tur: 'havaiFisek', guc: 1 });
    expect(olayEfekti('tip', 50, { celebration: 'yildiz' })).toEqual({ tur: 'yildiz', guc: 1 });
    expect(olayEfekti('chat', 0, {})).toBeNull();
  });

  it('olay başına efekt ve güç ayardan; "yok" efekti kapatır, güç sınırlanır', () => {
    const ayar = { efektTakip: 'emoji', gucTakip: '1.5', efektBuyukBagis: 'sarsinti', gucBuyukBagis: '9', efektRaid: 'yok' };
    expect(olayEfekti('follow', 0, ayar)).toEqual({ tur: 'emoji', guc: 1.5 });
    expect(olayEfekti('kicks', 250, ayar)).toEqual({ tur: 'sarsinti', guc: 1.5 });
    expect(olayEfekti('host', 0, ayar)).toBeNull();
    // TikTok hediyesi tutarı jeton: büyük bağış basamağına girmez
    expect(olayEfekti('gift_tiktok', 500, ayar)).toEqual({ tur: 'konfeti', guc: 1 });
  });
});
