/**
 * StreamAxT widget defaults
 * Developed by AxthrowA
 */

export const FONTS = [
  'Plus Jakarta Sans', 'Inter', 'Roboto', 'Montserrat', 'Oswald', 'Poppins',
  'Anton', 'Russo One', 'Bangers', 'Teko', 'Orbitron', 'Nunito'
];

export const ANIMATIONS = [
  { value: 'none', label: 'Yok' },
  { value: 'fade', label: 'Fade' },
  { value: 'slide', label: 'Slide' },
  { value: 'slide-left', label: 'Slide Left' },
  { value: 'slide-right', label: 'Slide Right' },
  { value: 'slide-up', label: 'Slide Up' },
  { value: 'bounce', label: 'Bounce' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'pulse', label: 'Pulse' }
];

export const ACTIVITY_DEFAULTS = {
  showFollow: true,
  showSub: true,
  showGiftSub: true,
  showTip: true,
  showRaid: true,
  showHost: true,
  showKicks: true,
  showBits: true,
  maxItems: 8,
  newestFirst: true,
  showIcons: true,
  showTimestamp: true,
  compact: false,
  hideEmpty: false,
  fontFamily: 'Plus Jakarta Sans',
  fontSize: 14,
  fontWeight: 700,
  fontColor: '#ffffff',
  letterSpacing: 0,
  backgroundColor: '#000000',
  backgroundOpacity: 0.75,
  borderRadius: 16,
  borderColor: '#ffffff22',
  outlineEnabled: false,
  outlineColor: '#000000',
  outlineWidth: 2,
  animation: 'slide',
  animationDuration: 400,
  gap: 8,
  iconFollow: '💜',
  iconSub: '⭐',
  iconGiftSub: '🎁',
  iconTip: '💰',
  iconRaid: '🚀',
  iconHost: '📺',
  iconKicks: '💚',
  templateFollow: '{user} takip etti',
  templateSub: '{user} abone oldu',
  templateGiftSub: '{user} {count} hediye abone gönderdi',
  templateTip: '{user} {amount} {currency} bağışladı',
  templateRaid: '{user} {viewers} kişiyle raid yaptı',
  templateHost: '{user} host etti',
  templateKicks: '{user} {amount} Kick gönderdi',
  soundEnabled: false,
  soundUrl: '',
  soundVolume: 0.5,
  mute: false,
  paused: false
};

export const CHAT_DEFAULTS = {
  maxMessages: 40,
  fontSize: 22,
  fontFamily: 'Plus Jakarta Sans',
  fontWeight: 600,
  textColor: '#ffffff',
  usernameColorMode: 'user',
  customUsernameColor: '#a78bfa',
  lineHeight: 1.35,
  letterSpacing: 0,
  showPlatformLogo: true,
  showBadges: true,
  showTimestamp: true,
  showAvatars: true,
  highlightSpecial: true,
  fadeMessages: true,
  fadeTimeout: 17,
  smoothMask: true,
  textShadow: true,
  transparentBg: true,
  hideCommands: true,
  hideBots: true,
  hideEmoteOnly: false,
  ignoreList: '',
  animation: 'fade',
  align: 'left',
  reverse: false,
  messageBgColor: '#000000',
  messageBgOpacity: 0.5,
  borderRadius: 12,
  gap: 10,
  outlineEnabled: false,
  outlineColor: '#000000',
  outlineWidth: 1,
  highlightColor: '#7c3aed',
  hideBroadcaster: false
};

export const GOAL_DEFAULTS = {
  title: 'Hedef',
  endingTitle: 'Hedefe ulaşıldı! 🎉',
  current: 0,
  target: 1000,
  currency: 'TL',
  type: 'tip',
  fontFamily: 'Plus Jakarta Sans',
  fontSize: 14,
  fontWeight: 800,
  fontColor: '#ffffff',
  barColor: '#10b981',
  barBackground: '#ffffff1a',
  barHeight: 20,
  barRadius: 999,
  layout: 'text-above',
  showRemaining: true,
  showPercent: true,
  showGlow: true,
  decimals: 0,
  prefix: '',
  suffix: '',
  outlineEnabled: false,
  outlineColor: '#000000',
  outlineWidth: 2,
  animation: 'pulse',
  backgroundColor: '#000000',
  backgroundOpacity: 0.85,
  borderRadius: 16,
  letterSpacing: 0.5,
  textTransform: 'uppercase'
};

export const EMOTE_COMBO_DEFAULTS = {
  minCombo: 3,
  timeoutMs: 5000,
  displayMs: 4000,
  size: 64,
  showFloating: true,
  showPopup: true,
  confetti: true,
  soundEnabled: true,
  soundUrl: '',
  soundVolume: 0.6,
  animation: 'bounce',
  fontFamily: 'Anton',
  fontSize: 64,
  fontColor: '#fbbf24',
  outlineEnabled: true,
  outlineColor: '#000000',
  outlineWidth: 3,
  backgroundColor: '#000000',
  backgroundOpacity: 0.85,
  borderColor: '#fbbf24',
  template: 'x{count} COMBO!',
  subTemplate: '{emote} ÇILGINLIĞI!',
  onlyKnownEmotes: false
};

export const LABELS_DEFAULTS = {
  template: 'Son takip: {lastFollower}  |  Son abone: {lastSub}  |  Son bağış: {lastTip}  |  Top bağış: {topTipper}',
  showFollow: true,
  showSub: true,
  showTip: true,
  showTop: true,
  showRaid: false,
  separator: '  |  ',
  fontFamily: 'Plus Jakarta Sans',
  fontSize: 16,
  fontWeight: 700,
  fontColor: '#e2e8f0',
  letterSpacing: 0.5,
  textTransform: 'none',
  outlineEnabled: true,
  outlineColor: '#000000',
  outlineWidth: 2,
  animation: 'marquee',
  marqueeSpeed: 40,
  backgroundColor: '#000000',
  backgroundOpacity: 0.85,
  borderRadius: 16,
  height: 44,
  paddingX: 20
};

export const POLL_DEFAULTS = {
  command: '!oy',
  fontFamily: 'Plus Jakarta Sans',
  fontSize: 14,
  fontColor: '#ffffff',
  titleColor: '#34d399',
  barColor: '#10b981',
  barBackground: '#171717',
  showPercent: true,
  showVotes: true,
  hideUntilEnd: false,
  backgroundColor: '#000000',
  backgroundOpacity: 0.9,
  borderColor: '#10b981',
  borderRadius: 16,
  animation: 'fade',
  outlineEnabled: false,
  outlineColor: '#000000',
  outlineWidth: 1
};

export const WHEEL_DEFAULTS = {
  size: 300,
  maxLabel: 14,
  segments: [
    { label: 'Ahmet_34', color: '#8b5cf6', weight: 1 },
    { label: 'ProPlayer', color: '#ec4899', weight: 1 },
    { label: 'KralGamer', color: '#3b82f6', weight: 1 },
    { label: 'AyseLive', color: '#10b981', weight: 1 },
    { label: 'Can_99', color: '#f59e0b', weight: 1 },
    { label: 'Ece_Star', color: '#06b6d4', weight: 1 },
    { label: 'Berk_GG', color: '#6366f1', weight: 1 },
    { label: 'Zeynep_X', color: '#ef4444', weight: 1 }
  ],
  spinMs: 4500,
  extraSpins: 6,
  pointerColor: '#ef4444',
  borderColor: '#a855f7',
  fontFamily: 'Plus Jakarta Sans',
  fontSize: 12,
  fontColor: '#ffffff',
  soundEnabled: true,
  confetti: true,
  command: '!cark',
  outlineEnabled: true,
  outlineColor: '#000000',
  outlineWidth: 1,
  animation: 'ease-out'
};

export const ALERT_ADVANCED_DEFAULTS = {
  queueEnabled: true,
  gapMs: 800,
  ttsEnabled: false,
  ttsReadMessage: true,
  globalVolume: 0.7,
  layoutMode: 'stacked',
  animation: 'bounce',
  textEffect: 'shine',
  minTipAmount: 0,
  minKicks: 0,
  skipEnabled: true,
  confetti: true,
  fontFamily: 'Plus Jakarta Sans'
};

export const GIVEAWAY_DEFAULTS = {
  keyword: '!katil',
  durationMinutes: 10,
  winnerCount: 1,
  maxEntries: 0,
  costPoints: 0,
  subBonusMultiplier: 2,
  followerOnly: false,
  subOnly: false,
  minWatchMinutes: 0,
  minMessages: 0,
  announceChat: true,
  duplicatePrevent: true,
  autoClose: true,
  overlayTitle: 'ÇEKİLİŞ',
  fontFamily: 'Plus Jakarta Sans',
  fontSize: 18,
  fontColor: '#ffffff',
  accentColor: '#a855f7',
  backgroundColor: '#000000',
  backgroundOpacity: 0.85,
  borderRadius: 16,
  animation: 'fade',
  showKeyword: true,
  showEntries: true,
  showTimer: true,
  confetti: true
};


/**
 * Subathon sayacı — olay başına eklenecek süreler panelden ayarlanır.
 * `tipMinutes` her `tipPerAmount` birim bağış için eklenir (ör. 10₺ başına 2 dk).
 */
/**
 * Subathon — YALNIZ görünüm ayarları.
 *
 * Süre kuralları (abone / hediye abone / bağış / KICKs kaç dakika ekler)
 * artık SUNUCUDA tutuluyor: `/api/subathon/settings`. Sayaç tarayıcıda
 * yaşarken iki OBS kaynağı iki farklı süre gösteriyordu ve KICKs hiç
 * işlenmiyordu. Kurallar Overlay Stüdyo > Subathon panelinden ayarlanır.
 */
export const SUBATHON_DEFAULTS = {
  title: 'SUBATHON',
  notifyMs: 4000,
  showTotalAdded: true,
  hideWhenIdle: false,
  accentColor: '#22d3ee',
  accentColor2: '#34d399'
};

export const TRIVIA_DEFAULTS = {
  maxWidth: 672,
  radius: 24,
  cardColor: '#090d16',
  cardOpacity: 0.95,
  borderColor: '#ffffff',
  borderOpacity: 0.1,
  shadowColor: '#000000',
  shadowOpacity: 0.85,
  soundEnabled: true
};


/** İzleyici sayacı — tema, hizalama, ikon ve platform seçimi. */
export const VIEWER_COUNTER_DEFAULTS = {
  title: 'İZLEYİCİ',
  theme: 'classic',
  layout: 'column',
  align: 'left',
  fontFamily: 'Plus Jakarta Sans',
  fontSize: 18,
  textColor: '#ffffff',
  accentColor: '#22d3ee',
  bgColor: '#000000',
  bgOpacity: 0.8,
  borderColor: '#ffffff',
  radius: 16,
  paddingX: 16,
  paddingY: 12,
  showTitle: true,
  showTotal: true,
  showPerPlatform: true,
  showPlatformName: false,
  showIcons: true,
  compactNumbers: false,
  showKick: true,
  showTwitch: true,
  showYoutube: true
};


/** Şu an çalan şarkı kartı — tasarım, kapak, ekolayzer, renkler. */
export const NOW_PLAYING_DEFAULTS = {
  theme: 'base',
  label: 'ŞU AN ÇALAN',
  align: 'left',
  fontFamily: 'Plus Jakarta Sans',
  fontSize: 12,
  textColor: '#ffffff',
  accentColor: '#22d3ee',
  accentColor2: '#34d399',
  bgColor: '#000000',
  bgOpacity: 0.85,
  radius: 16,
  paddingX: 14,
  paddingY: 12,
  maxWidth: 384,
  coverSize: 48,
  showCover: true,
  showLabel: true,
  showRequester: true,
  showEqualizer: true,
  marquee: false,
  hideWhenIdle: true
};

/** Bağış Kupası — tema, kap boyutu, emoji setleri ve eşikler. */
export const THE_CUP_DEFAULTS = {
  title: 'BAĞIŞ KUPASI',
  theme: 'glass',
  align: 'right',
  fontFamily: 'Plus Jakarta Sans',
  fontSize: 11,
  textColor: '#a5f3fc',
  accentColor: '#22d3ee',
  bgColor: '#083344',
  bgOpacity: 0.25,
  cupWidth: 192,
  cupHeight: 256,
  cupRadius: 40,
  borderWidth: 4,
  itemSize: 24,
  itemSizeVary: 8,
  maxItems: 45,
  minKicks: 0,
  minTipAmount: 0,
  emojiTip: '🪙,💰,💵',
  emojiSub: '⭐,👑,🚀',
  emojiGift: '🎁,💎,👑',
  emojiKicks: '🟢,💚,🔋',
  showLabel: true,
  showCount: true,
  showGlare: true,
  animateItems: true
};

/** Sabitlenmiş mesaj — tema, konum, otomatik gizleme. */
export const PINNED_DEFAULTS = {
  label: 'SABİTLENEN MESAJ',
  theme: 'card',
  position: 'top',
  align: 'center',
  fontFamily: 'Plus Jakarta Sans',
  fontSize: 14,
  textColor: '#f3f4f6',
  accentColor: '#22d3ee',
  bgColor: '#000000',
  bgOpacity: 0.9,
  borderColor: '#22d3ee',
  radius: 16,
  paddingX: 16,
  paddingY: 16,
  maxWidth: 512,
  icon: '📌',
  showIcon: true,
  showLabel: true,
  showAuthor: true,
  showPlatform: false,
  autoHideSeconds: 0
};

/** Shoutout — tema, süre, konfeti ve gösterilecek alanlar. */
export const SHOUTOUT_DEFAULTS = {
  label: 'YAYINCI TAVSİYESİ',
  theme: 'card',
  position: 'center',
  fontFamily: 'Plus Jakarta Sans',
  fontSize: 24,
  textColor: '#ffffff',
  accentColor: '#22d3ee',
  bgColor: '#000000',
  bgOpacity: 0.9,
  borderColor: '#22d3ee',
  radius: 24,
  paddingX: 24,
  paddingY: 24,
  maxWidth: 512,
  avatarSize: 80,
  durationMs: 8000,
  urlPrefix: 'kick.com/',
  defaultBio: 'Bu harika kanala göz atmayı ve takip etmeyi unutmayın!',
  showAvatar: true,
  showLabel: true,
  showBio: true,
  showUrl: true,
  confetti: true
};

/** Sıralama tablosu — sıralama ölçütü, tema, madalya ve satır sayısı. */
export const RANKINGS_DEFAULTS = {
  title: 'SIRALAMA',
  sort: 'points',
  theme: 'classic',
  limit: 10,
  refreshSeconds: 8,
  fontFamily: 'Plus Jakarta Sans',
  fontSize: 13,
  textColor: '#ffffff',
  accentColor: '#fbbf24',
  bgColor: '#000000',
  bgOpacity: 0.85,
  borderColor: '#ffffff',
  radius: 16,
  paddingX: 16,
  paddingY: 16,
  minWidth: 280,
  rowGap: 6,
  valueSuffix: '',
  showTitle: true,
  showRank: true,
  showMedals: true,
  showValue: true,
  highlightTop: true,
  compactNumbers: false,
  hideEmpty: true
};

/** Hype Treni — seviye eşiği, olay puanları ve görünüm. */
export const HYPE_TRAIN_DEFAULTS = {
  title: 'HYPE TRENİ',
  subtitle: 'Topluluk desteğiyle raylar ısınıyor!',
  theme: 'classic',
  fontFamily: 'Plus Jakarta Sans',
  fontSize: 14,
  textColor: '#ffffff',
  accentColor: '#6366f1',
  accentColor2: '#ec4899',
  bgColor: '#000000',
  bgOpacity: 0.9,
  borderColor: '#6366f1',
  radius: 16,
  paddingX: 16,
  paddingY: 16,
  levelGoal: 500,
  levelGrowth: 1.5,
  maxLevel: 10,
  windowSeconds: 300,
  pointsSub: 100,
  pointsGiftSub: 100,
  pointsTip: 10,
  pointsKicks: 1,
  pointsFollow: 5,
  showTimer: true,
  showLevel: true,
  showPercent: true,
  showSubtitle: true,
  showLastSupporter: true,
  hideWhenIdle: true
};

/** Şarkı sözleri — tema, satır sayısı ve tipografi. */
export const LYRICS_DEFAULTS = {
  theme: 'neon',
  fontFamily: 'Plus Jakarta Sans',
  fontSize: 30,
  contextFontSize: 14,
  textColor: '#ffffff',
  accentColor: '#22d3ee',
  contextColor: '#9ca3af',
  bgColor: '#000000',
  bgOpacity: 0.6,
  borderColor: '#22d3ee',
  radius: 16,
  paddingX: 20,
  paddingY: 20,
  maxWidth: 896,
  lineMs: 4500,
  refreshSeconds: 12,
  idleText: '🎵 Müzik ritmini dinliyor...',
  showTrack: true,
  showPrev: true,
  showNext: true,
  showDisc: true,
  hideWhenIdle: false
};

/** Yayın Kralı — taht kartı görünümü. */
export const KING_DEFAULTS = {
  title: 'YAYIN HÜKÜMDARI',
  theme: 'royal',
  fontFamily: 'Plus Jakarta Sans',
  fontSize: 18,
  textColor: '#ffffff',
  accentColor: '#f59e0b',
  bgColor: '#1c1917',
  bgOpacity: 0.85,
  borderColor: '#f59e0b',
  radius: 16,
  paddingX: 20,
  paddingY: 12,
  avatarSize: 48,
  pointsLabel: 'Puan',
  showAvatar: true,
  showCrown: true,
  showPoints: true,
  showReign: true,
  showTitle: true,
  hideWhenEmpty: false
};

/** JumpScare — varsayılan medya, süre ve tetikleme eşiği. */
export const JUMPSCARE_DEFAULTS = {
  mediaUrl: '',
  mediaType: 'image',
  audioUrl: '',
  durationMs: 4000,
  volume: 1,
  minTipAmount: 0,
  minKicks: 0,
  donorLabelColor: '#ef4444',
  fallbackEmoji: '💀',
  contrast: 150,
  brightness: 125,
  screamFallback: true,
  showDonor: true,
  shake: true
};

/** Sadakat ödülü bildirimi. */
export const LOYALTY_DEFAULTS = {
  label: 'SADAKAT MAĞAZASI KULLANILDI',
  theme: 'card',
  position: 'center',
  fontFamily: 'Plus Jakarta Sans',
  fontSize: 24,
  textColor: '#ffffff',
  accentColor: '#fbbf24',
  bgColor: '#000000',
  bgOpacity: 0.9,
  borderColor: '#fbbf24',
  radius: 24,
  paddingX: 24,
  paddingY: 24,
  maxWidth: 448,
  icon: '🎁',
  durationMs: 6000,
  pointsLabel: 'Puan',
  showIcon: true,
  showLabel: true,
  showCost: true,
  showPayload: true,
  confetti: true,
  soundEnabled: false
};

/** Jenerik (kapanış) — bölümler, hız ve başlıklar. */
export const END_CREDITS_DEFAULTS = {
  title: 'YAYINI İZLEDİĞİNİZ İÇİN TEŞEKKÜRLER!',
  subtitle: 'Bugünkü yayında bize destek olan harika topluluğumuz:',
  footer: 'Powered by StreamAxT',
  fontFamily: 'Plus Jakarta Sans',
  titleSize: 44,
  fontSize: 16,
  textColor: '#e5e7eb',
  accentColor: '#22d3ee',
  accentColor2: '#34d399',
  bgColor: '#000000',
  bgOpacity: 0,
  scrollSeconds: 35,
  maxPerSection: 15,
  gap: 48,
  titleSubs: 'ABONELERİMİZ',
  titleTips: 'DESTEKÇİLERİMİZ & BAĞIŞLAR',
  titleFollows: 'YENİ TAKİPÇİLER',
  titleRaids: 'RAID GÖNDERENLER',
  showSubs: true,
  showTips: true,
  showFollows: true,
  showRaids: false,
  showAmounts: true,
  showFooter: true,
  loop: true,
  hideEmpty: true
};

/** OBS ses oynatıcı (TTS) — ses düzeyi ve durum kartı. */
export const AUDIO_PLAYER_DEFAULTS = {
  volume: 0.8,
  maxQueue: 20,
  theme: 'status',
  fontFamily: 'Plus Jakarta Sans',
  fontSize: 12,
  textColor: '#9ca3af',
  accentColor: '#22d3ee',
  bgColor: '#000000',
  bgOpacity: 0.8,
  radius: 12,
  label: 'StreamAxT OBS Audio',
  showStatus: true,
  showText: true,
  showQueue: true,
  hideWhenIdle: false
};

export const WIDGET_DEFAULTS: Record<string, Record<string, any>> = {
  'activity-feed': ACTIVITY_DEFAULTS,
  'chat-overlay': CHAT_DEFAULTS,
  'donation-goal': { ...GOAL_DEFAULTS, title: 'Bağış Hedefi', type: 'tip', barColor: '#10b981', target: 1000 },
  'follower-goal': { ...GOAL_DEFAULTS, title: 'Takipçi Hedefi', type: 'follower', barColor: '#8b5cf6', target: 500, currency: '' },
  'subscriber-goal': { ...GOAL_DEFAULTS, title: 'Abone Hedefi', type: 'sub', barColor: '#ec4899', target: 250, currency: '' },
  'kicks-goal': { ...GOAL_DEFAULTS, title: 'KICKs Hedefi', type: 'kicks', barColor: '#53fc18', target: 500, currency: 'KICK' },
  'emote-combo': EMOTE_COMBO_DEFAULTS,
  'event-labels': LABELS_DEFAULTS,
  polls: POLL_DEFAULTS,
  'wheel-of-fortune': WHEEL_DEFAULTS,
  'alert-box': ALERT_ADVANCED_DEFAULTS,
  giveaways: GIVEAWAY_DEFAULTS,
  subathon: SUBATHON_DEFAULTS,
  trivia: TRIVIA_DEFAULTS,
  'viewer-counter': VIEWER_COUNTER_DEFAULTS,
  'now-playing': NOW_PLAYING_DEFAULTS,
  'the-cup': THE_CUP_DEFAULTS,
  'pinned-messages': PINNED_DEFAULTS,
  shoutout: SHOUTOUT_DEFAULTS,
  rankings: RANKINGS_DEFAULTS,
  'hype-train': HYPE_TRAIN_DEFAULTS,
  lyrics: LYRICS_DEFAULTS,
  king: KING_DEFAULTS,
  jumpscare: JUMPSCARE_DEFAULTS,
  'loyalty-redemptions': LOYALTY_DEFAULTS,
  'end-credits': END_CREDITS_DEFAULTS,
  'audio-player': AUDIO_PLAYER_DEFAULTS
};

export function parseBool(v: string | null, fallback: boolean) {
  if (v === null) return fallback;
  return v !== '0' && v !== 'false';
}
