/**
 * AxthrowA anahtarı (aç/kapa). shadcn Switch ile aynı kullanım (`checked`, `onCheckedChange`, `data-state`),
 * ama Radix bağımlılığı yok: tek bir `role="switch"` düğme. Açıkken camgöbeği, odakta marka parlaması,
 * topuz yaylı (hafif aşan) geçişle kayar.
 */
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "role"> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

export function Switch({ checked, onCheckedChange, className, disabled, ...rest }: Props) {
  const state = checked ? "checked" : "unchecked";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-state={state}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-300",
        "bg-zinc-700 data-[state=checked]:bg-axthrowa-cyan data-[state=checked]:shadow-[0_0_14px_rgba(6,182,212,0.35)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-axthrowa-cyan/50 focus-visible:ring-offset-2 focus-visible:ring-offset-axthrowa-dark",
        "disabled:cursor-not-allowed disabled:opacity-40",
        className
      )}
      {...rest}
    >
      <span
        data-state={state}
        className={cn(
          "pointer-events-none block h-5 w-5 transform-gpu rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.35)]",
          "transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
        )}
      />
    </button>
  );
}

export default Switch;
