import { useEffect, useRef, useState } from "react";
import { API_BASE, OverlaySettings, ScreenId, fetchSettings } from "./api";

type Msg =
  | {
      type: "snapshot";
      starting: OverlaySettings;
      ending: OverlaySettings;
      brb: OverlaySettings;
      chat: OverlaySettings;
    }
  | { type: "settings"; screen: string; data: OverlaySettings }
  | { type: "obs-stream-state"; outputActive?: boolean; t?: number };

/** Yarım açık bağlantıyı yakalamak için canlılık aralığı */
const HEARTBEAT_MS = 25_000;
const HEARTBEAT_TIMEOUT_MS = 10_000;
const MAX_RETRY_MS = 15_000;

export type OverlaySyncOptions = {
  /** Panel önizlemesi ayarları kendi tutar — orada WebSocket açmaya gerek yok. */
  enabled?: boolean;
};

export function useOverlaySync(
  screen: ScreenId,
  initial: OverlaySettings,
  options?: OverlaySyncOptions
) {
  const enabled = options?.enabled !== false;
  const [settings, setSettings] = useState<OverlaySettings>(initial || {});
  const [connected, setConnected] = useState(false);
  const [mediaEpoch, setMediaEpoch] = useState(0);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (!bootstrapped.current && initial && Object.keys(initial).length) {
      setSettings(initial);
      bootstrapped.current = true;
    }
  }, [initial]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    fetchSettings(screen)
      .then((data) => {
        if (!cancelled && data && Object.keys(data).length) setSettings(data);
      })
      .catch(() => {});

    let ws: WebSocket | null = null;
    let retry: number | undefined;
    let heartbeat: number | undefined;
    let pongTimer: number | undefined;
    let attempt = 0;

    const clearHeartbeat = () => {
      if (heartbeat) window.clearInterval(heartbeat);
      if (pongTimer) window.clearTimeout(pongTimer);
      heartbeat = undefined;
      pongTimer = undefined;
    };

    const connect = () => {
      if (cancelled) return;
      const url = `${API_BASE.replace(/^http/, "ws")}/ws/overlay-sync`;
      try {
        ws = new WebSocket(url);
      } catch {
        scheduleRetry();
        return;
      }
      const sock = ws;

      sock.onopen = () => {
        attempt = 0;
        setConnected(true);
        clearHeartbeat();
        // Uygulama kapanıp ağ yarım açık kalırsa onclose gelmeyebiliyor;
        // düzenli ping'e yanıt yoksa bağlantıyı biz kapatıp yeniden kuruyoruz.
        heartbeat = window.setInterval(() => {
          if (sock.readyState !== WebSocket.OPEN) return;
          try {
            sock.send(JSON.stringify({ type: "ping", t: Date.now() }));
          } catch {
            /* */
          }
          if (pongTimer) window.clearTimeout(pongTimer);
          pongTimer = window.setTimeout(() => {
            try {
              sock.close();
            } catch {
              /* */
            }
          }, HEARTBEAT_TIMEOUT_MS);
        }, HEARTBEAT_MS);
      };

      sock.onclose = () => {
        clearHeartbeat();
        setConnected(false);
        scheduleRetry();
      };

      sock.onerror = () => {
        setConnected(false);
      };

      sock.onmessage = (ev) => {
        // Sunucudan herhangi bir trafik = bağlantı canlı
        if (pongTimer) {
          window.clearTimeout(pongTimer);
          pongTimer = undefined;
        }
        try {
          const msg = JSON.parse(ev.data) as Msg;
          if (msg.type === "snapshot") {
            const data = (msg as Record<string, unknown>)[screen] as OverlaySettings | undefined;
            if (data) setSettings(data);
          } else if (msg.type === "settings" && msg.screen === screen) {
            setSettings(msg.data);
          } else if (msg.type === "obs-stream-state") {
            setMediaEpoch(Number(msg.t) || Date.now());
          }
        } catch {
          /* */
        }
      };
    };

    const scheduleRetry = () => {
      if (cancelled) return;
      // Sabit 1.5 sn yeniden deneme, uygulama kapalıyken OBS katmanlarını
      // sonsuz döngüye sokuyordu; üstel geri çekilme + sapma kullan.
      const raw = 1000 * 2 ** Math.min(attempt, 4);
      attempt += 1;
      const delay = Math.min(MAX_RETRY_MS, Math.round(raw * (0.8 + Math.random() * 0.4)));
      retry = window.setTimeout(connect, delay);
    };

    connect();

    return () => {
      cancelled = true;
      clearHeartbeat();
      if (retry) window.clearTimeout(retry);
      try {
        ws?.close();
      } catch {
        /* */
      }
    };
  }, [screen, enabled]);

  return { settings, setSettings, connected, settingsRef, mediaEpoch };
}
