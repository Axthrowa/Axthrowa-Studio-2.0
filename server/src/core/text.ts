/**
 * AxBoT — Türkçe metin yardımcıları (saf)
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

/**
 * Uzun sohbet mesajını platform sınırına göre parçalar (Kick: 500 karakter).
 * Önce satır sonundan, olmazsa boşluktan böler; tek sözcük sınırdan uzunsa keser.
 * Karakter sayımı kod noktası iledir (emoji iki birim sayılmaz).
 */
export function mesajiParcala(metin: string, sinir = 500): string[] {
  const parcalar: string[] = [];
  let kalan = [...String(metin ?? '').trim()];
  while (kalan.length > sinir) {
    const pencere = kalan.slice(0, sinir + 1).join('');
    let kes = pencere.lastIndexOf('\n');
    if (kes < sinir * 0.5) kes = pencere.lastIndexOf(' ');
    let parca: string;
    if (kes <= 0) {
      parca = kalan.slice(0, sinir).join('');
      kalan = kalan.slice(sinir);
    } else {
      const kodNoktasi = [...pencere.slice(0, kes)].length;
      parca = kalan.slice(0, kodNoktasi).join('');
      kalan = kalan.slice(kodNoktasi + 1);
    }
    if (parca.trim()) parcalar.push(parca.trim());
  }
  const son = kalan.join('').trim();
  if (son) parcalar.push(son);
  return parcalar;
}
