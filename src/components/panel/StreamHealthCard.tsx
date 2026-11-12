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
  bytes: 0,
  fps: null,
};

export default function StreamHealthCard() {
  const [health, setHealth] = useState<StreamHealth>(EMPTY);
  const [obsErr, setObsErr] = useState<string | null>(null);
  const notices = useNotices();
  const [sesli, setSesli] = useState(() => localStorage.getItem("studio.saglikSesi") !== "0");

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
    const id = setVisibleInterval(() => void tick(), 5000);
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
    <section className="mx-4 mb-3 rounded-2xl border border-white/[0.08] bg-panel-card/70 p-4 shadow-panel">
      <div className="mb-2.5 flex items-center justify-between gap-2 border-b border-white/[0.06] pb-2.5">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-panel-accent" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">Yayın Sağlığı & Telemetri</h3>
          <label className="ml-2 flex items-center gap-1 text-[10px] font-semibold text-white/70" title="Kare düşüşü, ağ yoğunluğu, kopma ve yayın durmasında sesli uyarı (her sekmede çalışır)">
            <input
              type="checkbox"
              checked={sesli}
              onChange={(e) => {
                setSesli(e.target.checked);
                localStorage.setItem("studio.saglikSesi", e.target.checked ? "1" : "0");
              }}
            />
            Sesli uyarı
          </label>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
            health.active
              ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
              : "border border-white/10 bg-white/5 text-white/70"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${health.active ? "bg-emerald-400 animate-pulse" : "bg-white/40"}`} />
          {health.active ? "Canlı" : "Kapalı"}
        </span>
      </div>

      <div className={`grid grid-cols-3 gap-3 ${health.active ? "" : "opacity-65"}`}>
        <div className="rounded-xl border border-white/[0.08] bg-black/35 p-3">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white/80">
            <Clock className="h-3.5 w-3.5 text-panel-accent" /> Süre
          </p>
          <p className="mt-1 font-mono text-lg md:text-xl font-bold tracking-tight text-white">
            {health.active ? fmtUptime(health.durationMs) : "—:—"}
          </p>
          <p className="mt-0.5 text-xs font-medium text-white/70">Yayın zamanlayıcısı</p>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-black/35 p-3">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white/80">
            <WifiOff className="h-3.5 w-3.5 text-amber-400" /> Drop Kare
          </p>
          <p
            className={`mt-1 font-mono text-lg md:text-xl font-bold tracking-tight ${
              health.dropPct >= 2 ? "text-amber-300" : "text-white"
            }`}
          >
            {health.active ? `%${health.dropPct.toFixed(1)}` : "—"}
          </p>
          <p className="mt-0.5 truncate text-xs font-medium text-white/70">
            {health.active ? `${health.skippedFrames}/${health.totalFrames} kare` : "ölçüm yok"}
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-black/35 p-3">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white/80">
            <Activity className="h-3.5 w-3.5 text-panel-accent" /> Ağ Yoğunluğu
          </p>
          <p className="mt-1 font-mono text-lg md:text-xl font-bold tracking-tight text-white">
            {health.active
              ? `%${Math.round(Math.min(1, Math.max(0, health.congestion)) * 100)}`
              : "—"}
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-gradient-to-r from-teal-400 to-emerald-400 transition-all duration-300"
              style={{
                width: health.active
                  ? `${Math.min(100, Math.max(5, Math.round(health.congestion * 100)))}%`
                  : "0%",
              }}
            />
          </div>
        </div>
      </div>

      {!health.active && (
        <p className="mt-2.5 text-xs font-medium text-white/70">
          Yayın başlayınca canlı OBS telemetri verileri aktarılır.
        </p>
      )}

      {errors.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {errors.slice(0, 4).map((text) => (
            <li
              key={text}
              className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-xs font-medium leading-relaxed text-red-100"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-2.5 flex items-center gap-2 text-xs font-medium text-white/75">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span>Sistem kararlı · Aktif hata yok</span>
        </div>
      )}
    </section>
  );
}
