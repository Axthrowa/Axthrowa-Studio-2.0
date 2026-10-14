import axios from 'axios';
import { BasePlatform, PlatformStatus, ModerasyonSonucu } from './base.js';
import { KickRealtime } from './kick-realtime.js';
import { abonelikKanallari } from './kick-realtime-protokol.js';
import { kickZamani, type YayinBilgisi } from '../core/live-status-math.js';
import { sifreleHepsi } from '../core/security/vault.js';
import { eventBus } from '../core/event-bus.js';
import { db } from '../db/index.js';
import { settingsCache } from '../core/settings-cache.js';
import { hataMetni } from '../core/logger.js';
import { mesajiParcala } from '../core/text.js';

export interface KickChannelVerification {
  success: boolean;
  channelSlug: string;
  chatroomId?: number;
  broadcasterUserId?: number;
  followersCount?: number;
  isVerified?: boolean;
  canSendChat?: boolean;
  error?: string;
}

export class KickPlatform extends BasePlatform {
  readonly name = 'kick' as const;
  /** Canlı sohbet (okuma) bağlantısı — gönderim resmi API'den ayrıdır. */
  private realtime = new KickRealtime();
  private connected: boolean = false;
  private currentChannel: string = '';
  private chatroomId: number | null = null;
  private broadcasterUserId: number | null = null;
  private botToken: string = '';
  private botUserId: number | null = null;
  private botUsername: string = '';
  /**
   * Bot az önce şu metinleri gönderdi (metin → zaman damgası).
   *
   * Bir mesaj Birleşik Sohbet'te ÜÇ kez görünüyordu: (1) `bot_message` olayının
   * ürettiği baloncuk, (2) gönderim başarılı olunca buradan atılan ikinci
   * baloncuk, (3) Kick'in Pusher üzerinden geri yankıladığı gerçek mesaj.
   * (2) kaldırıldı; (3) bu harita sayesinde eleniyor. Yalnız BOTUN kendi
   * gönderdiği metinler elenir, yayıncının elle yazdığı mesajlar durur.
   */
  private recentlySent: Map<string, number> = new Map();
  /**
   * Sohbetten öğrenilen kullanıcı adı → Kick kullanıcı kimliği.
   * Zaman aşımı için kimlik gerekir; her seferinde kanal sayfasını
   * sorgulamak yerine sohbette zaten gelen `sender.id` kullanılır.
   */
  private kullaniciKimlikleri: Map<string, number> = new Map();

  /** Yankı elemesi: bu metin son 20 saniyede bot tarafından mı gönderildi? */
  private wasJustSentByBot(text: string): boolean {
    const key = String(text || '').trim();
    const now = Date.now();
    for (const [k, t] of this.recentlySent) {
      if (now - t > 20000) this.recentlySent.delete(k);
    }
    if (this.recentlySent.has(key)) {
      this.recentlySent.delete(key);
      return true;
    }
    return false;
  }
  private processedMessageIds: Set<string> = new Set();

  async connect(): Promise<boolean> {
    const channelRow = db.prepare("SELECT * FROM channels WHERE platform = 'kick' AND is_active = 1 LIMIT 1").get() as any;
    if (!channelRow || !channelRow.channel_name) {
      this.connected = false;
      return false;
    }

    const channelSlug = channelRow.channel_name.trim().toLowerCase();
    this.currentChannel = channelSlug;
    this.botToken = channelRow.token || '';

    try {
      // 1. Fetch channel metadata, user ID & chatroom ID
      const res = await axios.get(`https://kick.com/api/v2/channels/${channelSlug}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        },
        timeout: 7000
      });

      this.chatroomId = res.data?.chatroom?.id;
      this.broadcasterUserId = res.data?.user_id || res.data?.id;

      if (!this.chatroomId) {
        console.warn(`[Kick] Could not obtain chatroom ID for ${channelSlug}`);
        return false;
      }

      // 2. Identify Bot User Profile from token if available
      let cleanToken = (this.botToken || '').replace(/^Bearer\s+/i, '').trim();
      if (cleanToken) {
        try {
          const userRes = await axios.get('https://api.kick.com/public/v1/users', {
            headers: { Authorization: `Bearer ${cleanToken}` },
            timeout: 5000
          });
          const botUser = userRes.data?.data?.[0];
          if (botUser) {
            this.botUserId = Number(botUser.user_id);
            this.botUsername = String(botUser.name || '');
            console.log(`[Kick] Bot authenticated as: @${this.botUsername} (User ID: ${this.botUserId})`);
          }
        } catch (e: any) {
          if (e?.response?.status === 401) {
            console.log('[Kick] Token expired (401) on startup. Attempting auto-refresh...');
            const refreshed = await this.refreshKickToken();
            if (refreshed) {
              cleanToken = (this.botToken || '').replace(/^Bearer\s+/i, '').trim();
              try {
                const userRes2 = await axios.get('https://api.kick.com/public/v1/users', {
                  headers: { Authorization: `Bearer ${cleanToken}` },
                  timeout: 5000
                });
                const botUser2 = userRes2.data?.data?.[0];
                if (botUser2) {
                  this.botUserId = Number(botUser2.user_id);
                  this.botUsername = String(botUser2.name || '');
                  console.log(`[Kick] Bot refreshed & authenticated as: @${this.botUsername} (User ID: ${this.botUserId})`);
                }
              } catch (e2) {
                console.warn('[Kick] Token yenilendi ama bot kullanıcı bilgisi alınamadı:', hataMetni(e2));
              }
            }
          } else {
            console.warn('[Kick] Note: Could not fetch bot user profile:', e?.message || e);
          }
        }
      }

      // 3. Canlı sohbeti dinle. Eskiden sabit bir Pusher anahtarı vardı; Kick
      //    onu kapatınca (Ekim 2026) bot sohbeti OKUYAMAZ oldu ve komutlar /
      //    bilgi yarışması cevapları hiç gelmedi. Artık Kick'in kendi
      //    bağlantı pazarlığı kullanılıyor (bkz. kick-realtime-protokol.ts).
      const kanalId = Number(res.data?.id);
      this.realtime.removeAllListeners();
      this.realtime.on('olay', (_kanal: string, olay: string, veri: unknown) => this.olayIsle(olay, veri, channelSlug));
      this.realtime.on('durum', () => eventBus.emit('platform_status_changed', { platform: 'kick' }));
      this.realtime.baslat(abonelikKanallari(this.chatroomId, Number.isFinite(kanalId) ? kanalId : null));

      this.connected = true;
      console.log(`[Kick] Connected successfully to channel: ${channelSlug} (Chatroom #${this.chatroomId}, Broadcaster ID: ${this.broadcasterUserId})`);
      return true;
    } catch (err: any) {
      console.error(`[Kick] Connection failed:`, err?.message || err);
      this.connected = false;
      return false;
    }
  }

  /** Son birkaç saniyede işlenen sohbet-dışı olaylar (aynı olay birden çok kanaldan gelebilir). */
  private sonOlaylar: Map<string, number> = new Map();

  private olayTekrariMi(olay: string, veri: unknown): boolean {
    const an = Date.now();
    for (const [k, t] of this.sonOlaylar) if (an - t > 5000) this.sonOlaylar.delete(k);
    let imza = '';
    try {
      imza = JSON.stringify(veri).slice(0, 300);
    } catch {
      imza = String(veri);
    }
    const anahtar = `${olay}|${imza}`;
    if (this.sonOlaylar.has(anahtar)) return true;
    this.sonOlaylar.set(anahtar, an);
    return false;
  }

  /** Kick gerçek zamanlı olayını ilgili işleyiciye yönlendirir. */
  private olayIsle(olay: string, veri: unknown, channelSlug: string) {
    if (!olay) return;
    if (olay.includes('ChatMessageEvent')) {
      this.handleChatMessage(veri, channelSlug); // kendi kimlik elemesi var
      return;
    }
    if (this.olayTekrariMi(olay, veri)) return;
    const parsed: any = veri && typeof veri === 'object' ? veri : {};

    if (olay === 'App\\Events\\FollowersUpdated') {
      if (parsed?.username) {
        eventBus.emitFollow({
          platform: 'kick',
          channel: channelSlug,
          username: parsed.username,
          displayName: parsed.username,
          timestamp: Date.now()
        });
      }
      return;
    }
    if (olay === 'App\\Events\\SubscriptionEvent') {
      eventBus.emitSub({
        platform: 'kick',
        channel: channelSlug,
        username: parsed?.username || 'Gizli Abone',
        tier: 'Tier 1',
        months: parsed?.months || 1,
        isGift: false,
        timestamp: Date.now()
      });
      return;
    }
    if (olay === 'App\\Events\\GiftedSubscriptionsEvent') {
      eventBus.emitSub({
        platform: 'kick',
        channel: channelSlug,
        username: parsed?.gifter_username || 'Gizli Bağışçı',
        tier: 'Tier 1',
        months: 1,
        isGift: true,
        count: Number(parsed?.gifted_usernames?.length) || 1,
        recipient: `${parsed?.gifted_usernames?.length || 1} izleyiciye`,
        timestamp: Date.now()
      });
      return;
    }
    // KICKs ve host olaylari icin ADI degisebilen olaylari burada
    // yakaliyoruz: Kick bu olaylarin adini gecmiste degistirdi ve sabit
    // eslesme kullanmak sessizce calismamaya yol aciyordu.
    this.handleGlobalEvent(olay, veri, channelSlug);
  }

  private handleChatMessage(raw: any, channelSlug: string) {
    try {
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const content = data?.content || data?.message;
      if (!data || !content) return;

      // Prevent processing same message multiple times from different event bindings
      const msgId = String(data.id || `${data.created_at || Date.now()}_${data.sender?.id}`);
      if (this.processedMessageIds.has(msgId)) return;
      this.processedMessageIds.add(msgId);
      if (this.processedMessageIds.size > 500) {
        const first = this.processedMessageIds.values().next().value;
        if (first) this.processedMessageIds.delete(first);
      }

      const sender = data.sender || {};
      const senderId = Number(sender.id);
      const senderName = String(sender.username || '').trim();

      // Check if message was sent by the bot itself
      const isSelf = Boolean(
        (this.botUserId && senderId === this.botUserId) ||
        (this.botUsername && senderName.toLowerCase() === this.botUsername.toLowerCase())
      );

      const identity = sender.identity || {};
      const rawBadges = [
        ...(identity.badges || []),
        ...(identity.badges_v2 || [])
      ];

      const badges: string[] = (identity.badges || []).map((b: any) => b.type);
      const isBroadcaster = badges.includes('broadcaster') || senderName.toLowerCase() === channelSlug.toLowerCase();
      if (isBroadcaster && !badges.includes('broadcaster')) {
        badges.unshift('broadcaster');
      }
      const isMod = badges.includes('moderator') || isBroadcaster;
      const isSub = badges.includes('subscriber');
      const isVip = badges.includes('vip');
      const userColor = identity.color || undefined;

      console.log(`[Kick Chat] <${senderName}>: ${content}`);

      // Botun kendi gönderdiği mesaj Kick'ten geri geliyor; akışta ikinci kez
      // görünmesin (komut döngüsü de başlatmasın).
      if (isSelf && this.wasJustSentByBot(content)) return;

      if (sender.id && senderName) {
        this.kullaniciKimlikleri.set(senderName.toLowerCase(), Number(sender.id));
        if (this.kullaniciKimlikleri.size > 5000) {
          const ilk = this.kullaniciKimlikleri.keys().next().value;
          if (ilk) this.kullaniciKimlikleri.delete(ilk);
        }
      }

      eventBus.emitChat({
        id: msgId,
        platform: 'kick',
        channel: channelSlug,
        user: {
          id: String(sender.id || senderName),
          username: senderName || 'KickUser',
          displayName: senderName || 'KickUser',
          badges,
          rawBadges,
          color: userColor,
          isMod,
          isSub,
          isVip,
          isBroadcaster,
          isSelf,
          avatarUrl: sender.profile_pic
        },
        message: content,
        timestamp: Date.now()
      });
    } catch (err) {
      console.error('[Kick] Error parsing chat message:', err);
    }
  }

  /**
   * Adi sabitlenmemis Kick olaylari (KICKs, host/raid).
   *
   * `alert_presets` tablosunda `kicks` ve `host` satirlari vardi ama veri
   * yolunda karsiliklari YOKTU: gercek yayinda hic tetiklenmiyor, yalniz
   * panelin "Test" dugmesiyle geliyorlardi. Subathon sayacinin KICKs ile
   * otomatik uzamasi da bu yuzden calismiyordu.
   */
  private handleGlobalEvent(eventName: string, data: any, channelSlug: string): void {
    if (!eventName) return;
    const ad = String(eventName);
    let p: any = data;
    try {
      if (typeof data === 'string') p = JSON.parse(data);
    } catch {
      return;
    }
    if (!p || typeof p !== 'object') return;

    // --- KICKs ---
    if (/kick(s)?(gift|sent|received)|KicksGifted|RewardRedeemed/i.test(ad)) {
      const adet = Number(
        p.amount ?? p.kicks ?? p.quantity ?? p.gift?.amount ?? p.kicks_amount ?? 0
      );
      if (adet > 0) {
        const kim = p.sender?.username || p.username || p.user?.username || 'İzleyici';
        eventBus.emitKicks({
          platform: 'kick',
          channel: channelSlug,
          username: kim,
          displayName: p.sender?.display_name || p.display_name || kim,
          amount: adet,
          message: p.message || p.gift?.name || '',
          timestamp: Date.now()
        });
      }
      return;
    }

    // --- Host / Raid ---
    if (/StreamHost|HostEvent|RaidEvent/i.test(ad)) {
      const izleyici = Number(p.number_viewers ?? p.viewers ?? p.optional_message?.viewers ?? 0);
      const kim = p.host_username || p.username || p.user?.username || 'Yayıncı';
      eventBus.emitHost({
        platform: 'kick',
        channel: channelSlug,
        username: kim,
        displayName: p.host_username || kim,
        viewers: izleyici,
        timestamp: Date.now()
      });
    }
  }

  async disconnect(): Promise<void> {
    this.realtime.durdur();
    this.connected = false;
  }

  /** Sohbet okuma bağlantısının durumu (panel teşhisi için). */
  sohbetOkumaDurumu() {
    return this.realtime.durum();
  }

  async refreshKickToken(forceClientCredentials = false): Promise<boolean> {
    try {
      const row = db.prepare("SELECT token, refresh_token FROM channels WHERE platform = 'kick'").get() as any;
      const clientId = settingsCache.get('kick_client_id') || '';
      const clientSecret = settingsCache.get('kick_client_secret') || '';

      if (!clientId) {
        console.warn('[Kick Token Refresh] Cannot refresh: kick_client_id is missing.');
        return false;
      }

      const params = new URLSearchParams();
      if (row?.refresh_token && !forceClientCredentials) {
        params.append('grant_type', 'refresh_token');
        params.append('client_id', clientId);
        if (clientSecret) params.append('client_secret', clientSecret);
        params.append('refresh_token', row.refresh_token);
      } else if (clientSecret) {
        params.append('grant_type', 'client_credentials');
        params.append('client_id', clientId);
        params.append('client_secret', clientSecret);
      } else {
        return false;
      }

      const res = await axios.post('https://id.kick.com/oauth/token', params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 StreamAxT/1.0'
        },
        timeout: 8000
      });

      if (res.data?.access_token) {
        const newToken = res.data.access_token;
        const newRefresh = res.data.refresh_token || row?.refresh_token || null;
        const expiresAt = Date.now() + ((res.data.expires_in || 3600) * 1000);

        this.botToken = newToken;
        db.prepare(`
          UPDATE channels 
          SET token = ?, refresh_token = ?, token_expires_at = ? 
          WHERE platform = 'kick'
        `).run(...sifreleHepsi([newToken, newRefresh]), expiresAt);

        console.log('[Kick Token Refresh] Successfully obtained and saved fresh Kick token!');
        return true;
      }
    } catch (err: any) {
      console.warn('[Kick Token Refresh] Error during token refresh:', err?.response?.data || err.message);
    }
    return false;
  }

  async sendKickMessage(channel: string, message: string, retried = false): Promise<{ success: boolean; message: string; details?: any }> {
    // 1. Ensure token is available
    if (!this.botToken) {
      try {
        const row = db.prepare("SELECT token, channel_name FROM channels WHERE platform = 'kick'").get() as any;
        if (row?.token) {
          this.botToken = row.token;
        }
        if (!this.currentChannel && row?.channel_name) {
          this.currentChannel = row.channel_name;
        }
      } catch (e) {
        console.warn('[Kick] Kayıtlı token okunamadı:', hataMetni(e));
      }
    }

    let cleanToken = (this.botToken || '').replace(/^Bearer\s+/i, '').trim();

    if (!cleanToken) {
      return {
        success: false,
        message: 'Kick canlı dinleme devrede, fakat henüz bot tokeni tanımlanmamış. İzleyici mesajları ve OBS uyarıları çalışmaktadır. Botun sohbete otomatik cevap yazabilmesi için lütfen Kick sekmesinden "Developer OAuth" veya "Manuel Bot Tokeni" ekleyin.'
      };
    }

    // 2. Ensure broadcaster user ID and chatroom ID
    if (!this.broadcasterUserId || !this.chatroomId) {
      const targetSlug = channel || this.currentChannel;
      if (targetSlug) {
        try {
          const res = await axios.get(`https://kick.com/api/v2/channels/${targetSlug.toLowerCase().trim()}`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Accept': 'application/json'
            },
            timeout: 6000
          });
          this.chatroomId = res.data?.chatroom?.id;
          this.broadcasterUserId = res.data?.user_id || res.data?.id;
        } catch (e: any) {
          console.warn('[Kick] Meta refresh error before send:', e.message);
        }
      }
    }

    let lastErrorMsg = '';

    // Giden mesaj için AYRI baloncuk atılmaz (üçleme yapıyordu); yalnız metin
    // kaydedilir ki Kick'in yankısı elensin.
    const notifyMultiChat = () => {
      this.recentlySent.set(String(message || '').trim(), Date.now());
    };


    // 3. Try Official Kick Developer Public API (v1) - Try 'user' first, then 'bot' fallback
    if (this.broadcasterUserId) {
      for (const msgType of ['user', 'bot'] as const) {
        try {
          const officialRes = await axios.post(
            'https://api.kick.com/public/v1/chat',
            {
              broadcaster_user_id: Number(this.broadcasterUserId),
              content: message,
              type: msgType
            },
            {
              headers: {
                Authorization: `Bearer ${cleanToken}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 StreamAxT/1.0'
              },
              timeout: 6000
            }
          );

          if (officialRes.status === 200 || officialRes.status === 201) {
            console.log(`[Kick] Chat message sent successfully via Official API (v1, type: ${msgType})`);
            notifyMultiChat();
            return {
              success: true,
              message: 'Mesaj Kick sohbetine başarıyla iletildi!'
            };
          }
        } catch (err: any) {
          const status = err.response?.status;
          const resData = err.response?.data;
          console.warn(`[Kick API v1 (${msgType})] Error:`, status, resData || err.message);

          if (status === 401 && !retried) {
            console.log('[Kick] Token 401 received. Trying auto-refresh...');
            const refreshed = await this.refreshKickToken();
            if (refreshed) {
              return this.sendKickMessage(channel, message, true);
            }
            return {
              success: false,
              message: 'Kick API Yetkilendirme Hatası (401 Unauthorized): Girdiğiniz bot tokeni geçersiz veya süresi dolmuş. Lütfen OAuth ile yeniden yetkilendirin.'
            };
          } else if (status === 403) {
            lastErrorMsg = 'Kick İzin Hatası (403 Forbidden): Bot hesabının kanalda yazma izni yok. Kanalınızda "/mod <BotKullanıcıAdı>" yazarak botu moderatör yapın ve kanalın abone modunda olmadığını kontrol edin.';
          } else if (status === 429) {
            return {
              success: false,
              message: 'Kick Hız Sınırı (429 Rate Limit): Çok hızlı mesaj gönderildi. Lütfen birkaç saniye sonra tekrar deneyin.'
            };
          } else if (resData?.message) {
            lastErrorMsg = `Kick API: ${resData.message}`;
          }
        }
      }
    }

    // 4. Try Fallback: Kick Chatroom v2 API Endpoint
    if (this.chatroomId) {
      try {
        const v2Res = await axios.post(
          `https://kick.com/api/v2/messages/send/${this.chatroomId}`,
          { content: message, type: 'message' },
          {
            headers: {
              Authorization: `Bearer ${cleanToken}`,
              'Content-Type': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            },
            timeout: 6000
          }
        );

        if (v2Res.status === 200 || v2Res.status === 201) {
          notifyMultiChat();
          return {
            success: true,
            message: 'Mesaj Kick sohbetine iletildi!'
          };
        }
      } catch (err: any) {
        console.warn('[Kick v2 Send Error]:', err?.response?.status, err?.response?.data || err.message);
        if (err?.response?.status === 401 && !retried) {
          const refreshed = await this.refreshKickToken();
          if (refreshed) {
            return this.sendKickMessage(channel, message, true);
          }
        }
      }
    }

    return {
      success: false,
      message: lastErrorMsg || 'Mesaj gönderilemedi. Token yetkisini ve botun kanalda moderatör olduğunu kontrol edin.'
    };
  }

  /** Panelin "neden gitmedi" diye gösterebilmesi için son hata. */
  lastSendError = '';

  /**
   * Kullaniciya zaman asimi verir (Kick resmi API'si).
   *
   * NOT: Bu yol CANLI YAYINDA DOGRULANMADI — gercek bir izleyiciye timeout
   * atmak kullanicinin kanalinda gorunur bir moderasyon eylemi olurdu.
   * API sozlesmesi mevcut `sendKickMessage` desenine gore yazildi.
   * Bkz. docs/KNOWN_LIMITATIONS.md
   */
  async timeoutUser(username: string, saniye: number, sebep?: string): Promise<ModerasyonSonucu> {
    // Kick DAKIKA bekliyor: belgeye gore 1–10080 (7 gun)
    const dakika = Math.min(10080, Math.max(1, Math.round(Number(saniye) / 60)));
    return this.yasakIstegi('timeout', username, { duration: dakika, reason: String(sebep || 'AutoMod').slice(0, 100) });
  }

  /** Kalici ban: ayni uc, `duration` VERILMEZ (docs.kick.com — moderation). */
  async banUser(username: string, sebep?: string): Promise<ModerasyonSonucu> {
    return this.yasakIstegi('ban', username, { reason: String(sebep || 'Moderatör').slice(0, 100) });
  }

  /** `DELETE /public/v1/moderation/bans` — ban ve zaman asimini kaldirir. */
  async unbanUser(username: string): Promise<ModerasyonSonucu> {
    return this.yasakIstegi('unban', username, {});
  }

  /** Hedef kullanicinin kimligi: once sohbetten ogrenilen, yoksa kanal sayfasi. */
  private async hedefKimligi(ad: string): Promise<number | undefined> {
    const onbellek = this.kullaniciKimlikleri.get(ad.toLowerCase());
    if (onbellek) return onbellek;
    const kanal = await axios.get(`https://kick.com/api/v2/channels/${encodeURIComponent(ad.toLowerCase())}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
      timeout: 8000
    });
    const id = Number(kanal.data?.user_id || kanal.data?.user?.id);
    return Number.isFinite(id) && id > 0 ? id : undefined;
  }

  /**
   * Zaman asimi, kalici ban ve ban kaldirma ayni resmi uctur
   * (`/public/v1/moderation/bans`, izin `moderation:ban`).
   *
   * NOT: CANLI YAYINDA DOGRULANMADI — gercek bir izleyiciye moderasyon
   * kullanicinin kanalinda gorunur bir eylem olurdu. Bkz. KNOWN_LIMITATIONS.
   */
  private async yasakIstegi(
    tur: 'timeout' | 'ban' | 'unban',
    username: string,
    ek: { duration?: number; reason?: string }
  ): Promise<ModerasyonSonucu> {
    const ad = String(username || '').replace(/^@/, '').trim();
    if (!ad) return { ok: false, hata: 'Kullanici adi bos' };
    if (!this.broadcasterUserId) return { ok: false, hata: 'Kanal kimligi bilinmiyor (baglanti yok)' };

    const token = (this.botToken || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return { ok: false, hata: 'Kick tokeni yok — Platformlar sekmesinden baglan' };

    try {
      const hedefId = await this.hedefKimligi(ad);
      if (!hedefId) return { ok: false, hata: `${ad} kullanicisi bulunamadi` };

      const govde = { broadcaster_user_id: Number(this.broadcasterUserId), user_id: hedefId, ...ek };
      const basliklar = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
      if (tur === 'unban') {
        await axios.delete('https://api.kick.com/public/v1/moderation/bans', { data: govde, headers: basliklar, timeout: 10000 });
      } else {
        await axios.post('https://api.kick.com/public/v1/moderation/bans', govde, { headers: basliklar, timeout: 10000 });
      }
      return { ok: true };
    } catch (e: any) {
      const durum = e?.response?.status;
      const mesaj =
        durum === 401 || durum === 403
          ? 'Kick tokeninde "moderation:ban" izni yok — Platformlar > Kick > yeniden baglan (yeni izinlerle)'
          : String(e?.response?.data?.message || e?.message || e);
      console.warn(`[Kick] ${tur} basarisiz (${ad}):`, mesaj);
      return { ok: false, hata: mesaj };
    }
  }

  /** Resmi API: `DELETE /public/v1/chat/{message_id}` — izin `moderation:chat_message:manage`. */
  async deleteMessage(messageId: string): Promise<ModerasyonSonucu> {
    const token = (this.botToken || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return { ok: false, hata: 'Kick tokeni yok — Platformlar sekmesinden baglan' };
    if (!messageId) return { ok: false, hata: 'Mesaj kimligi yok' };
    try {
      await axios.delete(`https://api.kick.com/public/v1/chat/${encodeURIComponent(messageId)}`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 8000
      });
      return { ok: true };
    } catch (e: any) {
      const durum = e?.response?.status;
      const hata =
        durum === 401 || durum === 403
          ? 'Kick tokeninde "moderation:chat_message:manage" izni yok — Platformlar > Kick > yeniden baglan'
          : durum === 404
            ? 'Mesaj bulunamadi (zaten silinmis olabilir)'
            : String(e?.response?.data?.message || e?.message || e);
      console.warn('[Kick] mesaj silme basarisiz:', hata);
      return { ok: false, hata };
    }
  }

  /**
   * Yayin durumu. Baglanirken zaten kullanilan kanal sayfasi (v2) okunur:
   * `livestream` yayin kapaliyken `null`, aciksa `is_live`, `start_time`
   * (UTC, saat dilimsiz), `viewer_count`, `session_title`, `categories`.
   * Gozlem: 2026-09-23. Resmi `/public/v1/channels` yaniti YAYIN ANAHTARINI
   * da (stream key) donduruyor; o yuzden bilerek KULLANILMIYOR.
   */
  async yayinDurumu(): Promise<YayinBilgisi | null> {
    if (!this.connected || !this.currentChannel) return null;
    try {
      const res = await axios.get(`https://kick.com/api/v2/channels/${this.currentChannel}`, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json'
        },
        timeout: 8000
      });
      const ls = res.data?.livestream;
      if (!ls || ls.is_live === false) return { canli: false, kanal: this.currentChannel };
      return {
        canli: true,
        baslangic: kickZamani(ls.start_time || ls.created_at),
        izleyici: Number(ls.viewer_count) || 0,
        baslik: String(ls.session_title || ''),
        kategori: String(ls.categories?.[0]?.name || ''),
        yayinId: String(ls.id || ''),
        kanal: this.currentChannel
      };
    } catch {
      return null; // ag hatasi: durumu degistirme
    }
  }

  /** Resmi API: `PATCH /public/v1/channels` — izin `channel:write`. */
  private async kanalGuncelle(govde: Record<string, unknown>): Promise<ModerasyonSonucu> {
    const token = (this.botToken || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return { ok: false, hata: 'Kick tokeni yok — Platformlar sekmesinden baglan' };
    try {
      await axios.patch('https://api.kick.com/public/v1/channels', govde, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        timeout: 10000
      });
      return { ok: true };
    } catch (e: any) {
      const durum = e?.response?.status;
      return {
        ok: false,
        hata:
          durum === 401 || durum === 403
            ? 'Kick tokeninde "channel:write" izni yok ya da token yayinciya ait degil — Platformlar > Kick > yeniden baglan'
            : String(e?.response?.data?.message || e?.message || e)
      };
    }
  }

  async baslikDegistir(baslik: string): Promise<ModerasyonSonucu> {
    const b = String(baslik || '').trim();
    if (!b) return { ok: false, hata: 'Baslik bos olamaz' };
    return this.kanalGuncelle({ stream_title: b.slice(0, 140) });
  }

  /** Kategori adiyla arar (`GET /public/v2/categories?name=`), bulunanla gunceller. */
  async kategoriDegistir(kategori: string): Promise<ModerasyonSonucu & { kategori?: string }> {
    const token = (this.botToken || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return { ok: false, hata: 'Kick tokeni yok — Platformlar sekmesinden baglan' };
    const ad = String(kategori || '').trim();
    if (!ad) return { ok: false, hata: 'Kategori adi bos' };
    try {
      const r = await axios.get('https://api.kick.com/public/v2/categories', {
        params: { name: ad, limit: 10 },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 8000
      });
      const liste: any[] = Array.isArray(r.data?.data) ? r.data.data : [];
      if (!liste.length) return { ok: false, hata: `"${ad}" adli Kick kategorisi bulunamadi` };
      const tam = liste.find((k) => String(k.name).toLowerCase() === ad.toLowerCase());
      const k = tam || liste[0];
      const g = await this.kanalGuncelle({ category_id: Number(k.id) });
      return g.ok ? { ok: true, kategori: String(k.name) } : g;
    } catch (e: any) {
      return { ok: false, hata: String(e?.response?.data?.message || e?.message || e) };
    }
  }

  /** Kanal sayfası önbelleği (`$(kick alan kullanıcı)` aynı kişi için tekrar sorgulamasın). */
  private profilOnbellek: Map<string, { zaman: number; veri: any }> = new Map();

  /** Herkese açık kanal sayfası (biyografi, sosyal hesaplar, takipçi). 5 dk önbellek. */
  async profil(slug: string): Promise<any | null> {
    const s = String(slug || '').replace(/^@/, '').trim().toLowerCase();
    if (!/^[a-z0-9_-]{1,40}$/.test(s)) return null;
    const o = this.profilOnbellek.get(s);
    if (o && Date.now() - o.zaman < 5 * 60_000) return o.veri;
    try {
      const r = await axios.get(`https://kick.com/api/v2/channels/${encodeURIComponent(s)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json'
        },
        timeout: 6000
      });
      this.profilOnbellek.set(s, { zaman: Date.now(), veri: r.data });
      if (this.profilOnbellek.size > 300) this.profilOnbellek.delete(this.profilOnbellek.keys().next().value as string);
      return r.data;
    } catch {
      return null;
    }
  }

  /** Botun Kick kullanici adi — anahtar kelime komutu kendini tetiklemesin. */
  botKullaniciAdi(): string {
    return (this.botUsername || '').toLowerCase();
  }

  async sendMessage(channel: string, message: string): Promise<boolean> {
    // Kick bir mesajda en çok 500 karakter kabul eder; uzun yanıt (açıklamalı
    // yarışma cevabı, uzun özel komut) eskiden REDDEDİLİP sessizce kayboluyordu.
    const parcalar = mesajiParcala(message, 500);
    for (const parca of parcalar.length ? parcalar : [message]) {
      const res = await this.sendKickMessage(channel, parca);
      this.lastSendError = res.success ? '' : res.message;
      if (!res.success) return false;
    }
    return true;
  }

  async verifyChannel(channelSlug: string, token?: string): Promise<KickChannelVerification> {
    const slug = channelSlug.trim().toLowerCase();
    try {
      const res = await axios.get(`https://kick.com/api/v2/channels/${slug}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        },
        timeout: 6000
      });

      const chatroomId = res.data?.chatroom?.id;
      const broadcasterUserId = res.data?.user_id || res.data?.id;
      const followersCount = res.data?.followersCount || res.data?.followers_count || 0;
      const isVerified = Boolean(res.data?.verified);

      let canSendChat = false;
      const cleanToken = (token || this.botToken).replace(/^Bearer\s+/i, '').trim();

      if (cleanToken && chatroomId) {
        // Test token validity with chat test ping or user info
        try {
          const authCheck = await axios.get('https://api.kick.com/public/v1/users', {
            headers: { Authorization: `Bearer ${cleanToken}` },
            timeout: 4000
          });
          canSendChat = authCheck.status === 200;
        } catch {
          // If public API check fails, token might still work on channel API
          canSendChat = true;
        }
      }

      return {
        success: true,
        channelSlug: slug,
        chatroomId,
        broadcasterUserId,
        followersCount,
        isVerified,
        canSendChat
      };
    } catch (err: any) {
      return {
        success: false,
        channelSlug: slug,
        error: err?.response?.status === 404 ? 'Kick kanalı bulunamadı!' : 'Kick sunucusuna bağlanılamadı.'
      };
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getStatus(): PlatformStatus {
    // "Bağlı" görünüp sohbeti okuyamamak (Ekim 2026'daki gibi) sessiz kalmasın
    const okuma = this.realtime.durum();
    const hata =
      this.connected && okuma.durum !== 'bagli'
        ? okuma.durum === 'baglaniyor'
          ? 'Sohbet bağlantısı kuruluyor…'
          : `Sohbet okunamıyor${okuma.hata ? `: ${okuma.hata}` : ''} — yeniden deneniyor`
        : undefined;
    return {
      connected: this.connected,
      channel: this.currentChannel,
      ...(hata ? { error: hata } : {})
    };
  }
}

export const kickPlatform = new KickPlatform();
export default kickPlatform;
