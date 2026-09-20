/** Panel içi canlı önizleme — iframe yok (boş ekran / CSP sorunlarını önler) */
import { useEffect, useMemo, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import OverlayShell from "../overlay/OverlayShell";
import UnifiedChatPanel from "./UnifiedChatPanel";
import { OverlaySettings, ScreenId } from "../../lib/api";
import { PreviewQualityProvider } from "../../lib/previewQuality";
import { useStreamPreviewEpoch } from "../../lib/useStreamPreviewEpoch";

/** OBS Browser Source ölçüsü — önizleme bunun minyatürü */
const CANVAS_W = 1920;
const CANVAS_H = 1080;

type Props = {
  screen: ScreenId;
  settings: OverlaySettings;
  onPatch: (patch: OverlaySettings) => void;
  /** Süre / medya bitince (Giriş→oyun, Çıkış→Stop Stream) */
  onCountdownEnd?: (settings: OverlaySettings) => void;
};

export default function LivePreview({ screen, settings, onPatch, onCountdownEnd }: Props) {
  if (screen === "chat") {
    return (
      <div className="h-full min-h-0 w-full overflow-hidden">
        <UnifiedChatPanel settings={settings} />
      </div>
    );
  }
  return (
    <ScaledOverlay
      screen={screen}
      settings={settings}
      onPatch={onPatch}
      onCountdownEnd={onCountdownEnd}
    />
  );
}

/**
 * Overlay'i gerçek 1920×1080 tuvalinde çizip kutuya sığacak kadar küçültür.
 */
function ScaledOverlay({ screen, settings, onPatch, onCountdownEnd }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mediaEpoch = useStreamPreviewEpoch();
  const [scale, setScale] = useState(0.25);
  const [previewVolume, setPreviewVolume] = useState(() => {
    const saved = Number(localStorage.getItem("panel.previewVolume"));
    return Number.isFinite(saved) ? Math.max(0, Math.min(100, saved)) : 25;
  });
  const [previewMuted, setPreviewMuted] = useState(
    () => localStorage.getItem("panel.previewMuted") === "1"
  );
  const previewSettings = useMemo(() => {
    const factor = previewMuted ? 0 : previewVolume / 100;
    return {
      ...settings,
      videoSound: !!settings.videoSound && factor > 0,
      videoVolume: Math.round((Number(settings.videoVolume) || 100) * factor),
      musicVolume: Math.round((Number(settings.musicVolume) || 70) * factor),
    };
  }, [previewMuted, previewVolume, settings]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const fit = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width < 2 || height < 2) return;
      setScale(Math.min(width / CANVAS_W, height / CANVAS_H));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    localStorage.setItem("panel.previewVolume", String(previewVolume));
    localStorage.setItem("panel.previewMuted", previewMuted ? "1" : "0");
  }, [previewMuted, previewVolume]);

  return (
    <div ref={boxRef} className="relative h-full w-full overflow-hidden bg-black">
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: CANVAS_W,
          height: CANVAS_H,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        <div className="h-full w-full [&_.obs-canvas-wrap]:!h-full [&_.obs-canvas-wrap]:!w-full">
          <PreviewQualityProvider scale={scale}>
            <OverlayShell
              key={screen}
              screen={screen}
              initial={settings}
              liveSettings={previewSettings}
              forceEdit
              showCredits={screen === "ending"}
              showVisualizer={screen === "brb"}
              mediaEpoch={mediaEpoch}
              onPositionsPersist={(positions) => onPatch({ positions })}
              onLivePatch={onPatch}
              onCountdownEnd={onCountdownEnd}
            />
          </PreviewQualityProvider>
        </div>
      </div>
      <div className="absolute bottom-3 right-3 z-50 flex items-center gap-2 rounded-full border border-white/15 bg-black/75 px-3 py-2 shadow-xl">
        <button
          type="button"
          className="text-panel-accent"
          title={previewMuted ? "Önizleme sesini aç" : "Önizleme sesini kapat"}
          onClick={() => setPreviewMuted((v) => !v)}
        >
          {previewMuted || previewVolume === 0 ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={previewMuted ? 0 : previewVolume}
          aria-label="Önizleme ses seviyesi"
          className="ns-range w-24"
          onChange={(e) => {
            setPreviewVolume(Number(e.target.value));
            setPreviewMuted(false);
          }}
        />
        <span className="w-8 text-right text-[10px] text-white/70">
          {previewMuted ? 0 : previewVolume}%
        </span>
      </div>
    </div>
  );
}
