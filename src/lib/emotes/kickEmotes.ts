import kickRaw from "./kickEmotes.json";
import type { EmoteDictionary, EmoteEntry } from "./types";

const KICK_CDN = "https://files.kick.com/emotes";

type KickRow = { name: string; id: string };

function putEntry(dict: EmoteDictionary, entry: EmoteEntry) {
  dict.set(entry.name, entry);
  dict.set(entry.name.toLowerCase(), entry);
}

/** Kick yerel emote sözlüğü — API olmadığı için statik liste. */
export function buildKickEmoteDictionary(): EmoteDictionary {
  const dict: EmoteDictionary = new Map();
  for (const row of kickRaw as KickRow[]) {
    const name = String(row.name || "").trim();
    const id = String(row.id || "").trim();
    if (!name || !id) continue;
    putEntry(dict, {
      name,
      url: `${KICK_CDN}/${id}/fullsize`,
    });
  }
  return dict;
}
