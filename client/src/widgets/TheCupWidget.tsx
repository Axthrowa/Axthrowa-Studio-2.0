/**
 * StreamAxT Bağış Kupası widget
 * Developed by AxthrowA
 *
 * Eski sürümde hiç ayarı yoktu: kap boyutu, renkler ve emoji setleri koda
 * gömülüydü, üstelik `payload.type === 'alert'` her uyarıda kupaya öğe
 * atıyordu (takip bile kupayı dolduruyordu). Artık olay türü ayrıştırılıyor,
 * eşikler (min. bağış / min. KICKs) uygulanıyor ve panelden "Kupayı boşalt"
 * için `cup_clear` yayını dinleniyor.
 */
import { useState, useEffect, useRef } from 'react';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { THE_CUP_DEFAULTS } from '../lib/widget-defaults.js';
import { rgba, yatay, emojiListesi, onizlemeKipi, wsAdresi } from '../lib/widget-style.js';

interface DroppedItem {
  id: string;
  emoji: string;
  size: number;
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

/**
 * Olay kupaya düşmeli mi? Takip/raid/host kupayı doldurmaz; bağış ve KICKs
 * panelde verilen alt sınırın altındaysa da sayılmaz.
 */
export function kupayaDuser(
  tur: string,
  tutar: number,
  esik: { minTipAmount?: number; minKicks?: number }
): boolean {
  if (tur === 'tip') return Number(tutar || 0) >= Math.max(0, Number(esik.minTipAmount) || 0);
  if (tur === 'kicks') return Number(tutar || 0) >= Math.max(0, Number(esik.minKicks) || 0);
  return tur === 'sub' || tur === 'gift_sub' || tur === 'gift_tiktok';
}

/** Kupaya sayılmayan türler: takip, raid, host. */
export const KUPA_DISI = ['follow', 'raid', 'host'];

export function TheCupWidget({ embedded = false, previewMode = false }: TheCupWidgetProps) {
  const s = useWidgetSettings('the-cup', THE_CUP_DEFAULTS);
  const onizleme = onizlemeKipi(previewMode);
  const ayarRef = useRef(s);
  ayarRef.current = s;

  const [items, setItems] = useState<DroppedItem[]>(
    onizleme
      ? ['🪙', '💎', '⭐', '🪙', '👑', '💎', '🎁', '🪙'].map((emoji, i) => ({
          id: `o${i}`,
          emoji,
          size: 24 + (i % 3) * 2
        }))
      : []
  );

  const ekle = (tur: string) => {
    const a = ayarRef.current;
    const set = emojiSeti(tur, a);
    const emoji = set[Math.floor(Math.random() * set.length)];
    const taban = Math.max(8, Number(a.itemSize) || 24);
    const oynak = Math.max(0, Number(a.itemSizeVary) || 0);
    const tavan = Math.max(1, Number(a.maxItems) || 45);
    setItems((prev) => [
      ...prev.slice(-(tavan - 1)),
      {
        id: `${Date.now()}-${Math.random()}`,
        emoji,
        size: taban + Math.floor(Math.random() * (oynak + 1))
      }
    ]);
  };

  useEffect(() => {
    if (onizleme) return;
    const ws = new WebSocket(wsAdresi());

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);

        if (payload.type === 'cup_clear' || payload.type === 'the_cup_clear') {
          setItems([]);
          return;
        }

        // YALNIZ `cup_drop` dinlenir. Sunucu destek olaylarında hem `alert`
        // hem `cup_drop` yayınlıyor; ikisi birden dinlendiğinde tek bağış
        // kupaya iki öğe atıyordu. Hangi olayın kupaya sayıldığına sunucu
        // karar verir, eşikleri burada uygularız.
        if (payload.type !== 'cup_drop' && payload.type !== 'the_cup_drop') return;

        const d = payload.data || {};
        const tur = String(d.type || payload.tokenType || 'tip');
        if (!kupayaDuser(tur, Number(d.amount || 0), ayarRef.current)) return;
        const adet = tur === 'gift_sub' ? Math.min(20, Math.max(1, Number(d.count || 1))) : 1;
        for (let i = 0; i < adet; i++) ekle(tur);
      } catch {
        /* bozuk mesaj */
      }
    };

    return () => ws.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onizleme]);

  const tema = String(s.theme || 'glass');
  const genislik = Number(s.cupWidth) || 192;
  const yukseklik = Number(s.cupHeight) || 256;
  const kenar = Math.max(0, Number(s.borderWidth) || 0);

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

  return (
    <div
      className={
        embedded
          ? 'w-full h-full bg-transparent p-0 flex items-center select-none font-sans'
          : 'w-screen h-screen bg-transparent p-6 flex items-end select-none font-sans'
      }
      style={{ justifyContent: yatay(s.align), fontFamily: s.fontFamily }}
    >
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
            ...(temaStili[tema] || temaStili.glass)
          }}
        >
          {s.showGlare && (
            <div
              className="absolute top-0 left-2 w-3 h-full rounded-full"
              style={{ background: rgba('#ffffff', 0.2), filter: 'blur(1px)' }}
            />
          )}

          <div className="absolute inset-0 flex flex-wrap-reverse content-start p-3 gap-1 overflow-hidden">
            {items.map((item) => (
              <span
                key={item.id}
                style={{ fontSize: `${item.size}px`, lineHeight: 1 }}
                className={s.animateItems ? 'animate-bounce' : undefined}
              >
                {item.emoji}
              </span>
            ))}
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
            {s.showCount && `(${items.length} Öğe)`}
          </div>
        )}
      </div>
    </div>
  );
}

export default TheCupWidget;
