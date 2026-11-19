/**
 * AxBoT — Kappagen / Ekranda Emojiler overlay'i
 * Developed by AxthrowA
 *
 * Sunucu sohbetteki emote'ları (Kick, 7TV, emoji) `kappagen` olayıyla yollar;
 * burada ekranın rastgele bir kenarından girip başka bir kenarından çıkarlar.
 * `!kappagen` patlaması ortadan dağılır. Aynı anda ekrandaki emote sayısı
 * sınırlıdır (OBS'i yormasın).
 *
 * Akıcılık (18 Kasım 2026 ölçümü, başsız Chrome, 1920x1080, saniyede 20 emote):
 * - Her emote'taki `filter: drop-shadow` hareketli (GIF/WebP) emote'un her karesinde yeniden
 *   taranıyordu: tarama 1,9 → 9,9 ms/sn, kare p95 16,7 → 33,3 ms (30 FPS'e düşüş). Gölge artık
 *   filtresiz bir degrade halka; bir kez taranır, emote'la birlikte kayar.
 * - Uçuş ve giriş tek Web Animations hareketi: piksel değerli kareler (CSS değişkeni yok), iç içe
 *   ikinci animasyon yok; hareket ekran kartında (compositor) akar, ana iş parçacığı meşgulken de takılmaz.
 * - Emote'lar React durumuna girmez: her yeni mesajda liste yeniden çizilmez, DOM'a doğrudan eklenir.
 * - Ekran doluyken eski emote ani silinmez (göz o "pıt" diye kaybolmayı takılma sanıyordu); yeni gelen
 *   beklemeden düşer. Patlama yer açmak için en eskiyi hızlıca söndürür.
 */
import { kokOzellik } from '../lib/kabuklar.js';
import { useEffect, useRef } from 'react';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { KAPPAGEN_DEFAULTS, OGE_TAVANI } from '../lib/widget-defaults.js';
import { KaliciSoket } from '../lib/kaliciSoket.js';
import { hizCarpani, onizlemeKipi, wsAdresi } from '../lib/widget-style.js';
import { hareketAz } from '../lib/hareket.js';
import { EMOTE_GOLGESI, guvenliEmoteAdresi } from '../lib/emote.js';
import { donmusAdres, useYediTvHaritasi } from '../lib/yediTv.js';

/** Hız 1'in temposu: eskisi gözle takip edilemeyecek kadar hızlıydı */
const TABAN_HIZ = 0.6;

export interface Parca {
  ad: string;
  url?: string;
}

export type GirisTuru = 'none' | 'fade' | 'zoom';

/** Yalnız bilinen emote sunucularından görsel (sohbetten gelen veri); kural lib/emote.ts'te tek yerde */
export const guvenliGorsel = guvenliEmoteAdresi;

/** Rastgele bir kenardan giriş, başka bir kenardan çıkış; konumlar % (ekran dışında başlar ve biter) */
export function ucusRotasi(r: () => number = Math.random) {
  const kenarNoktasi = (kenar: number) => {
    const u = 5 + r() * 90;
    return kenar === 0 ? { x: u, y: -12 } : kenar === 1 ? { x: 112, y: u } : kenar === 2 ? { x: u, y: 112 } : { x: -12, y: u };
  };
  const giris = Math.floor(r() * 4) % 4;
  const cikis = (giris + 1 + (Math.floor(r() * 3) % 3)) % 4;
  const a = kenarNoktasi(giris);
  const b = kenarNoktasi(cikis);
  return { x: a.x, y: a.y, dx: b.x - a.x, dy: b.y - a.y };
}

/** Ayardaki giriş animasyonu adı → emote'ta kullanılabilen üç tür (ağır efektler emote'ta yok). */
export function girisTuru(ad: unknown): GirisTuru {
  const s = String(ad ?? 'zoom').toLowerCase();
  if (s === 'none' || s === 'yok') return 'none';
  if (s.startsWith('fade') || s === 'solma') return 'fade';
  return 'zoom';
}

export interface UcusPlani {
  /** Başlangıç ve bitiş merkezi (px) */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  donus: number;
  sure: number;
  boyut: number;
  patlama: boolean;
  giris: GirisTuru;
  /** Girişin süresi (ms); uçuşun içinde, ayrı animasyon değil */
  girisMs: number;
}

/**
 * Tek animasyonun kareleri: piksel değerli `translate3d` + `rotate` + `scale`, opaklık.
 * CSS değişkeni ve yüzde kullanılmaz (ekran kartında akabilsin diye).
 */
export function ucusKareleri(p: UcusPlani): Keyframe[] {
  const yari = p.boyut / 2;
  const nokta = (t: number, olcek: number) => {
    const x = p.x0 + (p.x1 - p.x0) * t - yari;
    const y = p.y0 + (p.y1 - p.y0) * t - yari;
    return `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${(p.donus * t).toFixed(1)}deg) scale(${olcek})`;
  };
  const baslangicOlcek = p.giris === 'zoom' ? 0.3 : 1;
  const baslangicOpak = p.giris === 'none' ? 1 : 0;
  const girisOrani = p.giris === 'none' ? 0 : Math.min(0.25, Math.max(0, p.girisMs) / Math.max(1, p.sure));
  const kareler: Keyframe[] = [{ transform: nokta(0, baslangicOlcek), opacity: baslangicOpak, offset: 0 }];
  if (girisOrani > 0) kareler.push({ transform: nokta(girisOrani, 1), opacity: 1, offset: girisOrani });
  // Patlama ortadan dağılıp söner; normal uçuş ekran dışına kadar tam opak
  if (p.patlama) kareler.push({ transform: nokta(0.85, 1), opacity: 1, offset: Math.max(girisOrani, 0.85) });
  kareler.push({ transform: nokta(1, 1), opacity: p.patlama ? 0 : 1, offset: 1 });
  return kareler;
}

/** Ekrandaki emote sınırı: ayar, 5 ile genel tavan (60) arasında */
export function ekranSiniri(ayar: unknown): number {
  const n = Number(ayar);
  return Math.min(OGE_TAVANI.emote, Math.max(5, Number.isFinite(n) ? Math.round(n) : 12));
}

/**
 * Yer var mı: normal emote dolu ekranda beklemeden düşer; patlama yer açar (en eskiyi söndürür).
 * Dönen sayı: söndürülmesi gereken en eski emote adedi.
 */
export function yerAc(aktif: number, sinir: number, yeni: number, patlama: boolean): { kabul: number; sondur: number } {
  const bos = Math.max(0, sinir - aktif);
  if (!patlama) return { kabul: Math.min(yeni, bos), sondur: 0 };
  const kabul = Math.min(yeni, sinir);
  return { kabul, sondur: Math.max(0, kabul - bos) };
}

/** Görsel önceden çözülür: ilk kez gelen emote'u çözmek uçan diğerlerini bir an takılıyordu */
const cozulen = new Map<string, Promise<unknown>>();
function gorseliCoz(url: string): Promise<unknown> {
  let s = cozulen.get(url);
  if (!s) {
    const g = new Image();
    g.referrerPolicy = 'no-referrer';
    g.src = url;
    s = g.decode().catch(() => {});
    if (cozulen.size > 300) cozulen.clear();
    cozulen.set(url, s);
  }
  return s;
}

/** Tek emote düğümü: kutu (hareket) > [gölge halkası] > görsel/yazı */
export function dugumYap(p: Parca, boyut: number, golge: boolean): HTMLDivElement {
  const kutu = document.createElement('div');
  kutu.style.cssText = `position:absolute;left:0;top:0;width:${boyut}px;height:${boyut}px;will-change:transform,opacity;contain:strict;pointer-events:none`;
  if (golge) {
    const g = document.createElement('div');
    g.style.cssText = `position:absolute;inset:-14%;background:${EMOTE_GOLGESI}`;
    kutu.appendChild(g);
  }
  if (p.url) {
    const img = document.createElement('img');
    img.src = p.url;
    img.alt = p.ad;
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.draggable = false;
    img.style.cssText = 'position:relative;display:block;width:100%;height:100%;object-fit:contain';
    kutu.appendChild(img);
  } else {
    const yazi = document.createElement('span');
    yazi.textContent = p.ad;
    yazi.style.cssText = `position:relative;display:block;width:100%;height:100%;text-align:center;font-size:${Math.round(boyut * 0.8)}px;line-height:${boyut}px`;
    kutu.appendChild(yazi);
  }
  return kutu;
}

type Aktif = { dugum: HTMLDivElement; anim: Animation };

const ORNEK: Parca[] = [{ ad: '🔥' }, { ad: '😂' }, { ad: '💜' }, { ad: '🎉' }, { ad: '👀' }];

export function KappagenWidget(props?: { embedded?: boolean; previewMode?: boolean }) {
  const s = useWidgetSettings('on-screen-emotes', KAPPAGEN_DEFAULTS);
  const ayar = useRef(s);
  ayar.current = s;
  const sahne = useRef<HTMLDivElement>(null);
  const kokRef = useRef<HTMLDivElement>(null);
  const onizleme = onizlemeKipi(props?.previewMode);
  // Durağan kare adresleri (WID-4) emote haritasıyla yüklenir
  useYediTvHaritasi(Boolean((s as Record<string, any>).emoteDondur));

  useEffect(() => {
    const aktif: Aktif[] = [];
    const azHareket = hareketAz();

    // Tek URL sayfası katmanın ekranda olup olmadığını bu işaretten okur
    const bosMu = () => kokRef.current?.toggleAttribute('data-katman-bos', aktif.length === 0);
    const kaldir = (o: Aktif) => {
      const i = aktif.indexOf(o);
      if (i >= 0) aktif.splice(i, 1);
      o.dugum.remove();
      bosMu();
    };

    const sondur = (o: Aktif) => {
      // Yer açarken en eski 160 ms'de söner (anlık kaybolma göze takılma gibi görünüyordu)
      o.anim.pause();
      const i = aktif.indexOf(o);
      if (i >= 0) aktif.splice(i, 1);
      const s2 = o.dugum.animate([{ opacity: getComputedStyle(o.dugum).opacity }, { opacity: 0 }], { duration: 160, fill: 'forwards' });
      s2.onfinish = () => o.dugum.remove();
      bosMu();
    };

    const baslat = (p: Parca, patlama: boolean) => {
      const kok = sahne.current;
      if (!kok) return;
      const a = ayar.current;
      const W = kok.clientWidth || window.innerWidth;
      const H = kok.clientHeight || window.innerHeight;
      const boyut = Math.round(Math.max(16, Number(a.size) || 64) * (patlama ? 1.2 : 0.8 + Math.random() * 0.4));
      const sure = (Math.max(800, Number(a.durationMs) || 3500) * (0.8 + Math.random() * 0.4)) / (hizCarpani(a.speed) * TABAN_HIZ);
      let x0: number, y0: number, x1: number, y1: number;
      if (patlama) {
        const aci = Math.random() * Math.PI * 2;
        const hiz = 25 + Math.random() * 30;
        x0 = W / 2;
        y0 = H / 2;
        x1 = x0 + (Math.cos(aci) * hiz * W) / 100;
        y1 = y0 + (Math.sin(aci) * hiz * H) / 100;
      } else {
        const r = ucusRotasi();
        x0 = (r.x / 100) * W;
        y0 = (r.y / 100) * H;
        x1 = ((r.x + r.dx) / 100) * W;
        y1 = ((r.y + r.dy) / 100) * H;
      }
      const plan: UcusPlani = {
        x0, y0, x1, y1, sure, boyut, patlama,
        donus: a.spin && !azHareket ? (Math.random() - 0.5) * 540 : 0,
        giris: girisTuru((a as Record<string, any>).girisAnimasyonu ?? a.animation),
        girisMs: Number(a.animationDuration) || 300
      };
      const golge = Boolean(a.shadow) && !(a as Record<string, any>).golgeKapali;
      const dugum = dugumYap(p, boyut, golge);
      kok.appendChild(dugum);
      const anim = dugum.animate(ucusKareleri(plan), { duration: sure, easing: patlama ? 'cubic-bezier(.2,.7,.3,1)' : 'linear', fill: 'forwards' });
      const o: Aktif = { dugum, anim };
      aktif.push(o);
      bosMu();
      anim.onfinish = () => kaldir(o);
      anim.oncancel = () => kaldir(o);
    };

    const ekle = (parcalar: Parca[], patlama: boolean) => {
      const a = ayar.current;
      if (a.paused) return;
      const dondur = Boolean((a as Record<string, any>).emoteDondur);
      const kopya = patlama ? Math.max(1, Math.min(10, azHareket ? 1 : Number(a.burstCopies) || 1)) : 1;
      const liste: Parca[] = [];
      for (const p of parcalar) {
        // WID-4: "dondur" açıksa CDN'in durağan karesi (tarama yalnız bir kez)
        const temiz = { ad: String(p.ad || '').slice(0, 60), url: guvenliGorsel(donmusAdres(p.url, dondur)) };
        for (let i = 0; i < kopya; i++) liste.push(temiz);
      }
      const { kabul, sondur: sondurulecek } = yerAc(aktif.length, ekranSiniri(a.maxOnScreen), liste.length, patlama);
      if (!kabul) return;
      for (const o of aktif.slice(0, sondurulecek)) sondur(o);
      const secilen = liste.slice(0, kabul);
      // Görseller çözülmeden eklenmez: ilk kez gelen emote uçanları bir an takılıyordu
      void Promise.all(secilen.map((p) => (p.url ? gorseliCoz(p.url) : null))).then(() => secilen.forEach((p) => baslat(p, patlama)));
    };

    bosMu();
    let ws: KaliciSoket | null = null;
    let ornek = 0;
    if (onizleme) {
      // Ayar penceresindeki önizleme boş kalmasın
      ornek = window.setInterval(() => ekle([ORNEK[Math.floor(Math.random() * ORNEK.length)]], false), 900);
    } else {
      // yeniden-baglanma: gerekmez — anlık emote patlaması; kaçan olay sonradan anlamsız
      ws = new KaliciSoket(wsAdresi());
      ws.onmessage = (e) => {
        let m: any;
        try {
          m = JSON.parse(String(e.data));
        } catch {
          return;
        }
        if (m?.type === 'kappagen' && Array.isArray(m.emotes)) {
          if (!m.patlama && !m.test && !ayar.current.fromChat) return;
          ekle(m.emotes.slice(0, 20), Boolean(m.patlama));
        }
      };
    }
    return () => {
      ws?.close();
      window.clearInterval(ornek);
      for (const o of aktif.splice(0)) {
        o.anim.cancel();
        o.dugum.remove();
      }
    };
  }, [onizleme]);

  return (
    <div ref={kokRef} {...kokOzellik(s)} data-katman-bos="" style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div ref={sahne} style={{ position: 'absolute', inset: 0 }} />
    </div>
  );
}

export default KappagenWidget;
