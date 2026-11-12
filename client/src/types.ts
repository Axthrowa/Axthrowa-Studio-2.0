export interface PlatformStatus {
  connected: boolean;
  channel?: string;
  error?: string;
  viewerCount?: number;
}

export interface ChannelConfig {
  id: string;
  platform: 'twitch' | 'kick' | 'youtube' | 'discord' | 'tiktok' | 'trovo';
  channel_name: string;
  account_id?: string;
  token?: string;
  refresh_token?: string;
  is_active: number;
}

export interface CustomCommand {
  id: string;
  name: string;
  response: string;
  user_level: 'everyone' | 'regular' | 'sub' | 'vip' | 'mod' | 'broadcaster';
  cooldown: number;
  aliases: string;
  is_enabled: number;
  use_count: number;
  description?: string;
  /** Örnek alınan bot komut formu alanları (sunucu: command-input.ts) */
  cooldown_mode?: 'global' | 'user';
  user_cooldown?: number;
  cost_points?: number;
  min_level?: number;
  /** Virgüllü; boş = tüm platformlar */
  platforms?: string;
  trigger_type?: 'command' | 'keyword';
  access_mode?: 'always' | 'online' | 'offline';
  /** 1: yetki, bekleme ya da erişim reddinde sohbete kısa yanıt yazılır */
  refusal_reply?: number;
}

export interface TimerConfig {
  id: string;
  name: string;
  messages: string;
  interval_minutes: number;
  min_chat_lines: number;
  is_enabled: number;
  last_run_at?: number;
}

export interface AutoModSettings {
  caps_enabled: number;
  caps_min_length: number;
  caps_max_percent: number;
  emotes_enabled: number;
  emotes_max: number;
  links_enabled: number;
  links_whitelist: string[];
  symbols_enabled: number;
  symbols_max_percent: number;
  blacklist_words: string[];
  ai_moderation_enabled: number;
  ai_toxicity_threshold: number;
}

export interface SongItem {
  id: string;
  title: string;
  url: string;
  duration: number;
  requestedBy: string;
  platform: string;
  thumbnail?: string;
  createdAt: number;
}

export interface Giveaway {
  id: string;
  title: string;
  keyword: string;
  is_active: number;
  sub_bonus_multiplier: number;
  cost_points: number;
  winner?: string;
  winner_platform?: string;
  created_at: number;
}

export interface AlertPreset {
  id: string;
  event_type: 'follow' | 'sub' | 'tip' | 'raid' | 'gift_tiktok' | 'gift_sub' | 'host' | 'kicks';
  title_template: string;
  message_template: string;
  sound_url: string;
  image_url: string;
  duration_ms: number;
  font_family: string;
  text_color: string;
  accent_color: string;
  animation: 'bounce' | 'fade' | 'slide' | 'zoom';
  sound_volume: number;
  is_enabled: number;
}

export interface StreamEvent {
  id: string;
  platform: 'twitch' | 'kick' | 'youtube' | 'discord' | 'tiktok' | 'trovo';
  event_type: 'chat' | 'follow' | 'sub' | 'tip' | 'raid' | 'gift';
  username: string;
  display_name?: string;
  message?: string;
  amount?: number;
  currency?: string;
  avatar_url?: string;
  timestamp: number;
}

export interface ChatMessage {
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
    color?: string;
    rawBadges?: any[];
    avatarUrl?: string;
  };
  message: string;
  /** Twitch emote konumları (kimlik → "baş-son") */
  emotes?: Record<string, string[]>;
  timestamp: number;
  /** Ortak kara listedeki kullanıcı: panelde işaretli, OBS katmanında gizli. */
  karaListede?: boolean;
  /** Açık kalkanın kuralına takıldı (abone/link/caps/emoji): panelde işaretli, OBS katmanında gizli. */
  kalkanda?: 'abone' | 'link' | 'caps' | 'emoji';
}
