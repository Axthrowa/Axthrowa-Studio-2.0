/**
 * StreamAxT "Şu An Çalan" widget
 * Developed by AxthrowA
 *
 * Panelden ayarlanabilir: tasarım (base/glass/pill/wave/minimal/neon), renkler,
 * yazı tipi, kapak görseli, ekolayzer, isteyen kişi ve kayan yazı. Eskiden hiç
 * ayarı yoktu; görünüm koda gömülüydü.
 */
import { useState, useEffect } from 'react';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { NOW_PLAYING_DEFAULTS } from '../lib/widget-defaults.js';

interface SongItem {
  title: string;
  requestedBy: string;
  thumbnail?: string;
  duration?: number;
}

export interface NowPlayingWidgetProps {
  embedded?: boolean;
  previewMode?: boolean;
}

/** Hex + opaklık → rgba. */
function rgba(hex: string, opaklik: number | string | undefined): string {
  const h = String(hex || '#000000').replace('#', '');
  const t = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(t.slice(0, 2), 16) || 0;
  const g = parseInt(t.slice(2, 4), 16) || 0;
  const b = parseInt(t.slice(4, 6), 16) || 0;
  const a = Math.max(0, Math.min(1, Number(opaklik ?? 1)));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

const ORNEK: SongItem = {
  title: 'StreamAxT Lofi Chill Beats',
  requestedBy: 'Yayıncı',
  thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150&auto=format&fit=crop&q=80'
};

export function NowPlayingWidget({ embedded = false, previewMode = false }: NowPlayingWidgetProps) {
  const s = useWidgetSettings('now-playing', NOW_PLAYING_DEFAULTS);
  const onizleme =
    previewMode ||
    (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === '1');

  const [song, setSong] = useState<SongItem | null>(onizleme ? ORNEK : null);

  useEffect(() => {
    if (onizleme) return;
    fetch('/api/songrequest/current')
      .then((r) => r.json())
      .then((d) => {
        if (d && d.title) setSong(d);
      })
      .catch(() => {});

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const port =
      window.location.port === '5173' || window.location.port === '3000' ? '3001' : window.location.port || '3001';
    const ws = new WebSocket(`${protocol}//${window.location.hostname}:${port}/ws?type=all`);
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'song_started' && payload.song) setSong(payload.song);
        if (payload.type === 'song_ended' && s.hideWhenIdle) setSong(null);
      } catch {
        /* bozuk mesaj */
      }
    };
    return () => ws.close();
  }, [onizleme, s.hideWhenIdle]);

  if (!song) return null;

  const tasarim = String(s.theme || 'base');
  const kapakBoyut = Number(s.coverSize) || 48;

  const kartStili: Record<string, React.CSSProperties> = {
    base: {
      background: rgba(s.bgColor, s.bgOpacity),
      border: `1px solid ${rgba('#ffffff', 0.15)}`
    },
    glass: {
      background: rgba(s.bgColor, Math.min(0.45, Number(s.bgOpacity) || 0.45)),
      border: `1px solid ${rgba('#ffffff', 0.2)}`,
      backdropFilter: 'blur(12px)'
    },
    pill: {
      background: rgba(s.bgColor, s.bgOpacity),
      border: `1px solid ${rgba(s.accentColor, 0.35)}`,
      borderRadius: 999
    },
    minimal: { background: 'transparent', border: 'none' },
    neon: {
      background: rgba(s.bgColor, s.bgOpacity),
      border: `2px solid ${s.accentColor}`,
      boxShadow: `0 0 20px ${rgba(s.accentColor, 0.5)}`
    }
  };

  return (
    <div
      className={
        embedded
          ? 'w-full h-full bg-transparent p-0 flex items-start select-none font-sans'
          : 'w-screen h-screen bg-transparent p-4 flex items-start select-none font-sans'
      }
      style={{ justifyContent: s.align === 'center' ? 'center' : s.align === 'right' ? 'flex-end' : 'flex-start' }}
    >
      <div
        className="flex items-center gap-3 shadow-2xl"
        style={{
          ...(kartStili[tasarim] || kartStili.base),
          borderRadius: tasarim === 'pill' ? 999 : Number(s.radius) || 16,
          padding: `${Number(s.paddingY) || 12}px ${Number(s.paddingX) || 14}px`,
          maxWidth: Number(s.maxWidth) || 384,
          fontFamily: s.fontFamily,
          color: s.textColor
        }}
      >
        {s.showCover && (
          <div
            className="relative overflow-hidden flex-shrink-0 flex items-center justify-center"
            style={{
              width: kapakBoyut,
              height: kapakBoyut,
              borderRadius: tasarim === 'pill' ? 999 : 12,
              background: rgba(s.accentColor, 0.25),
              border: `1px solid ${rgba('#ffffff', 0.2)}`
            }}
          >
            {song.thumbnail ? (
              <img src={song.thumbnail} alt="" className="w-full h-full object-cover" />
            ) : (
              <span style={{ fontSize: kapakBoyut * 0.45 }}>🎵</span>
            )}
            {s.showEqualizer && (
              <div className="absolute inset-0 flex items-center justify-center gap-0.5" style={{ background: rgba('#000000', 0.3) }}>
                <span className="w-1 h-3 rounded-full animate-pulse" style={{ background: s.accentColor }} />
                <span className="w-1 h-5 rounded-full animate-pulse delay-100" style={{ background: s.accentColor2 }} />
                <span className="w-1 h-2 rounded-full animate-pulse delay-200" style={{ background: s.accentColor }} />
              </div>
            )}
          </div>
        )}

        <div className="flex-1 min-w-0">
          {s.showLabel && (
            <div
              className="font-mono uppercase tracking-wider font-bold flex items-center gap-1"
              style={{ fontSize: Math.max(8, (Number(s.fontSize) || 12) * 0.8), color: s.accentColor }}
            >
              <span>🎶</span>
              <span>{s.label}</span>
            </div>
          )}
          <div
            className={s.marquee ? 'whitespace-nowrap overflow-hidden' : 'truncate'}
            style={{ fontSize: Number(s.fontSize) || 12, fontWeight: 700 }}
            title={song.title}
          >
            {song.title}
          </div>
          {s.showRequester && song.requestedBy && (
            <div style={{ fontSize: Math.max(8, (Number(s.fontSize) || 12) * 0.82), opacity: 0.7 }}>
              İsteyen: <span style={{ fontWeight: 600, opacity: 1 }}>{song.requestedBy}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default NowPlayingWidget;
