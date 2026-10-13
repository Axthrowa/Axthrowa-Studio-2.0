/**
 * StreamAxT — Türkçe metin yardımcıları (saf)
 * Developed by AxthrowA
 *
 * `'HAYIR'.toLowerCase()` = `'hayir'` ama `'Hayır'.toLowerCase()` =
 * `'hayır'`: aynı kelime iki farklı biçime düşüyor. Sohbette insanlar büyük
 * harfle, Türkçe karakterle ya da karaktersiz yazar; karşılaştırma üçünü de
 * aynı saymalı.
 */

/** Türkçe duyarlı küçük harf + ASCII katlama (ı→i, ş→s, ğ→g, ü→u, ö→o, ç→c). */
export function trKatla(metin: string): string {
  return String(metin ?? '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/â/g, 'a')
    .replace(/î/g, 'i')
    .replace(/û/g, 'u')
    .trim();
}

/** Düzenli ifade özel karakterlerini kaçışlar. */
export function kacisla(metin: string): string {
  return String(metin ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
