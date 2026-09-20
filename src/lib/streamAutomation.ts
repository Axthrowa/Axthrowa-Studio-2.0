/** Yayın otomasyonu — Giriş bitişi → oyun sahnesi, Çıkış bitişi → Stop Stream */

import type { OverlaySettings } from "./api";
import { connectObs, stopStreamWithRetry, switchScene } from "./obs";
import { logger } from "./logger";
import { ruleStopStream, ruleThenScene } from "./endRules";

export type ObsSlice = NonNullable<OverlaySettings["obs"]>;

export function resolveGameScene(obs: ObsSlice | Record<string, unknown> | undefined): string {
  const o = (obs || {}) as ObsSlice & {
    sceneMap?: { game?: string; starting?: string };
    sceneOnEnd?: string;
    returnScene?: string;
  };
  // Kuralda seçilen sahne varsa o öncelikli; yoksa eski çözüm.
  return ruleThenScene(
    o as never,
    "starting",
    String(o.sceneMap?.game || "").trim() ||
      String(o.sceneOnEnd || "").trim() ||
      String(o.returnScene || "").trim()
  );
}

export function resolveStartingScene(obs: ObsSlice | Record<string, unknown> | undefined): string {
  const o = (obs || {}) as ObsSlice & {
    sceneMap?: { starting?: string };
    startingScene?: string;
  };
  return (
    String(o.sceneMap?.starting || "").trim() ||
    String(o.startingScene || "").trim()
  );
}

export function resolveEndingFollowScene(obs: ObsSlice | Record<string, unknown> | undefined): string {
  const o = (obs || {}) as ObsSlice & {
    endingEndScene?: string;
    sceneOnEnd?: string;
  };
  return ruleThenScene(
    o as never,
    "ending",
    String(o.endingEndScene || "").trim() || String(o.sceneOnEnd || "").trim()
  );
}

export function obsConnectionFrom(obs: ObsSlice | Record<string, unknown> | undefined) {
  const o = (obs || {}) as ObsSlice;
  return {
    host: String(o.host || "127.0.0.1"),
    port: Number(o.port) || 4455,
    password: String(o.password || ""),
  };
}

/**
 * Rust tarafında bekleyen sekansı iptal eder.
 *
 * Overlay bitişi kendisi işlerken (sahne geçişi / yayın kapatma) Rust'ın kendi
 * zamanlayıcısı da aynı işi yapmaya hazır bekleyebiliyor; ikisi birbirinden
 * habersizdi. Native komut yoksa (tarayıcı, eski paket) sessizce geçilir.
 */
export async function cancelRustSequence(): Promise<void> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("obs_cancel_sequence");
  } catch {
    /* Tauri dışı ortam ya da komut henüz yok */
  }
}

/** Giriş sayacı / medya bitince oyun sahnesine geç */
export async function runStartingEndAction(live: OverlaySettings): Promise<string | null> {
  const obs = live.obs || {};
  await cancelRustSequence();
  const scene = resolveGameScene(obs);
  if (!scene) return null;
  const cfg = obsConnectionFrom(obs);
  await connectObs(cfg);
  await switchScene({
    sceneName: scene,
    transition: obs.transition,
    transitionMs: obs.transitionMs ?? 300,
  });
  return scene;
}

/** Çıkış bitince Stop Stream (+ isteğe bağlı sahne) */
export async function runEndingEndAction(live: OverlaySettings): Promise<{
  stopped: boolean;
  scene: string | null;
}> {
  const obs = live.obs || {};
  await cancelRustSequence();
  const cfg = obsConnectionFrom(obs);
  let stopped = false;
  if (ruleStopStream(obs as never)) {
    try {
      await stopStreamWithRetry(cfg);
      stopped = true;
    } catch (e) {
      logger.error("[stream] StopStream başarısız", e);
    }
  } else {
    try {
      await connectObs(cfg);
    } catch {
      /* */
    }
  }
  const scene = resolveEndingFollowScene(obs);
  if (scene) {
    try {
      await connectObs(cfg);
      await switchScene({
        sceneName: scene,
        transition: obs.transition,
        transitionMs: obs.transitionMs ?? 300,
      });
    } catch (e) {
      logger.error("[stream] çıkış sonrası sahne", e);
    }
  }
  return { stopped, scene: scene || null };
}

export const STARTING_END_STORAGE_KEY = "yya.starting_end_at";

export function seedStartingCountdown(minutes = 5): number {
  const end = Date.now() + Math.max(1, minutes) * 60_000;
  try {
    localStorage.setItem(STARTING_END_STORAGE_KEY, String(end));
    sessionStorage.setItem("starting_end_5", String(end));
  } catch {
    /* */
  }
  return end;
}

export function readStartingCountdownEnd(): number {
  try {
    const persisted = Number(localStorage.getItem(STARTING_END_STORAGE_KEY) || 0);
    if (persisted > Date.now()) return persisted;
    const session = Number(sessionStorage.getItem("starting_end_5") || 0);
    if (session > Date.now()) return session;
  } catch {
    /* */
  }
  return 0;
}

export function clearStartingCountdown(): void {
  try {
    localStorage.removeItem(STARTING_END_STORAGE_KEY);
    sessionStorage.removeItem("starting_end_5");
  } catch {
    /* */
  }
}
