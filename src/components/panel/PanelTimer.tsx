import { useEffect, useState } from "react";

/**
 * Giriş/Çıkış/Mola geri sayımı — kendi saniyelik sayacıyla.
 *
 * Sayaç eskiden `PanelPage` kökünde (`setTick` her 1 sn) çalışıyordu: her saniye
 * 3800 satırlık tüm panel — tüm sekmeler, formlar, listeler — yeniden çiziliyordu.
 * Bu, giriş/çıkış/mola sekmelerinde sürekli küçük takılmalara ve gecikmiş
 * tepkiye yol açıyordu. Artık yalnız bu küçük bileşen her saniye çizilir.
 */

export type TimerScreen = "starting" | "ending" | "brb" | string;

export type TimerInput = {
  screen: TimerScreen;
  endingMinutes?: unknown;
  brbMinutes?: unknown;
  targetDate?: unknown;
};

/** Saf hesap: gösterilecek "MM:SS" metni ya da (bu ekranda sayaç yoksa) null. */
export function computePanelTimer(
  cfg: TimerInput,
  now: number,
  read: (key: string) => string | null
): string | null {
  const { screen } = cfg;
  if (screen !== "ending" && screen !== "brb" && screen !== "starting") return null;
  const mins =
    screen === "starting"
      ? 5
      : screen === "ending"
        ? Number(cfg.endingMinutes) || 0
        : Number(cfg.brbMinutes) || 0;
  const target = cfg.targetDate ? String(cfg.targetDate) : "";
  if (screen !== "starting" && !mins && !target) return null;

  let end = screen !== "starting" && target ? new Date(target).getTime() : NaN;
  if (isNaN(end)) {
    const key =
      screen === "starting" ? "starting_end_5" : screen === "ending" ? "ending_end_" + mins : "brb_end_" + mins;
    end = Number(read(key) || 0);
    if (!end) return `${String(mins).padStart(2, "0")}:00`;
  }
  const left = Math.max(0, Math.floor((end - now) / 1000));
  const m = Math.floor(left / 60);
  const s = left % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Her saniye kendini yenileyen sayaç metni; sayaç yoksa `render` çağrılmaz. */
export default function PanelTimer({
  timer,
  render,
}: {
  timer: TimerInput;
  render: (text: string) => React.ReactNode;
}) {
  const active = timer.screen === "starting" || timer.screen === "ending" || timer.screen === "brb";
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);

  const text = computePanelTimer(timer, now, readSession);
  return text == null ? null : <>{render(text)}</>;
}
