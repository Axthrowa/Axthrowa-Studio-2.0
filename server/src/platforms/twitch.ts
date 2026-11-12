import WebSocket from 'ws';
import { BasePlatform, PlatformStatus, ModerasyonSonucu } from './base.js';
import { eventBus } from '../core/event-bus.js';
import { db } from '../db/index.js';
import { TwitchHelix } from './twitch-helix.js';
import { twitchEmoteEtiketi, twitchRozetleri } from './twitch-rules.js';
import type { YayinBilgisi } from '../core/live-status-math.js';

export class TwitchPlatform extends BasePlatform {
  readonly name = 'twitch' as const;
  private ws: WebSocket | null = null;
  private connected: boolean = false;
  private currentChannel: string = '';
  private botToken: string = '';
  private botUsername: string = '';
  /**
   * Helix: moderasyon, yayın durumu, başlık/kategori. IRC ile /timeout
   * Şubat 2023'te kaldırıldı; bunlar yalnız Helix ile yapılabiliyor.
   * Client-ID ayrıca istenmez, jeton doğrulamasından öğrenilir.
   */
  private helix = new TwitchHelix(() => this.botToken);
  /** Özgün rozet görselleri (kanalın abone/bit rozetleri dahil); jeton yoksa boş, istemci yedeği çizer */
  private rozetHaritasi: ReadonlyMap<string, string> = new Map();

  /** Bot hesabının kullanıcı adı (anahtar kelime komutlarının kendini tetiklemesini önlemek için). */
  botKullaniciAdi(): string {
    return this.botToken ? this.botUsername.toLowerCase() : '';
  }

  async connect(): Promise<boolean> {
    const channelRow = db.prepare("SELECT * FROM channels WHERE platform = 'twitch' AND is_active = 1 LIMIT 1").get() as any;
    if (!channelRow || !channelRow.channel_name) {
      this.connected = false;
      return false;
    }

    const channel = channelRow.channel_name.trim().toLowerCase().replace('#', '');
    this.currentChannel = channel;
    this.botToken = channelRow.token || '';
    this.botUsername = channelRow.account_id || `justinfan${Math.floor(Math.random() * 80000 + 10000)}`;
    this.helix.unut();
    if (this.botToken) {
      void this.helix
        .sohbetRozetleri(channel)
        .then((h) => {
          if (h.size) this.rozetHaritasi = h;
        })
        .catch(() => {});
    }

    return new Promise((resolve) => {
      try {
        const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
        this.ws = ws;

        ws.on('open', () => {
          if (this.ws !== ws) return;

          // Request Twitch IRC capabilities (tags for badges, sub info, etc.)
          this.ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership');

          if (this.botToken) {
            const cleanToken = this.botToken.startsWith('oauth:') ? this.botToken : `oauth:${this.botToken}`;
            this.ws.send(`PASS ${cleanToken}`);
            this.ws.send(`NICK ${this.botUsername.toLowerCase()}`);
          } else {
            // Anonymous read-only login
            this.ws.send(`NICK ${this.botUsername}`);
          }

          this.ws.send(`JOIN #${channel}`);
          this.connected = true;
          console.log(`[Twitch] Connected to channel #${channel}`);
          resolve(true);
        });

        ws.on('message', (data: WebSocket.Data) => {
          this.handleIrcMessage(data.toString());
        });

        ws.on('close', () => {
          // Yeniden bağlanınca eski soketin geç gelen kapanışı yeni bağlantıyı kopmuş göstermesin
          if (this.ws !== ws) return;
          this.connected = false;
          console.log('[Twitch] Disconnected');
        });

        ws.on('error', (err) => {
          console.error('[Twitch] WebSocket error:', err.message);
          if (this.ws === ws) this.connected = false;
          resolve(false);
        });
      } catch (err) {
        console.error('[Twitch] Connection error:', err);
        this.connected = false;
        resolve(false);
      }
    });
  }

  private handleIrcMessage(raw: string) {
    const lines = raw.split('\r\n');
    for (const line of lines) {
      if (!line) continue;

      // Twitch bakımdan önce RECONNECT yollar: bağlantı kapatılır, bekçi yeniden bağlar
      if (/^(@\S+ )?:tmi\.twitch\.tv RECONNECT\b/.test(line)) {
        this.ws?.close();
        continue;
      }

      // Handle PING/PONG keepalive
      if (line.startsWith('PING')) {
        this.ws?.send(line.replace('PING', 'PONG'));
        continue;
      }

      // Parse PRIVMSG
      if (line.includes('PRIVMSG')) {
        this.parsePrivMsg(line);
      } else if (line.includes('USERNOTICE')) {
        this.parseUserNotice(line);
      }
    }
  }

  private parsePrivMsg(line: string) {
    try {
      const parts = line.split(' ');
      let tagsStr = '';
      let msgIndex = 0;

      if (line.startsWith('@')) {
        tagsStr = parts[0].slice(1);
        msgIndex = line.indexOf('PRIVMSG');
      }

      const tags = this.parseTags(tagsStr);
      const textMatch = line.slice(msgIndex).match(/PRIVMSG #[^\s]+ :?(.*)/);
      const messageText = textMatch ? textMatch[1] : '';

      const username = tags['display-name'] || tags['login'] || 'TwitchUser';
      const badgesStr = tags['badges'] || '';
      const isMod = tags['mod'] === '1' || badgesStr.includes('moderator');
      const isSub = tags['subscriber'] === '1' || badgesStr.includes('subscriber');
      const isVip = badgesStr.includes('vip');
      const isBroadcaster = badgesStr.includes('broadcaster') || username.toLowerCase() === this.currentChannel;

      // Check bits donation
      if (tags['bits']) {
        const bits = parseInt(tags['bits'], 10);
        eventBus.emitTip({
          platform: 'twitch',
          channel: this.currentChannel,
          username,
          displayName: username,
          amount: bits,
          currency: 'Bits',
          message: messageText,
          timestamp: Date.now()
        });
      }

      // Zaman aşımı için kullanıcı kimliği gerekir; sohbetten öğrenilir
      if (tags['user-id']) this.helix.kimlikOgren(tags['login'] || username, tags['user-id']);

      eventBus.emitChat({
        id: tags['id'] || String(Date.now()),
        platform: 'twitch',
        channel: this.currentChannel,
        user: {
          id: tags['user-id'] || username,
          username: username.toLowerCase(),
          displayName: username,
          badges: badgesStr.split(',').filter(Boolean),
          rawBadges: twitchRozetleri(badgesStr, this.rozetHaritasi),
          color: tags['color'] || undefined,
          isMod,
          isSub,
          isVip,
          isBroadcaster
        },
        message: messageText,
        paylasimli: !!tags['source-room-id'] && tags['source-room-id'] !== tags['room-id'],
        ilkMesaj: tags['first-msg'] === '1',
        emotes: twitchEmoteEtiketi(tags['emotes']),
        timestamp: Date.now()
      });
    } catch (err) {
      console.error('[Twitch] Error parsing PRIVMSG:', err);
    }
  }

  private parseUserNotice(line: string) {
    try {
      const tags = this.parseTags(line.split(' ')[0].slice(1));
      const msgId = tags['msg-id'];
      const username = tags['display-name'] || tags['login'] || 'TwitchUser';

      if (msgId === 'sub' || msgId === 'resub') {
        const months = parseInt(tags['msg-param-cumulative-months'] || '1', 10);
        const tier = tags['msg-param-sub-plan-name'] || 'Tier 1';
        eventBus.emitSub({
          platform: 'twitch',
          channel: this.currentChannel,
          username,
          displayName: username,
          tier,
          months,
          isGift: false,
          timestamp: Date.now()
        });
      } else if (msgId === 'subgift' || msgId === 'anonsubgift') {
        eventBus.emitSub({
          platform: 'twitch',
          channel: this.currentChannel,
          username,
          displayName: username,
          tier: 'Tier 1',
          months: 1,
          isGift: true,
          count: 1,
          recipient: tags['msg-param-recipient-display-name'] || 'İzleyici',
          timestamp: Date.now()
        });
      } else if (msgId === 'raid') {
        const viewers = parseInt(tags['msg-param-viewerCount'] || '1', 10);
        eventBus.emitRaid({
          platform: 'twitch',
          channel: this.currentChannel,
          username,
          displayName: username,
          viewers,
          timestamp: Date.now()
        });
      }
    } catch (err) {
      console.error('[Twitch] Error parsing USERNOTICE:', err);
    }
  }

  private parseTags(tagsStr: string): Record<string, string> {
    const tags: Record<string, string> = {};
    if (!tagsStr) return tags;
    for (const pair of tagsStr.split(';')) {
      const [key, value] = pair.split('=');
      if (key) tags[key] = value || '';
    }
    return tags;
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  async sendMessage(channel: string, message: string): Promise<boolean> {
    if (!this.connected || !this.ws || !this.botToken) {
      console.log(`[Twitch Mock-Send to #${channel}]: ${message} (Bot token not provided or read-only)`);
      return false;
    }

    try {
      // Satır sonu IRC'de yeni komut demek: çok satırlı yanıt (yapay zekâ) kesilir, kalanı ham komut olarak giderdi
      message = message.replace(/[\r\n]+/g, ' ').trim();
      this.ws.send(`PRIVMSG #${channel} :${message}`);
      // Twitch IRC gönderene kendi mesajını geri yollamaz; panelde görünsün diye bot hesabının adıyla yansıtılır
      eventBus.emitChat({
        id: `self-${Date.now()}`,
        platform: 'twitch',
        channel,
        user: { id: this.botUsername, username: this.botUsername.toLowerCase(), displayName: this.botUsername, badges: [], isMod: true, isSub: false, isVip: false, isBroadcaster: false, isSelf: true },
        message,
        timestamp: Date.now()
      });
      return true;
    } catch (err) {
      console.error('[Twitch] Failed to send message:', err);
      return false;
    }
  }

  avatarBul(kullanici: string): Promise<string | null> {
    return this.helix.avatarBul(kullanici);
  }

  // ------------------------------------------------ Helix: moderasyon ------

  async timeoutUser(username: string, saniye: number, sebep?: string): Promise<ModerasyonSonucu> {
    if (!this.currentChannel) return { ok: false, hata: 'Twitch kanalı bağlı değil' };
    const r = await this.helix.yasakla(this.currentChannel, username, saniye, sebep);
    if (!r.ok) console.warn(`[Twitch] timeout başarısız (${username}):`, r.hata);
    return r.ok ? { ok: true } : { ok: false, hata: r.hata };
  }

  /** Kalıcı ban: Helix `POST /moderation/bans`, `duration` verilmez. */
  async banUser(username: string, sebep?: string): Promise<ModerasyonSonucu> {
    if (!this.currentChannel) return { ok: false, hata: 'Twitch kanalı bağlı değil' };
    const r = await this.helix.yasakla(this.currentChannel, username, undefined, sebep || 'Moderatör');
    if (!r.ok) console.warn(`[Twitch] ban başarısız (${username}):`, r.hata);
    return r.ok ? { ok: true } : { ok: false, hata: r.hata };
  }

  async unbanUser(username: string): Promise<ModerasyonSonucu> {
    if (!this.currentChannel) return { ok: false, hata: 'Twitch kanalı bağlı değil' };
    const r = await this.helix.yasakKaldir(this.currentChannel, username);
    if (!r.ok) console.warn(`[Twitch] ban kaldırma başarısız (${username}):`, r.hata);
    return r.ok ? { ok: true } : { ok: false, hata: r.hata };
  }

  async deleteMessage(messageId: string): Promise<ModerasyonSonucu> {
    if (!this.currentChannel) return { ok: false, hata: 'Twitch kanalı bağlı değil' };
    const r = await this.helix.mesajSil(this.currentChannel, messageId);
    if (!r.ok) console.warn('[Twitch] mesaj silme başarısız:', r.hata);
    return r.ok ? { ok: true } : { ok: false, hata: r.hata };
  }

  async sohbetiTemizle(): Promise<{ ok: boolean; yontem?: 'komut'; hata?: string }> {
    if (!this.currentChannel) return { ok: false, hata: 'Twitch kanalı bağlı değil' };
    const r = await this.helix.sohbetiTemizle(this.currentChannel);
    return r.ok ? { ok: true, yontem: 'komut' } : { ok: false, hata: r.hata };
  }

  /** Sohbet modları (yavaş / takipçi / abone / emote / benzersiz). Gövde önceden doğrulanmış olmalı. */
  async sohbetModu(govde: Record<string, boolean | number>): Promise<ModerasyonSonucu> {
    if (!this.currentChannel) return { ok: false, hata: 'Twitch kanalı bağlı değil' };
    const r = await this.helix.sohbetModlari(this.currentChannel, govde);
    if (!r.ok) console.warn('[Twitch] sohbet modu değiştirilemedi:', r.hata);
    return r.ok ? { ok: true } : { ok: false, hata: r.hata };
  }

  /** `!accountage` için. */
  async hesapOlusturma(login: string): Promise<number | null> {
    if (!this.botToken) return null;
    return this.helix.hesapOlusturma(login);
  }

  // ------------------------------------------- Helix: yayın ve kanal -------

  async yayinDurumu(): Promise<YayinBilgisi | null> {
    // Anonim IRC okuyucusunun jetonu yok: durum bilinemez (null = değiştirme)
    if (!this.connected || !this.currentChannel || !this.botToken) return null;
    const r = await this.helix.yayin(this.currentChannel);
    if (!r.ok) return null;
    return { ...r.veri, kanal: this.currentChannel };
  }

  async baslikDegistir(baslik: string): Promise<ModerasyonSonucu> {
    const r = await this.helix.kanalGuncelle(this.currentChannel, { baslik });
    return r.ok ? { ok: true } : { ok: false, hata: r.hata };
  }

  async takipciSayisi(): Promise<{ ok: true; sayi: number } | { ok: false; hata: string }> {
    if (!this.botToken || !this.currentChannel) return { ok: false, hata: 'Twitch bağlı değil' };
    const r = await this.helix.takipciSayisi(this.currentChannel);
    return r.ok ? { ok: true, sayi: r.veri } : { ok: false, hata: r.hata };
  }

  async klipOlustur(): Promise<{ ok: true; url: string } | { ok: false; hata: string }> {
    if (!this.botToken || !this.currentChannel) return { ok: false, hata: 'Twitch bağlı değil' };
    const r = await this.helix.klipOlustur(this.currentChannel);
    return r.ok ? { ok: true, url: r.veri.url } : { ok: false, hata: r.hata };
  }

  async isaretKoy(aciklama: string): Promise<ModerasyonSonucu> {
    const r = await this.helix.isaretKoy(this.currentChannel, aciklama);
    return r.ok ? { ok: true } : { ok: false, hata: r.hata };
  }

  async reklamBaslat(saniye: number): Promise<ModerasyonSonucu> {
    const r = await this.helix.reklamBaslat(this.currentChannel, saniye);
    return r.ok ? { ok: true } : { ok: false, hata: r.hata };
  }

  async kategoriDegistir(kategori: string): Promise<ModerasyonSonucu & { kategori?: string }> {
    const k = await this.helix.kategoriBul(kategori);
    if (!k.ok) return { ok: false, hata: k.hata };
    const r = await this.helix.kanalGuncelle(this.currentChannel, { kategoriId: k.veri.id });
    return r.ok ? { ok: true, kategori: k.veri.ad } : { ok: false, hata: r.hata };
  }

  isConnected(): boolean {
    return this.connected;
  }

  getStatus(): PlatformStatus {
    return {
      connected: this.connected,
      channel: this.currentChannel
    };
  }
}

export const twitchPlatform = new TwitchPlatform();
export default twitchPlatform;
