/**
 * Bot modülü 1 — Profil / Dashboard API istemcisi
 */

import { apiBaseCandidates } from "../api";

export type StreamSession = {
  id: string;
  channel_id: string;
  started_at: number;
  ended_at: number | null;
  title: string | null;
  category: string | null;
  peak_viewers: number;
  avg_viewers: number;
  new_followers: number;
  new_subs: number;
  tips_total: number;
  chat_messages: number;
  duration_sec: number | null;
  notes: string | null;
  vod_url: string | null;
};

export type EventLog = {
  id: string;
  session_id: string | null;
  channel_id: string;
  kind: string;
  platform: string;
  user_name: string;
  user_id: string | null;
  amount: number | null;
  message: string | null;
  meta_json: string;
  ts: number;
};

export type DashboardSnapshot = {
  channel_id: string;
  channel_name: string;
  active_session: StreamSession | null;
  viewers: number;
  chat_rpm: number;
  session_followers: number;
  session_subs: number;
  session_chat: number;
  active_chatters: number;
  session_viewers: number;
  loyalty_users: number;
  commands: number;
  recent_events: EventLog[];
  sessions: StreamSession[];
  eski_panel_aktarildi: boolean;
};

const PREFIX = "/api/bot";
let cachedApiBase: string | null = null;

function looksLikeJson(res: Response, text: string) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return true;
  const t = text.trimStart();
  return t.startsWith("{") || t.startsWith("[");
}

function requestHeaders(init?: RequestInit): Headers {
  const headers = new Headers(init?.headers || {});
  const method = String(init?.method || "GET").toUpperCase();
  const hasBody = init?.body != null && init.body !== "";
  if (method === "GET" || method === "HEAD") {
    headers.delete("Content-Type");
  } else if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return headers;
}

async function fetchWithBase(urlPath: string, init?: RequestInit): Promise<Response> {
  const bases = cachedApiBase != null ? [cachedApiBase, ...apiBaseCandidates()] : apiBaseCandidates();
  const seen = new Set<string>();
  let lastErr: unknown;
  for (const base of bases) {
    if (seen.has(base)) continue;
    seen.add(base);
    try {
      const res = await fetch(`${base}${urlPath}`, {
        cache: "no-store",
        ...init,
        headers: requestHeaders(init),
      });
      cachedApiBase = base;
      return res;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Failed to fetch");
}

let baseProbe: Promise<void> | null = null;

async function resolveApiBase(): Promise<void> {
  if (cachedApiBase != null) return;
  if (baseProbe) return baseProbe;
  baseProbe = (async () => {
    // Bazı kökler (özellikle Vite) bilinmeyen /api yoluna 404 yerine
    // index.html döndürür. Bu nedenle yalnız ağ hatasında değil, JSON olmayan
    // yanıtta da sonraki base adayını dene.
    for (const base of apiBaseCandidates()) {
      try {
        const res = await fetch(`${base}${PREFIX}/dashboard`, {
          cache: "no-store",
        });
        const text = await res.text();
        if (res.ok && looksLikeJson(res, text)) {
          cachedApiBase = base;
          return;
        }
      } catch {
        /* next */
      }
    }
    // json() gerçek istekte ayrıntılı ağ hatasını üretsin; başarısız probe'u
    // kalıcı cache'leme ki sunucu sonradan açıldığında kendini toparlasın.
  })();
  try {
    await baseProbe;
  } finally {
    baseProbe = null;
  }
}

/** Mutlak API yolu (ör. /api/bot/dashboard). */
export async function botUrl(path: string): Promise<string> {
  await resolveApiBase();
  const rest = path.startsWith("/") ? path : `/${path}`;
  return `${PREFIX}${rest}`;
}

function networkDownMessage(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return "Yerel bot API yanıt vermedi. Uygulamayı cikti\\portable\\Baslat.bat ile tek kopya açın.";
  }
  return msg || "İstek başarısız";
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const urlPath = await botUrl(path);
  let res: Response;
  try {
    res = await fetchWithBase(urlPath, init);
  } catch (e) {
    cachedApiBase = null;
    throw new Error(networkDownMessage(e));
  }
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  if (!looksLikeJson(res, text)) {
    throw new Error("API JSON dönmedi — sunucu Bot rotaları eksik olabilir");
  }
  return JSON.parse(text) as T;
}

async function raw(path: string, init?: RequestInit): Promise<Response> {
  const urlPath = await botUrl(path);
  try {
    return await fetchWithBase(urlPath, init);
  } catch (e) {
    cachedApiBase = null;
    throw new Error(networkDownMessage(e));
  }
}

export function fetchDashboard() {
  return json<DashboardSnapshot>("/dashboard");
}

export function startSession(title?: string) {
  return json<StreamSession>("/sessions", {
    method: "POST",
    body: JSON.stringify({ title: title || null }),
  });
}

export function endSession(sessionId: string) {
  return json<{ session: StreamSession | null }>("/sessions/end", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId }),
  });
}

export async function pushMetrics(body: {
  session_id: string;
  viewers?: number;
  chat_rpm?: number;
  followers?: number;
  subs?: number;
}) {
  return raw("/metrics", {
    method: "POST",
    body: JSON.stringify(body),
  }).catch(() => undefined);
}

export async function logBotEvent(body: {
  kind: string;
  platform?: string;
  user_name: string;
  amount?: number;
  message?: string;
}) {
  return raw("/events", {
    method: "POST",
    body: JSON.stringify(body),
  }).catch(() => undefined);
}

/** Modül 2–8 kısa istemci */
export const botApi = {
  alerts: () => json<{ alerts: unknown[] }>("/alerts"),
  alertVariants: () => json<{ variants: unknown[] }>("/alerts/variants"),
  putAlertVariants: (variants: unknown[]) =>
    json<{ variants: unknown[] }>("/alerts/variants", {
      method: "PUT",
      body: JSON.stringify({ variants }),
    }),
  seedAlerts: () => raw("/alerts/seed", { method: "POST" }),
  testAlert: (body: {
    kind?: string;
    type_id?: string;
    user?: string;
    message?: string;
    amount?: string | number;
  }) =>
    raw("/alerts/test", {
      method: "POST",
      body: JSON.stringify({
        type_id: body.type_id || body.kind || "follow",
        kind: body.kind || body.type_id || "follow",
        user: body.user,
        message: body.message,
        amount: body.amount,
      }),
    }),
  goals: () => json<{ goals: unknown[] }>("/goals"),
  commands: () => json<{ commands: unknown[] }>("/commands"),
  createCommand: (body: Record<string, unknown>) =>
    json<unknown>("/commands", { method: "POST", body: JSON.stringify(body) }),
  updateCommand: (body: Record<string, unknown>) =>
    json<unknown>("/commands", { method: "PUT", body: JSON.stringify(body) }),
  deleteCommand: (id: string) =>
    raw(`/commands?id=${encodeURIComponent(id)}`, { method: "DELETE" }),
  timers: () => json<{ timers: unknown[] }>("/timers"),
  upsertTimer: (body: Record<string, unknown>) =>
    json<unknown>("/timers", { method: "POST", body: JSON.stringify(body) }),
  deleteTimer: (id: string) =>
    raw(`/timers?id=${encodeURIComponent(id)}`, { method: "DELETE" }),
  loyaltyUsers: (limit = 50) =>
    json<{ users: unknown[] }>(`/loyalty/users?limit=${limit}`),
  loyaltySettings: () => json<Record<string, unknown>>("/loyalty/settings"),
  putLoyaltySettings: (body: Record<string, unknown>) =>
    json<Record<string, unknown>>("/loyalty/settings", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  loyaltyTick: () =>
    json<{
      ticked: boolean;
      users_updated?: number;
      reason?: string;
    }>("/loyalty/tick", { method: "POST" }),
  resetLoyalty: (body: { points: boolean; levels: boolean }) =>
    json<{ ok: boolean; updated: number }>("/loyalty/reset", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  botSettings: () => json<Record<string, unknown>>("/bot-settings"),
  putBotSettings: (body: Record<string, unknown>) =>
    json<Record<string, unknown>>("/bot-settings", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  shop: () => json<{ items: unknown[] }>("/shop"),
  upsertShop: (body: Record<string, unknown>) =>
    json<unknown>("/shop", { method: "POST", body: JSON.stringify(body) }),
  deleteShop: (id: string) =>
    raw(`/shop?id=${encodeURIComponent(id)}`, { method: "DELETE" }),
  filters: () => json<Record<string, unknown>>("/filters"),
  putFilters: (body: Record<string, unknown>) =>
    json<Record<string, unknown>>("/filters", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  gamesSettings: () => json<unknown>("/games/settings"),
  putGamesSettings: (body: Record<string, unknown>) =>
    json<unknown>("/games/settings", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  heistStart: () => raw("/games/heist/start", { method: "POST" }),
  remoteSetup: (username: string, password: string) =>
    json<{ ok?: boolean; user_id?: string }>("/remote/setup", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  remoteLogin: (username: string, password: string) =>
    json<Record<string, unknown>>("/remote/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  remoteLogout: () => {
    const token = localStorage.getItem("studio.bot.remoteToken");
    return raw("/remote/logout", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: JSON.stringify(token ? { token } : {}),
    });
  },
  remoteUsers: () => json<{ users: unknown[] }>("/remote/users"),
  upsertRemoteUser: (body: Record<string, unknown>) =>
    json<unknown>("/remote/users", { method: "POST", body: JSON.stringify(body) }),
  deleteRemoteUser: (id: string) =>
    json<{ ok: boolean }>("/remote/users/delete", {
      method: "POST",
      body: JSON.stringify({ id }),
    }),
  remoteTriggerAlert: (body: Record<string, unknown>) => {
    const token = localStorage.getItem("studio.bot.remoteToken");
    return raw("/remote/alerts/trigger", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: JSON.stringify(body),
    });
  },
  remoteChatSend: (text: string) => {
    const token = localStorage.getItem("studio.bot.remoteToken");
    return raw("/remote/chat/send", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: JSON.stringify({ text }),
    });
  },
  remoteObsScene: (scene: string) => {
    const token = localStorage.getItem("studio.bot.remoteToken");
    return raw("/remote/obs/scene", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: JSON.stringify({ scene }),
    });
  },
  discordTest: () => raw("/integrations/discord/test", { method: "POST" }),
  eskiPaneliAktar: (force = false) =>
    raw(`/sync/eski-panel?force=${force ? 1 : 0}`, { method: "POST" }),
  seedWidgets: () => raw("/widgets/seed", { method: "POST" }),
};

export function fmtDuration(sec: number | null | undefined) {
  if (sec == null || sec < 0) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}s ${m}dk`;
  if (m > 0) return `${m}dk ${s}sn`;
  return `${s}sn`;
}

export function fmtTs(ms: number) {
  try {
    return new Date(ms).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}
