import type { EmoteDictionary, EmoteEntry } from "./types";

const SEVEN_TV_GLOBAL = "https://7tv.io/v3/emote-sets/global";

type SevenTvEmote = {
  name?: string;
  data?: {
    host?: { url?: string };
  };
};

function emoteUrl(host: string): string {
  const base = host.startsWith("//") ? `https:${host}` : host;
  return `${base}/3x.webp`;
}

function putEntry(dict: EmoteDictionary, entry: EmoteEntry) {
  dict.set(entry.name, entry);
  dict.set(entry.name.toLowerCase(), entry);
}

/** 7TV global emote set — KEKW, monkaS, POGGERS vb. */
export async function fetch7tvGlobalEmotes(): Promise<EmoteDictionary> {
  const dict: EmoteDictionary = new Map();
  const res = await fetch(SEVEN_TV_GLOBAL, { cache: "default" });
  if (!res.ok) throw new Error(`7TV HTTP ${res.status}`);

  const data = (await res.json()) as { emotes?: SevenTvEmote[] };
  for (const emote of data.emotes || []) {
    const name = String(emote.name || "").trim();
    const host = emote.data?.host?.url;
    if (!name || !host) continue;
    putEntry(dict, { name, url: emoteUrl(host) });
  }
  return dict;
}

export function mergeEmoteDictionaries(...maps: EmoteDictionary[]): EmoteDictionary {
  const merged: EmoteDictionary = new Map();
  for (const map of maps) {
    for (const [k, v] of map) merged.set(k, v);
  }
  return merged;
}
