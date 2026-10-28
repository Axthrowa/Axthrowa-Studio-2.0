/**
 * Dashboard: gömülü StreamAxT botunun platform bağlantıları — YYA'nın kendi bağlantılarıyla aynı ekranda.
 * Bağlamak/ayarlamak botun Platformlar sayfasında (düğme o sekmeyi açar). — AxthrowA
 */
import { useEffect, useState } from "react";

const AD: Record<string, string> = { kick: "Kick", twitch: "Twitch", youtube: "YouTube", tiktok: "TikTok", trovo: "Trovo", discord: "Discord" };

export default function BotBaglantilari({ onAc }: { onAc: () => void }) {
  const [durum, setDurum] = useState<Record<string, { connected?: boolean; channel?: string }> | null>(null);
  const [kapali, setKapali] = useState(false);
  useEffect(() => {
    const port = import.meta.env.VITE_STREAMAXT_PORT || "3001";
    let iptal = false;
    const oku = () =>
      fetch(`http://127.0.0.1:${port}/api/status`)
        .then((r) => r.json())
        .then((d) => {
          if (iptal) return;
          setDurum(d?.platforms || {});
          setKapali(false);
        })
        .catch(() => !iptal && setKapali(true));
    oku();
    const t = setInterval(oku, 10_000);
    return () => {
      iptal = true;
      clearInterval(t);
    };
  }, []);

  return (
    <section className="mx-4 mb-3 rounded-2xl border border-white/[0.08] bg-panel-card/70 p-4 shadow-panel">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold uppercase tracking-wider text-white">Bot (StreamAxT) bağlantıları</h3>
        <button type="button" className="dt-btn" onClick={onAc}>
          Bot'ta yönet
        </button>
      </div>
      {kapali ? (
        <p className="text-xs text-amber-200">Bot çalışmıyor (Bot sekmesini açınca başlar).</p>
      ) : !durum ? (
        <p className="text-xs text-white/60">Yükleniyor…</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {Object.entries(durum)
            .filter(([ad]) => ad in AD)
            .map(([ad, d]) => (
              <span
                key={ad}
                className={`rounded-full border px-3 py-1 text-xs font-bold ${d?.connected ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-200" : "border-white/10 bg-white/5 text-white/55"}`}
                title={d?.channel ? `Kanal: ${d.channel}` : undefined}
              >
                {d?.connected ? "●" : "○"} {AD[ad]}
              </span>
            ))}
        </div>
      )}
    </section>
  );
}
