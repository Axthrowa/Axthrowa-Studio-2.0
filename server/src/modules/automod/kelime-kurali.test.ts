/**
 * StreamAxT — kara liste kelime kuralları testleri
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import { kelimeEslesmesi, kelimeKuraliDerle, kelimeListesiDerle, regexGuvenliMi, zalgoMu } from './kelime-kurali.js';

const derle = (l: string[]) => kelimeListesiDerle(l).kurallar;

describe('düz kelime (eski davranış + Türkçe katlama)', () => {
  it('alt metin olarak bulur, büyük/küçük ve Türkçe karakter fark etmez', () => {
    const k = derle(['küfür']);
    expect(kelimeEslesmesi(k, 'bu bir KÜFÜR')).toBe('küfür');
    expect(kelimeEslesmesi(k, 'kufur yazdım')).toBe('küfür');
    expect(kelimeEslesmesi(k, 'merhaba')).toBeNull();
  });
});

describe('joker *', () => {
  it('kelime başından eşleşir', () => {
    const k = derle(['test*']);
    expect(kelimeEslesmesi(k, 'testing yapıyorum')).toBe('test*');
    expect(kelimeEslesmesi(k, 'TEST')).toBe('test*');
    expect(kelimeEslesmesi(k, 'contest')).toBeNull();
  });
  it('baştaki * içeride de bulur', () => {
    expect(kelimeEslesmesi(derle(['*spam*']), 'nospammer')).toBe('*spam*');
  });
});

describe('~/regex/', () => {
  it('telefon numarası kalıbı', () => {
    const k = derle(['~/(\\d{3}[-.])?\\d{3}[-.]\\d{4}/']);
    expect(kelimeEslesmesi(k, 'ara beni 321-2345')).not.toBeNull();
    expect(kelimeEslesmesi(k, 'saat 12:30')).toBeNull();
  });
  it('bayraklar: i büyük/küçük harf duyarsız', () => {
    expect(kelimeEslesmesi(derle(['~/b[o0]t s[a4]t/i']), 'BOT SAT burada')).not.toBeNull();
  });
  it('felaket geri izlemeli ve derlenmeyen desen reddedilir', () => {
    expect(regexGuvenliMi('(a+)+')).toBe(false);
    expect(regexGuvenliMi('(\\w*)*x')).toBe(false);
    expect(regexGuvenliMi('(x|y+){2,}')).toBe(false);
    expect(regexGuvenliMi('a+b*')).toBe(true);
    const { kurallar, gecersiz } = kelimeListesiDerle(['~/(a+)+$/', '~/([/', 'iyi']);
    expect(gecersiz).toEqual(['~/(a+)+$/', '~/([/']);
    expect(kurallar).toHaveLength(1);
  });
  it('çok uzun desen reddedilir', () => {
    expect(kelimeKuraliDerle('~/' + 'a'.repeat(300) + '/')).toBeNull();
  });
});

describe('Zalgo', () => {
  it('yığılmış birleşik işaretleri yakalar', () => {
    expect(zalgoMu('h́̂̃̄ello')).toBe(true);
  });
  it('normal Türkçe ve emoji serbest', () => {
    expect(zalgoMu('Çığ düştü, şöyle böyle güzel bir yayın 🎉')).toBe(false);
    expect(zalgoMu('café')).toBe(false);
    expect(zalgoMu('')).toBe(false);
  });
});
