import { useEffect, useState } from "react";
import OverlayShell from "../../components/overlay/OverlayShell";
import { fetchSettings, OverlaySettings } from "../../lib/api";
import { runStartingEndAction } from "../../lib/streamAutomation";
import { logger } from "../../lib/logger";

export default function StartingPage() {
  const [initial, setInitial] = useState<OverlaySettings | null>(null);

  useEffect(() => {
    fetchSettings("starting")
      .then(setInitial)
      .catch(() => setInitial({}));
  }, []);

  if (!initial) return <div className="obs-canvas-wrap" data-bg="dark" />;

  return (
    <OverlayShell
      screen="starting"
      initial={initial}
      onCountdownEnd={async (live) => {
        try {
          const r = await runStartingEndAction(live || initial);
          if (r.done && !r.result) {
            logger.warn("Hedef oyun sahnesi seçilmedi (obs.sceneMap.game / sceneOnEnd)");
          }
        } catch (e) {
          logger.error("OBS sahne geçişi başarısız", e);
        }
      }}
    />
  );
}
