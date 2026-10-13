/**
 * StreamAxT Event Labels
 * Developed by AxthrowA
 */
import { useEffect, useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { LABELS_DEFAULTS } from '../lib/widget-defaults.js';

export function EventLabelsWidget(_props?: { embedded?: boolean; previewMode?: boolean }) {
  const s = useWidgetSettings('event-labels', LABELS_DEFAULTS);
  const { lastMessage } = useWebSocket('all');
  const [lastFollower, setLastFollower] = useState('—');
  const [lastSub, setLastSub] = useState('—');
  const [lastTip, setLastTip] = useState('—');
  const [topTipper, setTopTipper] = useState('—');
  const [lastRaid, setLastRaid] = useState('—');
  const [topAmount, setTopAmount] = useState(0);

  useEffect(() => {
    if (!lastMessage) return;
    const ev = lastMessage.data || lastMessage.payload?.event || lastMessage.payload || {};
    const type = lastMessage.subType || ev?.event_type || lastMessage.type;
    const name = ev?.displayName || ev?.display_name || ev?.username || lastMessage.payload?.user?.displayName;
    if (type === 'follow' && name) setLastFollower(name);
    // 'sub' sunucunun gerçek abonelik türü — eskiden listede yoktu
    if ((type === 'sub' || type === 'subscription' || type === 'gifted_sub' || type === 'gift_sub') && name) setLastSub(name);
    if ((type === 'donation' || type === 'tip' || lastMessage.type === 'donation') && name) {
      const amount = Number(ev?.amount ?? lastMessage.payload?.amount ?? 0);
      const currency = ev?.currency || lastMessage.payload?.currency || 'TL';
      setLastTip(`${name} (${amount} ${currency})`);
      if (amount >= topAmount) {
        setTopAmount(amount);
        setTopTipper(`${name} (${amount} ${currency})`);
      }
    }
    if (type === 'raid' && name) setLastRaid(`${name} (${ev?.viewers || ''} izleyici)`);
  }, [lastMessage, topAmount]);

  const vars: Record<string, string> = { lastFollower, lastSub, lastTip, topTipper, lastRaid };
  let text = s.template || '';
  Object.entries(vars).forEach(([k, v]) => {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  });
  if (!s.showFollow) text = text.replace(/Son takip:[^|]*/gi, '');
  if (!s.showSub) text = text.replace(/Son abone:[^|]*/gi, '');
  if (!s.showTip) text = text.replace(/Son bağış:[^|]*/gi, '');
  if (!s.showTop) text = text.replace(/Top bağış:[^|]*/gi, '');
  if (!s.showRaid) text = text.replace(/Son raid:[^|]*/gi, '');

  const bg = `${s.backgroundColor}${Math.round(s.backgroundOpacity * 255).toString(16).padStart(2, '0')}`;
  const isMarquee = s.animation === 'marquee';

  return (
    <div style={{
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      background: bg,
      borderRadius: s.borderRadius,
      height: s.height,
      padding: `0 ${s.paddingX}px`,
      display: 'flex',
      alignItems: 'center'
    }}>
      <span className={isMarquee ? 'axt-marquee' : `axt-anim-${s.animation}`} style={{
        fontFamily: s.fontFamily,
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        color: s.fontColor,
        letterSpacing: s.letterSpacing,
        textTransform: s.textTransform as any,
        WebkitTextStroke: s.outlineEnabled ? `${s.outlineWidth}px ${s.outlineColor}` : undefined,
        animationDuration: isMarquee ? `${s.marqueeSpeed}s` : undefined
      }}>
        {text} {isMarquee ? text : ''}
      </span>
    </div>
  );
}

export default EventLabelsWidget;
