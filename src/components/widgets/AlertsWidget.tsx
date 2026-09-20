/** Alerts widget — AlertWidget + Queue Engine (galeri / master overlay). */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWidgetSync, type WidgetSyncEvent } from "../../lib/widgets/useWidgetSync";
import { AlertQueueEngine } from "../../lib/alerts/queueEngine";
import {
  defaultAlertType,
  mapKindToEventId,
  type AlertTypeConfig,
} from "../../lib/alerts/types";
import AlertWidget from "./AlertWidget";

type Props = { config: Record<string, unknown> };

type PlayItem = {
  template: string;
  vars: { name: string; amount?: string; message?: string };
  alertCfg: AlertTypeConfig;
};

export default function AlertsWidget({ config }: Props) {
  const preview = Boolean(config._previewMode);
  const durationMs = Math.max(2000, Number(config.durationMs) || 6500);

  const baseCfg: AlertTypeConfig = useMemo(() => {
    const base = defaultAlertType(mapKindToEventId(String(config.kind || "follow")));
    return {
      ...base,
      nameColor: String(config.primary_color || config.accent || base.nameColor),
      textColor: String(config.text_color || "#ffffff"),
      fontFamily: String(config.fontFamily || config.font_family || base.fontFamily),
      fontSize: Math.max(14, Number(config.fontSize) || 28),
      layout:
        String(config.layout) === "side-by-side" || String(config.layout) === "text-over"
          ? (String(config.layout) as AlertTypeConfig["layout"])
          : "image-top",
      styleMode:
        String(config.styleMode) === "banner" ||
        String(config.styleMode) === "card" ||
        String(config.styleMode) === "minimal"
          ? (String(config.styleMode) as AlertTypeConfig["styleMode"])
          : "compact",
      template: String(config.template || config.preview_message || "{name} — {amount}"),
      durationSec: Math.round(durationMs / 1000),
      volume: Number(config.volume ?? 0.8),
      mediaPath: String(config.mediaUrl || config.media_path || ""),
      soundPath: String(config.soundUrl || config.sound_path || ""),
      textEffect:
        String(config.textEffect || "wiggle") as AlertTypeConfig["textEffect"],
    };
  }, [config, durationMs]);

  const [current, setCurrent] = useState<PlayItem | null>(null);
  const engineRef = useRef<AlertQueueEngine<PlayItem> | null>(null);
  const { subscribe } = useWidgetSync({
    kinds: ["follow", "sub", "tip", "donation", "raid", "bits", "host", "gifted"],
  });

  useEffect(() => {
    engineRef.current = new AlertQueueEngine<PlayItem>({
      onPlay: (item) => setCurrent(item),
      getDurationMs: (item) => Math.max(1500, item.alertCfg.durationSec * 1000),
      onIdle: () => setCurrent(null),
    });
    return () => engineRef.current?.clear();
  }, []);

  const show = useCallback(
    (ev: WidgetSyncEvent) => {
      const user = ev.user || "Kullanıcı";
      const kind = mapKindToEventId(ev.kind);
      const tpl =
        ev.text ||
        (kind === "tip"
          ? "{name} {amount} bağışladı!"
          : kind === "raid"
            ? "{name} raid attı!"
            : kind === "sub"
              ? "{name} abone oldu!"
              : kind === "gifted"
                ? "{name} {amount} hediye abone gönderdi!"
                : kind === "host"
                  ? "{name} host attı!"
                  : "{name} takip etti!");
      engineRef.current?.enqueue({
        template: tpl.includes("{") ? tpl : `{name} — ${tpl}`,
        vars: {
          name: user,
          amount: ev.amount != null ? String(ev.amount) : undefined,
          message: ev.message,
        },
        alertCfg: { ...baseCfg, template: tpl.includes("{") ? tpl : baseCfg.template },
      });
    },
    [baseCfg]
  );

  useEffect(() => subscribe(show), [subscribe, show]);

  useEffect(() => {
    if (!preview) return;
    engineRef.current?.enqueue({
      template: String(config.template || "{name} abone oldu!"),
      vars: { name: "DemoKullanıcı", amount: "1", message: "Merhaba!" },
      alertCfg: baseCfg,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview]);

  return (
    <div className="yya-widget-root h-full w-full bg-transparent">
      <AlertWidget
        visible={!!current}
        template={current?.template || baseCfg.template}
        vars={current?.vars || { name: "…" }}
        config={current?.alertCfg || baseCfg}
        mediaUrl={baseCfg.mediaPath.startsWith("http") ? baseCfg.mediaPath : undefined}
        soundUrl={baseCfg.soundPath.startsWith("http") ? baseCfg.soundPath : undefined}
        previewChrome={preview && !current}
      />
    </div>
  );
}
