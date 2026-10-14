/**
 * StreamAxT — !clip ile kaydedilen klipler (izle / indir / sil)
 * Developed by AxthrowA
 */
import { useCallback, useEffect, useState } from 'react';
import { Download, Film, RefreshCw, Trash2 } from 'lucide-react';

interface Klip {
  dosya: string;
  boyut: number;
  zaman: number;
  sure: number;
  kim: string;
}

export function KlipListesi() {
  const [klipler, setKlipler] = useState<Klip[]>([]);
  const [ffmpeg, setFfmpeg] = useState<boolean | null>(null);
  const [acik, setAcik] = useState<string | null>(null);

  const yukle = useCallback(() => {
    fetch('/api/klipler')
      .then((r) => r.json())
      .then((d) => {
        setKlipler(Array.isArray(d.klipler) ? d.klipler : []);
        setFfmpeg(Boolean(d.ffmpeg));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    yukle();
    const t = setInterval(yukle, 10_000);
    return () => clearInterval(t);
  }, [yukle]);

  const sil = async (dosya: string) => {
    await fetch(`/api/klipler/${encodeURIComponent(dosya)}`, { method: 'DELETE' }).catch(() => {});
    if (acik === dosya) setAcik(null);
    yukle();
  };

  return (
    <div className="space-y-3 pt-2 border-t border-white/10">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Film className="w-4 h-4 text-purple-400" /> Kaydedilen klipler ({klipler.length})
        </h3>
        <button onClick={yukle} className="text-xs text-gray-300 hover:text-white flex items-center gap-1">
          <RefreshCw className="w-3.5 h-3.5" /> Yenile
        </button>
      </div>
      {ffmpeg === false && (
        <p className="text-[11px] rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-amber-200">
          ffmpeg bulunamadı — <code>!clip</code> şimdilik yalnız anı işaretler. ffmpeg kurulunca gerçek video klip kaydeder.
        </p>
      )}
      {klipler.length === 0 ? (
        <p className="text-xs text-gray-500">Henüz klip yok. Yayın açıkken sohbete <code>!clip</code> ya da <code>!clip 45</code> yazılınca burada görünür.</p>
      ) : (
        <ul className="space-y-2">
          {klipler.map((k) => (
            <li key={k.dosya} className="rounded-xl border border-white/10 bg-black/30 p-2.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <button onClick={() => setAcik(acik === k.dosya ? null : k.dosya)} className="text-left min-w-0">
                  <span className="font-bold text-white">{new Date(k.zaman).toLocaleString('tr-TR')}</span>
                  <span className="text-gray-400"> · {k.sure} sn · {k.kim} · {(k.boyut / 1048576).toFixed(1)} MB</span>
                </button>
                <span className="flex items-center gap-2 shrink-0">
                  <a href={`/api/klipler/${encodeURIComponent(k.dosya)}?indir=1`} className="text-gray-300 hover:text-white" title="İndir">
                    <Download className="w-4 h-4" />
                  </a>
                  <button onClick={() => void sil(k.dosya)} className="text-red-300 hover:text-red-200" title="Sil">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </span>
              </div>
              {acik === k.dosya && (
                <video src={`/api/klipler/${encodeURIComponent(k.dosya)}`} controls autoPlay className="mt-2 w-full rounded-lg bg-black" />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default KlipListesi;
