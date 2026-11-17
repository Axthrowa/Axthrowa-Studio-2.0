/**
 * AxBoT — Sesli komut dinleyicisi sayfası (/sesli-dinleyici)
 * Developed by AxthrowA
 *
 * Yalnız dinler: panel (AxthrowA Studio) bunu arka planda gizli tutar, böylece başka sekmedeyken ya da oyun
 * oynarken de komutlar çalışır. OBS'te özel tarayıcı dock'u olarak da açılabilir. `?otomatik=1`: ayarlarda sesli
 * komutlar açıksa kendiliğinden dinlemeye başlar. Üst pencere bas-konuş tuşunu `postMessage` ile bildirir.
 */
import { useEffect, useRef, useState } from 'react';
import { panelDinleyicisi, etkilesimdeSur } from '../lib/sesli/tekil.js';
import { KANAL_ADI, pttIletisi, type DinleyiciDurumu, type KanalMesaji } from '../lib/sesli/kapi.js';
import { wsAdresi } from '../lib/widget-style.js';

const DURUM_METNI: Record<DinleyiciDurumu, string> = {
  kapali: 'Kapalı',
  'model-yok': 'Model indirilmemiş',
  yukleniyor: 'Yükleniyor…',
  dinliyor: 'Dinliyor',
  hata: 'Hata',
  'baska-pencerede': 'Başka pencerede dinleniyor'
};

export default function SesliDinleyici() {
  const otomatik = new URLSearchParams(window.location.search).get('otomatik') === '1';
  const [durum, setDurum] = useState<DinleyiciDurumu>('kapali');
  const [mesaj, setMesaj] = useState('');
  const [seviye, setSeviye] = useState(0);
  const [basili, setBasili] = useState(false);
  const [kismi, setKismi] = useState('');
  const [son, setSon] = useState<{ metin: string; yanit?: { ok: boolean; mesaj: string } } | null>(null);
  const etkinRef = useRef(false);

  useEffect(() => {
    const d = panelDinleyicisi();
    const kanal = new BroadcastChannel(KANAL_ADI);
    kanal.onmessage = (e) => {
      const m = e.data as KanalMesaji;
      if (m.tur === 'durum') {
        setDurum(m.durum);
        if (m.mesaj !== undefined) setMesaj(m.mesaj);
        setSeviye(m.seviye ?? 0);
        setBasili(!!m.basili);
      } else if (m.tur === 'kismi') setKismi(m.metin);
      else if (m.tur === 'sonuc') {
        setKismi('');
        setSon({ metin: m.metin, yanit: m.yanit });
      }
    };

    const ayarla = (a: any, ilk = false) => {
      etkinRef.current = !!a?.etkin;
      d.secenekleriAyarla({ kip: a?.kip ?? 'ikisi', mikrofon: a?.mikrofon ?? '' });
      if (!a?.etkin) d.durdur();
      else if (otomatik || !ilk) {
        void d.baslat().then(() => {
          // Ses bağlamı kullanıcı etkileşimi bekliyorsa ilk tıkta sürsün
          if (d.durum === 'hata') etkilesimdeSur(() => void d.baslat());
        });
      }
    };
    void fetch('/api/sesli')
      .then((r) => r.json())
      .then((x) => ayarla(x.ayarlar, true))
      .catch(() => setMesaj('Sunucuya ulaşılamadı'));

    // Ayar değişince (panelden) anında uygula
    let ws: WebSocket | null = null;
    let kapandi = false;
    const baglan = () => {
      ws = new WebSocket(wsAdresi('sesli'));
      ws.onmessage = (e) => {
        try {
          const m = JSON.parse(String(e.data));
          if (m.type === 'sesli_ayarlar') {
            ayarla(m.ayarlar);
            void d.dilbilgisiYenile();
          }
          if (m.type === 'sesli_komutlar') void d.dilbilgisiYenile();
          if (m.type === 'sesli_model' && m.model?.durum === 'hazir' && etkinRef.current && d.durum === 'model-yok') void d.baslat();
        } catch {
          /* */
        }
      };
      ws.onclose = () => {
        if (!kapandi) setTimeout(baglan, 3000);
      };
    };
    baglan();

    // Üst pencere (panel) bas-konuş tuşunu bildirir
    const ileti = (e: MessageEvent) => {
      if (e.source !== window.parent) return;
      const b = pttIletisi(e.data);
      if (b !== null) d.basKonus(b);
    };
    window.addEventListener('message', ileti);

    return () => {
      kapandi = true;
      ws?.close();
      window.removeEventListener('message', ileti);
      kanal.close();
      d.yokEt();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const d = panelDinleyicisi();
  return (
    <div className="min-h-screen bg-[#0d1017] p-3 text-sm text-gray-200" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${durum === 'dinliyor' ? (basili ? 'bg-red-500' : 'bg-emerald-400') : durum === 'hata' ? 'bg-red-500' : 'bg-gray-500'}`} />
        <b data-durum={durum}>{DURUM_METNI[durum]}</b>
        {basili && <span className="rounded bg-red-500/20 px-1.5 text-xs text-red-300">BAS-KONUŞ</span>}
        <div className="ml-auto flex gap-1">
          {durum === 'dinliyor' ? (
            <button className="rounded bg-white/10 px-2 py-1 text-xs" onClick={() => d.durdur()}>
              Durdur
            </button>
          ) : (
            <button className="rounded bg-cyan-600 px-2 py-1 text-xs font-bold text-white" onClick={() => void d.baslat()}>
              Dinle
            </button>
          )}
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded bg-white/10">
        <div className="h-full bg-emerald-400 transition-[width] duration-100" style={{ width: `${Math.round(seviye * 100)}%` }} />
      </div>
      {mesaj && <p className="mt-2 text-xs text-gray-400">{mesaj}</p>}
      <p className="mt-2 min-h-[1.25rem] italic text-gray-400" data-kismi>
        {kismi}
      </p>
      {son && (
        <p className="mt-1 text-[12px]" data-son>
          “{son.metin}” {son.yanit ? <span className={son.yanit.ok ? 'text-emerald-300' : 'text-gray-500'}>→ {son.yanit.mesaj}</span> : null}
        </p>
      )}
      <button
        className={`mt-3 w-full select-none rounded-lg py-2 text-xs font-bold ${basili ? 'bg-red-600 text-white' : 'bg-white/10 text-gray-200'}`}
        onPointerDown={() => d.basKonus(true)}
        onPointerUp={() => d.basKonus(false)}
        onPointerLeave={() => basili && d.basKonus(false)}
      >
        Basılı tut ve konuş
      </button>
    </div>
  );
}
