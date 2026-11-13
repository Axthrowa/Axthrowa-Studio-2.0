/**
 * R6: OBS "Özel tarayıcı paneli" (dock) için şarkı isteği kuyruğu. Salt okunur: düğme yok,
 * sohbet ya da oynatıcıya hiçbir şey göndermez. Adres: /dock/sarki-sirasi
 */
import { useEffect, useState } from 'react';

interface Oge {
  id: string;
  title: string;
  requestedBy: string;
}

export function SarkiSirasiDock() {
  const [veri, setVeri] = useState<{ current: Oge | null; queue: Oge[] } | null>(null);
  const [hata, setHata] = useState(false);
  useEffect(() => {
    let iptal = false;
    const yokla = () =>
      fetch('/api/songrequest/queue', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((d) => !iptal && (setVeri({ current: d.current || null, queue: Array.isArray(d.queue) ? d.queue : [] }), setHata(false)))
        .catch(() => !iptal && setHata(true));
    void yokla();
    const t = setInterval(yokla, 3000);
    return () => {
      iptal = true;
      clearInterval(t);
    };
  }, []);
  const bekleyen = (veri?.queue || []).filter((o) => o.id !== veri?.current?.id);
  return (
    <main className="min-h-screen bg-[#0f1115] p-3 text-sm text-gray-200">
      <h1 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">Şarkı istekleri</h1>
      {hata ? <p className="text-amber-300">AxBoT'a ulaşılamadı; yeniden deneniyor…</p> : null}
      {veri?.current ? (
        <p className="mb-2 rounded-lg border border-white/10 bg-white/5 p-2">
          <span className="block text-[11px] text-gray-400">Çalıyor · {veri.current.requestedBy}</span>
          <span className="font-semibold text-white">{veri.current.title}</span>
        </p>
      ) : null}
      {veri && !bekleyen.length ? <p className="text-gray-400">Sırada istek yok.</p> : null}
      <ol className="space-y-1">
        {bekleyen.map((o, i) => (
          <li key={o.id} className="flex gap-2">
            <span className="w-5 shrink-0 text-right tabular-nums text-gray-500">{i + 1}.</span>
            <span className="min-w-0">
              <span className="block truncate text-white">{o.title}</span>
              <span className="text-[11px] text-gray-400">{o.requestedBy}</span>
            </span>
          </li>
        ))}
      </ol>
    </main>
  );
}

export default SarkiSirasiDock;
