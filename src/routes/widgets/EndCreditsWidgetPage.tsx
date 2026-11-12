/** OBS End Credits */

import { useMemo } from "react";
import { useObsKeepalive } from "../../lib/obsKeepalive";
import { useOverlayBotConfig } from "../../lib/sohbetBot/useOverlayWidgetEvents";
import { useIsWidgetPreview } from "../../lib/sohbetBot/widgetPreview";

type Section = { title: string; names: string[] };

export default function EndCreditsWidgetPage() {
  useObsKeepalive();
  const preview = useIsWidgetPreview();
  const cfg = useOverlayBotConfig();
  const mc = cfg.movieCredits;

  if (!mc?.enabled && !preview) {
    return <div className="h-screen w-screen bg-transparent" />;
  }

  const sections = useMemo<Section[]>(() => {
    const r = cfg.recent || { follows: [], subs: [], raids: [], redeems: [] };
    const cutoff = Date.now() - Math.max(1, mc?.hours || 8) * 3600_000;
    const follows = r.follows.filter((x) => x.t >= cutoff).map((x) => x.user);
    const subs = r.subs.filter((x) => x.t >= cutoff).map((x) => x.user);
    const raids = r.raids
      .filter((x) => x.t >= cutoff)
      .map((x) => `${x.user}${x.amount ? ` ×${x.amount}` : ""}`);
    const redeems = r.redeems
      .filter((x) => x.t >= cutoff)
      .map((x) => `${x.user} — ${x.item}`);
    const list = [
      { title: "Aboneler", names: subs },
      { title: "Takipçiler", names: follows },
      { title: "Raidler", names: raids },
      { title: "Ödüller", names: redeems },
    ].filter((s) => s.names.length);
    if (list.length || !preview) return list;
    return [
      { title: "Aboneler", names: ["DemoSub", "ChatHero"] },
      { title: "Takipçiler", names: ["YeniTakipçi", "ViewerOne"] },
    ];
  }, [cfg.recent, mc?.hours, preview]);

  const speed = Math.max(30, Math.min(180, mc?.scrollSpeed || 80));
  const dur = Math.max(20, Math.round(4000 / speed));

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-transparent text-white">
      <div
        className="credits-roll absolute inset-x-0 top-full px-8 text-center"
        style={{
          color: mc?.textColor || "#fff",
          animationDuration: `${dur}s`,
          animationIterationCount: mc?.loop === false ? 1 : "infinite",
        }}
      >
        {preview && (
          <div className="mb-4 text-[10px] uppercase tracking-widest text-amber-300/85">Önizleme</div>
        )}
        <h1 className="mb-10 text-3xl font-semibold tracking-wide">
          {mc?.startMessage || "Teşekkürler"}
        </h1>
        {sections.length === 0 && <p className="text-white/70">Henüz olay yok</p>}
        {sections.map((sec) => (
          <div key={sec.title} className="mb-10">
            <div className="mb-3 text-[11px] uppercase tracking-[0.28em] text-amber-300/75">
              {sec.title}
            </div>
            {sec.names.map((name, i) => (
              <div key={`${sec.title}-${name}-${i}`} className="mb-2 text-xl font-medium">
                {name}
              </div>
            ))}
          </div>
        ))}
        <h2 className="mt-12 text-2xl font-semibold">
          {mc?.endMessage || "İzlediğiniz için teşekkürler"}
        </h2>
      </div>
      <style>{`
        @keyframes creditsRoll {
          from { transform: translateY(0); }
          to { transform: translateY(calc(-100% - 100vh)); }
        }
        .credits-roll { animation-name: creditsRoll; animation-timing-function: linear; }
      `}</style>
    </div>
  );
}
