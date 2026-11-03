import { describe, expect, it } from 'vitest';
import { temalar, temayiUygula } from './themes';
import { KING_DEFAULTS } from './widget-defaults';

const GORUNUMLER = ['royal', 'minimal', 'glass', 'neon', 'plate', 'taht', 'altin', 'alev', 'buz', 'serit', 'kart'];

/** WCAG göreli parlaklık */
function parlaklik(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function karsitlik(a: string, b: string): number {
  const [x, y] = [parlaklik(a), parlaklik(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

describe('Tahtın Kralı temaları', () => {
  const uygula = (t: ReturnType<typeof temalar>[number]) =>
    temayiUygula(KING_DEFAULTS, t, Object.keys(KING_DEFAULTS), (k, v) => k !== 'theme' || GORUNUMLER.includes(String(v))) as typeof KING_DEFAULTS;

  it('her temada görünüm geçerli ve yazı zemininde okunur', () => {
    const hatali = temalar('king').flatMap((t) => {
      const s = uygula(t);
      const yazi = /^#[0-9a-f]{6}$/i.test(s.textColor) ? s.textColor : '#ffffff';
      const zemin = /^#[0-9a-f]{6}$/i.test(s.bgColor) ? s.bgColor : '#000000';
      return !GORUNUMLER.includes(s.theme) || (s.theme !== 'minimal' && Number(s.bgOpacity) >= 0.5 && karsitlik(yazi, zemin) < 3) ? [`${t.id}: ${s.theme} ${yazi}/${zemin}`] : [];
    });
    expect(hatali).toEqual([]);
  });
});
