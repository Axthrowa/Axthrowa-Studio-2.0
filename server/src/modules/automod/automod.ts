import { db } from '../../db/index.js';
import { ChatMessagePayload, eventBus } from '../../core/event-bus.js';
import { commandManager } from '../commands/command-manager.js';
import { platformManager } from '../../platforms/manager.js';
import {
  bypassEder,
  eylemPlani,
  kuralAyariOku,
  sureyiYaz,
  type KuralAdi
} from './enforcement.js';
import { TekrarIzleyici } from './repeat.js';

export interface AutoModViolation {
  rule: 'caps' | 'emotes' | 'links' | 'symbols' | 'blacklist' | 'repeat' | 'ai_toxic';
  reason: string;
  matchedText?: string;
}

export class AutoModEngine {
  private cachedSettings: any = null;
  private blacklistCache: string[] = [];
  private whitelistCache: string[] = [];
  private lastLoadTime: number = 0;
  private tekrar = new TekrarIzleyici();

  reload() {
    try {
      const row = db.prepare('SELECT * FROM automod_settings WHERE id = 1').get() as any;
      if (row) {
        this.cachedSettings = row;
        this.blacklistCache = JSON.parse(row.blacklist_words || '[]').filter((w: string) => Boolean(w && w.trim())).map((w: string) => w.trim().toLowerCase());
        this.whitelistCache = JSON.parse(row.links_whitelist || '[]').filter((w: string) => Boolean(w && w.trim())).map((w: string) => w.trim().toLowerCase());
      }
    } catch {
      this.cachedSettings = null;
    }
  }

  private getSettings() {
    if (!this.cachedSettings || Date.now() - this.lastLoadTime > 60000) {
      this.reload();
      this.lastLoadTime = Date.now();
    }
    return this.cachedSettings;
  }

  checkMessage(message: ChatMessagePayload): AutoModViolation | null {
    // Broadcaster and moderators bypass AutoMod
    if (message.user.isBroadcaster || message.user.isMod) {
      return null;
    }

    const row = this.getSettings();
    if (!row) return null;

    let advanced: any = {};
    try {
      const adv = db.prepare("SELECT value FROM bot_settings WHERE key = 'automod_advanced'").get() as { value: string } | undefined;
      advanced = adv?.value ? JSON.parse(adv.value) : {};
    } catch {}

    if (advanced.caps_exclude_subs && message.user.isSub) { /* skip later per-rule */ }
    if (advanced.name_enabled) {
      const uname = message.user.username.toLowerCase();
      const words: string[] = advanced.name_words || [];
      if (words.some((w: string) => uname.includes(String(w).toLowerCase()))) {
        return { rule: 'blacklist', reason: advanced.name_warning || 'Kullanıcı adı kurala uymuyor.' };
      }
      if (advanced.name_regex) {
        try {
          if (new RegExp(advanced.name_regex, 'i').test(uname)) {
            return { rule: 'blacklist', reason: advanced.name_warning || 'Kullanıcı adı kurala uymuyor.' };
          }
        } catch {}
      }
    }

    const text = message.message.trim();
    if (!text) return null;

    // Tekrar sayacı HER mesajı kaydeder (başka kural yakalasa da): spamcı
    // büyük harfle/küçük harfle dönüşümlü yazınca sayım kaçmasın. Karar
    // aşağıda, başka kural ihlal bulmazsa verilir.
    const tekrarAcik = !!row.repeat_enabled && !(advanced.repeat_exclude_subs && message.user.isSub);
    const tekrarSayisi = tekrarAcik
      ? this.tekrar.kaydet(message.user.username, text, (Number(row.repeat_window) || 30) * 1000)
      : 0;

    // 1. Fast Blacklisted Words Filter (in-memory)
    if (!(advanced.blacklist_exclude_subs && message.user.isSub)) {
    const lowerText = text.toLowerCase();
    for (const badWord of this.blacklistCache) {
      if (lowerText.includes(badWord)) {
        return {
          rule: 'blacklist',
          reason: advanced.blacklist_warning || 'Yasaklı kelime kullanımı tespit edildi.',
          matchedText: badWord
        };
      }
    }
    }

    // 2. Links / URL Protection
    if (row.links_enabled && !(advanced.links_exclude_subs && message.user.isSub) && !commandManager.isPermitted(message.user.username)) {
      const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.(com|net|org|io|gg|tv|xyz|info|ru|me)[\/\w-]*)/gi;
      const matches = text.match(urlRegex);
      if (matches && matches.length > 0) {
        const isWhitelisted = matches.every(url => {
          const lowerUrl = url.toLowerCase();
          return this.whitelistCache.some(domain => lowerUrl.includes(domain));
        });

        if (!isWhitelisted) {
          return {
            rule: 'links',
            reason: advanced.links_warning || 'İzinsiz link/bağlantı paylaşımı yasaktır.',
            matchedText: matches[0]
          };
        }
      }
    }

    // 3. Excessive Caps Filter
    if (row.caps_enabled && text.length >= row.caps_min_length && !(advanced.caps_exclude_subs && message.user.isSub)) {
      let upperCount = 0;
      let letterCount = 0;

      for (const char of text) {
        if (/[a-zA-ZğüşıöçĞÜŞİÖÇ]/.test(char)) {
          letterCount++;
          if (char === char.toUpperCase()) {
            upperCount++;
          }
        }
      }

      if (letterCount > 0) {
        const percent = (upperCount / letterCount) * 100;
        if (percent >= row.caps_max_percent) {
          return {
            rule: 'caps',
            reason: advanced.caps_warning || 'Aşırı büyük harf (CAPS LOCK) kullanımı tespit edildi.'
          };
        }
      }
    }

    // 4. Excessive Emotes Filter
    if (row.emotes_enabled && !(advanced.emotes_exclude_subs && message.user.isSub)) {
      // Check unicode emojis
      const emojiRegex = /(\p{Extended_Pictographic}|\p{Emoji_Presentation})/gu;
      const emojis = text.match(emojiRegex);
      const emojiCount = emojis ? emojis.length : 0;
      if (emojiCount > row.emotes_max) {
        return {
          rule: 'emotes',
          reason: advanced.emotes_warning || `Çok fazla emoji kullanımı (${emojiCount}/${row.emotes_max}).`
        };
      }
    }

    // 5. Excessive Symbols Filter
    if (row.symbols_enabled && text.length >= (advanced.symbols_min_length || 8) && !(advanced.symbols_exclude_subs && message.user.isSub)) {
      const symbolRegex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/g;
      const symbols = text.match(symbolRegex);
      if (symbols) {
        const symbolPercent = (symbols.length / text.length) * 100;
        if (symbolPercent >= row.symbols_max_percent) {
          return {
            rule: 'symbols',
            reason: advanced.symbols_warning || 'Aşırı sembol kullanımı tespit edildi.'
          };
        }
      }
    }

    // 6. Tekrarlanan mesaj (B9)
    if (tekrarAcik && tekrarSayisi >= Math.max(2, Number(row.repeat_count) || 3)) {
      this.tekrar.sifirla(message.user.username);
      return {
        rule: 'repeat',
        reason: advanced.repeat_warning || 'Aynı mesajı tekrar tekrar yazma.'
      };
    }

    return null;
  }

  /**
   * Bulunan ihlale gore eylemi uygular.
   *
   * Sira onemli: once bypass kontrolu (yayinci/mod zaten `checkMessage`
   * icinde eleniyor ama abone/VIP muafiyeti burada), sonra platform
   * eylemi, en son sohbet uyarisi.
   */
  async ihlaliUygula(message: ChatMessagePayload, violation: AutoModViolation): Promise<void> {
    const row = this.getSettings();
    const kural = (violation.rule === 'ai_toxic' ? 'blacklist' : violation.rule) as KuralAdi;
    const ayar = kuralAyariOku(row, kural, violation.reason);

    // Rol muafiyeti — BotRix'te her kuralin kendi bypass listesi var
    if (bypassEder(message.user as any, ayar.bypass)) return;

    const plan = eylemPlani(ayar, message.platform);

    // Calisma anindaki basarisizliklar burada toplanir. `eylemPlani` yalnizca
    // platformun YETENEGINI bilir; token eksikligi veya baglanti kopmasi gibi
    // anlik hatalari bilemez. Bu yuzden gercek sonuca gore uyariya dusulur —
    // aksi halde "timeout" secili bir kuralda ihlal SESSIZCE gecerdi.
    let calismaHatasi: string | null = null;

    // 1) Zaman asimi
    if (plan.timeoutSn > 0) {
      const p: any = platformManager.getPlatform(message.platform);
      if (typeof p?.timeoutUser === 'function') {
        const sonuc = await p.timeoutUser(message.user.username, plan.timeoutSn, ayar.mesaj);
        if (sonuc?.ok) {
          this.denetimKaydet(message, violation, `timeout ${sureyiYaz(plan.timeoutSn)}`);
          eventBus.emitBotMessage({
            platform: message.platform,
            channel: message.channel,
            message: `🛡️ @${message.user.displayName} ${sureyiYaz(plan.timeoutSn)} susturuldu: ${ayar.mesaj}`
          });
          return;
        }
        // Basarisizsa sessizce gecme — sebebi panele tasi ve uyariya dus
        calismaHatasi = sonuc?.hata || 'bilinmeyen hata';
        console.warn(`[AutoMod] Zaman asimi uygulanamadi:`, calismaHatasi);
        eventBus.emitSendError(message.platform, `AutoMod zaman asimi uygulanamadi: ${calismaHatasi}`);
      } else {
        calismaHatasi = `${message.platform} adaptorunde zaman asimi uygulanmamis`;
      }
    }

    // 2) Mesaj silme
    if (plan.sil) {
      const p: any = platformManager.getPlatform(message.platform);
      const mesajId = (message as any).id || (message as any).messageId;
      if (typeof p?.deleteMessage === 'function' && mesajId) {
        const sonuc = await p.deleteMessage(String(mesajId));
        if (sonuc?.ok) this.denetimKaydet(message, violation, 'mesaj silindi');
      }
    }

    // 3) Uyari — plan uyari istemese bile eylem uygulanamadiysa uyar.
    if (plan.uyar || calismaHatasi) {
      const sebep = plan.dusurulen || calismaHatasi;
      const ek = sebep ? ` (${sebep})` : '';
      eventBus.emitBotMessage({
        platform: message.platform,
        channel: message.channel,
        message: `🛡️ AutoMod: @${message.user.displayName}, ${ayar.mesaj}${ek}`
      });
      this.denetimKaydet(message, violation, 'uyari');
    }
  }

  /** Denetim kaydi — panelde "Kalkan & Denetim" sekmesinde gorunur. */
  private denetimKaydet(message: ChatMessagePayload, violation: AutoModViolation, eylem: string): void {
    try {
      db.prepare(
        'INSERT INTO audit_logs (timestamp, action, moderator, target, details, severity) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(
        Date.now(),
        `automod:${violation.rule}`,
        'AutoMod',
        message.user.username,
        `${eylem} — ${violation.reason}`,
        violation.rule === 'blacklist' ? 'high' : 'medium'
      );
    } catch {
      /* denetim kaydi kritik degil */
    }
  }
}

export const autoMod = new AutoModEngine();
export default autoMod;
