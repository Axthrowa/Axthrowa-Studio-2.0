/**
 * StreamAxT Activity Feed overlay
 * Developed by AxthrowA
 */
import { useEffect, useRef, useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { ACTIVITY_DEFAULTS } from '../lib/widget-defaults.js';

interface FeedItem {
  id: string;
  type: string;
  icon: string;
  text: string;
  time: string;
}

const TYPE_MAP: Record<string, string> = {
  follow: 'showFollow',
  subscription: 'showSub',
  gifted_sub: 'showGiftSub',
  gift_sub: 'showGiftSub',
  donation: 'showTip',
  tip: 'showTip',
  raid: 'showRaid',
  host: 'showHost',
  kicks: 'showKicks',
  bits: 'showBits'
};

function tpl(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

export function ActivityFeedWidget() {
  const s = useWidgetSettings('activity-feed', ACTIVITY_DEFAULTS);
  const { lastMessage } = useWebSocket('all');
  const [items, setItems] = useState<FeedItem[]>([]);

  const islenen = useRef<unknown>(null);
  useEffect(() => {
    if (!lastMessage || s.paused) return;
    // Etki ayar (`s`) değişince de çalışır: aynı ileti ikinci kez sayılmasın
    if (islenen.current === lastMessage) return;
    islenen.current = lastMessage;
    const ev = lastMessage.data || lastMessage.payload?.event || lastMessage.payload || {};
    const type = lastMessage.subType || ev?.event_type || (lastMessage.type === 'alert' ? lastMessage.subType : lastMessage.type);
    const flag = TYPE_MAP[type];
    if (!flag || !(s as any)[flag]) return;

        const user = ev?.displayName || ev?.display_name || ev?.username || lastMessage.payload?.user?.displayName || 'Biri';
    const amount = ev?.amount ?? lastMessage.payload?.amount ?? '';
    const currency = ev?.currency || lastMessage.payload?.currency || 'TL';
    const viewers = ev?.viewers ?? lastMessage.payload?.viewers ?? '';
    const count = ev?.count ?? lastMessage.payload?.count ?? amount;
    const icons: Record<string, string> = {
      follow: s.iconFollow, subscription: s.iconSub, gifted_sub: s.iconGiftSub || s.iconSub,
      gift_sub: s.iconGiftSub || s.iconSub, donation: s.iconTip, tip: s.iconTip, raid: s.iconRaid,
      host: s.iconHost, kicks: s.iconKicks, bits: s.iconTip
    };
    const templates: Record<string, string> = {
      follow: s.templateFollow, subscription: s.templateSub, gifted_sub: s.templateGiftSub,
      gift_sub: s.templateGiftSub, donation: s.templateTip, tip: s.templateTip, raid: s.templateRaid,
      host: s.templateHost, kicks: s.templateKicks, bits: s.templateKicks
    };
    const text = tpl(templates[type] || '{user}', { user, amount, currency, viewers, count });
    setItems(prev => {
      const next = { id: `${Date.now()}`, type, icon: icons[type] || '✨', text, time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) };
      const list = s.newestFirst ? [next, ...prev] : [...prev, next];
      return list.slice(0, s.maxItems);
    });
    if (s.soundEnabled && s.soundUrl && !s.mute) {
      const a = new Audio(s.soundUrl);
      a.volume = s.soundVolume;
      a.play().catch(() => {});
    }
  }, [lastMessage, s]);

  const bg = s.backgroundColor.length === 7
    ? `${s.backgroundColor}${Math.round(s.backgroundOpacity * 255).toString(16).padStart(2, '0')}`
    : s.backgroundColor;

  if (s.hideEmpty && items.length === 0) return null;

  return (
    <div style={{
      fontFamily: s.fontFamily,
      background: bg,
      borderRadius: s.borderRadius,
      border: `1px solid ${s.borderColor}`,
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: s.gap,
      minHeight: 80
    }}>
      {items.length === 0 && (
        <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 12 }}>Henüz aktivite yok</div>
      )}
      {items.map(item => (
        <div key={item.id} className={`axt-anim-${s.animation}`} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: s.fontSize,
          fontWeight: s.fontWeight,
          color: s.fontColor,
          letterSpacing: s.letterSpacing,
          WebkitTextStroke: s.outlineEnabled ? `${s.outlineWidth}px ${s.outlineColor}` : undefined,
          animationDuration: `${s.animationDuration}ms`
        }}>
          {s.showIcons && <span>{item.icon}</span>}
          <span style={{ flex: 1 }}>{item.text}</span>
          {s.showTimestamp && <span style={{ opacity: 0.45, fontSize: 11 }}>{item.time}</span>}
        </div>
      ))}
    </div>
  );
}

export default ActivityFeedWidget;
