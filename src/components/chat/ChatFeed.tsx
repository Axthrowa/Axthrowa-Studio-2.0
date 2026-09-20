import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChatMessage, PLATFORM_LABEL, Platform } from "../../lib/chatHub";
import { ChatPart } from "../../lib/chatParts";
import { ChatBadge } from "../../lib/chatBadges";
import { SOCIAL_META } from "../../lib/socials";
import { safeMediaUrl, sanitizePlainText } from "../../lib/sanitizeChat";

function hhmm(ts: number) {
  const d = new Date(ts || Date.now());
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Platformun kendi logosu — harf rozeti yerine gerçek marka işareti */
function PlatformLogo({ platform }: { platform: Platform }) {
  const meta = SOCIAL_META[platform];
  if (!meta) return null;
  return (
    <span
      className={`chat-platform chat-platform-${platform}`}
      style={{ background: meta.color }}
      title={PLATFORM_LABEL[platform]}
      aria-label={PLATFORM_LABEL[platform]}
    >
      <svg viewBox="0 0 24 24" role="img" aria-hidden focusable="false">
        <path d={meta.path} fill={meta.iconFill} />
      </svg>
    </span>
  );
}

/**
 * Tek rozet: platformun gerçek görseli varsa o çizilir; görsel yoksa ya da
 * yüklenemezse platform biçimli SVG simgeye düşer (rozet hiç kaybolmaz).
 */
function Badge({ badge }: { badge: ChatBadge }) {
  const [failed, setFailed] = useState(false);

  if (badge.url && !failed) {
    return (
      <img
        className="chat-badge"
        src={badge.url}
        alt={badge.label}
        title={badge.label}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    );
  }
  if (badge.icon) {
    const { icon } = badge;
    return (
      <span
        className="chat-badge chat-badge-icon"
        style={icon.filled ? { background: icon.color } : undefined}
        title={badge.label}
        aria-label={badge.label}
      >
        <svg viewBox="0 0 24 24" role="img" aria-hidden focusable="false">
          <path d={icon.path} fill={icon.filled ? "#0a0c12" : icon.color} />
        </svg>
      </span>
    );
  }
  if (!badge.label) return null;
  return (
    <span className="chat-badge chat-badge-text" title={badge.label}>
      {badge.label.slice(0, 3)}
    </span>
  );
}

/** Kullanıcı rozetleri — platformdaki gibi simge olarak */
function Badges({ badges }: { badges: ChatBadge[] }) {
  if (!badges.length) return null;
  return (
    <>
      {badges.map((b, i) => (
        <Badge key={`${b.label}-${i}`} badge={b} />
      ))}
    </>
  );
}

function Parts({ parts, fallback }: { parts: ChatPart[]; fallback: string }) {
  if (!parts.length) return <>{sanitizePlainText(fallback)}</>;
  return (
    <>
      {parts.map((p, i) => {
        if (p.type !== "emote") {
          return <span key={i}>{sanitizePlainText(p.text)}</span>;
        }
        const url = safeMediaUrl(p.url);
        if (!url) {
          return <span key={i}>{sanitizePlainText(p.name || "")}</span>;
        }
        return (
          <img
            key={i}
            className="chat-emote"
            src={url}
            alt={sanitizePlainText(p.name)}
            title={sanitizePlainText(p.name)}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={(e) => {
              const el = e.currentTarget;
              const src = el.getAttribute("src") || "";
              if (src.includes("/fullsize")) {
                el.src = src.replace("/fullsize", "/medium");
                return;
              }
              if (src.includes("files.kick.com/emotes/")) {
                const id = src.match(/emotes\/(\d+)/)?.[1];
                if (id) {
                  el.src = `https://kick.com/emotes/${id}/fullsize`;
                  return;
                }
              }
              const span = document.createElement("span");
              span.textContent = sanitizePlainText(p.name || "");
              el.replaceWith(span);
            }}
          />
        );
      })}
    </>
  );
}

export type ChatFeedProps = {
  messages: ChatMessage[];
  showBadge?: boolean;
  /** Moderatör / abone / VIP rozetleri */
  showUserBadges?: boolean;
  showTimestamps?: boolean;
  highlightEvents?: boolean;
  /** Mesaj bu süre (ms) sonra kaybolur; 0 = kalıcı */
  hideAfterMs?: number;
  /** Kaybolmadan önce solma süresi (ms) */
  fadeOutMs?: number;
  /** Boş listede gösterilecek yazı (panelde yardımcı, OBS'te gizli) */
  emptyText?: string;
  className?: string;
};

/**
 * Üç platformun ortak mesaj listesi. Hem OBS overlay'i hem panel sekmesi
 * bunu kullanır — böylece görünüm iki yerde ayrışmaz.
 */
export default function ChatFeed({
  messages,
  showBadge = true,
  showUserBadges = true,
  showTimestamps = false,
  highlightEvents = true,
  hideAfterMs = 0,
  fadeOutMs = 900,
  emptyText,
  className = "",
}: ChatFeedProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const [now, setNow] = useState(() => Date.now());

  // Kullanıcı yukarı kaydırdıysa otomatik kaydırmayı bırak
  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  };

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el || !pinned.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    pinned.current = true;
  }, []);

  const fadeMs = Math.max(200, Math.min(fadeOutMs, hideAfterMs > 0 ? hideAfterMs : fadeOutMs));

  // Kaybolma solması için zaman damgası.
  //
  // Eskiden sabit 200 ms'lik bir `setInterval` vardı: hiçbir mesaj solmuyorken
  // bile saniyede beş kez tüm liste yeniden çiziliyordu. Mesaj yalnızca
  // ömrünün son `fadeMs`'inde görünüm değiştirdiği için, o ana kadar uyuyup
  // yalnızca solma sırasında sık uyanıyoruz.
  useEffect(() => {
    if (!(hideAfterMs > 0) || !messages.length) return;
    let timer = 0;

    const uyan = () => {
      const simdi = Date.now();
      setNow(simdi);
      let soluyor = false;
      let sonrakiMs = Infinity;
      for (const m of messages) {
        const kalan = hideAfterMs - (simdi - m.ts);
        if (kalan <= 0) continue; // tamamen kaybolmuş
        if (kalan < fadeMs) soluyor = true;
        else sonrakiMs = Math.min(sonrakiMs, kalan - fadeMs);
      }
      // Solma sırasında akıcılık için sık; CSS geçişi aradaki adımları
      // yumuşatıyor.
      if (soluyor) sonrakiMs = 200;
      if (!Number.isFinite(sonrakiMs)) return; // hepsi kaybolmuş, iş kalmadı
      timer = window.setTimeout(uyan, Math.max(50, sonrakiMs));
    };
    uyan();

    return () => window.clearTimeout(timer);
  }, [hideAfterMs, fadeMs, messages]);

  return (
    <div className={`chat-list ${className}`} ref={listRef} onScroll={onScroll}>
      {messages.length === 0 && emptyText && <div className="chat-empty">{emptyText}</div>}
      {messages.map((m) => {
        const isEvent = highlightEvents && m.kind !== "chat";
        let leaving = false;
        let opacity = 1;
        if (hideAfterMs > 0) {
          const age = now - m.ts;
          const left = hideAfterMs - age;
          if (left <= 0) {
            opacity = 0;
            leaving = true;
          } else if (left < fadeMs) {
            opacity = Math.max(0, left / fadeMs);
            leaving = true;
          }
        }
        return (
          <div
            className={`chat-msg${isEvent ? " chat-msg-event" : ""}${leaving ? " chat-msg-leaving" : ""}`}
            key={m.key}
            style={hideAfterMs > 0 ? { opacity, transition: "opacity 0.2s linear" } : undefined}
          >
            {showTimestamps && <span className="chat-time">{hhmm(m.ts)}</span>}
            {showBadge && <PlatformLogo platform={m.platform} />}
            {showUserBadges && <Badges badges={m.badges} />}
            <span className="user" style={{ color: m.color }}>
              {sanitizePlainText(m.user)}
            </span>
            {isEvent && (
              <span className="chat-kind">{m.amount ? m.amount : kindLabel(m.kind)}</span>
            )}
            <span className="chat-text">
              <Parts parts={m.parts} fallback={sanitizePlainText(m.text)} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

function kindLabel(kind: ChatMessage["kind"]) {
  switch (kind) {
    case "superchat":
      return "Super Chat";
    case "sticker":
      return "Sticker";
    case "membership":
      return "Üyelik";
    case "sub":
      return "Abone";
    case "raid":
      return "Raid";
    case "follow":
      return "Takip";
    case "bits":
      return "Bits";
    default:
      return "";
  }
}
