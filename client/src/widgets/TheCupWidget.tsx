/**
 * AxBoT Bağış Kupası widget
 * Developed by AxthrowA
 *
 * Kupaya bağış, abone, hediye abonelik ve KICKs düşer; hangilerinin sayılacağı
 * ve eşikler panelden seçilir, karar ve kalıcı durum SUNUCUDADIR
 * (modules/engagement/kupa.ts): OBS sayfası yenilense de kupa dolu kalır,
 * panelden "Kupayı sıfırla" ile boşaltılır.
 *
 * Yerleşim: tuğla dizisi gibi alttan yukarı sıra sıra dolar (her sırada boşluk sırası rastgele), öğeler
 * hafif kayık ve döndürülmüş durur; kupanın yuvarlak tabanında alt sıralar daralır. Düşüş yerçekimiyle
 * hızlanır, yana sapar, döner ve yere değince tek küçük sekmeyle oturur.
 */
import { kutuTasarimi } from '../lib/widget-style.js';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { THE_CUP_DEFAULTS } from '../lib/widget-defaults.js';
import { rgba, yatay, emojiListesi, onizlemeKipi, wsAdresi } from '../lib/widget-style.js';
import { KaliciSoket } from '../lib/kaliciSoket.js';

const TEST_SURESI_MS = 8000;

interface Oge {
  id: string;
  tur: string;
  /** Yeni düştü: yukarıdan düşme animasyonu */
  yeni?: boolean;
  /** Aynı anda düşenler arka arkaya düşsün (ms) */
  gecikme?: number;
}

export interface TheCupWidgetProps {
  embedded?: boolean;
  previewMode?: boolean;
}

/** Olay türüne göre hangi emoji setinden seçileceği. */
export function emojiSeti(
  tur: string,
  s: { emojiTip?: string; emojiSub?: string; emojiGift?: string; emojiKicks?: string }
): string[] {
  if (tur === 'sub') return emojiListesi(s.emojiSub, ['⭐', '👑', '🚀']);
  if (tur === 'gift_sub' || tur === 'gift_tiktok') return emojiListesi(s.emojiGift, ['🎁', '💎', '👑']);
  if (tur === 'kicks') return emojiListesi(s.emojiKicks, ['🟢', '💚', '🔋']);
  return emojiListesi(s.emojiTip, ['🪙', '💰', '💵']);
}

/** Dizeden kararlı sözde rastgele sayı üreteci (mulberry32) */
export function tohumlu(metin: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < metin.length; i++) h = Math.imul(h ^ metin.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Yerlesim {
  x: number;
  /** Alttan uzaklık */
  y: number;
  boyut: number;
  aci: number;
  emoji: string;
}

/**
 * Yığın yerleşimi: tuğla dizisi gibi alttan yukarı sıra sıra (tek sıralar yarım adım kayık). Her sıranın
 * boşlukları tohumlu rastgele sırayla dolar: yığın hep düz ve homojen, ama dizilim ızgara gibi değil.
 * Konum yalnız sıradaki yerden (indeks) ve kimlikten gelir: yeni öğe düşünce eskiler yerinden oynamaz.
 * `kose`: kupanın taban köşe yarıçapı; alt sıralar köşelerde daralır.
 */
export function yigin(
  ogeler: Array<{ id: string; tur: string }>,
  genislik: number,
  s: { itemSize?: number; itemSizeVary?: number } & Parameters<typeof emojiSeti>[1],
  kose = 0
): Yerlesim[] {
  const taban = Math.max(8, Number(s.itemSize) || 24);
  const oynak = Math.max(0, Number(s.itemSizeVary) || 0);
  const adim = (taban + oynak / 2) * 0.9;
  const satirH = (taban + oynak / 2) * 0.74;
  const yerler: Array<{ x: number; y: number }> = [];
  let satir = 0;
  const satirUret = () => {
    const y = satir * satirH;
    // Yuvarlak tabanda bu yükseklikte kullanılabilir genişlik
    const orta = y + taban / 2;
    const iceri = kose > 0 && orta < kose ? kose - Math.sqrt(Math.max(0, kose * kose - (kose - orta) ** 2)) : 0;
    const kayma = satir % 2 ? adim / 2 : 0;
    const kullanilir = Math.max(taban, genislik - iceri * 2 - kayma);
    const n = Math.max(1, Math.floor((kullanilir - taban) / adim) + 1);
    const bas = iceri + kayma + (kullanilir - ((n - 1) * adim + taban)) / 2;
    const sira = Array.from({ length: n }, (_, i) => i);
    const r = tohumlu(`satir-${satir}`);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [sira[i], sira[j]] = [sira[j], sira[i]];
    }
    for (const i of sira) yerler.push({ x: bas + i * adim, y });
    satir++;
  };
  return ogeler.map((o, i) => {
    while (yerler.length <= i) satirUret();
    const yer = yerler[i];
    const r = tohumlu(o.id);
    const set = emojiSeti(o.tur, s);
    const boyut = taban + Math.floor(r() * (oynak + 1));
    const x = Math.min(Math.max(0, genislik - boyut), Math.max(0, yer.x + (r() - 0.5) * taban * 0.3 - (boyut - taban) / 2));
    const y = Math.max(0, yer.y + (r() - 0.5) * taban * 0.16);
    return { x, y, boyut, aci: Math.round((r() - 0.5) * 70), emoji: set[Math.floor(r() * set.length) % set.length] };
  });
}

let sayac = 0;
const yeniKimlik = () => `${Date.now().toString(36)}-${(sayac++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export function TheCupWidget({ embedded = false, previewMode = false }: TheCupWidgetProps) {
  const s = useWidgetSettings('the-cup', THE_CUP_DEFAULTS);
  const onizleme = onizlemeKipi(previewMode);
  const ayarRef = useRef(s);
  ayarRef.current = s;

  const [ogeler, setOgeler] = useState<Oge[]>(
    onizleme ? ['tip', 'kicks', 'sub', 'tip', 'gift_sub', 'kicks', 'tip', 'sub', 'tip', 'gift_sub'].map((tur, i) => ({ id: `o${i}`, tur })) : []
  );

  useEffect(() => {
    if (onizleme) return;
    // Kalıcı durum: sayfa yenilense de kupa dolu kalır
    const yukle = () =>
      fetch('/api/cup')
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d?.ogeler)) setOgeler(d.ogeler.map((tur: string, i: number) => ({ id: `k${i}`, tur })));
        })
        .catch(() => {});
    void yukle();
    const ws = new KaliciSoket(wsAdresi());
    ws.onyenidenbaglandi = () => void yukle();
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'cup_clear' || payload.type === 'the_cup_clear') {
          setOgeler([]);
          return;
        }
        if (payload.type !== 'cup_drop' && payload.type !== 'the_cup_drop') return;
        // Hangi olayın kaç öğe düşüreceğine sunucu karar verir (kurallar, eşikler)
        const d = payload.data || {};
        // Test yalnız görseldir: birkaç saniye sonra kayıtlı içerik geri gelir
        if (payload.test) setTimeout(() => void yukle(), TEST_SURESI_MS);
        const adet = Math.min(20, Math.max(1, Number(d.adet) || 1));
        const tur = String(d.type || 'tip');
        const tavan = Math.max(5, Number(ayarRef.current.maxItems) || 45);
        // Dolu kupaya eklenmez (sunucu da eklemez): en eskiyi atmak bütün yığını kaydırıyordu
        setOgeler((onceki) => [...onceki, ...Array.from({ length: adet }, (_, i) => ({ id: yeniKimlik(), tur, yeni: true, gecikme: i * 110 }))].slice(0, tavan));
      } catch {
        /* bozuk mesaj */
      }
    };
    return () => ws.close();
  }, [onizleme]);

  const tema = String(s.theme || 'glass');
  const genislik = Number(s.cupWidth) || 192;
  const yukseklik = Number(s.cupHeight) || 256;
  const kenar = Math.max(0, Number(s.borderWidth) || 0);
  const ic = Math.max(20, genislik - kenar * 2 - 12);
  const kose = Math.max(0, (Number(s.cupRadius) || 40) - kenar - 6);
  const yerlesim = useMemo(() => yigin(ogeler, ic, s, kose), [ogeler, ic, s, kose]);

  const temaStili: Record<string, React.CSSProperties> = {
    glass: {
      background: rgba(s.bgColor, s.bgOpacity),
      borderColor: rgba(s.accentColor, 0.7),
      backdropFilter: 'blur(4px)',
      boxShadow: `0 10px 35px ${rgba(s.accentColor, 0.4)}`
    },
    neon: {
      background: rgba(s.bgColor, s.bgOpacity),
      borderColor: s.accentColor,
      boxShadow: `0 0 24px ${rgba(s.accentColor, 0.75)}, inset 0 0 18px ${rgba(s.accentColor, 0.35)}`
    },
    wood: {
      background: rgba('#3f2412', Math.max(0.6, Number(s.bgOpacity) || 0.6)),
      borderColor: '#a16207',
      boxShadow: '0 10px 30px rgba(0,0,0,.55)'
    },
    minimal: {
      background: 'transparent',
      borderColor: rgba(s.accentColor, 0.45),
      boxShadow: 'none'
    },
    crystal: {
      background: `linear-gradient(180deg, ${rgba(s.accentColor, 0.18)}, ${rgba(s.bgColor, s.bgOpacity)})`,
      borderColor: rgba('#ffffff', 0.5),
      backdropFilter: 'blur(8px)',
      boxShadow: `0 12px 40px ${rgba(s.accentColor, 0.35)}`
    }
  };

  if (s.hideEmpty && !onizleme && !ogeler.length) return null;

  return (
    <div
      className={
        embedded
          ? 'w-full h-full bg-transparent p-0 flex items-center select-none font-sans'
          : 'w-screen h-screen bg-transparent p-6 flex items-end select-none font-sans'
      }
      style={{ justifyContent: yatay(s.align), fontFamily: s.fontFamily }}
    >
      <style>{`@keyframes axt-kupa-dus {
        0% { transform: translate3d(var(--dx0), -${yukseklik + 40}px, 0) rotate(var(--aci0)); animation-timing-function: cubic-bezier(.4,.05,.75,.6) }
        76% { transform: translate3d(0, 0, 0) rotate(var(--aci)); animation-timing-function: cubic-bezier(.2,.6,.4,1) }
        88% { transform: translate3d(0, calc(var(--sicra) * -1), 0) rotate(var(--aci)); animation-timing-function: cubic-bezier(.6,0,.8,.4) }
        100% { transform: translate3d(0, 0, 0) rotate(var(--aci)) }
      }`}</style>
      <div className="relative flex flex-col items-center">
        <div
          className="relative overflow-hidden"
          style={{
            width: genislik,
            height: yukseklik,
            borderLeftWidth: kenar,
            borderRightWidth: kenar,
            borderBottomWidth: kenar * 2,
            borderTopWidth: 0,
            borderStyle: 'solid',
            borderBottomLeftRadius: Number(s.cupRadius) || 40,
            borderBottomRightRadius: Number(s.cupRadius) || 40,
            ...(kutuTasarimi(s) || temaStili[tema] || temaStili.glass)
          }}
        >
          {s.showGlare && (
            <div
              className="absolute top-0 left-2 w-3 h-full rounded-full"
              style={{ background: rgba('#ffffff', 0.2), filter: 'blur(1px)' }}
            />
          )}

          <div className="absolute" style={{ left: 6, right: 6, bottom: 6, top: 0 }}>
            {ogeler.map((o, i) => {
              const y = yerlesim[i];
              if (!y) return null;
              return (
                <span
                  key={o.id}
                  style={
                    {
                      position: 'absolute',
                      left: y.x,
                      bottom: y.y,
                      fontSize: `${y.boyut}px`,
                      lineHeight: 1,
                      transform: `rotate(${y.aci}deg)`,
                      '--aci': `${y.aci}deg`,
                      // Düşerken döner ve yana sapar; sekme boya göre
                      '--aci0': `${y.aci + (i % 2 ? 1 : -1) * (180 + (i * 37) % 180)}deg`,
                      '--dx0': `${((i * 53) % 81) - 40}px`,
                      '--sicra': `${Math.round(y.boyut * 0.22)}px`,
                      willChange: o.yeni ? 'transform' : undefined,
                      transformOrigin: '50% 100%',
                      animation:
                        o.yeni && s.animateItems !== false ? `axt-kupa-dus ${1500 + ((i * 71) % 300)}ms linear ${o.gecikme || 0}ms both` : undefined
                    } as React.CSSProperties
                  }
                >
                  {y.emoji}
                </span>
              );
            })}
          </div>
        </div>

        {(s.showLabel || s.showCount) && (
          <div
            className="mt-2 px-4 py-1 rounded-full font-black font-mono tracking-wider shadow-lg"
            style={{
              background: rgba('#000000', 0.8),
              border: `1px solid ${rgba(s.accentColor, 0.4)}`,
              color: s.textColor,
              fontSize: Number(s.fontSize) || 11
            }}
          >
            {s.showLabel && s.title}
            {s.showLabel && s.showCount ? ' ' : ''}
            {s.showCount && `(${ogeler.length} Öğe${ogeler.length >= Math.max(5, Number(s.maxItems) || 45) ? ' · dolu' : ''})`}
          </div>
        )}
      </div>
    </div>
  );
}

export default TheCupWidget;
