/**
 * StreamAxT — sohbet cevabı eşleştirme testleri
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import { cevapBicimi, kelimeTuttuMu, serbestCevapDogruMu, sikCoz } from './cevap-eslestir.js';

const SECENEK = { A: 'Karamazov Kardeşler', B: 'Suç ve Ceza', C: 'İstanbul', D: 'Kırmızı' };

describe('cevapBicimi', () => {
  it('Türkçe büyük harfleri doğru katlar (JS toLowerCase hatası)', () => {
    expect(cevapBicimi('İSTANBUL')).toBe('istanbul');
    expect(cevapBicimi('İstanbul')).toBe('istanbul');
    expect(cevapBicimi('KIRMIZI')).toBe('kirmizi');
  });
  it('emote, etiket ve noktalamayı temizler', () => {
    expect(cevapBicimi('@StreamAxTBot  C)  [emote:37226:KEKW]')).toBe('c');
    expect(cevapBicimi('<:kekw:123> suç ve ceza!!!')).toBe('suc ve ceza');
  });
});

describe('sikCoz — harf ve rakam', () => {
  it.each([
    ['a', 'A'],
    ['B', 'B'],
    ['  c  ', 'C'],
    ['d', 'D'],
    ['1', 'A'],
    ['4', 'D'],
    ['A)', 'A'],
    ['b.', 'B'],
    ['C!', 'C'],
    ['d - bence', 'D'],
    ['A şıkkı', 'A'],
    ['a sikki', 'A'],
    ['B seçeneği', 'B'],
    ['c olmalı', 'C'],
    ['cevap b', 'B'],
    ['Cevabım: C', 'C'],
    ['bence d', 'D'],
    ['@StreamAxTBot a', 'A'],
    ['[emote:1:KEKW] b', 'B']
  ])('%s → %s', (mesaj, beklenen) => {
    expect(sikCoz(mesaj, SECENEK)).toBe(beklenen);
  });

  it('ilgisiz sohbet şık sayılmaz', () => {
    expect(sikCoz('selam millet', SECENEK)).toBeNull();
    expect(sikCoz('abi bu soru zor', SECENEK)).toBeNull();
    expect(sikCoz('', SECENEK)).toBeNull();
    expect(sikCoz('ceza', SECENEK)).toBeNull(); // seçeneğin yalnız bir parçası
  });
});

describe('sikCoz — seçenek metni', () => {
  it('Türkçe büyük/küçük ve karaktersiz yazım tutar', () => {
    expect(sikCoz('İSTANBUL', SECENEK)).toBe('C');
    expect(sikCoz('istanbul', SECENEK)).toBe('C');
    expect(sikCoz('kirmizi', SECENEK)).toBe('D');
    expect(sikCoz('suc ve ceza', SECENEK)).toBe('B');
    expect(sikCoz('bence Suç ve Ceza', SECENEK)).toBe('B');
  });
  it('şık harfi + seçenek metni', () => {
    expect(sikCoz('b suç ve ceza', SECENEK)).toBe('B');
  });
  it('seçenek metni birebir rakamsa rakam kuralından önce gelir', () => {
    expect(sikCoz('4', { A: '4', B: '6', C: '8', D: '10' })).toBe('A');
    expect(sikCoz('8', { A: '4', B: '6', C: '8', D: '10' })).toBe('C');
    expect(sikCoz('4', { A: '12', B: '6', C: '8', D: '10' })).toBe('D');
  });
  it('iç içe seçeneklerde en uzunu; eşitse belirsiz', () => {
    expect(sikCoz('ankara ve izmir', { A: 'Ankara', B: 'Ankara ve İzmir', C: 'x', D: 'y' })).toBe('B');
    expect(sikCoz('elma armut', { A: 'elma', B: 'armut', C: 'x', D: 'y' })).toBeNull();
  });
});

describe('serbest cevap ve kelime bulmacası', () => {
  it('tam kelime eşleşmesi; kısa cevap kelime içinde aranmaz', () => {
    expect(serbestCevapDogruMu('au', ['au'])).toBe(true);
    expect(serbestCevapDogruMu('cevap AU', ['au'])).toBe(true);
    expect(serbestCevapDogruMu('aura farming', ['au'])).toBe(false);
    expect(serbestCevapDogruMu('Los Santos!', ['los santos'])).toBe(true);
    expect(serbestCevapDogruMu('lossantos', ['los santos'])).toBe(true);
    expect(serbestCevapDogruMu('JÜPİTER', ['jupiter'])).toBe(true);
    expect(serbestCevapDogruMu('HÜKÜM DAĞI', ['hukum dagi'])).toBe(true);
  });
  it('bulmaca kelimesi Türkçe karakterle de tutar', () => {
    expect(kelimeTuttuMu('yayın', 'yayin')).toBe(true);
    expect(kelimeTuttuMu('KULAKLIK buldum', 'kulaklik')).toBe(true);
    expect(kelimeTuttuMu('yayinci', 'yayin')).toBe(false);
  });
});
