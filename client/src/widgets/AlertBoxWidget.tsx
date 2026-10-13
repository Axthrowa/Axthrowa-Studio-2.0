import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../hooks/useWebSocket.js';
import confetti from 'canvas-confetti';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { ALERT_ADVANCED_DEFAULTS } from '../lib/widget-defaults.js';
import {
  BOS_DURUM,
  GorulenKimlikler,
  atla,
  ilerlet,
  kuyrugaEkle,
  temizle,
  metinPenceresiAcik,
  sonrakiMetinSiniri,
  sonrakiTik,
  type KuyrukDurumu
} from '../lib/alertQueue.js';
import { animStili, type AnimAsamasi } from '../lib/animations.js';

interface AlertItem {
  id: string;
  eventType: string;
  title: string;
  message: string;
  soundUrl: string;
  imageUrl: string;
  durationMs: number;
  textColor: string;
  accentColor: string;
  animation: string;
  layoutMode?: 'stacked' | 'side-by-side' | 'text-over';
  textEffect?: string;
  soundVolume: number;
}

function playSynthesizedChime(volume: number = 0.7) {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    
    // Pleasant dual-tone chime (C5 -> E5 -> G5 -> C6)
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      
      gain.gain.setValueAtTime(0, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(Math.min(1, volume * 0.3), now + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.35);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.38);
    });
  } catch (err) {
    console.warn('[AlertBox] Synthesized chime fallback error:', err);
  }
}

export function AlertBoxWidget({ embedded = false, previewMode = false }: { embedded?: boolean; previewMode?: boolean }) {
  const advanced = useWidgetSettings('alert-box', ALERT_ADVANCED_DEFAULTS);
  const { activeAlert, setActiveAlert, alertControl } = useWebSocket('alertbox');
  /** Ekip denetimi (duraklat / sustur); OBS kaynağı yeniden yüklense de sunucudan okunur */
  const [denetim, setDenetim] = useState({ paused: false, muted: false });
  const denetimRef = useRef(denetim);
  denetimRef.current = denetim;
  const [kuyruk, setKuyruk] = useState<KuyrukDurumu>(BOS_DURUM);
  const gorulenler = useRef(new GorulenKimlikler(200));
  const [imgError, setImgError] = useState(false);
  const [showHelper, setShowHelper] = useState(!embedded);

  const params = new URLSearchParams(window.location.search);
  const isPreview = previewMode || params.get('preview') === '1' || params.get('test') === '1';

  // Auto-hide helper indicator after 6 seconds
  useEffect(() => {
    if (embedded) return;
    const timer = setTimeout(() => setShowHelper(false), 6000);
    return () => clearTimeout(timer);
  }, [embedded]);

  // Listen for audio unlock clicks
  const unlockAudio = () => {
    setShowHelper(false);
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        ctx.resume();
      }
    } catch {}
  };

  // Check URL query parameters for instant preview/test
  useEffect(() => {
    const testType = params.get('test');
    if (testType) {
      setTimeout(() => {
        enqueueAlert({
          id: 'test-url-' + Date.now(),
          eventType: testType,
          title: testType.toUpperCase() + ' TESTİ!',
          message: 'StreamAxT AlertBox Bildirim Testi',
          soundUrl: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
          imageUrl: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif',
          durationMs: 5000,
          textColor: '#ffffff',
          accentColor: '#3EEDFE',
          animation: 'bounce',
          layoutMode: 'stacked',
          textEffect: 'shine',
          soundVolume: 0.7
        });
      }, 500);
    }
  }, []);

  const normalizeAlert = (raw: any): AlertItem => {
    return {
      id: raw.id || String(Date.now()),
      eventType: raw.eventType || raw.event_type || 'follow',
      title: raw.title || raw.title_template || 'YENİ BİLDİRİM!',
      message: raw.message || raw.message_template || '',
      soundUrl: raw.soundUrl || raw.sound_url || '',
      imageUrl: raw.imageUrl || raw.image_url || 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif',
      durationMs: raw.durationMs || raw.duration_ms || 5000,
      textColor: raw.textColor || raw.text_color || '#ffffff',
      accentColor: raw.accentColor || raw.accent_color || '#3EEDFE',
      animation: raw.animation || advanced.animation || 'bounce',
      layoutMode: raw.layoutMode || raw.layout_mode || advanced.layoutMode || 'stacked',
      textEffect: raw.textEffect || raw.text_effect || advanced.textEffect || 'shine',
      soundVolume: raw.soundVolume ?? raw.sound_volume ?? 0.7
    };
  };

  /**
   * Kuyruk artik saf bir DURUM MAKINESI (lib/alertQueue.ts).
   *
   * Eskiden `alertQueue.current` dizisi + `isProcessing` bayragi + ic ice
   * `setTimeout` vardi: arka arkaya gelen iki olay birbirini eziyordu ve
   * WebSocket yeniden baglandiginda ayni uyari iki kez oynuyordu.
   */
  const enqueueAlert = (item: AlertItem) => {
    if (item.eventType === 'tip' && advanced.minTipAmount && Number((item as any).amount || 0) < advanced.minTipAmount) return;
    if (item.eventType === 'kicks' && advanced.minKicks && Number((item as any).amount || 0) < advanced.minKicks) return;

    // Ayni uyariyi iki kez oynatma
    if (gorulenler.current.gorduk(item.id)) return;
    gorulenler.current.ekle(item.id);

    const animMs = Math.max(0, Number(advanced.animationDuration) || 500);
    setKuyruk((d) =>
      kuyrugaEkle(
        d,
        {
          id: item.id,
          tur: item.eventType,
          veri: item,
          sureMs: item.durationMs || 5000,
          animMs
        },
        Boolean(advanced.queueEnabled),
        Date.now(),
        denetimRef.current.paused
      )
    );
    // Ses/konfeti burada ÇALINMIYOR: kuyrukta bekleyen uyarının sesi, önündeki
    // uyarı ekrandayken çalıyordu (görsel ile ses kayıyordu). Aşağıdaki etki,
    // uyarı gerçekten ekrana geldiğinde çalar.
  };

  /** Ses ve konfeti — gorsel asamadan bagimsiz, olay gelir gelmez. */
  const oynat = (alert: AlertItem) => {
    setImgError(false);

    if (denetimRef.current.muted) {
      // Uyarılar sessize alındı: görsel sürer, ses çalınmaz
    } else if (alert.soundUrl) {
      try {
        const audio = new Audio(alert.soundUrl);
        audio.volume = Math.max(0, Math.min(1, (alert.soundVolume ?? 0.7) * (advanced.globalVolume ?? 1)));
        audio.play().catch(() => playSynthesizedChime(alert.soundVolume));
      } catch {
        playSynthesizedChime(alert.soundVolume);
      }
    } else {
      playSynthesizedChime(alert.soundVolume);
    }

    if (advanced.confetti && ['sub', 'tip', 'raid', 'gift_tiktok', 'follow', 'gift_sub', 'kicks', 'host'].includes(alert.eventType)) {
      try {
        confetti({ particleCount: alert.eventType === 'follow' ? 50 : 90, spread: 80, origin: { y: 0.6 } });
      } catch {
        /* konfeti yoksa sorun degil */
      }
    }
  };

  // Açılışta güncel denetim durumu (OBS kaynağı yayın ortasında yeniden yüklenebilir)
  useEffect(() => {
    fetch('/api/alerts/control')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.state) setDenetim({ paused: !!d.state.paused, muted: !!d.state.muted });
      })
      .catch(() => {});
  }, []);

  // Panelden / moderatörden gelen denetim komutları
  useEffect(() => {
    if (!alertControl) return;
    const s = alertControl.state || {};
    setDenetim({ paused: !!s.paused, muted: !!s.muted });
    if (alertControl.action === 'skip' && advanced.skipEnabled !== false) {
      setKuyruk((d) => atla(d));
    } else if (alertControl.action === 'clear') {
      setKuyruk((d) => temizle(d));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertControl]);

  useEffect(() => {
    if (activeAlert) enqueueAlert(normalizeAlert(activeAlert));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAlert]);

  // Uyarı ekrana gelince (aktif değişince) ses ve konfeti
  const sonCalinan = useRef<string>('');
  useEffect(() => {
    const oge = kuyruk.aktif;
    if (!oge || sonCalinan.current === oge.id) return;
    sonCalinan.current = oge.id;
    oynat(oge.veri as AlertItem);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kuyruk.aktif?.id]);

  // Metin görünüm penceresi sınırında yeniden çiz (ör. 1500 ms'de metin belirsin)
  const [, setMetinSaati] = useState(0);
  useEffect(() => {
    if (!kuyruk.aktif) return;
    const gecen = Date.now() - kuyruk.aktifBaslangic;
    const kalan = sonrakiMetinSiniri(gecen, Number(advanced.textFromMs) || 0, Number(advanced.textToMs) || 0);
    if (kalan === null) return;
    const t = setTimeout(() => setMetinSaati((x) => x + 1), kalan + 5);
    return () => clearTimeout(t);
  });

  // Durum makinesini tam gerektiginde ilerlet — surekli setInterval yok.
  useEffect(() => {
    const bekle = sonrakiTik(kuyruk);
    if (bekle === null) return;
    const t = setTimeout(() => {
      setKuyruk((d) => {
        const yeni = ilerlet(d, Number(advanced.gapMs) || 0, Date.now(), denetimRef.current.paused);
        if (yeni.aktif === null && d.aktif !== null) setActiveAlert(null);
        return yeni;
      });
    }, bekle);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kuyruk, advanced.gapMs, denetim.paused]);

  // Mock alert for preview / OBS setup mode
  const mockPreviewAlert: AlertItem = {
    id: 'mock-alert-1',
    eventType: 'sub',
    title: '🎉 YENİ ABONE!',
    message: '@Ahmet_Kaya aramıza katıldı!',
    soundUrl: '',
    imageUrl: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif',
    durationMs: 5000,
    textColor: '#ffffff',
    accentColor: '#3EEDFE',
    animation: 'bounce',
    layoutMode: 'stacked',
    textEffect: 'shine',
    soundVolume: 0.7
  };

  const aktifUyari = (kuyruk.aktif?.veri as AlertItem | undefined) || null;
  const displayAlert = aktifUyari || (isPreview ? mockPreviewAlert : null);
  const asama: AnimAsamasi = aktifUyari
    ? kuyruk.asama === 'entering'
      ? 'visible' // giris: hedef duruma gecis (CSS animasyonu calissin)
      : kuyruk.asama === 'exiting'
        ? 'exiting'
        : 'visible'
    : isPreview
      ? 'visible'
      : 'hidden';

  /**
   * Metin katmani gorunur mu?
   *
   * BotRix'te "Metin gorunumu ms - ms" araligi var: gorsel/ses ile metnin
   * senkronize edilmesini saglar. 0-0 ise her zaman gorunur.
   */
  const metinGorunur = () => {
    // Önizlemede (aktif uyarı yok) metin hep görünür
    if (!kuyruk.aktif) return true;
    return metinPenceresiAcik(
      Date.now() - kuyruk.aktifBaslangic,
      Number(advanced.textFromMs) || 0,
      Number(advanced.textToMs) || 0
    );
  };

  /** İşletim sisteminde "hareketi azalt" açıksa animasyonlar sadeleşir. */
  const azaltilmisHareket =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

  // Metin efekti — CSS sinifi
  const getTextEffectClass = (fx?: string) => {
    switch (fx) {
      case 'wiggle': return 'animate-[pulse_1s_ease-in-out_infinite]';
      case 'wave': return 'tracking-widest animate-pulse';
      case 'shine': return 'drop-shadow-[0_0_15px_rgba(62,237,254,0.85)]';
      case 'skew': return '[transform:skewX(-8deg)]';
      case 'elastic': return 'animate-[bounce_1.2s_ease-in-out_infinite]';
      default: return '';
    }
  };

  return (
    <div 
      onClick={unlockAudio}
      className={`${embedded ? 'w-full h-full' : 'w-screen h-screen'} bg-transparent flex flex-col items-center justify-center overflow-hidden select-none cursor-pointer relative`}
    >
      {/* Discreet Ready / Autoplay Unlock Banner */}
      {showHelper && !displayAlert && (
        <div className="absolute bottom-4 px-4 py-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-full text-[11px] text-gray-300 font-mono flex items-center gap-2 pointer-events-none transition-opacity">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>StreamAxT AlertBox Hazır. Tarayıcıda ses için tıklayın.</span>
        </div>
      )}

      {displayAlert && (
        <div
          style={animStili(
            asama === 'exiting' ? (advanced.exitAnimation || displayAlert.animation) : displayAlert.animation,
            asama,
            Math.max(0, Number(advanced.animationDuration) || 500),
            0,
            azaltilmisHareket
          )}
          className={`p-4 max-w-full ${
            displayAlert.layoutMode === 'side-by-side'
              ? 'flex flex-row items-center justify-center gap-5 text-left'
              : displayAlert.layoutMode === 'text-over'
              ? 'relative flex flex-col items-center justify-center text-center'
              : 'flex flex-col items-center justify-center text-center'
          }`}
        >
          {/* Animated Image / GIF or Stylized Fallback */}
          {displayAlert.imageUrl && !imgError ? (
            <div className={`relative ${displayAlert.layoutMode === 'text-over' ? 'w-full max-h-56' : 'mb-3'} drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)]`}>
              <img
                src={displayAlert.imageUrl}
                alt="Alert GIF"
                onError={() => setImgError(true)}
                style={{ maxHeight: `${Math.max(40, Number(advanced.imageMaxHeight) || 192)}px` }}
                className="object-contain rounded-2xl mx-auto"
              />
            </div>
          ) : (
            <div 
              className="w-20 h-20 mb-3 rounded-2xl flex items-center justify-center text-3xl shadow-2xl animate-bounce"
              style={{ backgroundColor: `${displayAlert.accentColor || '#3EEDFE'}33`, border: `2px solid ${displayAlert.accentColor || '#3EEDFE'}` }}
            >
              🔔
            </div>
          )}

          {/* Metin katmani.
              BotRix'te ust ve alt metnin rengi, boyutu ve konumu AYRI
              ayarlaniyor; ayrica metnin gorunecegi ms araligi var. Bizde
              tek renk ve sabit boyut vardi. */}
          <div
            className={
              displayAlert.layoutMode === 'text-over'
                ? 'absolute inset-0 flex flex-col items-center justify-center p-3 bg-black/60 rounded-2xl'
                : ''
            }
            style={{
              transform: `translate(${Number(advanced.textOffsetX) || 0}px, ${Number(advanced.textOffsetY) || 0}px)`,
              opacity: metinGorunur() ? 1 : 0,
              transition: 'opacity 200ms ease',
              fontFamily: advanced.fontFamily
            }}
          >
            {/* Ust metin (baslik) */}
            <div
              className={`font-black uppercase tracking-wider font-display mb-1 ${getTextEffectClass(displayAlert.textEffect)}`}
              style={{
                color: (advanced.titleColor as string) || displayAlert.accentColor || '#3EEDFE',
                fontSize: `${Math.max(10, Number(advanced.titleSize) || 36)}px`,
                textShadow: `0 4px 12px rgba(0,0,0,${Math.max(0, Math.min(100, Number(advanced.textShadow) ?? 80)) / 100})`
              }}
            >
              {displayAlert.title}
            </div>

            {/* Alt metin (izleyici mesaji) */}
            {displayAlert.message && !advanced.hideUserMessage && (
              <div
                className="font-bold bg-black/80 px-4 py-1.5 rounded-full border border-white/20 backdrop-blur-md shadow-xl mt-1"
                style={{
                  color: (advanced.messageColor as string) || displayAlert.textColor || '#ffffff',
                  fontSize: `${Math.max(9, Number(advanced.messageSize) || 18)}px`,
                  textShadow: `0 3px 8px rgba(0,0,0,${Math.max(0, Math.min(100, Number(advanced.textShadow) ?? 80)) / 100})`
                }}
              >
                {displayAlert.message}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AlertBoxWidget;
