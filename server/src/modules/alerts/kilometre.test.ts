import { describe, expect, it } from 'vitest';
import { OturumSayaci, kilometreMetni } from './kilometre';

describe('oturum kilometre taşları', () => {
  it('onuncu takipte bir kez eşik verir', () => {
    const s = new OturumSayaci();
    const sonuc = Array.from({ length: 11 }, () => s.ekle('follow', 1));
    expect(sonuc.slice(0, 9).every((x) => x.length === 0)).toBe(true);
    expect(sonuc[9]).toEqual([10]);
    expect(sonuc[10]).toEqual([]);
  });

  it('tek seferde birden çok eşik geçilebilir (hediye abone, büyük Kicks); türler ayrı sayılır', () => {
    const s = new OturumSayaci();
    expect(s.ekle('sub', 30)).toEqual([10, 25]);
    expect(s.ekle('kicks', 600)).toEqual([100, 500]);
    expect(s.ekle('follow', 0)).toEqual([]);
  });

  it('sıfırlanınca baştan sayar', () => {
    const s = new OturumSayaci();
    s.ekle('follow', 10);
    s.sifirla();
    expect(s.ekle('follow', 10)).toEqual([10]);
  });

  it('metin', () => {
    expect(kilometreMetni('follow', 10, 'Ali')).toBe('Bu yayının 10. takipçi: Ali!');
    expect(kilometreMetni('kicks', 500, 'Ali')).toContain('500 Kicks');
  });
});
