/**
 * StreamAxT Chat Overlay
 * Developed by AxthrowA
 */
import { useEffect, useRef, useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { CHAT_DEFAULTS } from '../lib/widget-defaults.js';
import { ChatMessageContent } from '../components/ChatMessageContent.js';
import { PlatformLogo } from '../components/PlatformLogo.js';
import { PlatformBadges } from '../components/PlatformBadge.js';

interface OverlayMsg {
  id: string;
  platform: string;
  user: string;
  color: string;
  text: string;
  /** Platformun gönderdiği rozet ve rol bilgisi (özgün rozet görselleri için) */
  rozet: { rawBadges?: any[]; badges?: string[]; isBroadcaster?: boolean; isMod?: boolean; isVip?: boolean; isSub?: boolean };
  avatar?: string;
  ts: string;
  special?: boolean;
  created: number;
}

const PLATFORM_COLORS: Record<string, string> = { twitch: '#9146ff', kick: '#53fc18', youtube: '#ff0000', tiktok: '#fe2c55' };

/**
 * Önizleme örnekleri: stüdyo tuvali ve OBS test kipi boş bir kutu yerine
 * gerçek bileşenin bu ayarlarla NASIL görüneceğini göstersin.
 */
const ORNEK_MESAJLAR: OverlayMsg[] = [
  { id: 'o1', platform: 'kick', user: 'Kaan', color: '#53fc18', text: 'Selamlar! Harika yayın oluyor.', rozet: { isMod: true }, ts: '14:22', special: true, created: 0 },
  { id: 'o2', platform: 'twitch', user: 'Ayse', color: '#f59e0b', text: 'Boss savaşında bol şans 🔥', rozet: { isSub: true }, ts: '14:23', special: true, created: 0 },
  { id: 'o3', platform: 'youtube', user: 'Murat', color: '#f87171', text: '!ses alkış', rozet: {}, ts: '14:24', created: 0 }
];

export function ChatBoxWidget(props?: { embedded?: boolean; previewMode?: boolean }) {
  const s = useWidgetSettings('chat-overlay', CHAT_DEFAULTS);
  const { lastMessage } = useWebSocket('chatbox');
  const [messages, setMessages] = useState<OverlayMsg[]>([]);
  /** Bu etki ayar (`s`) değişince de çalışır: aynı ileti İKİNCİ KEZ eklenmesin. */
  const islenen = useRef<unknown>(null);

  useEffect(() => {
    if (!lastMessage || lastMessage.type !== 'chat') return;
    if (islenen.current === lastMessage) return;
    islenen.current = lastMessage;
    const p = lastMessage.data || lastMessage.payload;
    // Ortak kara listedeki kullanıcının ve kalkana takılan mesaj yayında gösterilmez
    if (!p || p.karaListede || p.kalkanda) return;
    const user = p.user;
    const username = (user?.username || '').toLowerCase();
    const ignored = (s.ignoreList || '').split(',').map((x: string) => x.trim().toLowerCase()).filter(Boolean);
    if (ignored.includes(username)) return;
    if (s.hideCommands && (p.message || '').trim().startsWith('!')) return;
    if (s.hideBots && (user?.isBot || username.includes('bot'))) return;
    if (s.hideBroadcaster && user?.isBroadcaster) return;
    // Kick emote'u `[emote:123:ad]` biçiminde gelir; eski `:ad:` deseni onu tanımıyordu
    if (s.hideEmoteOnly && !String(p.message || '').replace(/\[emote:\d+:[^\]]+\]|:\w+:/g, '').trim()) return;

    // Rozetler emoji yerine platformun ÖZGÜN rozetleriyle çizilir (PlatformBadges)
    const rozet = {
      rawBadges: Array.isArray(user?.rawBadges) ? user.rawBadges : [],
      badges: Array.isArray(user?.badges) ? user.badges : [],
      isBroadcaster: Boolean(user?.isBroadcaster),
      isMod: Boolean(user?.isMod),
      isVip: Boolean(user?.isVip),
      isSub: Boolean(user?.isSub)
    };

    const color = s.usernameColorMode === 'platform'
      ? (PLATFORM_COLORS[p.platform] || '#fff')
      : s.usernameColorMode === 'custom'
        ? s.customUsernameColor
        : (user?.color || PLATFORM_COLORS[p.platform] || '#fff');

    setMessages(prev => {
      const next: OverlayMsg = {
        id: `${Date.now()}-${Math.random()}`,
        platform: p.platform,
        user: user?.displayName || user?.username || 'anon',
        color,
        text: p.message,
        rozet,
        // Sunucu yükü `avatarUrl` taşır; eski `avatar` alanı hiç dolu gelmiyordu
        avatar: user?.avatarUrl || user?.avatar,
        ts: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        special: Boolean(user?.isSub || user?.isMod || user?.isBroadcaster),
        created: Date.now()
      };
      const list = s.reverse ? [next, ...prev] : [...prev, next];
      return list.slice(-s.maxMessages);
    });
  }, [lastMessage, s]);

  useEffect(() => {
    if (!s.fadeMessages) return;
    const t = setInterval(() => {
      const cutoff = Date.now() - s.fadeTimeout * 1000;
      setMessages(prev => prev.filter(m => m.created > cutoff));
    }, 1000);
    return () => clearInterval(t);
  }, [s.fadeMessages, s.fadeTimeout]);

  const kaynak = props?.previewMode && messages.length === 0 ? ORNEK_MESAJLAR : messages;
  const list = s.reverse ? [...kaynak].reverse() : kaynak;
  const msgBg = s.messageBgColor.length === 7
    ? `${s.messageBgColor}${Math.round(s.messageBgOpacity * 255).toString(16).padStart(2, '0')}`
    : 'transparent';

  return (
    <div className="flex flex-col justify-end gap-1 p-4 h-full" style={{
      fontFamily: s.fontFamily,
      gap: s.gap,
      background: s.transparentBg ? 'transparent' : '#0a0a0a',
      maskImage: s.smoothMask ? 'linear-gradient(to bottom, transparent 0%, black 18%)' : undefined
    }}>
      {list.map(msg => (
        <div key={msg.id} className={`axt-anim-${s.animation} flex items-start`} style={{
          gap: 8,
          justifyContent: s.align === 'center' ? 'center' : s.align === 'right' ? 'flex-end' : 'flex-start',
          background: s.transparentBg ? 'transparent' : msgBg,
          borderRadius: s.borderRadius,
          padding: s.transparentBg ? 0 : '6px 10px',
          borderLeft: s.highlightSpecial && msg.special ? `3px solid ${s.highlightColor}` : undefined,
          textShadow: s.textShadow ? '0 2px 8px #000' : undefined
        }}>
          {s.showAvatars && msg.avatar && (
            <img src={msg.avatar} alt="" style={{ width: 22, height: 22, borderRadius: '50%', marginTop: 2 }} />
          )}
          {s.showPlatformLogo && (
            <span style={{ color: PLATFORM_COLORS[msg.platform] || '#cbd5e1', display: 'inline-flex', marginTop: 3, flexShrink: 0 }} title={msg.platform}>
              <PlatformLogo platform={msg.platform} size={Math.round(Number(s.fontSize) * 0.95) || 16} />
            </span>
          )}
          {s.showTimestamp && <span style={{ color: '#64748b', fontSize: s.fontSize * 0.65, marginTop: 4 }}>{msg.ts}</span>}
          {s.showBadges && (
            <span style={{ display: 'inline-flex', gap: 3, marginTop: 2, flexShrink: 0 }}>
              <PlatformBadges platform={msg.platform as any} user={msg.rozet as any} size={Math.round(Number(s.fontSize) * 1.05) || 18} />
            </span>
          )}
          <p style={{
            fontSize: s.fontSize,
            fontWeight: s.fontWeight,
            lineHeight: s.lineHeight,
            letterSpacing: s.letterSpacing,
            color: s.textColor,
            textAlign: s.align as any,
            WebkitTextStroke: s.outlineEnabled ? `${s.outlineWidth}px ${s.outlineColor}` : undefined
          }}>
            <span style={{ color: msg.color, fontWeight: 800 }}>{msg.user}: </span>
            <ChatMessageContent message={msg.text} size={Math.round(Number(s.fontSize) * 1.3) || 24} />
          </p>
        </div>
      ))}
    </div>
  );
}

export default ChatBoxWidget;
