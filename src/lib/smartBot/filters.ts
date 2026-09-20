/** Spam filtreleri — Botaxt moderasyon: caps/link/emote/sembol/kelime. */

import type { ChatMessage } from "../chatHub";
import type { SpamFilters } from "./types";
import { userLevel } from "./levels";

const permits = new Map<string, number>();
const lastMsg = new Map<string, { text: string; t: number }>();

const LINK_RE = /https?:\/\/|www\.|\w+\.(com|net|org|gg|tv|io)\b/i;
const EMOTE_TOKEN = /:[a-zA-Z0-9_]+:|[\u{1F300}-\u{1FAFF}]/gu;
const SYMBOL_RE = /[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ\s]/g;

export function grantPermit(userKey: string, sec: number) {
  permits.set(userKey, Date.now() + sec * 1000);
}

export function checkSpam(
  msg: ChatMessage,
  filters: SpamFilters,
  broadcasters: string[] = []
): { ok: true } | { ok: false; reason: string; action: "warn" | "delete_warn" } {
  if (!filters.enabled) return { ok: true };
  if (msg.kind !== "chat") return { ok: true };

  const level = userLevel(msg, broadcasters);
  if (filters.bypassMods && level >= 500) return { ok: true };
  if (filters.bypassSubs && level >= 250) return { ok: true };

  const key = `${msg.platform}:${(msg.user || "").toLowerCase()}`;
  const permitUntil = permits.get(key) || 0;
  if (Date.now() < permitUntil) return { ok: true };

  const text = msg.text || "";
  const action = filters.action === "delete_warn" ? "delete_warn" : "warn";

  if (filters.maxMessageLen > 0 && text.length > filters.maxMessageLen) {
    return { ok: false, reason: "çok uzun mesaj", action };
  }

  if (filters.blockLinks && LINK_RE.test(text)) {
    return { ok: false, reason: "link engelli (!permit ile izin)", action };
  }

  const letters = text.replace(/[^a-zA-ZğüşıöçĞÜŞİÖÇ]/g, "");
  if (letters.length >= 8 && filters.maxCapsPercent > 0) {
    const caps = letters.replace(/[^A-ZĞÜŞİÖÇ]/g, "").length;
    const pct = (caps / letters.length) * 100;
    if (pct >= filters.maxCapsPercent) {
      return { ok: false, reason: "çok fazla büyük harf", action };
    }
  }

  const emotes = text.match(EMOTE_TOKEN) || [];
  if ((filters.maxEmotes || 0) > 0 && emotes.length > filters.maxEmotes) {
    return { ok: false, reason: "çok fazla emote", action };
  }

  const symbols = text.match(SYMBOL_RE) || [];
  if ((filters.maxSymbols || 0) > 0 && symbols.length > filters.maxSymbols) {
    return { ok: false, reason: "çok fazla sembol", action };
  }

  const banned = filters.bannedWords || [];
  if (banned.length) {
    const low = text.toLocaleLowerCase("tr");
    for (const w of banned) {
      const t = String(w || "").trim().toLocaleLowerCase("tr");
      if (t && low.includes(t)) {
        return { ok: false, reason: "yasaklı kelime", action };
      }
    }
  }

  const prev = lastMsg.get(key);
  if (prev && prev.text === text && Date.now() - prev.t < 4000) {
    return { ok: false, reason: "tekrar mesaj", action };
  }
  lastMsg.set(key, { text, t: Date.now() });
  return { ok: true };
}
