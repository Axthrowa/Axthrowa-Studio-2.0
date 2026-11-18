/**
 * WID-8: tek widget sayfasında (/widgets/<ad>) Test düğmesinin örnek gösterimi. Olay testi olmayan
 * widget'lar (sıralama, söz, sözcük bulutu…) `katman_ornek` gelince örnek verisiyle birkaç saniye çizilir;
 * Tek URL katmanı aynı iletiyi OverlayLayers'ta işler.
 */
import { cloneElement, isValidElement, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { ayarKanalinaKatil, ORNEK_KIMLIGI } from '../lib/ayarKanali.js';

export const ORNEK_TEST_MS = 10_000;

/** Sayfa yolu → Tek URL katman anahtarı (word-cloud → wordCloud).
 * shortcut: yalnız adı katman anahtarıyla eşleşen sayfalar; eşleşmeyenlerin (alertbox, chatbox) olay testi var. */
export function sayfaKatmani(yol: string): string {
  return (yol.match(/^\/widgets\/([a-z0-9-]+)\/?$/)?.[1] || '').replace(/-([a-z0-9])/g, (_, h: string) => h.toUpperCase());
}

export function OrnekTestKabugu({ children }: { children: ReactNode }) {
  const [ornek, setOrnek] = useState(false);
  useEffect(() => {
    const katman = sayfaKatmani(window.location.pathname);
    if (!katman) return;
    let zaman: ReturnType<typeof setTimeout> | undefined;
    const ayril = ayarKanalinaKatil({
      widgetId: ORNEK_KIMLIGI,
      ayar: (a) => {
        if (a.anahtar !== katman) return;
        setOrnek(true);
        clearTimeout(zaman);
        zaman = setTimeout(() => setOrnek(false), ORNEK_TEST_MS);
      },
      tazele: () => {}
    });
    return () => {
      clearTimeout(zaman);
      ayril();
    };
  }, []);
  // key: örnek ↔ canlı geçişinde widget baştan kurulur (örnek verisi ilk durumdan gelir)
  if (!isValidElement(children)) return <>{children}</>;
  return ornek ? cloneElement(children as ReactElement<{ previewMode?: boolean }>, { key: 'ornek', previewMode: true }) : cloneElement(children, { key: 'canli' });
}
