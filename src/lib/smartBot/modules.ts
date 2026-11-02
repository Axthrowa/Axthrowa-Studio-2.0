/** Modüller: 8ball, raffle, giveaway (Botaxt raffles), roulette, slots, quotes, queue. */

import type { ChatMessage } from "../chatHub";
import { saveBotConfig, getBotConfig } from "./store";
import { uid, type Quote } from "./types";
import { hasLevel, userLevel } from "./levels";
import { emitWidgetEvent } from "./events";
import type { GiveawayConfig } from "./v2";
import { mirrorLoyalty } from "./platformActions";

const EIGHT = [
  "Kesinlikle.",
  "Evet.",
  "Belki…",
  "Şüpheli.",
  "Hayır.",
  "Tekrar sor.",
  "Şansın yaver gider.",
  "Olmaz gibi.",
  "Yıldızlar evet diyor.",
  "Vazgeç.",
];

type RaffleState = {
  active: boolean;
  entrants: Set<string>;
  prize: string;
  startedBy: string;
};

type QueueState = { users: string[] };

let raffle: RaffleState = { active: false, entrants: new Set(), prize: "", startedBy: "" };
let viewerQueue: QueueState = { users: [] };
const gameCd = new Map<string, number>();

function gameCooled(key: string, sec: number): boolean {
  if (sec <= 0) return true;
  const now = Date.now();
  const prev = gameCd.get(key) || 0;
  if (now - prev < sec * 1000) return false;
  gameCd.set(key, now);
  return true;
}

function keyOf(msg: ChatMessage) {
  return `${msg.platform}:${(msg.user || "").toLowerCase()}`;
}

function isSub(msg: ChatMessage) {
  return (msg.badges || []).some((b) => /sub|subscriber|abon|üye|uye/i.test(String(b?.label || "")));
}

function syncGiveaway(patch: Partial<GiveawayConfig>) {
  saveBotConfig((prev) => {
    const g = { ...(prev as any).giveaway, ...patch };
    return { ...prev, giveaway: g } as any;
  });
  void emitWidgetEvent({
    kind: "giveaway",
    user: patch.winner || "system",
    message: patch.prize || patch.keyword,
    meta: { ...patch },
  });
}

function weightedPick(entrants: string[], multiplier: number): string {
  const bag: string[] = [];
  for (const e of entrants) {
    const n = Math.max(1, multiplier);
    for (let i = 0; i < n; i++) bag.push(e);
  }
  if (!bag.length) return entrants[0] || "";
  return bag[Math.floor(Math.random() * bag.length)];
}

/** Botaxt raffles: anahtar kelime ile katılım (+1) */
export function tryGiveawayKeyword(msg: ChatMessage): string[] | null {
  const cfg = getBotConfig() as any;
  const g: GiveawayConfig | undefined = cfg.giveaway;
  if (!g?.active || !cfg.modules?.giveaway) return null;
  const text = String(msg.text || "").trim();
  const kw = String(g.keyword || "+1").trim();
  if (!kw || text.toLowerCase() !== kw.toLowerCase()) return null;
  if (g.subsOnly && !isSub(msg)) return ["Sadece aboneler katılabilir."];
  const key = keyOf(msg);
  if (g.entrants.includes(key)) return null;
  const entrants = [...g.entrants, key];
  syncGiveaway({ entrants });
  return [`${msg.user} çekilişe katıldı (${entrants.length})`];
}

export function handleModuleCommand(
  msg: ChatMessage,
  cmd: string,
  args: string[],
  broadcasters: string[]
): string[] | null {
  const cfg = getBotConfig();
  const m = cfg.modules;
  const level = userLevel(msg, broadcasters);
  const isMod = hasLevel(level, 500);

  if (cmd === "8ball" || cmd === "sekiztop") {
    if (!m.eightball) return null;
    return [`🎱 ${EIGHT[Math.floor(Math.random() * EIGHT.length)]}`];
  }

  if (cmd === "quote" || cmd === "soz") {
    if (!m.quotes) return null;
    const sub = (args[0] || "").toLowerCase();
    if (sub === "add" || sub === "ekle") {
      if (!isMod) return ["Mod gerekir."];
      const text = args.slice(1).join(" ").trim();
      if (!text) return ["!quote add [metin]"];
      saveBotConfig((prev) => ({
        ...prev,
        quotes: [...(prev.quotes || []), { id: uid("q"), text, by: msg.user, addedBy: msg.user, ts: Date.now() } as Quote],
      }));
      return ["Alıntı eklendi."];
    }
    const list = cfg.quotes || [];
    if (!list.length) return ["Alıntı yok."];
    const q = list[Math.floor(Math.random() * list.length)];
    return [`💬 ${q.text} — ${q.addedBy || "?"}`];
  }

  if (cmd === "raffle") {
    if (!m.raffle) return null;
    const sub = (args[0] || "").toLowerCase();
    if (sub === "open" || sub === "start" || sub === "aç") {
      if (!isMod) return ["Mod gerekir."];
      raffle = { active: true, entrants: new Set(), prize: args.slice(1).join(" ") || "ödül", startedBy: msg.user };
      return [`Raffle: ${raffle.prize} — !join`];
    }
    if (sub === "draw" || sub === "çek" || sub === "end") {
      if (!isMod) return ["Mod gerekir."];
      if (!raffle.active) return ["Açık raffle yok."];
      const list = [...raffle.entrants];
      raffle.active = false;
      if (!list.length) return ["Kimse katılmadı."];
      const winner = list[Math.floor(Math.random() * list.length)].split(":")[1] || list[0];
      const prize = raffle.prize;
      raffle.entrants.clear();
      return [`🎉 Raffle kazananı: ${winner} — ${prize}`];
    }
    return ["Kullanım: !raffle open [ödül] | !raffle draw"];
  }

  if (cmd === "join" || cmd === "katil") {
    if (raffle.active) {
      raffle.entrants.add(keyOf(msg));
      return [`${msg.user} raffle’a katıldı (${raffle.entrants.size})`];
    }
    const g = (cfg as any).giveaway as GiveawayConfig | undefined;
    if (g?.active) {
      if (g.subsOnly && !isSub(msg)) return ["Sadece aboneler katılabilir."];
      const key = keyOf(msg);
      if (g.entrants.includes(key)) return null;
      const entrants = [...g.entrants, key];
      syncGiveaway({ entrants });
      return [`${msg.user} çekilişe katıldı (${entrants.length})`];
    }
    const qcfg = (cfg as any).queue;
    if (qcfg?.enabled !== false && (m.queue || qcfg?.enabled)) {
      if (qcfg && qcfg.open === false) return ["Sıra kapalı."];
      const k = keyOf(msg);
      const users: string[] = Array.isArray(qcfg?.users) ? [...qcfg.users] : [...viewerQueue.users];
      if (users.includes(k)) return [`${msg.user} zaten sırada #${users.indexOf(k) + 1}`];
      if (qcfg?.maxUsers && users.length >= qcfg.maxUsers) return ["Sıra dolu."];
      const cost = Number(qcfg?.cost || 0);
      if (cost > 0) {
        const bal = cfg.loyalty[k]?.points ?? 0;
        if (bal < cost) return [`Sıra için ${cost} ${cfg.pointsName} lazım.`];
      }
      users.push(k);
      viewerQueue.users = users;
      saveBotConfig((prev) => {
        const loyalty = { ...prev.loyalty };
        if (cost > 0) {
          const u = loyalty[k] || { points: 0, messages: 0, watchMin: 0, lastSeen: Date.now() };
          loyalty[k] = { ...u, points: Math.max(0, u.points - cost) };
        }
        return {
          ...prev,
          loyalty,
          queue: { ...((prev as any).queue || {}), users, enabled: true },
        } as any;
      });
      if (cost > 0) mirrorLoyalty(k, -cost, "queue");
      return [`${msg.user} sırada #${users.indexOf(k) + 1}`];
    }
    return null;
  }

  if (cmd === "giveaway" || cmd === "hediye" || cmd === "sorteo") {
    if (!m.giveaway) return null;
    const sub = (args[0] || "").toLowerCase();
    const g = ((cfg as any).giveaway || {}) as GiveawayConfig;
    if (sub === "open" || sub === "start" || sub === "aç") {
      if (!isMod) return ["Çekiliş için mod gerekir."];
      const prize = args.slice(1).join(" ") || "hediye";
      syncGiveaway({
        active: true,
        prize,
        entrants: [],
        spinning: false,
        winner: "",
        claimUntil: null,
        keyword: g.keyword || "+1",
      });
      return [`Çekiliş: ${prize} — yaz: ${g.keyword || "+1"} veya !join`];
    }
    if (sub === "keyword" || sub === "kelime") {
      if (!isMod) return ["Mod gerekir."];
      const keyword = args.slice(1).join(" ").trim() || "+1";
      syncGiveaway({ keyword });
      return [`Katılım kelimesi: ${keyword}`];
    }
    if (sub === "clear" || sub === "temizle") {
      if (!isMod) return ["Mod gerekir."];
      syncGiveaway({ entrants: [], winner: "", spinning: false, claimUntil: null });
      return ["Katılımcılar temizlendi."];
    }
    if (sub === "draw" || sub === "çek" || sub === "end" || sub === "winner") {
      if (!isMod) return ["Mod gerekir."];
      if (!g.active) return ["Açık çekiliş yok."];
      if (!g.entrants.length) return ["Katılım yok."];
      const spinMs = Math.max(5, Number(g.spinDurationSec || 5)) * 1000;
      const claimMs = Math.max(15, Number(g.claimDurationSec || 60)) * 1000;
      const winnerKey = weightedPick(g.entrants, Number(g.subMultiplier || 1));
      const winner = winnerKey.split(":")[1] || winnerKey;
      syncGiveaway({ spinning: true, winner });
      window.setTimeout(() => {
        syncGiveaway({
          spinning: false,
          active: false,
          winner,
          claimUntil: Date.now() + claimMs,
          entrants: [],
        });
      }, spinMs);
      return [`🎁 Çark dönüyor… Kazanan: ${winner} — ${g.prize}`];
    }
    return ["!giveaway open [ödül] | !giveaway keyword [+1] | !giveaway draw | !giveaway clear"];
  }

  if (cmd === "queue" || cmd === "sira") {
    const qcfg = (cfg as any).queue;
    if (!(m.queue || qcfg?.enabled)) return null;
    const users: string[] = Array.isArray(qcfg?.users) ? [...qcfg.users] : [...viewerQueue.users];
    viewerQueue.users = users;
    const sub = (args[0] || "").toLowerCase();
    if (sub === "list" || sub === "liste") {
      if (!users.length) return ["Sıra boş."];
      return [
        `Sıra: ${users
          .slice(0, 10)
          .map((u, i) => `${i + 1}.${u.split(":")[1]}`)
          .join(", ")}`,
      ];
    }
    if (sub === "next" || sub === "sonraki") {
      if (!isMod) return ["Mod gerekir."];
      const next = users.shift();
      viewerQueue.users = users;
      saveBotConfig((prev) => ({
        ...prev,
        queue: { ...((prev as any).queue || {}), users },
      }) as any);
      if (!next) return ["Sıra boş."];
      return [`Sıradaki: ${next.split(":")[1]}`];
    }
    if (sub === "clear" || sub === "temizle") {
      if (!isMod) return ["Mod gerekir."];
      viewerQueue.users = [];
      saveBotConfig((prev) => ({
        ...prev,
        queue: { ...((prev as any).queue || {}), users: [] },
      }) as any);
      return ["Sıra temizlendi."];
    }
    if (qcfg && qcfg.open === false) return ["Sıra kapalı."];
    const k = keyOf(msg);
    if (!users.includes(k)) {
      if (qcfg?.maxUsers && users.length >= qcfg.maxUsers) return ["Sıra dolu."];
      users.push(k);
      viewerQueue.users = users;
      saveBotConfig((prev) => ({
        ...prev,
        queue: { ...((prev as any).queue || {}), users, enabled: true },
      }) as any);
    }
    return [`${msg.user} sırada #${users.indexOf(k) + 1}`];
  }

  if (cmd === "roulette" || cmd === "rulet") {
    const mg = (cfg as any).minigames?.roulette;
    if (mg && !mg.enabled) return null;
    if (!m.roulette && !mg?.enabled) return null;
    if (mg?.minRole && !hasLevel(level, mg.minRole)) return ["Rol yetersiz."];
    if (!gameCooled(`roulette:${keyOf(msg)}`, Number(mg?.cooldownSeconds || 0))) {
      return ["Rulet cooldown."];
    }
    const maxBet = Number(mg?.maxBet || 10000);
    const amt = Math.max(1, Math.min(maxBet, Number(args[0]) || 10));
    const winChance = mg?.difficulty === "easy" ? 0.55 : 0.48;
    const win = Math.random() < winChance;
    const key = keyOf(msg);
    saveBotConfig((prev) => {
      const u = prev.loyalty[key] || { points: 0, watchMin: 0, messages: 0, lastSeen: Date.now() };
      const points = Math.max(0, (u.points || 0) + (win ? amt : -amt));
      return { ...prev, loyalty: { ...prev.loyalty, [key]: { ...u, points, lastSeen: Date.now() } } };
    });
    mirrorLoyalty(key, win ? amt : -amt, "roulette");
    return [win ? `${msg.user} +${amt} kazandı!` : `${msg.user} -${amt} kaybetti.`];
  }

  if (cmd === "slots") {
    const mg = (cfg as any).minigames?.slots;
    if (mg && !mg.enabled) return null;
    if (!m.slots && !mg?.enabled) return null;
    if (mg?.minRole && !hasLevel(level, mg.minRole)) return ["Rol yetersiz."];
    if (!gameCooled(`slots:${keyOf(msg)}`, Number(mg?.cooldownSeconds || 0))) {
      return ["Slots cooldown."];
    }
    const icons = ["🍒", "🍋", "🔔", "⭐", "7️⃣"];
    const a = icons[Math.floor(Math.random() * icons.length)];
    const b = icons[Math.floor(Math.random() * icons.length)];
    const c = icons[Math.floor(Math.random() * icons.length)];
    const win = a === b && b === c;
    return [`${a}${b}${c} ${win ? "JACKPOT!" : "Tekrar dene."}`];
  }

  if (cmd === "gamble" || cmd === "bahis") {
    const mg = (cfg as any).minigames?.gamble;
    if (mg && !mg.enabled) return null;
    if (!m.gamble && !mg?.enabled) return null;
    if (mg?.minRole && !hasLevel(level, mg.minRole)) return ["Rol yetersiz."];
    if (!gameCooled(`gamble:${keyOf(msg)}`, Number(mg?.cooldownSeconds || 0))) {
      return ["Gamble cooldown."];
    }
    const maxBet = Number(mg?.maxBet || 10000);
    const amt = Math.max(1, Math.min(maxBet, Number(args[0]) || 10));
    const winChance = mg?.difficulty === "easy" ? 0.5 : 0.45;
    const win = Math.random() < winChance;
    const key = keyOf(msg);
    saveBotConfig((prev) => {
      const u = prev.loyalty[key] || { points: 0, watchMin: 0, messages: 0, lastSeen: Date.now() };
      const points = Math.max(0, (u.points || 0) + (win ? amt * 2 : -amt));
      return { ...prev, loyalty: { ...prev.loyalty, [key]: { ...u, points, lastSeen: Date.now() } } };
    });
    mirrorLoyalty(key, win ? amt * 2 : -amt, "gamble");
    return [win ? `${msg.user} gamble +${amt * 2}` : `${msg.user} gamble -${amt}`];
  }

  if (cmd === "bduel" || cmd === "duel") {
    const mg = (cfg as any).minigames?.bduel;
    if (!mg?.enabled) return ["B-Duel kapalı (yerel stub)."];
    return ["B-Duel bulut oyunu — yerel kayıt açık; tam savaş motoru yok."];
  }

  return null;
}
