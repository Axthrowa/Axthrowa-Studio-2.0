/** PanelPage'den ayrıldı (TEK-4, davranış aynı): ayar kaydı, müzik/OBS aynalama ve yeniden yükleme. */
import { useCallback, useEffect } from "react";
import { fetchSettings, patchSettings, OverlaySettings, saveSettings, ScreenId } from "../../lib/api";
import { migrateHotkeyDefaults } from "../../lib/hotkeyPlan";
import { DEFAULT_SOCIALS } from "../../lib/socials";
import { type MsgKey } from "../../i18n/messages";
import { bildir } from "../../lib/bildirimler";
import { KISAYOL_OLAYI, kisayolSatiriEkle, type KisayolIstegi } from "../../lib/nesneMenusu";
import type { HotkeyRow } from "../../lib/obsHotkeyCatalog";
import { useAxthrowaStore } from "../../store/useAxthrowaStore";
import { useOnizlemeTaslagi } from "../../lib/onizlemeTaslagi";
import { getCreditsSession } from "../../lib/creditsSession";
import { MUSIC_SHARE_SCREENS, MUSIC_KEYS, OBS_SHARE_SCREENS } from "./PanelPage";
import type { NavId } from "../../lib/panelLayout";

export type UsePanelKayitGirdisi = {
  hotkeyCaptureRef: React.RefObject<boolean>;
  obsSharedRef: React.RefObject<Record<string, unknown> | null>;
  saveTimer: React.RefObject<number | null>;
  screen: ScreenId;
  setActiveNav: React.Dispatch<React.SetStateAction<NavId | ScreenId>>;
  setSettings: React.Dispatch<React.SetStateAction<OverlaySettings>>;
  settings: OverlaySettings;
  settingsRef: React.RefObject<OverlaySettings>;
  showToast: (m: string) => undefined;
  tt: (key: MsgKey) => string;
};

export function usePanelKayit({ hotkeyCaptureRef, obsSharedRef, saveTimer, screen, setActiveNav, setSettings, settings, settingsRef, showToast, tt }: UsePanelKayitGirdisi) {

  useEffect(
    () => () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    },
    []
  );

  const persistNow = useCallback(async (s: ScreenId, data: OverlaySettings) => {
    // Çıkış ayarının tamamı kaydedilirken canlı jenerik listesi panelin güncel oturumundan yazılır (bayatı ezmesin)
    await saveSettings(s, s === "ending" ? { ...data, creditsLive: getCreditsSession() } : data);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "s" || e.altKey) return;
      if (hotkeyCaptureRef.current) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      e.preventDefault();
      void persistNow(screen, settings)
        .then(() => showToast(tt("brand.saved")))
        .catch(() => showToast("Kaydedilemedi — sunucu kapalı olabilir"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [persistNow, screen, settings, showToast, tt]);

  const onizlemedeBekliyor = () => useAxthrowaStore.getState().isLive && useOnizlemeTaslagi.getState().acik;

  const scheduleSave = useCallback(
    (data: OverlaySettings) => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      // A8b: yayındayken "önce önizlemede dene" açıksa OBS'e gitmez; önizleme yerel ayardan çizer
      if (onizlemedeBekliyor()) {
        useOnizlemeTaslagi.getState().beklet({ ekran: screen, veri: data });
        return;
      }
      // OBS'e yansıma süresi bu gecikme + WebSocket yayını kadar. 140 ms
      // tuş vuruşlarını hâlâ birleştiriyor ama gözle fark edilmiyor.
      saveTimer.current = window.setTimeout(() => {
        saveTimer.current = null;
        void persistNow(screen, data)
          .then(() => showToast("Otomatik kaydedildi"))
          .catch(() => showToast("Kaydedilemedi — sunucu kapalı olabilir"));
      }, 140);
    },
    [persistNow, screen, showToast]
  );

  // Aynı müziği tüm yayın ekranlarında çalmak için kopyalanan alanlar.
  // Ayarlar ekran başına tutuluyor; paylaşımı sunucuya yazarken yapıyoruz ki
  // OBS'teki her ekran kendi ayarından aynı parçayı okusun.
  const mirrorMusic = useCallback(
    async (data: OverlaySettings) => {
      const targets = MUSIC_SHARE_SCREENS.filter((s) => s !== screen);
      const patch: OverlaySettings = {};
      for (const key of MUSIC_KEYS) patch[key] = data[key] ?? null;
      await Promise.all(
        targets.map((s) =>
          patchSettings(s, patch).catch(() => {
            /* sunucu kapalıysa sessiz geç; kaydetme uyarısı zaten çıkıyor */
          })
        )
      );
    },
    [screen]
  );

  // Kısayol / OBS WebSocket ayarları sekme değişince sıfırlanmasın —
  // Giriş'te atadığın F1, Çıkış / Mola / Chat'te de aynı kalsın.
  const mirrorObs = useCallback(
    async (data: OverlaySettings) => {
      if (!data.obs || typeof data.obs !== "object") return;
      obsSharedRef.current = data.obs as Record<string, unknown>;
      const targets = OBS_SHARE_SCREENS.filter((s) => s !== screen);
      await Promise.all(
        targets.map((s) =>
          patchSettings(s, { obs: data.obs }).catch(() => {
            /* */
          })
        )
      );
    },
    [screen]
  );

  const update = useCallback(
    (patch: OverlaySettings) => {
      setSettings((s) => {
        const next = { ...s, ...patch };
        if (patch.obs && typeof patch.obs === "object") {
          next.obs = { ...(s.obs || {}), ...patch.obs };
          obsSharedRef.current = next.obs as Record<string, unknown>;
        }
        scheduleSave(next);
        // A8b: bekletilirken paylaşılan müzik de öbür ekranlara uygulanınca kopyalanır
        if (next.musicShared && MUSIC_KEYS.some((k) => k in patch) && !onizlemedeBekliyor()) {
          void mirrorMusic(next);
        }
        if (patch.obs) {
          void mirrorObs(next);
        }
        return next;
      });
    },
    [scheduleSave, mirrorMusic, mirrorObs]
  );

  // Sağ tık "Kısayol ata" (sahne, deste tuşu): Kısayollar sayfasında tuşu boş satır açılır
  useEffect(() => {
    const ata = (e: Event) => {
      const istek = (e as CustomEvent<KisayolIstegi>).detail;
      if (!istek?.name) return;
      e.preventDefault();
      const obs = (settingsRef.current.obs || {}) as Record<string, unknown>;
      const satirlar = Array.isArray(obs.actionHotkeys) ? (obs.actionHotkeys as HotkeyRow[]) : [];
      const r = kisayolSatiriEkle(satirlar, istek, `hk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`);
      if (r.yeni) update({ obs: { actionHotkeys: r.satirlar } });
      setActiveNav("hotkeys");
      bildir(r.yeni ? `${istek.label}: kısayol satırı açıldı, tuş kutusuna basıp tuşu ata` : `${istek.label}: kısayol satırı zaten var${r.satir.hotkey ? ` (${r.satir.hotkey})` : ""}`);
    };
    window.addEventListener(KISAYOL_OLAYI, ata);
    return () => window.removeEventListener(KISAYOL_OLAYI, ata);
  }, [update]);

  const reload = useCallback(async (s: ScreenId) => {
    try {
      const data = await fetchSettings(s);
      // Mutlak video yollarını kütüphane adına indir (oturumlar arası kalıcılık)
      let bgVideoPath = data.bgVideoPath;
      if (typeof bgVideoPath === "string" && (bgVideoPath.includes("/") || bgVideoPath.includes("\\"))) {
        bgVideoPath = bgVideoPath.replace(/\\/g, "/").split("/").pop() || bgVideoPath;
      }
      let bgImagePath = data.bgImagePath;
      if (
        typeof bgImagePath === "string" &&
        (bgImagePath.includes("assets/backgrounds") || bgImagePath.includes("assets\\backgrounds"))
      ) {
        bgImagePath = bgImagePath.replace(/\\/g, "/").split("/").pop() || bgImagePath;
      }
      // Ortak OBS: oturumda bilinen kısayolları koru; yoksa bu ekrandan tohumla.
      const obsHam =
        (obsSharedRef.current as OverlaySettings["obs"]) ||
        (data.obs as OverlaySettings["obs"]) ||
        undefined;

      // Eski F1-F4 varsayılanları artık kodda atanmıyor. Mevcut kullanıcıların
      // kısayolu kaybolmasın diye bir kez diske açıkça yazıyoruz; sonrasında
      // temizlerlerse gerçekten temizlenmiş kalır.
      const goc = obsHam ? migrateHotkeyDefaults(obsHam) : null;
      const obs = goc ? ({ ...obsHam, ...goc } as OverlaySettings["obs"]) : obsHam;
      if (goc && obs) {
        obsSharedRef.current = obs as Record<string, unknown>;
        void Promise.all(
          OBS_SHARE_SCREENS.map((t) => patchSettings(t, { obs }).catch(() => {}))
        );
      }
      if (obs && !obsSharedRef.current) {
        obsSharedRef.current = obs as Record<string, unknown>;
        const targets = OBS_SHARE_SCREENS.filter((x) => x !== s);
        void Promise.all(
          targets.map((t) => patchSettings(t, { obs }).catch(() => {}))
        );
      } else if (obsSharedRef.current) {
        void patchSettings(s, { obs: obsSharedRef.current }).catch(() => {});
      }
      setSettings({
        ...data,
        bgVideoPath,
        bgImagePath,
        obs,
        socials: { ...DEFAULT_SOCIALS, ...(data.socials || {}) },
      });
    } catch {
      setSettings({ socials: DEFAULT_SOCIALS });
    }
  }, []);
  return { mirrorMusic, persistNow, reload, update };
}
