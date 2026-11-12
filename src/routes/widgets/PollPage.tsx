/** OBS Poll / Prediction overlay */

import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useObsKeepalive } from "../../lib/obsKeepalive";
import { useOverlayBotConfig } from "../../lib/sohbetBot/useOverlayWidgetEvents";
import { useIsWidgetPreview } from "../../lib/sohbetBot/widgetPreview";

export default function PollPage() {
  useObsKeepalive();
  const preview = useIsWidgetPreview();
  const [params] = useSearchParams();
  const mode = params.get("mode") === "prediction" ? "prediction" : "poll";
  const cfg = useOverlayBotConfig();

  const view = useMemo(() => {
    if (mode === "prediction") {
      const p = cfg.prediction;
      if (!p.active && !preview) return null;
      const pots = p.active ? p.pots : [42, 58];
      const opts = p.active ? p.options : ["Evet", "Hayır"];
      const q = p.active ? p.question : "Örnek tahmin: Bugün rekor kırılır mı?";
      const total = pots[0] + pots[1] || 1;
      return {
        title: q,
        rows: [
          { label: opts[0], pct: Math.round((pots[0] / total) * 100), val: pots[0] },
          { label: opts[1], pct: Math.round((pots[1] / total) * 100), val: pots[1] },
        ],
        demo: !p.active,
      };
    }
    const p = cfg.poll;
    if (!p.active && !preview) return null;
    const options = p.active && p.options.length ? p.options : ["A", "B", "C"];
    const question = p.active ? p.question : "Örnek anket: Bugün ne oynayalım?";
    const counts = p.active
      ? options.map((_, i) => Object.values(p.votes).filter((v) => v === i).length)
      : [12, 8, 5];
    const total = counts.reduce((a, b) => a + b, 0) || 1;
    return {
      title: question,
      rows: options.map((label, i) => ({
        label,
        pct: Math.round((counts[i] / total) * 100),
        val: counts[i],
      })),
      demo: !p.active,
    };
  }, [cfg, mode, preview]);

  if (!view) {
    return (
      <div className="grid h-screen place-items-center bg-transparent p-4 text-white">
        <div className="rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-zinc-950/90 to-cyan-950/30 px-6 py-4 text-sm text-white/80 shadow-[0_0_28px_rgba(62,207,207,0.12)]">
          Anket yok — panelden başlat veya Test et
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen items-end justify-center bg-transparent p-4 text-white">
      <div className="w-[min(96vw,520px)] overflow-hidden rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-zinc-950/88 via-zinc-900/85 to-cyan-950/35 px-5 py-4 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md">
        <div className="mb-3 h-0.5 w-full rounded-full bg-gradient-to-r from-cyan-400/80 via-emerald-400/50 to-transparent" />
        {view.demo && (
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-amber-300/85">
            Önizleme
          </div>
        )}
        <div className="mb-3 text-base font-semibold tracking-tight">{view.title}</div>
        <div className="space-y-2.5">
          {view.rows.map((r) => (
            <div key={r.label}>
              <div className="mb-1 flex justify-between text-xs text-white/75">
                <span className="font-medium">{r.label}</span>
                <span className="tabular-nums">
                  {r.val} · {r.pct}%
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-black/55 ring-1 ring-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-[width] duration-500"
                  style={{
                    width: `${r.pct}%`,
                    boxShadow: "0 0 16px rgba(62,207,207,0.45)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
