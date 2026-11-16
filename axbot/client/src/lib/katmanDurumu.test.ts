import { describe, expect, it } from 'vitest';
import { katmanAdi } from './widget-style';
import { kopanKatmanlar } from './durumOzeti';

describe('katman adı ve kopanlar', () => {
  it('yalnız widget sayfaları katman sayılır', () => {
    expect(katmanAdi('/widgets/alertbox')).toBe('alertbox');
    expect(katmanAdi('/widgets/donation-goal/')).toBe('donation-goal');
    expect(katmanAdi('/')).toBe('');
    expect(katmanAdi('/widgets/a/b')).toBe('');
  });

  it('şu an bağlı olmayan ve kopmuş olanları verir', () => {
    const l = [
      { katman: 'a', bagli: 1, obs: 1, sonBaglanti: 1, sonKopma: 9 },
      { katman: 'b', bagli: 0, obs: 0, sonBaglanti: 1, sonKopma: 9 },
      { katman: 'c', bagli: 0, obs: 0, sonBaglanti: 1, sonKopma: 0 }
    ];
    expect(kopanKatmanlar(l).map((k) => k.katman)).toEqual(['b']);
    expect(kopanKatmanlar(undefined)).toEqual([]);
  });
});
