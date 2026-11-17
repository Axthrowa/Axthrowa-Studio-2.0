/** Panel içi canlı önizleme — iframe yok (boş ekran / CSP sorunlarını önler) */
import { useEffect, useMemo, useRef, useState } from "react";
import { SpeakerHigh, SpeakerSlash } from "@phosphor-icons/react";
import OverlayShell from "../overlay/OverlayShell";
import UnifiedChatPanel from "./UnifiedChatPanel";
import { OverlaySettings, ScreenId } from "../../lib/api";
import { PreviewQualityProvider } from "../../lib/previewQuality";
import { useStreamPreviewEpoch } from "../../lib/useStreamPreviewEpoch";

/** OBS Browser Source ölçüsü — önizleme bunun minyatürü */
const CANVAS_W = 1920;
const CANVAS_H = 1080;
/** Önizleme penceresiyle tuval kenarı arasındaki boşluk: desen ve parlama görünsün (px) */
const TUVAL_PAYI = 28;

type Props = {
  screen: ScreenId;
  settings: OverlaySettings;
  onPatch: (patch: OverlaySettings) => void;
  /** Süre / medya bitince (Giriş→oyun, Çıkış→Stop Stream) */
  onCountdownEnd?: (settings: OverlaySettings) => void;
  /** Tuvalde bir parçaya tıklandı */
  onPartSelect?: (key: string) => void;
};

export default function LivePreview({ screen, settings, onPatch, onCountdownEnd, onPartSelect }: Props) {
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
      onPartSelect={onPartSelect}
    />
  );
}

/**
 * Stüdyo çalışma tuvali: noktalı zemin, ortadan yayılan menekşe parlama ve ortada 1920×1080 overlay'in
 * kutuya sığacak kadar küçültülmüş hâli. Pencere sert çizgiyle değil, yumuşak gölge ve ince iç ışıkla ayrılır.
 */
function ScaledOverlay({ screen, settings, onPatch, onCountdownEnd, onPartSelect }: Props) {
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
      // Dar kutuda pay küçülür: önizleme alandan fazla kaybetmesin
      const pay = Math.min(TUVAL_PAYI, width * 0.04, height * 0.06);
      setScale(Math.max(0.05, Math.min((width - pay * 2) / CANVAS_W, (height - pay * 2) / CANVAS_H)));
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
    <div
      ref={boxRef}
      className="relative h-full w-full overflow-hidden rounded-2xl bg-axthrowa-dark bg-[radial-gradient(#27272a_1px,transparent_1px)] bg-[size:20px_20px]"
    >
      {/* Derinlik: tuvalin ortasından dışa sönen koyu menekşe parlama */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_50%_50%,rgb(var(--ui-brand)/0.14),rgb(var(--ui-brand)/0.04)_45%,transparent_75%)]" />

      {/* Önizleme penceresi: ölçeklenmiş boyutunda, ortada; çizgi yerine yayılan gölge ve ince iç ışık */}
      <div
        className="absolute left-1/2 top-1/2 overflow-hidden rounded-xl bg-black shadow-[0_0_40px_rgb(var(--ui-brand)/0.1),var(--ui-shadow-float)] ring-1 ring-white/10"
        style={{
          width: CANVAS_W * scale,
          height: CANVAS_H * scale,
          transform: "translate(-50%, -50%)",
        }}
      >
        <div
          style={{
            width: CANVAS_W,
            height: CANVAS_H,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
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
                onPartSelect={onPartSelect}
              />
            </PreviewQualityProvider>
          </div>
        </div>
      </div>

      {/* Stüdyo etiketi: üstte ortada, çerçevesiz cam hap */}
      <div className="pointer-events-none absolute left-1/2 top-4 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-axthrowa-card/80 px-3 py-1.5 shadow-panel backdrop-blur-md">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500 shadow-[0_0_8px_rgb(var(--ui-danger)/0.9)]" />
        <span className="text-ui-2 axt-etiket font-semibold text-zinc-300">Canlı önizleme</span>
        <span className="font-mono text-ui-2 text-zinc-400">1920×1080</span>
      </div>

      {/* Ses: sağ alt köşede cam hap */}
      <div className="absolute bottom-4 right-4 z-50 flex items-center gap-3 rounded-full bg-axthrowa-card/85 py-2 pl-3 pr-4 shadow-panel backdrop-blur-md">
        <button
          type="button"
          className="p-1 transition-colors duration-200"
          aria-label={previewMuted ? "Önizleme sesini aç" : "Önizleme sesini kapat"}
          title={previewMuted ? "Önizleme sesini aç" : "Önizleme sesini kapat"}
          onClick={() => setPreviewMuted((v) => !v)}
        >
          {previewMuted || previewVolume === 0 ? (
            <SpeakerSlash weight="bold" className="h-4 w-4 text-zinc-500 hover:text-zinc-300" />
          ) : (
            <SpeakerHigh weight="duotone" className="h-4 w-4 text-axthrowa-cyan hover:brightness-125" />
          )}
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={previewMuted ? 0 : previewVolume}
          aria-label="Önizleme ses seviyesi"
          className="ns-range w-24 accent-axthrowa-cyan"
          onChange={(e) => {
            setPreviewVolume(Number(e.target.value));
            setPreviewMuted(false);
          }}
        />
        <span className="w-8 text-right font-mono text-ui-2 text-zinc-400">
          {previewMuted ? 0 : previewVolume}%
        </span>
      </div>
    </div>
  );
}
