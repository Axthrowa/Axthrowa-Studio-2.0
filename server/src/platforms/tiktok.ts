import { BasePlatform, PlatformStatus } from './base.js';
import { eventBus } from '../core/event-bus.js';
import { db } from '../db/index.js';

export class TikTokPlatform extends BasePlatform {
  readonly name = 'tiktok' as const;
  private tiktokLiveConnection: any = null;
  private connected: boolean = false;
  private currentChannel: string = '';

  async connect(): Promise<boolean> {
    const channelRow = db.prepare("SELECT * FROM channels WHERE platform = 'tiktok' AND is_active = 1 LIMIT 1").get() as any;
    if (!channelRow || !channelRow.channel_name) {
      this.connected = false;
      return false;
    }

    const username = channelRow.channel_name.trim().replace('@', '');
    this.currentChannel = username;

    try {
      const { TikTokLiveConnection } = await import('tiktok-live-connector');
      this.tiktokLiveConnection = new TikTokLiveConnection(username, {
        processInitialData: false,
        enableExtendedGiftInfo: true
      } as any);

      const state = await this.tiktokLiveConnection.connect();
      this.connected = true;
      console.log(`[TikTok] Connected to room ID: ${state.roomId} (@${username})`);

      // 1. Chat messages
      this.tiktokLiveConnection.on('chat', (data: any) => {
        try {
          eventBus.emitChat({
            id: data.msgId || String(Date.now()),
            platform: 'tiktok',
            channel: username,
            user: {
              id: data.userId || data.uniqueId,
              username: data.uniqueId,
              displayName: data.nickname || data.uniqueId,
              badges: data.isModerator ? ['moderator'] : [],
              isMod: Boolean(data.isModerator),
              isSub: Boolean(data.isSubscriber),
              isVip: false,
              isBroadcaster: data.uniqueId.toLowerCase() === username.toLowerCase(),
              avatarUrl: data.profilePictureUrl
            },
            message: data.comment,
            timestamp: Date.now()
          });
        } catch (err) {
          console.error('[TikTok] Chat error:', err);
        }
      });

      // 2. Gifts
      this.tiktokLiveConnection.on('gift', (data: any) => {
        try {
          // Only emit alert on gift finish/streak end or non-streakable gift
          if (data.giftType === 1 && !data.repeatEnd) {
            return;
          }

          eventBus.emitTikTokGift({
            platform: 'tiktok',
            channel: username,
            username: data.uniqueId,
            displayName: data.nickname || data.uniqueId,
            giftName: data.giftName || 'Hediye',
            count: data.repeatCount || 1,
            diamonds: (data.diamondCount || 1) * (data.repeatCount || 1),
            avatarUrl: data.profilePictureUrl,
            timestamp: Date.now()
          });
        } catch (err) {
          console.error('[TikTok] Gift error:', err);
        }
      });

      // 3. Follows
      this.tiktokLiveConnection.on('follow', (data: any) => {
        try {
          eventBus.emitFollow({
            platform: 'tiktok',
            channel: username,
            username: data.uniqueId,
            displayName: data.nickname || data.uniqueId,
            timestamp: Date.now()
          });
        } catch (err) {
          console.error('[TikTok] Follow error:', err);
        }
      });

      // 4. Stream End
      this.tiktokLiveConnection.on('streamEnd', () => {
        console.log('[TikTok] Stream ended by broadcaster');
        this.connected = false;
      });

      return true;
    } catch (err: any) {
      console.warn(`[TikTok] Failed to connect to @${username} (Stream may be offline):`, err?.message || err);
      this.connected = false;
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.tiktokLiveConnection) {
      try {
        this.tiktokLiveConnection.disconnect();
      } catch {}
      this.tiktokLiveConnection = null;
    }
    this.connected = false;
  }

  async sendMessage(channel: string, message: string): Promise<boolean> {
    // Note: TikTok does not allow sending chat via reverse API; read-only stream.
    console.log(`[TikTok Bot message for @${channel}]: ${message} (TikTok public chat is read-only)`);
    return false;
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

export const tiktokPlatform = new TikTokPlatform();
export default tiktokPlatform;
