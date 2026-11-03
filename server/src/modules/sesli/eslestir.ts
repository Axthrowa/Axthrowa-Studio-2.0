/**
 * AxBoT — Sesli komutlar: saf eşleştirme mantığı (birim testli, DB açmaz)
 * Developed by AxthrowA
 *
 * Konuşma tanıma (Vosk, tarayıcıda yerel) cümleyi metne çevirir; burada o metin yayıncının tanımladığı
 * ifadelerle ve dinamik kalıplarla ("<ses adı> çal", "<widget> aç") karşılaştırılır. Tanıyıcı hata yapar
 * ("çekilişi" → "çekiliş i"), bu yüzden tam eşitlik değil, Türkçe karakterleri katlayan bulanık benzerlik kullanılır.
 */

export type PanoEylemi = 'atla' | 'duraklat' | 'devam' | 'temizle';
export type AcKapat = 'ac' | 'kapat' | 'degistir';

/** Sesle tetiklenebilecek eylemler */
export type SesliEylem =
  | { tur: 'komut'; metin: string } // bot komutunu yayıncı adına çalıştırır, yanıt sohbete gider
  | { tur: 'sohbet'; metin: string } // sohbete mesaj yazar
  | { tur: 'tts'; metin: string } // seslendirir
  | { tur: 'pano_oynat'; ogeId: string }
  | { tur: 'pano_kontrol'; eylem: PanoEylemi }
  | { tur: 'overlay'; widget: string; durum: AcKapat }
  | { tur: 'widget_test'; widget: string }
  | { tur: 'uyari_test'; olay: string }
  | { tur: 'sarki_atla' }
  | { tur: 'sohbet_temizle' }
  | { tur: 'kalkan'; durum: 'ac' | 'kapat' };

export interface SesliKomut {
  id: string;
  ad: string;
  /** Söylenecek ifadeler (biri yeter) */
  ifadeler: string[];
  eylem: SesliEylem;
  etkin: boolean;
}

export type DinlemeKipi = 'uyandirma' | 'bas_konus' | 'ikisi';

export interface SesliAyarlar {
  etkin: boolean;
  kip: DinlemeKipi;
  /** Uyandırma sözcüğü ("bot, çekilişi başlat") */
  uyandirma: string;
  /** 0..1 — bunun altındaki benzerlikler eşleşme sayılmaz */
  esik: number;
  /** "<ses adı> çal" ile panodan çalma */
  dinamikPano: boolean;
  /** "<widget> aç/kapat" ile Overlay Studio widget'ları */
  dinamikOverlay: boolean;
  /**
   * Tanıma yalnız komut ifadeleriyle sınırlı mı (Vosk dilbilgisi). Küçük Türkçe modelde isabeti belirgin artırır;
   * kapatılırsa serbest konuşma tanınır (yeni eklenen bot komutları için ifade tanımlamak gerekmez ama daha çok hata).
   */
  kisitli: boolean;
  /** Komut eylemi hangi platform adına çalışsın / yanıt nereye gitsin */
  platform: 'kick' | 'twitch' | 'youtube' | 'tiktok' | 'trovo' | 'discord';
  /** Seçili mikrofon (tarayıcı aygıt kimliği; boş = varsayılan) */
  mikrofon: string;
}

export const VARSAYILAN_AYARLAR: SesliAyarlar = {
  etkin: false,
  kip: 'ikisi',
  uyandirma: 'bot',
  esik: 0.78,
  dinamikPano: true,
  dinamikOverlay: true,
  kisitli: true,
  platform: 'kick',
  mikrofon: ''
};

const PLATFORMLAR = ['kick', 'twitch', 'youtube', 'tiktok', 'trovo', 'discord'] as const;

export function ayarlariDuzelt(g: any): SesliAyarlar {
  const a = { ...VARSAYILAN_AYARLAR, ...(g && typeof g === 'object' ? g : {}) };
  return {
    etkin: !!a.etkin,
    kip: (['uyandirma', 'bas_konus', 'ikisi'] as const).includes(a.kip) ? a.kip : VARSAYILAN_AYARLAR.kip,
    uyandirma: String(a.uyandirma ?? '').trim().slice(0, 30) || VARSAYILAN_AYARLAR.uyandirma,
    esik: Math.min(0.98, Math.max(0.5, Number(a.esik) || VARSAYILAN_AYARLAR.esik)),
    dinamikPano: a.dinamikPano !== false,
    dinamikOverlay: a.dinamikOverlay !== false,
    kisitli: a.kisitli !== false,
    platform: (PLATFORMLAR as readonly string[]).includes(a.platform) ? a.platform : VARSAYILAN_AYARLAR.platform,
    mikrofon: String(a.mikrofon ?? '').slice(0, 200)
  };
}

/** Küçük harf (Türkçe), Türkçe karakterleri ASCII'ye katla, noktalamayı at, boşlukları sadeleştir */
export function normalize(s: string): string {
  return String(s ?? '')
    .toLocaleLowerCase('tr-TR')
    .replace(/[çc]/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/[ıi̇]/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
    .replace(/[âà]/g, 'a')
    .replace(/[îì]/g, 'i')
    .replace(/[ûù]/g, 'u')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Levenshtein uzaklığı */
export function uzaklik(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let onceki = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const simdi = [i];
    for (let j = 1; j <= b.length; j++) {
      simdi[j] = Math.min(onceki[j] + 1, simdi[j - 1] + 1, onceki[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    onceki = simdi;
  }
  return onceki[b.length];
}

/** 0..1 benzerlik (normalize edilmiş dizgeler) */
export function benzerlik(a: string, b: string): number {
  const en = Math.max(a.length, b.length);
  return en === 0 ? 1 : 1 - uzaklik(a, b) / en;
}

/**
 * İfadenin metinde geçme puanı: ifade kadar sözcükten oluşan her pencere (±1 sözcük) ifadeyle karşılaştırılır,
 * en iyisi döner. Böylece "bot lütfen sohbeti temizle" içinde "sohbeti temizle" bulunur.
 */
export function ifadePuani(metin: string, ifade: string): number {
  const m = normalize(metin);
  const i = normalize(ifade);
  if (!m || !i) return 0;
  if (m === i) return 1;
  if ((' ' + m + ' ').includes(' ' + i + ' ')) return 0.99;
  const ms = m.split(' ');
  const n = i.split(' ').length;
  let en = benzerlik(m, i);
  for (const boy of [n - 1, n, n + 1]) {
    if (boy < 1 || boy > ms.length) continue;
    for (let bas = 0; bas + boy <= ms.length; bas++) {
      en = Math.max(en, benzerlik(ms.slice(bas, bas + boy).join(' '), i));
    }
  }
  return en;
}

/**
 * Uyandırma sözcüğünü arar (ilk iki sözcükte, bulanık). Bulursa sonrasını döner, bulamazsa null.
 * Tanıyıcı kısa sözcükleri sık karıştırdığı için ilk sözcük de yalnız başına denenir ("bot" ↔ "bat").
 */
export function uyandirmayiAyikla(metin: string, uyandirma: string): string | null {
  const m = normalize(metin).split(' ').filter(Boolean);
  const u = normalize(uyandirma).split(' ').filter(Boolean);
  if (!m.length || !u.length) return null;
  const hedef = u.join(' ');
  const uyar = (aday: string) =>
    hedef.length <= 4
      ? // Kısa sözcük: yalnız aynı uzunlukta tek harf hatası ("bat" ✓, "botu"/"bota" ✗ — sohbette geçen ad)
        aday.length === hedef.length && uzaklik(aday, hedef) <= 1
      : benzerlik(aday, hedef) >= 0.75;
  for (let bas = 0; bas <= Math.min(1, m.length - u.length); bas++) {
    // İkinci sırada yalnız bir hitaptan sonra ("hey bot …"); "yayın botu …" konuşmanın parçasıdır
    if (bas === 1 && !HITAP.has(m[0])) break;
    if (uyar(m.slice(bas, bas + u.length).join(' '))) return m.slice(bas + u.length).join(' ');
  }
  return null;
}

const HITAP = new Set(['hey', 'ey', 'hadi', 'tamam', 'evet', 'pekala', 'peki']);

/** Overlay Studio "hepsi bir arada" widget anahtarları ve sesle söylenebilecek adları */
export const WIDGET_ADLARI: Record<string, string[]> = {
  chat: ['sohbet', 'chat', 'sohbet kutusu'],
  alerts: ['uyarı', 'uyarılar', 'alert', 'bildirim'],
  goals: ['hedef', 'hedefler', 'hedef çubuğu'],
  subathon: ['subathon', 'sayaç'],
  trivia: ['bil bakalım', 'bilgi yarışması', 'trivia'],
  eventLabels: ['olay etiketleri', 'etiketler'],
  emoteCombo: ['emote', 'emote kombo'],
  nowPlaying: ['çalan şarkı', 'şimdi çalıyor', 'şarkı kartı'],
  theCup: ['kupa'],
  polls: ['anket', 'anketler'],
  wheel: ['çark', 'çarkıfelek'],
  hypeTrain: ['hype', 'hype treni']
};

const AC_SOZ = ['ac', 'goster', 'getir', 'etkinlestir'];
const KAPAT_SOZ = ['kapat', 'gizle', 'kaldir'];
const CAL_SOZ = ['cal', 'oynat', 'patlat'];
/** Ses adı ile fiil arasındaki ekler: "davul sesini çal", "alkış videosunu oynat" */
const DOLGU = new Set(['sesini', 'sesi', 'videosunu', 'videoyu', 'videosu', 'sesli', 'bir', 'su', 'lutfen', 'hadi']);

export interface PanoAday {
  id: string;
  ad: string;
  komut: string;
}

export type Eslesme =
  | { kaynak: 'komut'; komut: SesliKomut; skor: number; ifade: string }
  | { kaynak: 'pano'; oge: PanoAday; skor: number }
  | { kaynak: 'overlay'; widget: string; durum: 'ac' | 'kapat'; skor: number };

function fiilVar(sozcukler: string[], fiiller: string[]): number {
  for (let i = 0; i < sozcukler.length; i++) {
    if (fiiller.some((f) => sozcukler[i] === f || (sozcukler[i].length > 2 && benzerlik(sozcukler[i], f) >= 0.75))) return i;
  }
  return -1;
}

/** "<ad> çal" / "çal <ad>" → panodaki en benzer öğe */
export function panoEslestir(metin: string, ogeler: PanoAday[], esik: number): { oge: PanoAday; skor: number } | null {
  const s = normalize(metin).split(' ').filter(Boolean);
  const f = fiilVar(s, CAL_SOZ);
  if (f < 0 || !ogeler.length) return null;
  const once = s.slice(0, f).filter((x) => !DOLGU.has(x)).join(' ');
  const sonra = s.slice(f + 1).filter((x) => !DOLGU.has(x)).join(' ');
  let en: { oge: PanoAday; skor: number } | null = null;
  for (const aday of [once, sonra].filter(Boolean)) {
    for (const o of ogeler) {
      const skor = Math.max(benzerlik(aday, normalize(o.ad)), benzerlik(aday, normalize(o.komut.replace(/-/g, ' '))));
      if (!en || skor > en.skor) en = { oge: o, skor };
    }
  }
  return en && en.skor >= esik ? en : null;
}

/** "<widget> aç/kapat" */
export function overlayEslestir(metin: string, esik: number): { widget: string; durum: 'ac' | 'kapat'; skor: number } | null {
  const s = normalize(metin).split(' ').filter(Boolean);
  const ac = fiilVar(s, AC_SOZ);
  const kapat = fiilVar(s, KAPAT_SOZ);
  const f = ac >= 0 && (kapat < 0 || ac >= kapat) ? ac : kapat;
  if (f < 0) return null;
  const durum: 'ac' | 'kapat' = f === ac ? 'ac' : 'kapat';
  // Fiilden önceki sözcükler widget adı ("anket aç"); Türkçe eki at ("anketi" → "anket")
  const ad = s.slice(0, f).join(' ');
  if (!ad) return null;
  let en: { widget: string; skor: number } | null = null;
  for (const [widget, adlar] of Object.entries(WIDGET_ADLARI)) {
    for (const a of adlar) {
      const skor = Math.max(ifadePuani(ad, a), benzerlik(ad.replace(/(yi|yu|i|u)$/u, ''), normalize(a)));
      if (!en || skor > en.skor) en = { widget, skor };
    }
  }
  return en && en.skor >= esik ? { widget: en.widget, durum, skor: en.skor } : null;
}

/**
 * Metni komutlara eşler. Önce yayıncının tanımladığı ifadeler (en yüksek puan), sonra dinamik kalıplar.
 * Tanımlı komut dinamik eşleşmeden biraz düşük puanlıysa bile önceliklidir (yayıncının açık niyeti).
 */
export function eslestir(
  metin: string,
  komutlar: SesliKomut[],
  ayar: Pick<SesliAyarlar, 'esik' | 'dinamikPano' | 'dinamikOverlay'>,
  panoOgeleri: PanoAday[] = []
): Eslesme | null {
  let en: Eslesme | null = null;
  for (const k of komutlar) {
    if (!k.etkin) continue;
    for (const ifade of k.ifadeler) {
      const skor = ifadePuani(metin, ifade);
      if (skor >= ayar.esik && (!en || skor > en.skor)) en = { kaynak: 'komut', komut: k, skor, ifade };
    }
  }
  if (en && en.skor >= 0.95) return en;
  const adaylar: Eslesme[] = en ? [en] : [];
  if (ayar.dinamikPano) {
    const p = panoEslestir(metin, panoOgeleri, ayar.esik);
    if (p) adaylar.push({ kaynak: 'pano', oge: p.oge, skor: p.skor - 0.02 });
  }
  if (ayar.dinamikOverlay) {
    const o = overlayEslestir(metin, ayar.esik);
    if (o) adaylar.push({ kaynak: 'overlay', widget: o.widget, durum: o.durum, skor: o.skor - 0.02 });
  }
  adaylar.sort((a, b) => b.skor - a.skor);
  return adaylar[0] ?? null;
}

/** İstemciden gelen eylemi doğrula/temizle; geçersizse null */
export function eylemDuzelt(e: any): SesliEylem | null {
  if (!e || typeof e !== 'object') return null;
  const metin = String(e.metin ?? '').trim().slice(0, 500);
  switch (e.tur) {
    case 'komut':
      return metin ? { tur: 'komut', metin } : null;
    case 'sohbet':
      return metin ? { tur: 'sohbet', metin } : null;
    case 'tts':
      return metin ? { tur: 'tts', metin } : null;
    case 'pano_oynat':
      return e.ogeId ? { tur: 'pano_oynat', ogeId: String(e.ogeId) } : null;
    case 'pano_kontrol':
      return ['atla', 'duraklat', 'devam', 'temizle'].includes(e.eylem) ? { tur: 'pano_kontrol', eylem: e.eylem } : null;
    case 'overlay':
      return WIDGET_ADLARI[e.widget] && ['ac', 'kapat', 'degistir'].includes(e.durum)
        ? { tur: 'overlay', widget: e.widget, durum: e.durum }
        : null;
    case 'widget_test':
      return /^[a-z0-9_-]{1,40}$/i.test(String(e.widget ?? '')) ? { tur: 'widget_test', widget: String(e.widget) } : null;
    case 'uyari_test':
      return ['follow', 'sub', 'tip', 'raid', 'gift_tiktok'].includes(e.olay) ? { tur: 'uyari_test', olay: e.olay } : null;
    case 'sarki_atla':
      return { tur: 'sarki_atla' };
    case 'sohbet_temizle':
      return { tur: 'sohbet_temizle' };
    case 'kalkan':
      return ['ac', 'kapat'].includes(e.durum) ? { tur: 'kalkan', durum: e.durum } : null;
    default:
      return null;
  }
}

/** İlk kurulumda önerilen komutlar (yayıncı düzenleyebilir/silebilir) */
export const ORNEK_KOMUTLAR: Omit<SesliKomut, 'id'>[] = [
  { ad: 'Sesi atla', ifadeler: ['sesi geç', 'sesi atla'], eylem: { tur: 'pano_kontrol', eylem: 'atla' }, etkin: true },
  { ad: 'Ses sırasını temizle', ifadeler: ['sesleri temizle', 'ses sırasını temizle'], eylem: { tur: 'pano_kontrol', eylem: 'temizle' }, etkin: true },
  { ad: 'Şarkıyı atla', ifadeler: ['şarkıyı geç', 'şarkıyı atla', 'sonraki şarkı'], eylem: { tur: 'sarki_atla' }, etkin: true },
  { ad: 'Sohbeti temizle', ifadeler: ['sohbeti temizle', 'chati temizle'], eylem: { tur: 'sohbet_temizle' }, etkin: true },
  { ad: 'Kalkanı aç', ifadeler: ['kalkanı aç', 'kalkan modunu aç'], eylem: { tur: 'kalkan', durum: 'ac' }, etkin: true },
  { ad: 'Kalkanı kapat', ifadeler: ['kalkanı kapat', 'kalkan modunu kapat'], eylem: { tur: 'kalkan', durum: 'kapat' }, etkin: true },
  { ad: 'Takipçi uyarısı testi', ifadeler: ['takipçi testi', 'uyarı testi'], eylem: { tur: 'uyari_test', olay: 'follow' }, etkin: true },
  { ad: 'Çarkı çevir (test)', ifadeler: ['çarkı çevir'], eylem: { tur: 'widget_test', widget: 'wheel' }, etkin: true }
];

/** Türkçe belirtme hali (-ı/-i/-u/-ü, ünlüden sonra -yı…): "anket" → "anketi", "çark" → "çarkı", "kupa" → "kupayı" */
export function belirtmeHali(ad: string): string {
  const s = ad.trim();
  const unluler = 'aeıioöuü';
  let son = '';
  for (let i = s.length - 1; i >= 0; i--) {
    if (unluler.includes(s[i])) {
      son = s[i];
      break;
    }
  }
  if (!son) return s;
  const ek = /[aı]/.test(son) ? 'ı' : /[ei]/.test(son) ? 'i' : /[ou]/.test(son) ? 'u' : 'ü';
  return s + (unluler.includes(s[s.length - 1]) ? 'y' : '') + ek;
}

/**
 * Tanıyıcıya verilecek ifade listesi (Vosk dilbilgisi): yalnız bunlar ve "[unk]" (bilinmeyen) tanınır. Uyandırma
 * sözcüklü ve sözcüksüz halleri, ses panosu ve widget kalıpları dahil. Küçük harf, Türkçe karakterler korunur
 * (modelin sözcük dağarcığıyla eşleşmesi için).
 */
export function dilbilgisi(
  ayar: Pick<SesliAyarlar, 'uyandirma' | 'dinamikPano' | 'dinamikOverlay'>,
  komutlar: SesliKomut[],
  pano: PanoAday[] = []
): string[] {
  const kucuk = (x: string) => x.toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  const uyan = kucuk(ayar.uyandirma);
  const govdeler = new Set<string>();
  for (const k of komutlar) if (k.etkin) for (const i of k.ifadeler) govdeler.add(kucuk(i));
  if (ayar.dinamikPano) {
    for (const o of pano) {
      const ad = kucuk(o.ad);
      if (!ad) continue;
      for (const f of ['çal', 'oynat']) {
        govdeler.add(`${ad} ${f}`);
        govdeler.add(`${ad} sesini ${f}`);
        govdeler.add(`${f} ${ad}`);
      }
    }
  }
  if (ayar.dinamikOverlay) {
    for (const adlar of Object.values(WIDGET_ADLARI)) {
      for (const ad of adlar) {
        for (const bicim of new Set([ad, belirtmeHali(ad)])) {
          for (const f of ['aç', 'göster', 'kapat', 'gizle']) govdeler.add(`${bicim} ${f}`);
        }
      }
    }
  }
  const sonuc = new Set<string>();
  for (const g of govdeler) {
    if (!g) continue;
    sonuc.add(g);
    if (uyan) sonuc.add(`${uyan} ${g}`);
  }
  if (uyan) sonuc.add(uyan);
  return [...sonuc, '[unk]'];
}
