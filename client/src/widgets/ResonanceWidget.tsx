/**
 * AxBoT — "Şu An Çalan" = Resonance müzik çaları overlay'i
 * Developed by AxthrowA
 *
 * Eski "Şu An Çalan" kartı yalnız şarkı isteği kuyruğunu gösteriyordu.
 * Yerini Resonance aldı: Spotify / YouTube Music'te GERÇEKTEN çalan parça,
 * kapak, ilerleme ve Resonance'ta seçilen tema (AxBoT /resonance/).
 * Eski /widgets/now-playing OBS adresi de bunu gösterir (kaynaklar bozulmasın).
 */
import { useEffect, useRef, useState } from 'react';

export function ResonanceWidget({ embedded = false }: { embedded?: boolean; previewMode?: boolean }) {
  const cerceve = useRef<HTMLIFrameElement>(null);
  const [yukseklik, setYukseklik] = useState(0);
  useEffect(() => {
    if (!embedded) return;
    // Kart ve sözler kutudan uzunsa çerçeve kırpmasın: sayfa kendi boyunu bildirir
    const dinle = (e: MessageEvent) => {
      if (e.source !== cerceve.current?.contentWindow || e.data?.source !== 'resonance-overlay') return;
      const h = Number(e.data.height);
      if (h >= 20) setYukseklik(h);
    };
    window.addEventListener('message', dinle);
    return () => window.removeEventListener('message', dinle);
  }, [embedded]);
  return (
    <iframe
      ref={cerceve}
      title="Resonance — Şu An Çalan"
      src="/resonance/overlay"
      scrolling="no"
      style={{
        border: 0,
        width: embedded ? '100%' : '100vw',
        height: embedded ? yukseklik || '100%' : '100vh',
        background: 'transparent',
        colorScheme: 'normal',
        pointerEvents: 'none'
      }}
      allowTransparency
    />
  );
}

export default ResonanceWidget;
