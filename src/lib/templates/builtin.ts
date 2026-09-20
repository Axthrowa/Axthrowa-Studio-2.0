import type { ScreenTemplate, TemplateScreen } from "./fields";

/**
 * Hazır şablonlar. Yalnız görünüm taşır (bkz. `fields.ts`): renk, yazı tipi,
 * efekt, yerleşim, parçacık, sayaç biçimi. Video/görsel/logo kullanıcıda kalır.
 *
 * Arka plan hep dosyasız üç değerden biri (`mix|accent|dark`); şablon uygulanınca
 * kullanıcının videosu devre dışı kalır — bilinçli: "Şablon = ekranın görünümü".
 * Geri alma butonu bunu 10 sn boyunca tersine çevirir.
 */

const pos = (x: number, y: number) => ({ x, y });

function tpl(
  screen: TemplateScreen,
  id: string,
  name: string,
  description: string,
  settings: Record<string, any>
): ScreenTemplate {
  return { id: `builtin-${id}`, name, description, screen, builtin: true, settings };
}

/** Üstten alta: logo → etiket → başlık → alt yazı → sayaç → sosyal → alt not. */
const ORTALI = {
  logo: pos(50, 20),
  eyebrow: pos(50, 36),
  title: pos(50, 45),
  sub: pos(50, 55),
  countdown: pos(50, 68),
  socials: pos(50, 84),
  ticker: pos(50, 94),
};

/* -------------------------------------------------------------------- Giriş */

const GIRIS: ScreenTemplate[] = [
  tpl("starting", "giris-minimal", "Minimal Koyu", "Sade koyu zemin, ince yazı, küçük sayaç.", {
    eyebrow: "BİRAZDAN BAŞLIYORUZ",
    title: "Yayın birazdan başlıyor",
    sub: "Yerinizi alın",
    accent: "#8ab4ff",
    textColor: "#f4f6fb",
    eyebrowColor: "#8ab4ff",
    subColor: "#a9b1c6",
    countdownColor: "#f4f6fb",
    countdownStyle: "minimal",
    font: "system",
    bgStyle: "dark",
    particles: false,
    positions: ORTALI,
    textStyles: {
      title: { font: "system", size: 110, effect: "none", anim: "none", color: "#f4f6fb" },
      eyebrow: { font: "system", size: 85, effect: "none", anim: "none", color: "#8ab4ff" },
      sub: { font: "system", size: 100, effect: "none", anim: "none", color: "#a9b1c6" },
      countdown: { font: "system", size: 120, effect: "none", anim: "none", color: "#f4f6fb" },
    },
  }),
  tpl("starting", "giris-neon", "Neon Izgara", "Camgöbeği neon, parlayan başlık, kutulu sayaç.", {
    eyebrow: "CANLI YAYIN",
    title: "Az kaldı",
    sub: "Hazır mısın?",
    accent: "#00e5ff",
    textColor: "#eafcff",
    eyebrowColor: "#ff4de1",
    subColor: "#9fdcf0",
    countdownColor: "#00e5ff",
    countdownStyle: "boxes",
    font: "futuristic",
    bgStyle: "accent",
    particles: true,
    positions: ORTALI,
    textStyles: {
      title: { font: "futuristic", size: 120, effect: "neon", anim: "glowPulse", color: "#eafcff", accentColor: "#00e5ff" },
      eyebrow: { font: "futuristic", size: 80, effect: "glow", anim: "none", color: "#ff4de1", accentColor: "#ff4de1" },
      sub: { font: "system", size: 100, effect: "none", anim: "none", color: "#9fdcf0" },
      countdown: { font: "futuristic", size: 125, effect: "neon", anim: "pulse", color: "#00e5ff", accentColor: "#00e5ff" },
    },
  }),
  tpl("starting", "giris-retro", "Retro CRT", "Yeşil terminal yazısı, 8-bit başlık.", {
    eyebrow: "> BAĞLANIYOR...",
    title: "YAYIN BAŞLIYOR",
    sub: "LÜTFEN BEKLEYİN",
    accent: "#39ff14",
    textColor: "#b6ffb0",
    eyebrowColor: "#39ff14",
    subColor: "#7dd97a",
    countdownColor: "#39ff14",
    countdownStyle: "minimal",
    font: "terminal",
    bgStyle: "dark",
    particles: false,
    positions: ORTALI,
    textStyles: {
      title: { font: "pixel8", size: 80, effect: "glow", anim: "blink", color: "#b6ffb0", accentColor: "#39ff14" },
      eyebrow: { font: "terminal", size: 130, effect: "none", anim: "none", color: "#39ff14" },
      sub: { font: "terminal", size: 140, effect: "none", anim: "none", color: "#7dd97a" },
      countdown: { font: "pixel8", size: 90, effect: "glow", anim: "none", color: "#39ff14", accentColor: "#39ff14" },
    },
  }),
];

/* -------------------------------------------------------------------- Çıkış */

const CIKIS: ScreenTemplate[] = [
  tpl("ending", "cikis-tesekkur", "Teşekkürler", "Sıcak tonlar, büyük teşekkür başlığı.", {
    eyebrow: "YAYIN BİTTİ",
    title: "İzlediğiniz için teşekkürler",
    sub: "Bir sonraki yayında görüşürüz",
    accent: "#ffb84d",
    textColor: "#fff6e8",
    eyebrowColor: "#ffb84d",
    subColor: "#e6cfae",
    countdownColor: "#fff6e8",
    countdownStyle: "minimal",
    font: "serif",
    bgStyle: "mix",
    particles: true,
    positions: ORTALI,
    textStyles: {
      title: { font: "serif", size: 115, effect: "soft", anim: "float", color: "#fff6e8", accentColor: "#ffb84d" },
      eyebrow: { font: "system", size: 85, effect: "none", anim: "none", color: "#ffb84d" },
      sub: { font: "hand", size: 150, effect: "none", anim: "none", color: "#e6cfae" },
      countdown: { font: "serif", size: 100, effect: "none", anim: "none", color: "#fff6e8" },
    },
  }),
  tpl("ending", "cikis-kredi", "Kredi Akışı", "Film jeneriği havası: koyu zemin, kayan yazı.", {
    eyebrow: "YAPIM",
    title: "Görüşmek üzere",
    sub: "Takip etmeyi unutma",
    accent: "#e5e7eb",
    textColor: "#f5f5f5",
    eyebrowColor: "#9ca3af",
    subColor: "#b8bcc6",
    countdownColor: "#f5f5f5",
    countdownStyle: "minimal",
    font: "condensed",
    bgStyle: "dark",
    particles: false,
    creditsEnabled: true,
    creditsSize: 130,
    tickerSpeed: 9,
    positions: { ...ORTALI, credits: pos(50, 70) },
    textStyles: {
      title: { font: "condensed", size: 125, effect: "none", anim: "none", color: "#f5f5f5" },
      eyebrow: { font: "condensed", size: 85, effect: "none", anim: "none", color: "#9ca3af" },
      sub: { font: "condensed", size: 105, effect: "none", anim: "none", color: "#b8bcc6" },
      credits: { font: "condensed", size: 130, effect: "none", anim: "none", color: "#f5f5f5" },
    },
  }),
];

/* --------------------------------------------------------------------- Mola */

const MOLA: ScreenTemplate[] = [
  tpl("brb", "mola-kahve", "Kahve Molası", "Sıcak kahve tonları, yumuşak süzülen başlık.", {
    eyebrow: "KISA BİR MOLA",
    title: "Hemen dönüyorum",
    sub: "Bir kahve alıp geliyorum",
    accent: "#d99a5b",
    textColor: "#fff3e6",
    eyebrowColor: "#d99a5b",
    subColor: "#dcc3a6",
    countdownColor: "#fff3e6",
    countdownStyle: "minimal",
    font: "rounded",
    bgStyle: "mix",
    particles: true,
    positions: {
      logo: pos(50, 22),
      eyebrow: pos(50, 38),
      title: pos(50, 47),
      sub: pos(50, 57),
      countdown: pos(50, 70),
      socials: pos(50, 86),
    },
    textStyles: {
      title: { font: "rounded", size: 115, effect: "soft", anim: "float", color: "#fff3e6", accentColor: "#d99a5b" },
      eyebrow: { font: "rounded", size: 85, effect: "none", anim: "none", color: "#d99a5b" },
      sub: { font: "hand", size: 150, effect: "none", anim: "none", color: "#dcc3a6" },
      countdown: { font: "rounded", size: 130, effect: "none", anim: "none", color: "#fff3e6" },
    },
  }),
  tpl("brb", "mola-odak", "Odak Sayacı", "Büyük, dikkat dağıtmayan geri sayım.", {
    eyebrow: "MOLADAYIZ",
    title: "Birazdan devam",
    sub: "",
    accent: "#7cf5c1",
    textColor: "#eafff6",
    eyebrowColor: "#7cf5c1",
    subColor: "#a5d8c3",
    countdownColor: "#7cf5c1",
    countdownStyle: "boxes",
    font: "mono",
    bgStyle: "dark",
    particles: false,
    positions: {
      logo: pos(50, 16),
      eyebrow: pos(50, 30),
      title: pos(50, 38),
      countdown: pos(50, 60),
      sub: pos(50, 78),
      socials: pos(50, 88),
    },
    textStyles: {
      title: { font: "mono", size: 100, effect: "none", anim: "none", color: "#eafff6" },
      eyebrow: { font: "mono", size: 80, effect: "none", anim: "none", color: "#7cf5c1" },
      countdown: { font: "mono", size: 190, effect: "glow", anim: "none", color: "#7cf5c1", accentColor: "#7cf5c1" },
    },
  }),
];

export const BUILTIN_TEMPLATES: ScreenTemplate[] = [...GIRIS, ...CIKIS, ...MOLA];

export function builtinFor(screen: TemplateScreen): ScreenTemplate[] {
  return BUILTIN_TEMPLATES.filter((t) => t.screen === screen);
}
