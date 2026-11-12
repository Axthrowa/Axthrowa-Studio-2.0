/** OBS The Cup — /glass (canvas dolum) */

import { useEffect, useRef } from "react";
import { useObsKeepalive } from "../../lib/obsKeepalive";
import { useOverlayBotConfig } from "../../lib/sohbetBot/useOverlayWidgetEvents";
import { useIsWidgetPreview } from "../../lib/sohbetBot/widgetPreview";

export default function CupPage() {
  useObsKeepalive();
  const preview = useIsWidgetPreview();
  const cfg = useOverlayBotConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const cup = cfg.cup || {
    current: 0,
    target: 100,
    label: "Kupa",
    color: "#f59e0b",
    enabled: true,
    minBits: 1,
    minKicks: 1,
  };
  const current = preview && cup.current <= 0 ? Math.round(cup.target * 0.45) : cup.current;
  const pct = Math.min(1, current / Math.max(1, cup.target));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = (canvas.width = 280);
    const h = (canvas.height = 360);
    let raf = 0;
    let t0 = performance.now();

    const draw = (now: number) => {
      const wave = Math.sin((now - t0) / 400) * 4;
      ctx.clearRect(0, 0, w, h);

      ctx.strokeStyle = "rgba(255,255,255,.35)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(70, 40);
      ctx.lineTo(50, 300);
      ctx.quadraticCurveTo(140, 340, 230, 300);
      ctx.lineTo(210, 40);
      ctx.closePath();
      ctx.stroke();

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(72, 42);
      ctx.lineTo(52, 298);
      ctx.quadraticCurveTo(140, 332, 228, 298);
      ctx.lineTo(208, 42);
      ctx.closePath();
      ctx.clip();

      const fillH = 250 * pct;
      const y = 300 - fillH + wave;
      ctx.fillStyle = cup.color || "#f59e0b";
      ctx.globalAlpha = 0.85;
      ctx.fillRect(40, y, 200, 320);
      ctx.restore();

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [pct, cup.color]);

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-end gap-2 bg-transparent p-4 text-white">
      {preview && (
        <div className="text-[10px] uppercase tracking-widest text-amber-300/85">Önizleme</div>
      )}
      <canvas ref={canvasRef} className="max-h-[70vh]" />
      <div className="rounded-lg border border-white/10 bg-zinc-950/75 px-4 py-2 text-center backdrop-blur-md">
        <div className="text-sm font-semibold">{cup.label || "Kupa"}</div>
        <div className="text-xs text-white/70">
          {current} / {cup.target}
        </div>
        <div className="mt-1 text-[10px] text-white/50">
          min bits {cup.minBits ?? 1} · min kicks {cup.minKicks ?? 1}
        </div>
      </div>
    </div>
  );
}
