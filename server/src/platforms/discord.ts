import { Client, GatewayIntentBits, TextChannel } from 'discord.js';
import { BasePlatform, PlatformStatus } from './base.js';
import { eventBus } from '../core/event-bus.js';
import { db } from '../db/index.js';

export class DiscordPlatform extends BasePlatform {
  readonly name = 'discord' as const;
  private client: Client | null = null;
  private connected: boolean = false;
  private currentChannelId: string = '';

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
        // Ignore bot messages
        if (message.author.bot) return;

        // Only listen in designated channel if configured
        if (this.currentChannelId && message.channelId !== this.currentChannelId) {
          return;
        }

        const isMod = message.member?.permissions.has('ModerateMembers') || message.member?.permissions.has('Administrator') || false;

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
            avatarUrl: message.author.displayAvatarURL()
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
        await (ch as TextChannel).send(message);
        return true;
      }
      return false;
    } catch (err) {
      console.error('[Discord] Failed to send message:', err);
      return false;
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
