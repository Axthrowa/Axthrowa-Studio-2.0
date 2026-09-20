/** Mac Ayarları / Elgato tarzı ayar satırları. */

import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export function SettingsGroup({
  title,
  hint,
  children,
  className,
}: {
  title?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-1.5", className)}>
      {(title || hint) && (
        <header className="px-0.5 pb-0.5">
          {title ? <h4 className="yya-label">{title}</h4> : null}
          {hint ? <p className="mt-0.5 text-[11px] leading-snug text-white/50">{hint}</p> : null}
        </header>
      )}
      <div className="yya-settings-panel ns-settings-group">{children}</div>
    </section>
  );
}

export function SettingsRow({
  label,
  description,
  children,
  last,
  stacked,
}: {
  label: string;
  description?: string;
  children: ReactNode;
  last?: boolean;
  stacked?: boolean;
}) {
  return (
    <div
      className={cn(
        "px-3 py-2",
        !last && "border-b border-white/5",
        stacked
          ? "space-y-2"
          : "flex items-center justify-between gap-3"
      )}
    >
      <div className="min-w-0 flex-1 pr-2">
        <p className="text-[13px] text-white/90">{label}</p>
        {description ? (
          <p className="mt-0.5 text-[11px] leading-snug text-white/50">{description}</p>
        ) : null}
      </div>
      <div className={cn(stacked ? "w-full" : "shrink-0")}>{children}</div>
    </div>
  );
}

export function RuntimePanelShell({
  eyebrow,
  title,
  icon,
  accentClass = "text-emerald-400 border-white/[0.05]",
  children,
}: {
  eyebrow: string;
  title?: string;
  icon?: ReactNode;
  accentClass?: string;
  children: ReactNode;
}) {
  return (
    <div className="yya-card relative overflow-hidden">
      <div className="mb-2.5 flex items-center gap-2">
        {icon ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.04] text-emerald-400">
            {icon}
          </span>
        ) : null}
        <div>
          <p className={cn("yya-label", accentClass.split(/\s+/).find((c) => c.startsWith("text-")))}>
            {eyebrow}
          </p>
          {title ? <p className="mt-0.5 text-[13px] font-medium text-white/90">{title}</p> : null}
        </div>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
