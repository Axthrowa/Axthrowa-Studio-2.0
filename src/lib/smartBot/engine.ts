/**
 * Akıllı bot motoru — mesaj başına hızlı yol; ağır iş async.
 */

import type { ChatMessage } from "../chatHub";
import { handleChatCommand } from "../chatCommands";
import { checkSpam, grantPermit } from "./filters";
import { hasLevel, userLevel } from "./levels";
import { handleModuleCommand, tryGiveawayKeyword } from "./modules";
import { enqueueBotReply } from "./replyQueue";
import { getBotConfig, saveBotConfig } from "./store";
import { noteChatLine, noteChatter, startBotTimers, startLoyaltyTicker } from "./timers";
import { buildArgs, interpolate } from "./variables";
import {
  extractDiscordInvite,
  finalizeCommandReply,
  normalizeSocialUrl,
} from "./commandTemplate";
import type { BotCommand, UserLevel } from "./types";
import { isLocalBotUser } from "./botIdentity";
import { botaxtApi } from "../api/botaxt";

const userCd = new Map<string, number>();
const globalCd = new Map<string, number>();

let bootstrapped = false;

/** Emote combo sayacı */
let comboEmote = "";
let comboCount = 0;
let comboTimer: number | null = null;

function trackEmoteCombo(msg: ChatMessage) {
  const cfg = getBotConfig() as any;
  const comboCfg = cfg.emoteCombo || {};
  if (comboCfg.enabled === false) return;
  const minCount = Math.max(2, Number(comboCfg.minCount) || 3);
  const windowMs = Math.max(1000, Number(comboCfg.windowMs) || 8000);

  const tokens = (msg.text || "").match(/:[a-zA-Z0-9_]+:|[\u{1F300}-\u{1FAFF}]/gu) || [];
  if (!tokens.length) {
    comboEmote = "";
    comboCount = 0;
    return;
  }
  const e = tokens[0] || "";
  if (!e) {
    comboEmote = "";
    comboCount = 0;
    return;
  }
  if (tokens.every((t) => t === e) && e === comboEmote) {
    comboCount += 1;
  } else if (tokens.every((t) => t === e)) {
    comboEmote = e;
    comboCount = tokens.length;
  } else {
    comboEmote = "";
    comboCount = 0;
    return;
  }
  if (comboTimer != null) window.clearTimeout(comboTimer);
  comboTimer = window.setTimeout(() => {
    comboEmote = "";
    comboCount = 0;
  }, windowMs);
  if (comboCount >= minCount) {
    void import("./events").then(({ emitWidgetEvent }) =>
      emitWidgetEvent({
        kind: "emotecombo",
        user: msg.user,
        message: `${e} x${comboCount}`,
        meta: { emote: e, count: comboCount },
        platform: msg.platform,
      })
    );
  }
}

export function bootstrapSmartBot() {
  if (bootstrapped) return;
  bootstrapped = true;
  startBotTimers();
  startLoyaltyTicker();
}

function normName(s: string): string {
  return String(s || "")
    .toLocaleLowerCase("tr")
    .replace(/^!/, "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9ğüşıöç]+/gi, "");
}

function findCommand(cfgName: string, list: BotCommand[]): BotCommand | null {
  const n = normName(cfgName);
  for (const c of list) {
    if (!c.enabled) continue;
    if (normName(c.name) === n) return c;
    if ((c.aliases || []).some((a) => normName(a) === n)) return c;
  }
  return null;
}

function cooled(map: Map<string, number>, key: string, sec: number): boolean {
  if (sec <= 0) return true;
  const now = Date.now();
  const prev = map.get(key) || 0;
  if (now - prev < sec * 1000) return false;
  map.set(key, now);
  return true;
}

function broadcasters(): string[] {
  const cfg = getBotConfig();
  const names = [cfg.channelName].filter(Boolean);
  return names;
}

function reply(msg: ChatMessage, lines: string[]) {
  enqueueBotReply(msg, lines);
}

function bumpLoyaltyMessage(msg: ChatMessage) {
  const cfg = getBotConfig();
  if (!cfg.modules.loyalty) return;
  const ignored = ((cfg as any).loyaltyExtras?.ignoredUsers || []) as string[];
  if (ignored.some((u) => u && msg.user.toLowerCase() === String(u).toLowerCase())) return;
  const key = `${msg.platform}:${(msg.user || "").toLowerCase()}`;
  const add = cfg.pointsPerMessage || 0;
  const initial = Number((cfg as any).loyaltyExtras?.initialPoints || 0);
  saveBotConfig((prev) => {
    const u = prev.loyalty[key] || {
      points: initial,
      messages: 0,
      watchMin: 0,
      lastSeen: Date.now(),
    };
    return {
      ...prev,
      loyalty: {
        ...prev.loyalty,
        [key]: {
          ...u,
          points: u.points + add,
          messages: u.messages + 1,
          lastSeen: Date.now(),
        },
      },
    };
  });
}

function handleBuiltinAdmin(
  msg: ChatMessage,
  cmd: string,
  args: string[],
  level: UserLevel
): string[] | null {
  const cfg = getBotConfig();
  const isMod = hasLevel(level, 500);

  if (cmd === "komutlar" || cmd === "commands" || cmd === "cmds") {
    const names = cfg.commands.filter((c) => c.enabled).map((c) => `!${c.name}`);
    const extra = [
      "!puan",
      "!top",
      "!uptime",
      cfg.modules.eightball ? "!8ball" : "",
      cfg.modules.quotes ? "!quote" : "",
      cfg.modules.raffle ? "!raffle" : "",
      "!seslistesi",
      "!istek",
    ].filter(Boolean);
    const all = [...names, ...extra].slice(0, 40);
    return [`Komutlar: ${all.join(" · ")}`];
  }

  if (cmd === "puan" || cmd === "points") {
    if (!cfg.modules.loyalty) return ["Sadakat kapalı."];
    const target = (args[0] || msg.user).replace(/^@/, "");
    const key = `${msg.platform}:${target.toLowerCase()}`;
    const u = cfg.loyalty[key];
    return [
      `${target}: ${u?.points ?? 0} ${cfg.pointsName} · ${u?.watchMin ?? 0} dk · ${u?.messages ?? 0} mesaj`,
    ];
  }

  if (cmd === "top" || cmd === "leaderboard") {
    if (!cfg.modules.loyalty) return ["Sadakat kapalı."];
    const rows = Object.entries(cfg.loyalty)
      .map(([k, v]) => ({ name: k.split(":")[1] || k, points: v.points }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 5);
    if (!rows.length) return ["Henüz puan yok."];
    return [
      `Top ${cfg.pointsName}: ${rows.map((r, i) => `${i + 1}.${r.name}(${r.points})`).join(" · ")}`,
    ];
  }

  if (cmd === "uptime" || cmd === "yayin") {
    if (!cfg.streamStartedAt) {
      return ["Yayın süresi bilinmiyor — Profil’den “Yayını başlat”a bas."];
    }
    const fake = msg;
    return [
      interpolate("Yayın süresi: $(uptime) · $(game)", {
        msg: fake,
        cfg,
        rawCmd: cmd,
        args,
      }),
    ];
  }

  if (cmd === "bot" || cmd === "sesbot") {
    return [
      `${cfg.botName} yerelde çalışıyor · Kick yazma: ${cfg.replyToKick ? "açık" : "kapalı"} · !komutlar`,
    ];
  }

  if (cmd === "permit" || cmd === "izin") {
    if (!isMod) return ["Mod gerekir."];
    const who = (args[0] || "").replace(/^@/, "");
    if (!who) return ["Kullanım: !permit kullanıcı"];
    grantPermit(`${msg.platform}:${who.toLowerCase()}`, cfg.filters.permitSec || 30);
    return [`${who} ${cfg.filters.permitSec || 30}sn link izni aldı.`];
  }

  if (cmd === "editcounter" || cmd === "sayac" || cmd === "counter") {
    if (!isMod) return ["Mod gerekir."];
    const name = args[0];
    const op = args[1];
    if (!name) {
      return [
        `Sayaçlar: ${cfg.counters.map((c) => `${c.name}=${c.value}`).join(" · ") || "yok"}`,
      ];
    }
    let valueDelta = 0;
    let setAbs: number | null = null;
    if (op === "+" || op === "add" || op === "arttir") valueDelta = Number(args[2] || 1) || 1;
    else if (op === "-" || op === "sub" || op === "azalt") valueDelta = -(Number(args[2] || 1) || 1);
    else if (op === "set" || op === "ayarla") setAbs = Number(args[2] || 0) || 0;
    else if (op && !Number.isNaN(Number(op))) setAbs = Number(op);
    else valueDelta = 1;

    saveBotConfig((prev) => {
      const counters = [...prev.counters];
      let c = counters.find((x) => x.name.toLowerCase() === name.toLowerCase());
      if (!c) {
        c = { id: `ctr_${name}`, name, value: 0 };
        counters.push(c);
      }
      if (setAbs != null) c.value = setAbs;
      else c.value = Math.max(0, c.value + valueDelta);
      return { ...prev, counters };
    });
    const v = getBotConfig().counters.find((x) => x.name.toLowerCase() === name.toLowerCase());
    return [`${name} = ${v?.value ?? 0}`];
  }

  if (cmd === "setgame" || cmd === "oyun") {
    if (!isMod) return ["Mod gerekir."];
    const game = args.join(" ").trim();
    if (!game) return [`Oyun: ${cfg.game || "—"}`];
    saveBotConfig((p) => ({ ...p, game }));
    return [`Oyun: ${game}`];
  }

  if (cmd === "settitle" || cmd === "baslik") {
    if (!isMod) return ["Mod gerekir."];
    const title = args.join(" ").trim();
    if (!title) return [`Başlık: ${cfg.title || "—"}`];
    saveBotConfig((p) => ({ ...p, title }));
    return [`Başlık: ${title}`];
  }

  if (cmd === "clip") {
    if (!(cfg.modules as any).clip) return ["Clip kapalı."];
    return [
      `${msg.user} clip istedi — Kick/Twitch clip API bu yerel sürümde manuel; yayıncı klip alsın!`,
    ];
  }

  if (cmd === "resetranking" || cmd === "sifirlaranking") {
    if (!isMod) return ["Mod gerekir."];
    const what = (args[0] || "all").toLowerCase();
    saveBotConfig((prev) => {
      const loyalty = { ...prev.loyalty };
      for (const k of Object.keys(loyalty)) {
        if (what === "points" || what === "puan" || what === "all") loyalty[k].points = 0;
        if (what === "watch" || what === "all") loyalty[k].watchMin = 0;
        if (what === "messages" || what === "all") loyalty[k].messages = 0;
      }
      return { ...prev, loyalty };
    });
    return [`Ranking sıfırlandı (${what}).`];
  }

  if (cmd === "subathon") {
    if (!isMod) return ["Mod gerekir."];
    const sub = (args[0] || "").toLowerCase();
    if (sub === "start" || sub === "başlat") {
      const base = Number(args[1] || (cfg as any).subathon?.baseSeconds || 3600);
      saveBotConfig(
        (prev) =>
          ({
            ...prev,
            subathon: {
              ...((prev as any).subathon || {}),
              enabled: true,
              endsAt: Date.now() + base * 1000,
            },
            modules: { ...prev.modules, subathon: true },
          }) as any
      );
      return [`Subathon başladı (${base}sn). Overlay: /subathon?obs=1`];
    }
    if (sub === "stop" || sub === "dur") {
      saveBotConfig(
        (prev) =>
          ({
            ...prev,
            subathon: { ...((prev as any).subathon || {}), enabled: false, endsAt: null },
          }) as any
      );
      return ["Subathon durdu."];
    }
    return ["!subathon start [sn] | !subathon stop"];
  }

  if (cmd === "so" || cmd === "shoutout") {
    const target = args[0] || "";
    if (!target) return ["!so [kullanıcı] [mesaj]"];
    const message = args.slice(1).join(" ").trim() || `Herkese selam @${target}!`;
    void import("./events").then(({ emitWidgetEvent }) =>
      emitWidgetEvent({
        kind: "shoutout",
        user: target.replace(/^@/, ""),
        message,
        platform: msg.platform,
        meta: { durationMs: 6000 },
      })
    );
    return [`Shoutout → ${target}`];
  }

  if (cmd === "tts" || cmd === "sesli") {
    const tts = (cfg as any).tts;
    if (!tts?.enabled) return ["Sesli okuma kapalı."];
    const text = args.join(" ").trim();
    if (!text) return ["!tts [mesaj]"];
    const low = text.toLowerCase();
    const blocked = (tts.blacklist || []).some(
      (w: string) => w && low.includes(String(w).toLowerCase())
    );
    if (blocked) return ["Bu mesaj engelli."];
    const clipped = text.slice(0, tts.maxLen || 200);
    void import("./events").then(({ emitWidgetEvent }) =>
      emitWidgetEvent({
        kind: "tts",
        user: msg.user,
        message: clipped,
        platform: msg.platform,
        meta: { voice: tts.voice || "", lang: tts.lang || "tr-TR", cloudMode: !!tts.cloudMode },
      })
    );
    return [`🔊 TTS: ${clipped.slice(0, 40)}${clipped.length > 40 ? "…" : ""}`];
  }

  if (cmd === "wheel" || cmd === "cark" || cmd === "çark") {
    if (!(cfg as any).modules?.wheel) return null;
    if (!isMod) return ["Mod gerekir."];
    const sub = (args[0] || "spin").toLowerCase();
    const opts: string[] =
      Array.isArray((cfg as any).wheel?.options) && (cfg as any).wheel.options.length
        ? (cfg as any).wheel.options
        : ["Ödül 1", "Ödül 2", "Ödül 3", "Tekrar"];
    if (sub === "options" || sub === "secenek") {
      const list = args
        .slice(1)
        .join(" ")
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean);
      if (!list.length) return ["!wheel options A|B|C"];
      saveBotConfig(
        (prev) =>
          ({
            ...prev,
            wheel: {
              ...((prev as any).wheel || {}),
              options: list,
              weights: list.map(() => 1),
              spinning: false,
            },
          }) as any
      );
      return [`Çark seçenekleri: ${list.join(", ")}`];
    }
    void import("./v2").then(({ pickWeightedIndex, computeWheelRotationDeg }) => {
      const wheel = (getBotConfig() as any).wheel || {};
      const options: string[] =
        Array.isArray(wheel.options) && wheel.options.length
          ? wheel.options
          : opts;
      const weights: number[] =
        Array.isArray(wheel.weights) && wheel.weights.length === options.length
          ? wheel.weights
          : options.map(() => 1);
      const idx = pickWeightedIndex(weights, options.length);
      const result = options[idx] || options[0];
      const spinMs = Math.max(1500, Number(wheel.spinDurationMs) || 4000);
      const prevRot = Number(wheel.rotationDeg) || 0;
      const rotationDeg = prevRot + computeWheelRotationDeg(idx, options.length);
      saveBotConfig(
        (prev) =>
          ({
            ...prev,
            wheel: {
              ...((prev as any).wheel || {}),
              options,
              weights,
              spinning: true,
              result: "",
              rotationDeg,
              spinDurationMs: spinMs,
            },
          }) as any
      );
      void import("./events").then(({ emitWidgetEvent }) =>
        emitWidgetEvent({
          kind: "wheel",
          user: msg.user,
          message: "spin",
          meta: { spinning: true, rotationDeg, result, spinDurationMs: spinMs },
        })
      );
      window.setTimeout(() => {
        saveBotConfig(
          (prev) =>
            ({
              ...prev,
              wheel: { ...((prev as any).wheel || {}), spinning: false, result, rotationDeg },
            }) as any
        );
        void import("./events").then(({ emitWidgetEvent }) =>
          emitWidgetEvent({
            kind: "wheel",
            user: msg.user,
            message: result,
            meta: { result, rotationDeg },
          })
        );
      }, spinMs);
    });
    return [`🎡 Çark dönüyor…`];
  }

  if (cmd === "hype" || cmd === "hypetrain") {
    if (!(cfg as any).modules?.hypeTrain) return null;
    if (!isMod) return ["Mod gerekir."];
    const sub = (args[0] || "").toLowerCase();
    if (sub === "start" || sub === "başlat") {
      const goal = Math.max(10, Number(args[1]) || 100);
      saveBotConfig(
        (prev) =>
          ({
            ...prev,
            hypeTrain: {
              active: true,
              level: 1,
              progress: 0,
              goal,
              conductor: (cfg as any).hypeTrain?.conductor || msg.user || "",
            },
            modules: { ...prev.modules, hypeTrain: true },
          }) as any
      );
      void import("./events").then(({ emitWidgetEvent }) =>
        emitWidgetEvent({ kind: "hypetrain", user: msg.user, message: "start", meta: { goal } })
      );
      return [`Hype Train başladı (hedef ${goal}).`];
    }
    if (sub === "stop" || sub === "dur") {
      saveBotConfig(
        (prev) =>
          ({
            ...prev,
            hypeTrain: { ...((prev as any).hypeTrain || {}), active: false },
          }) as any
      );
      return ["Hype Train bitti."];
    }
    if (sub === "add" || sub === "ekle") {
      const bump = Math.max(1, Number(args[1]) || 10);
      saveBotConfig((prev) => {
        let hypeTrain = { ...((prev as any).hypeTrain || {}), active: true };
        let progress = (hypeTrain.progress || 0) + bump;
        let level = hypeTrain.level || 1;
        let goal = hypeTrain.goal || 100;
        while (progress >= goal) {
          progress -= goal;
          level += 1;
          goal = Math.floor(goal * 1.25);
        }
        return { ...prev, hypeTrain: { ...hypeTrain, progress, level, goal } } as any;
      });
      return [`Hype +${bump}`];
    }
    return ["!hype start [hedef] | !hype add [n] | !hype stop"];
  }

  if (cmd === "viewers" || cmd === "izleyici") {
    if (!isMod) return ["Mod gerekir."];
    const n = Number(args[0]);
    if (!Number.isFinite(n) || n < 0) return ["!viewers [sayı]"];
    saveBotConfig((prev) => ({ ...prev, viewerCount: Math.floor(n) }) as any);
    void import("./events").then(({ emitWidgetEvent }) =>
      emitWidgetEvent({ kind: "viewers", user: msg.user, amount: String(Math.floor(n)) })
    );
    return [`İzleyici: ${Math.floor(n)}`];
  }

  if (cmd === "cup" || cmd === "copa" || cmd === "glass") {
    if (!isMod) return ["Mod gerekir."];
    const sub = (args[0] || "").toLowerCase();
    if (sub === "add" || sub === "ekle") {
      const add = Math.max(1, Number(args[1]) || 1);
      saveBotConfig((prev) => {
        const cup = { ...((prev as any).cup || {}) };
        return {
          ...prev,
          cup: { ...cup, current: Number(cup.current || 0) + add, enabled: true },
        } as any;
      });
      void import("./events").then(({ emitWidgetEvent }) =>
        emitWidgetEvent({ kind: "cup", user: msg.user, amount: String(add) })
      );
      return [`Copa +${add}`];
    }
    if (sub === "set" || sub === "ayarla") {
      const current = Math.max(0, Number(args[1]) || 0);
      const target = args[2] != null ? Math.max(1, Number(args[2]) || 100) : undefined;
      saveBotConfig((prev) => {
        const cup = { ...((prev as any).cup || {}) };
        return {
          ...prev,
          cup: {
            ...cup,
            current,
            ...(target != null ? { target } : {}),
            enabled: true,
          },
        } as any;
      });
      return [`Copa = ${current}${target != null ? ` / ${target}` : ""}`];
    }
    if (sub === "reset" || sub === "sıfırla") {
      saveBotConfig(
        (prev) =>
          ({
            ...prev,
            cup: { ...((prev as any).cup || {}), current: 0 },
          }) as any
      );
      return ["Copa sıfırlandı."];
    }
    return ["!cup add [n] | !cup set [current] [target?] | !cup reset"];
  }

  if (cmd === "addpoints" || cmd === "verpuan") {
    if (!isMod) return ["Mod gerekir."];
    const who = (args[0] || "").replace(/^@/, "");
    const amt = Number(args[1] || 0);
    if (!who || !amt) return ["Kullanım: !addpoints kullanıcı miktar"];
    const key = `${msg.platform}:${who.toLowerCase()}`;
    saveBotConfig((prev) => {
      const u = prev.loyalty[key] || {
        points: 0,
        messages: 0,
        watchMin: 0,
        lastSeen: Date.now(),
      };
      return {
        ...prev,
        loyalty: {
          ...prev.loyalty,
          [key]: { ...u, points: Math.max(0, u.points + amt) },
        },
      };
    });
    return [`${who} +${amt} ${cfg.pointsName}`];
  }

  if (cmd === "redeem" || cmd === "magaza" || cmd === "shop") {
    if (!(cfg.modules as any).shop) return ["Mağaza kapalı."];
    const shop = (cfg as any).shop || [];
    if (!args[0] || args[0] === "list" || args[0] === "liste") {
      if (!shop.length) return ["Mağaza boş."];
      return [
        `Mağaza: ${shop
          .filter((s: any) => s.enabled)
          .map((s: any) => `!redeem ${s.name}(${s.cost})`)
          .join(" · ")}`,
      ];
    }
    const item = shop.find(
      (s: any) => s.enabled && String(s.name).toLowerCase() === args[0].toLowerCase()
    );
    if (!item) return [`Ürün yok: ${args[0]}`];
    const userKey = `${msg.platform}:${msg.user.toLowerCase()}`;
    const bal = cfg.loyalty[userKey]?.points ?? 0;
    if (bal < item.cost) return [`Yetersiz ${cfg.pointsName} (var: ${bal}, lazım: ${item.cost})`];
    saveBotConfig((prev) => {
      const u = prev.loyalty[userKey] || {
        points: 0,
        messages: 0,
        watchMin: 0,
        lastSeen: Date.now(),
      };
      const recent = { ...((prev as any).recent || { follows: [], subs: [], raids: [], redeems: [] }) };
      recent.redeems = [{ user: msg.user, item: item.name, t: Date.now() }, ...(recent.redeems || [])].slice(
        0,
        30
      );
      const salesLog = [
        {
          id: `sale_${Date.now()}`,
          user: msg.user,
          item: item.name,
          cost: item.cost,
          t: Date.now(),
        },
        ...(((prev as any).salesLog as any[]) || []),
      ].slice(0, 100);
      return {
        ...prev,
        loyalty: {
          ...prev.loyalty,
          [userKey]: { ...u, points: u.points - item.cost, lastSeen: Date.now() },
        },
        recent,
        salesLog,
      } as any;
    });
    const text = String(item.response || "")
      .replace(/\$\(user\)/gi, msg.user)
      .replace(/\{user\}/gi, msg.user);
    if (item.alert) {
      void import("./events").then(({ emitWidgetEvent }) =>
        emitWidgetEvent({
          kind: "redeem",
          user: msg.user,
          message: text,
          meta: { item: item.name },
          platform: msg.platform,
        })
      );
    }
    return [text || `${msg.user} ${item.name} aldı!`];
  }

  if (cmd === "poll" || cmd === "anket") {
    if (!(cfg.modules as any).poll) return ["Anket kapalı."];
    const sub = (args[0] || "").toLowerCase();
    if (sub === "start" || sub === "aç" || sub === "open") {
      if (!isMod) return ["Mod gerekir."];
      const rest = args.slice(1).join(" ");
      const parts = rest.split("|").map((s) => s.trim()).filter(Boolean);
      if (parts.length < 3) return ["!poll start Soru? | A | B | C"];
      saveBotConfig(
        (prev) =>
          ({
            ...prev,
            poll: {
              active: true,
              question: parts[0],
              options: parts.slice(1).slice(0, 6),
              votes: {},
              endsAt: Date.now() + 5 * 60_000,
            },
          }) as any
      );
      return [`Anket: ${parts[0]} — oy: !vote 1..${parts.length - 1}`];
    }
    if (sub === "end" || sub === "kapat" || sub === "close") {
      if (!isMod) return ["Mod gerekir."];
      const p = (cfg as any).poll;
      if (!p?.active) return ["Açık anket yok."];
      const counts = (p.options || []).map((_: string, i: number) =>
        Object.values(p.votes || {}).filter((v) => v === i).length
      );
      saveBotConfig((prev) => ({ ...prev, poll: { ...p, active: false } }) as any);
      return [
        `Anket bitti: ${(p.options || [])
          .map((o: string, i: number) => `${o}=${counts[i]}`)
          .join(" · ")}`,
      ];
    }
    return ["!poll start Soru | A | B  ·  !vote 1"];
  }

  if (cmd === "vote" || cmd === "oy") {
    const p = (cfg as any).poll;
    if (!p?.active) return ["Aktif anket yok."];
    const idx = Number(args[0]) - 1;
    if (!Number.isFinite(idx) || idx < 0 || idx >= (p.options || []).length) {
      return [`Kullanım: !vote 1-${p.options.length}`];
    }
    const userKey = `${msg.platform}:${msg.user.toLowerCase()}`;
    saveBotConfig((prev) => {
      const poll = { ...(prev as any).poll };
      poll.votes = { ...(poll.votes || {}), [userKey]: idx };
      return { ...prev, poll } as any;
    });
    return [`${msg.user} → ${p.options[idx]}`];
  }

  if (cmd === "prediction" || cmd === "tahmin") {
    if (!(cfg.modules as any).prediction) return ["Tahmin kapalı."];
    const sub = (args[0] || "").toLowerCase();
    if (sub === "start" || sub === "aç") {
      if (!isMod) return ["Mod gerekir."];
      const q = args.slice(1).join(" ").trim() || "Ne olur?";
      saveBotConfig(
        (prev) =>
          ({
            ...prev,
            prediction: {
              active: true,
              question: q,
              options: ["Evet", "Hayır"],
              pots: [0, 0],
              bets: {},
            },
          }) as any
      );
      return [`Tahmin: ${q} — !bet 1 miktar | !bet 2 miktar`];
    }
    if (sub === "resolve" || sub === "bitir") {
      if (!isMod) return ["Mod gerekir."];
      const win = Number(args[1]) === 2 ? 1 : 0;
      const pred = (cfg as any).prediction;
      if (!pred?.active) return ["Aktif tahmin yok."];
      const winners = Object.entries(pred.bets || {}).filter(([, b]: any) => b.side === win);
      const winPot = pred.pots[win] || 0;
      const losePot = pred.pots[1 - win] || 0;
      const total = winPot + losePot;
      saveBotConfig((prev) => {
        const loyalty = { ...prev.loyalty };
        for (const [k, b] of winners as any[]) {
          const share = winPot > 0 ? Math.floor((b.amount / winPot) * total) : b.amount;
          const u = loyalty[k] || { points: 0, messages: 0, watchMin: 0, lastSeen: Date.now() };
          loyalty[k] = { ...u, points: u.points + share };
        }
        return {
          ...prev,
          loyalty,
          prediction: { ...pred, active: false, pots: [0, 0], bets: {} },
        } as any;
      });
      return [`Tahmin sonucu: ${pred.options[win]} — ${winners.length} kazanan`];
    }
    return ["!prediction start soru  ·  !bet 1|2 miktar  ·  !prediction resolve 1|2"];
  }

  if (cmd === "bet") {
    const pred = (cfg as any).prediction;
    if (!pred?.active) return ["Aktif tahmin yok."];
    const side = Number(args[0]) === 2 ? 1 : 0;
    const amount = Math.max(1, Math.min(5000, Number(args[1]) || 0));
    if (!amount) return ["!bet 1|2 miktar"];
    const userKey = `${msg.platform}:${msg.user.toLowerCase()}`;
    const bal = cfg.loyalty[userKey]?.points ?? 0;
    if (bal < amount) return [`Yetersiz ${cfg.pointsName}`];
    saveBotConfig((prev) => {
      const prediction = { ...(prev as any).prediction };
      const loyalty = { ...prev.loyalty };
      const u = loyalty[userKey] || { points: 0, messages: 0, watchMin: 0, lastSeen: Date.now() };
      loyalty[userKey] = { ...u, points: u.points - amount };
      const prevBet = prediction.bets?.[userKey];
      if (prevBet) {
        prediction.pots[prevBet.side] = Math.max(0, prediction.pots[prevBet.side] - prevBet.amount);
        loyalty[userKey].points += prevBet.amount;
        loyalty[userKey].points -= amount;
      }
      prediction.bets = { ...(prediction.bets || {}), [userKey]: { side, amount } };
      prediction.pots[side] += amount;
      return { ...prev, loyalty, prediction } as any;
    });
    return [`${msg.user} ${amount} → ${pred.options[side]}`];
  }

  if (cmd === "level" || cmd === "seviye") {
    const userKey = `${msg.platform}:${(args[0] || msg.user).replace(/^@/, "").toLowerCase()}`;
    const points = cfg.loyalty[userKey]?.points ?? 0;
    const tiers = ((cfg as any).levels || []) as { name: string; minPoints: number }[];
    const sorted = [...tiers].sort((a, b) => a.minPoints - b.minPoints);
    let name = sorted[0]?.name || "Yeni";
    for (const t of sorted) if (points >= t.minPoints) name = t.name;
    return [`${args[0] || msg.user}: ${name} (${points} ${cfg.pointsName})`];
  }

  if (cmd === "addcom") {
    if (!isMod) return ["Mod gerekir."];
    const name = (args[0] || "").replace(/^!/, "").trim();
    const response = args.slice(1).join(" ").trim();
    if (!name || !response) return ["Kullanım: !addcom !isim yanıt metni"];
    queueMicrotask(() => {
      void botaxtApi
        .createCommand({
          name,
          response,
          enabled: true,
          min_level: 0,
          cooldown_sec: 5,
          aliases: [],
          platforms_json: JSON.stringify(["kick"]),
        })
        .then(() => reply(msg, [`Komut eklendi: !${name}`]))
        .catch((e: Error) => reply(msg, [e.message || "Komut eklenemedi"]));
    });
    return [];
  }

  if (cmd === "editcom") {
    if (!isMod) return ["Mod gerekir."];
    const name = (args[0] || "").replace(/^!/, "").trim();
    const response = args.slice(1).join(" ").trim();
    if (!name || !response) return ["Kullanım: !editcom !isim yeni yanıt"];
    queueMicrotask(() => {
      void botaxtApi
        .commands()
        .then((r) => {
          const list = (r.commands || []) as { id?: string; name?: string }[];
          const found = list.find(
            (c) => String(c.name || "").toLowerCase() === name.toLowerCase()
          );
          if (!found?.id) {
            reply(msg, [`!${name} bulunamadı`]);
            return;
          }
          return botaxtApi.updateCommand({
            id: found.id,
            name,
            response,
            enabled: true,
          });
        })
        .then((ok) => {
          if (ok !== undefined) reply(msg, [`Komut güncellendi: !${name}`]);
        })
        .catch((e: Error) => reply(msg, [e.message || "Komut güncellenemedi"]));
    });
    return [];
  }

  if (cmd === "delcom") {
    if (!isMod) return ["Mod gerekir."];
    const name = (args[0] || "").replace(/^!/, "").trim();
    if (!name) return ["Kullanım: !delcom !isim"];
    queueMicrotask(() => {
      void botaxtApi
        .commands()
        .then((r) => {
          const list = (r.commands || []) as { id?: string; name?: string }[];
          const found = list.find(
            (c) => String(c.name || "").toLowerCase() === name.toLowerCase()
          );
          if (!found?.id) {
            reply(msg, [`!${name} bulunamadı`]);
            return;
          }
          return botaxtApi.deleteCommand(found.id);
        })
        .then((ok) => {
          if (ok !== undefined) reply(msg, [`Komut silindi: !${name}`]);
        })
        .catch((e: Error) => reply(msg, [e.message || "Komut silinemedi"]));
    });
    return [];
  }

  if (cmd === "followage") {
    const target = (args[0] || msg.user).replace(/^@/, "");
    queueMicrotask(() => {
      void botaxtApi
        .loyaltyUsers(200)
        .then((r) => {
          const users = (r.users || []) as {
            user_name?: string;
            watch_sec?: number;
            messages?: number;
          }[];
          const u = users.find(
            (x) => String(x.user_name || "").toLowerCase() === target.toLowerCase()
          );
          if (!u || (!u.watch_sec && !u.messages)) {
            reply(msg, [`@${target} henüz bu kanalı takip etmiyor.`]);
            return;
          }
          const sec = Number(u.watch_sec || 0);
          const m = Math.floor(sec / 60);
          reply(msg, [`@${target} kanalda ${m} dakika süredir görünüyor.`]);
        })
        .catch(() => reply(msg, [`@${target} takip bilgisi alınamadı.`]));
    });
    return [];
  }

  if (cmd === "command" || cmd === "cmd") {
    if (!isMod) return ["Mod gerekir."];
    const sub = (args[0] || "").toLowerCase();
    if (sub === "add" || sub === "ekle") {
      let name = (args[1] || "").replace(/^!/, "");
      const response = args.slice(2).join(" ").trim();
      if (!name || !response) return ["!cmd add !isim yanıt"];
      saveBotConfig((prev) => ({
        ...prev,
        commands: [
          ...prev.commands.filter((c) => normName(c.name) !== normName(name)),
          {
            id: `cmd_${Date.now()}`,
            name,
            aliases: [],
            response,
            enabled: true,
            userCooldownSec: 5,
            globalCooldownSec: 2,
            level: 100 as UserLevel,
            count: 0,
          },
        ],
      }));
      return [`Komut eklendi: !${name}`];
    }
    if (sub === "remove" || sub === "del" || sub === "sil") {
      const name = (args[1] || "").replace(/^!/, "");
      saveBotConfig((prev) => ({
        ...prev,
        commands: prev.commands.filter((c) => normName(c.name) !== normName(name)),
      }));
      return [`Komut silindi: !${name}`];
    }
    if (sub === "edit" || sub === "duzenle") {
      const name = (args[1] || "").replace(/^!/, "");
      const response = args.slice(2).join(" ").trim();
      if (!name || !response) return ["!cmd edit !isim yeni yanıt"];
      saveBotConfig((prev) => ({
        ...prev,
        commands: prev.commands.map((c) =>
          normName(c.name) === normName(name) ? { ...c, response } : c
        ),
      }));
      return [`Komut güncellendi: !${name}`];
    }
    return ["!cmd add|edit|remove !isim …"];
  }

  return null;
}

/**
 * Her sohbet mesajında çağrılır.
 * Eski SesBot (SFX / istek) korunur; smart bot üstüne biner.
 */
export function handleSmartBotMessage(msg: ChatMessage): ChatMessage[] {
  bootstrapSmartBot();

  if (isLocalBotUser(msg.user, getBotConfig().botName) || String(msg.key).startsWith("bot-") || String(msg.key).startsWith("timer-")) {
    return [];
  }

  const cfg = getBotConfig();
  if (!cfg.enabled) {
    // Bot kapalıysa yine de eski SFX/istek çalışsın
    return handleChatCommand(msg);
  }

  if (msg.kind === "chat") {
    noteChatLine();
    noteChatter(msg.platform, msg.user);
    // Loyalty mesaj puanı — async microtask (UI donmasın)
    queueMicrotask(() => bumpLoyaltyMessage(msg));

    // Botaxt raffles keyword (+1)
    queueMicrotask(() => {
      const lines = tryGiveawayKeyword(msg);
      if (lines?.length) reply(msg, lines);
    });

    // Botaxt emotewall — sohbet emote’ları
    const ew = (cfg as any).emotewall;
    if (ew?.enabled !== false) {
      const emotes = (msg.parts || []).filter((p) => p.type === "emote") as { type: "emote"; url: string; name: string }[];
      if (emotes.length) {
        queueMicrotask(() => {
          for (const e of emotes.slice(0, 8)) {
            void import("./events").then(({ emitWidgetEvent }) =>
              emitWidgetEvent({
                kind: "emote",
                user: msg.user,
                message: e.name,
                meta: { emote: e.name, url: e.url },
                platform: msg.platform,
              })
            );
          }
        });
      }
    }

    // Botaxt TTS / CloudTTS — sohbeti seslendir
    const tts = (cfg as any).tts;
    if (tts?.enabled) {
      const text = String(msg.text || "").trim();
      if (text && !(tts.skipCommands && text.startsWith("!"))) {
        const low = text.toLowerCase();
        const blocked = (tts.blacklist || []).some((w: string) => w && low.includes(String(w).toLowerCase()));
        if (!blocked) {
          queueMicrotask(() => {
            void import("./events").then(({ emitWidgetEvent }) =>
              emitWidgetEvent({
                kind: "tts",
                user: msg.user,
                message: text.slice(0, tts.maxLen || 120),
                platform: msg.platform,
                meta: { cloudMode: !!tts.cloudMode },
              })
            );
          });
        }
      }
    }
  }

  // Chat alerts → sohbet + OBS alert widget + recent/goals
  if (cfg.modules.chatAlerts && msg.kind !== "chat") {
    const map: Record<string, string> = {
      follow: `Teşekkürler takip @${msg.user}!`,
      sub: `Teşekkürler abone @${msg.user}${msg.amount ? ` (${msg.amount})` : ""}!`,
      raid: `Raid! Hoş geldin @${msg.user}${msg.amount ? ` ×${msg.amount}` : ""}`,
      bits: `Bits: @${msg.user} ${msg.amount || ""}`,
      superchat: `Super Chat @${msg.user} ${msg.amount || ""}`,
      membership: `Üyelik @${msg.user}!`,
    };
    const line = map[msg.kind];
    if (line) queueMicrotask(() => reply(msg, [line]));
    queueMicrotask(() => {
      const kind =
        msg.kind === "follow"
          ? "follow"
          : msg.kind === "sub" || msg.kind === "membership"
            ? "sub"
            : msg.kind === "raid"
              ? "raid"
              : msg.kind === "bits" || msg.kind === "superchat"
                ? "bits"
                : "donation";
      void import("./events").then(({ emitWidgetEvent }) =>
        emitWidgetEvent({
          kind: kind as any,
          user: msg.user,
          amount: msg.amount || undefined,
          platform: msg.platform,
          message: msg.text,
        })
      );
      saveBotConfig((prev) => {
        const recent = {
          follows: [],
          subs: [],
          raids: [],
          redeems: [],
          ...((prev as any).recent || {}),
        };
        const entry = { user: msg.user, amount: msg.amount || undefined, t: Date.now() };
        if (msg.kind === "follow") recent.follows = [entry, ...(recent.follows || [])].slice(0, 30);
        if (msg.kind === "sub" || msg.kind === "membership")
          recent.subs = [entry, ...(recent.subs || [])].slice(0, 30);
        if (msg.kind === "raid") recent.raids = [entry, ...(recent.raids || [])].slice(0, 30);
        const goals = ((prev as any).goals || []).map((g: any) => {
          if (!g.enabled) return g;
          const kind = String(msg.kind);
          if (g.kind === "followers" && kind === "follow")
            return { ...g, current: g.current + 1 };
          if (g.kind === "subs" && (kind === "sub" || kind === "membership"))
            return { ...g, current: g.current + 1 };
          if (g.kind === "tips" && (kind === "superchat" || kind === "donation" || kind === "bits")) {
            const amt = Number(String(msg.amount || "").replace(/[^\d.]/g, "")) || 1;
            return { ...g, current: g.current + amt };
          }
          if (g.kind === "kicks" && (kind === "bits" || msg.platform === "kick")) {
            if (kind === "bits" || kind === "superchat" || kind === "donation") {
              const amt = Number(String(msg.amount || "").replace(/[^\d.]/g, "")) || 1;
              return { ...g, current: g.current + amt };
            }
          }
          return g;
        });
        // Subathon uzatma
        let subathon = { ...((prev as any).subathon || {}) };
        if (subathon.enabled && subathon.endsAt && !subathon.paused) {
          const amt = Number(String(msg.amount || "").replace(/[^\d.]/g, "")) || 0;
          let add = 0;
          if (msg.kind === "follow") {
            add = Number(subathon.secondsPerFollow || 0) * 1000;
          } else if (msg.kind === "sub" || msg.kind === "membership") {
            add = Number(subathon.secondsPerSub || 0) * 1000;
          } else if (msg.kind === "bits") {
            const perBit = Number(subathon.secondsPerBit || 0);
            add = perBit * Math.max(1, amt || 1) * 1000;
          } else if (msg.kind === "superchat") {
            add = Number(subathon.secondsPerTip || 0) * 1000;
          }
          if (add > 0) subathon = { ...subathon, endsAt: Math.max(Date.now(), subathon.endsAt) + add };
        }
        // Hype train progress
        let hypeTrain = { ...((prev as any).hypeTrain || {}) };
        if (hypeTrain.active) {
          const bump =
            msg.kind === "sub" || msg.kind === "membership" || msg.kind === "bits" ? 10 : msg.kind === "follow" ? 2 : 0;
          if (bump) {
            let progress = (hypeTrain.progress || 0) + bump;
            let level = hypeTrain.level || 1;
            let goal = hypeTrain.goal || 100;
            while (progress >= goal) {
              progress -= goal;
              level += 1;
              goal = Math.floor(goal * 1.25);
            }
            hypeTrain = { ...hypeTrain, progress, level, goal };
          }
        }
        // Botaxt glass/cup — bits / tip / kicks ile dolar
        let cup = { ...((prev as any).cup || {}) };
        if (cup.enabled !== false) {
          const amt = Number(String(msg.amount || "").replace(/[^\d.]/g, "")) || 0;
          const kind = String(msg.kind);
          const add =
            kind === "bits"
              ? Math.max(cup.minBits || 1, amt || 1)
              : kind === "superchat" || kind === "donation"
                ? Math.max(1, amt || 1)
                : msg.platform === "kick" && (kind === "bits" || amt > 0)
                  ? Math.max(cup.minKicks || 1, amt || 1)
                  : 0;
          if (add > 0) cup = { ...cup, current: Number(cup.current || 0) + add };
        }
        // Emotewall explosion
        const ew = (prev as any).emotewall || {};
        if ((msg.kind === "follow" && ew.explosionOnFollow) || ((msg.kind === "sub" || msg.kind === "membership") && ew.explosionOnSub)) {
          queueMicrotask(() => {
            void import("./events").then(({ emitWidgetEvent }) =>
              emitWidgetEvent({
                kind: "emote",
                user: msg.user,
                message: "💥",
                meta: { explosion: true, count: 12 },
                platform: msg.platform,
              })
            );
          });
        }
        // Loyalty extras — bits / sub puan
        let loyalty = { ...prev.loyalty };
        const lx = (prev as any).loyaltyExtras || {};
        const userKey = `${msg.platform}:${(msg.user || "").toLowerCase()}`;
        const ignored = (lx.ignoredUsers || []).map((x: string) => x.toLowerCase());
        if (!ignored.includes((msg.user || "").toLowerCase())) {
          if (msg.kind === "bits" || msg.kind === "superchat") {
            const amt = Number(String(msg.amount || "").replace(/[^\d.]/g, "")) || 0;
            const add = Math.floor((amt / 100) * (lx.pointsPer100Bits || 0));
            if (add > 0) {
              const u = loyalty[userKey] || { points: lx.initialPoints || 0, messages: 0, watchMin: 0, lastSeen: Date.now() };
              loyalty = { ...loyalty, [userKey]: { ...u, points: (u.points || 0) + add, lastSeen: Date.now() } };
            }
          }
          if (msg.kind === "sub" || msg.kind === "membership") {
            const add = Number(lx.pointsPerSub || 0);
            if (add > 0) {
              const u = loyalty[userKey] || { points: lx.initialPoints || 0, messages: 0, watchMin: 0, lastSeen: Date.now() };
              loyalty = { ...loyalty, [userKey]: { ...u, points: (u.points || 0) + add, lastSeen: Date.now() } };
            }
          }
        }
        return { ...prev, recent, goals, subathon, hypeTrain, cup, loyalty } as any;
      });
    });
  }

  // Emote combo (aynı emote peş peşe)
  if (msg.kind === "chat" && (cfg.modules as any).emoteCombo) {
    queueMicrotask(() => trackEmoteCombo(msg));
  }

  // Spam — yalnızca uyarı (timeout API yok)
  if (msg.kind === "chat") {
    const spam = checkSpam(msg, cfg.filters, broadcasters());
    if (!spam.ok) {
      try {
        window.dispatchEvent(
          new CustomEvent("chat-command-toast", {
            detail: `Filtre (${spam.action}): ${msg.user} — ${spam.reason}`,
          })
        );
      } catch {
        /* */
      }
    }
  }

  const parsed = String(msg.text || "")
    .trim()
    .match(/^!(\S+)\s*(.*)$/u);

  // Botaxt claim drop
  if (msg.kind === "chat") {
    const drop = (cfg as any).loyaltyExtras?.claimDrop;
    if (drop?.enabled && drop.activeUntil && Date.now() < drop.activeUntil) {
      const claimCmd = normName(drop.command || "claim");
      const textNorm = normName(String(msg.text || "").replace(/^!/, ""));
      if (textNorm === claimCmd || (parsed && normName(parsed[1]) === claimCmd)) {
        queueMicrotask(() => {
          const key = `${msg.platform}:${msg.user.toLowerCase()}`;
          saveBotConfig((prev) => {
            const lx = { ...((prev as any).loyaltyExtras || {}) };
            const cd = { ...(lx.claimDrop || {}) };
            if (!cd.activeUntil || Date.now() >= cd.activeUntil) return prev;
            const claimed: string[] = Array.isArray(cd.claimed) ? cd.claimed : [];
            if (claimed.includes(key)) return prev;
            if (claimed.length >= (cd.claimLimit || 100)) return prev;
            const u = prev.loyalty[key] || {
              points: lx.initialPoints || 0,
              messages: 0,
              watchMin: 0,
              lastSeen: Date.now(),
            };
            if ((u.messages || 0) < (cd.minMessages || 0)) return prev;
            const reward = Number(cd.reward || 0);
            const success = String(cd.successMsg || "$(user) {reward} puan aldı!")
              .replace(/\$\(user\)/gi, msg.user)
              .replace(/\{reward\}/gi, String(reward));
            queueMicrotask(() => reply(msg, [success]));
            return {
              ...prev,
              loyalty: {
                ...prev.loyalty,
                [key]: { ...u, points: (u.points || 0) + reward, lastSeen: Date.now() },
              },
              loyaltyExtras: {
                ...lx,
                claimDrop: { ...cd, claimed: [...claimed, key] },
              },
            } as any;
          });
        });
      }
    }
  }

  // Keyword komutlar (! olmadan)
  if (!parsed && msg.kind === "chat") {
    const extras = (cfg as any).commandExtras || {};
    for (const c of cfg.commands) {
      if (!c.enabled) continue;
      const ex = extras[c.id] || { trigger: "command" };
      if (ex.trigger !== "keyword") continue;
      const text = String(msg.text || "");
      const needle = c.name;
      let ok = false;
      const km = ex.keywordMatch || "exact";
      if (km === "exact") ok = text.trim().toLowerCase() === needle.toLowerCase();
      else if (km === "startsWith") ok = text.toLowerCase().startsWith(needle.toLowerCase());
      else if (km === "endsWith") ok = text.toLowerCase().endsWith(needle.toLowerCase());
      else ok = text.toLowerCase().includes(needle.toLowerCase());
      if (!ok) continue;
      queueMicrotask(() => runCustomCommand(msg, c, "", []));
      return [];
    }
    return handleChatCommand(msg);
  }

  if (!parsed) {
    return [];
  }

  const cmdRaw = parsed[1];
  const args = buildArgs(msg.text, cmdRaw);
  const cmdNorm = normName(cmdRaw);
  const level = userLevel(msg, broadcasters());

  // 1) Built-in admin / info
  const builtin = handleBuiltinAdmin(msg, cmdNorm, args, level);
  if (builtin) {
    if (builtin.length) queueMicrotask(() => reply(msg, builtin));
    return [];
  }

  // Song request kuyruk
  if ((cmdNorm === "sr" || cmdNorm === "istek" || cmdNorm === "song") && (cfg as any).songRequest?.enabled) {
    const title = args.join(" ").trim();
    if (title) {
      queueMicrotask(() => {
        const sr = (getBotConfig() as any).songRequest;
        const key = `${msg.platform}:${msg.user.toLowerCase()}`;
        const mine = (sr.queue || []).filter((q: any) => q.user === msg.user).length;
        if (mine >= (sr.maxPerUser || 3)) {
          reply(msg, ["Şarkı kotan doldu."]);
          return;
        }
        if ((sr.blacklist || []).some((b: string) => title.toLowerCase().includes(String(b).toLowerCase()))) {
          reply(msg, ["Bu istek engelli."]);
          return;
        }
        const cost = Number(sr.cost || 0);
        const cur = getBotConfig().loyalty[key];
        if (cost > 0 && (!cur || (cur.points || 0) < cost)) {
          reply(msg, [`Bu istek ${cost} puan ister.`]);
          return;
        }
        saveBotConfig((prev) => {
          const loyalty = { ...prev.loyalty };
          if (cost > 0) {
            const u = loyalty[key] || { points: 0, messages: 0, watchMin: 0, lastSeen: Date.now() };
            loyalty[key] = { ...u, points: u.points - cost };
          }
          const songRequest = {
            ...((prev as any).songRequest || {}),
            queue: [
              ...(((prev as any).songRequest?.queue as any[]) || []),
              { id: `sr_${Date.now()}`, user: msg.user, title, url: title, t: Date.now() },
            ],
          };
          return { ...prev, loyalty, songRequest } as any;
        });
        reply(msg, [`Sıraya eklendi: ${title}`]);
      });
      return [];
    }
  }

  // 2) Modules
  const modLines = handleModuleCommand(msg, cmdNorm, args, broadcasters());
  if (modLines) {
    queueMicrotask(() => reply(msg, modLines));
    return [];
  }

  // 3) Custom commands
  const custom = findCommand(cmdNorm, cfg.commands);
  if (custom) {
    queueMicrotask(() => runCustomCommand(msg, custom, cmdRaw, args));
    return [];
  }

  // 4) Legacy SesBot: SFX + şarkı isteği
  const songCmds = new Set(["istek", "sr", "song", "songrequest"]);
  const listCmds = new Set(["seslistesi", "sfxlist", "soundlist", "sounds"]);
  if (songCmds.has(cmdNorm) && !cfg.modules.songRequest) return [];
  if (listCmds.has(cmdNorm) && !cfg.modules.sfx) return [];
  if (!cfg.modules.sfx && !songCmds.has(cmdNorm) && !listCmds.has(cmdNorm)) {
    return [];
  }
  return handleChatCommand(msg);
}

function runCustomCommand(
  msg: ChatMessage,
  custom: import("./types").BotCommand,
  cmdRaw: string,
  args: string[]
) {
  const cfg = getBotConfig();
  const level = userLevel(msg, broadcasters());
  if (!hasLevel(level, custom.level)) return;
  const extras = ((cfg as any).commandExtras || {})[custom.id] || {};
  let extrasUrl = String(extras.url || "").trim();
  try {
    const raw = String((custom as { extras_json?: string }).extras_json || "");
    if (raw) {
      const parsed = JSON.parse(raw) as { url?: string };
      extrasUrl = extrasUrl || String(parsed?.url || "").trim();
    }
  } catch {
    /* */
  }
  const pickedPreview = [custom.response, ...((extras.responses as string[]) || [])].filter(Boolean)[0] || custom.response;
  let invite = extrasUrl ? normalizeSocialUrl(custom.name, extrasUrl) : "";
  if (!invite) invite = extractDiscordInvite(pickedPreview);
  const platforms: string[] = extras.platforms || ["all"];
  if (!platforms.includes("all") && !platforms.includes(msg.platform)) return;
  const avail = extras.availability || "always";
  const live = !!(cfg.streamStartedAt && cfg.streamStartedAt > 0);
  if (avail === "live" && !live) return;
  if (avail === "offline" && live) return;
  const uk = `${custom.name}:${msg.platform}:${msg.user.toLowerCase()}`;
  if (!cooled(userCd, uk, custom.userCooldownSec)) return;
  if (!cooled(globalCd, normName(custom.name), custom.globalCooldownSec)) return;
  const cost = Number(extras.cost || 0);
  const key = `${msg.platform}:${msg.user.toLowerCase()}`;
  if (cost > 0) {
    const u = cfg.loyalty[key];
    if (!u || (u.points || 0) < cost) {
      reply(msg, [`Bu komut ${cost} ${(cfg as any).pointsName || "puan"} ister.`]);
      return;
    }
  }
  saveBotConfig((prev) => {
    let loyalty = prev.loyalty;
    if (cost > 0) {
      const u = loyalty[key] || { points: 0, messages: 0, watchMin: 0, lastSeen: Date.now() };
      loyalty = { ...loyalty, [key]: { ...u, points: Math.max(0, (u.points || 0) - cost) } };
    }
    return {
      ...prev,
      loyalty,
      commands: prev.commands.map((c) =>
        c.id === custom.id ? { ...c, count: (c.count || 0) + 1 } : c
      ),
    };
  });
  const updated = getBotConfig().commands.find((c) => c.id === custom.id) || custom;
  const pool = [custom.response, ...((extras.responses as string[]) || [])].filter(Boolean);
  const picked = pool[Math.floor(Math.random() * pool.length)] || custom.response;
  const text = finalizeCommandReply({
    name: custom.name,
    reply: interpolate(picked, {
      msg,
      cfg: getBotConfig(),
      cmd: updated,
      rawCmd: cmdRaw || custom.name,
      args,
      url: invite,
    }),
    url: invite,
    trigger: msg.text.trim(),
  });
  reply(msg, [text]);
}
