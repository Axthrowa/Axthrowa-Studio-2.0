/** Alt durum çubuğu. Canlı nokta yalnız burada. */

import { useEffect, useRef, useState } from "react";
import { useT } from "../../i18n";
import { getStreamHealth, isObsConnected } from "../../lib/obs";
import { clearVisibleInterval, setVisibleInterval } from "../../lib/visibleInterval";
import { useAxthrowaStore } from "../../store/useAxthrowaStore";

function fmtSure(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${m}:${ss}`;
}

export default function DurumCubugu({ port }: { port: string }) {
  const t = useT();
  const obs = useAxthrowaStore((s) => s.isObsConnected);
  const canli = useAxthrowaStore((s) => s.isLive);
  const [sure, setSure] = useState(0);
  const [dusen, setDusen] = useState<number | null>(null);
  const ornek = useRef({ at: 0, sure: 0, aktif: false });

  useEffect(() => {
    let iptal = false;
    const tick = async () => {
      if (!isObsConnected()) {
        ornek.current.aktif = false;
        if (!iptal) {
          setSure(0);
          setDusen(null);
        }
        return;
      }
      try {
        const h = await getStreamHealth();
        if (iptal) return;
        ornek.current = { at: Date.now(), sure: h.active ? h.durationMs : 0, aktif: h.active };
        setSure(ornek.current.sure);
        setDusen(h.active ? h.dropPct : null);
      } catch {
        if (!iptal) setDusen(null);
      }
    };
    void tick();
    const id = setVisibleInterval(() => void tick(), 5000);
    const clock = window.setInterval(() => {
      const o = ornek.current;
      if (!o.aktif) return;
      setSure(o.sure + (Date.now() - o.at));
    }, 1000);
    return () => {
      iptal = true;
      clearVisibleInterval(id);
      window.clearInterval(clock);
    };
  }, [obs]);

  return (
    <footer className="flex h-7 shrink-0 items-center gap-3 border-t border-white/10 bg-[var(--dt-surface-2)] px-3 text-[11px] text-white/70">
      <span className="inline-flex items-center gap-1.5">
        <span className={"h-1.5 w-1.5 rounded-full " + (obs ? "bg-[var(--dt-ok)]" : "bg-white/35")} />
        {obs ? t("status.obsOn") : t("status.obsOff")}
      </span>
      <span className="text-white/50" aria-hidden>
        ·
      </span>
      <span className={"inline-flex items-center gap-1.5 font-medium tabular-nums " + (canli ? "text-[var(--dt-live)]" : "")}>
        {canli ? <span className="h-1.5 w-1.5 rounded-full bg-[var(--dt-live)]" /> : null}
        {canli ? `CANLI ${fmtSure(sure)}` : t("status.idle")}
      </span>
      {dusen != null ? (
        <>
          <span className="text-white/50" aria-hidden>
            ·
          </span>
          <span className={"tabular-nums " + (dusen >= 2 ? "text-[var(--dt-warn)]" : "")}>
            {t("status.drop")} %{dusen.toFixed(1)}
          </span>
        </>
      ) : null}
      <span className="ml-auto font-mono tabular-nums text-white/55">:{port}</span>
    </footer>
  );
}
