/**
 * Cross-widget event bus + Premium SFX motoru.
 * OBS kaynakları aynı /ws/overlay-sync üzerinden `widget-bus` mesajı paylaşır.
 */

import type { CSSProperties } from "react";
import { API_BASE } from "../api";
import { sfxCandidateUrls } from "../soundboard";
import { overlaySyncWsUrl } from "./useWidgetSync";
import { logger } from "../logger";

export type WidgetBusAction =
  | "goal.complete"
  | "goal.progress"
  | "hypetrain.level"
  | "emotewall.burst"
  | "credits.play"
  | "poll.ended"
  | "poll.started"
  | "raffle.winner"
  | "cup.spawn"
  | "wheel.stopped"
  | "chat.hype"
  | "minigame.pop"
  | string;

export type WidgetBusEvent = {
  type: "widget-bus";
  from: string;
  action: WidgetBusAction;
  payload?: Record<string, unknown>;
  t?: number;
};

/** Panel veya overlay → Rust → tüm OBS kaynakları */
export async function emitWidgetBus(
  from: string,
  action: WidgetBusAction,
  payload: Record<string, unknown> = {}
): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/bot/runtime/bus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, action, payload }),
    });
  } catch {
    /* offline / preview */
  }
}

const PRESET_FREQ: Record<string, number[]> = {
  chime: [880, 1320, 1760],
  coin: [980, 1310],
  boom: [90, 60],
  levelup: [523, 659, 784, 1046],
  sparkle: [1200, 1600, 2000],
  success: [440, 554, 659],
  swoosh: [320, 480, 640],
};

let sharedCtx: AudioContext | null = null;
let audioUnlocked = false;

function getAudioContext(): AudioContext | null {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return null;
    if (!sharedCtx || sharedCtx.state === "closed") {
      sharedCtx = new Ctx();
    }
    return sharedCtx;
  } catch (err) {
    logger.error("[SFX] AudioContext oluşturulamadı:", err);
    return null;
  }
}

/** Tarayıcı autoplay kilidini kullanıcı etkileşimiyle aç. */
export async function unlockWidgetAudio(): Promise<boolean> {
  const ctx = getAudioContext();
  if (!ctx) return false;
  try {
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    audioUnlocked = ctx.state === "running";
    return audioUnlocked;
  } catch (err) {
    logger.error("[SFX] AudioContext resume hatası:", err);
    return false;
  }
}

export function volFromConfig(config: Record<string, unknown>, fallback = 0.65): number {
  const raw = Number(config.volume ?? config.sfxVolume ?? fallback * 100);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(0, Math.min(1, raw > 1 ? raw / 100 : raw));
}

function resolveAudioUrl(src: string): string[] {
  const s = src.trim();
  if (!s || s.startsWith("preset:") || s.startsWith("data:")) return [];
  if (/^https?:\/\//i.test(s)) return [s];
  if (s.startsWith("/assets/") || s.startsWith("assets/")) {
    const path = s.replace(/^\/?assets\//, "");
    return [`${API_BASE}/assets/${path}`, `${API_BASE}/${s.replace(/^\//, "")}`];
  }
  if (s.startsWith("/")) {
    return [`${API_BASE}${s}`];
  }
  return sfxCandidateUrls(s);
}

function playPreset(name: string, vol: number): boolean {
  const ctx = getAudioContext();
  if (!ctx) return false;
  const freqs = PRESET_FREQ[name] || PRESET_FREQ.chime;
  try {
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    const now = ctx.currentTime;
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = name === "boom" ? "sawtooth" : "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(vol * 0.38, now + 0.02 + i * 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.32 + i * 0.08);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(now + i * 0.06);
      o.stop(now + 0.45 + i * 0.08);
    });
    return true;
  } catch (err) {
    logger.error("[SFX] preset çalınamadı:", name, err);
    return false;
  }
}

async function playFileUrl(url: string, vol: number): Promise<boolean> {
  try {
    const a = new Audio();
    a.crossOrigin = "anonymous";
    a.preload = "auto";
    a.volume = vol;
    a.src = url;
    await a.play();
    return true;
  } catch (err) {
    logger.error("[SFX] dosya çalınamadı:", url, err);
    return false;
  }
}

/** Web Audio preset veya uzak / lokal mp3-wav URL */
export function playWidgetSfx(
  sfx: string | undefined | null,
  volume = 0.65
): void {
  void playWidgetSfxAsync(sfx, volume);
}

export async function playWidgetSfxAsync(
  sfx: string | undefined | null,
  volume = 0.65
): Promise<boolean> {
  if (!sfx || sfx === "none" || sfx === "off") return false;

  const vol = Math.max(0, Math.min(1, volume));
  await unlockWidgetAudio();

  if (sfx.startsWith("preset:")) {
    const name = sfx.slice(7);
    const ok = playPreset(name, vol);
    if (!ok) {
      logger.error("[SFX] preset başarısız:", sfx);
    }
    return ok;
  }

  const urls = resolveAudioUrl(sfx);
  if (urls.length === 0) {
    logger.error("[SFX] geçersiz kaynak:", sfx);
    return false;
  }

  for (const url of urls) {
    const ok = await playFileUrl(url, vol);
    if (ok) return true;
  }
      logger.error("[SFX] tüm URL adayları başarısız:", urls.join(", "));
  return false;
}

export function resolveSfx(
  config: Record<string, unknown>,
  key: string,
  fallbackPreset = "preset:chime"
): string {
  const enabled = config.sfxEnabled !== false && config.soundEnabled !== false;
  if (!enabled) return "none";
  const custom = String(config[key] || config.sfxUrl || "").trim();
  if (custom) {
    if (custom.startsWith("preset:") || custom.startsWith("http") || custom.includes(".")) {
      return custom;
    }
    return `preset:${custom}`;
  }
  const preset = String(config.sfxPreset || fallbackPreset);
  return preset.startsWith("preset:") ? preset : `preset:${preset}`;
}

export function transformStyle(
  config: Record<string, unknown>
): CSSProperties {
  const x = Number(config.posX ?? config.position_x ?? 0);
  const y = Number(config.posY ?? config.position_y ?? 0);
  const scale = Number(config.scale ?? 1);
  const rot = Number(config.rotateDeg ?? 0);
  return {
    transform: `translate(${Number.isFinite(x) ? x : 0}px, ${Number.isFinite(y) ? y : 0}px) scale(${Number.isFinite(scale) ? scale : 1}) rotate(${Number.isFinite(rot) ? rot : 0}deg)`,
    transformOrigin: "center center",
  };
}

/** Inline custom CSS — widget köküne scoped değil; kullanıcı bilinçli yazar */
export function injectCustomCss(id: string, css: string | undefined | null): () => void {
  const styleId = `studio-custom-css-${id}`;
  const existing = document.getElementById(styleId);
  if (!css || !String(css).trim()) {
    existing?.remove();
    return () => undefined;
  }
  let el = existing as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = styleId;
    document.head.appendChild(el);
  }
  el.textContent = String(css);
  return () => {
    document.getElementById(styleId)?.remove();
  };
}

/** Tekil WS dinleyici (overlay başına bir bağlantı paylaşılabilir) */
type BusListener = (ev: WidgetBusEvent) => void;
const globalListeners = new Set<BusListener>();
let sharedWs: WebSocket | null = null;
let sharedRetry: number | undefined;

function ensureSharedBus() {
  if (
    sharedWs &&
    (sharedWs.readyState === WebSocket.OPEN ||
      sharedWs.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }
  const url = overlaySyncWsUrl();
  try {
    sharedWs = new WebSocket(url);
  } catch {
    sharedRetry = window.setTimeout(ensureSharedBus, 2200);
    return;
  }
  sharedWs.onmessage = (e) => {
    try {
      const msg = JSON.parse(String(e.data)) as WidgetBusEvent;
      if (msg?.type !== "widget-bus") return;
      globalListeners.forEach((fn) => {
        try {
          fn(msg);
        } catch {
          /* */
        }
      });
    } catch {
      /* */
    }
  };
  sharedWs.onclose = () => {
    sharedWs = null;
    if (globalListeners.size > 0) {
      sharedRetry = window.setTimeout(ensureSharedBus, 2200);
    }
  };
}

export function subscribeWidgetBus(fn: BusListener): () => void {
  globalListeners.add(fn);
  ensureSharedBus();
  return () => {
    globalListeners.delete(fn);
    if (globalListeners.size === 0 && sharedRetry) {
      window.clearTimeout(sharedRetry);
    }
  };
}
