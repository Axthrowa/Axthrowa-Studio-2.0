import { describe, expect, it } from 'vitest';
import { sayacDurumu } from './ViewerCounterWidget.js';

// H2: test örneği bitince eski kapanıştaki sayılar geri yazılıyor, o arada gelen gerçek sayı kayboluyordu
describe('izleyici sayacı test örneği', () => {
  it('test sırasında gelen gerçek sayı test bitince ekranda kalır', () => {
    const d = sayacDurumu({ kick: 10, twitch: 0, youtube: 0 });
    expect(d.test({ kick: 999 }, 0)).toEqual({ kick: 999, twitch: 0, youtube: 0 });
    expect(d.gercek({ kick: 25, twitch: 4 }, 3000)).toBeNull(); // ekran testte kalır
    expect(d.bitti(7999)).toBeNull();
    expect(d.bitti(8000)).toEqual({ kick: 25, twitch: 4, youtube: 0 });
  });
  it('ikinci test süreyi uzatır; ilk zamanlayıcı erken geri almaz', () => {
    const d = sayacDurumu({ kick: 1, twitch: 1, youtube: 1 });
    d.test({ kick: 5 }, 0);
    d.test({ kick: 6 }, 5000);
    expect(d.bitti(8000)).toBeNull();
    expect(d.bitti(13000)).toEqual({ kick: 1, twitch: 1, youtube: 1 });
  });
  it('test yokken gerçek sayı hemen gösterilir, eksik alan önceki değeri korur', () => {
    const d = sayacDurumu({ kick: 3, twitch: 2, youtube: 1 });
    expect(d.gercek({ twitch: '7' }, 0)).toEqual({ kick: 3, twitch: 7, youtube: 1 });
  });
});
