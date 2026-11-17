import { useEffect, useState } from 'react';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Anahtar, Buton, Girdi, Kart, useToast } from '../ui/index.js';

interface KickOdulu {
  id: string;
  baslik: string;
  aciklama: string;
  bedel: number;
  etkin: boolean;
  girdiGerekli: boolean;
}

/** Otomasyonun "ödül" alanına önerilen Kick ödül adları */
export const KICK_ODUL_LISTESI = 'kick-odul-adlari';

/** B8: Kick kanal ödülleri: listele, oluştur, aç/kapat, sil. Kullanımı otomasyondaki "Ödül" tetiğini çalıştırır. */
export function KickOdulleri() {
  const toast = useToast();
  const [oduller, setOduller] = useState<KickOdulu[] | null>(null);
  const [hata, setHata] = useState('');
  const [yeni, setYeni] = useState({ baslik: '', bedel: 100, aciklama: '', girdiGerekli: false });
  const [mesgul, setMesgul] = useState(false);

  const istek = async (yontem: string, yol = '', govde?: unknown) => {
    const r = await fetch(`/api/kick/oduller${yol}`, {
      method: yontem,
      headers: govde ? { 'Content-Type': 'application/json' } : undefined,
      body: govde ? JSON.stringify(govde) : undefined
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    return d?.ok ? d : { ok: false, hata: d?.hata || 'Bota ulaşılamadı' };
  };
  const yenile = async () => {
    const d = await istek('GET');
    setHata(d.ok ? '' : d.hata);
    setOduller(d.ok ? d.oduller : []);
  };
  const yap = async (yontem: string, yol: string, govde?: unknown, basari?: string) => {
    setMesgul(true);
    const d = await istek(yontem, yol, govde);
    setMesgul(false);
    if (!d.ok) {
      toast(d.hata, 'hata');
      return false;
    }
    if (basari) toast(basari, 'basari');
    await yenile();
    return true;
  };

  useEffect(() => {
    void yenile();
  }, []);

  return (
    <Kart
      baslik="Kick kanal ödülleri"
      aciklama="Burada açılan ödül Kick'te görünür; izleyici kullanınca Otomasyon sayfasındaki “Ödül” tetikli kurallar çalışır."
      sag={
        <Buton ton="ikincil" ikon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => void yenile()}>
          Yenile
        </Buton>
      }
    >
      <datalist id={KICK_ODUL_LISTESI}>
        {(oduller || []).map((o) => (
          <option key={o.id} value={o.baslik} />
        ))}
      </datalist>
      {hata && <p className="mb-2 text-xs text-amber-300">{hata}</p>}
      {oduller && oduller.length > 0 && (
        <ul className="mb-3 space-y-1">
          {oduller.map((o) => (
            <li key={o.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1 text-xs">
              <span className="min-w-0 flex-1 truncate font-bold text-white" title={o.aciklama}>
                {o.baslik}
              </span>
              <span className="font-mono text-gray-400">{o.bedel}</span>
              {o.girdiGerekli && <span className="text-gray-500">metin ister</span>}
              <Anahtar acik={o.etkin} etiket={`${o.baslik} açık`} onChange={(v) => void yap('PATCH', `/${o.id}`, { etkin: v })} />
              <button
                type="button"
                aria-label={`${o.baslik} sil`}
                className="rounded p-1 text-gray-500 hover:text-red-400"
                onClick={() => {
                  if (confirm(`"${o.baslik}" Kick'ten silinsin mi?`)) void yap('DELETE', `/${o.id}`, undefined, 'Ödül silindi');
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {!hata && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void yap('POST', '', yeni, 'Ödül Kick’te açıldı').then((ok) => ok && setYeni({ baslik: '', bedel: 100, aciklama: '', girdiGerekli: false }));
          }}
        >
          <Girdi aria-label="Ödül adı" placeholder="Ödül adı" maxLength={50} className="min-w-40 flex-1" value={yeni.baslik} onChange={(e) => setYeni({ ...yeni, baslik: e.target.value })} />
          <Girdi aria-label="Bedel" type="number" min={1} className="w-24" value={yeni.bedel} onChange={(e) => setYeni({ ...yeni, bedel: Number(e.target.value) })} />
          <Girdi aria-label="Açıklama" placeholder="Açıklama (isteğe bağlı)" maxLength={200} className="min-w-40 flex-1" value={yeni.aciklama} onChange={(e) => setYeni({ ...yeni, aciklama: e.target.value })} />
          <label className="flex items-center gap-1 text-xs text-gray-300">
            <Anahtar acik={yeni.girdiGerekli} onChange={(v) => setYeni({ ...yeni, girdiGerekli: v })} />
            Metin istesin
          </label>
          <Buton type="submit" disabled={mesgul || !yeni.baslik.trim() || yeni.bedel < 1} ikon={<Plus className="h-3.5 w-3.5" />}>
            Ödül aç
          </Buton>
        </form>
      )}
    </Kart>
  );
}
