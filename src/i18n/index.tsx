/**
 * Çok dil (tr varsayılan, en ikinci). Tablolar pakette: yükleme beklemesi (Suspense) yok, sağlayıcı da gerekmez —
 * dil `useAxthrowaStore`da tutulur, değişince yalnız metin okuyan bileşenler yeniden çizilir.
 *
 *   const t = useT();                        <WidgetCard title={t("nav.settings")} />
 *   const { locale, setLocale } = useI18n();  setLocale("en")   // kalıcı (appPrefs)
 *
 * Tabloda olmayan anahtar Türkçeye, o da yoksa anahtarın kendisine düşer.
 */
import { useCallback } from "react";
import { en, tr, type MsgKey } from "./messages";
import { useAxthrowaStore } from "../store/useAxthrowaStore";

const tables = { tr, en } as const;

export function useI18n() {
  const locale = useAxthrowaStore((s) => s.locale);
  const setLocale = useAxthrowaStore((s) => s.setLocale);
  const t = useCallback((key: MsgKey) => tables[locale][key] || tables.tr[key] || key, [locale]);
  return { locale, setLocale, t };
}

export function useT() {
  return useI18n().t;
}
