/**
 * AxBoT OBS Ses / TTS oynatıcısı
 * Developed by AxthrowA
 *
 * Panelden ses düzeyi, kuyruk sınırı, durum kartının teması ve boşta gizlenme
 * ayarlanır. Eski sürümde ses düzeyi yalnız adres satırından (`?volume=`)
 * okunabiliyordu ve kuyruğun üst sınırı yoktu: uzun bir mola sonrası biriken
 * onlarca TTS arka arkaya okunuyordu.
 */
import { useEffect, useRef, useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { playTtsAudio } from '../lib/tts-playback.js';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { AUDIO_PLAYER_DEFAULTS } from '../lib/widget-defaults.js';
import { rgba } from '../lib/widget-style.js';

export interface AudioPlayerWidgetProps {
  embedded?: boolean;
  previewMode?: boolean;
}

export function AudioPlayerWidget({ embedded = false }: AudioPlayerWidgetProps) {
  const s = useWidgetSettings('audio-player', AUDIO_PLAYER_DEFAULTS);
  const ayarRef = useRef(s);
  ayarRef.current = s;

  const { ttsItem } = useWebSocket('audio');
  const [currentSpeech, setCurrentSpeech] = useState<string | null>(null);
  const [bekleyen, setBekleyen] = useState(0);
  const queueRef = useRef<any[]>([]);
  const playingRef = useRef(false);

  useEffect(() => {
    if (!ttsItem) return;
    const tavan = Math.max(1, Number(ayarRef.current.maxQueue) || 20);
    queueRef.current.push(ttsItem);
    // Kuyruk taşarsa EN ESKİ kayıtlar düşer: yayın anına yakın olan okunur.
    if (queueRef.current.length > tavan) queueRef.current = queueRef.current.slice(-tavan);
    setBekleyen(queueRef.current.length);
    playNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ttsItem]);

  const playNext = () => {
    if (playingRef.current) return;
    const next = queueRef.current.shift();
    setBekleyen(queueRef.current.length);
    if (!next) return;
    playingRef.current = true;
    playTTS(next).finally(() => {
      playingRef.current = false;
      playNext();
    });
  };

  const playTTS = (item: any): Promise<void> => {
    const text = item.processedText || item.text || '';
    setCurrentSpeech(text);
    return playTtsAudio({
      ...item,
      volume: Number(ayarRef.current.volume ?? item.volume ?? 0.8)
    }).finally(() => setCurrentSpeech(null));
  };

  if (!s.showStatus) return null;
  if (s.hideWhenIdle && !currentSpeech) return null;

  const tema = String(s.theme || 'status');
  const temaStili: Record<string, React.CSSProperties> = {
    status: {
      background: rgba(s.bgColor, s.bgOpacity),
      border: `1px solid ${rgba('#ffffff', 0.1)}`,
      backdropFilter: 'blur(8px)'
    },
    minimal: { background: 'transparent', border: 'none' },
    neon: {
      background: rgba(s.bgColor, s.bgOpacity),
      border: `1px solid ${s.accentColor}`,
      boxShadow: `0 0 16px ${rgba(s.accentColor, 0.5)}`
    },
    dot: { background: 'transparent', border: 'none' }
  };

  return (
    <div
      className={
        embedded
          ? 'w-full h-full bg-transparent flex items-center justify-center p-1'
          : 'w-screen h-screen bg-transparent flex items-center justify-center p-4'
      }
    >
      <div
        className="flex items-center gap-2"
        style={{
          ...(temaStili[tema] || temaStili.status),
          borderRadius: Number(s.radius) || 12,
          padding: tema === 'dot' ? 0 : '8px 16px',
          color: s.textColor,
          fontFamily: s.fontFamily,
          fontSize: Number(s.fontSize) || 12
        }}
      >
        <span
          className={`w-2 h-2 rounded-full ${currentSpeech ? 'animate-ping' : ''}`}
          style={{ background: currentSpeech ? '#34d399' : s.accentColor }}
        />
        {tema !== 'dot' && (
          <span>
            {s.label} ·{' '}
            {currentSpeech
              ? s.showText
                ? `Seslendiriliyor: “${currentSpeech}”`
                : 'Seslendiriliyor'
              : 'Boşta (Hazır)'}
            {s.showQueue && bekleyen > 0 ? ` · kuyruk ${bekleyen}` : ''}
          </span>
        )}
      </div>
    </div>
  );
}

export default AudioPlayerWidget;
