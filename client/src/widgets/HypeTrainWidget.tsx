/**
 * AxBoT Hype Treni widget
 * Developed by AxthrowA
 *
 * Eski sürüm tamamen sahteydi: seviye ve yüzde sabit kodlanmıştı, geri sayım
 * sıfıra inince 300'e dönüyordu ve hiçbir yayın olayı treni ilerletmiyordu.
 * Artık abone / hediye abone / bağış / KICKs / takip olayları puan ekliyor,
 * puan seviye hedefini aşınca tren seviye atlıyor ve süre dolunca tren
 * duruyor. Eşikler ve puan karşılıkları panelden ayarlanır.
 *
 * 3. tur: tren durumu SUNUCUDA (server/modules/hype/hype-train.ts). Eskiden
 * her OBS kaynağı kendi trenini tutuyordu: iki kaynak iki farklı tren
 * gösteriyor, kaynak yenilenince tren sıfırlanıyordu. Widget artık yalnız
 * gösterir: açılışta /api/hype-train, sonra `hype_state` yayınları.
 * Aşağıdaki hesap fonksiyonları sunucuyla aynı kuraldır, önizleme ve
 * geriye uyum için duruyor.
 */
import { kokOzellik } from '../lib/kabuklar.js';
import { ortakHareket } from '../lib/animations.js';
import { kutuTasarimi } from '../lib/widget-style.js';
import { useEffect, useRef, useState } from 'react';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { HYPE_TRAIN_DEFAULTS } from '../lib/widget-defaults.js';
import { rgba, sureYaz, onizlemeKipi, wsAdresi } from '../lib/widget-style.js';
import { KaliciSoket } from '../lib/kaliciSoket.js';

export interface HypeTrainWidgetProps {
  embedded?: boolean;
  previewMode?: boolean;
}


/** Seviye hedefi kademeli büyür: taban * büyüme^(seviye-1). */
export function seviyeHedefi(seviye: number, taban: number, buyume: number): number {
  const s = Math.max(1, Math.floor(Number(seviye) || 1));
  const t = Math.max(1, Number(taban) || 1);
  const b = Math.max(1, Number(buyume) || 1);
  return Math.round(t * Math.pow(b, s - 1));
}

export function HypeTrainWidget({ embedded = false, previewMode = false }: HypeTrainWidgetProps) {
  const s = useWidgetSettings('hype-train', HYPE_TRAIN_DEFAULTS);
  const onizleme = onizlemeKipi(previewMode);

  const [aktif, setAktif] = useState(onizleme);
  const [tren, setTren] = useState({ seviye: onizleme ? 3 : 1, puan: onizleme ? 410 : 0 });
  const { seviye, puan } = tren;
  const [bitisAni, setBitisAni] = useState(onizleme ? Date.now() + 187_000 : 0);
  const [sonDestek, setSonDestek] = useState<string | null>(onizleme ? 'Can_Stream · +100' : null);
  const [, setTik] = useState(0);
  const testZaman = useRef<ReturnType<typeof setTimeout> | null>(null);

  const uygula = (d: any) => {
    if (!d) return;
    setAktif(!!d.aktif);
    setTren({ seviye: Math.max(1, Number(d.seviye) || 1), puan: Math.max(0, Number(d.puan) || 0) });
    setBitisAni(Number(d.bitisAni) || 0);
    setSonDestek(d.sonDestek ?? null);
  };

  const gercegiYukle = () =>
    fetch('/api/hype-train')
      .then((r) => r.json())
      .then(uygula)
      .catch(() => {});

  // Geri sayım yerelde akar (bitiş anından); sıfırlamayı sunucu yapar
  useEffect(() => {
    if (!aktif || onizleme) return;
    const t = setInterval(() => setTik((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [aktif, onizleme]);

  useEffect(() => {
    if (onizleme) return;
    gercegiYukle();
    const ws = new KaliciSoket(wsAdresi());
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type !== 'hype_state' || !payload.data) return;
        uygula(payload.data);
        // Test gösterimi: birkaç saniye sonra gerçek duruma dön
        if (payload.data.test) {
          if (testZaman.current) clearTimeout(testZaman.current);
          testZaman.current = setTimeout(gercegiYukle, 8000);
        }
      } catch {
        /* bozuk mesaj */
      }
    };
    return () => {
      ws.close();
      if (testZaman.current) clearTimeout(testZaman.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onizleme]);

  const kalan = aktif ? Math.max(0, Math.round((bitisAni - Date.now()) / 1000)) : 0;

  if (!aktif && s.hideIdle) return null;

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
      <div {...kokOzellik(s)}
        className="w-full"
        style={{
          ...(kutuTasarimi(s) || temaStili[tema] || temaStili.classic), ...ortakHareket(s),
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
