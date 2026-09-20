import { useEffect, useState } from "react";
import OverlayShell from "../../components/overlay/OverlayShell";
import { fetchSettings, OverlaySettings } from "../../lib/api";
import { runEndingEndAction } from "../../lib/streamAutomation";
import { logger } from "../../lib/logger";

export default function EndingPage() {
  const [initial, setInitial] = useState<OverlaySettings | null>(null);
  useEffect(() => {
    fetchSettings("ending")
      .then(setInitial)
      .catch(() => setInitial({}));
  }, []);
  if (!initial) return <div className="obs-canvas-wrap" data-bg="dark" />;
  return (
    <OverlayShell
      screen="ending"
      initial={initial}
      showCredits
      onCountdownEnd={async (live) => {
        try {
          await runEndingEndAction(live || initial);
        } catch (e) {
          logger.error("Çıkış bitiş aksiyonu başarısız", e);
        }
      }}
    />
  );
}
