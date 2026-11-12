/**
 * Uyarı kuyruğu monitörü (U3): OBS'teki uyarı kutusunda ekrandaki ve sıradaki uyarılar; duraklat, sustur, atla,
 * bekleyenleri temizle, son uyarıları yeniden oynat. Durum botta tutulur; aynı botu açan her panel (uzak moderatör
 * dahil) aynı kuyruğu görür. İyimser kilit: başka biri az önce değiştirdiyse eylem reddedilir, güncel durum yüklenir.
 */
import { useCallback, useEffect, useState } from "react";
import { Pause, Play, RotateCcw, SkipForward, Trash2, Volume2, VolumeX } from "lucide-react";
import { axbotBase } from "../../lib/axbot";

type AlertState = { paused: boolean; muted: boolean; version: number; updatedBy: string; lastAction: string | null; updatedAt: number };
type RecentAlert = { id: string; eventType: string; title: string; message: string; at: number; isTest: boolean };
type KuyrukOgesi = { id: string; eventType: string; title: string; message?: string; isTest: boolean };
type Kuyruk = { aktif: KuyrukOgesi | null; bekleyen: KuyrukOgesi[]; guncellendi: number; kaynak: number };

const ROZET = "rounded-full border px-2 py-0.5 text-[10px] font-bold";
const DUGME = "studio-btn-ghost inline-flex items-center gap-1 !px-2 !py-1";

function Oge({ o, etiket }: { o: KuyrukOgesi; etiket?: string }) {
  return (
    <span className="min-w-0 truncate text-white/80">
      {etiket ? <span className="mr-1 text-[10px] font-bold text-panel-accent">{etiket}</span> : null}
      {o.title || o.eventType}
      {o.message ? <span className="ml-1 text-panel-muted">{o.message}</span> : null}
      {o.isTest ? <span className="ml-1 text-[10px] text-cyan-300">TEST</span> : null}
    </span>
  );
}

export default function UyariKuyrugu({ onToast }: { onToast: (m: string) => void }) {
  const [state, setState] = useState<AlertState | null>(null);
  const [recent, setRecent] = useState<RecentAlert[]>([]);
  const [kuyruk, setKuyruk] = useState<Kuyruk | null>(null);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${await axbotBase()}/api/alerts/control`, { cache: "no-store" });
      const d = await r.json();
      setState(d.state);
      setRecent(d.recent || []);
      setKuyruk(d.queue || null);
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    void load();
    let ws: WebSocket | null = null;
    let closed = false;
    let retry: number | undefined;
    const connect = async () => {
      const kok = await axbotBase();
      if (closed) return;
      ws = new WebSocket(`${kok.replace(/^http/, "ws")}/ws?type=dashboard`);
      ws.onopen = () => void load();
      ws.onmessage = (ev) => {
        try {
          const m = JSON.parse(String(ev.data));
          if (m?.type === "alert_queue" && m.queue) setKuyruk(m.queue);
          if (m?.type === "alert_control" && m.state) setState(m.state);
          if (m?.type === "alert_control" || m?.type === "alert") window.setTimeout(() => void load(), 250);
        } catch {
          /* */
        }
      };
      ws.onclose = () => {
        if (!closed) retry = window.setTimeout(() => void connect(), 4000);
      };
    };
    void connect();
    return () => {
      closed = true;
      if (retry) window.clearTimeout(retry);
      ws?.close();
    };
  }, [load]);

  const act = async (action: string, alertId?: string) => {
    try {
      const r = await fetch(`${await axbotBase()}/api/alerts/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, version: state?.version, alertId, actor: "Canlı ekranı" }),
      });
      const d = await r.json().catch(() => ({}));
      if (d?.state) setState(d.state);
      if (d?.recent) setRecent(d.recent);
      if (d?.queue) setKuyruk(d.queue);
      if (r.status === 409) onToast(`${d.error || "Başka biri az önce değiştirdi"}: güncel durum yüklendi`);
      else if (!r.ok) onToast(d.error || "Uyarı denetimi uygulanamadı");
    } catch {
      onToast("AxBoT'a ulaşılamadı (Bot sekmesinden başlatın)");
    }
  };

  if (offline) return <p className="text-xs text-white/50">AxBoT çalışmıyor: uyarı kuyruğu için Bot sekmesinden başlatın.</p>;

  const bekleyen = kuyruk?.bekleyen ?? [];
  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" className={DUGME} disabled={!state} aria-pressed={!!state?.paused} onClick={() => void act(state?.paused ? "resume" : "pause")}>
          {state?.paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />} {state?.paused ? "Sürdür" : "Duraklat"}
        </button>
        <button type="button" className={DUGME} disabled={!state} aria-pressed={!!state?.muted} onClick={() => void act(state?.muted ? "unmute" : "mute")}>
          {state?.muted ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />} {state?.muted ? "Sesi aç" : "Sessize al"}
        </button>
        <button type="button" className={DUGME} disabled={!state || !kuyruk?.aktif} onClick={() => void act("skip")}>
          <SkipForward className="h-3 w-3" /> Atla
        </button>
        <button type="button" className={DUGME} disabled={!state || !bekleyen.length} onClick={() => void act("clear")}>
          <Trash2 className="h-3 w-3" /> Bekleyenleri temizle
        </button>
        {state?.paused ? <span className={`${ROZET} border-amber-500/30 bg-amber-500/15 text-amber-300`}>DURAKLATILDI</span> : null}
        {state?.muted ? <span className={`${ROZET} border-red-500/30 bg-red-500/15 text-red-300`}>SESSİZ</span> : null}
      </div>

      <section aria-label="Sıradaki uyarılar" className="space-y-1">
        {!kuyruk?.kaynak ? (
          <p className="text-panel-muted">OBS'te açık uyarı kutusu yok; sıradaki uyarılar kutu açılınca görünür.</p>
        ) : (
          <>
            <div className="rounded-lg bg-white/[0.05] px-2 py-1">{kuyruk.aktif ? <Oge o={kuyruk.aktif} etiket="EKRANDA" /> : <span className="text-panel-muted">Ekranda uyarı yok</span>}</div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-panel-muted">Sırada ({bekleyen.length})</p>
            {bekleyen.length ? (
              <ol className="max-h-32 space-y-1 overflow-y-auto">
                {bekleyen.map((o, i) => (
                  <li key={o.id} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2 py-1">
                    <span className="w-4 shrink-0 text-right tabular-nums text-panel-muted">{i + 1}</span>
                    <Oge o={o} />
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-panel-muted">Bekleyen uyarı yok.</p>
            )}
          </>
        )}
      </section>

      {state?.lastAction ? (
        <p className="text-[10px] text-panel-muted">
          Son: {state.updatedBy} · {state.lastAction} · {new Date(state.updatedAt).toLocaleTimeString("tr-TR")}
        </p>
      ) : null}

      <section aria-label="Son uyarılar" className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-panel-muted">Son uyarılar</p>
        <div className="max-h-40 space-y-1 overflow-y-auto">
          {recent.length === 0 ? <p className="text-panel-muted">Bu oturumda uyarı yok.</p> : null}
          {recent.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2 py-1">
              <span className="min-w-0 truncate text-white/80">
                {u.title || u.eventType} <span className="text-panel-muted">{u.message}</span>
                {u.isTest ? <span className="ml-1 text-[10px] text-cyan-300">TEST</span> : null}
              </span>
              <button type="button" className="shrink-0 rounded p-1 hover:bg-white/10" title="Yeniden oynat" aria-label={`Yeniden oynat: ${u.title || u.eventType}`} onClick={() => void act("replay", u.id)}>
                <RotateCcw className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
