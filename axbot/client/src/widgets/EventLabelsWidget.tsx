/**
 * AxBoT Event Labels
 * Developed by AxthrowA
 *
 * Son takipçi / abone / bağış / en büyük bağış / raid / KICKs etiketleri.
 * Eskiden: açılışta veri yoktu (her şey "—"), varsayılan kayan yazı + kalın
 * kontur metni okunmaz yapıyordu ve bir etiketi gizlemek şablon metnine
 * düzenli ifadeyle dokunarak yapılıyordu (şablon değişince bozuluyordu).
 * Artık her etiket ayrı bir parça: başlığı, rengi ve görünürlüğü ayrı ayarlanır;
 * son olaylar sunucudan (/api/event-labels) okunur, canlı olaylar üstüne yazar.
 */
import { kokOzellik } from '../lib/kabuklar.js';
import { animKimligi, hareketAnahtari, ortakHareket } from '../lib/animations.js';
import { kutuTasarimi } from '../lib/widget-style.js';
import { useEffect, useState } from 'react';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { LABELS_DEFAULTS } from '../lib/widget-defaults.js';
import { KaliciSoket } from '../lib/kaliciSoket.js';
import { onizlemeKipi, wsAdresi } from '../lib/widget-style.js';

interface Veri {
  sonTakip: string | null;
  sonAbone: string | null;
  sonBagis: { ad: string; tutar: number; birim: string } | null;
  enBuyukBagis: { ad: string; tutar: number; birim: string } | null;
  sonRaid: { ad: string; izleyici: number } | null;
  sonKicks: { ad: string; tutar: number } | null;
  /** Kick kanalının takipçi sayısı (sunucudan; yeni takipte +1) */
  takipciSayisi?: number | null;
}

const BOS: Veri = { sonTakip: null, sonAbone: null, sonBagis: null, enBuyukBagis: null, sonRaid: null, sonKicks: null };
const ORNEK: Veri = {
  sonTakip: 'KralGamer',
  sonAbone: 'AyseLive',
  sonBagis: { ad: 'ProPlayer', tutar: 50, birim: 'TL' },
  enBuyukBagis: { ad: 'Can_99', tutar: 250, birim: 'TL' },
  sonRaid: { ad: 'YayinUstasi', izleyici: 42 },
  sonKicks: { ad: 'Ece_Star', tutar: 100 },
  takipciSayisi: 1234
};

const sayi = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

export function EventLabelsWidget(props?: { embedded?: boolean; previewMode?: boolean }) {
  const s = useWidgetSettings('event-labels', LABELS_DEFAULTS);
  const onizleme = onizlemeKipi(props?.previewMode);
  const [v, setV] = useState<Veri>(onizleme ? ORNEK : BOS);

  useEffect(() => {
    if (onizleme) return;
    const yukle = () =>
      fetch('/api/event-labels')
        .then((r) => r.json())
        .then((d) => d && typeof d === 'object' && setV((o) => ({ ...o, ...d })))
        .catch(() => {});
    void yukle();
    const tekrar = window.setInterval(() => void yukle(), 60_000);
    const ws = new KaliciSoket(wsAdresi());
    ws.onyenidenbaglandi = () => void yukle();
    ws.onmessage = (e) => {
      let m: any;
      try {
        m = JSON.parse(String(e.data));
      } catch {
        return;
      }
      if (m?.type === 'event_labels_test') {
        setV(ORNEK);
        setTimeout(() => void yukle(), 8000);
        return;
      }
      if (m?.type !== 'alert' || m?.alert?.isTest) return;
      const d = m.data || {};
      const ad = String(d.displayName || d.display_name || d.username || '').slice(0, 60);
      if (!ad) return;
      const tur = String(m.subType || '');
      setV((o) => {
        if (tur === 'follow') return { ...o, sonTakip: ad, takipciSayisi: typeof o.takipciSayisi === 'number' ? o.takipciSayisi + 1 : o.takipciSayisi };
        if (tur === 'sub' || tur === 'gift_sub') return { ...o, sonAbone: ad };
        if (tur === 'tip') {
          const b = { ad, tutar: Number(d.amount) || 0, birim: String(d.currency || 'TL') };
          return { ...o, sonBagis: b, enBuyukBagis: !o.enBuyukBagis || b.tutar > o.enBuyukBagis.tutar ? b : o.enBuyukBagis };
        }
        if (tur === 'raid') return { ...o, sonRaid: { ad, izleyici: Number(d.viewers) || 0 } };
        if (tur === 'kicks') return { ...o, sonKicks: { ad, tutar: Number(d.amount) || 0 } };
        return o;
      });
    };
    return () => {
      window.clearInterval(tekrar);
      ws.close();
    };
  }, [onizleme]);

  const bosDeger = String(s.emptyValue ?? '—');
  const parcalar: Array<{ anahtar: string; baslik: string; deger: string }> = [];
  if (s.showFollow) parcalar.push({ anahtar: 'f', baslik: s.labelFollow, deger: v.sonTakip || bosDeger });
  if (s.showSub) parcalar.push({ anahtar: 's', baslik: s.labelSub, deger: v.sonAbone || bosDeger });
  if (s.showTip) parcalar.push({ anahtar: 't', baslik: s.labelTip, deger: v.sonBagis ? `${v.sonBagis.ad} (${sayi(v.sonBagis.tutar)} ${v.sonBagis.birim})` : bosDeger });
  if (s.showTop) parcalar.push({ anahtar: 'b', baslik: s.labelTop, deger: v.enBuyukBagis ? `${v.enBuyukBagis.ad} (${sayi(v.enBuyukBagis.tutar)} ${v.enBuyukBagis.birim})` : bosDeger });
  if (s.showRaid) parcalar.push({ anahtar: 'r', baslik: s.labelRaid, deger: v.sonRaid ? `${v.sonRaid.ad} (${v.sonRaid.izleyici} izleyici)` : bosDeger });
  if (s.showFollowers) parcalar.push({ anahtar: 'n', baslik: s.labelFollowers, deger: typeof v.takipciSayisi === 'number' ? v.takipciSayisi.toLocaleString('tr-TR') : bosDeger });
  if (s.showKicks) parcalar.push({ anahtar: 'k', baslik: s.labelKicks, deger: v.sonKicks ? `${v.sonKicks.ad} (${v.sonKicks.tutar} KICKs)` : bosDeger });

  const bg = `${s.backgroundColor}${Math.round(Number(s.backgroundOpacity) * 255).toString(16).padStart(2, '0')}`;
  const kayan = s.animation === 'marquee';
  const sutun = s.layout === 'column';
  const golge = s.textShadow ? '0 1px 3px rgba(0,0,0,.85)' : undefined;
  const kontur = s.outlineEnabled ? `${s.outlineWidth}px ${s.outlineColor}` : undefined;

  const icerik = parcalar.map((p, i) => (
    <span key={`${p.anahtar}${i}`} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap', maxWidth: kayan ? undefined : '100%' }}>
      {!sutun && i > 0 && <span style={{ color: s.labelColor, opacity: 0.6, margin: '0 10px', flexShrink: 0 }}>{s.separator}</span>}
      <span style={{ color: s.labelColor, fontWeight: 600, fontSize: Number(s.fontSize) * 0.85, flexShrink: 0 }}>{p.baslik}</span>
      {/* Kaynaktan geniş tek etiket: değer "…" ile kısalır */}
      <span style={{ color: s.fontColor, fontWeight: s.fontWeight, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.deger}</span>
    </span>
  ));

  return (
    <div {...kokOzellik(s)} style={{
      overflow: 'hidden',
      background: bg,
      borderRadius: s.borderRadius,
      ...kutuTasarimi(s), ...ortakHareket(s, { giris: false }),
      minHeight: s.height,
      padding: sutun ? `10px ${s.paddingX}px` : `0 ${s.paddingX}px`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: s.align === 'right' ? 'flex-end' : s.align === 'center' ? 'center' : 'flex-start'
    }}>
      <div
        key={hareketAnahtari(s)}
        className={kayan ? 'axt-marquee' : `axt-anim-${animKimligi(String(s.animation || 'fade'))}`}
        style={{
          display: 'flex',
          flexDirection: sutun ? 'column' : 'row',
          alignItems: sutun ? 'flex-start' : 'center',
          gap: sutun ? 6 : 0,
          // Dar kaynakta yan yana sığmayan etiket alta geçer; kayan yazı tek satırda kalır
          flexWrap: !sutun && !kayan ? 'wrap' : undefined,
          maxWidth: kayan ? undefined : '100%',
          rowGap: 4,
          whiteSpace: 'nowrap',
          fontFamily: s.fontFamily,
          fontSize: s.fontSize,
          letterSpacing: s.letterSpacing,
          textTransform: s.textTransform as any,
          textShadow: golge,
          WebkitTextStroke: kontur,
          paintOrder: 'stroke fill',
          animationDuration: kayan ? `${s.marqueeSpeed}s` : `${Math.max(0, Number(s.animationDuration) || 600)}ms`
        }}
      >
        {icerik}
        {/* Kayan yazıda boşluksuz döngü için ikinci kopya */}
        {kayan && <span style={{ display: 'inline-flex', marginLeft: 40 }}>{icerik}</span>}
      </div>
    </div>
  );
}

export default EventLabelsWidget;
