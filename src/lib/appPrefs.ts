import { MotionGlobalConfig } from "framer-motion";
import { applyPlatformTheme } from "./platformTheme";

export type AppTheme = "dark" | "light" | "system";
export type AppLocale = "tr" | "en";
export type Yogunluk = "rahat" | "siki";
export type Kose = "yuvarlak" | "az" | "keskin";
/** "sistem" yalnız işletim sisteminin azaltılmış hareket tercihini dinler; varsayılan "acik" (Windows'ta animasyonlar kapalı olsa da oynar). */
export type Hareket = "acik" | "azaltilmis" | "kapali" | "sistem";
export type MenuYazi = "kucuk" | "normal" | "buyuk" | "cokBuyuk";
/** Sol menü yazısının piksel boyu */
export const MENU_YAZI_PX: Record<MenuYazi, number> = { kucuk: 12, normal: 13, buyuk: 15, cokBuyuk: 17 };

export type AppPrefs = {
  theme: AppTheme;
  locale: AppLocale;
  openObsOnLaunch: boolean;
  obsExePath: string | null;
  yogunluk: Yogunluk;
  kose: Kose;
  hareket: Hareket;
  menuYazi: MenuYazi;
};

const KEY = "app.prefs";

export const DEFAULT_APP_PREFS: AppPrefs = {
  theme: "dark",
  locale: "tr",
  openObsOnLaunch: false,
  obsExePath: null,
  yogunluk: "rahat",
  kose: "yuvarlak",
  hareket: "acik",
  menuYazi: "normal",
};

const secenek = <T extends string>(v: unknown, izinli: readonly T[], varsayilan: T): T =>
  izinli.includes(v as T) ? (v as T) : varsayilan;

export function loadAppPrefs(): AppPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_APP_PREFS };
    const p = JSON.parse(raw) as Partial<AppPrefs>;
    return {
      theme: p.theme === "light" || p.theme === "system" || p.theme === "dark" ? p.theme : "dark",
      locale: p.locale === "en" ? "en" : "tr",
      openObsOnLaunch: !!p.openObsOnLaunch,
      obsExePath: typeof p.obsExePath === "string" && p.obsExePath ? p.obsExePath : null,
      yogunluk: secenek(p.yogunluk, ["rahat", "siki"], "rahat"),
      kose: secenek(p.kose, ["yuvarlak", "az", "keskin"], "yuvarlak"),
      hareket: secenek(p.hareket, ["acik", "azaltilmis", "kapali", "sistem"], "acik"),
      menuYazi: secenek(p.menuYazi, ["kucuk", "normal", "buyuk", "cokBuyuk"], "normal"),
    };
  } catch {
    return { ...DEFAULT_APP_PREFS };
  }
}

export function saveAppPrefs(prefs: AppPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* */
  }
}

export function resolveTheme(theme: AppTheme): "dark" | "light" {
  if (theme === "system") {
    return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return theme;
}

/** Açık zeminli skin seçiliyse koyu/açık tercihinden bağımsız açık temaya geçilir. */
const ACIK_SKINLER = ["gun-isigi"];

export function applyThemeToDom(theme: AppTheme) {
  const resolved = ACIK_SKINLER.includes(document.documentElement.dataset.skin ?? "") ? "light" : resolveTheme(theme);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.classList.toggle("theme-light", resolved === "light");
  document.documentElement.classList.toggle("theme-dark", resolved === "dark");
  // Metin vurgusu açık/koyu temaya göre değişiyor (parlak marka rengi beyaz
  // zeminde okunmaz); platform rengi yazılıysa yeniden hesapla.
  applyPlatformTheme();
}

/** "sistem" seçiliyse işletim sistemi tercihine göre çözülür. */
export function resolveHareket(h: Hareket): Exclude<Hareket, "sistem"> {
  if (h !== "sistem") return h;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "azaltilmis" : "acik";
}

/** Yoğunluk, köşe ve hareket tercihini kök öğeye yazar (CSS `data-*` özniteliklerini okur). */
export function applyArayuzToDom(p: Pick<AppPrefs, "yogunluk" | "kose" | "hareket"> & Partial<Pick<AppPrefs, "menuYazi">>) {
  const d = document.documentElement.dataset;
  document.documentElement.style.setProperty("--menu-yazi", `${MENU_YAZI_PX[p.menuYazi ?? "normal"]}px`);
  d.yogunluk = p.yogunluk;
  d.kose = p.kose;
  d.hareket = resolveHareket(p.hareket);
  // framer-motion animasyonları CSS'ten etkilenmez; "kapalı"da hepsi anında biter
  MotionGlobalConfig.skipAnimations = d.hareket === "kapali";
}
