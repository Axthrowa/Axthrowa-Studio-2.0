/** Ortak panel UI — premium kompakt (macOS / Elgato) */

import type { ReactNode } from "react";
import type { BotConfigV2 } from "../../../lib/smartBot/v2";
import { cn } from "../../../lib/cn";
import { SettingsRow } from "../../ui/SettingsGroup";

export type TabProps = {
  cfg: BotConfigV2;
  patch: (p: Partial<BotConfigV2>) => void;
  onToast: (m: string) => void;
};

export function Header({ title, sub }: { title: string; sub?: string }) {
  return (
    <div>
      <h2 className="yya-section-title">{title}</h2>
      {sub && <p className="yya-section-sub">{sub}</p>}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("yya-settings-panel", className)}>{children}</div>;
}

export function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  description,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <SettingsRow label={label} description={description}>
        <input
          type={type}
          className="yya-input w-[10rem] sm:w-[13rem]"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      </SettingsRow>
    </div>
  );
}

export function Btn({
  children,
  onClick,
  tone = "amber",
  className = "",
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "amber" | "primary" | "ghost" | "danger" | "accent";
  className?: string;
  disabled?: boolean;
}) {
  const cls =
    tone === "danger"
      ? "yya-btn-danger"
      : tone === "ghost"
        ? "yya-btn-ghost"
        : "yya-btn-primary";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(cls, className, disabled && "pointer-events-none opacity-50")}
    >
      {children}
    </button>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="yya-stat">
      <p className="yya-label">{label}</p>
      <p className="mt-1 text-[13px] font-medium text-white/90">{value}</p>
    </div>
  );
}

export function Check({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 border-b border-white/5 px-3 py-2 last:border-0 hover:bg-white/[0.03]">
      <span className="text-[13px] text-white/90">{label}</span>
      <input
        type="checkbox"
        className="size-3.5 accent-emerald-500"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export function SubNav<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-0.5 rounded-lg border border-white/[0.05] bg-black/30 p-0.5">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => onChange(it.id)}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors duration-150",
            value === it.id
              ? "bg-emerald-500/15 text-emerald-400"
              : "text-white/50 hover:bg-white/[0.06] hover:text-white/80"
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
