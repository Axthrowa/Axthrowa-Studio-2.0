import { useEffect, useState } from 'react';

/** Sunucu: GET /api/durum-ozeti (api/rotalar/sistem.ts) */
export interface DurumOzeti {
  platformlar: string[];
  muzik: 'spotify' | 'yya-spotify' | 'ytmd' | null;
  obsKaynak: number;
  /** Widget sayfalarının bağlantısı (sunucu: ws/katmanDurumu.ts) */
  katmanlar?: KatmanSatiri[];
  ai: { saglayici: string; hazir: boolean };
}

export interface KatmanSatiri {
  katman: string;
  bagli: number;
  obs: number;
  sonBaglanti: number;
  sonKopma: number;
}

/** Bu oturumda bağlanıp sonra kopan (şu an bağlı olmayan) katmanlar: yayında görünmüyorlar */
export const kopanKatmanlar = (l: KatmanSatiri[] = []) => l.filter((k) => k.bagli === 0 && k.sonKopma > 0);

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
  'yya-spotify': "Spotify (AxthrowA Studio'dan)",
  ytmd: 'YouTube Music'
};
