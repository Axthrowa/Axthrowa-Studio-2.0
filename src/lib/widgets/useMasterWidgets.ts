/**
 * Master Overlay — tüm widget_instances + config_updated / widgets_updated.
 */

import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../api";
import {
  isWidgetMasterEnabled,
  parseWidgetConfig,
  type MasterWidgetRow,
} from "./masterLayout";
import { subscribeOverlaySync } from "../overlaySyncHub";

export type MasterWidgetLive = MasterWidgetRow & {
  config: Record<string, unknown>;
};

async function fetchAllWidgets(): Promise<MasterWidgetLive[]> {
  const res = await fetch(`${API_BASE}/api/bot/widgets`, { cache: "no-store" });
  if (!res.ok) return [];
  const j = (await res.json()) as { widgets?: MasterWidgetRow[] };
  const list = j.widgets || [];
  return list
    .map((w) => ({
      ...w,
      config: parseWidgetConfig(w),
    }))
    .sort(
      (a, b) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
        String(a.name || a.kind).localeCompare(String(b.name || b.kind), "tr")
    );
}

export function useMasterWidgets() {
  const [widgets, setWidgets] = useState<MasterWidgetLive[]>([]);
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);

  const reload = useCallback(async () => {
    const list = await fetchAllWidgets();
    setWidgets(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    void fetchAllWidgets().then((list) => {
      if (alive) {
        setWidgets(list);
        setLoading(false);
      }
    });

    const poll = window.setInterval(() => {
      void fetchAllWidgets().then((list) => {
        if (alive) setWidgets(list);
      });
    }, 20000);

    const onMsg = (raw: string) => {
      try {
        const msg = JSON.parse(raw) as Record<string, unknown>;
        if (msg.type !== "config_updated" && msg.type !== "widgets_updated") return;

        const id = msg.id != null ? String(msg.id) : "";
        const kind = String(msg.kind || "").toLowerCase();
        const cfg =
          msg.config && typeof msg.config === "object"
            ? (msg.config as Record<string, unknown>)
            : null;
        const enabledMsg =
          typeof msg.enabled === "boolean"
            ? msg.enabled
            : typeof msg.enabled === "number"
              ? msg.enabled !== 0
              : undefined;

        setWidgets((prev) => {
          if (!id && !kind) {
            void reload();
            return prev;
          }
          let found = false;
          const next = prev.map((w) => {
            const match =
              (id && w.id === id) ||
              (kind && (w.kind || "").toLowerCase() === kind);
            if (!match) return w;
            found = true;
            return {
              ...w,
              enabled: enabledMsg !== undefined ? enabledMsg : w.enabled,
              config: cfg ? { ...w.config, ...cfg } : w.config,
            };
          });
          if (!found) {
            void reload();
            return prev;
          }
          return next;
        });
      } catch {
        /* ignore */
      }
    };

    const unsubscribe = subscribeOverlaySync({
      onOpen: () => setWsConnected(true),
      onClose: () => setWsConnected(false),
      onMessage: (e) => onMsg(String(e.data)),
    });

    return () => {
      alive = false;
      window.clearInterval(poll);
      unsubscribe();
    };
  }, [reload]);

  const enabledWidgets = widgets.filter((w) => isWidgetMasterEnabled(w, w.config));

  return { widgets, enabledWidgets, loading, wsConnected, reload };
}
