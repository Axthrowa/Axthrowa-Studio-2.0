/**
 * AxBoT — sohbet tarafı olay mesajları
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
import { rastgeleFarkli, takipAdaylari, takipMetinleriCoz, takipTemalariCoz, TAKIP_TEMA_ADLARI, temaAdaylari, TEMA_ADLARI } from './temalar.js';

export type SohbetOlayi = 'follow' | 'sub' | 'resub' | 'gift_sub' | 'tip' | 'kicks' | 'host' | 'raid' | 'welcome' | 'stream_online';

export interface OlayKurali {
  aktif: boolean;
  sablon: string;
  /** Olay değeri bu eşiğin altındaysa mesaj gönderilmez. */
  minDeger: number;
  /** Aynı olay için art arda mesaj yağmasını engeller (saniye). */
  beklemeSn: number;
  /** Ek şablonlar: olay her geldiğinde şablon + bunlardan rastgele biri gider */
  varyantlar?: string[];
  /** Yalnız takip: Kick adı vermediğinde de karşıla ("Yeni takipçi" diye). Boş: evet */
  adsizKarsila?: boolean;
}

/** Adı bilinmeyen takipçi dalgasında sohbet dolmasın */
const ADSIZ_KARSILAMA_ARASI_MS = 30_000;

export type ChatAlertAyarlari = Record<SohbetOlayi, OlayKurali>;

const K = (sablon: string, minDeger = 0, aktif = false, beklemeSn = 0): OlayKurali => ({
  aktif,
  sablon,
  minDeger,
  beklemeSn
});

export const VARSAYILAN_CHAT_ALERT: ChatAlertAyarlari = {
  follow: K('💜 $(sender) kanalı takip etti, hoş geldin!', 0, true),
  sub: K('⭐ $(sender) abone oldu! Teşekkürler!'),
  resub: K('⭐ $(sender) aboneliğini $(v1). ay yeniledi!'),
  gift_sub: K('🎁 $(sender) $(v1) kişiye abonelik hediye etti!'),
  tip: K('💰 $(sender) $(v1) bağış yaptı, çok teşekkürler!'),
  kicks: K('🟢 $(sender) $(v1) KICKs gönderdi!', 0),
  host: K('🚀 $(sender) $(v1) izleyiciyle kanalı host etti!', 0),
  raid: K('🚀 $(sender) $(v1) izleyiciyle raid yaptı!', 0),
  // İlk kez yazan izleyiciyi karşılama — BotRix'te premium
  welcome: K('👋 Aramıza hoş geldin $(sender)!', 0, false, 0),
  // Yayın başlayınca sohbete duyuru (yaygın botlarda 'Live Announcement')
  stream_online: K('🔴 Yayın başladı! $(title) — gel izle: $(platformurl)', 0, false, 0)
};

const AYAR_ANAHTARI = 'chat_alert_settings';
const TEMA_ANAHTARI = 'chat_alert_tema';
const TAKIP_TEMA_ANAHTARI = 'chat_alert_takip_temalari';
const TAKIP_METIN_ANAHTARI = 'takip_karsilama_metinleri';

/** Eşik kontrolü: değer yoksa 0 sayılır. */
export function esikGecer(kural: OlayKurali, deger: number): boolean {
  return Math.max(0, Number(deger) || 0) >= Math.max(0, Number(kural.minDeger) || 0);
}

class SohbetUyarilari {
  private sonGonderim = new Map<SohbetOlayi, number>();
  /** Son gönderilen şablon (aynısı art arda gelmesin) */
  private sonSablon = new Map<SohbetOlayi, string>();

  /** Seçili tema ('yok' = kendi şablonların) */
  temaOku(): string {
    try {
      const r = db.prepare('SELECT value FROM bot_settings WHERE key = ?').get(TEMA_ANAHTARI) as { value?: string } | undefined;
      const t = String(r?.value || 'yok');
      return t in TEMA_ADLARI ? t : 'yok';
    } catch {
      return 'yok';
    }
  }

  temaYaz(tema: string): string {
    const t = tema in TEMA_ADLARI ? tema : 'yok';
    db.prepare('INSERT INTO bot_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(TEMA_ANAHTARI, t);
    return t;
  }

  /** Karşılamada seçili temalar (boş: genel tema ya da kendi şablonun) */
  takipTemalariOku(): string[] {
    const r = db.prepare('SELECT value FROM bot_settings WHERE key = ?').get(TAKIP_TEMA_ANAHTARI) as { value?: string } | undefined;
    const sablon = this.ayarOku().follow.sablon;
    return takipTemalariCoz(r?.value, sablon !== VARSAYILAN_CHAT_ALERT.follow.sablon || this.temaOku() !== 'yok');
  }

  takipTemalariYaz(temalar: unknown): string[] {
    const secili = (Array.isArray(temalar) ? temalar : []).filter((t) => typeof t === 'string' && t in TAKIP_TEMA_ADLARI);
    db.prepare('INSERT INTO bot_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(TAKIP_TEMA_ANAHTARI, JSON.stringify(secili));
    return secili;
  }

  /** Panelde düzenlenen karşılama metinleri (tema → liste) */
  takipMetinleriOku(): Record<string, string[]> {
    const r = db.prepare('SELECT value FROM bot_settings WHERE key = ?').get(TAKIP_METIN_ANAHTARI) as { value?: string } | undefined;
    return takipMetinleriCoz(r?.value);
  }

  /** `metinler` null: temayı gömülü metinlere döndürür */
  takipMetinleriYaz(tema: string, metinler: unknown): Record<string, string[]> {
    if (!(tema in TAKIP_TEMA_ADLARI)) return this.takipMetinleriOku();
    const hepsi = this.takipMetinleriOku();
    if (Array.isArray(metinler)) hepsi[tema] = metinler.map(String);
    else delete hepsi[tema];
    const temiz = takipMetinleriCoz(hepsi);
    db.prepare('INSERT INTO bot_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(TAKIP_METIN_ANAHTARI, JSON.stringify(temiz));
    return temiz;
  }

  /** Bu olay için gönderilecek şablon: tema seçiliyse temadan, değilse şablon + varyantlar */
  sablonSec(olay: SohbetOlayi, kural: OlayKurali): string | undefined {
    const tema = this.temaOku();
    let adaylar = olay === 'follow' ? takipAdaylari(this.takipTemalariOku(), this.takipMetinleriOku()) : [];
    if (!adaylar.length) adaylar = tema !== 'yok' ? temaAdaylari(tema, olay) : [];
    if (!adaylar.length) adaylar = [kural.sablon, ...(Array.isArray(kural.varyantlar) ? kural.varyantlar : [])].map((x) => String(x || '').trim()).filter(Boolean);
    const secilen = rastgeleFarkli(adaylar, this.sonSablon.get(olay));
    if (secilen) this.sonSablon.set(olay, secilen);
    return secilen;
  }
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
      // Varyantlar: metin listesi, en çok 20 × 400 karakter
      if (mevcut[k] && yeni[k] && 'varyantlar' in (yeni[k] as object)) {
        const v = (yeni[k] as any).varyantlar;
        mevcut[k].varyantlar = (Array.isArray(v) ? v : String(v || '').split(/\r?\n/))
          .map((x: unknown) => String(x ?? '').trim().slice(0, 400))
          .filter(Boolean)
          .slice(0, 20);
      }
    }
    db.prepare(
      'INSERT INTO bot_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run(AYAR_ANAHTARI, JSON.stringify(mevcut));
    return mevcut;
  }

  private async gonder(olay: SohbetOlayi, p: any, deger: number, ekArgs: string[] = []) {
    // Test uyarısı gerçek Kick sohbetine sahte kullanıcı için teşekkür yazmasın
    if (p?.isTest === true) return;
    const kural = this.ayarOku()[olay];
    if (!kural?.aktif) return;
    if (!esikGecer(kural, deger)) return;

    const simdi = Date.now();
    // Kick çoğu takipte adı vermez, yalnız sayı artar: "Yeni takipçi" diye karşılanır (kapatılabilir)
    if (p?.anonim === true && (olay !== 'follow' || kural.adsizKarsila === false || simdi - (this.sonGonderim.get(olay) || 0) < ADSIZ_KARSILAMA_ARASI_MS)) return;
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
      const sablon = this.sablonSec(olay, kural);
      if (!sablon) return;
      const metin = await degiskenleriCoz(sablon, ctx);
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

  /** Aynı yayın için duyuru bir kez (bot yeniden başlasa da). */
  private duyurulanYayinlar = new Set<string>();

  baglaOlaylar() {
    // Bot yayın ORTASINDA açıldıysa (ilk gözlem) duyurma: yeniden başlatma sohbete tekrar 'yayın başladı' yazmasın
    eventBus.on('stream_online', (p: any) => {
      if (p?.ilkGozlem) return;
      const kimlik = `${p?.platform}:${p?.yayinId || p?.baslangic || ''}`;
      if (this.duyurulanYayinlar.has(kimlik)) return;
      this.duyurulanYayinlar.add(kimlik);
      void this.gonder('stream_online', { platform: p?.platform, channel: p?.channel, username: p?.channel, displayName: p?.channel }, 0);
    });

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
      void this.gonder('tip', p, Number(p?.amount) || 0, [`${p?.amount || 0} ${p?.currency || ''}`.trim()])
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
