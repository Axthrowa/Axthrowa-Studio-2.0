import { safeMediaUrl, sanitizePlainText } from "./sanitizeChat";

/** Sohbet mesajının yazı + emote parçaları */
export type ChatPart =
  | { type: "text"; text: string }
  | { type: "emote"; url: string; name: string };

/** Parçalardan düz metin (arama / boş mesaj kontrolü / kopyalama) */
export function partsToText(parts: ChatPart[]): string {
  return parts
    .map((p) => (p.type === "text" ? p.text : p.name))
    .join("")
    .trim();
}

export function textPart(text: string): ChatPart[] {
  const clean = sanitizePlainText(text);
  return clean ? [{ type: "text", text: clean }] : [];
}

/** Sunucudan gelen ham parça dizisini doğrular (kötü biçimli veriyi eler). */
export function normalizeParts(raw: unknown, fallbackText: string): ChatPart[] {
  if (!Array.isArray(raw)) return textPart(fallbackText);
  const out: ChatPart[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const p = item as Record<string, unknown>;
    if (p.type === "emote" && typeof p.url === "string" && p.url) {
      const url = safeMediaUrl(p.url);
      if (url) {
        out.push({ type: "emote", url, name: sanitizePlainText(p.name ?? "") });
      } else {
        out.push({ type: "text", text: sanitizePlainText(p.name || p.url) });
      }
    } else if (typeof p.text === "string" && p.text) {
      out.push({ type: "text", text: sanitizePlainText(p.text) });
    }
  }
  return out.length ? out : textPart(fallbackText);
}

/* ---------------------------------------------------------------- Twitch */

const TWITCH_EMOTE_CDN = "https://static-cdn.jtvnw.net/emoticons/v2";

/**
 * Twitch IRC `emotes` etiketini parçalara çevirir.
 *
 * Etiket biçimi: `id:baş-son,baş-son/id2:baş-son`
 * Offsetler **kod noktası** cinsindendir (UTF-16 değil), bu yüzden mesajı
 * `Array.from` ile bölüyoruz; aksi hâlde emoji içeren mesajlarda emote'lar
 * bir karakter kayıyor.
 */
export function twitchParts(text: string, emotesTag: string | undefined): ChatPart[] {
  if (!emotesTag || !text) return textPart(text);

  type Span = { start: number; end: number; id: string };
  const spans: Span[] = [];
  for (const group of emotesTag.split("/")) {
    const colon = group.indexOf(":");
    if (colon <= 0) continue;
    const id = group.slice(0, colon);
    for (const range of group.slice(colon + 1).split(",")) {
      const dash = range.indexOf("-");
      if (dash <= 0) continue;
      const start = Number(range.slice(0, dash));
      const end = Number(range.slice(dash + 1));
      if (!Number.isInteger(start) || !Number.isInteger(end) || end < start) continue;
      spans.push({ start, end, id });
    }
  }
  if (!spans.length) return textPart(text);
  spans.sort((a, b) => a.start - b.start);

  const chars = Array.from(text);
  const parts: ChatPart[] = [];
  let cursor = 0;

  for (const span of spans) {
    if (span.start < cursor || span.start >= chars.length) continue;
    const end = Math.min(span.end, chars.length - 1);
    if (span.start > cursor) {
      parts.push({ type: "text", text: chars.slice(cursor, span.start).join("") });
    }
    const name = chars.slice(span.start, end + 1).join("");
    parts.push({
      type: "emote",
      url: `${TWITCH_EMOTE_CDN}/${span.id}/default/dark/2.0`,
      name,
    });
    cursor = end + 1;
  }
  if (cursor < chars.length) {
    parts.push({ type: "text", text: chars.slice(cursor).join("") });
  }
  return parts.length ? parts : textPart(text);
}

/* ------------------------------------------------------------------ Kick */

/** Kick mesaj gövdesindeki `[emote:12345:isim]` işaretleri */
const KICK_EMOTE_RE = /\[emote:(\d+):([^\]]*)\]/g;

/**
 * Kick emote işaretlerini görsele çevirir. Bu işaretler ham metinde
 * `[emote:5748043:AINTNOWAY]` olarak geliyordu ve yayında aynen görünüyordu.
 */
export function kickParts(text: string): ChatPart[] {
  if (!text.includes("[emote:")) return textPart(text);

  const parts: ChatPart[] = [];
  let last = 0;
  KICK_EMOTE_RE.lastIndex = 0;
  for (let m = KICK_EMOTE_RE.exec(text); m; m = KICK_EMOTE_RE.exec(text)) {
    if (m.index > last) {
      parts.push({ type: "text", text: text.slice(last, m.index) });
    }
    parts.push({
      type: "emote",
      url: `https://files.kick.com/emotes/${m[1]}/fullsize`,
      name: m[2] || "emote",
    });
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    parts.push({ type: "text", text: text.slice(last) });
  }
  return parts.length ? parts : textPart(text);
}
