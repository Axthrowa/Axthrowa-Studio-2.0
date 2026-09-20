/** StreamElements tarzı $(değişken) interpolasyonu — senkron, hafif. */

import type { ChatMessage } from "../chatHub";
import type { BotConfig, BotCommand } from "./types";

function fmtDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "çevrimdışı";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}s ${m}dk ${sec}sn`;
  if (m > 0) return `${m}dk ${sec}sn`;
  return `${sec}sn`;
}

function argsOf(text: string, cmdLen: number): string[] {
  const rest = text.trim().slice(cmdLen).trim();
  if (!rest) return [];
  return rest.split(/\s+/);
}

export type VarContext = {
  msg: ChatMessage;
  cfg: BotConfig;
  cmd?: BotCommand;
  /** Komut adı dahil `!name args` */
  rawCmd: string;
  args: string[];
  url?: string;
};

export function buildArgs(msgText: string, commandName: string): string[] {
  const m = msgText.trim().match(/^!(\S+)\s*(.*)$/u);
  if (!m) return [];
  void commandName;
  return (m[2] || "").trim() ? (m[2] || "").trim().split(/\s+/) : [];
}

export function interpolate(template: string, ctx: VarContext): string {
  const { msg, cfg, cmd, args } = ctx;
  const sender = msg.user || "izleyici";
  const touser = args[0] || sender;
  const joined = args.join(" ");
  const uptime = cfg.streamStartedAt
    ? fmtDuration(Date.now() - cfg.streamStartedAt)
    : "yayın bilgisi yok (panele başlat)";

  const loyaltyKey = `${msg.platform}:${sender.toLowerCase()}`;
  const loy = cfg.loyalty[loyaltyKey];

  let out = template;

  // $(1), $(2), $(1:), $(1:3)
  out = out.replace(/\$\((\d+)(?::(\d*))?\)/g, (_, a: string, b?: string) => {
    const i = Number(a) - 1;
    if (b === undefined) return args[i] || "";
    if (b === "") return args.slice(i).join(" ");
    const j = Number(b);
    return args.slice(i, j).join(" ");
  });

  const map: Record<string, string> = {
    user: sender,
    sender: sender,
    source: sender,
    touser,
    query: joined,
    "1": args[0] || "",
    count: String(cmd?.count ?? 0),
    provider: msg.platform,
    platform: msg.platform,
    channel: cfg.channelName || msg.platform,
    title: cfg.title || "—",
    status: cfg.title || "—",
    game: cfg.game || "—",
    uptime,
    time: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
    pointsname: cfg.pointsName || "puan",
    msgid: msg.id || "",
  };

  out = out.replace(/\$\(([a-zA-Z_][\w.]*)\)/g, (full, key: string) => {
    if (key === "user.points" || key === "sender.points") {
      return String(loy?.points ?? 0);
    }
    if (key === "user.name" || key === "sender.name") return sender.toLowerCase();
    if (key === "user.watchtime" || key === "sender.time_online") {
      return `${loy?.watchMin ?? 0} dk`;
    }
    if (key === "random" || key.startsWith("random.")) {
      const n = key.match(/random\.?(\d+)?(?:-(\d+))?/);
      if (n && n[1] && n[2]) {
        const lo = Number(n[1]);
        const hi = Number(n[2]);
        return String(lo + Math.floor(Math.random() * (hi - lo + 1)));
      }
      if (n && n[1]) return String(1 + Math.floor(Math.random() * Number(n[1])));
      return String(1 + Math.floor(Math.random() * 100));
    }
    if (key === "quote") {
      if (!cfg.quotes.length) return "alıntı yok";
      const q = cfg.quotes[Math.floor(Math.random() * cfg.quotes.length)];
      return `#${q.id.slice(-4)} "${q.text}" — ${q.by}`;
    }
    if (key.startsWith("getcount.")) {
      const name = key.slice("getcount.".length);
      const c = cfg.counters.find((x) => x.name.toLowerCase() === name.toLowerCase());
      return String(c?.value ?? 0);
    }
    if (key in map) return map[key];
    return full;
  });

  // $(math 1+2)
  out = out.replace(/\$\(math\s+([^)]+)\)/gi, (_, expr: string) => {
    try {
      const safe = String(expr).replace(/[^0-9+\-*/().%\s]/g, "");
      // eslint-disable-next-line no-new-func
      const v = Function(`"use strict"; return (${safe})`)();
      return Number.isFinite(v) ? String(v) : "?";
    } catch {
      return "?";
    }
  });

  out = out.replace(/\{([a-zA-Z_][\w]*)\}/g, (full, key: string) => {
    if (key === "url") return ctx.url ? ctx.url : full;
    if (key === "username" || key === "user") return sender;
    if (key in map) return map[key];
    return full;
  });

  return out;
}

export { argsOf, fmtDuration };
