/** Twitch anonim IRC (salt-okunur) — token gerekmez */
import { ChatPart, twitchParts } from "./chatParts";
import { ChatBadge, loadTwitchBadges, twitchBadges } from "./chatBadges";


export type TwitchEvent = {
  id: string;
  user: string;
  text: string;
  /** Yazı + emote parçaları (emote'lar `emotes` etiketinden çözülür) */
  parts: ChatPart[];
  color?: string;
  /** chat | sub | raid | bits | system */
  kind: "chat" | "sub" | "raid" | "bits" | "system";
  badges: ChatBadge[];
  amount?: string | null;
  ts: number;
};

export type TwitchHandlers = {
  onMessage: (msg: TwitchEvent) => void;
  onStatus?: (state: "connecting" | "live" | "error", detail?: string) => void;
};

const IRC_URL = "wss://irc-ws.chat.twitch.tv:443";
/** Sunucu 5 dk sessizlikte düşürür; 60 sn'de bir PING at. */
const KEEPALIVE_MS = 60_000;
/** Yanıtsız PING sonrası bağlantıyı ölü say. */
const PONG_TIMEOUT_MS = 15_000;

export function connectTwitchChat(channel: string, handlers: TwitchHandlers): () => void {
  const ch = normalizeTwitchChannel(channel);
  if (!ch) return () => {};

  let ws: WebSocket | null = null;
  let closed = false;
  let retryTimer: number | undefined;
  let keepaliveTimer: number | undefined;
  let pongTimer: number | undefined;
  let attempt = 0;

  const clearTimers = () => {
    if (keepaliveTimer) window.clearInterval(keepaliveTimer);
    if (pongTimer) window.clearTimeout(pongTimer);
    keepaliveTimer = undefined;
    pongTimer = undefined;
  };

  const scheduleReconnect = () => {
    if (closed) return;
    // 1s → 2s → 4s … en çok 30s; sabit 2.5s yeniden denemesi ağı boğuyordu.
    const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5));
    attempt += 1;
    retryTimer = window.setTimeout(connect, delay);
  };

  // Rozet görselleri ilk mesajdan önce hazır olsun
  void loadTwitchBadges("global");

  const connect = () => {
    if (closed) return;
    handlers.onStatus?.("connecting");
    // justinfan = Twitch'in anonim okuyucu takma adı
    const nick = `justinfan${Math.floor(10_000 + Math.random() * 89_999)}`;
    try {
      ws = new WebSocket(IRC_URL);
    } catch {
      scheduleReconnect();
      return;
    }
    const sock = ws;

    sock.onopen = () => {
      attempt = 0;
      sock.send("CAP REQ :twitch.tv/tags twitch.tv/commands");
      sock.send("PASS SCHMOOPIIE");
      sock.send(`NICK ${nick}`);
      sock.send(`JOIN #${ch}`);
      handlers.onStatus?.("live", `#${ch}`);
      clearTimers();
      keepaliveTimer = window.setInterval(() => {
        if (sock.readyState !== WebSocket.OPEN) return;
        sock.send("PING :keepalive");
        if (pongTimer) window.clearTimeout(pongTimer);
        pongTimer = window.setTimeout(() => {
          // PONG gelmedi → bağlantı sessizce ölmüş, kapat ki yeniden kurulsun
          try {
            sock.close();
          } catch {
            /* */
          }
        }, PONG_TIMEOUT_MS);
      }, KEEPALIVE_MS);
    };

    sock.onclose = () => {
      clearTimers();
      if (!closed) {
        handlers.onStatus?.("error", "bağlantı koptu");
        scheduleReconnect();
      }
    };

    sock.onerror = () => {
      handlers.onStatus?.("error", "bağlanılamadı");
    };

    sock.onmessage = (ev) => {
      const raw = String(ev.data || "");
      for (const line of raw.split("\r\n")) {
        if (!line) continue;
        if (line.startsWith("PING ")) {
          sock.send(`PONG ${line.slice(5)}`);
          continue;
        }
        if (line.includes(" PONG ")) {
          if (pongTimer) window.clearTimeout(pongTimer);
          pongTimer = undefined;
          continue;
        }
        // Twitch "yakında kapatıyorum" der — beklemeden yeniden bağlan
        if (line.includes(" RECONNECT")) {
          try {
            sock.close();
          } catch {
            /* */
          }
          continue;
        }
        const parsed = parseLine(line);
        if (parsed) handlers.onMessage(parsed);
      }
    };
  };

  connect();

  return () => {
    closed = true;
    clearTimers();
    if (retryTimer) window.clearTimeout(retryTimer);
    try {
      ws?.close();
    } catch {
      /* */
    }
  };
}

/** "https://twitch.tv/Kanal", "#kanal", "Kanal" → "kanal" */
export function normalizeTwitchChannel(input: string): string {
  const raw = String(input || "").trim();
  if (!raw) return "";
  const afterHost = raw.includes("twitch.tv/") ? raw.split("twitch.tv/").pop() || "" : raw;
  return afterHost
    .replace(/^#/, "")
    .split(/[/?&#]/)[0]
    .trim()
    .toLowerCase();
}

function parseTags(tagStr: string): Record<string, string> {
  const tags: Record<string, string> = {};
  for (const part of tagStr.split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0) {
      // IRCv3 kaçışları: \s = boşluk, \: = noktalı virgül
      tags[part.slice(0, eq)] = part
        .slice(eq + 1)
        .replace(/\\s/g, " ")
        .replace(/\\:/g, ";")
        .replace(/\\\\/g, "\\");
    }
  }
  return tags;
}

/** Kanala özel abone rozetleri için oda kimliği gerekir; ilk mesajda gelir. */
function badgesFrom(tags: Record<string, string>): ChatBadge[] {
  const roomId = tags["room-id"] || "";
  if (roomId) void loadTwitchBadges(roomId);
  return twitchBadges(tags.badges, roomId || undefined);
}

/** PRIVMSG ve USERNOTICE (abonelik/raid) satırlarını tek biçime indirger. */
export function parseLine(line: string): TwitchEvent | null {
  let tags: Record<string, string> = {};
  let rest = line;
  if (rest.startsWith("@")) {
    const sp = rest.indexOf(" ");
    if (sp < 0) return null;
    tags = parseTags(rest.slice(1, sp));
    rest = rest.slice(sp + 1);
  }

  const isNotice = rest.includes(" USERNOTICE #");
  const marker = isNotice ? " USERNOTICE #" : " PRIVMSG #";
  const idx = rest.indexOf(marker);
  if (idx < 0) return null;

  const after = rest.slice(idx + marker.length);
  const colon = after.indexOf(" :");
  // USERNOTICE'ta mesaj gövdesi olmayabilir (ör. sessiz raid)
  const text = colon < 0 ? "" : after.slice(colon + 2);

  const nickFromPrefix = rest.startsWith(":")
    ? rest.slice(1, rest.indexOf("!") > 0 ? rest.indexOf("!") : undefined)
    : "";
  const user = tags["display-name"] || tags.login || nickFromPrefix || "user";

  let kind: TwitchEvent["kind"] = "chat";
  let body = text;
  let parts: ChatPart[];
  let amount: string | null = null;
  if (isNotice) {
    const notice = tags["msg-id"] || "";
    kind = notice === "raid" ? "raid" : "sub";
    const systemMsg = tags["system-msg"] || "";
    // Sistem metni emote taşımaz; emote offsetleri yalnız kullanıcı metnine ait
    const emoteParts = twitchParts(text, tags.emotes);
    body = [systemMsg, text].filter(Boolean).join(" — ");
    if (!body) return null;
    parts = systemMsg
      ? [{ type: "text", text: text ? `${systemMsg} — ` : systemMsg }, ...emoteParts]
      : emoteParts;
  } else if (!text) {
    return null;
  } else {
    parts = twitchParts(text, tags.emotes);
    if (tags.bits) {
      kind = "bits";
      amount = `${tags.bits} bits`;
    }
  }

  const tsRaw = Number(tags["tmi-sent-ts"]);
  return {
    id: tags.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    user,
    text: body,
    parts,
    color: tags.color || "#9146ff",
    kind,
    badges: badgesFrom(tags),
    amount,
    ts: Number.isFinite(tsRaw) && tsRaw > 0 ? tsRaw : Date.now(),
  };
}
