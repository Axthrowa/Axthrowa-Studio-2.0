/**
 * Stüdyo Masası paneli: kart değil, kenetli bölme. Paneller arasında boşluk yok, 1 px çizgi:
 * kapsayıcıya `grid gap-px bg-ui-line` (ya da `flex gap-px bg-ui-line`) verin, paneller `bg-ui-s1` ile doldurur.
 *
 *   <div className="grid grid-cols-[1fr_320px] gap-px bg-ui-line">
 *     <Panel title="Sahneler" meta="7" actions={<IconButton label="Sahne ekle"><Plus /></IconButton>}>…</Panel>
 *     <Panel title="Sohbet">…</Panel>
 *   </div>
 *   <SettingRow label="Yoğunluk" description="Sıkı: daha çok bilgi" htmlFor="y"><SegmentedControl …/></SettingRow>
 *   <ListRow selected leading={<Film />} trailing={<Kbd>F1</Kbd>}>Oyun</ListRow>
 */
import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "./cn";

type PanelProps = Omit<ComponentProps<"section">, "title"> & {
  /** 11 px büyük harf başlık (`lang="tr"` ile İ doğru) */
  title: ReactNode;
  /** Başlık yanında sayı / durum (mono, soluk) */
  meta?: ReactNode;
  /** Başlığın sağındaki eylemler (IconButton) */
  actions?: ReactNode;
  /** Gövde kaydırılır mı (varsayılan evet) */
  scroll?: boolean;
  bodyClassName?: string;
};

export function Panel({ title, meta, actions, scroll = true, className, bodyClassName, children, ...rest }: PanelProps) {
  const baslikId = useId();
  return (
    <section aria-labelledby={baslikId} className={cn("flex min-h-0 min-w-0 flex-col bg-ui-s1", className)} {...rest}>
      <header className="flex h-6 shrink-0 items-center gap-1.5 border-b border-ui-line px-pad">
        <h2 id={baslikId} className="truncate font-sans text-ui-1 font-semibold uppercase tracking-[0.05em] text-ui-fg2">
          {title}
        </h2>
        {meta != null ? <span className="font-mono text-ui-1 text-ui-fg3">{meta}</span> : null}
        {actions ? <div className="ml-auto flex items-center gap-0.5">{actions}</div> : null}
      </header>
      <div className={cn("min-h-0 flex-1", scroll && "overflow-auto", bodyClassName)}>{children}</div>
    </section>
  );
}

type SettingRowProps = {
  label: ReactNode;
  description?: ReactNode;
  /** Denetimin kimliği: etiket tıklanınca ona odaklanır. Açıklamanın kimliği `${htmlFor}-aciklama`
   *  olur; denetime `aria-describedby` olarak verin. */
  htmlFor?: string;
  /** Sağdaki denetim */
  children: ReactNode;
  className?: string;
};

/** Ayar satırı: solda etiket + açıklama, sağda denetim. Satırlar alt çizgiyle ayrılır. */
export function SettingRow({ label, description, htmlFor, children, className }: SettingRowProps) {
  const aciklamaId = htmlFor ? `${htmlFor}-aciklama` : undefined;
  return (
    <div className={cn("grid min-h-row grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-b border-ui-line px-pad py-2", className)}>
      <div className="min-w-0">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="block text-ui-3 text-ui-fg">
            {label}
          </label>
        ) : (
          <div className="text-ui-3 text-ui-fg">{label}</div>
        )}
        {description ? (
          <p id={aciklamaId} className="mt-0.5 text-ui-2 text-ui-fg2">
            {description}
          </p>
        ) : null}
      </div>
      <div className="flex items-center justify-end gap-2">
        {children}
      </div>
    </div>
  );
}

type ListRowProps = ComponentProps<"div"> & {
  selected?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Büyük vuruş alanı (sahne listesi, deste) */
  large?: boolean;
};

/**
 * Liste satırı. Seçim `aria-selected` ile (role="option"/"row"/"tab" verildiğinde) ve sol vurgu
 * çizgisiyle gösterilir — renk tek başına değil. Etkileşimli satıra `tabIndex={0}` + `onClick` + klavye verin.
 */
export function ListRow({ selected, leading, trailing, large, role, className, children, ...rest }: ListRowProps) {
  return (
    <div
      role={role}
      aria-selected={role ? !!selected : undefined}
      data-selected={selected || undefined}
      className={cn(
        "relative flex min-w-0 select-none items-center gap-2 px-pad text-ui-3 text-ui-fg transition-colors duration-ui",
        large ? "h-hit" : "h-row",
        "hover:bg-ui-s2 [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:shrink-0",
        selected && "bg-ui-accent/15 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-ui-accent",
        className
      )}
      {...rest}
    >
      {leading ? <span className="flex shrink-0 text-ui-fg3">{leading}</span> : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing ? <span className="flex shrink-0 items-center gap-1 text-ui-fg3">{trailing}</span> : null}
    </div>
  );
}
