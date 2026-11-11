/**
 * AxBoT Sabitlenmiş Mesaj widget
 * Developed by AxthrowA
 *
 * Eski sürümde hiç ayarı yoktu; üstelik örnek mesaj gerçek bir sabitleme yokken
 * de ekranda duruyordu — OBS'e eklendiği anda sahte bir çekiliş duyurusu
 * yayınlanıyordu. Örnek artık yalnız `?preview=1` ile görünür. Panelden tema,
 * konum, renkler ve otomatik gizleme süresi ayarlanır; `pinned_clear` yayını
 * mesajı kaldırır.
 */
import { kokOzellik } from '../lib/kabuklar.js';
import { ortakHareket } from '../lib/animations.js';
import { useState, useEffect, useRef } from 'react';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { PINNED_DEFAULTS } from '../lib/widget-defaults.js';
import { rgba, yatay, dikey, onizlemeKipi, wsAdresi, kartTasarimlari, kutuTasarimi } from '../lib/widget-style.js';
import { KaliciSoket } from '../lib/kaliciSoket.js';

interface PinnedItem {
  id: string;
  username: string;
  displayName: string;
  message: string;
  platform?: string;
  color?: string;
}

export interface PinnedMessageWidgetProps {
  embedded?: boolean;
  previewMode?: boolean;
}

const ORNEK: PinnedItem = {
  id: 'ornek',
  username: 'Yayinci',
  displayName: 'Yayıncı',
  message: 'Bugün saat 21:00’de büyük çekiliş var! Katılmak için sohbete !katil yazabilirsiniz!',
  platform: 'kick'
};

export function PinnedMessageWidget({ embedded = false, previewMode = false }: PinnedMessageWidgetProps) {
  const s = useWidgetSettings('pinned-messages', PINNED_DEFAULTS);
  const onizleme = onizlemeKipi(previewMode);
  const [pinned, setPinned] = useState<PinnedItem | null>(onizleme ? ORNEK : null);
  const gizleZaman = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (onizleme) return;
    // `sifirla`: yeniden bağlanınca sabit mesaj yoksa eskisi ekranda kalmasın
    const yukle = (sifirla: boolean) =>
      fetch('/api/pinned')
        .then((r) => (r.ok ? r.json() : undefined))
        .then((d) => {
          if (d && d.message) setPinned(d);
          else if (sifirla && d !== undefined) setPinned(null);
        })
        .catch(() => {});
    void yukle(false);

    const ws = new KaliciSoket(wsAdresi());
    ws.onyenidenbaglandi = () => void yukle(true);
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'pinned_message') setPinned(payload.data || null);
        if (payload.type === 'pinned_clear') setPinned(null);
      } catch {
        /* bozuk mesaj */
      }
    };
    return () => ws.close();
  }, [onizleme]);

  // Otomatik gizleme: 0 = kalıcı kalsın.
  useEffect(() => {
    if (gizleZaman.current) clearTimeout(gizleZaman.current);
    const sn = Math.max(0, Number(s.autoHideSeconds) || 0);
    if (!pinned || !sn || onizleme) return;
    gizleZaman.current = setTimeout(() => setPinned(null), sn * 1000);
    return () => {
      if (gizleZaman.current) clearTimeout(gizleZaman.current);
    };
  }, [pinned, s.autoHideSeconds, onizleme]);

  if (!pinned) return null;

  const tema = String(s.theme || 'card');
  const temaStili: Record<string, React.CSSProperties> = {
    card: {
      background: rgba(s.bgColor, s.bgOpacity),
      border: `2px solid ${rgba(s.borderColor, 0.7)}`,
      backdropFilter: 'blur(12px)'
    },
    banner: {
      background: `linear-gradient(90deg, ${rgba(s.accentColor, 0.35)}, ${rgba(s.bgColor, s.bgOpacity)})`,
      border: `1px solid ${rgba(s.borderColor, 0.5)}`,
      borderRadius: 8
    },
    minimal: { background: 'transparent', border: 'none' },
    neon: {
      background: rgba(s.bgColor, s.bgOpacity),
      border: `2px solid ${s.accentColor}`,
      boxShadow: `0 0 22px ${rgba(s.accentColor, 0.6)}`
    },
    glass: {
      background: rgba(s.bgColor, Math.min(0.5, Number(s.bgOpacity) || 0.5)),
      border: `1px solid ${rgba('#ffffff', 0.22)}`,
      backdropFilter: 'blur(14px)'
    }
  };

  const boy = Number(s.fontSize) || 14;

  return (
    <div
      className={
        embedded
          ? 'w-full h-full bg-transparent p-0 flex select-none font-sans'
          : 'w-screen h-screen bg-transparent p-6 flex select-none font-sans'
      }
      style={{ alignItems: dikey(s.position), justifyContent: yatay(s.align), fontFamily: s.fontFamily }}
    >
      <div {...kokOzellik(s)}
        className="flex items-center gap-3.5 shadow-2xl w-full"
        style={{
          ...(kutuTasarimi(s) || temaStili[tema] || kartTasarimlari(s)[tema] || temaStili.card), ...ortakHareket(s),
          borderRadius: tema === 'banner' ? 8 : Number(s.radius) || 16,
          padding: `${Number(s.paddingY) || 16}px ${Number(s.paddingX) || 16}px`,
          maxWidth: Number(s.maxWidth) || 512,
          color: s.textColor,
          // Kapsül ve kompakt tasarım köşe/boşluğu kendisi belirler
          ...(tema === 'capsule' || tema === 'compact' ? kartTasarimlari(s)[tema] : {})
        }}
      >
        {s.showIcon && (
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: rgba(s.accentColor, 0.25), border: `1px solid ${s.accentColor}` }}
          >
            {s.icon}
          </div>
        )}

        <div className="flex-1 min-w-0">
          {(s.showLabel || s.showAuthor) && (
            <div className="flex items-center gap-2 mb-0.5">
              {s.showLabel && (
                <span
                  className="font-mono uppercase tracking-widest font-bold"
                  style={{ fontSize: Math.max(9, boy * 0.7), color: s.accentColor }}
                >
                  {s.label}
                </span>
              )}
              {s.showAuthor && (
                <span className="font-bold" style={{ fontSize: Math.max(10, boy * 0.82) }}>
                  @{pinned.displayName || pinned.username}
                </span>
              )}
              {s.showPlatform && pinned.platform && (
                <span style={{ fontSize: Math.max(9, boy * 0.68), opacity: 0.6 }}>{pinned.platform}</span>
              )}
            </div>
          )}

          <div className="font-semibold break-words leading-relaxed" style={{ fontSize: boy }}>
            {pinned.message}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PinnedMessageWidget;
