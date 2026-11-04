import { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { OverlayKatmanlari } from './OverlayLayers.js';
import JumpScareWidget from './JumpScareWidget.js';

export interface WidgetLayoutItem {
  enabled: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  [key: string]: any;
}

export interface AllInOneConfig {
  canvasWidth: number;
  canvasHeight: number;
  testMode?: boolean;
  chat: WidgetLayoutItem & {
    fontSize?: number;
    transparent?: boolean;
    mask?: boolean;
  };
  alerts: WidgetLayoutItem & {
    durationMs?: number;
    soundVolume?: number;
    animation?: string;
    layoutMode?: string;
    textEffect?: string;
  };
  goals: WidgetLayoutItem & {
    type?: 'follower' | 'sub' | 'tip' | 'kicks';
    target?: number;
    current?: number;
    title?: string;
  };
  subathon: WidgetLayoutItem;
  eventLabels: WidgetLayoutItem;
  emoteCombo: WidgetLayoutItem;
  nowPlaying: WidgetLayoutItem;
  theCup: WidgetLayoutItem;
  polls: WidgetLayoutItem;
  wheel: WidgetLayoutItem;
  hypeTrain: WidgetLayoutItem;
  lyrics?: WidgetLayoutItem & {
    fontSize?: number;
    glowColor?: string;
  };
  jumpScare?: WidgetLayoutItem;
  king?: WidgetLayoutItem;
  trivia?: WidgetLayoutItem;
}


export const DEFAULT_ALL_IN_ONE_CONFIG: AllInOneConfig = {
  canvasWidth: 1920,
  canvasHeight: 1080,
  testMode: false,
  chat: {
    enabled: true,
    x: 40,
    y: 430,
    width: 420,
    height: 610,
    scale: 1,
    fontSize: 18,
    transparent: true,
    mask: true
  },
  alerts: {
    enabled: true,
    x: 660,
    y: 60,
    width: 600,
    height: 260,
    scale: 1,
    durationMs: 5000,
    soundVolume: 0.7,
    animation: 'bounce',
    layoutMode: 'stacked',
    textEffect: 'wiggle'
  },
  goals: {
    enabled: true,
    x: 40,
    y: 60,
    width: 380,
    height: 60,
    scale: 1,
    type: 'follower',
    target: 100,
    current: 28,
    title: 'Takipçi Hedefi'
  },
  subathon: {
    enabled: false,
    x: 1560,
    y: 60,
    width: 320,
    height: 70,
    scale: 1
  },
  eventLabels: {
    enabled: true,
    x: 0,
    y: 0,
    width: 1920,
    height: 44,
    scale: 1
  },
  emoteCombo: {
    enabled: true,
    x: 760,
    y: 340,
    width: 400,
    height: 400,
    scale: 1
  },
  nowPlaying: {
    enabled: false,
    x: 1460,
    y: 960,
    width: 420,
    height: 90,
    scale: 1
  },
  theCup: {
    enabled: false,
    x: 1580,
    y: 610,
    width: 300,
    height: 430,
    scale: 1
  },
  polls: {
    enabled: false,
    x: 1540,
    y: 180,
    width: 340,
    height: 260,
    scale: 1
  },
  wheel: {
    enabled: false,
    x: 760,
    y: 340,
    width: 400,
    height: 400,
    scale: 1
  },
  hypeTrain: {
    enabled: false,
    x: 685,
    y: 350,
    width: 550,
    height: 85,
    scale: 1
  },
  lyrics: {
    enabled: false,
    x: 460,
    y: 880,
    width: 1000,
    height: 150,
    scale: 1,
    fontSize: 24,
    glowColor: '#00f2fe'
  },
  jumpScare: {
    enabled: true,
    x: 0,
    y: 0,
    width: 1920,
    height: 1080,
    scale: 1
  },
  king: {
    enabled: false,
    x: 1560,
    y: 180,
    width: 320,
    height: 120,
    scale: 1
  },
  trivia: {
    enabled: true,
    x: 620,
    y: 280,
    width: 680,
    height: 520,
    scale: 1
  }
};


export function UnifiedOverlayWidget() {
  const [config, setConfig] = useState<AllInOneConfig>(DEFAULT_ALL_IN_ONE_CONFIG);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const { lastMessage } = useWebSocket();

  // Handle window resizing for responsive full preview
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load config from API (ilk açılışta ve her yeniden bağlanmada — bkz. aşağı)
  const yerlesimiOku = () =>
    fetch('/api/overlay/all-in-one')
      .then(res => res.json())
      .then(data => {
        if (data && typeof data === 'object' && data.chat) {
          setConfig(prev => ({ ...prev, ...data }));
        }
      })
      .catch(() => {});
  useEffect(() => {
    void yerlesimiOku();
  }, []);

  // Listen to live WebSocket config updates
  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.type === 'overlay_reload') {
      window.location.reload();
    } else if (lastMessage.type === 'all_in_one_overlay_settings' && lastMessage.config) {
      setConfig(prev => ({ ...prev, ...lastMessage.config }));
    } else if (lastMessage.type === 'init') {
      // Sunucu yeniden başladı / bağlantı geri geldi: kopukken kaydedilen
      // yerleşim de OBS'e yansısın (eskiden sayfa yenilenene kadar eski kalıyordu)
      void yerlesimiOku();
    }
  }, [lastMessage]);

  // Check if testMode is active (via DB config or URL query parameter like ?preview=1 or ?test=1)
  const urlParams = new URLSearchParams(window.location.search);
  const isTestMode = Boolean(config.testMode || urlParams.get('preview') === '1' || urlParams.get('test') === '1');

  // Compute scale factor if viewport is not 1920x1080 (e.g. testing in smaller browser window)
  const scaleX = windowSize.width / 1920;
  const scaleY = windowSize.height / 1080;
  // If in OBS at 1920x1080, scale is exactly 1. Otherwise scale down proportionally
  const autoScale = (windowSize.width === 1920 && windowSize.height === 1080) 
    ? 1 
    : Math.min(scaleX, scaleY);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '1920px',
        height: '1080px',
        transform: `scale(${autoScale})`,
        transformOrigin: 'top left',
        backgroundColor: 'transparent',
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 9999
      }}
    >
      {/* Test Mode Banner */}
      {isTestMode && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(124, 58, 237, 0.85)',
            border: '1px solid rgba(167, 139, 250, 0.6)',
            color: '#fff',
            padding: '4px 16px',
            borderRadius: '9999px',
            fontSize: '11px',
            fontWeight: 800,
            fontFamily: 'sans-serif',
            letterSpacing: '0.05em',
            boxShadow: '0 4px 20px rgba(124, 58, 237, 0.5)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#4ade80' }} />
          <span>OBS TEST / ÖNİZLEME MODU AKTİF • Bileşenler tuvalde yerleşimi doğrulamak için gösteriliyor</span>
        </div>
      )}

      {/* Katmanlar TEK kaynaktan gelir (OverlayLayers.tsx): Overlay Stüdyo
          önizlemesi de aynı bileşeni kullanır, böylece "önizlemede başka,
          OBS'te başka görünüyor" sorunu yapısal olarak imkânsızlaşır. */}
      <OverlayKatmanlari config={config as any} onizleme={isTestMode} />

      {config.jumpScare?.enabled && (
        <JumpScareWidget />
      )}

    </div>
  );
}


export default UnifiedOverlayWidget;
