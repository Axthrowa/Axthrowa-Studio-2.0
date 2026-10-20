/**
 * StreamAxT — komut girdisi ve eşleme kuralları (saf)
 * Developed by AxthrowA
 *
 * Veritabanı erişimi YOK — testler çalışan sunucunun SQLite kilidine
 * takılmasın (prediction-math.ts ile aynı desen).
 *
 * NEDEN VAR: Canlı denemede bulundu —
 *   • Panel `user_level` / `is_enabled` / `aliases` gönderiyordu, sunucu
 *     `userLevel` / `isEnabled` okuyordu. Sonuç: yeni komutta seçilen rol
 *     YOK SAYILIYORDU (moderatör komutu herkese açılıyordu), takma adlar
 *     kaydedilmiyordu, DÜZENLEME ise her seferinde HTTP 500 veriyordu.
 *   • 1. turda motora eklenen alanlar (bekleme kipi, fiyat, platform,
 *     tetikleyici, erişim) API'den hiç yazılamıyordu.
 *
 * Bu modül iki adlandırmayı da kabul eder ve kısmi güncellemede verilmeyen
 * alanları MEVCUT değerden alır — eski bir panel yeni alanları sıfırlamasın.
 *
 * BotRix komut formu (BOTRIX_UI_INVENTORY §6.2): Komut · Erişim ·
 * Etkinleştirme (Sadece komut / Sohbet anahtar kelimesi) · Mesaj · Platform ·
 * Bekleme süresi · Bekleme modu (Genel / Kullanıcı başına) · Takma ad ·
 * Fiyat · Rol.
 */
import { trKatla, kacisla } from '../../core/text.js';

export const ROLLER = ['everyone', 'regular', 'sub', 'vip', 'mod', 'broadcaster'] as const;
export const PLATFORMLAR = ['kick', 'twitch', 'youtube', 'tiktok', 'discord', 'trovo'] as const;
export const TETIKLEYICILER = ['command', 'keyword'] as const;
export const ERISIM_KIPLERI = ['always', 'online', 'offline'] as const;
export const BEKLEME_KIPLERI = ['global', 'user'] as const;

export type Rol = (typeof ROLLER)[number];
export type Tetikleyici = (typeof TETIKLEYICILER)[number];
export type ErisimKipi = (typeof ERISIM_KIPLERI)[number];

export interface KomutKaydi {
  name: string;
  response: string;
  user_level: Rol;
  cooldown: number;
  aliases: string; // JSON dizi
  is_enabled: number;
  description: string;
  cooldown_mode: (typeof BEKLEME_KIPLERI)[number];
  user_cooldown: number;
  cost_points: number;
  min_level: number;
  platforms: string; // virgüllü, boş = hepsi
  trigger_type: Tetikleyici;
  access_mode: ErisimKipi;
}

export const VARSAYILAN_KOMUT: KomutKaydi = {
  name: '',
  response: '',
  user_level: 'everyone',
  cooldown: 5,
  aliases: '[]',
  is_enabled: 1,
  description: '',
  cooldown_mode: 'global',
  user_cooldown: 0,
  cost_points: 0,
  min_level: 0,
  platforms: '',
  trigger_type: 'command',
  access_mode: 'always'
};

/** İki adlandırmadan hangisi geldiyse onu alır. */
function al(govde: any, yilan: string, deve: string): unknown {
  if (govde?.[yilan] !== undefined) return govde[yilan];
  if (govde?.[deve] !== undefined) return govde[deve];
  return undefined;
}

function tamSayi(v: unknown, alt: number, ust: number): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return undefined;
  return Math.min(ust, Math.max(alt, n));
}

function secenek<T extends string>(v: unknown, izinli: readonly T[]): T | undefined {
  const s = String(v ?? '').trim().toLowerCase();
  return (izinli as readonly string[]).includes(s) ? (s as T) : undefined;
}

function mantiksal(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const s = String(v).trim().toLowerCase();
  if (['1', 'true', 'evet', 'on'].includes(s)) return 1;
  if (['0', 'false', 'hayir', 'hayır', 'off'].includes(s)) return 0;
  return undefined;
}

/** Komut/takma ad adını temizler: önek, boşluk, büyük harf. */
export function adTemizle(ham: unknown, onek = '!'): string {
  let s = String(ham ?? '').trim();
  if (onek && s.startsWith(onek)) s = s.slice(onek.length);
  return s.replace(/^!+/, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('tr-TR');
}

/** Takma adlar: dizi, JSON dizi metni veya virgüllü metin kabul edilir. */
export function takmaAdlariCoz(v: unknown, anaAd = ''): string[] {
  let liste: unknown[] = [];
  if (Array.isArray(v)) liste = v;
  else if (typeof v === 'string') {
    const s = v.trim();
    if (s.startsWith('[')) {
      try {
        const j = JSON.parse(s);
        if (Array.isArray(j)) liste = j;
      } catch {
        liste = s.split(',');
      }
    } else if (s) liste = s.split(',');
  }
  const gorulen = new Set<string>();
  const cikti: string[] = [];
  for (const x of liste) {
    const a = adTemizle(x);
    if (!a || a === anaAd || gorulen.has(a)) continue;
    gorulen.add(a);
    cikti.push(a);
  }
  return cikti.slice(0, 20);
}

/** Platform listesi: dizi veya virgüllü metin. Bilinmeyenler atılır. */
export function platformlariCoz(v: unknown): string {
  const liste = Array.isArray(v) ? v : String(v ?? '').split(',');
  const kume = new Set<string>();
  for (const p of liste) {
    const s = String(p).trim().toLowerCase();
    if ((PLATFORMLAR as readonly string[]).includes(s)) kume.add(s);
  }
  // Hepsi seçildiyse boş = "tüm platformlar" (geriye uyum)
  if (kume.size === PLATFORMLAR.length) return '';
  return PLATFORMLAR.filter((p) => kume.has(p)).join(',');
}

/**
 * Gelen gövdeyi doğrular ve kayda çevirir.
 *
 * `mevcut` verilirse (düzenleme) gövdede OLMAYAN alanlar mevcut değerden
 * alınır. Böylece yalnız "yanıt" gönderen eski bir istemci, rolü veya
 * açık/kapalı durumunu sıfırlamaz.
 */
export function komutGirdisiniCoz(
  govde: any,
  mevcut?: Partial<KomutKaydi>
): { ok: true; kayit: KomutKaydi } | { ok: false; hata: string } {
  const taban: KomutKaydi = { ...VARSAYILAN_KOMUT, ...(mevcut || {}) } as KomutKaydi;

  const tetikleyici = secenek(al(govde, 'trigger_type', 'triggerType'), TETIKLEYICILER) ?? taban.trigger_type;

  const hamAd = al(govde, 'name', 'name');
  const ad = hamAd !== undefined ? adTemizle(hamAd) : taban.name;
  if (!ad) return { ok: false, hata: 'Komut adı gerekli.' };
  if (ad.length > 50) return { ok: false, hata: 'Komut adı en fazla 50 karakter olabilir.' };
  // Komut tek kelimedir; anahtar kelime ise öbek olabilir ("iyi yayınlar")
  if (tetikleyici === 'command' && /\s/.test(ad)) {
    return { ok: false, hata: 'Komut adı boşluk içeremez. Öbek için tetikleyiciyi "Sohbet anahtar kelimesi" yapın.' };
  }
  if (tetikleyici === 'keyword' && trKatla(ad).length < 2) {
    return { ok: false, hata: 'Anahtar kelime en az 2 karakter olmalı — tek harf her mesajda tetiklenirdi.' };
  }

  const hamYanit = al(govde, 'response', 'response');
  const yanit = hamYanit !== undefined ? String(hamYanit) : taban.response;
  if (!yanit.trim()) return { ok: false, hata: 'Komut yanıtı gerekli.' };
  if (yanit.length > 2000) return { ok: false, hata: 'Yanıt en fazla 2000 karakter olabilir.' };

  const hamTakma = al(govde, 'aliases', 'aliases');

  const kayit: KomutKaydi = {
    name: ad,
    response: yanit,
    user_level: secenek(al(govde, 'user_level', 'userLevel'), ROLLER) ?? taban.user_level,
    cooldown: tamSayi(al(govde, 'cooldown', 'cooldown'), 0, 86400) ?? taban.cooldown,
    aliases: JSON.stringify(hamTakma !== undefined ? takmaAdlariCoz(hamTakma, ad) : takmaAdlariCoz(taban.aliases, ad)),
    is_enabled: mantiksal(al(govde, 'is_enabled', 'isEnabled')) ?? taban.is_enabled,
    description: String(al(govde, 'description', 'description') ?? taban.description ?? '').slice(0, 300),
    cooldown_mode: secenek(al(govde, 'cooldown_mode', 'cooldownMode'), BEKLEME_KIPLERI) ?? taban.cooldown_mode,
    user_cooldown: tamSayi(al(govde, 'user_cooldown', 'userCooldown'), 0, 86400) ?? taban.user_cooldown,
    cost_points: tamSayi(al(govde, 'cost_points', 'costPoints'), 0, 1_000_000_000) ?? taban.cost_points,
    min_level: tamSayi(al(govde, 'min_level', 'minLevel'), 0, 10_000) ?? taban.min_level,
    platforms:
      al(govde, 'platforms', 'platforms') !== undefined
        ? platformlariCoz(al(govde, 'platforms', 'platforms'))
        : platformlariCoz(taban.platforms),
    trigger_type: tetikleyici,
    access_mode: secenek(al(govde, 'access_mode', 'accessMode'), ERISIM_KIPLERI) ?? taban.access_mode
  };

  return { ok: true, kayit };
}

// ------------------------------------------------------------- eşleme ------

/**
 * Anahtar kelime mesajda BÜTÜN KELİME olarak geçiyor mu?
 *
 * "selam" anahtarı "selamlar" içinde tetiklenmemeli; "iyi yayınlar" öbeği
 * "İYİ YAYINLAR!!" yazan izleyicide tetiklenmeli. İki taraf da Türkçe
 * katlanır, sınırlar Unicode harf/rakam üzerinden hesaplanır.
 */
export function anahtarKelimeEslesir(mesaj: string, anahtar: string): boolean {
  const m = trKatla(mesaj);
  const a = trKatla(anahtar).replace(/\s+/g, ' ');
  if (!m || a.length < 2) return false;
  const desen = a.split(' ').map(kacisla).join('\\s+');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${desen}(?=$|[^\\p{L}\\p{N}])`, 'u').test(m);
}

/**
 * Mesaja uyan anahtar kelime komutunu seçer.
 * Birden çok eşleşirse EN UZUN anahtar kazanır — "iyi yayınlar", "iyi"den
 * daha özeldir. Bir mesaj en fazla BİR yanıt üretir (sel olmasın).
 */
export function anahtarKomutuSec<T extends { name: string; aliases?: string | null }>(
  mesaj: string,
  komutlar: T[]
): T | null {
  let secilen: T | null = null;
  let enUzun = 0;
  for (const k of komutlar) {
    const adlar = [k.name, ...takmaAdlariCoz(k.aliases ?? '[]', k.name)];
    for (const ad of adlar) {
      if (ad.length > enUzun && anahtarKelimeEslesir(mesaj, ad)) {
        secilen = k;
        enUzun = ad.length;
      }
    }
  }
  return secilen;
}

/**
 * Erişim kipi: komut şu an çalışabilir mi?
 * `canli` null ise yayın durumu BİLİNMİYOR demektir (hiçbir platform durum
 * bildirmiyor). O zaman komut engellenmez — algılama çalışmıyor diye
 * kullanıcının komutları sessizce ölmesin.
 */
export function erisimUygunMu(kip: string, canli: boolean | null): boolean {
  if (kip === 'online') return canli !== false;
  if (kip === 'offline') return canli !== true;
  return true;
}

/** Erişim reddinde sohbete yazılacak açıklama (yalnız ! ile çağrılınca). */
export function erisimAciklamasi(kip: string): string {
  if (kip === 'online') return 'bu komut yalnız yayın açıkken çalışır';
  if (kip === 'offline') return 'bu komut yalnız yayın kapalıyken çalışır';
  return '';
}
