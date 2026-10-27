import { Client, GatewayIntentBits, TextChannel } from 'discord.js';
import { BasePlatform, PlatformStatus, ModerasyonSonucu } from './base.js';
import { eventBus } from '../core/event-bus.js';
import { db } from '../db/index.js';

/** Discord zaman aşımı üst sınırı: 28 gün (API). */
const EN_UZUN_ZAMAN_ASIMI_MS = 28 * 24 * 60 * 60 * 1000;

/** discord.js hatasını kullanıcıya söylenebilir metne çevirir. */
function discordHatasi(e: any): string {
  const kod = Number(e?.code);
  if (kod === 50013) return 'Botun bu sunucuda gerekli izni yok (Mesajları Yönet / Üyelere Zaman Aşımı / Üyeleri Yasakla)';
  if (kod === 10008) return 'Mesaj bulunamadı (zaten silinmiş olabilir)';
  if (kod === 10007 || kod === 10013) return 'Kullanıcı bu sunucuda bulunamadı';
  if (kod === 10026) return 'Bu kullanıcı yasaklı değil';
  return String(e?.message || e).slice(0, 160);
}

export class DiscordPlatform extends BasePlatform {
  readonly name = 'discord' as const;
  private client: Client | null = null;
  private connected: boolean = false;
  private currentChannelId: string = '';
  /**
   * Kullanıcı adı → Discord kullanıcı kimliği (sohbetten öğrenilir).
   * Moderasyon arayüzü kullanıcı adıyla çalışıyor; Discord kimlik ister.
   */
  private kimlikler = new Map<string, string>();

  async connect(): Promise<boolean> {
    const channelRow = db.prepare("SELECT * FROM channels WHERE platform = 'discord' AND is_active = 1 LIMIT 1").get() as any;
    if (!channelRow || !channelRow.token) {
      this.connected = false;
      return false;
    }

    const token = channelRow.token.trim();
    this.currentChannelId = channelRow.channel_name.trim(); // used as Discord Channel ID

    try {
      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent
        ]
      });

      this.client.on('ready', () => {
        this.connected = true;
        console.log(`[Discord] Bot logged in as ${this.client?.user?.tag}`);
      });

      this.client.on('messageCreate', (message) => {
        // Başka botlar yok sayılır; kendi mesajımız panelde görünsün diye isSelf ile geçer
        const kendi = message.author.id === this.client?.user?.id;
        if (message.author.bot && !kendi) return;

        // Only listen in designated channel if configured
        if (this.currentChannelId && message.channelId !== this.currentChannelId) {
          return;
        }

        const isMod = message.member?.permissions.has('ModerateMembers') || message.member?.permissions.has('Administrator') || false;
        this.kimlikler.set(message.author.username.toLowerCase(), message.author.id);
        if (this.kimlikler.size > 5000) this.kimlikler.clear();

        eventBus.emitChat({
          id: message.id,
          platform: 'discord',
          channel: message.channelId,
          user: {
            id: message.author.id,
            username: message.author.username,
            displayName: message.author.displayName || message.author.username,
            badges: isMod ? ['moderator'] : [],
            isMod,
            isSub: false,
            isVip: false,
            isBroadcaster: message.author.id === message.guild?.ownerId,
            avatarUrl: message.author.displayAvatarURL(),
            isSelf: kendi
          },
          message: message.content,
          timestamp: message.createdTimestamp
        });
      });

      await this.client.login(token);
      return true;
    } catch (err: any) {
      console.error('[Discord] Login failed:', err?.message || err);
      this.connected = false;
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.destroy();
      this.client = null;
    }
    this.connected = false;
  }

  async sendMessage(channelId: string, message: string): Promise<boolean> {
    if (!this.connected || !this.client) {
      console.log(`[Discord Mock-Send to channel ${channelId}]: ${message}`);
      return false;
    }

    try {
      const targetId = channelId || this.currentChannelId;
      const ch = await this.client.channels.fetch(targetId);
      if (ch && ch.isTextBased()) {
        // GÜVENLİK: bot mesajları başka platformlardan aktarılan izleyici
        // metnini taşıyor (sohbet aktarımı, komut yanıtları). Eskiden
        // `@everyone` / `@here` / rol etiketi olduğu gibi gidiyor, sunucudaki
        // HERKESE bildirim düşüyordu. Bot mesajı kimseyi etiketlemez.
        await (ch as TextChannel).send({ content: message, allowedMentions: { parse: [] } });
        return true;
      }
      return false;
    } catch (err) {
      console.error('[Discord] Failed to send message:', err);
      return false;
    }
  }

  // ------------------------------------------------------- moderasyon ------
  // discord.js v14 (belgeli): mesaj silme `Mesajları Yönet`, zaman aşımı
  // `Üyelere Zaman Aşımı Uygula`, ban `Üyeleri Yasakla` izni ister. İzin yoksa
  // hata SEBEBİYLE döner (sessiz kalmaz).

  private async kanal(): Promise<TextChannel | null> {
    if (!this.connected || !this.client || !this.currentChannelId) return null;
    const ch = await this.client.channels.fetch(this.currentChannelId).catch(() => null);
    return ch && ch.isTextBased() && 'guild' in ch ? (ch as TextChannel) : null;
  }

  private kullaniciKimligi(username: string): string | undefined {
    return this.kimlikler.get(String(username || '').replace(/^@/, '').trim().toLowerCase());
  }

  async deleteMessage(messageId: string): Promise<ModerasyonSonucu> {
    const ch = await this.kanal();
    if (!ch) return { ok: false, hata: 'Discord kanalı bağlı değil' };
    try {
      await ch.messages.delete(String(messageId));
      return { ok: true };
    } catch (e) {
      return { ok: false, hata: discordHatasi(e) };
    }
  }

  async timeoutUser(username: string, saniye: number, sebep?: string): Promise<ModerasyonSonucu> {
    const ch = await this.kanal();
    if (!ch) return { ok: false, hata: 'Discord kanalı bağlı değil' };
    const id = this.kullaniciKimligi(username);
    if (!id) return { ok: false, hata: `${username} bu oturumda sohbette görülmedi (kimlik yok)` };
    try {
      const uye = await ch.guild.members.fetch(id);
      const ms = Math.min(EN_UZUN_ZAMAN_ASIMI_MS, Math.max(1000, Math.round(Number(saniye) * 1000)));
      await uye.timeout(ms, String(sebep || 'AutoMod').slice(0, 400));
      return { ok: true };
    } catch (e) {
      return { ok: false, hata: discordHatasi(e) };
    }
  }

  async banUser(username: string, sebep?: string): Promise<ModerasyonSonucu> {
    const ch = await this.kanal();
    if (!ch) return { ok: false, hata: 'Discord kanalı bağlı değil' };
    const id = this.kullaniciKimligi(username);
    if (!id) return { ok: false, hata: `${username} bu oturumda sohbette görülmedi (kimlik yok)` };
    try {
      await ch.guild.members.ban(id, { reason: String(sebep || 'Moderatör').slice(0, 400) });
      return { ok: true };
    } catch (e) {
      return { ok: false, hata: discordHatasi(e) };
    }
  }

  async unbanUser(username: string): Promise<ModerasyonSonucu> {
    const ch = await this.kanal();
    if (!ch) return { ok: false, hata: 'Discord kanalı bağlı değil' };
    const id = this.kullaniciKimligi(username);
    if (!id) return { ok: false, hata: `${username} bu oturumda sohbette görülmedi (kimlik yok)` };
    try {
      await ch.guild.members.unban(id);
      return { ok: true };
    } catch (e) {
      return { ok: false, hata: discordHatasi(e) };
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getStatus(): PlatformStatus {
    return {
      connected: this.connected,
      channel: this.currentChannelId
    };
  }
}

export const discordPlatform = new DiscordPlatform();
export default discordPlatform;
