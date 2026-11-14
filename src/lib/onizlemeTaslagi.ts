/**
 * A8b "Önce önizlemede dene": yayın açıkken sahne düzenleyicisindeki değişiklik OBS'e gitmez, panel önizlemesinde
 * görünür; "Yayına uygula" ile kaydedilir. Bekleyen değişiklik kaybolmasın: ekran değişince, yayın bitince ya da anahtar
 * kapanınca kendiliğinden uygulanır.
 */
import { create } from "zustand";

const ANAHTAR = "studio.onizlemedeDene";

export type Taslak = { ekran: string; veri: unknown };

type Durum = {
  acik: boolean;
  bekleyen: Taslak | null;
  /** PanelPage kaydeder: bekleyeni sunucuya yazar */
  uygulayici: ((t: Taslak) => Promise<void>) | null;
  ac: (acik: boolean) => void;
  beklet: (t: Taslak) => void;
  /** Bekleyeni uygular (yoksa bir şey yapmaz) */
  uygula: () => Promise<void>;
};

function oku(): boolean {
  try {
    return localStorage.getItem(ANAHTAR) === "1";
  } catch {
    return false;
  }
}

export const useOnizlemeTaslagi = create<Durum>()((set, get) => ({
  acik: oku(),
  bekleyen: null,
  uygulayici: null,
  ac: (acik) => {
    try {
      localStorage.setItem(ANAHTAR, acik ? "1" : "0");
    } catch {
      /* tercih kalıcı olmasa da anahtar çalışır */
    }
    set({ acik });
    if (!acik) void get().uygula();
  },
  beklet: (t) => set({ bekleyen: t }),
  uygula: async () => {
    const { bekleyen, uygulayici } = get();
    if (!bekleyen || !uygulayici) return;
    set({ bekleyen: null });
    try {
      await uygulayici(bekleyen);
    } catch (e) {
      // Yazılamadıysa geri koy: değişiklik kaybolmasın
      if (!get().bekleyen) set({ bekleyen });
      throw e;
    }
  },
}));
