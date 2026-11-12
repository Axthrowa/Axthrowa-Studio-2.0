/** OBS Redeem-only alert queue */

import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "../../lib/api";
import { useObsKeepalive } from "../../lib/obsKeepalive";
import type { WidgetEvent } from "../../lib/sohbetBot/events";
import { getBotConfig, hydrateBotConfigFromServer, subscribeBotConfig } from "../../lib/sohbetBot";
import type { AlertStyle } from "../../lib/sohbetBot/v2";

function formatAlert(tpl: string, ev: WidgetEvent, item?: string) {
  return tpl
    .replace(/\{user\}/gi, ev.user)
    .replace(/\{amount\}/gi, ev.amount ? ` (${ev.amount})` : "")
    .replace(/\{item\}/gi, item || String(ev.meta?.item || ""))
    .replace(/\{message\}/gi, ev.message || "");
}

export default function RedeemOverlayPage() {
  useObsKeepalive();
  const [alerts, setAlerts] = useState<AlertStyle>(() => getBotConfig().alerts);
  const [current, setCurrent] = useState<(WidgetEvent & { text: string }) | null>(null);
  const queue = useRef<(WidgetEvent & { text: string })[]>([]);
  const busy = useRef(false);
  const hideTimer = useRef<number | null>(null);

  useEffect(() => {
    void hydrateBotConfigFromServer().then((c) => setAlerts(c.alerts));
    return subscribeBotConfig((c) => setAlerts(c.alerts));
  }, []);

  const pump = useCallback(() => {
    if (busy.current || !queue.current.length) return;
    busy.current = true;
    const next = queue.current.shift()!;
    setCurrent(next);
    const cfg = getBotConfig();
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      setCurrent(null);
      busy.current = false;
      pump();
    }, Math.max(2000, cfg.alerts.durationMs || 6500));
  }, []);

  const enqueue = useCallback(
    (ev: WidgetEvent) => {
      if (ev.kind !== "redeem") return;
      if (!getBotConfig().alerts.enabled) return;
      const a = getBotConfig().alerts;
      const text = formatAlert(a.redeemText, ev, String(ev.meta?.item || ""));
      queue.current.push({ ...ev, text });
      while (queue.current.length > 12) queue.current.shift();
      pump();
    },
    [pump]
  );

  useEffect(() => {
    const onLocal = (e: Event) => enqueue((e as CustomEvent<WidgetEvent>).detail);
    window.addEventListener("sohbet-bot-widget-olayi", onLocal);

    let ws: WebSocket | null = null;
    let retry: number | undefined;
    const connect = () => {
      try {
        ws = new WebSocket(`${API_BASE.replace(/^http/, "ws")}/ws/overlay-sync`);
      } catch {
        retry = window.setTimeout(connect, 2000);
        return;
      }
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          const data = msg?.data || msg;
          const we = data?._widgetEvent || (msg?.screen === "panel" ? msg?.data?._widgetEvent : null);
          if (we && we.id) enqueue(we as WidgetEvent);
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
      window.removeEventListener("sohbet-bot-widget-olayi", onLocal);
      if (retry) window.clearTimeout(retry);
      try {
        ws?.close();
      } catch {
        /* */
      }
    };
  }, [enqueue]);

  const layout = alerts.layout || "banner";

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-transparent text-white">
      {current && (
        <div
          className={`absolute left-1/2 top-[12%] w-[min(92vw,720px)] -translate-x-1/2 animate-[fadeUp_.45s_ease] ${
            layout === "minimal"
              ? "rounded-lg bg-black/55 px-5 py-3 text-center text-xl font-semibold backdrop-blur-md"
              : layout === "card"
                ? "rounded-2xl border border-white/15 bg-gradient-to-br from-zinc-900/90 to-stone-950/90 px-8 py-6 text-center shadow-2xl backdrop-blur-md"
                : "rounded-xl border border-cyan-400/25 bg-zinc-950/80 px-8 py-5 text-center shadow-[0_20px_60px_rgba(0,0,0,.45)] backdrop-blur-md"
          }`}
        >
          <div className="mb-1 text-[11px] uppercase tracking-[0.2em] text-cyan-300/80">redeem</div>
          <div className="text-2xl font-semibold leading-snug md:text-3xl">{current.text}</div>
          {current.message && <div className="mt-2 text-sm text-white/70">{current.message}</div>}
        </div>
      )}
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}`}</style>
    </div>
  );
}
