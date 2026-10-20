/**
 * StreamAxT — gözcü kararı testleri
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import { gozcuKarari, ZATEN_CALISIYOR_KODU } from './gozcu-karar.js';

const DK = 60_000;

describe('gozcuKarari', () => {
  it('normal kapanış ve "zaten çalışıyor" yeniden başlatılmaz', () => {
    expect(gozcuKarari(0, null, [], 0)).toEqual({ tur: 'cik', kod: 0 });
    expect(gozcuKarari(ZATEN_CALISIYOR_KODU, null, [], 0).tur).toBe('cik');
  });

  it('çökme yeniden başlatılır, bekleme artar ve 30 sn ile sınırlı', () => {
    expect(gozcuKarari(1, null, [], 0)).toEqual({ tur: 'yeniden', beklemeMs: 3000 });
    const iki = [{ zaman: 0, kod: 1 }, { zaman: 1000, kod: 1 }];
    expect(gozcuKarari(1, null, iki, 2000)).toEqual({ tur: 'yeniden', beklemeMs: 12_000 });
    const yedi = Array.from({ length: 7 }, (_, i) => ({ zaman: i, kod: 1 }));
    expect(gozcuKarari(null, 'SIGKILL', yedi, 10)).toEqual({ tur: 'yeniden', beklemeMs: 30_000 });
  });

  it('10 dk içinde çok çökme → vazgeçer; eski çökmeler sayılmaz', () => {
    const sekiz = Array.from({ length: 8 }, (_, i) => ({ zaman: i, kod: 1 }));
    expect(gozcuKarari(1, null, sekiz, 100).tur).toBe('cik');
    expect(gozcuKarari(1, null, sekiz, 11 * DK).tur).toBe('yeniden');
  });
});
