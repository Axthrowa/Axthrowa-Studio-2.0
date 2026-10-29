/**
 * AxthrowA bildirim kutusu: kart zemini, yuvarlak hatlar, kenarlık yerine durum renginde parlama.
 * `success` camgöbeği, `error` kırmızı, `warn` turuncu.
 *
 *   <Toast variant="success">Kaydedildi</Toast>
 *   <Toast variant="error" title="OBS bağlantısı koptu" onClose={…}>OBS'i açın.</Toast>
 */
import type { ReactNode } from "react";
import { CheckCircle, Warning, WarningOctagon, X } from "@phosphor-icons/react";
import { cn } from "../../lib/cn";

type Variant = "success" | "error" | "warn";

const TUR: Record<Variant, { kutu: string; ikon: typeof CheckCircle; renk: string }> = {
  success: { kutu: "shadow-glow-cyan", ikon: CheckCircle, renk: "text-axthrowa-cyan" },
  error: { kutu: "shadow-[0_8px_24px_rgba(0,0,0,0.45),0_0_16px_rgba(239,68,68,0.28)]", ikon: WarningOctagon, renk: "text-red-400" },
  warn: { kutu: "shadow-[0_8px_24px_rgba(0,0,0,0.45),0_0_16px_rgba(249,115,22,0.25)]", ikon: Warning, renk: "text-orange-400" },
};

type Props = {
  variant?: Variant;
  title?: string;
  children?: ReactNode;
  onClose?: () => void;
  className?: string;
};

export function Toast({ variant = "success", title, children, onClose, className }: Props) {
  const { kutu, ikon: Ikon, renk } = TUR[variant];
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "relative flex items-start gap-3 rounded-xl bg-axthrowa-card px-4 py-3 text-sm text-zinc-200 transform-gpu animate-zoom-in",
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-xl before:border-t before:border-white/5",
        kutu,
        className
      )}
    >
      <Ikon weight="duotone" className={cn("mt-0.5 h-4 w-4 shrink-0", renk)} />
      <div className="min-w-0 flex-1 leading-relaxed">
        {title ? <p className="font-semibold text-zinc-100">{title}</p> : null}
        {children ? <div className={title ? "text-zinc-400" : undefined}>{children}</div> : null}
      </div>
      {onClose ? (
        <button
          type="button"
          title="Kapat"
          aria-label="Bildirimi kapat"
          className="shrink-0 rounded-md p-0.5 text-zinc-500 transition-colors duration-200 hover:text-zinc-200"
          onClick={onClose}
        >
          <X weight="bold" className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
