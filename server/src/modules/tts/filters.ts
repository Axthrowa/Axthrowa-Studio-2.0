/**
 * AxBoT — TTS metin filtreleri
 * Developed by AxthrowA
 *
 * BotRix'in TTS sayfasındaki "Gelişmiş ayarlar" bölümü gözlemlendi
 * (BOTRIX_UI_INVENTORY §4.11): sayıları / sembolleri / emojileri /
 * tekrarlanan harfleri / linkleri yok say, karakter sınırı, bekleme süresi,
 * ton, okuma şablonu ve kara liste.
 *
 * Bizde bunların HİÇBİRİ yoktu: sohbete yazılan her şey olduğu gibi
 * okunuyordu — link okumak, emoji okumak ve "aaaaaaaa" gibi uzatmaları
 * seslendirmek yayında rahatsız edici.
 *
 * Bu modül SAF: yalnız metin dönüşümü, yan etki yok.
 */

export interface TTSFiltreAyarlari {
  /** Sayıları oku. Kapalıysa rakamlar silinir. */
  sayilariOku: boolean;
  /** Noktalama dışı sembolleri oku. */
  sembolleriOku: boolean;
  /** Emojileri oku. */
  emojileriOku: boolean;
  /** Linkleri oku. Kapalıysa adres yerine "bağlantı" denir. */
  linkleriOku: boolean;
  /** Tekrarlanan harfleri kısalt: "aaaaa" → "aa". */
  tekrarlariKisalt: boolean;
  /** Üst karakter sınırı; aşan kısım kırpılır. 0 = sınırsız. */
  karakterSiniri: number;
  /** Kullanıcı başına bekleme (saniye). */
  beklemeSn: number;
  /** En kısa okunabilir mesaj. */
  minUzunluk: number;
  /** Okuma şablonu: `{user}` ve `{message}`. */
  sablon: string;
  /** Bu kelimeleri içeren mesaj hiç okunmaz. */
  karaListe: string[];
  /** Bu kullanıcıların mesajları hiç okunmaz. */
  engelliKullanicilar: string[];
  /** Minimum rol — platform rol kümesine göre. */
  minRol: 'everyone' | 'sub' | 'vip' | 'og' | 'mod' | 'broadcaster';
}

export const VARSAYILAN_FILTRE: TTSFiltreAyarlari = {
  sayilariOku: true,
  sembolleriOku: false,
  emojileriOku: false,
  linkleriOku: false,
  tekrarlariKisalt: true,
  karakterSiniri: 200,
  beklemeSn: 0,
  minUzunluk: 2,
  sablon: '{message}',
  karaListe: [],
  engelliKullanicilar: [],
  minRol: 'everyone'
};

const ROL_SIRASI: Record<TTSFiltreAyarlari['minRol'], number> = {
  everyone: 0,
  sub: 1,
  vip: 2,
  og: 3,
  mod: 4,
  broadcaster: 5
};

export interface KullaniciRol {
  isBroadcaster?: boolean;
  isMod?: boolean;
  isVip?: boolean;
  isOg?: boolean;
  isSub?: boolean;
}

/** Kullanıcının en yüksek rolü. */
export function rolSeviyesi(u: KullaniciRol): number {
  if (u.isBroadcaster) return 5;
  if (u.isMod) return 4;
  if (u.isOg) return 3;
  if (u.isVip) return 2;
  if (u.isSub) return 1;
  return 0;
}

export function rolYeterli(u: KullaniciRol, minRol: TTSFiltreAyarlari['minRol']): boolean {
  return rolSeviyesi(u) >= (ROL_SIRASI[minRol] ?? 0);
}

/** Emoji ve piktogramlar. */
const EMOJI = /(\p{Extended_Pictographic}|\p{Emoji_Presentation}|[\u{1F1E6}-\u{1F1FF}]|️|‍)/gu;

/** Adres kalıpları. */
const LINK = /((https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(com|net|org|io|gg|tv|xyz|info|ru|me|co|dev)\b\S*)/gi;

/** Okunmasına izin verilen noktalama. */
const IZINLI_NOKTALAMA = ".,!?;:'\"()-—…";

/**
 * Mesajı seslendirilecek hâle getirir.
 * `null` dönerse mesaj hiç okunmaz.
 */
export function metniHazirla(
  ham: string,
  kullaniciAdi: string,
  ayar: TTSFiltreAyarlari
): { metin: string; sebep?: string } | null {
  let t = String(ham ?? '').trim();
  if (!t) return null;

  const ad = String(kullaniciAdi || '').toLowerCase().replace(/^@/, '');
  if (ayar.engelliKullanicilar.some((k) => String(k).toLowerCase().replace(/^@/, '') === ad)) {
    return null;
  }

  const kucuk = t.toLowerCase();
  if (ayar.karaListe.some((k) => k && kucuk.includes(String(k).toLowerCase()))) {
    return null;
  }

  // Linkler — adresi okumak yerine tek kelimeyle geç
  if (!ayar.linkleriOku) t = t.replace(LINK, ' bağlantı ');

  // Emoji koruması: sembol filtresi emojileri de siler. "Emojileri oku"
  // açıkken emoji önce yer tutucuya alınır, sembol temizliğinden sonra geri
  // konur — aksi halde iki ayar birbirini iptal ediyordu.
  const emojiKasasi: string[] = [];
  if (ayar.emojileriOku) {
    // Yer tutucu Private Use Area karakteridir: metinde doğal olarak
    // bulunmaz, ne sayı ne de sembol filtresine takılır. Boşluk+rakam
    // kullanmak gerçek sayılarla karışıyordu.
    t = t.replace(EMOJI, (m) => {
      emojiKasasi.push(m);
      return '\uE000' + (emojiKasasi.length - 1) + '\uE001';
    });
  } else {
    t = t.replace(EMOJI, ' ');
  }

  // Sayı filtresi yer tutucu içindeki indekse dokunmamalı.
  if (!ayar.sayilariOku) {
    t = t
      .split(/(\uE000\d+\uE001)/)
      .map((p) => (p.startsWith('\uE000') ? p : p.replace(/\d+/g, ' ')))
      .join('');
  }

  if (!ayar.sembolleriOku) {
    // Harf, rakam, boşluk ve izinli noktalama dışındaki her şey silinir
    // (yer tutucu sınırlayıcıları korunur)
    t = t.replace(/[^\p{L}\p{N}\s.,!?;:'"()\-—…\uE000\uE001]/gu, ' ');
  }

  if (emojiKasasi.length) {
    t = t.replace(/\uE000(\d+)\uE001/g, (_m, i) => emojiKasasi[Number(i)] ?? '');
  }

  if (ayar.tekrarlariKisalt) {
    // "aaaaaa" → "aa"; üçten fazla tekrar ikiye iner
    t = t.replace(/(\p{L})\1{2,}/gu, '$1$1');
    // "!!!!!" → "!"
    t = t.replace(/([!?.,])\1{1,}/g, '$1');
  }

  t = t.replace(/\s{2,}/g, ' ').trim();

  if (ayar.karakterSiniri > 0 && t.length > ayar.karakterSiniri) {
    t = t.slice(0, ayar.karakterSiniri).trim();
  }

  if (t.length < Math.max(1, ayar.minUzunluk)) return null;

  // Tek geçiş + işlev ile yerine koyma: izleyici metnindeki `$&` gibi kalıplar
  // yerine koyma sözdizimi sayılmasın, kullanıcı adındaki `{message}` da
  // ikinci kez değiştirilmesin.
  const degerler: Record<string, string> = { user: kullaniciAdi || '', message: t };
  const metin = String(ayar.sablon || '{message}')
    .replace(/\{(user|message)\}/gi, (_, anahtar: string) => degerler[anahtar.toLowerCase()])
    .replace(/\s{2,}/g, ' ')
    .trim();

  return { metin };
}

/** Bekleme süresi takibi — kullanıcı başına. */
export class TTSBekleme {
  private son = new Map<string, number>();

  hazirMi(kullanici: string, beklemeSn: number, simdi = Date.now()): boolean {
    if (beklemeSn <= 0) return true;
    const ad = String(kullanici || '').toLowerCase();
    const s = this.son.get(ad);
    // Kayıt yoksa kullanıcı HİÇ konuşmamıştır — beklemeye sokma.
    // `|| 0` kullanmak onu epoch 0'da konuşmuş saymak demekti.
    if (s === undefined) return true;
    return simdi - s >= beklemeSn * 1000;
  }

  isaretle(kullanici: string, simdi = Date.now()): void {
    this.son.set(String(kullanici || '').toLowerCase(), simdi);
  }

  temizle(): void {
    this.son.clear();
  }
}

export { IZINLI_NOKTALAMA };

/** Seslendirmede maskelenecek kelimeler (kök hâlleri ve yaygın yazımlar). */
export const TURKCE_KUFURLER = [
  'amk', 'aq', 'sik', 'sikerim', 'yarrak', 'orospu', 'piç', 'pic', 'göt', 'oç',
  'kahpe', 'puşt', 'ibne', 'amcık', 'dalyarak', 'amına', 'ananı', 'siktir', 'pezevenk'
];

function kacisla(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Kelimeyi, Türkçe büyük/küçük harf farkını da kapsayan bir desene çevirir.
 *
 * JS'in `\b` sınırı yalnız ASCII harfleri tanır: "piç", "oç", "ananı" gibi
 * Türkçe harfle BİTEN kelimeler eski filtrede hiç yakalanmıyor ve yayında
 * sesli okunuyordu. Sınırlar Unicode harf/rakam üzerinden kurulur; `i/İ` ve
 * `ı/I` eşlemesi `i` bayrağının bilmediği Türkçe kuralını tamamlar.
 */
function kufurDeseni(kelime: string): RegExp {
  const govde = [...kelime]
    .map((h) => (h === 'i' ? '[iİ]' : h === 'ı' ? '[ıI]' : kacisla(h)))
    .join('');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${govde}(?=$|[^\\p{L}\\p{N}])`, 'giu');
}

const KUFUR_DESENLERI = TURKCE_KUFURLER.map(kufurDeseni);

/** Küfürleri `***` ile değiştirir; kelime sınırındaki karakter korunur. */
export function kufurleriMaskele(metin: string): string {
  let t = String(metin ?? '');
  for (const desen of KUFUR_DESENLERI) {
    t = t.replace(desen, (_, on: string) => `${on}***`);
  }
  return t;
}
