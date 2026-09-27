/** Sağ üst tema seçici — Skin seçici (STUDIO_SKINS listesinden). */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Palette } from "lucide-react";
import { cn } from "../lib/cn";
import { useStudioTheme, type StudioSkin } from "../lib/theme/ThemeContext";

export default function ThemeSelector({ className }: { className?: string }) {
  const { skin, setSkin, skins } = useStudioTheme();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !btn.current) {
      setPos(null);
      return;
    }
    const place = () => {
      const r = btn.current!.getBoundingClientRect();
      setPos({
        top: Math.round(r.bottom + 8),
        right: Math.round(Math.max(8, window.innerWidth - r.right)),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (root.current?.contains(t) || menu.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = skins.find((s) => s.id === skin);

  const dropdown =
    open && pos
      ? createPortal(
          <AnimatePresence>
            <motion.div
              ref={menu}
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.16 }}
              className="fixed z-[9999] w-64 rounded-2xl border border-white/[0.12] bg-[#0c0e14] p-2 shadow-glass-elevated"
              style={{ top: pos.top, right: pos.right }}
              role="listbox"
            >
              {skins.map((s) => {
                const on = s.id === skin;
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => {
                      setSkin(s.id as StudioSkin);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-all duration-150",
                      on
                        ? "bg-[color:var(--panel-accent)]/15 ring-1 ring-[color:var(--panel-accent)]/30"
                        : "hover:bg-white/[0.05]"
                    )}
                  >
                    <span
                      className="size-7 shrink-0 rounded-lg border border-white/10 shadow-sm"
                      style={{
                        background: `linear-gradient(145deg, ${s.swatch[0]} 40%, ${s.swatch[1]})`,
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-white">
                        {s.label}
                      </span>
                      <span className="block text-[10px] text-white/50">{s.hint}</span>
                    </span>
                    {on ? (
                      <Check className="h-4 w-4 text-[color:var(--panel-accent)]" />
                    ) : null}
                  </button>
                );
              })}
            </motion.div>
          </AnimatePresence>,
          document.body
        )
      : null;

  return (
    <div ref={root} className={cn("relative", className)}>
      <button
        ref={btn}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-xs font-medium text-white/80 transition-all hover:border-[color:var(--panel-accent)]/40 hover:bg-white/[0.06] hover:text-[color:var(--panel-accent)]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span
          className="size-2.5 rounded-full ring-1 ring-white/30 shadow-sm"
          style={{
            background: `linear-gradient(135deg, ${active?.swatch[0]}, ${active?.swatch[1]})`,
          }}
        />
        <Palette className="h-3.5 w-3.5 opacity-70" />
        <span className="hidden sm:inline">{active?.label || "Tema"}</span>
      </button>
      {dropdown}
    </div>
  );
}
