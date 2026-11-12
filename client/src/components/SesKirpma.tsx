/** Ses adresinin yanında: kaçıncı saniyeden başlasın, en fazla kaç saniye çalsın. */
import { kirpmaOku, kirpmaYaz } from '../lib/sesKirpma';

export function SesKirpma({ url, degistir }: { url: string; degistir: (yeni: string) => void }) {
  const { temiz, baslangic, sure } = kirpmaOku(url);
  if (!temiz) return null;
  const alan = 'w-16 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white';
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
      <label className="flex items-center gap-1">
        Başla
        <input type="number" min={0} step={0.5} value={baslangic} aria-label="Sesin başlayacağı saniye" className={alan} onChange={(e) => degistir(kirpmaYaz(url, Number(e.target.value), sure))} />
        sn
      </label>
      <label className="flex items-center gap-1">
        En fazla
        <input type="number" min={0} step={0.5} value={sure} aria-label="En fazla çalma süresi (0 sonuna kadar)" className={alan} onChange={(e) => degistir(kirpmaYaz(url, baslangic, Number(e.target.value)))} />
        sn (0 = sonuna kadar)
      </label>
    </div>
  );
}
