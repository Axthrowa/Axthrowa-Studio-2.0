/** SahneAyarlari ve bölüm dosyalarının ortak alanları ve tipleri (TEK-4). */
import { lazy, type Dispatch, type SetStateAction } from "react";
import type { OverlaySettings, ScreenId } from "../../../lib/api";
import type { MsgKey } from "../../../i18n/messages";
import type { NavId } from "../../../lib/panelLayout";
import { type useNotices } from "../../../lib/notices";
import { type useVideoDownload } from "../../../lib/useVideoDownload";

/** Önizlemede tıklanan parça → ayar bölümü ve varsa alanı */
export const PARCA_AYARI: Record<string, { bolum: string; alan?: string }> = {
  logo: { bolum: "logo" },
  eyebrow: { bolum: "metin", alan: "eyebrow" },
  title: { bolum: "metin", alan: "title" },
  sub: { bolum: "metin", alan: "sub" },
  ticker: { bolum: "metin", alan: "ticker" },
  countdown: { bolum: "geriSayim" },
  socials: { bolum: "sosyal" },
  credits: { bolum: "jenerik" },
  nowPlaying: { bolum: "resonance" },
  lyrics: { bolum: "resonance" },
};

export function Field({
  alan,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  alan?: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div data-alan={alan}>
      <label className="mb-1.5 block text-xs font-bold axt-etiket text-white/85">{label}</label>
      <input
        aria-label={label}
        type={type}
        className="studio-input h-9 w-full rounded-xl border border-white/[0.12] bg-black/50 px-3 text-sm font-medium text-white outline-none transition-all duration-150 focus:border-panel-accent/70 focus:ring-1 focus:ring-panel-accent/40"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold axt-etiket text-white/85">{label}</label>
      <select
        aria-label={label}
        className="h-9 w-full rounded-xl border border-white/[0.12] bg-ui-s1 px-3 text-sm font-medium text-white outline-none transition-all duration-150 focus:border-panel-accent/70 focus:ring-1 focus:ring-panel-accent/40"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

export const TemplatePicker = lazy(() => import("../../../components/panel/TemplatePicker"));

export const VideoScrubber = lazy(() => import("../../../components/panel/VideoScrubber"));

export function clampInt(raw: string, min: number, max: number, fallback: number) {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}


export type SahneAyarlariProps = {
  PART_LABELS: Record<string, string>;
  bgFiles: string[];
  clearChatHk: string;
  clearChatNow: () => Promise<void>;
  creditCounts: { donors: number; subscribers: number; followers: number; };
  fetchKickChatroom: () => Promise<void>;
  handlePreviewCountdownEnd: (live: OverlaySettings) => Promise<void>;
  hiddenParts: string[];
  indirme: ReturnType<typeof useVideoDownload>;
  indirmeMetni: string;
  indirmeSuruyor: boolean;
  inputs: { name: string; kind: string; }[];
  logoFiles: string[];
  musicFiles: string[];
  notices: ReturnType<typeof useNotices>;
  obsConnected: boolean;
  obsUrl: string;
  openExternal: (url: string) => Promise<void>;
  panelsPinned: boolean;
  particleFiles: string[];
  particleKeys: string[];
  pickBackground: () => Promise<void>;
  pickLocalVideo: () => Promise<void>;
  pickLogo: () => Promise<void>;
  previewOn: boolean;
  refreshBackgrounds: () => void;
  refreshLogos: () => void;
  refreshMusic: () => void;
  refreshParticles: () => void;
  refreshVideos: () => void;
  resonanceOverlayUrl: string;
  restoreAllParts: () => void;
  restorePart: (key: string) => void;
  scenes: string[];
  screen: ScreenId;
  secOrder: (id: string, side?: boolean) => { order: number; };
  sectionHidden: (id: string) => boolean;
  setActiveNav: Dispatch<SetStateAction<NavId | ScreenId>>;
  setClearChatHk: Dispatch<SetStateAction<string>>;
  setCreditCounts: Dispatch<SetStateAction<{ donors: number; subscribers: number; followers: number; }>>;
  setHotkeyCapture: Dispatch<SetStateAction<boolean>>;
  setPanelsPinned: Dispatch<SetStateAction<boolean>>;
  setParticleFiles: Dispatch<SetStateAction<string[]>>;
  setPreviewOn: Dispatch<SetStateAction<boolean>>;
  settings: OverlaySettings;
  showToast: (m: string) => void;
  transitions: string[];
  tt: (key: MsgKey) => string;
  update: (patch: OverlaySettings) => void;
  videoFiles: string[];
};
