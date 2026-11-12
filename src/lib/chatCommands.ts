/**
 * Chat !komutları — ses paneli + şarkı isteği. — AxthrowA
 * Liste/yanıt OBS chat overlay’e `_botAnnounce` + inject ile gider.
 */

import { API_BASE } from "./api";
import type { ChatMessage } from "./chatHub";
import {
  loadSoundboard,
  playSoundPad,
  resolveSoundboard,
  type SoundPad,
} from "./soundboard";
import { enqueueBotReply } from "./sohbetBot/replyQueue";
import { isLocalBotUser } from "./sohbetBot/botIdentity";

const RESERVED = new Set([
  "seslistesi",
  "sfxlist",
  "soundlist",
  "sounds",
  "istek",
  "sr",
  "song",
  "songrequest",
  "skip",
]);

const COOLDOWN_SFX_MS = 2500;
const COOLDOWN_LIST_MS = 8000;
const COOLDOWN_SONG_MS = 12_000;

const lastByUser = new Map<string, number>();

function norm(s: string): string {
  return String(s || "")
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9ğüşıöç]+/gi, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

function padAliases(pad: SoundPad): string[] {
  const baseFile = pad.file.replace(/\.[^.]+$/, "");
  return [pad.name, baseFile, pad.file].map(norm).filter(Boolean);
}

function findPadIn(pads: SoundPad[], cmd: string): SoundPad | null {
  const n = norm(cmd);
  if (!n || RESERVED.has(n)) return null;
  for (const p of pads) {
    if (padAliases(p).includes(n)) return p;
  }
  const hits = pads.filter((p) =>
    padAliases(p).some((a) => a === n || a.includes(n) || n.includes(a))
  );
  if (hits.length === 1) return hits[0];
  return null;
}

function cooled(key: string, ms: number): boolean {
  const now = Date.now();
  const prev = lastByUser.get(key) || 0;
  if (now - prev < ms) return false;
  lastByUser.set(key, now);
  return true;
}

function toast(t: string) {
  try {
    window.dispatchEvent(new CustomEvent("chat-command-toast", { detail: t }));
  } catch {
    /* */
  }
}

function parseBang(text: string): { cmd: string; args: string } | null {
  const m = String(text || "")
    .trim()
    .match(/^!(\S+)\s*(.*)$/u);
  if (!m) return null;
  return { cmd: m[1], args: (m[2] || "").trim() };
}

function extractYoutubeId(q: string): string | null {
  const m = q.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|music\.youtube\.com\/watch\?v=)([A-Za-z0-9_-]{11})/
  );
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{11}$/.test(q.trim())) return q.trim();
  return null;
}

/** OBS + panel + (Kick bağlıysa) platform sohbeti — kuyruklu, donmaz. */
async function publishBotLines(source: ChatMessage, lines: string[]) {
  enqueueBotReply(source, lines);
}

async function requestSong(query: string): Promise<string> {
  const yt = extractYoutubeId(query);
  try {
    const res = await fetch(`${API_BASE}/api/player/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, videoId: yt || undefined }),
    });
    if (res.status === 404) {
      if (yt) {
        return "YTMD video linki için güncel uygulama gerekir; Spotify’da !istek şarkı adı kullan.";
      }
      return "Şarkı isteği bu exe sürümünde yok — Spotify bağlı güncel sürüm gerekir.";
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return String(data.error || data.message || "İstek başarısız — Spotify/YTMD bağlı mı?");
    }
    const title = data.title || data.name || query;
    const artist = data.artist ? ` — ${data.artist}` : "";
    return `Çalıyor: ${title}${artist}`;
  } catch {
    return "Müzik isteği gönderilemedi.";
  }
}

/**
 * Mesaj bir komutsa işler.
 * Liste async (sunucu soundboard); OBS chat `_botAnnounce` ile güncellenir.
 */
export function handleChatCommand(msg: ChatMessage): ChatMessage[] {
  if (isLocalBotUser(msg.user) || String(msg.key).startsWith("bot-")) return [];
  const parsed = parseBang(msg.text);
  if (!parsed) return [];

  const cmdNorm = norm(parsed.cmd);
  const userKey = `${msg.platform}:${msg.user}`;

  if (cmdNorm === "seslistesi" || cmdNorm === "sfxlist" || cmdNorm === "soundlist" || cmdNorm === "sounds") {
    if (!cooled(`list:${userKey}`, COOLDOWN_LIST_MS)) return [];
    void (async () => {
      const pads = await resolveSoundboard();
      if (!pads.length) {
        const line = "Ses listesi boş — panelden ses ekle.";
        toast(line);
        await publishBotLines(msg, [line]);
        return;
      }
      const names = pads.map((p) => p.name || p.file.replace(/\.[^.]+$/, "")).filter(Boolean);
      const lines: string[] = [];
      const chunk = 10;
      for (let i = 0; i < names.length; i += chunk) {
        const slice = names.slice(i, i + chunk);
        const prefix = i === 0 ? `Sesler (!isim): ` : `… `;
        lines.push(prefix + slice.map((n) => `!${String(n).replace(/\s+/g, "")}`).join(" · "));
      }
      toast(`Ses listesi (${names.length})`);
      await publishBotLines(msg, lines);
    })();
    return [];
  }

  if (cmdNorm === "istek" || cmdNorm === "sr" || cmdNorm === "song" || cmdNorm === "songrequest") {
    if (!parsed.args) {
      const line = "Kullanım: !istek şarkı adı  |  YTMD: !istek youtube-link";
      void publishBotLines(msg, [line]);
      return [];
    }
    if (!cooled(`song:${userKey}`, COOLDOWN_SONG_MS)) {
      void publishBotLines(msg, ["İstek için biraz bekle…"]);
      return [];
    }
    void publishBotLines(msg, [`İstek alındı: ${parsed.args}`]);
    void requestSong(parsed.args).then((text) => {
      toast(text);
      void publishBotLines(msg, [text]);
    });
    return [];
  }

  // SFX: sunucu listesinden bul (OBS localStorage boş olabilir)
  if (!cooled(`sfx:${userKey}:${cmdNorm}`, COOLDOWN_SFX_MS)) return [];
  void (async () => {
    const pads = await resolveSoundboard();
    const pad = findPadIn(pads, parsed.cmd) || findPadIn(loadSoundboard(), parsed.cmd);
    if (!pad) return;
    playSoundPad(pad);
    toast(`SFX: ${pad.name}`);
  })();
  return [];
}
