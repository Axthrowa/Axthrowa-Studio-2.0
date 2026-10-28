/**
 * Widget ayarları penceresinde canlı önizleme: widget'ın gerçek OBS sayfası 1280×720 iframe'de
 * açılır ve kutuya sığacak kadar küçültülür. Ayarlar kendiliğinden kaydedilip yayınlandığı için
 * önizleme her değişiklikte güncellenir (OBS'teki kaynakla aynı yol).
 */
import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Play } from 'lucide-react';

const GENISLIK = 1280;
const YUKSEKLIK = 720;

export function WidgetOnizleme({ url, testTuru }: { url: string; testTuru?: string }) {
  const kutu = useRef<HTMLDivElement>(null);
  const [olcek, setOlcek] = useState(0.4);
  const [anahtar, setAnahtar] = useState(0);
  const [test, setTest] = useState(false);

  useEffect(() => {
    const el = kutu.current;
    if (!el) return;
    const g = new ResizeObserver(() => setOlcek(el.clientWidth / GENISLIK));
    g.observe(el);
    return () => g.disconnect();
  }, []);

  const adres = (() => {
    try {
      const u = new URL(url, window.location.origin);
      u.searchParams.set('preview', '1');
      if (test && testTuru) u.searchParams.set('test', testTuru);
      return u.pathname + u.search;
    } catch {
      return url;
    }
  })();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-black uppercase tracking-wider text-cyan-300">Canlı önizleme</span>
        <div className="flex gap-1.5">
          {testTuru && (
            <button type="button" onClick={() => { setTest(true); setAnahtar(k => k + 1); }} className="text-[10px] px-2 py-1 rounded-lg bg-emerald-600/80 text-white font-bold flex items-center gap-1">
              <Play className="w-3 h-3" /> Örnek göster
            </button>
          )}
          <button type="button" onClick={() => setAnahtar(k => k + 1)} className="text-[10px] px-2 py-1 rounded-lg bg-white/10 text-gray-200 font-bold flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Yenile
          </button>
        </div>
      </div>
      <div
        ref={kutu}
        className="relative w-full overflow-hidden rounded-xl border border-white/10"
        style={{
          aspectRatio: `${GENISLIK} / ${YUKSEKLIK}`,
          // Saydam widget'lar dama desenli zeminde görünsün (OBS'teki gibi arkası boş)
          background: 'repeating-conic-gradient(#1f2430 0% 25%, #151821 0% 50%) 50% / 24px 24px'
        }}
      >
        <iframe
          key={anahtar}
          src={adres}
          title="Widget önizleme"
          style={{ width: GENISLIK, height: YUKSEKLIK, transform: `scale(${olcek})`, transformOrigin: '0 0', border: 0, background: 'transparent' }}
          allowTransparency
        />
      </div>
      <p className="text-[10px] text-gray-500">Ayar değişince önizleme kendiliğinden güncellenir (OBS'teki kaynakla aynı). Olay bekleyen widget'larda "Örnek göster"e bas.</p>
    </div>
  );
}

export default WidgetOnizleme;
