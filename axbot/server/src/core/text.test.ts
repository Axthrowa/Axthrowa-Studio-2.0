/**
 * AxBoT — metin yardımcıları testleri
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import { mesajiParcala } from './text.js';

describe('mesajiParcala (Kick 500 karakter sınırı)', () => {
  it('kısa mesaj tek parça kalır', () => {
    expect(mesajiParcala('merhaba')).toEqual(['merhaba']);
    expect(mesajiParcala('')).toEqual([]);
  });
  it('önce satır sonundan böler', () => {
    const a = 'a'.repeat(300);
    const b = 'b'.repeat(300);
    expect(mesajiParcala(`${a}\n${b}`)).toEqual([a, b]);
  });
  it('satır yoksa boşluktan böler, hiçbir parça sınırı aşmaz', () => {
    const metin = Array.from({ length: 200 }, (_, i) => `kelime${i}`).join(' ');
    const p = mesajiParcala(metin, 100);
    expect(p.every((x) => [...x].length <= 100)).toBe(true);
    expect(p.join(' ')).toBe(metin);
  });
  it('emoji kod noktası olarak sayılır ve bölünmez', () => {
    const metin = '🧠'.repeat(600);
    const p = mesajiParcala(metin, 500);
    expect(p.map((x) => [...x].length)).toEqual([500, 100]);
    expect(p.join('')).toBe(metin);
  });
});
