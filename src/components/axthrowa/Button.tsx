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
  primary: "bg-axthrowa-violet text-white hover:brightness-110",
  secondary: "bg-zinc-800 text-zinc-100 hover:bg-zinc-700",
  ghost: "text-zinc-300 hover:bg-white/5 hover:text-white",
};

export function Button({ variant = "primary", loading, disabled, className, children, type = "button", ...rest }: Props) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-axthrowa-cyan/60",
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
