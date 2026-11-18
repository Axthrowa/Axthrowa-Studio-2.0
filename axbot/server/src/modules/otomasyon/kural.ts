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
  | { tur: 'patlama'; mesaj: number; saniye: number }
  // Y12: Studio'nun bağlantı koruması bildirir (bit hızı eşiğin altında / OBS yeniden bağlanıyor, ve düzelme)
  | { tur: 'bit_hizi_dustu' }
  | { tur: 'baglanti_duzeldi' }
  | { tur: 'kare_dususu'; enAz: number }
  // Y7: Studio Twitch reklam takviminden bildirir
  | { tur: 'reklam_yaklasiyor' }
  | { tur: 'reklam_basliyor' }
  | { tur: 'reklam_bitti' }
  // Y8: Twitch izleme serisi ve power-up
  | { tur: 'izleme_serisi'; enAz: number }
  | { tur: 'power_up'; guc: string };

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
  | { tur: 'bekle'; saniye: number }
  // BOT-1 eylem kitaplığı
  | { tur: 'obs_filtre'; kaynak: string; filtre: string; durum: 'ac' | 'kapat' | 'degistir' }
  | { tur: 'obs_kaynak'; sahne: string; kaynak: string; durum: 'goster' | 'gizle' | 'degistir' }
  | { tur: 'obs_donusum'; sahne: string; kaynak: string; x: number | null; y: number | null; olcek: number | null; aci: number | null }
  | { tur: 'http'; yontem: 'GET' | 'POST'; adres: string; govde: string }
  | { tur: 'degisken'; hedef: 'sayac' | 'kanal'; ad: string; islem: 'ayarla' | 'ekle'; deger: string }
  | { tur: 'rastgele_dal'; yuzde: number; evet: Eylem[]; hayir: Eylem[] }
  | { tur: 'kural_calistir'; kuralId: string };

/** BOT-1: adlı eylem kuyruğu. Aynı kuyruktaki kuralların eylemleri en çok `ayniAnda` tanesi birlikte çalışır (1 = sıralı) */
export interface Kuyruk {
  ad: string;
  ayniAnda: number;
  /** Sırada bekleyebilecek iş; dolunca yeni olay atılır */
  enCokBekleyen: number;
}

export interface Kural {
  id: string;
  ad: string;
  etkin: boolean;
  beklemeSn: number;
  /** B7: eylemler sırayla mı, yoksa her seferinde rastgele biri mi */
  kip: 'sirali' | 'rastgele';
  /** B7: bekleme ya da çalışma sırasında gelen olaylar atılmaz, sıraya girer (en çok EN_COK_SIRA) */
  sira: boolean;
  /** BOT-1: adlı kuyruk (boş = kuyruksuz, kurallar birbirini beklemez) */
  kuyruk: string;
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
export const EN_COK_EYLEM = 20;
/** Dallar dahil bir kuraldaki toplam eylem ve dal derinliği */
export const EN_COK_TOPLAM_EYLEM = 60;
export const EN_COK_DAL_DERINLIGI = 3;
export const EN_COK_KUYRUK = 20;
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
    case 'bit_hizi_dustu':
    case 'baglanti_duzeldi':
    case 'reklam_yaklasiyor':
    case 'reklam_basliyor':
    case 'reklam_bitti':
      return { tur: t.tur };
    case 'kare_dususu':
      return { tur: 'kare_dususu', enAz: sayi(t.enAz, 1, 100) };
    case 'izleme_serisi':
      return { tur: 'izleme_serisi', enAz: sayi(t.enAz, 0, 1000) };
    case 'power_up':
      return { tur: 'power_up', guc: yazi(t.guc, 60) };
    default:
      return null;
  }
}

function kosulDuzelt(k: any): Kosul | null {
  if (k?.tur === 'mod' || k?.tur === 'abone' || k?.tur === 'canli') return { tur: k.tur };
  if (k?.tur === 'en_az_puan') return { tur: 'en_az_puan', puan: sayi(k.puan, 0, 1_000_000_000) };
  return null;
}

const KUYRUK_ADI = /^[\p{L}\p{N} _-]{1,40}$/u;
const kuyrukAdi = (v: unknown): string => {
  const a = yazi(v, 40);
  return KUYRUK_ADI.test(a) ? a : '';
};

export function kuyrukDuzelt(k: any): Kuyruk | null {
  const ad = kuyrukAdi(k?.ad);
  if (!ad) return null;
  return { ad, ayniAnda: sayi(k?.ayniAnda ?? 1, 1, 10), enCokBekleyen: sayi(k?.enCokBekleyen ?? 20, 1, 100) };
}

/** İsteğe bağlı sayı alanı: boş/yok → null */
const secimliSayi = (v: unknown, en: number, cok: number): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(cok, Math.max(en, n)) : null;
};

/**
 * HTTP eylemi adresi: yalnız http/https; izleyici değeri ({mesaj}…) şema ve sunucu kısmına giremez,
 * yoksa sohbetten istek başka sunucuya yönlendirilebilirdi.
 */
export function httpAdresiGecerli(adres: string): boolean {
  const m = adres.match(/^(https?):\/\/([^/?#]+)/i);
  if (!m || /[{}]/.test(m[0])) return false;
  try {
    new URL(adres.replace(/\{[a-z_:]+\}/gi, 'x'));
    return true;
  } catch {
    return false;
  }
}

/** Dallardaki eylemler de sayılır: `sayac.n` toplam */
function eylemListesi(ham: unknown, derinlik: number, sayac: { n: number }): Eylem[] | null {
  if (!Array.isArray(ham) || ham.length > EN_COK_EYLEM) return null;
  const l = ham.map((e) => eylemDuzelt(e, derinlik, sayac));
  return l.includes(null) ? null : (l as Eylem[]);
}

function eylemDuzelt(e: any, derinlik = 0, sayac = { n: 0 }): Eylem | null {
  if (++sayac.n > EN_COK_TOPLAM_EYLEM) return null;
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
    case 'obs_filtre': {
      const kaynak = yazi(e.kaynak, 120), filtre = yazi(e.filtre, 120);
      const durum = e.durum === 'kapat' || e.durum === 'degistir' ? e.durum : 'ac';
      return kaynak && filtre ? { tur: 'obs_filtre', kaynak, filtre, durum } : null;
    }
    case 'obs_kaynak': {
      const kaynak = yazi(e.kaynak, 120);
      const durum = e.durum === 'gizle' || e.durum === 'degistir' ? e.durum : 'goster';
      return kaynak ? { tur: 'obs_kaynak', sahne: yazi(e.sahne, 120), kaynak, durum } : null;
    }
    case 'obs_donusum': {
      const kaynak = yazi(e.kaynak, 120);
      const r = { x: secimliSayi(e.x, -20_000, 20_000), y: secimliSayi(e.y, -20_000, 20_000), olcek: secimliSayi(e.olcek, 0.01, 20), aci: secimliSayi(e.aci, -360, 360) };
      if (!kaynak || Object.values(r).every((v) => v === null)) return null;
      return { tur: 'obs_donusum', sahne: yazi(e.sahne, 120), kaynak, ...r };
    }
    case 'http': {
      const adres = yazi(e.adres, 500);
      if (!httpAdresiGecerli(adres)) return null;
      return { tur: 'http', yontem: e.yontem === 'POST' ? 'POST' : 'GET', adres, govde: e.yontem === 'POST' ? yazi(e.govde, 2000) : '' };
    }
    case 'degisken': {
      const ad = yazi(e.ad, 40).toLocaleLowerCase('tr');
      if (!/^[\p{L}\p{N}_-]+$/u.test(ad)) return null;
      const hedef = e.hedef === 'kanal' ? 'kanal' : 'sayac';
      // Kanal değişkeni metindir: "ekle" yalnız sayaçta
      const islem = hedef === 'sayac' && e.islem === 'ekle' ? 'ekle' : 'ayarla';
      return { tur: 'degisken', hedef, ad, islem, deger: yazi(e.deger, 200) };
    }
    case 'rastgele_dal': {
      if (derinlik + 1 >= EN_COK_DAL_DERINLIGI) return null;
      const evet = eylemListesi(e.evet ?? [], derinlik + 1, sayac);
      const hayir = eylemListesi(e.hayir ?? [], derinlik + 1, sayac);
      if (!evet || !hayir || evet.length + hayir.length === 0) return null;
      return { tur: 'rastgele_dal', yuzde: sayi(e.yuzde ?? 50, 0, 100), evet, hayir };
    }
    case 'kural_calistir':
      return yazi(e.kuralId, 60) ? { tur: 'kural_calistir', kuralId: yazi(e.kuralId, 60) } : null;
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
  const sayac = { n: 0 };
  const eylemler = hamEylem.map((e: any) => eylemDuzelt(e, 0, sayac));
  if (sayac.n > EN_COK_TOPLAM_EYLEM) return { ok: false, hata: `${ad}: dallarla birlikte en çok ${EN_COK_TOPLAM_EYLEM} eylem olabilir` };
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
      kuyruk: kuyrukAdi(ham?.kuyruk),
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
    case 'kare_dususu':
    case 'izleme_serisi':
      return (Number(o.miktar) || 0) >= t.enAz;
    case 'power_up':
      return !t.guc || String(o.odul ?? '').toLocaleLowerCase('tr') === t.guc.toLocaleLowerCase('tr');
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
export function metniDoldur(sablon: string, o: Olay, ek: { yanit?: string; kodla?: (v: string) => string } = {}): string {
  const degerler: Record<string, unknown> = { kullanici: o.kullanici, miktar: o.miktar, mesaj: o.mesaj, odul: o.odul, platform: o.platform, yanit: ek.yanit };
  const kodla = ek.kodla ?? ((v: string) => v);
  return sablon.replace(/\{(kullanici|miktar|mesaj|odul|platform|yanit)\}/g, (_, a: string) => kodla(temizDeger(degerler[a])));
}

/** HTTP eylemi: adrese giren değer URL kodlanır, JSON gövdeye giren dize kaçışlanır */
export const urlKodla = (v: string) => encodeURIComponent(v);
export const jsonKodla = (v: string) => JSON.stringify(v).slice(1, -1);

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
    case 'obs_filtre':
      return `OBS filtresi ${{ ac: 'aç', kapat: 'kapat', degistir: 'aç/kapat' }[e.durum]}: ${e.kaynak} › ${e.filtre}`;
    case 'obs_kaynak':
      return `OBS kaynağı ${{ goster: 'göster', gizle: 'gizle', degistir: 'göster/gizle' }[e.durum]}: ${e.sahne ? `${e.sahne} › ` : ''}${e.kaynak}`;
    case 'obs_donusum': {
      const p = [e.x !== null || e.y !== null ? `konum ${e.x ?? '–'}, ${e.y ?? '–'}` : '', e.olcek !== null ? `ölçek ${e.olcek}` : '', e.aci !== null ? `açı ${e.aci}°` : ''].filter(Boolean);
      return `OBS kaynağını dönüştür: ${e.kaynak} (${p.join(', ')})`;
    }
    case 'http':
      return `HTTP ${e.yontem}: ${metniDoldur(e.adres, o, { kodla: urlKodla })}`;
    case 'degisken':
      return `${e.hedef === 'sayac' ? 'Sayaç' : 'Kanal değişkeni'} ${e.ad} ${e.islem === 'ekle' ? '+=' : '='} ${metniDoldur(e.deger, o)}`;
    case 'rastgele_dal':
      return `%${e.yuzde} olasılıkla ${e.evet.length} eylem, yoksa ${e.hayir.length} eylem`;
    case 'kural_calistir':
      return `Başka kuralı çalıştır: ${e.kuralId}`;
  }
}

/** Kuralın (dallar dahil) bütün eylemleri: dışa aktarmada başvurular, doğrulamada sayım */
export function tumEylemler(eylemler: Eylem[]): Eylem[] {
  return eylemler.flatMap((e) => (e.tur === 'rastgele_dal' ? [e, ...tumEylemler(e.evet), ...tumEylemler(e.hayir)] : [e]));
}
