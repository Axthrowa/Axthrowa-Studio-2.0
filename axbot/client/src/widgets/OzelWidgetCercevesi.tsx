/**
 * WID-1: özel widget'ın korumalı çerçevesi. OBS sayfası (/widgets/ozel?id=…) ve editör önizlemesi bunu kullanır.
 * `sandbox="allow-scripts"`: allow-same-origin yok, kod botun kökenine, çerezine ve API'sine erişemez.
 */
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { alanVerisi, oturumaIsle, oturumIskeleti, srcdocOlustur, yuklemeAyrintisi, type OzelWidget, type SeOlay } from '../lib/ozelWidget.js';

export interface CerceveTutamagi {
  /** SE `onEventReceived` (ve oturum sayaçları değiştiyse `onSessionUpdate`) */
  olay(o: SeOlay): void;
}

interface Ozellik {
  w: OzelWidget;
  editorde?: boolean;
  /** SE_API.store.set — kalıcı yazma ana sayfanın işi */
  depoDegisti?: (depo: Record<string, unknown>) => void;
  className?: string;
}

export const OzelWidgetCercevesi = forwardRef<CerceveTutamagi, Ozellik>(function OzelWidgetCercevesi({ w, editorde = false, depoDegisti, className }, ref) {
  const cerceve = useRef<HTMLIFrameElement>(null);
  const oturum = useRef(oturumIskeleti());
  const depo = useRef<Record<string, unknown>>({ ...(w.depo || {}) });
  const fieldData = alanVerisi(w);
  const veriAnahtari = JSON.stringify(fieldData);
  // Yalnız kod ya da alan değeri değişince çerçeve yeniden kurulur (depo yazımı yeniden yüklemesin)
  const srcdoc = useMemo(() => srcdocOlustur(w, editorde), [w.html, w.css, w.js, veriAnahtari, editorde]); // eslint-disable-line react-hooks/exhaustive-deps
  const geri = useRef({ depoDegisti, fieldData });
  geri.current = { depoDegisti, fieldData };

  const gonder = (axtOlay: string, detail: unknown) => cerceve.current?.contentWindow?.postMessage({ axtOlay, detail }, '*');

  useImperativeHandle(ref, () => ({
    olay(o) {
      const once = oturum.current;
      oturum.current = oturumaIsle(once, o);
      gonder('onEventReceived', o);
      if (oturum.current !== once) gonder('onSessionUpdate', { session: oturum.current });
    }
  }));

  useEffect(() => {
    const dinle = (e: MessageEvent) => {
      const pencere = cerceve.current?.contentWindow;
      if (!pencere || e.source !== pencere) return;
      const m = e.data as { axtOzel?: number; tur?: string; id?: number; veri?: { k?: string; v?: unknown } };
      if (!m?.axtOzel || typeof m.veri?.k !== 'string') return;
      const k = m.veri.k;
      if (m.tur === 'depoOku') pencere.postMessage({ axtYanit: 1, id: m.id, deger: depo.current[k] ?? null }, '*');
      else if (m.tur === 'depoYaz') {
        depo.current = { ...depo.current, [k]: m.veri.v };
        geri.current.depoDegisti?.(depo.current);
      }
    };
    window.addEventListener('message', dinle);
    return () => window.removeEventListener('message', dinle);
  }, []);

  return (
    <iframe
      ref={cerceve}
      title={w.ad}
      srcDoc={srcdoc}
      sandbox="allow-scripts"
      allow="autoplay"
      referrerPolicy="no-referrer"
      className={className ?? 'fixed inset-0 w-full h-full border-0 bg-transparent'}
      onLoad={() => gonder('onWidgetLoad', yuklemeAyrintisi(geri.current.fieldData, oturum.current, editorde))}
    />
  );
});
