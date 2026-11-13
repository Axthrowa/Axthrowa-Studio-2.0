/**
 * Master Overlay — tek OBS Browser Source (1920×1080).
 * Canonical URL: `/overlay/master?obs=1` (BrowserRouter).
 * Studio önizleme: `isPreviewMode` ile mock + sürükle-bırak.
 */

import { useEffect } from "react";
import { useObsKeepalive } from "../../lib/obsKeepalive";
import {
  playWidgetSfx,
  unlockWidgetAudio,
} from "../../lib/widgets/widgetBus";
import { subscribeOverlaySync } from "../../lib/overlaySyncHub";
import { logger } from "../../lib/logger";
import MasterOverlayCanvas, {
  type CanvasWidget,
  type MasterOverlayCanvasProps,
} from "../../components/overlay/MasterOverlayCanvas";
import { useMasterWidgets } from "../../lib/widgets/useMasterWidgets";
import { WidgetSyncProvider } from "../../lib/widgets/useWidgetSync";

function useTransparentShell() {
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    root.classList.add("obs-transparent");
    body.classList.add("obs-transparent");
    const prev = {
      htmlBg: root.style.background,
      bodyBg: body.style.background,
      htmlOverflow: root.style.overflow,
      bodyOverflow: body.style.overflow,
      margin: body.style.margin,
    };
    root.style.setProperty("background", "transparent", "important");
    root.style.setProperty("background-color", "transparent", "important");
    root.style.overflow = "hidden";
    body.style.setProperty("background", "transparent", "important");
    body.style.setProperty("background-color", "transparent", "important");
    body.style.overflow = "hidden";
    body.style.margin = "0";

    const app = document.getElementById("root");
    const prevApp = app
      ? { bg: app.style.background, overflow: app.style.overflow, height: app.style.height }
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
      root.style.background = prev.htmlBg;
      root.style.overflow = prev.htmlOverflow;
      body.style.background = prev.bodyBg;
      body.style.overflow = prev.bodyOverflow;
      body.style.margin = prev.margin;
      if (app && prevApp) {
        app.style.background = prevApp.bg;
        app.style.overflow = prevApp.overflow;
        app.style.height = prevApp.height;
        app.style.width = "";
      }
    };
  }, []);
}

export type MasterOverlayProps = Partial<
  Pick<
    MasterOverlayCanvasProps,
    | "isPreviewMode"
    | "selectedId"
    | "onSelect"
    | "onRemove"
    | "onLayoutChange"
    | "onLayoutCommit"
    | "displayScale"
    | "editable"
    | "className"
  >
> & {
  previewWidgets?: CanvasWidget[];
};

function LiveMasterOverlay() {
  useObsKeepalive();
  useTransparentShell();
  const { enabledWidgets, loading, wsConnected } = useMasterWidgets();

  useEffect(() => {
    logger.log(
      "[MasterOverlay/bot] enabled=",
      enabledWidgets.length,
      "ws=",
      wsConnected,
      "kinds=",
      enabledWidgets.map((w) => w.kind).join(",")
    );
  }, [enabledWidgets, wsConnected]);

  useEffect(() => {
    const unlock = () => void unlockWidgetAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    const unsubscribe = subscribeOverlaySync({
      onMessage: (e) => {
        try {
          const msg = JSON.parse(String(e.data)) as Record<string, unknown>;
          if (msg.type === "widget-sfx-test") {
            const vol = Number(msg.volume) || 0.75;
            const preset = String(msg.preset || "coin");
            void playWidgetSfx(`preset:${preset.replace(/^preset:/, "")}`, vol);
          }
        } catch {
          /* */
        }
      },
    });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      unsubscribe();
    };
  }, []);

  if (loading && enabledWidgets.length === 0) {
    return <div className="h-screen w-screen bg-transparent" data-bot-master="loading" />;
  }

  return (
    <div
      className="relative h-screen w-screen overflow-hidden bg-transparent"
      data-master-overlay="1"
      data-bot-master="1"
      style={{ width: "100vw", height: "100vh" }}
    >
      <MasterOverlayCanvas
        widgets={enabledWidgets}
        isPreviewMode={false}
        displayScale={1}
        editable={false}
        stageWidth={1920}
        stageHeight={1080}
        className="h-full w-full"
      />
    </div>
  );
}

function PreviewMasterShell(props: MasterOverlayProps) {
  const widgets = props.previewWidgets || [];
  return (
    <MasterOverlayCanvas
      widgets={widgets}
      isPreviewMode
      selectedId={props.selectedId}
      onSelect={props.onSelect}
      onRemove={props.onRemove}
      onLayoutChange={props.onLayoutChange}
      onLayoutCommit={props.onLayoutCommit}
      displayScale={props.displayScale ?? 1}
      editable={props.editable ?? Boolean(props.onLayoutChange)}
      className={props.className}
    />
  );
}

export default function MasterOverlay(props: MasterOverlayProps = {}) {
  const isPreview = Boolean(props.isPreviewMode);

  if (isPreview) {
    return (
      <WidgetSyncProvider>
        <PreviewMasterShell {...props} />
      </WidgetSyncProvider>
    );
  }

  return (
    <WidgetSyncProvider>
      <LiveMasterOverlay />
    </WidgetSyncProvider>
  );
}
