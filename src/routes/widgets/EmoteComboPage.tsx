/** OBS Emote combo — big animated combo text */

import { useCallback, useEffect, useRef, useState } from "react";
import { useObsKeepalive } from "../../lib/obsKeepalive";
import type { WidgetEvent } from "../../lib/smartBot/events";
import {
  useOverlayBotConfig,
  useOverlayWidgetEvents,
} from "../../lib/smartBot/useOverlayWidgetEvents";
import { useIsWidgetPreview } from "../../lib/smartBot/widgetPreview";

type Combo = { emote: string; count: number; key: number };

export default function EmoteComboPage() {
  useObsKeepalive();
  const preview = useIsWidgetPreview();
  const cfg = useOverlayBotConfig();
  const comboCfg = cfg.emoteCombo;
  const [combo, setCombo] = useState<Combo | null>(null);
  const hideTimer = useRef<number | null>(null);

  const show = useCallback(
    (emote: string, count: number) => {
      const min = Math.max(2, comboCfg?.minCount || 3);
      if (count < min) return;
      if (comboCfg?.enabled === false) return;
      setCombo({ emote, count, key: Date.now() });
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      const showMs = Math.max(1000, comboCfg?.showMs || 4000);
      hideTimer.current = window.setTimeout(() => setCombo(null), showMs);
    },
    [comboCfg]
  );

  const onEvent = useCallback(
    (we: WidgetEvent) => {
      if (we.kind !== "emotecombo") return;
      const emote = String(we.meta?.emote || we.message || "🔥");
      const count = Number(we.meta?.count || we.amount || 1);
      show(emote, count);
    },
    [show]
  );

  useOverlayWidgetEvents(onEvent);

  useEffect(() => {
    if (!preview || combo) return;
    const min = Math.max(2, comboCfg?.minCount || 3);
    show("Kappa", Math.max(min, 8));
  }, [preview]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, []);

  if (comboCfg?.enabled === false && !preview) {
    return <div className="h-screen w-screen bg-transparent" />;
  }

  return (
    <div className="relative grid h-screen w-screen place-items-center overflow-hidden bg-transparent text-white">
      {combo && (
        <div
          key={combo.key}
          className="animate-[comboPop_.55s_cubic-bezier(.2,1.4,.4,1)] text-center"
        >
          <div className="text-6xl md:text-8xl">{combo.emote}</div>
          <div className="mt-2 bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-5xl font-black tabular-nums text-transparent md:text-7xl">
            x{combo.count}
          </div>
          <div className="mt-1 text-sm uppercase tracking-[0.25em] text-white/60">combo</div>
        </div>
      )}
      <style>{`
        @keyframes comboPop{
          0%{opacity:0;transform:scale(.55) translateY(18px)}
          60%{opacity:1;transform:scale(1.08)}
          100%{opacity:1;transform:scale(1)}
        }
      `}</style>
    </div>
  );
}
