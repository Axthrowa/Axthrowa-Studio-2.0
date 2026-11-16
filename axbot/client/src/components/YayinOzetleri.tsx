/** Yayın Sonu Özeti: son yayınların sayıları ve (açıksa) yapay zekânın 3 maddesi */
import { useEffect, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { Anahtar, BosDurum, Buton, Kart, useToast } from '../ui/index.js';

interface Rapor {
  id: string;
  baslangic: number;
  bitis: number;
  mesaj: number;
  kisi: number;
  enCokYazanlar: Array<{ ad: string; sayi: number }>;
  takip: number;
  abone: number;
  bagislar: Record<string, number>;
  baskinlar: Array<{ ad: string; izleyici: number }>;
  sarkilar?: Array<{ zaman: number; ad: string }>;
  komutlar?: Array<{ ad: string; sayi: number }>;
  maddeler: string[];
  aiHatasi?: string;
}

const postJson = (url: string, govde?: unknown) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(govde ?? {}) });

export function YayinOzetleri() {
  const toast = useToast();
  const [ozetler, setOzetler] = useState<Rapor[]>([]);
  const [aiAcik, setAiAcik] = useState(false);
  const [mesgul, setMesgul] = useState(false);

  useEffect(() => {
    fetch('/api/yayin-ozetleri')
      .then((r) => r.json())
      .then((d) => {
        setOzetler(d.ozetler || []);
        setAiAcik(Boolean(d.aiAcik));
      })
      .catch(() => {});
  }, []);

  const aiDegistir = async (acik: boolean) => {
    const r = await postJson('/api/yayin-ozetleri/ayar', { aiAcik: acik }).catch(() => null);
    if (!r?.ok) return toast('Ayar kaydedilemedi', 'hata');
    setAiAcik(acik);
  };

  const olustur = async () => {
    setMesgul(true);
    const r = await postJson('/api/yayin-ozetleri/olustur').catch(() => null);
    const d = await r?.json().catch(() => null);
    setMesgul(false);
    if (!r?.ok) return toast(d?.error || 'Özet oluşturulamadı', 'hata');
    setOzetler((l) => [d, ...l].slice(0, 10));
  };

  const discordaGonder = async (id: string) => {
    const r = await postJson(`/api/yayin-ozetleri/${encodeURIComponent(id)}/discord`).catch(() => null);
    const d = await r?.json().catch(() => null);
    toast(r?.ok ? "Şarkı listesi Discord'a gönderildi" : d?.error || 'Gönderilemedi', r?.ok ? 'basari' : 'hata');
  };

  return (
    <Kart
      baslik="Yayın Sonu Özeti"
      aciklama="Yayın kapanınca rapor burada belirir. Sohbete hiçbir şey yazılmaz."
      sag={
        <Buton ton="ikincil" ikon={<ClipboardList className="h-3.5 w-3.5" />} disabled={mesgul} onClick={() => void olustur()}>
          {mesgul ? 'Hazırlanıyor…' : 'Şimdi özetle'}
        </Buton>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 p-3">
        <p className="min-w-0 flex-1 text-xs text-gray-300">Yapay zekâ özeti: açıksa sohbetten bir örnek, seçili yapay zekâ sağlayıcısına gönderilir.</p>
        <Anahtar acik={aiAcik} onChange={(v) => void aiDegistir(v)} etiket="Yapay zekâ özeti" />
      </div>

      {!ozetler.length ? <BosDurum baslik="Henüz rapor yok" aciklama="İlk rapor bir sonraki yayın bitince oluşur." /> : null}
      {ozetler.map((o) => (
        <article key={o.id} className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-gray-300">
          <h4 className="font-bold text-white">
            {new Date(o.baslangic).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })} · {Math.round((o.bitis - o.baslangic) / 60_000)} dk
          </h4>
          <p className="mt-1 tabular-nums">
            {o.mesaj} mesaj · {o.kisi} kişi · {o.takip} takipçi · {o.abone} abonelik
            {Object.entries(o.bagislar).map(([birim, miktar]) => ` · ${Math.round(miktar * 100) / 100} ${birim}`)}
          </p>
          {o.enCokYazanlar.length ? <p className="mt-1">En çok yazanlar: {o.enCokYazanlar.map((k) => `${k.ad} (${k.sayi})`).join(', ')}</p> : null}
          {o.komutlar?.length ? <p className="mt-1">Komutlar: {o.komutlar.map((k) => `!${k.ad} (${k.sayi})`).join(', ')}</p> : null}
          {o.baskinlar.length ? <p className="mt-1">Baskınlar: {o.baskinlar.map((b) => `${b.ad} (${b.izleyici})`).join(', ')}</p> : null}
          {o.maddeler.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-gray-200">
              {o.maddeler.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          ) : null}
          {o.sarkilar?.length ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-gray-200">Çalan şarkılar ({o.sarkilar.length})</summary>
              <ol className="mt-1 space-y-0.5 tabular-nums">
                {o.sarkilar.map((s, i) => (
                  <li key={i}>
                    <span className="text-gray-500">{new Date(s.zaman).toLocaleTimeString('tr-TR', { timeStyle: 'short' })}</span> {s.ad}
                  </li>
                ))}
              </ol>
              <Buton ton="ikincil" className="mt-2" onClick={() => void discordaGonder(o.id)}>
                Discord'a gönder
              </Buton>
            </details>
          ) : null}
          {o.aiHatasi ? <p className="mt-2 text-amber-300">{o.aiHatasi}</p> : null}
          <a className="mt-2 inline-block text-xs text-gray-300 underline hover:text-white" href={`/api/yayin-ozetleri/${encodeURIComponent(o.id)}/csv`} download>
            Tabloları CSV olarak indir
          </a>
        </article>
      ))}
    </Kart>
  );
}
