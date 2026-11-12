/**
 * Chat Overlay — hazır temalar, rozet ikonları, emote, fade, gölge.
 */

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  KICK_ICONS,
  TWITCH_FALLBACK_ICONS,
  YOUTUBE_ICONS,
  type BadgeIcon,
} from "../../lib/badgeIcons";
import { MessageFormatter } from "../../lib/emotes/parseEmotes";
import { useWidgetSync, type WidgetSyncEvent } from "../../lib/widgets/useWidgetSync";
import {
  emitWidgetBus,
  playWidgetSfx,
  resolveSfx,
  volFromConfig,
} from "../../lib/widgets/widgetBus";

type ChatLine = {
  id: string;
  user: string;
  text: string;
  color: string;
  badges: string[];
  platform?: string;
  ts: number;
  fading?: boolean;
};

type Props = { config: Record<string, unknown> };

type ThemeId =
  | "boxed"
  | "clean"
  | "transparent"
  | "bubbles"
  | "streamline"
  | "side"
  | "neon"
  | "glitch";

const DEMO_LINES: ChatLine[] = [
  {
    id: "demo-1",
    user: "Axthrowa",
    text: "Hoş geldiniz! [emote:37226:KEKW] !oy 1",
    color: "#3EEDFE",
    badges: ["broadcaster", "moderator"],
    platform: "kick",
    ts: Date.now() - 6000,
  },
  {
    id: "demo-2",
    user: "NeonFox",
    text: "Chat efsane görünüyor 🔥",
    color: "#22d3ee",
    badges: ["subscriber", "vip"],
    platform: "kick",
    ts: Date.now() - 3500,
  },
  {
    id: "demo-3",
    user: "viewer42",
    text: "@Axthrowa selam! WWWWWW",
    color: "#ff8a5b",
    badges: [],
    platform: "twitch",
    ts: Date.now() - 1200,
  },
  {
    id: "demo-4",
    user: "GiftKing",
    text: "Hediye abone geldi 🎁",
    color: "#fbbf24",
    badges: ["og", "sub_gifter"],
    platform: "kick",
    ts: Date.now(),
  },
];

const BADGE_ALIASES: Record<string, string> = {
  mod: "moderator",
  mods: "moderator",
  sub: "subscriber",
  subs: "subscriber",
  vip: "vip",
  owner: "broadcaster",
  broadcaster: "broadcaster",
  gifted: "sub_gifter",
};

function resolveBadgeIcon(raw: string): BadgeIcon | null {
  const key = BADGE_ALIASES[raw.toLowerCase()] || raw.toLowerCase();
  return (
    KICK_ICONS[key] ||
    TWITCH_FALLBACK_ICONS[key] ||
    YOUTUBE_ICONS[key] ||
    null
  );
}

function PlatformDot({ platform }: { platform?: string }) {
  const p = (platform || "kick").toLowerCase();
  const color =
    p === "twitch" ? "#9146ff" : p === "youtube" ? "#ff0000" : "#53FC18";
  const label = p === "twitch" ? "T" : p === "youtube" ? "Y" : "K";
  return (
    <span
      className="inline-flex h-[1.05em] w-[1.05em] shrink-0 items-center justify-center rounded-[0.25em] text-[0.55em] font-black"
      style={{ background: color, color: "#0a0c12" }}
      title={p}
    >
      {label}
    </span>
  );
}

function BadgePills({ badges }: { badges: string[] }) {
  if (!badges.length) return null;
  return (
    <span className="mr-1 inline-flex items-center gap-0.5 align-middle">
      {badges.map((b, i) => {
        const icon = resolveBadgeIcon(b);
        if (!icon) {
          return (
            <span
              key={`${b}-${i}`}
              className="rounded px-1 text-[0.55em] font-bold uppercase tracking-wide text-white/50"
            >
              {b.slice(0, 3)}
            </span>
          );
        }
        return (
          <span
            key={`${b}-${i}`}
            className="inline-flex h-[1.05em] w-[1.05em] items-center justify-center rounded-[0.22em]"
            style={{ background: icon.filled ? icon.color : "transparent" }}
            title={icon.label}
          >
            <svg viewBox="0 0 24 24" className="h-[70%] w-[70%]" aria-hidden>
              <path
                d={icon.path}
                fill={icon.filled ? "#0a0c12" : icon.color}
              />
            </svg>
          </span>
        );
      })}
    </span>
  );
}

function themeShell(theme: ThemeId, bgOpacity: number): {
  wrap: string;
  row: string;
  bg: string;
} {
  const a = Number.isFinite(bgOpacity) ? bgOpacity : 0.55;
  switch (theme) {
    case "clean":
    case "transparent":
      return { wrap: "bg-transparent p-1", row: "", bg: "transparent" };
    case "bubbles":
      return {
        wrap: "bg-transparent p-2",
        row: "rounded-2xl border border-white/10 px-3 py-1.5 backdrop-blur-md",
        bg: `rgba(8,12,20,${a})`,
      };
    case "streamline":
      return {
        wrap: "border-l-2 border-[color:var(--chat-accent)] bg-transparent pl-3",
        row: "py-0.5",
        bg: "transparent",
      };
    case "side":
      return {
        wrap: "rounded-none border-r-4 border-[color:var(--chat-accent)] bg-black/30 pr-3 backdrop-blur-sm",
        row: "py-1",
        bg: `rgba(6,10,16,${a * 0.85})`,
      };
    case "neon":
      return {
        wrap: "rounded-xl border border-cyan-400/35 bg-black/50 p-3 shadow-[0_0_24px_rgba(34,211,238,.2)]",
        row: "",
        bg: `rgba(4,12,20,${a})`,
      };
    case "glitch":
      return {
        wrap: "rounded-xl border border-cyan-400/40 bg-black/45 p-3 shadow-[0_0_20px_rgba(62,237,254,.25)]",
        row: "",
        bg: `rgba(4,14,22,${a})`,
      };
    case "boxed":
    default:
      return {
        wrap: "rounded-xl border border-white/10 p-3 backdrop-blur-md",
        row: "",
        bg: `rgba(8,12,20,${a})`,
      };
  }
}

export default function ChatWidget({ config }: Props) {
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [hypeAura, setHypeAura] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const hypeHits = useRef<{ t: number; n: number }[]>([]);

  const themeRaw = String(config.theme || "boxed").toLowerCase();
  const theme = (
    ["boxed", "clean", "transparent", "bubbles", "streamline", "side", "neon", "glitch"].includes(
      themeRaw
    )
      ? themeRaw
      : "boxed"
  ) as ThemeId;

  const maxMessages = Math.max(1, Math.min(80, Number(config.maxMessages) || 12));
  const hideAfterRaw =
    Number(config.hideAfterMs) > 0
      ? Number(config.hideAfterMs)
      : Number(config.hideAfterSec) > 0
        ? Number(config.hideAfterSec) * 1000
        : 0;
  const hideOldExplicit = config.hideOldMessages;
  const hideOld =
    hideOldExplicit === true ||
    (hideOldExplicit !== false && hideAfterRaw > 0);
  const hideAfterMs = hideOld ? Math.max(1500, hideAfterRaw || 12_000) : 0;

  const showBadges = config.showBadges !== false;
  const showPlatform = config.showPlatform !== false;
  const showEmotes = config.showEmotes !== false;
  const textShadow = config.textShadow !== false;
  const highlightMentions = config.highlightMentions !== false;
  const ignoreBots = Boolean(config.ignoreBots);
  const mentionUser = String(config.mentionUser || config.channelName || "")
    .replace(/^@/, "")
    .trim()
    .toLowerCase();

  const fontSize = Math.max(12, Math.min(64, Number(config.fontSize) || 20));
  const fontFamily = String(
    config.font_family || config.fontFamily || "Outfit, system-ui, sans-serif"
  );
  const primary = String(config.primary_color || config.accent || "#3EEDFE");
  const nameColor = String(config.nameColor || "");
  const messageColor = String(config.messageColor || "#e5e7eb");
  const lineGap = Math.max(2, Math.min(24, Number(config.lineGap) || 8));
  const direction = String(config.direction || "bottom").toLowerCase(); // bottom | top
  const bgOpacity =
    config.background_opacity != null
      ? Math.min(1, Math.max(0, Number(config.background_opacity) / 100))
      : Number(config.opacity ?? 0.55);
  const opacity = Number(config.opacity ?? 1);
  const previewDemo = Boolean(config._previewDemo || config._previewMode);
  const messageAnim = String(config.messageAnim || config.animIn || "slide").toLowerCase();
  const hypeEnabled = config.hypeWaveEnabled !== false;
  const hypeLetter = String(config.hypeLetter || "W").toUpperCase();
  const hypeThreshold = Number(config.hypeThreshold) || 8;
  const hypeWindowMs = Number(config.hypeWindowMs) || 4000;
  const { subscribe } = useWidgetSync({ kinds: ["chat"] });

  const shell = useMemo(() => themeShell(theme, bgOpacity), [theme, bgOpacity]);

  const animInitial =
    messageAnim === "fade"
      ? { opacity: 0 }
      : messageAnim === "pop"
        ? { opacity: 0, scale: 0.86 }
        : { opacity: 0, x: theme === "side" ? 16 : -16 };

  useEffect(() => {
    if (previewDemo && lines.length === 0) setLines(DEMO_LINES);
  }, [previewDemo, lines.length]);

  useEffect(() => {
    return subscribe((ev: WidgetSyncEvent) => {
      if (!ev.user || !(ev.text || ev.message)) return;
      const text = String(ev.text || ev.message || "");
      const user = String(ev.user);
      if (ignoreBots) {
        const u = user.toLowerCase();
        if (
          u.includes("bot") ||
          u === "nightbot" ||
          u === "streamelements" ||
          u === "botrix" ||
          u === "moobot"
        ) {
          return;
        }
      }
      const line: ChatLine = {
        id: ev.id || `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        user,
        text,
        color: ev.color || nameColor || primary,
        badges: (ev.badges || []).map(String),
        platform: ev.platform,
        ts: ev.t || Date.now(),
      };
      setLines((prev) => {
        const next = [...prev.filter((l) => !l.id.startsWith("demo-")), line];
        return next.slice(-maxMessages);
      });

      if (hypeEnabled) {
        const compact = text.replace(/\s+/g, "").toUpperCase();
        const onlyLetter =
          compact.length >= 2 &&
          [...compact].every((ch) => ch === hypeLetter || ch === "!");
        if (onlyLetter || compact.split(hypeLetter).length - 1 >= 3) {
          const now = Date.now();
          hypeHits.current = [
            ...hypeHits.current.filter((h) => now - h.t < hypeWindowMs),
            { t: now, n: Math.max(1, compact.split(hypeLetter).length - 1) },
          ];
          const total = hypeHits.current.reduce((a, h) => a + h.n, 0);
          if (total >= hypeThreshold) {
            hypeHits.current = [];
            setHypeAura(true);
            playWidgetSfx(
              resolveSfx(config, "sfxUrl", "preset:sparkle"),
              volFromConfig(config, 0.65)
            );
            void emitWidgetBus("chat", "chat.hype", { letter: hypeLetter, total });
            window.setTimeout(() => setHypeAura(false), 2200);
          }
        }
      }

      if (hideAfterMs > 0) {
        const id = line.id;
        window.setTimeout(() => {
          setLines((prev) =>
            prev.map((l) => (l.id === id ? { ...l, fading: true } : l))
          );
          window.setTimeout(() => {
            setLines((prev) => prev.filter((l) => l.id !== id));
          }, 480);
        }, hideAfterMs);
      }
    });
  }, [
    subscribe,
    maxMessages,
    hideAfterMs,
    primary,
    nameColor,
    hypeEnabled,
    hypeLetter,
    hypeThreshold,
    hypeWindowMs,
    ignoreBots,
    config,
  ]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (direction === "top") {
      el.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [lines, direction]);

  const ordered = direction === "top" ? [...lines].reverse() : lines;

  return (
    <div
      className="relative flex studio-widget-root h-full w-full items-stretch justify-start bg-transparent p-2"
      style={
        {
          opacity,
          fontFamily,
          ["--chat-accent" as string]: primary,
        } as CSSProperties
      }
    >
      {hypeAura && (
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 80%, rgba(83,252,24,.28), transparent 55%), radial-gradient(ellipse at 50% 100%, rgba(34,211,238,.2), transparent 45%)",
            animation: "chatHypePulse 2.1s ease-out both",
          }}
        />
      )}
      <style>{`
        @keyframes chatHypePulse {
          0% { opacity: 0; transform: scale(.92) }
          30% { opacity: .9 }
          100% { opacity: 0; transform: scale(1.06) }
        }
        .studio-chat-scroll { scrollbar-width: none; }
        .studio-chat-scroll::-webkit-scrollbar { display: none; }
        .studio-chat-emote img { height: 1.35em; width: auto; vertical-align: -0.3em; }
      `}</style>

      <div
        ref={scroller}
        className={`studio-chat-scroll relative z-10 flex h-full min-h-0 w-full flex-col overflow-y-auto overflow-x-hidden ${shell.wrap}`}
        style={{
          fontSize,
          background: shell.bg,
          justifyContent: direction === "top" ? "flex-start" : "flex-end",
          gap: lineGap,
        }}
      >
        {ordered.length === 0 ? (
          <p className="text-sm text-white/50">Chat bekleniyor…</p>
        ) : (
          <AnimatePresence initial={false}>
            {ordered.map((l) => {
              const mentioned =
                highlightMentions &&
                mentionUser &&
                l.text.toLowerCase().includes(`@${mentionUser}`);
              const shadow = textShadow
                ? "0 1px 2px rgba(0,0,0,.85), 0 0 6px rgba(0,0,0,.45)"
                : "none";
              return (
                <motion.div
                  key={l.id}
                  initial={animInitial}
                  animate={{ opacity: l.fading ? 0 : 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, y: direction === "top" ? -8 : 8 }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                  className={`leading-snug ${shell.row} ${mentioned ? "ring-1 ring-[color:var(--chat-accent)]/50" : ""}`}
                  style={{
                    background:
                      theme === "bubbles"
                        ? shell.bg
                        : mentioned
                          ? `${primary}18`
                          : undefined,
                    textShadow: shadow,
                  }}
                >
                  {showPlatform ? <PlatformDot platform={l.platform} /> : null}
                  {showBadges ? <BadgePills badges={l.badges} /> : null}
                  <span
                    className="mx-1 font-semibold"
                    style={{ color: l.color || nameColor || primary }}
                  >
                    {l.user}
                  </span>
                  <span className="text-white/50">: </span>
                  <span className="studio-chat-emote" style={{ color: messageColor }}>
                    {showEmotes ? (
                      <MessageFormatter text={l.text} style={{ color: messageColor }} />
                    ) : (
                      l.text.replace(/\[emote:\d+:([^\]]*)\]/g, "$1")
                    )}
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
