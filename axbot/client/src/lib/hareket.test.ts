import { afterEach, describe, expect, it, vi } from 'vitest';

const confetti = vi.hoisted(() => Object.assign(vi.fn(), { shapeFromText: vi.fn() }));
vi.mock('canvas-confetti', () => ({ default: confetti }));

import { hareketAz } from './hareket';
import { kutla } from './kutlama';
import { sarsintiStili } from '../widgets/EkranEfekti';
import { tavanla } from '../hooks/useWidgetCalismasi';

describe('hareketi azalt (?hareket=az)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    confetti.mockClear();
  });

  it('yalnız adres anahtarıyla açılır', () => {
    expect(hareketAz('?hareket=az&obs=1')).toBe(true);
    expect(hareketAz('?obs=1')).toBe(false);
    expect(hareketAz('?hareket=tam')).toBe(false);
  });

  it('konfeti ve sarsıntı kapanır', () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', { location: { search: '?hareket=az' } });
    kutla('konfeti');
    vi.runAllTimers();
    expect(confetti).not.toHaveBeenCalled();
    expect(sarsintiStili(1)).toEqual({});

    vi.stubGlobal('window', { location: { search: '' } });
    kutla('konfeti');
    vi.runAllTimers();
    expect(confetti).toHaveBeenCalled();
    expect(sarsintiStili(1).animation).toContain('axt-ef-sars');
    vi.useRealTimers();
  });
});

describe('tavanla', () => {
  it('son öğeleri tutar', () => {
    expect(tavanla([1, 2, 3, 4], 2)).toEqual([3, 4]);
    const kisa = [1];
    expect(tavanla(kisa, 5)).toBe(kisa);
  });
});
