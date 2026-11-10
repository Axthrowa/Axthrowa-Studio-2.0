/**
 * AxBoT — Kappagen / Ekranda Emojiler overlay'i
 * Developed by AxthrowA
 *
 * Sunucu sohbetteki emote'ları (Kick, 7TV, emoji) `kappagen` olayıyla yollar;
 * burada ekranın rastgele bir kenarından girip başka bir kenarından çıkarlar.
 * `!kappagen` patlaması ortadan dağılır. Aynı anda
 * ekrandaki emote sayısı sınırlıdır (OBS'i yormasın).
 */
import { kokOzellik } from '../lib/kabuklar.js';
import { ortakHareket } from '../lib/animations.js';
import { memo, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { KAPPAGEN_DEFAULTS } from '../lib/widget-defaults.js';
import { KaliciSoket } from '../lib/kaliciSoket.js';
import { hizCarpani, wsAdresi } from '../lib/widget-style.js';

/** Hız 1'in temposu: eskisi gözle takip edilemeyecek kadar hızlıydı */
const TABAN_HIZ = 0.6;

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

/** Görsel önceden çözülür: ilk kez gelen emote'u çözmek uçan diğerlerini bir an takılıyordu */
const cozulen = new Map<string, Promise<unknown>>();
function gorseliCoz(url: string): Promise<unknown> {
  let s = cozulen.get(url);
  if (!s) {
    const g = new Image();
    g.referrerPolicy = 'no-referrer';
    g.src = url;
    s = g.decode().catch(() => {});
    if (cozulen.size > 300) cozulen.clear();
    cozulen.set(url, s);
  }
  return s;
}

const KAPPAGEN_CSS = `@keyframes axt-kappagen { from { transform: translate(-50%,-50%) translate3d(0,0,0) rotate(0deg); opacity: 1 }
  85% { opacity: 1 } to { transform: translate(-50%,-50%) translate3d(var(--dx), var(--dy), 0) rotate(var(--rot)); opacity: var(--son) } }`;

/** memo: yeni emote eklenince uçmakta olanlar yeniden çizilmez */
const UcanEmote = memo(function UcanEmote({ u, spin, shadow, hareket }: { u: Ucan; spin: boolean; shadow: boolean; hareket?: string }) {
  return (
    <div
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
          // Hareket ekran kartında kalsın: gölge filtresi bu katmanda olursa her karede yeniden çiziliyor, emote takılıyordu
          willChange: 'transform, opacity',
          backfaceVisibility: 'hidden',
          contain: 'layout style',
          animation: `axt-kappagen ${u.sure}ms ${u.patlama ? 'ease-out' : 'linear'} forwards`,
          '--son': u.patlama ? 0 : 1,
          '--dx': `${u.dx}vw`,
          '--dy': `${u.dy}vh`,
          '--rot': `${spin ? u.donus : 0}deg`
        } as CSSProperties
      }
    >
      <div style={{ width: '100%', height: '100%', animation: hareket, filter: shadow ? 'drop-shadow(0 4px 6px rgba(0,0,0,.6))' : undefined }}>
      {u.parca.url ? (
        <img src={u.parca.url} alt={u.parca.ad} decoding="sync" style={{ width: '100%', height: '100%', objectFit: 'contain' }} referrerPolicy="no-referrer" />
      ) : (
        <span>{u.parca.ad}</span>
      )}
      </div>
    </div>
  );
});

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
            sure: (Math.max(800, a.durationMs) * (0.8 + Math.random() * 0.4)) / (hizCarpani(a.speed) * TABAN_HIZ),
            boyut: a.size * (patlama ? 1.2 : 0.8 + Math.random() * 0.4)
          });
        }
      }
      if (!yeni.length) return;
      const baslat = () => {
        setUcanlar((u) => [...u, ...yeni].slice(-Math.max(5, a.maxOnScreen)));
        const enUzun = Math.max(...yeni.map((y) => y.sure));
        const kimlikler = new Set(yeni.map((y) => y.id));
        setTimeout(() => setUcanlar((u) => u.filter((x) => !kimlikler.has(x.id))), enUzun + 100);
      };
      void Promise.all(yeni.flatMap((y) => (y.parca.url ? [gorseliCoz(y.parca.url)] : []))).then(baslat);
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
    <div {...kokOzellik(s)} data-katman-bos={ucanlar.length ? undefined : ''} style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <style>{KAPPAGEN_CSS}</style>
      {ucanlar.map((u) => (
        <UcanEmote key={u.id} u={u} spin={Boolean(s.spin)} shadow={Boolean(s.shadow) && !(s as Record<string, any>).golgeKapali} hareket={ortakHareket(s).animation as string | undefined} />
      ))}
    </div>
  );
}

export default KappagenWidget;
