/**
 * UI-5 (H10): bot sunucusuna ulaşılıyor mu. Ulaşılamazken sayfalar boş tablo yerine "Bot kapalı" gösterir;
 * "komut yok" ile "bot kapalı" ayrılır. Tek başarısızlık sayılmaz (yeniden başlatma, ağ hıçkırığı).
 */
import { useEffect, useState } from 'react';
import { BOT_BASLAT } from './gomuluSozlesme.js';

export const KAPALI_ESIGI = 2;
const ARALIK_MS = 5000;

/** Art arda başarısızlık sayısından durum */
export const erisimDurumu = (basarisiz: number): 'bagli' | 'kapali' => (basarisiz >= KAPALI_ESIGI ? 'kapali' : 'bagli');

export function useSunucuErisimi(): { durum: 'bagli' | 'kapali'; yenidenDene: () => void } {
  const [basarisiz, setBasarisiz] = useState(0);
  const [tur, setTur] = useState(0);
  useEffect(() => {
    let iptal = false;
    const yokla = async () => {
      try {
        const r = await fetch('/health', { cache: 'no-store' });
        if (!iptal) setBasarisiz(r.ok ? 0 : (n) => n + 1);
      } catch {
        if (!iptal) setBasarisiz((n) => n + 1);
      }
    };
    void yokla();
    const id = window.setInterval(() => void yokla(), ARALIK_MS);
    return () => {
      iptal = true;
      window.clearInterval(id);
    };
  }, [tur]);
  return { durum: erisimDurumu(basarisiz), yenidenDene: () => setTur((t) => t + 1) };
}

/** Studio içindeyse botu Studio başlatır (AxBotHost); tek başına açıkken başlatacak kimse yok */
export function studiodanBaslat(): boolean {
  if (window.parent === window) return false;
  window.parent.postMessage({ type: BOT_BASLAT }, '*');
  return true;
}
