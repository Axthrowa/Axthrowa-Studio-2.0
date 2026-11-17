/**
 * Widget ayarlarının başlığında: bu katman şu an OBS'te açık mı?
 * Yayında katmanın görünmediği, ayar yaparken anlaşılsın.
 */
import { useDurumOzeti } from '../lib/durumOzeti.js';
import { katmanAdi } from '../lib/widget-style.js';

const once = (ms: number) => {
  const dk = Math.max(0, Math.round((Date.now() - ms) / 60_000));
  return dk < 1 ? 'az önce' : `${dk} dk önce`;
};

export function KatmanBaglantisi({ yol }: { yol: string }) {
  const d = useDurumOzeti();
  const ad = katmanAdi(yol);
  if (!d || !ad) return null;
  const k = d.katmanlar?.find((x) => x.katman === ad);
  const [renk, metin] = !k
    ? ['bg-gray-500', 'Bu oturumda OBS’te açılmadı']
    : k.bagli > 0
      ? ['bg-emerald-400', k.obs > 0 ? `OBS’te açık (${k.obs})` : `Açık (${k.bagli}, tarayıcı)`]
      : ['bg-amber-400 animate-pulse', `Bağlantı koptu · ${once(k.sonKopma)}`];
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-xs text-gray-400" role="status">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${renk}`} aria-hidden />
      <span className="truncate">{metin}</span>
    </span>
  );
}

export default KatmanBaglantisi;
