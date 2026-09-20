/**
 * Ayar grubu kartı — AxthrowA
 * Çizgiye tıkla → gizle (+); artıya tıkla → aç.
 */

import { useEffect, useState, type ReactNode, type CSSProperties } from "react";
import { useT } from "../../i18n";

type Props = {
  id: string;
  title: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  defaultOpen?: boolean;
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

  return (
    <section
      data-section={id}
      data-open={open ? "1" : "0"}
      style={style}
      // Kutu ve çizgi yok: gruplar yalnız boşlukla ayrılır (yan sütunda her grup
      // kendi çerçevesini + başlık çizgisini çizdiği için ekran kutu dolu görünüyordu).
      className={"py-2 " + (open ? "space-y-2 " : "") + className}
    >
      <button
        type="button"
        className="group flex w-full items-center gap-2 rounded-md py-1 text-left"
        title={open ? t("section.collapse") : t("section.expand")}
        aria-label={open ? t("section.collapse") : t("section.expand")}
        aria-expanded={open}
        onClick={toggle}
      >
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-white/90">{title}</h3>
        <span
          aria-hidden
          className={
            "shrink-0 text-xs text-panel-muted transition-transform group-hover:text-panel-accent " +
            (open ? "rotate-90" : "")
          }
        >
          ›
        </span>
      </button>
      {open && <div className="space-y-2">{children}</div>}
    </section>
  );
}
