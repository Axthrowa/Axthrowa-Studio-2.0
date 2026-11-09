import { EventEmitter } from 'events';
import { db } from '../db/index.js';
import { randomUUID as uuidv4 } from 'crypto';
import { StreamEvent } from '../db/schema.js';
import { seyrekUyar } from './logger.js';

export interface ChatMessagePayload {
  id: string;
  platform: 'twitch' | 'kick' | 'youtube' | 'discord' | 'tiktok' | 'trovo';
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
  platform: 'twitch' | 'kick' | 'youtube' | 'discord' | 'tiktok' | 'trovo';
  channel: string;
  username: string;
  displayName?: string;
  timestamp: number;
}

export interface SubPayload {
  platform: 'twitch' | 'kick' | 'youtube' | 'discord' | 'tiktok' | 'trovo';
  channel: string;
  username: string;
  displayName?: string;
  tier: string;
  months: number;
  isGift: boolean;
  recipient?: string;
  /**
   * Hediye abonelikte ADET. Eskiden adet yalnız `recipient` metninden
   * ("5 izleyiciye") ayıklanıyordu; Trovo'nun rastgele hediyesinde metin
   * olmadığı için sayı 1'e düşüyordu.
   */
  count?: number;
  timestamp: number;
}

export interface TipPayload {
  platform: 'twitch' | 'kick' | 'youtube' | 'discord' | 'tiktok' | 'trovo';
  channel: string;
  username: string;
  displayName?: string;
  amount: number;
  currency: string;
  message?: string;
  timestamp: number;
}

/** Kick'in kendi para birimi. `amount` KICKs adedidir. */
export interface KicksPayload {
  platform: 'kick';
  channel: string;
  username: string;
  displayName?: string;
  amount: number;
  message?: string;
  timestamp: number;
}

export interface HostPayload {
  platform: 'twitch' | 'kick';
  channel: string;
  username: string;
  displayName?: string;
  viewers: number;
  timestamp: number;
}

export interface RaidPayload {
  platform: 'twitch' | 'kick' | 'youtube' | 'discord' | 'tiktok' | 'trovo';
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
  platform: 'twitch' | 'kick' | 'youtube' | 'discord' | 'tiktok' | 'trovo' | 'all';
  channel?: string;
  message: string;
  replyToId?: string;
  /** `!bot mute` açıkken bile gönderilsin (susturma/açma onayı). */
  sessizdeBile?: boolean;
  /** Yayıncı panelden yazdı: komutsa yayıncı yetkisiyle çalıştırılır (bkz. pipeline). */
  panelden?: boolean;
}

class UniversalEventBus extends EventEmitter {
  /** Budama sıklığı için kayıt sayacı (bkz. logEvent). */
  private eklemeSayaci = 0;

  constructor() {
    super();
    this.setMaxListeners(50);
  }

  emitChat(payload: ChatMessagePayload) {
    // emit() ilk fırlatan dinleyicide durur: OBS yayını, komut hattı ve olay kaydı birbirini
    // düşürmesin, hata platform bağdaştırıcısına taşmasın diye her dinleyici ayrı korunur.
    for (const dinleyici of this.rawListeners('chat')) {
      try {
        dinleyici.call(this, payload);
      } catch (e) {
        seyrekUyar('olay:chat-dinleyici', '[EventBus] Sohbet dinleyicisi hata verdi', e);
      }
    }
    this.logEvent({
      id: payload.id || uuidv4(),
      platform: payload.platform,
      eventType: 'chat',
      username: payload.user.username,
      displayName: payload.user.displayName,
      message: payload.message,
      avatarUrl: payload.user.avatarUrl,
      timestamp: payload.timestamp
    }, (payload as any)?.isTest === true);
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
    }, (payload as any)?.isTest === true);
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
    }, (payload as any)?.isTest === true);
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
    }, (payload as any)?.isTest === true);
  }

  /**
   * KICKs olayi. Veri yolunda karsiligi YOKTU: `alert_presets` tablosunda
   * `kicks` satiri vardi ama gercek yayinda hic tetiklenmiyordu, yalniz
   * "Test" dugmesiyle geliyordu.
   */
  emitKicks(payload: KicksPayload) {
    this.emit('kicks', payload);
    this.logEvent({
      id: uuidv4(),
      platform: payload.platform,
      eventType: 'kicks',
      username: payload.username,
      displayName: payload.displayName || payload.username,
      amount: payload.amount,
      currency: 'KICK',
      message: payload.message,
      timestamp: payload.timestamp
    }, (payload as any)?.isTest === true);
  }

  emitHost(payload: HostPayload) {
    this.emit('host', payload);
    this.logEvent({
      id: uuidv4(),
      platform: payload.platform,
      eventType: 'host',
      username: payload.username,
      displayName: payload.displayName || payload.username,
      amount: payload.viewers,
      message: `${payload.viewers} izleyiciyle host`,
      timestamp: payload.timestamp
    }, (payload as any)?.isTest === true);
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
    }, (payload as any)?.isTest === true);
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
    }, (payload as any)?.isTest === true);
  }

  /** Sohbete yazma denemesi başarısız oldu — panele sebebiyle bildir. */
  emitSendError(platform: string, reason: string) {
    this.emit('bot_send_error', { platform, reason });
  }

  emitBotMessage(payload: BotMessagePayload) {
    this.emit('bot_message', payload);
  }

  private logEvent(event: StreamEvent, test = false) {
    // Test uyarısı kayda "isTest" işaretiyle düşer: son takipçi/abone etiketleri ve
    // $(followers) gibi sayımlar sahte test adlarını gerçek olay saymasın.
    if (test) event = { ...event, metadata: { ...(event.metadata || {}), isTest: true } };
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

      // Tablo sınırsız büyümesin. Eskiden TEK sınır (son 1000 kayıt) vardı ve
      // her sohbet mesajı da buraya yazıldığı için hareketli bir sohbette
      // takip/abone/bağış kayıtları dakikalar içinde siliniyordu (olay akışı,
      // kapanış jeneriği boş kalıyordu). Sohbet ve olaylar ayrı budanır; her
      // eklemede değil, 50 eklemede bir.
      if (++this.eklemeSayaci % 50 === 0) {
        db.prepare(`
          DELETE FROM stream_events WHERE event_type = 'chat' AND id NOT IN (
            SELECT id FROM stream_events WHERE event_type = 'chat' ORDER BY timestamp DESC LIMIT 2000
          )
        `).run();
        db.prepare(`
          DELETE FROM stream_events WHERE event_type <> 'chat' AND id NOT IN (
            SELECT id FROM stream_events WHERE event_type <> 'chat' ORDER BY timestamp DESC LIMIT 1000
          )
        `).run();
      }
    } catch (err) {
      console.error('Failed to log stream event:', err);
    }
  }
}

export const eventBus = new UniversalEventBus();
export default eventBus;

/** Hediye abonelik adedi: önce `count`, yoksa `recipient` metnindeki sayı, yoksa 1. */
export function hediyeAdedi(p: { count?: unknown; recipient?: unknown } | null | undefined): number {
  const n = Number(p?.count);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  const m = String(p?.recipient ?? '').match(/\d+/);
  return m ? Math.max(1, Number(m[0])) : 1;
}
