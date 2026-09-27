/**
 * BotAxt Global Tema Motoru — data-skin + CSS değişkenleri.
 * Temalar: Night Signal · Crimson Dragon · Cyber Neon · Aurora · Warm Sepia · Mono Contrast
 * (NVIDIA MCP ile renk/pattern yönü üretildi)
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type StudioSkin =
  | "night-signal"
  | "crimson-dragon"
  | "cyber-neon"
  | "aurora"
  | "warm-sepia"
  | "mono-contrast";

export type SkinMeta = {
  id: StudioSkin;
  label: string;
  hint: string;
  swatch: [string, string];
};

export const STUDIO_SKINS: SkinMeta[] = [
  {
    id: "night-signal",
    label: "Night Signal",
    hint: "Slate · cyan · coral",
    swatch: ["#0b0f19", "#22d3ee"],
  },
  {
    id: "crimson-dragon",
    label: "Crimson Dragon",
    hint: "Obsidyen · altın · kızıl",
    swatch: ["#140808", "#e8b84a"],
  },
  {
    id: "cyber-neon",
    label: "Cyber Neon",
    hint: "Synthwave · pembe · elektrik",
    swatch: ["#07061a", "#ff2bd6"],
  },
  {
    id: "aurora",
    label: "Aurora Turkuaz",
    hint: "Turkuaz · okyanus siber",
    swatch: ["#0a0f1c", "#3EEDFE"],
  },
  {
    id: "warm-sepia",
    label: "Warm Sepia",
    hint: "Kahve · krem · bakır",
    swatch: ["#17110c", "#e0a96d"],
  },
  {
    id: "mono-contrast",
    label: "Mono Contrast",
    hint: "Siyah · beyaz · sarı (yüksek kontrast)",
    swatch: ["#000000", "#ffd400"],
  },
];

export const DEFAULT_SKIN: StudioSkin = "night-signal";

/**
 * Kayıtlı skin metnini doğrular. Liste `STUDIO_SKINS`'ten geldiği için yeni bir
 * skin eklemek yalnız listeye girdi eklemektir; eskiden üç id sabit kodluydu ve
 * yeni skinler localStorage'dan geri yüklenemezdi.
 */
export function parseSkin(raw: unknown, ids: readonly string[] = STUDIO_SKINS.map((s) => s.id)): StudioSkin {
  return typeof raw === "string" && ids.includes(raw) ? (raw as StudioSkin) : DEFAULT_SKIN;
}

const STORAGE_KEY = "botaxt.studio.skin";

type ThemeCtx = {
  skin: StudioSkin;
  setSkin: (s: StudioSkin) => void;
  skins: SkinMeta[];
};

const Ctx = createContext<ThemeCtx | null>(null);

function readSkin(): StudioSkin {
  try {
    return parseSkin(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_SKIN;
  }
}

export function applySkinToDom(skin: StudioSkin) {
  const root = document.documentElement;
  root.dataset.skin = skin;
  for (const s of STUDIO_SKINS) root.classList.toggle(`skin-${s.id}`, s.id === skin);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [skin, setSkinState] = useState<StudioSkin>(() =>
    typeof window !== "undefined" ? readSkin() : DEFAULT_SKIN
  );

  useEffect(() => {
    applySkinToDom(skin);
    try {
      localStorage.setItem(STORAGE_KEY, skin);
    } catch {
      /* */
    }
  }, [skin]);

  const setSkin = useCallback((s: StudioSkin) => {
    setSkinState(s);
  }, []);

  const value = useMemo(
    () => ({ skin, setSkin, skins: STUDIO_SKINS }),
    [skin, setSkin]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStudioTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useStudioTheme must be used within ThemeProvider");
  }
  return ctx;
}
