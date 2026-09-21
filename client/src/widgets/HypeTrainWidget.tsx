/**
 * StreamAxT Hype Treni widget
 * Developed by AxthrowA
 *
 * Eski sürüm tamamen sahteydi: seviye ve yüzde sabit kodlanmıştı, geri sayım
 * sıfıra inince 300'e dönüyordu ve hiçbir yayın olayı treni ilerletmiyordu.
 * Artık abone / hediye abone / bağış / KICKs / takip olayları puan ekliyor,
 * puan seviye hedefini aşınca tren seviye atlıyor ve süre dolunca tren
 * duruyor. Eşikler ve puan karşılıkları panelden ayarlanır.
 */
import { useEffect, useRef, useState } from 'react';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { HYPE_TRAIN_DEFAULTS } from '../lib/widget-defaults.js';
import { rgba, sureYaz, onizlemeKipi, wsAdresi } from '../lib/widget-style.js';

export interface HypeTrainWidgetProps {
  embedded?: boolean;
  previewMode?: boolean;
}

type Ayar = typeof HYPE_TRAIN_DEFAULTS;

/** Seviye hedefi kademeli büyür: taban * büyüme^(seviye-1). */
export function seviyeHedefi(seviye: number, taban: number, buyume: number): number {
  const s = Math.max(1, Math.floor(Number(seviye) || 1));
  const t = Math.max(1, Number(taban) || 1);
  const b = Math.max(1, Number(buyume) || 1);
  return Math.round(t * Math.pow(b, s - 1));
}

/** Bir yayın olayının kaç hype puanı ettiği. Desteklenmeyen olay 0 döner. */
export function olayPuani(subType: string, data: any, s: Partial<Ayar>): number {
  const d = data || {};
  const adet = Math.max(1, Number(d.count || 1));
  const tutar = Math.max(0, Number(d.amount || 0));
  if (subType === 'sub') return Math.max(0, Number(s.pointsSub) || 0);
  if (subType === 'gift_sub') return Math.max(0, Number(s.pointsGiftSub) || 0) * adet;
  if (subType === 'tip') return Math.round(Math.max(0, Number(s.pointsTip) || 0) * tutar);
  if (subType === 'kicks') return Math.round(Math.max(0, Number(s.pointsKicks) || 0) * tutar);
  if (subType === 'follow' || subType === 'follower') return Math.max(0, Number(s.pointsFollow) || 0);
  return 0;
}

/** Puan eklendikten sonraki seviye ve seviye içi puan. */
export function seviyeIlerlet(
  seviye: number,
  puan: number,
  eklenen: number,
  s: Partial<Ayar>
): { seviye: number; puan: number; atladi: boolean } {
  const tavan = Math.max(1, Number(s.maxLevel) || 10);
  let sv = Math.max(1, Math.floor(seviye));
  let pn = Math.max(0, puan) + Math.max(0, eklenen);
  let atladi = false;
  let hedef = seviyeHedefi(sv, Number(s.levelGoal) || 500, Number(s.levelGrowth) || 1.5);
  while (pn >= hedef && sv < tavan) {
    pn -= hedef;
    sv += 1;
    atladi = true;
    hedef = seviyeHedefi(sv, Number(s.levelGoal) || 500, Number(s.levelGrowth) || 1.5);
  }
  if (sv >= tavan) pn = Math.min(pn, hedef);
  return { seviye: sv, puan: pn, atladi };
}

export function HypeTrainWidget({ embedded = false, previewMode = false }: HypeTrainWidgetProps) {
  const s = useWidgetSettings('hype-train', HYPE_TRAIN_DEFAULTS);
  const onizleme = onizlemeKipi(previewMode);
  const ayarRef = useRef(s);
  ayarRef.current = s;

  const [aktif, setAktif] = useState(onizleme);
  // Seviye ve seviye içi puan TEK durumda tutulur: iç içe setState çağrıları
  // React 18'in iki kez çalıştırdığı güncelleyicilerde puanı iki kez ekliyordu.
  const [tren, setTren] = useState({ seviye: onizleme ? 3 : 1, puan: onizleme ? 410 : 0 });
  const { seviye, puan } = tren;
  const [kalan, setKalan] = useState(onizleme ? 187 : 0);
  const [sonDestek, setSonDestek] = useState<string | null>(onizleme ? 'Can_Stream · +100' : null);

  // Geri sayım: süre dolunca tren durur, seviye ve puan sıfırlanır.
  useEffect(() => {
    if (!aktif || onizleme) return;
    const t = setInterval(() => {
      setKalan((p) => {
        if (p <= 1) {
          setAktif(false);
          setTren({ seviye: 1, puan: 0 });
          setSonDestek(null);
          return 0;
        }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [aktif, onizleme]);

  useEffect(() => {
    if (onizleme) return;
    const ws = new WebSocket(wsAdresi());
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);

        if (payload.type === 'hype_train_reset') {
          setAktif(false);
          setTren({ seviye: 1, puan: 0 });
          setKalan(0);
          setSonDestek(null);
          return;
        }
        if (payload.type !== 'alert') return;

        const a = ayarRef.current;
        const tur = String(payload.subType || '');
        const eklenen = olayPuani(tur, payload.data, a);
        if (eklenen <= 0) return;

        const ad = payload.data?.displayName || payload.data?.username || 'İzleyici';
        setSonDestek(`${ad} · +${eklenen}`);
        setKalan(Math.max(10, Number(a.windowSeconds) || 300));
        setAktif(true);
        setTren((once) => {
          const sonuc = seviyeIlerlet(once.seviye, once.puan, eklenen, a);
          return { seviye: sonuc.seviye, puan: sonuc.puan };
        });
      } catch {
        /* bozuk mesaj */
      }
    };
    return () => ws.close();
  }, [onizleme]);

  if (!aktif && s.hideWhenIdle) return null;

  const hedef = seviyeHedefi(seviye, Number(s.levelGoal) || 500, Number(s.levelGrowth) || 1.5);
  const yuzde = Math.min(100, Math.round((puan / Math.max(1, hedef)) * 100));
  const tema = String(s.theme || 'classic');
  const boy = Number(s.fontSize) || 14;

  const temaStili: Record<string, React.CSSProperties> = {
    classic: {
      background: rgba(s.bgColor, s.bgOpacity),
      border: `2px solid ${rgba(s.borderColor, 0.6)}`,
      backdropFilter: 'blur(12px)',
      boxShadow: `0 10px 40px ${rgba(s.accentColor, 0.5)}`
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
    rails: {
      background: `linear-gradient(90deg, ${rgba(s.accentColor, 0.3)}, ${rgba(s.accentColor2, 0.3)})`,
      border: `1px solid ${rgba('#ffffff', 0.15)}`
    }
  };

  return (
    <div
      className={
        embedded
          ? 'w-full h-full bg-transparent p-0 flex items-start justify-start select-none font-sans'
          : 'w-screen h-screen bg-transparent p-6 flex items-start justify-start select-none font-sans'
      }
      style={{ fontFamily: s.fontFamily }}
    >
      <div
        className="w-full"
        style={{
          ...(temaStili[tema] || temaStili.classic),
          borderRadius: Number(s.radius) || 16,
          padding: `${Number(s.paddingY) || 16}px ${Number(s.paddingX) || 16}px`,
          color: s.textColor
        }}
      >
        <div className="flex items-center justify-between mb-3 gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-2xl animate-bounce">🚂</span>
            <div className="min-w-0">
              <div className="font-black tracking-wider uppercase truncate" style={{ fontSize: boy }}>
                {s.title}
                {s.showLevel && ` SEVİYE ${seviye}`}
              </div>
              {s.showSubtitle && (
                <div className="font-medium truncate" style={{ fontSize: boy * 0.78, color: s.accentColor }}>
                  {sonDestek && s.showLastSupporter ? sonDestek : s.subtitle}
                </div>
              )}
            </div>
          </div>

          {s.showTimer && (
            <div
              className="px-3 py-1 rounded-xl font-mono font-bold flex-shrink-0"
              style={{
                background: rgba(s.accentColor, 0.2),
                border: `1px solid ${rgba(s.accentColor, 0.4)}`,
                fontSize: boy * 0.8
              }}
            >
              ⏳ {sureYaz(kalan)}
            </div>
          )}
        </div>

        <div
          className="relative w-full overflow-hidden mb-2"
          style={{
            height: 20,
            borderRadius: 999,
            background: rgba('#000000', 0.55),
            border: `1px solid ${rgba('#ffffff', 0.1)}`,
            padding: 2
          }}
        >
          <div
            style={{
              width: `${yuzde}%`,
              height: '100%',
              borderRadius: 999,
              background: `linear-gradient(90deg, ${s.accentColor}, ${s.accentColor2})`,
              transition: 'width 700ms ease',
              position: 'relative'
            }}
          >
            {s.showPercent && (
              <span
                className="absolute right-1 top-0 bottom-0 flex items-center px-1 font-black"
                style={{ fontSize: 9, color: '#fff' }}
              >
                %{yuzde}
              </span>
            )}
          </div>
        </div>

        <div
          className="flex justify-between items-center font-mono pt-1"
          style={{ fontSize: boy * 0.72, opacity: 0.75, borderTop: `1px solid ${rgba('#ffffff', 0.06)}` }}
        >
          <span>
            {puan} / {hedef}
          </span>
          <span style={{ color: s.accentColor2, fontWeight: 700 }}>
            {seviye >= (Number(s.maxLevel) || 10) ? 'Son seviye 🏁' : `Hedef: Seviye ${seviye + 1} 🚀`}
          </span>
        </div>
      </div>
    </div>
  );
}

export default HypeTrainWidget;
