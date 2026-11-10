/**
 * Sekme, bölümlü denetim ve araç çubuğu. Üçü de tek sekme durağıdır (roving tabindex):
 * Tab gruba girer, ok tuşları / Home / End grup içinde gezer, kapalı öğeler atlanır.
 *
 *   <Tabs label="Canlı" items={[{ id: "km", label: "Kontrol Merkezi" }, …]} value={v} onValueChange={setV} idPrefix="canli" />
 *   <TabPanel idPrefix="canli" id="km" hidden={v !== "km"}>…</TabPanel>
 *   <SegmentedControl label="Yoğunluk" options={[…]} value={y} onValueChange={setY} />
 *   <Toolbar label="Sahne araçları"><IconButton …/><IconButton …/></Toolbar>
 */
import { useEffect, useRef, type ComponentProps, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "./cn";
import { sonrakiIndeks } from "./yardimci";

export type SecenekOgesi<T extends string> = {
  id: T;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  /** Yalnız simge gösterilirken erişilebilir ad */
  ariaLabel?: string;
};

/** Grup içi ok tuşu gezintisi: yeni indeksteki öğeye odaklanır ve onu seçer. */
function useOkTuslari<T extends string>(items: SecenekOgesi<T>[], value: T, onValueChange: (v: T) => void, yon: "yatay" | "dikey") {
  const kok = useRef<HTMLDivElement>(null);
  const onKeyDown = (e: KeyboardEvent) => {
    const i = items.findIndex((x) => x.id === value);
    const j = sonrakiIndeks(i, e.key, items.map((x) => !!x.disabled), yon);
    if (j === null) return;
    e.preventDefault();
    onValueChange(items[j].id);
    kok.current?.querySelectorAll<HTMLElement>("[data-oge]")[j]?.focus();
  };
  return { kok, onKeyDown };
}

type TabsProps<T extends string> = {
  /** Sekme listesinin erişilebilir adı */
  label: string;
  items: SecenekOgesi<T>[];
  value: T;
  onValueChange: (v: T) => void;
  /** Sekme ↔ panel kimlik bağı (`TabPanel` ile aynı) */
  idPrefix: string;
  orientation?: "horizontal" | "vertical";
  /** Sekme şeridinin sağında sayfa düzeyi araçlar */
  trailing?: ReactNode;
  className?: string;
};

/** Sekme şeridi (28 px). Seçim odakla birlikte gelir: ok tuşu sekmeyi hemen açar. */
export function Tabs<T extends string>({ label, items, value, onValueChange, idPrefix, orientation = "horizontal", trailing, className }: TabsProps<T>) {
  const dikey = orientation === "vertical";
  const { kok, onKeyDown } = useOkTuslari(items, value, onValueChange, dikey ? "dikey" : "yatay");
  return (
    <div className={cn("flex bg-ui-s1", dikey ? "flex-col" : "h-7 items-stretch border-b border-ui-line", className)}>
      <div ref={kok} role="tablist" aria-label={label} aria-orientation={orientation} onKeyDown={onKeyDown} className={cn("flex min-w-0", dikey ? "flex-col" : "items-stretch")}>
        {items.map((t) => {
          const secili = t.id === value;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              data-oge
              id={`${idPrefix}-sekme-${t.id}`}
              aria-controls={`${idPrefix}-panel-${t.id}`}
              aria-selected={secili}
              aria-label={t.ariaLabel}
              tabIndex={secili ? 0 : -1}
              disabled={t.disabled}
              onClick={() => onValueChange(t.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 font-sans text-ui-2 text-ui-fg2 transition-colors duration-ui",
                "hover:text-ui-fg disabled:cursor-not-allowed disabled:opacity-50 [&>svg]:h-3.5 [&>svg]:w-3.5",
                dikey ? "h-row border-l-2 border-transparent" : "border-b-2 border-transparent",
                secili && "border-ui-accent font-semibold text-ui-fg",
                secili && dikey && "bg-ui-s2"
              )}
            >
              {t.icon}
              {t.label}
            </button>
          );
        })}
      </div>
      {trailing ? <div className="ml-auto flex items-stretch">{trailing}</div> : null}
    </div>
  );
}

export function TabPanel({ idPrefix, id, className, ...rest }: ComponentProps<"div"> & { idPrefix: string; id: string }) {
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${id}`}
      aria-labelledby={`${idPrefix}-sekme-${id}`}
      tabIndex={0}
      className={cn("min-h-0 outline-offset-[-2px]", className)}
      {...rest}
    />
  );
}

type SegmentedProps<T extends string> = {
  label: string;
  options: SecenekOgesi<T>[];
  value: T;
  onValueChange: (v: T) => void;
  size?: "md" | "lg";
  className?: string;
};

/** Bölümlü denetim (`radiogroup`): 2–5 kısa, birbirini dışlayan seçenek. */
export function SegmentedControl<T extends string>({ label, options, value, onValueChange, size = "md", className }: SegmentedProps<T>) {
  const { kok, onKeyDown } = useOkTuslari(options, value, onValueChange, "yatay");
  return (
    <div
      ref={kok}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn("inline-flex shrink-0 rounded-ui-2 border border-ui-line2 bg-ui-bg p-px", size === "lg" ? "h-hit" : "h-ctl", className)}
    >
      {options.map((o) => {
        const secili = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            data-oge
            aria-checked={secili}
            aria-label={o.ariaLabel}
            tabIndex={secili ? 0 : -1}
            disabled={o.disabled}
            onClick={() => onValueChange(o.id)}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap rounded-ui-1 px-2.5 font-sans text-ui-2 text-ui-fg2 transition-colors duration-ui",
              "hover:text-ui-fg disabled:cursor-not-allowed disabled:opacity-50 [&>svg]:h-3.5 [&>svg]:w-3.5",
              secili && "bg-ui-s3 font-semibold text-ui-fg shadow-[inset_0_0_0_1px_rgb(var(--ui-line2))]"
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

type ToolbarProps = ComponentProps<"div"> & {
  /** Araç çubuğunun erişilebilir adı */
  label: string;
  orientation?: "horizontal" | "vertical";
};

/**
 * Araç çubuğu: içindeki düğmeler tek sekme durağı (metin alanları gruba girmez, okları kendi kullanır); ok tuşları / Home / End aralarında gezer.
 * Ayırıcı için `<span role="separator" className="mx-1 h-4 w-px bg-ui-line" />`.
 */
export function Toolbar({ label, orientation = "horizontal", className, children, onKeyDown, onFocus, ...rest }: ToolbarProps) {
  const kok = useRef<HTMLDivElement>(null);
  const dugmeler = () => [...(kok.current?.querySelectorAll<HTMLElement>("button, [role='button']") ?? [])];

  // İlk açık düğme sekme durağı; diğerleri -1 (çocuklar değişince yeniden)
  useEffect(() => {
    const d = dugmeler();
    const etkin = d.find((x) => x.tabIndex === 0 && !x.hasAttribute("disabled")) ?? d.find((x) => !x.hasAttribute("disabled"));
    for (const x of d) x.tabIndex = x === etkin ? 0 : -1;
  });

  return (
    <div
      ref={kok}
      role="toolbar"
      aria-label={label}
      aria-orientation={orientation}
      className={cn("flex items-center gap-0.5", orientation === "vertical" && "flex-col", className)}
      onFocus={(e) => {
        onFocus?.(e);
        // Fareyle tıklanan düğme de sekme durağı olur
        const d = dugmeler();
        if (d.includes(e.target as HTMLElement)) for (const x of d) x.tabIndex = x === e.target ? 0 : -1;
      }}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        const d = dugmeler();
        const i = d.indexOf(document.activeElement as HTMLElement);
        if (i < 0) return;
        const j = sonrakiIndeks(i, e.key, d.map((x) => x.hasAttribute("disabled")), orientation === "vertical" ? "dikey" : "yatay");
        if (j === null) return;
        e.preventDefault();
        d[i].tabIndex = -1;
        d[j].tabIndex = 0;
        d[j].focus();
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
