import { useEffect } from "react";
import { useOverlaySync } from "../../lib/useOverlaySync";
import { chatHideAfterMs, useChatHub } from "../../lib/useChatHub";
import ChatFeed from "../../components/chat/ChatFeed";
import { useObsKeepalive } from "../../lib/obsKeepalive";

/**
 * OBS Browser Source için birleşik sohbet katmanı. — AxthrowA
 * Kick, Twitch ve YouTube tek listede akar; kanal adları boşsa Giriş
 * ekranındaki sosyal hesaplardan otomatik alınır.
 * Mesajlar varsayılan olarak süre dolunca kaybolur.
 */
export default function ChatPage() {
  useObsKeepalive();
  const { settings } = useOverlaySync("chat", {});
  const hideAfterMs = chatHideAfterMs(settings);
  const { messages } = useChatHub(settings, {
    max: Number(settings.maxMessages) || 60,
    hideAfterMs,
  });
  const transparent = settings.bgTransparent !== false;
  const scale = Math.min(200, Math.max(40, Number(settings.chatScale) || 100)) / 100;
  const boxW = Math.min(100, Math.max(20, Number(settings.chatBoxWidth) || 100));
  const boxH = Math.min(100, Math.max(20, Number(settings.chatBoxHeight) || 100));

  useEffect(() => {
    const root = document.documentElement;
    if (transparent) root.classList.add("obs-transparent");
    else root.classList.remove("obs-transparent");
    return () => root.classList.remove("obs-transparent");
  }, [transparent]);

  return (
    <div
      className="chat-overlay"
      data-fade={settings.fadeOldMessages ? "1" : undefined}
      style={{
        background: transparent ? "transparent" : "#0a0c12",
        ["--chat-size" as never]: `${Number(settings.fontSize) || 22}px`,
        ["--accent" as never]: settings.accent || "#3EEDFE",
        textShadow:
          settings.textShadow === false ? "none" : "0 2px 6px rgba(0,0,0,.85)",
      }}
    >
      <div
        className="chat-box"
        style={{
          width: `${boxW}%`,
          height: `${boxH}%`,
          transform: `scale(${scale})`,
          transformOrigin: "bottom left",
        }}
      >
        <ChatFeed
          messages={messages}
          showBadge={settings.showPlatformBadge !== false}
          showUserBadges={settings.showUserBadges !== false}
          showTimestamps={!!settings.showTimestamps}
          highlightEvents={settings.highlightEvents !== false}
          hideAfterMs={hideAfterMs}
        />
      </div>
    </div>
  );
}
