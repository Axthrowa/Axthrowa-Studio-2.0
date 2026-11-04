import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { YERLESIK_KOMUTLAR, komutlarMetni, yanitSablonu, yerlesikAyarlariCoz, yerlesikBul, yetkiYeterli } from './yerlesik-komutlar.js';
import { YERLESIK_ORNEKLER } from './yerlesik-ornekler.js';

describe('yerleşik komut listesi', () => {
  it('bottaki her komut adı listede (yeni komut eklenince liste unutulmasın)', () => {
    const kaynak = readFileSync(path.join(__dirname, 'command-manager.ts'), 'utf8').replace(/\r\n/g, '\n');
    const bas = kaynak.indexOf('private async executeBuiltIn(');
    const govde = kaynak.slice(bas, kaynak.indexOf('\n      default:', bas));
    const adlar = [...govde.matchAll(/^ {6}case '([^']+)':/gm)].map((m) => m[1]);
    expect(adlar.length).toBeGreaterThan(150);
    expect(adlar.filter((a) => !yerlesikBul(a))).toEqual([]);
  });

  it('takma ad asıl komutu bulur; panel ayarı yalnız bilinen komut ve geçerli değerleri alır', () => {
    expect(yerlesikBul('bakiye')?.ad).toBe('puan');
    expect(yerlesikAyarlariCoz('{"bakiye":{"yetki":"mod","bekleme":30},"yok":{"yetki":"mod"},"sr":{"yetki":"kral"}}')).toEqual({ puan: { yetki: 'mod', bekleme: 30 } });
    expect(yetkiYeterli('mod', { isMod: false })).toBe(false);
    expect(yetkiYeterli('yayinci', { isMod: true })).toBe(false);
  });

  it('!komutlar sohbet sınırına sığar, kapalıları yazmaz; kategoriyle ayrıntı verir', () => {
    const m = komutlarMetni({ kapali: ['sr'], ozel: ['merhaba'] });
    expect(m.length).toBeLessThanOrEqual(450);
    expect(m).toContain('!merhaba');
    expect(m).not.toMatch(/!sr\b/);
    expect(komutlarMetni({ kategori: 'oyun', kapali: [], ozel: [] })).toContain('!slot 25');
    expect(komutlarMetni({ kategori: '123', kapali: [], ozel: [] })).toMatch(/^📌 Komutlar:/);
    expect(YERLESIK_KOMUTLAR.length).toBeGreaterThan(90);
  });
});

describe('komutun sohbet görünümü', () => {
  it('her komutun örnek yanıtı var', () => {
    expect(YERLESIK_KOMUTLAR.filter((k) => !(k.ad in YERLESIK_ORNEKLER)).map((k) => k.ad)).toEqual([]);
  });
  it('yanıt şablonu {sonuc} ve {kullanici} yerleştirir; metindeki $ kalıpları bozulmaz', () => {
    expect(yanitSablonu('🎲 {kullanici}: {sonuc}', 'kazandın $& $1', 'ali')).toBe('🎲 ali: kazandın $& $1');
    expect(yanitSablonu('sabit yanıt', 'x', 'ali')).toBe('sabit yanıt');
    expect(yanitSablonu('{sonuc}', 'a'.repeat(900), 'ali').length).toBe(500);
  });
  it('şablon ayarlarda saklanır, boşu silinir', () => {
    expect(yerlesikAyarlariCoz({ puan: { yanit: '  {sonuc} !  ' } }).puan).toEqual({ yanit: '{sonuc} !' });
    expect(yerlesikAyarlariCoz({ puan: { yanit: '   ' } }).puan).toBeUndefined();
  });
});
