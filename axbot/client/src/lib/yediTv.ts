/**
 * AxBoT — 7TV, BTTV ve FFZ emote haritası (hepsi sunucunun /api/emotes önbelleğinden; katman dış adrese gitmez)
 * Developed by AxthrowA
 *
 * Tüm sohbet bileşenleri tek bir istek paylaşır; 30 dakikada bir tazelenir.
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { KaliciSoket } from './kaliciSoket.js';
import { wsAdresi } from './widget-style.js';

type Harita = ReadonlyMap<string, string>;

let harita: Harita = new Map();
/** Hareketli emote adresi → ilk karesi (WID-4 "dondur"); Kick emote'unun durağan sürümü yok, hareketli kalır */
let statik: ReadonlyMap<string, string> = new Map();
let donmusHarita: Harita = new Map();
let sonYukleme = 0;
let yukleniyor: Promise<void> | null = null;
const dinleyiciler = new Set<(h: Harita) => void>();

const GUVENLI = /^https:\/\/cdn\.7tv\.app\/emote\/[A-Za-z0-9]+\/\dx(?:_static)?\.webp$/;

// BTTV ve FFZ adresleri sunucuda süzülür; burada da yalnız kendi CDN'leri kabul edilir
const GUVENLI_BTTV_FFZ = /^https:\/\/cdn\.(?:betterttv\.net\/emote\/[0-9a-f]{24}\/(?:2x|static\/2x\.webp)|frankerfacez\.com\/[\w/.-]+)$/;

function yukle(): Promise<void> {
  if (yukleniyor) return yukleniyor;
  yukleniyor = fetch('/api/emotes')
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      const y = d?.yediTv;
      // Öncelik sırası: FFZ < BTTV < FFZ kanal < BTTV kanal < 7TV genel < 7TV kanal (sonra eklenen ezer)
      const yeni = new Map<string, string>();
      const yeniStatik = new Map<string, string>();
      const ekle = (liste: any[], guvenli: RegExp) => {
        for (const e of liste || []) {
          if (typeof e?.ad !== 'string' || typeof e?.url !== 'string' || !guvenli.test(e.url)) continue;
          yeni.set(e.ad, e.url);
          if (typeof e.statik === 'string' && guvenli.test(e.statik)) yeniStatik.set(e.url, e.statik);
        }
      };
      ekle([...(y?.ffz || []), ...(y?.bttv || []), ...(y?.ffzKanal || []), ...(y?.bttvKanal || [])], GUVENLI_BTTV_FFZ);
      ekle([...(y?.genel || []), ...(y?.kanal || [])], GUVENLI);
      harita = yeni;
      statik = yeniStatik;
      donmusHarita = new Map([...yeni].map(([ad, url]) => [ad, yeniStatik.get(url) ?? url]));
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

/** Sunucu 7TV seti değişince `emotes_tazele` yollar (yedi-tv-canli.ts); dinleyici varken tek soket */
let tazeleSoketi: KaliciSoket | null = null;
function tazelemeyiDinle() {
  if (tazeleSoketi || typeof window === 'undefined') return;
  tazeleSoketi = new KaliciSoket(wsAdresi('all'));
  tazeleSoketi.onmessage = (e) => {
    if (typeof e.data === 'string' && e.data.includes('"emotes_tazele"')) void yukle();
  };
}

/** `dondur`: hareketli 7TV/BTTV emote'ları ilk karesiyle */
export function useYediTvHaritasi(dondur = false): Harita {
  const [, setH] = useState<Harita>(harita);
  useEffect(() => {
    dinleyiciler.add(setH);
    tazelemeyiDinle();
    if (Date.now() - sonYukleme > 30 * 60_000) void yukle();
    return () => {
      dinleyiciler.delete(setH);
      if (!dinleyiciler.size) {
        tazeleSoketi?.close();
        tazeleSoketi = null;
      }
    };
  }, []);
  return dondur ? donmusHarita : harita;
}

/** Sunucudan gelen emote adresinin (duvar, kombo) durağan karşılığı; yoksa kendisi */
export function donmusAdres(url: string | undefined, dondur: boolean): string | undefined {
  return dondur && url ? (statik.get(url) ?? url) : url;
}

// ---- 7TV isim boyaları (WID-4) ----

export interface YediTvBoyasi {
  arkaPlan: string;
  golge?: string;
}

const boyalar = new Map<string, YediTvBoyasi | null | Promise<YediTvBoyasi | null>>();

/** Kullanıcı adının 7TV boyası; sunucu önbellekte tutar, burada da kullanıcı başına bir istek */
export function useYediTvBoyasi(platform: string, kimlik: string | undefined, acik: boolean): YediTvBoyasi | null {
  const anahtar = acik && kimlik && (platform === 'kick' || platform === 'twitch') ? `${platform}:${kimlik}` : '';
  const hazir = anahtar ? boyalar.get(anahtar) : null;
  const [boya, setBoya] = useState<YediTvBoyasi | null>(hazir && !(hazir instanceof Promise) ? hazir : null);
  useEffect(() => {
    if (!anahtar) return setBoya(null);
    let iptal = false;
    let is = boyalar.get(anahtar);
    if (is === undefined) {
      if (boyalar.size > 3000) boyalar.clear();
      is = fetch(`/api/emotes/boya?platform=${platform}&id=${encodeURIComponent(kimlik!)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => (d?.boya && typeof d.boya.arkaPlan === 'string' ? (d.boya as YediTvBoyasi) : null))
        .catch(() => null)
        .then((b) => {
          boyalar.set(anahtar, b);
          return b;
        });
      boyalar.set(anahtar, is);
    }
    void Promise.resolve(is).then((b) => !iptal && setBoya(b));
    return () => {
      iptal = true;
    };
  }, [anahtar]); // eslint-disable-line react-hooks/exhaustive-deps
  return boya;
}

/** Boyalı ad: degrade/görsel yazının içine kırpılır, gölge filtreyle */
export function boyaStili(b: YediTvBoyasi | null): CSSProperties | undefined {
  if (!b) return undefined;
  return {
    backgroundImage: b.arkaPlan,
    backgroundSize: 'cover',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    filter: b.golge
  };
}
