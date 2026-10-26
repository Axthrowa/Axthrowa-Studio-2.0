/**
 * StreamAxT Jenerik (kapanış) widget
 * Developed by AxthrowA
 *
 * Panelden başlıklar, bölümler, kaydırma hızı ve renkler ayarlanır. Eski
 * sürümde her bölümün altında SABİT sahte isimler vardı ("StreamQueen •
 * ProGamer34 • KralOyuncu") — gerçek yayında da görünüyordu. Artık örnek
 * isimler yalnız `?preview=1` kipinde çıkar, boş bölüm gizlenir ve kaydırma
 * süresi ayardan gelir.
 */
import { useState, useEffect, useRef } from 'react';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { END_CREDITS_DEFAULTS } from '../lib/widget-defaults.js';
import { rgba, onizlemeKipi , wsAdresi } from '../lib/widget-style.js';
import { KaliciSoket } from '../lib/kaliciSoket.js';

export interface EndCreditsWidgetProps {
  embedded?: boolean;
  previewMode?: boolean;
}

type Olay = {
  event_type?: string;
  username?: string;
  display_name?: string;
  amount?: number;
  currency?: string;
};

const ORNEK: Olay[] = [
  { event_type: 'sub', display_name: 'StreamQueen' },
  { event_type: 'sub', display_name: 'ProGamer34' },
  { event_type: 'sub', display_name: 'KralOyuncu' },
  { event_type: 'tip', display_name: 'ApexLegend', amount: 100, currency: '₺' },
  { event_type: 'tip', display_name: 'YildizKullanici', amount: 50, currency: '₺' },
  { event_type: 'follow', display_name: 'GamerBoy' },
  { event_type: 'follow', display_name: 'EfsaneGamer' },
  { event_type: 'follow', display_name: 'Kartal34' },
  { event_type: 'raid', display_name: 'BuyukKanal' }
];

export function EndCreditsWidget({ embedded = false, previewMode = false }: EndCreditsWidgetProps) {
  const s = useWidgetSettings('end-credits', END_CREDITS_DEFAULTS);
  const onizleme = onizlemeKipi(previewMode);
  const [events, setEvents] = useState<Olay[]>(onizleme ? ORNEK : []);
  // Kaydırmayı baştan başlatmak için anahtar (credits_start gelince artar)
  const [tur, setTur] = useState(0);
  const ayarRef = useRef(s);
  ayarRef.current = s;

  useEffect(() => {
    if (onizleme) return;
    const yukle = () =>
      fetch(`/api/events?saat=${Math.max(1, Number(ayarRef.current.taranacakSaat) || 12)}`)
        .then((r) => r.json())
        .then((d) => setEvents(Array.isArray(d) ? d : []))
        .catch(() => {});
    yukle();
    // Widget "Test" düğmesi ve yayın sonu komutu `credits_start` yayınlar;
    // eskiden dinlenmiyordu, jenerik yalnız sayfa açılışında bir kez akıyordu.
    const ws = new KaliciSoket(wsAdresi());
    ws.onmessage = (ev) => {
      try {
        const m = JSON.parse(ev.data);
        if (m.type === 'credits_start') {
          yukle();
          setTur((x) => x + 1);
        }
      } catch {
        /* bozuk mesaj */
      }
    };
    return () => ws.close();
  }, [onizleme]);

  const tavan = Math.max(1, Number(s.maxPerSection) || 15);
  // Test uyarıları jeneriğe girmez; hediye abonelikler abonelerle birlikte sayılır
  const gercek = events.filter((e) => !String((e as any).metadata || '').includes('"isTest":true'));
  // Hediye abonelikler abonelerle, KICKs destekçilerle birlikte sayılır
  const sec = (tur: string) =>
    gercek
      .filter((e) => e.event_type === tur || (tur === 'sub' && e.event_type === 'gift_sub') || (tur === 'tip' && e.event_type === 'kicks'))
      .slice(0, tavan);

  const bolumler = [
    { ac: !!s.showSubs, baslik: `⭐ ${s.titleSubs}`, renk: s.accentColor2, veri: sec('sub'), tutar: false },
    { ac: !!s.showTips, baslik: `💰 ${s.titleTips}`, renk: s.accentColor, veri: sec('tip'), tutar: true },
    { ac: !!s.showFollows, baslik: `🎉 ${s.titleFollows}`, renk: s.accentColor2, veri: sec('follow'), tutar: false },
    { ac: !!s.showRaids, baslik: `🚀 ${s.titleRaids}`, renk: s.accentColor, veri: sec('raid'), tutar: false }
  ].filter((b) => b.ac && (!s.hideEmpty || b.veri.length > 0));

  const sure = Math.max(5, Number(s.scrollSeconds) || 35);
  const boy = Number(s.fontSize) || 16;

  return (
    <div
      className={
        embedded
          ? 'w-full h-full overflow-hidden relative font-sans select-none flex justify-center text-center'
          : 'w-screen h-screen overflow-hidden relative font-sans select-none flex justify-center text-center'
      }
      style={{ background: rgba(s.bgColor, s.bgOpacity), fontFamily: s.fontFamily, color: s.textColor }}
    >
      <div
        key={tur}
        className="absolute bottom-0 w-full flex flex-col items-center"
        style={{
          maxWidth: 640,
          gap: Number(s.gap) || 48,
          padding: '64px 0',
          animation: `streamaxtCredits ${sure}s linear ${s.loop ? 'infinite' : '1 forwards'}`
        }}
      >
        <div className="space-y-2">
          <div className="font-black tracking-wider" style={{ fontSize: Number(s.titleSize) || 44, color: s.accentColor }}>
            {s.title}
          </div>
          <div className="font-mono" style={{ fontSize: boy * 0.8, opacity: 0.65 }}>
            {s.subtitle}
          </div>
        </div>

        {bolumler.map((b) => (
          <div key={b.baslik} className="space-y-4 w-full">
            <div
              className="font-bold tracking-widest uppercase pb-1"
              style={{
                fontSize: boy * 1.1,
                color: b.renk,
                borderBottom: `1px solid ${rgba(b.renk, 0.3)}`
              }}
            >
              {b.baslik}
            </div>
            <div className="font-semibold space-y-1" style={{ fontSize: boy }}>
              {b.veri.map((e, i) => (
                <div key={`${e.username || e.display_name}-${i}`}>
                  {e.display_name || e.username}
                  {b.tutar && s.showAmounts && e.amount ? ` (${e.amount} ${e.currency || (e.event_type === 'kicks' ? 'KICKs' : '₺')})` : ''}
                </div>
              ))}
            </div>
          </div>
        ))}

        {s.showFooter && (
          <div className="pt-8 font-mono" style={{ fontSize: boy * 0.7, opacity: 0.45 }}>
            {s.footer}
          </div>
        )}
      </div>

      <style>{`
        @keyframes streamaxtCredits {
          0% { transform: translateY(100vh); }
          100% { transform: translateY(-120%); }
        }
      `}</style>
    </div>
  );
}

export default EndCreditsWidget;
