import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PANEL_TEMALARI, VARSAYILAN_TEMA, temaKimligi } from './panelTemalari';

const CSS = readFileSync(new URL('../panel-temalari.css', import.meta.url), 'utf8');

function blok(secici: string): Record<string, string> {
  const bas = CSS.indexOf(`${secici} {`);
  if (bas < 0) return {};
  const govde = CSS.slice(bas, CSS.indexOf('\n}', bas));
  return Object.fromEntries([...govde.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}
const temaBlogu = (id: string) => blok(`.axt-panel[data-panel-tema="${id}"]`);

// WCAG göreli parlaklık: #rgb/#rrggbb ve oklch(L% C H)
function rgb(renk: string): number[] {
  if (renk.startsWith('#')) {
    const h = renk.length === 4 ? [...renk.slice(1)].map((c) => c + c).join('') : renk.slice(1);
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  }
  const [L, C, H] = renk.match(/oklch\(([\d.]+)% ([\d.]+) ([\d.]+)\)/)!.slice(1).map(Number);
  const l0 = L / 100, a = C * Math.cos((H * Math.PI) / 180), b = C * Math.sin((H * Math.PI) / 180);
  const l = (l0 + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (l0 - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (l0 - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]
    .map((x) => Math.min(1, Math.max(0, x)))
    .map((x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055));
}
function kontrast(a: string, b: string): number {
  const y = (r: string) => { const [R, G, B] = rgb(r).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * R + 0.7152 * G + 0.0722 * B; };
  const [p, q] = [y(a), y(b)].sort((x, z) => z - x);
  return (p + 0.05) / (q + 0.05);
}

const GEREKLI = ['--axt-zemin', '--axt-yuzey', '--axt-yuzey-2', '--axt-odak', '--axt-doku', '--axt-golge', '--axt-yaricap-kart', '--axt-yaricap-dugme',
  '--color-gray-200', '--color-gray-300', '--color-gray-400', '--color-gray-500', '--color-slate-900', '--color-zinc-500',
  '--color-purple-300', '--color-purple-400', '--color-purple-500', '--color-purple-600', '--color-indigo-600', '--color-violet-500'];
// Panelde düz metin olarak en çok geçen tonlar
const METINLER = ['--color-gray-200', '--color-gray-300', '--color-gray-400', '--color-gray-500', '--color-zinc-400', '--color-purple-300', '--color-purple-400'];

describe('panel temaları', () => {
  it('bilinmeyen ya da boş kimlik varsayılana düşer', () => {
    expect(temaKimligi('yokboyle')).toBe(VARSAYILAN_TEMA);
    expect(temaKimligi(null)).toBe(VARSAYILAN_TEMA);
    expect(temaKimligi(42)).toBe(VARSAYILAN_TEMA);
    expect(temaKimligi('orman')).toBe('orman');
  });

  it('kimlikler eşsiz, en az 6 tema var, varsayılanın CSS bloğu yok', () => {
    expect(new Set(PANEL_TEMALARI.map((t) => t.id)).size).toBe(PANEL_TEMALARI.length);
    expect(PANEL_TEMALARI.length).toBeGreaterThanOrEqual(6);
    expect(temaBlogu(VARSAYILAN_TEMA)).toEqual({});
  });

  it.each(PANEL_TEMALARI.filter((t) => t.id !== VARSAYILAN_TEMA))('$id gerekli değişkenleri tanımlar ve önizlemesi CSS ile aynı', (t) => {
    const v = temaBlogu(t.id);
    for (const ad of GEREKLI) expect(v[ad], `${t.id} ${ad}`).toBeTruthy();
    expect(v['--axt-zemin']).toBe(t.onizleme.zemin);
    expect(v['--axt-yuzey']).toBe(t.onizleme.yuzey);
  });

  it.each(PANEL_TEMALARI.filter((t) => t.id !== VARSAYILAN_TEMA))('$id metinleri yüzeylerde WCAG AA (4.5:1) sağlar', (t) => {
    const v = temaBlogu(t.id);
    const beyaz = v['--color-white'] ?? '#fff';
    for (const zemin of [v['--axt-zemin'], v['--axt-yuzey'], v['--axt-yuzey-2']]) {
      expect(kontrast(beyaz, zemin), `${t.id} beyaz/${zemin}`).toBeGreaterThanOrEqual(4.5);
      for (const ad of METINLER) expect(kontrast(v[ad], zemin), `${t.id} ${ad}/${zemin}`).toBeGreaterThanOrEqual(4.5);
    }
    // Dolgu düğme: beyaz yazı (açık temada yerel olarak #fff) mor dolgu üstünde
    expect(kontrast('#fff', v['--color-purple-600']), `${t.id} düğme`).toBeGreaterThanOrEqual(4.5);
  });

  it('temaların değiştirdiği her renk değişkeni önizleme tuvalinde varsayılana döner', () => {
    const geri = blok('.axt-panel .axt-onizleme');
    for (const t of PANEL_TEMALARI) {
      for (const ad of Object.keys(temaBlogu(t.id)).filter((a) => a.startsWith('--color-'))) expect(geri[ad], `${t.id} ${ad}`).toBeTruthy();
    }
    expect(geri['--color-gray-500']).toBe('oklch(55.1% 0.027 264.364)');
    expect(geri['--color-white']).toBe('#fff');
  });
});
