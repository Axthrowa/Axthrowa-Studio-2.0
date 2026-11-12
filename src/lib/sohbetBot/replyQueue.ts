/**
 * Bot yanıt kuyruğu — tek worker, satırlar arası gecikme.
 * Kick (API) · Twitch (IRC OAuth) · YouTube (Data API) · Overlay.
 */

import { API_BASE, patchSettings } from "../api";
import type { ChatMessage, Platform } from "../chatHub";
import { sendTwitchPrivmsg, twitchWriteStatus } from "../platformAuth/twitchWrite";
import { sendYoutubeLiveChat, youtubeWriteStatus } from "../platformAuth/youtubeWrite";
import { pushAppAlert } from "../appAlert";
import { getBotConfig } from "./store";

type Job = {
  lines: string[];
  source: ChatMessage;
  toKick: boolean;
  toTwitch: boolean;
  toYoutube: boolean;
  toOverlay: boolean;
};

const queue: Job[] = [];
let pumping = false;
let kickAuthWarned = false;
let twitchAuthWarned = false;
let youtubeAuthWarned = false;

function botReply(source: ChatMessage, text: string, name: string): ChatMessage {
  return {
    key: `bot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    id: `bot-${Date.now()}`,
    platform: source.platform,
    user: name,
    text,
    parts: [{ type: "text", text }],
    color: "#fbbf24",
    kind: "chat",
    badges: [],
    ts: Date.now(),
  };
}

function injectLocal(msg: ChatMessage) {
  try {
    window.dispatchEvent(new CustomEvent("chat-command-inject", { detail: msg }));
  } catch {
    /* */
  }
}

function toast(t: string) {
  try {
    window.dispatchEvent(new CustomEvent("chat-command-toast", { detail: t }));
  } catch {
    /* */
  }
}

async function sendKick(text: string): Promise<boolean> {
  const delay = Math.max(250, Math.min(2000, getBotConfig().replyDelayMs || 1200));
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const cfg = getBotConfig();
      const slug = String(cfg.channelName || "").trim();
      const res = await fetch(`${API_BASE}/api/kick/chat/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, slug: slug || undefined }),
      });
      if (res.status === 401 || res.status === 404) {
        if (!kickAuthWarned) {
          kickAuthWarned = true;
          pushAppAlert({
            message:
              "Kick API bağlı değil — Chat Bot’tan Client ID + Secret ile Bağlan’a basın.",
          });
        }
        return false;
      }
      if (res.status === 429) {
        const wait = Number(res.headers.get("retry-after")) * 1000;
        await sleep(Number.isFinite(wait) && wait > 0 ? Math.min(wait, 8000) : delay + 800);
        continue;
      }
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        if (/rate limit|hız limiti/i.test(body)) {
          await sleep(delay + 800);
          continue;
        }
        if (!kickAuthWarned) {
          kickAuthWarned = true;
          pushAppAlert({
            message: body || `Kick sohbet gönderilemedi (HTTP ${res.status})`,
          });
        }
        return false;
      }
      return true;
    } catch {
      if (!kickAuthWarned) {
        kickAuthWarned = true;
        pushAppAlert({
          message:
            "Kick yanıtı gönderilemedi. Chatbot’ta Client ID + Secret kayıtlı olsun; Kick.com oturumu gerekmez.",
        });
      }
      return false;
    }
  }
  return false;
}

function sleep(ms: number) {
  return new Promise<void>((r) => window.setTimeout(r, ms));
}

async function pump() {
  if (pumping) return;
  pumping = true;
  try {
    while (queue.length) {
      const job = queue.shift()!;
      const cfg = getBotConfig();
      const delay = Math.max(1100, Math.min(2500, cfg.replyDelayMs || 1200));
      const name = cfg.botName || "AxBoT";

      if (job.toOverlay && job.lines.length) {
        for (const line of job.lines) {
          injectLocal(botReply(job.source, line, name));
        }
        try {
          await patchSettings("chat", {
            _botAnnounce: {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              lines: job.lines,
              platform: job.source.platform as Platform,
              t: Date.now(),
            },
          });
        } catch {
          /* */
        }
      }

      let wroteRemote = false;

      if (job.toKick && job.source.platform === "kick") {
        for (const line of job.lines) {
          await sendKick(line);
          await sleep(delay);
          wroteRemote = true;
        }
      }

      if (job.toTwitch && job.source.platform === "twitch") {
        if (!twitchWriteStatus().connected) {
          if (!twitchAuthWarned) {
            twitchAuthWarned = true;
            toast("Twitch bot bağlı değil — Bot → Twitch yazma’dan Bağlan");
          }
        } else {
          const channel = cfg.channelName || job.source.platform;
          // chatHub kanalı source’tan gelmiyor — panel channelName / twitch channel
          const ch =
            (cfg as { twitchChannel?: string }).twitchChannel ||
            cfg.channelName ||
            "";
          for (const line of job.lines) {
            const ok = await sendTwitchPrivmsg(ch || String((job.source as any).channel || ""), line);
            // channel fallback: use login from message context via settings
            if (!ok) {
              // try channelName alone
              await sendTwitchPrivmsg(cfg.channelName, line);
            }
            await sleep(delay);
            wroteRemote = true;
          }
          void channel;
        }
      }

      if (job.toYoutube && job.source.platform === "youtube") {
        if (!youtubeWriteStatus().connected) {
          if (!youtubeAuthWarned) {
            youtubeAuthWarned = true;
            toast("YouTube bot bağlı değil — Bot → YouTube yazma’dan Bağlan");
          }
        } else {
          for (const line of job.lines) {
            await sendYoutubeLiveChat(line, cfg.channelName);
            await sleep(delay);
            wroteRemote = true;
          }
        }
      }

      if (!wroteRemote) await sleep(40);
    }
  } finally {
    pumping = false;
    if (queue.length) void pump();
  }
}

/** Bot satırlarını kuyruğa ekle (donmaz). */
export function enqueueBotReply(
  source: ChatMessage,
  lines: string[],
  opts?: { kick?: boolean; twitch?: boolean; youtube?: boolean; overlay?: boolean }
) {
  const clean = lines.map((l) => String(l || "").trim()).filter(Boolean);
  if (!clean.length) return;
  const cfg = getBotConfig();
  queue.push({
    lines: clean,
    source,
    toKick: opts?.kick ?? (cfg.replyToKick !== false && source.platform === "kick"),
    toTwitch:
      opts?.twitch ?? (cfg.replyToTwitch !== false && source.platform === "twitch"),
    toYoutube:
      opts?.youtube ?? (cfg.replyToYoutube !== false && source.platform === "youtube"),
    toOverlay: opts?.overlay ?? cfg.replyToOverlay !== false,
  });
  while (queue.length > 40) queue.shift();
  void pump();
}

export function resetKickAuthWarn() {
  kickAuthWarned = false;
  twitchAuthWarned = false;
  youtubeAuthWarned = false;
}
