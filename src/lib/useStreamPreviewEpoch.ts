import { useEffect, useState } from "react";
import { API_BASE } from "./api";

/**
 * OBS StreamStateChanged → önizleme cache-bust.
 * Tauri olayı + overlay-sync WS (tarayıcı / OBS Browser Source).
 */
export function useStreamPreviewEpoch() {
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let ws: WebSocket | null = null;
    let retry = 0;
    let cancelled = false;

    const bump = (raw?: unknown) => {
      const n = Number(raw);
      setEpoch(Number.isFinite(n) && n > 0 ? n : Date.now());
    };

    void import("@tauri-apps/api/event")
      .then(({ listen }) =>
        listen<{ outputActive?: boolean; t?: number }>("obs-stream-state", (event) => {
          bump(event.payload?.t);
        })
      )
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => undefined);

    const connect = () => {
      if (cancelled) return;
      try {
        ws = new WebSocket(`${API_BASE.replace(/^http/, "ws")}/ws/overlay-sync`);
      } catch {
        return;
      }
      const sock = ws;
      sock.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data) as { type?: string; t?: number };
          if (msg?.type === "obs-stream-state") bump(msg.t);
        } catch {
          /* */
        }
      };
      sock.onclose = () => {
        if (!cancelled) retry = window.setTimeout(connect, 3000);
      };
    };
    connect();

    return () => {
      cancelled = true;
      unlisten?.();
      window.clearTimeout(retry);
      try {
        ws?.close();
      } catch {
        /* */
      }
    };
  }, []);

  return epoch;
}
