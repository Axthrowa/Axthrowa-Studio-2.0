/**
 * AxBoT Subathon sayacı
 * Developed by AxthrowA
 *
 * Sayaç artık SUNUCUDA tutuluyor (`server/src/modules/subathon`). Bu widget
 * yalnız gösterir.
 *
 * Neden değişti: sayaç tarayıcıda yaşarken iki OBS kaynağı açıldığında iki
 * FARKLI süre görünüyordu, panel sayacı göremiyordu ve KICKs olayı veri
 * yolunda hiç olmadığı için asla eklenmiyordu. Süre artışı kuralları
 * (abone / hediye abone / bağış / KICKs) panelden ayarlanır ve olaylar
 * otomatik işlenir.
 */
import { useEffect, useRef, useState } from 'react';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { SUBATHON_DEFAULTS } from '../lib/widget-defaults.js';
import { kutuTasarimi, rgba, onizlemeKipi, wsAdresi } from '../lib/widget-style.js';
import { KaliciSoket } from '../lib/kaliciSoket.js';

export interface SubathonWidgetProps {
  embedded?: boolean;
  previewMode?: boolean;
}

interface SunucuDurumu {
  aktif: boolean;
  duraklatildi?: boolean;
  bitisAni: number;
  kalanSaniye: number;
  eklenenSaniye: number;
  sonEkleme: { metin: string; saniye: number; zaman: number } | null;
  ayar: {
    aboneDakika: number;
    hediyeAboneDakika: number;
    bagisDakika: number;
    bagisBirimi: number;
    kicksDakika: number;
    kicksBirimi: number;
    takipDakika?: number;
    aboneAcik?: boolean;
    hediyeAcik?: boolean;
    bagisAcik?: boolean;
    kicksAcik?: boolean;
    takipAcik?: boolean;
  };
}

export function sureYaz(toplamSn: number): string {
  const t = Math.max(0, Math.floor(toplamSn));
  const sa = Math.floor(t / 3600);
  const dk = Math.floor((t % 3600) / 60);
  const sn = t % 60;
  return `${String(sa).padStart(2, '0')}:${String(dk).padStart(2, '0')}:${String(sn).padStart(2, '0')}`;
}

const ONIZLEME: SunucuDurumu = {
  aktif: true,
  bitisAni: Date.now() + 13520 * 1000,
  kalanSaniye: 13520,
  eklenenSaniye: 1800,
  sonEkleme: { metin: '+5 dk · abone (Can_Stream)', saniye: 300, zaman: Date.now() },
  ayar: { aboneDakika: 5, hediyeAboneDakika: 5, bagisDakika: 10, bagisBirimi: 50, kicksDakika: 1, kicksBirimi: 100 }
};

export function SubathonWidget({ embedded = false, previewMode = false }: SubathonWidgetProps) {
  const s = useWidgetSettings('subathon', SUBATHON_DEFAULTS);
  const onizleme = onizlemeKipi(previewMode);

  const [durum, setDurum] = useState<SunucuDurumu | null>(onizleme ? ONIZLEME : null);
  const [kalan, setKalan] = useState(onizleme ? 13520 : 0);
  const [bildirim, setBildirim] = useState<string | null>(onizleme ? ONIZLEME.sonEkleme!.metin : null);
  const bildirimZaman = useRef<NodeJS.Timeout | null>(null);
  const sonBildirimAni = useRef(0);

  const durumuUygula = (d: SunucuDurumu) => {
    setDurum(d);
    // Kalan süreyi bitiş anından hesapla: sunucu ile arada gecikme olsa bile
    // widget doğru saniyede kalır.
    // Duraklatılmışken saklı kalan süre görünür (00:00 değil)
    setKalan(d.aktif ? Math.max(0, Math.round((d.bitisAni - Date.now()) / 1000)) : Math.max(0, Number(d.kalanSaniye) || 0));

    if (d.sonEkleme && d.sonEkleme.zaman > sonBildirimAni.current) {
      sonBildirimAni.current = d.sonEkleme.zaman;
      setBildirim(d.sonEkleme.metin);
      if (bildirimZaman.current) clearTimeout(bildirimZaman.current);
      bildirimZaman.current = setTimeout(() => setBildirim(null), Math.max(1000, Number(s.notifyMs) || 4000));
    }
  };

  useEffect(() => {
    if (onizleme) return;

    fetch('/api/subathon')
      .then((r) => r.json())
      .then((d) => d && durumuUygula(d))
      .catch(() => {});

    const ws = new KaliciSoket(wsAdresi());
    // Kopukken kaçan süre/ekleme: bağlantı gelince sayacı sunucudan tazele
    ws.onyenidenbaglandi = () => {
      fetch('/api/subathon')
        .then((r) => r.json())
        .then((d) => d && durumuUygula(d))
        .catch(() => {});
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'subathon_state' && msg.data) {
          durumuUygula(msg.data);
          // Widget "Test" düğmesi örnek durum gönderir; birkaç saniye sonra
          // gerçek sayaca dönülür (gerçek süre değişmez).
          if (msg.data.test) {
            setTimeout(() => {
              fetch('/api/subathon')
                .then((r) => r.json())
                .then((d) => d && durumuUygula(d))
                .catch(() => {});
            }, 8000);
          }
        }
      } catch {
        /* bozuk mesaj */
      }
    };
    return () => {
      ws.close();
      if (bildirimZaman.current) clearTimeout(bildirimZaman.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onizleme]);

  // Yerel geri sayım: sunucu 5 saniyede bir yayın yapar, arada widget sayar.
  useEffect(() => {
    if (!durum?.aktif) return;
    const t = setInterval(() => setKalan((p) => Math.max(0, p - 1)), 1000);
    return () => clearInterval(t);
  }, [durum?.aktif]);

  if (!durum) return null;
  if (!durum.aktif && s.hideWhenIdle) return null;

  const a = durum.ayar;
  const tema = String(s.theme || 'card');
  const vurgu = s.accentColor;
  const metinRengi = s.textColor || '#ffffff';
  const sure = sureYaz(kalan);
  const sureBoy = Math.max(16, Number(s.timeFontSize) || 56) * (embedded ? 0.7 : 1);
  const golge = '0 3px 6px rgba(0,0,0,.95), 0 0 14px rgba(0,0,0,.6)';

  // Süre gösterimi temaya göre: düz yazı, LCD hücreleri ya da çevirmeli kartlar
  const sureGosterimi =
    tema === 'flip' || tema === 'digital' ? (
      <div className="flex items-center gap-1 my-1" style={{ fontFamily: s.timeFontFamily }}>
        {sure.split('').map((c, i) =>
          c === ':' ? (
            <span key={i} style={{ fontSize: sureBoy * 0.8, color: vurgu, fontWeight: 900, textShadow: golge }}>:</span>
          ) : (
            <span
              key={i}
              className="relative inline-flex items-center justify-center font-black"
              style={
                tema === 'flip'
                  ? {
                      width: sureBoy * 0.72,
                      height: sureBoy * 1.15,
                      fontSize: sureBoy,
                      borderRadius: 8,
                      color: metinRengi,
                      background: `linear-gradient(180deg, ${rgba(s.bgColor, 1)} 0 49%, ${rgba('#000000', 1)} 49% 51%, ${rgba(s.bgColor, 0.85)} 51%)`,
                      boxShadow: `0 4px 10px rgba(0,0,0,.6), inset 0 0 0 1px ${rgba(vurgu, 0.5)}`
                    }
                  : {
                      width: sureBoy * 0.66,
                      height: sureBoy * 1.1,
                      fontSize: sureBoy,
                      borderRadius: 4,
                      color: vurgu,
                      background: rgba('#000000', 0.75),
                      textShadow: `0 0 10px ${vurgu}, 0 0 22px ${rgba(vurgu, 0.6)}`,
                      boxShadow: `inset 0 0 12px ${rgba(vurgu, 0.18)}`
                    }
              }
            >
              {c}
            </span>
          )
        )}
      </div>
    ) : (
      <div
        className="font-black tracking-tight my-1"
        style={{
          fontFamily: s.timeFontFamily,
          fontSize: sureBoy,
          lineHeight: 1.05,
          color: metinRengi,
          textShadow: tema === 'neon' ? `0 0 8px ${vurgu}, 0 0 22px ${vurgu}, 0 0 42px ${rgba(vurgu, 0.7)}` : golge
        }}
      >
        {sure}
      </div>
    );

  const durumSatiri = s.showStatus !== false && (
    <div className="flex items-center gap-2 mb-1">
      {s.showStatusDot !== false && <span className={`w-2.5 h-2.5 rounded-full ${durum.aktif ? 'animate-ping' : ''}`} style={{ background: durum.aktif ? '#34d399' : '#6b7280' }} />}
      <h2 className="font-black uppercase tracking-widest" style={{ color: vurgu, fontFamily: s.fontFamily, fontSize: Number(s.statusFontSize) || 12, textShadow: golge }}>
        {s.icon ? `${s.icon} ` : ''}
        {[s.title, durum.aktif ? s.statusLiveText : durum.duraklatildi ? s.statusPausedText : s.statusIdleText].filter(Boolean).join(' ')}
      </h2>
    </div>
  );

  // Kurallar sunucudaki AYARDAN okunur; widget'ın kendi kopyası yok.
  const kuralListesi = [
    a.aboneAcik !== false && <>Abone: <strong style={{ color: vurgu }}>+{a.aboneDakika} dk</strong></>,
    a.hediyeAcik !== false && <>Hediye abone: <strong className="text-amber-300">+{a.hediyeAboneDakika} dk</strong></>,
    a.bagisAcik !== false && <>Bağış: <strong className="text-emerald-300">+{a.bagisDakika} dk / {a.bagisBirimi}</strong></>,
    a.kicksAcik !== false && <>KICKs: <strong style={{ color: '#53fc18' }}>+{a.kicksDakika} dk / {a.kicksBirimi}</strong></>,
    a.takipAcik !== false && (a.takipDakika ?? 0) > 0 && <>Takip: <strong style={{ color: '#a78bfa' }}>+{a.takipDakika} dk</strong></>
  ].filter(Boolean);
  const kurallar = s.showRules !== false && kuralListesi.length > 0 && (
    <div className="flex flex-wrap justify-center items-center gap-x-2 gap-y-0.5 text-[11px] font-semibold" style={{ color: rgba(metinRengi, 0.8), textShadow: golge }}>
      {kuralListesi.map((k, i) => (
        <span key={i}>
          {i > 0 && <span className="mr-2">•</span>}
          {k}
        </span>
      ))}
    </div>
  );

  const kutuStili: React.CSSProperties =
    kutuTasarimi(s) ||
    (tema === 'minimal'
      ? {}
      : tema === 'cam'
        ? { background: rgba(s.bgColor, Math.min(0.35, Number(s.bgOpacity))), border: `1px solid ${rgba('#ffffff', 0.3)}`, borderRadius: Number(s.radius), boxShadow: '0 10px 30px rgba(0,0,0,.35)' }
      : tema === 'plaka'
        ? { background: rgba(s.bgColor, s.bgOpacity), borderBottom: `5px solid ${vurgu}`, borderRadius: 6, boxShadow: '0 8px 20px rgba(0,0,0,.5)' }
      : tema === 'serit'
        ? { background: `linear-gradient(90deg, ${rgba(vurgu, 0.85)}, ${rgba(s.bgColor, s.bgOpacity)} 45%)`, borderLeft: `6px solid ${s.accentColor2 || vurgu}`, borderRadius: 4 }
      : tema === 'neon'
        ? { background: rgba(s.bgColor, s.bgOpacity), border: `2px solid ${vurgu}`, borderRadius: Number(s.radius), boxShadow: `0 0 18px ${vurgu}, inset 0 0 18px ${rgba(vurgu, 0.35)}` }
        : { background: rgba(s.bgColor, s.bgOpacity), border: `2px solid ${vurgu}`, borderRadius: Number(s.radius), boxShadow: `0 10px 35px ${rgba(vurgu, 0.33)}` });

  return (
    <div
      className={
        embedded
          ? 'w-full h-full bg-transparent p-0 flex flex-col justify-start items-center gap-2 select-none'
          : 'w-screen h-screen bg-transparent p-6 flex flex-col justify-start items-center gap-2 select-none'
      }
      style={{ fontFamily: s.fontFamily }}
    >
      {tema === 'pill' || tema === 'serit' ? (
        <div className="flex items-center gap-3 px-5 py-2" style={{ ...kutuStili, ...(tema === 'pill' ? { borderRadius: 999 } : null) }}>
          <span style={{ fontSize: sureBoy * 0.55 }}>{s.icon || '⏳'}</span>
          <span className="font-black uppercase tracking-widest" style={{ color: vurgu, fontSize: Math.max(11, sureBoy * 0.28), textShadow: golge }}>{s.title}</span>
          <span className="font-black" style={{ fontFamily: s.timeFontFamily, fontSize: sureBoy * 0.6, color: metinRengi, textShadow: golge }}>{sure}</span>
        </div>
      ) : (
        <div className={`p-4 flex flex-col items-center ${tema === 'minimal' ? '' : 'backdrop-blur-xl'} ${embedded ? 'w-full justify-center' : 'min-w-[320px]'}`} style={kutuStili}>
          {durumSatiri}
          {sureGosterimi}
          {kurallar}
          {s.showTotalAdded && durum.eklenenSaniye > 0 && (
            <div className="mt-1 text-[10px]" style={{ color: rgba(metinRengi, 0.6), textShadow: golge }}>{s.totalAddedLabel ? `${s.totalAddedLabel}: ` : ''}{sureYaz(durum.eklenenSaniye)}</div>
          )}
        </div>
      )}

      {/* Bildirim kartın ALTINDA, akışın içinde — sayacı kapatmaz. */}
      {bildirim && (
        <div
          className="px-4 py-1.5 rounded-full text-xs font-black text-white shadow-xl animate-bounce"
          style={{ background: `linear-gradient(90deg, ${vurgu}, ${s.accentColor2})`, textShadow: golge }}
        >
          🎉 {bildirim}
        </div>
      )}
    </div>
  );
}

export default SubathonWidget;
