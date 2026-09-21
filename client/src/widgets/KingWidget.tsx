/**
 * StreamAxT Yayın Kralı widget
 * Developed by AxthrowA
 *
 * Panelden tema, renkler, avatar boyutu ve gösterilecek alanlar ayarlanır.
 * Eski sürümde WebSocket adresi 3001'e sabitti (portu değişen kurulumda hiç
 * bağlanmıyordu), yeniden bağlanma zamanlayıcısı temizlenmediği için widget
 * kapansa da arkada çalışmaya devam ediyordu ve taht boşken bile "Yayıncı"
 * yazan sahte bir kral görünüyordu.
 */
import { useState, useEffect, useRef } from 'react';
import { Crown, Sparkles, Timer } from 'lucide-react';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { KING_DEFAULTS } from '../lib/widget-defaults.js';
import { rgba, sayiYaz, onizlemeKipi, wsAdresi } from '../lib/widget-style.js';

interface KingState {
  currentKing: string;
  displayName: string;
  avatarUrl?: string;
  pointsBid: number;
  crownTime?: number;
  reignSeconds?: number;
  title?: string;
}

export interface KingWidgetProps {
  embedded?: boolean;
  previewMode?: boolean;
}

/** Saltanat süresini insan diline çevirir. */
export function saltanatYaz(toplamSaniye: number): string {
  const t = Math.max(0, Math.floor(Number(toplamSaniye) || 0));
  const dk = Math.floor(t / 60);
  if (dk >= 60) return `${Math.floor(dk / 60)}s ${dk % 60}d`;
  return `${dk}d ${t % 60}s`;
}

const ORNEK: KingState = {
  currentKing: 'axthrowa',
  displayName: 'AxthrowA',
  pointsBid: 2500,
  reignSeconds: 754
};

export function KingWidget({ embedded = false, previewMode = false }: KingWidgetProps) {
  const s = useWidgetSettings('king', KING_DEFAULTS);
  const onizleme = onizlemeKipi(previewMode);
  const [king, setKing] = useState<KingState | null>(onizleme ? ORNEK : null);
  const [seconds, setSeconds] = useState(onizleme ? 754 : 0);
  const kapaliRef = useRef(false);

  useEffect(() => {
    if (onizleme) return;
    kapaliRef.current = false;
    let ws: WebSocket | null = null;
    let yenidenBaglan: NodeJS.Timeout | null = null;

    fetch('/api/king')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.displayName) {
          setKing(d);
          setSeconds(Number(d.reignSeconds) || 0);
        }
      })
      .catch(() => {});

    const connect = () => {
      if (kapaliRef.current) return;
      ws = new WebSocket(wsAdresi());
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'king_update' && data.state) {
            setKing(data.state);
            setSeconds(Number(data.state.reignSeconds) || 0);
          }
          if (data.type === 'king_cleared') {
            setKing(null);
            setSeconds(0);
          }
        } catch {
          /* bozuk mesaj */
        }
      };
      ws.onclose = () => {
        if (!kapaliRef.current) yenidenBaglan = setTimeout(connect, 3000);
      };
    };
    connect();

    const timer = setInterval(() => setSeconds((p) => p + 1), 1000);

    return () => {
      kapaliRef.current = true;
      if (yenidenBaglan) clearTimeout(yenidenBaglan);
      ws?.close();
      clearInterval(timer);
    };
  }, [onizleme]);

  if (!king && s.hideWhenEmpty) return null;
  if (!king) return null;

  const tema = String(s.theme || 'royal');
  const temaStili: Record<string, React.CSSProperties> = {
    royal: {
      background: `linear-gradient(90deg, ${rgba(s.bgColor, s.bgOpacity)}, ${rgba('#000000', 0.8)}, ${rgba(
        s.bgColor,
        s.bgOpacity
      )})`,
      border: `2px solid ${rgba(s.borderColor, 0.6)}`,
      boxShadow: `0 0 25px ${rgba(s.accentColor, 0.35)}`,
      backdropFilter: 'blur(8px)'
    },
    minimal: { background: 'transparent', border: 'none', boxShadow: 'none' },
    glass: {
      background: rgba(s.bgColor, Math.min(0.5, Number(s.bgOpacity) || 0.5)),
      border: `1px solid ${rgba('#ffffff', 0.2)}`,
      backdropFilter: 'blur(14px)'
    },
    neon: {
      background: rgba(s.bgColor, s.bgOpacity),
      border: `2px solid ${s.accentColor}`,
      boxShadow: `0 0 26px ${rgba(s.accentColor, 0.7)}`
    },
    plate: {
      background: rgba(s.bgColor, s.bgOpacity),
      border: 'none',
      borderBottom: `4px solid ${s.accentColor}`,
      borderRadius: 8
    }
  };

  const boy = Number(s.fontSize) || 18;
  const avatar = Number(s.avatarSize) || 48;

  return (
    <div
      className={
        embedded
          ? 'w-full h-full flex items-center justify-center p-1 bg-transparent select-none'
          : 'w-screen h-screen flex items-center justify-center p-2 bg-transparent select-none'
      }
      style={{ fontFamily: s.fontFamily }}
    >
      <div
        className="relative flex items-center gap-3.5"
        style={{
          ...(temaStili[tema] || temaStili.royal),
          borderRadius: tema === 'plate' ? 8 : Number(s.radius) || 16,
          padding: `${Number(s.paddingY) || 12}px ${Number(s.paddingX) || 20}px`,
          color: s.textColor
        }}
      >
        {s.showCrown && (
          <div
            className="absolute -top-3.5 left-6 p-1 rounded-full animate-bounce"
            style={{ background: s.accentColor, boxShadow: `0 0 12px ${s.accentColor}` }}
          >
            <Crown className="w-4 h-4" style={{ color: '#1c1917', fill: '#1c1917' }} />
          </div>
        )}

        {s.showAvatar && (
          <div className="relative flex-shrink-0">
            {king.avatarUrl ? (
              <img
                src={king.avatarUrl}
                alt={king.displayName}
                className="rounded-xl object-cover"
                style={{ width: avatar, height: avatar, border: `2px solid ${s.accentColor}` }}
              />
            ) : (
              <div
                className="rounded-xl flex items-center justify-center"
                style={{
                  width: avatar,
                  height: avatar,
                  background: `linear-gradient(135deg, ${s.accentColor}, ${rgba(s.accentColor, 0.5)})`,
                  border: `2px solid ${rgba('#ffffff', 0.3)}`
                }}
              >
                <Crown style={{ width: avatar * 0.5, height: avatar * 0.5, color: '#000', fill: '#000' }} />
              </div>
            )}
            <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5">
              <span
                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{ background: s.accentColor }}
              />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5" style={{ background: s.accentColor }} />
            </span>
          </div>
        )}

        <div className="flex flex-col min-w-0">
          {s.showTitle && (
            <span
              className="font-semibold uppercase tracking-widest flex items-center gap-1"
              style={{ fontSize: Math.max(9, boy * 0.55), color: s.accentColor }}
            >
              <Sparkles className="w-3 h-3" />
              {king.title || s.title}
            </span>
          )}

          <div className="font-black leading-tight truncate" style={{ fontSize: boy }}>
            {king.displayName || king.currentKing}
          </div>

          {(s.showPoints || s.showReign) && (
            <div
              className="flex items-center gap-3 mt-0.5 font-medium"
              style={{ fontSize: Math.max(9, boy * 0.6), opacity: 0.85 }}
            >
              {s.showPoints && (
                <span
                  className="px-2 py-0.5 rounded-md"
                  style={{
                    background: rgba(s.accentColor, 0.2),
                    border: `1px solid ${rgba(s.accentColor, 0.3)}`,
                    color: s.accentColor
                  }}
                >
                  💎 {sayiYaz(Number(king.pointsBid) || 0)} {s.pointsLabel}
                </span>
              )}
              {s.showReign && (
                <span className="flex items-center gap-1">
                  <Timer className="w-3 h-3" style={{ color: s.accentColor }} />
                  {saltanatYaz(seconds)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default KingWidget;
