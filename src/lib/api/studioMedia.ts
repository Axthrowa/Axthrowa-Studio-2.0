/**
 * Botaxt Alerts / Widgets — Tauri invoke + HTTP fallback.
 * Medya: DB'de mutlak path; OBS için streamUrl (`/media/file` Range).
 */

import { API_BASE } from "../api";

export type PlayableMedia = {
  path: string;
  streamUrl: string;
  assetUrl: string;
};

/** Rust serde snake_case fallback — invoke bazen stream_url dönebilir */
function normalizePlayable(raw: Record<string, unknown>): PlayableMedia {
  return {
    path: String(raw.path || ""),
    streamUrl: String(raw.streamUrl || raw.stream_url || ""),
    assetUrl: String(raw.assetUrl || raw.asset_url || ""),
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
      return { path, streamUrl, assetUrl: streamUrl };
    }
  );
  return normalizePlayable(raw);
}

export async function mediaImportFile(sourcePath: string, kind = "alerts") {
  const raw = await invokeOrHttp<Record<string, unknown>>(
    "media_import_file",
    { sourcePath, kind },
    async () => {
      throw new Error("media_import_file yalnızca Tauri'de");
    }
  );
  return normalizePlayable(raw);
}

export function alertsList() {
  return invokeOrHttp<{ alerts: unknown[] }>("alerts_list", {}, () =>
    jsonFetch("/api/botaxt/alerts")
  );
}

export function alertsUpsert(alert: Record<string, unknown>) {
  return invokeOrHttp("alerts_upsert", { alert }, async () => {
    const cur = await jsonFetch<{ alerts: unknown[] }>("/api/botaxt/alerts");
    const list = Array.isArray(cur.alerts) ? [...cur.alerts] : [];
    const id = String(alert.id || "");
    const idx = list.findIndex((a) => (a as { id?: string }).id === id);
    if (idx >= 0) list[idx] = { ...(list[idx] as object), ...alert };
    else list.push(alert);
    return jsonFetch("/api/botaxt/alerts", {
      method: "PUT",
      body: JSON.stringify({ alerts: list }),
    });
  });
}

export function alertsDelete(id: string) {
  return invokeOrHttp<{ deleted: boolean }>("alerts_delete", { id }, async () => {
    throw new Error("alerts_delete HTTP henüz yok — Tauri invoke kullan");
  });
}

export function alertVariantsList(typeId?: string) {
  return invokeOrHttp<{ variants: unknown[] }>(
    "alert_variants_list",
    { typeId: typeId ?? null },
    () => jsonFetch("/api/botaxt/alerts/variants")
  );
}

export function alertVariantsUpsert(variant: Record<string, unknown>) {
  return invokeOrHttp("alert_variants_upsert", { variant }, () =>
    jsonFetch("/api/botaxt/alerts/variants", {
      method: "PUT",
      body: JSON.stringify({ variants: [variant] }),
    })
  );
}

export function alertVariantsDelete(id: string) {
  return invokeOrHttp<{ deleted: boolean }>("alert_variants_delete", { id }, async () => {
    throw new Error("alert_variants_delete HTTP henüz yok");
  });
}

export function widgetsList() {
  return invokeOrHttp<{ widgets: unknown[] }>("widgets_list", {}, () =>
    jsonFetch("/api/botaxt/widgets")
  );
}

export function widgetsUpsert(widget: Record<string, unknown>) {
  return invokeOrHttp("widgets_upsert", { widget }, () =>
    jsonFetch("/api/botaxt/widgets", {
      method: "POST",
      body: JSON.stringify(widget),
    })
  );
}

export function widgetsPatchConfig(id: string, config: Record<string, unknown>) {
  return invokeOrHttp("widgets_patch_config", { id, config }, () =>
    jsonFetch(`/api/botaxt/widgets/${encodeURIComponent(id)}/config`, {
      method: "PUT",
      body: JSON.stringify({ config }),
    })
  );
}

export function widgetsDelete(id: string) {
  return invokeOrHttp<{ deleted: boolean }>("widgets_delete", { id }, () =>
    jsonFetch(`/api/botaxt/widgets/${encodeURIComponent(id)}`, { method: "DELETE" })
  );
}

export function widgetsObsUrl(id: string) {
  return invokeOrHttp<{ id: string; obs_url: string; obs_path: string }>(
    "widgets_obs_url",
    { id },
    async () => {
      const j = await jsonFetch<{ widgets: Array<{ id: string; obs_url?: string; obs_path?: string }> }>(
        "/api/botaxt/widgets"
      );
      const w = (j.widgets || []).find((x) => x.id === id);
      if (!w) throw new Error("widget yok");
      return {
        id,
        obs_url: w.obs_url || `${API_BASE}${w.obs_path || "/"}`,
        obs_path: w.obs_path || "/",
      };
    }
  );
}
