/**
 * StreamAxT widget defaults
 * Developed by AxthrowA
 */

export const FONTS = [
  'Plus Jakarta Sans', 'Inter', 'Roboto', 'Montserrat', 'Oswald', 'Poppins',
  'Anton', 'Russo One', 'Bangers', 'Teko', 'Orbitron', 'Nunito',
  // Oyun & film temalarının yazı tipleri (Google Fonts, OFL)
  'Press Start 2P', 'VT323', 'Audiowide', 'Black Ops One', 'Cinzel', 'Special Elite', 'Creepster', 'Rye', 'Bebas Neue'
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
  // Kapalı: iletiler 17 sn sonra kayboluyor, OBS'te sohbet çoğu zaman boş görünüyordu.
  // Eskiler "en fazla mesaj" sınırıyla düşer.
  fadeMessages: false,
  fadeTimeout: 17,
  smoothMask: true,
  textShadow: true,
  transparentBg: true,
  hideCommands: true,
  hideBots: true,
  showOwnBot: true,
  hideEmoteOnly: false,
  ignoreList: '',
  animation: 'fade',
  align: 'left',
  reverse: false,
  layout: 'column',
  messageSound: false,
  messageSoundVolume: 0.4,
  messageBubbles: false,
  showDonations: true,
  showRedemptions: true,
  messageBgColor: '#000000',
  messageBgOpacity: 0.5,
  borderRadius: 12,
  gap: 10,
  outlineEnabled: false,
  outlineColor: '#000000',
  outlineWidth: 1,
  highlightColor: '#7c3aed',
  hideBroadcaster: false,
  // Hangi platformların sohbeti görünsün (BotRix "Platformlar" seçimi karşılığı)
  kickGoster: true,
  twitchGoster: true,
  youtubeGoster: true,
  tiktokGoster: true,
  trovoGoster: true,
  discordGoster: true
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
  textTransform: 'uppercase',
  // Çubuk görünümü (hedef temaları bunları doldurur)
  barStyle: 'flat',
  barColor2: '#f97316',
  barBorderColor: '#ffffff',
  barBorderWidth: 0,
  barIcon: '',
  // Koyu gölge: açık/renkli sahnede yazı okunmuyordu
  textShadow: true
};

/** Kappagen / Ekranda Emojiler */
export const KAPPAGEN_DEFAULTS = {
  fromChat: true,
  size: 64,
  durationMs: 3500,
  maxOnScreen: 60,
  burstCopies: 4,
  spin: true,
  shadow: true,
  paused: false
};

export const EMOTE_COMBO_DEFAULTS = {
  /** Kombo kutusu stili: none, pixel, neon, clean */
  comboStyle: 'none',
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
  onlyKnownEmotes: false,
  gatherMode: true,
  burstOnEnd: true
};

export const LABELS_DEFAULTS = {
  showFollow: true,
  showSub: true,
  showTip: true,
  showTop: true,
  showRaid: false,
  showKicks: false,
  showFollowers: false,
  labelFollow: 'Son takipçi:',
  labelSub: 'Son abone:',
  labelTip: 'Son bağış:',
  labelTop: 'En büyük bağış:',
  labelRaid: 'Son raid:',
  labelKicks: 'Son KICKs:',
  labelFollowers: 'Takipçi:',
  emptyValue: '—',
  separator: '•',
  layout: 'row',
  align: 'left',
  fontFamily: 'Plus Jakarta Sans',
  fontSize: 18,
  fontWeight: 800,
  fontColor: '#ffffff',
  labelColor: '#a5b4fc',
  letterSpacing: 0.3,
  textTransform: 'none',
  textShadow: true,
  outlineEnabled: false,
  outlineColor: '#000000',
  outlineWidth: 1,
  animation: 'fade',
  marqueeSpeed: 40,
  backgroundColor: '#0b0d13',
  backgroundOpacity: 0.8,
  borderRadius: 14,
  height: 48,
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
  /** Anket bittikten kaç sn sonra kaybolsun (0 = kalsın) */
  hideAfterSec: 8,
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
  /** !cark bekleme süresi (sn, herkes için ortak; mod/yayıncı muaf) */
  cevirmeBeklemeSn: 30,
  /** !cark puan maliyeti (0 = ücretsiz; mod/yayıncı muaf) */
  cevirmeMaliyeti: 0,
  /** Renk paleti: custom = dilimlerin kendi rengi */
  palette: 'custom',
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
  /** Yalnız çevrilince / ayar değişince görünsün */
  autoHide: true,
  /** Sonuçtan kaç sn sonra kaybolsun (0 = kalsın) */
  hideAfterSec: 10,
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

/**
 * Uyarı kutusu — BotRix'in uyarı sayfasındaki derinliğe göre genişletildi
 * (BOTRIX_ALERT_MATRIX §2). Eskiden 13 ayar vardı; metin katmanı, konum,
 * görünüm penceresi ve animasyon süresi hiç ayarlanamıyordu.
 */
export const ALERT_ADVANCED_DEFAULTS = {
  // Kuyruk
  queueEnabled: true,
  gapMs: 800,
  skipEnabled: true,

  // Ses
  ttsEnabled: false,
  ttsReadMessage: true,
  globalVolume: 0.7,

  // Yerleşim
  layoutMode: 'stacked',
  fontFamily: 'Plus Jakarta Sans',

  // Animasyon
  animation: 'bounce',
  animationDuration: 500,
  exitAnimation: 'fade',
  textEffect: 'shine',

  // Metin katmanları — BotRix'te üst ve alt metnin rengi AYRI ayarlanıyor
  titleColor: '#3EEDFE',
  messageColor: '#ffffff',
  titleSize: 36,
  messageSize: 18,
  textShadow: 80,
  textOffsetX: 0,
  textOffsetY: 0,
  hideUserMessage: false,

  // Metin görünüm penceresi (ms) — görsel/ses ile metin senkronizasyonu
  textFromMs: 0,
  textToMs: 0,

  // Görsel
  imageMaxHeight: 192,

  // Eşikler
  minTipAmount: 0,
  minKicks: 0,
  confetti: true
};

// Çekiliş KURALLARI (süre, kazanan sayısı, şartlar) Çekilişler sayfasında; bunlar yalnız katman görünümü.
// Eskiden kurallar burada da vardı ama hiçbir yerde okunmuyordu.
export const GIVEAWAY_DEFAULTS = {
  keyword: '!katil',
  overlayTitle: 'ÇEKİLİŞ',
  winnerShowSec: 12,
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
  showTimer: true
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
  accentColor2: '#34d399',
  // Görünüm: kart, minimal, dijital (LCD), çevirmeli kartlar, neon, tek satır hap
  theme: 'card',
  fontFamily: 'Plus Jakarta Sans',
  timeFontFamily: 'Orbitron',
  timeFontSize: 56,
  textColor: '#ffffff',
  bgColor: '#000000',
  bgOpacity: 0.85,
  radius: 16,
  icon: '⏳',
  showRules: true,
  showStatus: true
};

/** Kelime bulutu — sohbette en çok geçen sözcükler */
export const WORD_CLOUD_DEFAULTS = {
  maxWords: 40,
  minCount: 2,
  minSize: 16,
  maxSize: 72,
  verticalRatio: 0.2,
  colors: '#22d3ee,#a78bfa,#f472b6,#fbbf24,#34d399,#ffffff',
  fontFamily: 'Montserrat',
  bgColor: '#000000',
  bgOpacity: 0,
  radius: 16,
  textShadow: true,
  refreshSec: 5
};

/** Skor tablosu — takım adları/skorlar `!skortablo` ya da panelden */
export const SCOREBOARD_DEFAULTS = {
  theme: 'split',
  showTitle: true,
  fontFamily: 'Russo One',
  fontSize: 48,
  textColor: '#ffffff',
  accentColor: '#22d3ee',
  bgColor: '#000000',
  bgOpacity: 0.75,
  radius: 16
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
  soundEnabled: true,
  /** Doğru cevap gösterildikten kaç sn sonra kaybolsun (0 = kaybolmasın) */
  hideDelaySec: 3,
  /** Turnuva kürsüsü kaç sn ekranda kalsın (0 = kalsın) */
  podiumHideSec: 8
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
  /** logo = platform logosu, dot = renkli nokta */
  iconStyle: 'logo',
  compactNumbers: false,
  showKick: true,
  showTwitch: true,
  showYoutube: true
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
  animateItems: true,
  /** Kupayı dolduran olaylar (karar sunucuda: modules/engagement/kupa.ts) */
  fromTip: true,
  fromSub: true,
  fromGift: true,
  fromKicks: true
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
  /** Bu sayıdan fazla izleyiciyle raid gelirse otomatik göster (0 = kapalı) */
  raidOtomatikEsik: 0,
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
  /** Treni besleyen olaylar (karar sunucuda: modules/hype/hype-math.ts) */
  fromSub: true,
  fromGift: true,
  fromTip: true,
  fromKicks: true,
  fromFollow: false,
  /** Kapalıysa tren yalnız panelden "Başlat" ile başlar */
  autoStart: true,
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
  refreshSeconds: 5,
  idleText: '🎵 Müzik ritmini dinliyor...',
  notFoundText: 'Bu şarkının sözleri bulunamadı',
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
  hideWhenEmpty: false,
  /** Taht yalnız izleyiciler için: yayıncı tahta çıkamaz ve gösterilmez */
  onlyViewers: true,
  emptyText: 'Taht boş — !tahtikap <puan>'
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
  /** Jenerik son kaç saatin olaylarını tarar (BotRix "Taranacak saat") */
  taranacakSaat: 12,
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
  'on-screen-emotes': KAPPAGEN_DEFAULTS,
  'event-labels': LABELS_DEFAULTS,
  polls: POLL_DEFAULTS,
  'wheel-of-fortune': WHEEL_DEFAULTS,
  'alert-box': ALERT_ADVANCED_DEFAULTS,
  giveaways: GIVEAWAY_DEFAULTS,
  subathon: SUBATHON_DEFAULTS,
  trivia: TRIVIA_DEFAULTS,
  'viewer-counter': VIEWER_COUNTER_DEFAULTS,
  'the-cup': THE_CUP_DEFAULTS,
  'word-cloud': WORD_CLOUD_DEFAULTS,
  scoreboard: SCOREBOARD_DEFAULTS,
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


/**
 * Tek tuvaldeki hedef çubuğunun türü (yerleşim ayarı `goals.type`) → ayarları
 * kullanılan hedef widget'ı. Stüdyo formu ve OBS çıktısı AYNI kimliği kullanır.
 */
export function hedefWidgetKimligi(tur?: unknown): string {
  if (tur === 'sub') return 'subscriber-goal';
  if (tur === 'kicks') return 'kicks-goal';
  if (tur === 'tip' || tur === 'donation') return 'donation-goal';
  return 'follower-goal';
}

/** Olay başına uyarı kaydının varsayılanları (Uyarılar sayfası ve widget ayarları ortak kullanır) */
export const UYARI_OLAY_VARSAYILANLARI: Record<string, any> = {
  follow: { event_type: 'follow', title_template: 'YENİ TAKİPÇİ!', message_template: '{user} aileye katıldı!', accent_color: '#8b5cf6', duration_ms: 5000 },
  sub: { event_type: 'sub', title_template: 'YENİ ABONE!', message_template: '{user} {tier} ile abone oldu! ({months} ay)', accent_color: '#ec4899', duration_ms: 6500 },
  gift_sub: { event_type: 'gift_sub', title_template: 'HEDİYE ABONE!', message_template: '{user} {count} hediye abone gönderdi!', accent_color: '#f472b6', duration_ms: 6500 },
  host: { event_type: 'host', title_template: 'HOST!', message_template: '{user} kanalı host etti ({viewers})', accent_color: '#38bdf8', duration_ms: 6000 },
  tip: { event_type: 'tip', title_template: 'BAĞIŞ GELDİ!', message_template: '{user} {amount} {currency}: "{message}"', accent_color: '#10b981', duration_ms: 7000 },
  kicks: { event_type: 'kicks', title_template: 'KICKS!', message_template: '{user} {amount} Kick gönderdi!', accent_color: '#53fc18', duration_ms: 5500 },
  raid: { event_type: 'raid', title_template: 'RAID!', message_template: '{user} {viewers} izleyici ile raid yaptı!', accent_color: '#f59e0b', duration_ms: 8000 }
};

/** Henüz kaydı olmayan olay için düzenlenebilir başlangıç kaydı */
export function yeniUyariKaydi(olay: string): Record<string, any> {
  return { ...(UYARI_OLAY_VARSAYILANLARI[olay] || {}), event_type: olay, sound_url: '', image_url: '', font_family: 'Plus Jakarta Sans', text_color: '#ffffff', animation: 'bounce', sound_volume: 0.7, is_enabled: 1, layout_mode: 'stacked', text_effect: 'shine' };
}

/** `/api/alerts/save` gövdesi (sunucu satır adlarından API adlarına) */
export function uyariKaydiGovdesi(olay: string, p: Record<string, any>) {
  return {
    id: p.id,
    eventType: olay,
    titleTemplate: p.title_template,
    messageTemplate: p.message_template,
    soundUrl: p.sound_url,
    imageUrl: p.image_url,
    durationMs: p.duration_ms,
    fontFamily: p.font_family,
    textColor: p.text_color,
    accentColor: p.accent_color,
    animation: p.animation,
    soundVolume: p.sound_volume,
    isEnabled: p.is_enabled,
    layoutMode: p.layout_mode,
    textEffect: p.text_effect
  };
}
