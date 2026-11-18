/**
 * BOT-1: otomasyon kuralını dosya olarak dışa / içe aktarma.
 * Paket, kuralın çağırdığı kuralları, kullandığı kuyrukları, ses panosu öğelerini ve onların medyasını taşır;
 * böylece temiz kurulumda içe alınan kural eksiksiz çalışır.
 */
import crypto from 'node:crypto';
import { gomuluMedyaYukle, medyaGom, type GomuluMedya } from '../alerts/backup.js';
import { sesPanosu } from '../pano/pano.js';
import { EN_COK_KURAL, tumEylemler, type Eylem, type Kural, type Kuyruk } from './kural.js';
import { otomasyon } from './otomasyon.js';

export const PAKET_TURU = 'axbot-otomasyon';
export const PAKET_SURUMU = 1;

/** Panodan yalnız yeniden kurmaya yetenler; kova ve sıra bu kurulumda yok sayılır */
const PANO_ALANLARI = ['id', 'ad', 'komut', 'medyaId', 'tur', 'gorselId', 'ses', 'maksSureSn', 'maliyet', 'beklemeSn', 'kullaniciBeklemeSn', 'yetki', 'agirlik', 'etkin'] as const;

export interface OtomasyonPaketi {
  tur: typeof PAKET_TURU;
  surum: number;
  kurallar: Kural[];
  kuyruklar: Kuyruk[];
  pano: Record<string, unknown>[];
  medya: GomuluMedya[];
}

export interface IceAlmaSonucu {
  ok: boolean;
  hata?: string;
  kurallar: number;
  kuyruklar: number;
  pano: { eklenen: number; zatenVardi: number };
  medya: { eklenen: number; zatenVardi: number; atlanan: number };
  uyarilar: string[];
}

/** Seçilen kurallar (boş = hepsi) ve çağırdıkları kurallar, iç içe */
export function disaAktar(kimlikler: string[] = []): OtomasyonPaketi {
  const hepsi = otomasyon.kurallar();
  const secilen = new Map<string, Kural>();
  const ekle = (k: Kural | undefined) => {
    if (!k || secilen.has(k.id)) return;
    secilen.set(k.id, k);
    for (const e of tumEylemler(k.eylemler)) if (e.tur === 'kural_calistir') ekle(hepsi.find((x) => x.id === e.kuralId));
  };
  for (const k of kimlikler.length ? hepsi.filter((x) => kimlikler.includes(x.id)) : hepsi) ekle(k);
  const kurallar = [...secilen.values()];
  const kuyrukAdlari = new Set(kurallar.map((k) => k.kuyruk).filter(Boolean));
  const ogeIdleri = new Set(kurallar.flatMap((k) => tumEylemler(k.eylemler)).flatMap((e) => (e.tur === 'pano_oynat' ? [e.ogeId] : [])));
  const pano = sesPanosu.ogeler().filter((o) => ogeIdleri.has(o.id));
  const { gomulu } = medyaGom(new Set(pano.flatMap((o) => [o.medyaId, o.gorselId ?? ''].filter(Boolean))));
  return {
    tur: PAKET_TURU,
    surum: PAKET_SURUMU,
    kurallar,
    kuyruklar: otomasyon.kuyruklar().filter((q) => kuyrukAdlari.has(q.ad)),
    pano: pano.map((o) => Object.fromEntries(PANO_ALANLARI.map((a) => [a, (o as any)[a]]))),
    medya: gomulu
  };
}

/** Dallar dahil eylemlerdeki kural ve pano başvurularını yeni kimliklere çevirir */
function eylemleriCevir(eylemler: Eylem[], kural: Map<string, string>, oge: Map<string, string>): Eylem[] {
  return eylemler.map((e) => {
    if (e.tur === 'kural_calistir') return { ...e, kuralId: kural.get(e.kuralId) ?? e.kuralId };
    if (e.tur === 'pano_oynat') return { ...e, ogeId: oge.get(e.ogeId) ?? e.ogeId };
    if (e.tur === 'rastgele_dal') return { ...e, evet: eylemleriCevir(e.evet, kural, oge), hayir: eylemleriCevir(e.hayir, kural, oge) };
    return e;
  });
}

/**
 * Paketteki kurallar mevcutların SONUNA yeni kimlikle eklenir (üzerine yazılmaz); eksik kuyruk adla açılır,
 * medya içerikçe aynıysa yeniden yazılmaz, pano öğesi aynı komutla varsa o kullanılır.
 * Kurallar bütün olarak doğrulanır: biri bozuksa hiçbiri eklenmez (medya ve pano öğesi kalır, zararsız).
 */
export function iceAktar(veri: any): IceAlmaSonucu {
  const sonuc: IceAlmaSonucu = { ok: false, kurallar: 0, kuyruklar: 0, pano: { eklenen: 0, zatenVardi: 0 }, medya: { eklenen: 0, zatenVardi: 0, atlanan: 0 }, uyarilar: [] };
  if (veri?.tur !== PAKET_TURU || !Array.isArray(veri?.kurallar)) return { ...sonuc, hata: 'Bu dosya bir AxBoT otomasyon paketi değil' };
  if (Number(veri.surum) > PAKET_SURUMU) return { ...sonuc, hata: 'Paket daha yeni bir AxBoT sürümünden; önce AxBoT’u güncelleyin' };
  const mevcut = otomasyon.kurallar();
  if (mevcut.length + veri.kurallar.length > EN_COK_KURAL) return { ...sonuc, hata: `En çok ${EN_COK_KURAL} kural olabilir` };

  const medyaHaritasi = gomuluMedyaYukle(Array.isArray(veri.medya) ? veri.medya : [], sonuc);
  const ogeHaritasi = new Map<string, string>();
  const panoOgeleri = sesPanosu.ogeler();
  for (const p of Array.isArray(veri.pano) ? veri.pano : []) {
    const eskiId = String(p?.id ?? '');
    const ayni = panoOgeleri.find((o) => o.komut === String(p?.komut ?? '').toLocaleLowerCase('tr'));
    if (ayni) {
      ogeHaritasi.set(eskiId, ayni.id);
      sonuc.pano.zatenVardi++;
      continue;
    }
    const cevir = (id: unknown) => (id ? medyaHaritasi.get(String(id)) ?? String(id) : null);
    const r = sesPanosu.ogeYaz({ ...p, id: undefined, kovaId: null, medyaId: cevir(p?.medyaId), gorselId: cevir(p?.gorselId) });
    if (r.ok) {
      ogeHaritasi.set(eskiId, r.oge.id);
      sonuc.pano.eklenen++;
    } else sonuc.uyarilar.push(`Ses panosu öğesi "${String(p?.ad ?? eskiId).slice(0, 60)}" kurulamadı: ${r.hata}`);
  }

  const kuyruklar = [...otomasyon.kuyruklar()];
  const kuyrukAdi = new Map<string, string>();
  for (const q of Array.isArray(veri.kuyruklar) ? veri.kuyruklar : []) {
    const ad = String(q?.ad ?? '');
    const var_ = kuyruklar.find((x) => x.ad.toLocaleLowerCase('tr') === ad.toLocaleLowerCase('tr'));
    if (var_) kuyrukAdi.set(ad, var_.ad);
    else {
      kuyruklar.push(q);
      kuyrukAdi.set(ad, ad);
      sonuc.kuyruklar++;
    }
  }

  const kuralHaritasi = new Map<string, string>(veri.kurallar.map((k: any) => [String(k?.id ?? ''), crypto.randomUUID()]));
  const yeni = veri.kurallar.map((k: any) => ({
    ...k,
    id: kuralHaritasi.get(String(k?.id ?? '')),
    kuyruk: k?.kuyruk ? kuyrukAdi.get(String(k.kuyruk)) ?? k.kuyruk : '',
    eylemler: Array.isArray(k?.eylemler) ? eylemleriCevir(k.eylemler, kuralHaritasi, ogeHaritasi) : k?.eylemler
  }));
  const r = otomasyon.kaydet([...mevcut, ...yeni], kuyruklar);
  if (!r.ok) return { ...sonuc, kuyruklar: 0, hata: r.hata };
  return { ...sonuc, ok: true, kurallar: yeni.length };
}
