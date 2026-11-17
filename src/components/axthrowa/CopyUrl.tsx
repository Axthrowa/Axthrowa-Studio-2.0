import { useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { copyText } from "../../lib/clipboard";
import { openExternal } from "../../lib/openExternal";

/**
 * OBS adresi satırı: tıkla-kopyala + "Önizle".
 *
 * Adres, salt okunur kutu + ayrı "Kopyala" düğmesi yerine tek satır: satırın
 * her yerine tıklamak kopyalar. Sağdaki **Önizle** adresi tarayıcıda açar —
 * OBS'e eklemeden önce katmanın nasıl göründüğünü görmek için. Kopyalama
 * eklenirken bu önizleme düğmesi düşmüştü, "OBS önizleme butonları çalışmıyor"
 * şikâyeti bundandı.
 */
type Props = {
  url: string;
  /** Kopyalanınca (ör. panel bildirimi) */
  onCopied?: (url: string) => void;
  /** Kopyalanamazsa */
  onFail?: (url: string) => void;
  /** Önizleme açılınca / açılamayınca bildirim */
  onOpened?: (url: string, sonuc: "opened" | "copied" | "failed") => void;
  className?: string;
};

const FEEDBACK_MS = 1600;

export default function CopyUrl({ url, onCopied, onFail, onOpened, className = "" }: Props) {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  const [opening, setOpening] = useState(false);
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

  const preview = async () => {
    if (opening) return;
    setOpening(true);
    try {
      const sonuc = await openExternal(url);
      onOpened?.(url, sonuc);
    } finally {
      setOpening(false);
    }
  };

  const label = state === "ok" ? "Kopyalandı" : state === "fail" ? "Kopyalanamadı" : "Kopyala";

  return (
    <div className={"flex w-full items-stretch gap-1.5 " + className}>
      <button
        type="button"
        onClick={() => void copy()}
        title={`${url}\nTıkla: kopyala`}
        aria-label={`Adresi kopyala: ${url}`}
        className={
          "group flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-left transition-all duration-150 hover:border-white/[0.14] hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-panel-accent/60 " +
          (state === "ok"
            ? "!border-emerald-500/40 !bg-emerald-500/15 shadow-[0_0_12px_rgb(var(--ui-ok)/0.2)] "
            : state === "fail"
              ? "!border-red-500/40 !bg-red-500/15 shadow-[0_0_12px_rgb(var(--ui-danger)/0.2)] "
              : "")
        }
      >
        <span className="min-w-0 flex-1 truncate font-mono text-ui-2 text-white/90 group-hover:text-white">{url}</span>
        <span
          className={
            "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-ui-2 font-semibold transition-all duration-150" +
            (state === "ok"
              ? "bg-emerald-500/20 text-emerald-300"
              : state === "fail"
                ? "bg-red-500/20 text-red-300"
                : "bg-white/[0.05] text-panel-muted group-hover:bg-white/[0.08] group-hover:text-white")
          }
        >
          {state === "ok" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          {label}
        </span>
      </button>

      <button
        type="button"
        onClick={() => void preview()}
        disabled={opening}
        title={`Önizle: ${url}\nTarayıcıda açar (OBS'e eklemeden önce kontrol)`}
        aria-label={`Önizle: ${url}`}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-panel-accent/30 bg-panel-accent/15 px-2.5 text-ui-2 font-semibold text-panel-accent transition-all duration-150 hover:border-panel-accent/50 hover:bg-panel-accent/25 disabled:opacity-50"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        {opening ? "Açılıyor…" : "Önizle"}
      </button>
    </div>
  );
}
