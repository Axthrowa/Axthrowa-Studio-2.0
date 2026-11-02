import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE, OverlaySettings, fetchSettings } from "./api";
import {
  ChatMessage,
  Platform,
  PlatformStatus,
  chatHubConfig,
  configKey,
  startChatHub,
} from "./chatHub";
import type { ChatBadge } from "./chatBadges";
import { KICK_ICONS, TWITCH_FALLBACK_ICONS, YOUTUBE_ICONS } from "./badgeIcons";
import { kickParts, textPart } from "./chatParts";
import { handleSmartBotMessage } from "./smartBot";
import { pushAppAlert } from "./appAlert";
import { isLocalBotUser } from "./smartBot/botIdentity";
import { isRustKickChatActive, jsHandlesKickCommands, refreshRustKickChatActive } from "./rustKickGate";

const INITIAL_STATUS: Record<Platform, PlatformStatus> = {
  kick: { platform: "kick", state: "off", detail: "kapalı", channel: "" },
  twitch: { platform: "twitch", state: "off", detail: "kapalı", channel: "" },
  youtube: { platform: "youtube", state: "off", detail: "kapalı", channel: "" },
};

/** Yinelenen mesaj anahtarlarını sınırlı tutmak için pencere boyu */
const SEEN_MAX = 800;

export type UseChatHubResult = {
  messages: ChatMessage[];
  status: Record<Platform, PlatformStatus>;
  clear: () => void;
};

/**
 * Üç platformu tek listede toplar.
 *
 * Her mesaj için ayrı `setState` çağırmak yoğun sohbette saniyede onlarca
 * yeniden render demekti; gelen mesajlar bir tampona yazılır ve tek bir
 * animasyon karesinde toplu olarak uygulanır.
 */
export function useChatHub(
  chatSettings: OverlaySettings,
  options?: { max?: number; enabled?: boolean; hideAfterMs?: number }
): UseChatHubResult {
  const max = Math.max(1, Math.min(500, Number(options?.max) || 60));
  const enabled = options?.enabled !== false;
  const hideAfterMs = Math.max(0, Number(options?.hideAfterMs) || 0);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<Record<Platform, PlatformStatus>>(INITIAL_STATUS);
  const [starting, setStarting] = useState<OverlaySettings | null>(null);
  // Otomatik algılamada Giriş ayarları gelmeden bağlanırsak boş kanalla
  // başlayıp hemen yeniden bağlanıyoruz; bir kez beklemek daha ucuz.
  const [startingResolved, setStartingResolved] = useState(false);

  const seen = useRef<Set<string>>(new Set());
  const buffer = useRef<ChatMessage[]>([]);
  const frame = useRef<number | null>(null);
  const maxRef = useRef(max);
  maxRef.current = max;
  const hideRef = useRef(hideAfterMs);
  hideRef.current = hideAfterMs;

  // Otomatik kanal tespiti Giriş ekranındaki sosyal hesapları okur
  const autoDetect = chatSettings.autoDetect !== false;
  useEffect(() => {
    if (!autoDetect) {
      setStarting(null);
      setStartingResolved(true);
      return;
    }
    let cancelled = false;
    setStartingResolved(false);
    fetchSettings("starting")
      .then((d) => {
        if (cancelled) return;
        setStarting(d);
        setStartingResolved(true);
      })
      .catch(() => {
        if (cancelled) return;
        setStarting(null);
        setStartingResolved(true);
      });
    return () => {
      cancelled = true;
    };
  }, [autoDetect]);

  const flush = useCallback(() => {
    frame.current = null;
    const batch = buffer.current;
    if (!batch.length) return;
    buffer.current = [];
    const hideMs = hideRef.current;
    const cutoff = hideMs > 0 ? Date.now() - hideMs : 0;
    setMessages((prev) => {
      let next = prev.length ? prev.concat(batch) : batch;
      if (cutoff > 0) next = next.filter((m) => m.ts >= cutoff);
      return next.length > maxRef.current ? next.slice(next.length - maxRef.current) : next;
    });
  }, []);

  const push = useCallback(
    (m: ChatMessage) => {
      if (seen.current.has(m.key)) return;
      seen.current.add(m.key);
      if (seen.current.size > SEEN_MAX) {
        // En yeni yarıyı tut — Set ekleme sırasını korur
        seen.current = new Set([...seen.current].slice(-Math.floor(SEEN_MAX / 2)));
      }
      buffer.current.push(m);
      if (frame.current == null) {
        frame.current =
          typeof requestAnimationFrame === "function"
            ? requestAnimationFrame(flush)
            : (window.setTimeout(flush, 60) as unknown as number);
      }
    },
    [flush]
  );

  // Kick kullanıcı adını her harfte yeniden bağlamayı engelle (curl konsolu + çift soket)
  const [kickSlugStable, setKickSlugStable] = useState(() =>
    String(chatSettings.kickSlug || "").trim()
  );
  useEffect(() => {
    const next = String(chatSettings.kickSlug || "").trim();
    const t = window.setTimeout(() => setKickSlugStable(next), 550);
    return () => window.clearTimeout(t);
  }, [chatSettings.kickSlug]);

  const cfg = useMemo(
    () =>
      chatHubConfig(
        { ...chatSettings, kickSlug: kickSlugStable || chatSettings.kickSlug },
        starting
      ),
    // Anahtar değişmedikçe yeniden bağlanma
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      chatSettings.enableKick,
      chatSettings.enableTwitch,
      chatSettings.enableYoutube,
      chatSettings.autoDetect,
      kickSlugStable,
      chatSettings.chatroomId,
      chatSettings.twitchChannel,
      chatSettings.youtubeChannel,
      chatSettings.youtubeVideoId,
      starting,
    ]
  );
  const key = configKey(cfg);

  useEffect(() => {
    if (!enabled || !startingResolved) {
      setStatus(INITIAL_STATUS);
      return;
    }
    const stop = startChatHub(cfg, {
      onMessage: push,
      onStatus: (s) => setStatus((prev) => (sameStatus(prev[s.platform], s) ? prev : { ...prev, [s.platform]: s })),
    });
    return () => {
      stop();
      if (frame.current != null) {
        cancelAnimationFrame(frame.current);
        frame.current = null;
      }
      buffer.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, startingResolved, push]);

  useEffect(() => {
    const onInj = (e: Event) => {
      const d = (e as CustomEvent<ChatMessage>).detail;
      if (d) push(d);
    };
    window.addEventListener("chat-command-inject", onInj);
    return () => window.removeEventListener("chat-command-inject", onInj);
  }, [push]);

  // Üst sınır küçültülürse fazlalığı hemen at
  useEffect(() => {
    setMessages((prev) => (prev.length > max ? prev.slice(prev.length - max) : prev));
  }, [max]);

  // Süre dolan mesajları ekrandan kaldır (kaybolma süresi)
  useEffect(() => {
    if (!(hideAfterMs > 0)) return;
    const tick = () => {
      const now = Date.now();
      const cutoff = now - hideAfterMs;
      const botCutoff = now - Math.max(hideAfterMs, 28_000);
      setMessages((prev) => {
        if (!prev.length) return prev;
        const next = prev.filter((m) =>
          isLocalBotUser(m.user) ? m.ts >= botCutoff : m.ts >= cutoff
        );
        return next.length === prev.length ? prev : next;
      });
    };
    tick();
    const id = window.setInterval(tick, 2000);
    return () => window.clearInterval(id);
  }, [hideAfterMs]);

  const clear = useCallback(() => {
    buffer.current = [];
    seen.current = new Set();
    setMessages([]);
  }, []);

  // SesBot duyurusu ( !seslistesi ) — sunucu _botAnnounce → OBS chat
  const lastBotAnn = useRef("");
  useEffect(() => {
    const ann = chatSettings._botAnnounce;
    if (!ann || typeof ann !== "object") return;
    const id = String((ann as { id?: string }).id || "");
    if (!id || id === lastBotAnn.current) return;
    lastBotAnn.current = id;
    const lines = Array.isArray((ann as { lines?: unknown }).lines)
      ? ((ann as { lines: unknown[] }).lines).map(String)
      : [];
    const single = String((ann as { text?: string }).text || "");
    const allLines = lines.length ? lines : single ? [single] : [];
    const platform = ((ann as { platform?: Platform }).platform || "kick") as Platform;
    for (const line of allLines) {
      if (!line.trim()) continue;
      push({
        key: `bot-ann-${id}-${Math.random().toString(36).slice(2, 7)}`,
        id: `bot-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        platform,
        user: String((ann as { user?: string }).user || "BotAxT"),
        text: line,
        parts: [{ type: "text", text: line }],
        color: "#fbbf24",
        kind: "chat",
        badges: [],
        ts: Date.now(),
      });
    }
  }, [chatSettings._botAnnounce, push]);

  // Rust bot motoru → overlay-sync `chat-message`
  // Pusher/IRC ile aynı anahtarı kullan: çift mesaj olmasın; emote + rozet ikonları gelsin.
  useEffect(() => {
    if (!enabled) return;
    void refreshRustKickChatActive();
    const gateId = window.setInterval(() => void refreshRustKickChatActive(), 4000);
    let ws: WebSocket | null = null;
    let retry: number | undefined;
    const connect = () => {
      try {
        ws = new WebSocket(`${API_BASE.replace(/^http/, "ws")}/ws/overlay-sync`);
      } catch {
        retry = window.setTimeout(connect, 2500);
        return;
      }
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg?.type === "bot-error") {
            const text = String(msg.text || msg.message || "").trim();
            if (text && !/rate limit|hız limiti|429/i.test(text)) {
              pushAppAlert({ message: text });
            }
            return;
          }
          if (msg?.type !== "chat-message") return;
          const platform = (msg.platform || "kick") as Platform;
          const user = String(msg.user || "");
          const text = String(msg.text || "");
          if (!user || !text) return;
          const id = String(msg.id || "").trim();
          const badges = badgesFromOverlayMsg(platform, msg);
          const parts =
            platform === "kick" && text.includes("[emote:")
              ? kickParts(text)
              : textPart(text);
          // Kick Pusher ile aynı anahtar → seen set çiftini ezer
          const key =
            platform === "kick" && id
              ? `kick:${id}`
              : platform === "twitch" && id
                ? `twitch:${id}`
                : `rust-${id || `${platform}-${user}-${msg.t}`}`;
          const incoming: ChatMessage = {
            key,
            id: id || `${Date.now()}`,
            platform,
            user,
            text: parts.map((p) => (p.type === "text" ? p.text : p.name)).join(""),
            parts,
            color: String(
              msg.color ||
                (platform === "twitch" ? "#9146ff" : platform === "youtube" ? "#ff0000" : "#53FC18")
            ),
            kind: "chat",
            badges,
            ts: Number(msg.t) || Date.now(),
          };
          push(incoming);
          // Rust dinlerken Pusher kapalı; komutları bu soket işler. Yanıt Kick API kuyruğuna gider.
          if (platform === "kick" && jsHandlesKickCommands(isRustKickChatActive())) {
            const extras = handleSmartBotMessage(incoming);
            for (const x of extras) push(x);
          }
        } catch {
          /* */
        }
      };
      ws.onclose = () => {
        retry = window.setTimeout(connect, 2500);
      };
    };
    connect();
    return () => {
      window.clearInterval(gateId);
      if (retry) window.clearTimeout(retry);
      try {
        ws?.close();
      } catch {
        /* */
      }
    };
  }, [enabled, push]);

  // Panel / kısayol: clearEpoch artınca tüm chat yüzeyleri temizlenir.
  const lastClear = useRef(0);
  useEffect(() => {
    const epoch = Number(chatSettings.clearEpoch) || 0;
    if (epoch > 0 && epoch !== lastClear.current) {
      lastClear.current = epoch;
      clear();
    }
  }, [chatSettings.clearEpoch, clear]);

  return { messages, status, clear };
}

/** Rust overlay `chat-message` rozetlerini görülebilir simgelere çevir. */
function badgesFromOverlayMsg(platform: Platform, msg: Record<string, unknown>): ChatBadge[] {
  const out: ChatBadge[] = [];
  const seen = new Set<string>();
  const pushType = (raw: string) => {
    const type = raw.trim().toLowerCase();
    if (!type || seen.has(type)) return;
    seen.add(type);
    const icon =
      (platform === "kick" && KICK_ICONS[type]) ||
      (platform === "youtube" && YOUTUBE_ICONS[type]) ||
      TWITCH_FALLBACK_ICONS[type] ||
      KICK_ICONS[type] ||
      undefined;
    out.push({
      label: icon?.label || raw,
      icon: icon || {
        path: "M12 2 4 5.2v6c0 5 3.4 9.6 8 10.8 4.6-1.2 8-5.8 8-10.8v-6L12 2z",
        color: "#8a8f9c",
        label: raw,
        filled: true,
      },
    });
  };

  if (Array.isArray(msg.badges)) {
    for (const b of msg.badges) {
      if (typeof b === "string") pushType(b);
      else if (b && typeof b === "object") {
        const o = b as Record<string, unknown>;
        pushType(String(o.type || o.label || o.icon || ""));
      }
    }
  }
  if (msg.is_mod) pushType("moderator");
  if (msg.is_vip) pushType("vip");
  if (msg.is_sub) pushType(platform === "youtube" ? "member" : "subscriber");
  return out;
}

function sameStatus(a: PlatformStatus | undefined, b: PlatformStatus) {
  return !!a && a.state === b.state && a.detail === b.detail && a.channel === b.channel;
}

/** Ayarlardan mesajın ekranda kalma süresi (ms). 0 = kalıcı. */
export function chatHideAfterMs(settings: OverlaySettings): number {
  if (settings.autoHideMessages === false) return 0;
  const raw = Number(settings.messageHideSec);
  const sec = Number.isFinite(raw) && raw > 0 ? raw : 12;
  return Math.round(Math.min(180, Math.max(2, sec)) * 1000);
}
