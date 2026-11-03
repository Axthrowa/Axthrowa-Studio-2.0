/**
 * AxBoT — İzleyici Kuyruğu
 * Developed by AxthrowA
 *
 * BotRix'te `/panel/interaction > İzleyici Kuyruğu` (BETA) ve on komut
 * belgelenmiş: `!joinq` `!leaveq` `!posq` `!queue`/`!listq` ve moderatör
 * komutları `!openq` `!closeq` `!nextq` `!removeq` `!clearq`
 * (BOTRIX_UI_INVENTORY §13.1). Bizde hiç yoktu.
 *
 * Saf mantık: sıra bellekte + diskte tutulur, komutlar buradan beslenir.
 */
import { db } from '../../db/index.js';
import { degisinceBildir, durumYayinci } from '../../core/state-push.js';

export * from './queue-order.js';
import { sirala, VARSAYILAN_KUYRUK, type KuyrukAyarlari, type KuyrukKaydi } from './queue-order.js';

const AYAR_ANAHTARI = 'queue_settings';

class KuyrukMotoru {
  constructor() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS viewer_queue (
        kullanici   TEXT PRIMARY KEY,
        gorunen_ad  TEXT NOT NULL,
        platform    TEXT NOT NULL DEFAULT '',
        katilma     INTEGER NOT NULL,
        oncelikli   INTEGER NOT NULL DEFAULT 0
      );
    `);
  }

  ayarOku(): KuyrukAyarlari {
    try {
      const r = db.prepare('SELECT value FROM bot_settings WHERE key = ?').get(AYAR_ANAHTARI) as
        | { value: string }
        | undefined;
      if (r?.value) return { ...VARSAYILAN_KUYRUK, ...JSON.parse(r.value) };
    } catch {
      /* bozuk JSON */
    }
    return { ...VARSAYILAN_KUYRUK };
  }

  ayarYaz(yeni: Partial<KuyrukAyarlari>): KuyrukAyarlari {
    const birlesik = { ...this.ayarOku(), ...yeni };
    db.prepare(
      'INSERT INTO bot_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run(AYAR_ANAHTARI, JSON.stringify(birlesik));
    return birlesik;
  }

  liste(): KuyrukKaydi[] {
    const r = db.prepare('SELECT * FROM viewer_queue').all() as any[];
    const kayitlar = r.map((x) => ({
      kullanici: x.kullanici,
      gorunenAd: x.gorunen_ad,
      platform: x.platform,
      katilma: x.katilma,
      oncelikli: !!x.oncelikli
    }));
    return sirala(kayitlar, this.ayarOku().oncelikVar);
  }

  /** 1 tabanlı sıra; kuyrukta değilse 0. */
  sira(kullanici: string): number {
    const ad = String(kullanici || '').toLowerCase();
    return this.liste().findIndex((k) => k.kullanici === ad) + 1;
  }

  katil(
    kullanici: string,
    gorunenAd: string,
    platform: string,
    roller: { isSub?: boolean; isVip?: boolean; isMod?: boolean; isBroadcaster?: boolean } = {},
    zorla = false
  ): { ok: true; sira: number } | { ok: false; hata: string } {
    const a = this.ayarOku();
    if (!a.acik && !zorla) return { ok: false, hata: 'Kuyruk şu an kapalı.' };

    const ad = String(kullanici || '').toLowerCase();
    if (!ad) return { ok: false, hata: 'Kullanıcı adı yok.' };

    const mevcutSira = this.sira(ad);
    if (mevcutSira > 0) return { ok: false, hata: `Zaten kuyruktasın (sıra ${mevcutSira}).` };

    if (a.soloAbone && !zorla && !roller.isSub && !roller.isMod && !roller.isBroadcaster) {
      return { ok: false, hata: 'Kuyruk yalnız abonelere açık.' };
    }

    if (a.maksKisi > 0 && this.liste().length >= a.maksKisi) {
      return { ok: false, hata: `Kuyruk dolu (${a.maksKisi} kişi).` };
    }

    db.prepare(
      'INSERT INTO viewer_queue (kullanici, gorunen_ad, platform, katilma, oncelikli) VALUES (?,?,?,?,?)'
    ).run(ad, gorunenAd || kullanici, platform || '', Date.now(), a.oncelikVar && (roller.isSub || roller.isVip) ? 1 : 0);

    return { ok: true, sira: this.sira(ad) };
  }

  ayril(kullanici: string): boolean {
    return db.prepare('DELETE FROM viewer_queue WHERE kullanici = ?').run(String(kullanici).toLowerCase()).changes > 0;
  }

  /** Sıradaki kişiyi alır ve kuyruktan çıkarır. */
  sonraki(): KuyrukKaydi | null {
    const l = this.liste();
    if (!l.length) return null;
    this.ayril(l[0].kullanici);
    return l[0];
  }

  temizle(): number {
    const n = this.liste().length;
    db.prepare('DELETE FROM viewer_queue').run();
    return n;
  }

  ac(): KuyrukAyarlari {
    return this.ayarYaz({ acik: true });
  }

  kapat(): KuyrukAyarlari {
    return this.ayarYaz({ acik: false });
  }
}

export const kuyruk = new KuyrukMotoru();

// Durum değişince panele anında yayınla (yoklama yerine)
degisinceBildir(
  kuyruk,
  ['katil', 'ayril', 'sonraki', 'temizle', 'ac', 'kapat', 'ayarYaz'],
  durumYayinci('kuyruk_durumu', () => ({ liste: kuyruk.liste(), ayar: kuyruk.ayarOku() }))
);
export default kuyruk;
