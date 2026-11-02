import { describe, expect, it } from 'vitest';
import { TEK_SEFERDE_EN_COK, takipciArtisi, type TakipciIzi } from './kick-takipci.js';

describe('takipciArtisi', () => {
  it('ilk okuma başlangıçtır, eski takipçiler sayılmaz', () => {
    const iz: TakipciIzi = { enYuksek: null };
    expect(takipciArtisi(iz, 500)).toBe(0);
    expect(takipciArtisi(iz, 502)).toBe(2);
  });

  it('bırakıp yeniden takip etmek uyarı tekrarlatmaz', () => {
    const iz: TakipciIzi = { enYuksek: 100 };
    expect(takipciArtisi(iz, 99)).toBe(0);
    expect(takipciArtisi(iz, 100)).toBe(0);
    expect(takipciArtisi(iz, 101)).toBe(1);
  });

  it('büyük sıçrama sınırlanır, geçersiz sayı yok sayılır', () => {
    const iz: TakipciIzi = { enYuksek: 100 };
    expect(takipciArtisi(iz, 'yok')).toBe(0);
    expect(takipciArtisi(iz, 0)).toBe(0);
    expect(takipciArtisi(iz, 1000)).toBe(TEK_SEFERDE_EN_COK);
    expect(iz.enYuksek).toBe(1000);
  });
});
