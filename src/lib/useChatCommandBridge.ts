/**
 * Panel açıkken chat !komutlarını her zaman dinle (Ses / Ayarlar sekmesinde bile).
 * OBS chat overlay veya chat önizlemesi kapalıysa da çalışır.
 */

import { useEffect, useState } from "react";
import { fetchSettings, type OverlaySettings } from "./api";
import {
  chatHubConfig,
  startChatHub,
  type ChatMessage,
} from "./chatHub";

export function useChatCommandBridge(opts?: {
  onToast?: (msg: string) => void;
  onInject?: (msg: ChatMessage) => void;
}) {
  const onToast = opts?.onToast;
  const onInject = opts?.onInject;
  const [chatSettings, setChatSettings] = useState<OverlaySettings>({});
  const [starting, setStarting] = useState<OverlaySettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void fetchSettings("chat")
        .then((d) => {
          if (!cancelled) setChatSettings(d || {});
        })
        .catch(() => {});
      void fetchSettings("starting")
        .then((d) => {
          if (!cancelled) setStarting(d);
        })
        .catch(() => {});
    };
    load();
    const t = window.setInterval(load, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  useEffect(() => {
    const cfg = chatHubConfig(chatSettings, starting);
    // Hiç kanal yoksa boşuna bağlanma
    const any =
      (cfg.kick.enabled && cfg.kick.slug) ||
      (cfg.twitch.enabled && cfg.twitch.channel) ||
      (cfg.youtube.enabled && cfg.youtube.ref);
    if (!any) return;

    const stop = startChatHub(cfg, {
      onMessage: () => {
        /* komutlar hub içinde işlenir; burada yalnızca bağlantıyı canlı tutarız */
      },
      onStatus: () => {},
    });
    return stop;
  }, [chatSettings, starting]);

  useEffect(() => {
    const onToastEv = (e: Event) => {
      const d = (e as CustomEvent<string>).detail;
      if (d && onToast) onToast(d);
    };
    const onInj = (e: Event) => {
      const d = (e as CustomEvent<ChatMessage>).detail;
      if (d && onInject) onInject(d);
    };
    window.addEventListener("chat-command-toast", onToastEv);
    window.addEventListener("chat-command-inject", onInj);
    return () => {
      window.removeEventListener("chat-command-toast", onToastEv);
      window.removeEventListener("chat-command-inject", onInj);
    };
  }, [onToast, onInject]);
}
