/**
 * Üst sekme çubuğu — Botaxt tarzı yatay nav, özgün Night Signal tonları.
 */

import { useRef, useState, type ReactNode } from "react";
import { DEFAULT_TABS, reorderByDrop, type NavId, type PanelLayout } from "../../lib/panelLayout";

type Props = {
  visibleTabs: string[];
  activeNav: string;
  labelFor: (id: string) => string;
  dragHint: string;
  customizeLabel: string;
  editLayout: boolean;
  onToggleEdit: () => void;
  onSelect: (id: NavId) => void;
  onReorder: (order: string[]) => void;
  layoutOrder: string[];
  children?: ReactNode;
};

const DRAG_PX = 8;

export default function NavTabBar({
  visibleTabs,
  activeNav,
  labelFor,
  dragHint,
  customizeLabel,
  editLayout,
  onToggleEdit,
  onSelect,
  onReorder,
  layoutOrder,
  children,
}: Props) {
  const dragId = useRef<string | null>(null);
  const start = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastOver = useRef<string | null>(null);
  const [activeDrag, setActiveDrag] = useState<string | null>(null);

  const fullOrder = () =>
    layoutOrder.length ? [...layoutOrder] : DEFAULT_TABS.map((t) => t.id);

  const endDrag = () => {
    dragId.current = null;
    dragging.current = false;
    lastOver.current = null;
    setActiveDrag(null);
  };

  return (
    <nav className="relative z-[80] mx-4 mt-3 flex flex-wrap items-center gap-1.5 overflow-visible rounded-2xl bg-[color:var(--panel-glass)] px-2.5 py-2">
      {visibleTabs.map((id, i) => {
        const active = activeNav === id;
        const isDrag = activeDrag === id;
        return (
          <button
            key={id}
            type="button"
            data-nav-id={id}
            title={dragHint}
            style={{ animationDelay: `${i * 30}ms` }}
            className={
              "yya-pill animate-nav-in select-none touch-none " +
              (isDrag ? "opacity-60 ring-2 ring-panel-accent " : "") +
              (active
                ? "bg-panel-soft text-panel-accent ring-1 ring-panel-accent/40"
                : "bg-transparent text-panel-muted hover:bg-white/[0.04] hover:text-white") +
              " cursor-grab active:cursor-grabbing"
            }
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              dragId.current = id;
              dragging.current = false;
              lastOver.current = null;
              start.current = { x: e.clientX, y: e.clientY };
              try {
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              } catch {
                /* */
              }
            }}
            onPointerMove={(e) => {
              if (!dragId.current) return;
              const dx = e.clientX - start.current.x;
              const dy = e.clientY - start.current.y;
              if (!dragging.current) {
                if (dx * dx + dy * dy < DRAG_PX * DRAG_PX) return;
                dragging.current = true;
                setActiveDrag(dragId.current);
              }
              const el = document.elementFromPoint(e.clientX, e.clientY);
              const tab = el?.closest("[data-nav-id]") as HTMLElement | null;
              const overId = tab?.dataset.navId;
              if (!overId || overId === dragId.current) return;
              if (overId === lastOver.current) return;
              lastOver.current = overId;
              const next = reorderByDrop(fullOrder(), dragId.current, overId);
              onReorder(next);
            }}
            onPointerUp={(e) => {
              const idNow = dragId.current;
              const wasDrag = dragging.current;
              try {
                (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
              } catch {
                /* */
              }
              endDrag();
              if (!wasDrag && idNow === id) onSelect(id as NavId);
            }}
            onPointerCancel={() => endDrag()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(id as NavId);
              }
            }}
          >
            {labelFor(id)}
          </button>
        );
      })}
      <button
        type="button"
        className="yya-pill ml-auto bg-white/[0.05] text-panel-muted hover:text-white"
        onClick={onToggleEdit}
      >
        {customizeLabel}
      </button>
      {editLayout ? children : null}
    </nav>
  );
}

/** PanelPage setLayout için */
export function applyTabOrder(prev: PanelLayout, order: string[]): PanelLayout {
  return { ...prev, tabs: { ...prev.tabs, order } };
}
