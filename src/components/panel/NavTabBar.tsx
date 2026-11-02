/**
 * Sabit sol menü. Üstte iki mod: Canlı (yayın masası) ve Hazırlık (sahne, bot, bağlantı).
 * Etiketler her zaman görünür. Seçim 2 px sol çizgi.
 */

import { useRef, useState, type ReactNode } from "react";
import {
  Bot,
  Coffee,
  Keyboard,
  MessageCircle,
  Monitor,
  Music,
  Play,
  Plug,
  Radio,
  Settings,
  SlidersHorizontal,
  Square,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import { useT } from "../../i18n";
import type { MsgKey } from "../../i18n/messages";
import { olay } from "../../lib/analitik";
import { DEFAULT_TABS, reorderByDrop, type NavId, type PanelLayout } from "../../lib/panelLayout";

export type StudioModul = "canli" | "hazirlik";

export const CANLI_SEKME: string[] = ["control", "chat", "sounds", "music"];
export const HAZIRLIK_SEKME: string[] = ["starting", "ending", "brb", "bot", "profile", "yayin", "hotkeys", "settings"];

type Props = {
  visibleTabs: string[];
  activeNav: string;
  modul: StudioModul;
  onModul: (m: StudioModul) => void;
  labelFor: (id: string) => string;
  dragHint: string;
  customizeLabel: string;
  editLayout: boolean;
  onToggleEdit: () => void;
  onSelect: (id: NavId) => void;
  onReorder: (order: string[]) => void;
  layoutOrder: string[];
  brandTitle: string;
  children?: ReactNode;
};

const DRAG_PX = 8;

const TAB_ICONS: Record<string, LucideIcon> = {
  control: Radio,
  chat: MessageCircle,
  sounds: Volume2,
  music: Music,
  starting: Play,
  ending: Square,
  brb: Coffee,
  bot: Bot,
  profile: Plug,
  yayin: Monitor,
  hotkeys: Keyboard,
  settings: Settings,
};

const GRUPLAR: { modul: StudioModul; labelKey: MsgKey; ids: string[] }[] = [
  { modul: "canli", labelKey: "nav.mode.live", ids: CANLI_SEKME },
  { modul: "hazirlik", labelKey: "nav.group.scene", ids: ["starting", "ending", "brb"] },
  { modul: "hazirlik", labelKey: "nav.group.audience", ids: ["bot"] },
  { modul: "hazirlik", labelKey: "nav.group.system", ids: ["profile", "yayin", "hotkeys", "settings"] },
];

function reorderInMode(order: string[], ids: string[], dragId: string, dropId: string) {
  const set = new Set(ids);
  const groupOrder = order.filter((id) => set.has(id));
  const nextGroup = reorderByDrop(groupOrder, dragId, dropId);
  let i = 0;
  return order.map((id) => (set.has(id) ? nextGroup[i++] : id));
}

export default function NavTabBar({
  visibleTabs,
  activeNav,
  modul,
  onModul,
  labelFor,
  dragHint,
  customizeLabel,
  editLayout,
  onToggleEdit,
  onSelect,
  onReorder,
  layoutOrder,
  brandTitle,
  children,
}: Props) {
  const dragId = useRef<string | null>(null);
  const start = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastOver = useRef<string | null>(null);
  const [activeDrag, setActiveDrag] = useState<string | null>(null);
  const t = useT();
  const visible = new Set(visibleTabs);
  const modeIds = modul === "canli" ? CANLI_SEKME : HAZIRLIK_SEKME;

  const fullOrder = () => (layoutOrder.length ? [...layoutOrder] : DEFAULT_TABS.map((tab) => tab.id));

  const endDrag = () => {
    dragId.current = null;
    dragging.current = false;
    lastOver.current = null;
    setActiveDrag(null);
  };

  const sec = (id: string) => {
    olay("sekme_acildi", { sekme: id });
    onSelect(id as NavId);
  };

  const ad = (id: string) => labelFor(id);

  return (
    <aside className="yya-nav-rail flex h-full w-[200px] shrink-0 flex-col border-r border-white/10 bg-panel-bg">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-white/10 px-3">
        <Radio className="h-4 w-4 shrink-0 text-white/80" strokeWidth={1.75} />
        <span className="truncate text-[13px] font-medium text-white">{brandTitle}</span>
      </div>

      <div className="grid grid-cols-2 gap-1 border-b border-white/10 p-2" role="tablist" aria-label={t("nav.menu")}>
        {(["canli", "hazirlik"] as const).map((m) => {
          const secili = modul === m;
          return (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={secili}
              className={
                "h-7 rounded text-[12px] font-medium transition-colors duration-150 " +
                (secili ? "bg-white/[0.08] text-white" : "text-white/70 hover:bg-white/[0.04] hover:text-white")
              }
              onClick={() => onModul(m)}
            >
              {t(m === "canli" ? "nav.mode.live" : "nav.mode.prep")}
            </button>
          );
        })}
      </div>

      <nav className="custom-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto py-1" aria-label={t("nav.menu")}>
        {GRUPLAR.filter((g) => g.modul === modul).map((group) => {
          const order = fullOrder();
          const ids = [
            ...order.filter((id) => group.ids.includes(id) && visible.has(id)),
            ...group.ids.filter((id) => visible.has(id) && !order.includes(id)),
          ];
          if (!ids.length) return null;
          return (
            <div key={group.labelKey} className="mb-1">
              {modul === "hazirlik" ? (
                <p className="px-3 pb-1 pt-3 text-[11px] font-medium text-white/55">{t(group.labelKey)}</p>
              ) : null}
              {ids.map((id) => {
                const active = activeNav === id;
                const Icon = TAB_ICONS[id];
                return (
                  <button
                    key={id}
                    type="button"
                    data-nav-id={id}
                    title={`${ad(id)} — ${dragHint}`}
                    aria-current={active ? "page" : undefined}
                    className={
                      "flex h-8 w-full select-none touch-none items-center gap-2 border-l-2 px-3 text-[13px] font-medium cursor-grab " +
                      (activeDrag === id ? "opacity-60 " : "") +
                      (active
                        ? "border-panel-accent bg-white/[0.06] text-white"
                        : "border-transparent text-white/70 transition-colors duration-150 hover:bg-white/[0.04] hover:text-white")
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
                      if (!overId || overId === dragId.current || !modeIds.includes(overId)) return;
                      if (overId === lastOver.current) return;
                      lastOver.current = overId;
                      onReorder(reorderInMode(fullOrder(), modeIds, dragId.current, overId));
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
                      if (!wasDrag && idNow === id) sec(id);
                    }}
                    onPointerCancel={() => endDrag()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        sec(id);
                      }
                    }}
                  >
                    {Icon ? <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} /> : null}
                    <span className="truncate">{ad(id)}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-2">
        <button
          type="button"
          className="flex h-8 w-full items-center gap-2 px-2 text-[12px] font-medium text-white/70 transition-colors duration-150 hover:bg-white/[0.04] hover:text-white"
          onClick={onToggleEdit}
          title={customizeLabel}
        >
          <SlidersHorizontal className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span className="truncate">{customizeLabel}</span>
        </button>
        {editLayout ? children : null}
      </div>
    </aside>
  );
}

export function applyTabOrder(prev: PanelLayout, order: string[]): PanelLayout {
  return { ...prev, tabs: { ...prev.tabs, order } };
}
