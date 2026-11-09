/**
 * AxBoT Yayın Kralı widget
 * Developed by AxthrowA
 *
 * Panelden tema, renkler, avatar boyutu ve gösterilecek alanlar ayarlanır.
 * Eski sürümde WebSocket adresi 3001'e sabitti (portu değişen kurulumda hiç
 * bağlanmıyordu), yeniden bağlanma zamanlayıcısı temizlenmediği için widget
 * kapansa da arkada çalışmaya devam ediyordu ve taht boşken bile "Yayıncı"
 * yazan sahte bir kral görünüyordu.
 */
import { kokOzellik } from '../lib/kabuklar.js';
import { ortakHareket } from '../lib/animations.js';
import { kutuTasarimi } from '../lib/widget-style.js';
import { useState, useEffect, useRef } from 'react';
import { Crown, Sparkles, Timer } from 'lucide-react';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { KING_DEFAULTS } from '../lib/widget-defaults.js';
import { rgba, sayiYaz, onizlemeKipi, wsAdresi } from '../lib/widget-style.js';
import { KaliciSoket } from '../lib/kaliciSoket.js';
import { acikRenkMi } from './WheelWidget.js';

interface KingState {
  currentKing: string;
  displayName: string;
  avatarUrl?: string;
  pointsBid: number;
  crownTime?: number;
  reignSeconds?: number;
  title?: string;
  /** Tahtta izleyici yok (sunucu söyler) */
  bos?: boolean;
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

    fetch('/api/king')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.displayName) {
          setKing(d);
          setSeconds(Number(d.reignSeconds) || 0);
        }
      })
      .catch(() => {});

    const ws = new KaliciSoket(wsAdresi());
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

    const timer = setInterval(() => setSeconds((p) => p + 1), 1000);

    return () => {
      kapaliRef.current = true;
      ws.close();
      clearInterval(timer);
    };
  }, [onizleme]);

  // Taht boşken (hiç kapılmadı / yalnız-izleyici kipinde yayıncı) yayıncı gösterilmez
  const bos = !king || Boolean(king.bos);
  if (bos && (s.hideWhenEmpty || !king)) return null;
  if (!king) return null;
  // Tek satır uzun yazı kutuyu şişiriyordu, ad gelince küçülüyordu: komut alt satırda küçük yazılır
  const bosMetin = String(s.emptyText || 'Taht boş — !tahtikap <puan>').split(/\s+—\s+/);
  const gorunen: KingState = bos
    ? { ...king, displayName: bosMetin[0], avatarUrl: '', pointsBid: 0 }
    : king;

  const tema = String(s.theme || 'royal');
  const temaStili: Record<string, React.CSSProperties> = {
    royal: {
      // Orta koyuluk zemini örtmez: eskiden sabit siyahtı, açık temalarda koyu yazı okunmuyordu
      background: `linear-gradient(90deg, transparent, ${rgba('#000000', 0.18)}, transparent), ${rgba(s.bgColor, s.bgOpacity)}`,
      border: `2px solid ${rgba(s.borderColor, 0.6)}`,
      boxShadow: `0 0 25px ${rgba(s.accentColor, 0.35)}`,
      backdropFilter: 'blur(8px)'
    },
    // Zeminsiz: yazı yayının üstünde okunsun diye yazı rengine zıt hale
    minimal: { background: 'transparent', border: 'none', boxShadow: 'none', textShadow: acikRenkMi(s.textColor) ? '0 2px 4px #000, 0 0 10px rgba(0,0,0,.8)' : '0 0 3px #fff, 0 0 10px rgba(255,255,255,.9)' },
    glass: {
      background: rgba(s.bgColor, Math.min(0.5, Number(s.bgOpacity ?? 0.5))),
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
    },
    taht: {
      background: `linear-gradient(135deg, ${rgba(s.bgColor, s.bgOpacity)}, ${rgba(s.accentColor, 0.22)})`,
      border: `4px double ${s.accentColor}`,
      boxShadow: `0 8px 24px rgba(0,0,0,.5), inset 0 0 18px ${rgba(s.accentColor, 0.2)}`
    },
    altin: {
      background: 'linear-gradient(135deg, #f7d774, #b8860b 45%, #fff1b8 62%, #a8740a)',
      border: '1px solid #fff1b8',
      boxShadow: '0 6px 20px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.6)'
    },
    alev: {
      background: `linear-gradient(180deg, ${rgba(s.bgColor, s.bgOpacity)} 45%, ${rgba(s.accentColor, 0.45)})`,
      borderBottom: `3px solid ${s.accentColor}`,
      boxShadow: `0 10px 26px ${rgba(s.accentColor, 0.55)}`
    },
    buz: {
      background: `linear-gradient(135deg, ${rgba(s.bgColor, s.bgOpacity)}, ${rgba('#ffffff', 0.12)})`,
      border: `1px solid ${rgba(s.accentColor, 0.8)}`,
      boxShadow: `inset 0 0 16px ${rgba(s.accentColor, 0.35)}`,
      backdropFilter: 'blur(10px)'
    },
    serit: {
      background: `linear-gradient(90deg, ${rgba(s.accentColor, 0.9)}, ${rgba(s.bgColor, s.bgOpacity)} 70%)`,
      borderLeft: `6px solid ${s.accentColor}`
    },
    kart: {
      background: rgba(s.bgColor, s.bgOpacity),
      borderLeft: `5px solid ${s.accentColor}`,
      boxShadow: '0 6px 18px rgba(0,0,0,.45)'
    }
  };

  // Altın zemin sabit parlak: açık renkler (varsayılanlar dahil) üstünde okunmuyordu
  const altinZemin = tema === 'altin' && !kutuTasarimi(s);
  const vurgu = altinZemin && acikRenkMi(s.accentColor) ? '#7c4a03' : s.accentColor;
  const yazi = altinZemin && acikRenkMi(s.textColor) ? '#2b1a00' : s.textColor;

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
      <div {...kokOzellik(s)}
        className="relative flex items-center gap-3.5"
        style={{
          ...(kutuTasarimi(s) || temaStili[tema] || temaStili.royal), ...ortakHareket(s),
          borderRadius: tema === 'plate' ? 8 : Number(s.radius) || 16,
          padding: `${Number(s.paddingY) || 12}px ${Number(s.paddingX) || 20}px`,
          color: yazi
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
            {gorunen.avatarUrl ? (
              <img
                src={gorunen.avatarUrl}
                alt={gorunen.displayName}
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
          </div>
        )}

        <div className="flex flex-col min-w-0">
          {s.showTitle && (
            <span
              className="font-semibold uppercase tracking-widest flex items-center gap-1"
              style={{ fontSize: Math.max(9, boy * 0.55), color: vurgu }}
            >
              <Sparkles className="w-3 h-3" />
              {king.title || s.title}
            </span>
          )}

          <div className="font-black leading-tight truncate" style={{ fontSize: boy }}>
            {gorunen.displayName || gorunen.currentKing}
          </div>

          {bos && bosMetin[1] && (
            <div className="mt-0.5 font-medium truncate" style={{ fontSize: Math.max(9, boy * 0.6), opacity: 0.85 }}>
              {bosMetin[1]}
            </div>
          )}

          {!bos && (s.showPoints || s.showReign) && (
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
                    color: vurgu
                  }}
                >
                  💎 {sayiYaz(Number(gorunen.pointsBid) || 0)} {s.pointsLabel}
                </span>
              )}
              {s.showReign && (
                <span className="flex items-center gap-1">
                  <Timer className="w-3 h-3" style={{ color: vurgu }} />
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
