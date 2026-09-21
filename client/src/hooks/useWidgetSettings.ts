/**
 * StreamAxT widget settings loader
 * Developed by AxthrowA
 */
import { useEffect, useState } from 'react';
import { WIDGET_DEFAULTS } from '../lib/widget-defaults.js';

export function useWidgetSettings<T extends Record<string, any>>(widgetId: string, defaults?: T) {
  const base = { ...(WIDGET_DEFAULTS[widgetId] || {}), ...(defaults || {}) } as T;
  const [settings, setSettings] = useState<T>(base);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl: Record<string, any> = {};
    params.forEach((value, key) => {
      if (value === '1' || value === '0') fromUrl[key] = value === '1';
      else if (!Number.isNaN(Number(value)) && value.trim() !== '') fromUrl[key] = Number(value);
      else fromUrl[key] = value;
    });

    fetch(`/api/widgets/${widgetId}/settings`)
      .then(r => r.json())
      .then(d => setSettings({ ...base, ...d, ...fromUrl }))
      .catch(() => setSettings({ ...base, ...fromUrl }));

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const port = (window.location.port === '5173' || window.location.port === '3000') ? '3001' : (window.location.port || '3001');
    const ws = new WebSocket(`${protocol}//${window.location.hostname}:${port}/ws?type=all`);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'widget_settings' && msg.widgetId === widgetId && msg.settings) {
          setSettings(prev => ({ ...prev, ...msg.settings }));
        }
      } catch {}
    };
    return () => ws.close();
  }, [widgetId]);

  return settings;
}
