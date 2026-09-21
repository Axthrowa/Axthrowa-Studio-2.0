export interface ChannelConfig {
  id: string;
  platform: 'twitch' | 'kick' | 'youtube' | 'discord' | 'tiktok';
  channelName: string;
  accountId?: string;
  token?: string;
  refreshToken?: string;
  isActive: boolean;
  createdAt: number;
}

export interface CustomCommand {
  id: string;
  name: string;
  response: string;
  userLevel: 'everyone' | 'sub' | 'vip' | 'mod' | 'broadcaster';
  cooldown: number; // in seconds
  aliases?: string[];
  isEnabled: boolean;
  useCount: number;
  description?: string;
}

export interface TimerConfig {
  id: string;
  name: string;
  messages: string[];
  intervalMinutes: number;
  minChatLines: number;
  isEnabled: boolean;
  lastRunAt?: number;
}

export interface AutoModSettings {
  capsEnabled: boolean;
  capsMinLength: number;
  capsMaxPercent: number;
  emotesEnabled: boolean;
  emotesMax: number;
  linksEnabled: boolean;
  linksWhitelist: string[];
  symbolsEnabled: boolean;
  symbolsMaxPercent: number;
  blacklistWords: string[];
  aiModerationEnabled: boolean;
  aiToxicityThreshold: number; // 1 to 10
}

export interface EconomyUser {
  id: string;
  platform: string;
  username: string;
  displayName: string;
  points: number;
  watchTimeMinutes: number;
  messagesCount: number;
  subsCount: number;
  giftedSubsCount: number;
  tipsAmount: number;
  loyaltyTier: string;
  lastActive: number;
}

export interface LoyaltyReward {
  id: string;
  title: string;
  cost: number;
  rewardType: 'tts' | 'sound' | 'gif' | 'vip' | 'priority_song';
  payload?: string;
  isEnabled: boolean;
}

export interface Poll {
  id: string;
  title: string;
  options: string[];
  isActive: boolean;
  createdAt: number;
  closedAt?: number;
}

export interface PinnedMessage {
  id: string;
  platform: string;
  username: string;
  displayName: string;
  message: string;
  color?: string;
  createdAt: number;
}

export interface ChatOverlaySettings {
  maxMessages: number;
  fontSize: number;
  showPlatformLogo: boolean;
  showBadges: boolean;
  showTimestamp: boolean;
  highlightSpecial: boolean;
  fadeMessages: boolean;
  fadeTimeout: number; // in seconds
  smoothMask: boolean;
  textShadow: boolean;
  transparentBg: boolean;
}

export interface SongQueueItem {
  id: string;
  title: string;
  url: string;
  duration: number; // in seconds
  requestedBy: string;
  platform: string;
  thumbnail?: string;
  createdAt: number;
  isPlayed: boolean;
}

export interface Giveaway {
  id: string;
  title: string;
  keyword: string;
  isActive: boolean;
  subBonusMultiplier: number;
  costPoints: number;
  winner?: string;
  winnerPlatform?: string;
  createdAt: number;
  closedAt?: number;
}

export interface GiveawayEntry {
  id: string;
  giveawayId: string;
  username: string;
  platform: string;
  tickets: number;
  enteredAt: number;
}

export interface AlertPreset {
  id: string;
  eventType: 'follow' | 'sub' | 'gift' | 'gift_sub' | 'tip' | 'raid' | 'kick' | 'kicks' | 'host' | 'gift_tiktok';
  titleTemplate: string;
  messageTemplate: string;
  soundUrl: string;
  imageUrl: string;
  durationMs: number;
  fontFamily: string;
  textColor: string;
  accentColor: string;
  animation: 'fade' | 'bounce' | 'slide' | 'zoom';
  soundVolume: number;
  isEnabled: boolean;
}

export interface StreamEvent {
  id: string;
  platform: 'twitch' | 'kick' | 'youtube' | 'discord' | 'tiktok';
  eventType: 'chat' | 'follow' | 'sub' | 'gift' | 'gift_sub' | 'tip' | 'kicks' | 'host' | 'raid';
  username: string;
  displayName?: string;
  message?: string;
  amount?: number;
  currency?: string;
  avatarUrl?: string;
  metadata?: Record<string, any>;
  timestamp: number;
}

export interface AuditLog {
  id: string;
  timestamp: number;
  action: string;
  moderator: string;
  target?: string;
  details?: string;
  severity?: 'info' | 'warn' | 'danger';
}

export interface ViewerNote {
  username: string;
  note: string;
  tags?: string[];
  sentiment?: 'positive' | 'neutral' | 'negative';
  updatedAt: number;
}

export interface KingState {
  id: string;
  currentKing: string;
  displayName: string;
  avatarUrl?: string;
  pointsBid: number;
  crownTime: number;
  reignSeconds: number;
  title: string;
  history?: string; // JSON array of past kings
}

export interface TTSSettings {
  primaryEngine: 'edge' | 'google' | 'gemini' | 'elevenlabs' | 'webspeech';
  fallbackChain: ('edge' | 'google' | 'gemini' | 'elevenlabs' | 'webspeech')[];
  language?: string;
  edgeVoice: string;
  googleLang: string;
  geminiVoice: string;
  elevenlabsApiKey?: string;
  elevenlabsVoiceId?: string;
  speed: number;
  pitch: number;
  volume: number;
  profanityFilter: boolean;
  removeUrls: boolean;
  maxLength: number;
  minPointsOrDonation?: number;
  /** Erkek karakterde Google motoru (kadın tonlu) kullanılsın mı? Varsayılan: evet. */
  googleForMale?: boolean;
}

export interface Donation {
  id: string;
  donorName: string;
  amount: number;
  currency: string;
  message?: string;
  platform: 'bynogame' | 'webhook' | 'kofi' | 'custom';
  createdAt: number;
  alertShown: boolean;
  jumpscareTriggered: boolean;
}

export interface JumpScareSettings {
  isEnabled: boolean;
  minAmount: number;
  mediaType: 'video' | 'image' | 'audio';
  mediaUrl: string;
  audioUrl?: string;
  durationMs: number;
  volume: number;
}

export interface ShieldModeSettings {
  isActive: boolean;
  activatedAt?: number;
  autoClearRaidMessages: boolean;
  minAccountAgeDays: number;
  blockLinks: boolean;
  blockCaps: boolean;
  blockEmotes: boolean;
  followerOnly: boolean;
  subOnly: boolean;
}

export interface ChatRescueSettings {
  isEnabled: boolean;
  inactivityMinutes: number;
  personality: 'friendly' | 'troll' | 'wise' | 'gamer' | 'custom';
  customPrompt?: string;
  allowPolls: boolean;
  allowTrivia: boolean;
  lastRescuedAt?: number;
}

export type TriviaCategory = 
  | 'Genel Kültür' 
  | 'Bilgi' 
  | 'Oyun' 
  | 'Film ve Dizi' 
  | 'Coğrafya' 
  | 'Tarih'
  | 'Spor'
  | 'Bilim'
  | 'Sanat'
  | 'Sinema TV'
  | 'Tıbbi Terimler'
  | 'Azerbaycan Türkçesi'
  | 'Gündem 2000/26'
  | 'Basketbol'
  | 'Ekonomi'
  | 'Türk Mutfağı'
  | 'Teknoloji'
  | 'Oyunlar'
  | 'İz Bırakanlar'
  | 'Geçmişten Günümüze'
  | '4 İşlem'
  | 'Osmanlı Tarihi'
  | 'Yazım Yanlışları'
  | 'Söz ve Deyiş'
  | string;

export interface TriviaQuestion {
  id: string;
  category: TriviaCategory;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: 'A' | 'B' | 'C' | 'D';
  points: number;
  explanation?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  createdAt: number;
}

export interface TriviaScore {
  username: string;
  displayName: string;
  platform: string;
  totalScore: number;
  correctCount: number;
  wrongCount: number;
  fastestMs: number;
  currentStreak: number;
  bestStreak: number;
  lastPlayed: number;
}


