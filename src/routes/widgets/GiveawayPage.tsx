/** OBS Giveaways / çekiliş */

import { useEffect, useMemo, useState } from "react";
import { useObsKeepalive } from "../../lib/obsKeepalive";
import { useOverlayBotConfig } from "../../lib/smartBot/useOverlayWidgetEvents";
import { useIsWidgetPreview } from "../../lib/smartBot/widgetPreview";
import type { GiveawayConfig } from "../../lib/smartBot/v2";

export default function GiveawayPage() {
  useObsKeepalive();
  const preview = useIsWidgetPreview();
  const cfg = useOverlayBotConfig();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 250);
    return () => window.clearInterval(id);
  }, []);

  const g: GiveawayConfig = cfg.giveaway || {
    active: false,
    keyword: "+1",
    prize: "",
    entrants: [],
    subMultiplier: 1,
    subsOnly: false,
    spinDurationSec: 5,
    claimDurationSec: 60,
    spinning: false,
    winner: "",
    claimUntil: null,
  };

  const claimLeft = useMemo(() => {
    void tick;
    if (!g.claimUntil) return 0;
    return Math.max(0, Math.ceil((g.claimUntil - Date.now()) / 1000));
  }, [g.claimUntil, tick]);

  const names =
    g.entrants.length > 0
      ? g.entrants.map((e) => e.split(":")[1] || e)
      : preview
        ? ["Demo1", "Demo2", "ChatFan"]
        : [];

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-transparent p-6 text-white">
      <div className="w-[min(94vw,480px)] rounded-2xl border border-emerald-400/25 bg-zinc-950/85 px-6 py-5 text-center backdrop-blur-md">
        {preview && !g.active && (
          <div className="mb-2 text-[10px] uppercase tracking-widest text-amber-300/80">Önizleme</div>
        )}
        <div className="text-[10px] uppercase tracking-[0.22em] text-emerald-300/80">Çekiliş</div>
        {g.spinning ? (
          <>
            <div className="mt-4 h-28 overflow-hidden rounded-xl border border-white/10 bg-black/50">
              <div className="animate-[spinScroll_0.35s_linear_infinite] py-2 text-xl font-semibold">
                {[...names, ...names, g.winner || "?"].map((n, i) => (
                  <div key={`${n}-${i}`} className="py-1">
                    {n}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3 text-sm text-white/70">Çevriliyor…</div>
          </>
        ) : g.winner ? (
          <>
            <div className="mt-4 text-3xl font-semibold text-emerald-300">{g.winner}</div>
            <div className="mt-2 text-sm text-white/70">{g.prize || "Ödül"}</div>
            {claimLeft > 0 && <div className="mt-2 text-xs text-white/50">Claim: {claimLeft}s</div>}
          </>
        ) : (
          <>
            <div className="mt-4 text-lg font-semibold">{g.prize || (preview ? "Örnek ödül" : "Bekleniyor")}</div>
            <div className="mt-2 text-sm text-white/70">
              Anahtar: <span className="font-mono text-emerald-200">{g.keyword || "+1"}</span>
            </div>
            <div className="mt-3 text-xs text-white/55">{names.length} katılımcı</div>
            {!g.active && !preview && (
              <div className="mt-3 text-sm text-white/80">Çekiliş kapalı — panelden başlat</div>
            )}
          </>
        )}
      </div>
      <style>{`
        @keyframes spinScroll {
          from { transform: translateY(0); }
          to { transform: translateY(-33%); }
        }
      `}</style>
    </div>
  );
}
