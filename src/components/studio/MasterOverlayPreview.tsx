/**
 * Master Overlay önizleme — büyük 16:9 sahne, Framer Motion sürükle-bırak.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { MonitorPlay, Move } from "lucide-react";
import { cn } from "../../lib/cn";
import MasterOverlayCanvas, {
  type CanvasWidget,
} from "../overlay/MasterOverlayCanvas";
import {
  isWidgetMasterEnabled,
  type MasterScenePatch,
  type MasterWidgetRow,
} from "../../lib/widgets/masterLayout";
import { WidgetSyncProvider } from "../../lib/widgets/useWidgetSync";

export type PreviewWidget = MasterWidgetRow & {
  config: Record<string, unknown>;
};

type Props = {
  widgets: PreviewWidget[];
  liveConfigs?: Record<string, Record<string, unknown>>;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onRemove?: (id: string) => void;
  onRemoveAll?: () => void;
  onSceneChange?: (id: string, patch: MasterScenePatch) => void;
  onSceneCommit?: (id: string, patch: MasterScenePatch) => void;
  /** @deprecated */
  onLayoutChange?: (id: string, patch: MasterScenePatch) => void;
  /** @deprecated */
  onLayoutCommit?: (id: string, patch: MasterScenePatch) => void;
  checkerboard?: boolean;
  className?: string;
};

const STAGE_W = 1920;
const STAGE_H = 1080;
/** Sahne dışı sürükleme için görünür tampon (px, mantıksal) */
const OFFSTAGE_PAD = 320;

export default function MasterOverlayPreview({
  widgets,
  liveConfigs = {},
  selectedId = null,
  onSelect,
  onRemove,
  onRemoveAll,
  onSceneChange,
  onSceneCommit,
  onLayoutChange,
  onLayoutCommit,
  checkerboard = false,
  className,
}: Props) {
  const handleChange = onSceneChange ?? onLayoutChange;
  const handleCommit = onSceneCommit ?? onLayoutCommit;
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.85);

  useEffect(() => {
    const el = hostRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const apply = (width: number) => {
      if (width < 120) return;
      setScale((prev) => {
        const auto = Math.min(1, Math.max(0.55, width / STAGE_W));
        // Elle ayarlanmış zoom'u (0.85 dışı) ezme — sadece ilk/otomatik aralıkta uygula
        if (prev < 0.7 || prev > 1.05) return prev;
        return auto;
      });
    };
    apply(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      apply(entries[0]?.contentRect.width ?? el.clientWidth);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const canvasWidgets = useMemo((): CanvasWidget[] => {
    return widgets
      .map((w) => {
        const cfg = { ...w.config, ...(liveConfigs[w.id] || {}) };
        return { ...w, config: cfg };
      })
      .filter((w) => isWidgetMasterEnabled(w, w.config));
  }, [widgets, liveConfigs]);

  const pct = Math.round(scale * 100);
  const displayW = STAGE_W * scale;
  const displayH = STAGE_H * scale;

  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-panel-soft text-panel-accent">
            <MonitorPlay className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-panel-accent">
              Konum sahnesi · 1920×1080
            </p>
            <p className="flex items-center gap-1 text-[10px] text-panel-muted">
              <Move className="h-3 w-3" />
              Sınırsız sürükle · mavi köşeden ölçekle · X ile kaldır
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onRemoveAll && canvasWidgets.length > 0 ? (
            <button
              type="button"
              className="rounded-lg border border-red-400/35 bg-red-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-red-200 hover:bg-red-500/20"
              onClick={() => onRemoveAll()}
            >
              Tümünü kaldır
            </button>
          ) : null}
          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/30 p-0.5">
            <button
              type="button"
              className="rounded-md px-2 py-1 text-[11px] font-bold text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => setScale((s) => Math.max(0.45, Math.round((s - 0.05) * 100) / 100))}
              title="Küçült"
            >
              −
            </button>
            <span className="min-w-[3rem] text-center text-[10px] font-semibold uppercase tracking-wider text-panel-accent">
              %{pct}
            </span>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-[11px] font-bold text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => setScale((s) => Math.min(1.25, Math.round((s + 0.05) * 100) / 100))}
              title="Büyüt"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div
        className="w-full rounded-[1.15rem] p-2 sm:p-2.5"
        style={{
          background: "linear-gradient(145deg, #2a3344 0%, #12161f 42%, #0a0d12 100%)",
          boxShadow: "0 28px 64px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.08)",
        }}
      >
        <div
          ref={hostRef}
          className="relative w-full overflow-hidden rounded-xl border border-black/50"
          style={{
            aspectRatio: `${STAGE_W} / ${STAGE_H}`,
            background: checkerboard
              ? undefined
              : "radial-gradient(ellipse at 18% 0%, rgba(62,207,207,.14), transparent 50%), #05070b",
          }}
        >
          {checkerboard ? (
            <div
              className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"
              style={{
                backgroundColor: "#1a1f2b",
                backgroundImage:
                  "linear-gradient(45deg, #12161f 25%, transparent 25%), linear-gradient(-45deg, #12161f 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #12161f 75%), linear-gradient(-45deg, transparent 75%, #12161f 75%)",
                backgroundSize: "24px 24px",
                backgroundPosition: "0 0, 0 12px, 12px -12px, -12px 0",
              }}
            />
          ) : null}
          {/* Pad sahne içi kalsın — dışarı taşan hit-area sol ayar panelini yutmasın */}
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ touchAction: "none" }}
          >
            <div
              className="absolute"
              style={{
                left: -OFFSTAGE_PAD * scale,
                top: -OFFSTAGE_PAD * scale,
                width: displayW + OFFSTAGE_PAD * scale * 2,
                height: displayH + OFFSTAGE_PAD * scale * 2,
                padding: OFFSTAGE_PAD * scale,
              }}
            >
              <WidgetSyncProvider>
                <MasterOverlayCanvas
                  widgets={canvasWidgets}
                  isPreviewMode
                  selectedId={selectedId}
                  onSelect={onSelect}
                  onRemove={onRemove}
                  onSceneChange={handleChange}
                  onSceneCommit={handleCommit}
                  displayScale={scale}
                  editable={Boolean(handleChange)}
                />
              </WidgetSyncProvider>
            </div>
          </div>
          <div className="pointer-events-none absolute bottom-2 left-2 rounded-md border border-panel-accent/30 bg-black/60 px-2 py-0.5 font-mono text-[9px] font-semibold tracking-wide text-[#7dd3d3]">
            /overlay/master?obs=1 · 1920×1080
          </div>
        </div>
      </div>
    </div>
  );
}
