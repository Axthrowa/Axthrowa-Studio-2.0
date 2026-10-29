/**
 * Uygulama geneli durum (zustand). Bileşenler yalnız ihtiyaç duyduğu alanı seçer; o alan değişmedikçe
 * yeniden çizilmez — props ile taşımaya gerek kalmaz:
 *
 *   const canli = useAxthrowaStore((s) => s.isLive);
 *
 * Kim günceller:
 * - OBS bağlantısı, sahne, yayın: `lib/obs.ts` (obs-websocket olayları) ve `ObsContext`
 * - Yayın durumu Rust'tan da gelir (`obs-stream-state`): `useAxthrowaStoreKoprusu` (panelde bir kez)
 * - Dil: Ayarlar › Genel (`setLocale`), tarayıcı deposuna kalıcı yazılır
 */
import { create } from "zustand";
import { loadAppPrefs, saveAppPrefs, type AppLocale } from "../lib/appPrefs";
import { useAxthrowaEvents } from "../lib/useAxthrowaEvents";

type AxthrowaDurum = {
  isObsConnected: boolean;
  obsConnecting: boolean;
  obsLastError: string | null;
  /** OBS yayın çıkışı açık mı */
  isLive: boolean;
  /** OBS'te yayındaki (program) sahne */
  currentScene: string;
  locale: AppLocale;
  setLive: (canli: boolean) => void;
  setLocale: (dil: AppLocale) => void;
};

export const useAxthrowaStore = create<AxthrowaDurum>()((set) => ({
  isObsConnected: false,
  obsConnecting: false,
  obsLastError: null,
  isLive: false,
  currentScene: "",
  locale: loadAppPrefs().locale,
  setLive: (isLive) => set({ isLive }),
  setLocale: (locale) => {
    set({ locale });
    saveAppPrefs({ ...loadAppPrefs(), locale });
  },
}));

/** Rust olaylarını store'a bağlar. Panelde bir kez çağrılır; Tauri dışında bir şey yapmaz. */
export function useAxthrowaStoreKoprusu() {
  // OBS'te yayın elle (ya da kısayolla) başlatılıp durdurulsa da düğme ve noktalar doğru kalır
  useAxthrowaEvents<{ outputActive?: boolean }>("obs-stream-state", (v) => {
    if (typeof v?.outputActive === "boolean") useAxthrowaStore.setState({ isLive: v.outputActive });
  });
}
