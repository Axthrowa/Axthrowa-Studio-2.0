import axios from 'axios';
import { BasePlatform, PlatformStatus } from './base.js';
import { eventBus } from '../core/event-bus.js';
import { db } from '../db/index.js';

export class YouTubePlatform extends BasePlatform {
  readonly name = 'youtube' as const;
  private connected: boolean = false;
  private currentChannel: string = '';
  private liveChatId: string = '';
  private apiKey: string = '';
  private oauthToken: string = '';
  private pollInterval: NodeJS.Timeout | null = null;
  private nextPageToken: string = '';

  async connect(): Promise<boolean> {
    const channelRow = db.prepare("SELECT * FROM channels WHERE platform = 'youtube' AND is_active = 1 LIMIT 1").get() as any;
    if (!channelRow || !channelRow.channel_name) {
      this.connected = false;
      return false;
    }

    this.currentChannel = channelRow.channel_name.trim();
    this.apiKey = channelRow.token || '';
    this.oauthToken = channelRow.refresh_token || '';

    // If channel_name contains direct liveChatId or video ID
    if (this.currentChannel.startsWith('Cg') || this.currentChannel.length > 20) {
      this.liveChatId = this.currentChannel;
    }

    this.connected = true;
    this.startPolling();
    console.log(`[YouTube] Listening for live chat on channel/video: ${this.currentChannel}`);
    return true;
  }

  private startPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);

    this.pollInterval = setInterval(async () => {
      if (!this.connected || !this.apiKey || !this.liveChatId) return;

      try {
        let url = `https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${this.liveChatId}&part=snippet,authorDetails&key=${this.apiKey}`;
        if (this.nextPageToken) {
          url += `&pageToken=${this.nextPageToken}`;
        }

        const res = await axios.get(url, { timeout: 5000 });
        this.nextPageToken = res.data.nextPageToken;

        const items = res.data.items || [];
        for (const item of items) {
          const author = item.authorDetails || {};
          const snippet = item.snippet || {};

          // Check SuperChat
          if (snippet.type === 'superChatEvent') {
            const sc = snippet.superChatDetails || {};
            eventBus.emitTip({
              platform: 'youtube',
              channel: this.currentChannel,
              username: author.displayName,
              displayName: author.displayName,
              amount: parseFloat(sc.amountMicros) / 1000000,
              currency: sc.currency,
              message: sc.userComment,
              timestamp: new Date(snippet.publishedAt).getTime()
            });
          }

          // Normal text message
          const text = snippet.displayMessage || snippet.textMessageDetails?.messageText;
          if (text) {
            eventBus.emitChat({
              id: item.id,
              platform: 'youtube',
              channel: this.currentChannel,
              user: {
                id: author.channelId,
                username: author.displayName,
                displayName: author.displayName,
                badges: author.isChatModerator ? ['moderator'] : [],
                isMod: Boolean(author.isChatModerator),
                isSub: Boolean(author.isChatSponsor),
                isVip: false,
                isBroadcaster: Boolean(author.isChatOwner),
                avatarUrl: author.profileImageUrl
              },
              message: text,
              timestamp: new Date(snippet.publishedAt).getTime()
            });
          }
        }
      } catch (err: any) {
        // Silent poll fallback
      }
    }, 4500);
  }

  async disconnect(): Promise<void> {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.connected = false;
  }

  async sendMessage(channel: string, message: string): Promise<boolean> {
    if (!this.oauthToken || !this.liveChatId) {
      console.log(`[YouTube Mock-Send]: ${message} (OAuth token required for YouTube live chat writing)`);
      return false;
    }

    try {
      await axios.post(
        `https://www.googleapis.com/youtube/v3/liveChat/messages?part=snippet`,
        {
          snippet: {
            liveChatId: this.liveChatId,
            type: 'textMessageEvent',
            textMessageDetails: {
              messageText: message
            }
          }
        },
        {
          headers: {
            Authorization: `Bearer ${this.oauthToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return true;
    } catch (err) {
      console.error('[YouTube] Failed to send live chat message:', err);
      return false;
    }
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

export const youtubePlatform = new YouTubePlatform();
export default youtubePlatform;
