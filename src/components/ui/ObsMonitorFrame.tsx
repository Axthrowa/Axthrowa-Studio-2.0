/** OBS / stüdyo monitör mockup — canlı önizleme çerçevesi. */

import type { ReactNode } from "react";
import { MonitorPlay } from "lucide-react";
import { cn } from "../../lib/cn";

type Props = {
  children: ReactNode;
  pathLabel?: string;
  scaleLabel?: string;
  className?: string;
  /** İç sahne oranı (varsayılan 16:9) */
  aspectClass?: string;
};

export default function ObsMonitorFrame({
  children,
  pathLabel,
  scaleLabel,
  className,
  aspectClass = "aspect-video",
}: Props) {
  return (
    <div className={cn("flex h-full min-h-0 flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-panel-soft text-panel-accent">
            <MonitorPlay className="h-3.5 w-3.5" aria-hidden />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-panel-accent">
              Canlı önizleme
            </p>
            <p className="text-[10px] text-panel-muted">OBS Browser Source · anlık</p>
          </div>
        </div>
        {scaleLabel ? (
          <span className="rounded-lg border border-panel-accent/25 bg-panel-soft/80 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-panel-accent">
            {scaleLabel}
          </span>
        ) : null}
      </div>

      {/* Bezel + stand */}
      <div className="flex flex-1 flex-col items-center">
        <div
          className="relative w-full max-w-full rounded-[1.35rem] p-[10px] shadow-[0_28px_64px_rgba(0,0,0,.55)]"
          style={{
            background:
              "linear-gradient(145deg, #2a3344 0%, #12161f 42%, #0a0d12 100%)",
            boxShadow:
              "0 28px 64px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.08)",
          }}
        >
          {/* Kamera / status bar */}
          <div className="mb-2 flex items-center justify-between px-1.5">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#ff5f57]/90" />
              <span className="h-1.5 w-1.5 rounded-full bg-[#febc2e]/90" />
              <span className="h-1.5 w-1.5 rounded-full bg-[#28c840]/90" />
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-8 rounded-full bg-white/10" />
              <span className="relative flex h-2 w-2 items-center justify-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-panel-accent/40" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-panel-accent" />
              </span>
            </div>
          </div>

          <div
            className={cn(
              "relative overflow-hidden rounded-[0.85rem] border border-black/60",
              aspectClass
            )}
            style={{
              background:
                "radial-gradient(ellipse at 18% 0%, rgba(62,207,207,.16), transparent 50%), radial-gradient(ellipse at 92% 100%, rgba(255,138,91,.1), transparent 48%), #05070b",
              minHeight: 260,
            }}
          >
            {/* Checker transparency hint */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage:
                  "linear-gradient(45deg, #fff 25%, transparent 25%), linear-gradient(-45deg, #fff 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #fff 75%), linear-gradient(-45deg, transparent 75%, #fff 75%)",
                backgroundSize: "14px 14px",
                backgroundPosition: "0 0, 0 7px, 7px -7px, -7px 0",
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center p-2 sm:p-3">
              {children}
            </div>
            {pathLabel ? (
              <div className="pointer-events-none absolute bottom-2 left-2 rounded-md border border-panel-accent/30 bg-black/60 px-2 py-0.5 font-mono text-[9px] font-semibold tracking-wide text-[#7dd3d3]">
                {pathLabel}
              </div>
            ) : null}
          </div>
        </div>

        {/* Stand neck + base */}
        <div
          className="mt-0 h-3 w-10 rounded-b-md"
          style={{
            background: "linear-gradient(180deg, #1a2030, #0d1118)",
          }}
        />
        <div
          className="h-1.5 w-28 rounded-full"
          style={{
            background:
              "linear-gradient(90deg, transparent, #2a3344 20%, #3a4558 50%, #2a3344 80%, transparent)",
            boxShadow: "0 6px 16px rgba(0,0,0,.4)",
          }}
        />
      </div>
    </div>
  );
}
