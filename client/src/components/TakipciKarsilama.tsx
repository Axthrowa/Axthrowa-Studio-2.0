/**
 * Yeni takipçi karşılaması: aç/kapat, tema seçimi ve sohbette nasıl görüneceği.
 * Discord botundaki gibi birden çok tema seçilir; her takipte seçilenlerden rastgele bir mesaj gider.
 */
import { useEffect, useState } from 'react';

interface Tema { id: string; ad: string; ornekler: string[] }
interface Kural { aktif: boolean; adsizKarsila?: boolean }

const yolla = (yol: string, govde: unknown) =>
  fetch(yol, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(govde) }).then((r) => {
    if (!r.ok) throw new Error('Kaydedilemedi');
    return r.json();
  });

export function TakipciKarsilama({ degisti }: { degisti?: () => void }) {
  const [temalar, setTemalar] = useState<Tema[] | null>(null);
  const [secili, setSecili] = useState<string[]>([]);
  const [kural, setKural] = useState<Kural | null>(null);
  const [hata, setHata] = useState('');
  const [ornekNo, setOrnekNo] = useState(0);

  useEffect(() => {
    Promise.all([fetch('/api/chat-alerts/karsilama').then((r) => r.json()), fetch('/api/chat-alerts').then((r) => r.json())])
      .then(([k, a]) => {
        setTemalar(k.temalar);
        setSecili(k.secili);
        setKural(a.follow);
      })
      .catch(() => setHata('Karşılama ayarları alınamadı.'));
  }, []);

  if (!temalar || !kural) return <p className="text-xs text-gray-400 p-4">{hata || 'Yükleniyor…'}</p>;

  const kuralYaz = (d: Partial<Kural>) => {
    const yeni = { ...kural, ...d };
    setKural(yeni);
    yolla('/api/chat-alerts', { follow: d })
      .then(() => degisti?.())
      .catch((e) => setHata(String(e.message || e)));
  };
  const temaYaz = (liste: string[]) => {
    setSecili(liste);
    setOrnekNo(0);
    yolla('/api/chat-alerts/karsilama', { temalar: liste }).catch((e) => setHata(String(e.message || e)));
  };

  const ornekler = temalar.filter((t) => secili.includes(t.id)).flatMap((t) => t.ornekler);
  const ornek = ornekler.length ? ornekler[ornekNo % ornekler.length].replace(/\$\(sender\)/g, 'izleyici').replace(/\$\(channel\)/g, 'kanal') : '';

  return (
    <div className="glass-panel rounded-2xl border border-white/10 p-4 space-y-3">
      <div>
        <h3 className="text-sm font-bold text-white">Yeni takipçi karşılaması</h3>
        <p className="text-[11px] text-gray-400">Biri kanalı takip edince bot sohbete seçili temalardan rastgele bir karşılama yazar; aynı mesaj art arda gelmez.</p>
      </div>
      <label className="flex items-center gap-2 text-xs text-gray-200">
        <input type="checkbox" className="w-4 h-4 accent-purple-600" checked={kural.aktif} onChange={(e) => kuralYaz({ aktif: e.target.checked })} />
        Yeni takipçiyi sohbette karşıla
      </label>
      <label className="flex items-center gap-2 text-xs text-gray-200">
        <input type="checkbox" className="w-4 h-4 accent-purple-600" checked={kural.adsizKarsila !== false} onChange={(e) => kuralYaz({ adsizKarsila: e.target.checked })} />
        Kick takipçinin adını vermezse “Yeni takipçi” diye karşıla
      </label>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Karşılama temaları">
        {temalar.map((t) => {
          const acik = secili.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={acik}
              onClick={() => temaYaz(acik ? secili.filter((x) => x !== t.id) : [...secili, t.id])}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${acik ? 'bg-purple-600 border-purple-500 text-white' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}
            >
              {t.ad} <span className="opacity-60">{t.ornekler.length}</span>
            </button>
          );
        })}
        <button type="button" onClick={() => temaYaz(temalar.map((t) => t.id))} className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-cyan-300 hover:bg-white/10">
          Hepsi
        </button>
        <button type="button" onClick={() => temaYaz([])} className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-gray-400 hover:bg-white/10">
          Hiçbiri
        </button>
      </div>
      {ornek ? (
        <div className="flex items-start gap-2 rounded-lg bg-black/30 px-3 py-2 text-xs">
          <span className="min-w-0 flex-1 break-words text-gray-200">
            <b className="text-emerald-400">AxBoT:</b> {ornek}
          </span>
          <button type="button" onClick={() => setOrnekNo((n) => n + 1)} className="shrink-0 text-[11px] font-bold text-cyan-300 hover:underline">
            Başka örnek
          </button>
        </div>
      ) : (
        <p className="text-[11px] text-gray-400">Tema seçili değil: Sohbet uyarılarındaki kendi takip şablonun gider.</p>
      )}
      {hata && <p className="text-xs text-red-300">{hata}</p>}
    </div>
  );
}

export default TakipciKarsilama;
