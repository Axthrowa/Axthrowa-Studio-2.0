/**
 * AxBoT Geri Sayım widget'ı — sohbetten (`!gerisayim 10m Yayın başlıyor`) ya da panelden başlatılan sayaç.
 * Developed by AxthrowA
 *
 * Süre sunucuda tutulur (OBS kaynağı yenilense de kaldığı yerden sürer). Saat farkı, sunucunun
 * gönderdiği `simdi` ile düzeltilir. Ekran saniyede dört kez yalnız metin olarak güncellenir; çubuk
 * `transform: scaleX` ile kısalır (yeniden yerleşim yok). Bitince yazı gösterilir, istenirse kısa bir ses çalar.
 */
import { useEffect, useRef, useState } from 'react';
import { kokOzellik } from '../lib/kabuklar.js';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { GERI_SAYIM_DEFAULTS } from '../lib/widget-defaults.js';
import { onizlemeMi, renkSaydam, sadeKart } from '../lib/sadeKart.js';

export type GeriSayimVerisi = { bitis: number | null; kalanMs: number | null; toplamMs: number; baslik: string; simdi?: number };

/** Kalan süre (ms). `fark` = sunucu saati − yerel saat */
export function kalanMs(v: GeriSayimVerisi | null, yerel: number, fark: number): number {
  if (!v) return 0;
  if (v.kalanMs !== null && v.kalanMs !== undefined) return Math.max(0, v.kalanMs);
  if (v.bitis === null || v.bitis === undefined) return 0;
  return Math.max(0, v.bitis - (yerel + fark));
}

/** 3725000 → "1:02:05"; `sifirli` iken dakika da iki hane ("05:00") */
export function sureMetni(ms: number, sifirli = false): string {
  const t = Math.max(0, Math.ceil(ms / 1000));
  const sa = Math.floor(t / 3600);
  const dk = Math.floor((t % 3600) / 60);
  const sn = t % 60;
  const iki = (n: number) => String(n).padStart(2, '0');
  if (sa > 0) return `${sa}:${iki(dk)}:${iki(sn)}`;
  return `${sifirli ? iki(dk) : dk}:${iki(sn)}`;
}

function bitisSesi(duzey: number) {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ac = new AC();
    [0, 0.16, 0.32].forEach((t, i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'triangle';
      o.frequency.value = [660, 880, 1320][i];
      g.gain.setValueAtTime(0.0001, ac.currentTime + t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.001, duzey) * 0.4, ac.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + t + 0.28);
      o.connect(g).connect(ac.destination);
      o.start(ac.currentTime + t);
      o.stop(ac.currentTime + t + 0.3);
    });
    setTimeout(() => void ac.close?.(), 1200);
  } catch {
    /* ses yoksa sessiz */
  }
}

export function GeriSayimWidget({ embedded = false, previewMode = false }: { embedded?: boolean; previewMode?: boolean }) {
  const s = useWidgetSettings('geri-sayim', GERI_SAYIM_DEFAULTS);
  const { lastMessage } = useWebSocket('all');
  const onizleme = onizlemeMi(previewMode);
  const [veri, setVeri] = useState<GeriSayimVerisi | null>(() =>
    onizleme ? { bitis: Date.now() + 5 * 60_000, kalanMs: null, toplamMs: 10 * 60_000, baslik: '' } : null
  );
  const fark = useRef(0);
  const [simdi, setSimdi] = useState(() => Date.now());
  const [bitisAni, setBitisAni] = useState<number | null>(null);
  const caldi = useRef(false);

  const al = (v: any) => {
    if (!v || typeof v !== 'object') return;
    if (typeof v.simdi === 'number') fark.current = v.simdi - Date.now();
    setVeri({ bitis: v.bitis ?? null, kalanMs: v.kalanMs ?? null, toplamMs: Number(v.toplamMs) || 0, baslik: String(v.baslik || '') });
    setBitisAni(null);
    // Çoktan bitmiş bir sayaç (kaynak sonradan açıldı) bitiş yazısını/sesini yeniden göstermesin
    caldi.current = typeof v.bitis === 'number' && v.bitis - (Date.now() + fark.current) < -2000;
  };

  useEffect(() => {
    if (onizleme) return;
    fetch('/api/overlay/geri-sayim')
      .then((r) => (r.ok ? r.json() : null))
      .then(al)
      .catch(() => {});
  }, [onizleme]);

  useEffect(() => {
    if (lastMessage?.type !== 'geri_sayim_durumu') return;
    if (onizleme && !lastMessage.test) return;
    al(lastMessage.data);
  }, [lastMessage, onizleme]);

  const kalan = kalanMs(veri, simdi, fark.current);
  const calisiyor = Boolean(veri && veri.bitis !== null && kalan > 0);

  // Yalnız sayaç çalışırken saniyede dört kez yenile
  useEffect(() => {
    if (!calisiyor) return;
    const t = window.setInterval(() => setSimdi(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [calisiyor]);

  // Sıfıra inince: bitiş yazısı + ses (bir kez)
  useEffect(() => {
    if (!veri || veri.bitis === null || kalan > 0 || caldi.current) return;
    caldi.current = true;
    setBitisAni(Date.now());
    if (s.sesAcik && !onizleme) bitisSesi(Number(s.sesDuzeyi) || 0.5);
  }, [veri, kalan, s.sesAcik, s.sesDuzeyi, onizleme]);

  // Bitiş yazısı belirli süre görünür
  useEffect(() => {
    if (bitisAni === null) return;
    const sn = Math.max(0, Number(s.bitinceGosterSn) || 0);
    if (!sn) return;
    const t = window.setTimeout(() => setSimdi(Date.now()), sn * 1000 + 50);
    return () => window.clearTimeout(t);
  }, [bitisAni, s.bitinceGosterSn]);

  const bitisSuruyor = bitisAni !== null && (Number(s.bitinceGosterSn) <= 0 || simdi - bitisAni < Number(s.bitinceGosterSn) * 1000);
  const duraklatildi = Boolean(veri && veri.kalanMs !== null && veri.kalanMs > 0);
  const var_ = calisiyor || duraklatildi || bitisSuruyor;
  const gizli = !onizleme && s.bosGizle !== false && !var_;

  const boyut = Math.max(16, Number(s.fontSize) || 72);
  const vurgu = String(s.accentColor || '#22d3ee');
  const baslik = (veri?.baslik || s.varsayilanBaslik || '').trim();
  const oran = veri && veri.toplamMs > 0 ? Math.max(0, Math.min(1, kalan / veri.toplamMs)) : 0;
  const metin = bitisSuruyor && kalan === 0 ? s.bitinceMetin || 'Başlıyor!' : sureMetni(kalan, Boolean(s.sifirliDakika));

  return (
    <div
      className={embedded ? 'w-full h-full flex items-center justify-center' : 'w-screen h-screen bg-transparent p-4 flex items-start justify-start'}
      data-katman-bos={gizli ? '' : undefined}
    >
      <div
        {...kokOzellik(s)}
        style={{
          ...sadeKart(s),
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          minWidth: boyut * 3.2,
          padding: `${boyut * 0.22}px ${boyut * 0.45}px`,
          visibility: gizli ? 'hidden' : undefined
        }}
      >
        {baslik && (
          <div style={{ fontSize: boyut * 0.3, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: renkSaydam(s.textColor || '#ffffff', 0.75) }}>
            {baslik}
          </div>
        )}
        <div style={{ fontSize: boyut, fontWeight: 900, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums', color: bitisSuruyor && kalan === 0 ? vurgu : undefined }}>
          {metin}
          {duraklatildi && <span style={{ fontSize: boyut * 0.35, marginLeft: 10, opacity: 0.7 }}>⏸</span>}
        </div>
        {s.cubukGoster !== false && veri && veri.toplamMs > 0 && (
          <div style={{ width: '100%', height: Math.max(4, boyut * 0.08), marginTop: boyut * 0.12, borderRadius: 99, background: renkSaydam('#ffffff', 0.12), overflow: 'hidden' }}>
            <div style={{ height: '100%', background: vurgu, transformOrigin: 'left center', transform: `scaleX(${oran})`, transition: 'transform .25s linear' }} />
          </div>
        )}
      </div>
    </div>
  );
}

export default GeriSayimWidget;
