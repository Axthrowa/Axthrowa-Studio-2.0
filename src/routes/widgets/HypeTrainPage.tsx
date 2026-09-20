/** OBS Hype Train progress */

import { useObsKeepalive } from "../../lib/obsKeepalive";
import { useOverlayBotConfig } from "../../lib/smartBot/useOverlayWidgetEvents";
import { useIsWidgetPreview } from "../../lib/smartBot/widgetPreview";

export default function HypeTrainPage() {
  useObsKeepalive();
  const preview = useIsWidgetPreview();
  const cfg = useOverlayBotConfig();
  const live = cfg.hypeTrain;
  const hype =
    live.active || !preview
      ? live
      : { active: true, progress: 35, level: 2, goal: 100, conductor: "DemoKondüktör" };

  if (!hype.active && !preview) {
    return (
      <div className="grid h-screen place-items-center bg-transparent p-4 text-white">
        <div className="rounded-xl border border-white/15 bg-zinc-950/80 px-5 py-3 text-sm">
          Hype treni yok — !hype start veya panelden başlat
        </div>
      </div>
    );
  }

  const pct = Math.min(100, Math.round((hype.progress / Math.max(1, hype.goal)) * 100));
  const conductor = hype.conductor || "";

  return (
    <div className="flex h-screen w-screen items-end justify-center bg-transparent p-4 text-white">
      <div className="w-[min(96vw,560px)] rounded-xl border border-fuchsia-400/20 bg-zinc-950/75 px-5 py-4 backdrop-blur-md">
        {!live.active && preview && (
          <div className="mb-2 text-[10px] uppercase tracking-widest text-amber-300/80">Önizleme</div>
        )}
        <div className="mb-2 flex items-end justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-fuchsia-300/85">Hype Treni</div>
            <div className="text-lg font-semibold">Seviye {hype.level}</div>
            {conductor && (
              <div className="mt-0.5 text-xs text-white/60">
                Kondüktör: <span className="text-fuchsia-200/90">{conductor}</span>
              </div>
            )}
          </div>
          <div className="text-right text-sm tabular-nums text-white/85">
            {hype.progress} / {hype.goal}
            <span className="ml-2 text-white/50">{pct}%</span>
          </div>
        </div>
        <div className="h-3.5 overflow-hidden rounded-full bg-black/50 ring-1 ring-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-amber-400 transition-[width] duration-700 ease-out"
            style={{ width: `${pct}%`, boxShadow: "0 0 20px rgba(232,121,249,.45)" }}
          />
        </div>
      </div>
    </div>
  );
}
