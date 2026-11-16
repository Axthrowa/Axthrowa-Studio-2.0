import { describe, it, expect } from 'vitest';
import { kirpmaOku, kirpmaYaz } from './sesKirpma';

describe('ses kırpma', () => {
  it('başlangıç ve süreyi adres parçasına yazar, okur ve kaldırır', () => {
    expect(kirpmaYaz('/s.mp3', 2, 3)).toBe('/s.mp3#t=2,5');
    expect(kirpmaYaz('/s.mp3#t=2,5', 1.5, 0)).toBe('/s.mp3#t=1.5');
    expect(kirpmaYaz('/s.mp3#t=2,5', 0, 0)).toBe('/s.mp3');
    expect(kirpmaYaz('', 2, 3)).toBe('');
    expect(kirpmaOku('/s.mp3#t=2,5')).toEqual({ temiz: '/s.mp3', baslangic: 2, sure: 3 });
    expect(kirpmaOku('/s.mp3#t=4')).toEqual({ temiz: '/s.mp3', baslangic: 4, sure: 0 });
    expect(kirpmaOku('https://x.com/a.mp3?q=1')).toEqual({ temiz: 'https://x.com/a.mp3?q=1', baslangic: 0, sure: 0 });
  });
});
