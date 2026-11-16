import { describe, expect, it } from 'vitest';
import { KatmanIzleyici, katmanAdiTemizle } from './katmanDurumu.js';

describe('katman durumu', () => {
  it('bağlı ve kopan katmanları ayırır', () => {
    const iz = new KatmanIzleyici();
    iz.baglandi('alertbox', 1000);
    iz.baglandi('chatbox', 1000);
    iz.koptu('chatbox', 5000);
    const d = iz.durum([{ katman: 'alertbox', obs: true }, { katman: 'alertbox', obs: false }]);
    expect(d).toEqual([
      { katman: 'alertbox', bagli: 2, obs: 1, sonBaglanti: 1000, sonKopma: 0 },
      { katman: 'chatbox', bagli: 0, obs: 0, sonBaglanti: 1000, sonKopma: 5000 }
    ]);
  });

  it('aynı sayfanın birden çok soketi bir kez sayılır', () => {
    const iz = new KatmanIzleyici();
    iz.baglandi('alertbox', 1);
    const d = iz.durum([
      { katman: 'alertbox', obs: true, sayfa: 'p1' },
      { katman: 'alertbox', obs: true, sayfa: 'p1' },
      { katman: 'alertbox', obs: true, sayfa: 'p2' }
    ]);
    expect(d[0]).toMatchObject({ bagli: 2, obs: 2 });
  });

  it('katmansız (panel) bağlantılar listeye girmez', () => {
    expect(new KatmanIzleyici().durum([{ obs: true }])).toEqual([]);
  });

  it('yalnız güvenli adları kabul eder', () => {
    expect(katmanAdiTemizle('AlertBox')).toBe('alertbox');
    expect(katmanAdiTemizle('donation-goal')).toBe('donation-goal');
    expect(katmanAdiTemizle('<script>')).toBeUndefined();
    expect(katmanAdiTemizle('')).toBeUndefined();
    expect(katmanAdiTemizle('a'.repeat(41))).toBeUndefined();
  });
});
