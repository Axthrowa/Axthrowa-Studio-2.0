/**
 * AxBoT — Discord duyuruları
 * Developed by AxthrowA
 *
 * Örnek alınan botta `/panel/integrations` platform bağlantısı DEĞİL, Discord duyuru
 * otomasyonudur: Twitch/YouTube Live/YouTube Videos/TikTok/Kick için yayına
 * başlayınca veya içerik paylaşınca Discord'a mesaj atar
 * (rakip incelemesi). Bizde hiç yoktu.
 *
 * Webhook kullanılır: Discord botunu sunucuya eklemeye gerek yok, kullanıcı
 * kanal ayarlarından bir webhook adresi alıp yapıştırır.
 */
import { db } from '../../db/index.js';
import { coz, sifreleHepsi } from '../../core/security/vault.js';
import { eventBus } from '../../core/event-bus.js';
import { baglamOlustur, degiskenleriCoz } from '../../core/variables/index.js';

export * from './discord-rules.js';
import {
  VARSAYILAN_DUYURU,
  webhookGecerliMi,
  etiketOneki,
  zatenDuyuruldu,
  type DuyuruAyarlari,
  type DuyuruKaynagi,
  type DuyuruKurali
} from './discord-rules.js';

const AYAR_ANAHTARI = 'discord_announce';



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
          // Webhook adresi JSON içinde şifreli durur (S6)
          birlesik[k].webhook = String(coz(birlesik[k].webhook) ?? '');
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
    // Diske yazarken webhook adresleri şifrelenir; döndürülen nesne düz kalır
    const anahtarlar = Object.keys(mevcut) as DuyuruKaynagi[];
    const sifreli = sifreleHepsi(anahtarlar.map((k) => mevcut[k].webhook)); // tek PowerShell çağrısı
    const disk: Record<string, DuyuruKurali> = {};
    anahtarlar.forEach((k, i) => {
      disk[k] = { ...mevcut[k], webhook: String(sifreli[i] ?? '') };
    });
    db.prepare(
      'INSERT INTO bot_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run(AYAR_ANAHTARI, JSON.stringify(disk));
    return mevcut;
  }

  /**
   * Duyuruyu gönderir.
   * `zorla` test düğmesi içindir: bekleme süresini atlar.
   */
  /** Otomasyon: yayın duyurusu için girilmiş ilk geçerli webhook'a düz metin yazar; kimse etiketlenmez */
  async metinGonder(metin: string): Promise<void> {
    const webhook = Object.values(this.ayarOku()).find((k) => webhookGecerliMi(k.webhook))?.webhook;
    if (!webhook) throw new Error('Discord webhook adresi girilmemiş (Bağlantılar › Discord duyuruları)');
    const r = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: metin.slice(0, 1900), allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(15000)
    });
    if (!r.ok) throw new Error(`Discord yanıtı: ${r.status}`);
  }

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

    const istek = () =>
      fetch(kural.webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: govde.slice(0, 1900),
          // Etiket ayarı kapalıyken şablonda @everyone yazsa bile ping ATMASIN
          // Discord'da @here de "everyone" izniyle çalışır (allowed_mentions)
          allowed_mentions: kural.etiket === 'yok' ? { parse: [] } : { parse: ['everyone'] }
        }),
        // 8 sn yetmiyordu: bazı ağlarda yalnız DNS 4–12 sn sürüyordu (core/dns-hizli.ts)
        signal: AbortSignal.timeout(15000)
      });

    // Ağ hatasında (yanıt hiç gelmedi) bir kez daha denenir; Discord yanıt
    // verdiyse (4xx/5xx) tekrar denenmez — çift mesaj riski olmasın.
    for (let deneme = 1; deneme <= 2; deneme++) {
      try {
        const r = await istek();
        if (r.status === 429) return { ok: false, hata: 'Discord hız sınırı (429) — biraz sonra tekrar dene.' };
        if (r.status === 401 || r.status === 404) {
          return { ok: false, hata: `Discord ${r.status}: webhook silinmiş ya da adres yanlış — kanaldan yeni webhook kopyala.` };
        }
        if (!r.ok) return { ok: false, hata: `Discord ${r.status}` };
        this.sonGonderim.set(kaynak, Date.now());
        return { ok: true };
      } catch (e: any) {
        if (deneme === 2) {
          const m = String(e?.message || e);
          return { ok: false, hata: /timeout|aborted/i.test(m) ? "Discord'a 15 sn içinde ulaşılamadı (ağ/DNS)." : m.slice(0, 120) };
        }
      }
    }
    return { ok: false, hata: 'Gönderilemedi.' };
  }

  private sonYayinAnahtari(kaynak: DuyuruKaynagi) {
    return `discord_son_yayin_${kaynak}`;
  }

  /**
   * Yayın açılınca otomatik duyuru.
   *
   * Önceki sürümde bu dinleyici YAZILMIŞ ama HİÇ BAĞLANMAMIŞTI (index.ts
   * çağırmıyordu) ve Kick/Twitch/YouTube `stream_online` üretmiyordu —
   * otomatik duyuru hiç çalışmıyordu, yalnız "Test" düğmesi çalışıyordu.
   * Artık canlı durum servisi (live-status.ts) olayı üretiyor.
   */
  baglaOlaylar() {
    eventBus.on('stream_online', async (p: any) => {
      const kaynak = String(p?.platform || '').toLowerCase() as DuyuruKaynagi;
      if (!kaynak || !this.ayarOku()[kaynak]) return;

      const anahtar = this.sonYayinAnahtari(kaynak);
      const onceki = (db.prepare('SELECT value FROM bot_settings WHERE key = ?').get(anahtar) as { value?: string } | undefined)
        ?.value;
      if (zatenDuyuruldu(p?.yayinId, onceki)) return;

      const r = await this.duyur(kaynak, p?.channel || '');
      if (r.ok) {
        if (p?.yayinId) {
          db.prepare(
            'INSERT INTO bot_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
          ).run(anahtar, String(p.yayinId));
        }
        console.log(`[Discord] ${kaynak} yayını duyuruldu.`);
      } else if (r.hata && !/kapalı/.test(r.hata)) {
        console.warn(`[Discord] ${kaynak} duyurusu gönderilemedi:`, r.hata);
      }
    });
  }
}

export const discordDuyuru = new DiscordDuyurulari();
export default discordDuyuru;
