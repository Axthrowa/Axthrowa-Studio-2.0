/**
 * AxBoT — seviye/XP testleri
 * Developed by AxthrowA
 *
 * Yalnız saf hesap fonksiyonları test edilir; `levels.ts` veritabanını
 * açtığı için buradan yüklenmez.
 */
import { describe, it, expect } from 'vitest';
import { seviyeMaliyeti, seviyeHesapla } from './curve.js';

const AYAR = { tabanXp: 100, buyume: 1.5, maksSeviye: 100 };

describe('seviyeMaliyeti', () => {
  it('ilk seviye tabana eşit', () => {
    expect(seviyeMaliyeti(1, 100, 1.5)).toBe(100);
  });

  it('kademeli zorlaşır', () => {
    expect(seviyeMaliyeti(2, 100, 1.5)).toBe(150);
    expect(seviyeMaliyeti(3, 100, 1.5)).toBe(225);
  });

  it('büyüme 1 ise sabit kalır', () => {
    expect(seviyeMaliyeti(5, 80, 1)).toBe(80);
  });

  it('geçersiz girdide çökmez', () => {
    expect(seviyeMaliyeti(0, 100, 1.5)).toBe(100);
    expect(seviyeMaliyeti(-3, 100, 1.5)).toBe(100);
  });
});

describe('seviyeHesapla', () => {
  it('XP yokken seviye 0', () => {
    const h = seviyeHesapla(0, AYAR);
    expect(h.seviye).toBe(0);
    expect(h.sonrakiIcinXp).toBe(100);
    expect(h.yuzde).toBe(0);
  });

  it('tam eşikte seviye atlar', () => {
    expect(seviyeHesapla(100, AYAR).seviye).toBe(1);
    expect(seviyeHesapla(250, AYAR).seviye).toBe(2); // 100 + 150
    expect(seviyeHesapla(475, AYAR).seviye).toBe(3); // + 225
  });

  it('eşiğin bir altında seviye atlamaz', () => {
    expect(seviyeHesapla(99, AYAR).seviye).toBe(0);
    expect(seviyeHesapla(249, AYAR).seviye).toBe(1);
  });

  it('seviye içi ilerleme ve yüzde doğru', () => {
    const h = seviyeHesapla(175, AYAR); // seviye 1, içinde 75 XP, sonraki 150
    expect(h.seviye).toBe(1);
    expect(h.buSeviyedeXp).toBe(75);
    expect(h.sonrakiIcinXp).toBe(150);
    expect(h.yuzde).toBe(50);
  });

  it('maksimum seviyede durur — sonsuz döngüye girmez', () => {
    const h = seviyeHesapla(10_000_000, { tabanXp: 10, buyume: 1.01, maksSeviye: 5 });
    expect(h.seviye).toBe(5);
  });

  it('negatif veya bozuk XP sıfır sayılır', () => {
    expect(seviyeHesapla(-50, AYAR).seviye).toBe(0);
    expect(seviyeHesapla(NaN, AYAR).seviye).toBe(0);
  });

  it('ayar değişince seviye YENİDEN hesaplanır (veri kaybı yok)', () => {
    // Toplam XP saklanıyor, seviye türetiliyor. Taban düşünce herkes yükselir.
    const xp = 500;
    expect(seviyeHesapla(xp, { tabanXp: 100, buyume: 1.5, maksSeviye: 100 }).seviye).toBe(3);
    expect(seviyeHesapla(xp, { tabanXp: 50, buyume: 1.5, maksSeviye: 100 }).seviye).toBe(4);
  });
});
