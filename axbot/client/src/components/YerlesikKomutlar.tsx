/**
 * Komutlar › Yerleşik Komutlar: botun tüm yerleşik komutları (sunucudaki tek listeden), aç/kapat,
 * yetki ve bekleme. Eskiden panelde elle yazılmış 37 satırlık ayrı bir liste vardı; çoğu komut görünmüyordu.
 */
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Anahtar, Panel, Secim } from '../ui/index.js';

type Yetki = 'herkes' | 'mod' | 'yayinci';
interface Komut {
  ad: string;
  takma: string[];
  kategori: string;
  yetki: Yetki;
  modEk?: boolean;
  aciklama: string;
  kullanim?: string;
  bekleme?: number;
}
interface Veri {
  komutlar: Komut[];
  kapali: string[];
  ornekler: Record<string, string>;
  ayarlar: Record<string, { yetki?: Yetki; bekleme?: number; yanit?: string; sessiz?: boolean }>;
  moduller: Record<string, { kapali: boolean; komutlar: string[] }>;
}

const YETKI_ADI: Record<Yetki, string> = { herkes: 'Herkes', mod: 'Mod', yayinci: 'Yayıncı' };

/** Komutun sohbette görünüşü: izleyicinin yazdığı ve botun yanıtı */
export function SohbetOnizleme({ yazilan, yanit }: { yazilan: string; yanit: string }) {
  return (
    <div className="rounded-lg bg-black/30 px-3 py-1.5 text-xs leading-relaxed">
      <div className="text-gray-300 break-words">
        <b className="text-sky-300">izleyici:</b> {yazilan}
      </div>
      <div className="text-gray-200 break-words">
        <b className="text-emerald-400">AxBoT:</b> {yanit || <i className="text-gray-500">sohbete yazmaz, yalnız işlem yapar</i>}
      </div>
    </div>
  );
}

export function YerlesikKomutlar({ arama }: { arama: string }) {
  const [v, setV] = useState<Veri | null>(null);
  const [kategori, setKategori] = useState('');
  const [hata, setHata] = useState('');
  // Yanıtı düzenlenen komut ve taslağı
  const [duzen, setDuzen] = useState<{ ad: string; metin: string } | null>(null);

  useEffect(() => {
    fetch('/api/commands/builtin')
      .then((r) => r.json())
      .then(setV)
      .catch(() => setHata('Komut listesi alınamadı'));
  }, []);

  const kaydet = async (ad: string, degisim: { acik?: boolean; yetki?: Yetki | ''; bekleme?: number; yanit?: string; sessiz?: boolean }) => {
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
      <Panel className="rounded-2xl overflow-hidden border border-white/10">
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
              const ornek = v.ornekler[k.ad] ?? '';
              const sablon = duzen?.ad === k.ad ? duzen.metin : ayar.yanit;
              const yanit = sablon ? sablon.replace(/\{sonuc\}/g, ornek).replace(/\{kullanici\}/g, 'izleyici') : ornek;
              return (
                <Fragment key={k.ad}>
                <tr className={acik ? '' : 'opacity-50'}>
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
                    <Secim
                      value={ayar.yetki || ''}
                      onChange={(e) => void kaydet(k.ad, { yetki: e.target.value as Yetki | '' })}

                      title="Varsayılan: komutun kendi kuralı"
                    >
                      <option value="">Varsayılan ({YETKI_ADI[k.yetki]}{k.modEk ? ' + mod ek' : ''})</option>
                      {k.yetki === 'herkes' && <option value="mod">Yalnız mod</option>}
                      {k.yetki !== 'yayinci' && <option value="yayinci">Yalnız yayıncı</option>}
                    </Secim>
                  </td>
                  <td className="py-2.5 px-4 align-top">
                    <input
                      type="number"
                      min={0}
                      max={3600}
                      defaultValue={ayar.bekleme ?? k.bekleme ?? 0}
                      onBlur={(e) => {
                        const sn = Math.max(0, Math.min(3600, Number(e.target.value) || 0));
                        if (sn !== (ayar.bekleme ?? k.bekleme ?? 0)) void kaydet(k.ad, { bekleme: sn });
                      }}
                      className="w-20 bg-black/50 border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono"
                      title="Genel bekleme (sn); mod ve yayıncı muaf"
                    />
                    <span className="ml-1 text-[10px] text-gray-500">sn</span>
                  </td>
                  <td className="py-2.5 px-4 align-top">
                    <Anahtar acik={acik} onChange={(v) => void kaydet(k.ad, { acik: v })} ad={`!${k.ad} açık`} />
                  </td>
                </tr>
                <tr className={acik ? '' : 'opacity-50'}>
                  <td colSpan={5} className="px-4 pb-3 pt-0">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <SohbetOnizleme yazilan={(k.kullanim || `!${k.ad}`).split(' · ')[0]} yanit={yanit} />
                      </div>
                      <label
                        className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-1 py-1 text-[11px] text-gray-300"
                        title="Komut kapalıyken, yetki yokken ya da beklemedeyken sohbete kısa yanıt yazılmaz"
                      >
                        <Anahtar acik={!!ayar.sessiz} onChange={(v) => void kaydet(k.ad, { sessiz: v })} />
                        Reddedince sessiz kal
                      </label>
                      {ornek && (
                        <button
                          type="button"
                          onClick={() => setDuzen(duzen?.ad === k.ad ? null : { ad: k.ad, metin: ayar.yanit || '{sonuc}' })}
                          className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-bold text-gray-200 hover:bg-white/10"
                        >
                          {ayar.yanit ? 'Yanıtı düzenle ●' : 'Yanıtı düzenle'}
                        </button>
                      )}
                    </div>
                    {duzen?.ad === k.ad && (
                      <div className="mt-2 space-y-1.5">
                        <textarea
                          rows={2}
                          maxLength={400}
                          value={duzen.metin}
                          aria-label={`!${k.ad} yanıt şablonu`}
                          onChange={(e) => setDuzen({ ad: k.ad, metin: e.target.value })}
                          className="w-full bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white"
                        />
                        <p className="text-[10px] text-gray-400">
                          <b>{'{sonuc}'}</b> botun yanıtı, <b>{'{kullanici}'}</b> komutu yazan kişi. {'{sonuc}'} olmazsa puan, kazanç ve hata mesajları da görünmez; her durumda bu metin yazılır.
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void kaydet(k.ad, { yanit: duzen.metin.trim() === '{sonuc}' ? '' : duzen.metin }).then(() => setDuzen(null))}
                            className="rounded-lg bg-purple-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-purple-500"
                          >
                            Kaydet
                          </button>
                          <button
                            type="button"
                            onClick={() => void kaydet(k.ad, { yanit: '' }).then(() => setDuzen(null))}
                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold text-gray-200 hover:bg-white/10"
                          >
                            Varsayılana dön
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

export default YerlesikKomutlar;
