/** OBS overlay’lerde ortak: widget event + sohbetBot canlı senkron. */

import { useCallback, useEffect, useState } from "react";
import { subscribeOverlaySync } from "../overlaySyncHub";
import type { WidgetEvent } from "./events";
import {
  applyRemoteBotConfig,
  getBotConfig,
  hydrateBotConfigFromServer,
  subscribeBotConfig,
} from "./store";
import type { BotConfigV2 } from "./v2";
import { panelBotu } from "../eskiAdlar";

function pickSohbetBot(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const o = obj as Record<string, unknown>;
  const bot = panelBotu(o);
  if (bot && typeof bot === "object") return bot;
  return undefined;
}

function extractPanelPayload(msg: unknown): { sohbetBot?: unknown; event?: WidgetEvent | null } {
  const m = msg as {
    type?: string;
    screen?: string;
    data?: Record<string, unknown>;
    panel?: Record<string, unknown>;
  };
  if (!m || typeof m !== "object") return {};

  // İlk bağlantı snapshot’ı — panel ayarları kökte
  if (m.type === "snapshot") {
    const fromPanel = pickSohbetBot(m.panel);
    const we = (m.panel?._widgetEvent || null) as WidgetEvent | null;
    return { sohbetBot: fromPanel, event: we?.id ? we : null };
  }

  const data = (m.data || m) as Record<string, unknown> | undefined;
  if (!data || typeof data !== "object") return {};
  const screenOk = !m.screen || m.screen === "panel" || m.type === "snapshot";
  if (!screenOk && m.type === "settings") return {};
  const we = (data._widgetEvent || null) as WidgetEvent | null;
  const sohbetBot = pickSohbetBot(data) ?? (m.screen === "panel" ? pickSohbetBot(data) : undefined);
  return { sohbetBot, event: we?.id ? we : null };
}

/** Sadece olay dinle; sohbetBot varsa uzak cache’e uygula. */
export function useOverlayWidgetEvents(onEvent: (ev: WidgetEvent) => void) {
  useEffect(() => {
    const onLocal = (e: Event) => onEvent((e as CustomEvent<WidgetEvent>).detail);
    window.addEventListener("sohbet-bot-widget-olayi", onLocal);

    const unsubscribe = subscribeOverlaySync({
      onMessage: (raw) => {
        try {
          const msg = JSON.parse(raw.data);
          const { sohbetBot, event } = extractPanelPayload(msg);
          if (sohbetBot && typeof sohbetBot === "object") {
            applyRemoteBotConfig(sohbetBot);
          }
          if (event?.id) onEvent(event);
        } catch {
          /* */
        }
      },
    });
    return () => {
      window.removeEventListener("sohbet-bot-widget-olayi", onLocal);
      unsubscribe();
    };
  }, [onEvent]);
}

/** Widget sayfaları için: hydrate + subscribe + OBS live sohbetBot. */
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
