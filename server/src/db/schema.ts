export interface StreamEvent {
  id: string;
  platform: 'twitch' | 'kick' | 'youtube' | 'discord' | 'tiktok' | 'trovo';
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
  /**
   * Ortak kara listedeki kullanıcı yazınca: yok say (varsayılan, eski
   * davranış) / mesajı platformda sil / platformda kalıcı banla.
   */
  karaListeEylemi?: 'yoksay' | 'sil' | 'ban';
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


