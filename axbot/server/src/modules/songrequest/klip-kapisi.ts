/**
 * AxBoT — klip isteği ne zaman başlar?
 * Developed by AxthrowA
 *
 * Klip, çalan müziğin üstüne binmez: parça bitene kadar bekler, müzik klip boyunca
 * duraklatılır, klip bitince kaldığı yerden sürer. Kendisinden önce istenmiş şarkı
 * varsa önce o çalar (izleyici sırası).
 */
import type { CalanSarki } from '../muzik/spotify-saf.js';

/** Parçanın bitmesine bu kadar kala duraklatılır: sonraki şarkının başı kaçmasın */
export const KLIP_SON_MS = 1500;
/** Widget bu süredir sormadıysa OBS'te açık değildir: klip çalamayacaksa müzik de durmaz */
export const KLIP_WIDGET_MS = 10_000;
/** Süresi bilinmeyen / hiç bitmeyen yayın klibi sonsuza dek bekletmesin */
export const KLIP_EN_COK_BEKLEME_MS = 20 * 60_000;
/** Oynatıcı bitişi bildirmezse bu süreden sonra klibin gerçek süresine bakılır */
export const KLIP_TAKILDI_MS = 15 * 60_000;

export type KlipKarari = 'bekle' | 'baslat' | 'duraklat' | 'duraklat-son';

export interface KlipDurumu {
  calan: CalanSarki | null;
  /** Beklemeye başlarken çalan parça */
  ilkAnahtar: string;
  /** Klipten önce istenmiş, henüz başlamamış şarkı var */
  oncekiIstek: boolean;
  /** Çalan parça kuyruktaki bir istek (ona geçiş "parça bitti" sayılmaz) */
  istekCaliyor: boolean;
  widgetCanli: boolean;
  bekleyisMs: number;
  simdi: number;
}

export function parcaAnahtari(c: CalanSarki | null): string {
  return c?.title ? `${c.title}|${c.artist}` : '';
}

export function klipKarari(d: KlipDurumu): KlipKarari {
  if (!d.widgetCanli) return 'bekle';
  const c = d.calan;
  const caliyor = Boolean(c?.title && c.isPlaying);
  if (d.bekleyisMs >= KLIP_EN_COK_BEKLEME_MS) return caliyor ? 'duraklat' : 'baslat';
  if (d.oncekiIstek) return 'bekle';
  if (!caliyor || !c) return 'baslat';
  const konum = c.progress + Math.max(0, d.simdi - (Number(c.updatedAt) || d.simdi));
  if (c.duration > 0 && c.duration - konum <= KLIP_SON_MS) return 'duraklat-son';
  // Bitişi kaçırdık, müzik sonraki parçaya geçti
  if (d.ilkAnahtar && parcaAnahtari(c) !== d.ilkAnahtar && !d.istekCaliyor) return 'duraklat';
  return 'bekle';
}
