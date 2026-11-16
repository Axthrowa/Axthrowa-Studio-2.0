/**
 * AxBoT widget settings loader
 * Developed by AxthrowA
 */
import { useEffect, useMemo, useState } from 'react';
import { FONTS, WIDGET_DEFAULTS } from '../lib/widget-defaults.js';
import { fontuYukle, yaziAilesi } from '../lib/widget-style.js';

/** CSS'inde kendi yazı tipini kullanan tema görünümleri (kartTasarimlari, şarkı sözü) */
const TEMA_YAZI_TIPI: Record<string, string> = {
  pixel: 'Press Start 2P',
  retro: 'Press Start 2P',
  phosphor: 'VT323',
  kaset: 'Special Elite'
};
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
  const base = { ...(WIDGET_DEFAULTS[widgetId] || WIDGET_DEFAULTS[widgetId.replace(/-\d+$/, '')] || {}), ...(defaults || {}) } as T;
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

  // Ayarlardaki HER yazı tipi (fontFamily, timeFontFamily, lineFontFamily…) ve temanın kendi yazı tipi yüklenir.
  // Eskiden yalnız fontFamily yükleniyordu; diğerleri OBS'te yedek yazı tipine düşüyordu.
  const yazilar = Object.values(settings as Record<string, unknown>).filter((v): v is string => typeof v === 'string' && FONTS.includes(v));
  const temaYazisi = TEMA_YAZI_TIPI[String((settings as Record<string, unknown>).theme || '')];
  const anahtar = [...yazilar, temaYazisi || ''].join('|');
  useEffect(() => {
    for (const ad of anahtar.split('|')) fontuYukle(ad, FONTS);
  }, [anahtar]);

  // Widget'lar değeri doğrudan `fontFamily`ye yazar: tırnaklı ad + yedek (bkz. yaziAilesi)
  return useMemo(() => {
    const out: Record<string, unknown> = { ...settings };
    for (const [k, v] of Object.entries(out)) if (typeof v === 'string' && FONTS.includes(v)) out[k] = yaziAilesi(v);
    return out as T;
  }, [settings]);
}
