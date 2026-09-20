/** OBS overlay’lerde ortak: widget event + smartBot canlı senkron. */

import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../api";
import type { WidgetEvent } from "./events";
import {
  applyRemoteBotConfig,
  getBotConfig,
  hydrateBotConfigFromServer,
  subscribeBotConfig,
} from "./store";
import type { BotConfigV2 } from "./v2";

function pickSmartBot(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const o = obj as Record<string, unknown>;
  if (o.smartBot && typeof o.smartBot === "object") return o.smartBot;
  return undefined;
}

function extractPanelPayload(msg: unknown): { smartBot?: unknown; event?: WidgetEvent | null } {
  const m = msg as {
    type?: string;
    screen?: string;
    data?: Record<string, unknown>;
    panel?: Record<string, unknown>;
  };
  if (!m || typeof m !== "object") return {};

  // İlk bağlantı snapshot’ı — panel ayarları kökte
  if (m.type === "snapshot") {
    const fromPanel = pickSmartBot(m.panel);
    const we = (m.panel?._widgetEvent || null) as WidgetEvent | null;
    return { smartBot: fromPanel, event: we?.id ? we : null };
  }

  const data = (m.data || m) as Record<string, unknown> | undefined;
  if (!data || typeof data !== "object") return {};
  const screenOk = !m.screen || m.screen === "panel" || m.type === "snapshot";
  if (!screenOk && m.type === "settings") return {};
  const we = (data._widgetEvent || null) as WidgetEvent | null;
  const smartBot = pickSmartBot(data) ?? (m.screen === "panel" ? pickSmartBot(data) : undefined);
  return { smartBot, event: we?.id ? we : null };
}

/** Sadece olay dinle; smartBot varsa uzak cache’e uygula. */
export function useOverlayWidgetEvents(onEvent: (ev: WidgetEvent) => void) {
  useEffect(() => {
    const onLocal = (e: Event) => onEvent((e as CustomEvent<WidgetEvent>).detail);
    window.addEventListener("smartbot-widget-event", onLocal);

    let ws: WebSocket | null = null;
    let retry: number | undefined;
    const connect = () => {
      try {
        ws = new WebSocket(`${API_BASE.replace(/^http/, "ws")}/ws/overlay-sync`);
      } catch {
        retry = window.setTimeout(connect, 2000);
        return;
      }
      ws.onmessage = (raw) => {
        try {
          const msg = JSON.parse(raw.data);
          const { smartBot, event } = extractPanelPayload(msg);
          if (smartBot && typeof smartBot === "object") {
            applyRemoteBotConfig(smartBot);
          }
          if (event?.id) onEvent(event);
        } catch {
          /* */
        }
      };
      ws.onclose = () => {
        retry = window.setTimeout(connect, 2000);
      };
    };
    connect();
    return () => {
      window.removeEventListener("smartbot-widget-event", onLocal);
      if (retry) window.clearTimeout(retry);
      try {
        ws?.close();
      } catch {
        /* */
      }
    };
  }, [onEvent]);
}

/** Widget sayfaları için: hydrate + subscribe + OBS live smartBot. */
export function useOverlayBotConfig(): BotConfigV2 {
  const [cfg, setCfg] = useState<BotConfigV2>(() => getBotConfig());

  useEffect(() => {
    void hydrateBotConfigFromServer().then(setCfg);
    return subscribeBotConfig(setCfg);
  }, []);

  const onEvent = useCallback((_ev: WidgetEvent) => {
    setCfg(getBotConfig());
  }, []);

  useOverlayWidgetEvents(onEvent);

  return cfg;
}
