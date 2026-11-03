/**
 * Gömülü AxBoT çerçevesinden gelen `postMessage` isteklerinin doğrulaması.
 *
 * AxBoT iframe içinde `window.open` yapamadığı adresi üst pencereye
 * `{ type: "streamaxt:open-external", url }` olarak bildirir; panel adresi
 * işletim sisteminin tarayıcısında açar. Doğrulama olmadan panelde açık
 * HERHANGİ bir çerçeve ya da pencere tarayıcıda rastgele adres açtırabilirdi;
 * iki AxBoT görünümü aynı anda bağlıyken de adres iki kez açılırdı.
 * Bu yüzden yalnız bizim çerçevemizden (kaynak pencere + köken) ve yalnız
 * http(s) adresler kabul edilir.
 */

export const OPEN_EXTERNAL_TYPE = "streamaxt:open-external";
/** AxBoT'un "Resonance'ı aç" isteği: tarayıcı yerine panelin Müzik (Resonance) sekmesi açılır. */
export const OPEN_MUSIC_TYPE = "streamaxt:open-music";
/** Odak gömülü bottayken basılan Ctrl+K: paneli açan tuş çerçevenin dışına çıkmaz, bot bunu bildirir. */
export const KOMUT_PALETI_TYPE = "streamaxt:komut-paleti";

export type EmbedMessageEvent = {
  data: unknown;
  origin: string;
  source: unknown;
};

/** Beklenen köken: gömülen adresin `origin`'i; adres bozuksa `null`. */
export function frameOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Geçerli bir "dış bağlantı aç" isteğiyse açılacak adresi, değilse `null`
 * döner.
 */
export function openExternalRequest(
  ev: EmbedMessageEvent,
  frameWindow: unknown,
  expectedOrigin: string | null,
): string | null {
  if (!frameWindow || ev.source !== frameWindow) return null;
  if (!expectedOrigin || ev.origin !== expectedOrigin) return null;
  const d = ev.data as { type?: unknown; url?: unknown } | null;
  if (!d || typeof d !== "object" || d.type !== OPEN_EXTERNAL_TYPE || typeof d.url !== "string") return null;
  const url = d.url.trim();
  // Yalnız http(s); `javascript:`, `file:`, `ms-settings:` gibi şemalar açılmaz.
  if (!/^https?:\/\/[^\s]+$/i.test(url)) return null;
  return url;
}

/** Yalnız bizim çerçevemizden ve AxBoT kökeninden gelen "Komut paletini aç" isteği mi. */
export function komutPaletiRequest(ev: EmbedMessageEvent, frameWindow: unknown, expectedOrigin: string | null): boolean {
  if (!frameWindow || ev.source !== frameWindow) return false;
  if (!expectedOrigin || ev.origin !== expectedOrigin) return false;
  return (ev.data as { type?: unknown } | null)?.type === KOMUT_PALETI_TYPE;
}

/** Yalnız bizim çerçevemizden ve AxBoT kökeninden gelen "Müzik sekmesini aç" isteği mi. */
export function openMusicRequest(ev: EmbedMessageEvent, frameWindow: unknown, expectedOrigin: string | null): boolean {
  if (!frameWindow || ev.source !== frameWindow) return false;
  if (!expectedOrigin || ev.origin !== expectedOrigin) return false;
  return (ev.data as { type?: unknown } | null)?.type === OPEN_MUSIC_TYPE;
}

/**
 * Gömülü Resonance'ın panelden açmasını isteyebileceği adresler.
 *
 * Müzik kartı `{ source: "resonance", type: "open-external" }` mesajını
 * kaynağına bakmadan kabul ediyor (o dosya bu projede değiştirilmiyor);
 * paneldeki HERHANGİ bir çerçeve (YouTube/Kick oynatıcısı dahil) aynı mesajla
 * tarayıcıda rastgele adres açtırabilirdi. Liste, yerel sunucunun
 * `/api/open-external` ucundaki izin listesiyle aynıdır.
 */
const RESONANCE_LINK_PREFIXES = [
  "https://accounts.spotify.com/",
  "https://accounts.google.com/",
  "https://developer.spotify.com/",
  "https://id.kick.com/",
  "https://kick.com/",
  "https://www.kick.com/",
  "https://id.twitch.tv/",
  "https://twitch.tv/",
] as const;

export function resonanceLinkAllowed(url: unknown): boolean {
  if (typeof url !== "string") return false;
  const u = url.trim();
  if (/[\s"<>]/.test(u)) return false;
  return RESONANCE_LINK_PREFIXES.some((p) => u.startsWith(p));
}
