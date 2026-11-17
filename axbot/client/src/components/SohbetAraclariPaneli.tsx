/**
 * Widget penceresi ekleri: sohbet istatistikleri (kelime bulutu) ve skor tablosu düzenleyici
 */
import { useEffect, useState } from 'react';

export function SohbetIstatistikPaneli() {
  const [o, setO] = useState<any>(null);
  // Eski sunucu ya da hata yanıtı paneli bozmasın: yalnız beklenen biçim kabul edilir
  const kabul = (d: any) => Array.isArray(d?.saatler) && setO(d);
  const oku = () => fetch('/api/sohbet-istatistik').then((r) => r.json()).then(kabul).catch(() => {});
  useEffect(() => {
    void oku();
    const t = setInterval(oku, 5000);
    return () => clearInterval(t);
  }, []);
  if (!o) return null;
  const enCok = Math.max(1, ...o.saatler);
  return (
    <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 space-y-2 text-xs text-gray-300">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-cyan-200">📊 Sohbet istatistikleri (bu oturum)</h4>
        <button
          type="button"
          onClick={() => void fetch('/api/sohbet-istatistik/sifirla', { method: 'POST' }).then((r) => r.json()).then(kabul)}
          className="px-2 py-1 rounded-lg bg-white/10 text-xs font-bold"
        >
          Sıfırla
        </button>
      </div>
      <div className="flex gap-4">
        <span><b className="text-white">{o.mesajSayisi}</b> mesaj</span>
        <span><b className="text-white">{o.kisiSayisi}</b> kişi</span>
        {o.enYogunSaat !== null && <span>En yoğun saat: <b className="text-white">{String(o.enYogunSaat).padStart(2, '0')}:00</b></span>}
      </div>
      <div className="flex items-end gap-0.5 h-10" title="Saatlere göre mesaj sayısı">
        {o.saatler.map((n: number, i: number) => (
          <div key={i} className="flex-1 rounded-t bg-cyan-400/70" style={{ height: `${(n / enCok) * 100}%`, minHeight: n ? 2 : 0 }} title={`${i}:00 — ${n}`} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs axt-etiket text-gray-500 font-bold">En çok yazanlar</div>
          {o.enCokYazanlar.map((k: any) => <div key={k.ad}>{k.ad} <span className="text-gray-500">({k.sayi})</span></div>)}
        </div>
        <div>
          <div className="text-xs axt-etiket text-gray-500 font-bold">En çok geçenler</div>
          {o.bulut.slice(0, 10).map((b: any) => <div key={b.sozcuk}>{b.sozcuk} <span className="text-gray-500">({b.sayi})</span></div>)}
        </div>
      </div>
      <p className="text-xs text-gray-500">Sohbetten: !chatstats · !emotecount KEKW · mod: !chatstats sifirla</p>
    </div>
  );
}

interface Tablo {
  baslik: string;
  takimlar: Array<{ ad: string; renk: string; skor: number }>;
}

export function SkorTablosuPaneli() {
  const [t, setT] = useState<Tablo | null>(null);
  useEffect(() => {
    fetch('/api/skor-tablosu').then((r) => r.json()).then((d) => Array.isArray(d?.takimlar) && setT(d)).catch(() => {});
  }, []);
  const kaydet = (yeni: Tablo) => {
    setT(yeni);
    void fetch('/api/skor-tablosu', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(yeni) })
      .then((r) => r.json())
      .then((d) => Array.isArray(d?.takimlar) && setT(d))
      .catch(() => {});
  };
  if (!t) return null;
  const takim = (i: number, yama: Partial<Tablo['takimlar'][number]>) => kaydet({ ...t, takimlar: t.takimlar.map((x, j) => (j === i ? { ...x, ...yama } : x)) });
  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-2 text-xs text-gray-300">
      <h4 className="font-bold text-amber-200">🏆 Skor tablosu</h4>
      <input value={t.baslik} onChange={(e) => setT({ ...t, baslik: e.target.value })} onBlur={() => kaydet(t)} className="w-full bg-black/50 border border-white/10 rounded-lg p-1.5 text-white" placeholder="Başlık" />
      {t.takimlar.map((x, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input type="color" value={x.renk} onChange={(e) => takim(i, { renk: e.target.value })} className="w-8 h-8 rounded bg-transparent" />
          <input value={x.ad} onChange={(e) => setT({ ...t, takimlar: t.takimlar.map((y, j) => (j === i ? { ...y, ad: e.target.value } : y)) })} onBlur={() => kaydet(t)} className="flex-1 bg-black/50 border border-white/10 rounded-lg p-1.5 text-white" />
          <button type="button" onClick={() => takim(i, { skor: x.skor - 1 })} className="w-7 h-7 rounded bg-white/10 font-black">−</button>
          <span className="w-10 text-center text-white font-black text-sm">{x.skor}</span>
          <button type="button" onClick={() => takim(i, { skor: x.skor + 1 })} className="w-7 h-7 rounded bg-white/10 font-black">+</button>
          {t.takimlar.length > 2 && (
            <button type="button" onClick={() => kaydet({ ...t, takimlar: t.takimlar.filter((_, j) => j !== i) })} className="text-red-300 px-1" title="Takımı sil">✕</button>
          )}
        </div>
      ))}
      <div className="flex gap-2">
        {t.takimlar.length < 6 && (
          <button type="button" onClick={() => kaydet({ ...t, takimlar: [...t.takimlar, { ad: `Takım ${t.takimlar.length + 1}`, renk: '#a78bfa', skor: 0 }] })} className="px-2 py-1 rounded-lg bg-white/10 font-bold">
            + Takım
          </button>
        )}
        <button type="button" onClick={() => kaydet({ ...t, takimlar: t.takimlar.map((x) => ({ ...x, skor: 0 })) })} className="px-2 py-1 rounded-lg bg-white/10 font-bold">
          Skorları sıfırla
        </button>
      </div>
    </div>
  );
}

/** Sabitlenmiş mesaj: sohbetten seçmeden kendi metnini yaz ve OBS'te sabitle */
export function SabitMesajPaneli() {
  const [metin, setMetin] = useState('');
  const [ad, setAd] = useState('');
  const [durum, setDurum] = useState('');
  const sabitle = async () => {
    if (!metin.trim()) return;
    await fetch('/api/pinned', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: 'kick', username: ad.trim() || 'yayinci', displayName: ad.trim() || 'Yayıncı', message: metin.trim().slice(0, 500) })
    }).catch(() => {});
    setDurum('Sabitlendi');
    setTimeout(() => setDurum(''), 2000);
  };
  return (
    <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 space-y-2 text-xs text-gray-300">
      <h4 className="font-bold text-cyan-200">📌 Mesaj sabitle</h4>
      <input value={ad} onChange={(e) => setAd(e.target.value)} placeholder="Yazan (boşsa Yayıncı)" className="w-full bg-black/50 border border-white/10 rounded-lg p-1.5 text-white" />
      <textarea value={metin} onChange={(e) => setMetin(e.target.value)} placeholder="Sabitlenecek metin (sohbetten de 📌 ile seçilebilir)" className="w-full bg-black/50 border border-white/10 rounded-lg p-1.5 text-white min-h-[56px]" />
      <div className="flex gap-2 items-center">
        <button type="button" onClick={() => void sabitle()} className="px-3 py-1.5 rounded-lg bg-cyan-600 text-white font-bold">Sabitle</button>
        <button type="button" onClick={() => void fetch('/api/pinned', { method: 'DELETE' })} className="px-3 py-1.5 rounded-lg bg-white/10 font-bold">Kaldır</button>
        {durum && <span className="text-emerald-400">{durum}</span>}
      </div>
    </div>
  );
}
