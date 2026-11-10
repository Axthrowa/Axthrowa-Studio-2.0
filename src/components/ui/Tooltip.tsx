/**
 * İpucu: fare üstünde ya da klavye odağında 300 ms sonra açılır, Esc / ayrılınca kapanır.
 * Belgeye (body) sabit konumla çizilir: taşma gizli panellerin içinde kırpılmaz.
 *
 *   <Tooltip content="Mikrofonu sustur" shortcut="Ctrl+M"><IconButton … /></Tooltip>
 */
import { cloneElement, isValidElement, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn";
import { Kbd } from "./Durum";

const ACILMA_MS = 300;
const PAY = 6;

type Yon = "top" | "bottom" | "left" | "right";

const KAYDIR: Record<Yon, string> = {
  top: "-translate-x-1/2 -translate-y-full",
  bottom: "-translate-x-1/2",
  left: "-translate-x-full -translate-y-1/2",
  right: "-translate-y-1/2",
};

/** Tetikleyicinin kutusuna göre ipucunun bağlanma noktası (sabit konum, px). */
export function ipucuNoktasi(r: Pick<DOMRect, "left" | "right" | "top" | "bottom" | "width" | "height">, yon: Yon) {
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  if (yon === "bottom") return { x: cx, y: r.bottom + PAY };
  if (yon === "left") return { x: r.left - PAY, y: cy };
  if (yon === "right") return { x: r.right + PAY, y: cy };
  return { x: cx, y: r.top - PAY };
}

export type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  side?: Yon;
  /** Kısayol ipucu (ör. "Ctrl+M") */
  shortcut?: string;
  className?: string;
};

export function Tooltip({ content, children, side = "top", shortcut, className }: TooltipProps) {
  const [nokta, setNokta] = useState<{ x: number; y: number } | null>(null);
  const kok = useRef<HTMLSpanElement>(null);
  const zaman = useRef<number | undefined>(undefined);
  const id = useId();

  const goster = () => {
    window.clearTimeout(zaman.current);
    zaman.current = window.setTimeout(() => {
      const r = kok.current?.getBoundingClientRect();
      if (r) setNokta(ipucuNoktasi(r, side));
    }, ACILMA_MS);
  };
  const gizle = () => {
    window.clearTimeout(zaman.current);
    setNokta(null);
  };
  useEffect(() => () => window.clearTimeout(zaman.current), []);

  // Açıklama odaklanan öğenin kendisine bağlansın (ekran okuyucu sarmalayıcıyı okumaz)
  const tetik = isValidElement(children)
    ? cloneElement(children as ReactElement<{ "aria-describedby"?: string }>, { "aria-describedby": nokta ? id : undefined })
    : children;

  return (
    <span
      ref={kok}
      className="inline-flex"
      onPointerEnter={goster}
      onPointerLeave={gizle}
      onFocusCapture={goster}
      onBlurCapture={gizle}
      onKeyDown={(e) => e.key === "Escape" && gizle()}
    >
      {tetik}
      {nokta
        ? createPortal(
            <span
              id={id}
              role="tooltip"
              style={{ left: nokta.x, top: nokta.y }}
              className={cn(
                "ui-gir pointer-events-none fixed z-ui-popover flex w-max max-w-xs items-center gap-2 rounded-ui-1 bg-ui-s3 px-2 py-1 font-sans text-ui-2 text-ui-fg shadow-ui-float",
                KAYDIR[side],
                className
              )}
            >
              <span>{content}</span>
              {shortcut ? <Kbd>{shortcut}</Kbd> : null}
            </span>,
            document.body
          )
        : null}
    </span>
  );
}

export default Tooltip;
