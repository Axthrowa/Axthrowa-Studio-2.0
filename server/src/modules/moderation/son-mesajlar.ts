/**
 * StreamAxT — son sohbet mesajları tamponu (`!nuke`, `!vanish`)
 * Developed by AxthrowA
 *
 * Yaygın botlarda gözlenen (herkese açık belgeler, 2026-10) toplu moderasyon:
 *  - `!nuke <kalıp> [saniye]`: son mesajlarda kalıba (düz / `*` / `~/regex/`)
 *    uyanları siler; süre verilirse yazanlara zaman aşımı uygular.
 *  - `!vanish`: izleyici kendi son mesajlarını sildirir.
 * Bu dosya saf: tampon + hedef seçimi. Platform çağrıları komut tarafında.
 */
import { kelimeEslesmesi, kelimeKuraliDerle } from '../automod/kelime-kurali.js';

export interface KayitliMesaj {
  id: string;
  platform: string;
  kullanici: string;
  gorunenAd: string;
  metin: string;
  zaman: number;
  /** Yayıncı/mod/bot mesajları toplu moderasyondan muaf. */
  muaf: boolean;
}

export const TAMPON_BOYUTU = 500;
export const NUKE_PENCERESI_MS = 3 * 60 * 1000;
export const NUKE_EN_COK_MESAJ = 60;

export class SonMesajlar {
  private liste: KayitliMesaj[] = [];

  ekle(m: KayitliMesaj): void {
    if (!m.id) return;
    this.liste.push(m);
    if (this.liste.length > TAMPON_BOYUTU) this.liste.splice(0, this.liste.length - TAMPON_BOYUTU);
  }

  tumu(): KayitliMesaj[] {
    return this.liste;
  }

  /** Silinen/işlenen mesajları tampondan çıkar (ikinci `!nuke` aynılarını denemesin). */
  cikar(idler: Set<string>): void {
    this.liste = this.liste.filter((m) => !idler.has(m.id));
  }
}

/** `!nuke` hedefleri: pencere içinde, muaf olmayan, kalıba uyan mesajlar (yeniden eskiye). */
export function nukeHedefleri(
  mesajlar: KayitliMesaj[],
  kalip: string,
  simdi: number,
  pencereMs = NUKE_PENCERESI_MS,
  platform?: string
): { hedefler: KayitliMesaj[]; gecersiz: boolean } {
  const kural = kelimeKuraliDerle(kalip);
  if (!kural) return { hedefler: [], gecersiz: true };
  const hedefler: KayitliMesaj[] = [];
  for (let i = mesajlar.length - 1; i >= 0 && hedefler.length < NUKE_EN_COK_MESAJ; i--) {
    const m = mesajlar[i];
    if (simdi - m.zaman > pencereMs) break;
    if (m.muaf || (platform && m.platform !== platform)) continue;
    if (kelimeEslesmesi([kural], m.metin)) hedefler.push(m);
  }
  return { hedefler, gecersiz: false };
}

/** `!vanish`: kişinin pencere içindeki kendi mesajları. */
export function kendiMesajlari(
  mesajlar: KayitliMesaj[],
  kullanici: string,
  platform: string,
  simdi: number,
  pencereMs = NUKE_PENCERESI_MS
): KayitliMesaj[] {
  const k = kullanici.toLowerCase();
  return mesajlar.filter((m) => m.platform === platform && m.kullanici.toLowerCase() === k && simdi - m.zaman <= pencereMs);
}

/** `!nuke` argümanları: son sayı süre (saniye), geri kalanı kalıp. */
export function nukeArgumanlari(args: string[]): { kalip: string; sureSn: number } {
  const a = [...args];
  let sureSn = 0;
  if (a.length > 1 && /^\d{1,6}$/.test(a[a.length - 1])) sureSn = Number(a.pop());
  return { kalip: a.join(' ').trim(), sureSn };
}

export const sonMesajlar = new SonMesajlar();
