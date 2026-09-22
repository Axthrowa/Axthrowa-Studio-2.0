/**
 * StreamAxT — Discord duyuruları
 * Developed by AxthrowA
 *
 * BotRix'te `/panel/integrations` platform bağlantısı DEĞİL, Discord duyuru
 * otomasyonudur: Twitch/YouTube Live/YouTube Videos/TikTok/Kick için yayına
 * başlayınca veya içerik paylaşınca Discord'a mesaj atar
 * (BOTRIX_UI_INVENTORY §8). Bizde hiç yoktu.
 *
 * Webhook kullanılır: Discord botunu sunucuya eklemeye gerek yok, kullanıcı
 * kanal ayarlarından bir webhook adresi alıp yapıştırır.
 */
import { db } from '../../db/index.js';
import { eventBus } from '../../core/event-bus.js';
import { baglamOlustur, degiskenleriCoz } from '../../core/variables/index.js';

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

const AYAR_ANAHTARI = 'discord_announce';

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

class DiscordDuyurulari {
  private sonGonderim = new Map<DuyuruKaynagi, number>();

  ayarOku(): DuyuruAyarlari {
    try {
      const r = db.prepare('SELECT value FROM bot_settings WHERE key = ?').get(AYAR_ANAHTARI) as
        | { value: string }
        | undefined;
      if (r?.value) {
        const kayitli = JSON.parse(r.value);
        const birlesik = { ...VARSAYILAN_DUYURU };
        for (const k of Object.keys(birlesik) as DuyuruKaynagi[]) {
          if (kayitli[k]) birlesik[k] = { ...birlesik[k], ...kayitli[k] };
        }
        return birlesik;
      }
    } catch {
      /* bozuk JSON */
    }
    return { ...VARSAYILAN_DUYURU };
  }

  ayarYaz(yeni: Partial<DuyuruAyarlari>): DuyuruAyarlari {
    const mevcut = this.ayarOku();
    for (const k of Object.keys(yeni) as DuyuruKaynagi[]) {
      if (mevcut[k] && yeni[k]) mevcut[k] = { ...mevcut[k], ...yeni[k] };
    }
    db.prepare(
      'INSERT INTO bot_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run(AYAR_ANAHTARI, JSON.stringify(mevcut));
    return mevcut;
  }

  /**
   * Duyuruyu gönderir.
   * `zorla` test düğmesi içindir: bekleme süresini atlar.
   */
  async duyur(
    kaynak: DuyuruKaynagi,
    kanal: string,
    zorla = false
  ): Promise<{ ok: boolean; hata?: string }> {
    const kural = this.ayarOku()[kaynak];
    if (!kural) return { ok: false, hata: 'Bilinmeyen kaynak.' };
    if (!kural.aktif && !zorla) return { ok: false, hata: 'Bu kaynak için duyuru kapalı.' };
    if (!webhookGecerliMi(kural.webhook)) {
      return { ok: false, hata: 'Geçerli bir Discord webhook adresi girilmemiş.' };
    }

    if (!zorla && kural.beklemeDk > 0) {
      const son = this.sonGonderim.get(kaynak) || 0;
      if (Date.now() - son < kural.beklemeDk * 60000) {
        return { ok: false, hata: 'Bekleme süresi dolmadı.' };
      }
    }

    // Şablon tam değişken motorundan geçer
    const sahte: any = {
      platform: kaynak,
      channel: kanal || '',
      user: { username: kanal || 'yayinci', displayName: kanal || 'Yayıncı', isBroadcaster: true },
      message: '',
      timestamp: Date.now()
    };

    let metin: string;
    try {
      metin = await degiskenleriCoz(kural.sablon, baglamOlustur(sahte, [], `discord:${kaynak}`));
    } catch {
      metin = kural.sablon;
    }

    const govde = etiketOneki(kural.etiket) + metin;
    if (!govde.trim()) return { ok: false, hata: 'Boş mesaj.' };

    try {
      const r = await fetch(kural.webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: govde.slice(0, 1900),
          // Etiket ayarı kapalıyken şablonda @everyone yazsa bile ping ATMASIN
          allowed_mentions:
            kural.etiket === 'yok' ? { parse: [] } : { parse: [kural.etiket === 'here' ? 'everyone' : 'everyone'] }
        }),
        signal: AbortSignal.timeout(8000)
      });

      if (!r.ok) return { ok: false, hata: `Discord ${r.status}` };
      this.sonGonderim.set(kaynak, Date.now());
      return { ok: true };
    } catch (e: any) {
      return { ok: false, hata: String(e?.message || e).slice(0, 120) };
    }
  }

  baglaOlaylar() {
    // Yayın başlangıcı olayı henüz platform adaptörlerinde yok
    // (KNOWN_LIMITATIONS). Şimdilik elle/API ile tetiklenir; olay eklenince
    // burası otomatik çalışır.
    eventBus.on('stream_online', (p: any) => {
      const kaynak = String(p?.platform || '').toLowerCase() as DuyuruKaynagi;
      if (kaynak) void this.duyur(kaynak, p?.channel || '');
    });
  }
}

export const discordDuyuru = new DiscordDuyurulari();
export default discordDuyuru;
