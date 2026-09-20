/** Platform marka renkleri + aktif bot teması */

export type BotPlatform = "kick" | "twitch" | "youtube" | "discord";

export const PLATFORM_BRAND: Record<
  BotPlatform,
  { label: string; color: string; ink: string; soft: string; hover: string }
> = {
  kick: {
    label: "Kick",
    color: "#3EEDFE",
    ink: "#032f34",
    soft: "rgba(62, 237, 254, 0.14)",
    hover: "#25cbd9",
  },
  twitch: {
    label: "Twitch",
    color: "#9146FF",
    ink: "#ffffff",
    soft: "rgba(145, 70, 255, 0.16)",
    hover: "#7c3aed",
  },
  youtube: {
    label: "YouTube",
    color: "#FF0000",
    ink: "#ffffff",
    soft: "rgba(255, 0, 0, 0.14)",
    hover: "#e00000",
  },
  discord: {
    label: "Discord",
    color: "#5865F2",
    ink: "#ffffff",
    soft: "rgba(88, 101, 242, 0.16)",
    hover: "#4752c4",
  },
};

/** Varsayılan vurgu — yeşil yerine turkuaz */
export const TURQUOISE = {
  color: "#3EEDFE",
  strong: "#25cbd9",
  soft: "rgba(62, 237, 254, 0.14)",
  ink: "#032f34",
  glow: "rgba(62, 237, 254, 0.18)",
};

const LS_PLATFORM = "yya.activePlatform";
let memoryPlatform: BotPlatform | null = null;

function canUseStorage() {
  return typeof localStorage !== "undefined";
}

export function getActivePlatform(): BotPlatform | null {
  try {
    const v = canUseStorage() ? localStorage.getItem(LS_PLATFORM) : memoryPlatform;
    if (v === "kick" || v === "twitch" || v === "youtube" || v === "discord") return v;
  } catch {
    /* */
  }
  return memoryPlatform;
}

export function setActivePlatform(platform: BotPlatform | null) {
  memoryPlatform = platform;
  try {
    if (canUseStorage()) {
      if (!platform) localStorage.removeItem(LS_PLATFORM);
      else localStorage.setItem(LS_PLATFORM, platform);
    }
  } catch {
    /* */
  }
  applyPlatformTheme(platform);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("yya-platform-theme", { detail: { platform } }));
  }
}

/** `#rrggbb` → "r g b" (Tailwind `rgb(var(--x) / <alpha>)` biçimi). */
export function hexToRgbTriple(hex: string): string {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (!/^[0-9a-f]{6}$/i.test(full) || Number.isNaN(n)) return "62 237 254";
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** Skin'in kendi vurgusunu geri getirmek için kaldırılan değişkenler. */
export const SKIN_ACCENT_KEYS = [
  "--panel-accent",
  "--panel-accent-strong",
  "--panel-accent-glow",
  "--panel-cta",
  "--panel-cta-ink",
  "--panel-soft",
  "--accent",
  "--accent-rgb",
  "--accent-text-rgb",
] as const;

/**
 * Platform seçimine göre yazılacak CSS değişkenleri.
 *
 * `null` değeri "bu değişkeni kaldır" demektir → skin'in kendi rengi geri gelir.
 *
 * ## Neden Kick ve platformsuz durumda hiçbir şey yazmıyoruz
 * Eskiden `platform` boşken bile turkuaz **inline** yazılıyordu. Inline stil CSS
 * skin bloklarını ezdiği için Crimson'ın altını ya da Cyber'in camgöbeğini hiç
 * göremiyordu: skin değişince arka plan değişiyor, vurgu rengi değişmiyordu.
 * Kick'in marka rengi zaten varsayılan skin'in vurgusuyla aynı (#3EEDFE); onu
 * ayrıca zorlamak yalnızca diğer skinleri bozuyordu.
 * Twitch/YouTube/Discord ise kullanıcının bilinçli seçimi — marka rengi geçerli.
 *
 * @param light açık tema mı — metin vurgusu için koyu ton seçilir; parlak
 *   marka renkleri beyaz zeminde okunmuyor.
 */
export function computePlatformVars(
  platform: BotPlatform | null,
  light = false
): Record<string, string | null> {
  const platformVars = (color: string, ink: string) => ({
    "--platform-color": color,
    "--platform-ink": ink,
  });

  if (!platform || platform === "kick") {
    const cleared: Record<string, string | null> = {};
    for (const k of SKIN_ACCENT_KEYS) cleared[k] = null;
    // Bu ikisi skin değil "aktif platform" bilgisi (BotPanel kullanıyor); her
    // zaman dolu kalmalı.
    return { ...cleared, ...platformVars(TURQUOISE.color, TURQUOISE.ink) };
  }

  const b = PLATFORM_BRAND[platform];
  return {
    "--panel-accent": b.color,
    "--panel-accent-strong": b.hover,
    "--panel-accent-glow": b.soft,
    "--panel-cta": b.color,
    "--panel-cta-ink": b.ink,
    "--panel-soft": b.soft,
    "--accent": b.color,
    "--accent-rgb": hexToRgbTriple(b.color),
    "--accent-text-rgb": hexToRgbTriple(light ? b.hover : b.color),
    ...platformVars(b.color, b.ink),
  };
}

/** documentElement CSS değişkenlerini güncelle */
export function applyPlatformTheme(platform: BotPlatform | null = getActivePlatform()) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (platform && platform !== "kick") root.dataset.platform = platform;
  else if (platform === "kick") root.dataset.platform = "kick";
  else delete root.dataset.platform;

  const vars = computePlatformVars(platform, root.classList.contains("theme-light"));
  for (const [key, value] of Object.entries(vars)) {
    if (value === null) root.style.removeProperty(key);
    else root.style.setProperty(key, value);
  }
}
