/** OBS Subathon countdown */

import { useEffect, useRef, useState } from "react";
import { useObsKeepalive } from "../../lib/obsKeepalive";
import { useOverlayBotConfig } from "../../lib/smartBot/useOverlayWidgetEvents";
import { useIsWidgetPreview } from "../../lib/smartBot/widgetPreview";

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function SubathonPage() {
  useObsKeepalive();
  const preview = useIsWidgetPreview();
  const cfg = useOverlayBotConfig();
  const subathon = cfg.subathon;
  const [now, setNow] = useState(() => Date.now());
  const frozenRemain = useRef<number | null>(null);

  useEffect(() => {
    if (subathon.paused) return;
    frozenRemain.current = null;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [subathon.paused]);

  const enabled = subathon.enabled || preview;
  if (!enabled) {
    return (
      <div className="grid h-screen place-items-center bg-transparent p-4 text-white">
        <div className="rounded-xl border border-white/15 bg-zinc-950/80 px-5 py-3 text-sm">
          Abone maratonu kapalı — panelden aç
        </div>
      </div>
    );
  }

  const endsAt =
    subathon.endsAt ??
    (preview ? Date.now() + (subathon.baseSeconds || 3600) * 1000 : Date.now() + (subathon.baseSeconds || 0) * 1000);

  let remaining: number;
  if (subathon.paused) {
    if (frozenRemain.current == null) frozenRemain.current = Math.max(0, endsAt - now);
    remaining = frozenRemain.current;
  } else {
    remaining = endsAt - now;
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-transparent text-white">
      <div className="text-center">
        {preview && !subathon.enabled && (
          <div className="mb-2 text-[10px] uppercase tracking-widest text-amber-300/85">Önizleme</div>
        )}
        <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-amber-300/85">
          Abone Maratonu{subathon.paused ? " · Duraklatıldı" : ""}
        </div>
        <div className="font-mono text-6xl font-semibold tabular-nums tracking-tight md:text-8xl">
          {formatRemaining(remaining)}
        </div>
        <div className="mt-3 text-xs text-white/70">
          +{subathon.secondsPerSub}s / abone · +{subathon.secondsPerFollow}s / takip
          {" · "}+{subathon.secondsPerTip ?? 30}s / bağış · +{subathon.secondsPerBit ?? 1}s / bit
        </div>
      </div>
    </div>
  );
}
