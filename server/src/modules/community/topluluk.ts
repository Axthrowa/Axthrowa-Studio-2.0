/**
 * AxBoT — topluluk özellikleri: kappagen, emote piramidi, emote bingo, votekick
 * Developed by AxthrowA
 *
 * Akış (pipeline) moderasyondan GEÇMİŞ her mesaj için `toplulukMesaji`
 * çağırır. Sohbete yazılacak yanıtlar döner; overlay olayları burada yayınlanır.
 * Sohbete yazan özellikler (piramit, bingo, votekick) varsayılan KAPALIDIR.
 */
import type { ChatMessagePayload } from '../../core/event-bus.js';
import { settingsCache } from '../../core/settings-cache.js';
import { Bingo, PiramitIzci, Votekick, emoteAdlari } from './oyunlar.js';
import { emoteleriAyikla, type EmoteParcasi } from '../emotes/ayikla.js';
import { yediTv } from '../emotes/yedi-tv.js';

/** Ayardan sınırlı tam sayı */
export function ayarSayi(anahtar: string, varsayilan: number, min: number, max: number): number {
  const n = Math.floor(Number(settingsCache.get(anahtar, String(varsayilan))));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : varsayilan;
}

export const votekick = new Votekick(() => ({
  esik: ayarSayi('votekick_threshold', 5, 1, 100),
  pencereMs: ayarSayi('votekick_window', 60, 10, 600) * 1000,
  hedefBeklemeMs: 300_000
}));
export const piramit = new PiramitIzci();
export const bingo = new Bingo();

const GIZLI_HESAP = new Set([
  'nightbot', 'streamelements', 'streamlabs', 'moobot', 'fossabot', 'botrix', 'botaxt', 'sesbot', 'wizebot', 'sery_bot'
]);
const emoteBekleme = new Map<string, number>();

// Kappagen: saniyede en çok ~25 emote overlay'e gider (sohbet seli overlay'i boğmasın)
const KOVA_KAPASITE = 25;
let kova = KOVA_KAPASITE;
let kovaZaman = Date.now();
function kovadanAl(n: number): number {
  const simdi = Date.now();
  kova = Math.min(KOVA_KAPASITE, kova + ((simdi - kovaZaman) / 1000) * KOVA_KAPASITE);
  kovaZaman = simdi;
  const al = Math.min(n, Math.floor(kova));
  kova -= al;
  return al;
}

let wsYayin: ((payload: any) => void) | null = null;
async function yayinla(payload: any) {
  if (!wsYayin) {
    const { wsHub } = await import('../../ws/server.js');
    wsYayin = (p) => wsHub.broadcastTo(['all'], p);
  }
  wsYayin(payload);
}

/** 7TV haritasını tazeler (önbellekliyse anında döner). */
export function yediTvTazele(): void {
  if (!settingsCache.getBoolean('seventv_enabled', true)) return;
  void import('../../platforms/kick.js')
    .then(({ kickPlatform }) => yediTv.getir(kickPlatform.getStatus().channel || null))
    .catch(() => {});
}

/** Overlay'e emote patlaması gönderir (kappagen). */
export function kappagenGonder(emoteler: EmoteParcasi[], patlama: boolean): void {
  const adet = patlama ? emoteler.length : kovadanAl(emoteler.length);
  if (adet <= 0) return;
  void yayinla({ type: 'kappagen', emotes: emoteler.slice(0, adet), patlama }).catch(() => {});
}

export function metindenEmoteler(metin: string, enCok = 8): EmoteParcasi[] {
  return emoteleriAyikla(metin, settingsCache.getBoolean('seventv_enabled', true) ? yediTv.harita() : new Map(), enCok);
}

/** Moderasyondan geçmiş sohbet mesajı. Sohbete yazılacak yanıtları döner. */
export function toplulukMesaji(message: ChatMessagePayload, ekle?: (puan: number, kullanici: string) => void): string[] {
  const yanitlar: string[] = [];
  const metin = String(message.message || '');
  if (message.user.isSelf) return yanitlar;
  const hesap = String(message.user.username || '').toLowerCase();
  if (GIZLI_HESAP.has(hesap)) return yanitlar;
  yediTvTazele();

  // Kappagen: sohbetteki emote'lar overlay'de uçar (yalnız overlay — sohbete yazmaz)
  if (settingsCache.getBoolean('kappagen_chat_enabled', true) && !metin.startsWith('!')) {
    const simdi = Date.now();
    if (simdi - (emoteBekleme.get(hesap) || 0) >= 4000) {
      emoteBekleme.set(hesap, simdi);
      if (emoteBekleme.size > 4000) emoteBekleme.delete(emoteBekleme.keys().next().value as string);
      const e = metindenEmoteler(metin, 4);
      if (e.length) kappagenGonder(e, false);
    }
  }

  const duz = emoteAdlari(metin);

  // Emote bingo: gizli emote'u ilk yazan kazanır
  if (bingo.acikMi()) {
    const r = bingo.tahmin(duz);
    if (r) {
      if (r.odul > 0 && ekle) ekle(r.odul, message.user.username);
      yanitlar.push(
        `🎯 BINGO! @${message.user.displayName} gizli emote'u buldu: ${r.emote}` + (r.odul > 0 ? ` (+${r.odul} puan)` : '')
      );
    }
  }

  // Emote piramidi
  if (settingsCache.getBoolean('pyramid_enabled', false)) {
    const y = piramit.mesaj(message.user.username, duz, ayarSayi('pyramid_min', 3, 3, 20));
    if (y) {
      const sablon = settingsCache.get('pyramid_message', '🔺 @{user} {height} katlı bir emote piramidi kurdu!');
      yanitlar.push(
        sablon.replace(/\{user\}/g, message.user.displayName || message.user.username).replace(/\{height\}/g, String(y)).slice(0, 400)
      );
    }
  } else {
    piramit.sifirla();
  }
  return yanitlar;
}
