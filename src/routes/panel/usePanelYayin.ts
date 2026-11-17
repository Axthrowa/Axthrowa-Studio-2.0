/** PanelPage'den ayrıldı (TEK-4, davranış aynı): yayını başlat/bitir, ana yayın düğmesi ve süre bitişi. */
import { useCallback, useEffect } from "react";
import { fetchSettings, patchSettings, OverlaySettings, ScreenId } from "../../lib/api";
import type { Kip } from "../../lib/canliYerlesim";
import { type NavId, type PanelLayout } from "../../lib/panelLayout";
import { switchScene } from "../../lib/obs";
import { clearStartingCountdown, obsConnectionFrom, resolveGameScene, resolveEndingScene, resolveStartingScene, runEndingEndAction, runStartingEndAction, seedStartingCountdown } from "../../lib/streamAutomation";
import { ruleStopStream } from "../../lib/endRules";
import { obsControl } from "../../lib/obsControl";
import { endSession, fetchDashboard, startSession } from "../../lib/api/botApi";
import { getBotConfig, saveBotConfig } from "../../lib/sohbetBot";
import { notifyDiscordLive } from "../../lib/sohbetBot/platformActions";
import { sonYayinKareleriniAl } from "../../lib/yayinSagligi";
import { getObs } from "../../lib/obs";
import { KAYIT_KAPALI_UYARISI } from "../../lib/vodHatirlatici";
import { bildir } from "../../lib/bildirimler";
import { gunluk } from "../../lib/gunluk";
import { olay } from "../../lib/analitik";
import { clearCreditsSession, creditsSessionCounts } from "../../lib/creditsSession";
import type { ObsConnection } from "../../lib/obs";

export type UsePanelYayinGirdisi = {
  endingStopDoneRef: React.RefObject<boolean>;
  forceNavRef: React.RefObject<NavId | null>;
  liveOn: boolean;
  masterBusy: boolean;
  obsConnect: (cfg?: Partial<ObsConnection> | undefined) => Promise<void>;
  scheduleOverlayRefresh: (base?: string | undefined) => void;
  screen: ScreenId;
  setActiveNav: React.Dispatch<React.SetStateAction<NavId | ScreenId>>;
  setCreditCounts: React.Dispatch<React.SetStateAction<{ donors: number; subscribers: number; followers: number; }>>;
  setKipIstegi: React.Dispatch<React.SetStateAction<{ kip: Kip | null; n: number; } | null>>;
  setLayout: React.Dispatch<React.SetStateAction<PanelLayout>>;
  setLiveOn: (canli: boolean) => void;
  setMasterBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setObsConnected: React.Dispatch<React.SetStateAction<boolean>>;
  setScreen: React.Dispatch<React.SetStateAction<ScreenId>>;
  settingsRef: React.RefObject<OverlaySettings>;
  showToast: (m: string) => undefined;
  startingSwitchDoneRef: React.RefObject<boolean>;
  streamWatchArmedRef: React.RefObject<boolean>;
};

export function usePanelYayin({ endingStopDoneRef, forceNavRef, liveOn, masterBusy, obsConnect, scheduleOverlayRefresh, screen, setActiveNav, setCreditCounts, setKipIstegi, setLayout, setLiveOn, setMasterBusy, setObsConnected, setScreen, settingsRef, showToast, startingSwitchDoneRef, streamWatchArmedRef }: UsePanelYayinGirdisi) {

  /** Profil → Yayını başlat: OBS giriş sahnesi + StartStream. Panel Dashboard’da kalır. */
  const goLiveFromProfile = useCallback(async () => {
    startingSwitchDoneRef.current = false;
    endingStopDoneRef.current = false;
    streamWatchArmedRef.current = true;
    // Çıkış jeneriği oturumu YENİ yayın başlarken sıfırlanır (bitişte değil):
    // çıkış ekranı kendi listesini gösterirken silinmemeli, ama bir sonraki
    // yayına önceki yayının bağış/takip/abone isimleri taşınmamalı.
    clearCreditsSession();
    setCreditCounts(creditsSessionCounts());

    const obs = settingsRef.current.obs || {};
    const scene = resolveStartingScene(obs);
    const cfg = obsConnectionFrom(obs);
    const game = resolveGameScene(obs);
    const holdMin = Math.max(1, Number(obs.startHoldMin) || 5);
    // Bitiş anı OBS'teki Giriş ekranına da gider: sayaç her yayında baştan (ör. 5:00) başlar
    const bitis = seedStartingCountdown(holdMin);
    void patchSettings("starting", { countdownEndsAt: bitis }).catch(() => {});

    try {
      await obsConnect(cfg);
      setObsConnected(true);
    } catch (first) {
      try {
        await obsControl.connect(cfg.host, cfg.port, cfg.password);
        setObsConnected(true);
      } catch (e: any) {
        const msg = String((e as Error)?.message || first || e);
        throw new Error(
          "OBS bağlanamadı: " +
            (/ACL/i.test(msg) ? "WebSocket yanıt vermiyor — OBS açık mı?" : msg)
        );
      }
    }

    if (scene) {
      try {
        await switchScene({
          sceneName: scene,
          transition: obs.transition,
          transitionMs: obs.transitionMs,
        });
      } catch {
        /* sahne listesi henüz gelmemiş olabilir */
      }
    }

    if (!scene) {
      showToast("Giriş sahnesi atanmamış — kısayollardan Giriş sahnesini seç");
    }
    if (!game) {
      showToast(
        "Uyarı: süre bitince geçilecek sahne seçili değil (Geri sayım → Süre bitince…)"
      );
    }

    try {
      await obsControl.startStreamSequence();
    } catch (e: any) {
      throw new Error(
        "StartStream: " + (e?.message || e) + " — OBS’te yayın zaten açık olabilir"
      );
    }

    setLiveOn(true);
    // Y4: OBS'in "yayınla birlikte kaydet" ayarı okunamaz; kaydın başlamasına süre tanıyıp durumuna bakılır
    window.setTimeout(() => {
      void getObs()
        .call("GetRecordStatus")
        .then((r) => {
          if (!(r as { outputActive?: boolean }).outputActive) bildir(KAYIT_KAPALI_UYARISI, "uyari");
        })
        .catch(() => {});
    }, 5000);
    const bot = getBotConfig() as {
      channelName?: string;
      title?: string;
      discordWebhook?: string;
      discord?: { enabled?: boolean; webhookUrl?: string; goLiveMessage?: string };
    };
    const hook = bot.discord?.webhookUrl || bot.discordWebhook;
    if (hook && (bot.discord?.enabled === true || !!bot.discordWebhook)) {
      void notifyDiscordLive({
        webhookUrl: hook,
        enabled: true,
        message: bot.discord?.goLiveMessage,
        channel: bot.channelName,
        title: bot.title,
      }).catch(() => {});
    }
  }, [showToast, obsConnect]);

  const endLiveFromProfile = useCallback(async () => {
    streamWatchArmedRef.current = false;
    endingStopDoneRef.current = false;
    setLayout((prev) => {
      const hidden = (prev.tabs.hidden || []).filter((id) => id !== "ending");
      const order = prev.tabs.order?.includes("ending")
        ? prev.tabs.order
        : ["ending", ...(prev.tabs.order || [])];
      return { ...prev, tabs: { ...prev.tabs, order, hidden } };
    });
    forceNavRef.current = "ending";
    setActiveNav("ending");
    setScreen("ending");
    try {
      await obsControl.stopStreamSequence(resolveEndingScene(settingsRef.current.obs || {}));
    } catch {
      /* OBS kapalıysa sessiz */
    }
    scheduleOverlayRefresh();
    setLiveOn(false);
    clearStartingCountdown();
  }, [scheduleOverlayRefresh]);

  /** `raporuAc`: yayın gerçekten kapandıysa (çıkış ekranı bitti) Yayın sonrası → Rapor kendiliğinden açılır (U7b) */
  const closeDbSessionQuiet = useCallback(async (raporuAc = true) => {
    try {
      const dash = await fetchDashboard();
      const sid = dash.active_session?.id;
      if (sid) await endSession(sid, sonYayinKareleriniAl());
      saveBotConfig((prev) => ({ ...prev, streamStartedAt: null }));
    } catch {
      /* */
    }
    if (raporuAc) {
      setActiveNav("control");
      setKipIstegi({ kip: "sonrasi", n: Date.now() });
    }
  }, []);

  const runMasterStream = useCallback(async () => {
    if (masterBusy) return;
    setMasterBusy(true);
    try {
      if (liveOn) {
        gunluk.info("Yayın durduruluyor");
        await endLiveFromProfile();
        // Çıkış sayacı yayını kendisi kapatacaksa rapor o zaman açılır; kapatmayacaksa şimdi (yoksa hiç açılmaz)
        // endingMinutes çıkış ekranının ayarı; o an başka ekran açık olabilir
        const cikis = await fetchSettings("ending").catch(() => settingsRef.current);
        const sayacKapatir = (Number(cikis.endingMinutes) || 0) > 0 && ruleStopStream((settingsRef.current.obs || {}) as never);
        await closeDbSessionQuiet(!sayacKapatir);
        gunluk.info("Yayın durduruldu");
        olay("yayin_bitti");
      } else {
        gunluk.info("Yayın başlatılıyor");
        await goLiveFromProfile();
        gunluk.info("Yayın başlatıldı");
        olay("yayin_basladi");
        try {
          await startSession();
        } catch {
          /* SQLite oturumu isteğe bağlı */
        }
      }
    } catch (e: any) {
      gunluk.error(`Yayın ${liveOn ? "durdurulamadı" : "başlatılamadı"}: ${e?.message || e}`);
      showToast(String(e?.message || e));
    } finally {
      setMasterBusy(false);
    }
  }, [
    masterBusy,
    liveOn,
    endLiveFromProfile,
    goLiveFromProfile,
    closeDbSessionQuiet,
    showToast,
  ]);

  /** Panel LivePreview: süre / medya bitişi */
  const handlePreviewCountdownEnd = useCallback(
    async (live: OverlaySettings) => {
      const scr = screen;
      if (scr === "starting") {
        if (startingSwitchDoneRef.current) return;
        startingSwitchDoneRef.current = true;
        try {
          const r = await runStartingEndAction(live);
          if (!r.done) showToast("Süre bitti — sahne geçişini OBS'teki sayfa yaptı");
          else if (r.result) showToast(`Süre bitti → ${r.result}`);
          else showToast("Süre bitti ama hedef sahne seçili değil");
        } catch (e: any) {
          startingSwitchDoneRef.current = false;
          showToast("Sahne geçişi: " + (e?.message || e));
        }
        return;
      }
      if (scr === "ending") {
        if (endingStopDoneRef.current) return;
        endingStopDoneRef.current = true;
        streamWatchArmedRef.current = false;
        try {
          const r = await runEndingEndAction(live);
          if (!r.done) {
            // Bitişi OBS'teki sayfa üstlendi; kural yayını kapatıyorsa
            // panelin oturum kaydı da kapanmalı (eskiden iki taraf da
            // StopStream gönderiyor, ikincisi hata verip oturum açık kalıyordu).
            showToast("Çıkış bitti — işlemi OBS'teki sayfa yaptı");
            if (ruleStopStream((live.obs || {}) as never)) await closeDbSessionQuiet();
          } else if (r.result.stopped) {
            showToast("Çıkış bitti — yayın kapatıldı");
            await closeDbSessionQuiet();
          } else {
            showToast("Çıkış bitti (otomatik kapat kapalı)");
          }
        } catch (e: any) {
          endingStopDoneRef.current = false;
          showToast("Çıkış aksiyonu: " + (e?.message || e));
        }
      }
    },
    [screen, showToast, closeDbSessionQuiet]
  );

  // Önizleme kapalı olsa bile Giriş/Çıkış süre bitişini panelden izle
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!streamWatchArmedRef.current) return;
      const obs = settingsRef.current.obs || {};

      if (!startingSwitchDoneRef.current) {
        const end = Number(sessionStorage.getItem("starting_end_5") || 0);
        if (end > 0 && end <= Date.now()) {
          startingSwitchDoneRef.current = true;
          void runStartingEndAction({ obs } as OverlaySettings)
            .then((r) => {
              if (r.done && r.result) showToast(`Süre bitti → ${r.result}`);
            })
            .catch((e) => {
              startingSwitchDoneRef.current = false;
              showToast("Sahne geçişi: " + (e?.message || e));
            });
        }
      }

      if (screen === "ending" && !endingStopDoneRef.current) {
        const mins = Number(settingsRef.current.endingMinutes) || 0;
        if (mins > 0) {
          const endE = Number(sessionStorage.getItem(`ending_end_${mins}`) || 0);
          if (endE > 0 && endE <= Date.now()) {
            endingStopDoneRef.current = true;
            streamWatchArmedRef.current = false;
            void runEndingEndAction(settingsRef.current)
              .then(async (r) => {
                if (r.done ? r.result.stopped : ruleStopStream((settingsRef.current.obs || {}) as never)) {
                  showToast(r.done ? "Çıkış bitti — yayın kapatıldı" : "Çıkış bitti — işlemi OBS'teki sayfa yaptı");
                  await closeDbSessionQuiet();
                }
              })
              .catch((e) => {
                endingStopDoneRef.current = false;
                showToast("Çıkış aksiyonu: " + (e?.message || e));
              });
          }
        }
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [screen, showToast, closeDbSessionQuiet]);
  return { handlePreviewCountdownEnd, runMasterStream };
}
