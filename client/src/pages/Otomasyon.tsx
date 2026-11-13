/**
 * Görsel kural oluşturucu: Tetikleyici → Koşullar → Eylemler. Kod yazmadan "sahne şovu" kurulur.
 * "Dene" hiçbir eylemi çalıştırmaz, yalnız ne olacağını gösterir.
 */
import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, FlaskConical, Play, Plus, Trash2, Workflow, Zap } from 'lucide-react';
import { Anahtar, BosDurum, Buton, Girdi, KaydedilmemisUyari, Kart, Secim, useToast } from '../ui/index.js';
import { KICK_ODUL_LISTESI, KickOdulleri } from '../components/KickOdulleri.js';

type Alanlar = Record<string, any> & { tur: string };
interface Kural {
  id: string;
  ad: string;
  etkin: boolean;
  beklemeSn: number;
  /** B7: sırayla ya da her seferinde rastgele bir eylem */
  kip?: 'sirali' | 'rastgele';
  /** B7: bekleme sırasında gelen olaylar sıraya girer */
  sira?: boolean;
  tetik: Alanlar;
  kosullar: Alanlar[];
  eylemler: Alanlar[];
}
interface Gunluk {
  zaman: number;
  kural: string;
  ok: boolean;
  mesaj: string;
}

type AlanTanimi = { ad: string; etiket: string; sayi?: boolean; ipucu?: string; liste?: string };
const SAHNE_ONERILERI = 'otomasyon-sahne-onerileri';
type Tanim = { etiket: string; alanlar: AlanTanimi[]; varsayilan?: Record<string, any> };

const TETIKLER: Record<string, Tanim> = {
  komut: { etiket: 'Sohbet komutu', alanlar: [{ ad: 'komut', etiket: 'Komut', ipucu: '!hype' }] },
  takip: { etiket: 'Yeni takipçi', alanlar: [] },
  abone: { etiket: 'Yeni abonelik', alanlar: [] },
  bagis: { etiket: 'Bağış', alanlar: [{ ad: 'enAz', etiket: 'En az miktar', sayi: true }], varsayilan: { enAz: 0 } },
  baskin: { etiket: 'Baskın (raid)', alanlar: [{ ad: 'enAz', etiket: 'En az izleyici', sayi: true }], varsayilan: { enAz: 0 } },
  odul: { etiket: 'Ödül (bot puanı ya da Kick kanal ödülü)', alanlar: [{ ad: 'odul', etiket: 'Ödül adı (boş = hepsi)' }], varsayilan: { odul: '' } },
  sure: { etiket: 'Belirli aralıkla', alanlar: [{ ad: 'dakika', etiket: 'Her kaç dakikada', sayi: true }], varsayilan: { dakika: 30 } },
  patlama: {
    etiket: 'Sohbet patlaması',
    alanlar: [
      { ad: 'mesaj', etiket: 'Mesaj sayısı', sayi: true },
      { ad: 'saniye', etiket: 'Kaç saniyede', sayi: true },
    ],
    varsayilan: { mesaj: 30, saniye: 10 },
  },
};

const KOSULLAR: Record<string, Tanim> = {
  mod: { etiket: 'Kullanıcı moderatör ya da yayıncı', alanlar: [] },
  abone: { etiket: 'Kullanıcı abone', alanlar: [] },
  canli: { etiket: 'Yayın canlı', alanlar: [] },
  en_az_puan: { etiket: 'Puanı en az', alanlar: [{ ad: 'puan', etiket: 'Puan', sayi: true }], varsayilan: { puan: 100 } },
};

const EYLEMLER: Record<string, Tanim> = {
  sohbet: { etiket: 'Sohbete yaz', alanlar: [{ ad: 'metin', etiket: 'Metin', ipucu: 'Hoş geldin {kullanici}!' }] },
  tts: { etiket: 'Seslendir', alanlar: [{ ad: 'metin', etiket: 'Metin' }] },
  pano_oynat: { etiket: 'Ses panosundan çal', alanlar: [] },
  shoutout: { etiket: 'Shoutout kartı göster', alanlar: [{ ad: 'kanal', etiket: 'Kanal', ipucu: '{kullanici}' }], varsayilan: { kanal: '{kullanici}' } },
  obs_sahne: { etiket: 'OBS sahnesine geç', alanlar: [{ ad: 'sahne', etiket: 'Sahne adı', ipucu: 'Sahne adı ya da {onceki_sahne}', liste: SAHNE_ONERILERI }] },
  replay: { etiket: 'OBS tekrar arabelleğini kaydet', alanlar: [] },
  klip: { etiket: 'Klip al', alanlar: [{ ad: 'saniye', etiket: 'Saniye', sayi: true }], varsayilan: { saniye: 30 } },
  discord: { etiket: "Discord'a yaz", alanlar: [{ ad: 'metin', etiket: 'Metin' }] },
  kalkan: { etiket: 'Kalkan modu', alanlar: [], varsayilan: { durum: 'ac' } },
  sarki_atla: { etiket: 'Şarkıyı atla', alanlar: [] },
  sohbet_temizle: { etiket: 'OBS sohbetini temizle', alanlar: [] },
  komut: { etiket: 'Bot komutu çalıştır', alanlar: [{ ad: 'metin', etiket: 'Komut (yayıncı yetkisiyle)', ipucu: '!komut' }] },
  bekle: { etiket: 'Bekle', alanlar: [{ ad: 'saniye', etiket: 'Saniye', sayi: true }], varsayilan: { saniye: 3 } },
};

const yeni = (tanimlar: Record<string, Tanim>, tur: string): Alanlar => ({ tur, ...tanimlar[tur].varsayilan });
const yeniKural = (): Kural => ({
  id: crypto.randomUUID(),
  ad: 'Yeni kural',
  etkin: true,
  beklemeSn: 30,
  tetik: { tur: 'komut', komut: '' },
  kosullar: [],
  eylemler: [{ tur: 'sohbet', metin: '' }],
});

/** Bir blok: tür seçimi ve o türün alanları */
function Blok({ tanimlar, deger, degistir, pano }: { tanimlar: Record<string, Tanim>; deger: Alanlar; degistir: (d: Alanlar) => void; pano?: Array<{ id: string; ad: string }> }) {
  const tanim = tanimlar[deger.tur];
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <Secim
        aria-label="Tür"
        className="w-56 max-w-full"
        value={deger.tur}
        onChange={(e) => degistir(yeni(tanimlar, e.target.value))}
        secenekler={Object.entries(tanimlar).map(([value, t]) => ({ value, label: t.etiket }))}
      />
      {tanim?.alanlar.map((a) => (
        <Girdi
          key={a.ad}
          aria-label={a.etiket}
          title={a.etiket}
          type={a.sayi ? 'number' : 'text'}
          min={a.sayi ? 0 : undefined}
          placeholder={a.ipucu || a.etiket}
          list={a.liste ?? (a.ad === 'odul' ? KICK_ODUL_LISTESI : undefined)}
          className={a.sayi ? 'w-28' : 'min-w-40 flex-1'}
          value={deger[a.ad] ?? ''}
          onChange={(e) => degistir({ ...deger, [a.ad]: a.sayi ? Number(e.target.value) : e.target.value })}
        />
      ))}
      {deger.tur === 'pano_oynat' ? (
        <Secim
          aria-label="Ses"
          className="min-w-40 flex-1"
          value={deger.ogeId ?? ''}
          onChange={(e) => degistir({ ...deger, ogeId: e.target.value })}
          secenekler={[{ value: '', label: 'Ses seçin' }, ...(pano || []).map((o) => ({ value: o.id, label: o.ad }))]}
        />
      ) : null}
      {deger.tur === 'kalkan' ? (
        <Secim
          aria-label="Kalkan durumu"
          className="w-28"
          value={deger.durum}
          onChange={(e) => degistir({ ...deger, durum: e.target.value })}
          secenekler={[
            { value: 'ac', label: 'Aç' },
            { value: 'kapat', label: 'Kapat' },
          ]}
        />
      ) : null}
    </div>
  );
}

const baslik = (n: string) => <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{n}</h4>;
const satirSinif = 'flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 p-2';
const ikonTus = 'rounded-lg p-1.5 text-gray-400 transition-all hover:bg-white/10 hover:text-white active:scale-[0.98] disabled:opacity-30';

function KuralDuzenleyici({ kural, degistir, sil, pano }: { kural: Kural; degistir: (k: Kural) => void; sil: () => void; pano: Array<{ id: string; ad: string }> }) {
  const toast = useToast();
  const [sonuc, setSonuc] = useState<{ uyar: boolean; engel: string | null; adimlar: string[] } | null>(null);
  const [calisma, setCalisma] = useState<{ ok: boolean; mesaj: string } | 'suruyor' | null>(null);
  const yama = (d: Partial<Kural>) => {
    setSonuc(null);
    setCalisma(null);
    degistir({ ...kural, ...d });
  };
  const liste = (ad: 'kosullar' | 'eylemler', i: number, d: Alanlar) => yama({ [ad]: kural[ad].map((x, j) => (j === i ? d : x)) });
  const kaldir = (ad: 'kosullar' | 'eylemler', i: number) => yama({ [ad]: kural[ad].filter((_, j) => j !== i) });
  const tasi = (i: number, yon: number) => {
    const l = [...kural.eylemler];
    l.splice(i + yon, 0, l.splice(i, 1)[0]);
    yama({ eylemler: l });
  };
  const dene = async () => {
    const r = await fetch('/api/otomasyon/dene', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kural }) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    if (!r?.ok) return toast(d?.error || 'Denenemedi', 'hata');
    setSonuc(d);
  };
  const calistir = async () => {
    if (!confirm(`"${kural.ad}" örnek bir olayla gerçekten çalıştırılsın mı? Sohbet, OBS ve Discord eylemleri gerçekten yapılır.`)) return;
    setCalisma('suruyor');
    const r = await fetch('/api/otomasyon/calistir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kural }) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setCalisma(d && typeof d.ok === 'boolean' ? d : { ok: false, mesaj: 'Bota ulaşılamadı' });
  };

  return (
    <Kart
      baslik={kural.ad || 'Adsız kural'}
      sag={
        <div className="flex items-center gap-2">
          <Buton ton="ikincil" ikon={<FlaskConical className="h-3.5 w-3.5" />} onClick={() => void dene()}>
            Dene
          </Buton>
          <Buton ton="ikincil" disabled={calisma === 'suruyor'} ikon={<Play className="h-3.5 w-3.5" />} onClick={() => void calistir()}>
            {calisma === 'suruyor' ? 'Çalışıyor…' : 'Çalıştır'}
          </Buton>
          <button type="button" className={ikonTus} aria-label={`${kural.ad} kuralını sil`} title="Kuralı sil" onClick={sil}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <Girdi aria-label="Kural adı" className="min-w-48 flex-1" value={kural.ad} onChange={(e) => yama({ ad: e.target.value })} />
        <label className="flex items-center gap-2 text-xs text-gray-300">
          Bekleme (sn)
          <Girdi type="number" min={0} className="w-24" value={kural.beklemeSn} onChange={(e) => yama({ beklemeSn: Number(e.target.value) })} />
        </label>
        <Anahtar acik={kural.etkin} onChange={(v) => yama({ etkin: v })} etiket="Etkin" />
        <Secim
          aria-label="Çalıştırma biçimi"
          className="w-56"
          value={kural.kip || 'sirali'}
          onChange={(e) => yama({ kip: e.target.value as Kural['kip'] })}
          secenekler={[
            { value: 'sirali', label: 'Eylemler sırayla' },
            { value: 'rastgele', label: 'Her seferinde rastgele biri' },
          ]}
        />
        <label className="flex items-center gap-2 text-xs text-gray-300" title="Bekleme sırasında gelen olaylar atılmaz; sırayla, beklemeye uyarak çalışır (en çok 10)">
          <input type="checkbox" checked={kural.sira === true} onChange={(e) => yama({ sira: e.target.checked })} />
          Sıraya al
        </label>
      </div>
      <datalist id={SAHNE_ONERILERI}>
        <option value="{onceki_sahne}">Kuraldan önceki sahneye dön</option>
      </datalist>

      {baslik('1 · Tetikleyici')}
      <div className={satirSinif}>
        <Zap aria-hidden className="h-4 w-4 flex-shrink-0 text-amber-300" />
        <Blok tanimlar={TETIKLER} deger={kural.tetik} degistir={(d) => yama({ tetik: d })} />
      </div>

      {baslik('2 · Koşullar (hepsi sağlanmalı)')}
      {kural.kosullar.map((k, i) => (
        <div key={i} className={satirSinif}>
          <Blok tanimlar={KOSULLAR} deger={k} degistir={(d) => liste('kosullar', i, d)} />
          <button type="button" className={ikonTus} aria-label={`${i + 1}. koşulu kaldır`} onClick={() => kaldir('kosullar', i)}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <Buton ton="ikincil" ikon={<Plus className="h-3.5 w-3.5" />} onClick={() => yama({ kosullar: [...kural.kosullar, yeni(KOSULLAR, 'canli')] })}>
        Koşul ekle
      </Buton>

      {baslik(kural.kip === 'rastgele' ? '3 · Eylemler (rastgele biri)' : '3 · Eylemler (sırayla)')}
      {kural.eylemler.map((e, i) => (
        <div key={i} className={satirSinif}>
          <span className="w-5 flex-shrink-0 text-center text-xs font-black text-gray-500">{i + 1}</span>
          <Blok tanimlar={EYLEMLER} deger={e} degistir={(d) => liste('eylemler', i, d)} pano={pano} />
          <button type="button" className={ikonTus} aria-label={`${i + 1}. eylemi yukarı al`} disabled={i === 0} onClick={() => tasi(i, -1)}>
            <ArrowUp className="h-4 w-4" />
          </button>
          <button type="button" className={ikonTus} aria-label={`${i + 1}. eylemi aşağı al`} disabled={i === kural.eylemler.length - 1} onClick={() => tasi(i, 1)}>
            <ArrowDown className="h-4 w-4" />
          </button>
          <button type="button" className={ikonTus} aria-label={`${i + 1}. eylemi kaldır`} onClick={() => kaldir('eylemler', i)}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <Buton ton="ikincil" ikon={<Plus className="h-3.5 w-3.5" />} onClick={() => yama({ eylemler: [...kural.eylemler, yeni(EYLEMLER, 'sohbet')] })}>
        Eylem ekle
      </Buton>

      {calisma && calisma !== 'suruyor' ? (
        <p role="status" className={`rounded-xl border border-white/10 bg-black/40 p-3 text-xs ${calisma.ok ? 'text-emerald-300' : 'text-red-300'}`}>
          {calisma.ok ? 'Çalıştı: ' : 'Durdu: '}
          {calisma.mesaj}
        </p>
      ) : null}
      {sonuc ? (
        <div role="status" className="rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-gray-300">
          <p className="font-bold text-white">Deneme: hiçbir eylem çalıştırılmadı</p>
          {sonuc.engel ? <p className="mt-1 text-amber-300">Örnek olayda duracak: {sonuc.engel}</p> : null}
          <ol className="mt-1 list-decimal space-y-0.5 pl-4">
            {sonuc.adimlar.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ol>
        </div>
      ) : null}
    </Kart>
  );
}

export function Otomasyon() {
  const toast = useToast();
  const [kurallar, setKurallar] = useState<Kural[] | null>(null);
  const [gunluk, setGunluk] = useState<Gunluk[]>([]);
  const [pano, setPano] = useState<Array<{ id: string; ad: string }>>([]);
  const [degisti, setDegisti] = useState(false);

  useEffect(() => {
    const oku = (ilk: boolean) =>
      fetch('/api/otomasyon')
        .then((r) => r.json())
        .then((d) => {
          setGunluk(d.gunluk || []);
          if (ilk) setKurallar(d.kurallar || []);
        })
        .catch(() => {
          if (ilk) setKurallar([]);
        });
    void oku(true);
    fetch('/api/pano')
      .then((r) => r.json())
      .then((d) => setPano(d.ogeler || []))
      .catch(() => {});
    const t = setInterval(() => void oku(false), 5000);
    return () => clearInterval(t);
  }, []);

  const guncelle = (l: Kural[]) => {
    setKurallar(l);
    setDegisti(true);
  };

  const kaydet = async () => {
    const r = await fetch('/api/otomasyon', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kurallar }) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    if (!r?.ok) return toast(d?.error || 'Kaydedilemedi', 'hata');
    setKurallar(d.kurallar);
    setDegisti(false);
    toast('Kurallar kaydedildi', 'basari');
  };

  return (
    <div className="space-y-4">
      <KaydedilmemisUyari varMi={degisti} onKaydet={() => void kaydet()} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-white">
            <Workflow className="h-6 w-6 text-purple-400" /> Otomasyon
          </h1>
          <p className="text-sm text-gray-400">
            Bir olay olunca botun ne yapacağını kur. Metinlerde <code className="text-purple-400">{'{kullanici} {miktar} {mesaj} {odul} {platform}'}</code> kullanılabilir; sahne adına <code className="text-purple-400">{'{onceki_sahne}'}</code> yazılırsa kuraldan önceki sahneye dönülür. OBS eylemleri için AxthrowA Studio açık olmalı.
          </p>
        </div>
        <div className="flex gap-2">
          <Buton ton="ikincil" ikon={<Plus className="h-3.5 w-3.5" />} onClick={() => guncelle([...(kurallar || []), yeniKural()])}>
            Yeni kural
          </Buton>
          <Buton disabled={!degisti} onClick={() => void kaydet()}>
            Kaydet
          </Buton>
        </div>
      </div>

      {kurallar && !kurallar.length ? <BosDurum baslik="Henüz kural yok" aciklama="Örneğin: !hype yazılınca sahneyi değiştir, ses çal, sohbete yaz." /> : null}
      {(kurallar || []).map((k) => (
        <KuralDuzenleyici
          key={k.id}
          kural={k}
          pano={pano}
          degistir={(d) => guncelle((kurallar || []).map((x) => (x.id === k.id ? d : x)))}
          sil={() => guncelle((kurallar || []).filter((x) => x.id !== k.id))}
        />
      ))}

      <KickOdulleri />

      <Kart baslik="Son çalışmalar" aciklama="Bot yeniden başlayınca sıfırlanır">
        {gunluk.length === 0 ? <p className="text-xs text-gray-500">Henüz çalışan kural yok.</p> : null}
        <ul className="space-y-1">
          {gunluk.map((g, i) => (
            <li key={i} className="flex gap-2 text-xs">
              <span className="flex-shrink-0 font-mono text-gray-500">{new Date(g.zaman).toLocaleTimeString('tr-TR')}</span>
              <span className={g.ok ? 'text-emerald-400' : 'text-red-400'}>{g.ok ? 'Tamam' : 'Hata'}</span>
              <span className="font-bold text-white">{g.kural}</span>
              <span className="min-w-0 truncate text-gray-400">{g.mesaj}</span>
            </li>
          ))}
        </ul>
      </Kart>
    </div>
  );
}

export default Otomasyon;
