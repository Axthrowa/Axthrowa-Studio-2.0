/**
 * StreamAxT — moderasyon ihlal eylemleri
 * Developed by AxthrowA
 *
 * Denetimde bulundu (BOTRIX_GAP_ANALYSIS §4): AutoMod'umuz bir ihlal
 * gördüğünde yalnız sohbete uyarı yazıyordu — platformda GERÇEK bir eylem
 * yapmıyordu. BotRix'te her kural için ayrı ayrı seçilebilen beş eylem,
 * on bir zaman aşımı kademesi, özel uyarı mesajı ve bypass rolleri var
 * (BOTRIX_UI_INVENTORY §6.1).
 *
 * Bu modül SAF: hangi eylemin uygulanacağına karar verir, uygulamaz.
 * Böylece platform bağlantısı olmadan test edilebilir.
 */
import type { Rol } from '../../platforms/capabilities.js';
import { yetenek } from '../../platforms/capabilities.js';

export type IhlalEylemi = 'warn' | 'timeout' | 'timeout_warn' | 'delete' | 'delete_warn';

export type KuralAdi = 'caps' | 'emotes' | 'links' | 'symbols' | 'blacklist';

/** BotRix'teki on bir kademe (BOTRIX_UI_INVENTORY §6.1). */
export const TIMEOUT_KADEMELERI = [30, 60, 120, 300, 900, 1800, 3600, 7200, 18000, 43200, 86400] as const;

export const EYLEM_SECENEKLERI: Array<{ value: IhlalEylemi; label: string }> = [
  { value: 'warn', label: 'Uyarı mesajı gönder' },
  { value: 'timeout', label: 'Kullanıcıya zaman aşımı ver' },
  { value: 'timeout_warn', label: 'Zaman aşımı + uyarı mesajı' },
  { value: 'delete', label: 'Mesajı sil' },
  { value: 'delete_warn', label: 'Sil + uyarı mesajı' }
];

export interface KuralAyari {
  eylem: IhlalEylemi;
  timeoutSn: number;
  mesaj: string;
  bypass: Rol[];
}

export interface KullaniciRolleri {
  isBroadcaster?: boolean;
  isMod?: boolean;
  isVip?: boolean;
  isSub?: boolean;
  isOg?: boolean;
}

/** Uygulanacak somut adımlar. */
export interface EylemPlani {
  uyar: boolean;
  sil: boolean;
  timeoutSn: number;
  /** Platform desteklemediği için düşülen eylem varsa sebebi. */
  dusurulen?: string;
}

/**
 * Kullanıcı bu kuraldan muaf mı?
 * Yayıncı ve moderatör HER ZAMAN muaftır (BotRix: "Moderatör her zaman
 * bypass'a sahiptir"), ayarda yazmasa bile.
 */
export function bypassEder(user: KullaniciRolleri, bypass: Rol[] = []): boolean {
  if (user.isBroadcaster || user.isMod) return true;
  const küme = new Set(bypass);
  if (küme.has('vip') && user.isVip) return true;
  if (küme.has('sub') && user.isSub) return true;
  if (küme.has('og') && user.isOg) return true;
  return false;
}

/** Zaman aşımı süresini geçerli bir kademeye oturtur. */
export function timeoutKademesi(saniye: number): number {
  const s = Number(saniye) || 0;
  if (s <= 0) return TIMEOUT_KADEMELERI[0];
  // En yakın kademeye yuvarla; listede yoksa en büyüğe sıkıştır.
  let enYakin: number = TIMEOUT_KADEMELERI[0];
  for (const k of TIMEOUT_KADEMELERI) {
    if (Math.abs(k - s) < Math.abs(enYakin - s)) enYakin = k;
  }
  return enYakin;
}

/**
 * Eylemi platform yeteneğine göre somut adımlara çevirir.
 *
 * Platform bir eylemi desteklemiyorsa SESSİZCE yok sayılmaz: uyarıya
 * düşülür ve sebep `dusurulen` alanında döner ki panelde gösterilebilsin.
 */
export function eylemPlani(ayar: KuralAyari, platform: string): EylemPlani {
  const y = yetenek(platform);
  const eylem = ayar.eylem || 'warn';

  const timeoutIster = eylem === 'timeout' || eylem === 'timeout_warn';
  const silIster = eylem === 'delete' || eylem === 'delete_warn';
  const uyarIster = eylem === 'warn' || eylem === 'timeout_warn' || eylem === 'delete_warn';

  const timeoutOlur = timeoutIster && y.moderasyon.timeout;
  const silOlur = silIster && y.moderasyon.mesajSil;

  const dusurulenler: string[] = [];
  if (timeoutIster && !timeoutOlur) dusurulenler.push(`${platform} zaman aşımı desteklemiyor`);
  if (silIster && !silOlur) dusurulenler.push(`${platform} mesaj silme desteklemiyor`);

  return {
    // İstenen eylem uygulanamıyorsa en azından uyar — ihlal cevapsız kalmasın
    uyar: uyarIster || dusurulenler.length > 0,
    sil: silOlur,
    timeoutSn: timeoutOlur ? timeoutKademesi(ayar.timeoutSn) : 0,
    dusurulen: dusurulenler.length ? dusurulenler.join('; ') : undefined
  };
}

/** Veritabanı satırından bir kuralın ayarını okur. */
export function kuralAyariOku(row: any, kural: KuralAdi, varsayilanMesaj: string): KuralAyari {
  let bypass: Rol[] = ['mod', 'broadcaster'];
  try {
    const ham = row?.[`${kural}_bypass`];
    if (ham) {
      const p = JSON.parse(ham);
      if (Array.isArray(p)) bypass = p as Rol[];
    }
  } catch {
    /* bozuk JSON — varsayılanda kal */
  }

  return {
    eylem: (row?.[`${kural}_action`] as IhlalEylemi) || 'warn',
    timeoutSn: Number(row?.[`${kural}_timeout`]) || 60,
    mesaj: String(row?.[`${kural}_message`] || '').trim() || varsayilanMesaj,
    bypass
  };
}

/** Süreyi insan diline çevirir: 300 → "5 dakika". */
export function sureyiYaz(saniye: number): string {
  const s = Number(saniye) || 0;
  if (s < 60) return `${s} saniye`;
  if (s < 3600) return `${Math.round(s / 60)} dakika`;
  if (s < 86400) return `${Math.round(s / 3600)} saat`;
  return `${Math.round(s / 86400)} gün`;
}
