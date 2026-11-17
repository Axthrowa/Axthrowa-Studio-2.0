/** OverlayShell'den ayrıldı (TEK-4, davranış aynı): sürükle, boyutlandır, metin ve görünürlük düzenleme. */
import { useRef, ReactNode, PointerEvent as REPointerEvent } from "react";
import { OverlaySettings, ScreenId, patchSettings, saveSettings } from "../../lib/api";
import { esikAsildi, suruklenmisKonum, type Konum } from "../../lib/surukle";
import { clamp } from "./OverlayShell";

export type UseKabukDuzenlemeGirdisi = {
  displaySettings: OverlaySettings;
  dragKey: React.RefObject<string | null>;
  dragStart: React.RefObject<{ bas: Konum; px: number; py: number; moved: boolean; son: Konum; } | null>;
  edit: boolean;
  localPositions: any;
  onLivePatch: ((patch: OverlaySettings) => void) | undefined;
  onPartSelect: ((key: string) => void) | undefined;
  onPositionsPersist: ((positions: Record<string, { x: number; y: number; }>) => void) | undefined;
  resizeKey: React.RefObject<string | null>;
  resizeStart: React.RefObject<{ x: number; y: number; size: number; cx: number; cy: number; dist: number; }>;
  screen: ScreenId;
  setGuides: React.Dispatch<React.SetStateAction<{ v?: number | undefined; h?: number | undefined; }>>;
  setLocalPositions: React.Dispatch<any>;
  setLocalSizes: React.Dispatch<any>;
  setSynced: React.Dispatch<React.SetStateAction<OverlaySettings>>;
  settingsRef: React.RefObject<OverlaySettings>;
  wrapRef: React.RefObject<HTMLDivElement | null>;
};

export function useKabukDuzenleme({ displaySettings, dragKey, dragStart, edit, localPositions, onLivePatch, onPartSelect, onPositionsPersist, resizeKey, resizeStart, screen, setGuides, setLocalPositions, setLocalSizes, setSynced, settingsRef, wrapRef }: UseKabukDuzenlemeGirdisi) {

  const sonSecim = useRef(-1000);
  const onPointerDown = (key: string, bas: Konum) => (e: REPointerEvent) => {
    if (!edit) return;
    // Yerinde yazı düzenlerken imleç metni seçsin, öğe sürüklenmesin
    if ((e.target as HTMLElement).closest?.('[contenteditable="true"]')) return;
    e.preventDefault();
    e.stopPropagation();
    dragKey.current = key;
    dragStart.current = { bas, px: e.clientX, py: e.clientY, moved: false, son: bas };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: REPointerEvent) => {
    if (!edit) return;
    if (resizeKey.current) {
      const key = resizeKey.current;
      const start = resizeStart.current;
      if (key === "ticker") {
        const dx = e.clientX - start.x;
        const next = clamp(Math.round(start.size + dx * 0.12), 50, 100);
        if (onLivePatch) onLivePatch({ tickerWidth: next });
        else setSynced((s: any) => ({ ...s, tickerWidth: next }));
        return;
      }
      const dist = Math.hypot(e.clientX - start.cx, e.clientY - start.cy);
      const ratio = start.dist > 4 ? dist / start.dist : 1;
      const next = clamp(Math.round(start.size * ratio), 30, 280);
      setLocalSizes((prev: any) => ({ ...(prev || {}), [key]: next }));
      return;
    }
    if (!dragKey.current || !dragStart.current) return;
    const key = dragKey.current;
    const st = dragStart.current;
    const dx = e.clientX - st.px;
    const dy = e.clientY - st.py;
    if (!st.moved && !esikAsildi(dx, dy)) return;
    st.moved = true;
    const rect = wrapRef.current?.getBoundingClientRect();
    const { konum, kilavuz } = suruklenmisKonum(st.bas, dx, dy, rect?.width || 0, rect?.height || 0);
    st.son = konum;
    setGuides(kilavuz);
    setLocalPositions((prev: any) => ({ ...(prev || {}), [key]: konum }));
  };

  const persistSizes = async (sizes: Record<string, number>) => {
    if (onLivePatch) {
      onLivePatch({ sizes });
      return;
    }
    setSynced((s: any) => ({ ...s, sizes }));
    try {
      await patchSettings(screen, { sizes });
      await saveSettings(screen, { ...settingsRef.current, sizes });
    } catch {
      /* */
    }
  };

  const onPointerUp = async (e: REPointerEvent) => {
    if (resizeKey.current) {
      const key = resizeKey.current;
      resizeKey.current = null;
      if (key === "ticker") {
        const w = Number(settingsRef.current.tickerWidth) || 96;
        if (onLivePatch) onLivePatch({ tickerWidth: w });
        else {
          void patchSettings(screen, { tickerWidth: w });
          void saveSettings(screen, { ...settingsRef.current, tickerWidth: w });
        }
        return;
      }
      setLocalSizes((prev: any) => {
        const sizes = { ...(settingsRef.current.sizes || {}), ...(prev || {}) };
        void persistSizes(sizes);
        return sizes;
      });
      return;
    }
    if (!dragKey.current) return;
    const key = dragKey.current;
    const st = dragStart.current;
    dragKey.current = null;
    dragStart.current = null;
    setGuides({});
    // Sürüklemeden bırakılan tık konumu DEĞİŞTİRMEZ (eskiden öğe tıklanan yere atlıyordu)
    if (!st?.moved) {
      // Çift tıkın ikinci basışı odağı yerinde yazı düzenlemeden almasın
      if (e.type === "pointerup" && e.timeStamp - sonSecim.current > 400) onPartSelect?.(key);
      sonSecim.current = e.timeStamp;
      return;
    }
    const positions = { ...(settingsRef.current.positions || {}), ...(localPositions || {}), [key]: st.son };
    setLocalPositions(positions);
    if (onPositionsPersist) {
      onPositionsPersist(positions);
      return;
    }
    setSynced((s: any) => ({ ...s, positions }));
    try {
      await patchSettings(screen, { positions });
      await saveSettings(screen, { ...settingsRef.current, positions });
    } catch {
      /* */
    }
  };

  /** Önizlemede yerinde düzenlenen yazıyı kaydeder (panelde canlı yama, aksi hâlde sunucu). */
  const metniKaydet = async (alan: "eyebrow" | "title" | "sub" | "ticker" | "liveText", deger: string) => {
    if (onLivePatch) {
      onLivePatch({ [alan]: deger });
      return;
    }
    setSynced((s: any) => ({ ...s, [alan]: deger }));
    try {
      await patchSettings(screen, { [alan]: deger });
      await saveSettings(screen, { ...settingsRef.current, [alan]: deger });
    } catch {
      /* */
    }
  };

  const setVisible = async (key: string, show: boolean) => {
    const visible = { ...(settingsRef.current.visible || {}), [key]: show };
    if (onLivePatch) {
      onLivePatch({ visible });
      return;
    }
    setSynced((s: any) => ({ ...s, visible }));
    try {
      await patchSettings(screen, { visible });
      await saveSettings(screen, { ...settingsRef.current, visible });
    } catch {
      /* */
    }
  };

  const renderDraggable = (key: string, content: ReactNode, defaultPos = { x: 50, y: 50 }) => {
    // Konum kullanıcıya ait: kenara dayamak ya da kasten yarısını dışarı
    // taşırmak isteyebilir. Buraya sınırlama koymuyoruz.
    const pos = displaySettings.positions?.[key] || defaultPos;
    const size = (displaySettings.sizes?.[key] || 100) / 100;
    const visible = displaySettings.visible?.[key] !== false;
    if (!visible || content == null) return null;
    const tickerW =
      key === "ticker"
        ? Math.min(100, Math.max(50, Number(displaySettings.tickerWidth) || 92))
        : null;

    return (
      <div
        key={key}
        className={`draggable ${edit ? "dragging-ready" : ""}`}
        data-key={key}
        onPointerDown={onPointerDown(key, pos)}
        style={{
          left: `${pos.x}%`,
          top: `${pos.y}%`,
          width: tickerW != null ? `${tickerW}%` : undefined,
          transform: `translate(-50%, -50%) scale(${key === "ticker" ? 1 : size})`,
          cursor: edit ? "move" : "default",
          touchAction: "none",
          userSelect: "none",
        }}
      >
        {edit && (
          <>
            <button
              type="button"
              className="drag-hide-btn"
              title="Önizlemeden kaldır"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onClick={(e) => {
                e.stopPropagation();
                void setVisible(key, false);
              }}
            >
              ×
            </button>
            {(["nw", "ne", "sw", "se"] as const).map((corner) => (
              <div
                key={corner}
                className="drag-resize-handle"
                data-corner={corner}
                title="Boyutlandır"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  const el = (e.currentTarget as HTMLElement).parentElement;
                  const rect = el?.getBoundingClientRect();
                  const cx = rect ? rect.left + rect.width / 2 : e.clientX;
                  const cy = rect ? rect.top + rect.height / 2 : e.clientY;
                  const dist = Math.hypot(e.clientX - cx, e.clientY - cy) || 1;
                  resizeKey.current = key;
                  resizeStart.current = {
                    x: e.clientX,
                    y: e.clientY,
                    size:
                      key === "ticker"
                        ? Number(displaySettings.tickerWidth) || 96
                        : displaySettings.sizes?.[key] || 100,
                    cx,
                    cy,
                    dist,
                  };
                  (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                }}
              />
            ))}
          </>
        )}
        {content}
      </div>
    );
  };
  return { metniKaydet, onPointerMove, onPointerUp, renderDraggable, setVisible };
}
