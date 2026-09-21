import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../hooks/useWebSocket.js';
import confetti from 'canvas-confetti';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { ALERT_ADVANCED_DEFAULTS } from '../lib/widget-defaults.js';

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
  const { activeAlert, setActiveAlert } = useWebSocket('alertbox');
  const [currentAlert, setCurrentAlert] = useState<AlertItem | null>(null);
  const [visible, setVisible] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [showHelper, setShowHelper] = useState(!embedded);

  const params = new URLSearchParams(window.location.search);
  const isPreview = previewMode || params.get('preview') === '1' || params.get('test') === '1';

  const alertQueue = useRef<AlertItem[]>([]);
  const isProcessing = useRef(false);

  // Auto-hide helper indicator after 6 seconds
  useEffect(() => {
    if (embedded) return;
    const timer = setTimeout(() => setShowHelper(false), 6000);
    return () => clearTimeout(timer);
  }, [embedded]);

  // Listen for audio unlock clicks
  const unlockAudio = () => {
    setAudioUnlocked(true);
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

  const enqueueAlert = (item: AlertItem) => {
    if (item.eventType === 'tip' && advanced.minTipAmount && Number((item as any).amount || 0) < advanced.minTipAmount) return;
    if (item.eventType === 'kicks' && advanced.minKicks && Number((item as any).amount || 0) < advanced.minKicks) return;
    if (!advanced.queueEnabled) {
      alertQueue.current = [item];
    } else {
      alertQueue.current.push(item);
    }
    processNextAlert();
  };

  useEffect(() => {
    if (activeAlert) {
      const normalized = normalizeAlert(activeAlert);
      enqueueAlert(normalized);
    }
  }, [activeAlert]);

  const processNextAlert = () => {
    if (isProcessing.current || alertQueue.current.length === 0) return;

    isProcessing.current = true;
    const alert = alertQueue.current.shift()!;
    setImgError(false);
    setCurrentAlert(alert);
    setVisible(true);

    // Play alert sound with synthesized fallback
    if (alert.soundUrl) {
      try {
        const audio = new Audio(alert.soundUrl);
        audio.volume = Math.max(0, Math.min(1, (alert.soundVolume ?? 0.7) * (advanced.globalVolume ?? 1)));
        audio.play().catch(() => {
          playSynthesizedChime(alert.soundVolume);
        });
      } catch {
        playSynthesizedChime(alert.soundVolume);
      }
    } else {
      playSynthesizedChime(alert.soundVolume);
    }

    // Trigger confetti for celebration events
    if (advanced.confetti && ['sub', 'tip', 'raid', 'gift_tiktok', 'follow', 'gift_sub', 'kicks', 'host'].includes(alert.eventType)) {
      try {
        confetti({
          particleCount: alert.eventType === 'follow' ? 50 : 90,
          spread: 80,
          origin: { y: 0.6 }
        });
      } catch {}
    }

    // Duration timer with fade out
    setTimeout(() => {
      setVisible(false);
      setTimeout(() => {
        setCurrentAlert(null);
        isProcessing.current = false;
        setActiveAlert(null);
        processNextAlert();
      }, 500);
    }, alert.durationMs || 5000);
  };

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

  const displayAlert = currentAlert || (isPreview ? mockPreviewAlert : null);
  const isDisplayVisible = Boolean(currentAlert ? visible : isPreview);

  // Animation CSS helper
  const getAnimationClass = (anim: string, isVis: boolean) => {
    if (!isVis) {
      switch (anim) {
        case 'slide':
        case 'slide-up': return 'opacity-0 translate-y-12';
        case 'slide-down': return 'opacity-0 -translate-y-12';
        case 'slide-left': return 'opacity-0 translate-x-16';
        case 'slide-right': return 'opacity-0 -translate-x-16';
        case 'zoom': return 'opacity-0 scale-50';
        case 'flip': return 'opacity-0 [transform:rotateX(75deg)] scale-90';
        case 'glitch': return 'opacity-0 scale-95 filter hue-rotate-90';
        case 'bounce':
        default: return 'opacity-0 scale-85 translate-y-6';
      }
    }
    switch (anim) {
      case 'slide':
      case 'slide-up':
      case 'slide-down':
      case 'slide-left':
      case 'slide-right': return 'opacity-100 translate-y-0 translate-x-0 transition-transform duration-500';
      case 'zoom': return 'opacity-100 scale-100 transition-all duration-500';
      case 'flip': return 'opacity-100 [transform:rotateX(0deg)] scale-100 transition-transform duration-500';
      case 'glitch': return 'opacity-100 scale-100 transition-all duration-300';
      case 'bounce':
      default: return 'opacity-100 scale-100 translate-y-0 animate-[bounce_1s_ease-in-out_1]';
    }
  };

  // Text effect CSS helper
  const getTextEffectClass = (fx?: string) => {
    switch (fx) {
      case 'wiggle': return 'animate-[pulse_1s_ease-in-out_infinite]';
      case 'wave': return 'tracking-widest animate-pulse';
      case 'shine': return 'drop-shadow-[0_0_15px_rgba(62,237,254,0.85)]';
      case 'pulse': return 'animate-pulse';
      case 'shake': return 'animate-[bounce_0.8s_infinite]';
      default: return 'drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]';
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
          className={`transition-all duration-500 transform ${getAnimationClass(displayAlert.animation, isDisplayVisible)} p-4 max-w-full ${
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
                className="max-h-48 object-contain rounded-2xl mx-auto"
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

          {/* Alert Content Box */}
          <div className={displayAlert.layoutMode === 'text-over' ? 'absolute inset-0 flex flex-col items-center justify-center p-3 bg-black/60 rounded-2xl' : ''}>
            {/* Alert Title */}
            <div
              className={`text-2xl md:text-4xl font-black uppercase tracking-wider font-display mb-1 ${getTextEffectClass(displayAlert.textEffect)}`}
              style={{ color: displayAlert.accentColor || '#3EEDFE' }}
            >
              {displayAlert.title}
            </div>

            {/* Alert Sub-Message */}
            {displayAlert.message && (
              <div
                className="text-sm md:text-lg font-bold drop-shadow-[0_3px_8px_rgba(0,0,0,0.9)] bg-black/80 px-4 py-1.5 rounded-full border border-white/20 backdrop-blur-md shadow-xl mt-1"
                style={{ color: displayAlert.textColor || '#ffffff' }}
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
