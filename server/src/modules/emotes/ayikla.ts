/**
 * AxBoT — sohbet metninden emote ayıklama (kappagen ve sohbet katmanı)
 * Developed by AxthrowA
 */

export interface EmoteParcasi {
  ad: string;
  /** Görsel adresi (Kick / 7TV); emoji için yok */
  url?: string;
}

// Ten rengi (1F3FB–1F3FF), varyasyon seçici (FE0F) ve ZWJ (200D) birleşimleri tek emoji sayılır
const TON = '[\\u{1F3FB}-\\u{1F3FF}]?';
const EMOJI = new RegExp(`\\p{Extended_Pictographic}${TON}(?:\\u{FE0F}|\\u{200D}\\p{Extended_Pictographic}${TON})*`, 'gu');

export function kickEmoteAdresi(kimlik: string): string {
  return `https://files.kick.com/emotes/${kimlik}/fullsize`;
}

/**
 * Metindeki emote'lar sırayla: Kick `[emote:id:ad]`, 7TV adı (haritada
 * varsa) ve Unicode emoji. En çok `enCok` parça.
 */
export function emoteleriAyikla(metin: string, yediTv: ReadonlyMap<string, string>, enCok = 8): EmoteParcasi[] {
  const out: EmoteParcasi[] = [];
  if (!metin) return out;
  // Kick işaretlemesi ve kelimeler metindeki SIRAYLA işlenir
  for (const parca of metin.split(/(\[emote:\d{1,12}:[^\]\s]{1,60}\])|\s+/)) {
    if (out.length >= enCok) break;
    if (!parca) continue;
    const kick = parca.match(/^\[emote:(\d{1,12}):([^\]\s]{1,60})\]$/);
    if (kick) {
      out.push({ ad: kick[2], url: kickEmoteAdresi(kick[1]) });
      continue;
    }
    const kelime = parca;
    const yedi = yediTv.get(kelime);
    if (yedi) {
      out.push({ ad: kelime, url: yedi });
      continue;
    }
    for (const m of kelime.matchAll(EMOJI)) {
      if (out.length >= enCok) break;
      out.push({ ad: m[0] });
    }
  }
  return out;
}
