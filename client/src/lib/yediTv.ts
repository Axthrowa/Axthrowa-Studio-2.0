/**
 * AxBoT — 7TV emote haritası (sunucunun /api/emotes önbelleğinden) + BTTV ve FFZ genel emote'ları
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

/** BTTV genel seti: [{ id, code }] */
export function bttvAyikla(liste: unknown): Array<[string, string]> {
  return (Array.isArray(liste) ? liste : [])
    .filter((e) => typeof e?.code === 'string' && /^[0-9a-f]{24}$/.test(String(e?.id)))
    .map((e) => [e.code, `https://cdn.betterttv.net/emote/${e.id}/2x`]);
}

/** FFZ genel seti: { sets: { <kimlik>: { emoticons: [{ name, urls: { '2': adres } }] } } } */
export function ffzAyikla(g: any): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const set of Object.values(g?.sets || {}) as any[]) {
    for (const e of Array.isArray(set?.emoticons) ? set.emoticons : []) {
      const url = String(e?.urls?.['2'] || e?.urls?.['1'] || '');
      if (typeof e?.name === 'string' && /^https:\/\/cdn\.frankerfacez\.com\//.test(url)) out.push([e.name, url]);
    }
  }
  return out;
}

const disJson = (adres: string) =>
  fetch(adres)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);

function yukle(): Promise<void> {
  if (yukleniyor) return yukleniyor;
  yukleniyor = Promise.all([fetch('/api/emotes').then((r) => (r.ok ? r.json() : null)), disJson('https://api.betterttv.net/3/cached/emotes/global'), disJson('https://api.frankerfacez.com/v1/set/global')])
    .then(([d, bttv, ffz]) => {
      // Öncelik sırası: FFZ < BTTV < 7TV genel < 7TV kanal (sonra eklenen ezer)
      const yeni = new Map<string, string>([...ffzAyikla(ffz), ...bttvAyikla(bttv)]);
      for (const e of [...(d?.yediTv?.genel || []), ...(d?.yediTv?.kanal || [])]) {
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
