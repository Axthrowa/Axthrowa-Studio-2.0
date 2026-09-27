/**
 * Timer motoru — tek tick (60s), satır sayacı.
 * Birden fazla setInterval yok → donma / sızıntı yok.
 */

import type { ChatMessage } from "../chatHub";
import { enqueueBotReply } from "./replyQueue";
import { getBotConfig, saveBotConfig } from "./store";
import { interpolate } from "./variables";

let lineCount = 0;
let tickTimer: number | null = null;
const lastFire = new Map<string, number>();

export function noteChatLine() {
  lineCount += 1;
}

export function startBotTimers() {
  if (tickTimer != null) return;
  tickTimer = window.setInterval(() => {
    const cfg = getBotConfig();
    if (!cfg.enabled) return;
    const now = Date.now();
    for (const t of cfg.timers) {
      if (!t.enabled) continue;
      const intervalMs = Math.max(1, t.intervalMin || 5) * 60_000;
      const last = lastFire.get(t.id) || 0;
      if (now - last < intervalMs) continue;
      if ((t.minLines || 0) > 0 && lineCount < t.minLines) continue;
      lineCount = 0;
      lastFire.set(t.id, now);
      const fake: ChatMessage = {
        key: `timer-${t.id}`,
        id: `timer-${t.id}`,
        platform: "kick",
        user: cfg.botName || "BotAxT",
        text: "",
        parts: [],
        color: "#fbbf24",
        kind: "chat",
        badges: [],
        ts: now,
      };
      const text = interpolate(t.message, {
        msg: fake,
        cfg,
        rawCmd: "",
        args: [],
      });
      enqueueBotReply(fake, [text], {
        kick: cfg.replyToKick,
        overlay: cfg.replyToOverlay,
      });
    }
  }, 15_000);
}

/** İzleme puanı — dakikada bir */
let loyaltyTick: number | null = null;
const activeChatters = new Map<string, number>();

export function noteChatter(platform: string, user: string) {
  activeChatters.set(`${platform}:${user.toLowerCase()}`, Date.now());
}

export function startLoyaltyTicker() {
  if (loyaltyTick != null) return;
  loyaltyTick = window.setInterval(() => {
    const cfg = getBotConfig();
    if (!cfg.enabled || !cfg.modules.loyalty) return;
    const now = Date.now();
    const fresh: string[] = [];
    for (const [k, t] of activeChatters) {
      if (now - t < 90_000) fresh.push(k);
      else activeChatters.delete(k);
    }
    if (!fresh.length) return;
    const ppm = cfg.pointsPerMinute || 0;
    if (ppm <= 0) return;
    saveBotConfig((prev) => {
      const loyalty = { ...prev.loyalty };
      for (const k of fresh) {
        const u = loyalty[k] || { points: 0, messages: 0, watchMin: 0, lastSeen: now };
        loyalty[k] = {
          ...u,
          points: u.points + ppm,
          watchMin: u.watchMin + 1,
          lastSeen: now,
        };
      }
      return { ...prev, loyalty };
    });
  }, 60_000);
}
