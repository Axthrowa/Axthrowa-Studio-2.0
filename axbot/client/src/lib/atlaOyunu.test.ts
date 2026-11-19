import { describe, expect, it } from 'vitest';
import { ATLA_FIZIK_VARSAYILAN, ilerlet, inisPuani, hedefKonumu, turRuzgari, yeniAtlayan, carpistir, type Dunya } from './atlaOyunu.js';

const sabit = (dizi: number[]) => {
  let i = 0;
  return () => dizi[i++ % dizi.length];
};
const dunya = (o: Partial<Dunya> = {}): Dunya => ({ W: 1920, H: 1080, olcek: 1, zemin: 1000, hedefX: 960, ruzgar: 0, ...o });

describe('inisPuani', () => {
  it('ortada 100, kenarda 1, dışarıda 0', () => {
    expect(inisPuani(960, 960, 260)).toBe(100);
    expect(inisPuani(960 + 129.9, 960, 260)).toBe(1);
    expect(inisPuani(960 + 131, 960, 260)).toBe(0);
    expect(inisPuani(960 - 65, 960, 260)).toBe(50);
  });
});

describe('hedefKonumu', () => {
  it('ekrandan taşmaz ve önceki konumdan uzaklaşır', () => {
    for (let i = 0; i < 300; i++) {
      const x = hedefKonumu(1920, 260, 800);
      expect(x).toBeGreaterThanOrEqual(150);
      expect(x).toBeLessThanOrEqual(1770);
    }
    expect(Math.abs(hedefKonumu(1920, 260, 960, sabit([0.5, 0.9])) - 960)).toBeGreaterThanOrEqual(260);
  });
});

describe('fizik', () => {
  it('her karakter sonunda zemine iner ve ekran içinde kalır', () => {
    const d = dunya({ ruzgar: turRuzgari(3) });
    const liste = Array.from({ length: 20 }, (_, i) => yeniAtlayan(String(i), d, ATLA_FIZIK_VARSAYILAN));
    let artan = 0;
    for (let t = 0; t < 40 && liste.some((k) => !k.indi); t += 1 / 60) artan = ilerlet(liste, d, ATLA_FIZIK_VARSAYILAN, 1 / 60, artan);
    for (const k of liste) {
      expect(k.indi).toBe(true);
      expect(k.x).toBeGreaterThanOrEqual(36);
      expect(k.x).toBeLessThanOrEqual(1920 - 36);
      expect(k.puan).toBe(inisPuani(k.inisX, 960, ATLA_FIZIK_VARSAYILAN.hedefGenislik));
    }
  });

  it('kare hızından bağımsız: 30 ve 144 FPS aynı yere indirir', () => {
    const a = { ...ATLA_FIZIK_VARSAYILAN, carpisma: false };
    const in_ = (fps: number) => {
      const d = dunya({ ruzgar: 40 });
      const k = yeniAtlayan('x', d, a, sabit([0.3, 0.7, 0.2]));
      let artan = 0;
      for (let t = 0; t < 30 && !k.indi; t += 1 / fps) artan = ilerlet([k], d, a, 1 / fps, artan);
      return k.inisX;
    };
    expect(Math.abs(in_(30) - in_(144))).toBeLessThan(3);
  });

  it('paraşütle iniş birkaç saniye sürer (izlenebilir), ama sonsuza dek değil', () => {
    const d = dunya();
    const k = yeniAtlayan('x', d, ATLA_FIZIK_VARSAYILAN, sabit([0.5]));
    let artan = 0;
    while (!k.indi && k.t < 60) artan = ilerlet([k], d, ATLA_FIZIK_VARSAYILAN, 1 / 60, artan);
    expect(k.t).toBeGreaterThan(4);
    expect(k.t).toBeLessThan(15);
  });

  it('çarpışan iki karakter birbirinden ayrılır', () => {
    const d = dunya();
    const p = yeniAtlayan('a', d, ATLA_FIZIK_VARSAYILAN);
    const q = yeniAtlayan('b', d, ATLA_FIZIK_VARSAYILAN);
    Object.assign(p, { x: 500, y: 400, vx: 50, vy: 0 });
    Object.assign(q, { x: 520, y: 400, vx: -50, vy: 0 });
    carpistir([p, q], ATLA_FIZIK_VARSAYILAN, 1);
    // Merkezler arası en az 0,8 karakter boyu (paraşütler hafifçe üst üste binebilir)
    expect(q.x - p.x).toBeGreaterThanOrEqual((72 / 2) * 1.6 - 0.001);
    expect(p.vx).toBeLessThan(0);
    expect(q.vx).toBeGreaterThan(0);
  });
});
