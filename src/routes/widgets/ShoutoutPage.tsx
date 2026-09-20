/** OBS Shoutout overlay */

import { useCallback, useEffect, useRef, useState } from "react";
import { useObsKeepalive } from "../../lib/obsKeepalive";
import type { WidgetEvent } from "../../lib/smartBot/events";
import { useOverlayWidgetEvents } from "../../lib/smartBot/useOverlayWidgetEvents";
import { useIsWidgetPreview } from "../../lib/smartBot/widgetPreview";

type Shout = { user: string; message: string; key: number };

export default function ShoutoutPage() {
  useObsKeepalive();
  const preview = useIsWidgetPreview();
  const [current, setCurrent] = useState<Shout | null>(null);
  const hideTimer = useRef<number | null>(null);

  const show = useCallback((user: string, message: string, durationMs: number) => {
    setCurrent({ user, message, key: Date.now() });
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setCurrent(null), Math.max(1500, durationMs));
  }, []);

  const onEvent = useCallback(
    (we: WidgetEvent) => {
      if (we.kind !== "shoutout") return;
      const durationMs = Number(we.meta?.durationMs || 6000);
      show(we.user || "Kullanıcı", we.message || String(we.meta?.message || ""), durationMs);
    },
    [show]
  );

  useOverlayWidgetEvents(onEvent);

  useEffect(() => {
    if (!preview || current) return;
    setCurrent({
      user: "DemoKanal",
      message: "Örnek shoutout — !so kullanıcı",
      key: Date.now(),
    });
  }, [preview, current]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-transparent text-white">
      {current && (
        <div
          key={current.key}
          className="absolute left-1/2 top-[14%] w-[min(92vw,640px)] -translate-x-1/2 animate-[fadeUp_.45s_ease] rounded-xl border border-sky-400/25 bg-zinc-950/80 px-8 py-5 text-center shadow-[0_20px_60px_rgba(0,0,0,.45)] backdrop-blur-md"
        >
          {preview && (
            <div className="mb-1 text-[10px] uppercase tracking-widest text-amber-300/80">Önizleme</div>
          )}
          <div className="mb-1 text-[11px] uppercase tracking-[0.2em] text-sky-300/85">Selamlama</div>
          <div className="text-2xl font-semibold md:text-3xl">{current.user}</div>
          {current.message && <div className="mt-2 text-sm text-white/70">{current.message}</div>}
        </div>
      )}
      {!current && (
        <div className="grid h-screen place-items-center">
          <div className="rounded-xl border border-white/15 bg-zinc-950/80 px-5 py-3 text-sm text-white/85">
            Selamlama bekleniyor — !so kullanıcı
          </div>
        </div>
      )}
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}`}</style>
    </div>
  );
}
