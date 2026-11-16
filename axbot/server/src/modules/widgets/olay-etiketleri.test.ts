/**
 * AxBoT — Olay Etiketleri verisi testleri
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import { etiketleriCikar } from './olay-etiketleri.js';

const s = (event_type: string, display_name: string, amount: number | null = null, metadata: string | null = null) => ({
  event_type, username: display_name.toLowerCase(), display_name, amount, currency: 'TL', metadata, timestamp: 0
});

describe('etiketleriCikar', () => {
  it('her türün en yenisi; en büyük bağış ayrı', () => {
    const v = etiketleriCikar([
      s('follow', 'Yeni'),
      s('tip', 'Ali', 50),
      s('follow', 'Eski'),
      s('tip', 'Veli', 200),
      s('sub', 'Ayşe'),
      s('raid', 'Kanal', null, JSON.stringify({ viewers: 42 })),
      s('kicks', 'K', 100)
    ]);
    expect(v.sonTakip).toBe('Yeni');
    expect(v.sonBagis).toEqual({ ad: 'Ali', tutar: 50, birim: 'TL' });
    expect(v.enBuyukBagis).toEqual({ ad: 'Veli', tutar: 200, birim: 'TL' });
    expect(v.sonAbone).toBe('Ayşe');
    expect(v.sonRaid).toEqual({ ad: 'Kanal', izleyici: 42 });
    expect(v.sonKicks).toEqual({ ad: 'K', tutar: 100 });
  });
  it('en büyük bağış farklı para birimlerini karıştırmaz', () => {
    const v = etiketleriCikar([
      s('tip', 'Ali', 100),
      { ...s('tip', 'Yabanci', 500), currency: 'USD' },
      s('tip', 'Veli', 80)
    ]);
    expect(v.enBuyukBagis).toEqual({ ad: 'Ali', tutar: 100, birim: 'TL' });
  });

  it('test uyarıları ve bozuk metadata', () => {
    const v = etiketleriCikar([s('follow', 'Test', null, JSON.stringify({ isTest: true })), s('follow', 'Gercek', null, '{bozuk')]);
    expect(v.sonTakip).toBe('Gercek');
    expect(etiketleriCikar([]).sonBagis).toBeNull();
  });
});
