import { describe, expect, it } from 'vitest';
import { harfleriKaristir, karisikMetin, kelimeSec, KELIMELER } from './kelime-havuzu.js';
import { trKatla } from '../../core/text.js';
import { kelimeTuttuMu } from './cevap-eslestir.js';

describe('kelime havuzu', () => {
  it('kelimeler tekil, ipucu kelimenin kendisini söylemiyor', () => {
    expect(KELIMELER.length).toBeGreaterThanOrEqual(140);
    expect(new Set(KELIMELER.map((k) => k.kelime)).size).toBe(KELIMELER.length);
    for (const k of KELIMELER) {
      expect(k.kelime.length).toBeGreaterThanOrEqual(3);
      expect(trKatla(k.ipucu)).not.toContain(trKatla(k.kelime));
    }
  });

  it('karışık harfler aynı harflerdir ve kelimenin kendisi değildir', () => {
    for (const k of KELIMELER) {
      for (let i = 0; i < 5; i++) {
        const h = harfleriKaristir(k.kelime);
        expect(h.join('')).not.toBe(k.kelime);
        expect([...h].sort()).toEqual([...k.kelime].sort());
      }
    }
  });

  it('her rastgelelikte kelime açığa çıkmaz (karıştırma aynı sırayı verse de)', () => {
    expect(harfleriKaristir('kick', () => 0.999).join('')).not.toBe('kick');
  });

  it('büyük harfe Türkçe çevirir, Türkçe ya da ASCII yazan bilir', () => {
    expect(karisikMetin('kirpi', () => 0.5)).toContain('İ');
    expect(kelimeTuttuMu('yayinci', 'yayıncı')).toBe(true);
    expect(kelimeTuttuMu('YAYINCI', 'yayıncı')).toBe(true);
  });

  it('son kullanılanları tekrar seçmez, hepsi kullanıldıysa yine seçer', () => {
    const havuz = [{ kelime: 'aaa', ipucu: '' }, { kelime: 'bbb', ipucu: '' }];
    expect(kelimeSec(['aaa'], () => 0, havuz).kelime).toBe('bbb');
    expect(kelimeSec(['aaa', 'bbb'], () => 0, havuz).kelime).toBe('aaa');
  });
});
