/** Yazı tipi / efekt / animasyon kataloğu — en az 10 font */
export const FONT_OPTIONS: { id: string; label: string; stack: string }[] = [
  { id: "system", label: "Sistem", stack: '"Segoe UI", system-ui, sans-serif' },
  { id: "pixel8", label: "8-Bit", stack: '"Press Start 2P", monospace' },
  { id: "terminal", label: "Terminal", stack: '"VT323", monospace' },
  { id: "futuristic", label: "Fütüristik", stack: '"Orbitron", sans-serif' },
  { id: "bold", label: "Kalın Başlık", stack: '"Bebas Neue", sans-serif' },
  { id: "display", label: "Display", stack: '"Anton", sans-serif' },
  { id: "serif", label: "Serif", stack: '"Playfair Display", Georgia, serif' },
  { id: "hand", label: "El Yazısı", stack: '"Caveat", cursive' },
  { id: "mono", label: "Mono Code", stack: '"JetBrains Mono", "Consolas", monospace' },
  { id: "rounded", label: "Yuvarlak", stack: '"Nunito", system-ui, sans-serif' },
  { id: "condensed", label: "Dar", stack: '"Oswald", sans-serif' },
  { id: "impact", label: "Impact", stack: '"Black Ops One", system-ui, sans-serif' },
];

export const FONT_STACKS: Record<string, string> = Object.fromEntries(
  FONT_OPTIONS.map((f) => [f.id, f.stack])
);

export const EFFECT_OPTIONS: { id: string; label: string }[] = [
  { id: "none", label: "Yok" },
  { id: "glow", label: "Parlama" },
  { id: "shadow", label: "Gölge" },
  { id: "outline", label: "Kontur" },
  { id: "retro", label: "Retro Blok" },
  { id: "neon", label: "Neon" },
  { id: "emboss", label: "Kabartma" },
  { id: "soft", label: "Yumuşak Gölge" },
  { id: "fire", label: "Ateş Parıltısı" },
  { id: "ice", label: "Buz" },
  { id: "chrome", label: "Metalik" },
];

export const ANIM_OPTIONS: { id: string; label: string }[] = [
  { id: "none", label: "Yok" },
  { id: "pulse", label: "Nabız" },
  { id: "float", label: "Süzülme" },
  { id: "wiggle", label: "Sallanma" },
  { id: "blink", label: "Yanıp Sönme" },
  { id: "glowPulse", label: "Parlama Nabzı" },
  { id: "shake", label: "Titreme" },
  { id: "bounce", label: "Zıplama" },
];

export type TextStyle = {
  font?: string;
  size?: number;
  effect?: string;
  anim?: string;
  /** Yazı rengi */
  color?: string;
  /** Efekt vurgu rengi (glow/neon vb.) */
  accentColor?: string;
};

export const TEXT_STYLE_KEYS = ["eyebrow", "title", "sub", "countdown", "ticker", "credits"] as const;
export type TextStyleKey = (typeof TEXT_STYLE_KEYS)[number];

export const TEXT_STYLE_LABELS: Record<TextStyleKey, string> = {
  eyebrow: "Üst etiket",
  title: "Ana başlık",
  sub: "Alt başlık",
  countdown: "Geri sayım / rozet",
  ticker: "Alt not",
  credits: "Jenerik",
};
