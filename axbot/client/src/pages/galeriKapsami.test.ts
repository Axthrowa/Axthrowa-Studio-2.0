// WID-8: galerideki her widget'ın "Nasıl çalışır?" ipucu ve Test düğmesi olsun (olay testi ya da katman örneği)
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GALERI_KATMANI } from '../widgets/OverlayLayers.js';
import { WIDGET_IPUCLARI } from '../lib/widget-ipuclari.js';
import { testAdiBul } from './overlayStudioVerileri.js';

// Galeri listesi kancanın içinde (simge ve adres çalışma anında); kimlikler kaynaktan okunur
const galeri = [...readFileSync(new URL('./useOverlayStudioGaleri.tsx', import.meta.url), 'utf8').matchAll(/^\s+id: '([a-z0-9-]+)',$/gm)].map((m) => m[1]);

describe('widget galerisi kapsamı', () => {
  it('galeri okunur', () => expect(galeri.length).toBeGreaterThan(30));
  it.each(galeri)('%s: ipucu var', (id) => expect(WIDGET_IPUCLARI[id]?.length).toBeGreaterThan(0));
  it.each(galeri)('%s: Test düğmesi var', (id) => expect(testAdiBul(id)).toBeTruthy());
  it('katman örneği olan widget Tek URL katmanına bağlı', () => {
    for (const id of galeri) if (testAdiBul(id)?.startsWith('ornek-')) expect(GALERI_KATMANI[id]).toBeDefined();
  });
});
