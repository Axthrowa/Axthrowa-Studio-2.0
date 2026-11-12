/**
 * AxBoT — `{{...}}` uyum testleri
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import { ciftParantezCevir } from './cift-parantez-uyum.js';

describe('ciftParantezCevir', () => {
  it('düz yer tutucular', () => {
    expect(ciftParantezCevir('Selam {{sender.username}}!')).toBe('Selam $(user)!');
    expect(ciftParantezCevir('{{ stream.title }} · {{stream.viewers}} izleyici')).toBe('$(title) · $(viewers) izleyici');
    expect(ciftParantezCevir('{{taggedUser.username}} {{streamer.username}}')).toBe('$(touser) $(channel)');
  });

  it('profil alanları $(kick) olur', () => {
    expect(ciftParantezCevir('{{sender.instagram}}')).toBe('$(kick instagram $(user))');
    expect(ciftParantezCevir('{{taggedUser.url}}')).toBe('$(kick url $(touser))');
    expect(ciftParantezCevir('{{streamer.followers}}')).toBe('$(kick takipci $(channel))');
  });

  it('fonksiyonlar', () => {
    expect(ciftParantezCevir('{{randomRange(1,6)}}')).toBe('$(random 1 6)');
    expect(ciftParantezCevir('{{randomRange(10, 2)}}')).toBe('$(random 2 10)');
    expect(ciftParantezCevir('{{randomItem(“one”,”two”,”three”)}}')).toBe('$(pick one;two;three)');
    expect(ciftParantezCevir('{{randomItem("a, b","c")}}')).toBe('$(pick a, b;c)');
    expect(ciftParantezCevir('{{randomItemPercentage(“one”:70, “two”:5, “three”:25)}}')).toBe('$(pickw one:70;two:5;three:25)');
    expect(ciftParantezCevir('{{request(https://example.com/x)}}')).toBe('$(urlfetch https://example.com/x)');
  });

  it('tanınmayanı ve bozuk olanı olduğu gibi bırakır', () => {
    expect(ciftParantezCevir('{{bilinmeyen}} {{sender.sifre}}')).toBe('{{bilinmeyen}} {{sender.sifre}}');
    expect(ciftParantezCevir('{{randomRange(a,b)}}')).toBe('{{randomRange(a,b)}}');
    expect(ciftParantezCevir('{{request(file:///etc/passwd)}}')).toBe('{{request(file:///etc/passwd)}}');
    expect(ciftParantezCevir('düz metin')).toBe('düz metin');
    expect(ciftParantezCevir('')).toBe('');
  });

  it('seçenekteki ; değişken ayıracını bozmaz', () => {
    expect(ciftParantezCevir('{{randomItem("a;b","c")}}')).toBe('$(pick a,b;c)');
  });
});
