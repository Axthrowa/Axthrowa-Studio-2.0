import { describe, expect, it } from 'vitest';
import { CezaMerdiveni } from './merdiven';

describe('ceza merdiveni', () => {
  it('art arda ihlaller basamak çıkar, banda durur', () => {
    const m = new CezaMerdiveni();
    const adimlar = [0, 1, 2, 3, 4].map((i) => m.ilerle('kick:Ali', 60_000, 1000 + i));
    expect(adimlar.map((a) => a.basamak)).toEqual([
      { tur: 'uyari' },
      { tur: 'timeout', saniye: 60 },
      { tur: 'timeout', saniye: 600 },
      { tur: 'ban' },
      { tur: 'ban' }
    ]);
  });

  it('pencere boyunca temiz kalan baştan başlar; kişiler ayrı sayılır', () => {
    const m = new CezaMerdiveni();
    m.ilerle('kick:ali', 60_000, 0);
    expect(m.ilerle('KICK:ALI', 60_000, 59_000).adim).toBe(1);
    expect(m.ilerle('kick:ali', 60_000, 59_000 + 60_000).adim).toBe(0);
    expect(m.ilerle('twitch:ali', 60_000, 0).adim).toBe(0);
  });

  it('K2: kayıt yeni örneğe geri yüklenir; 24 saatten eskisi ve bozuk girdi alınmaz', () => {
    let kayit: unknown = [];
    const m = new CezaMerdiveni((k) => (kayit = JSON.parse(JSON.stringify(k))));
    m.ilerle('kick:ali', 60_000, 1000);
    m.ilerle('kick:ali', 60_000, 2000);
    const yeni = new CezaMerdiveni(undefined, kayit, 3000);
    expect(yeni.ilerle('kick:ali', 60_000, 3000).adim).toBe(2);
    const eski = new CezaMerdiveni(undefined, kayit, 2000 + 25 * 3600_000);
    expect(eski.ilerle('kick:ali', 48 * 3600_000, 2000 + 25 * 3600_000).adim).toBe(0);
    expect(() => new CezaMerdiveni(undefined, [['x', null], 5, 'bozuk'])).not.toThrow();
  });
});
