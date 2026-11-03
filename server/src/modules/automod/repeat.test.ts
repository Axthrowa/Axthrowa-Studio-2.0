/**
 * AxBoT — tekrarlanan mesaj koruması testleri (B9)
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import { TekrarIzleyici, tekrarAnahtari } from './repeat.js';

describe('tekrarAnahtari', () => {
  it('büyük harf, Türkçe karakter ve sondaki noktalama aynı sayılır', () => {
    expect(tekrarAnahtari('MERHABA!!')).toBe(tekrarAnahtari('merhaba'));
    expect(tekrarAnahtari('Günaydın')).toBe(tekrarAnahtari('GUNAYDIN'));
    expect(tekrarAnahtari('selam    millet')).toBe('selam millet');
  });

  it('farklı mesajlar farklı kalır', () => {
    expect(tekrarAnahtari('selam')).not.toBe(tekrarAnahtari('selamlar'));
  });
});

describe('TekrarIzleyici', () => {
  it('pencere içinde kaçıncı tekrar olduğunu sayar', () => {
    const t = new TekrarIzleyici();
    expect(t.kaydet('ali', 'spam', 30_000, 0)).toBe(1);
    expect(t.kaydet('ali', 'SPAM!', 30_000, 1000)).toBe(2);
    expect(t.kaydet('ali', 'spam', 30_000, 2000)).toBe(3);
  });

  it('pencere dışına düşen eski mesaj sayılmaz', () => {
    const t = new TekrarIzleyici();
    t.kaydet('ali', 'spam', 10_000, 0);
    t.kaydet('ali', 'spam', 10_000, 1000);
    expect(t.kaydet('ali', 'spam', 10_000, 20_000)).toBe(1);
  });

  it('kullanıcılar ayrı sayılır', () => {
    const t = new TekrarIzleyici();
    t.kaydet('ali', 'selam', 30_000, 0);
    expect(t.kaydet('veli', 'selam', 30_000, 1)).toBe(1);
  });

  it('araya başka mesaj girse de aynı mesaj sayılır', () => {
    const t = new TekrarIzleyici();
    t.kaydet('ali', 'spam', 30_000, 0);
    t.kaydet('ali', 'başka', 30_000, 1);
    expect(t.kaydet('ali', 'spam', 30_000, 2)).toBe(2);
  });

  it('ceza sonrası sıfırlanır — aynı mesaj her seferinde ceza almaz', () => {
    const t = new TekrarIzleyici();
    t.kaydet('ali', 'spam', 30_000, 0);
    t.kaydet('ali', 'spam', 30_000, 1);
    t.sifirla('ali');
    expect(t.kaydet('ali', 'spam', 30_000, 2)).toBe(1);
  });

  it('boş mesaj ve kullanıcı sayılmaz', () => {
    const t = new TekrarIzleyici();
    expect(t.kaydet('', 'x', 30_000, 0)).toBe(0);
    expect(t.kaydet('ali', '   ', 30_000, 0)).toBe(0);
  });
});
