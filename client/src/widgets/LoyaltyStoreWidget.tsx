/**
 * AxBoT Sadakat Mağazası bildirimi
 * Developed by AxthrowA
 *
 * Panelden tema, konum, süre, konfeti, ses ve gösterilecek alanlar ayarlanır.
 * Eski sürümde gösterim süresi ve renkler koda gömülüydü; ayrıca zaman
 * aşımları temizlenmediği için arka arkaya kullanılan iki ödül birbirinin
 * kartını erken kapatıyordu.
 */
import { kokOzellik } from '../lib/kabuklar.js';
import { ortakHareket } from '../lib/animations.js';
import { kutuTasarimi } from '../lib/widget-style.js';
import { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { LOYALTY_DEFAULTS } from '../lib/widget-defaults.js';
import { rgba, dikey, sayiYaz, onizlemeKipi, wsAdresi } from '../lib/widget-style.js';
import { KaliciSoket } from '../lib/kaliciSoket.js';

interface RedemptionEvent {
  user: string;
  rewardTitle: string;
  rewardType?: string;
  cost: number;
  payload?: string;
}

export interface LoyaltyStoreWidgetProps {
  embedded?: boolean;
  previewMode?: boolean;
}

const ORNEK: RedemptionEvent = {
  user: 'AxthrowA',
  rewardTitle: 'Şarkı İsteği',
  cost: 500,
  payload: 'Lofi Chill Beats'
};

export function LoyaltyStoreWidget({ embedded = false, previewMode = false }: LoyaltyStoreWidgetProps) {
  const s = useWidgetSettings('loyalty-redemptions', LOYALTY_DEFAULTS);
  const onizleme = onizlemeKipi(previewMode);
  const ayarRef = useRef(s);
  ayarRef.current = s;

  const [event, setEvent] = useState<RedemptionEvent | null>(onizleme ? ORNEK : null);
  const [visible, setVisible] = useState(onizleme);
  const gizleRef = useRef<NodeJS.Timeout | null>(null);
  const temizleRef = useRef<NodeJS.Timeout | null>(null);

  const goster = (data: RedemptionEvent) => {
    const a = ayarRef.current;
    setEvent(data);
    setVisible(true);

    if (a.confetti) {
      try {
        confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
      } catch {
        /* konfeti yoksa sorun değil */
      }
    }
    if (a.soundEnabled) {
      try {
        new Audio('/sounds/alert.mp3').play().catch(() => {});
      } catch {
        /* ses dosyası yok */
      }
    }

    if (gizleRef.current) clearTimeout(gizleRef.current);
    if (temizleRef.current) clearTimeout(temizleRef.current);
    gizleRef.current = setTimeout(() => {
      setVisible(false);
      temizleRef.current = setTimeout(() => setEvent(null), 500);
    }, Math.max(1000, Number(a.durationMs) || 6000));
  };

  useEffect(() => {
    if (onizleme) return;
    const ws = new KaliciSoket(wsAdresi());
    ws.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.type === 'loyalty_redeemed' && payload.data) goster(payload.data);
      } catch {
        /* bozuk mesaj */
      }
    };
    return () => {
      ws.close();
      if (gizleRef.current) clearTimeout(gizleRef.current);
      if (temizleRef.current) clearTimeout(temizleRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onizleme]);

  if (!event) return null;

  const tema = String(s.theme || 'card');
  const temaStili: Record<string, React.CSSProperties> = {
    card: {
      background: rgba(s.bgColor, s.bgOpacity),
      border: `2px solid ${s.borderColor}`,
      backdropFilter: 'blur(16px)',
      boxShadow: `0 15px 50px ${rgba(s.accentColor, 0.4)}`
    },
    banner: {
      background: `linear-gradient(90deg, ${rgba(s.accentColor, 0.4)}, ${rgba(s.bgColor, s.bgOpacity)})`,
      border: `1px solid ${rgba(s.borderColor, 0.5)}`
    },
    minimal: { background: 'transparent', border: 'none', boxShadow: 'none' },
    neon: {
      background: rgba(s.bgColor, s.bgOpacity),
      border: `2px solid ${s.accentColor}`,
      boxShadow: `0 0 28px ${rgba(s.accentColor, 0.7)}`
    },
    glass: {
      background: rgba(s.bgColor, Math.min(0.5, Number(s.bgOpacity) || 0.5)),
      border: `1px solid ${rgba('#ffffff', 0.22)}`,
      backdropFilter: 'blur(18px)'
    }
  };

  const boy = Number(s.fontSize) || 24;

  return (
    <div
      className={
        embedded
          ? 'w-full h-full bg-transparent p-0 flex justify-center select-none font-sans'
          : 'w-screen h-screen bg-transparent p-6 flex justify-center select-none font-sans'
      }
      style={{ alignItems: dikey(s.position), fontFamily: s.fontFamily }}
    >
      <div {...kokOzellik(s)}
        className={`transition-all duration-500 transform ${
          visible ? 'scale-100 opacity-100 translate-y-0' : 'scale-90 opacity-0 -translate-y-6'
        } flex flex-col items-center text-center`}
        style={{
          ...(kutuTasarimi(s) || temaStili[tema] || temaStili.card), ...(visible ? ortakHareket(s) : null),
          borderRadius: Number(s.radius) || 24,
          padding: `${Number(s.paddingY) || 24}px ${Number(s.paddingX) || 24}px`,
          maxWidth: Number(s.maxWidth) || 448,
          color: s.textColor
        }}
      >
        {s.showIcon && (
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-3 animate-bounce"
            style={{ background: rgba(s.accentColor, 0.2), border: `2px solid ${s.accentColor}` }}
          >
            {s.icon}
          </div>
        )}

        {s.showLabel && (
          <div
            className="font-mono font-bold tracking-widest uppercase mb-1"
            style={{ fontSize: Math.max(9, boy * 0.42), color: s.accentColor }}
          >
            {s.label}
          </div>
        )}

        <div className="font-black mb-1" style={{ fontSize: boy }}>
          {event.user}
        </div>

        <div
          className="font-bold px-4 py-1 rounded-full mb-2"
          style={{
            fontSize: boy * 0.72,
            color: s.accentColor,
            background: rgba(s.accentColor, 0.15),
            border: `1px solid ${rgba(s.accentColor, 0.4)}`
          }}
        >
          {event.rewardTitle}
          {s.showCost && ` (${sayiYaz(Number(event.cost) || 0)} ${s.pointsLabel})`}
        </div>

        {s.showPayload && event.payload && (
          <div
            className="font-medium italic p-2.5 rounded-xl w-full"
            style={{
              fontSize: Math.max(10, boy * 0.5),
              opacity: 0.85,
              background: rgba('#000000', 0.5),
              border: `1px solid ${rgba('#ffffff', 0.1)}`
            }}
          >
            “{event.payload}”
          </div>
        )}
      </div>
    </div>
  );
}

export default LoyaltyStoreWidget;
