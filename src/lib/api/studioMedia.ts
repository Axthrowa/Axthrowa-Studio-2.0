/**
 * Bot Alerts / Widgets — Tauri invoke + HTTP fallback.
 * Medya: DB'de mutlak path; OBS için streamUrl (`/media/file` Range).
 */

import { API_BASE } from "../api";

export type PlayableMedia = {
  path: string;
  streamUrl: string;
};

/** Rust serde snake_case fallback — invoke bazen stream_url dönebilir */
function normalizePlayable(raw: Record<string, unknown>): PlayableMedia {
  return {
    path: String(raw.path || ""),
    streamUrl: String(raw.streamUrl || raw.stream_url || ""),
  };
}

async function invokeOrHttp<T>(
  cmd: string,
  args: Record<string, unknown>,
  http: () => Promise<T>
): Promise<T> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<T>(cmd, args);
  } catch {
    return http();
  }
}

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<T>;
}

export async function mediaPlayableUrls(path: string) {
  const raw = await invokeOrHttp<Record<string, unknown>>(
    "media_playable_urls",
    { path },
    async () => {
      const streamUrl = `${API_BASE}/media/file?path=${encodeURIComponent(path)}`;
      return { path, streamUrl };
    }
  );
  return normalizePlayable(raw);
}

export function alertsList() {
  return invokeOrHttp<{ alerts: unknown[] }>("alerts_list", {}, () =>
    jsonFetch("/api/bot/alerts")
  );
}

export function alertVariantsList(typeId?: string) {
  return invokeOrHttp<{ variants: unknown[] }>(
    "alert_variants_list",
    { typeId: typeId ?? null },
    () => jsonFetch("/api/bot/alerts/variants")
  );
}

