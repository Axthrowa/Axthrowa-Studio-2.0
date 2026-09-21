/**
 * StreamAxT Subathon sayacı
 * Developed by AxthrowA
 *
 * Olaylar (abone, hediye abone, bağış) süreye OTOMATİK eklenir; kaç dakika
 * ekleneceği panelden ayarlanır. Eski sürümde bu değerler yalnız adres
 * satırından (`?sub=5`) okunuyordu, hediye abone hiç sayılmıyordu ve süre
 * artış bildirimi kartın DIŞINA (`-bottom-8`) konumlandığı için OBS
 * kaynağının dışında kalıp görünmüyordu. Bildirim artık kartın ALTINDA,
 * akışın içinde duruyor: sayacın üstünü kapatmıyor.
 */
import { useEffect, useRef, useState } from 'react';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { SUBATHON_DEFAULTS } from '../lib/widget-defaults.js';

export interface SubathonWidgetProps {
  embedded?: boolean;
  previewMode?: boolean;
}

/** Bağış tutarına göre eklenecek saniye. */
export function bagisSaniyesi(tutar: number, dakikaBasina: number, tutarBirimi: number): number {
  const birim = Math.max(1, Number(tutarBirimi) || 1);
  const adet = Math.max(0, Math.floor(Number(tutar || 0) / birim));
  return adet * Math.max(0, Number(dakikaBasina) || 0) * 60;
}

/** Hediye abone sayısına göre eklenecek saniye. */
export function hediyeSaniyesi(adet: number, dakikaBasina: number): number {
  return Math.max(0, Math.floor(Number(adet) || 1)) * Math.max(0, Number(dakikaBasina) || 0) * 60;
}

const DEPO = 'streamaxt-subathon-bitis';

export function SubathonWidget({ embedded = false, previewMode = false }: SubathonWidgetProps) {
  const s = useWidgetSettings('subathon', SUBATHON_DEFAULTS);

  const [secondsLeft, setSecondsLeft] = useState(previewMode ? 13520 : (s.startMinutes || 120) * 60);
  const [totalAdded, setTotalAdded] = useState(0);
  const [recentAdd, setRecentAdd] = useState<string | null>(previewMode ? '+5 dk (Abone: Can_Stream)' : null);
  const bildirimZaman = useRef<NodeJS.Timeout | null>(null);

  // Sayaç OBS sahne yenilemesinde sıfırlanmasın: bitiş anı tarayıcıda saklanır.
  useEffect(() => {
    if (previewMode) return;
    try {
      const kayit = Number(localStorage.getItem(DEPO));
      if (kayit && kayit > Date.now()) {
        setSecondsLeft(Math.floor((kayit - Date.now()) / 1000));
        return;
      }
    } catch {
      /* depo yok */
    }
    setSecondsLeft((s.startMinutes || 120) * 60);
  }, [previewMode, s.startMinutes]);

  useEffect(() => {
    if (previewMode) return;
    try {
      localStorage.setItem(DEPO, String(Date.now() + secondsLeft * 1000));
    } catch {
      /* depo yok */
    }
  }, [secondsLeft, previewMode]);

  // Geri sayım
  useEffect(() => {
    const i = setInterval(() => setSecondsLeft((p) => Math.max(0, p - 1)), 1000);
    return () => clearInterval(i);
  }, []);

  const bildir = (metin: string) => {
    setRecentAdd(metin);
    if (bildirimZaman.current) clearTimeout(bildirimZaman.current);
    bildirimZaman.current = setTimeout(() => setRecentAdd(null), Math.max(500, Number(s.notifyMs) || 4000));
  };

  const sureEkle = (saniye: number, metin: string) => {
    if (saniye <= 0) return;
    const tavanSn = Math.max(0, Number(s.maxHours) || 0) * 3600;
    setSecondsLeft((p) => (tavanSn ? Math.min(tavanSn, p + saniye) : p + saniye));
    setTotalAdded((p) => p + saniye);
    bildir(metin);
  };

  // Olayları dinle: abone / hediye abone / bağış
  useEffect(() => {
    if (previewMode) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const port =
      window.location.port === '5173' || window.location.port === '3000' ? '3001' : window.location.port || '3001';
    const ws = new WebSocket(`${protocol}//${window.location.hostname}:${port}/ws?type=all`);

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type !== 'alert') return;
        const d = payload.data || {};
        const ad = d.displayName || d.username || 'İzleyici';

        if (payload.subType === 'sub') {
          const dk = Number(s.subMinutes) || 0;
          sureEkle(dk * 60, `+${dk} dk (Abone: ${ad})`);
        } else if (payload.subType === 'gift_sub') {
          const adet = Number(d.count || d.amount || 1);
          const sn = hediyeSaniyesi(adet, Number(s.giftSubMinutes) || 0);
          sureEkle(sn, `+${Math.round(sn / 60)} dk (${adet} hediye abone: ${ad})`);
        } else if (payload.subType === 'tip') {
          const tutar = Number(d.amount || 0);
          const sn = bagisSaniyesi(tutar, Number(s.tipMinutes) || 0, Number(s.tipPerAmount) || 1);
          sureEkle(sn, `+${Math.round(sn / 60)} dk (Bağış ${tutar}${d.currency || ''}: ${ad})`);
        } else if (payload.subType === 'kicks') {
          const tutar = Number(d.amount || 0);
          const sn = bagisSaniyesi(tutar, Number(s.kicksMinutes) || 0, Number(s.kicksPerAmount) || 1);
          sureEkle(sn, `+${Math.round(sn / 60)} dk (${tutar} KICKs: ${ad})`);
        }
      } catch {
        /* bozuk mesaj */
      }
    };
    return () => ws.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewMode, s.subMinutes, s.giftSubMinutes, s.tipMinutes, s.tipPerAmount, s.kicksMinutes, s.kicksPerAmount, s.maxHours, s.notifyMs]);

  const formatTime = (totalSec: number) => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const sn = totalSec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sn).padStart(2, '0')}`;
  };

  return (
    <div
      className={
        embedded
          ? 'w-full h-full bg-transparent p-0 flex flex-col justify-start items-center gap-2 select-none font-sans'
          : 'w-screen h-screen bg-transparent p-6 flex flex-col justify-start items-center gap-2 select-none font-sans'
      }
    >
      <div
        className={`bg-black/85 backdrop-blur-xl border-2 p-4 rounded-2xl flex flex-col items-center ${
          embedded ? 'w-full justify-center' : 'min-w-[320px]'
        }`}
        style={{ borderColor: s.accentColor, boxShadow: `0 10px 35px ${s.accentColor}55` }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <h2
            className="text-[11px] font-black uppercase tracking-widest font-mono"
            style={{ color: s.accentColor }}
          >
            {s.title} CANLI SAYAÇ
          </h2>
        </div>

        <div
          className={`${
            embedded ? 'text-3xl lg:text-4xl' : 'text-5xl md:text-6xl'
          } font-black font-mono tracking-tight text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] my-1`}
        >
          {formatTime(secondsLeft)}
        </div>

        <div className="flex flex-wrap justify-center items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-400 font-medium">
          <span>
            Abone: <strong style={{ color: s.accentColor }}>+{s.subMinutes} dk</strong>
          </span>
          <span>•</span>
          <span>
            Hediye: <strong className="text-amber-300">+{s.giftSubMinutes} dk</strong>
          </span>
          <span>•</span>
          <span>
            Bağış: <strong className="text-emerald-300">
              +{s.tipMinutes} dk / {s.tipPerAmount}
            </strong>
          </span>
        </div>

        {s.showTotalAdded && totalAdded > 0 && (
          <div className="mt-1 text-[10px] text-gray-500">Bu yayında eklenen: {formatTime(totalAdded)}</div>
        )}
      </div>

      {/* Bildirim: kartın ALTINDA, akışın içinde — sayacı kapatmaz. */}
      {recentAdd && (
        <div
          className="px-4 py-1.5 rounded-full text-xs font-black text-white shadow-xl animate-bounce"
          style={{ background: `linear-gradient(90deg, ${s.accentColor}, ${s.accentColor2})` }}
        >
          🎉 {recentAdd}
        </div>
      )}
    </div>
  );
}

export default SubathonWidget;
