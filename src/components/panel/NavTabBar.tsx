/**
 * Sol kenar çubuğu — StreamAxT stüdyo düzeni (logo başlığı, gradyan etkin sekme,
 * durum altlığı). Sürükle-bırak sıralama ve "Menüyü düzenle" korunur.
 *
 * Normalde yalnız simgeler görünür (56px); fare çubuğa değince genişleyip
 * etiketleri açar. Genişleme düzeni kaydırmasın diye çubuk konumlandırılmıştır:
 * içerik yerinde kalır, menü üstüne açılır. Saf CSS (`group-hover` /
 * `group-focus-within`) — klavyeyle gezerken de açık kalır.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  PlayCircle,
  StopCircle,
  Coffee,
  MessageSquare,
  Bot,
  Radio,
  Music,
  Volume2,
  Keyboard,
  Sliders,
  SlidersHorizontal,
  MonitorPlay,
} from "lucide-react";
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
  brandTitle: string;
  statusLabel: string;
  statusHint: string;
  children?: ReactNode;
};

const DRAG_PX = 8;
/** Fare çubuktan çıkınca kapanma gecikmesi — hemen kapanması rahatsız ediyordu. */
const CLOSE_DELAY_MS = 450;

const TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  profile: LayoutDashboard,
  yayin: MonitorPlay,
  control: Radio,
  starting: PlayCircle,
  ending: StopCircle,
  brb: Coffee,
  chat: MessageSquare,
  bot: Bot,
  music: Music,
  sounds: Volume2,
  hotkeys: Keyboard,
  settings: Sliders,
};

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
  brandTitle,
  statusLabel,
  statusHint,
  children,
}: Props) {
  const dragId = useRef<string | null>(null);
  const start = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastOver = useRef<string | null>(null);
  const [activeDrag, setActiveDrag] = useState<string | null>(null);
  // Açık/kapalı durumu JS'te: saf CSS :hover fare kenardan çıkar çıkmaz
  // kapatıyordu ve menü "çok çabuk" kapanıyordu.
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);
  const cancelClose = () => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = undefined;
    }
  };
  useEffect(() => cancelClose, []);

  const fullOrder = () =>
    layoutOrder.length ? [...layoutOrder] : DEFAULT_TABS.map((t) => t.id);

  const endDrag = () => {
    dragId.current = null;
    dragging.current = false;
    lastOver.current = null;
    setActiveDrag(null);
  };

  return (
    <div
      className="yya-nav-rail relative z-[80] w-14 shrink-0"
      onPointerEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onPointerLeave={() => {
        cancelClose();
        closeTimer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
      }}
      onFocusCapture={() => {
        cancelClose();
        setOpen(true);
      }}
    >
    <aside
      className={
        "absolute inset-y-0 left-0 flex flex-col justify-between overflow-hidden border-r border-white/[0.07] shadow-[8px_0_24px_rgba(0,0,0,0.45)] transition-[width] duration-200 ease-out " +
        (open ? "w-56" : "w-14")
      }
      // Menü içeriğin ÜSTÜNE açılıyor; yarı saydam zeminde alttaki kartlar
      // görünüp yazıları okunmaz yapıyordu (özellikle alt kısımda). Zemin opak.
      style={{ background: "var(--panel-elevated)" }}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-white/[0.06] p-3">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 via-teal-400 to-emerald-400 text-[#022026] shadow-lg shadow-cyan-500/25">
            <Radio className="h-4 w-4" />
          </div>
          <div className={"min-w-0 overflow-hidden transition-opacity duration-150 " + (open ? "opacity-100" : "opacity-0")}>
            <span className="block truncate font-display text-[13px] font-extrabold leading-tight tracking-tight text-white">{brandTitle}</span>
            <p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-cyan-400/90">
              Stream Studio
              <span className="rounded-full border border-cyan-400/40 bg-cyan-500/20 px-1.5 text-[9px] font-black text-cyan-300">PRO</span>
            </p>
          </div>
        </div>
        <nav className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2" aria-label="Ana menü">
      {visibleTabs.map((id, i) => {
        const active = activeNav === id;
        const isDrag = activeDrag === id;
        const Icon = TAB_ICONS[id];
        return (
          <button
            key={id}
            type="button"
            data-nav-id={id}
            title={`${labelFor(id)} — ${dragHint}`}
            className={
              "group relative flex w-full items-center gap-3 rounded px-2.5 py-2 text-xs font-semibold transition-colors duration-150 select-none touch-none " +
              (isDrag ? "opacity-60 ring-2 ring-panel-accent scale-95 " : "") +
              (active
                ? "bg-panel-cta text-[color:var(--panel-cta-ink)]"
                : "text-white/75 hover:bg-white/[0.06] hover:text-white") +
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
            {Icon && (
              <Icon
                className={`h-4 w-4 shrink-0 transition-colors ${
                  active ? "text-[color:var(--panel-cta-ink)]" : "text-white/60 group-hover:text-white"
                }`}
              />
            )}
            <span className={"truncate transition-opacity duration-150 " + (open ? "opacity-100" : "opacity-0")}>
              {labelFor(id)}
            </span>
          </button>
        );
      })}
        </nav>
      </div>
      <div className="space-y-2 border-t border-white/[0.06] bg-black/20 p-2 md:p-3">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-xs font-semibold text-white/75 transition-all hover:border-white/[0.18] hover:bg-white/[0.08] hover:text-white"
          onClick={onToggleEdit}
          title={customizeLabel}
        >
          <SlidersHorizontal className="h-4 w-4 shrink-0" />
          <span className={"truncate transition-opacity duration-150 " + (open ? "opacity-100" : "opacity-0")}>
            {customizeLabel}
          </span>
        </button>
        {editLayout ? (
          <div className={"transition-opacity " + (open ? "opacity-100" : "opacity-0")}>
            {children}
          </div>
        ) : null}
        <div className={"flex items-center justify-between gap-2 overflow-hidden whitespace-nowrap text-[11px] text-white/60 transition-opacity duration-150 " + (open ? "opacity-100" : "opacity-0")}>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            {statusLabel}
          </span>
          <span className="font-mono text-cyan-300">{statusHint}</span>
        </div>
      </div>
    </aside>
    </div>
  );
}

/** PanelPage setLayout için */
export function applyTabOrder(prev: PanelLayout, order: string[]): PanelLayout {
  return { ...prev, tabs: { ...prev.tabs, order } };
}
