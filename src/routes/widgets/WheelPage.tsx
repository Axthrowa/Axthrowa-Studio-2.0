/** OBS Wheel of fortune overlay */

import { useEffect, useMemo, useState } from "react";
import { useObsKeepalive } from "../../lib/obsKeepalive";
import { useOverlayBotConfig } from "../../lib/smartBot/useOverlayWidgetEvents";
import { useIsWidgetPreview } from "../../lib/smartBot/widgetPreview";

export default function WheelPage() {
  useObsKeepalive();
  const preview = useIsWidgetPreview();
  const cfg = useOverlayBotConfig();
  const wheel = cfg.wheel;
  const [rot, setRot] = useState(() => Number(wheel.rotationDeg) || 0);
  const [transitionMs, setTransitionMs] = useState(0);

  const options = wheel.options?.length ? wheel.options : ["Ödül 1", "Ödül 2", "Ödül 3", "Tekrar"];
  const slice = 360 / options.length;
  const spinMs = Math.max(1500, wheel.spinDurationMs || 4000);

  useEffect(() => {
    const target = Number(wheel.rotationDeg) || 0;
    if (wheel.spinning) {
      setTransitionMs(spinMs);
      // rAF: transition’ı hedef açıya bağla
      requestAnimationFrame(() => setRot(target));
    } else {
      setRot(target);
      setTransitionMs(0);
    }
  }, [wheel.spinning, wheel.rotationDeg, spinMs]);

  const colors = useMemo(
    () => ["#f59e0b", "#38bdf8", "#a78bfa", "#34d399", "#fb7185", "#f97316", "#22d3ee", "#eab308"],
    []
  );

  const conic = options
    .map((_, i) => `${colors[i % colors.length]} ${i * slice}deg ${(i + 1) * slice}deg`)
    .join(", ");

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-6 bg-transparent text-white">
      {preview && (
        <div className="rounded-md border border-amber-400/30 bg-zinc-950/70 px-3 py-1 text-[10px] uppercase tracking-widest text-amber-300/90">
          Önizleme · !wheel spin
        </div>
      )}
      <div className="relative">
        <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1 text-2xl text-amber-300">
          ▼
        </div>
        <div
          className="relative h-64 w-64 rounded-full border-4 border-white/20 shadow-2xl md:h-80 md:w-80"
          style={{
            background: `conic-gradient(${conic})`,
            transform: `rotate(${rot}deg)`,
            transition: transitionMs > 0 ? `transform ${transitionMs}ms cubic-bezier(.15,.85,.25,1)` : "none",
          }}
        >
          {options.map((opt, i) => {
            const angle = i * slice + slice / 2;
            return (
              <div
                key={`${opt}-${i}`}
                className="absolute left-1/2 top-1/2 origin-center text-center text-[11px] font-semibold text-zinc-950 md:text-xs"
                style={{
                  transform: `rotate(${angle}deg) translateY(-105px) rotate(-${angle}deg)`,
                  width: 72,
                  marginLeft: -36,
                }}
              >
                {opt}
              </div>
            );
          })}
        </div>
      </div>
      {!wheel.spinning && (wheel.result || preview) && (
        <div className="rounded-lg border border-white/10 bg-zinc-950/75 px-5 py-2 text-lg font-semibold backdrop-blur-md">
          {wheel.result || "Çark hazır"}
        </div>
      )}
    </div>
  );
}
