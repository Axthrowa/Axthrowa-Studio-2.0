/**
 * StreamAxT widget settings loader
 * Developed by AxthrowA
 */
import { useEffect, useState } from 'react';
import { WIDGET_DEFAULTS } from '../lib/widget-defaults.js';
import { ayarKanalinaKatil } from '../lib/ayarKanali.js';

/** Adres çubuğundaki `?anahtar=değer` ayarları (OBS'te URL ile ince ayar). */
function urlAyarlari(): Record<string, any> {
  const params = new URLSearchParams(window.location.search);
  const fromUrl: Record<string, any> = {};
  params.forEach((value, key) => {
    if (value === '1' || value === '0') fromUrl[key] = value === '1';
    else if (!Number.isNaN(Number(value)) && value.trim() !== '') fromUrl[key] = Number(value);
    else fromUrl[key] = value;
  });
  return fromUrl;
}

export function useWidgetSettings<T extends Record<string, any>>(widgetId: string, defaults?: T) {
  const base = { ...(WIDGET_DEFAULTS[widgetId] || {}), ...(defaults || {}) } as T;
  const [settings, setSettings] = useState<T>(base);

  useEffect(() => {
    let iptal = false;
    const fromUrl = urlAyarlari();
    const oku = () =>
      fetch(`/api/widgets/${widgetId}/settings`)
        .then((r) => r.json())
        .then((d) => !iptal && setSettings({ ...base, ...d, ...fromUrl }))
        .catch(() => !iptal && setSettings((prev) => ({ ...prev, ...fromUrl })));

    // Kimlik değişti (ör. hedef türü): önceki widget'ın ayarı ekranda kalmasın
    setSettings({ ...base, ...fromUrl });
    void oku();

    const ayril = ayarKanalinaKatil({
      widgetId,
      ayar: (s) => !iptal && setSettings((prev) => ({ ...prev, ...s, ...fromUrl })),
      tazele: () => void oku()
    });
    return () => {
      iptal = true;
      ayril();
    };
  }, [widgetId]);

  return settings;
}
