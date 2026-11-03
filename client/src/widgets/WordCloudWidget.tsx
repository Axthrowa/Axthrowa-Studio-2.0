/**
 * AxBoT Kelime Bulutu — sohbette en çok geçen sözcükler, sıklığa göre büyüyen bulut
 * Developed by AxthrowA
 *
 * Sayım sunucuda (`/api/sohbet-istatistik`); widget birkaç saniyede bir okur.
 * Yerleşim: sözcükler sarmal üzerinde sırayla yerleştirilir, çakışanlar dışarı itilir.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { WORD_CLOUD_DEFAULTS } from '../lib/widget-defaults.js';
import { onizlemeKipi, rgba } from '../lib/widget-style.js';

type Sozcuk = { sozcuk: string; sayi: number };

const ORNEK: Sozcuk[] = 'KEKW:42 gol:30 harika:24 valorant:20 efsane:18 yayın:15 klip:14 LUL:13 abone:11 mod:9 bölüm:8 boss:8 müzik:7 şaka:6 POG:6 kazandık:5 rank:5 takım:4'
  .split(' ')
  .map((p) => ({ sozcuk: p.split(':')[0], sayi: Number(p.split(':')[1]) }));

export interface Yerlesik {
  sozcuk: string;
  x: number;
  y: number;
  boyut: number;
  renk: string;
  donuk: boolean;
}

/** Arşimet sarmalı ile çakışmasız yerleşim (yaklaşık kutu: genişlik ≈ harf × 0.6 × boyut) */
export function bulutYerlesimi(liste: Sozcuk[], w: number, h: number, enKucuk: number, enBuyuk: number, renkler: string[], dikeyOran: number): Yerlesik[] {
  if (!liste.length) return [];
  const max = liste[0].sayi;
  const min = liste[liste.length - 1].sayi;
  const kutular: Array<{ x: number; y: number; w: number; h: number }> = [];
  const sonuc: Yerlesik[] = [];
  liste.forEach((s, i) => {
    const oran = max === min ? 1 : (s.sayi - min) / (max - min);
    const boyut = Math.round(enKucuk + Math.sqrt(oran) * (enBuyuk - enKucuk));
    const donuk = i > 0 && (i * 7) % 10 < dikeyOran * 10;
    const kw = s.sozcuk.length * boyut * 0.62 + 6;
    const kh = boyut * 1.1;
    const [bw, bh] = donuk ? [kh, kw] : [kw, kh];
    for (let t = 0; t < 2000; t += 1) {
      const a = t * 0.35;
      const r = 4 * a;
      const x = w / 2 + r * Math.cos(a) * 1.4 - bw / 2;
      const y = h / 2 + r * Math.sin(a) - bh / 2;
      if (x < 0 || y < 0 || x + bw > w || y + bh > h) {
        if (r > Math.max(w, h)) break;
        continue;
      }
      if (kutular.some((k) => x < k.x + k.w && x + bw > k.x && y < k.y + k.h && y + bh > k.y)) continue;
      kutular.push({ x, y, w: bw, h: bh });
      sonuc.push({ sozcuk: s.sozcuk, x: x + bw / 2, y: y + bh / 2, boyut, renk: renkler[i % renkler.length], donuk });
      break;
    }
  });
  return sonuc;
}

export function WordCloudWidget({ embedded = false, previewMode = false }: { embedded?: boolean; previewMode?: boolean }) {
  const s = useWidgetSettings('word-cloud', WORD_CLOUD_DEFAULTS);
  const onizleme = onizlemeKipi(previewMode);
  const [liste, setListe] = useState<Sozcuk[]>(onizleme ? ORNEK : []);
  const kutu = useRef<HTMLDivElement>(null);
  const [olcu, setOlcu] = useState({ w: 800, h: 450 });

  useEffect(() => {
    if (onizleme) return;
    const oku = () =>
      fetch('/api/sohbet-istatistik')
        .then((r) => r.json())
        .then((d) => Array.isArray(d?.bulut) && setListe(d.bulut))
        .catch(() => {});
    oku();
    const t = setInterval(oku, Math.max(2, Number(s.refreshSec) || 5) * 1000);
    return () => clearInterval(t);
  }, [onizleme, s.refreshSec]);

  useEffect(() => {
    const el = kutu.current;
    if (!el) return;
    const g = new ResizeObserver(() => setOlcu({ w: el.clientWidth, h: el.clientHeight }));
    g.observe(el);
    return () => g.disconnect();
  }, []);

  const renkler = useMemo(() => String(s.colors || '').split(',').map((r) => r.trim()).filter(Boolean), [s.colors]);
  const yerler = useMemo(
    () =>
      bulutYerlesimi(
        liste.filter((x) => x.sayi >= (Number(s.minCount) || 1)).slice(0, Number(s.maxWords) || 40),
        olcu.w,
        olcu.h,
        Number(s.minSize) || 16,
        Number(s.maxSize) || 72,
        renkler.length ? renkler : ['#ffffff'],
        Number(s.verticalRatio) || 0
      ),
    [liste, olcu, s.minCount, s.maxWords, s.minSize, s.maxSize, renkler, s.verticalRatio]
  );

  return (
    <div
      ref={kutu}
      className={`${embedded ? 'w-full h-full' : 'w-screen h-screen'} relative overflow-hidden select-none`}
      style={{ background: Number(s.bgOpacity) > 0 ? rgba(s.bgColor, s.bgOpacity) : 'transparent', borderRadius: Number(s.radius) || 0, fontFamily: s.fontFamily }}
    >
      {yerler.map((y) => (
        <span
          key={y.sozcuk}
          className="absolute whitespace-nowrap font-black"
          style={{
            left: y.x,
            top: y.y,
            fontSize: y.boyut,
            color: y.renk,
            lineHeight: 1,
            transform: `translate(-50%, -50%)${y.donuk ? ' rotate(-90deg)' : ''}`,
            textShadow: s.textShadow !== false ? '0 2px 4px rgba(0,0,0,.85)' : undefined,
            transition: 'left .6s ease, top .6s ease, font-size .6s ease'
          }}
        >
          {y.sozcuk}
        </span>
      ))}
    </div>
  );
}

export default WordCloudWidget;
