import { useEffect, useRef, useState } from "react";
import { OverlaySettings, ScreenId, fetchSettings } from "./api";
import { dropOverlaySync, overlaySyncOpen, sendOverlaySync, subscribeOverlaySync } from "./overlaySyncHub";

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
/** WebSocket kapalıyken ayarların sorulma aralığı */
const YEDEK_YOKLAMA_MS = 3_000;

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

    let heartbeat: number | undefined;
    let pongTimer: number | undefined;

    const clearHeartbeat = () => {
      if (heartbeat) window.clearInterval(heartbeat);
      if (pongTimer) window.clearTimeout(pongTimer);
      heartbeat = undefined;
      pongTimer = undefined;
    };

    // Soket sayfada ortak (overlaySyncHub); yeniden bağlanma orada.
    const unsubscribe = subscribeOverlaySync({
      onOpen: () => {
        setConnected(true);
        clearHeartbeat();
        // Uygulama kapanıp ağ yarım açık kalırsa onclose gelmeyebiliyor;
        // düzenli ping'e yanıt yoksa bağlantıyı biz kapatıp yeniden kuruyoruz.
        heartbeat = window.setInterval(() => {
          if (!overlaySyncOpen()) return;
          try {
            sendOverlaySync(JSON.stringify({ type: "ping", t: Date.now() }));
          } catch {
            /* */
          }
          if (pongTimer) window.clearTimeout(pongTimer);
          pongTimer = window.setTimeout(dropOverlaySync, HEARTBEAT_TIMEOUT_MS);
        }, HEARTBEAT_MS);
      },
      onClose: () => {
        clearHeartbeat();
        setConnected(false);
      },
      onMessage: (ev) => {
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
      },
    });

    // Yedek yol: WebSocket kapalıyken (OBS'in tarayıcısı bağlantıyı düşürdüyse, uygulama yeniden açıldıysa)
    // ayarlar birkaç saniyede bir sorulur; panelde yapılan değişiklik OBS'e yine yansır.
    const yedek = window.setInterval(() => {
      if (overlaySyncOpen()) return;
      fetchSettings(screen)
        .then((data) => {
          if (cancelled || !data || !Object.keys(data).length) return;
          if (JSON.stringify(data) !== JSON.stringify(settingsRef.current)) setSettings(data);
        })
        .catch(() => {});
    }, YEDEK_YOKLAMA_MS);

    return () => {
      cancelled = true;
      window.clearInterval(yedek);
      clearHeartbeat();
      unsubscribe();
    };
  }, [screen, enabled]);

  return { settings, setSettings, connected, settingsRef, mediaEpoch };
}
