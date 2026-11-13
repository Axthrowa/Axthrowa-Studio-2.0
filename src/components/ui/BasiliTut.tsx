import { useEffect, useRef, useState, type ButtonHTMLAttributes, type KeyboardEvent } from "react";

/** Tablo A8 — canlıda geri alınamayan eylem (yayını bitir) pencere yerine bu kadar basılı tutmayla onaylanır */
export const BASILI_TUT_MS = 600;

/** Süre dolunca `onOnay` çağrılır; dönen işlev erken bırakmada sayacı iptal eder */
export function basiliTutBaslat(onOnay: () => void, sure = BASILI_TUT_MS): () => void {
  const t = setTimeout(onOnay, sure);
  return () => clearTimeout(t);
}

export const basiliTutTusuMu = (key: string) => key === " " || key === "Enter";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  onOnay: () => void;
  /** false iken sıradan tek tık düğmesi (ör. yayın kapalıyken "Yayını başlat") */
  basiliTut: boolean;
};

/** Basılı tutunca düğmenin içinde dolan çubuk; tek tık bir şey yapmaz, yalnız ipucunu gösterir */
export function BasiliTutDugme({ onOnay, basiliTut, children, className, disabled, title, ...rest }: Props) {
  const [doluyor, setDoluyor] = useState(false);
  const iptal = useRef<(() => void) | null>(null);
  const birak = () => {
    iptal.current?.();
    iptal.current = null;
    setDoluyor(false);
  };
  const basla = () => {
    if (disabled || iptal.current) return;
    setDoluyor(true);
    iptal.current = basiliTutBaslat(() => {
      iptal.current = null;
      setDoluyor(false);
      onOnay();
    });
  };
  useEffect(() => () => iptal.current?.(), []);
  useEffect(() => {
    if (!basiliTut || disabled) birak();
  }, [basiliTut, disabled]);

  if (!basiliTut)
    return (
      <button type="button" {...rest} title={title} disabled={disabled} className={className} onClick={onOnay}>
        {children}
      </button>
    );

  const tus = (e: KeyboardEvent<HTMLButtonElement>, asagi: boolean) => {
    if (!basiliTutTusuMu(e.key)) return;
    e.preventDefault();
    if (asagi) {
      if (!e.repeat) basla();
    } else birak();
  };
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled}
      title={title ? `${title} — onay için basılı tut` : "Onay için basılı tut"}
      aria-description="Onaylamak için basılı tut"
      className={`relative overflow-hidden ${className || ""}`}
      onPointerDown={(e) => {
        if (e.button === 0) basla();
      }}
      onPointerUp={birak}
      onPointerLeave={birak}
      onPointerCancel={birak}
      onBlur={birak}
      onKeyDown={(e) => tus(e, true)}
      onKeyUp={(e) => tus(e, false)}
      onContextMenu={(e) => doluyor && e.preventDefault()}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 bg-current opacity-25"
        style={{ width: doluyor ? "100%" : "0%", transition: doluyor ? `width ${BASILI_TUT_MS}ms linear` : "none" }}
      />
      <span className="relative inline-flex items-center gap-[inherit]">{children}</span>
      <span className="sr-only" aria-live="polite">
        {doluyor ? "Basılı tutuluyor" : ""}
      </span>
    </button>
  );
}
