/**
 * StreamAxT Skor Tablosu — 2-6 takımın skoru; `!skortablo` komutu ya da panel günceller
 * Developed by AxthrowA
 */
import { useEffect, useState } from 'react';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { SCOREBOARD_DEFAULTS } from '../lib/widget-defaults.js';
import { onizlemeKipi, rgba, wsAdresi } from '../lib/widget-style.js';
import { KaliciSoket } from '../lib/kaliciSoket.js';

interface Tablo {
  baslik: string;
  takimlar: Array<{ ad: string; renk: string; skor: number }>;
}

const ORNEK: Tablo = { baslik: 'MAÇ SKORU', takimlar: [{ ad: 'Mavi', renk: '#3b82f6', skor: 3 }, { ad: 'Kırmızı', renk: '#ef4444', skor: 2 }] };

export function ScoreboardWidget({ previewMode = false }: { embedded?: boolean; previewMode?: boolean }) {
  const s = useWidgetSettings('scoreboard', SCOREBOARD_DEFAULTS);
  const onizleme = onizlemeKipi(previewMode);
  const [t, setT] = useState<Tablo | null>(onizleme ? ORNEK : null);
  const [parlayan, setParlayan] = useState<number | null>(null);

  useEffect(() => {
    if (onizleme) return;
    const oku = () => fetch('/api/skor-tablosu').then((r) => r.json()).then((d) => Array.isArray(d?.takimlar) && setT(d)).catch(() => {});
    oku();
    const ws = new KaliciSoket(wsAdresi());
    ws.onyenidenbaglandi = oku;
    ws.onmessage = (ev) => {
      try {
        const m = JSON.parse(ev.data);
        if (m.type !== 'skor_tablosu' || !m.data) return;
        setT((eski) => {
          // Skoru değişen takım kısa süre parlar
          const i = eski ? m.data.takimlar.findIndex((x: any, j: number) => x.skor !== eski.takimlar[j]?.skor) : -1;
          if (i >= 0) {
            setParlayan(i);
            setTimeout(() => setParlayan(null), 1200);
          }
          return m.data;
        });
      } catch {
        /* bozuk mesaj */
      }
    };
    return () => ws.close();
  }, [onizleme]);

  if (!t) return null;
  const tema = String(s.theme || 'split');
  const kutu = { background: rgba(s.bgColor, s.bgOpacity), borderRadius: Number(s.radius), border: `2px solid ${rgba(s.accentColor, 0.7)}` };
  const golge = '0 2px 4px rgba(0,0,0,.9)';

  return (
    <div className="w-screen h-screen flex items-start justify-center p-6 select-none" style={{ fontFamily: s.fontFamily, color: s.textColor }}>
      <div className="flex flex-col items-center gap-2" style={tema === 'minimal' ? {} : { ...kutu, padding: 14, boxShadow: `0 10px 30px ${rgba(s.accentColor, 0.3)}` }}>
        {s.showTitle && (
          <div className="font-black uppercase tracking-[0.25em]" style={{ color: s.accentColor, fontSize: Math.max(11, Number(s.fontSize) * 0.45), textShadow: golge }}>
            {t.baslik}
          </div>
        )}
        <div className={tema === 'stacked' ? 'flex flex-col gap-1.5 w-full' : 'flex items-stretch gap-2'}>
          {t.takimlar.map((x, i) => (
            <div key={i} className="flex items-center gap-2">
              {tema !== 'stacked' && i > 0 && <span className="font-black opacity-70 px-1" style={{ fontSize: Number(s.fontSize) * 0.6, textShadow: golge }}>:</span>}
              <div
                className="flex items-center gap-3 px-4 py-2 rounded-xl"
                style={{
                  background: tema === 'minimal' ? 'transparent' : `linear-gradient(135deg, ${rgba(x.renk, 0.9)}, ${rgba(x.renk, 0.55)})`,
                  boxShadow: parlayan === i ? `0 0 24px ${x.renk}` : undefined,
                  transform: parlayan === i ? 'scale(1.08)' : 'none',
                  transition: 'transform .3s, box-shadow .3s',
                  minWidth: tema === 'stacked' ? 260 : undefined,
                  justifyContent: tema === 'stacked' ? 'space-between' : undefined
                }}
              >
                <span className="font-black uppercase tracking-wider" style={{ fontSize: Number(s.fontSize) * 0.5, textShadow: golge, color: tema === 'minimal' ? x.renk : undefined }}>
                  {x.ad}
                </span>
                <span className="font-black tabular-nums" style={{ fontSize: Number(s.fontSize), lineHeight: 1, textShadow: golge }}>
                  {x.skor}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ScoreboardWidget;
