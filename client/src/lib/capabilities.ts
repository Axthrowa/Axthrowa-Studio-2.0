/**
 * StreamAxT — istemci tarafı yetenek okuma
 * Developed by AxthrowA
 *
 * Panelin her platform için TÜM ayarları göstermesi denetimde kusur olarak
 * bulunmuştu (CURRENT_SYSTEM_AUDIT §3): Discord'a "abone uyarısı",
 * YouTube'a "raid" gibi karşılığı olmayan ayarlar sunuluyordu. Kullanıcı
 * ayarı açıyor, hiç çalışmıyor, sebebini anlayamıyordu.
 *
 * BotRix bunu gizleyerek değil ETİKETLEYEREK çözüyor: "Bits (Twitch)",
 * "Super Chat (YouTube)". Biz de aynısını yapıyoruz — bir ayarı sessizce
 * yok etmek, neden çalışmadığını söylemekten daha kötü.
 *
 * Sunucu gerçeği tek yerde tutar (`platforms/capabilities.ts`); burası
 * yalnız onu okur ve önbelleğe alır.
 */

export type PlatformAdi = 'twitch' | 'kick' | 'youtube' | 'discord' | 'tiktok';

export interface PlatformYetenekleri {
  sohbet: { oku: boolean; gonder: boolean };
  olaylar: string[];
  moderasyon: { timeout: boolean; ban: boolean; mesajSil: boolean };
  yayin: { baslikDegistir: boolean; kategoriDegistir: boolean; izleyiciSayisi: boolean };
  roller: string[];
}

export type YetenekHaritasi = Record<string, PlatformYetenekleri>;

export const PLATFORM_ETIKETI: Record<string, string> = {
  kick: 'Kick',
  twitch: 'Twitch',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  discord: 'Discord'
};

let onbellek: YetenekHaritasi | null = null;
let bekleyen: Promise<YetenekHaritasi> | null = null;

/**
 * Yetenek tablosunu getirir (süreç boyunca bir kez).
 * Ağ hatasında BOŞ harita döner — panel çökmez, yalnız etiket görünmez.
 */
export async function yetenekleriGetir(): Promise<YetenekHaritasi> {
  if (onbellek) return onbellek;
  if (bekleyen) return bekleyen;

  bekleyen = fetch('/api/platforms/capabilities')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((d) => {
      onbellek = (d?.yetenekler || {}) as YetenekHaritasi;
      return onbellek;
    })
    .catch(() => ({}) as YetenekHaritasi)
    .finally(() => {
      bekleyen = null;
    });

  return bekleyen;
}

/** Testler ve "yeniden yükle" için. */
export function onbellegiTemizle() {
  onbellek = null;
}

/**
 * Platformdan BAĞIMSIZ kaynaklar.
 *
 * Bağış, yayın platformundan değil dış bir ödeme/webhook sağlayıcıdan gelir
 * (BynoGame, Ko-fi, özel webhook). Yalnız platform tablosuna bakıp
 * "bağış Twitch ve YouTube'da çalışır" demek Kick yayıncısını yanıltırdı:
 * BynoGame bağışı Kick'te de çalışır.
 */
export const DIS_KAYNAKLAR: Record<string, string> = {
  tip: 'BynoGame / webhook bağışları da bu uyarıyı tetikler (platformdan bağımsız)'
};

/** Bu olayı hangi platformlar üretebilir? */
export function olayiDestekleyenler(harita: YetenekHaritasi, olay: string): string[] {
  return Object.keys(harita).filter((p) => harita[p]?.olaylar?.includes(olay));
}

/**
 * Bir olayın yanına yazılacak kısa açıklama.
 *
 * Tüm bağlı platformlar destekliyorsa metin üretilmez — gereksiz gürültü
 * olur. Hiçbiri desteklemiyorsa bu açıkça söylenir.
 */
export function olayEtiketi(harita: YetenekHaritasi, olay: string): string {
  const hepsi = Object.keys(harita);
  if (!hepsi.length) return '';
  const dis = DIS_KAYNAKLAR[olay] || '';
  const destekleyen = olayiDestekleyenler(harita, olay);

  if (!destekleyen.length) {
    return dis || 'Hiçbir bağlı platform bu olayı üretmiyor';
  }
  if (destekleyen.length === hepsi.length && !dis) return '';

  const platformlar = destekleyen.map((p) => PLATFORM_ETIKETI[p] || p).join(' · ');
  return dis ? `${platformlar} · ${dis}` : platformlar;
}

/** Rol listesi: bağlı platformların desteklediği rollerin birleşimi. */
export function birlesikRoller(harita: YetenekHaritasi): string[] {
  const sira = ['everyone', 'sub', 'vip', 'og', 'mod', 'broadcaster'];
  const kume = new Set<string>();
  for (const p of Object.keys(harita)) for (const r of harita[p]?.roller || []) kume.add(r);
  return sira.filter((r) => kume.has(r));
}
