/**
 * StreamAxT Chat Overlay
 * Developed by AxthrowA
 */
import { useEffect, useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { CHAT_DEFAULTS } from '../lib/widget-defaults.js';

interface OverlayMsg {
  id: string;
  platform: string;
  user: string;
  color: string;
  text: string;
  badges: string[];
  avatar?: string;
  ts: string;
  special?: boolean;
  created: number;
}

const PLATFORM_COLORS: Record<string, string> = { twitch: '#9146ff', kick: '#53fc18', youtube: '#ff0000', tiktok: '#fe2c55' };
const PLATFORM_ICONS: Record<string, string> = { twitch: '🟣', kick: '🟢', youtube: '🔴', tiktok: '🎵' };

export function ChatBoxWidget(_props?: { embedded?: boolean; previewMode?: boolean }) {
  const s = useWidgetSettings('chat-overlay', CHAT_DEFAULTS);
  const { lastMessage } = useWebSocket('chatbox');
  const [messages, setMessages] = useState<OverlayMsg[]>([]);

  useEffect(() => {
    if (!lastMessage || lastMessage.type !== 'chat') return;
    const p = lastMessage.data || lastMessage.payload;
    const user = p.user;
    const username = (user?.username || '').toLowerCase();
    const ignored = (s.ignoreList || '').split(',').map((x: string) => x.trim().toLowerCase()).filter(Boolean);
    if (ignored.includes(username)) return;
    if (s.hideCommands && (p.message || '').trim().startsWith('!')) return;
    if (s.hideBots && (user?.isBot || username.includes('bot'))) return;
    if (s.hideBroadcaster && user?.isBroadcaster) return;
    if (s.hideEmoteOnly && !p.message?.replace(/:\w+:/g, '').trim()) return;

    const badges: string[] = [];
    if (user?.isMod) badges.push('🛡️');
    if (user?.isSub) badges.push('⭐');
    if (user?.isVip) badges.push('💎');
    if (user?.isBroadcaster) badges.push('👑');

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
        badges,
        avatar: user?.avatar,
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

  const list = s.reverse ? [...messages].reverse() : messages;
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
          {s.showPlatformLogo && <span>{PLATFORM_ICONS[msg.platform] || '💬'}</span>}
          {s.showTimestamp && <span style={{ color: '#64748b', fontSize: s.fontSize * 0.65, marginTop: 4 }}>{msg.ts}</span>}
          {s.showBadges && msg.badges.map(b => <span key={b}>{b}</span>)}
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
            {msg.text}
          </p>
        </div>
      ))}
    </div>
  );
}

export default ChatBoxWidget;
