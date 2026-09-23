/**
 * StreamAxT — Etkileşim
 * Developed by AxthrowA
 *
 * BotRix'te `/panel/interaction` altında üç araç var: Tahminler, İzleyici
 * Kuyruğu (BETA) ve Puan Düşüşleri (BOTRIX_UI_INVENTORY §13). Sunucu tarafı
 * bu turda yazıldı, API uçları hazırdı ama panelde hiç görünmüyordu —
 * yani yayıncı için yok hükmündeydi. Bu sayfa o üç aracın tam yüzeyi.
 *
 * Uçlar:
 *   /api/predictions  (+ /lock /resolve /cancel)
 *   /api/queue        (+ /settings /open /close /next /clear, DELETE /:kullanici)
 *   /api/point-drops  (+ /settings /start /stop)
 */
import { useEffect, useRef, useState } from 'react';
import { BarChart3, Gift, ListOrdered, Lock, Play, Plus, RotateCcw, Save, Square, Trash2, X } from 'lucide-react';
import {
  Alan,
  Anahtar,
  BosDurum,
  Buton,
  Girdi,
  HataDurumu,
  Iskelet,
  Kart,
  Secim,
  useOnay,
  useToast
} from '../ui/index.js';

type Sekme = 'tahmin' | 'kuyruk' | 'dusus';

const SEKMELER: Array<{ id: Sekme; etiket: string; ikon: typeof BarChart3 }> = [
  { id: 'tahmin', etiket: 'Tahminler', ikon: BarChart3 },
  { id: 'kuyruk', etiket: 'İzleyici Kuyruğu', ikon: ListOrdered },
  { id: 'dusus', etiket: 'Puan Düşüşleri', ikon: Gift }
];

async function al<T>(yol: string): Promise<T> {
  const r = await fetch(yol);
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

/** POST/DELETE: gövde hata taşıyorsa mesajı yukarı fırlatır. */
async function yolla<T>(yol: string, govde?: unknown, yontem: 'POST' | 'DELETE' = 'POST'): Promise<T> {
  const r = await fetch(yol, {
    method: yontem,
    headers: { 'Content-Type': 'application/json' },
    body: govde === undefined ? undefined : JSON.stringify(govde)
  });
  const veri = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(String((veri as any)?.hata || (veri as any)?.error || r.status));
  return veri as T;
}

/** Saniyeyi "1:05" biçimine çevirir. */
function sureMetni(sn: number): string {
  const g = Math.max(0, Math.floor(sn));
  return `${Math.floor(g / 60)}:${String(g % 60).padStart(2, '0')}`;
}

// ------------------------------------------------------------- Tahminler ----

function TahminPaneli() {
  const toast = useToast();
  const { sor, eleman } = useOnay();
  const [d, setD] = useState<any>(null);
  const [hata, setHata] = useState('');
  const [baslik, setBaslik] = useState('');
  const [secenekler, setSecenekler] = useState<string[]>(['', '']);
  const [kilitDk, setKilitDk] = useState(0);

  const yukle = () =>
    al<any>('/api/predictions')
      .then((x) => {
        setD(x);
        setHata('');
      })
      .catch(() => setHata('Tahmin durumu okunamadı.'));

  // Açık tahminde havuz canlı büyür; 3 sn'de bir tazelenir.
  useEffect(() => {
    yukle();
    const t = setInterval(yukle, 3000);
    return () => clearInterval(t);
  }, []);

  if (hata) return <HataDurumu mesaj={hata} yenidenDene={yukle} />;
  if (!d) return <Iskelet satir={5} />;

  const t = d.tahmin;
  const acik = t && (t.durum === 'acik' || t.durum === 'kilitli');

  const olustur = async () => {
    const temiz = secenekler.map((s) => s.trim()).filter(Boolean);
    if (!baslik.trim()) return toast('Başlık gerekli.', 'hata');
    if (temiz.length < 2) return toast('En az iki seçenek gerekli.', 'hata');
    try {
      await yolla('/api/predictions', { baslik: baslik.trim(), secenekler: temiz, kilitDakika: kilitDk });
      setBaslik('');
      setSecenekler(['', '']);
      toast('Tahmin açıldı — sohbette !bet ile katılabilirler.', 'basari');
      yukle();
    } catch (e: any) {
      toast(String(e.message), 'hata');
    }
  };

  const sonuclandir = (secenek: string) =>
    sor(`"${secenek}" kazandı olarak işaretlensin mi?`, 'Havuz kazananlara dağıtılır, bu geri alınamaz.', async () => {
      try {
        const r = await yolla<any>('/api/predictions/resolve', { secenek });
        toast(`${r.kazananlar} kişiye ${r.dagitilan} puan dağıtıldı.`, 'basari');
        yukle();
      } catch (e: any) {
        toast(String(e.message), 'hata');
      }
    });

  const iptal = () =>
    sor('Tahmin iptal edilsin mi?', 'Yatırılan tüm puanlar iade edilir.', async () => {
      const r = await yolla<any>('/api/predictions/cancel');
      toast(`İptal edildi · ${r.iade} puan iade edildi.`, 'basari');
      yukle();
    });

  return (
    <div className="space-y-3">
      {eleman}

      {acik ? (
        <Kart
          baslik={t.baslik}
          aciklama={
            t.durum === 'kilitli'
              ? 'Kilitli — yeni bahis alınmıyor, sonucu işaretleyin.'
              : 'Açık — izleyiciler !bet <seçenek> <puan> yazıyor.'
          }
          sag={
            <span
              className={`px-2 py-1 rounded-lg text-[10px] font-black ${
                t.durum === 'kilitli' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
              }`}
            >
              {t.durum === 'kilitli' ? 'KİLİTLİ' : 'AÇIK'}
            </span>
          }
        >
          <div className="space-y-2">
            {t.secenekler.map((s: string, i: number) => {
              const puan = d.secenekToplam?.[i] || 0;
              const yuzde = d.havuz > 0 ? Math.round((puan / d.havuz) * 100) : 0;
              return (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-white">
                      {i + 1}. {s}
                    </span>
                    <span className="text-gray-400">
                      {puan} puan · %{yuzde}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-purple-500 transition-all" style={{ width: `${yuzde}%` }} />
                  </div>
                  <Buton ton="ikincil" onClick={() => sonuclandir(s)} className="w-full justify-center">
                    "{s}" kazandı
                  </Buton>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
            <span className="text-[11px] text-gray-400 mr-auto">
              Havuz: <b className="text-white">{d.havuz}</b> puan · {d.bahisSayisi} bahis
            </span>
            {t.durum === 'acik' && (
              <Buton
                ton="ikincil"
                ikon={<Lock className="w-3.5 h-3.5" />}
                onClick={async () => {
                  await yolla('/api/predictions/lock');
                  toast('Tahmin kilitlendi.', 'basari');
                  yukle();
                }}
              >
                Kilitle
              </Buton>
            )}
            <Buton ton="tehlike" ikon={<X className="w-3.5 h-3.5" />} onClick={iptal}>
              İptal (iade)
            </Buton>
          </div>
        </Kart>
      ) : (
        <Kart
          baslik="Yeni tahmin"
          aciklama="İzleyiciler puanlarını yatırır; kazananlar tüm havuzu bahis oranlarına göre bölüşür."
        >
          <Alan etiket="Soru" ipucu="Örn: Bu maçı kim kazanır?">
            <Girdi value={baslik} onChange={(e) => setBaslik(e.target.value)} placeholder="Tahmin sorusu" />
          </Alan>

          <div className="space-y-2">
            <span className="block text-[11px] font-bold text-gray-300">Seçenekler (en az 2, en çok 6)</span>
            {secenekler.map((s, i) => (
              <div key={i} className="flex gap-2">
                <Girdi
                  value={s}
                  onChange={(e) => setSecenekler(secenekler.map((x, j) => (j === i ? e.target.value : x)))}
                  placeholder={`${i + 1}. seçenek`}
                />
                {secenekler.length > 2 && (
                  <Buton
                    ton="tehlike"
                    ikon={<Trash2 className="w-3.5 h-3.5" />}
                    onClick={() => setSecenekler(secenekler.filter((_, j) => j !== i))}
                  />
                )}
              </div>
            ))}
            {secenekler.length < 6 && (
              <Buton ton="ikincil" ikon={<Plus className="w-3.5 h-3.5" />} onClick={() => setSecenekler([...secenekler, ''])}>
                Seçenek ekle
              </Buton>
            )}
          </div>

          <Alan etiket="Otomatik kilit (dakika)" ipucu="0 = elle kilitlenir">
            <Girdi
              type="number"
              min={0}
              value={kilitDk}
              onChange={(e) => setKilitDk(Math.max(0, Number(e.target.value) || 0))}
            />
          </Alan>

          <Buton ikon={<Play className="w-3.5 h-3.5" />} onClick={olustur}>
            Tahmini başlat
          </Buton>
        </Kart>
      )}

      <Kart baslik="Sohbet komutları">
        <ul className="text-[11px] text-gray-400 space-y-1">
          <li>
            <code className="text-purple-300">!bet</code> — açık tahminin durumunu gösterir
          </li>
          <li>
            <code className="text-purple-300">!bet &lt;seçenek&gt; &lt;puan&gt;</code> — izleyici bahis yapar
          </li>
          <li>
            <code className="text-purple-300">!bet create Soru | A | B</code> — yayıncı/mod tahmin açar
          </li>
          <li>
            <code className="text-purple-300">!bet lock</code> ·{' '}
            <code className="text-purple-300">!bet result &lt;seçenek&gt;</code> ·{' '}
            <code className="text-purple-300">!bet cancel</code>
          </li>
        </ul>
      </Kart>
    </div>
  );
}

// ---------------------------------------------------------------- Kuyruk ----

function KuyrukPaneli() {
  const toast = useToast();
  const { sor, eleman } = useOnay();
  const [liste, setListe] = useState<any[] | null>(null);
  const [ayar, setAyar] = useState<any>(null);
  const [hata, setHata] = useState('');
  // Kullanıcı az önce ayar değiştirdiyse yoklama yanıtı yazdığını EZMESİN:
  // POST havada iken gelen GET eski değeri döndürüp girdiyi geri sıçratırdı.
  const sonDuzenleme = useRef(0);

  const yukle = () =>
    al<any>('/api/queue')
      .then((x) => {
        setListe(x.liste);
        if (Date.now() - sonDuzenleme.current > 2000) setAyar(x.ayar);
        setHata('');
      })
      .catch(() => setHata('Kuyruk okunamadı.'));

  useEffect(() => {
    yukle();
    const t = setInterval(yukle, 4000);
    return () => clearInterval(t);
  }, []);

  if (hata) return <HataDurumu mesaj={hata} yenidenDene={yukle} />;
  if (!ayar || !liste) return <Iskelet satir={5} />;

  const ayarKaydet = async (yeni: any) => {
    sonDuzenleme.current = Date.now();
    setAyar(yeni); // iyimser: anahtar hemen dönsün
    try {
      await yolla('/api/queue/settings', yeni);
    } catch {
      toast('Kaydedilemedi.', 'hata');
      sonDuzenleme.current = 0;
      yukle();
    }
  };

  return (
    <div className="space-y-3">
      {eleman}

      <Kart
        baslik="Kuyruk durumu"
        aciklama={ayar.acik ? 'Açık — izleyiciler !joinq ile giriyor.' : 'Kapalı — !joinq reddediliyor.'}
        sag={
          <Anahtar
            acik={!!ayar.acik}
            etiket={ayar.acik ? 'Açık' : 'Kapalı'}
            onChange={async (v) => {
              await yolla(v ? '/api/queue/open' : '/api/queue/close');
              yukle();
            }}
          />
        }
      >
        <div className="flex flex-wrap gap-2">
          <Buton
            ton="ikincil"
            onClick={async () => {
              const r = await yolla<any>('/api/queue/next');
              toast(r.bos ? 'Kuyruk boş.' : `Sıradaki: ${r.gorunenAd}`, r.bos ? 'hata' : 'basari');
              yukle();
            }}
          >
            Sıradakini çağır
          </Buton>
          <Buton
            ton="tehlike"
            ikon={<Trash2 className="w-3.5 h-3.5" />}
            onClick={() =>
              sor('Kuyruk temizlensin mi?', 'Sıradaki herkes çıkarılır.', async () => {
                const r = await yolla<any>('/api/queue/clear');
                toast(`${r.silinen} kişi çıkarıldı.`, 'basari');
                yukle();
              })
            }
          >
            Kuyruğu temizle
          </Buton>
        </div>
      </Kart>

      <Kart baslik={`Sıradakiler (${liste.length})`}>
        {liste.length === 0 ? (
          <BosDurum baslik="Kuyruk boş" aciklama="İzleyiciler sohbete !joinq yazarak katılır." />
        ) : (
          <ol className="space-y-1">
            {liste.map((k, i) => (
              <li key={k.kullanici} className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2">
                <span className="w-6 text-xs font-black text-purple-300">{i + 1}</span>
                <span className="text-sm text-white font-bold">{k.gorunenAd}</span>
                {k.oncelikli && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-black">
                    ÖNCELİKLİ
                  </span>
                )}
                <span className="ml-auto text-[10px] text-gray-500">{k.platform || '—'}</span>
                <Buton
                  ton="tehlike"
                  ikon={<X className="w-3.5 h-3.5" />}
                  onClick={async () => {
                    await yolla(`/api/queue/${encodeURIComponent(k.kullanici)}`, undefined, 'DELETE');
                    yukle();
                  }}
                />
              </li>
            ))}
          </ol>
        )}
      </Kart>

      <Kart baslik="Kuyruk kuralları">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Alan etiket="En fazla kişi" ipucu="0 = sınırsız">
            <Girdi
              type="number"
              min={0}
              value={ayar.maksKisi}
              onChange={(e) => ayarKaydet({ ...ayar, maksKisi: Math.max(0, Number(e.target.value) || 0) })}
            />
          </Alan>
          <div className="space-y-2 pt-5">
            <Anahtar
              acik={!!ayar.oncelikVar}
              etiket="Abone ve VIP öne geçsin"
              onChange={(v) => ayarKaydet({ ...ayar, oncelikVar: v })}
            />
            <Anahtar
              acik={!!ayar.soloAbone}
              etiket="Yalnız aboneler girebilsin"
              onChange={(v) => ayarKaydet({ ...ayar, soloAbone: v })}
            />
            <Anahtar
              acik={!!ayar.modYonetir}
              etiket="Moderatörler kuyruğu yönetebilsin"
              onChange={(v) => ayarKaydet({ ...ayar, modYonetir: v })}
            />
          </div>
        </div>
      </Kart>

      <Kart baslik="Sohbet komutları">
        <ul className="text-[11px] text-gray-400 space-y-1">
          <li>
            <code className="text-purple-300">!joinq</code> katıl ·{' '}
            <code className="text-purple-300">!leaveq</code> ayrıl ·{' '}
            <code className="text-purple-300">!posq</code> sıramı söyle
          </li>
          <li>
            <code className="text-purple-300">!kuyruk</code> / <code className="text-purple-300">!listq</code> /{' '}
            <code className="text-purple-300">!siradakiler</code> — kuyruğu göster
          </li>
          <li>
            Mod: <code className="text-purple-300">!openq</code> <code className="text-purple-300">!closeq</code>{' '}
            <code className="text-purple-300">!nextq</code> <code className="text-purple-300">!removeq</code>{' '}
            <code className="text-purple-300">!clearq</code>
          </li>
          <li className="text-gray-500">
            Not: <code>!sira</code> ŞARKI isteği kuyruğuna aittir, izleyici kuyruğuna değil.
          </li>
        </ul>
      </Kart>
    </div>
  );
}

// ----------------------------------------------------------- Puan düşüşü ----

function DususPaneli() {
  const toast = useToast();
  const [d, setD] = useState<any>(null);
  const [ayar, setAyar] = useState<any>(null);
  const [hata, setHata] = useState('');
  const kirli = useRef(false);

  const yukle = () =>
    al<any>('/api/point-drops')
      .then((x) => {
        setD(x);
        // Kullanıcı form üzerinde yazarken yoklama yazdıklarını EZMESİN
        if (!kirli.current) setAyar(x.ayar);
        setHata('');
      })
      .catch(() => setHata('Puan düşüşü durumu okunamadı.'));

  useEffect(() => {
    yukle();
    const t = setInterval(yukle, 2000);
    return () => clearInterval(t);
  }, []);

  if (hata) return <HataDurumu mesaj={hata} yenidenDene={yukle} />;
  if (!d || !ayar) return <Iskelet satir={5} />;

  const duzenle = (yama: any) => {
    kirli.current = true;
    setAyar({ ...ayar, ...yama });
  };

  const kaydet = async () => {
    await yolla('/api/point-drops/settings', ayar);
    kirli.current = false;
    toast('Ayarlar kaydedildi.', 'basari');
    yukle();
  };

  return (
    <div className="space-y-3">
      <Kart
        baslik="Düşüş durumu"
        aciklama={
          d.aktif
            ? `Açık · "${d.anahtar}" yazan ${d.katilanlar.length} kişi · ${sureMetni(d.kalanSaniye)} kaldı`
            : 'Kapalı — başlatınca sohbete anahtar kelimeyi yazan ilk kişiler puanı paylaşır.'
        }
        sag={
          <span
            className={`px-2 py-1 rounded-lg text-[10px] font-black ${
              d.aktif ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-gray-400'
            }`}
          >
            {d.aktif ? 'AÇIK' : 'KAPALI'}
          </span>
        }
      >
        <div className="flex flex-wrap gap-2">
          <Buton
            ikon={<Play className="w-3.5 h-3.5" />}
            disabled={d.aktif}
            onClick={async () => {
              try {
                await yolla('/api/point-drops/start');
                toast('Puan düşüşü başladı!', 'basari');
                yukle();
              } catch (e: any) {
                toast(String(e.message), 'hata');
              }
            }}
          >
            Başlat
          </Buton>
          <Buton
            ton="tehlike"
            ikon={<Square className="w-3.5 h-3.5" />}
            disabled={!d.aktif}
            onClick={async () => {
              await yolla('/api/point-drops/stop');
              toast('İptal edildi — puan dağıtılmadı.', 'basari');
              yukle();
            }}
          >
            İptal et
          </Buton>
        </div>

        {d.aktif && d.katilanlar.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/10">
            {d.katilanlar.map((k: string) => (
              <span key={k} className="px-2 py-0.5 rounded-lg bg-white/10 text-[10px] text-white font-bold">
                {k}
              </span>
            ))}
          </div>
        )}
      </Kart>

      <Kart baslik="Düşüş ayarları">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Alan etiket="Anahtar kelime" ipucu="Sohbete bunu yazan katılır">
            <Girdi value={ayar.anahtar} onChange={(e) => duzenle({ anahtar: e.target.value })} />
          </Alan>
          <Alan etiket="Dağıtılacak toplam puan">
            <Girdi
              type="number"
              min={0}
              value={ayar.toplamPuan}
              onChange={(e) => duzenle({ toplamPuan: Math.max(0, Number(e.target.value) || 0) })}
            />
          </Alan>
          <Alan etiket="En fazla kişi" ipucu="0 = sınırsız; dolunca süre beklenmeden biter">
            <Girdi
              type="number"
              min={0}
              value={ayar.maksKisi}
              onChange={(e) => duzenle({ maksKisi: Math.max(0, Number(e.target.value) || 0) })}
            />
          </Alan>
          <Alan etiket="Süre (saniye)">
            <Girdi
              type="number"
              min={5}
              value={ayar.sureSn}
              onChange={(e) => duzenle({ sureSn: Math.max(5, Number(e.target.value) || 5) })}
            />
          </Alan>
          <Alan
            etiket="Paylaşım biçimi"
            ipucu={
              ayar.paylasim === 'bolusum'
                ? 'Havuz katılan sayısına bölünür — az katılan çok kazanır'
                : 'Herkese sabit puan (toplam / en fazla kişi)'
            }
          >
            <Secim
              value={ayar.paylasim}
              onChange={(e) => duzenle({ paylasim: e.target.value })}
              secenekler={[
                { value: 'bolusum', label: 'Havuz bölüşümü' },
                { value: 'sabit', label: 'Kişi başı sabit' }
              ]}
            />
          </Alan>
          <div className="pt-5">
            <Anahtar
              acik={!!ayar.modBaslatabilir}
              etiket="Moderatörler başlatabilsin"
              onChange={(v) => duzenle({ modBaslatabilir: v })}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Buton ikon={<Save className="w-3.5 h-3.5" />} onClick={kaydet}>
            Kaydet
          </Buton>
          <Buton
            ton="ikincil"
            ikon={<RotateCcw className="w-3.5 h-3.5" />}
            onClick={() => {
              kirli.current = false;
              yukle();
            }}
          >
            Geri al
          </Buton>
        </div>
      </Kart>

      <Kart baslik="Sohbet komutları">
        <ul className="text-[11px] text-gray-400 space-y-1">
          <li>
            <code className="text-purple-300">!pdrops start</code> ·{' '}
            <code className="text-purple-300">!pdrops stop</code> ·{' '}
            <code className="text-purple-300">!pdrops status</code>
          </li>
          <li>
            İzleyici yalnız <code className="text-purple-300">{ayar.anahtar}</code> yazar — bir kişi bir kez sayılır.
          </li>
        </ul>
      </Kart>
    </div>
  );
}

// ------------------------------------------------------------------ Sayfa ---

export function Interaction() {
  const [sekme, setSekme] = useState<Sekme>('tahmin');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-purple-400" /> Etkileşim
        </h1>
        <p className="text-sm text-gray-400">
          Tahminler, izleyici kuyruğu ve puan düşüşleri — izleyiciyi ekran başında tutan üç araç.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 bg-black/30 p-1 rounded-xl">
        {SEKMELER.map((s) => {
          const I = s.ikon;
          return (
            <button
              key={s.id}
              onClick={() => setSekme(s.id)}
              className={`px-3 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${
                sekme === s.id ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <I className="w-3.5 h-3.5" />
              {s.etiket}
            </button>
          );
        })}
      </div>

      {sekme === 'tahmin' && <TahminPaneli />}
      {sekme === 'kuyruk' && <KuyrukPaneli />}
      {sekme === 'dusus' && <DususPaneli />}
    </div>
  );
}

export default Interaction;
