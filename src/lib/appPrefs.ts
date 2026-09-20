import { applyPlatformTheme } from "./platformTheme";

export type AppTheme = "dark" | "light" | "system";
export type AppLocale = "tr" | "en";

export type AppPrefs = {
  theme: AppTheme;
  locale: AppLocale;
  openObsOnLaunch: boolean;
  obsExePath: string | null;
};

const KEY = "app.prefs";

export const DEFAULT_APP_PREFS: AppPrefs = {
  theme: "dark",
  locale: "tr",
  openObsOnLaunch: false,
  obsExePath: null,
};

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

export function applyThemeToDom(theme: AppTheme) {
  const resolved = resolveTheme(theme);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.classList.toggle("theme-light", resolved === "light");
  document.documentElement.classList.toggle("theme-dark", resolved === "dark");
  // Metin vurgusu açık/koyu temaya göre değişiyor (parlak marka rengi beyaz
  // zeminde okunmaz); platform rengi yazılıysa yeniden hesapla.
  applyPlatformTheme();
}
