import { useMemo, useState } from "react";
import { OverlaySettings } from "../../lib/api";
import { PLATFORM_LABEL, Platform, PlatformStatus } from "../../lib/chatHub";
import { useChatHub } from "../../lib/useChatHub";
import ChatFeed from "../chat/ChatFeed";
import { useI18n } from "../../i18n";

const PLATFORMS: Platform[] = ["kick", "twitch", "youtube"];

const STATE_DOT: Record<PlatformStatus["state"], string> = {
  live: "bg-emerald-400",
  connecting: "bg-amber-400 animate-pulse",
  error: "bg-red-500",
  off: "bg-white/25",
};

/**
 * Panel birleşik sohbet — AxthrowA
 */
export default function UnifiedChatPanel({ settings }: { settings: OverlaySettings }) {
  const { t, locale } = useI18n();
  const [hidden, setHidden] = useState<Record<Platform, boolean>>({
    kick: false,
    twitch: false,
    youtube: false,
  });

  const STATE_TEXT: Record<PlatformStatus["state"], string> =
    locale === "en"
      ? { live: "live", connecting: "connecting", error: "error", off: "off" }
      : { live: "canlı", connecting: "bağlanıyor", error: "hata", off: "kapalı" };

  // Panelde mesaj süreyle kaybolmaz: kaybolma süresi yalnız OBS katmanının ayarı
  const hideAfterMs = 0;
  const { messages, status, clear } = useChatHub(settings, {
    max: Math.max(Number(settings.maxMessages) || 60, 150),
    hideAfterMs,
  });

  const shown = useMemo(
    () => messages.filter((m) => !hidden[m.platform]),
    [messages, hidden]
  );

  const counts = useMemo(() => {
    const c: Record<Platform, number> = { kick: 0, twitch: 0, youtube: 0 };
    for (const m of messages) c[m.platform] += 1;
    return c;
  }, [messages]);

  const anyLive = PLATFORMS.some((p) => status[p].state === "live");

  return (
    <div className="flex h-full flex-col bg-black">
      <div className="flex flex-wrap items-center gap-2 border-b border-panel-border px-3 py-2">
        {PLATFORMS.map((p) => {
          const st = status[p];
          const off = hidden[p];
          return (
            <button
              key={p}
              onClick={() => setHidden((h) => ({ ...h, [p]: !h[p] }))}
              title={`${st.channel || "-"} — ${st.detail || STATE_TEXT[st.state]}`}
              className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition ${
                off
                  ? "border-panel-border bg-transparent text-panel-muted line-through"
                  : "border-panel-border bg-white/5 text-white"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${STATE_DOT[st.state]}`} />
              <span className="font-semibold">{PLATFORM_LABEL[p]}</span>
              <span className="text-panel-muted">{counts[p]}</span>
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-ui-2 text-panel-muted">
            {shown.length} {t("chat.msgCount")}
          </span>
          <button
            className="rounded-md bg-black/40 px-2 py-1 text-ui-2 text-white"
            onClick={clear}
          >
            {t("chat.clearBtn")}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <div
          className="chat-overlay !h-full !w-full !p-3"
          style={{
            background: "transparent",
            ["--chat-size" as never]: "15px",
            ["--accent" as never]: settings.accent || "#3EEDFE",
          }}
        >
          <ChatFeed
            messages={shown}
            showBadge
            showUserBadges={settings.showUserBadges !== false}
            showTimestamps={settings.showTimestamps !== false}
            highlightEvents={settings.highlightEvents !== false}
            hideAfterMs={hideAfterMs}
            emptyText={
              anyLive
                ? "Bağlandı — ilk mesaj bekleniyor…"
                : "Kanal adlarını gir (veya Giriş ekranındaki sosyal hesapları doldur); bağlantı otomatik kurulur."
            }
          />
        </div>
      </div>

      <div className="border-t border-panel-border px-3 py-1.5 text-ui-2 text-panel-muted">
        {PLATFORMS.map((p) => {
          const st = status[p];
          if (st.state === "off") return null;
          return (
            <span key={p} className="mr-3">
              <b className="text-white/80">{PLATFORM_LABEL[p]}</b>{" "}
              {st.channel ? `${st.channel} · ` : ""}
              {st.detail || STATE_TEXT[st.state]}
            </span>
          );
        })}
      </div>
    </div>
  );
}
