/** Shadcn-style Switch — kompakt turkuaz / platform accent */

import type { ComponentPropsWithoutRef } from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "../../lib/cn";

export function Switch({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-white/10 transition-colors duration-150",
        "data-[state=checked]:bg-teal-500 data-[state=unchecked]:bg-white/10",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-pure-white shadow-sm transition-transform duration-150",
          "data-[state=checked]:translate-x-[1.05rem] data-[state=unchecked]:translate-x-0.5"
        )}
      />
    </SwitchPrimitive.Root>
  );
}
