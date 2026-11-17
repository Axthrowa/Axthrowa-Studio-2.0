/**
 * AxBoT — widget'ların ortak iskeleti (WID-6).
 * Developed by AxthrowA
 *
 * Her widget aynı şeyi yeniden yazıyordu: ayar okuma, önizleme kipi, soket (kopunca yeniden bağlanma),
 * bağlantı dönünce durumu tazeleme, liste tavanı ve "hareketi azalt". Hepsi tek kancada:
 *
 *   const { s, onizleme, gonder, hareketAz } = useWidgetCalismasi('trivia', {
 *     kanal: 'trivia', previewMode, onMesaj: (m) => …, onAcildi: () => durumuOku()
 *   });
 *
 * Test olayları sunucudan aynı soketle gelir (gerçek olayla aynı yol); önizlemede soket açılmaz.
 */
import { useEffect, useRef, useState } from 'react';
import { KaliciSoket } from '../lib/kaliciSoket.js';
import { hareketAz } from '../lib/hareket.js';
import { onizlemeKipi, wsAdresi } from '../lib/widget-style.js';
import { useWidgetSettings } from './useWidgetSettings.js';

export interface SoketIletisi {
  type?: string;
  [k: string]: any;
}

interface SoketSecenek {
  /** Soket açılsın mı (önizlemede kapalı) */
  acik?: boolean;
  onMesaj?: (m: SoketIletisi) => void;
  /** Bağlantı açıldı ya da koptuktan sonra geri geldi: kaçırılan durumu buradan okuyun */
  onAcildi?: () => void;
}

/** Sunucu soketi: paylaşılan, kendi kendine yeniden bağlanan bağlantı; iletiler JSON çözülmüş gelir. */
export function useWidgetSoketi(kanal: string, { acik = true, onMesaj, onAcildi }: SoketSecenek = {}) {
  const [bagli, setBagli] = useState(false);
  const soket = useRef<KaliciSoket | null>(null);
  const dinleyici = useRef({ onMesaj, onAcildi });
  dinleyici.current = { onMesaj, onAcildi };

  useEffect(() => {
    if (!acik) return;
    const s = new KaliciSoket(wsAdresi(kanal));
    soket.current = s;
    s.onacildi = () => {
      setBagli(true);
      dinleyici.current.onAcildi?.();
    };
    s.onkapandi = () => setBagli(false);
    s.onmessage = (e) => {
      let m: SoketIletisi;
      try {
        m = JSON.parse(String(e.data));
      } catch {
        return;
      }
      dinleyici.current.onMesaj?.(m);
    };
    return () => {
      soket.current = null;
      s.close();
      setBagli(false);
    };
  }, [kanal, acik]);

  /** Bağlantı yoksa `false` döner (ileti kaybolur; sunucu süre sınırıyla ilerler). */
  const gonder = (veri: unknown) => soket.current?.send(JSON.stringify(veri)) ?? false;
  return { bagli, gonder };
}

/** Listeyi son `tavan` öğeyle sınırlar (saatlerce açık katmanda bellek büyümesin). */
export function tavanla<T>(liste: T[], tavan: number): T[] {
  return liste.length > tavan ? liste.slice(-tavan) : liste;
}

interface CalismaSecenek<T> extends Omit<SoketSecenek, 'acik'> {
  /** Soket kanalı (`wsAdresi` türü); verilmezse soket açılmaz */
  kanal?: string;
  previewMode?: boolean;
  varsayilan?: T;
}

export function useWidgetCalismasi<T extends Record<string, any>>(widgetId: string, secenek: CalismaSecenek<T> = {}) {
  const s = useWidgetSettings<T>(widgetId, secenek.varsayilan);
  const onizleme = onizlemeKipi(secenek.previewMode);
  const { bagli, gonder } = useWidgetSoketi(secenek.kanal ?? 'all', {
    acik: Boolean(secenek.kanal) && !onizleme,
    onMesaj: secenek.onMesaj,
    onAcildi: secenek.onAcildi
  });
  return { s, onizleme, bagli, gonder, hareketAz: hareketAz() };
}
