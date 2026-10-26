/**
 * Panel başlığındaki "ne çalışıyor?" şeridi: platform, müzik, OBS, yapay zekâ.
 * Noktaya tıklayınca ilgili sayfa açılır.
 */
import { MUZIK_ADI, useDurumOzeti } from '../lib/durumOzeti.js';

export function DurumSeridi({ git }: { git: (sekme: string) => void }) {
  const d = useDurumOzeti();
  if (!d) return null;
  const ogeler = [
    { ad: 'Platform', ok: d.platformlar.length > 0, ipucu: d.platformlar.length ? `Bağlı: ${d.platformlar.join(', ')}` : 'Bağlı platform yok', sekme: 'platforms' },
    { ad: 'Müzik', ok: Boolean(d.muzik), ipucu: d.muzik ? MUZIK_ADI[d.muzik] : 'Spotify / YouTube Music bağlı değil', sekme: 'songrequest' },
    { ad: 'OBS', ok: d.obsKaynak > 0, ipucu: d.obsKaynak ? `${d.obsKaynak} OBS kaynağı bağlı` : 'OBS kaynağı bağlı değil (OBS kapalı ya da URL eklenmemiş)', sekme: 'overlays' },
    { ad: 'Yapay zekâ', ok: d.ai.hazir, ipucu: d.ai.hazir ? `Sağlayıcı: ${d.ai.saglayici}` : 'API anahtarı girilmemiş', sekme: 'ai' }
  ];
  return (
    <div className="flex items-center gap-1.5" aria-label="Sistem durumu">
      {ogeler.map((o) => (
        <button
          key={o.ad}
          type="button"
          onClick={() => git(o.sekme)}
          title={o.ipucu}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] font-bold text-gray-300 hover:bg-white/[0.08]"
        >
          <span className={`h-2 w-2 rounded-full ${o.ok ? 'bg-emerald-400' : 'bg-red-400'}`} aria-hidden />
          {o.ad}
          <span className="sr-only">{o.ok ? 'çalışıyor' : 'sorun var'}: {o.ipucu}</span>
        </button>
      ))}
    </div>
  );
}

export default DurumSeridi;
