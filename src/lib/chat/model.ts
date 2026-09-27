/**
 * Evrensel çok platformlu sohbet — normalleştirilmiş model.
 *
 * Kimlik ilkesi: bir izleyici **platform + platformdaki kullanıcı kimliği** ile tanınır. Twitch'teki "ali" ile
 * YouTube'daki "ali" farklı insanlardır; kullanıcı adına göre birleştirilmez. Kimlik yoksa (platform vermediyse)
 * yedek anahtar `platform:ad:<küçük harf ad>` olur ve `userKeySource: "name"` ile işaretlenir.
 */

export const CHAT_PLATFORMS = ["kick", "twitch", "youtube", "trovo", "discord", "tiktok"] as const;
export type ChatPlatform = (typeof CHAT_PLATFORMS)[number] | "unknown";

export type ChatRole = "broadcaster" | "moderator" | "vip" | "subscriber";

/** Kara liste / kalkan: bot yok sayar, OBS sohbetinde gösterilmez (StreamAxT işaretler) */
export type ModerationState = "visible" | "blocked" | "shielded";

export type NormalizedChatMessage = {
  /** `platform:messageId` — tekilleştirme anahtarı */
  key: string;
  messageId: string;
  platform: ChatPlatform;
  /** kanal / yayıncı adı (bahsetme tespiti için) */
  channelId: string;
  /** `platform:userId` — kişi kimliği */
  userKey: string;
  userKeySource: "id" | "name";
  userId: string;
  username: string;
  displayName: string;
  avatar?: string;
  color?: string;
  badges: string[];
  roles: ChatRole[];
  timestamp: number;
  message: string;
  isBot: boolean;
  isSystem: boolean;
  mentionsChannel: boolean;
  isQuestion: boolean;
  isPaid: boolean;
  amount?: number;
  currency?: string;
  moderation: ModerationState;
  moderationReason?: string;
  /** bu oturumda kişinin ilk iletisi (depo ekler) */
  firstInSession?: boolean;
};

export type ActivityEvent = {
  /** olay kimliği (StreamAxT uyarı kimliği) — tekilleştirme */
  eventId: string;
  platform: ChatPlatform;
  eventType: string;
  user: string;
  timestamp: number;
  amount?: number;
  currency?: string;
  quantity?: number;
  months?: number;
  viewers?: number;
  message?: string;
  isTest: boolean;
  /** StreamAxT uyarı kuyruğundaki kimlik — yeniden oynatma için */
  alertId?: string;
};

export const PLATFORM_LABEL: Record<ChatPlatform, string> = {
  kick: "Kick",
  twitch: "Twitch",
  youtube: "YouTube",
  trovo: "Trovo",
  discord: "Discord",
  tiktok: "TikTok",
  unknown: "?",
};

/** Rozet kısaltması (logo değil — marka görseli kullanılmaz) */
export const PLATFORM_SHORT: Record<ChatPlatform, string> = {
  kick: "KK",
  twitch: "TW",
  youtube: "YT",
  trovo: "TR",
  discord: "DC",
  tiktok: "TT",
  unknown: "??",
};

export const ACTIVITY_LABEL: Record<string, string> = {
  follow: "takip etti",
  sub: "abone oldu",
  gift_sub: "hediye abonelik",
  resub: "aboneliğini yeniledi",
  tip: "bağış yaptı",
  kicks: "Kicks gönderdi",
  raid: "baskın yaptı",
  host: "host etti",
  gift_tiktok: "TikTok hediyesi",
  loyalty_redeemed: "ödül aldı",
};
