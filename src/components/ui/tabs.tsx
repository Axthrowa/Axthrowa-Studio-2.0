/** Shadcn-style Tabs (Radix) — BotAxt cyan accent. */

import type { ComponentPropsWithoutRef } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "../../lib/cn";

export const Tabs = TabsPrimitive.Root;

export function TabsList({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex h-10 w-full items-center gap-0.5 rounded-xl border border-white/10 bg-black/25 p-0.5",
        className
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/50 transition duration-150",
        "hover:text-white/70 data-[state=active]:bg-cyan-400/15 data-[state=active]:text-cyan-300",
        className
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn("mt-3 focus-visible:outline-none", className)}
      {...props}
    />
  );
}
