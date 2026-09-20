import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Settings2, X } from "lucide-react";
import { cn } from "../../../lib/cn";

export type Obj = Record<string, unknown>;

/** Chat Bot vurgu rengi — turkuaz */
export const accent = {
  focus: "focus:border-teal-400/60",
  text: "text-teal-400",
  textSoft: "text-teal-300",
  border: "border-teal-400",
  borderSoft: "border-teal-400/35",
  bg: "bg-teal-400",
  bgHover: "hover:bg-teal-300",
  bgSoft: "bg-teal-400/15",
  glow: "bg-teal-400/35",
  shadow: "shadow-[0_0_16px_rgba(45,212,191,.55)]",
} as const;

export const input =
  "w-full rounded-lg border border-white/10 bg-[#0b0f12] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-teal-400/60";
export const label = "mb-1.5 block text-xs font-semibold tracking-normal text-white/65";
export const button =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-extrabold tracking-normal text-white antialiased [text-shadow:none] transition disabled:cursor-not-allowed disabled:opacity-40";

export function enabled(v: unknown) {
  return v === true || v === 1 || v === "1";
}

export function parseObject(v: unknown): Obj {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Obj;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (typeof parsed === "string") return parseObject(parsed);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Obj)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

export function parseList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return v.split(",").map((x) => x.trim()).filter(Boolean);
    }
  }
  return [];
}

export function GlowToggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border-0 transition",
        "disabled:cursor-not-allowed disabled:opacity-40",
        checked ? "bg-teal-400" : "bg-red-500/70"
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute top-1 h-6 w-6 rounded-full bg-pure-white shadow transition-transform duration-150",
          checked ? "left-7 translate-x-0" : "left-1 translate-x-0"
        )}
      />
    </button>
  );
}

export function Modal({
  title,
  children,
  onClose,
  onConfirm,
  busy,
  confirm = "Onayla",
  footerExtra,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
  busy?: boolean;
  confirm?: string;
  footerExtra?: ReactNode;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const node = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[min(92vh,900px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111518] shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#111518] px-5 py-4">
          <h3 className="min-w-0 text-lg font-bold tracking-normal text-white sm:text-xl">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="shrink-0 rounded-lg p-2.5 text-white/55 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
          {children}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-white/10 bg-[#111518] px-5 py-4">
          {footerExtra}
          <button
            type="button"
            onClick={onClose}
            className={cn(button, "border border-white/10 text-white/70 hover:bg-white/5")}
          >
            İptal
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={cn(button, "bg-teal-400 text-[#042f2e] hover:bg-teal-300")}
          >
            {confirm}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return node;
  return createPortal(node, document.body);
}

export function FeatureRow({
  title,
  desc,
  checked,
  onToggle,
  onConfigure,
  configureLabel = "Yapılandır",
  busy,
  hideToggle,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onToggle: (v: boolean) => void;
  onConfigure?: () => void;
  configureLabel?: string;
  busy?: boolean;
  hideToggle?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-white/[0.08] bg-[#101417] px-5 py-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-teal-400">{title}</h3>
        <p className="mt-1 text-sm text-white/50">{desc}</p>
      </div>
      <div className="flex items-center justify-between gap-4 sm:justify-end">
        {onConfigure ? (
          <button
            type="button"
            onClick={onConfigure}
            className={cn(
              button,
              "border border-white/15 bg-white/[0.06] text-sm font-extrabold text-white/90 hover:border-teal-400/50 hover:bg-teal-400/10 hover:text-teal-200"
            )}
          >
            {configureLabel === "Yapılandır" ? (
              <Settings2 className="h-3.5 w-3.5" />
            ) : null}
            {configureLabel}
          </button>
        ) : null}
        {!hideToggle ? (
          <GlowToggle checked={checked} disabled={busy} onChange={onToggle} />
        ) : null}
      </div>
    </div>
  );
}
