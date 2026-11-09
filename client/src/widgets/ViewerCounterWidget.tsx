/**
 * AxBoT İzleyici Sayacı widget
 * Developed by AxthrowA
 *
 * Ayarlar panelden gelir (eskiden yalnız adres satırından okunuyordu ve
 * panelde hiç ayarı yoktu). Tema, hizalama, ikon, yuvarlaklık, renkler ve
 * çoklu platform toplamı BotRix'teki sayaçla aynı işlev seviyesinde —
 * uygulama bize ait, kod kopyalanmadı.
 */
import { kokOzellik } from '../lib/kabuklar.js';
import { ortakHareket } from '../lib/animations.js';
import { kutuTasarimi } from '../lib/widget-style.js';
import { useEffect, useRef, useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { VIEWER_COUNTER_DEFAULTS } from '../lib/widget-defaults.js';
import { PlatformLogo } from '../components/PlatformLogo.js';

type Satir = { id: string; label: string; value: number; renk: string };

/** Hex + opaklık → rgba (renk seçici hex tutar, saydamlık ayrı alandır). */
export function rgba(hex: string, opaklik: number | string | undefined): string {
  const h = String(hex || '#000000').replace('#', '');
  const t = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(t.slice(0, 2), 16) || 0;
  const g = parseInt(t.slice(2, 4), 16) || 0;
  const b = parseInt(t.slice(4, 6), 16) || 0;
  const a = Math.max(0, Math.min(1, Number(opaklik ?? 1)));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Sayıyı okunur yaz: 1.234 / 12,3 B gibi. */
export function sayiBicimle(n: number, kisalt: boolean): string {
  if (!kisalt || n < 1000) return n.toLocaleString('tr-TR');
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace('.', ',')} B`;
  return `${(n / 1_000_000).toFixed(1).replace('.', ',')} M`;
}

export function ViewerCounterWidget({ embedded = false, previewMode = false }: { embedded?: boolean; previewMode?: boolean }) {
  const s = useWidgetSettings('viewer-counter', VIEWER_COUNTER_DEFAULTS);
  const { lastMessage } = useWebSocket('all');
  const onizleme =
    previewMode ||
    (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === '1');

  const [counts, setCounts] = useState({
    kick: onizleme ? 128 : 0,
    twitch: onizleme ? 64 : 0,
    youtube: onizleme ? 42 : 0
  });

  // Sayılar botun yayın yoklamasından gelir. Eskiden platform durumundan okunuyordu; orada izleyici hiç yoktu, hep 0 yazıyordu
  const testBitis = useRef(0);
  useEffect(() => {
    if (onizleme) return;
    const cek = () => {
      if (Date.now() < testBitis.current) return;
      fetch('/api/overlay/izleyici')
        .then((r) => r.json())
        .then((d) => setCounts({ kick: Number(d.kick) || 0, twitch: Number(d.twitch) || 0, youtube: Number(d.youtube) || 0 }))
        .catch(() => {});
    };
    cek();
    const t = setInterval(cek, 20000);
    return () => clearInterval(t);
  }, [onizleme]);

  useEffect(() => {
    if (onizleme) return;
    if (lastMessage?.type === 'viewer_count') {
      // Test örneği birkaç saniye görünür, sonra önceki sayılar geri gelir
      if (lastMessage.test) {
        testBitis.current = Date.now() + 8000;
        const onceki = counts;
        setTimeout(() => setCounts(onceki), 8000);
      }
      setCounts((prev) => ({
        kick: lastMessage.kick ?? prev.kick,
        twitch: lastMessage.twitch ?? prev.twitch,
        youtube: lastMessage.youtube ?? prev.youtube
      }));
    }
  }, [lastMessage, onizleme]);

  const satirlar: Satir[] = [
    s.showKick ? { id: 'kick', label: 'Kick', value: counts.kick, renk: '#53fc18' } : null,
    s.showTwitch ? { id: 'twitch', label: 'Twitch', value: counts.twitch, renk: '#9146ff' } : null,
    s.showYoutube ? { id: 'youtube', label: 'YouTube', value: counts.youtube, renk: '#ff0000' } : null
  ].filter(Boolean) as Satir[];

  const toplam = satirlar.reduce((t, r) => t + r.value, 0);
  const tema = String(s.theme || 'classic');

  const temaStili: Record<string, React.CSSProperties> = {
    classic: {
      background: rgba(s.bgColor, s.bgOpacity),
      border: `1px solid ${rgba(s.borderColor, 0.25)}`
    },
    minimal: { background: 'transparent', border: 'none' },
    glass: {
      background: rgba(s.bgColor, Math.min(0.5, Number(s.bgOpacity) || 0.5)),
      border: `1px solid ${rgba('#ffffff', 0.18)}`,
      backdropFilter: 'blur(10px)'
    },
    neon: {
      background: rgba(s.bgColor, s.bgOpacity),
      border: `2px solid ${s.accentColor}`,
      boxShadow: `0 0 18px ${rgba(s.accentColor, 0.55)}`
    },
    capsule: {
      background: rgba(s.bgColor, s.bgOpacity),
      border: `1px solid ${rgba(s.borderColor, 0.25)}`,
      borderRadius: 999
    },
    // Koyu kadife: derin renk geçişi, yumuşak iç gölge
    velvet: {
      background: `radial-gradient(120% 140% at 0% 0%, ${rgba(s.accentColor, 0.35)}, ${rgba(s.bgColor, s.bgOpacity)} 60%)`,
      border: `1px solid ${rgba(s.accentColor, 0.35)}`,
      boxShadow: `inset 0 1px 0 ${rgba('#ffffff', 0.12)}, 0 12px 30px rgba(0,0,0,.55)`
    },
    // Borsa bandı: düz şerit, solda renkli çubuk, eş aralıklı rakamlar
    ticker: {
      background: rgba(s.bgColor, Math.max(0.85, Number(s.bgOpacity) || 0)),
      borderLeft: `6px solid ${s.accentColor}`,
      fontVariantNumeric: 'tabular-nums',
      letterSpacing: 1
    },
    // Holografik kenar: kayan gökkuşağı çerçeve
    holochip: {
      background: `linear-gradient(${rgba(s.bgColor, s.bgOpacity)}, ${rgba(s.bgColor, s.bgOpacity)}) padding-box, linear-gradient(120deg, #22d3ee, #a78bfa, #f472b6, #fbbf24, #22d3ee) border-box`,
      border: '2px solid transparent',
      boxShadow: `0 0 18px ${rgba('#a78bfa', 0.35)}`
    },
    splitflap: {
      background: 'transparent',
      border: 'none'
    }
  };

  const hizala = String(s.align || 'center');
  const icHizala = hizala === 'center' ? 'center' : hizala === 'right' ? 'flex-end' : 'flex-start';
  const kap = embedded
    ? 'w-full h-full flex items-center'
    : 'w-screen h-screen bg-transparent p-4 flex items-start';

  return (
    <div
      className={kap}
      style={{ justifyContent: hizala === 'center' ? 'center' : hizala === 'right' ? 'flex-end' : 'flex-start' }}
    >
      <div {...kokOzellik(s)}
        style={{
          ...(kutuTasarimi(s) || temaStili[tema] || temaStili.classic), ...ortakHareket(s),
          borderRadius: tema === 'capsule' ? 999 : Number(s.radius) || 16,
          padding: `${Number(s.paddingY) || 12}px ${Number(s.paddingX) || 16}px`,
          color: s.textColor,
          fontFamily: s.fontFamily,
          fontSize: Number(s.fontSize) || 18,
          display: 'flex',
          flexDirection: s.layout === 'row' ? 'row' : 'column',
          alignItems: s.layout === 'row' ? 'center' : icHizala,
          textAlign: hizala as 'left' | 'center' | 'right',
          gap: s.layout === 'row' ? 12 : 2
        }}
      >
        {s.showTitle && (
          <div
            className="uppercase tracking-widest font-bold"
            style={{ fontSize: Math.max(9, (Number(s.fontSize) || 18) * 0.55), opacity: 0.6 }}
          >
            {s.title}
          </div>
        )}

        {s.showTotal &&
          (tema === 'splitflap' ? (
            // Havalimanı tabelası gibi: her rakam ortasından bölünmüş ayrı karo
            <div className="flex gap-1">
              {sayiBicimle(toplam, !!s.compactNumbers).split('').map((c, i) => (
                <span
                  key={i}
                  className="font-black inline-flex items-center justify-center"
                  style={{
                    fontSize: (Number(s.fontSize) || 18) * 1.25,
                    minWidth: (Number(s.fontSize) || 18) * 0.95,
                    padding: '2px 4px',
                    borderRadius: 6,
                    background: `linear-gradient(180deg, ${rgba(s.bgColor, 1)} 0 49%, #000 49% 51%, ${rgba(s.bgColor, 0.85)} 51%)`,
                    boxShadow: `0 3px 8px rgba(0,0,0,.55), inset 0 0 0 1px ${rgba(s.accentColor, 0.4)}`
                  }}
                >
                  {c}
                </span>
              ))}
            </div>
          ) : (
            <div className="font-black" style={{ fontSize: (Number(s.fontSize) || 18) * 1.25 }}>
              {sayiBicimle(toplam, !!s.compactNumbers)}
            </div>
          ))}

        {s.showPerPlatform && (
          <div className="flex gap-3" style={{ fontSize: Math.max(10, (Number(s.fontSize) || 18) * 0.7) }}>
            {satirlar.map((r) => (
              <span key={r.id} className="flex items-center gap-1">
                {s.showIcons &&
                  (s.iconStyle === 'dot' ? (
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, background: r.renk }} />
                  ) : (
                    // Platform logosu (satır içi SVG: OBS'te ağ isteği yok)
                    <PlatformLogo platform={r.id} size={Math.max(12, Math.round((Number(s.fontSize) || 18) * 0.85))} />
                  ))}
                {s.showPlatformName && <span style={{ opacity: 0.7 }}>{r.label}</span>}
                <strong>{sayiBicimle(r.value, !!s.compactNumbers)}</strong>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ViewerCounterWidget;
