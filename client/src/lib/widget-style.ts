/**
 * StreamAxT widget görünüm yardımcıları
 * Developed by AxthrowA
 *
 * Renk seçicileri hex tutar, saydamlık ayrı bir alandır; bu ikisini birleştiren
 * dönüşüm her widget'ta tekrar yazılıyordu. Hizalama ve sayı biçimlemesi de
 * aynı şekilde kopyalanıyordu — hepsi burada toplandı.
 */

/** Hex + opaklık → rgba(). Geçersiz girdi siyaha düşer, widget çökmez. */
export function rgba(hex: string | undefined, opaklik: number | string | undefined = 1): string {
  const h = String(hex || '#000000').replace('#', '');
  const t = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0');
  const r = parseInt(t.slice(0, 2), 16) || 0;
  const g = parseInt(t.slice(2, 4), 16) || 0;
  const b = parseInt(t.slice(4, 6), 16) || 0;
  const a = Math.max(0, Math.min(1, Number(opaklik ?? 1)));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** 'left' | 'center' | 'right' → flexbox karşılığı. */
export function yatay(deger: string | undefined): 'flex-start' | 'center' | 'flex-end' {
  if (deger === 'center') return 'center';
  if (deger === 'right') return 'flex-end';
  return 'flex-start';
}

/** 'top' | 'center' | 'bottom' → flexbox karşılığı. */
export function dikey(deger: string | undefined): 'flex-start' | 'center' | 'flex-end' {
  if (deger === 'center') return 'center';
  if (deger === 'bottom') return 'flex-end';
  return 'flex-start';
}

/** Sayıyı okunur yaz: 1.234 / 12,3 B / 1,2 M. */
export function sayiYaz(n: number, kisalt = false): string {
  const s = Number(n) || 0;
  if (!kisalt || Math.abs(s) < 1000) return s.toLocaleString('tr-TR');
  if (Math.abs(s) < 1_000_000) return `${(s / 1000).toFixed(1).replace('.', ',')} B`;
  return `${(s / 1_000_000).toFixed(1).replace('.', ',')} M`;
}

/** "🪙,💰,💵" → ['🪙','💰','💵']; boş girdi yedek listeye düşer. */
export function emojiListesi(ham: string | undefined, yedek: string[]): string[] {
  const parcalar = String(ham || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  return parcalar.length ? parcalar : yedek;
}

/** Saniyeyi 12:34 / 1:02:03 biçimine çevirir. */
export function sureYaz(toplamSaniye: number): string {
  const t = Math.max(0, Math.floor(Number(toplamSaniye) || 0));
  const sa = Math.floor(t / 3600);
  const dk = Math.floor((t % 3600) / 60);
  const sn = t % 60;
  if (sa > 0) return `${sa}:${String(dk).padStart(2, '0')}:${String(sn).padStart(2, '0')}`;
  return `${dk}:${String(sn).padStart(2, '0')}`;
}

/** Önizleme kipi: prop ya da adres satırındaki ?preview=1. */
/**
 * Widget yazı tipini Google Fonts'tan yükler (OBS tarayıcısında kurulu olmayabilir).
 * Yalnız FONTS listesindeki adlar: ayardan gelen keyfi değer adrese yazılmaz.
 */
export function fontuYukle(ad: string | undefined, liste: readonly string[]): void {
  if (!ad || !liste.includes(ad) || typeof document === 'undefined') return;
  const id = 'axt-font-' + ad.replace(/\s+/g, '-');
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(ad).replace(/%20/g, '+')}&display=swap`;
  document.head.appendChild(link);
}

export function onizlemeKipi(prop?: boolean): boolean {
  if (prop) return true;
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('preview') === '1';
}

/**
 * Sunucunun portu: sayfa sunucunun kendisinden açıldığı için onun portudur;
 * yalnız vite geliştirme portları (5173/3000) varsayılan 3001'e çevrilir.
 */
export function sunucuPortu(konum: { port: string } = window.location): string {
  return konum.port === '5173' || konum.port === '3000' ? '3001' : konum.port || '3001';
}

/** Overlay WebSocket adresi. */
export function wsAdresi(tur = 'all'): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.hostname}:${sunucuPortu()}/ws?type=${tur}`;
}
