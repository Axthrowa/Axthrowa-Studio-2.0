/** PanelPage'den ayrıldı (TEK-4, davranış aynı): OBS listeleri ve otomatik bağlantı. */
import { useCallback, useEffect } from "react";
import { fetchServerInfo, fetchSettings, OverlaySettings, ScreenId } from "../../lib/api";
import { isObsConnected, listInputs, listScenes, listTransitions } from "../../lib/obs";
import { obsControl } from "../../lib/obsControl";
import { fetchDashboard } from "../../lib/api/botApi";
import { loadObsSaved, saveObsSaved } from "../../lib/obsPersist";
import { pickObsConnection, sameObsConnection } from "../../lib/obsConnection";
import { suggestSceneMap } from "../../lib/sceneSuggest";
import { gorulenleriOku, gorulenleriYaz, vodHatirlatmalari } from "../../lib/vodHatirlatici";
import { bildir } from "../../lib/bildirimler";
import { useOnizlemeTaslagi } from "../../lib/onizlemeTaslagi";
import { ROL_AD } from "./PanelPage";
import type { ObsConnection } from "../../lib/obs";

export type UsePanelObsGirdisi = {
  liveOn: boolean;
  mirrorMusic: (data: OverlaySettings) => Promise<void>;
  obsConnect: (cfg?: Partial<ObsConnection> | undefined) => Promise<void>;
  persistNow: (s: ScreenId, data: OverlaySettings) => Promise<void>;
  refreshBackgrounds: () => void;
  refreshLogos: () => void;
  refreshMusic: () => void;
  refreshParticles: () => void;
  refreshVideos: () => void;
  reload: (s: ScreenId) => Promise<void>;
  scenesCountRef: React.RefObject<number>;
  scheduleOverlayRefresh: (base?: string | undefined) => void;
  screen: ScreenId;
  setInputs: React.Dispatch<React.SetStateAction<{ name: string; kind: string; }[]>>;
  setObsConnected: React.Dispatch<React.SetStateAction<boolean>>;
  setScenes: React.Dispatch<React.SetStateAction<string[]>>;
  setServer: React.Dispatch<any>;
  setTransitions: React.Dispatch<React.SetStateAction<string[]>>;
  settingsRef: React.RefObject<OverlaySettings>;
  showToast: (m: string) => undefined;
  update: (patch: OverlaySettings) => void;
};

export function usePanelObs({ liveOn, mirrorMusic, obsConnect, persistNow, refreshBackgrounds, refreshLogos, refreshMusic, refreshParticles, refreshVideos, reload, scenesCountRef, scheduleOverlayRefresh, screen, setInputs, setObsConnected, setScenes, setServer, setTransitions, settingsRef, showToast, update }: UsePanelObsGirdisi) {

  /** Sahne / geçiş / ses girişi listelerini OBS'ten yeniden yükler. */
  const refreshObsLists = useCallback(async () => {
    let list: string[] = [];
    try {
      const snap = await obsControl.scenes();
      if (snap.scenes?.length) list = snap.scenes;
    } catch {
      /* JS istemcisine düş */
    }
    if (!list.length) {
      try {
        list = await listScenes();
      } catch {
        /* */
      }
    }
    if (list.length) setScenes(list);
    try {
      setTransitions(await listTransitions());
    } catch {
      /* */
    }
    try {
      setInputs(await listInputs());
    } catch {
      /* */
    }
    // Sahne-rol eşleşmesi boşsa kısayollar hedefsiz kalıyordu: yalnız boş rolleri
    // ad benzerliğiyle doldur (kullanıcının seçtiğine dokunma).
    const oneri = suggestSceneMap(list, settingsRef.current.obs);
    if (oneri) {
      update({ obs: oneri.patch });
      showToast(`Sahneler eşleştirildi: ${oneri.filled.map((r) => ROL_AD[r]).join(", ")}`);
    }
    scheduleOverlayRefresh();
  }, [scheduleOverlayRefresh, update, showToast]);

  const tryAutoObs = useCallback(
    async (silent = true, need: { rust: boolean; js: boolean } = { rust: true, js: true }) => {
      // Bağlantı bilgisinin tek kaynağı: "Bağlantılar" kartının kaydettiği panel
      // ayarı. Eskiden ekran dilimindeki (şifresiz, eski adresli) kayıt
      // okunuyordu — kart "Bağlı" derken panel yanlış adrese gidiyordu.
      let panelObs: Record<string, unknown> | null = null;
      let sunucuOkundu = false;
      try {
        panelObs = ((await fetchSettings("panel")).obs as Record<string, unknown>) || null;
        sunucuOkundu = true;
      } catch {
        /* sunucu yanıt vermezse yerel yedek kullanılır */
      }
      const cfg = pickObsConnection({
        panel: panelObs,
        saved: loadObsSaved(),
        slice: settingsRef.current.obs,
      });
      // Sunucu kapalıyken yazılmaz: eski yedekteki şifre kasaya taşınmadan silinmesin
      if (sunucuOkundu) saveObsSaved(cfg);
      // Ekran dilimini hizala: kısayol/plan kodu dilimi okuyor.
      // Ama BOŞ şifre, dilimde duran dolu şifrenin üstüne yazılmaz: panel kartı
      // şifresiz kaldığında bu hizalama kullanıcının OBS şifresini siliyordu.
      const sliceObs = (settingsRef.current.obs || {}) as { password?: unknown };
      const slicePw = typeof sliceObs.password === "string" ? sliceObs.password.trim() : "";
      const wouldClearPassword = !cfg.password && !!slicePw;
      if (!sameObsConnection(settingsRef.current.obs, cfg) && !wouldClearPassword) {
        update({ obs: { host: cfg.host, port: cfg.port, password: cfg.password } });
      }
      // Yalnız kopuk olanı bağla: sağlam Rust bağlantısını her 5 sn'de sıfırlamak
      // (JS istemcisi bağlanamadığında) kısayolları ve OBS Kontrol'ü sürekli
      // "bağlı değil"e düşürüyordu.
      let ok = !need.rust || !need.js ? true : false;
      if (need.rust) {
        try {
          await obsControl.connect(cfg.host, cfg.port, cfg.password);
          ok = true;
        } catch {
          /* sessiz retry */
        }
      }
      if (need.js) {
        try {
          await obsConnect(cfg);
          ok = true;
        } catch {
          /* sessiz retry */
        }
      }
      if (!ok) {
        setObsConnected(isObsConnected());
        return false;
      }
      setObsConnected(true);
      await refreshObsLists();
      if (!silent) showToast("OBS bağlandı");
      return true;
    },
    [obsConnect, refreshObsLists, update, showToast]
  );

  // Y4: Kick VOD'u silinmeye 2 gün kalan yayınlar (açılışta bir kez)
  useEffect(() => {
    void fetchDashboard()
      .then((d) => {
        const gorulen = gorulenleriOku();
        const liste = vodHatirlatmalari(d.sessions, Date.now(), gorulen);
        for (const h of liste) bildir(h.metin, "uyari");
        if (liste.length) gorulenleriYaz([...gorulen, ...liste.map((h) => h.id)]);
      })
      .catch(() => {});
  }, []);

  // A8b: bekleyen taslağı yazacak işlev
  useEffect(() => {
    useOnizlemeTaslagi.setState({
      uygulayici: async (t) => {
        const veri = t.veri as OverlaySettings;
        try {
          await persistNow(t.ekran as ScreenId, veri);
          if (veri.musicShared) await mirrorMusic(veri);
          showToast("Yayına uygulandı");
        } catch (e) {
          showToast("Yayına uygulanamadı — sunucu kapalı olabilir");
          throw e;
        }
      },
    });
  }, [persistNow, mirrorMusic, showToast]);
  // Yayın bitince bekleyen kaybolmasın
  useEffect(() => {
    if (!liveOn) void useOnizlemeTaslagi.getState().uygula().catch(() => {});
  }, [liveOn]);

  useEffect(() => {
    // Ekran değişince önceki ekranın bekleyeni yazılır
    void useOnizlemeTaslagi.getState().uygula().catch(() => {});
    void reload(screen);
    fetchServerInfo().then(setServer).catch(() => {});
    refreshParticles();
    refreshMusic();
    refreshLogos();
    refreshVideos();
    refreshBackgrounds();
  }, [screen, reload, refreshParticles, refreshMusic, refreshLogos, refreshVideos, refreshBackgrounds]);

  // Program açılınca OBS WebSocket'e sessiz otomatik bağlan; koparsa tekrar dene
  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const loop = async () => {
      if (cancelled) return;
      let rustOk = false;
      try {
        rustOk = !!(await obsControl.status()).connected;
      } catch {
        rustOk = false;
      }
      if (!isObsConnected() || !rustOk) {
        await tryAutoObs(true, { rust: !rustOk, js: !isObsConnected() });
      } else if (scenesCountRef.current === 0) {
        // Kartla ya da başka yoldan bağlanılmış ama sahneler yüklenmemiş.
        await refreshObsLists();
      }
      if (!cancelled) timer = window.setTimeout(() => void loop(), 5000);
    };
    void loop();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [tryAutoObs, refreshObsLists]);
  return { refreshObsLists };
}
