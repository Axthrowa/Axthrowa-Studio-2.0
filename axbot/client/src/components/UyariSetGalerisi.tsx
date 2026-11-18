/**
 * WID-3: hazır uyarı setleri galerisi. Setler uyarı yedeği biçiminde paketlerdir, görsel ve sesleri
 * pakete gömülüdür (internetsiz çalışır). "Uygula" takip, abone, bağış, raid… uyarılarını setle değiştirir;
 * "Geri al" uygulamadan önceki uyarıları geri yükler.
 */
import { useEffect, useState } from 'react';
import { Play, RotateCcw } from 'lucide-react';
import { Buton, Kart, useToast } from '../ui/index.js';

interface SetOzeti {
  id: string;
  ad: string;
  aciklama: string;
  vurgu: string;
  onizleme: string;
}

async function postJson(url: string, govde: unknown): Promise<any> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(govde) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.ok === false) throw new Error(j?.hata || j?.error || `HTTP ${r.status}`);
  return j;
}

export function UyariSetGalerisi({ onDegisti }: { onDegisti: () => void }) {
  const toast = useToast();
  const [setler, setSetler] = useState<SetOzeti[]>([]);
  const [mesgul, setMesgul] = useState('');
  // Son uygulanan set ve ondan önceki uyarılar (geri almak için)
  const [son, setSon] = useState<{ id: string; onceki: unknown } | null>(null);

  useEffect(() => {
    fetch('/api/alerts/sets').then((r) => r.json()).then((d) => setSetler(d?.setler || [])).catch(() => {});
  }, []);

  const uygula = async (s: SetOzeti) => {
    setMesgul(s.id);
    try {
      const r = await postJson(`/api/alerts/sets/${s.id}/apply`, {});
      // Art arda set denenirse geri alma ilk setten önceki duruma döner
      setSon((o) => ({ id: s.id, onceki: o?.onceki ?? r.onceki }));
      toast(`"${s.ad}" uygulandı: ${r.preset.eklenen + r.preset.guncellenen} uyarı.`, 'basari');
      onDegisti();
    } catch (e) {
      toast(`Set uygulanamadı: ${e instanceof Error ? e.message : e}`, 'hata');
    } finally {
      setMesgul('');
    }
  };

  const geriAl = async () => {
    if (!son) return;
    setMesgul('geri');
    try {
      await postJson('/api/alerts/backup/import', { veri: son.onceki, uzerineYaz: true });
      setSon(null);
      toast('Önceki uyarılar geri yüklendi.', 'basari');
      onDegisti();
    } catch (e) {
      toast(`Geri alınamadı: ${e instanceof Error ? e.message : e}`, 'hata');
    } finally {
      setMesgul('');
    }
  };

  const dene = (olay: string) =>
    void postJson('/api/alerts/test', { eventType: olay, deger: olay === 'tip' ? 100 : undefined }).catch(() => {});

  return (
    <Kart baslik="Hazır uyarı setleri" aciklama="Görsel ve sesleri bilgisayarda: internet kesikken de çalışır. Takip, abone, hediye abone, bağış, Kicks, raid, host ve kilometre taşı uyarılarını değiştirir.">
      {son && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-amber-500/10 border border-amber-400/30 px-3 py-2 text-xs text-amber-100">
          <span>Uygulanan set: <b>{setler.find((s) => s.id === son.id)?.ad}</b></span>
          <Buton ton="ikincil" disabled={!!mesgul} onClick={() => void geriAl()} ikon={<RotateCcw className="w-3.5 h-3.5" />}>
            Geri al
          </Buton>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {setler.map((s) => (
          <div key={s.id} className="rounded-xl border p-3 space-y-2 bg-black/30" style={{ borderColor: son?.id === s.id ? s.vurgu : 'rgba(255,255,255,.1)' }}>
            <div className="flex items-center gap-3">
              <img src={s.onizleme} alt="" width={56} height={56} />
              <div className="min-w-0">
                <div className="text-sm font-bold text-white">{s.ad}</div>
                <div className="text-[11px] text-gray-400">{s.aciklama}</div>
              </div>
            </div>
            <div className="flex gap-1.5">
              <Buton className="flex-1" disabled={!!mesgul} onClick={() => void uygula(s)}>
                {mesgul === s.id ? 'Uygulanıyor…' : son?.id === s.id ? 'Uygulandı' : 'Uygula'}
              </Buton>
              {son?.id === s.id && (
                <Buton ton="ikincil" onClick={() => dene('follow')} ikon={<Play className="w-3.5 h-3.5" />} title="Takipçi uyarısını dene">
                  Dene
                </Buton>
              )}
            </div>
          </div>
        ))}
      </div>
    </Kart>
  );
}
