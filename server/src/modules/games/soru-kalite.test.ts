/**
 * StreamAxT — soru bankası kalite denetimi testleri
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import { bankayiDenetle, copSoruMu, islemSonucu, yanlisYazimlar, yakinSayilar, type Soru } from './soru-kalite.js';

const s = (category: string, question: string, ops: string[], correctOption: string, id = question): Soru => ({
  id, category, question, optionA: ops[0], optionB: ops[1], optionC: ops[2], optionD: ops[3], correctOption
});

describe('anlamsız şablon soruları', () => {
  it('atılır', () => {
    expect(copSoruMu(s('Spor', 'Spor bilgisi #3: hangisi doğrudur?', ['Yanlış A3', 'Yanlış B3', 'Doğru bilgi 3', 'Yanlış C3'], 'C'))).toBe(true);
    expect(copSoruMu(s('Spor', 'Bir oyuncu 6 sayı attıysa bu hangi sporda olabilir?', ['a', 'b', 'c', 'd'], 'A'))).toBe(true);
    expect(copSoruMu(s('Coğrafya', 'Türkiye’nin başkenti?', ['Ankara', 'İzmir', 'Bursa', 'Adana'], 'A'))).toBe(false);
  });
});

describe('onarım', () => {
  it('yer tutucu çeldirici aynı kalıbın cevaplarıyla değişir; doğru cevap korunur', () => {
    const banka = [
      s('Coğrafya', 'Rize ili hangi coğrafi bölgededir?', ['Karadeniz', 'Sahra', 'Bir nehir', 'Kutup'], 'A'),
      s('Coğrafya', 'Bursa ili hangi coğrafi bölgededir?', ['Marmara', 'Ege', 'Akdeniz', 'Karadeniz'], 'A'),
      s('Coğrafya', 'İzmir ili hangi coğrafi bölgededir?', ['Ege', 'Marmara', 'Akdeniz', 'İç Anadolu'], 'A'),
      s('Coğrafya', 'Adana ili hangi coğrafi bölgededir?', ['Akdeniz', 'Ege', 'Marmara', 'Karadeniz'], 'A')
    ];
    const r = bankayiDenetle(banka);
    const rize = r.onarilan.find((q) => q.question.startsWith('Rize'))!;
    expect(rize.optionA).toBe('Karadeniz');
    expect(rize.correctOption).toBe('A');
    expect(['Marmara', 'Ege', 'Akdeniz']).toContain(rize.optionC);
    expect(r.atilacak).toHaveLength(0);
  });

  it('"yalnız" eki atılır; sağlam soru silinmez', () => {
    const r = bankayiDenetle([s('Coğrafya', 'Çin Seddi hangi ülkededir?', ['Hindistan', 'Moğolistan yalnız', 'Japonya', 'Çin'], 'D')]);
    expect(r.onarilan[0].optionB).toBe('Moğolistan');
    expect(r.atilacak).toHaveLength(0);
  });

  it('sayısal cevapta "Diğer 1" yakın sayıyla değişir', () => {
    const r = bankayiDenetle([s('Spor', 'Beyzbolda sahada kaç oyuncu yer alır?', ['9', 'Diğer 1', '4', '8'], 'A')]);
    expect(Number(r.onarilan[0].optionB)).not.toBeNaN();
    expect(r.onarilan[0].optionB).not.toBe('9');
  });

  it('yazım sorusunda bozuk şıklar yanlış yazımlarla değişir, tek doğru kalır', () => {
    const r = bankayiDenetle([s('Yazım Yanlışları', "'herkes' ve benzerleri: hangisi doğru yazımdır?", ['herkes', 'herkez', 'herkezx', 'HERKEZ'], 'A')]);
    const q = r.onarilan[0];
    expect(q.optionA).toBe('herkes');
    expect([q.optionB, q.optionC, q.optionD].map((x) => x.toLocaleLowerCase('tr-TR'))).not.toContain('herkes');
    expect(new Set([q.optionB, q.optionC, q.optionD].map((x) => x.toLocaleLowerCase('tr-TR'))).size).toBe(3);
  });

  it('anlamsız yer tutucu onarılamazsa soru atılır', () => {
    const r = bankayiDenetle([s('Sinema TV', "Sinema türü olarak 'Komedi' geçerli midir?", ['Sadece kimya', 'Sadece spor', 'Evet', 'Hayır'], 'C')]);
    expect(r.atilacak).toHaveLength(1);
  });

  it('dört işlem yanlış işaretlenmişse düzeltilir', () => {
    const r = bankayiDenetle([s('4 İşlem', '38 + 30 = ?', ['67', '69', '8', '68'], 'A')]);
    expect(r.onarilan[0].correctOption).toBe('D');
    expect(islemSonucu('12 × 6 = ?')).toBe(72);
    expect(islemSonucu('26 − 2 = ?')).toBe(24);
    expect(islemSonucu('7 ÷ 2 = ?')).toBeNull();
  });
});

describe('üreteçler', () => {
  it('yanlış yazım doğru yazımı içermez', () => {
    const y = yanlisYazimlar('yalnız');
    expect(y.length).toBeGreaterThanOrEqual(3);
    expect(y).not.toContain('yalnız');
  });
  it('yakın sayılar doğruyu içermez', () => {
    expect(yakinSayilar(9)).not.toContain('9');
    expect(yakinSayilar(0).every((x) => Number(x) >= 0)).toBe(true);
  });
});
