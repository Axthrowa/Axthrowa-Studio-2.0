/**
 * AxBoT — panelden gelen moderasyon isteklerinin doğrulaması (saf)
 * Developed by AxthrowA
 *
 * Panelin izleyici kartındaki "zaman aşımı / kalıcı ban / banı kaldır"
 * düğmeleri GERÇEK platform eylemi yapar; gövde burada sıkı doğrulanır.
 */
import { KARA_LISTE_EYLEMLERI, type KaraListeEylemi } from './blacklist-rules.js';

export const MODERASYON_PLATFORMLARI = ['kick', 'twitch', 'youtube', 'trovo', 'tiktok', 'discord'] as const;
export type ModerasyonPlatformu = (typeof MODERASYON_PLATFORMLARI)[number];
export type ElleEylem = 'timeout' | 'ban' | 'unban';

/** Twitch'in izin verdiği en uzun zaman aşımı: 14 gün. */
export const EN_UZUN_ZAMAN_ASIMI_SN = 1_209_600;

export type ElleModerasyon =
  | { ok: true; platform: ModerasyonPlatformu; ad: string; sebep: string; saniye: number }
  | { ok: false; hata: string };

export function elleModerasyonCoz(govde: unknown, eylem: ElleEylem): ElleModerasyon {
  const g = (govde && typeof govde === 'object' ? govde : {}) as Record<string, unknown>;
  const platform = String(g.platform ?? '').trim().toLowerCase();
  if (!(MODERASYON_PLATFORMLARI as readonly string[]).includes(platform)) {
    return { ok: false, hata: 'Geçersiz platform' };
  }
  const ad = String(g.username ?? '').trim().replace(/^@+/, '');
  // Boşluk/denetim karakteri yok: platform komutlarına ek argüman sokulmasın
  if (!ad || ad.length > 60 || /[\s\u0000-\u001f\u007f]/.test(ad)) {
    return { ok: false, hata: 'Geçersiz kullanıcı adı' };
  }
  const sebep = String(g.sebep ?? g.reason ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, 200) || 'Moderatör kararı';
  let saniye = 0;
  if (eylem === 'timeout') {
    const n = Math.round(Number(g.saniye ?? g.seconds ?? 600));
    if (!Number.isFinite(n) || n < 1) return { ok: false, hata: 'Süre en az 1 saniye olmalı' };
    saniye = Math.min(EN_UZUN_ZAMAN_ASIMI_SN, n);
  }
  return { ok: true, platform: platform as ModerasyonPlatformu, ad, sebep, saniye };
}

/** Kalkan ayarı: yalnız bilinen alanlar, türüyle. `isActive` burada değişmez. */
export interface KalkanAyarGirdisi {
  autoClearRaidMessages?: boolean;
  minAccountAgeDays?: number;
  blockLinks?: boolean;
  blockCaps?: boolean;
  blockEmotes?: boolean;
  followerOnly?: boolean;
  subOnly?: boolean;
  karaListeEylemi?: KaraListeEylemi;
  platformdaSil?: boolean;
}

const MANTIKSAL = ['autoClearRaidMessages', 'blockLinks', 'blockCaps', 'blockEmotes', 'followerOnly', 'subOnly', 'platformdaSil'] as const;

export function kalkanAyariniCoz(govde: unknown): KalkanAyarGirdisi {
  const g = (govde && typeof govde === 'object' ? govde : {}) as Record<string, unknown>;
  const cikti: KalkanAyarGirdisi = {};
  for (const k of MANTIKSAL) {
    if (typeof g[k] === 'boolean') cikti[k] = g[k] as boolean;
  }
  if (g.minAccountAgeDays !== undefined) {
    const n = Math.round(Number(g.minAccountAgeDays));
    if (Number.isFinite(n)) cikti.minAccountAgeDays = Math.min(365, Math.max(0, n));
  }
  if (typeof g.karaListeEylemi === 'string' && (KARA_LISTE_EYLEMLERI as readonly string[]).includes(g.karaListeEylemi)) {
    cikti.karaListeEylemi = g.karaListeEylemi as KaraListeEylemi;
  }
  return cikti;
}
