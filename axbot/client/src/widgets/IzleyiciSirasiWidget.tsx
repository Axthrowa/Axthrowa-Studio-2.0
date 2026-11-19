/**
 * AxBoT İzleyici Sırası widget'ı — "benimle oyna" kuyruğunu ekranda gösterir.
 * Developed by AxthrowA
 *
 * Kuyruk komutları vardı (`!joinq`, `!nextq` …) ama sıra yalnız panelde görünüyordu. Sunucu her
 * değişiklikte `kuyruk_durumu` yayınlar; bu katman yoklama yapmadan anında güncellenir. Yeni gelen
 * satır kısaca kayarak girer.
 */
import { useEffect, useState } from 'react';
import { kokOzellik } from '../lib/kabuklar.js';
import { hareketAz } from '../lib/hareket.js';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { IZLEYICI_SIRASI_DEFAULTS } from '../lib/widget-defaults.js';
import { PlatformLogo } from '../components/PlatformLogo.js';
import { onizlemeMi, renkSaydam, sadeKart } from '../lib/sadeKart.js';

export type SiraKaydi = { kullanici: string; gorunenAd: string; platform: string; oncelikli?: boolean };
type Durum = { liste: SiraKaydi[]; acik: boolean };

const ORNEK: Durum = {
  acik: true,
  liste: [
    { kullanici: 'zeynep', gorunenAd: 'zeynep', platform: 'kick', oncelikli: true },
    { kullanici: 'mert', gorunenAd: 'mert', platform: 'twitch' },
    { kullanici: 'ece', gorunenAd: 'ece', platform: 'youtube' },
    { kullanici: 'kaan', gorunenAd: 'kaan', platform: 'kick' }
  ]
};

/** Sunucu iletisinden güvenli durum (eksik alanlar boş sayılır) */
export function siraDurumu(veri: any): Durum {
  const liste = Array.isArray(veri?.liste) ? veri.liste : [];
  return {
    acik: Boolean(veri?.ayar?.acik),
    liste: liste
      .filter((k: any) => k && typeof k.kullanici === 'string')
      .map((k: any) => ({ kullanici: k.kullanici, gorunenAd: String(k.gorunenAd || k.kullanici).slice(0, 40), platform: String(k.platform || ''), oncelikli: Boolean(k.oncelikli) }))
  };
}

export function IzleyiciSirasiWidget({ embedded = false, previewMode = false }: { embedded?: boolean; previewMode?: boolean }) {
  const s = useWidgetSettings('izleyici-sirasi', IZLEYICI_SIRASI_DEFAULTS);
  const { lastMessage } = useWebSocket('all');
  const onizleme = onizlemeMi(previewMode);
  const [d, setD] = useState<Durum>(onizleme ? ORNEK : { acik: false, liste: [] });

  useEffect(() => {
    if (onizleme) return;
    fetch('/api/overlay/kuyruk')
      .then((r) => (r.ok ? r.json() : null))
      .then((x) => x && setD(siraDurumu(x)))
      .catch(() => {});
  }, [onizleme]);

  useEffect(() => {
    if (lastMessage?.type !== 'kuyruk_durumu' || !lastMessage.data) return;
    if (onizleme && !lastMessage.test) return;
    setD(siraDurumu(lastMessage.data));
  }, [lastMessage, onizleme]);

  const enCok = Math.max(1, Math.min(20, Number(s.enCok) || 6));
  const gorunen = d.liste.slice(0, enCok);
  const kalan = d.liste.length - gorunen.length;
  const gizli = !onizleme && ((s.kapaliysaGizle && !d.acik) || (s.bosGizle && !d.liste.length));
  const boyut = Math.max(10, Number(s.fontSize) || 18);
  const vurgu = String(s.accentColor || '#22d3ee');
  const hareket = !hareketAz();

  return (
    <div
      className={embedded ? 'w-full h-full flex items-start justify-center' : 'w-screen h-screen bg-transparent p-4 flex items-start justify-start'}
      data-katman-bos={gizli ? '' : undefined}
    >
      <style>{`@keyframes axt-sira-gir{from{opacity:0;transform:translateX(-14px)}to{opacity:1;transform:none}}`}</style>
      <div
        {...kokOzellik(s)}
        style={{ ...sadeKart(s), width: Number(s.genislik) || 340, padding: boyut * 0.8, fontSize: boyut, visibility: gizli ? 'hidden' : undefined }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: boyut * 0.6 }}>
          <span style={{ fontWeight: 900, fontSize: boyut * 1.05 }}>{s.title || 'İzleyici sırası'}</span>
          <span
            style={{
              fontSize: boyut * 0.65,
              fontWeight: 800,
              padding: '3px 9px',
              borderRadius: 999,
              background: d.acik ? renkSaydam('#22c55e', 0.2) : renkSaydam('#ffffff', 0.08),
              color: d.acik ? '#86efac' : renkSaydam('#ffffff', 0.6)
            }}
          >
            {d.acik ? `Açık · ${s.katilmaKomutu || '!joinq'}` : 'Kapalı'}
          </span>
        </div>
        {!gorunen.length ? (
          <div style={{ opacity: 0.6, fontSize: boyut * 0.85 }}>{d.acik ? `Sıra boş — ${s.katilmaKomutu || '!joinq'} yaz` : 'Sıra şu an kapalı'}</div>
        ) : (
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: boyut * 0.35 }}>
            {gorunen.map((k, i) => (
              <li
                key={k.kullanici}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: boyut * 0.5,
                  padding: `${boyut * 0.3}px ${boyut * 0.45}px`,
                  borderRadius: 10,
                  background: i === 0 ? renkSaydam(vurgu, 0.18) : renkSaydam('#ffffff', 0.05),
                  animation: hareket ? 'axt-sira-gir .35s ease-out both' : undefined
                }}
              >
                <span style={{ width: boyut * 1.4, fontWeight: 900, color: i === 0 ? vurgu : renkSaydam('#ffffff', 0.55), fontVariantNumeric: 'tabular-nums' }}>{i + 1}.</span>
                {s.platformGoster !== false && k.platform && <PlatformLogo platform={k.platform} size={Math.round(boyut * 0.9)} />}
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: i === 0 ? 800 : 600 }}>{k.gorunenAd}</span>
                {k.oncelikli && <span title="Öncelikli" style={{ fontSize: boyut * 0.75 }}>⭐</span>}
              </li>
            ))}
          </ol>
        )}
        {kalan > 0 && <div style={{ marginTop: boyut * 0.5, opacity: 0.6, fontSize: boyut * 0.75 }}>+{kalan} kişi daha</div>}
      </div>
    </div>
  );
}

export default IzleyiciSirasiWidget;
