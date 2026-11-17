/**
 * Sol menü: yayın akışına göre yedi başlık (`lib/anaMenu.ts`). Açık başlığın sayfaları altında görünür.
 * Davranış (A2):
 * - Başlığa basınca o başlıkta en son açılan sayfaya gider; açık başlığa yeniden basmak onu katlar/açar
 *   (katlı başlıklar bu bilgisayarda hatırlanır).
 * - Dar kipte (52 px) simgenin üstünde 300 ms durunca başlığın sayfaları yan panelde açılır.
 * - Ctrl+1 … Ctrl+7 başlıklar arasında geçer.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { BarChart3, Bot, Cast, CheckCircle2, Clapperboard, FileText, Gift, History, Keyboard, Layers, ListMusic, MessageCircle, MessagesSquare, Monitor, MonitorPlay, Music, PlugZap, Radio, Settings, Settings2, SlidersHorizontal, Target, Volume2, Wand2, type LucideIcon } from "lucide-react";
import { useT } from "../../i18n";
import { olay } from "../../lib/analitik";
import type { Kip } from "../../lib/canliYerlesim";
import { ANA_MENU, ekranMi, menuGrubuBul, satirGorunur, satirHedefi, sayfaAcikMi, type MenuGrubuId, type MenuSayfasi } from "../../lib/anaMenu";

type Props = {
  visibleTabs: string[];
  activeNav: string;
  botSayfa?: string;
  /** Canlı ekranının kipi: yayın sonrası kendi başlığında seçili görünür */
  kip?: Kip | null;
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
  sonrasi: History,
  ayarlar: Settings,
};

/** Her başlığın simgesi kendi renginde: menü bir bakışta ayırt edilir, daha canlı durur */
const GRUP_RENGI: Record<MenuGrubuId, string> = {
  hazirlik: "text-emerald-400",
  canli: "text-rose-400",
  sahne: "text-sky-400",
  etkilesim: "text-pink-400",
  bot: "text-violet-400",
  sonrasi: "text-teal-400",
  ayarlar: "text-amber-400",
};

/** Alt sayfaların simgesi: bot sayfasında sekme adı, diğerlerinde gezinme kimliği */
const SAYFA_IKONU: Record<string, LucideIcon> = {
  kurulum: Wand2,
  profile: CheckCircle2,
  platforms: PlugZap,
  control: Clapperboard,
  chat: MessagesSquare,
  starting: MonitorPlay,
  yayin: Cast,
  overlays: Layers,
  music: Music,
  sounds: Volume2,
  polls: BarChart3,
  giveaways: Gift,
  interaction: Target,
  songrequest: ListMusic,
  sonrasi: FileText,
  settings: Settings2,
  hotkeys: Keyboard,
};
const sayfaKimligi = (s: MenuSayfasi) => s.kip || s.botSayfa || s.nav;

const KATLI_ANAHTARI = "studio.menu.katli";
function katliOku(): MenuGrubuId[] {
  try {
    const v = JSON.parse(localStorage.getItem(KATLI_ANAHTARI) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Dar kipte yan panelin açılma gecikmesi: imleç geçip giderken panel çıkmasın */
const YAN_PANEL_MS = 300;

export default function NavTabBar({ visibleTabs, activeNav, botSayfa, kip, labelFor, customizeLabel, editLayout, onToggleEdit, onSelect, dar = false, children }: Props) {
  const t = useT();
  const visible = new Set(visibleTabs);
  const aktifGrup = menuGrubuBul(activeNav, botSayfa, kip);
  const [katli, setKatli] = useState<MenuGrubuId[]>(katliOku);
  const [yanPanel, setYanPanel] = useState<MenuGrubuId | null>(null);
  const yanZaman = useRef<number | null>(null);
  // Başlık başına son açık sayfa (başlığa basınca oraya dönülür) ve son açık ekran (Giriş/Mola/Çıkış)
  const sonSayfa = useRef<Partial<Record<MenuGrubuId, MenuSayfasi>>>({});
  const sonEkran = useRef<string | undefined>(undefined);

  const gorunenSayfalar = (grupId: MenuGrubuId) => ANA_MENU.find((g) => g.id === grupId)!.sayfalar.filter((s) => satirGorunur(s, visible));

  useEffect(() => {
    if (ekranMi(activeNav)) sonEkran.current = activeNav;
    const satir = gorunenSayfalar(aktifGrup).find((s) => sayfaAcikMi(s, activeNav, botSayfa, kip));
    if (satir) sonSayfa.current[aktifGrup] = satir.nav === "bot" ? { ...satir, botSayfa: botSayfa || satir.botSayfa } : satir;
  });

  useEffect(() => {
    try {
      localStorage.setItem(KATLI_ANAHTARI, JSON.stringify(katli));
    } catch {
      /* depolama kapalı */
    }
  }, [katli]);

  const sec = (s: MenuSayfasi) => {
    const hedef = satirHedefi(s, visible, sonEkran.current);
    olay("sekme_acildi", { sekme: hedef.botSayfa || hedef.kip || hedef.nav });
    setYanPanel(null);
    onSelect(hedef);
  };

  const grubaGit = (grupId: MenuGrubuId) => {
    const sayfalar = gorunenSayfalar(grupId);
    if (!sayfalar.length) return;
    const son = sonSayfa.current[grupId];
    sec(son && sayfalar.some((s) => sayfaKimligi(s) === sayfaKimligi(son) || (s.nav === "bot" && son.nav === "bot")) ? son : sayfalar[0]);
  };
  const grubaGitRef = useRef(grubaGit);
  grubaGitRef.current = grubaGit;

  // Ctrl+1 … Ctrl+7: başlıklar arasında
  useEffect(() => {
    const tus = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.altKey || e.shiftKey || e.metaKey || e.defaultPrevented) return;
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > ANA_MENU.length) return;
      e.preventDefault();
      grubaGitRef.current(ANA_MENU[n - 1].id);
    };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, []);

  const yanPanelAc = (grupId: MenuGrubuId) => {
    if (!dar) return;
    if (yanZaman.current) window.clearTimeout(yanZaman.current);
    yanZaman.current = window.setTimeout(() => setYanPanel(grupId), YAN_PANEL_MS);
  };
  const yanPanelKapat = () => {
    if (yanZaman.current) window.clearTimeout(yanZaman.current);
    yanZaman.current = null;
    setYanPanel(null);
  };
  useEffect(() => () => void (yanZaman.current && window.clearTimeout(yanZaman.current)), []);

  const sayfaDugmesi = (s: MenuSayfasi, grupId: MenuGrubuId, simgeli: boolean, yanda = false) => {
    const secili = sayfaAcikMi(s, activeNav, botSayfa, kip);
    const SayfaIkonu = SAYFA_IKONU[sayfaKimligi(s)];
    const yalnizSimge = dar && !yanda;
    return (
      <button
        key={sayfaKimligi(s)}
        type="button"
        data-nav-id={s.nav}
        aria-current={secili ? "page" : undefined}
        aria-label={yalnizSimge ? labelFor(s) : undefined}
        title={yalnizSimge ? labelFor(s) : undefined}
        className={`flex min-h-8 w-full items-center ${yalnizSimge ? "justify-center px-0" : yanda ? "gap-2 px-3" : "gap-2 pl-[30px] pr-3"} py-1 text-left text-[length:var(--menu-yazi,13px)] transition-all duration-150 active:scale-[0.98] motion-reduce:active:scale-100 ${secili ? "font-medium text-panel-accent" : "text-white/70 hover:bg-[var(--dt-surface-3)] hover:text-white"}`}
        onClick={() => sec(s)}
      >
        {simgeli ? SayfaIkonu ? <SayfaIkonu aria-hidden className={`h-3.5 w-3.5 shrink-0 ${secili ? "" : GRUP_RENGI[grupId]}`} strokeWidth={1.75} /> : <span className="w-3.5 shrink-0" /> : null}
        {yalnizSimge ? null : <span className="truncate">{labelFor(s)}</span>}
      </button>
    );
  };

  return (
    <aside className={`studio-nav-rail flex h-full shrink-0 flex-col border-r border-panel-border bg-[var(--dt-surface-1)] transition-[width] duration-150 ${dar ? "w-[52px]" : "w-[200px]"}`}>
      <nav className={`custom-scrollbar flex min-h-0 flex-1 flex-col gap-0.5 py-2 ${dar ? "overflow-visible" : "overflow-y-auto"}`} aria-label={t("nav.menu")}>
        {ANA_MENU.map((grup, i) => {
          const sayfalar = gorunenSayfalar(grup.id);
          if (!sayfalar.length) return null;
          const acik = grup.id === aktifGrup;
          const Icon = GRUP_IKONU[grup.id];
          const tek = sayfalar.length === 1;
          const katlandi = katli.includes(grup.id);
          const kisayol = `Ctrl+${i + 1}`;
          return (
            <div key={grup.id} className="relative" onMouseEnter={() => yanPanelAc(grup.id)} onMouseLeave={yanPanelKapat}>
              <button
                type="button"
                data-nav-id={tek ? sayfalar[0].nav : undefined}
                aria-current={acik && tek ? "page" : undefined}
                aria-expanded={tek ? undefined : acik && !katlandi}
                aria-keyshortcuts={`Control+${i + 1}`}
                aria-label={dar ? t(grup.adAnahtari) : undefined}
                title={dar ? `${t(grup.adAnahtari)} (${kisayol})` : kisayol}
                className={
                  `flex min-h-9 w-full items-center border-l-2 py-1 ${dar ? "justify-center px-0" : "gap-2.5 px-3"} text-[length:var(--menu-yazi,13px)] font-medium transition-all duration-150 active:scale-[0.98] motion-reduce:active:scale-100 ` +
                  (acik ? "border-panel-accent bg-[var(--dt-surface-3)] text-white" : "border-transparent text-white/70 hover:bg-[var(--dt-surface-3)] hover:text-white")
                }
                onClick={() => {
                  if (!acik) return grubaGit(grup.id);
                  // Açık başlığa yeniden basmak sayfayı değiştirmez; çok sayfalı başlığı katlar/açar
                  if (!tek) setKatli((k) => (katlandi ? k.filter((g) => g !== grup.id) : [...k, grup.id]));
                }}
              >
                <Icon className={`h-4 w-4 shrink-0 ${GRUP_RENGI[grup.id]}`} strokeWidth={1.75} />
                {dar ? null : <span className="truncate">{t(grup.adAnahtari)}</span>}
              </button>
              {acik && !tek && !katlandi ? <div className="mb-1 mt-0.5 flex flex-col">{sayfalar.map((s) => sayfaDugmesi(s, grup.id, true))}</div> : null}
              {dar && yanPanel === grup.id ? (
                <div
                  role="menu"
                  aria-label={t(grup.adAnahtari)}
                  className="ui-gir absolute left-full top-0 z-50 ml-1 flex w-48 flex-col rounded-ui-2 border border-ui-line2 bg-[var(--dt-surface-2)] py-1 shadow-xl"
                >
                  <p className="px-3 pb-1 pt-0.5 text-ui-2 axt-etiket font-semibold text-white/50">{t(grup.adAnahtari)}</p>
                  {sayfalar.map((s) => sayfaDugmesi(s, grup.id, true, true))}
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
