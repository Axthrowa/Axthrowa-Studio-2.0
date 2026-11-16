import { describe, expect, it } from 'vitest';
import { bahisOku } from './bahis.js';

const k = { kisi: 'ali', ornek: 'örnek: !zar 50', ad: 'zar bahsi', varsayilan: 50, min: 10, max: 2500 };

describe('bahisOku', () => {
  it('sayı, varsayılan ve hepsi', () => {
    expect(bahisOku('120', 500, k)).toEqual({ miktar: 120 });
    expect(bahisOku(undefined, 500, k)).toEqual({ miktar: 50 });
    expect(bahisOku('HEPSI', 300, k)).toEqual({ miktar: 300 });
    expect(bahisOku('hepsi', 3, { ...k, min: 0, hepsiEnAz: 10 })).toEqual({ hata: '@ali, yeterli puanın yok! Bakiyen: 3 💰' });
  });

  it('geçersiz, sınır dışı ve yetersiz bakiye reddedilir', () => {
    expect(bahisOku('-5', 500, k)).toEqual({ hata: '@ali, örnek: !zar 50' });
    expect(bahisOku('abc', 500, k)).toEqual({ hata: '@ali, örnek: !zar 50' });
    expect(bahisOku('5', 500, k)).toEqual({ hata: '@ali, minimum zar bahsi: 10 Puan!' });
    expect(bahisOku('9999', 99999, k)).toEqual({ hata: '@ali, maksimum zar bahsi: 2500 Puan!' });
    expect(bahisOku('600', 500, k)).toEqual({ hata: '@ali, yeterli puanın yok! Bakiyen: 500 💰' });
    // Varsayılan yoksa miktarsız komut geçersiz (rulet)
    expect(bahisOku(undefined, 500, { kisi: 'ali', ornek: 'x' })).toEqual({ hata: '@ali, x' });
  });
});
