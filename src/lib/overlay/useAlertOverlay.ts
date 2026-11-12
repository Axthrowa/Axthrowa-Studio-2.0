/**
 * OBS Overlay event bus
 *
 * KRİTİK: OBS Browser Source Tauri webview DEĞİLDİR.
 * `listen('trigger_alert')` yalnızca uygulama penceresinde çalışır.
 * OBS tarafı `ws://127.0.0.1:8843/ws/overlay-sync` dinler.
 *
 * Alert Queue Engine: art arda gelen uyarılar sırayla oynatılır.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "../api";
import { mediaPlayableUrls } from "../api/studioMedia";
import { alertsList, alertVariantsList } from "../api/studioMedia";
import type { WidgetEvent } from "../sohbetBot/events";
import { AlertQueueEngine } from "../alerts/queueEngine";
import {
  configFromDbRow,
  defaultAlertType,
  formatAlertTemplate,
  mapKindToEventId,
  type AlertEventId,
  type AlertTypeConfig,
} from "../alerts/types";

export type AlertVisual = {
  id: string;
  kind: string;
  user: string;
  amount?: string | number;
  message?: string;
  template: string;
  text: string;
  config: AlertTypeConfig;
  mediaUrl?: string;
  soundUrl?: string;
  durationMs: number;
  /** legacy uyumluluk */
  animIn: string;
  animOut: string;
  volume: number;
  textColor: string;
  accentColor: string;
  fontSize: number;
  fontFamily?: string;
  layout: string;
  hideMessage?: boolean;
  textEffect?: string;
  textShadow?: number;
  posX?: number;
  posY?: number;
};

type AlertRow = Record<string, unknown> & {
  id: string;
  enabled?: number | boolean;
  media_path?: string | null;
  sound_path?: string | null;
  media?: { streamUrl?: string; stream_url?: string };
  sound?: { streamUrl?: string; stream_url?: string };
  custom_html?: string | null;
};

type VariantRow = {
  id: string;
  type_id: string;
  enabled?: number | boolean;
  template?: string;
  min_amount?: number;
  max_amount?: number | null;
  duration_ms?: number;
  volume?: number;
  media_path?: string | null;
  sound_path?: string | null;
  anim_in?: string | null;
  media?: { streamUrl?: string; stream_url?: string };
  sound?: { streamUrl?: string; stream_url?: string };
};

function on(v: number | boolean | undefined) {
  return v === true || v === 1;
}

async function resolveMediaUrl(path?: string | null, enriched?: { streamUrl?: string; stream_url?: string }) {
  const fromEnrich = enriched?.streamUrl || enriched?.stream_url;
  if (fromEnrich) return fromEnrich;
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  try {
    const m = await mediaPlayableUrls(path);
    return m.streamUrl;
  } catch {
    return `${API_BASE}/media/file?path=${encodeURIComponent(path)}`;
  }
}

function extractWidgetEvent(msg: Record<string, unknown>): WidgetEvent | AlertVisual | null {
  const data = (msg?.data || msg) as Record<string, unknown>;
  const we =
    data?._widgetEvent ||
    data?.trigger_alert ||
    data?.new_alert ||
    (msg?.type === "new_alert" ? data : null) ||
    (msg?.type === "trigger_alert" ? data : null) ||
    (msg?.type === "snapshot" ? (msg?.panel as Record<string, unknown>)?._widgetEvent : null) ||
    (msg?.screen === "panel" ? (data as Record<string, unknown>)?._widgetEvent : null);
  if (!we || typeof we !== "object") return null;
  return we as WidgetEvent | AlertVisual;
}

export function useTransparentObs() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("obs-transparent");
    document.body.style.background = "transparent";
    const el = document.getElementById("root");
    if (el) el.style.background = "transparent";
    return () => {
      root.classList.remove("obs-transparent");
      document.body.style.background = "";
      if (el) el.style.background = "";
    };
  }, []);
}

export function useAlertOverlayQueue() {
  const [current, setCurrent] = useState<AlertVisual | null>(null);
  const [phase, setPhase] = useState<"in" | "show" | "out">("in");
  const [queueLen, setQueueLen] = useState(0);
  const alertsRef = useRef<AlertRow[]>([]);
  const variantsRef = useRef<VariantRow[]>([]);
  const engineRef = useRef<AlertQueueEngine<AlertVisual> | null>(null);
  const phaseTimers = useRef<number[]>([]);

  const clearPhaseTimers = () => {
    for (const t of phaseTimers.current) window.clearTimeout(t);
    phaseTimers.current = [];
  };

  const loadCatalog = useCallback(async () => {
    try {
      const [a, v] = await Promise.all([alertsList(), alertVariantsList()]);
      alertsRef.current = (a.alerts || []) as AlertRow[];
      variantsRef.current = (v.variants || []) as VariantRow[];
    } catch {
      /* */
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
    const id = window.setInterval(() => void loadCatalog(), 30_000);
    return () => window.clearInterval(id);
  }, [loadCatalog]);

  useEffect(() => {
    engineRef.current = new AlertQueueEngine<AlertVisual>({
      onPlay: (item) => {
        clearPhaseTimers();
        setPhase("in");
        setCurrent(item);
        setQueueLen(engineRef.current?.length ?? 0);
        const outMs = Math.max(400, Math.min(1200, item.durationMs * 0.12));
        const showMs = Math.max(1200, item.durationMs - outMs);
        phaseTimers.current.push(
          window.setTimeout(() => setPhase("show"), 50),
          window.setTimeout(() => setPhase("out"), showMs)
        );
      },
      getDurationMs: (item) => item.durationMs,
      onIdle: () => {
        setCurrent(null);
        setPhase("in");
        setQueueLen(0);
        clearPhaseTimers();
      },
    });
    return () => {
      engineRef.current?.clear();
      clearPhaseTimers();
    };
  }, []);

  const enqueueVisual = useCallback((v: AlertVisual) => {
    engineRef.current?.enqueue(v);
    setQueueLen(engineRef.current?.length ?? 0);
  }, []);

  const enqueueEvent = useCallback(
    async (ev: WidgetEvent) => {
      const typeId = mapKindToEventId(String(ev.kind || "follow"));
      const amt = Number(String(ev.amount || "").replace(/[^\d.]/g, "")) || 0;

      let alert = alertsRef.current.find((a) => a.id === typeId && on(a.enabled as number | boolean));
      if (!alert) alert = alertsRef.current.find((a) => a.id === typeId);

      if (alert && !on(alert.enabled as number | boolean)) {
        return;
      }

      const cfg: AlertTypeConfig = alert
        ? configFromDbRow(alert as Record<string, unknown>)
        : defaultAlertType(typeId as AlertEventId);

      if (amt < (cfg.minAmount || 0)) {
        return;
      }

      const matched = variantsRef.current
        .filter(
          (v) =>
            v.type_id === typeId &&
            on(v.enabled) &&
            amt >= (v.min_amount || 0) &&
            (v.max_amount == null || amt <= Number(v.max_amount))
        )
        .sort((a, b) => (b.min_amount || 0) - (a.min_amount || 0))[0];

      if (matched?.template) cfg.template = matched.template;
      if (matched?.anim_in) cfg.animIn = matched.anim_in as AlertTypeConfig["animIn"];
      if (matched?.duration_ms) cfg.durationSec = Math.max(1, Math.round(matched.duration_ms / 1000));
      if (matched?.volume != null) cfg.volume = Number(matched.volume);

      const template = cfg.template || "{name}";
      const text = formatAlertTemplate(template, {
        name: ev.user,
        amount: ev.amount,
        message: ev.message,
      }) || `${ev.user}`;

      const mediaPath = matched?.media_path ?? alert?.media_path ?? cfg.mediaPath;
      const soundPath = matched?.sound_path ?? alert?.sound_path ?? cfg.soundPath;
      const mediaUrl = await resolveMediaUrl(mediaPath, matched?.media || alert?.media);
      const soundUrl = await resolveMediaUrl(soundPath, matched?.sound || alert?.sound);
      const durationMs = Number(matched?.duration_ms || Math.round(cfg.durationSec * 1000) || 5000);

      enqueueVisual({
        id: ev.id || `${Date.now()}`,
        kind: typeId,
        user: ev.user,
        amount: ev.amount,
        message: ev.message,
        template,
        text,
        config: cfg,
        mediaUrl,
        soundUrl,
        durationMs,
        animIn: cfg.animIn,
        animOut: cfg.animOut,
        volume: cfg.volume,
        textColor: cfg.textColor,
        accentColor: cfg.nameColor,
        fontSize: cfg.fontSize,
        fontFamily: cfg.fontFamily,
        layout: cfg.layout,
        textShadow: cfg.textShadow,
      });
    },
    [enqueueVisual]
  );

  useEffect(() => {
    const onLocal = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.config && detail?.template) {
        enqueueVisual(detail as AlertVisual);
        return;
      }
      if (detail?.text && detail?.animIn && !detail?.kind) {
        /* eski format */
        const cfg = defaultAlertType("follow");
        enqueueVisual({
          id: String(detail.id || Date.now()),
          kind: "follow",
          user: detail.user || "",
          template: detail.text,
          text: detail.text,
          config: {
            ...cfg,
            animIn: detail.animIn,
            animOut: detail.animOut || "fade",
            durationSec: Math.max(1, Math.round(Number(detail.durationMs || 5000) / 1000)),
            volume: Number(detail.volume ?? 0.8),
            textColor: detail.textColor || cfg.textColor,
            nameColor: detail.accentColor || cfg.nameColor,
            fontSize: Number(detail.fontSize || cfg.fontSize),
            fontFamily: detail.fontFamily || cfg.fontFamily,
            layout: "image-top",
          },
          mediaUrl: detail.mediaUrl,
          soundUrl: detail.soundUrl,
          durationMs: Number(detail.durationMs || 5000),
          animIn: detail.animIn,
          animOut: detail.animOut || "fade",
          volume: Number(detail.volume ?? 0.8),
          textColor: detail.textColor || "#fff",
          accentColor: detail.accentColor || "#3EEDFE",
          fontSize: Number(detail.fontSize || 32),
          fontFamily: detail.fontFamily,
          layout: detail.layout || "image-top",
        });
        return;
      }
      if (detail?.kind && detail?.user) {
        void enqueueEvent(detail as WidgetEvent);
      }
    };
    window.addEventListener("sohbet-bot-widget-olayi", onLocal);
    window.addEventListener("trigger_alert", onLocal);
    window.addEventListener("new_alert", onLocal);

    let ws: WebSocket | null = null;
    let retry: number | undefined;
    const connect = () => {
      try {
        ws = new WebSocket(`${API_BASE.replace(/^http/, "ws")}/ws/overlay-sync`);
      } catch {
        retry = window.setTimeout(connect, 2000);
        return;
      }
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data) as Record<string, unknown>;
          const we = extractWidgetEvent(msg);
          if (!we) return;
          if ((we as AlertVisual).config && (we as AlertVisual).template) {
            enqueueVisual(we as AlertVisual);
          } else if ((we as WidgetEvent).kind && (we as WidgetEvent).user) {
            void enqueueEvent(we as WidgetEvent);
          } else if ((we as AlertVisual).text && (we as AlertVisual).animIn) {
            onLocal(new CustomEvent("trigger_alert", { detail: we }));
          }
        } catch {
          /* */
        }
      };
      ws.onclose = () => {
        retry = window.setTimeout(connect, 2000);
      };
    };
    connect();

    let unlisten: (() => void) | undefined;
    void (async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        unlisten = await listen("trigger_alert", (e) => {
          onLocal(new CustomEvent("trigger_alert", { detail: e.payload }));
        });
      } catch {
        /* */
      }
    })();

    return () => {
      window.removeEventListener("sohbet-bot-widget-olayi", onLocal);
      window.removeEventListener("trigger_alert", onLocal);
      window.removeEventListener("new_alert", onLocal);
      if (retry) window.clearTimeout(retry);
      try {
        ws?.close();
      } catch {
        /* */
      }
      unlisten?.();
      clearPhaseTimers();
    };
  }, [enqueueEvent, enqueueVisual]);

  return { current, phase, enqueueEvent, queueLen };
}
