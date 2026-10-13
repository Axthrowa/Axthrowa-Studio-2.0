/**
 * StreamAxT Goal overlay — donation / follower / sub / kicks
 * Developed by AxthrowA
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { GOAL_DEFAULTS } from '../lib/widget-defaults.js';

function widgetIdFromPath() {
  const params = new URLSearchParams(window.location.search);
  const type = params.get('type');
  if (type === 'follower') return 'follower-goal';
  if (type === 'sub') return 'subscriber-goal';
  if (type === 'kicks') return 'kicks-goal';
  if (type === 'tip' || type === 'donation') return 'donation-goal';
  const path = window.location.pathname;
  if (path.includes('follower-goal')) return 'follower-goal';
  if (path.includes('subscriber-goal')) return 'subscriber-goal';
  if (path.includes('kicks-goal')) return 'kicks-goal';
  return 'donation-goal';
}

export function GoalWidget(_props?: { embedded?: boolean; previewMode?: boolean }) {
  const widgetId = widgetIdFromPath();
  const s = useWidgetSettings(widgetId, GOAL_DEFAULTS as any);
  const { lastMessage } = useWebSocket('all');
  const [current, setCurrent] = useState(Number(s.current) || 0);
  const [reached, setReached] = useState(false);

  useEffect(() => {
    setCurrent(Number(s.current) || 0);
  }, [s.current]);

  useEffect(() => {
    if (!lastMessage) return;
    const ev = lastMessage.data || lastMessage.payload?.event || lastMessage.payload || {};
    const type = lastMessage.subType || ev?.event_type || lastMessage.type;
    const amount = Number(ev?.amount ?? lastMessage.payload?.amount ?? 0);
    if ((s.type === 'tip' || s.type === 'donation') && (type === 'donation' || type === 'tip' || lastMessage.type === 'donation')) {
      setCurrent(v => v + (amount || 0));
    }
    if (s.type === 'follower' && type === 'follow') setCurrent(v => v + 1);
    // Sunucunun abonelik uyarı türü 'sub'; eskiden listede yoktu ve normal
    // abonelikler hedefe HİÇ eklenmiyordu. Hediye paketi adediyle sayılır.
    if (s.type === 'sub' && (type === 'sub' || type === 'subscription')) setCurrent(v => v + 1);
    if (s.type === 'sub' && (type === 'gift_sub' || type === 'gifted_sub')) {
      setCurrent(v => v + Math.max(1, Number(ev?.count) || 1));
    }
    if (s.type === 'kicks' && type === 'kicks') setCurrent(v => v + (amount || 1));
  }, [lastMessage, s.type]);

  const percent = Math.min(100, (current / Math.max(1, Number(s.target))) * 100);
  useEffect(() => {
    if (percent >= 100) setReached(true);
  }, [percent]);

  const fmt = (n: number) => {
    const val = s.decimals > 0 ? n.toFixed(s.decimals) : Math.floor(n).toString();
    return `${s.prefix || ''}${val}${s.suffix || (s.currency ? ' ' + s.currency : '')}`;
  };

  const bg = s.backgroundColor?.length === 7
    ? `${s.backgroundColor}${Math.round((s.backgroundOpacity ?? 0.85) * 255).toString(16).padStart(2, '0')}`
    : '#0a0a0acc';

  const textStyle: CSSProperties = {
    fontFamily: s.fontFamily,
    fontSize: s.fontSize,
    fontWeight: s.fontWeight,
    color: s.fontColor,
    letterSpacing: s.letterSpacing,
    textTransform: s.textTransform as any,
    WebkitTextStroke: s.outlineEnabled ? `${s.outlineWidth}px ${s.outlineColor}` : undefined
  };

  const bar = (
    <div style={{ height: s.barHeight, borderRadius: s.barRadius, background: s.barBackground, overflow: 'hidden', position: 'relative' }}>
      <div style={{
        height: '100%',
        width: `${percent}%`,
        background: s.barColor,
        borderRadius: s.barRadius,
        boxShadow: s.showGlow ? `0 0 16px ${s.barColor}` : undefined,
        transition: 'width 0.6s ease'
      }} />
    </div>
  );

  const label = (
    <div className="flex justify-between" style={textStyle}>
      <span>{reached ? s.endingTitle : s.title}</span>
      <span>
        {fmt(current)} / {fmt(Number(s.target))}
        {s.showPercent ? `  (${percent.toFixed(0)}%)` : ''}
        {s.showRemaining ? `  · kalan ${fmt(Math.max(0, Number(s.target) - current))}` : ''}
      </span>
    </div>
  );

  return (
    <div className={`axt-anim-${s.animation}`} style={{ background: bg, borderRadius: s.borderRadius, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {s.layout === 'text-below' ? <>{bar}{label}</> : <>{label}{bar}</>}
    </div>
  );
}

export default GoalWidget;
