/**
 * Sol menü: yayın akışına göre altı başlık (`lib/anaMenu.ts`). Birden çok sayfası olan başlık açıkken
 * sayfaları altında görünür. Etiketler her zaman görünür, seçim 2 px sol çizgi.
 */

import type { ReactNode } from "react";
import { BarChart3, Bot, Cast, CheckCircle2, Clapperboard, Coffee, Flag, Gift, Keyboard, Layers, MessageCircle, MessagesSquare, Monitor, Music, Play, Radio, Settings, Settings2, SlidersHorizontal, Target, Volume2, type LucideIcon } from "lucide-react";
import { useT } from "../../i18n";
import { olay } from "../../lib/analitik";
import { ANA_MENU, menuGrubuBul, sayfaAcikMi, type MenuGrubuId, type MenuSayfasi } from "../../lib/anaMenu";

type Props = {
  visibleTabs: string[];
  activeNav: string;
  botSayfa?: string;
  labelFor: (s: MenuSayfasi) => string;
  customizeLabel: string;
  editLayout: boolean;
  onToggleEdit: () => void;
  onSelect: (s: MenuSayfasi) => void;
  /** Dar kip: yalnız simgeler görünür (menü "gizlenince" tamamen kaybolmaz) */
  dar?: boolean;
  children?: ReactNode;
};

const GRUP_IKONU: Record<MenuGrubuId, LucideIcon> = {
  hazirlik: CheckCircle2,
  canli: Radio,
  sahne: Monitor,
  etkilesim: MessageCircle,
  bot: Bot,
  ayarlar: Settings,
};

/** Her başlığın simgesi kendi renginde: menü bir bakışta ayırt edilir, daha canlı durur */
const GRUP_RENGI: Record<MenuGrubuId, string> = {
  hazirlik: "text-emerald-400",
  canli: "text-rose-400",
  sahne: "text-sky-400",
  etkilesim: "text-pink-400",
  bot: "text-violet-400",
  ayarlar: "text-amber-400",
};

/** Alt sayfaların simgesi: bot sayfasında sekme adı, diğerlerinde gezinme kimliği */
const SAYFA_IKONU: Record<string, LucideIcon> = {
  control: Clapperboard,
  chat: MessagesSquare,
  starting: Play,
  ending: Flag,
  brb: Coffee,
  yayin: Cast,
  overlays: Layers,
  music: Music,
  sounds: Volume2,
  polls: BarChart3,
  giveaways: Gift,
  interaction: Target,
  settings: Settings2,
  hotkeys: Keyboard,
};

export default function NavTabBar({ visibleTabs, activeNav, botSayfa, labelFor, customizeLabel, editLayout, onToggleEdit, onSelect, dar = false, children }: Props) {
  const t = useT();
  const visible = new Set(visibleTabs);
  const aktifGrup = menuGrubuBul(activeNav, botSayfa);

  const sec = (s: MenuSayfasi) => {
    olay("sekme_acildi", { sekme: s.botSayfa || s.nav });
    onSelect(s);
  };

  return (
    <aside className={`yya-nav-rail flex h-full shrink-0 flex-col border-r border-panel-border bg-[var(--dt-surface-1)] transition-[width] duration-150 ${dar ? "w-[52px]" : "w-[200px]"}`}>
      <nav className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto py-2" aria-label={t("nav.menu")}>
        {ANA_MENU.map((grup) => {
          const sayfalar = grup.sayfalar.filter((s) => visible.has(s.nav));
          if (!sayfalar.length) return null;
          const acik = grup.id === aktifGrup;
          const Icon = GRUP_IKONU[grup.id];
          const tek = sayfalar.length === 1;
          return (
            <div key={grup.id}>
              <button
                type="button"
                data-nav-id={tek ? sayfalar[0].nav : undefined}
                aria-current={acik && tek ? "page" : undefined}
                aria-expanded={tek ? undefined : acik}
                aria-label={dar ? t(grup.adAnahtari) : undefined}
                title={dar ? t(grup.adAnahtari) : undefined}
                className={
                  `flex min-h-9 w-full items-center border-l-2 py-1 ${dar ? "justify-center px-0" : "gap-2.5 px-3"} text-[length:var(--menu-yazi,13px)] font-medium transition-all duration-150 active:scale-[0.98] motion-reduce:active:scale-100 ` +
                  (acik ? "border-panel-accent bg-[var(--dt-surface-3)] text-white" : "border-transparent text-white/70 hover:bg-[var(--dt-surface-3)] hover:text-white")
                }
                onClick={() => {
                  // Açık başlığa yeniden basmak sayfayı değiştirmesin
                  if (!acik) sec(sayfalar[0]);
                }}
              >
                <Icon className={`h-4 w-4 shrink-0 ${GRUP_RENGI[grup.id]}`} strokeWidth={1.75} />
                {dar ? null : <span className="truncate">{t(grup.adAnahtari)}</span>}
              </button>
              {acik && !tek ? (
                <div className="mb-1 mt-0.5 flex flex-col">
                  {sayfalar.map((s) => {
                    const secili = sayfaAcikMi(s, activeNav, botSayfa);
                    const SayfaIkonu = SAYFA_IKONU[s.botSayfa || s.nav];
                    return (
                      <button
                        key={s.botSayfa || s.nav}
                        type="button"
                        data-nav-id={s.nav}
                        aria-current={secili ? "page" : undefined}
                        aria-label={dar ? labelFor(s) : undefined}
                        title={dar ? labelFor(s) : undefined}
                        className={`flex min-h-8 w-full items-center ${dar ? "justify-center px-0" : "gap-2 pl-[30px] pr-3"} py-1 text-left text-[length:var(--menu-yazi,13px)] transition-all duration-150 active:scale-[0.98] motion-reduce:active:scale-100 ${secili ? "font-medium text-panel-accent" : "text-white/70 hover:bg-[var(--dt-surface-3)] hover:text-white"}`}
                        onClick={() => sec(s)}
                      >
                        {SayfaIkonu ? <SayfaIkonu aria-hidden className={`h-3.5 w-3.5 shrink-0 ${secili ? "" : GRUP_RENGI[grup.id]}`} strokeWidth={1.75} /> : <span className="w-3.5 shrink-0" />}
                        {dar ? null : <span className="truncate">{labelFor(s)}</span>}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-panel-border p-2">
        <button
          type="button"
          className="flex min-h-8 w-full items-center gap-2 px-2 py-1 text-[length:calc(var(--menu-yazi,13px)-1px)] font-medium text-white/70 transition-colors duration-150 hover:text-white"
          onClick={onToggleEdit}
          title={customizeLabel}
          aria-label={dar ? customizeLabel : undefined}
        >
          <SlidersHorizontal className={`h-4 w-4 shrink-0 ${dar ? "mx-auto" : ""}`} strokeWidth={1.75} />
          {dar ? null : <span className="truncate">{customizeLabel}</span>}
        </button>
        {editLayout && !dar ? children : null}
      </div>
    </aside>
  );
}
