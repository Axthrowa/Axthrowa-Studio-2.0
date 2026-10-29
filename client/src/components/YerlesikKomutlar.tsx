/**
 * Komutlar › Yerleşik Komutlar: botun tüm yerleşik komutları (sunucudaki tek listeden), aç/kapat,
 * yetki ve bekleme. Eskiden panelde elle yazılmış 37 satırlık ayrı bir liste vardı; çoğu komut görünmüyordu.
 */
import { useEffect, useMemo, useState } from 'react';

type Yetki = 'herkes' | 'mod' | 'yayinci';
interface Komut {
  ad: string;
  takma: string[];
  kategori: string;
  yetki: Yetki;
  modEk?: boolean;
  aciklama: string;
  kullanim?: string;
}
interface Veri {
  komutlar: Komut[];
  kapali: string[];
  ayarlar: Record<string, { yetki?: Yetki; bekleme?: number }>;
  moduller: Record<string, { kapali: boolean; komutlar: string[] }>;
}

const YETKI_ADI: Record<Yetki, string> = { herkes: 'Herkes', mod: 'Mod', yayinci: 'Yayıncı' };

export function YerlesikKomutlar({ arama }: { arama: string }) {
  const [v, setV] = useState<Veri | null>(null);
  const [kategori, setKategori] = useState('');
  const [hata, setHata] = useState('');

  useEffect(() => {
    fetch('/api/commands/builtin')
      .then((r) => r.json())
      .then(setV)
      .catch(() => setHata('Komut listesi alınamadı'));
  }, []);

  const kaydet = async (ad: string, degisim: { acik?: boolean; yetki?: Yetki | ''; bekleme?: number }) => {
    setHata('');
    try {
      const r = await fetch('/api/commands/builtin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ad, ...degisim }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Kaydedilemedi');
      setV((o) => (o ? { ...o, kapali: d.kapali, ayarlar: d.ayarlar } : o));
    } catch (e) {
      setHata(String((e as Error).message || e));
    }
  };

  const kategoriler = useMemo(() => (v ? [...new Set(v.komutlar.map((k) => k.kategori))] : []), [v]);
  if (!v) return <p className="text-xs text-gray-400 p-4">{hata || 'Yükleniyor…'}</p>;

  const modulKapali = (ad: string) => Object.entries(v.moduller).find(([, m]) => m.kapali && m.komutlar.includes(ad))?.[0];
  const q = arama.trim().toLocaleLowerCase('tr-TR');
  const liste = v.komutlar.filter(
    (k) =>
      (!kategori || k.kategori === kategori) &&
      (!q || [k.ad, ...k.takma, k.aciklama, k.kullanim || ''].some((t) => t.toLocaleLowerCase('tr-TR').includes(q)))
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {['', ...kategoriler].map((kt) => (
          <button
            key={kt || 'hepsi'}
            type="button"
            onClick={() => setKategori(kt)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${kategori === kt ? 'bg-purple-600 border-purple-500 text-white' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}
          >
            {kt || `Hepsi (${v.komutlar.length})`}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-gray-400">
        Sohbette <b className="text-gray-200">!komutlar</b> herkesin kullanabildiği açık komutları, <b className="text-gray-200">!komutlar oyunlar</b> gibi kategoriyle
        o bölümün tümünü kullanım örnekleriyle yazar. Yetkiyi yükseltmek (ör. herkes → mod) komutu izleyicilere kapatır; mod komutunu herkese açmaz.
      </p>
      {hata && <p className="text-xs text-red-300">{hata}</p>}
      <div className="glass-panel rounded-2xl overflow-hidden border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.04] text-xs font-bold text-gray-400 uppercase">
            <tr>
              <th className="py-3 px-4">Komut</th>
              <th className="py-3 px-4">Ne yapar</th>
              <th className="py-3 px-4">Yetki</th>
              <th className="py-3 px-4">Bekleme</th>
              <th className="py-3 px-4">Açık</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {liste.map((k) => {
              const acik = !v.kapali.includes(k.ad);
              const ayar = v.ayarlar[k.ad] || {};
              const modul = modulKapali(k.ad);
              return (
                <tr key={k.ad} className={acik ? '' : 'opacity-50'}>
                  <td className="py-2.5 px-4 align-top">
                    <div className="font-bold text-purple-400">!{k.ad}</div>
                    {k.takma.length > 0 && <div className="text-[10px] text-gray-500">{k.takma.map((t) => `!${t}`).join(' ')}</div>}
                    <div className="text-[10px] text-gray-500">{k.kategori}</div>
                  </td>
                  <td className="py-2.5 px-4 align-top text-gray-300">
                    {k.aciklama}
                    {k.kullanim && <div className="mt-0.5 font-mono text-[11px] text-cyan-300/90">{k.kullanim}</div>}
                    {modul && <div className="mt-0.5 text-[10px] text-amber-300">“{modul}” modülü kapalı (!modul ac {modul})</div>}
                  </td>
                  <td className="py-2.5 px-4 align-top">
                    <select
                      value={ayar.yetki || ''}
                      onChange={(e) => void kaydet(k.ad, { yetki: e.target.value as Yetki | '' })}
                      className="bg-black/50 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                      title="Varsayılan: komutun kendi kuralı"
                    >
                      <option value="">Varsayılan ({YETKI_ADI[k.yetki]}{k.modEk ? ' + mod ek' : ''})</option>
                      {k.yetki === 'herkes' && <option value="mod">Yalnız mod</option>}
                      {k.yetki !== 'yayinci' && <option value="yayinci">Yalnız yayıncı</option>}
                    </select>
                  </td>
                  <td className="py-2.5 px-4 align-top">
                    <input
                      type="number"
                      min={0}
                      max={3600}
                      defaultValue={ayar.bekleme || 0}
                      onBlur={(e) => {
                        const sn = Math.max(0, Math.min(3600, Number(e.target.value) || 0));
                        if (sn !== (ayar.bekleme || 0)) void kaydet(k.ad, { bekleme: sn });
                      }}
                      className="w-20 bg-black/50 border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono"
                      title="Genel bekleme (sn); mod ve yayıncı muaf"
                    />
                    <span className="ml-1 text-[10px] text-gray-500">sn</span>
                  </td>
                  <td className="py-2.5 px-4 align-top">
                    <input type="checkbox" checked={acik} onChange={(e) => void kaydet(k.ad, { acik: e.target.checked })} className="w-4 h-4 accent-purple-600" aria-label={`!${k.ad} açık`} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default YerlesikKomutlar;
