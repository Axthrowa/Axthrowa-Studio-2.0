/** OverlayShell'den ayrıldı (TEK-4, davranış aynı): geri sayım, süre ve medya bitişiyle ekranı bitirme. */
import { useCallback, useEffect, useMemo, useRef } from "react";
import { nextLoopState, shouldCountLoop } from "../../lib/endRules";
import { OverlaySettings, ScreenId } from "../../lib/api";
import { readStartingCountdownEnd } from "../../lib/streamAutomation";
import type { ResolvedRule } from "../../lib/endRules";

export type UseKabukBitisGirdisi = {
  audioNode: HTMLAudioElement | null;
  effMinutes: number;
  effTarget: string;
  endRule: ResolvedRule;
  endRuleRef: React.RefObject<ResolvedRule>;
  endedRef: React.RefObject<boolean>;
  isEndScreen: boolean;
  now: number;
  obs: boolean;
  onCountdownEnd: ((settings: OverlaySettings) => void) | undefined;
  screen: ScreenId;
  settings: OverlaySettings;
  settingsRef: React.RefObject<OverlaySettings>;
  sourceActive: boolean;
  timerEpoch: number;
  videoBitisiyleBitirRef: React.RefObject<boolean>;
  videoNode: HTMLVideoElement | null;
  videoSrc: string;
};

export function useKabukBitis({ audioNode, effMinutes, effTarget, endRule, endRuleRef, endedRef, isEndScreen, now, obs, onCountdownEnd, screen, settings, settingsRef, sourceActive, timerEpoch, videoBitisiyleBitirRef, videoNode, videoSrc }: UseKabukBitisGirdisi) {

  const countdown = useMemo(() => {
    void timerEpoch;
    // Hedef tarih ve dakika artık kuraldan geliyor (giriş ekranı eski
    // davranışta targetDate'i yok sayıyordu; bu, kuraldan türetiliyor).
    let target = effTarget ? new Date(effTarget).getTime() : NaN;
    const mins = isEndScreen ? effMinutes : 0;

    if (
      isNaN(target) &&
      mins > 0 &&
      (screen === "brb" || screen === "ending" || screen === "starting")
    ) {
      if (screen === "starting") {
        const persisted = readStartingCountdownEnd();
        if (persisted > Date.now()) {
          target = persisted;
        } else if (obs && !sourceActive) {
          const total = mins * 60;
          return {
            mode: "count" as const,
            total,
            hours: Math.floor(total / 3600),
            minutes: Math.floor((total % 3600) / 60),
            seconds: total % 60,
            totalMinutes: mins,
            pending: true,
          };
        }
      }
      if (isNaN(target)) {
      // OBS'te sahne henüz aktif değil → ayarlanan süreyi sabit göster, sayma.
      if (obs && !sourceActive) {
        const total = mins * 60;
        return {
          mode: "count" as const,
          total,
          hours: Math.floor(total / 3600),
          minutes: Math.floor((total % 3600) / 60),
          seconds: total % 60,
          totalMinutes: mins,
          pending: true,
        };
      }
      const key = `${screen}_end_${mins}`;
      const end = Number(sessionStorage.getItem(key) || 0);
      if (end > Date.now()) {
        target = end;
      } else if (end > 0) {
        return { mode: "badge" as const, ended: true };
      } else {
        const total = mins * 60;
        return {
          mode: "count" as const,
          total,
          hours: Math.floor(total / 3600),
          minutes: Math.floor((total % 3600) / 60),
          seconds: total % 60,
          totalMinutes: mins,
          pending: true,
        };
      }
      }
    }
    if (isNaN(target)) {
      // Hiç sayaç kurulmamış. `ended` bayrağı şart: sayaç bitmiş gibi
      // davranırsak ekran açılır açılmaz sahne geçişi/yayın durdurma tetiklenir.
      if (screen === "ending" || screen === "brb" || screen === "starting") {
        return { mode: "badge" as const, ended: false };
      }
      return { mode: "hidden" as const };
    }
    const diff = target - now;
    if (diff <= 0) return { mode: "badge" as const, ended: true };
    const total = Math.floor(diff / 1000);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return {
      mode: "count" as const,
      total,
      hours,
      minutes,
      seconds,
      totalMinutes: Math.floor(total / 60),
    };
  }, [
    effTarget,
    effMinutes,
    isEndScreen,
    now,
    screen,
    obs,
    sourceActive,
    timerEpoch,
  ]);

  /** Ekranın bitiş eylemini (sahne geçişi / yayın durdurma) bir kez çalıştırır. */
  const bitisiTetikle = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    onCountdownEnd?.(settingsRef.current);
  }, [onCountdownEnd]);

  // Video tur sayacı ("video N kez dönünce bitsin"). Hedef 1 ise eski
  // davranış: ilk bitişte tamamdır.
  const loopsSeenRef = useRef(0);
  const lastLoopAtRef = useRef(0);
  /**
   * Videonun bir turu tamamlandı. Hedefe ulaşıldıysa ekranı bitirir, değilse
   * videoyu kırpma başlangıcına sarıp sürdürür.
   */
  const medyaTurBitti = useCallback(
    (el: HTMLVideoElement | null, start: number) => {
      // `timeupdate` (bitişe 0.2 sn kala) ve `ended` aynı turu bildirebilir.
      if (!shouldCountLoop(lastLoopAtRef.current, Date.now())) return;
      lastLoopAtRef.current = Date.now();
      const st = nextLoopState(loopsSeenRef.current, endRuleRef.current.loops);
      loopsSeenRef.current = st.seen;
      if (st.done) {
        try {
          el?.pause();
        } catch {
          /* */
        }
        bitisiTetikle();
        return;
      }
      if (el) {
        try {
          el.currentTime = start;
          void el.play().catch(() => {});
        } catch {
          /* meta yoksa sonraki olay yeniden dener */
        }
      }
    },
    [bitisiTetikle]
  );
  // Kaynak, kural ya da OBS görünürlüğü değişince sayaç sıfırlansın.
  useEffect(() => {
    loopsSeenRef.current = 0;
    lastLoopAtRef.current = 0;
  }, [videoSrc, endRule.mode, endRule.loops, sourceActive]);

  // Sayaç bitişi. Yalnızca bu oturumda sayacın "çalışır" hâlinde görüldükten
  // sonra bitişe geçince tetikle — sayfa açılırken zaten bitmiş sayaç OBS'te
  // rastgele sahne değiştirmesin.
  const sayacBitti =
    countdown.mode === "badge" &&
    !!countdown.ended &&
    !(obs && !sourceActive) &&
    !(countdown as { pending?: boolean }).pending;
  const sayacCalisiyor =
    countdown.mode === "badge" &&
    !countdown.ended &&
    !(countdown as { pending?: boolean }).pending;
  const armedForEndRef = useRef(false);
  useEffect(() => {
    if (countdown.mode === "count" || sayacCalisiyor) {
      armedForEndRef.current = true;
      endedRef.current = false;
    }
    if (sayacBitti) {
      if (!armedForEndRef.current) {
        // Açılışta zaten bitmiş sayaç: OBS sahnesini zorla değiştirme.
        // endedRef'i kilitleme — video/müzik bitişi hâlâ sahne geçirebilsin.
        return;
      }
      bitisiTetikle();
    }
  }, [sayacBitti, sayacCalisiyor, countdown.mode, bitisiTetikle]);

  /**
   * Video/müzik bitince aksiyon (Giriş→oyun sahnesi / Çıkış→yayın kapat).
   * Panel önizlemesinde `onCountdownEnd` yok — döngü bozulmasın.
   */
  const mediaBitisiyleBitir = useMemo(() => {
    if (!onCountdownEnd) return false;
    // Kullanıcı bir bitiş kuralı seçtiyse medya bitişi yalnızca o kural
    // istiyorsa etkin olur; dakika sayacı çalışıyor olması artık medya
    // bitişini engellemiyor ("süre veya video bitişi" ilk gerçekleşende biter).
    if (endRule.explicit) return endRule.usesMedia;
    if (screen === "ending") {
      if (settings.obs?.stopStreamOnEnd === false) return false;
      // Dakika/tarih sayacı aktifken medya bitişi yayın kapatmasın —
      // önce geri sayım bitsin (panel metniyle aynı).
      // Sayaç yoksa veya süresi dolmuşsa (badge) video/müzik bitişi yedek tetik.
      if (countdown.mode === "count") return false;
      return true;
    }
    if (screen === "starting") {
      // 5 dk sayacı çalışırken medya bitişi erken oyun sahnesine geçmesin.
      if (countdown.mode === "count") return false;
      return settings.obs?.autoSwitchOnStartingMediaEnd !== false;
    }
    return false;
  }, [
    onCountdownEnd,
    screen,
    settings.obs?.stopStreamOnEnd,
    settings.obs?.autoSwitchOnStartingMediaEnd,
    countdown.mode,
    endRule.explicit,
    endRule.usesMedia,
  ]);
  // Eski adla aynı ref — video loop / Youtube playOnce buradan okuyor.
  const videoBitisiyleBitir = mediaBitisiyleBitir;
  videoBitisiyleBitirRef.current = videoBitisiyleBitir;

  // Medya bitiş aksiyonu açıkken loop bayrağını güncel tut.
  useEffect(() => {
    const a = audioNode;
    if (a) a.loop = !videoBitisiyleBitir && settings.audioLoop !== false;
    const v = videoNode;
    if (v) {
      const start = Number(settings.bgVideoStart) || 0;
      const end = Number(settings.bgVideoEnd) || 0;
      v.loop = !videoBitisiyleBitir && !(end > start);
    }
  }, [audioNode, videoNode, videoBitisiyleBitir, settings.audioLoop, settings.bgVideoStart, settings.bgVideoEnd]);
  return { bitisiTetikle, countdown, medyaTurBitti, videoBitisiyleBitir };
}
