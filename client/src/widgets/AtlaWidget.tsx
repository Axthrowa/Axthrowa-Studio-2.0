/**
 * AxBoT — !atla kartı. Oy birikir; eşik dolunca veya mod atlayınca “atlandı” yazar.
 */
import { kokOzellik } from '../lib/kabuklar.js';
import { hareketAnahtari, ortakHareket } from '../lib/animations.js';
import { useEffect, useRef, useState } from 'react';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { ATLA_DEFAULTS } from '../lib/widget-defaults.js';
import { KaliciSoket } from '../lib/kaliciSoket.js';
import { onizlemeKipi, wsAdresi } from '../lib/widget-style.js';

type Kart = { title: string; by: string; votes: number; required: number; skipped: boolean };

export function AtlaWidget(props?: { embedded?: boolean; previewMode?: boolean }) {
  const s = useWidgetSettings('atla', ATLA_DEFAULTS);
  const onizleme = onizlemeKipi(props?.previewMode);
  const [kart, setKart] = useState<Kart | null>(
    onizleme ? { title: 'Örnek şarkı', by: 'izleyici', votes: 2, required: 3, skipped: false } : null
  );
  const ayar = useRef(s);
  ayar.current = s;

  useEffect(() => {
    if (onizleme) return;
    let kapan = 0;
    // yeniden-baglanma: gerekmez — anlık oylama kartı, birkaç saniyede kapanır; kopukken atlanan şarkı zaten geçmiştir
    const ws = new KaliciSoket(wsAdresi());
    ws.onmessage = (ev) => {
      let m: { type?: string; data?: Kart };
      try {
        m = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (m?.type !== 'atla' || !m.data) return;
      setKart(m.data);
      window.clearTimeout(kapan);
      kapan = window.setTimeout(() => setKart(null), Math.max(1500, Number(ayar.current.durationMs) || 5000));
    };
    return () => {
      ws.close();
      window.clearTimeout(kapan);
    };
  }, [onizleme]);

  if (!kart) {
    return <div {...kokOzellik(s)} data-katman-bos="" style={{ width: '100%', height: '100%' }} />;
  }
  const dolu = Math.max(1, kart.required);
  const yuzde = Math.min(100, Math.round((kart.votes / dolu) * 100));
  return (
    <div {...kokOzellik(s)} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div key={hareketAnahtari(s)} style={ortakHareket(s)}>
        <div style={{ minWidth: 280, padding: '14px 18px', borderRadius: 16, background: 'rgba(8,10,16,.82)', color: '#fff', fontFamily: 'inherit' }}>
          <div style={{ fontSize: 13, letterSpacing: '.08em', opacity: .7 }}>{kart.skipped ? 'ATLANDI' : 'ATLA'}</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{kart.title}</div>
          <div style={{ fontSize: 13, opacity: .75, marginTop: 2 }}>{kart.by}</div>
          <div style={{ marginTop: 10, height: 8, borderRadius: 99, background: 'rgba(255,255,255,.15)', overflow: 'hidden' }}>
            <div style={{ width: `${kart.skipped ? 100 : yuzde}%`, height: '100%', background: kart.skipped ? '#34d399' : '#22d3ee' }} />
          </div>
          <div style={{ marginTop: 6, fontSize: 13 }}>{kart.skipped ? 'Sıradaki şarkıya geçildi' : `${kart.votes}/${dolu} oy`}</div>
        </div>
      </div>
    </div>
  );
}

export default AtlaWidget;
