import { useEffect, useState } from 'react';

/** Sunucu: GET /api/durum-ozeti (api/rotalar/sistem.ts) */
export interface DurumOzeti {
  platformlar: string[];
  muzik: 'spotify' | 'yya-spotify' | 'ytmd' | null;
  obsKaynak: number;
  ai: { saglayici: string; hazir: boolean };
}

/** 10 sn'de bir yenilenen durum özeti (yüklenene kadar null). */
export function useDurumOzeti(): DurumOzeti | null {
  const [d, setD] = useState<DurumOzeti | null>(null);
  useEffect(() => {
    let iptal = false;
    const cek = () =>
      fetch('/api/durum-ozeti')
        .then((r) => (r.ok ? r.json() : null))
        .then((v) => !iptal && v && setD(v))
        .catch(() => {});
    cek();
    const t = setInterval(cek, 10_000);
    return () => {
      iptal = true;
      clearInterval(t);
    };
  }, []);
  return d;
}

export const MUZIK_ADI: Record<string, string> = {
  spotify: 'Spotify',
  'yya-spotify': "Spotify (Yayın Yönetim Aracı'ndan)",
  ytmd: 'YouTube Music'
};
