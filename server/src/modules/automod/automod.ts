import { db } from '../../db/index.js';
import { ChatMessagePayload } from '../../core/event-bus.js';
import { commandManager } from '../commands/command-manager.js';

export interface AutoModViolation {
  rule: 'caps' | 'emotes' | 'links' | 'symbols' | 'blacklist' | 'ai_toxic';
  reason: string;
  matchedText?: string;
}

export class AutoModEngine {
  private cachedSettings: any = null;
  private blacklistCache: string[] = [];
  private whitelistCache: string[] = [];
  private lastLoadTime: number = 0;

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

    return null;
  }
}

export const autoMod = new AutoModEngine();
export default autoMod;
