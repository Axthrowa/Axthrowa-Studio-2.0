/**
 * StreamAxT Shoutout widget
 * Developed by AxthrowA
 *
 * Panelden tema, konum, süre, konfeti ve gösterilecek alanlar ayarlanır.
 * Eski sürümde gösterim süresi (8 sn), kart rengi ve "kick.com/" öneki koda
 * gömülüydü; zaman aşımı temizlenmediği için arka arkaya gelen iki shoutout
 * birbirinin sayacını bozuyordu.
 */
import { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { SHOUTOUT_DEFAULTS } from '../lib/widget-defaults.js';
import { rgba, dikey, onizlemeKipi, wsAdresi, kartTasarimlari } from '../lib/widget-style.js';
import { KaliciSoket } from '../lib/kaliciSoket.js';

interface ShoutoutData {
  channel: string;
  platform: string;
  avatarUrl?: string;
  bio?: string;
  /** Yayında oynadığı ya da son oynadığı oyun */
  oyun?: string;
}

export interface ShoutoutWidgetProps {
  embedded?: boolean;
  previewMode?: boolean;
}

export function ShoutoutWidget({ embedded = false, previewMode = false }: ShoutoutWidgetProps) {
  const s = useWidgetSettings('shoutout', SHOUTOUT_DEFAULTS);
  const onizleme = onizlemeKipi(previewMode);
  const [so, setSo] = useState<ShoutoutData | null>(null);
  const [visible, setVisible] = useState(false);
  const ayarRef = useRef(s);
  ayarRef.current = s;
  const gizleRef = useRef<NodeJS.Timeout | null>(null);
  const temizleRef = useRef<NodeJS.Timeout | null>(null);

  const triggerSO = (data: ShoutoutData) => {
    const a = ayarRef.current;
    setSo(data);
    setVisible(true);
    if (a.confetti) {
      try {
        confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
      } catch {
        /* konfeti yoksa sorun değil */
      }
    }
    // Önceki shoutout'un sayaçları temizlenmezse kart erken kapanıyordu.
    if (gizleRef.current) clearTimeout(gizleRef.current);
    if (temizleRef.current) clearTimeout(temizleRef.current);
    gizleRef.current = setTimeout(() => {
      setVisible(false);
      temizleRef.current = setTimeout(() => setSo(null), 500);
    }, Math.max(1000, Number(a.durationMs) || 8000));
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (onizleme || params.has('channel')) {
      triggerSO({
        channel: params.get('channel') || 'StreamAxT',
        platform: params.get('platform') || 'kick',
        avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80'
      });
    }

    const ws = new KaliciSoket(wsAdresi());
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'shoutout' && payload.data) triggerSO(payload.data);
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

  if (!so) return null;

  const tema = String(s.theme || 'card');
  const temaStili: Record<string, React.CSSProperties> = {
    card: {
      background: rgba(s.bgColor, s.bgOpacity),
      border: `2px solid ${rgba(s.borderColor, 0.7)}`,
      backdropFilter: 'blur(16px)',
      boxShadow: `0 15px 45px ${rgba(s.accentColor, 0.5)}`
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
  const avatar = Number(s.avatarSize) || 80;

  return (
    <div
      className={
        embedded
          ? 'w-full h-full bg-transparent p-0 flex justify-center select-none font-sans'
          : 'w-screen h-screen bg-transparent p-8 flex justify-center select-none font-sans'
      }
      style={{ alignItems: dikey(s.position), fontFamily: s.fontFamily }}
    >
      <div
        className={`transition-all duration-500 transform ${
          visible ? 'scale-100 opacity-100 translate-y-0' : 'scale-90 opacity-0 -translate-y-8'
        } flex items-center gap-5 w-full`}
        style={{
          ...(temaStili[tema] || kartTasarimlari(s)[tema] || temaStili.card),
          borderRadius: Number(s.radius) || 24,
          padding: `${Number(s.paddingY) || 24}px ${Number(s.paddingX) || 24}px`,
          maxWidth: Number(s.maxWidth) || 512,
          color: s.textColor,
          // Kapsül ve kompakt tasarım köşe/boşluğu kendisi belirler
          ...(tema === 'capsule' || tema === 'compact' ? kartTasarimlari(s)[tema] : {})
        }}
      >
        {s.showAvatar && (
          <div
            className="rounded-2xl overflow-hidden flex-shrink-0 shadow-lg flex items-center justify-center"
            style={{
              width: avatar,
              height: avatar,
              background: rgba(s.accentColor, 0.25),
              border: `2px solid ${rgba('#ffffff', 0.2)}`
            }}
          >
            {so.avatarUrl ? (
              <img src={so.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span style={{ fontSize: avatar * 0.4 }}>🎮</span>
            )}
          </div>
        )}

        <div className="flex-1 min-w-0">
          {s.showLabel && (
            <div
              className="font-mono font-bold tracking-widest uppercase mb-0.5"
              style={{ fontSize: Math.max(9, boy * 0.42), color: s.accentColor }}
            >
              📢 {s.label}
            </div>
          )}

          <div className="font-black truncate" style={{ fontSize: boy }}>
            @{so.channel}
          </div>

          {so.oyun && (
            <div className="font-bold truncate" style={{ fontSize: Math.max(10, boy * 0.5), color: s.accentColor, marginTop: 2 }}>
              🎮 {so.oyun}
            </div>
          )}

          {s.showBio && (
            <div style={{ fontSize: Math.max(10, boy * 0.5), opacity: 0.78, marginTop: 4 }}>
              {so.bio || s.defaultBio}
            </div>
          )}

          {s.showUrl && (
            <div
              className="font-mono font-bold"
              style={{ fontSize: Math.max(10, boy * 0.46), color: s.accentColor, marginTop: 8 }}
            >
              👉 {s.urlPrefix}
              {so.channel}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ShoutoutWidget;
