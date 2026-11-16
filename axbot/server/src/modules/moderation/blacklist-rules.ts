/**
 * AxBoT — ortak kara liste kuralları (saf)
 * Developed by AxthrowA
 *
 * 4. tur denetimi: liste yalnız botun işleme hattında kullanılıyordu
 * (komut/puan/TTS yok sayılıyordu); mesajlar OBS sohbet katmanında görünmeye
 * devam ediyordu, oysa panel "filtrelenir ve engellenir" diyordu. Kullanıcı
 * adı platformdan bağımsız eşleşiyordu: Kick'teki "ali"yi listeye eklemek
 * YouTube'daki BAŞKA bir "ali"yi de etkiliyordu. Kalıcı ban gibi geri dönüşü
 * zor bir eylem ancak platform eşleşmesiyle güvenlidir.
 *
 * Eylemler (varsayılan eski davranış: yok say):
 *   yoksay → bot yok sayar, OBS sohbet katmanında gösterilmez
 *   sil    → + mesaj platformda silinir (destekleyen platformda)
 *   ban    → + kullanıcı o platformda KALICI banlanır (destekleyen platformda)
 */

export const KARA_LISTE_PLATFORMLARI = ['kick', 'twitch', 'youtube', 'trovo', 'tiktok', 'discord', 'tum'] as const;
export type KaraListePlatformu = (typeof KARA_LISTE_PLATFORMLARI)[number];

export const KARA_LISTE_EYLEMLERI = ['yoksay', 'sil', 'ban'] as const;
export type KaraListeEylemi = (typeof KARA_LISTE_EYLEMLERI)[number];

/** Eski kayıtlar Kick içindi (ekran "Kick Ortak Kara Listesi" diyordu). */
export const VARSAYILAN_KARA_LISTE_PLATFORMU: KaraListePlatformu = 'kick';

export function karaListePlatformu(ham: unknown, varsayilan: KaraListePlatformu = VARSAYILAN_KARA_LISTE_PLATFORMU): KaraListePlatformu {
  const s = String(ham ?? '').trim().toLowerCase();
  if (s === 'all' || s === '*' || s === 'tümü' || s === 'tumu') return 'tum';
  return (KARA_LISTE_PLATFORMLARI as readonly string[]).includes(s) ? (s as KaraListePlatformu) : varsayilan;
}

export function karaListeEylemi(ham: unknown): KaraListeEylemi {
  const s = String(ham ?? '').trim().toLowerCase();
  return (KARA_LISTE_EYLEMLERI as readonly string[]).includes(s) ? (s as KaraListeEylemi) : 'yoksay';
}

/** `@Ali ` → `ali`. Boşsa boş dizge. */
export function karaListeAdi(ham: unknown): string {
  return String(ham ?? '').trim().replace(/^@+/, '').toLowerCase().slice(0, 60);
}

/** Kayıt bu platformdan gelen mesaja uyar mı? */
export function karaListeEslesir(kayitPlatformu: unknown, mesajPlatformu: unknown): boolean {
  const k = karaListePlatformu(kayitPlatformu);
  return k === 'tum' || k === String(mesajPlatformu ?? '').toLowerCase();
}

export interface EylemPlani {
  sil: boolean;
  ban: boolean;
  /** Seçilen eylem platformda yapılamıyorsa açıklama (günlük/panel için). */
  not?: string;
}

/**
 * Seçilen eylemi platformun yeteneğine göre somut adımlara çevirir.
 * Ban yapılamayan platformda silmeye, silme yapılamayanda yalnız yok saymaya
 * düşülür — sessizce değil, `not` ile.
 */
export function eylemPlani(
  eylem: KaraListeEylemi,
  yetenek: { ban: boolean; mesajSil: boolean },
  platform: string
): EylemPlani {
  if (eylem === 'ban') {
    if (yetenek.ban) return { sil: false, ban: true };
    if (yetenek.mesajSil) return { sil: true, ban: false, not: `${platform} kalıcı ban desteklemiyor; mesaj silindi` };
    return { sil: false, ban: false, not: `${platform} ban ve mesaj silme desteklemiyor; yalnız yok sayıldı` };
  }
  if (eylem === 'sil') {
    if (yetenek.mesajSil) return { sil: true, ban: false };
    return { sil: false, ban: false, not: `${platform} mesaj silme desteklemiyor; yalnız yok sayıldı` };
  }
  return { sil: false, ban: false };
}

/**
 * Aynı kullanıcıya platformda tekrar tekrar ban isteği atılmasın: başarılı
 * bandan sonra kişi zaten yazamaz; başarısız olduysa (ör. izin yok) istek
 * fırtınası yerine `araMs`'de bir yeniden denenir.
 */
export function denemeZamaniGeldi(sonDeneme: number | undefined, simdi: number, araMs: number): boolean {
  return sonDeneme === undefined || simdi - sonDeneme >= araMs;
}
