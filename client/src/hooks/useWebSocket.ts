import { useState, useEffect, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { ChatMessage, PlatformStatus } from '../types.js';
import { wsAdresi } from '../lib/widget-style.js';
import { KaliciSoket } from '../lib/kaliciSoket.js';

const EN_COK_ILETI = 500;

export function useWebSocket(type: 'dashboard' | 'alertbox' | 'chatbox' | 'goals' | 'wheel' | 'audio' | 'all' = 'all', secenek?: { gecmis?: boolean }) {
  const [connected, setConnected] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [activeAlert, setActiveAlert] = useState<any | null>(null);
  const [platformStatuses, setPlatformStatuses] = useState<Record<string, PlatformStatus>>({});
  const [winnerEvent, setWinnerEvent] = useState<any | null>(null);
  const [ttsItem, setTtsItem] = useState<any | null>(null);
  const [lastMessage, setLastMessage] = useState<any | null>(null);
  /** Ekip çapında uyarı kuyruğu denetimi: {action, state, alertId?} — her mesaj yeni nesne (aynı eylem tekrar gelse de) */
  const [alertControl, setAlertControl] = useState<any | null>(null);

  const wsRef = useRef<KaliciSoket | null>(null);
  /** Panel sohbeti: yoğun sohbette her iletide değil, 100 ms'lik partilerle çizilir */
  const tampon = useRef<ChatMessage[]>([]);
  const tamponZaman = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    const ws = new KaliciSoket(wsAdresi(type));
    wsRef.current = ws;

    ws.onacildi = () => {
      setConnected(true);
      // Sekme değişince ya da bağlantı kopup gelince son iletiler geri yüklenir
      if (secenek?.gecmis) {
        fetch('/api/chat/history')
          .then((r) => r.json())
          .then((d) =>
            setChatMessages((prev) => {
              const gorulen = new Set(prev.map((m) => m.id));
              return [...(d.mesajlar || []).filter((m: ChatMessage) => !gorulen.has(m.id)), ...prev].slice(-EN_COK_ILETI);
            })
          )
          .catch(() => {});
      }
      // Galeri önizlemesi "Test et"i bu işaretle zamanlar (bkz. WidgetOnizleme)
      if (typeof window !== 'undefined') (window as unknown as { __axtSoketAcik?: boolean }).__axtSoketAcik = true;
      console.log(`[WS] Connected to AxBoT Hub (${type})`);
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (secenek?.gecmis && payload.type === 'chat') {
          tampon.current.push(payload.data);
          tamponZaman.current ??= setTimeout(() => {
            tamponZaman.current = null;
            const yeni = tampon.current.splice(0);
            setChatMessages((prev) => [...prev, ...yeni].slice(-EN_COK_ILETI));
          }, 100);
          return;
        }
        // Arka arkaya gelen iletiler tek render'da birleşirse `lastMessage`
        // dinleyicileri yalnız SONUNCUYU görür (oy/uyarı/ayar iletisi
        // kaybolur). Her ileti kendi render'ını alsın.
        flushSync(() => setLastMessage(payload));

        if (payload.type === 'init') {
          if (payload.data?.platformStatuses) {
            setPlatformStatuses(payload.data.platformStatuses);
          }
        } else if (payload.type === 'platform_statuses' && payload.data) {
          setPlatformStatuses(payload.data);
        } else if (payload.type === 'chat') {
          setChatMessages((prev) => [...prev.slice(-(EN_COK_ILETI - 1)), payload.data]);
        } else if (payload.type === 'alert') {
          setActiveAlert(payload.alert || payload);
        } else if (payload.type === 'alert_control') {
          setAlertControl({ ...payload, receivedAt: Date.now() });
        } else if (payload.type === 'giveaway_winner') {
          setWinnerEvent(payload.winner);
        } else if (payload.type === 'tts' || payload.type === 'tts_play') {
          setTtsItem(payload.data || payload.item || payload);
        } else if (payload.type === 'chat_deleted') {
          setChatMessages((prev) => prev.filter((m) => !(m.platform === payload.data?.platform && m.id === payload.data?.id)));
        } else if (payload.type === 'clear_chat') {
          tampon.current = payload.platform ? tampon.current.filter((m) => m.platform !== payload.platform) : [];
          setChatMessages((prev) => (payload.platform ? prev.filter((m) => m.platform !== payload.platform) : []));
        }
      } catch (err) {
        console.error('[WS] Parse error:', err);
      }
    };

    ws.onkapandi = () => setConnected(false);
  }, [type, secenek?.gecmis]);

  useEffect(() => {
    connect();
    return () => {
      if (tamponZaman.current) clearTimeout(tamponZaman.current);
      tamponZaman.current = null;
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  const testAlert = useCallback((eventType: string = 'follow') => {
    // 1. Send via WebSocket
    wsRef.current?.send(JSON.stringify({ action: 'test_alert', eventType }));
    // 2. Also send via REST API to ensure delivery
    fetch('/api/alerts/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType })
    }).catch(() => {});
  }, []);

  const sendChat = useCallback((platform: string, message: string) => {
    wsRef.current?.send(JSON.stringify({ action: 'send_chat', platform, message }));
  }, []);

  const clearChat = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ action: 'clear_chat' }));
    fetch('/api/chat/clear', { method: 'POST' }).catch(() => {});
    setChatMessages([]);
  }, []);

  /** Ham ileti (ör. uyarı kutusunun kuyruk raporu) */
  const gonder = useCallback((ileti: object) => {
    wsRef.current?.send(JSON.stringify(ileti));
  }, []);

  const triggerTTS = useCallback((text: string) => {
    wsRef.current?.send(JSON.stringify({ action: 'trigger_tts', text }));
  }, []);

  return {
    connected,
    chatMessages,
    activeAlert,
    setActiveAlert,
    platformStatuses,
    winnerEvent,
    ttsItem,
    testAlert,
    sendChat,
    clearChat,
    triggerTTS,
    lastMessage,
    alertControl,
    gonder
  };
}
