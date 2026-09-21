/**
 * StreamAxT Subathon sayacı
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
import { rgba, onizlemeKipi, wsAdresi } from '../lib/widget-style.js';

export interface SubathonWidgetProps {
  embedded?: boolean;
  previewMode?: boolean;
}

interface SunucuDurumu {
  aktif: boolean;
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
  };
}

/** Bağış/KICKs tutarını dakikaya çevirir — sunucudaki kuralın aynısı. */
export function birimDakikasi(tutar: number, dakika: number, birim: number): number {
  const b = Math.max(1, Number(birim) || 1);
  const adet = Math.floor(Math.max(0, Number(tutar) || 0) / b);
  return adet * Math.max(0, Number(dakika) || 0);
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
    setKalan(d.aktif ? Math.max(0, Math.round((d.bitisAni - Date.now()) / 1000)) : 0);

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

    const ws = new WebSocket(wsAdresi());
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'subathon_state' && msg.data) durumuUygula(msg.data);
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

  return (
    <div
      className={
        embedded
          ? 'w-full h-full bg-transparent p-0 flex flex-col justify-start items-center gap-2 select-none font-sans'
          : 'w-screen h-screen bg-transparent p-6 flex flex-col justify-start items-center gap-2 select-none font-sans'
      }
    >
      <div
        className={`backdrop-blur-xl border-2 p-4 rounded-2xl flex flex-col items-center ${
          embedded ? 'w-full justify-center' : 'min-w-[320px]'
        }`}
        style={{
          background: rgba('#000000', 0.85),
          borderColor: s.accentColor,
          boxShadow: `0 10px 35px ${rgba(s.accentColor, 0.33)}`
        }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`w-2.5 h-2.5 rounded-full ${durum.aktif ? 'animate-ping' : ''}`}
            style={{ background: durum.aktif ? '#34d399' : '#6b7280' }}
          />
          <h2 className="text-[11px] font-black uppercase tracking-widest font-mono" style={{ color: s.accentColor }}>
            {s.title} {durum.aktif ? 'CANLI SAYAÇ' : 'DURAKLADI'}
          </h2>
        </div>

        <div
          className={`${
            embedded ? 'text-3xl lg:text-4xl' : 'text-5xl md:text-6xl'
          } font-black font-mono tracking-tight text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] my-1`}
        >
          {sureYaz(kalan)}
        </div>

        {/* Kurallar sunucudaki AYARDAN okunur; widget'ın kendi kopyası yok. */}
        <div className="flex flex-wrap justify-center items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-400 font-medium">
          <span>
            Abone: <strong style={{ color: s.accentColor }}>+{a.aboneDakika} dk</strong>
          </span>
          <span>•</span>
          <span>
            Hediye abone: <strong className="text-amber-300">+{a.hediyeAboneDakika} dk</strong>
          </span>
          <span>•</span>
          <span>
            Bağış: <strong className="text-emerald-300">+{a.bagisDakika} dk / {a.bagisBirimi}</strong>
          </span>
          <span>•</span>
          <span>
            KICKs: <strong style={{ color: '#53fc18' }}>+{a.kicksDakika} dk / {a.kicksBirimi}</strong>
          </span>
        </div>

        {s.showTotalAdded && durum.eklenenSaniye > 0 && (
          <div className="mt-1 text-[10px] text-gray-500">Bu yayında eklenen: {sureYaz(durum.eklenenSaniye)}</div>
        )}
      </div>

      {/* Bildirim kartın ALTINDA, akışın içinde — sayacı kapatmaz. */}
      {bildirim && (
        <div
          className="px-4 py-1.5 rounded-full text-xs font-black text-white shadow-xl animate-bounce"
          style={{ background: `linear-gradient(90deg, ${s.accentColor}, ${s.accentColor2})` }}
        >
          🎉 {bildirim}
        </div>
      )}
    </div>
  );
}

export default SubathonWidget;
