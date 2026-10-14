/**
 * StreamAxT — `{{...}}` uyum testleri
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import { kickbotCevir } from './kickbot-uyum.js';

describe('kickbotCevir', () => {
  it('düz yer tutucular', () => {
    expect(kickbotCevir('Selam {{sender.username}}!')).toBe('Selam $(user)!');
    expect(kickbotCevir('{{ stream.title }} · {{stream.viewers}} izleyici')).toBe('$(title) · $(viewers) izleyici');
    expect(kickbotCevir('{{taggedUser.username}} {{streamer.username}}')).toBe('$(touser) $(channel)');
  });

  it('profil alanları $(kick) olur', () => {
    expect(kickbotCevir('{{sender.instagram}}')).toBe('$(kick instagram $(user))');
    expect(kickbotCevir('{{taggedUser.url}}')).toBe('$(kick url $(touser))');
    expect(kickbotCevir('{{streamer.followers}}')).toBe('$(kick takipci $(channel))');
  });

  it('fonksiyonlar', () => {
    expect(kickbotCevir('{{randomRange(1,6)}}')).toBe('$(random 1 6)');
    expect(kickbotCevir('{{randomRange(10, 2)}}')).toBe('$(random 2 10)');
    expect(kickbotCevir('{{randomItem(“one”,”two”,”three”)}}')).toBe('$(pick one;two;three)');
    expect(kickbotCevir('{{randomItem("a, b","c")}}')).toBe('$(pick a, b;c)');
    expect(kickbotCevir('{{randomItemPercentage(“one”:70, “two”:5, “three”:25)}}')).toBe('$(pickw one:70;two:5;three:25)');
    expect(kickbotCevir('{{request(https://example.com/x)}}')).toBe('$(urlfetch https://example.com/x)');
  });

  it('tanınmayanı ve bozuk olanı olduğu gibi bırakır', () => {
    expect(kickbotCevir('{{bilinmeyen}} {{sender.sifre}}')).toBe('{{bilinmeyen}} {{sender.sifre}}');
    expect(kickbotCevir('{{randomRange(a,b)}}')).toBe('{{randomRange(a,b)}}');
    expect(kickbotCevir('{{request(file:///etc/passwd)}}')).toBe('{{request(file:///etc/passwd)}}');
    expect(kickbotCevir('düz metin')).toBe('düz metin');
    expect(kickbotCevir('')).toBe('');
  });

  it('seçenekteki ; değişken ayıracını bozmaz', () => {
    expect(kickbotCevir('{{randomItem("a;b","c")}}')).toBe('$(pick a,b;c)');
  });
});
