import { useEffect, useRef, useState } from "react";
import { ruleThenScene } from "../../lib/endRules";
import OverlayShell from "../../components/overlay/OverlayShell";
import { fetchSettings, OverlaySettings } from "../../lib/api";
import { connectObs, setInputMute, switchScene } from "../../lib/obs";
import { useObsSourceActive } from "../../lib/obsSourceActive";
import { logger } from "../../lib/logger";

export default function BrbPage() {
  const [initial, setInitial] = useState<OverlaySettings | null>(null);
  const obsMode =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("obs");
  const sourceActive = useObsSourceActive(obsMode);
  const mutedForActiveRef = useRef(false);

  useEffect(() => {
    fetchSettings("brb")
      .then(setInitial)
      .catch(() => setInitial({}));
  }, []);

  // Mikrofonu yalnız BRB kaynağı gerçekten görünürken kapat — sayfa yüklenince
  // (görünmeyen sahnede) OBS sahnesine dokunma / mikrofona dokunma.
  useEffect(() => {
    if (!obsMode || !initial) return;
    const obs = initial.obs || {};
    if (!obs.muteMicOnBrb || !obs.micInput) return;

    let cancelled = false;
    (async () => {
      try {
        await connectObs({
          host: obs.host || "127.0.0.1",
          port: Number(obs.port) || 4455,
          password: obs.password || "",
        });
      } catch {
        return;
      }
      if (cancelled) return;
      if (sourceActive && !mutedForActiveRef.current) {
        try {
          await setInputMute(obs.micInput!, true);
          mutedForActiveRef.current = true;
        } catch {
          /* */
        }
      } else if (!sourceActive && mutedForActiveRef.current) {
        try {
          await setInputMute(obs.micInput!, false);
          mutedForActiveRef.current = false;
        } catch {
          /* */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [obsMode, initial, sourceActive]);

  if (!initial) return <div className="obs-canvas-wrap" data-bg="dark" />;

  return (
    <OverlayShell
      screen="brb"
      initial={initial}
      showVisualizer
      onCountdownEnd={async (live) => {
        const obs = live?.obs || initial.obs || {};
        try {
          await connectObs({
            host: obs.host || "127.0.0.1",
            port: Number(obs.port) || 4455,
            password: obs.password || "",
          });
        } catch {
          /* */
        }
        if (obs.micInput) {
          try {
            await setInputMute(obs.micInput, false);
            mutedForActiveRef.current = false;
          } catch {
            /* */
          }
        }
        const scene = ruleThenScene(obs as never, "brb", obs.brbEndScene || obs.returnScene || obs.sceneOnEnd || "");
        if (scene && obs.autoSwitchOnBrbEnd !== false) {
          try {
            await switchScene({
              sceneName: scene,
              transition: obs.transition,
              transitionMs: obs.transitionMs ?? 300,
            });
          } catch (e) {
            logger.error("Mola bitiş sahne geçişi başarısız", e);
          }
        }
      }}
    />
  );
}
