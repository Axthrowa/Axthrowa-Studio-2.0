/**
 * AxBoT JumpScare Overlay
 * Developed by AxthrowA
 *
 * Panelden varsayılan medya, süre, ses düzeyi, görsel şiddeti ve tetikleme
 * eşiği ayarlanır. Olay ayarları taşıyorsa onlar önceliklidir (tek seferlik
 * özel jumpscare). Eski sürümde kapanış zamanlayıcısı temizlenmiyordu: art
 * arda gelen iki tetikte ikincisi birincinin sayacıyla erken kapanıyordu.
 */
import { useState, useEffect, useRef } from 'react';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { JUMPSCARE_DEFAULTS } from '../lib/widget-defaults.js';
import { onizlemeKipi, wsAdresi } from '../lib/widget-style.js';
import { KaliciSoket } from '../lib/kaliciSoket.js';

export interface JumpScareWidgetProps {
  embedded?: boolean;
  previewMode?: boolean;
}

/** Bağış/KICKs eşiği tutuyor mu? Eşik 0 ise her tetik geçer. */
export function esikTutuyor(
  data: { amount?: number; type?: string },
  s: { minTipAmount?: number; minKicks?: number }
): boolean {
  const tutar = Number(data?.amount || 0);
  if (data?.type === 'kicks') return tutar >= Math.max(0, Number(s.minKicks) || 0);
  if (data?.type === 'tip') return tutar >= Math.max(0, Number(s.minTipAmount) || 0);
  return true;
}

function korkuSesi(volume = 1) {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.18);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.7);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.05, volume * 0.5), now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.9);
  } catch {
    /* ses motoru yok */
  }
}

export function JumpScareWidget({ previewMode = false }: JumpScareWidgetProps) {
  const s = useWidgetSettings('jumpscare', JUMPSCARE_DEFAULTS);
  const onizleme = onizlemeKipi(previewMode);
  const ayarRef = useRef(s);
  ayarRef.current = s;

  const [isActive, setIsActive] = useState(false);
  const [scare, setScare] = useState<{
    mediaUrl: string;
    mediaType: string;
    audioUrl?: string;
    volume: number;
    donor?: string;
    amount?: number;
  }>({ mediaUrl: '', mediaType: 'image', volume: 1 });
  const [mediaFailed, setMediaFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const kapatRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (onizleme) {
      setScare({ mediaUrl: '', mediaType: 'image', volume: 0, donor: 'Önizleme', amount: 50 });
      setIsActive(true);
      return;
    }

    const ws = new KaliciSoket(wsAdresi());
    ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type !== 'jumpscare_trigger') return;

          const a = ayarRef.current;
          const olay = data.settings || {};
          if (!esikTutuyor({ amount: data.amount, type: data.alertType }, a)) return;

          const sure = Math.max(300, Number(olay.durationMs || a.durationMs) || 4000);
          const ses = Number(olay.volume ?? a.volume ?? 1);

          setMediaFailed(false);
          setScare({
            mediaUrl: String(olay.mediaUrl || a.mediaUrl || ''),
            mediaType: String(olay.mediaType || a.mediaType || 'image'),
            audioUrl: String(olay.audioUrl || a.audioUrl || ''),
            volume: ses,
            donor: data.donor,
            amount: data.amount
          });
          setIsActive(true);
          if (a.screamFallback) korkuSesi(ses);

          // Önceki tetiğin sayacı kalırsa yeni jumpscare erken kapanıyordu.
          if (kapatRef.current) clearTimeout(kapatRef.current);
          kapatRef.current = setTimeout(() => setIsActive(false), sure);
        } catch {
          /* bozuk mesaj */
        }
      };
    return () => {
      if (kapatRef.current) clearTimeout(kapatRef.current);
      ws.close();
    };
  }, [onizleme]);

  useEffect(() => {
    if (!isActive) return;
    if (videoRef.current) {
      videoRef.current.volume = Math.max(0, Math.min(1, scare.volume ?? 1));
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => setMediaFailed(true));
    }
    if (audioRef.current && scare.audioUrl) {
      audioRef.current.volume = Math.max(0, Math.min(1, scare.volume ?? 1));
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  }, [isActive, scare]);

  if (!isActive) return null;

  const filtre = `contrast(${Math.max(50, Number(s.contrast) || 150)}%) brightness(${
    Math.max(50, Number(s.brightness) || 125)
  }%)`;

  return (
    <div className="fixed inset-0 z-[99999] w-screen h-screen bg-black flex items-center justify-center overflow-hidden">
      {!mediaFailed && scare.mediaUrl && scare.mediaType === 'video' ? (
        <video
          ref={videoRef}
          src={scare.mediaUrl}
          autoPlay
          playsInline
          onError={() => setMediaFailed(true)}
          className="w-full h-full object-cover scale-105"
          style={{ filter: filtre }}
        />
      ) : !mediaFailed && scare.mediaUrl && scare.mediaType !== 'audio' ? (
        <img
          src={scare.mediaUrl}
          alt=""
          onError={() => setMediaFailed(true)}
          className={`w-full h-full object-cover ${s.shake ? 'animate-bounce' : ''}`}
          style={{ filter: filtre }}
        />
      ) : (
        <div className="w-full h-full bg-red-950 flex items-center justify-center animate-pulse">
          <div className="text-[20vw] leading-none select-none">{s.fallbackEmoji}</div>
        </div>
      )}

      {scare.audioUrl && <audio ref={audioRef} src={scare.audioUrl} autoPlay />}

      {s.showDonor && scare.donor && (
        <div
          className={`absolute bottom-10 left-1/2 -translate-x-1/2 text-white font-black text-2xl md:text-4xl px-8 py-3 rounded-full border-2 border-white tracking-widest uppercase ${
            s.shake ? 'animate-bounce' : ''
          }`}
          style={{ background: s.donorLabelColor, boxShadow: `0 0 30px ${s.donorLabelColor}` }}
        >
          {scare.donor}
          {scare.amount ? ` (${scare.amount} TL)` : ''}
        </div>
      )}
    </div>
  );
}

export default JumpScareWidget;
