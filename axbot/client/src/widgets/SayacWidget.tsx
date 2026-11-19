/**
 * AxBoT Sayaç widget'ı — adlandırılmış sohbet sayacını (ölüm, galibiyet, "bitti mi" …) ekranda gösterir.
 * Developed by AxthrowA
 *
 * Sayaç zaten vardı (`!count ölüm`, `!editcounter ölüm 5`, `$(count ölüm +1)`), ama yalnız sohbete
 * yazıyordu; ekranda göstermenin yolu yoktu. Değer değişince sunucu `sayac_durumu` yayınlar, sayı
 * anında güncellenir ve kısaca büyür.
 */
import { useEffect, useRef, useState } from 'react';
import { kokOzellik } from '../lib/kabuklar.js';
import { hareketAz } from '../lib/hareket.js';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { SAYAC_DEFAULTS } from '../lib/widget-defaults.js';
import { onizlemeMi, renkSaydam, sadeKart } from '../lib/sadeKart.js';

/** Sayaç adları sunucuda `toLowerCase` ile tutulur (aynısı: "İ" farkı olmasın) */
export const sayacAdi = (ad: unknown) => String(ad || 'count').trim().toLowerCase() || 'count';

/** Gelen ileti bu sayaca mı? `*` test iletisi her sayaca uyar */
export function buSayacMi(gelen: unknown, ad: string): boolean {
  const g = String(gelen ?? '');
  return g === '*' || sayacAdi(g) === sayacAdi(ad);
}

export function SayacWidget({ embedded = false, previewMode = false }: { embedded?: boolean; previewMode?: boolean }) {
  const s = useWidgetSettings('sayac', SAYAC_DEFAULTS);
  const { lastMessage } = useWebSocket('all');
  const onizleme = onizlemeMi(previewMode);
  const ad = sayacAdi(s.sayacAdi);
  const [deger, setDeger] = useState<number>(onizleme ? 7 : 0);
  const sayi = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (onizleme) return;
    let iptal = false;
    fetch(`/api/overlay/sayac?ad=${encodeURIComponent(ad)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!iptal && d) setDeger(Number(d.deger) || 0);
      })
      .catch(() => {});
    return () => {
      iptal = true;
    };
  }, [ad, onizleme]);

  useEffect(() => {
    if (lastMessage?.type !== 'sayac_durumu' || !lastMessage.data || !buSayacMi(lastMessage.data.ad, ad)) return;
    if (onizleme && !lastMessage.test) return;
    setDeger(Number(lastMessage.data.deger) || 0);
    if (s.artisAnimasyonu !== false && !hareketAz() && sayi.current?.animate) {
      sayi.current.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.35)', color: s.accentColor || '#f43f5e' }, { transform: 'scale(1)' }],
        { duration: 420, easing: 'cubic-bezier(.2,.9,.3,1.2)' }
      );
    }
  }, [lastMessage, ad, onizleme, s.artisAnimasyonu, s.accentColor]);

  const boyut = Math.max(16, Number(s.fontSize) || 48);
  const hedef = Math.max(0, Number(s.hedef) || 0);
  const dikey = s.duzen === 'dikey';
  return (
    <div
      className={embedded ? 'w-full h-full flex items-center justify-center' : 'w-screen h-screen bg-transparent p-4 flex items-start justify-start'}
      data-katman-bos={s.sifirdaGizle && deger === 0 && !onizleme ? '' : undefined}
    >
      <div
        {...kokOzellik(s)}
        style={{
          ...sadeKart(s),
          display: 'inline-flex',
          flexDirection: dikey ? 'column' : 'row',
          alignItems: 'center',
          gap: dikey ? 2 : boyut * 0.3,
          padding: `${boyut * 0.22}px ${boyut * 0.45}px`,
          lineHeight: 1,
          visibility: s.sifirdaGizle && deger === 0 && !onizleme ? 'hidden' : undefined
        }}
      >
        {s.simge && <span style={{ fontSize: boyut * 0.8 }}>{s.simge}</span>}
        {s.etiket && (
          <span
            style={{
              fontSize: boyut * (dikey ? 0.32 : 0.45),
              fontWeight: 800,
              letterSpacing: dikey ? 2 : 0.5,
              textTransform: dikey ? 'uppercase' : undefined,
              color: renkSaydam(s.textColor || '#ffffff', 0.75)
            }}
          >
            {s.etiket}
          </span>
        )}
        <span style={{ fontSize: boyut, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
          <span ref={sayi} style={{ display: 'inline-block' }}>
            {deger.toLocaleString('tr-TR')}
          </span>
          {hedef > 0 && <span style={{ fontSize: boyut * 0.5, opacity: 0.6 }}> / {hedef.toLocaleString('tr-TR')}</span>}
        </span>
      </div>
    </div>
  );
}

export default SayacWidget;
