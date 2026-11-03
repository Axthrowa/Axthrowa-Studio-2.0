/**
 * AxBoT — güvenli ifade çözümleyicisi testleri (Function/eval yerine)
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import { ifadeHesapla, matematik } from './pure.js';

describe('ifadeHesapla', () => {
  it('öncelik, parantez, tekli eksi, üs, mod', () => {
    expect(ifadeHesapla('2+3*4')).toBe(14);
    expect(ifadeHesapla('(2+3)*4')).toBe(20);
    expect(ifadeHesapla('-3+5')).toBe(2);
    expect(ifadeHesapla('2**3**2')).toBe(512);
    expect(ifadeHesapla('10%4')).toBe(2);
    expect(ifadeHesapla('.5*4')).toBe(2);
  });
  it('hatalı ifade ve sıfıra bölme fırlatır', () => {
    expect(() => ifadeHesapla('1+')).toThrow();
    expect(() => ifadeHesapla('1/0')).toThrow();
    expect(() => ifadeHesapla('(1')).toThrow();
    expect(() => ifadeHesapla('1)2')).toThrow();
    expect(() => ifadeHesapla('('.repeat(30) + '1' + ')'.repeat(30))).toThrow();
  });
  it('matematik kod çalıştırmaz', () => {
    expect(matematik('process.exit(1)')).toBe('(math geçersiz)');
    expect(matematik('1,5 + 1')).toBe('2.5');
  });
});
