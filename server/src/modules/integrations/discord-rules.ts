/**
 * StreamAxT — Discord duyuru kuralları (saf)
 * Developed by AxthrowA
 *
 * Veritabanı erişimi YOK. Sebep: testler koşarken çalışan sunucunun SQLite
 * kilidine takılmasın (prediction-math.ts / queue-order.ts ile aynı desen).
 */

export type DuyuruKaynagi = 'kick' | 'twitch' | 'youtube' | 'tiktok';

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
  tiktok: K()
};

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
