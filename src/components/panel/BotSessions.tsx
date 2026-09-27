import { useCallback, useEffect, useState } from "react";
import { clearVisibleInterval, setVisibleInterval } from "../../lib/visibleInterval";
import { streamaxtBase } from "../../lib/streamaxt";

/** StreamAxT `/api/status` çıktısındaki tek platform. */
type PlatformStatus = { connected?: boolean; channel?: string; error?: string };

type BotStatus = {
  uptime?: string;
  platforms?: Record<string, PlatformStatus>;
  stats?: { commandsCount?: number; timersCount?: number; queueCount?: number };
};

/** Gösterim sırası ve Türkçe adlar. */
const PLATFORMS: Array<{ id: string; label: string }> = [
  { id: "kick", label: "Kick" },
  { id: "twitch", label: "Twitch" },
  { id: "youtube", label: "YouTube" },
  { id: "discord", label: "Discord" },
  { id: "tiktok", label: "TikTok" },
];

/**
 * Dashboard'daki Kick kartında bot (StreamAxT) durumu: çalışıyor mu, ne kadardır
 * ayakta ve hangi platform oturumlarına bağlı.
 *
 * Veri doğrudan StreamAxT sunucusundan (`/api/status`) okunur; bot kapalıyken
 * istek düşer ve kart "kapalı" gösterir.
 */
export default function BotSessions() {
  const [st, setSt] = useState<BotStatus | null>(null);
  const [checked, setChecked] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`${await streamaxtBase()}/api/status`, { cache: "no-store" });
      setSt(r.ok ? ((await r.json()) as BotStatus) : null);
    } catch {
      setSt(null);
    } finally {
      setChecked(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setVisibleInterval(() => void refresh(), 5000);
    return () => clearVisibleInterval(id);
  }, [refresh]);

  const live = !!st;
  const platforms = st?.platforms || {};

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
      <div className="flex items-center gap-2">
        <span
          className={
            "h-2 w-2 shrink-0 rounded-full " +
            (live ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-neutral-500")
          }
        />
        <span className="text-[11px] font-bold uppercase tracking-wider text-white/80">Bot · StreamAxT</span>
        <span className="ml-auto truncate text-[11px] text-panel-muted">
          {!checked ? "denetleniyor…" : live ? st?.uptime || "açık" : "kapalı"}
        </span>
      </div>

      {live ? (
        <>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {PLATFORMS.map(({ id, label }) => {
              const p = platforms[id] || {};
              const on = !!p.connected;
              return (
                <span
                  key={id}
                  title={p.error || (on ? `Bağlı: ${p.channel || "-"}` : "Bağlı değil")}
                  className={
                    "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold " +
                    (on
                      ? "bg-emerald-500/15 text-emerald-200"
                      : "bg-white/[0.04] text-white/60")
                  }
                >
                  <span className={"h-1.5 w-1.5 rounded-full " + (on ? "bg-emerald-400" : "bg-white/30")} />
                  {label}
                  {on && p.channel ? <span className="text-emerald-300/80">· {p.channel}</span> : null}
                </span>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-panel-muted">
            {st?.stats?.commandsCount ?? 0} komut · {st?.stats?.timersCount ?? 0} duyuru ·{" "}
            {st?.stats?.queueCount ?? 0} şarkı sırada
          </p>
        </>
      ) : (
        checked && (
          <p className="mt-2 text-[11px] text-panel-muted">
            Bot sekmesini açınca StreamAxT başlar ve oturumlar burada görünür.
          </p>
        )
      )}
    </div>
  );
}
