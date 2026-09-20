/**
 * OBS Browser Source kasa — `/widgets/:kind?obs=1`
 * Şeffaf html/body; config + overlay-sync.
 */

import { useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useObsKeepalive } from "../../lib/obsKeepalive";
import { renderWidgetByKind } from "../../lib/widgets/renderWidgetByKind";
import { useWidgetConfig, useWidgetSync } from "../../lib/widgets/useWidgetSync";
import { logger } from "../../lib/logger";

function useTransparentShell(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    const body = document.body;
    root.classList.add("obs-transparent");
    body.classList.add("obs-transparent");
    const prevHtmlBg = root.style.background;
    const prevBodyBg = body.style.background;
    const prevHtmlOverflow = root.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevMargin = body.style.margin;

    root.style.setProperty("background", "transparent", "important");
    root.style.setProperty("background-color", "transparent", "important");
    root.style.overflow = "hidden";
    body.style.setProperty("background", "transparent", "important");
    body.style.setProperty("background-color", "transparent", "important");
    body.style.overflow = "hidden";
    body.style.margin = "0";

    const app = document.getElementById("root");
    const prevApp = app
      ? {
          bg: app.style.background,
          overflow: app.style.overflow,
          height: app.style.height,
        }
      : null;
    if (app) {
      app.style.setProperty("background", "transparent", "important");
      app.style.setProperty("background-color", "transparent", "important");
      app.style.overflow = "hidden";
      app.style.height = "100vh";
      app.style.width = "100vw";
    }

    return () => {
      root.classList.remove("obs-transparent");
      body.classList.remove("obs-transparent");
      root.style.background = prevHtmlBg;
      root.style.overflow = prevHtmlOverflow;
      body.style.background = prevBodyBg;
      body.style.overflow = prevBodyOverflow;
      body.style.margin = prevMargin;
      if (app && prevApp) {
        app.style.background = prevApp.bg;
        app.style.overflow = prevApp.overflow;
        app.style.height = prevApp.height;
        app.style.width = "";
      }
    };
  }, [enabled]);
}

export default function WidgetOverlay() {
  useObsKeepalive();
  const [sp] = useSearchParams();
  useTransparentShell(true);
  const { connected } = useWidgetSync({ enabled: true });

  const { kind: kindParam = "chat" } = useParams();
  const kind = (kindParam || sp.get("kind") || "chat").toLowerCase().trim();
  const { config, loading } = useWidgetConfig(kind);

  useEffect(() => {
    logger.log(
      "[WidgetOverlay] kind=",
      kind,
      "ws=",
      connected,
      "configKeys=",
      Object.keys(config)
    );
  }, [kind, connected, config]);

  if (loading && Object.keys(config).length === 0) {
    return <div className="h-screen w-screen bg-transparent" />;
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-transparent">
      {renderWidgetByKind(kind, config)}
    </div>
  );
}
