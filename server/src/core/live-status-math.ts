/**
 * StreamAxT — canlı yayın durumu hesapları (saf)
 * Developed by AxthrowA
 *
 * Denetimde bulundu: `!uptime` ve `$(uptime)` YAYININ değil BOTUN ne
 * kadardır açık olduğunu söylüyordu (`index.ts` açılışta
 * `setStreamStartTime(Date.now())` yapıyordu). Yayının açık olup olmadığı
 * hiçbir yerde bilinmiyordu; bu yüzden Discord duyurusunun beklediği
 * `stream_online` olayı Kick/Twitch/YouTube'da HİÇ üretilmiyordu.
 *
 * Bu dosya veritabanına ve ağa dokunmaz; test edilebilir.
 */

export interface YayinBilgisi {
  canli: boolean;
  /** Yayın başlangıcı (epoch ms); bilinmiyorsa null. */
  baslangic?: number | null;
  izleyici?: number;
  baslik?: string;
  kategori?: string;
  /** Yayına özgü kimlik — aynı yayın iki kez duyurulmasın diye. */
  yayinId?: string;
  kanal?: string;
}

export interface PlatformYayinDurumu extends Required<Omit<YayinBilgisi, 'baslangic'>> {
  platform: string;
  baslangic: number | null;
  guncelleme: number;
}

export interface GenelDurum {
  /** null = hiçbir platform durum bildirmiyor, BİLİNMİYOR. */
  canli: boolean | null;
  baslangic: number | null;
  izleyici: number;
  canliPlatformlar: string[];
}

/**
 * Kick zaman damgasını çözer.
 * Gözlem (2026-09-23, kick.com/api/v2/channels/<kanal>): `start_time`
 * `"2026-09-23 12:53:51"` biçiminde, saat dilimi YAZMIYOR ve UTC. Resmi
 * API ise `"2026-09-23T12:53:51Z"` veriyor. İkisi de kabul edilir.
 */
export function kickZamani(ham: unknown): number | null {
  const s = String(ham ?? '').trim();
  if (!s || s.startsWith('0001-')) return null;
  const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? s.replace(' ', 'T') : `${s.replace(' ', 'T')}Z`;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/** ISO zaman (Twitch/YouTube) → epoch ms. */
export function isoZamani(ham: unknown): number | null {
  const t = Date.parse(String(ham ?? ''));
  return Number.isFinite(t) ? t : null;
}

/**
 * Durum geçişi. İlk gözlemde (önceki yok) yayın açıksa `acildi` döner —
 * bot yayın ortasında açılırsa da durum doğru kurulsun. Tekrar duyuruyu
 * engellemek ÜST KATMANIN işi (yayın kimliğiyle).
 */
export function gecis(onceki: boolean | undefined, simdi: boolean): 'acildi' | 'kapandi' | null {
  if (simdi && onceki !== true) return 'acildi';
  if (!simdi && onceki === true) return 'kapandi';
  return null;
}

/** Tüm platformların birleşik durumu. */
export function genelDurum(durumlar: PlatformYayinDurumu[]): GenelDurum {
  if (!durumlar.length) return { canli: null, baslangic: null, izleyici: 0, canliPlatformlar: [] };
  const canlilar = durumlar.filter((d) => d.canli);
  if (!canlilar.length) return { canli: false, baslangic: null, izleyici: 0, canliPlatformlar: [] };
  const baslangiclar = canlilar.map((d) => d.baslangic).filter((x): x is number => typeof x === 'number');
  return {
    canli: true,
    baslangic: baslangiclar.length ? Math.min(...baslangiclar) : null,
    izleyici: canlilar.reduce((t, d) => t + (Number(d.izleyici) || 0), 0),
    canliPlatformlar: canlilar.map((d) => d.platform)
  };
}

/** 3725000 ms → "1 saat 2 dakika 5 saniye" (eski `getStreamUptime` biçimi). */
export function sureMetni(ms: number): string {
  const f = Math.max(0, Math.floor(ms / 1000));
  const sa = Math.floor(f / 3600);
  const dk = Math.floor((f % 3600) / 60);
  const sn = f % 60;
  const parca: string[] = [];
  if (sa > 0) parca.push(`${sa} saat`);
  if (dk > 0 || sa > 0) parca.push(`${dk} dakika`);
  parca.push(`${sn} saniye`);
  return parca.join(' ');
}

/** YouTube video kimliği mi (11 karakter), sohbet kimliği mi? */
export function youtubeKimlikTuru(ham: string): 'video' | 'sohbet' | 'bilinmiyor' {
  const s = String(ham || '').trim();
  const url = s.match(/(?:v=|youtu\.be\/|\/live\/)([A-Za-z0-9_-]{11})/);
  if (url) return 'video';
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return 'video';
  if (s.length > 20) return 'sohbet';
  return 'bilinmiyor';
}

/** Adres veya çıplak kimlikten 11 karakterlik video kimliği. */
export function youtubeVideoKimligi(ham: string): string {
  const s = String(ham || '').trim();
  const url = s.match(/(?:v=|youtu\.be\/|\/live\/)([A-Za-z0-9_-]{11})/);
  if (url) return url[1];
  return /^[A-Za-z0-9_-]{11}$/.test(s) ? s : '';
}
