/**
 * Bağlam menüsü (sağ tık) — masaüstü etkileşim kalıbı (DESKTOP_INTERACTION_GUIDELINES.md §2).
 * Ok tuşları / Enter / Esc ile kullanılır; ekran kenarına sığdırılır; dışarı tıklayınca, kaydırınca ya da pencere
 * odağı gidince kapanır.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export type MenuOgesi =
  | {
      etiket: string;
      simge?: ReactNode;
      kisayol?: string;
      tehlikeli?: boolean;
      devreDisi?: boolean;
      eylem: () => void;
    }
  | "ayirici";

type Durum = { x: number; y: number; ogeler: MenuOgesi[] } | null;

export function useBaglamMenusu() {
  const [durum, setDurum] = useState<Durum>(null);
  const kapat = useCallback(() => setDurum(null), []);
  const ac = useCallback((e: { clientX: number; clientY: number; preventDefault?: () => void }, ogeler: MenuOgesi[]) => {
    e.preventDefault?.();
    setDurum({ x: e.clientX, y: e.clientY, ogeler });
  }, []);
  const menu = durum ? <BaglamMenusu x={durum.x} y={durum.y} ogeler={durum.ogeler} onKapat={kapat} /> : null;
  return { ac, kapat, menu };
}

export function BaglamMenusu({ x, y, ogeler, onKapat }: { x: number; y: number; ogeler: MenuOgesi[]; onKapat: () => void }) {
  const kutu = useRef<HTMLDivElement>(null);
  const [konum, setKonum] = useState({ x, y });

  useLayoutEffect(() => {
    const el = kutu.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setKonum({
      x: Math.max(4, Math.min(x, window.innerWidth - r.width - 4)),
      y: Math.max(4, Math.min(y, window.innerHeight - r.height - 4)),
    });
    el.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }, [x, y]);

  useEffect(() => {
    const disari = (e: MouseEvent) => {
      if (!kutu.current?.contains(e.target as Node)) onKapat();
    };
    const tus = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onKapat();
        return;
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const dugmeler = [...(kutu.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
      const i = dugmeler.indexOf(document.activeElement as HTMLButtonElement);
      const j = e.key === "ArrowDown" ? (i + 1) % dugmeler.length : (i - 1 + dugmeler.length) % dugmeler.length;
      dugmeler[j]?.focus();
    };
    window.addEventListener("mousedown", disari, true);
    window.addEventListener("keydown", tus, true);
    window.addEventListener("blur", onKapat);
    window.addEventListener("scroll", onKapat, true);
    return () => {
      window.removeEventListener("mousedown", disari, true);
      window.removeEventListener("keydown", tus, true);
      window.removeEventListener("blur", onKapat);
      window.removeEventListener("scroll", onKapat, true);
    };
  }, [onKapat]);

  return (
    <div ref={kutu} className="dt-menu" role="menu" style={{ left: konum.x, top: konum.y }} onContextMenu={(e) => e.preventDefault()}>
      {ogeler.map((o, i) =>
        o === "ayirici" ? (
          <div key={`a${i}`} className="dt-menu-ayirici" role="separator" />
        ) : (
          <button
            key={o.etiket}
            type="button"
            role="menuitem"
            className="dt-menu-oge"
            data-tehlikeli={o.tehlikeli ? "true" : undefined}
            disabled={o.devreDisi}
            onClick={() => {
              onKapat();
              o.eylem();
            }}
          >
            {o.simge}
            <span>{o.etiket}</span>
            {o.kisayol && <span className="dt-menu-kisayol">{o.kisayol}</span>}
          </button>
        )
      )}
    </div>
  );
}
