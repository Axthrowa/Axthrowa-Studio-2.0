/** PanelPage'den ayrıldı (TEK-4, davranış aynı): bildirim, bağlantı koruması, planlı yayın ve mini şerit. */
import { useCallback, useEffect, useState } from "react";
import { API_BASE, fetchSettings, OverlaySettings } from "../../lib/api";
import { obsHatasiniCevir } from "../../lib/obsErrors";
import { useChatCommandBridge } from "../../lib/useChatCommandBridge";
import { onObsConnection, refreshOurBrowserSources } from "../../lib/obs";
import { useCreditsCollector } from "../../lib/useCreditsCollector";
import { clearNotice, pushNotice } from "../../lib/notices";
import { bildir } from "../../lib/bildirimler";
import { creditsSessionCounts, subscribeCreditsSession } from "../../lib/creditsSession";

export type UsePanelIzlemeGirdisi = {
  obsCtxConnected: boolean;
  overlayRefreshTimers: React.RefObject<number[]>;
  server: any;
  setCreditCounts: React.Dispatch<React.SetStateAction<{ donors: number; subscribers: number; followers: number; }>>;
  setObsConnected: React.Dispatch<React.SetStateAction<boolean>>;
  settingsRef: React.RefObject<OverlaySettings>;
};

export function usePanelIzleme({ obsCtxConnected, overlayRefreshTimers, server, setCreditCounts, setObsConnected, settingsRef }: UsePanelIzlemeGirdisi) {

  /** OBS açılınca / yeniden bağlanınca overlay tarayıcı kaynaklarını yenile. */
  const scheduleOverlayRefresh = useCallback((base?: string) => {
    for (const t of overlayRefreshTimers.current) window.clearTimeout(t);
    overlayRefreshTimers.current = [];
    const run = () => {
      void refreshOurBrowserSources({
        base: base || server?.base || API_BASE || "http://127.0.0.1:8843",
      }).catch(() => {});
    };
    // CEF bazen WebSocket'ten sonra ayağa kalkıyor — birkaç dalga.
    overlayRefreshTimers.current = [
      window.setTimeout(run, 600),
      window.setTimeout(run, 2200),
      window.setTimeout(run, 5500),
    ];
  }, [server?.base]);

  // Yayın boyunca abone / bağış / takip olaylarını jenerik oturumuna yaz
  useCreditsCollector(true);
  useEffect(() => subscribeCreditsSession(() => setCreditCounts(creditsSessionCounts())), []);

  // OBS bağlantısı koparsa sahne kısayolları sessizce çalışmaz hâle geliyordu:
  // `obsConnected` yalnızca kendi `connect` çağrımıza göre ayarlandığı için
  // bayrak `true` kalıyordu. Artık soket olaylarını dinliyoruz.
  useEffect(() => {
    setObsConnected(obsCtxConnected);
  }, [obsCtxConnected]);
  useEffect(
    () =>
      onObsConnection((baglandi, sebep) => {
        setObsConnected(baglandi);
        if (baglandi) {
          clearNotice("obs");
          scheduleOverlayRefresh();
          return;
        }
        // `sebep` yoksa bağlantıyı kullanıcı kendisi kesti — uyarı gerekmez.
        if (!sebep) return;
        // Ham protokol metni yerine ne yapılacağını söyleyen çeviri.
        const cevrili = obsHatasiniCevir(String(sebep), Number(settingsRef.current?.obs?.port) || undefined);
        pushNotice({
          id: "obs",
          level: "error",
          text: cevrili.metin,
          hint: cevrili.ipucu,
        });
      }),
    [scheduleOverlayRefresh]
  );

  useEffect(
    () => () => {
      for (const t of overlayRefreshTimers.current) window.clearTimeout(t);
    },
    []
  );

  // Eski tek satırlık bildirimler ortak bildirim standardına gider (A5): tür metinden anlaşılır
  const showToast = useCallback((m: string) => void bildir(m), []);
  // Y12: bağlantı koruması (ayar kapalıyken yalnız ayarı okur)
  useEffect(() => {
    let durdur: (() => void) | undefined;
    let bitti = false;
    void import("../../lib/baglantiKorumasi").then((m) => {
      if (!bitti) durdur = m.baglantiKorumasiIzle((t) => void bildir(t));
    });
    return () => {
      bitti = true;
      durdur?.();
    };
  }, []);
  // Y11: planlı yayından 5 dk önce panelde ve (pencere gizliyse) masaüstünde hatırlat
  useEffect(() => {
    const hatirlatilan = new Set<string>();
    const tur = async () => {
      try {
        const [{ takvimAyari, hatirlatilacaklar }, { yerelBildirim }] = await Promise.all([import("../../lib/yayinTakvimi"), import("../../lib/yerelBildirim")]);
        const a = takvimAyari((await fetchSettings("panel")).yayinTakvimi);
        for (const y of hatirlatilacaklar(a.liste, Date.now(), hatirlatilan)) {
          hatirlatilan.add(y.id);
          const metin = `Planlı yayın ${new Date(y.zaman).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}: ${y.baslik || "başlıksız"}`;
          bildir(metin, "bilgi");
          void yerelBildirim("Yayın saati yaklaştı", metin);
        }
      } catch {
        /* ayar okunamadı: sonraki turda */
      }
    };
    void tur();
    const t = setInterval(() => void tur(), 30_000);
    return () => clearInterval(t);
  }, []);
  // U9: önceki oturumda ayrı pencerede kalan paneller aynı yerde yeniden açılır
  useEffect(() => {
    void import("../../lib/ayrikPanel").then((m) => m.ayrikPencereleriGeriAc());
  }, []);
  // U10: Ctrl+M tam pencere ile her zaman üstte mini şerit arasında geçer
  const [mini, setMini] = useState(false);
  const miniyeGec = useCallback((ac: boolean) => {
    setMini(ac);
    void import("../../lib/miniKip").then((m) => m.miniKipAyarla(ac));
  }, []);
  useEffect(() => {
    const tus = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.altKey || e.shiftKey || e.metaKey || e.key.toLowerCase() !== "m") return;
      const el = e.target as HTMLElement | null;
      if (el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.isContentEditable) return;
      e.preventDefault();
      setMini((m) => {
        void import("../../lib/miniKip").then((k) => k.miniKipAyarla(!m));
        return !m;
      });
    };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, []);

  useChatCommandBridge({ onToast: showToast });
  return { mini, miniyeGec, scheduleOverlayRefresh, showToast };
}
