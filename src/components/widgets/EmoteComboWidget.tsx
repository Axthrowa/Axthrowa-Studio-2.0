/** Emote Combo — index.emotekombosu.css stilleri + Framer Motion zıplama. */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  overlaySyncWsUrl,
  useWidgetSync,
  type WidgetSyncEvent,
} from "../../lib/widgets/useWidgetSync";
import "./emoteCombo.css";

type Props = { config: Record<string, unknown> };

type ComboView = {
  label: string;
  url: string;
  count: number;
};

const IDLE_MS = 5000;

function tierClass(count: number): string {
  if (count >= 10) return "combo-text--tier10";
  if (count >= 5) return "combo-text--tier5";
  return "";
}

function emoteSizeClass(count: number): string {
  if (count >= 10) return "emote--xl";
  if (count >= 5) return "emote--lg";
  return "";
}

export default function EmoteComboWidget({ config }: Props) {
  const isPreview = Boolean(config._previewMode);
  const threshold = Math.max(2, Number(config.threshold) || 2);
  const showCount = Boolean(config.showCount ?? true);
  const burstScale = Number(config.burstScale) || 1.6;
  const opacity = Number(config.opacity ?? 1);
  const scale = Math.min(3, Math.max(0.5, Number(config.scale) || 1));

  const [combo, setCombo] = useState<ComboView | null>(() =>
    isPreview ? { label: "KEKW", url: "", count: 5 } : null
  );
  const hideTimer = useRef<number | undefined>(undefined);

  const bump = (next: ComboView) => {
    if (next.count < threshold && !isPreview) return;
    setCombo(next);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    if (!isPreview) {
      hideTimer.current = window.setTimeout(() => setCombo(null), IDLE_MS);
    }
  };

  useEffect(() => {
    if (isPreview) return;
    let ws: WebSocket | null = null;
    let retry: number | undefined;
    let closed = false;

    const connect = () => {
      if (closed) return;
      try {
        ws = new WebSocket(overlaySyncWsUrl());
      } catch {
        retry = window.setTimeout(connect, 2200);
        return;
      }
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(String(e.data)) as Record<string, unknown>;
          if (msg.type !== "emote_combo_updated") return;
          const count = Number(msg.count) || 0;
          const label = String(
            msg.label || msg.emoteId || msg.emote_id || "Emote"
          );
          const url = String(msg.emoteUrl || msg.emote_url || "");
          bump({ label, url, count });
        } catch {
          /* */
        }
      };
      ws.onclose = () => {
        if (!closed) retry = window.setTimeout(connect, 2200);
      };
    };
    connect();
    return () => {
      closed = true;
      if (retry) window.clearTimeout(retry);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      try {
        ws?.close();
      } catch {
        /* */
      }
    };
  }, [isPreview, threshold]);

  const { subscribe } = useWidgetSync({ kinds: ["chat", "emotecombo"] });
  useEffect(() => {
    if (isPreview) return;
    return subscribe((ev: WidgetSyncEvent) => {
      if (ev.kind === "emotecombo") {
        const meta = (ev.raw || {}) as Record<string, unknown>;
        const label = String(ev.message || meta.emote || "Emote").split(" ")[0];
        const count = Number(meta.count) || threshold;
        bump({ label, url: "", count });
      }
    });
  }, [subscribe, isPreview, threshold]);

  if (!combo) {
    return (
      <div
        className="yya-widget-root yya-emote-combo h-full w-full bg-transparent"
        style={{ opacity, transform: `scale(${scale})` }}
      />
    );
  }

  const countTier = tierClass(combo.count);
  const sizeClass = emoteSizeClass(combo.count);
  const popScale =
    burstScale * (combo.count >= 10 ? 1.25 : combo.count >= 5 ? 1.12 : 1);

  return (
    <div
      className="yya-widget-root yya-emote-combo flex h-full w-full items-center justify-center bg-transparent"
      style={{
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: "center",
      }}
    >
      <div className="emote-container">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={combo.count}
            className="emote-combo"
            initial={{ scale: 0.6, y: 14, opacity: 0 }}
            animate={{ scale: popScale, y: 0, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 16 }}
          >
            {combo.url ? (
              <img
                src={combo.url}
                alt={combo.label}
                className={`emote ${sizeClass}`}
                draggable={false}
              />
            ) : (
              <span className={`emote-label ${sizeClass}`}>{combo.label}</span>
            )}
            {showCount ? (
              <span className={`combo-text ${countTier}`}>x{combo.count}</span>
            ) : null}
            {combo.count >= 5 ? (
              <span
                className={`combo-badge ${
                  combo.count >= 10 ? "combo-badge--gold" : ""
                }`}
              >
                {combo.count >= 10 ? "Efsane Kombo" : "Alev Kombo"}
              </span>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
