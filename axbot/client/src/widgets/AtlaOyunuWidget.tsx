/**
 * AxBoT — !atla oyunu katmanı (paraşütle hedefe atlama)
 * Developed by AxthrowA
 *
 * Sunucu her `!atla` için kimlikli bir atlayış yollar (`atla_oyunu_atla`); fizik burada sabit adımla akar
 * (lib/atlaOyunu.ts), karakter yere inince puan sunucuya bildirilir (`atla_oyunu_sonuc`). Puanı, sohbet
 * yanıtını ve skor tablosunu sunucu yönetir; aynı atlayış için ilk gelen sonucu kabul eder, iki katman
 * açık olsa da puan iki kez yazılmaz. Önizleme kipinde atlayışlar yerel üretilir, sonuç bildirilmez.
 *
 * Çizim: tek rAF döngüsü, yalnız `transform`/`opacity` (yerleşim ve boyama yok); paraşüt ve karakter bir
 * kez çizilip kaydırılır. Hareketli emote/avatar filtre almaz (bkz. KappagenWidget ölçümü).
 */
import { kokOzellik } from '../lib/kabuklar.js';
import { useEffect, useRef, useState } from 'react';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { ATLA_OYUNU_DEFAULTS } from '../lib/widget-defaults.js';
import { KaliciSoket } from '../lib/kaliciSoket.js';
import { onizlemeKipi, wsAdresi } from '../lib/widget-style.js';
import { hareketAz } from '../lib/hareket.js';
import { kutla } from '../lib/kutlama.js';
import { guvenliGorsel } from './KappagenWidget.js';
import { avatarAdresi } from '../components/SohbetAvatari.js';
import {
  ATLA_FIZIK_VARSAYILAN,
  hedefKonumu,
  ilerlet,
  puanEtiketi,
  turRuzgari,
  yeniAtlayan,
  type AtlaAyari,
  type Atlayan,
  type Dunya
} from '../lib/atlaOyunu.js';

export interface AtlayisIstegi {
  id: string;
  kullanici: string;
  gorunen: string;
  platform?: string;
  emote?: { ad: string; url?: string };
}

interface Skor {
  gorunen: string;
  enIyi: number;
  toplam: number;
}

/** Ad → sabit renk (paraşüt): aynı izleyici her atlayışta aynı renkte */
export function adRengi(ad: string): string {
  let h = 0;
  for (const c of ad.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360} 85% 58%)`;
}

const TEMALAR: Record<string, (g: number) => string> = {
  havuz: () =>
    'radial-gradient(ellipse at 50% 30%, rgba(255,255,255,.55) 0 8%, transparent 9%), linear-gradient(180deg,#67e8f9 0%,#0ea5e9 45%,#0369a1 100%)',
  hedef: () =>
    'radial-gradient(ellipse at 50% 50%, #ef4444 0 14%, #fff 15% 30%, #ef4444 31% 46%, #fff 47% 62%, #ef4444 63% 78%, #fff 79% 100%)',
  platform: () => 'linear-gradient(180deg,#fbbf24 0 22%,#b45309 23% 100%)'
};

function hedefStili(tema: string, gorsel: string | undefined, w: number, h: number): Partial<CSSStyleDeclaration> {
  if (tema === 'ozel' && gorsel) {
    return { background: `center / contain no-repeat url("${gorsel}")`, borderRadius: '0', boxShadow: 'none' };
  }
  const yuvarlak = tema === 'platform' ? '10px' : '50%';
  return {
    background: (TEMALAR[tema] || TEMALAR.havuz)(w),
    borderRadius: tema === 'platform' ? yuvarlak : `${w / 2}px / ${h / 2}px`,
    boxShadow: tema === 'havuz' ? 'inset 0 -6px 0 rgba(0,0,0,.25), 0 0 0 4px rgba(255,255,255,.75)' : '0 6px 0 rgba(0,0,0,.35)'
  };
}

/** Paraşüt: bir kez çizilen SVG (taranır, sonra yalnız kayar) */
function parasutSvg(renk: string): string {
  return `<svg viewBox="0 0 100 70" width="100%" height="100%" aria-hidden="true">
    <path d="M4 34 Q50 -18 96 34 Q84 28 72 34 Q61 27 50 34 Q39 27 28 34 Q16 28 4 34Z" fill="${renk}" stroke="rgba(0,0,0,.35)" stroke-width="2"/>
    <path d="M20 31 Q50 2 80 31" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="3"/>
    <path d="M6 34 L46 68 M28 34 L48 68 M50 34 L50 68 M72 34 L52 68 M94 34 L54 68" stroke="rgba(255,255,255,.85)" stroke-width="1.6"/>
  </svg>`;
}

/** Varsayılan karakter (avatar/emote yoksa): basit, kendi çizimimiz */
function karakterSvg(renk: string): string {
  return `<svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">
    <circle cx="32" cy="32" r="28" fill="${renk}" stroke="rgba(0,0,0,.45)" stroke-width="3"/>
    <circle cx="23" cy="27" r="5" fill="#111"/><circle cx="41" cy="27" r="5" fill="#111"/>
    <circle cx="24.5" cy="25.5" r="1.6" fill="#fff"/><circle cx="42.5" cy="25.5" r="1.6" fill="#fff"/>
    <path d="M21 40 Q32 50 43 40" fill="none" stroke="#111" stroke-width="3.5" stroke-linecap="round"/>
  </svg>`;
}

/** Kısa sentez sesler: dış dosya yok (internetsiz de çalar) */
function sesCal(tur: 'atla' | 'su' | 'yer' | 'tam', duzey: number) {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const c: AudioContext = (sesCal as any).c || ((sesCal as any).c = new AC());
    const t = c.currentTime;
    const g = c.createGain();
    g.connect(c.destination);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.35 * duzey), t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (tur === 'tam' ? 0.9 : 0.35));
    const o = c.createOscillator();
    o.connect(g);
    if (tur === 'atla') {
      o.type = 'triangle';
      o.frequency.setValueAtTime(880, t);
      o.frequency.exponentialRampToValueAtTime(330, t + 0.3);
    } else if (tur === 'su') {
      o.type = 'sine';
      o.frequency.setValueAtTime(220, t);
      o.frequency.exponentialRampToValueAtTime(900, t + 0.12);
      o.frequency.exponentialRampToValueAtTime(160, t + 0.32);
    } else if (tur === 'yer') {
      o.type = 'square';
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(60, t + 0.2);
    } else {
      o.type = 'triangle';
      [523, 659, 784, 1047].forEach((f, i) => o.frequency.setValueAtTime(f, t + i * 0.11));
    }
    o.start(t);
    o.stop(t + 1);
  } catch {
    /* ses yok: oyun sessiz sürer */
  }
}

type Dugum = { kutu: HTMLDivElement; govde: HTMLDivElement; parasut: HTMLDivElement; etiket: HTMLDivElement; yazi: HTMLDivElement };
type Aktif = { k: Atlayan; istek: AtlayisIstegi; d: Dugum; bildirildi: boolean; kalkis: number; inisAni: number };

const ORNEK_ADLAR = ['ayse', 'mert', 'zeynep', 'kaan', 'ece', 'burak', 'deniz'];

export function AtlaOyunuWidget(props?: { embedded?: boolean; previewMode?: boolean }) {
  const s = useWidgetSettings('atla-oyunu', ATLA_OYUNU_DEFAULTS);
  const ayar = useRef(s);
  ayar.current = s;
  const onizleme = onizlemeKipi(props?.previewMode);
  const sahne = useRef<HTMLDivElement>(null);
  const hedef = useRef<HTMLDivElement>(null);
  const kokRef = useRef<HTMLDivElement>(null);
  const [ruzgar, setRuzgar] = useState(0);
  const [tablo, setTablo] = useState<Skor[]>([]);
  const [toplu, setToplu] = useState<{ bitis: number; bekleyen: number } | null>(null);
  const [kalanSn, setKalanSn] = useState(0);
  const topluRef = useRef(toplu);
  topluRef.current = toplu;

  useEffect(() => {
    if (!toplu) return;
    const t = () => setKalanSn(Math.max(0, Math.ceil((toplu.bitis - Date.now()) / 1000)));
    t();
    const i = window.setInterval(t, 250);
    return () => window.clearInterval(i);
  }, [toplu]);

  useEffect(() => {
    const kok = sahne.current;
    if (!kok) return;
    const azHareket = hareketAz();
    const aktif: Aktif[] = [];
    let artan = 0;
    let son = 0;
    let rafId = 0;
    let hedefX: number | null = null;
    let gizliMi = false;
    /** İsabetten sonra hedef taşınacak: yerdeki herkes kaybolunca (inenin hedefi altından kaymasın) */
    let tasinacak = false;
    let sonAtlayis = Date.now();
    let turRuz = turRuzgari(Number(ayar.current.ruzgar));
    setRuzgar(turRuz);
    const gizleKontrol = window.setInterval(() => {
      const sn = Number(ayar.current.hedefGizleSn) || 0;
      if (sn > 0 && !aktif.length && Date.now() - sonAtlayis > sn * 1000) hedefGoster(false);
    }, 1000);

    const fizik = (): AtlaAyari => {
      const a = ayar.current;
      return {
        ...ATLA_FIZIK_VARSAYILAN,
        boyut: Math.max(24, Math.min(220, Number(a.boyut) || 72)),
        hedefGenislik: Math.max(60, Math.min(900, Number(a.hedefGenislik) || 320)),
        yercekimi: Math.max(0.3, Math.min(3, Number(a.yercekimi) || 1)),
        ruzgar: Math.max(0, Math.min(3, Number(a.ruzgar))),
        inisHizi: Math.max(0.3, Math.min(3, Number(a.inisHizi) || 1)),
        carpisma: a.carpisma !== false
      };
    };
    const dunya = (): Dunya => {
      const W = kok.clientWidth || window.innerWidth;
      const H = kok.clientHeight || window.innerHeight;
      const olcek = H / 1080;
      const f = fizik();
      if (hedefX === null) hedefX = hedefKonumu(W, f.hedefGenislik * olcek, null);
      const zemin = H - (Number(ayar.current.zeminPayi) || 40) * olcek - (f.boyut * olcek) / 2;
      return { W, H, olcek, zemin, hedefX, ruzgar: turRuz };
    };

    const hedefCiz = () => {
      const el = hedef.current;
      if (!el) return;
      const d = dunya();
      const a = ayar.current;
      const w = fizik().hedefGenislik * d.olcek;
      const h = Math.max(18, w * (a.hedefTema === 'hedef' ? 0.22 : 0.18));
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      Object.assign(el.style, hedefStili(String(a.hedefTema), guvenliHedefGorseli(a.hedefGorseli), w, h));
      el.style.transform = `translate3d(${d.hedefX - w / 2}px, ${d.zemin + (fizik().boyut * d.olcek) / 2 - h * 0.55}px, 0)`;
      el.style.opacity = gizliMi ? '0' : '1';
    };
    const hedefGoster = (goster: boolean) => {
      if (gizliMi === !goster) return;
      gizliMi = !goster;
      hedefCiz();
    };

    const dugumYap = (istek: AtlayisIstegi, boyut: number): Dugum => {
      const a = ayar.current;
      const renk = String(a.parasutRengi || '') || adRengi(istek.kullanici);
      const kutu = document.createElement('div');
      kutu.style.cssText = `position:absolute;left:0;top:0;width:${boyut}px;height:${boyut}px;will-change:transform;pointer-events:none`;
      const parasut = document.createElement('div');
      parasut.style.cssText = `position:absolute;left:${-boyut * 0.45}px;bottom:${boyut * 0.62}px;width:${boyut * 1.9}px;height:${boyut * 1.33}px;transform-origin:50% 100%;transform:scale(.15);opacity:0;transition:transform 260ms cubic-bezier(.34,1.56,.64,1),opacity 160ms`;
      parasut.innerHTML = parasutSvg(renk);
      const govde = document.createElement('div');
      govde.style.cssText = 'position:absolute;inset:0;border-radius:50%;overflow:hidden';
      const emote = istek.emote?.url ? guvenliGorsel(istek.emote.url) : undefined;
      if (emote) {
        govde.style.borderRadius = '0';
        govde.style.overflow = 'visible';
        govde.innerHTML = `<img alt="" draggable="false" referrerpolicy="no-referrer" decoding="async" src="${emote}" style="width:100%;height:100%;object-fit:contain;display:block">`;
      } else if (istek.emote?.ad) {
        govde.style.borderRadius = '0';
        govde.style.overflow = 'visible';
        govde.innerHTML = `<span style="display:block;text-align:center;font-size:${boyut * 0.82}px;line-height:${boyut}px"></span>`;
        (govde.firstChild as HTMLElement).textContent = istek.emote.ad.slice(0, 8);
      } else {
        govde.innerHTML = karakterSvg(renk);
        if (a.avatarKullan !== false && !onizleme) {
          const img = document.createElement('img');
          img.alt = '';
          img.draggable = false;
          img.decoding = 'async';
          img.referrerPolicy = 'no-referrer';
          img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:50%;opacity:0;transition:opacity 200ms';
          img.onload = () => {
            img.style.opacity = '1';
            img.style.boxShadow = `0 0 0 ${Math.max(2, boyut * 0.05)}px ${renk}`;
          };
          img.src = avatarAdresi(istek.platform || 'kick', istek.kullanici);
          govde.appendChild(img);
        }
      }
      const etiket = document.createElement('div');
      etiket.style.cssText = `position:absolute;left:50%;top:${boyut + 4}px;transform:translateX(-50%);white-space:nowrap;font-weight:700;font-size:${Math.max(12, Math.round(boyut * 0.2))}px;line-height:1.1;color:${String(a.adRengi || '#fff')};text-shadow:0 1px 2px #000,0 0 6px rgba(0,0,0,.6);${a.adGoster === false ? 'display:none' : ''}`;
      etiket.textContent = istek.gorunen.slice(0, 24);
      const yazi = document.createElement('div');
      yazi.style.cssText = `position:absolute;left:50%;bottom:${boyut + 6}px;transform:translateX(-50%) scale(.4);opacity:0;white-space:nowrap;font-weight:900;font-size:${Math.max(16, Math.round(boyut * 0.42))}px;line-height:1;color:#fff;text-shadow:0 2px 0 #000,0 0 10px rgba(0,0,0,.7);transition:transform 320ms cubic-bezier(.34,1.56,.64,1),opacity 200ms`;
      kutu.append(parasut, govde, etiket, yazi);
      return { kutu, govde, parasut, etiket, yazi };
    };

    const sicrama = (x: number, y: number, boyut: number, su: boolean) => {
      if (azHareket) return;
      const h = document.createElement('div');
      const w = boyut * 1.8;
      h.style.cssText = `position:absolute;left:0;top:0;width:${w}px;height:${w * 0.35}px;border-radius:50%;border:${Math.max(3, boyut * 0.06)}px solid ${su ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.55)'};pointer-events:none`;
      kok.appendChild(h);
      const a = h.animate(
        [
          { transform: `translate3d(${x - w / 2}px, ${y - w * 0.17}px, 0) scale(.3)`, opacity: 1 },
          { transform: `translate3d(${x - w / 2}px, ${y - w * 0.17}px, 0) scale(1.4)`, opacity: 0 }
        ],
        { duration: 650, easing: 'cubic-bezier(.2,.7,.3,1)' }
      );
      a.onfinish = () => h.remove();
    };

    const bildir = (o: Aktif) => {
      if (o.bildirildi || onizleme) return;
      o.bildirildi = true;
      ws?.send(JSON.stringify({ action: 'atla_oyunu_sonuc', id: o.istek.id, puan: o.k.puan }));
    };

    const kare = (zaman: number) => {
      rafId = 0;
      if (!aktif.length) {
        son = 0;
        return;
      }
      const dt = son ? (zaman - son) / 1000 : 0;
      son = zaman;
      const d = dunya();
      const f = fizik();
      const havada = aktif.filter((o) => !o.k.indi).map((o) => o.k);
      artan = ilerlet(havada, d, f, dt, artan);
      const yari = (f.boyut * d.olcek) / 2;
      const a = ayar.current;
      for (const o of [...aktif]) {
        const k = o.k;
        if (k.parasut && !k.indi && o.d.parasut.style.opacity !== '1') {
          o.d.parasut.style.opacity = '1';
          o.d.parasut.style.transform = 'scale(1)';
        }
        // Yatay hıza göre hafif eğim: süzülüyormuş gibi
        const egim = k.indi ? 0 : Math.max(-18, Math.min(18, (k.vx / Math.max(1, d.olcek)) * 0.08));
        o.d.kutu.style.transform = `translate3d(${(k.x - yari).toFixed(1)}px, ${(k.y - yari).toFixed(1)}px, 0) rotate(${egim.toFixed(1)}deg)`;
        if (k.indi && !o.inisAni) {
          o.inisAni = zaman;
          o.d.parasut.style.transform = 'scale(.2) translateY(30%)';
          o.d.parasut.style.opacity = '0';
          o.d.yazi.textContent = puanEtiketi(k.puan);
          o.d.yazi.style.color = k.puan >= 95 ? '#fde047' : k.puan > 0 ? '#86efac' : '#fca5a5';
          // Iska sade kalır: isabetler göze çarpsın
          o.d.yazi.style.opacity = k.puan > 0 ? '1' : '.75';
          o.d.yazi.style.transform = `translateX(-50%) scale(${k.puan > 0 ? 1 : 0.6})`;
          const tema = String(a.hedefTema);
          if (a.sesAcik !== false) sesCal(k.puan >= 95 ? 'tam' : k.puan > 0 && tema === 'havuz' ? 'su' : 'yer', Number(a.sesDuzeyi) || 0.5);
          sicrama(k.x, k.y + yari, f.boyut * d.olcek, k.puan > 0 && tema === 'havuz');
          if (k.puan >= 95 && a.tamIsabetKutlama && a.tamIsabetKutlama !== 'yok') kutla(String(a.tamIsabetKutlama));
          bildir(o);
          if (k.puan > 0 && a.hedefTasi !== false) tasinacak = true;
          // Yerdekiler üst üste binmesin: yalnız görüntü kayar, puan iniş noktasından hesaplandı
          const yer = f.boyut * d.olcek * 0.85;
          for (let deneme = 0; deneme < 6; deneme++) {
            const cakisan = aktif.find((x) => x !== o && x.k.indi && Math.abs(x.k.x - k.x) < yer);
            if (!cakisan) break;
            const yon = k.x >= cakisan.k.x ? 1 : -1;
            k.x = Math.max(yari, Math.min(d.W - yari, cakisan.k.x + yon * yer));
          }
          o.d.kutu.style.transform = `translate3d(${(k.x - yari).toFixed(1)}px, ${(k.y - yari).toFixed(1)}px, 0)`;
        }
        const kalma = Math.max(1, Number(a.inisteKalmaSn) || 4) * 1000;
        if (o.inisAni && zaman - o.inisAni > kalma) {
          aktif.splice(aktif.indexOf(o), 1);
          const s2 = o.d.kutu.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
          s2.onfinish = () => o.d.kutu.remove();
          if (!aktif.length && tasinacak) {
            tasinacak = false;
            hedefX = hedefKonumu(d.W, f.hedefGenislik * d.olcek, hedefX);
            turRuz = turRuzgari(Number(ayar.current.ruzgar));
            setRuzgar(turRuz);
            hedefCiz();
          }
        }
      }
      kokRef.current?.toggleAttribute('data-katman-bos', !aktif.length && gizliMi);
      rafId = requestAnimationFrame(kare);
    };

    const atlat = (istek: AtlayisIstegi) => {
      const f = fizik();
      const d = dunya();
      const sinir = Math.max(1, Number(ayar.current.enCokHavada) || 8) * (topluRef.current ? 4 : 1) + 4;
      if (aktif.filter((o) => !o.k.indi).length >= sinir) return;
      sonAtlayis = Date.now();
      hedefGoster(true);
      const boyut = f.boyut * d.olcek;
      const k = yeniAtlayan(istek.id, d, f);
      const dugum = dugumYap(istek, boyut);
      dugum.kutu.style.transform = `translate3d(${k.x - boyut / 2}px, ${k.y - boyut / 2}px, 0)`;
      kok.appendChild(dugum.kutu);
      aktif.push({ k, istek, d: dugum, bildirildi: false, kalkis: performance.now(), inisAni: 0 });
      if (ayar.current.sesAcik !== false) sesCal('atla', (Number(ayar.current.sesDuzeyi) || 0.5) * 0.6);
      kokRef.current?.toggleAttribute('data-katman-bos', false);
      if (!rafId) rafId = requestAnimationFrame(kare);
    };

    let ws: KaliciSoket | null = null;
    let ornek = 0;
    const tabloYukle = () =>
      fetch('/api/atla-oyunu/tablo')
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => Array.isArray(j?.tablo) && setTablo(j.tablo))
        .catch(() => {});
    hedefCiz();
    if (onizleme) {
      let n = 0;
      ornek = window.setInterval(() => {
        const ad = ORNEK_ADLAR[n++ % ORNEK_ADLAR.length];
        atlat({ id: `onizleme-${n}`, kullanici: ad, gorunen: ad, emote: n % 3 === 0 ? { ad: '🐸' } : undefined });
      }, 1600);
      setTablo([
        { gorunen: 'zeynep', enIyi: 100, toplam: 412 },
        { gorunen: 'mert', enIyi: 96, toplam: 255 },
        { gorunen: 'ece', enIyi: 81, toplam: 190 }
      ]);
    } else {
      void tabloYukle();
      ws = new KaliciSoket(wsAdresi());
      // Kopukken inen atlayışın sonucu bağlantı gelince yollanır; tablo da tazelenir
      ws.onyenidenbaglandi = () => {
        for (const o of aktif) if (o.k.indi && !o.bildirildi) bildir(o);
        void tabloYukle();
      };
      ws.onmessage = (e) => {
        let m: any;
        try {
          m = JSON.parse(String(e.data));
        } catch {
          return;
        }
        if (m?.type === 'atla_oyunu_atla' && m.data?.id) {
          atlat({
            id: String(m.data.id).slice(0, 80),
            kullanici: String(m.data.kullanici || '').slice(0, 40),
            gorunen: String(m.data.gorunen || m.data.kullanici || '').slice(0, 40),
            platform: String(m.data.platform || 'kick'),
            emote: m.data.emote && typeof m.data.emote === 'object' ? { ad: String(m.data.emote.ad || '').slice(0, 60), url: m.data.emote.url } : undefined
          });
        } else if (m?.type === 'atla_oyunu_tablo' && Array.isArray(m.tablo)) {
          setTablo(m.tablo.slice(0, 10));
        } else if (m?.type === 'atla_oyunu_toplu') {
          setToplu(m.acik ? { bitis: Number(m.bitis) || Date.now(), bekleyen: Number(m.bekleyen) || 0 } : null);
        } else if (m?.type === 'atla_oyunu_sifirla') {
          for (const o of aktif.splice(0)) o.d.kutu.remove();
          hedefX = null;
          hedefCiz();
        }
      };
    }
    const boyutDegisti = () => hedefCiz();
    window.addEventListener('resize', boyutDegisti);
    return () => {
      ws?.close();
      window.clearInterval(ornek);
      window.clearInterval(gizleKontrol);
      window.removeEventListener('resize', boyutDegisti);
      if (rafId) cancelAnimationFrame(rafId);
      for (const o of aktif.splice(0)) o.d.kutu.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onizleme]);

  const sagda = String(s.skorTablosuKonum || 'sagUst').startsWith('sag');
  const ustte = String(s.skorTablosuKonum || 'sagUst').endsWith('Ust');
  const kosee = { [sagda ? 'right' : 'left']: 24, [ustte ? 'top' : 'bottom']: 24 } as Record<string, number>;
  return (
    <div ref={kokRef} {...kokOzellik(s)} data-katman-bos="" style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', fontFamily: 'inherit' }}>
      <div ref={hedef} style={{ position: 'absolute', left: 0, top: 0, transition: 'opacity 400ms', willChange: 'transform' }} />
      <div ref={sahne} style={{ position: 'absolute', inset: 0 }} />
      {(s.ruzgarGoster !== false || s.skorTablosu !== false || toplu) && (
        <div style={{ position: 'absolute', ...kosee, display: 'flex', flexDirection: 'column', gap: 8, alignItems: sagda ? 'flex-end' : 'flex-start', color: '#fff', textShadow: '0 1px 2px #000' }}>
          {toplu && (
            <div style={{ background: 'rgba(8,10,16,.82)', borderRadius: 12, padding: '10px 14px', fontWeight: 800, fontSize: 18 }}>
              🪂 Toplu atlama · <span style={{ color: '#fde047' }}>!atla</span> yaz · {kalanSn} sn · {toplu.bekleyen} kişi
            </div>
          )}
          {s.ruzgarGoster !== false && (
            <div style={{ background: 'rgba(8,10,16,.7)', borderRadius: 10, padding: '6px 10px', fontSize: 14, fontWeight: 700 }}>
              Rüzgâr {Math.abs(ruzgar) < 8 ? 'yok' : `${ruzgar < 0 ? '←' : '→'} ${Math.max(1, Math.round(Math.abs(ruzgar) / 35))}`}
            </div>
          )}
          {s.skorTablosu !== false && tablo.length > 0 && (
            <div style={{ background: 'rgba(8,10,16,.78)', borderRadius: 12, padding: '10px 12px', minWidth: 190, fontSize: 14 }}>
              <div style={{ fontWeight: 800, opacity: 0.8, marginBottom: 6 }}>🏆 En iyi atlayışlar</div>
              {tablo.slice(0, 5).map((t, i) => (
                <div key={t.gorunen} style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
                  <span>
                    {i + 1}. {t.gorunen}
                  </span>
                  <b style={{ color: t.enIyi >= 95 ? '#fde047' : '#86efac' }}>{t.enIyi}</b>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Özel hedef görseli: yalnız https ya da sunucunun kendi medya yolu */
function guvenliHedefGorseli(v: unknown): string | undefined {
  const s = String(v || '').trim();
  if (/^https:\/\/[^\s"'()<>]+$/i.test(s) || /^\/(media|api\/media)\/[\w./%-]+$/.test(s)) return s;
  return undefined;
}

export default AtlaOyunuWidget;
