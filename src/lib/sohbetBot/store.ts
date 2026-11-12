/** Debounced localStorage + settings sync — UI thread’i bloke etmez. */

import { API_BASE, patchSettings } from "../api";
import { panelBotu } from "../eskiAdlar";
import { defaultBotConfig, type BotConfig } from "./types";
import { DEFAULT_BOT_NAME } from "./botIdentity";
import { ensureV2, type BotConfigV2 } from "./v2";

const LS_KEY = "panel.sohbetBot";
const SAVE_DEBOUNCE_MS = 400;

let cache: BotConfigV2 | null = null;
let saveTimer: number | null = null;
const listeners = new Set<(c: BotConfigV2) => void>();

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function mergeConfig(raw: unknown): BotConfigV2 {
  const base = defaultBotConfig();
  if (!raw || typeof raw !== "object") return ensureV2(base);
  const o = raw as Partial<BotConfig>;
  const prevName = String(o.botName || "").replace(/^@/, "").trim();
  const botName =
    !prevName || /^(bot|sesbot)$/i.test(prevName) ? DEFAULT_BOT_NAME : prevName;
  const delayRaw = Number(o.replyDelayMs);
  const replyDelayMs =
    !Number.isFinite(delayRaw) || delayRaw >= 480 ? 250 : Math.max(100, delayRaw);
  return ensureV2({
    ...base,
    ...o,
    botName,
    replyDelayMs,
    commands: Array.isArray(o.commands) ? o.commands : base.commands,
    timers: Array.isArray(o.timers) ? o.timers : base.timers,
    counters: Array.isArray(o.counters) ? o.counters : base.counters,
    loyalty: o.loyalty && typeof o.loyalty === "object" ? o.loyalty : base.loyalty,
    quotes: Array.isArray(o.quotes) ? o.quotes : base.quotes,
    filters: { ...base.filters, ...(o.filters || {}) },
    modules: { ...base.modules, ...(o.modules || {}) },
  });
}

export function loadBotConfig(): BotConfigV2 {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(LS_KEY);
    cache = mergeConfig(raw ? JSON.parse(raw) : null);
  } catch {
    cache = ensureV2(defaultBotConfig());
  }
  return cache;
}

export function getBotConfig(): BotConfigV2 {
  return loadBotConfig();
}

export function subscribeBotConfig(fn: (c: BotConfigV2) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(c: BotConfigV2) {
  for (const fn of listeners) {
    try {
      fn(c);
    } catch {
      /* */
    }
  }
}

/** Sohbet puanı: tüm ayarı kopyalamadan kullanıcıyı yerinde günceller, yazmayı 2 sn biriktirir. */
export function noteLoyalty(key: string, addPoints: number, addMessages: number, initial = 0) {
  const cfg = loadBotConfig();
  let u = cfg.loyalty[key];
  if (!u) {
    u = { points: initial, messages: 0, watchMin: 0, lastSeen: Date.now() };
    cfg.loyalty[key] = u;
  }
  u.points += addPoints;
  u.messages += addMessages;
  u.lastSeen = Date.now();
  if (saveTimer != null) return;
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    const c = loadBotConfig();
    emit(c);
    flushPersist(c);
  }, 2000);
}

function flushPersist(c: BotConfigV2) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(c));
  } catch {
    /* quota */
  }
  void patchSettings("panel", { sohbetBot: c }).catch(() => {});
}

export function saveBotConfig(
  next: BotConfigV2 | BotConfig | ((prev: BotConfigV2) => BotConfigV2 | BotConfig)
): BotConfigV2 {
  const prev = loadBotConfig();
  const raw = typeof next === "function" ? next(clone(prev)) : next;
  const c = ensureV2(raw as BotConfig);
  cache = c;
  emit(c);
  if (saveTimer != null) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    flushPersist(c);
  }, SAVE_DEBOUNCE_MS);
  return c;
}

export function updateBotConfig(patch: Partial<BotConfigV2>): BotConfigV2 {
  return saveBotConfig((prev) => ({ ...prev, ...patch }));
}

export async function hydrateBotConfigFromServer(): Promise<BotConfigV2> {
  try {
    const res = await fetch(`${API_BASE}/api/settings?screen=panel`);
    if (!res.ok) return loadBotConfig();
    const data = await res.json();
    const bot = panelBotu(data);
    if (bot && typeof bot === "object") {
      return applyRemoteBotConfig(bot as never);
    }
  } catch {
    /* */
  }
  return loadBotConfig();
}

/**
 * OBS / başka sekme — sunucudan gelen sohbetBot’u uygula.
 * Tekrar PATCH etmez (echo loop yok).
 */
export function applyRemoteBotConfig(raw: unknown): BotConfigV2 {
  const merged = mergeConfig(
    raw && typeof raw === "object" ? { ...loadBotConfig(), ...(raw as object) } : loadBotConfig()
  );
  cache = merged;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(merged));
  } catch {
    /* */
  }
  emit(merged);
  return merged;
}
