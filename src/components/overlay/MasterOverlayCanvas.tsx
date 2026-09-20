/**
 * Master Overlay canvas — gelişmiş sahne editörü (sınırsız sürükle + resize/scale).
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as REPointerEvent,
} from "react";
import { motion, useMotionValue } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";
import { accentForKind } from "../../lib/widgets/catalog";
import {
  clampMasterLayout,
  configForMasterInner,
  isWidgetMasterEnabled,
  readMasterLayout,
  type MasterScenePatch,
  type MasterWidgetRow,
} from "../../lib/widgets/masterLayout";
import { renderPreviewAwareWidget } from "../../lib/widgets/previewContent";
import { renderWidgetByKind } from "../../lib/widgets/renderWidgetByKind";

export type CanvasWidget = MasterWidgetRow & {
  config: Record<string, unknown>;
};

export type MasterOverlayCanvasProps = {
  widgets: CanvasWidget[];
  isPreviewMode?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onRemove?: (id: string) => void;
  onSceneChange?: (id: string, patch: MasterScenePatch) => void;
  onSceneCommit?: (id: string, patch: MasterScenePatch) => void;
  /** @deprecated use onSceneChange */
  onLayoutChange?: (id: string, patch: MasterScenePatch) => void;
  /** @deprecated use onSceneCommit */
  onLayoutCommit?: (id: string, patch: MasterScenePatch) => void;
  displayScale?: number;
  editable?: boolean;
  className?: string;
  stageWidth?: number;
  stageHeight?: number;
};

const STAGE_W = 1920;
const STAGE_H = 1080;
const FOCUS_Z = 9999;
const FOCUS_RING = "#38bdf8";

/** Önizleme: sahne dışına taşıma — geniş drag alanı */
const FREE_DRAG = {
  left: -3000,
  top: -3000,
  right: 3000,
  bottom: 3000,
};

type ResizeState = {
  id: string;
  startClientX: number;
  startClientY: number;
  originX: number;
  originY: number;
  originW: number;
  originH: number;
  originScale: number;
  lastPatch: MasterScenePatch | null;
};

function clampScale(v: number) {
  return Math.min(3, Math.max(0.5, Math.round(v * 100) / 100));
}

function DraggableWidgetSlot({
  w,
  scale,
  selected,
  focused,
  isPreviewMode,
  editable,
  onSelect,
  onRemove,
  onSceneChange,
  onSceneCommit,
  onFocus,
  onBlur,
}: {
  w: CanvasWidget;
  scale: number;
  selected: boolean;
  focused: boolean;
  isPreviewMode: boolean;
  editable: boolean;
  onSelect?: (id: string) => void;
  onRemove?: (id: string) => void;
  onSceneChange?: (id: string, patch: MasterScenePatch) => void;
  onSceneCommit?: (id: string, patch: MasterScenePatch) => void;
  onFocus: () => void;
  onBlur: () => void;
}) {
  const layout = readMasterLayout(w.config);
  const cfgScale = Number(w.config.scale ?? 1);
  const rot = Number(w.config.rotateDeg ?? 0);
  const baseZ = Number(w.config.z_index ?? 10);
  const accent = accentForKind(w.kind);
  const editorMode = isPreviewMode && editable;

  const x = useMotionValue(layout.x * scale);
  const y = useMotionValue(layout.y * scale);

  useEffect(() => {
    x.set(layout.x * scale);
    y.set(layout.y * scale);
  }, [layout.x, layout.y, scale, x, y]);

  const displayW = layout.w * scale;
  const displayH = layout.h * scale;

  const layoutOpts = useMemo(
    () => ({ freePosition: editorMode, freeSize: editorMode }),
    [editorMode]
  );

  const emitScene = useCallback(
    (commit: boolean, extra?: Partial<MasterScenePatch>) => {
      const patch: MasterScenePatch = {
        ...clampMasterLayout(
          x.get() / scale,
          y.get() / scale,
          layout.w,
          layout.h,
          STAGE_W,
          STAGE_H,
          layoutOpts
        ),
        scale: cfgScale,
        ...extra,
      };
      onSceneChange?.(w.id, patch);
      if (commit) onSceneCommit?.(w.id, patch);
    },
    [w.id, x, y, scale, layout.w, layout.h, layoutOpts, cfgScale, onSceneChange, onSceneCommit]
  );

  const innerCfg = {
    ...configForMasterInner(w.config),
    _widgetName: w.name || w.kind,
  };

  const active = selected || focused;

  return (
    <motion.div
      className={cn(
        "absolute",
        editorMode && (active ? "cursor-grab active:cursor-grabbing" : "cursor-pointer")
      )}
      data-master-slot="1"
      data-widget-id={w.id}
      data-widget-kind={w.kind}
      data-selected={selected ? "1" : "0"}
      drag={editorMode}
      dragMomentum={false}
      dragElastic={0}
      dragConstraints={editorMode ? FREE_DRAG : false}
      style={{
        x,
        y,
        width: displayW,
        height: displayH,
        zIndex: active ? FOCUS_Z : baseZ,
        outline: active ? `2px solid ${FOCUS_RING}` : `1px solid ${accent}44`,
        outlineOffset: active ? 2 : 1,
        boxShadow: active
          ? `0 0 0 1px rgba(0,0,0,.45), 0 0 0 3px ${FOCUS_RING}33, 0 0 28px ${FOCUS_RING}44`
          : undefined,
        pointerEvents: editorMode ? "auto" : "none",
        userSelect: "none",
        touchAction: editorMode ? "none" : undefined,
        overflow: "visible",
      }}
      onPointerDown={(ev) => {
        ev.stopPropagation();
        onSelect?.(w.id);
        onFocus();
      }}
      onDragStart={() => {
        onSelect?.(w.id);
        onFocus();
      }}
      onDrag={() => emitScene(false)}
      onDragEnd={() => {
        emitScene(true);
        onBlur();
      }}
    >
      <div
        className="pointer-events-none absolute left-0 top-0 z-20 flex max-w-full items-center gap-1.5 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-pure-white"
        style={{
          background: active
            ? `linear-gradient(90deg, ${FOCUS_RING}dd, transparent)`
            : `linear-gradient(90deg, ${accent}dd, transparent)`,
        }}
      >
        <span className="truncate">{w.name || w.kind}</span>
        <span className="shrink-0 opacity-70">
          {layout.x},{layout.y} · ×{cfgScale.toFixed(2)}
        </span>
      </div>
      {onRemove ? (
        <button
          type="button"
          className="absolute right-1 top-1 z-40 inline-flex h-7 w-7 items-center justify-center rounded-md border border-pure-white/20 bg-black/70 text-pure-white/90 shadow-lg hover:bg-red-600/90 hover:text-pure-white"
          title="Önizlemeden kaldır"
          aria-label={`${w.name || w.kind} kaldır`}
          onPointerDown={(ev) => {
            ev.preventDefault();
            ev.stopPropagation();
          }}
          onClick={(ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            onRemove(w.id);
          }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
      <div
        className={cn(
          "pointer-events-none h-full w-full origin-top-left rounded-sm",
          isPreviewMode ? "overflow-visible" : "overflow-hidden"
        )}
        style={{
          transform:
            cfgScale !== 1 || rot ? `scale(${cfgScale}) rotate(${rot}deg)` : undefined,
        }}
      >
        {renderPreviewAwareWidget(w.kind, innerCfg, !!isPreviewMode, renderWidgetByKind)}
      </div>
      {editorMode && selected ? (
        <ScaleResizeHandle
          widget={w}
          displayScale={scale}
          layoutOpts={layoutOpts}
          onSceneChange={onSceneChange}
          onSceneCommit={onSceneCommit}
          onFocus={onFocus}
        />
      ) : null}
    </motion.div>
  );
}

function ScaleResizeHandle({
  widget,
  displayScale,
  layoutOpts,
  onSceneChange,
  onSceneCommit,
  onFocus,
}: {
  widget: CanvasWidget;
  displayScale: number;
  layoutOpts: { freePosition?: boolean; freeSize?: boolean };
  onSceneChange?: (id: string, patch: MasterScenePatch) => void;
  onSceneCommit?: (id: string, patch: MasterScenePatch) => void;
  onFocus: () => void;
}) {
  const resizeRef = useRef<ResizeState | null>(null);

  const computePatch = useCallback(
    (clientX: number, clientY: number, state: ResizeState): MasterScenePatch => {
      const s = displayScale || 1;
      const dx = (clientX - state.startClientX) / s;
      const dy = (clientY - state.startClientY) / s;
      const delta = (dx + dy) / 2;
      const base = Math.max(state.originW, state.originH, 120);
      const factor = Math.max(0.35, 1 + delta / base);
      const nextScale = clampScale(state.originScale * factor);
      const scaleRatio = nextScale / state.originScale;
      const layout = clampMasterLayout(
        state.originX,
        state.originY,
        state.originW * scaleRatio,
        state.originH * scaleRatio,
        STAGE_W,
        STAGE_H,
        layoutOpts
      );
      return { ...layout, scale: nextScale };
    },
    [displayScale, layoutOpts]
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const state = resizeRef.current;
      if (!state || !onSceneChange) return;
      const patch = computePatch(e.clientX, e.clientY, state);
      state.lastPatch = patch;
      onSceneChange(state.id, patch);
    };
    const onUp = (e: PointerEvent) => {
      const state = resizeRef.current;
      if (!state) return;
      resizeRef.current = null;
      const patch = state.lastPatch || computePatch(e.clientX, e.clientY, state);
      onSceneChange?.(state.id, patch);
      onSceneCommit?.(state.id, patch);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [computePatch, onSceneChange, onSceneCommit]);

  const beginResize = (e: REPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onFocus();
    const layout = readMasterLayout(widget.config);
    resizeRef.current = {
      id: widget.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      originX: layout.x,
      originY: layout.y,
      originW: layout.w,
      originH: layout.h,
      originScale: Number(widget.config.scale ?? 1),
      lastPatch: null,
    };
  };

  return (
    <div
      className="absolute -bottom-2 -right-2 z-50 flex h-5 w-5 cursor-se-resize items-center justify-center rounded-full border-2 border-pure-white bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,.65)] touch-none sm:h-6 sm:w-6"
      title="Boyutlandır / ölçekle"
      onPointerDown={beginResize}
    />
  );
}

export default function MasterOverlayCanvas({
  widgets,
  isPreviewMode = false,
  selectedId = null,
  onSelect,
  onRemove,
  onSceneChange,
  onSceneCommit,
  onLayoutChange,
  onLayoutCommit,
  displayScale = 1,
  editable: editableProp,
  className,
  stageWidth = STAGE_W,
  stageHeight = STAGE_H,
}: MasterOverlayCanvasProps) {
  const editable = editableProp ?? Boolean(onSceneChange || onLayoutChange);
  const handleChange = onSceneChange ?? onLayoutChange;
  const handleCommit = onSceneCommit ?? onLayoutCommit;
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const enabled = useMemo(() => {
    return widgets
      .filter((w) => isWidgetMasterEnabled(w, w.config))
      .sort(
        (a, b) =>
          Number(a.config.z_index ?? 10) - Number(b.config.z_index ?? 10) ||
          (a.sort_order ?? 0) - (b.sort_order ?? 0)
      );
  }, [widgets]);

  const scale = displayScale;
  const displayW = stageWidth * scale;
  const displayH = stageHeight * scale;

  return (
    <div
      className={cn("relative bg-transparent", isPreviewMode && "overflow-visible", className)}
      data-master-overlay={isPreviewMode ? "preview" : "live"}
      style={{
        width: displayW,
        height: displayH,
        overflow: isPreviewMode ? "visible" : "hidden",
      }}
      onPointerDown={() => setFocusedId(null)}
    >
      {isPreviewMode ? (
        <div
          className="pointer-events-none absolute inset-0 rounded-sm border border-sky-400/25"
          aria-hidden
        />
      ) : null}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: `${40 * scale}px ${40 * scale}px`,
        }}
      />
      {enabled.map((w) => (
        <DraggableWidgetSlot
          key={w.id}
          w={w}
          scale={scale}
          selected={selectedId === w.id}
          focused={focusedId === w.id}
          isPreviewMode={isPreviewMode}
          editable={editable}
          onSelect={onSelect}
          onRemove={onRemove}
          onSceneChange={handleChange}
          onSceneCommit={handleCommit}
          onFocus={() => setFocusedId(w.id)}
          onBlur={() => setFocusedId(null)}
        />
      ))}
      {enabled.length === 0 && isPreviewMode ? (
        <div className="flex h-full w-full items-center justify-center">
          <p className="font-display text-2xl text-pure-white/25 sm:text-3xl">
            Aktif widget yok — listeden aç
          </p>
        </div>
      ) : null}
    </div>
  );
}
