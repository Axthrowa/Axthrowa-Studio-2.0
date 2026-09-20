/**
 * Subathon — overlay-sync WS: new_follow / new_sub / new_donation / new_kick + alert yedek.
 */

import { useEffect, useRef } from "react";
import { overlaySyncWsUrl } from "./useWidgetSync";

export type SubathonEventPayload = {
  kind: "follow" | "sub" | "tip" | "donation" | "kick" | "raid" | "bits" | "host";
  user?: string;
  message?: string;
  amount?: number | null;
  raw?: Record<string, unknown>;
};

function normalizeAmount(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function fromSubathonWire(msg: Record<string, unknown>): SubathonEventPayload | null {
  const t = String(msg.type || "");
  const data = (msg.data || msg) as Record<string, unknown>;

  const map: Record<string, SubathonEventPayload["kind"]> = {
    new_follow: "follow",
    new_sub: "sub",
    new_donation: "tip",
    new_kick: "kick",
  };
  const kind = map[t];
  if (kind) {
    return {
      kind,
      user: data.user != null ? String(data.user) : undefined,
      message: String(data.message || data.text || ""),
      amount: normalizeAmount(data.amount ?? msg.amount),
      raw: msg,
    };
  }

  if (t === "trigger_alert" || t === "widget-test") {
    const nested = (data.kind || data.type || "") as string;
    const k = nested.toLowerCase();
    const mapped =
      k === "donation" || k === "tip"
        ? "tip"
        : k === "cheer"
          ? "bits"
          : (k as SubathonEventPayload["kind"]);
    if (["follow", "sub", "tip", "donation", "kick", "raid", "bits", "host"].includes(mapped)) {
      return {
        kind: mapped === "donation" ? "tip" : mapped,
        user: data.user != null ? String(data.user) : undefined,
        message: String(data.message || data.text || ""),
        amount: normalizeAmount(data.amount),
        raw: data,
      };
    }
  }

  return null;
}

export function useSubathonEvents(
  onEvent: (ev: SubathonEventPayload) => void,
  enabled = true
) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!enabled) return;

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
          const ev = fromSubathonWire(msg);
          if (ev) handlerRef.current(ev);
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
      try {
        ws?.close();
      } catch {
        /* */
      }
    };
  }, [enabled]);
}
