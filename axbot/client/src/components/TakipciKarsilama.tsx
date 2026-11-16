/**
 * Yeni takipçi karşılaması: aç/kapat, tema seçimi ve sohbette nasıl görüneceği.
 * Discord botundaki gibi birden çok tema seçilir; her takipte seçilenlerden rastgele bir mesaj gider.
 */
import { useEffect, useState } from 'react';

interface Tema { id: string; ad: string; ornekler: string[]; varsayilan?: string[]; duzenlendi?: boolean }
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
  const [duzenlenen, setDuzenlenen] = useState('');
  const [taslak, setTaslak] = useState('');
  const [kaydedildi, setKaydedildi] = useState('');

  useEffect(() => {
    Promise.all([fetch('/api/chat-alerts/karsilama').then((r) => r.json()), fetch('/api/chat-alerts').then((r) => r.json())])
      .then(([k, a]) => {
        setTemalar(k.temalar);
        setSecili(k.secili);
        const ilk = k.secili[0] || k.temalar[0]?.id || '';
        setDuzenlenen(ilk);
        setTaslak((k.temalar.find((t: Tema) => t.id === ilk)?.ornekler || []).join('\n'));
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

  const duzenlemeAc = (id: string) => {
    setDuzenlenen(id);
    setTaslak((temalar.find((t) => t.id === id)?.ornekler || []).join('\n'));
    setKaydedildi('');
  };
  const metinYaz = (metinler: string[] | null) =>
    yolla('/api/chat-alerts/karsilama/metinler', { tema: duzenlenen, metinler })
      .then((k) => {
        setTemalar(k.temalar);
        setTaslak((k.temalar.find((t: Tema) => t.id === duzenlenen)?.ornekler || []).join('\n'));
        setKaydedildi(metinler ? 'Kaydedildi' : 'Varsayılan metinlere dönüldü');
      })
      .catch((e) => setHata(String(e.message || e)));
  const duzenTema = temalar.find((t) => t.id === duzenlenen);

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
      <details className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
        <summary className="cursor-pointer text-xs font-bold text-gray-200">Metinleri gör ve düzenle</summary>
        <div className="mt-2 space-y-2">
          <label className="flex items-center gap-2 text-[11px] text-gray-300">
            Tema
            <select value={duzenlenen} onChange={(e) => duzenlemeAc(e.target.value)} className="bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white">
              {temalar.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.ad}
                  {t.duzenlendi ? ' (düzenlendi)' : ''}
                </option>
              ))}
            </select>
          </label>
          <textarea
            value={taslak}
            onChange={(e) => {
              setTaslak(e.target.value);
              setKaydedildi('');
            }}
            rows={8}
            aria-label="Karşılama metinleri, her satıra bir metin"
            placeholder="Her satıra bir karşılama yaz. Örnek: Hoş geldin $(sender), $(channel) ailesine katıldın!"
            className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-white font-mono"
          />
          <p className="text-[10px] text-gray-500">Her satır bir metin. $(sender) takip edenin adı, $(channel) kanal adı olur. En çok 100 satır, satır başına 300 harf.</p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => metinYaz(taslak.split('\n'))} className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-[11px] font-bold text-white">
              Kaydet
            </button>
            {duzenTema?.duzenlendi && (
              <button type="button" onClick={() => metinYaz(null)} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-bold text-gray-200">
                Varsayılana dön
              </button>
            )}
            {kaydedildi && <span className="text-[11px] text-emerald-400">{kaydedildi}</span>}
            {duzenTema && !secili.includes(duzenTema.id) && <span className="text-[11px] text-amber-300">Bu tema seçili değil; metinleri gitmesi için yukarıdan seç.</span>}
          </div>
        </div>
      </details>
      {hata && <p className="text-xs text-red-300">{hata}</p>}
    </div>
  );
}

export default TakipciKarsilama;
