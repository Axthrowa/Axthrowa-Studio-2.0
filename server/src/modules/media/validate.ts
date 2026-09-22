/**
 * StreamAxT — medya doğrulama (saf)
 * Developed by AxthrowA
 *
 * Dosya sistemi ve veritabanı erişimi YOK: test edilebilir olsun diye
 * ayrıldı. Güvenlik kararları (hangi tür izinli, içerik imzası, dosya adı
 * temizliği) burada.
 */

export type MedyaTuru = 'image' | 'audio' | 'video';

export interface MedyaOgesi {
  id: string;
  ad: string;
  tur: MedyaTuru;
  dosya: string;
  boyut: number;
  mime: string;
  olusturma: number;
  /** Tarayıcıdan erişilecek yol. */
  url: string;
}

/** Tek dosya üst sınırı (BotRix ücretsiz planla aynı). */
export const MAKS_BOYUT = 5 * 1024 * 1024;

/** Kütüphane toplam üst sınırı — disk dolmasın. */
export const MAKS_TOPLAM = 500 * 1024 * 1024;

/**
 * İzin verilen türler.
 *
 * **SVG kasten YOK**: SVG içine script gömülebilir ve overlay sayfamızda
 * çalışır (stored XSS). Raster görseller ve ses/video güvenli.
 */
export const IZINLI: Record<string, { tur: MedyaTuru; uzanti: string }> = {
  'image/png': { tur: 'image', uzanti: '.png' },
  'image/jpeg': { tur: 'image', uzanti: '.jpg' },
  'image/gif': { tur: 'image', uzanti: '.gif' },
  'image/webp': { tur: 'image', uzanti: '.webp' },
  'audio/mpeg': { tur: 'audio', uzanti: '.mp3' },
  'audio/wav': { tur: 'audio', uzanti: '.wav' },
  'audio/ogg': { tur: 'audio', uzanti: '.ogg' },
  'audio/webm': { tur: 'audio', uzanti: '.weba' },
  'video/mp4': { tur: 'video', uzanti: '.mp4' },
  'video/webm': { tur: 'video', uzanti: '.webm' }
};

/**
 * Dosyanın gerçek türünü İÇERİĞİNDEN doğrular.
 *
 * İstemcinin bildirdiği MIME'a güvenilmez: `.png` diye gönderilen bir HTML
 * dosyası overlay'de çalıştırılabilir olurdu.
 */
export function imzadanTur(bayt: Buffer): string | null {
  const b = bayt;
  if (b.length < 12) return null;

  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.subarray(0, 3).toString('ascii') === 'GIF') return 'image/gif';
  if (b.subarray(0, 4).toString('ascii') === 'RIFF') {
    const alt = b.subarray(8, 12).toString('ascii');
    if (alt === 'WEBP') return 'image/webp';
    if (alt === 'WAVE') return 'audio/wav';
  }
  if (b.subarray(0, 4).toString('ascii') === 'OggS') return 'audio/ogg';
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return 'audio/mpeg'; // ID3
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return 'audio/mpeg'; // MPEG frame
  if (b.subarray(4, 8).toString('ascii') === 'ftyp') return 'video/mp4';
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'video/webm'; // Matroska

  return null;
}

/** Dosya adını güvenli hâle getirir — dizin çıkışı engellenir. */
export function guvenliAd(ham: string): string {
  const temiz = String(ham || '')
    .replace(/[\\/]/g, '_')
    .replace(/\.\./g, '_')
    .replace(/[^\p{L}\p{N}._ -]/gu, '')
    .trim()
    .slice(0, 80);
  // Yalnız ayraç kalmışsa ("///" → "___") anlamlı bir ad yoktur.
  return /[\p{L}\p{N}]/u.test(temiz) ? temiz : 'dosya';
}

