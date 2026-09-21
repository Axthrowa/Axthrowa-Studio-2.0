/**
 * StreamAxT — değişken motorunun saf yardımcıları
 * Developed by AxthrowA
 *
 * Veritabanı veya ağ erişimi YOK. Bu sayede test edilebilirler ve
 * `registry.ts` yüklenmeden çalıştırılabilirler.
 */

/** Sayıyı okunur biçimde yaz. */
export function sayi(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** Süreyi "2 saat 5 dakika" gibi yazar. */
export function sureMetni(ms: number, gecmis = false): string {
  const t = Math.abs(ms);
  const dk = Math.floor(t / 60000);
  const sa = Math.floor(dk / 60);
  const gun = Math.floor(sa / 24);
  const yil = Math.floor(gun / 365);

  const parcalar: string[] = [];
  if (yil) parcalar.push(`${yil} yıl`);
  if (gun % 365) parcalar.push(`${gun % 365} gün`);
  if (sa % 24) parcalar.push(`${sa % 24} saat`);
  if (dk % 60) parcalar.push(`${dk % 60} dakika`);
  if (!parcalar.length) parcalar.push('birkaç saniye');

  const metin = parcalar.slice(0, 3).join(' ');
  return gecmis ? `${metin} önce` : metin;
}

/** Güvenli matematik: yalnız sayı, operatör ve parantez. */
export function matematik(ifade: string): string {
  const temiz = String(ifade || '').trim();
  if (!temiz) return '0';
  // Değerlendirmeden ÖNCE beyaz liste: harf veya çağrı geçemez.
  if (!/^[\d\s+\-*/%().,]+$/.test(temiz)) return '(math geçersiz)';
  if (temiz.length > 120) return '(math çok uzun)';
  try {
    // eslint-disable-next-line no-new-func
    const sonuc = Function(`"use strict";return (${temiz.replace(/,/g, '.')})`)();
    if (typeof sonuc !== 'number' || !Number.isFinite(sonuc)) return '(math geçersiz)';
    return sayi(sonuc);
  } catch {
    return '(math geçersiz)';
  }
}

/** JSON yolundan değer okur: `profile.coins`, `items[0].name`. */
export function jsonYolu(veri: unknown, yol: string): unknown {
  const parcalar = String(yol || '')
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);
  let o: any = veri;
  for (const p of parcalar) {
    if (o === null || o === undefined) return undefined;
    o = o[p];
  }
  return o;
}

/**
 * `+1`, `-10`, `5` gibi bir ifadeyi ayrıştırır.
 * İşaretli ise göreli (fark), değilse mutlak değerdir.
 */
export function sayacIfadesi(ham: string): { tur: 'fark' | 'mutlak' | 'oku'; deger: number } {
  const t = String(ham || '').trim();
  if (!t) return { tur: 'oku', deger: 0 };
  if (/^[+-]/.test(t)) {
    const n = Number(t);
    return Number.isFinite(n) ? { tur: 'fark', deger: n } : { tur: 'oku', deger: 0 };
  }
  const n = Number(t);
  return Number.isFinite(n) ? { tur: 'mutlak', deger: n } : { tur: 'oku', deger: 0 };
}
