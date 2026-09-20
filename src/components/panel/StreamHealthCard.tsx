import { clearVisibleInterval, setVisibleInterval } from "../../lib/visibleInterval";
import { useEffect, useState } from "react";
import { Activity, AlertTriangle, Clock, WifiOff } from "lucide-react";
import { getStreamHealth, isObsConnected, type StreamHealth } from "../../lib/obs";
import { useNotices } from "../../lib/notices";

function fmtUptime(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const EMPTY: StreamHealth = {
  active: false,
  reconnecting: false,
  durationMs: 0,
  congestion: 0,
  skippedFrames: 0,
  totalFrames: 0,
  dropPct: 0,
};

export default function StreamHealthCard() {
  const [health, setHealth] = useState<StreamHealth>(EMPTY);
  const [obsErr, setObsErr] = useState<string | null>(null);
  const notices = useNotices();

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (!isObsConnected()) {
        if (!cancelled) {
          setHealth(EMPTY);
          setObsErr(null);
        }
        return;
      }
      try {
        const next = await getStreamHealth();
        if (!cancelled) {
          setHealth(next);
          setObsErr(null);
        }
      } catch (e) {
        if (!cancelled) setObsErr(String((e as Error)?.message || e));
      }
    };
    void tick();
    const id = setVisibleInterval(() => void tick(), 2000);
    return () => {
      cancelled = true;
      clearVisibleInterval(id);
    };
  }, []);

  const errors = [
    ...notices.map((n) => n.text + (n.hint ? ` — ${n.hint}` : "")),
    ...(obsErr ? [obsErr] : []),
    ...(health.reconnecting ? ["OBS yeniden bağlanıyor"] : []),
    ...(health.dropPct >= 2 ? [`Kare düşüşü yüksek: %${health.dropPct.toFixed(1)}`] : []),
  ];

  return (
    <section className="mx-4 mb-2 rounded-xl border border-panel-border/80 bg-panel-card/80 p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-white">Yayın sağlığı</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            health.active
              ? "bg-emerald-500/15 text-emerald-200"
              : "bg-white/5 text-panel-muted"
          }`}
        >
          {health.active ? "Canlı" : "Kapalı"}
        </span>
      </div>
      {/* Yayın kapalıyken 0:00 / %0.0 gerçek ölçüm gibi duruyordu; ölçüm yoksa
          sayı yerine tire gösterip soluklaştırıyoruz. */}
      <div className={`grid grid-cols-3 gap-1.5 ${health.active ? "" : "opacity-60"}`}>
        <div className="rounded-lg border border-white/[0.06] bg-black/20 px-2 py-1.5">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-panel-muted">
            <Clock className="h-3 w-3" /> Süre
          </p>
          <p className="mt-0.5 font-mono text-sm text-white">
            {health.active ? fmtUptime(health.durationMs) : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-black/20 px-2 py-1.5">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-panel-muted">
            <WifiOff className="h-3 w-3" /> Drop
          </p>
          <p
            className={`mt-0.5 font-mono text-sm ${
              health.dropPct >= 2 ? "text-amber-300" : "text-white"
            }`}
          >
            {health.active ? `%${health.dropPct.toFixed(1)}` : "—"}
          </p>
          <p className="text-[10px] text-panel-muted">
            {health.active ? `${health.skippedFrames}/${health.totalFrames} kare` : "ölçüm yok"}
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-black/20 px-2 py-1.5">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-panel-muted">
            <Activity className="h-3 w-3" /> Yoğunluk
          </p>
          <p className="mt-0.5 font-mono text-sm text-white">
            {health.active
              ? `%${Math.round(Math.min(1, Math.max(0, health.congestion)) * 100)}`
              : "—"}
          </p>
        </div>
      </div>
      {!health.active && (
        <p className="mt-1.5 text-[11px] text-panel-muted">
          Yayın başlayınca ölçülmeye başlar.
        </p>
      )}
      {errors.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {errors.slice(0, 4).map((text) => (
            <li
              key={text}
              className="flex items-start gap-1.5 rounded-md border border-red-400/25 bg-red-500/10 px-2 py-1 text-[11px] text-red-100"
            >
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[10px] text-panel-muted">Aktif hata yok</p>
      )}
    </section>
  );
}
