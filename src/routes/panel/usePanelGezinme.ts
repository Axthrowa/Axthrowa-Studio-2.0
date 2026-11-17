/** PanelPage'den ayrıldı (TEK-4, davranış aynı): sayfa açma, sayfa adı ve gezinme geçmişi. */
import { useCallback, useEffect, useRef } from "react";
import { ScreenId } from "../../lib/api";
import { type MenuSayfasi } from "../../lib/anaMenu";
import type { Kip } from "../../lib/canliYerlesim";
import { bosGecmis, gecmiseEkle, gecmisteGit } from "../../lib/gezinmeGecmisi";
import { en, tr, type MsgKey } from "../../i18n/messages";
import { type AppPrefs } from "../../lib/appPrefs";
import { DEFAULT_TABS, type NavId } from "../../lib/panelLayout";

export type UsePanelGezinmeGirdisi = {
  activeNav: NavId | ScreenId;
  botSekme: string | undefined;
  canliKip: Kip | null;
  endingStopDoneRef: React.RefObject<boolean>;
  forceNavRef: React.RefObject<NavId | null>;
  prefs: AppPrefs;
  setActiveNav: React.Dispatch<React.SetStateAction<NavId | ScreenId>>;
  setBotSekme: React.Dispatch<React.SetStateAction<string | undefined>>;
  setKipIstegi: React.Dispatch<React.SetStateAction<{ kip: Kip | null; n: number; } | null>>;
  setScreen: React.Dispatch<React.SetStateAction<ScreenId>>;
  startingSwitchDoneRef: React.RefObject<boolean>;
  streamWatchArmedRef: React.RefObject<boolean>;
};

export function usePanelGezinme({ activeNav, botSekme, canliKip, endingStopDoneRef, forceNavRef, prefs, setActiveNav, setBotSekme, setKipIstegi, setScreen, startingSwitchDoneRef, streamWatchArmedRef }: UsePanelGezinmeGirdisi) {

  const sayfaAdiBul = useCallback(
    (s: MenuSayfasi) => {
      const meta = DEFAULT_TABS.find((t) => t.id === s.nav);
      const key = (s.adAnahtari || meta?.labelKey || "") as MsgKey;
      const table = prefs.locale === "en" ? en : tr;
      return (key && table[key]) || meta?.label || s.nav;
    },
    [prefs.locale]
  );

  const sayfaAc = useCallback(({ nav: id, botSayfa, kip, bolum }: MenuSayfasi) => {
    setActiveNav(id);
    setBotSekme(botSayfa);
    // Rapor satırı yayın sonrası kipini, Kontrol satırı kendiliğinden kipi ister
    if (id === "control") setKipIstegi({ kip: kip ?? null, n: Date.now() });
    // Bölüm satırı: rapor çizilince o bölüme kay (en çok 2 sn bekler)
    if (bolum) {
      let n = 0;
      const kay = () => {
        const e = document.getElementById(`rapor-${bolum}`);
        if (e) e.scrollIntoView({ behavior: "smooth", block: "start" });
        else if (++n < 20) setTimeout(kay, 100);
      };
      setTimeout(kay, 50);
    }
    forceNavRef.current = null;
    if (id === "starting" || id === "ending" || id === "brb" || id === "chat") {
      setScreen(id);
    }
    if (id === "ending") {
      endingStopDoneRef.current = false;
      streamWatchArmedRef.current = true;
    }
    if (id === "starting") {
      startingSwitchDoneRef.current = false;
    }
  }, []);

  // Alt+← / Alt+→: gezinme geçmişi (menü, palet ve sayfa içi geçişlerin hepsi kaydedilir)
  const gecmis = useRef(bosGecmis<MenuSayfasi>());
  const gecmisteGidiliyor = useRef(false);
  useEffect(() => {
    const burasi: MenuSayfasi = { nav: activeNav as NavId, botSayfa: activeNav === "bot" ? botSekme : undefined, kip: activeNav === "control" && canliKip === "sonrasi" ? "sonrasi" : undefined };
    // Kısa bekleme: "Rapor" önce Canlı'yı sonra kipini değiştirir; ara adım geçmişe düşmesin
    const id = window.setTimeout(() => {
      if (gecmisteGidiliyor.current) {
        gecmisteGidiliyor.current = false;
        return;
      }
      gecmis.current = gecmiseEkle(gecmis.current, burasi, (a, b) => a.nav === b.nav && a.botSayfa === b.botSayfa && a.kip === b.kip);
    }, 150);
    return () => window.clearTimeout(id);
  }, [activeNav, botSekme, canliKip]);
  useEffect(() => {
    const tus = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
      const git = gecmisteGit(gecmis.current, e.key === "ArrowLeft" ? -1 : 1);
      if (!git) return;
      e.preventDefault();
      gecmis.current = git.gecmis;
      gecmisteGidiliyor.current = true;
      sayfaAc(git.sayfa);
    };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [sayfaAc]);
  return { sayfaAc, sayfaAdiBul };
}
