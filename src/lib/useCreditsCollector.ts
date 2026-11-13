import { useEffect, useMemo, useState } from "react";
import { fetchSettings, OverlaySettings } from "./api";
import { ChatMessage, chatHubConfig, configKey, startChatHub } from "./chatHub";
import { pushCredit } from "./creditsSession";
import { subscribeOverlaySync } from "./overlaySyncHub";

/**
 * Panel açıkken Kick/Twitch/YouTube olaylarını dinler ve çıkış jeneriği
 * oturumuna abone / takipçi / bağış isimlerini yazar.
 */
export function useCreditsCollector(enabled = true) {
  const [chat, setChat] = useState<OverlaySettings>({});
  const [starting, setStarting] = useState<OverlaySettings | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    Promise.all([fetchSettings("chat"), fetchSettings("starting")])
      .then(([c, s]) => {
        if (cancelled) return;
        setChat(c || {});
        setStarting(s || null);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });

    // Ayarlar WS ile değişince yenile
    const unsubscribe = subscribeOverlaySync({
      onMessage: (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "settings" && msg.screen === "chat") setChat(msg.data || {});
          if (msg.type === "settings" && msg.screen === "starting") setStarting(msg.data || {});
          if (msg.type === "snapshot") {
            if (msg.chat) setChat(msg.chat);
            if (msg.starting) setStarting(msg.starting);
          }
        } catch {
          /* */
        }
      },
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [enabled]);

  const cfg = useMemo(() => chatHubConfig(chat, starting), [chat, starting]);
  const key = configKey(cfg);

  useEffect(() => {
    if (!enabled || !ready) return;
    return startChatHub(cfg, {
      onStatus: () => {},
      onMessage: (m) => routeCredit(m),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, ready]);
}

function routeCredit(m: ChatMessage) {
  const user = String(m.user || "").trim();
  if (!user) return;
  switch (m.kind) {
    case "sub":
    case "membership":
      pushCredit("subscribers", user);
      break;
    case "superchat":
    case "sticker":
    case "bits":
      pushCredit("donors", m.amount ? `${user} · ${m.amount}` : user);
      break;
    case "follow":
      pushCredit("followers", user);
      break;
    case "raid":
      pushCredit("followers", `${user} (raid)`);
      break;
    default:
      break;
  }
}
