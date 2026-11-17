import { useCallback, useEffect, useState } from "react";
import { useAxthrowaEvents } from "@/lib/useAxthrowaEvents";

type Choice = "tray" | "quit" | "cancel";

/**
 * Pencerenin X düğmesine basılınca Rust `close-requested` olayı yollar; burada
 * küçük bir kutu gösterilir. Kutu görününce `close-ack` gönderilir — gelmezse
 * Rust yerel diyalogla yedeğe düşer, yani X hiçbir durumda "ölü" kalmaz.
 */
export default function CloseRequestModal() {
  const [open, setOpen] = useState(false);

  useAxthrowaEvents("close-requested", () => {
    setOpen(true);
    void import("@tauri-apps/api/event").then(({ emit }) => emit("close-ack"));
  });

  const choose = useCallback((c: Choice) => {
    setOpen(false);
    void import("@tauri-apps/api/event").then(({ emit }) => emit("close-choice", c));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") choose("cancel");
      else if (e.key === "Enter") choose("tray");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, choose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) choose("cancel");
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Kapatma seçenekleri"
    >
      <div className="w-full max-w-[280px] rounded-2xl bg-ui-s1 p-4 text-center shadow-2xl ring-1 ring-white/10">
        <p className="text-sm font-semibold text-white">Kapatılsın mı?</p>
        <p className="mt-1 text-ui-2 leading-snug text-white/55">
          Tepsiye küçültürsen bot, sunucu ve kısayollar çalışmaya devam eder.
        </p>
        <div className="mt-3 flex flex-col gap-1.5">
          <button
            type="button"
            autoFocus
            onClick={() => choose("tray")}
            className="rounded-xl bg-teal-500 px-3 py-2 text-xs font-semibold text-ui-accent-ink hover:bg-teal-400"
          >
            Tepsiye küçült
          </button>
          <button
            type="button"
            onClick={() => choose("quit")}
            className="rounded-xl bg-white/[0.06] px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-500/15"
          >
            Uygulamayı kapat
          </button>
          <button
            type="button"
            onClick={() => choose("cancel")}
            className="rounded-xl px-3 py-1.5 text-ui-2 text-white/50 hover:text-white/80"
          >
            Vazgeç
          </button>
        </div>
      </div>
    </div>
  );
}
