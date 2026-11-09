/**
 * AxthrowA ipucu. Koyu zemin, açık yazı, kenarlık yok; havada durduğu derin gölge ve ince camgöbeği parlamayla
 * belli olur. Fare üstüne gelince ya da klavyeyle odaklanınca kısa gecikmeyle açılır, akıcı kapanır.
 * Radix yok: sarmalanan öğenin yanına konumlanan tek bileşen.
 *
 *   <Tooltip content="Önizleme sesini kapat"><button>…</button></Tooltip>
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "../../lib/cn";

const ACILMA_MS = 300;
const CIKIS_MS = 150; // index.css --hz-cikis (140ms) + pay

const YER: Record<"top" | "bottom" | "left" | "right", string> = {
  top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
  bottom: "top-full left-1/2 mt-2 -translate-x-1/2",
  left: "right-full top-1/2 mr-2 -translate-y-1/2",
  right: "left-full top-1/2 ml-2 -translate-y-1/2",
};

export function Tooltip({
  content,
  children,
  side = "top",
  className,
}: {
  content: ReactNode;
  children: ReactNode;
  side?: keyof typeof YER;
  className?: string;
}) {
  const [acik, setAcik] = useState(false);
  const [cizili, setCizili] = useState(false);
  const zaman = useRef<number | undefined>(undefined);
  const id = useId();

  const goster = () => {
    window.clearTimeout(zaman.current);
    zaman.current = window.setTimeout(() => {
      setCizili(true);
      setAcik(true);
    }, ACILMA_MS);
  };
  const gizle = () => {
    window.clearTimeout(zaman.current);
    setAcik(false);
    zaman.current = window.setTimeout(() => setCizili(false), CIKIS_MS);
  };
  useEffect(() => () => window.clearTimeout(zaman.current), []);

  return (
    <span
      className="relative inline-flex"
      onPointerEnter={goster}
      onPointerLeave={gizle}
      onFocusCapture={goster}
      onBlurCapture={gizle}
      onKeyDown={(e) => e.key === "Escape" && gizle()}
      aria-describedby={cizili ? id : undefined}
    >
      {children}
      {cizili ? (
        // Dış öğe konumlar (translate), iç öğe canlanır (scale): ikisi aynı transform'u ezmesin
        <span className={cn("pointer-events-none absolute z-[500]", YER[side])}>
          <span
            id={id}
            role="tooltip"
            data-state={acik ? "open" : "closed"}
            className={cn(
              "block w-max max-w-xs rounded-lg bg-axthrowa-dark px-3 py-1.5 text-xs font-medium leading-snug text-zinc-200",
              "shadow-glow-cyan transform-gpu",
              "data-[state=closed]:animate-zoom-out data-[state=open]:animate-zoom-in",
              className
            )}
          >
            {content}
          </span>
        </span>
      ) : null}
    </span>
  );
}

export default Tooltip;
