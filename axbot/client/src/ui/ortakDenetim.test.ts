// UI-7: bot sayfaları ortak denetimleri kullanır — ham <select> ve elle glass-panel yok
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const kok = new URL('../', import.meta.url);
const tsxler = (alt: string) =>
  readdirSync(new URL(alt, kok), { recursive: true })
    .map(String)
    .filter((ad) => ad.endsWith('.tsx') && !ad.endsWith('.test.tsx'))
    .map((ad) => [`${alt}${ad.replace(/\\/g, '/')}`, readFileSync(new URL(alt + ad, kok), 'utf8')] as const);

describe('ortak denetimler', () => {
  for (const alt of ['pages/', 'components/']) {
    it(`${alt}: ham <select> yok (Secim kullanılır)`, () => {
      expect(tsxler(alt).length).toBeGreaterThan(10);
      expect(tsxler(alt).filter(([, s]) => /<select[\s>]/.test(s)).map(([ad]) => ad)).toEqual([]);
    });
    it(`${alt}: glass-panel yalnız Panel bileşeninden gelir`, () => {
      expect(tsxler(alt).filter(([, s]) => /(?<![\w-])glass-panel(?![\w-])/.test(s)).map(([ad]) => ad)).toEqual([]);
    });
  }
});
