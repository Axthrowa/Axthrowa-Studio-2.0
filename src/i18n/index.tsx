import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { en, tr, type MsgKey } from "./messages";
import type { AppLocale } from "../lib/appPrefs";

const tables = { tr, en } as const;

type I18nCtx = {
  locale: AppLocale;
  setLocale: (l: AppLocale) => void;
  t: (key: MsgKey) => string;
};

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({
  locale: initial,
  onLocaleChange,
  children,
}: {
  locale: AppLocale;
  onLocaleChange?: (l: AppLocale) => void;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<AppLocale>(initial);
  useEffect(() => {
    setLocaleState(initial);
  }, [initial]);
  const setLocale = useCallback(
    (l: AppLocale) => {
      setLocaleState(l);
      onLocaleChange?.(l);
    },
    [onLocaleChange]
  );
  const t = useCallback((key: MsgKey) => tables[locale][key] || tables.tr[key] || key, [locale]);
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return createElement(Ctx.Provider, { value }, children);
}

export function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n outside provider");
  return ctx;
}

/** Provider yoksa Türkçe fallback (overlay vb.). */
export function useT() {
  try {
    return useI18n().t;
  } catch {
    return (key: MsgKey) => tr[key] || key;
  }
}
