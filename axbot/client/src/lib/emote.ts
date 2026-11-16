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
  return /^https:\/\/(files\.kick\.com\/emotes\/\d+\/fullsize|cdn\.7tv\.app\/emote\/[A-Za-z0-9]+\/\dx\.webp)$/.test(url) ? url : undefined;
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
