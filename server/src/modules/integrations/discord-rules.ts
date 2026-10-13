/**
 * StreamAxT — Discord duyuru kuralları (saf)
 * Developed by AxthrowA
 *
 * Veritabanı erişimi YOK. Sebep: testler koşarken çalışan sunucunun SQLite
 * kilidine takılmasın (prediction-math.ts / queue-order.ts ile aynı desen).
 */

export type DuyuruKaynagi = 'kick' | 'twitch' | 'youtube' | 'tiktok' | 'trovo';

export interface DuyuruKurali {
  aktif: boolean;
  webhook: string;
  sablon: string;
  /** Aynı yayın için tekrar tekrar duyurulmasın (dakika). */
  beklemeDk: number;
  /** @everyone / @here etiketlensin mi? */
  etiket: 'yok' | 'here' | 'everyone';
}

export type DuyuruAyarlari = Record<DuyuruKaynagi, DuyuruKurali>;

const K = (): DuyuruKurali => ({
  aktif: false,
  webhook: '',
  sablon: '🔴 **$(channel)** yayında! $(platformUrl)/$(channel)',
  beklemeDk: 60,
  etiket: 'yok'
});

export const VARSAYILAN_DUYURU: DuyuruAyarlari = {
  kick: K(),
  twitch: K(),
  youtube: K(),
  tiktok: K(),
  trovo: K()
};

/**
 * Bu yayın zaten duyuruldu mu?
 *
 * Bekleme süresi bellekte tutuluyordu: bot yayın ortasında yeniden
 * başlatılınca aynı yayın İKİNCİ KEZ duyurulurdu. Yayın kimliği kalıcı
 * saklanır; aynı kimlik bir daha duyurulmaz. Kimlik yoksa (bazı platformlar
 * vermiyor) yalnız bekleme süresi korur.
 */
export function zatenDuyuruldu(yayinId: string | undefined, sonDuyurulan: string | undefined): boolean {
  const y = String(yayinId || '').trim();
  return !!y && y === String(sonDuyurulan || '').trim();
}

/** Webhook adresi gerçekten Discord'a mı gidiyor? */
export function webhookGecerliMi(url: string): boolean {
  try {
    const u = new URL(String(url || ''));
    return (
      u.protocol === 'https:' &&
      (u.hostname === 'discord.com' || u.hostname === 'discordapp.com' || u.hostname.endsWith('.discord.com')) &&
      u.pathname.startsWith('/api/webhooks/')
    );
  } catch {
    return false;
  }
}

/** Etiket ön eki. */
export function etiketOneki(etiket: DuyuruKurali['etiket']): string {
  if (etiket === 'everyone') return '@everyone ';
  if (etiket === 'here') return '@here ';
  return '';
}
