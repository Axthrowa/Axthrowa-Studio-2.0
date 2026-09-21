import { EventEmitter } from 'events';
import { db } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import { StreamEvent } from '../db/schema.js';

export interface ChatMessagePayload {
  id: string;
  platform: 'twitch' | 'kick' | 'youtube' | 'discord' | 'tiktok';
  channel: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    badges: string[];
    isMod: boolean;
    isSub: boolean;
    isVip: boolean;
    isBroadcaster: boolean;
    isSelf?: boolean;
    color?: string;
    rawBadges?: any[];
    avatarUrl?: string;
  };
  message: string;
  emotes?: Record<string, string[]>;
  timestamp: number;
}

export interface FollowPayload {
  platform: 'twitch' | 'kick' | 'youtube' | 'discord' | 'tiktok';
  channel: string;
  username: string;
  displayName?: string;
  timestamp: number;
}

export interface SubPayload {
  platform: 'twitch' | 'kick' | 'youtube' | 'discord' | 'tiktok';
  channel: string;
  username: string;
  displayName?: string;
  tier: string;
  months: number;
  isGift: boolean;
  recipient?: string;
  timestamp: number;
}

export interface TipPayload {
  platform: 'twitch' | 'kick' | 'youtube' | 'discord' | 'tiktok';
  channel: string;
  username: string;
  displayName?: string;
  amount: number;
  currency: string;
  message?: string;
  timestamp: number;
}

export interface RaidPayload {
  platform: 'twitch' | 'kick' | 'youtube' | 'discord' | 'tiktok';
  channel: string;
  username: string;
  displayName?: string;
  viewers: number;
  timestamp: number;
}

export interface TikTokGiftPayload {
  platform: 'tiktok';
  channel: string;
  username: string;
  displayName?: string;
  giftName: string;
  count: number;
  diamonds: number;
  avatarUrl?: string;
  timestamp: number;
}

export interface BotMessagePayload {
  platform: 'twitch' | 'kick' | 'youtube' | 'discord' | 'tiktok' | 'all';
  channel?: string;
  message: string;
  replyToId?: string;
}

class UniversalEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  emitChat(payload: ChatMessagePayload) {
    this.emit('chat', payload);
    this.logEvent({
      id: payload.id || uuidv4(),
      platform: payload.platform,
      eventType: 'chat',
      username: payload.user.username,
      displayName: payload.user.displayName,
      message: payload.message,
      avatarUrl: payload.user.avatarUrl,
      timestamp: payload.timestamp
    });
  }

  emitFollow(payload: FollowPayload) {
    this.emit('follow', payload);
    this.logEvent({
      id: uuidv4(),
      platform: payload.platform,
      eventType: 'follow',
      username: payload.username,
      displayName: payload.displayName || payload.username,
      timestamp: payload.timestamp
    });
  }

  emitSub(payload: SubPayload) {
    this.emit('sub', payload);
    this.logEvent({
      id: uuidv4(),
      platform: payload.platform,
      eventType: 'sub',
      username: payload.username,
      displayName: payload.displayName || payload.username,
      message: `${payload.tier} - ${payload.months} Ay`,
      timestamp: payload.timestamp
    });
  }

  emitTip(payload: TipPayload) {
    this.emit('tip', payload);
    this.logEvent({
      id: uuidv4(),
      platform: payload.platform,
      eventType: 'tip',
      username: payload.username,
      displayName: payload.displayName || payload.username,
      amount: payload.amount,
      currency: payload.currency,
      message: payload.message,
      timestamp: payload.timestamp
    });
  }

  emitRaid(payload: RaidPayload) {
    this.emit('raid', payload);
    this.logEvent({
      id: uuidv4(),
      platform: payload.platform,
      eventType: 'raid',
      username: payload.username,
      displayName: payload.displayName || payload.username,
      amount: payload.viewers,
      message: `${payload.viewers} izleyiciyle raid`,
      timestamp: payload.timestamp
    });
  }

  emitTikTokGift(payload: TikTokGiftPayload) {
    this.emit('gift_tiktok', payload);
    this.logEvent({
      id: uuidv4(),
      platform: 'tiktok',
      eventType: 'gift',
      username: payload.username,
      displayName: payload.displayName || payload.username,
      message: `x${payload.count} ${payload.giftName}`,
      amount: payload.diamonds,
      currency: 'Diamonds',
      avatarUrl: payload.avatarUrl,
      timestamp: payload.timestamp
    });
  }

  /** Sohbete yazma denemesi başarısız oldu — panele sebebiyle bildir. */
  emitSendError(platform: string, reason: string) {
    this.emit('bot_send_error', { platform, reason });
  }

  emitBotMessage(payload: BotMessagePayload) {
    this.emit('bot_message', payload);
  }

  private logEvent(event: StreamEvent) {
    try {
      db.prepare(`
        INSERT INTO stream_events (id, platform, event_type, username, display_name, message, amount, currency, avatar_url, metadata, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        event.id,
        event.platform,
        event.eventType,
        event.username,
        event.displayName || null,
        event.message || null,
        event.amount || null,
        event.currency || null,
        event.avatarUrl || null,
        event.metadata ? JSON.stringify(event.metadata) : null,
        event.timestamp
      );

      // Keep only last 1000 events to prevent unbounded table growth
      db.prepare(`
        DELETE FROM stream_events WHERE id NOT IN (
          SELECT id FROM stream_events ORDER BY timestamp DESC LIMIT 1000
        )
      `).run();
    } catch (err) {
      console.error('Failed to log stream event:', err);
    }
  }
}

export const eventBus = new UniversalEventBus();
export default eventBus;
