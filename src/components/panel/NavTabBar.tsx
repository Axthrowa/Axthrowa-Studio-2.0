/**
 * Sol menü: yayın akışına göre altı başlık (`lib/anaMenu.ts`). Birden çok sayfası olan başlık açıkken
 * sayfaları altında görünür. Etiketler her zaman görünür, seçim 2 px sol çizgi.
 */

import type { ReactNode } from "react";
import { Bot, CheckCircle2, MessageCircle, Monitor, Radio, Settings, SlidersHorizontal, type LucideIcon } from "lucide-react";
import logo from "@/assets/logo.png";
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
  brandTitle: string;
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

export default function NavTabBar({ visibleTabs, activeNav, botSayfa, labelFor, customizeLabel, editLayout, onToggleEdit, onSelect, brandTitle, children }: Props) {
  const t = useT();
  const visible = new Set(visibleTabs);
  const aktifGrup = menuGrubuBul(activeNav, botSayfa);

  const sec = (s: MenuSayfasi) => {
    olay("sekme_acildi", { sekme: s.botSayfa || s.nav });
    onSelect(s);
  };

  return (
    <aside className="yya-nav-rail flex h-full w-[200px] shrink-0 flex-col border-r border-white/10 bg-panel-bg">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-white/10 px-3">
        <img src={logo} alt="" className="h-5 w-5 shrink-0 rounded" />
        <span className="truncate text-[13px] font-medium text-white">{brandTitle}</span>
      </div>

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
                className={
                  "flex h-9 w-full items-center gap-2.5 border-l-2 px-3 text-[13px] font-medium transition-colors duration-150 " +
                  (acik ? "border-panel-accent bg-white/[0.06] text-white" : "border-transparent text-white/70 hover:bg-white/[0.04] hover:text-white")
                }
                onClick={() => {
                  // Açık başlığa yeniden basmak sayfayı değiştirmesin
                  if (!acik) sec(sayfalar[0]);
                }}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                <span className="truncate">{t(grup.adAnahtari)}</span>
              </button>
              {acik && !tek ? (
                <div className="mb-1 mt-0.5 flex flex-col">
                  {sayfalar.map((s) => {
                    const secili = sayfaAcikMi(s, activeNav, botSayfa);
                    return (
                      <button
                        key={s.botSayfa || s.nav}
                        type="button"
                        data-nav-id={s.nav}
                        aria-current={secili ? "page" : undefined}
                        className={`h-8 w-full truncate pl-[38px] pr-3 text-left text-[13px] transition-colors duration-150 ${secili ? "font-medium text-panel-accent" : "text-white/70 hover:text-white"}`}
                        onClick={() => sec(s)}
                      >
                        {labelFor(s)}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-2">
        <button
          type="button"
          className="flex h-8 w-full items-center gap-2 px-2 text-[12px] font-medium text-white/70 transition-colors duration-150 hover:text-white"
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
