/**
 * AxBoT — 7TV, BTTV ve FFZ emote haritası (hepsi sunucunun /api/emotes önbelleğinden; katman dış adrese gitmez)
 * Developed by AxthrowA
 *
 * Tüm sohbet bileşenleri tek bir istek paylaşır; 30 dakikada bir tazelenir.
 */
import { useEffect, useState } from 'react';

type Harita = ReadonlyMap<string, string>;

let harita: Harita = new Map();
let sonYukleme = 0;
let yukleniyor: Promise<void> | null = null;
const dinleyiciler = new Set<(h: Harita) => void>();

const GUVENLI = /^https:\/\/cdn\.7tv\.app\/emote\/[A-Za-z0-9]+\/\dx\.webp$/;

// BTTV ve FFZ adresleri sunucuda süzülür; burada da yalnız kendi CDN'leri kabul edilir
const GUVENLI_BTTV_FFZ = /^https:\/\/cdn\.(?:betterttv\.net\/emote\/[0-9a-f]{24}\/2x|frankerfacez\.com\/[\w/.-]+)$/;

function yukle(): Promise<void> {
  if (yukleniyor) return yukleniyor;
  yukleniyor = fetch('/api/emotes')
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      const y = d?.yediTv;
      // Öncelik sırası: FFZ < BTTV < 7TV genel < 7TV kanal (sonra eklenen ezer)
      const yeni = new Map<string, string>();
      for (const e of [...(y?.ffz || []), ...(y?.bttv || [])]) {
        if (typeof e?.ad === 'string' && typeof e?.url === 'string' && GUVENLI_BTTV_FFZ.test(e.url)) yeni.set(e.ad, e.url);
      }
      for (const e of [...(y?.genel || []), ...(y?.kanal || [])]) {
        if (typeof e?.ad === 'string' && typeof e?.url === 'string' && GUVENLI.test(e.url)) yeni.set(e.ad, e.url);
      }
      harita = yeni;
      sonYukleme = Date.now();
      dinleyiciler.forEach((f) => f(harita));
    })
    .catch(() => {
      sonYukleme = Date.now() - 25 * 60_000; // 5 dk sonra yeniden dene
    })
    .finally(() => {
      yukleniyor = null;
    });
  return yukleniyor;
}

export function useYediTvHaritasi(): Harita {
  const [h, setH] = useState<Harita>(harita);
  useEffect(() => {
    dinleyiciler.add(setH);
    if (Date.now() - sonYukleme > 30 * 60_000) void yukle();
    return () => {
      dinleyiciler.delete(setH);
    };
  }, []);
  return h;
}
