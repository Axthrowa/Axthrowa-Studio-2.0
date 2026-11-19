/**
 * AxBoT — sohbet metninden emote ayıklama (istemci)
 * Developed by AxthrowA
 *
 * Kick emote'u `[emote:<id>:<ad>]` olarak gelir; 7TV emote'u düz kelimedir
 * (adı canlı 7TV haritasında aranır); Unicode emoji metin olarak kalır.
 * Sunucudaki modules/emotes/ayikla.ts ile aynı kurallar.
 */

export interface EmoteParca {
  ad: string;
  url?: string;
}

const KICK_TEK = /^\[emote:(\d{1,12}):([^\]\s]{1,60})\]$/;
const TON = '[\\u{1F3FB}-\\u{1F3FF}]?';
const EMOJI = new RegExp(`\\p{Extended_Pictographic}${TON}(?:\\u{FE0F}|\\u{200D}\\p{Extended_Pictographic}${TON})*`, 'gu');

export function kickEmoteAdresi(id: string): string {
  return `https://files.kick.com/emotes/${id}/fullsize`;
}

/** Yalnız bilinen emote sunucularından görsel (sohbetten gelen veri) */
export function guvenliEmoteAdresi(url?: string): string | undefined {
  if (!url) return undefined;
  return /^https:\/\/(files\.kick\.com\/emotes\/\d+\/fullsize|cdn\.7tv\.app\/emote\/[A-Za-z0-9]+\/\dx(?:_static)?\.webp|cdn\.betterttv\.net\/emote\/[a-f0-9]{24}\/(?:[123]x|static\/2x\.webp)|cdn\.frankerfacez\.com\/[\w/.-]+)$/.test(url) ? url : undefined;
}

export function emoteleriAyikla(metin: string, yediTv: ReadonlyMap<string, string>, enCok = 8): EmoteParca[] {
  const out: EmoteParca[] = [];
  if (!metin) return out;
  for (const parca of String(metin).split(/(\[emote:\d{1,12}:[^\]\s]{1,60}\])|\s+/)) {
    if (out.length >= enCok) break;
    if (!parca) continue;
    const k = parca.match(KICK_TEK);
    if (k) {
      out.push({ ad: k[2], url: kickEmoteAdresi(k[1]) });
      continue;
    }
    const yedi = yediTv.get(parca);
    if (yedi) {
      out.push({ ad: parca, url: yedi });
      continue;
    }
    for (const m of parca.matchAll(EMOJI)) {
      if (out.length >= enCok) break;
      out.push({ ad: m[0] });
    }
  }
  return out;
}

/**
 * Emote gölgesi: `filter: drop-shadow` yerine filtresiz degrade halka. Filtre hareketli (GIF/WebP) emote'un her
 * karesinde yeniden taranıyordu (18 Kasım ölçümü: tarama ~3 kat, 60 → 20-30 FPS). Halka bir kez taranır ve
 * emote'la birlikte kayar. Emote'un arkasında, kutusunu her yönde %14 aşan bir katman olarak kullanılır.
 */
export const EMOTE_GOLGESI =
  'radial-gradient(circle at 50% 56%, rgba(0,0,0,.42) 0%, rgba(0,0,0,.24) 38%, rgba(0,0,0,0) 66%)';
