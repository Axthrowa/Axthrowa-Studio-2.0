/**
 * Merkezi OBS overlay WebSocket — mutlak `ws://127.0.0.1:8843/ws/overlay-sync`
 * chat-message, trigger_alert, settings._widgetEvent, widget-test
 */

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { API_BASE } from "../api";
import { logger } from "../logger";

export type WidgetSyncEvent = {
  id: string;
  kind: string;
  user?: string;
  text?: string;
  message?: string;
  amount?: number | string | null;
  platform?: string;
  badges?: string[];
  color?: string;
  t?: number;
  /** Botun kendi iletisi (Studio, botun az önce gönderdiği metinle eşleştirir) */
  bot?: boolean;
  raw?: Record<string, unknown>;
};

export type UseWidgetSyncOptions = {
  kinds?: string[];
  enabled?: boolean;
};

/** OBS Browser Source için her zaman loopback — API_BASE yanlış olsa bile. */
export function overlaySyncWsUrl(): string {
  const fromEnv = (import.meta as { env?: { VITE_WS_OVERLAY?: string } }).env
    ?.VITE_WS_OVERLAY;
  if (fromEnv && fromEnv.startsWith("ws")) return fromEnv;
  const portMatch = API_BASE.match(/:(\d+)/);
  const port = portMatch?.[1] || "8843";
  return `ws://127.0.0.1:${port}/ws/overlay-sync`;
}

type SharedSyncCtx = {
  connected: boolean;
  subscribe: (fn: (ev: WidgetSyncEvent) => void, kinds?: string[]) => () => void;
};

const WidgetSyncContext = createContext<SharedSyncCtx | null>(null);

export function useWidgetSyncContext(): SharedSyncCtx | null {
  return useContext(WidgetSyncContext);
}

/** Master Overlay: tek WS → tüm widget fan-out */
export function WidgetSyncProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const listeners = useRef(
    new Set<{ fn: (ev: WidgetSyncEvent) => void; kinds?: string[] }>()
  );

  const subscribe = useCallback(
    (fn: (ev: WidgetSyncEvent) => void, kinds?: string[]) => {
      const entry = { fn, kinds };
      listeners.current.add(entry);
      return () => {
        listeners.current.delete(entry);
      };
    },
    []
  );

  useEffect(() => {
    let ws: WebSocket | null = null;
    let retry: number | undefined;
    let closed = false;
    const url = overlaySyncWsUrl();

    const push = (ev: WidgetSyncEvent) => {
      listeners.current.forEach(({ fn, kinds }) => {
        if (kinds?.length && !kinds.includes(ev.kind)) return;
        try {
          fn(ev);
        } catch (err) {
          logger.error("[WS/shared] listener error", err);
        }
      });
    };

    const connect = () => {
      if (closed) return;
      try {
        ws = new WebSocket(url);
      } catch {
        retry = window.setTimeout(connect, 2200);
        return;
      }
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!closed) retry = window.setTimeout(connect, 2200);
      };
      ws.onerror = () => {
        try {
          ws?.close();
        } catch {
          /* */
        }
      };
      ws.onmessage = (e) => {
        const ev = parseMessage(String(e.data));
        if (ev) push(ev);
      };
    };
    connect();
    return () => {
      closed = true;
      if (retry) window.clearTimeout(retry);
      try {
        ws?.close();
      } catch {
        /* */
      }
    };
  }, []);

  const value = useMemo(() => ({ connected, subscribe }), [connected, subscribe]);
  return createElement(WidgetSyncContext.Provider, { value }, children);
}

function normalizeAmount(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function fromChatMessage(msg: Record<string, unknown>): WidgetSyncEvent | null {
  if (msg.type !== "chat-message") return null;
  return {
    id: String(msg.id || `chat-${msg.t || Date.now()}`),
    kind: "chat",
    user: String(msg.user || ""),
    text: String(msg.text || ""),
    platform: String(msg.platform || ""),
    badges: Array.isArray(msg.badges) ? (msg.badges as string[]) : [],
    color: msg.color ? String(msg.color) : undefined,
    t: Number(msg.t) || Date.now(),
    bot: msg.bot === true,
    raw: msg,
  };
}

function fromAlertLike(msg: Record<string, unknown>): WidgetSyncEvent | null {
  const data = (msg.data || msg._widgetEvent || msg) as Record<string, unknown>;
  if (!data || typeof data !== "object") return null;

  if (msg.type === "settings" && data._widgetEvent) {
    return fromAlertLike({
      type: "trigger_alert",
      data: data._widgetEvent as Record<string, unknown>,
    });
  }

  const kind = String(data.kind || data.type || "").toLowerCase();
  if (!kind || kind === "settings" || kind === "snapshot") return null;
  if (kind === "chat" || kind === "chat-message") return null;

  const mapped =
    kind === "donation" || kind === "tip"
      ? "tip"
      : kind === "cheer"
        ? "bits"
        : kind;

  return {
    id: String(data.id || `${mapped}-${data.t || Date.now()}`),
    kind: mapped,
    user: data.user ? String(data.user) : undefined,
    text: String(data.message || data.text || ""),
    message: String(data.message || data.text || ""),
    amount: normalizeAmount(data.amount),
    platform: data.platform ? String(data.platform) : undefined,
    t: Number(data.t) || Date.now(),
    raw: data,
  };
}

function parseMessage(raw: string): WidgetSyncEvent | null {
  try {
    const msg = JSON.parse(raw) as Record<string, unknown>;

    if (msg.type === "config_updated" || msg.type === "widgets_updated") {
      return null;
    }

    if (msg.type === "chat-message") return fromChatMessage(msg);

    if (msg.type === "emote_combo_updated") {
      return {
        id: `emotecombo-${msg.t || Date.now()}`,
        kind: "emotecombo",
        text: String(msg.label || msg.emoteId || ""),
        message: `${msg.label || ""} x${msg.count || 0}`,
        t: Number(msg.t) || Date.now(),
        raw: msg,
      };
    }

    const subathonType =
      msg.type === "new_follow"
        ? "follow"
        : msg.type === "new_sub"
          ? "sub"
          : msg.type === "new_donation"
            ? "tip"
            : msg.type === "new_kick"
              ? "kick"
              : null;
    if (subathonType) {
      const data = (msg.data || msg) as Record<string, unknown>;
      return {
        id: String(data.id || msg.id || `${subathonType}-${Date.now()}`),
        kind: subathonType,
        user: data.user != null ? String(data.user) : undefined,
        text: String(data.message || data.text || ""),
        message: String(data.message || data.text || ""),
        amount: normalizeAmount(data.amount),
        platform: data.platform != null ? String(data.platform) : undefined,
        t: Number(data.t || msg.t) || Date.now(),
        raw: msg as Record<string, unknown>,
      };
    }

    if (msg.type === "widget-test") {
      const nested = msg.data || msg.event;
      if (nested && typeof nested === "object") {
        const n = nested as Record<string, unknown>;
        if (n.type === "chat-message" || n.kind === "chat") {
          return fromChatMessage({ ...n, type: "chat-message" });
        }
        return fromAlertLike({ type: "trigger_alert", data: n });
      }
    }
    if (msg.type === "trigger_alert") return fromAlertLike(msg);
    if (msg.type === "settings") return fromAlertLike(msg);
    if (
      msg.type === "snapshot" &&
      (msg as { panel?: Record<string, unknown> }).panel?._widgetEvent
    ) {
      return fromAlertLike({
        type: "trigger_alert",
        data: (msg as { panel: Record<string, unknown> }).panel
          ._widgetEvent as Record<string, unknown>,
      });
    }
    if (msg.kind) return fromAlertLike({ type: "trigger_alert", data: msg });
  } catch (e) {
    logger.warn("[WS] parse failed", e, raw);
  }
  return null;
}

export function useWidgetSync(options: UseWidgetSyncOptions = {}) {
  const { kinds, enabled = true } = options;
  const shared = useWidgetSyncContext();
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<WidgetSyncEvent | null>(null);
  const [events, setEvents] = useState<WidgetSyncEvent[]>([]);
  const listeners = useRef(new Set<(ev: WidgetSyncEvent) => void>());
  const kindsKey = kinds?.join("|") || "";

  const subscribe = useCallback(
    (fn: (ev: WidgetSyncEvent) => void) => {
      if (shared) {
        return shared.subscribe((ev) => {
          if (kinds?.length && !kinds.includes(ev.kind)) return;
          fn(ev);
        }, kinds);
      }
      listeners.current.add(fn);
      return () => {
        listeners.current.delete(fn);
      };
    },
    [shared, kindsKey]
  );

  useEffect(() => {
    if (!enabled || !shared) return;
    setConnected(shared.connected);
    return shared.subscribe((ev) => {
      if (kinds?.length && !kinds.includes(ev.kind)) return;
      setLastEvent(ev);
      setEvents((prev) => [...prev.slice(-79), ev]);
      listeners.current.forEach((fn) => {
        try {
          fn(ev);
        } catch (err) {
          logger.error("[WS] listener error", err);
        }
      });
    }, kinds);
  }, [enabled, shared, kindsKey, shared?.connected]);

  useEffect(() => {
    if (!enabled || shared) return;

    let ws: WebSocket | null = null;
    let retry: number | undefined;
    let closed = false;
    const url = overlaySyncWsUrl();

    const push = (ev: WidgetSyncEvent) => {
      if (kinds?.length && !kinds.includes(ev.kind)) return;
      logger.log("[WS] → widget handler:", ev.kind, ev);
      setLastEvent(ev);
      setEvents((prev) => [...prev.slice(-79), ev]);
      listeners.current.forEach((fn) => {
        try {
          fn(ev);
        } catch (err) {
          logger.error("[WS] listener error", err);
        }
      });
    };

    const connect = () => {
      if (closed) return;
      logger.log("[WS] connecting", url);
      try {
        ws = new WebSocket(url);
      } catch (e) {
        logger.error("[WS] construct failed", e);
        retry = window.setTimeout(connect, 2200);
        return;
      }
      ws.onopen = () => {
        logger.log("[WS] open", url);
        setConnected(true);
      };
      ws.onclose = () => {
        logger.log("[WS] close");
        setConnected(false);
        if (!closed) retry = window.setTimeout(connect, 2200);
      };
      ws.onerror = () => {
        logger.warn("[WS] error");
        try {
          ws?.close();
        } catch {
          /* */
        }
      };
      ws.onmessage = (e) => {
        const ev = parseMessage(String(e.data));
        if (ev) push(ev);
      };
    };

    connect();
    return () => {
      closed = true;
      if (retry) window.clearTimeout(retry);
      try {
        ws?.close();
      } catch {
        /* */
      }
    };
  }, [enabled, kindsKey, shared]);

  return { connected: shared ? shared.connected : connected, lastEvent, events, subscribe };
}

export async function fetchWidgetConfig(
  kind: string
): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(`${API_BASE}/api/botaxt/widgets`, { cache: "no-store" });
    if (!res.ok) return {};
    const j = (await res.json()) as {
      widgets?: Array<{ kind?: string; config?: Record<string, unknown>; config_json?: string }>;
    };
    const w = (j.widgets || []).find(
      (x) => (x.kind || "").toLowerCase() === kind.toLowerCase()
    );
    if (!w) return {};
    if (w.config && typeof w.config === "object") return { ...w.config };
    if (w.config_json) {
      try {
        return JSON.parse(w.config_json) as Record<string, unknown>;
      } catch {
        return {};
      }
    }
  } catch {
    /* */
  }
  return {};
}

export function useWidgetConfig(kind: string) {
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchWidgetConfig(kind).then((c) => {
      if (alive) {
        setConfig(c);
        setLoading(false);
      }
    });

    const poll = window.setInterval(() => {
      void fetchWidgetConfig(kind).then((c) => {
        if (alive) setConfig(c);
      });
    }, 15000);

    let ws: WebSocket | null = null;
    let retry: number | undefined;
    let closed = false;
    const url = overlaySyncWsUrl();

    const onMsg = (raw: string) => {
      try {
        const msg = JSON.parse(raw) as Record<string, unknown>;
        if (msg.type !== "config_updated" && msg.type !== "widgets_updated") return;
        const msgKind = String(msg.kind || "").toLowerCase();
        if (msgKind && msgKind !== kind.toLowerCase()) return;
        if (msg.config && typeof msg.config === "object") {
          logger.log("[WS] config_updated", msgKind || kind, msg.config);
          setConfig({ ...(msg.config as Record<string, unknown>) });
          setLoading(false);
          return;
        }
        void fetchWidgetConfig(kind).then((c) => {
          if (alive) setConfig(c);
        });
      } catch {
        /* */
      }
    };

    const connect = () => {
      if (closed) return;
      try {
        ws = new WebSocket(url);
      } catch {
        retry = window.setTimeout(connect, 2500);
        return;
      }
      ws.onmessage = (e) => onMsg(String(e.data));
      ws.onclose = () => {
        if (!closed) retry = window.setTimeout(connect, 2500);
      };
      ws.onerror = () => {
        try {
          ws?.close();
        } catch {
          /* */
        }
      };
    };
    connect();

    return () => {
      alive = false;
      closed = true;
      window.clearInterval(poll);
      if (retry) window.clearTimeout(retry);
      try {
        ws?.close();
      } catch {
        /* */
      }
    };
  }, [kind]);

  return { config, loading, setConfig };
}

