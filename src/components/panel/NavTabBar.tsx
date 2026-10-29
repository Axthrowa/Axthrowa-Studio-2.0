/**
 * Sol kenar çubuğu — AxthrowA stüdyo düzeni. Bölümler çizgiyle değil boşluk ve hafif zemin farkıyla ayrılır;
 * vurgu yalnız menekşe/camgöbeği. Etkin sekme: %10 camgöbeği zemin + sol kenarda parlak dikey çizgi.
 * Sürükle-bırak sıralama ve "Menüyü düzenle" korunur.
 *
 * Normalde yalnız simgeler görünür (56px); fare çubuğa değince genişleyip
 * etiketleri açar. Genişleme düzeni kaydırmasın diye çubuk konumlandırılmıştır:
 * içerik yerinde kalır, menü üstüne açılır.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAxthrowaStore } from "../../store/useAxthrowaStore";
import { useT } from "../../i18n";
import {
  Broadcast,
  ChatCircleDots,
  Coffee,
  Keyboard,
  MonitorPlay,
  MusicNotes,
  PlayCircle,
  Robot,
  Sliders,
  SlidersHorizontal,
  SpeakerHigh,
  SquaresFour,
  StopCircle,
  type IconWeight,
} from "@phosphor-icons/react";
import { DEFAULT_TABS, reorderByDrop, type NavId, type PanelLayout } from "../../lib/panelLayout";
import { API_BASE } from "../../lib/api";

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

const TAB_ICONS: Record<string, React.ComponentType<{ className?: string; weight?: IconWeight }>> = {
  profile: SquaresFour,
  yayin: MonitorPlay,
  control: Broadcast,
  starting: PlayCircle,
  ending: StopCircle,
  brb: Coffee,
  chat: ChatCircleDots,
  bot: Robot,
  music: MusicNotes,
  sounds: SpeakerHigh,
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
  // Açılıştaki otomatik güncelleme denetimi yeni sürüm bulduysa başlıkta işaret (Ayarlar › Hakkında'dan kurulur)
  const [yeniSurum, setYeniSurum] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`${API_BASE}/api/guncelleme/durum`)
        .then((r) => r.json())
        .then((d) => setYeniSurum(d?.yeniVar ? String(d.son) : null))
        .catch(() => {});
    }, 30_000);
    return () => clearTimeout(t);
  }, []);
  const dragId = useRef<string | null>(null);
  const start = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastOver = useRef<string | null>(null);
  const [activeDrag, setActiveDrag] = useState<string | null>(null);
  const t = useT();
  // Yalnız bu iki alan değişince çizilir (OBS koptu / yayın başladı → nokta anında değişir)
  const obsBagli = useAxthrowaStore((s) => s.isObsConnected);
  const canli = useAxthrowaStore((s) => s.isLive);
  // Seçilen sekmenin simgesi yaylanarak zıplar; sayaç aynı sekmeye tekrar tıklanınca da yeniden oynatır
  const [yay, setYay] = useState<{ id: string; n: number } | null>(null);
  const sec = (id: string) => {
    setYay((y) => ({ id, n: (y?.n || 0) + 1 }));
    onSelect(id as NavId);
  };
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

  const etiket = "truncate transition-opacity duration-200 " + (open ? "opacity-100" : "opacity-0");

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
          // Opak zemin: menü içeriğin ÜSTÜNE açılır, alttaki kartlar görünmesin. Ayrım çizgiyle değil,
          // açıkken içeriğe düşen yumuşak gölgeyle.
          "absolute inset-y-0 left-0 flex flex-col justify-between overflow-hidden bg-axthrowa-dark transition-[width,box-shadow] duration-300 ease-out " +
          (open ? "w-60 shadow-[16px_0_40px_rgba(0,0,0,0.55)]" : "w-14")
        }
      >
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Marka: üstte geniş, altta menüye kadar daha geniş boşluk */}
          <div className="flex items-center gap-3 px-2.5 pb-6 pt-4">
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-axthrowa-violet to-axthrowa-cyan text-white shadow-[0_6px_20px_rgba(139,92,246,0.35)]">
              <Broadcast weight="bold" className="h-4 w-4" />
            </div>
            <div className={"min-w-0 overflow-hidden transition-opacity duration-200 " + (open ? "opacity-100" : "opacity-0")}>
              <span className="block truncate font-display text-[13px] font-extrabold leading-tight tracking-tight text-zinc-100">{brandTitle}</span>
              <p className="mt-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Stream Studio
                <span className="rounded-md bg-axthrowa-violet/15 px-1.5 py-px text-[9px] font-bold normal-case tracking-normal text-axthrowa-violet" title="Uygulama sürümü">
                  v{__YYA_SURUM__}
                </span>
                {yeniSurum && (
                  <span className="rounded-md bg-axthrowa-cyan/15 px-1.5 py-px text-[9px] font-bold normal-case tracking-normal text-axthrowa-cyan" title={`Yeni sürüm v${yeniSurum}: Ayarlar › Hakkında`}>
                    ↑ v{yeniSurum}
                  </span>
                )}
              </p>
            </div>
          </div>

          <nav className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pr-2" aria-label={t("nav.menu")}>
            {visibleTabs.map((id) => {
              const active = activeNav === id;
              const isDrag = activeDrag === id;
              const Icon = TAB_ICONS[id];
              return (
                <button
                  key={id}
                  type="button"
                  data-nav-id={id}
                  title={`${labelFor(id)} — ${dragHint}`}
                  aria-current={active ? "page" : undefined}
                  className={
                    // Sol kenar çizgisi hep var (pasifte saydam): etkinleşince içerik kaymaz
                    "group relative flex w-full select-none touch-none items-center gap-3 rounded-r-lg border-l-2 py-2.5 pl-[18px] pr-3 text-[13px] font-medium cursor-grab active:cursor-grabbing " +
                    (isDrag ? "scale-[0.97] opacity-60 ring-1 ring-axthrowa-violet/60 " : "") +
                    (active
                      ? "border-axthrowa-cyan bg-axthrowa-cyan/10 text-axthrowa-cyan shadow-[inset_8px_0_16px_-12px_rgba(6,182,212,0.9)]"
                      : "border-transparent text-zinc-400 transition-colors duration-200 hover:bg-zinc-800/50 hover:text-zinc-200")
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
                  {Icon && (
                    <span
                      key={yay?.id === id ? yay.n : "d"}
                      className={"relative inline-flex shrink-0 transform-gpu " + (yay?.id === id ? "animate-yay" : "")}
                    >
                      {id === "yayin" ? (
                        <span
                          title={t(obsBagli ? "status.obsOn" : "status.obsOff")}
                          className={
                            "absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-axthrowa-dark transition-colors duration-300 " +
                            (obsBagli ? "bg-axthrowa-cyan shadow-[0_0_6px_rgba(6,182,212,0.9)]" : "bg-zinc-600")
                          }
                        />
                      ) : null}
                      {id === "control" && canli ? (
                        <span
                          title={t("status.live")}
                          className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)] ring-2 ring-axthrowa-dark"
                        />
                      ) : null}
                      <Icon
                        weight={active ? "duotone" : "bold"}
                        className={
                          "h-[18px] w-[18px] transition-colors duration-200 " +
                          (active ? "text-axthrowa-cyan drop-shadow-[0_0_6px_rgba(6,182,212,0.6)]" : "text-zinc-500 group-hover:text-zinc-200")
                        }
                      />
                    </span>
                  )}
                  <span className={etiket}>{labelFor(id)}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Alt bölüm: çizgi yerine hafif yükseltilmiş kart zemini */}
        <div className="mx-2 mb-2 mt-4 space-y-3 rounded-xl bg-axthrowa-card/60 px-1.5 py-2">
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-xs font-medium text-zinc-400 transition-colors duration-200 hover:bg-zinc-800/50 hover:text-zinc-200"
            onClick={onToggleEdit}
            title={customizeLabel}
          >
            <SlidersHorizontal weight="bold" className={"h-4 w-4 shrink-0 " + (editLayout ? "text-axthrowa-violet" : "")} />
            <span className={etiket}>{customizeLabel}</span>
          </button>
          {editLayout ? <div className={"px-1 transition-opacity " + (open ? "opacity-100" : "opacity-0")}>{children}</div> : null}
          <div className={"flex items-center justify-between gap-2 overflow-hidden whitespace-nowrap px-2 pb-0.5 text-[11px] transition-opacity duration-200 " + (open ? "opacity-100" : "opacity-0")}>
            <span className="flex items-center gap-1.5 font-medium text-zinc-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              {statusLabel}
            </span>
            <span className="font-mono text-axthrowa-cyan/90">{statusHint}</span>
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
