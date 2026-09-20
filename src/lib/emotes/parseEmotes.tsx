/** Güvenli React emote parser — metni görsele çevirir (XSS yok). */

import { useMemo, type CSSProperties, type ReactNode } from "react";
import { safeMediaUrl, sanitizePlainText } from "../sanitizeChat";
import { useEmotes } from "./EmoteContext";
import type { EmoteLookup } from "./types";

const KICK_EMOTE_RE = /\[emote:(\d+):([^\]]*)\]/g;
const KICK_CDN = "https://files.kick.com/emotes";

const EMOTE_IMG_CLASS = "inline-block h-6 w-6 align-middle mx-0.5";

function emoteImg(key: string, url: string, name: string): ReactNode {
  const safe = safeMediaUrl(url);
  if (!safe) return sanitizePlainText(name);
  return (
    <img
      key={key}
      src={safe}
      alt={sanitizePlainText(name)}
      title={sanitizePlainText(name)}
      className={EMOTE_IMG_CLASS}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
    />
  );
}

function parseTextChunk(
  chunk: string,
  lookup: EmoteLookup,
  keyPrefix: string,
  keyRef: { n: number },
  out: ReactNode[]
) {
  if (!chunk) return;
  const tokens = chunk.split(/(\s+)/);
  for (const token of tokens) {
    if (!token) continue;
    if (/^\s+$/.test(token)) {
      out.push(token);
      continue;
    }

    const punct = token.match(/^([^\s.,!?;:]+)([.,!?;:+]*)$/);
    const core = punct ? punct[1] : token;
    const trailing = punct ? punct[2] : "";
    const hit = lookup(core);

    if (hit) {
      out.push(emoteImg(`${keyPrefix}e${keyRef.n++}`, hit.url, hit.name));
      if (trailing) out.push(trailing);
    } else {
      out.push(token);
    }
  }
}

/**
 * Metni React node dizisine çevirir.
 * Kick `[emote:id:ad]` işaretleri + sözlükteki kelime emote'ları desteklenir.
 */
export function parseEmotes(
  text: string,
  lookup: EmoteLookup,
  keyPrefix = "m"
): (string | ReactNode)[] {
  if (!text) return [""];
  const source = sanitizePlainText(text);

  const out: ReactNode[] = [];
  const keyRef = { n: 0 };
  let last = 0;

  KICK_EMOTE_RE.lastIndex = 0;
  for (let m = KICK_EMOTE_RE.exec(source); m; m = KICK_EMOTE_RE.exec(source)) {
    if (m.index > last) {
      parseTextChunk(source.slice(last, m.index), lookup, keyPrefix, keyRef, out);
    }
    const id = m[1];
    const name = m[2] || "emote";
    out.push(
      emoteImg(`${keyPrefix}k${keyRef.n++}`, `${KICK_CDN}/${id}/fullsize`, name)
    );
    last = m.index + m[0].length;
  }

  if (last < source.length) {
    parseTextChunk(source.slice(last), lookup, keyPrefix, keyRef, out);
  }

  return out.length ? out : [source];
}

type MessageFormatterProps = {
  text: string;
  className?: string;
  style?: CSSProperties;
};

/** Chat satırları — BotPanel, ChatWidget, overlay baloncukları. */
export function MessageFormatter({ text, className, style }: MessageFormatterProps) {
  const { lookup } = useEmotes();
  const nodes = useMemo(() => parseEmotes(text, lookup), [text, lookup]);
  return (
    <span className={className} style={style}>
      {nodes}
    </span>
  );
}
