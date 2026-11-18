/**
 * Görsel kural oluşturucu: Tetikleyici → Koşullar → Eylemler. Kod yazmadan "sahne şovu" kurulur.
 * "Dene" hiçbir eylemi çalıştırmaz, yalnız ne olacağını gösterir.
 */
import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Download, FlaskConical, Play, Plus, Trash2, Upload, Workflow, Zap } from 'lucide-react';
import { Anahtar, BosDurum, Buton, Girdi, Kart, KayitDurumu, Secim, useToast } from '../ui/index.js';
import { useOtoKayit } from '../hooks/useOtoKayit.js';
import { KICK_ODUL_LISTESI } from '../components/KickOdulleri.js';

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
  /** BOT-1: adlı kuyruk (boş = kuyruksuz) */
  kuyruk?: string;
  tetik: Alanlar;
  kosullar: Alanlar[];
  eylemler: Alanlar[];
}
interface Kuyruk {
  ad: string;
  ayniAnda: number;
  enCokBekleyen: number;
}
type Veri = { kurallar: Kural[]; kuyruklar: Kuyruk[] };
type Secenek = { value: string; label: string };
interface Gunluk {
  zaman: number;
  kural: string;
  ok: boolean;
  mesaj: string;
}

/** `secim`: açılır liste; `bos`: boş bırakılabilen sayı (null = değişmez) */
type AlanTanimi = { ad: string; etiket: string; sayi?: boolean; bos?: boolean; ipucu?: string; liste?: string; secim?: Secenek[] };
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
  // Y12: AxthrowA Studio'nun bağlantı koruması bildirir
  bit_hizi_dustu: { etiket: 'Bit hızı düştü (Studio)', alanlar: [] },
  baglanti_duzeldi: { etiket: 'Bağlantı düzeldi (Studio)', alanlar: [] },
  kare_dususu: { etiket: 'Düşen kare eşiği (Studio)', alanlar: [{ ad: 'enAz', etiket: 'En az yüzde', sayi: true }], varsayilan: { enAz: 5 } },
  // Y7: Twitch reklam takvimi (Studio)
  reklam_yaklasiyor: { etiket: 'Reklama 60 sn kaldı (Twitch)', alanlar: [] },
  reklam_basliyor: { etiket: 'Reklam başlıyor (Twitch)', alanlar: [] },
  reklam_bitti: { etiket: 'Reklam bitti (Twitch)', alanlar: [] },
  // Y8
  izleme_serisi: { etiket: 'İzleme serisi (Twitch)', alanlar: [{ ad: 'enAz', etiket: 'En az yayın', sayi: true }], varsayilan: { enAz: 3 } },
  power_up: { etiket: 'Power-up (Twitch)', alanlar: [{ ad: 'guc', etiket: 'Power-up adı (boş = hepsi)' }], varsayilan: { guc: '' } },
};

const KOSULLAR: Record<string, Tanim> = {
  mod: { etiket: 'Kullanıcı moderatör ya da yayıncı', alanlar: [] },
  abone: { etiket: 'Kullanıcı abone', alanlar: [] },
  canli: { etiket: 'Yayın canlı', alanlar: [] },
  en_az_puan: { etiket: 'Puanı en az', alanlar: [{ ad: 'puan', etiket: 'Puan', sayi: true }], varsayilan: { puan: 100 } },
};

const EYLEMLER: Record<string, Tanim> = {
  sohbet: { etiket: 'Sohbete yaz', alanlar: [{ ad: 'metin', etiket: 'Metin', ipucu: 'Hoş geldin {kullanici}!' }] },
  tts: { etiket: 'TTS ile oku', alanlar: [{ ad: 'metin', etiket: 'Metin' }] },
  pano_oynat: { etiket: 'Ses çal (ses panosu)', alanlar: [] },
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
  // BOT-1 eylem kitaplığı
  obs_filtre: {
    etiket: 'OBS filtresi',
    alanlar: [
      { ad: 'durum', etiket: 'Ne yapılsın', secim: [{ value: 'ac', label: 'Aç' }, { value: 'kapat', label: 'Kapat' }, { value: 'degistir', label: 'Aç/kapat' }] },
      { ad: 'kaynak', etiket: 'Kaynak adı', ipucu: 'Kamera' },
      { ad: 'filtre', etiket: 'Filtre adı', ipucu: 'Işık' },
    ],
    varsayilan: { durum: 'ac', kaynak: '', filtre: '' },
  },
  obs_kaynak: {
    etiket: 'OBS kaynağı göster / gizle',
    alanlar: [
      { ad: 'durum', etiket: 'Ne yapılsın', secim: [{ value: 'goster', label: 'Göster' }, { value: 'gizle', label: 'Gizle' }, { value: 'degistir', label: 'Göster/gizle' }] },
      { ad: 'kaynak', etiket: 'Kaynak adı' },
      { ad: 'sahne', etiket: 'Sahne (boş = şimdiki)' },
    ],
    varsayilan: { durum: 'goster', kaynak: '', sahne: '' },
  },
  obs_donusum: {
    etiket: 'OBS kaynağını taşı / ölçekle / döndür',
    alanlar: [
      { ad: 'kaynak', etiket: 'Kaynak adı' },
      { ad: 'sahne', etiket: 'Sahne (boş = şimdiki)' },
      { ad: 'x', etiket: 'X (px, boş = değişmez)', sayi: true, bos: true },
      { ad: 'y', etiket: 'Y (px, boş = değişmez)', sayi: true, bos: true },
      { ad: 'olcek', etiket: 'Ölçek (1 = asıl boy)', sayi: true, bos: true },
      { ad: 'aci', etiket: 'Açı (derece)', sayi: true, bos: true },
    ],
    varsayilan: { kaynak: '', sahne: '', x: null, y: null, olcek: 1, aci: null },
  },
  http: {
    etiket: 'HTTP isteği gönder',
    alanlar: [
      { ad: 'yontem', etiket: 'Yöntem', secim: [{ value: 'GET', label: 'GET' }, { value: 'POST', label: 'POST' }] },
      { ad: 'adres', etiket: 'Adres', ipucu: 'https://ornek.com/kanca?ad={kullanici}' },
      { ad: 'govde', etiket: 'Gövde (yalnız POST; { ile başlarsa JSON)', ipucu: '{"ad": "{kullanici}"}' },
    ],
    varsayilan: { yontem: 'GET', adres: '', govde: '' },
  },
  degisken: {
    etiket: 'Değişken yaz',
    alanlar: [
      { ad: 'hedef', etiket: 'Hedef', secim: [{ value: 'sayac', label: 'Sayaç — $(getcounter ad)' }, { value: 'kanal', label: 'Kanal değişkeni — $(globalvar ad)' }] },
      { ad: 'ad', etiket: 'Ad', ipucu: 'abone_sayisi' },
      { ad: 'islem', etiket: 'İşlem', secim: [{ value: 'ayarla', label: '= ayarla' }, { value: 'ekle', label: '+ ekle (yalnız sayaç)' }] },
      { ad: 'deger', etiket: 'Değer', ipucu: '1 ya da {miktar}' },
    ],
    varsayilan: { hedef: 'sayac', ad: '', islem: 'ekle', deger: '1' },
  },
  rastgele_dal: {
    etiket: 'Rastgele dal (olasılıkla)',
    alanlar: [{ ad: 'yuzde', etiket: 'Olasılık %', sayi: true }],
    varsayilan: { yuzde: 50, evet: [{ tur: 'sohbet', metin: '' }], hayir: [] },
  },
  kural_calistir: { etiket: 'Başka kuralı çalıştır', alanlar: [], varsayilan: { kuralId: '' } },
};
/** Sunucudaki EN_COK_DAL_DERINLIGI (3) ile aynı: en içteki listede yeni dal açılmaz */
const EN_DERIN_DAL = 2;
const DALSIZ = Object.fromEntries(Object.entries(EYLEMLER).filter(([t]) => t !== 'rastgele_dal'));

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
function Blok({ tanimlar, deger, degistir, pano, kurallar }: { tanimlar: Record<string, Tanim>; deger: Alanlar; degistir: (d: Alanlar) => void; pano?: Array<{ id: string; ad: string }>; kurallar?: Secenek[] }) {
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
      {tanim?.alanlar.map((a) =>
        a.secim ? (
          <Secim key={a.ad} aria-label={a.etiket} title={a.etiket} className="w-auto max-w-full" value={deger[a.ad] ?? a.secim[0].value} onChange={(e) => degistir({ ...deger, [a.ad]: e.target.value })} secenekler={a.secim} />
        ) : (
          <Girdi
            key={a.ad}
            aria-label={a.etiket}
            title={a.etiket}
            type={a.sayi ? 'number' : 'text'}
            min={a.sayi && !a.bos ? 0 : undefined}
            step={a.bos ? 'any' : undefined}
            placeholder={a.ipucu || a.etiket}
            list={a.liste ?? (a.ad === 'odul' ? KICK_ODUL_LISTESI : undefined)}
            className={a.sayi ? 'w-28' : 'min-w-40 flex-1'}
            value={deger[a.ad] ?? ''}
            onChange={(e) => degistir({ ...deger, [a.ad]: a.sayi ? (a.bos && e.target.value === '' ? null : Number(e.target.value)) : e.target.value })}
          />
        )
      )}
      {deger.tur === 'kural_calistir' ? (
        <Secim
          aria-label="Çalıştırılacak kural"
          className="min-w-40 flex-1"
          value={deger.kuralId ?? ''}
          onChange={(e) => degistir({ ...deger, kuralId: e.target.value })}
          secenekler={[{ value: '', label: 'Kural seçin' }, ...(kurallar || [])]}
        />
      ) : null}
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

const baslik = (n: string) => <h4 className="text-xs axt-etiket font-bold text-gray-400">{n}</h4>;
const satirSinif = 'flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 p-2';
const ikonTus = 'rounded-lg p-1.5 text-gray-400 transition-all hover:bg-white/10 hover:text-white active:scale-[0.98] disabled:opacity-30';

/** Eylem satırları; rastgele dalın "olursa / olmazsa" listeleri aynı bileşenle, bir kademe içeride */
function EylemListesi({ eylemler, degistir, pano, kurallar, derinlik, onEk }: { eylemler: Alanlar[]; degistir: (l: Alanlar[]) => void; pano: Array<{ id: string; ad: string }>; kurallar: Secenek[]; derinlik: number; onEk: string }) {
  const koy = (i: number, d: Alanlar) => degistir(eylemler.map((x, j) => (j === i ? d : x)));
  const tasi = (i: number, yon: number) => {
    const l = [...eylemler];
    l.splice(i + yon, 0, l.splice(i, 1)[0]);
    degistir(l);
  };
  const tanimlar = derinlik >= EN_DERIN_DAL ? DALSIZ : EYLEMLER;
  return (
    <>
      {eylemler.map((e, i) => {
        const ad = `${onEk}${i + 1}`;
        return (
          <div key={i} className="space-y-2">
            <div className={satirSinif}>
              <span className="w-6 flex-shrink-0 text-center text-xs font-black text-gray-500">{ad}</span>
              <Blok tanimlar={tanimlar} deger={e} degistir={(d) => koy(i, d)} pano={pano} kurallar={kurallar} />
              <button type="button" className={ikonTus} aria-label={`${ad}. eylemi yukarı al`} disabled={i === 0} onClick={() => tasi(i, -1)}>
                <ArrowUp className="h-4 w-4" />
              </button>
              <button type="button" className={ikonTus} aria-label={`${ad}. eylemi aşağı al`} disabled={i === eylemler.length - 1} onClick={() => tasi(i, 1)}>
                <ArrowDown className="h-4 w-4" />
              </button>
              <button type="button" className={ikonTus} aria-label={`${ad}. eylemi kaldır`} onClick={() => degistir(eylemler.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {e.tur === 'rastgele_dal' ? (
              <div className="ml-6 space-y-2 border-l-2 border-purple-500/30 pl-3">
                {baslik(`Olursa (%${e.yuzde ?? 50})`)}
                <EylemListesi eylemler={e.evet || []} degistir={(l) => koy(i, { ...e, evet: l })} pano={pano} kurallar={kurallar} derinlik={derinlik + 1} onEk={`${ad}a.`} />
                {baslik('Olmazsa')}
                <EylemListesi eylemler={e.hayir || []} degistir={(l) => koy(i, { ...e, hayir: l })} pano={pano} kurallar={kurallar} derinlik={derinlik + 1} onEk={`${ad}b.`} />
              </div>
            ) : null}
          </div>
        );
      })}
      <Buton ton="ikincil" ikon={<Plus className="h-3.5 w-3.5" />} onClick={() => degistir([...eylemler, yeni(EYLEMLER, 'sohbet')])}>
        {derinlik ? 'Bu dala eylem ekle' : 'Eylem ekle'}
      </Buton>
    </>
  );
}

/** Sunucudaki paketi dosya olarak indirir (kaydedilmiş hâl) */
async function paketIndir(id?: string): Promise<boolean> {
  const r = await fetch(`/api/otomasyon/disa-aktar${id ? `?id=${encodeURIComponent(id)}` : ''}`).catch(() => null);
  if (!r?.ok) return false;
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = 'axbot-otomasyon.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

function KuralDuzenleyici({ kural, degistir, sil, pano, kurallar, kuyruklar }: { kural: Kural; degistir: (k: Kural) => void; sil: () => void; pano: Array<{ id: string; ad: string }>; kurallar: Secenek[]; kuyruklar: Kuyruk[] }) {
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
          <Buton ton="ikincil" ikon={<Download className="h-3.5 w-3.5" />} title="Kuralı (çağırdığı kurallar, kuyruğu ve sesleriyle) dosyaya indir" onClick={() => void paketIndir(kural.id).then((ok) => ok || toast('Dışa aktarılamadı: kural kaydedilmiş olmalı', 'hata'))}>
            Dışa aktar
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
          <Anahtar acik={kural.sira === true} onChange={(v) => yama({ sira: v })} />
          Sıraya al
        </label>
        {kuyruklar.length ? (
          <Secim
            aria-label="Eylem kuyruğu"
            title="Aynı kuyruktaki kuralların eylemleri üst üste binmez"
            className="w-48"
            value={kural.kuyruk || ''}
            onChange={(e) => yama({ kuyruk: e.target.value })}
            secenekler={[{ value: '', label: 'Kuyruk yok' }, ...kuyruklar.map((q) => ({ value: q.ad, label: `Kuyruk: ${q.ad}` }))]}
          />
        ) : null}
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
      <EylemListesi eylemler={kural.eylemler} degistir={(l) => yama({ eylemler: l })} pano={pano} kurallar={kurallar.filter((k) => k.value !== kural.id)} derinlik={0} onEk="" />

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
  const [veri, setVeri] = useState<Veri | null>(null);
  const kurallar = veri?.kurallar ?? null;
  const kuyruklar = veri?.kuyruklar ?? [];
  const dosya = useRef<HTMLInputElement>(null);
  const [gunluk, setGunluk] = useState<Gunluk[]>([]);
  const [pano, setPano] = useState<Array<{ id: string; ad: string }>>([]);
  const [eksik, setEksik] = useState<string | null>(null);
  const kaydet = async () => {
    const r = await fetch('/api/otomasyon', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    // Yarım kural (400) hata sayılmaz: eksik yazılır, tamamlanınca kendiliğinden kaydedilir
    setEksik(r?.status === 400 ? d?.error || 'Kural eksik' : null);
    if (!r?.ok && r?.status !== 400) toast(d?.error || 'Kaydedilemedi', 'hata');
    return !!r?.ok;
  };
  // A4: değişiklik kısa beklemeden sonra kendiliğinden kaydedilir, Ctrl+Z geri alır
  const kayit = useOtoKayit(veri, kaydet, setVeri);
  const kayitTaban = kayit.taban;

  useEffect(() => {
    const oku = (ilk: boolean) =>
      fetch('/api/otomasyon')
        .then((r) => r.json())
        .then((d) => {
          setGunluk(d.gunluk || []);
          if (!ilk) return;
          const v = { kurallar: d.kurallar || [], kuyruklar: d.kuyruklar || [] };
          setVeri(v);
          kayitTaban(v);
        })
        .catch(() => {
          // Okunamadıysa taban kurulmaz: boş liste gerçek kuralların üzerine kaydedilmesin
          if (ilk) setVeri({ kurallar: [], kuyruklar: [] });
        });
    void oku(true);
    fetch('/api/pano')
      .then((r) => r.json())
      .then((d) => setPano(d.ogeler || []))
      .catch(() => {});
    const t = setInterval(() => void oku(false), 5000);
    return () => clearInterval(t);
  }, [kayitTaban]);

  const guncelle = (l: Kural[]) => setVeri({ kurallar: l, kuyruklar });
  const kuyrukYaz = (l: Kuyruk[], eskiAd?: string, yeniAd = '') =>
    setVeri({
      kuyruklar: l,
      // Kuyruğun adı değişir ya da silinirse ona bağlı kurallar da izler
      kurallar: (kurallar || []).map((k) => (eskiAd !== undefined && k.kuyruk === eskiAd ? { ...k, kuyruk: yeniAd } : k)),
    });
  const kuralSecenekleri = (kurallar || []).map((k) => ({ value: k.id, label: k.ad || 'Adsız kural' }));

  const iceAl = async (f: File) => {
    let paket: unknown;
    try {
      paket = JSON.parse(await f.text());
    } catch {
      return toast('Dosya okunamadı: JSON değil', 'hata');
    }
    const r = await fetch('/api/otomasyon/ice-aktar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(paket) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    if (!r?.ok) return toast(d?.error || 'İçe aktarılamadı', 'hata');
    const yeniVeri = await fetch('/api/otomasyon').then((x) => x.json()).catch(() => null);
    if (yeniVeri) {
      const v = { kurallar: yeniVeri.kurallar || [], kuyruklar: yeniVeri.kuyruklar || [] };
      setVeri(v);
      kayitTaban(v);
    }
    const ek = [d.pano?.eklenen ? `${d.pano.eklenen} ses` : '', d.kuyruklar ? `${d.kuyruklar} kuyruk` : ''].filter(Boolean).join(', ');
    toast(`${d.kurallar} kural içe alındı${ek ? ` (${ek})` : ''}${d.uyarilar?.length ? ` · ${d.uyarilar.join(' ')}` : ''}`, d.uyarilar?.length ? 'uyari' : 'basari');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-white">
            <Workflow className="h-6 w-6 text-purple-400" /> Otomasyon
          </h1>
          <p className="text-sm text-gray-400">
            Bir olay olunca botun ne yapacağını kur. Metinlerde <code className="text-purple-400">{'{kullanici} {miktar} {mesaj} {odul} {platform}'}</code> kullanılabilir; HTTP isteğinden sonraki adımlarda <code className="text-purple-400">{'{yanit}'}</code> yanıtın ilk 300 karakteridir; sahne adına <code className="text-purple-400">{'{onceki_sahne}'}</code> yazılırsa kuraldan önceki sahneye dönülür. OBS eylemleri için AxthrowA Studio açık olmalı.
          </p>
        </div>
        <div className="flex gap-2">
          <Buton ton="ikincil" ikon={<Plus className="h-3.5 w-3.5" />} onClick={() => guncelle([...(kurallar || []), yeniKural()])}>
            Yeni kural
          </Buton>
          <Buton ton="ikincil" ikon={<Upload className="h-3.5 w-3.5" />} onClick={() => dosya.current?.click()}>
            İçe aktar
          </Buton>
          <Buton ton="ikincil" ikon={<Download className="h-3.5 w-3.5" />} disabled={!kurallar?.length} onClick={() => void paketIndir().then((ok) => ok || toast('Dışa aktarılamadı', 'hata'))}>
            Tümünü dışa aktar
          </Buton>
          <input
            ref={dosya}
            type="file"
            accept=".json,application/json"
            className="hidden"
            aria-label="Otomasyon paketi seç"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void iceAl(f);
            }}
          />
          {eksik && kayit.durum === 'hata' ? (
            <span role="status" className="self-center text-xs text-amber-300">
              Tamamlanınca kaydedilecek: {eksik}
            </span>
          ) : (
            <KayitDurumu durum={kayit.durum} onYeniden={kayit.yeniden} />
          )}
        </div>
      </div>

      {kurallar && !kurallar.length ? <BosDurum baslik="Henüz kural yok" aciklama="Örneğin: !hype yazılınca sahneyi değiştir, ses çal, sohbete yaz." /> : null}
      {(kurallar || []).map((k) => (
        <KuralDuzenleyici
          key={k.id}
          kural={k}
          pano={pano}
          kurallar={kuralSecenekleri}
          kuyruklar={kuyruklar}
          degistir={(d) => guncelle((kurallar || []).map((x) => (x.id === k.id ? d : x)))}
          sil={() => guncelle((kurallar || []).filter((x) => x.id !== k.id))}
        />
      ))}

      <Kart baslik="Eylem kuyrukları" aciklama="Aynı kuyruktaki kuralların eylemleri üst üste binmez: sırayla (aynı anda 1) ya da en çok seçilen sayıda birlikte çalışır. Bekleyen sınırı dolunca yeni olay atılır.">
        {kuyruklar.map((q, i) => {
          const yaz = (d: Partial<Kuyruk>) => kuyrukYaz(kuyruklar.map((x, j) => (j === i ? { ...x, ...d } : x)), d.ad !== undefined ? q.ad : undefined, d.ad);
          return (
            <div key={i} className={satirSinif}>
              <Girdi aria-label="Kuyruk adı" className="min-w-40 flex-1" value={q.ad} maxLength={40} onChange={(e) => yaz({ ad: e.target.value })} />
              <label className="flex items-center gap-2 text-xs text-gray-300">
                Aynı anda
                <Girdi type="number" min={1} max={10} className="w-20" value={q.ayniAnda} onChange={(e) => yaz({ ayniAnda: Number(e.target.value) })} />
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-300">
                En çok bekleyen
                <Girdi type="number" min={1} max={100} className="w-20" value={q.enCokBekleyen} onChange={(e) => yaz({ enCokBekleyen: Number(e.target.value) })} />
              </label>
              <button type="button" className={ikonTus} aria-label={`${q.ad} kuyruğunu sil`} onClick={() => kuyrukYaz(kuyruklar.filter((_, j) => j !== i), q.ad, '')}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
        <Buton ton="ikincil" ikon={<Plus className="h-3.5 w-3.5" />} onClick={() => kuyrukYaz([...kuyruklar, { ad: `Kuyruk ${kuyruklar.length + 1}`, ayniAnda: 1, enCokBekleyen: 20 }])}>
          Kuyruk ekle
        </Buton>
      </Kart>

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
