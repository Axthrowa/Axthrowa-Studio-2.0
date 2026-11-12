/**
 * Sırayla dönen widget'ların ortak mantığı (sosyal medya, sponsor).
 * Developed by AxthrowA
 */
import { useCallback, useEffect, useState } from 'react';
import { hareketAnahtari, type AnimAsamasi } from './animations.js';

export interface DonguDurumu {
  i: number;
  asama: AnimAsamasi;
}

/** Süre yazılmamış video bitişini bildirmezse döngü burada takılmasın. */
export const VIDEO_UST_MS = 30 * 60 * 1000;
const ENKISA_GORUNUM_MS = 1000;
const GIRIS_KARESI_MS = 40;

/** Görünür → çıkış → sıradaki; tur sonunda bekleme varsa gizli kalır. */
export function donguIlerle(d: DonguDurumu, n: number, beklemeMs: number): DonguDurumu {
  switch (d.asama) {
    case 'entering':
      return { ...d, asama: 'visible' };
    case 'visible':
      return { ...d, asama: 'exiting' };
    case 'exiting': {
      const son = d.i + 1 >= n;
      if (son && beklemeMs > 0) return { i: 0, asama: 'hidden' };
      return { i: son ? 0 : d.i + 1, asama: 'entering' };
    }
    default:
      return { i: 0, asama: 'entering' };
  }
}

export function asamaSuresi(asama: AnimAsamasi, gorunumMs: number, beklemeMs: number, gecisMs: number): number {
  if (asama === 'visible') return Math.max(ENKISA_GORUNUM_MS, gorunumMs);
  if (asama === 'exiting') return gecisMs;
  if (asama === 'hidden') return beklemeMs;
  return GIRIS_KARESI_MS;
}

/**
 * Hesap/görsel değişince ve çıkışta öğe baştan kurulur. Aynı animasyon adı
 * durunca tarayıcı hareketi yeniden başlatmıyor; kart bir anda beliriyordu.
 * Giriş ile görünür aynı anahtar: 40 ms'lik geçiş animasyonu yarıda kesmesin.
 */
export function donenSahneAnahtari(i: number, asama: string, ayar: Record<string, any>): string {
  const yon = asama === 'exiting' ? 'cikis' : asama === 'hidden' ? 'gizli' : 'giris';
  return `${i}:${yon}:${hareketAnahtari(ayar)}`;
}

/** Dönen widget'larda çıkışta oynayacak animasyon: 'ayni' (ya da boş) girişin tersi demek */
export function asamaAnimasyonu(s: { animation?: unknown; exitAnimation?: unknown }, asama: string): string {
  const cikis = String(s.exitAnimation || 'ayni');
  return asama === 'exiting' && cikis !== 'ayni' ? cikis : String(s.animation || 'fade');
}

/**
 * Tek öğe ve bekleme yoksa ekranda sabit kalır. Sayaç yalnız sayılara bağlı:
 * ayar nesnesi yenilense de süre baştan başlamaz.
 */

export function useDongu(n: number, gorunumMs: (i: number) => number, beklemeMs: number, gecisMs: number) {
  const [d, setD] = useState<DonguDurumu>({ i: 0, asama: 'entering' });
  const i = n > 0 ? d.i % n : 0;
  const sure = asamaSuresi(d.asama, d.asama === 'visible' ? gorunumMs(i) : 0, beklemeMs, gecisMs);
  const sabit = n <= 1 && beklemeMs <= 0 && d.asama === 'visible';

  useEffect(() => {
    if (n <= 0 || sabit) return;
    const t = setTimeout(() => setD((x) => donguIlerle(x, n, beklemeMs)), sure);
    return () => clearTimeout(t);
  }, [d, n, sure, beklemeMs, sabit]);

  /** Video bitti ya da dosya açılmadı: süreyi beklemeden geç. */
  const gec = useCallback(() => setD((x) => (x.asama === 'visible' || x.asama === 'entering' ? { ...x, asama: 'exiting' } : x)), []);

  return { i, asama: d.asama, gec, sabit: n <= 1 && beklemeMs <= 0 };
}

/** Profil adresi yapıştırılsa da ekranda yalnız `@ad` görünsün. Oyun hesapları (Ad#TAG) olduğu gibi yazılır. */
export function hesapMetni(platform: string | undefined, girdi: string | undefined, oyun = false): string {
  const ham = String(girdi || '').trim().replace(/^https?:\/\/(www\.)?/i, '').replace(/\/+$/, '');
  if (!ham) return '';
  if (platform === 'discord' || platform === 'diger') return ham;
  if (oyun) return ham.includes('/') ? ham.split('/').pop() || '' : ham.replace(/^@/, '');
  // Yalnız çıplak site adresi (instagram.com) boş sayılır; noktalı kullanıcı adları (ad.soyad, ad.bsky.social) kalır
  const siteAdi = /^[a-z0-9-]+\.(com|tv|gg|net|org|app|me|co)$/i.test(ham);
  const ad = (ham.includes('/') ? ham.slice(ham.indexOf('/') + 1).split('/').pop() || '' : siteAdi ? '' : ham).replace(/^@/, '');
  return ad ? `@${ad}` : '';
}

export interface SponsorOgesi {
  url: string;
  tur?: 'image' | 'video';
  /** Saniye. 0: görselde varsayılan süre, videoda bitene kadar. */
  sure?: number;
  metin?: string;
}

/** Yalnız medya kütüphanesi ve web adresleri (`javascript:`, `file:` çizilmez). */
export function guvenliMedya(url: string | undefined): string {
  const u = String(url || '').trim();
  if (/^https?:\/\/\S+$/i.test(u)) return u;
  return /^\/api\/media\/[A-Za-z0-9_-]+\/dosya$/.test(u) ? u : '';
}

export function medyaTuru(url: string | undefined): 'image' | 'video' {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(String(url || '')) ? 'video' : 'image';
}

export function ogeTuru(o: SponsorOgesi): 'image' | 'video' {
  return o.tur === 'video' || o.tur === 'image' ? o.tur : medyaTuru(o.url);
}

export function ogeSuresiMs(o: SponsorOgesi, varsayilanSn: number): number {
  const sn = Number(o.sure) || 0;
  if (sn > 0) return sn * 1000;
  return ogeTuru(o) === 'video' ? VIDEO_UST_MS : (Number(varsayilanSn) || 10) * 1000;
}
