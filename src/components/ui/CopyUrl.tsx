import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { copyText } from "../../lib/clipboard";

/**
 * Tıklayınca kopyalanan adres.
 *
 * Adres, salt okunur bir kutu + ayrı "Kopyala" düğmesi yerine tek bir satır:
 * satırın her yerine tıklamak kopyalar, simge tik'e döner ve kısa süre
 * "Kopyalandı" yazar. Böylece ekranda hem bir kutu hem bir düğme eksilir.
 */
type Props = {
  url: string;
  /** Kopyalanınca (ör. panel bildirimi) */
  onCopied?: (url: string) => void;
  /** Kopyalanamazsa */
  onFail?: (url: string) => void;
  className?: string;
};

const FEEDBACK_MS = 1600;

export default function CopyUrl({ url, onCopied, onFail, className = "" }: Props) {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    []
  );

  const copy = async () => {
    const ok = await copyText(url);
    setState(ok ? "ok" : "fail");
    if (ok) onCopied?.(url);
    else onFail?.(url);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), FEEDBACK_MS);
  };

  const label = state === "ok" ? "Kopyalandı" : state === "fail" ? "Kopyalanamadı" : "Kopyala";

  return (
    <button
      type="button"
      onClick={() => void copy()}
      title={`${url}\nTıkla: kopyala`}
      aria-label={`Adresi kopyala: ${url}`}
      className={
        "group flex w-full items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2 text-left transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-panel-accent/60 " +
        (state === "ok" ? "!bg-emerald-400/10 " : state === "fail" ? "!bg-red-400/10 " : "") +
        className
      }
    >
      <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-white/85">{url}</span>
      <span
        className={
          "inline-flex shrink-0 items-center gap-1 text-[11px] font-medium transition-colors " +
          (state === "ok"
            ? "text-emerald-300"
            : state === "fail"
              ? "text-red-300"
              : "text-panel-muted group-hover:text-white")
        }
      >
        {state === "ok" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {label}
      </span>
    </button>
  );
}
