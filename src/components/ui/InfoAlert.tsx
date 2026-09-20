/** Profesyonel Info / Alert kutusu — ikon + ton. */

import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Link2,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../../lib/cn";

export type InfoAlertTone = "info" | "success" | "warning" | "accent" | "webhook" | "tts";

const TONE: Record<
  InfoAlertTone,
  { icon: LucideIcon; ring: string; bg: string; title: string; iconCls: string }
> = {
  info: {
    icon: Info,
    ring: "border-sky-400/25",
    bg: "from-sky-500/10 via-panel-card/80 to-panel-elevated/60",
    title: "text-sky-200",
    iconCls: "bg-sky-500/15 text-sky-300",
  },
  success: {
    icon: CheckCircle2,
    ring: "border-emerald-400/25",
    bg: "from-emerald-500/10 via-panel-card/80 to-panel-elevated/60",
    title: "text-emerald-200",
    iconCls: "bg-emerald-500/15 text-emerald-300",
  },
  warning: {
    icon: AlertTriangle,
    ring: "border-amber-400/30",
    bg: "from-amber-500/10 via-panel-card/80 to-panel-elevated/60",
    title: "text-amber-200",
    iconCls: "bg-amber-500/15 text-amber-300",
  },
  accent: {
    icon: Info,
    ring: "border-panel-accent/30",
    bg: "from-[color:var(--panel-accent)]/12 via-panel-card/80 to-panel-elevated/60",
    title: "text-panel-accent",
    iconCls: "bg-panel-soft text-panel-accent",
  },
  webhook: {
    icon: Link2,
    ring: "border-panel-accent/35",
    bg: "from-[color:var(--panel-accent)]/14 via-[#0a1218]/90 to-panel-elevated/50",
    title: "text-panel-accent",
    iconCls: "bg-panel-soft text-panel-accent",
  },
  tts: {
    icon: Volume2,
    ring: "border-[#ff8a5b]/30",
    bg: "from-[#3ecfcf]/12 via-[#10151e]/95 to-[#1a100c]/70",
    title: "text-panel-accent",
    iconCls: "bg-gradient-to-br from-panel-accent/20 to-[#ff8a5b]/20 text-panel-accent",
  },
};

type Props = {
  title: string;
  children: ReactNode;
  tone?: InfoAlertTone;
  className?: string;
  action?: ReactNode;
};

export default function InfoAlert({
  title,
  children,
  tone = "info",
  className,
  action,
}: Props) {
  const t = TONE[tone];
  const Icon = t.icon;
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-gradient-to-br p-4 shadow-[0_12px_40px_rgba(0,0,0,.28)]",
        t.ring,
        t.bg,
        className
      )}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/[0.03] blur-2xl" />
      <div className="relative flex gap-3">
        <span
          className={cn(
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            t.iconCls
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={cn("text-[12px] font-semibold tracking-wide", t.title)}>
              {title}
            </p>
            {action}
          </div>
          <div className="text-[12px] leading-relaxed text-white/75">{children}</div>
        </div>
      </div>
    </div>
  );
}
