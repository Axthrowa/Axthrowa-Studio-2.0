/**
 * WID-1: özel widget'ın OBS katmanı — /widgets/ozel?id=ozel-xxxx
 * Bot olayları (sohbet, takip, abone, bağış, raid…) SE `onEventReceived` olarak çerçeveye geçer;
 * editörde kaydedince ayar kanalıyla yeniden kurulur.
 */
import { useRef } from 'react';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { useWidgetSoketi } from '../hooks/useWidgetCalismasi.js';
import { BOS_WIDGET, seOlayinaCevir, type OzelWidget } from '../lib/ozelWidget.js';
import { OzelWidgetCercevesi, type CerceveTutamagi } from './OzelWidgetCercevesi.js';

export const OZEL_KIMLIK = /^ozel-[a-z0-9]{4,20}$/;

export default function OzelWidgetSayfasi() {
  const id = new URLSearchParams(window.location.search).get('id') ?? '';
  const gecerli = OZEL_KIMLIK.test(id);
  const w = useWidgetSettings<OzelWidget & Record<string, any>>(gecerli ? id : 'ozel-yok', { ...BOS_WIDGET, html: '', css: '', js: '' });
  const cerceve = useRef<CerceveTutamagi>(null);
  useWidgetSoketi('all', {
    acik: gecerli,
    onMesaj: (m) => {
      const o = seOlayinaCevir(m);
      if (o) cerceve.current?.olay(o);
    }
  });
  if (!gecerli) return <div data-katman-bos="" />;
  return (
    <OzelWidgetCercevesi
      ref={cerceve}
      w={w}
      depoDegisti={(depo) =>
        void fetch(`/api/widgets/${id}/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ depo }) }).catch(() => {})
      }
    />
  );
}
