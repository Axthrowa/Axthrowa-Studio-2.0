/**
 * AxBoT — Kappagen / Ekranda Emojiler overlay'i
 * Developed by AxthrowA
 *
 * Sunucu sohbetteki emote'ları (Kick, 7TV, emoji) `kappagen` olayıyla yollar;
 * burada ekranın rastgele bir kenarından girip başka bir kenarından çıkarlar.
 * `!kappagen` patlaması ortadan dağılır. Aynı anda
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
  patlama: boolean;
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

/** Rastgele bir kenardan giriş, başka bir kenardan çıkış; konumlar % (ekran dışında başlar ve biter) */
export function ucusRotasi(r: () => number = Math.random) {
  const kenarNoktasi = (kenar: number) => {
    const u = 5 + r() * 90;
    return kenar === 0 ? { x: u, y: -12 } : kenar === 1 ? { x: 112, y: u } : kenar === 2 ? { x: u, y: 112 } : { x: -12, y: u };
  };
  const giris = Math.floor(r() * 4) % 4;
  const cikis = (giris + 1 + (Math.floor(r() * 3) % 3)) % 4;
  const a = kenarNoktasi(giris);
  const b = kenarNoktasi(cikis);
  return { x: a.x, y: a.y, dx: b.x - a.x, dy: b.y - a.y };
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
          const rota = ucusRotasi();
          yeni.push({
            id: ++sayac,
            parca: { ad: String(p.ad || '').slice(0, 60), url: guvenliGorsel(p.url) },
            patlama,
            x: patlama ? 50 : rota.x,
            y: patlama ? 50 : rota.y,
            dx: patlama ? Math.cos(aci) * hiz : rota.dx,
            dy: patlama ? Math.sin(aci) * hiz : rota.dy,
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
        if (!m.patlama && !m.test && !ayar.current.fromChat) return;
        ekle(m.emotes.slice(0, 20), Boolean(m.patlama));
      }
    };
    return () => ws.close();
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <style>{`@keyframes axt-kappagen { from { transform: translate(-50%,-50%) translate(0,0) rotate(0deg); opacity: 1 }
        85% { opacity: 1 } to { transform: translate(-50%,-50%) translate(var(--dx), var(--dy)) rotate(var(--rot)); opacity: var(--son) } }`}</style>
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
              animation: `axt-kappagen ${u.sure}ms ${u.patlama ? 'ease-out' : 'linear'} forwards`,
              '--son': u.patlama ? 0 : 1,
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
