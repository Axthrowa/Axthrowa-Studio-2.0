/**
 * StreamAxT Goal overlay — donation / follower / sub / kicks
 * Developed by AxthrowA
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import type { GOAL_DEFAULTS } from '../lib/widget-defaults.js';

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

/** Çubuk dolgusu: düz, iki renk geçişi, akan çizgili ya da üstten parlak */
export function dolguArkaPlani(stil: string, renk: string, renk2: string): CSSProperties {
  if (stil === 'gradient') return { background: `linear-gradient(90deg, ${renk}, ${renk2})` };
  if (stil === 'striped')
    return {
      background: `repeating-linear-gradient(45deg, rgba(255,255,255,.22) 0 7px, transparent 7px 14px), linear-gradient(90deg, ${renk}, ${renk2})`,
      backgroundSize: '28px 100%, 100% 100%'
    };
  if (stil === 'glossy') return { background: `linear-gradient(180deg, rgba(255,255,255,.45), rgba(255,255,255,0) 55%), linear-gradient(90deg, ${renk}, ${renk2})` };
  return { background: renk };
}

export function GoalWidget(props?: { embedded?: boolean; previewMode?: boolean; widgetId?: string }) {
  // Tek tuvalde (/widgets/overlay) adres hedef türünü söylemez; tür yerleşim
  // ayarından gelir. Eskiden burada hep "donation-goal" seçiliyordu, stüdyo ise
  // "follower-goal" ayarlarını düzenliyordu: değişiklik OBS'e hiç yansımıyordu.
  const widgetId = props?.widgetId || widgetIdFromPath();
  // Varsayılanlar türe özgü kayıttan gelir (WIDGET_DEFAULTS). Genel
  // GOAL_DEFAULTS onların ÜSTÜNE yazılınca takipçi hedefi bağışları sayıyordu.
  const s = useWidgetSettings<typeof GOAL_DEFAULTS & Record<string, any>>(widgetId);
  const { lastMessage } = useWebSocket('all');
  const [current, setCurrent] = useState(Number(s.current) || 0);
  const [reached, setReached] = useState(false);

  useEffect(() => {
    setCurrent(Number(s.current) || 0);
  }, [s.current]);

  const islenen = useRef<unknown>(null);
  useEffect(() => {
    if (!lastMessage) return;
    // Etki hedef türü değişince de çalışır: aynı olay ikinci kez sayılmasın
    if (islenen.current === lastMessage) return;
    islenen.current = lastMessage;
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
    // Binlik ayırıcı: 46700 → 46.700 (uzun sayılar bir bakışta okunsun)
    const val = n.toLocaleString('tr-TR', { minimumFractionDigits: s.decimals > 0 ? s.decimals : 0, maximumFractionDigits: s.decimals > 0 ? s.decimals : 0 });
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
    WebkitTextStroke: s.outlineEnabled ? `${s.outlineWidth}px ${s.outlineColor}` : undefined,
    paintOrder: 'stroke fill',
    textShadow: s.textShadow !== false ? '0 2px 3px rgba(0,0,0,.95), 0 0 8px rgba(0,0,0,.75), 0 0 1px #000' : undefined
  };

  const dolgu = dolguArkaPlani(s.barStyle, s.barColor, s.barColor2);
  // Simge rozeti: barla aynı renk ve çerçevede, barın biraz üstüne taşan yuvarlak (eskiden çıplak emoji
  // dolgunun ucuna binip çubukla uyumsuz, sonradan eklenmiş gibi duruyordu)
  const barH = Math.max(6, Number(s.barHeight) || 20);
  const cerceve = Number(s.barBorderWidth) > 0 ? Number(s.barBorderWidth) : 0;
  const rozetBoy = Math.max(26, Math.round(barH + cerceve * 2 + 12));
  const ikinciRenk = s.barStyle === 'gradient' || s.barStyle === 'glossy' ? s.barColor2 || s.barColor : s.barColor;
  const ucta = s.barIconPosition === 'tip';
  const rozet = s.barIcon ? (
    <span
      style={{
        width: rozetBoy,
        height: rozetBoy,
        flexShrink: 0,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(rozetBoy * 0.56),
        lineHeight: 1,
        background: `radial-gradient(circle at 35% 30%, ${s.barColor}, ${ikinciRenk})`,
        border: `${Math.max(2, cerceve)}px solid ${cerceve > 0 ? s.barBorderColor : 'rgba(255,255,255,.85)'}`,
        boxShadow: `0 2px 8px rgba(0,0,0,.55)${s.showGlow ? `, 0 0 14px ${ikinciRenk}` : ''}`,
        zIndex: 1,
        ...(ucta
          ? {
              position: 'absolute' as const,
              top: '50%',
              left: `clamp(${rozetBoy / 2}px, ${percent}%, calc(100% - ${rozetBoy / 2}px))`,
              transform: 'translate(-50%, -50%)',
              transition: 'left 0.6s ease'
            }
          : { marginRight: -Math.round(rozetBoy * 0.35) })
      }}
    >
      {s.barIcon}
    </span>
  ) : null;
  const bar = (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      {!ucta && rozet}
      <div style={{ position: 'relative', flex: 1 }}>
      <div style={{
        height: s.barHeight,
        borderRadius: s.barRadius,
        background: s.barBackground,
        overflow: 'hidden',
        position: 'relative',
        border: Number(s.barBorderWidth) > 0 ? `${s.barBorderWidth}px solid ${s.barBorderColor}` : undefined,
        boxShadow: Number(s.barBorderWidth) > 0 ? `0 0 10px ${s.barBorderColor}55` : undefined
      }}>
        <div style={{
          height: '100%',
          width: `${percent}%`,
          ...dolgu,
          borderRadius: s.barRadius,
          boxShadow: s.showGlow ? `0 0 16px ${s.barColor}` : undefined,
          transition: 'width 0.6s ease',
          animation: s.barStyle === 'striped' ? 'axt-hedef-cizgi 1s linear infinite' : undefined
        }} />
      </div>
      {ucta && rozet}
      </div>
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
    <div className={`axt-anim-${s.animation}`} style={{ background: Number(s.backgroundOpacity) === 0 ? 'transparent' : bg, borderRadius: s.borderRadius, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <style>{'@keyframes axt-hedef-cizgi { from { background-position: 0 0, 0 0 } to { background-position: 28px 0, 0 0 } }'}</style>
      {s.layout === 'text-below' ? <>{bar}{label}</> : <>{label}{bar}</>}
    </div>
  );
}

export default GoalWidget;
