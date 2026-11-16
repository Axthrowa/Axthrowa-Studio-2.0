import { describe, it, expect } from 'vitest';
import {
  SLOT_UCLU_CARPAN,
  SLOT_IKILI_CARPAN,
  YARIS_TEK_KAZANMA,
  BOMBA_CARPANI,
  SOYGUN_HEDEFLERI,
  SOYGUN_EKIP_BONUSU,
  SOYGUN_EKIP_UST,
  KASA_DILIMLERI
} from './bahis.js';

// Ortalama geri dönüş (bahsin katı): 1'in üstü puan basar, çok altı oyunu anlamsız kılar
const dengeli = (geriDonus: number) => {
  expect(geriDonus).toBeGreaterThan(0.85);
  expect(geriDonus).toBeLessThanOrEqual(1);
};

describe('şans oyunu oranları dengeli', () => {
  it('slot: 5 simge, üçlü 1/25, ikili 12/25', () => {
    dengeli((1 / 25) * SLOT_UCLU_CARPAN + (12 / 25) * SLOT_IKILI_CARPAN);
  });

  it('tek kişilik yarış ve bomba', () => {
    dengeli(YARIS_TEK_KAZANMA * 2);
    dengeli(BOMBA_CARPANI / 3);
  });

  it('soygun: her hedef, tek kişi ve en kalabalık ekip', () => {
    for (const h of SOYGUN_HEDEFLERI) {
      for (const kisi of [1, SOYGUN_EKIP_UST]) {
        dengeli((h.baseSuccess + kisi * SOYGUN_EKIP_BONUSU) * (1 + h.multiplier));
      }
    }
  });

  it('kasa açma: varsayılan ikramiye 10 kat', () => {
    const { siradan, nadir, epik } = KASA_DILIMLERI;
    const p = [siradan[0], nadir[0] - siradan[0], epik[0] - nadir[0], 100 - epik[0]].map((x) => x / 100);
    dengeli(p[0] * siradan[1] + p[1] * nadir[1] + p[2] * epik[1] + p[3] * 10);
  });
});
