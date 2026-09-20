/**
 * OBS Alert Box — follow / sub / raid / redeem.
 * Panel `_widgetEvent` + local custom event.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "../../lib/api";
import { useObsKeepalive } from "../../lib/obsKeepalive";
import type { WidgetEvent } from "../../lib/smartBot/events";
import { getBotConfig } from "../../lib/smartBot";
import { useOverlayBotConfig } from "../../lib/smartBot/useOverlayWidgetEvents";
import { useIsWidgetPreview } from "../../lib/smartBot/widgetPreview";

function speak(text: string, volume: number, rate: number) {
  try {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "tr-TR";
    u.volume = Math.min(1, Math.max(0, volume));
    u.rate = Math.min(2, Math.max(0.5, rate));
    window.speechSynthesis.speak(u);
  } catch {
    /* */
  }
}

function beep() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 660;
    g.gain.value = 0.04;
    o.start();
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    o.stop(ctx.currentTime + 0.35);
  } catch {
    /* */
  }
}

function formatAlert(tpl: string, ev: WidgetEvent, item?: string) {
  return tpl
    .replace(/\{user\}/gi, ev.user)
    .replace(/\{amount\}/gi, ev.amount ? ` (${ev.amount})` : "")
    .replace(/\{item\}/gi, item || String(ev.meta?.item || ""))
    .replace(/\{message\}/gi, ev.message || "");
}

export default function AlertsPage() {
  useObsKeepalive();
  const preview = useIsWidgetPreview();
  const bot = useOverlayBotConfig();
  const alerts = bot.alerts;
  const theme = bot.alertsExtras?.theme || "default";
  const opacity = bot.alertsExtras?.opacity ?? 1;
  const [current, setCurrent] = useState<(WidgetEvent & { text: string }) | null>(null);
  const queue = useRef<(WidgetEvent & { text: string })[]>([]);
  const busy = useRef(false);
  const hideTimer = useRef<number | null>(null);

  const pump = useCallback(() => {
    if (busy.current || !queue.current.length) return;
    busy.current = true;
    const next = queue.current.shift()!;
    setCurrent(next);
    const cfg = getBotConfig();
    if (cfg.alerts.sound) beep();
    if (cfg.alerts.tts || cfg.tts.enabled) {
      speak(next.text, cfg.tts.volume, cfg.tts.rate);
    }
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    const dur =
      Number((next as any).meta?.durationMs) ||
      Math.max(2000, cfg.alerts.durationMs || 6500);
    hideTimer.current = window.setTimeout(() => {
      setCurrent(null);
      busy.current = false;
      pump();
    }, dur);
  }, []);

  const enqueue = useCallback(
    (ev: WidgetEvent) => {
      if (!getBotConfig().alerts.enabled) return;
      const cfg = getBotConfig();
      const a = cfg.alerts;
      const types = cfg.alertTypes;
      const mapKind =
        ev.kind === "follow"
          ? "follow"
          : ev.kind === "sub" || ev.kind === "membership"
            ? "sub"
            : ev.kind === "raid"
              ? "host"
              : ev.kind === "bits" || ev.kind === "superchat" || ev.kind === "donation"
                ? "tip"
                : ev.kind === "redeem"
                  ? null
                  : ev.kind === "test" || ev.kind === "tts"
                    ? null
                    : null;
      let text = "";
      let durationMs = a.durationMs || 6500;
      if (mapKind && types?.[mapKind]) {
        const t = types[mapKind];
        if (!t.enabled) return;
        text = formatAlert(t.text || a.followText, ev);
        durationMs = Math.max(2000, (t.durationSec || 6) * 1000);
      } else if (ev.kind === "follow") text = formatAlert(a.followText, ev);
      else if (ev.kind === "sub" || ev.kind === "membership") text = formatAlert(a.subText, ev);
      else if (ev.kind === "raid") text = formatAlert(a.raidText, ev);
      else if (ev.kind === "bits" || ev.kind === "superchat" || ev.kind === "donation")
        text = formatAlert(a.bitsText, ev);
      else if (ev.kind === "redeem") text = formatAlert(a.redeemText, ev, String(ev.meta?.item || ""));
      else if (ev.kind === "test" || ev.kind === "tts") text = ev.message || `${ev.user} test`;
      else return;

      // Varyant (minAmount)
      const variants = cfg.alertsExtras?.variants || [];
      const amt = Number(String(ev.amount || "").replace(/[^\d.]/g, "")) || 0;
      const typeKey =
        mapKind ||
        (ev.kind === "bits" || ev.kind === "donation" ? "tip" : ev.kind === "raid" ? "host" : ev.kind);
      const matched = variants
        .filter((v) => v.enabled && v.typeKey === typeKey && amt >= (v.minAmount || 0))
        .sort((x, y) => y.minAmount - x.minAmount)[0];
      if (matched?.text) text = formatAlert(matched.text, ev);

      queue.current.push({ ...ev, text, meta: { ...(ev.meta || {}), durationMs } });
      while (queue.current.length > 12) queue.current.shift();
      pump();
    },
    [pump]
  );

  useEffect(() => {
    const onLocal = (e: Event) => enqueue((e as CustomEvent<WidgetEvent>).detail);
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
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          const data = msg?.data || msg;
          const we =
            data?._widgetEvent ||
            (msg?.type === "snapshot" ? msg?.panel?._widgetEvent : null) ||
            (msg?.screen === "panel" ? msg?.data?._widgetEvent : null);
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
      window.removeEventListener("smartbot-widget-event", onLocal);
      if (retry) window.clearTimeout(retry);
      try {
        ws?.close();
      } catch {
        /* */
      }
    };
  }, [enqueue]);

  useEffect(() => {
    if (!preview || current) return;
    setCurrent({
      id: "preview",
      kind: "follow",
      user: "DemoKullanıcı",
      message: "",
      text: "DemoKullanıcı takip etti!",
      t: Date.now(),
    } as WidgetEvent & { text: string });
  }, [preview, current]);

  const layout = alerts.layout || "banner";
  const themeAnim =
    theme === "fade"
      ? "animate-[fadeUp_.6s_ease]"
      : theme === "slide"
        ? "animate-[slideIn_.45s_ease]"
        : "animate-[fadeUp_.45s_ease]";

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-transparent text-white">
      {current && (
        <div
          style={{ opacity }}
          className={`absolute left-1/2 top-[12%] w-[min(92vw,720px)] -translate-x-1/2 ${themeAnim} ${
            theme === "compact" || layout === "minimal"
              ? "rounded-lg bg-black/55 px-5 py-3 text-center text-xl font-semibold backdrop-blur-md"
              : theme === "legacy" || layout === "card"
                ? "rounded-2xl border border-white/15 bg-gradient-to-br from-zinc-900/90 to-stone-950/90 px-8 py-6 text-center shadow-2xl backdrop-blur-md"
                : "rounded-xl border border-amber-400/25 bg-zinc-950/80 px-8 py-5 text-center shadow-[0_20px_60px_rgba(0,0,0,.45)] backdrop-blur-md"
          }`}
        >
          <div className="mb-1 text-[11px] uppercase tracking-[0.2em] text-amber-300/80">
            {current.kind}
          </div>
          <div className="text-2xl font-semibold leading-snug md:text-3xl">{current.text}</div>
          {current.message && current.kind !== "test" && (
            <div className="mt-2 text-sm text-white/70">{current.message}</div>
          )}
        </div>
      )}
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}
        @keyframes slideIn{from{opacity:0;transform:translate(-50%,-40px)}to{opacity:1;transform:translate(-50%,0)}}
      `}</style>
    </div>
  );
}
