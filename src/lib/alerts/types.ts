/** Botrix-tarzı derin alerts yapılandırması — Advanced Settings tam kapsam */

export type AlertEventId = "sub" | "gifted" | "follow" | "host" | "tip" | "raid";

/** Yerleşim (disposition / layout) */
export type AlertLayoutMode = "image-top" | "side-by-side" | "text-over";

/** Stil kutusu */
export type AlertStyleMode = "compact" | "banner" | "card" | "minimal";

export type AlertAnimIn =
  | "none"
  | "fade"
  | "slide"
  | "slide-up"
  | "slide-down"
  | "slide-left"
  | "slide-right"
  | "zoom"
  | "zoom-down"
  | "bounce"
  | "flip"
  | "glitch";

export type AlertAnimOut = "fade" | "slide" | "none";

export type AlertTextEffect =
  | "none"
  | "wiggle"
  | "wave"
  | "shine"
  | "skew"
  | "elastic"
  | "bounce"
  | "pulse"
  | "shake";

export type AlertTypeConfig = {
  enabled: boolean;
  layout: AlertLayoutMode;
  styleMode: AlertStyleMode;
  /** Örn: `{name} takip etti!` */
  template: string;
  mediaPath: string;
  soundPath: string;
  /** 0–1 */
  volume: number;
  nameColor: string;
  textColor: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  letterSpacing: number;
  /** 0–24 px blur */
  textShadow: number;
  animIn: AlertAnimIn;
  animOut: AlertAnimOut;
  /** Ekranda kalma (saniye) */
  durationSec: number;
  /** Text animation */
  textEffect: AlertTextEffect;
  hideMessage: boolean;
  /** Disposition offsets (−40…40) */
  posX: number;
  posY: number;
  ttsEnabled: boolean;
  ttsLang: string;
  ttsRate: number;
  ttsVolume: number;
  ttsPitch: number;
  customCss: string;
  minAmount: number;
};

export const ANIM_IN_OPTIONS: { id: AlertAnimIn; label: string }[] = [
  { id: "none", label: "None" },
  { id: "fade", label: "Fade" },
  { id: "slide-up", label: "Slide Up" },
  { id: "slide-down", label: "Slide Down" },
  { id: "slide-left", label: "Slide Left" },
  { id: "slide-right", label: "Slide Right" },
  { id: "zoom", label: "Zoom" },
  { id: "zoom-down", label: "Zoom Down" },
  { id: "bounce", label: "Bounce" },
  { id: "flip", label: "Flip" },
  { id: "glitch", label: "Glitch" },
];

function normalizeAnimIn(raw: string): AlertAnimIn {
  const v = raw.toLowerCase().replace(/\s+/g, "-");
  if (ANIM_IN_OPTIONS.some((o) => o.id === v)) return v as AlertAnimIn;
  if (v === "slide") return "slide-up";
  return "fade";
}

export function defaultAlertType(id: AlertEventId): AlertTypeConfig {
  const templates: Record<AlertEventId, string> = {
    sub: "{name} subscribed x{amount}!",
    gifted: "{name} gifted {amount} subs!",
    follow: "{name} followed!",
    host: "{name} hosted with {amount}!",
    tip: "{name} tipped {amount}!",
    raid: "{name} — {amount} kicks!",
  };
  const accents: Record<AlertEventId, string> = {
    sub: "#38bdf8",
    gifted: "#22d3ee",
    follow: "#f59e0b",
    host: "#34d399",
    tip: "#fb7185",
    raid: "#3EEDFE",
  };
  return {
    enabled: true,
    layout: "image-top",
    styleMode: "compact",
    template: templates[id],
    mediaPath: "",
    soundPath: "",
    volume: 0.35,
    nameColor: accents[id],
    textColor: "#ffffff",
    fontFamily: "Outfit, system-ui, sans-serif",
    fontSize: 32,
    fontWeight: 700,
    letterSpacing: 0,
    textShadow: 4,
    animIn: "bounce",
    animOut: "fade",
    durationSec: 6,
    textEffect: "wiggle",
    hideMessage: false,
    posX: 0,
    posY: 0,
    ttsEnabled: false,
    ttsLang: "tr-TR",
    ttsRate: 1,
    ttsVolume: 0.85,
    ttsPitch: 1,
    customCss: "",
    minAmount: 0,
  };
}

export function isAlertEventId(id: string): id is AlertEventId {
  return ["sub", "gifted", "follow", "host", "tip", "raid"].includes(id);
}

/** DB AlertType satırından Botrix config çıkar */
export function configFromDbRow(row: Record<string, unknown>): AlertTypeConfig {
  const idRaw = String(row.id || "follow");
  const id: AlertEventId = isAlertEventId(idRaw) ? idRaw : "follow";
  const base = defaultAlertType(id);
  let extras: Partial<AlertTypeConfig> & Record<string, unknown> = {};
  try {
    const raw = String(row.custom_html || row.customHtml || "");
    if (raw.trim().startsWith("{")) extras = JSON.parse(raw) as Partial<AlertTypeConfig>;
  } catch {
    /* */
  }

  const layoutRaw = String(row.layout || extras.layout || extras.styleMode || base.layout);
  let layout: AlertLayoutMode = base.layout;
  let styleMode: AlertStyleMode = base.styleMode;
  if (layoutRaw === "side-by-side" || layoutRaw === "text-over" || layoutRaw === "image-top") {
    layout = layoutRaw;
  } else if (layoutRaw === "banner" || layoutRaw === "card" || layoutRaw === "compact" || layoutRaw === "minimal") {
    styleMode = layoutRaw as AlertStyleMode;
  }
  if (extras.styleMode === "banner" || extras.styleMode === "card" || extras.styleMode === "compact" || extras.styleMode === "minimal") {
    styleMode = extras.styleMode;
  }
  if (extras.layout === "side-by-side" || extras.layout === "text-over" || extras.layout === "image-top") {
    layout = extras.layout;
  }

  return {
    ...base,
    ...extras,
    enabled: row.enabled === true || row.enabled === 1 || Number(row.enabled) === 1,
    template: String(row.template || extras.template || base.template),
    mediaPath: String(row.media_path ?? row.mediaPath ?? extras.mediaPath ?? ""),
    soundPath: String(row.sound_path ?? row.soundPath ?? extras.soundPath ?? ""),
    volume: Number(row.volume ?? extras.volume ?? base.volume),
    textColor: String(row.text_color ?? row.textColor ?? extras.textColor ?? base.textColor),
    nameColor: String(row.accent_color ?? row.accentColor ?? extras.nameColor ?? base.nameColor),
    fontFamily: String(row.font_family ?? row.fontFamily ?? extras.fontFamily ?? base.fontFamily),
    fontSize: Number(row.font_size ?? row.fontSize ?? extras.fontSize ?? base.fontSize),
    fontWeight: Number(extras.fontWeight ?? base.fontWeight),
    letterSpacing: Number(extras.letterSpacing ?? base.letterSpacing),
    animIn: normalizeAnimIn(String(row.anim_in ?? row.animIn ?? extras.animIn ?? base.animIn)),
    animOut: (String(row.anim_out ?? row.animOut ?? extras.animOut ?? base.animOut) as AlertAnimOut) || "fade",
    durationSec: Math.max(
      1,
      extras.durationSec != null && Number.isFinite(Number(extras.durationSec))
        ? Math.round(Number(extras.durationSec))
        : Math.round(Number(row.duration_ms ?? row.durationMs ?? base.durationSec * 1000) / 1000)
    ),
    textShadow: Number(extras.textShadow ?? base.textShadow),
    textEffect: (String(extras.textEffect ?? base.textEffect) as AlertTextEffect) || "none",
    hideMessage: Boolean(extras.hideMessage ?? base.hideMessage),
    posX: Number(extras.posX ?? base.posX),
    posY: Number(extras.posY ?? base.posY),
    ttsEnabled:
      row.tts_enabled === true ||
      row.tts_enabled === 1 ||
      Number(row.tts_enabled) === 1 ||
      Boolean(extras.ttsEnabled),
    ttsLang: String(row.tts_lang ?? extras.ttsLang ?? base.ttsLang),
    ttsRate: Number(row.tts_rate ?? extras.ttsRate ?? base.ttsRate),
    ttsVolume: Number(row.tts_volume ?? extras.ttsVolume ?? base.ttsVolume),
    ttsPitch: Number(extras.ttsPitch ?? base.ttsPitch),
    customCss: String(row.custom_css ?? extras.customCss ?? ""),
    minAmount: Number(row.min_amount ?? extras.minAmount ?? 0),
    layout,
    styleMode,
  };
}

export function formatAlertTemplate(
  tpl: string,
  vars: { name?: string; amount?: string | number; message?: string }
) {
  return tpl
    .replace(/\{name\}/gi, String(vars.name || ""))
    .replace(/\{user\}/gi, String(vars.name || ""))
    .replace(/\{amount\}/gi, vars.amount != null && vars.amount !== "" ? String(vars.amount) : "")
    .replace(/\{message\}/gi, String(vars.message || ""))
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function mapKindToEventId(kind: string): AlertEventId {
  const k = kind.toLowerCase();
  if (k === "sub" || k === "subscription" || k === "membership") return "sub";
  if (k === "gifted" || k === "gift" || k === "giftsub") return "gifted";
  if (k === "follow" || k === "followers") return "follow";
  if (k === "host") return "host";
  if (k === "tip" || k === "donation" || k === "bits" || k === "superchat") return "tip";
  if (k === "raid" || k === "kick" || k === "kicks") return "raid";
  return "follow";
}

export function speakAlertTts(text: string, cfg: Pick<AlertTypeConfig, "ttsEnabled" | "ttsLang" | "ttsRate" | "ttsVolume" | "ttsPitch">) {
  if (!cfg.ttsEnabled || !text) return;
  try {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = cfg.ttsLang || "tr-TR";
    u.rate = Math.min(2, Math.max(0.5, cfg.ttsRate || 1));
    u.volume = Math.min(1, Math.max(0, cfg.ttsVolume ?? 0.85));
    u.pitch = Math.min(2, Math.max(0.5, cfg.ttsPitch || 1));
    const voices = window.speechSynthesis.getVoices() || [];
    const match = voices.find((v) => v.lang?.toLowerCase().startsWith((cfg.ttsLang || "tr").slice(0, 2).toLowerCase()));
    if (match) u.voice = match;
    window.speechSynthesis.speak(u);
  } catch {
    /* */
  }
}
