/**
 * Otomasyon kuralları: tetikleyici → koşullar → eylemler. Saf: doğrulama, eşleşme, şablon, açıklama.
 * Kurallar panelden JSON gelir; `kuralDuzelt` bu sınırda her alanı doğrular.
 */

export type Tetik =
  | { tur: 'komut'; komut: string }
  | { tur: 'takip' }
  | { tur: 'abone' }
  | { tur: 'bagis'; enAz: number }
  | { tur: 'baskin'; enAz: number }
  | { tur: 'odul'; odul: string }
  | { tur: 'sure'; dakika: number }
  | { tur: 'patlama'; mesaj: number; saniye: number };

export type Kosul = { tur: 'mod' } | { tur: 'abone' } | { tur: 'canli' } | { tur: 'en_az_puan'; puan: number };

export type Eylem =
  | { tur: 'sohbet'; metin: string }
  | { tur: 'tts'; metin: string }
  | { tur: 'komut'; metin: string }
  | { tur: 'pano_oynat'; ogeId: string }
  | { tur: 'shoutout'; kanal: string }
  | { tur: 'obs_sahne'; sahne: string }
  | { tur: 'replay' }
  | { tur: 'klip'; saniye: number }
  | { tur: 'sarki_atla' }
  | { tur: 'sohbet_temizle' }
  | { tur: 'kalkan'; durum: 'ac' | 'kapat' }
  | { tur: 'discord'; metin: string }
  | { tur: 'bekle'; saniye: number };

export interface Kural {
  id: string;
  ad: string;
  etkin: boolean;
  beklemeSn: number;
  /** B7: eylemler sırayla mı, yoksa her seferinde rastgele biri mi */
  kip: 'sirali' | 'rastgele';
  /** B7: bekleme ya da çalışma sırasında gelen olaylar atılmaz, sıraya girer (en çok EN_COK_SIRA) */
  sira: boolean;
  tetik: Tetik;
  kosullar: Kosul[];
  eylemler: Eylem[];
}

/** Motorun değerlendirdiği olay */
export interface Olay {
  tur: Tetik['tur'];
  platform?: string;
  kullanici?: string;
  mesaj?: string;
  miktar?: number;
  odul?: string;
  mod?: boolean;
  abone?: boolean;
}

export const EN_COK_KURAL = 100;
export const EN_COK_EYLEM = 12;
export const EN_COK_SIRA = 10;
/** Sahne alanına yazılınca kuralın ilk sahne değişiminden önceki sahneye döner */
export const ONCEKI_SAHNE = '{onceki_sahne}';
const EN_COK_METIN = 400;
/** Sohbet patlaması sürer: aynı anı defalarca kliplememek için daha uzun bekleme */
const EN_AZ_BEKLEME: Partial<Record<Tetik['tur'], number>> = { patlama: 30 };
const VARSAYILAN_EN_AZ_BEKLEME = 5;

const sayi = (v: unknown, en: number, cok: number): number => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(cok, Math.max(en, n)) : en;
};
const yazi = (v: unknown, cok = EN_COK_METIN): string => String(v ?? '').trim().slice(0, cok);

function tetikDuzelt(t: any): Tetik | null {
  switch (t?.tur) {
    case 'komut': {
      const komut = yazi(t.komut, 40).replace(/^!+/, '').toLocaleLowerCase('tr');
      return /^[^\s]+$/.test(komut) ? { tur: 'komut', komut } : null;
    }
    case 'takip':
    case 'abone':
      return { tur: t.tur };
    case 'bagis':
    case 'baskin':
      return { tur: t.tur, enAz: sayi(t.enAz, 0, 1_000_000) };
    case 'odul':
      return { tur: 'odul', odul: yazi(t.odul, 100) };
    case 'sure':
      return { tur: 'sure', dakika: sayi(t.dakika, 1, 1440) };
    case 'patlama':
      return { tur: 'patlama', mesaj: sayi(t.mesaj, 5, 1000), saniye: sayi(t.saniye, 3, 120) };
    default:
      return null;
  }
}

function kosulDuzelt(k: any): Kosul | null {
  if (k?.tur === 'mod' || k?.tur === 'abone' || k?.tur === 'canli') return { tur: k.tur };
  if (k?.tur === 'en_az_puan') return { tur: 'en_az_puan', puan: sayi(k.puan, 0, 1_000_000_000) };
  return null;
}

function eylemDuzelt(e: any): Eylem | null {
  const metinli = (tur: 'sohbet' | 'tts' | 'discord' | 'komut'): Eylem | null => {
    const metin = yazi(e.metin);
    return metin ? ({ tur, metin } as Eylem) : null;
  };
  switch (e?.tur) {
    case 'sohbet':
    case 'tts':
    case 'discord':
      return metinli(e.tur);
    case 'komut':
      return yazi(e.metin).startsWith('!') ? metinli('komut') : null;
    case 'pano_oynat':
      return yazi(e.ogeId) ? { tur: 'pano_oynat', ogeId: yazi(e.ogeId, 80) } : null;
    case 'shoutout':
      return yazi(e.kanal) ? { tur: 'shoutout', kanal: yazi(e.kanal, 60) } : null;
    case 'obs_sahne':
      return yazi(e.sahne) ? { tur: 'obs_sahne', sahne: yazi(e.sahne, 120) } : null;
    case 'replay':
    case 'sarki_atla':
    case 'sohbet_temizle':
      return { tur: e.tur };
    case 'klip':
      return { tur: 'klip', saniye: sayi(e.saniye, 5, 120) };
    case 'kalkan':
      return e.durum === 'ac' || e.durum === 'kapat' ? { tur: 'kalkan', durum: e.durum } : null;
    case 'bekle':
      return { tur: 'bekle', saniye: sayi(e.saniye, 1, 60) };
    default:
      return null;
  }
}

/** Panelden gelen kuralı doğrular; geçersizse nedenini döner */
export function kuralDuzelt(ham: any): { ok: true; kural: Kural } | { ok: false; hata: string } {
  const ad = yazi(ham?.ad, 80);
  if (!ad) return { ok: false, hata: 'Kuralın adı boş olamaz' };
  const tetik = tetikDuzelt(ham?.tetik);
  if (!tetik) return { ok: false, hata: `${ad}: tetikleyici geçersiz` };
  const hamKosul = Array.isArray(ham?.kosullar) ? ham.kosullar : [];
  const kosullar = hamKosul.map(kosulDuzelt);
  if (hamKosul.length > 8 || kosullar.includes(null)) return { ok: false, hata: `${ad}: koşul geçersiz` };
  const hamEylem = Array.isArray(ham?.eylemler) ? ham.eylemler : [];
  if (!hamEylem.length) return { ok: false, hata: `${ad}: en az bir eylem gerekli` };
  if (hamEylem.length > EN_COK_EYLEM) return { ok: false, hata: `${ad}: en çok ${EN_COK_EYLEM} eylem olabilir` };
  const eylemler = hamEylem.map(eylemDuzelt);
  const bozuk = eylemler.indexOf(null);
  if (bozuk >= 0) return { ok: false, hata: `${ad}: ${bozuk + 1}. eylem eksik ya da geçersiz` };
  return {
    ok: true,
    kural: {
      id: yazi(ham?.id, 60) || crypto.randomUUID(),
      ad,
      etkin: ham?.etkin !== false,
      beklemeSn: sayi(ham?.beklemeSn, EN_AZ_BEKLEME[tetik.tur] ?? VARSAYILAN_EN_AZ_BEKLEME, 86_400),
      kip: ham?.kip === 'rastgele' ? 'rastgele' : 'sirali',
      sira: ham?.sira === true,
      tetik,
      kosullar: kosullar as Kosul[],
      eylemler: eylemler as Eylem[],
    },
  };
}

/** Olay bu tetikleyiciye uyuyor mu. `sure` ve `patlama` motorda sayılır: tur eşleşmesi yeter. */
export function tetikUyar(t: Tetik, o: Olay): boolean {
  if (t.tur !== o.tur) return false;
  switch (t.tur) {
    case 'komut': {
      const ilk = String(o.mesaj ?? '').trim().split(/\s+/)[0] ?? '';
      return ilk.startsWith('!') && ilk.slice(1).toLocaleLowerCase('tr') === t.komut;
    }
    case 'bagis':
    case 'baskin':
      return (Number(o.miktar) || 0) >= t.enAz;
    case 'odul':
      return !t.odul || String(o.odul ?? '').toLocaleLowerCase('tr') === t.odul.toLocaleLowerCase('tr');
    default:
      return true;
  }
}

/** Sağlanmayan ilk koşulun açıklaması; hepsi sağlanıyorsa null */
export function kosulEngeli(kosullar: Kosul[], o: Olay, d: { puan: number; canli: boolean | null }): string | null {
  for (const k of kosullar) {
    if (k.tur === 'mod' && !o.mod) return 'Kullanıcı moderatör değil';
    if (k.tur === 'abone' && !o.abone) return 'Kullanıcı abone değil';
    if (k.tur === 'canli' && d.canli !== true) return 'Yayın canlı değil';
    if (k.tur === 'en_az_puan' && d.puan < k.puan) return `Puan yetersiz (${d.puan} < ${k.puan})`;
  }
  return null;
}

/** İzleyicinin yazdığı değer komut gibi başlamasın, satır kırmasın */
function temizDeger(v: unknown): string {
  return String(v ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .replace(/^[!/.]+/, '')
    .slice(0, 200);
}

/**
 * `{kullanici} {miktar} {mesaj} {odul} {platform}` alanlarını doldurur. Komut eylemleri bundan geçmez:
 * yayıncı yetkisiyle çalıştıkları için içlerine izleyici metni girmemeli.
 */
export function metniDoldur(sablon: string, o: Olay): string {
  const degerler: Record<string, unknown> = { kullanici: o.kullanici, miktar: o.miktar, mesaj: o.mesaj, odul: o.odul, platform: o.platform };
  return sablon.replace(/\{(kullanici|miktar|mesaj|odul|platform)\}/g, (_, a: string) => temizDeger(degerler[a]));
}

/** Son `saniye` içinde `mesaj` kadar sohbet oldu mu */
export class PatlamaSayaci {
  private zamanlar: number[] = [];
  ekle(simdi: number, mesaj: number, saniye: number): boolean {
    const sinir = simdi - saniye * 1000;
    this.zamanlar = this.zamanlar.filter((z) => z >= sinir);
    this.zamanlar.push(simdi);
    if (this.zamanlar.length < mesaj) return false;
    this.zamanlar = [];
    return true;
  }
}

/** Günlükte ve "dene" sonucunda görünen açıklama */
export function eylemAciklamasi(e: Eylem, o: Olay): string {
  switch (e.tur) {
    case 'sohbet':
      return `Sohbete yaz: ${metniDoldur(e.metin, o)}`;
    case 'tts':
      return `Seslendir: ${metniDoldur(e.metin, o)}`;
    case 'komut':
      return `Komutu çalıştır: ${e.metin}`;
    case 'pano_oynat':
      return 'Ses panosundan çal';
    case 'shoutout':
      return `Shoutout kartı: ${metniDoldur(e.kanal, o)}`;
    case 'obs_sahne':
      return e.sahne.trim() === ONCEKI_SAHNE ? 'OBS: kuraldan önceki sahneye dön' : `OBS sahnesine geç: ${metniDoldur(e.sahne, o)}`;
    case 'replay':
      return 'OBS tekrar arabelleğini kaydet';
    case 'klip':
      return `Klip al (${e.saniye} sn)`;
    case 'sarki_atla':
      return 'Şarkıyı atla';
    case 'sohbet_temizle':
      return 'OBS sohbetini temizle';
    case 'kalkan':
      return e.durum === 'ac' ? 'Kalkan modunu aç' : 'Kalkan modunu kapat';
    case 'discord':
      return `Discord'a yaz: ${metniDoldur(e.metin, o)}`;
    case 'bekle':
      return `${e.saniye} sn bekle`;
  }
}
