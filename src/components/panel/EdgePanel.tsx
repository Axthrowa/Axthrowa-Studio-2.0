import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Kenara gizlenen yan panel.
 *
 * Giriş/Çıkış/Mola/Chat ekranlarında sol (ayarlar) ve sağ (görünüm) panelleri
 * kenarda ince bir şerit olarak durur; fare şeride ya da panele değdiğinde
 * kayarak açılır. Böylece ortadaki önizleme tüm genişliği kullanır.
 *
 * `pinned` iken panel eski hâline döner: gridin gerçek bir sütunu olur
 * (`contents` sarmalayıcı düzeni değiştirmez) ve hep açık kalır.
 *
 * Açılma saf CSS ile (`group-hover` / `group-focus-within`) olur: panelin içinde
 * klavyeyle gezerken de açık kalır, JS zamanlayıcısı yoktur.
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

export default function EdgePanel({ side, pinned, width, label, className = "", children }: EdgePanelProps) {
  const left = side === "left";

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
  const openTransform = left
    ? "group-hover/edge-left:translate-x-0 group-focus-within/edge-left:translate-x-0"
    : "group-hover/edge-right:translate-x-0 group-focus-within/edge-right:translate-x-0";
  const openOpacity = left
    ? "group-hover/edge-left:opacity-100 group-focus-within/edge-left:opacity-100"
    : "group-hover/edge-right:opacity-100 group-focus-within/edge-right:opacity-100";
  const openPointer = left
    ? "group-hover/edge-left:pointer-events-auto group-focus-within/edge-left:pointer-events-auto"
    : "group-hover/edge-right:pointer-events-auto group-focus-within/edge-right:pointer-events-auto";
  const stripTint = left
    ? "group-hover/edge-left:border-panel-accent/40 group-hover/edge-left:bg-panel-accent/20"
    : "group-hover/edge-right:border-panel-accent/40 group-hover/edge-right:bg-panel-accent/20";

  return (
    <div
      className={`${group} absolute inset-y-4 z-30 ${left ? "left-0" : "right-0"}`}
      style={{ width: EDGE_STRIP }}
    >
      {/* Kenardaki tutamak — panel kapalıyken tek görünen parça. */}
      <div
        aria-hidden
        title={label}
        className={
          "absolute inset-y-0 flex items-center justify-center border border-white/[0.07] bg-panel-card/70 transition-colors " +
          (left ? "left-0 rounded-r-xl border-l-0" : "right-0 rounded-l-xl border-r-0") +
          " " +
          stripTint
        }
        style={{ width: EDGE_STRIP }}
      >
        <Chevron className="h-3.5 w-3.5 text-white/70" />
      </div>

      <aside
        aria-label={label}
        className={
          "pointer-events-none absolute inset-y-0 max-w-[88vw] overflow-hidden opacity-0 shadow-2xl transition-[transform,opacity] duration-200 ease-out " +
          (left
            ? "left-0 -translate-x-[calc(100%+12px)]"
            : "right-0 translate-x-[calc(100%+12px)]") +
          ` ${openTransform} ${openOpacity} ${openPointer} ${className}`
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
