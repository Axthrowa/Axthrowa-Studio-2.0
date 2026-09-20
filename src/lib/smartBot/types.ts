/** Yerel akıllı bot — StreamElements / Botaxt tarzı çekirdek tipler. */

export type UserLevel = 100 | 250 | 400 | 500 | 1000 | 1500;

export type BotCommand = {
  id: string;
  name: string;
  aliases: string[];
  response: string;
  enabled: boolean;
  /** Kullanıcı başına cooldown (sn) */
  userCooldownSec: number;
  /** Global cooldown (sn) */
  globalCooldownSec: number;
  level: UserLevel;
  /** Her tetiklemede $(count) artar */
  count: number;
};

export type BotTimer = {
  id: string;
  name: string;
  message: string;
  enabled: boolean;
  /** Dakika */
  intervalMin: number;
  /** Bu kadar satır olmadan gönderme (Botaxt lines) */
  minLines: number;
  platforms: Array<"kick" | "twitch" | "youtube" | "all">;
};

export type BotCounter = {
  id: string;
  name: string;
  value: number;
};

export type LoyaltyUser = {
  points: number;
  messages: number;
  watchMin: number;
  lastSeen: number;
};

export type SpamFilters = {
  enabled: boolean;
  bannedWords: string[];
  blockLinks: boolean;
  maxCapsPercent: number;
  maxMessageLen: number;
  permitSec: number;
  maxEmotes: number;
  maxSymbols: number;
  action: "warn" | "delete_warn";
  timeoutSec: number;
  bypassMods: boolean;
  bypassSubs: boolean;
};

export type BotModules = {
  eightball: boolean;
  raffle: boolean;
  giveaway: boolean;
  roulette: boolean;
  slots: boolean;
  gamble: boolean;
  quotes: boolean;
  queue: boolean;
  chatAlerts: boolean;
  loyalty: boolean;
  songRequest: boolean;
  sfx: boolean;
  poll: boolean;
  prediction: boolean;
  shop: boolean;
  emoteCombo: boolean;
  subathon: boolean;
  wheel: boolean;
  hypeTrain: boolean;
  clip: boolean;
};

export type Quote = {
  id: string;
  text: string;
  by: string;
  addedBy: string;
  ts: number;
};

export type BotConfig = {
  version: 1 | 2;
  enabled: boolean;
  botName: string;
  /** Overlay + platformlara yaz */
  replyToOverlay: boolean;
  replyToKick: boolean;
  replyToTwitch: boolean;
  replyToYoutube: boolean;
  replyDelayMs: number;
  streamStartedAt: number | null;
  channelName: string;
  title: string;
  game: string;
  pointsName: string;
  pointsPerMessage: number;
  pointsPerMinute: number;
  commands: BotCommand[];
  timers: BotTimer[];
  counters: BotCounter[];
  loyalty: Record<string, LoyaltyUser>;
  quotes: Quote[];
  filters: SpamFilters;
  modules: BotModules;
  /** Kick OAuth client id (panelden) */
  kickClientId: string;
  kickClientSecret: string;
  /** Twitch / YouTube yazma (Client ID — Developer Console) */
  twitchClientId: string;
  youtubeClientId: string;
  /** Discord OAuth Client ID (Developer Portal) */
  discordClientId: string;
};

export type BotReply = {
  lines: string[];
  platform?: "kick" | "twitch" | "youtube";
  silent?: boolean;
};

export const LEVEL_LABELS: Record<UserLevel, string> = {
  100: "Herkes",
  250: "Abone",
  400: "VIP",
  500: "Moderatör",
  1000: "Süper mod",
  1500: "Yayıncı",
};

export function uid(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function defaultBotConfig(): BotConfig {
  return {
    version: 1,
    enabled: true,
    botName: "BotAxT",
    replyToOverlay: true,
    replyToKick: true,
    replyToTwitch: true,
    replyToYoutube: true,
    replyDelayMs: 250,
    streamStartedAt: null,
    channelName: "",
    title: "",
    game: "",
    pointsName: "puan",
    pointsPerMessage: 1,
    pointsPerMinute: 2,
    commands: [
      {
        id: uid("cmd"),
        name: "sosyal",
        aliases: ["socials", "links"],
        response: "Sosyal: paneldaki Giriş → Sosyal hesaplara bak! Merhaba $(user) 👋",
        enabled: true,
        userCooldownSec: 8,
        globalCooldownSec: 3,
        level: 100,
        count: 0,
      },
      {
        id: uid("cmd"),
        name: "discord",
        aliases: ["dc"],
        response: "Discord: {url}",
        enabled: true,
        userCooldownSec: 10,
        globalCooldownSec: 5,
        level: 100,
        count: 0,
      },
    ],
    timers: [
      {
        id: uid("tm"),
        name: "Sosyal hatırlatma",
        message: "Takip + !sosyal — komutlar: !komutlar",
        enabled: false,
        intervalMin: 8,
        minLines: 12,
        platforms: ["all"],
      },
    ],
    counters: [{ id: uid("ctr"), name: "death", value: 0 }],
    loyalty: {},
    quotes: [],
    filters: {
      enabled: false,
      bannedWords: [],
      blockLinks: false,
      maxCapsPercent: 80,
      maxMessageLen: 400,
      permitSec: 30,
      maxEmotes: 8,
      maxSymbols: 20,
      action: "warn",
      timeoutSec: 60,
      bypassMods: true,
      bypassSubs: false,
    },
    modules: {
      eightball: true,
      raffle: true,
      giveaway: true,
      roulette: true,
      slots: true,
      gamble: true,
      quotes: true,
      queue: true,
      chatAlerts: true,
      loyalty: true,
      songRequest: true,
      sfx: true,
      poll: true,
      prediction: true,
      shop: true,
      emoteCombo: true,
      subathon: true,
      wheel: true,
      hypeTrain: true,
      clip: true,
    },
    kickClientId: "",
    kickClientSecret: "",
    twitchClientId: "",
    youtubeClientId: "",
    discordClientId: "",
  };
}
