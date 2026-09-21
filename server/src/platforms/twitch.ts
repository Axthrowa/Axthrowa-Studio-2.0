import WebSocket from 'ws';
import { BasePlatform, PlatformStatus } from './base.js';
import { eventBus } from '../core/event-bus.js';
import { db } from '../db/index.js';

export class TwitchPlatform extends BasePlatform {
  readonly name = 'twitch' as const;
  private ws: WebSocket | null = null;
  private connected: boolean = false;
  private currentChannel: string = '';
  private botToken: string = '';
  private botUsername: string = '';

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

    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

        this.ws.on('open', () => {
          if (!this.ws) return;

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

        this.ws.on('message', (data: WebSocket.Data) => {
          this.handleIrcMessage(data.toString());
        });

        this.ws.on('close', () => {
          this.connected = false;
          console.log('[Twitch] Disconnected');
        });

        this.ws.on('error', (err) => {
          console.error('[Twitch] WebSocket error:', err.message);
          this.connected = false;
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

      eventBus.emitChat({
        id: tags['id'] || String(Date.now()),
        platform: 'twitch',
        channel: this.currentChannel,
        user: {
          id: tags['user-id'] || username,
          username: username.toLowerCase(),
          displayName: username,
          badges: badgesStr.split(',').filter(Boolean),
          rawBadges: badgesStr.split(',').filter(Boolean),
          color: tags['color'] || undefined,
          isMod,
          isSub,
          isVip,
          isBroadcaster
        },
        message: messageText,
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
      this.ws.send(`PRIVMSG #${channel} :${message}`);
      return true;
    } catch (err) {
      console.error('[Twitch] Failed to send message:', err);
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

export const twitchPlatform = new TwitchPlatform();
export default twitchPlatform;
