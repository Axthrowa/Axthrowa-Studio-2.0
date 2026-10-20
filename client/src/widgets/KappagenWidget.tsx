/**
 * StreamAxT — Kappagen / Ekranda Emojiler overlay'i
 * Developed by AxthrowA
 *
 * Sunucu sohbetteki emote'ları (Kick, 7TV, emoji) `kappagen` olayıyla yollar;
 * burada ekranda uçarlar. `!kappagen` patlaması ortadan dağılır. Aynı anda
 * ekrandaki emote sayısı sınırlıdır (OBS'i yormasın).
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { KAPPAGEN_DEFAULTS } from '../lib/widget-defaults.js';
import { KaliciSoket } from '../lib/kaliciSoket.js';
import { wsAdresi } from '../lib/widget-style.js';

interface Parca {
  ad: string;
  url?: string;
}

interface Ucan {
  id: number;
  parca: Parca;
  x: number;
  y: number;
  dx: number;
  dy: number;
  donus: number;
  sure: number;
  boyut: number;
}

/** Yalnız bilinen emote sunucularından görsel (sohbetten gelen veri) */
export function guvenliGorsel(url?: string): string | undefined {
  if (!url) return undefined;
  return /^https:\/\/(files\.kick\.com\/emotes\/\d+\/fullsize|cdn\.7tv\.app\/emote\/[A-Za-z0-9]+\/\dx\.webp)$/.test(url) ? url : undefined;
}

let sayac = 0;

export function KappagenWidget(_props?: { embedded?: boolean; previewMode?: boolean }) {
  const s = useWidgetSettings('on-screen-emotes', KAPPAGEN_DEFAULTS);
  const ayar = useRef(s);
  ayar.current = s;
  const [ucanlar, setUcanlar] = useState<Ucan[]>([]);

  useEffect(() => {
    const ekle = (parcalar: Parca[], patlama: boolean) => {
      const a = ayar.current;
      if (a.paused) return;
      const yeni: Ucan[] = [];
      const kopya = patlama ? Math.max(1, Math.min(10, a.burstCopies)) : 1;
      for (const p of parcalar) {
        for (let i = 0; i < kopya; i++) {
          const aci = Math.random() * Math.PI * 2;
          const hiz = 25 + Math.random() * 30;
          yeni.push({
            id: ++sayac,
            parca: { ad: String(p.ad || '').slice(0, 60), url: guvenliGorsel(p.url) },
            x: patlama ? 50 : 5 + Math.random() * 90,
            y: patlama ? 50 : 100,
            dx: patlama ? Math.cos(aci) * hiz : (Math.random() - 0.5) * 20,
            dy: patlama ? Math.sin(aci) * hiz : -(60 + Math.random() * 40),
            donus: (Math.random() - 0.5) * 540,
            sure: Math.max(800, a.durationMs) * (0.8 + Math.random() * 0.4),
            boyut: a.size * (patlama ? 1.2 : 0.8 + Math.random() * 0.4)
          });
        }
      }
      if (!yeni.length) return;
      setUcanlar((u) => [...u, ...yeni].slice(-Math.max(5, a.maxOnScreen)));
      const enUzun = Math.max(...yeni.map((y) => y.sure));
      const kimlikler = new Set(yeni.map((y) => y.id));
      setTimeout(() => setUcanlar((u) => u.filter((x) => !kimlikler.has(x.id))), enUzun + 100);
    };

    const ws = new KaliciSoket(wsAdresi());
    ws.onmessage = (e) => {
      let m: any;
      try {
        m = JSON.parse(String(e.data));
      } catch {
        return;
      }
      if (m?.type === 'kappagen' && Array.isArray(m.emotes)) {
        if (!m.patlama && !ayar.current.fromChat) return;
        ekle(m.emotes.slice(0, 20), Boolean(m.patlama));
      } else if (m?.type === 'emote_used' && m.emote) {
        // Overlay Stüdyo "Test" düğmesi
        ekle([{ ad: String(m.emote) }], true);
      }
    };
    return () => ws.close();
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <style>{`@keyframes axt-kappagen { from { transform: translate(-50%,-50%) translate(0,0) rotate(0deg); opacity: 1 }
        85% { opacity: 1 } to { transform: translate(-50%,-50%) translate(var(--dx), var(--dy)) rotate(var(--rot)); opacity: 0 } }`}</style>
      {ucanlar.map((u) => (
        <div
          key={u.id}
          style={
            {
              position: 'absolute',
              left: `${u.x}%`,
              top: `${u.y}%`,
              width: u.boyut,
              height: u.boyut,
              fontSize: u.boyut * 0.8,
              lineHeight: `${u.boyut}px`,
              textAlign: 'center',
              animation: `axt-kappagen ${u.sure}ms ease-out forwards`,
              '--dx': `${u.dx}vw`,
              '--dy': `${u.dy}vh`,
              '--rot': `${s.spin ? u.donus : 0}deg`,
              filter: s.shadow ? 'drop-shadow(0 4px 6px rgba(0,0,0,.6))' : undefined
            } as CSSProperties
          }
        >
          {u.parca.url ? (
            <img src={u.parca.url} alt={u.parca.ad} style={{ width: '100%', height: '100%', objectFit: 'contain' }} referrerPolicy="no-referrer" />
          ) : (
            <span>{u.parca.ad}</span>
          )}
        </div>
      ))}
    </div>
  );
}

export default KappagenWidget;
