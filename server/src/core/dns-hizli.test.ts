/**
 * AxBoT — IPv4 öncelikli DNS testleri (ağsız: yalnız yerel adlar)
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import dns from 'dns';
import { hizliDnsKur, ipv4OncelikliLookup, ipv4OncelikliYap } from './dns-hizli.js';

const coz = (ad: string, secenek: any) =>
  new Promise<{ hata: any; adres: any; aile?: number }>((r) => ipv4OncelikliLookup(ad, secenek, (hata, adres, aile) => r({ hata, adres, aile })));

describe('ipv4OncelikliLookup', () => {
  it('localhost → IPv4 tek adres', async () => {
    const r = await coz('localhost', {});
    expect(r.hata).toBeNull();
    expect(r.aile).toBe(4);
    expect(r.adres).toBe('127.0.0.1');
  });

  it('all: true dizi döner', async () => {
    const r = await coz('localhost', { all: true });
    expect(Array.isArray(r.adres)).toBe(true);
    expect(r.adres[0].family).toBe(4);
  });

  it('IP adresine dokunmaz; açık aile korunur', async () => {
    expect((await coz('::1', {})).aile).toBe(6);
    expect((await coz('127.0.0.1', 4)).adres).toBe('127.0.0.1');
  });

  it('IPv4 bulunamazsa ailesiz çözümlemeye düşer (yalnız IPv6 alan adı)', async () => {
    const cagrilar: any[] = [];
    const sahte = (_ad: string, s: any, cb: any) => {
      cagrilar.push(s.family);
      if (s.family === 4) cb(Object.assign(new Error('yok'), { code: 'ENOTFOUND' }), '', 0);
      else cb(null, '2001:db8::1', 6);
    };
    const r = await new Promise<any>((coz) => ipv4OncelikliYap(sahte)('yalniz-v6.example', {}, (hata, adres, aile) => coz({ hata, adres, aile })));
    expect(r).toEqual({ hata: null, adres: '2001:db8::1', aile: 6 });
    expect(cagrilar).toEqual([4, undefined]);
  });

  it('süreç geneli dns.lookup sarılır', () => {
    hizliDnsKur();
    expect(dns.lookup).toBe(ipv4OncelikliLookup);
  });
});
