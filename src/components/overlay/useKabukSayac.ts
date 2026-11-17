/** OverlayShell'den ayrıldı (TEK-4, davranış aynı): süre/hedef tarih sayacının kurulması. */
import { useEffect, useState } from "react";
import { OverlaySettings, ScreenId } from "../../lib/api";
import { TextStyle, TextStyleKey } from "../../lib/textStyles";
import { readStartingCountdownEnd, STARTING_END_STORAGE_KEY } from "../../lib/streamAutomation";

export type UseKabukSayacGirdisi = {
  countdownActive: boolean;
  effMinutes: number;
  effTarget: string;
  endedRef: React.RefObject<boolean>;
  initial: OverlaySettings;
  isEndScreen: boolean;
  liveSettings: OverlaySettings | undefined;
  minuteTimerArmed: boolean;
  obs: boolean;
  screen: ScreenId;
  setNow: React.Dispatch<React.SetStateAction<number>>;
  setSynced: React.Dispatch<React.SetStateAction<OverlaySettings>>;
  settings: OverlaySettings;
  sourceActive: boolean;
};

export function useKabukSayac({ countdownActive, effMinutes, effTarget, endedRef, initial, isEndScreen, liveSettings, minuteTimerArmed, obs, screen, setNow, setSynced, settings, sourceActive }: UseKabukSayacGirdisi) {
  useEffect(() => {
    if (!countdownActive) return;
    if (obs && minuteTimerArmed && !sourceActive) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [countdownActive, obs, minuteTimerArmed, sourceActive]);

  // Dakika sayacı. Giriş: Dashboard’dan yazılan bitiş damgası korunur (yenilemede sıfırlanmaz).
  const [timerEpoch, setTimerEpoch] = useState(0);
  useEffect(() => {
    if (!isEndScreen) return;
    if (effTarget) return;
    const mins = effMinutes;
    if (!mins) return;
    const key = `${screen}_end_${mins}`;

    if (screen === "starting") {
      const persisted = readStartingCountdownEnd();
      if (persisted > Date.now()) {
        try {
          sessionStorage.setItem(key, String(persisted));
          localStorage.setItem(STARTING_END_STORAGE_KEY, String(persisted));
        } catch {
          /* */
        }
        setNow(Date.now());
        return;
      }
      if (obs && !sourceActive) {
        setNow(Date.now());
        setTimerEpoch((n) => n + 1);
        return;
      }
      const end = Date.now() + mins * 60_000;
      try {
        sessionStorage.setItem(key, String(end));
        localStorage.setItem(STARTING_END_STORAGE_KEY, String(end));
      } catch {
        /* */
      }
      endedRef.current = false;
      setNow(Date.now());
      setTimerEpoch((n) => n + 1);
      return;
    }

    if (obs) {
      if (sourceActive) {
        const existing = Number(sessionStorage.getItem(key) || 0);
        if (!existing || existing < Date.now()) {
          sessionStorage.setItem(key, String(Date.now() + mins * 60_000));
          endedRef.current = false;
        }
        setNow(Date.now());
        setTimerEpoch((n) => n + 1);
      } else {
        setNow(Date.now());
        setTimerEpoch((n) => n + 1);
      }
      return;
    }

    const existing = Number(sessionStorage.getItem(key) || 0);
    if (!existing || existing < Date.now()) {
      sessionStorage.setItem(key, String(Date.now() + mins * 60_000));
      endedRef.current = false;
      setNow(Date.now());
      setTimerEpoch((n) => n + 1);
    }
  }, [
    obs,
    sourceActive,
    screen,
    effMinutes,
    effTarget,
  ]);

  // "Yayını başlat": panel yeni bitiş anını ayarla yayar (`countdownEndsAt`). OBS ayrı bir tarayıcıdır, panelin
  // yerel belleğini göremez; bu olmadan sayaç önizlemede kaldığı saniyeden devam ediyordu.
  const yayinBitisi = Number((settings as { countdownEndsAt?: unknown }).countdownEndsAt) || 0;
  useEffect(() => {
    if (screen !== "starting" || yayinBitisi <= Date.now()) return;
    try {
      localStorage.setItem(STARTING_END_STORAGE_KEY, String(yayinBitisi));
      sessionStorage.setItem("starting_end_5", String(yayinBitisi));
      sessionStorage.setItem(`starting_end_${effMinutes}`, String(yayinBitisi));
    } catch {
      /* bellek kapalıysa sayaç yine `settings` üzerinden doğru başlar */
    }
    endedRef.current = false;
    setNow(Date.now());
    setTimerEpoch((n) => n + 1);
  }, [screen, yayinBitisi, effMinutes]);

  // Seed from initial once if sync empty
  useEffect(() => {
    if (liveSettings) return;
    if (initial && Object.keys(initial).length > 0) {
      setSynced((s: OverlaySettings) => (Object.keys(s).length ? s : initial));
    }
  }, [initial, liveSettings, setSynced]);

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", settings.accent || "#7c5cff");
    document.documentElement.style.setProperty("--title-color", settings.textColor || "#fff");
    document.documentElement.style.setProperty("--eyebrow-color", settings.eyebrowColor || "#b39dff");
    document.documentElement.style.setProperty("--sub-color", settings.subColor || "#c9cddb");
    document.documentElement.style.setProperty("--countdown-color", settings.countdownColor || "#fff");
    document.documentElement.style.setProperty("--ticker-color", settings.tickerColor || "#9aa0b4");
    document.documentElement.style.setProperty("--logo-zoom", String((settings.logoZoom || 100) / 100));
    document.documentElement.style.setProperty("--logo-pan-x", `${settings.logoPanX || 0}%`);
    document.documentElement.style.setProperty("--logo-pan-y", `${settings.logoPanY || 0}%`);

    const styles = (settings.textStyles || {}) as Record<string, TextStyle>;
    (["eyebrow", "title", "sub", "countdown", "ticker", "credits"] as TextStyleKey[]).forEach((key) => {
      const st = styles[key] || {};
      const size = (st.size ?? (key === "credits" ? settings.creditsSize : undefined) ?? 100) / 100;
      document.documentElement.style.setProperty(`--${key}-fx-scale`, String(size));
      if (st.color) {
        if (key === "title") document.documentElement.style.setProperty("--title-color", st.color);
        if (key === "eyebrow") document.documentElement.style.setProperty("--eyebrow-color", st.color);
        if (key === "sub") document.documentElement.style.setProperty("--sub-color", st.color);
        if (key === "countdown") document.documentElement.style.setProperty("--countdown-color", st.color);
        if (key === "ticker") document.documentElement.style.setProperty("--ticker-color", st.color);
      }
    });
  }, [settings]);
  return { timerEpoch };
}
