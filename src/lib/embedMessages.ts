/**
 * Gömülü AxBoT çerçevesinden gelen `postMessage` isteklerinin doğrulaması.
 *
 * AxBoT iframe içinde `window.open` yapamadığı adresi üst pencereye
 * `{ type: "axbot:open-external", url }` olarak bildirir; panel adresi
 * işletim sisteminin tarayıcısında açar. Doğrulama olmadan panelde açık
 * HERHANGİ bir çerçeve ya da pencere tarayıcıda rastgele adres açtırabilirdi;
 * iki AxBoT görünümü aynı anda bağlıyken de adres iki kez açılırdı.
 * Bu yüzden yalnız bizim çerçevemizden (kaynak pencere + köken) ve yalnız
 * http(s) adresler kabul edilir.
 */

export const OPEN_EXTERNAL_TYPE = "axbot:open-external";
/** AxBoT'un "Resonance'ı aç" isteği: tarayıcı yerine panelin Müzik (Resonance) sekmesi açılır. */
export const OPEN_MUSIC_TYPE = "axbot:open-music";
/** Odak gömülü bottayken basılan Ctrl+K: paneli açan tuş çerçevenin dışına çıkmaz, bot bunu bildirir. */
export const KOMUT_PALETI_TYPE = "axbot:komut-paleti";
/** AxBoT gömülünce Studio temasını ister. */
export const TEMA_ISTE_TUR = "studio-tema-iste";
/** Bot içinde Esc: odak çerçeveden çıkıp Studio menüsüne döner. Sözleşmenin tamamı: docs/GOMULU_SOZLESME.md */
export const ODAK_BIRAK_TYPE = "axbot:odak-birak";
/** Bot sunucusu kapandı: gömülü sayfa "Başlat"a basınca Studio botu başlatır (UI-5) */
export const BOT_BASLAT_TYPE = "axbot:baslat";
/** Komut paletinden seçilen bot ayarı AxBotHost'a bu pencere olayıyla haber verilir (istek: bekleyenBotAyariAl) */
export const BOT_AYAR_OLAYI = "studio:bot-ayar";

/** Studio → bot: ayarın yerine kaydır, vurgula, denetimine odaklan */
export function ayaraGitMesaji(ayar: string, sekme?: string) {
  return sekme ? { tur: "ayara-git" as const, ayar, sekme } : { tur: "ayara-git" as const, ayar };
}
let bekleyenAyar: { ayar: string; sekme?: string } | null = null;
/** Komut paleti bot ayarı seçti: istek, çerçeve yüklenip görünür olunca AxBotHost tarafından bir kez gönderilir */
export function botAyariIste(ayar: string, sekme?: string) {
  bekleyenAyar = { ayar, sekme };
  window.dispatchEvent(new Event(BOT_AYAR_OLAYI));
}
export function bekleyenBotAyariAl() {
  const b = bekleyenAyar;
  bekleyenAyar = null;
  return b;
}

/** Studio → bot: odak Studio'dayken bot sayfasında basılan Ctrl+Z */
export const GERI_AL_MESAJI = { tur: "geri-al" as const };

/** Ctrl+Z bota gitsin mi: odak yazı alanındaysa tarayıcının kendi geri alması kalır */
export function geriAlBotaGider(e: { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }, odak: { tagName?: string; isContentEditable?: boolean } | null): boolean {
  if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== "z") return false;
  const ad = (odak?.tagName || "").toUpperCase();
  return !(ad === "INPUT" || ad === "TEXTAREA" || ad === "SELECT" || ad === "IFRAME" || odak?.isContentEditable);
}

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

/** Yalnız bizim çerçevemizden ve AxBoT kökeninden gelen "odağı bırak" bildirimi mi. */
export function odakBirakRequest(ev: EmbedMessageEvent, frameWindow: unknown, expectedOrigin: string | null): boolean {
  if (!frameWindow || ev.source !== frameWindow) return false;
  if (!expectedOrigin || ev.origin !== expectedOrigin) return false;
  return (ev.data as { type?: unknown } | null)?.type === ODAK_BIRAK_TYPE;
}

/** Yalnız bizim çerçevemizden ve AxBoT kökeninden gelen "botu başlat" isteği mi. */
export function botBaslatRequest(ev: EmbedMessageEvent, frameWindow: unknown, expectedOrigin: string | null): boolean {
  if (!frameWindow || ev.source !== frameWindow) return false;
  if (!expectedOrigin || ev.origin !== expectedOrigin) return false;
  return (ev.data as { type?: unknown } | null)?.type === BOT_BASLAT_TYPE;
}

/** Yalnız bizim çerçevemizden gelen "temayı gönder" isteği mi. */
export function temaIstegi(ev: EmbedMessageEvent, frameWindow: unknown, expectedOrigin: string | null): boolean {
  if (!frameWindow || ev.source !== frameWindow) return false;
  if (!expectedOrigin || ev.origin !== expectedOrigin) return false;
  return (ev.data as { tur?: unknown } | null)?.tur === TEMA_ISTE_TUR;
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
