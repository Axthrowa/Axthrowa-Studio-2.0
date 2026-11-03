/**
 * AxBoT — Bil Bakalım sohbet mesajı testleri
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import { cevapMesaji, soruMesaji, triviaArgumanlari } from './trivia-mesaj.js';

describe('triviaArgumanlari', () => {
  const coz = (s: string) => (s.includes('tarih') ? 'Tarih' : s.includes('4') ? '4 İşlem' : 'all');
  it('kategori ve sayıyı sırası ne olursa olsun tanır', () => {
    expect(triviaArgumanlari(['tarih', '5'], coz)).toEqual({ kategori: 'Tarih', adet: 5 });
    expect(triviaArgumanlari(['5', 'tarih'], coz)).toEqual({ kategori: 'Tarih', adet: 5 });
  });
  it('sayı kategori sanılmaz, sınırlanır, yoksa varsayılan kullanılır', () => {
    expect(triviaArgumanlari(['4'], coz)).toEqual({ kategori: 'all', adet: 4 });
    expect(triviaArgumanlari(['99'], coz).adet).toBe(20);
    expect(triviaArgumanlari(['0'], coz).adet).toBe(1);
    expect(triviaArgumanlari([], coz, 5)).toEqual({ kategori: 'all', adet: 5 });
  });
});

const q = { question: 'Türkiye’nin başkenti\nneresidir?', optionA: 'İstanbul', optionB: 'Ankara', optionC: 'İzmir', optionD: 'Bursa' };

describe('Bil Bakalım sohbet mesajı', () => {
  it('yalnız soru ve şıklar, tek satır', () => {
    const m = soruMesaji(q);
    expect(m).toBe('🧠 Türkiye’nin başkenti neresidir?  A) İstanbul  B) Ankara  C) İzmir  D) Bursa');
    expect(m).not.toMatch(/\n|Kategori|Süre|Ödül|╔/);
  });
  it('turnuvada sıra numarası', () => {
    expect(soruMesaji(q, { no: 2, toplam: 5 })).toMatch(/^🧠 \(2\/5\) Türkiye/);
  });
  it('500 karakteri aşmaz', () => {
    expect(soruMesaji({ ...q, question: 'x'.repeat(900) }).length).toBeLessThanOrEqual(480);
  });
  it('cevap mesajı kısa', () => {
    expect(cevapMesaji('B', 'Ankara', { ad: 'ali', puan: 10, kisi: 3 })).toBe('✅ Doğru cevap: B) Ankara — ilk bilen @ali (+10), toplam 3 kişi bildi');
    expect(cevapMesaji('B', 'Ankara')).toBe('✅ Doğru cevap: B) Ankara — kimse bilemedi');
  });
});
