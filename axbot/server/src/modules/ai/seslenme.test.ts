/**
 * AxBoT — yapay zekâya seslenme testleri
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import { SeslenmeSiniri, seslenmeAyikla } from './seslenme.js';

describe('seslenmeAyikla', () => {
  const botlar = ['ornekbot'];
  it('bot adıyla başlayan mesajdan soruyu alır', () => {
    expect(seslenmeAyikla('@OrnekBot bugün ne oynuyoruz?', botlar)).toBe('bugün ne oynuyoruz?');
    expect(seslenmeAyikla('@ornekbot, selam', botlar)).toBe('selam');
    expect(seslenmeAyikla('@ornekbot: nasılsın', botlar)).toBe('nasılsın');
  });
  it('başka kişiye seslenme, ortada geçen ad ve boş soru yok sayılır', () => {
    expect(seslenmeAyikla('@ali selam', botlar)).toBeNull();
    expect(seslenmeAyikla('selam @ornekbot', botlar)).toBeNull();
    expect(seslenmeAyikla('@ornekbot', botlar)).toBeNull();
    expect(seslenmeAyikla('@ornekbot a', botlar)).toBeNull();
  });
});

describe('SeslenmeSiniri', () => {
  it('kişi başına ve genel bekleme', () => {
    const s = new SeslenmeSiniri(30_000, 4_000);
    expect(s.izinVer('ali', 0)).toBe(true);
    expect(s.izinVer('veli', 1_000)).toBe(false); // genel bekleme
    expect(s.izinVer('veli', 5_000)).toBe(true);
    expect(s.izinVer('ali', 10_000)).toBe(false); // kişi bekleme
    expect(s.izinVer('ali', 31_000)).toBe(true);
  });
});
