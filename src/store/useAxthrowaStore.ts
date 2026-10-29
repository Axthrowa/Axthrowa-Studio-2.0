/**
 * Uygulama geneli durum (zustand). Bileşenler yalnız ihtiyaç duyduğu alanı seçer; o alan değişmedikçe
 * yeniden çizilmez — props ile taşımaya gerek kalmaz:
 *
 *   const canli = useAxthrowaStore((s) => s.isLive);
 *
 * Kim günceller:
 * - OBS bağlantısı, sahne, yayın: `lib/obs.ts` (obs-websocket olayları) ve `ObsContext`
 * - Yayın durumu Rust'tan da gelir (`obs-stream-state`): `useAxthrowaStoreKoprusu` (panelde bir kez)
 * - Kick canlı durumu / izleyici: Dashboard'un 10 sn'lik yoklaması (`/api/kick/chatroom`)
 * - Sistem sağlığı (RAM/CPU): Rust `sistem-sagligi` olayı, 3 sn'de bir (pencere açıkken)
 * - Premium lisans: `lib/lisans.ts` (Rust doğrular, Windows Kimlik Bilgisi Yöneticisi'nde saklar)
 * - Dil: Ayarlar › Genel (`setLocale`), tarayıcı deposuna kalıcı yazılır
 */
import { create } from "zustand";
import { loadAppPrefs, saveAppPrefs, type AppLocale } from "../lib/appPrefs";
import { useAxthrowaEvents } from "../lib/useAxthrowaEvents";
import type { Lisans } from "../lib/lisans";

export type KickCanli = {
  live: boolean;
  viewers: number;
  followers: number;
  playbackUrl?: string | null;
  streamTitle?: string | null;
};

/** Uygulama + alt süreçleri (WebView2, bot…) toplamı */
export type SistemSagligi = { ramMb: number; cpu: number; surecSayisi: number };

type AxthrowaDurum = {
  isObsConnected: boolean;
  obsConnecting: boolean;
  obsLastError: string | null;
  /** OBS yayın çıkışı açık mı */
  isLive: boolean;
  /** OBS'te yayındaki (program) sahne */
  currentScene: string;
  locale: AppLocale;
  kick: KickCanli;
  sistem: SistemSagligi | null;
  lisans: Lisans | null;
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
  kick: { live: false, viewers: 0, followers: 0 },
  sistem: null,
  lisans: null,
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
  useAxthrowaEvents<SistemSagligi>("sistem-sagligi", (sistem) => useAxthrowaStore.setState({ sistem }));
}
