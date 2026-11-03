import { useEffect, useState, type ReactNode, type CSSProperties } from "react";
import {
  Type,
  Sparkles,
  Clock,
  Image as ImageIcon,
  Film,
  Play,
  Music,
  Move,
  Eye,
  Wand2,
  Clapperboard,
  MessageSquare,
  Globe,
  Radio,
  Server,
  Share2,
  ChevronRight,
  Sliders,
} from "lucide-react";
import { useT } from "../../i18n";

type Props = {
  id: string;
  title: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  defaultOpen?: boolean;
};

const SECTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  metin: Type,
  yaziStilleri: Sparkles,
  geriSayim: Clock,
  arkaPlan: ImageIcon,
  video: Film,
  youtube: Play,
  fonMuzigi: Music,
  logo: ImageIcon,
  boyutlar: Move,
  gorunurluk: Eye,
  parcacik: Wand2,
  jenerik: Clapperboard,
  chatAyarlari: MessageSquare,
  obsUrl: Globe,
  resonance: Radio,
  obsWs: Server,
  sosyal: Share2,
};

const STORAGE_KEY = "panel.sectionCollapsed";

function loadCollapsed(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveCollapsed(map: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* */
  }
}

/**
 * Bölümü açar, gösterir ve odağı içine alır (`alan`: varsa o ayar). Kenara gizli panel odak içerideyken
 * açık kalır. Bölüm bu ekranda yoksa ya da kullanıcı gizlediyse false döner.
 */
export function ayarBolumuAc(id: string, alan?: string): boolean {
  const kok = document.querySelector<HTMLElement>(`[data-section="${id}"]`);
  if (!kok) return false;
  const map = loadCollapsed();
  map[id] = false;
  saveCollapsed(map);
  window.dispatchEvent(new CustomEvent("section-collapsed-changed"));
  requestAnimationFrame(() => {
    // Çift tıkla yerinde yazı düzenleme başladıysa odak onda kalsın
    if ((document.activeElement as HTMLElement | null)?.isContentEditable) return;
    const hedef = (alan && kok.querySelector<HTMLElement>(`[data-alan="${alan}"] input`)) || kok.querySelector<HTMLElement>("button");
    hedef?.focus({ preventScroll: true });
    (hedef || kok).scrollIntoView({ block: "center", behavior: "smooth" });
    const vurgu = ["ring-2", "ring-panel-accent"];
    kok.classList.add(...vurgu);
    window.setTimeout(() => kok.classList.remove(...vurgu), 1600);
  });
  return true;
}

export function exportSectionCollapsed(): Record<string, boolean> {
  return loadCollapsed();
}

export function importSectionCollapsed(map: Record<string, boolean> | undefined) {
  if (!map || typeof map !== "object") return;
  saveCollapsed(map);
  window.dispatchEvent(new CustomEvent("section-collapsed-changed"));
}

export default function SettingsSection({
  id,
  title,
  children,
  className = "",
  style,
  defaultOpen = true,
}: Props) {
  const t = useT();
  const [open, setOpen] = useState(() => {
    const map = loadCollapsed();
    if (id in map) return !map[id];
    return defaultOpen;
  });

  useEffect(() => {
    const sync = () => {
      const map = loadCollapsed();
      if (id in map) setOpen(!map[id]);
    };
    window.addEventListener("section-collapsed-changed", sync);
    return () => window.removeEventListener("section-collapsed-changed", sync);
  }, [id]);

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      const map = loadCollapsed();
      map[id] = !next;
      saveCollapsed(map);
      return next;
    });
  };

  const Icon = SECTION_ICONS[id] || Sliders;

  return (
    <section
      data-section={id}
      data-open={open ? "1" : "0"}
      style={style}
      className={"rounded-xl transition-all " + (open ? "space-y-2 mb-2 " : "mb-1.5 ") + className}
    >
      <button
        type="button"
        className="group flex w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-left transition-all duration-150 hover:border-white/[0.15] hover:bg-white/[0.06]"
        title={open ? t("section.collapse") : t("section.expand")}
        aria-label={open ? t("section.collapse") : t("section.expand")}
        aria-expanded={open}
        onClick={toggle}
      >
        <Icon className="h-4 w-4 shrink-0 text-panel-accent transition-colors group-hover:text-panel-accent" />
        <h3 className="min-w-0 flex-1 truncate text-sm font-bold tracking-wide text-white group-hover:text-panel-accent">{title}</h3>
        <ChevronRight
          aria-hidden
          className={
            "h-4 w-4 shrink-0 text-panel-muted transition-transform duration-200 group-hover:text-panel-accent " +
            (open ? "rotate-90 text-panel-accent" : "")
          }
        />
      </button>
      {open && <div className="space-y-2.5 px-1 py-0.5">{children}</div>}
    </section>
  );
}
