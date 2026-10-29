/**
 * AxthrowA düğmesi. `primary` menekşe dolgu, `secondary` kart üstü koyu, `ghost` yalnız yazı.
 *
 *   <Button onClick={kur} loading={kuruluyor}>İndir ve kur</Button>
 */
import type { ButtonHTMLAttributes } from "react";
import { CircleNotch } from "@phosphor-icons/react";
import { cn } from "../../lib/cn";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
};

const TUR = {
  primary: "bg-axthrowa-violet text-white shadow-[0_0_20px_rgba(139,92,246,0.35)] hover:brightness-110",
  secondary: "bg-zinc-800/70 text-zinc-200 hover:bg-zinc-700/70 hover:text-white",
  ghost: "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100",
};

export function Button({ variant = "primary", loading, disabled, className, children, type = "button", ...rest }: Props) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-axthrowa-cyan/60 active:scale-[0.98]",
        "disabled:pointer-events-none disabled:opacity-50",
        TUR[variant],
        className
      )}
      {...rest}
    >
      {loading ? <CircleNotch weight="bold" className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}
