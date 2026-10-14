import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Kenara gizlenen yan panel.
 *
 * Giriş/Çıkış/Mola/Chat ekranlarında sol (ayarlar) ve sağ (görünüm) panelleri
 * kenarda ince bir şerit olarak durur; fare kenara YAKLAŞINCA kayarak açılır,
 * panelden çıkınca kısa bir gecikmeyle kapanır. Böylece ortadaki önizleme tüm
 * genişliği kullanır.
 *
 * Eskiden yalnız 16 px'lik şeride tam değince açılıyor ve fare bir piksel
 * dışarı kayınca anında kapanıyordu (açılır menüye giderken panel kaçıyordu).
 * Şimdi: kapsayıcının kenarına `YAKINLIK` (48) px kala açılır, ayrıldıktan
 * `KAPANMA_GECIKMESI` ms sonra kapanır. Panelin içinde klavye odağı varken
 * (açılır liste, renk seçici) açık kalır.
 *
 * `pinned` iken panel eski hâline döner: gridin gerçek bir sütunu olur
 * (`contents` sarmalayıcı düzeni değiştirmez) ve hep açık kalır.
 */
export type EdgePanelProps = {
  side: "left" | "right";
  pinned: boolean;
  /** Açıkken panel genişliği (px). */
  width: number;
  /** Şeridin üstündeki ipucu. */
  label: string;
  className?: string;
  children: ReactNode;
};

/** Şerit genişliği (px) — kenarda her zaman görünen tutamak. */
export const EDGE_STRIP = 16;
/** Kenara bu kadar yaklaşınca panel açılır (px). */
export const YAKINLIK = 48;
/** Fare panelden ayrıldıktan sonra kapanma beklemesi (ms). */
export const KAPANMA_GECIKMESI = 350;

/**
 * Fare konumu paneli açık tutmalı mı? Saf — test edilir.
 * `kap`: kapsayıcının sınırları, `panel`: açık panelin sınırları (kapalıysa yok).
 */
export function acikKalmali(
  x: number,
  y: number,
  side: "left" | "right",
  kap: { left: number; right: number; top: number; bottom: number },
  panel?: { left: number; right: number; top: number; bottom: number } | null,
): boolean {
  if (panel && x >= panel.left && x <= panel.right && y >= panel.top && y <= panel.bottom) return true;
  if (y < kap.top || y > kap.bottom || x < kap.left || x > kap.right) return false;
  return side === "left" ? x - kap.left <= YAKINLIK : kap.right - x <= YAKINLIK;
}

export default function EdgePanel({ side, pinned, width, label, className = "", children }: EdgePanelProps) {
  const left = side === "left";
  const kokRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const [acik, setAcik] = useState(false);
  const acikRef = useRef(false);
  acikRef.current = acik;

  useEffect(() => {
    if (pinned) return;
    let kapat: number | undefined;
    const hareket = (e: PointerEvent) => {
      const kap = kokRef.current?.parentElement?.getBoundingClientRect();
      if (!kap) return;
      const panel = acikRef.current ? panelRef.current?.getBoundingClientRect() : null;
      if (acikKalmali(e.clientX, e.clientY, side, kap, panel)) {
        if (kapat !== undefined) {
          window.clearTimeout(kapat);
          kapat = undefined;
        }
        if (!acikRef.current) setAcik(true);
      } else if (acikRef.current && kapat === undefined) {
        kapat = window.setTimeout(() => {
          kapat = undefined;
          // Açılır liste / renk seçici açıkken fare panelin dışında olabilir
          if (panelRef.current?.contains(document.activeElement)) return;
          setAcik(false);
        }, KAPANMA_GECIKMESI);
      }
    };
    window.addEventListener("pointermove", hareket, { passive: true });
    return () => {
      window.removeEventListener("pointermove", hareket);
      if (kapat !== undefined) window.clearTimeout(kapat);
    };
  }, [pinned, side]);

  if (pinned) {
    // Sarmalayıcı `contents`: grid sütun düzeni bozulmaz.
    return (
      <div className="contents">
        <aside className={`max-h-full min-h-0 ${className}`}>{children}</aside>
      </div>
    );
  }

  const Chevron = left ? ChevronRight : ChevronLeft;
  const group = left ? "group/edge-left" : "group/edge-right";
  // Odak panelin içindeyken (klavye, açılır liste) fare uzakta olsa da açık kal
  const odakAcik = left
    ? "group-focus-within/edge-left:translate-x-0 group-focus-within/edge-left:opacity-100 group-focus-within/edge-left:pointer-events-auto"
    : "group-focus-within/edge-right:translate-x-0 group-focus-within/edge-right:opacity-100 group-focus-within/edge-right:pointer-events-auto";
  const kapaliKonum = left ? "-translate-x-[calc(100%+12px)]" : "translate-x-[calc(100%+12px)]";
  const stripTint = acik ? "border-panel-accent/40 bg-panel-accent/20" : "";

  return (
    <div
      ref={kokRef}
      className={`${group} absolute inset-y-4 z-30 ${left ? "left-0" : "right-0"}`}
      style={{ width: EDGE_STRIP }}
    >
      {/* Kenardaki tutamak — panel kapalıyken tek görünen parça. Tıklayınca da açılır. */}
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={() => setAcik(true)}
        className={
          "absolute inset-y-0 flex items-center justify-center border border-white/[0.07] bg-panel-card/70 transition-colors " +
          (left ? "left-0 rounded-r-xl border-l-0" : "right-0 rounded-l-xl border-r-0") +
          " " +
          stripTint
        }
        style={{ width: EDGE_STRIP }}
      >
        <Chevron className="h-3.5 w-3.5 text-white/70" />
      </button>

      <aside
        ref={panelRef}
        aria-label={label}
        className={
          "absolute inset-y-0 max-w-[88vw] overflow-hidden shadow-2xl transition-[transform,opacity] duration-200 ease-out " +
          (left ? "left-0 " : "right-0 ") +
          (acik ? "pointer-events-auto translate-x-0 opacity-100" : `pointer-events-none opacity-0 ${kapaliKonum} ${odakAcik}`) +
          ` ${className}`
        }
        // Panel önizlemenin ÜSTÜNE kayıyor; yarı saydam zeminde altındaki video
        // yazıları okunmaz hâle getiriyordu. Kenar kipinde zemin opak olsun.
        style={{ width, background: "var(--panel-elevated)" }}
      >
        {children}
      </aside>
    </div>
  );
}
