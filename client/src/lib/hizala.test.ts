import { describe, expect, it } from 'vitest';
import { enBuyukBoyut, hizala, olcekSinirla, sinirla, yapistir } from './hizala';

const sohbet = { x: 40, y: 430, width: 420, height: 610, scale: 0.8 };

describe('olcekSinirla', () => {
  it('görünen kutu tuvalden taşmaz, küçülme alt sınırda durur', () => {
    expect(olcekSinirla(1.5, { x: 0, y: 0, width: 400, height: 200 })).toBe(1.5);
    expect(olcekSinirla(9, { x: 1000, y: 0, width: 460, height: 100 })).toBe(2);
    expect(olcekSinirla(0.01, { x: 0, y: 0, width: 400, height: 200 })).toBe(0.25);
  });
});

describe('hizala', () => {
  it('ölçekli sohbet ekranın en altına iner (eskiden 122 px yukarıda kalıyordu)', () => {
    // görünen yükseklik 610 × 0.8 = 488 → en alt y = 1080 − 488 = 592
    expect(sinirla(40, 5000, sohbet)).toEqual({ x: 40, y: 592 });
    expect(hizala(sohbet, 'alt')).toEqual({ y: 592 });
    expect(hizala(sohbet, 'sag')).toEqual({ x: 1920 - 336 });
  });

  it('ölçek 1’den büyükse tuvalden taşmaz', () => {
    expect(sinirla(5000, 5000, { x: 0, y: 0, width: 400, height: 200, scale: 2 })).toEqual({ x: 1120, y: 680 });
    expect(enBuyukBoyut({ x: 1000, y: 580, width: 100, height: 100, scale: 2 })).toEqual({ width: 460, height: 250 });
  });

  it('ortalama görünen boyuta göre', () => {
    expect(hizala({ x: 0, y: 0, width: 600, height: 200, scale: 0.5 }, 'yatayOrta')).toEqual({ x: 810 });
    expect(hizala({ x: 0, y: 0, width: 600, height: 200 }, 'dikeyOrta')).toEqual({ y: 440 });
  });

  it('kenara ve diğer katmana yapışır, kılavuz verir', () => {
    const k = { x: 0, y: 0, width: 200, height: 100 };
    // tuval ortasına 6 px yakın → orta çizgiye yapışır
    const a = yapistir(866, 300, k, []);
    expect(a.x).toBe(860);
    expect(a.kilavuz.dikey).toEqual([960]);
    // diğer katmanın sağ kenarına (x=500) sol kenar 7 px uzakta
    const b = yapistir(507, 300, k, [{ x: 100, y: 600, width: 400, height: 50 }]);
    expect(b.x).toBe(500);
    // eşikten uzaksa dokunmaz
    const c = yapistir(700, 300, k, []);
    expect(c).toEqual({ x: 700, y: 300, kilavuz: { dikey: [], yatay: [] } });
  });
});
