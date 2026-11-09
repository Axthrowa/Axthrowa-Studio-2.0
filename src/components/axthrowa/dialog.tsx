/**
 * AxthrowA penceresi (modal). Kenarlık yok: kart zemini, derin gölge ve üstten ince yansıma; arka plan
 * buzlu cam. Başlık ferah, düğmelerin olduğu alt şerit hafif koyu zeminle içerikten ayrılır.
 * Radix yok: belgeye taşınan (portal) tek bileşen; Esc ve dışa tıklama kapatır (`dismissible`),
 * kapanırken animasyon bitince kaldırılır.
 *
 *   <Dialog open={acik} onOpenChange={setAcik} title="Sahne silinsin mi?" footer={<>…düğmeler…</>}>…</Dialog>
 */
import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/cn";

// Çıkış animasyonu (index.css --hz-cikis 140ms) bitene kadar çizili kalır
const CIKIS_MS = 150;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Başlığın solundaki simge kutusu */
  icon?: ReactNode;
  children?: ReactNode;
  /** Alt şerit: düğmeler (sağa yaslı) */
  footer?: ReactNode;
  /** `alertdialog`: yalnız düğmeyle kapanan uyarı */
  role?: "dialog" | "alertdialog";
  /** Esc ve dışa tıklama kapatsın mı (uyarıda kapalı) */
  dismissible?: boolean;
  className?: string;
};

export function Dialog({ open, onOpenChange, title, description, icon, children, footer, role = "dialog", dismissible = true, className }: Props) {
  // Kapanırken animasyon oynasın diye bir süre daha çizilir
  const [cizili, setCizili] = useState(open);
  useEffect(() => {
    if (open) {
      setCizili(true);
      return;
    }
    const t = window.setTimeout(() => setCizili(false), CIKIS_MS);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open || !dismissible) return;
    const tus = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [open, dismissible, onOpenChange]);

  const baslikId = useId();
  const aciklamaId = useId();
  if (!cizili) return null;
  const state = open ? "open" : "closed";

  return createPortal(
    <div
      data-state={state}
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in"
      onMouseDown={(e) => {
        if (dismissible && e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div
        role={role}
        aria-modal="true"
        aria-labelledby={baslikId}
        aria-describedby={description ? aciklamaId : undefined}
        data-state={state}
        className={cn(
          "relative w-full max-w-md overflow-hidden rounded-2xl bg-axthrowa-card shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]",
          "before:pointer-events-none before:absolute before:inset-0 before:rounded-2xl before:border-t before:border-white/5",
          "transform-gpu data-[state=closed]:animate-zoom-out data-[state=open]:animate-zoom-in",
          className
        )}
      >
        <div className="flex items-start gap-4 px-7 pb-5 pt-7">
          {icon ? <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">{icon}</span> : null}
          <div className="flex min-w-0 flex-col gap-1.5">
            <h2 id={baslikId} className="text-[17px] font-semibold tracking-tight text-zinc-100">
              {title}
            </h2>
            {description ? (
              <div id={aciklamaId} className="text-sm leading-relaxed text-zinc-400">
                {description}
              </div>
            ) : null}
          </div>
        </div>
        {children ? <div className="px-7 pb-6 text-sm text-zinc-300">{children}</div> : null}
        {footer ? <div className="flex items-center justify-end gap-3 bg-zinc-950/50 px-7 py-4">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}

export default Dialog;
