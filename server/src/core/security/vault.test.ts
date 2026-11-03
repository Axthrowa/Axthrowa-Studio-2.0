/**
 * AxBoT — sır kasası testleri (S6)
 * Developed by AxthrowA
 */
import { describe, it, expect, afterEach } from 'vitest';
import { ONEK, _testIcinKullanilamazYap, coz, onekliMi, satiriCoz, sifrele, sifreleHepsi } from './vault.js';

afterEach(() => _testIcinKullanilamazYap(process.platform !== 'win32'));

describe('önek', () => {
  it('yalnız dpapi:v1: önekli değer şifreli sayılır', () => {
    expect(onekliMi(`${ONEK}AAAA`)).toBe(true);
    expect(onekliMi('oauth:abc')).toBe(false);
    expect(onekliMi(null)).toBe(false);
    expect(onekliMi(42)).toBe(false);
  });
});

describe('DPAPI YOKKEN (Linux/Mac ya da PowerShell engelli) — hiçbir şey bozulmaz', () => {
  it('şifreleme düz metni aynen döner', () => {
    _testIcinKullanilamazYap(true);
    expect(sifrele('token123')).toBe('token123');
    expect(sifreleHepsi(['a', null, ''])).toEqual(['a', null, '']);
  });

  it('öneksiz değer aynen okunur (geriye uyum)', () => {
    _testIcinKullanilamazYap(true);
    expect(coz('duz-token')).toBe('duz-token');
  });

  it('çözülemeyen şifreli değer BOŞ döner — platform "yeniden bağlan" der', () => {
    _testIcinKullanilamazYap(true);
    expect(coz(`${ONEK}AAAA`)).toBe('');
  });
});

describe('satiriCoz', () => {
  it('öneksiz satırı AYNEN (aynı nesne) döner', () => {
    const r = { id: 1, token: 'duz' };
    expect(satiriCoz(r)).toBe(r);
  });

  it('nesne olmayan değerlere dokunmaz', () => {
    expect(satiriCoz(undefined)).toBeUndefined();
    expect(satiriCoz(null)).toBeNull();
  });
});

describe.runIf(process.platform === 'win32')('Windows DPAPI gidiş-dönüş', () => {
  it('şifreler, düz metni içermez, geri çözer (Türkçe dahil)', () => {
    _testIcinKullanilamazYap(false);
    const duz = 'GERCEK_TOKEN_öçşğüİ_' + Date.now();
    const s = sifrele(duz)!;
    expect(onekliMi(s)).toBe(true);
    expect(s.includes('GERCEK_TOKEN')).toBe(false);
    expect(coz(s)).toBe(duz);
    // Değişmeyen değer yeniden kaydedilince aynı şifreli döner (PowerShell çağrılmaz)
    expect(sifrele(duz)).toBe(s);
    // Satır sarmalayıcısı çözer
    expect(satiriCoz({ token: s }).token).toBe(duz);
  }, 30_000);
});
