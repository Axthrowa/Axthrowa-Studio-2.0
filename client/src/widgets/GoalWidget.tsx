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
  // İlerleme sunucuda tutulur (modules/goals/hedefler.ts): gerçek olayda `current` ayarı artar ve ayar kanalıyla
  // gelir. Eskiden burada sayılıyordu: OBS yenilenince sıfırlanıyor, test ve "yeniden oynat" da sayılıyordu.
  // "Test et" kayıtlı değeri değiştirmez; birkaç saniye örnek artış gösterilir.
  const [testArtisi, setTestArtisi] = useState(0);
  const current = (Number(s.current) || 0) + testArtisi;
  const [reached, setReached] = useState(false);

  const islenen = useRef<unknown>(null);
  useEffect(() => {
    if (!lastMessage || islenen.current === lastMessage) return;
    islenen.current = lastMessage;
    if (lastMessage.type !== 'hedef_testi' || lastMessage.widgetId !== widgetId) return;
    setTestArtisi((v) => v + (Number(lastMessage.artis) || 1));
    // Temizlikte iptal edilmez: sonraki herhangi bir yayın zamanlayıcıyı iptal edip test artışını kalıcı yapardı
    setTimeout(() => setTestArtisi(0), 6000);
  }, [lastMessage, widgetId]);

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
  const barH = Math.max(6, Number(s.barHeight) || 20);
  const cerceve = Number(s.barBorderWidth) > 0 ? Number(s.barBorderWidth) : 0;
  // Simge barın ucunda, dolguyla birlikte ilerler; bar yüksekliğini biraz aşar ki küçük kalmasın.
  // Dolguyla aynı süre ve eğri: simge ucun önüne geçmez, arkasında kalmaz.
  const gecis = '0.9s cubic-bezier(.22,1,.36,1)';
  const simgeBoy = Math.max(24, Math.round((barH + cerceve * 2) * 1.5));
  const ucta = s.barIconPosition !== 'start';
  const simge = s.barIcon ? (
    <span
      style={{
        position: 'absolute',
        top: '50%',
        left: ucta ? `clamp(${simgeBoy / 2}px, ${percent}%, calc(100% - ${simgeBoy / 2}px))` : simgeBoy / 2,
        transform: 'translate(-50%, -50%)',
        transition: `left ${gecis}`,
        width: simgeBoy,
        height: simgeBoy,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(simgeBoy * 0.82),
        lineHeight: 1,
        filter: `drop-shadow(0 2px 3px rgba(0,0,0,.7))${s.showGlow ? ` drop-shadow(0 0 8px ${s.barColor})` : ''}`,
        zIndex: 1
      }}
    >
      {/* key: her artışta simge bir kez zıplar */}
      <span key={current} style={{ display: 'block', animation: 'axt-hedef-zipla .6s cubic-bezier(.34,1.56,.64,1)' }}>
        {s.barIcon}
      </span>
    </span>
  ) : null;
  const bar = (
    <div style={{ position: 'relative' }}>
      <div style={{
        height: s.barHeight,
        borderRadius: s.barRadius,
        background: s.barBackground,
        overflow: 'hidden',
        position: 'relative',
        border: cerceve > 0 ? `${cerceve}px solid ${s.barBorderColor}` : undefined,
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,.45)'
      }}>
        <div style={{
          height: '100%',
          width: `${percent}%`,
          ...dolgu,
          borderRadius: s.barRadius,
          boxShadow: s.showGlow ? `0 0 16px ${s.barColor}` : undefined,
          transition: `width ${gecis}`,
          animation: s.barStyle === 'striped' ? 'axt-hedef-cizgi 1s linear infinite' : undefined
        }} />
      </div>
      {simge}
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
      <style>{'@keyframes axt-hedef-cizgi { from { background-position: 0 0, 0 0 } to { background-position: 28px 0, 0 0 } } @keyframes axt-hedef-zipla { 0% { transform: scale(1) } 40% { transform: scale(1.35) translateY(-8%) } 100% { transform: scale(1) } }'}</style>
      {s.layout === 'text-below' ? <>{bar}{label}</> : <>{label}{bar}</>}
    </div>
  );
}

export default GoalWidget;
