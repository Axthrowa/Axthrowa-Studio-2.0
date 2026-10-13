/**
 * StreamAxT — sohbet tarafı olay mesajları
 * Developed by AxthrowA
 *
 * BotRix'te `Sohbet Botu > Ekstralar > Sohbet uyarıları` başlığı altında,
 * görsel overlay'den TAMAMEN AYRI bir sistem var: bir olay olduğunda
 * sohbete metin mesajı gönderiyor. Olaylar ve eşikleri gözlemlendi
 * (BOTRIX_ALERT_MATRIX §1.3): Takip, KICKs (min. tutar), Abonelik,
 * Yeniden abonelik, Hediye abonelik, Host (min. izleyici), Karşılama.
 *
 * Bizde bu hiç yoktu: olaylar yalnız overlay'de görünüyordu, sohbette
 * hiçbir şey yazılmıyordu.
 *
 * Şablonlar tam değişken motorunu kullanır: `$(sender)`, `$(amount)`,
 * `<ifKick>` vb. hepsi çalışır.
 */
import { db } from '../../db/index.js';
import { hediyeAdedi, eventBus } from '../../core/event-bus.js';
import { baglamOlustur, degiskenleriCoz } from '../../core/variables/index.js';

export type SohbetOlayi = 'follow' | 'sub' | 'resub' | 'gift_sub' | 'tip' | 'kicks' | 'host' | 'raid' | 'welcome';

export interface OlayKurali {
  aktif: boolean;
  sablon: string;
  /** Olay değeri bu eşiğin altındaysa mesaj gönderilmez. */
  minDeger: number;
  /** Aynı olay için art arda mesaj yağmasını engeller (saniye). */
  beklemeSn: number;
}

export type ChatAlertAyarlari = Record<SohbetOlayi, OlayKurali>;

const K = (sablon: string, minDeger = 0, aktif = false, beklemeSn = 0): OlayKurali => ({
  aktif,
  sablon,
  minDeger,
  beklemeSn
});

export const VARSAYILAN_CHAT_ALERT: ChatAlertAyarlari = {
  follow: K('💜 $(sender) kanalı takip etti, hoş geldin!'),
  sub: K('⭐ $(sender) abone oldu! Teşekkürler!'),
  resub: K('⭐ $(sender) aboneliğini $(v1). ay yeniledi!'),
  gift_sub: K('🎁 $(sender) $(v1) kişiye abonelik hediye etti!'),
  tip: K('💰 $(sender) $(v1) bağış yaptı, çok teşekkürler!'),
  kicks: K('🟢 $(sender) $(v1) KICKs gönderdi!', 0),
  host: K('🚀 $(sender) $(v1) izleyiciyle kanalı host etti!', 0),
  raid: K('🚀 $(sender) $(v1) izleyiciyle raid yaptı!', 0),
  // İlk kez yazan izleyiciyi karşılama — BotRix'te premium
  welcome: K('👋 Aramıza hoş geldin $(sender)!', 0, false, 0)
};

const AYAR_ANAHTARI = 'chat_alert_settings';

/** Eşik kontrolü: değer yoksa 0 sayılır. */
export function esikGecer(kural: OlayKurali, deger: number): boolean {
  return Math.max(0, Number(deger) || 0) >= Math.max(0, Number(kural.minDeger) || 0);
}

class SohbetUyarilari {
  private sonGonderim = new Map<SohbetOlayi, number>();
  /** Karşılama için: bu yayında kim konuştu? */
  private gorulenler = new Set<string>();

  ayarOku(): ChatAlertAyarlari {
    try {
      const r = db.prepare('SELECT value FROM bot_settings WHERE key = ?').get(AYAR_ANAHTARI) as
        | { value: string }
        | undefined;
      if (r?.value) {
        const kayitli = JSON.parse(r.value);
        const birlesik = { ...VARSAYILAN_CHAT_ALERT };
        for (const k of Object.keys(birlesik) as SohbetOlayi[]) {
          if (kayitli[k]) birlesik[k] = { ...birlesik[k], ...kayitli[k] };
        }
        return birlesik;
      }
    } catch {
      /* bozuk JSON */
    }
    return { ...VARSAYILAN_CHAT_ALERT };
  }

  ayarYaz(yeni: Partial<ChatAlertAyarlari>): ChatAlertAyarlari {
    const mevcut = this.ayarOku();
    for (const k of Object.keys(yeni) as SohbetOlayi[]) {
      if (mevcut[k] && yeni[k]) mevcut[k] = { ...mevcut[k], ...yeni[k] };
    }
    db.prepare(
      'INSERT INTO bot_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run(AYAR_ANAHTARI, JSON.stringify(mevcut));
    return mevcut;
  }

  private async gonder(olay: SohbetOlayi, p: any, deger: number, ekArgs: string[] = []) {
    const kural = this.ayarOku()[olay];
    if (!kural?.aktif || !kural.sablon?.trim()) return;
    if (!esikGecer(kural, deger)) return;

    const simdi = Date.now();
    if (kural.beklemeSn > 0) {
      const son = this.sonGonderim.get(olay) || 0;
      if (simdi - son < kural.beklemeSn * 1000) return;
    }
    this.sonGonderim.set(olay, simdi);

    // Şablon tam değişken motorundan geçer
    const sahteMesaj: any = {
      platform: p?.platform || 'kick',
      channel: p?.channel || '',
      user: {
        username: p?.username || 'izleyici',
        displayName: p?.displayName || p?.username || 'İzleyici',
        isBroadcaster: false,
        isMod: false,
        isSub: false,
        isVip: false
      },
      message: '',
      timestamp: simdi
    };

    try {
      const ctx = baglamOlustur(sahteMesaj, ekArgs, `chatalert:${olay}`);
      const metin = await degiskenleriCoz(kural.sablon, ctx);
      if (!metin.trim()) return;

      eventBus.emitBotMessage({
        platform: sahteMesaj.platform,
        channel: sahteMesaj.channel,
        message: metin
      });
    } catch (e: any) {
      console.warn(`[SohbetUyarısı] ${olay} gönderilemedi:`, e?.message || e);
    }
  }

  /** İlk kez yazan izleyiciyi karşıla. */
  sohbetMesaji(username: string, p: any) {
    const kural = this.ayarOku().welcome;
    if (!kural?.aktif) return;
    const ad = String(username || '').toLowerCase();
    if (!ad || this.gorulenler.has(ad)) return;
    this.gorulenler.add(ad);
    void this.gonder('welcome', p, 0);
  }

  baglaOlaylar() {
    eventBus.on('follow', (p: any) => void this.gonder('follow', p, 0));

    eventBus.on('sub', (p: any) => {
      if (p?.isGift) {
        const adet = hediyeAdedi(p);
        void this.gonder('gift_sub', p, adet, [String(adet)]);
      } else if (Number(p?.months) > 1) {
        void this.gonder('resub', p, Number(p.months), [String(p.months)]);
      } else {
        void this.gonder('sub', p, 0);
      }
    });

    eventBus.on('tip', (p: any) =>
      void this.gonder('tip', p, Number(p?.amount) || 0, [`${p?.amount || 0}${p?.currency || ''}`])
    );

    eventBus.on('kicks', (p: any) =>
      void this.gonder('kicks', p, Number(p?.amount) || 0, [String(p?.amount || 0)])
    );

    eventBus.on('host', (p: any) =>
      void this.gonder('host', p, Number(p?.viewers) || 0, [String(p?.viewers || 0)])
    );

    eventBus.on('raid', (p: any) =>
      void this.gonder('raid', p, Number(p?.viewers) || 0, [String(p?.viewers || 0)])
    );
  }

  /** Yayın başında karşılama listesi sıfırlanır. */
  yayinSifirla() {
    this.gorulenler.clear();
  }
}

export const sohbetUyarilari = new SohbetUyarilari();
export default sohbetUyarilari;
