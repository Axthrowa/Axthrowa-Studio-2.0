import { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessage, PlatformStatus } from '../types.js';
import { wsAdresi } from '../lib/widget-style.js';

export function useWebSocket(type: 'dashboard' | 'alertbox' | 'chatbox' | 'goals' | 'wheel' | 'audio' | 'all' = 'all') {
  const [connected, setConnected] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [activeAlert, setActiveAlert] = useState<any | null>(null);
  const [platformStatuses, setPlatformStatuses] = useState<Record<string, PlatformStatus>>({});
  const [winnerEvent, setWinnerEvent] = useState<any | null>(null);
  const [ttsItem, setTtsItem] = useState<any | null>(null);
  const [lastMessage, setLastMessage] = useState<any | null>(null);
  /** Ekip çapında uyarı kuyruğu denetimi: {action, state, alertId?} — her mesaj yeni nesne (aynı eylem tekrar gelse de) */
  const [alertControl, setAlertControl] = useState<any | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    const wsUrl = wsAdresi(type);

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        console.log(`[WS] Connected to StreamAxT Hub (${type})`);
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          setLastMessage(payload);

          if (payload.type === 'init') {
            if (payload.data?.platformStatuses) {
              setPlatformStatuses(payload.data.platformStatuses);
            }
          } else if (payload.type === 'chat') {
            setChatMessages((prev) => [...prev.slice(-150), payload.data]);
          } else if (payload.type === 'alert') {
            setActiveAlert(payload.alert || payload);
          } else if (payload.type === 'alert_control') {
            setAlertControl({ ...payload, receivedAt: Date.now() });
          } else if (payload.type === 'giveaway_winner') {
            setWinnerEvent(payload.winner);
          } else if (payload.type === 'tts' || payload.type === 'tts_play') {
            setTtsItem(payload.data || payload.item || payload);
          } else if (payload.type === 'clear_chat') {
            setChatMessages([]);
          }
        } catch (err) {
          console.error('[WS] Parse error:', err);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        setConnected(false);
      };
    } catch {
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    }
  }, [type]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  const testAlert = useCallback((eventType: string = 'follow') => {
    // 1. Send via WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'test_alert', eventType }));
    }
    // 2. Also send via REST API to ensure delivery
    fetch('/api/alerts/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType })
    }).catch(() => {});
  }, []);

  const sendChat = useCallback((platform: string, message: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'send_chat', platform, message }));
    }
  }, []);

  const clearChat = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'clear_chat' }));
    }
    fetch('/api/chat/clear', { method: 'POST' }).catch(() => {});
    setChatMessages([]);
  }, []);

  const triggerTTS = useCallback((text: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'trigger_tts', text }));
    }
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
    alertControl
  };
}
