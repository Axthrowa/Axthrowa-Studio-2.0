/** Enterprise widget katalog meta — Rust `WidgetGroup` ile hizalı. */

export type WidgetGroupId =
  | "goals_trackers"
  | "physics_visuals"
  | "chat_events"
  | "gamification"
  | "media_tts"
  | "utility"
  | "other";

export type WidgetGroupMeta = {
  id: WidgetGroupId;
  label: string;
  accent: string;
  kinds: string[];
};

export const WIDGET_GROUPS: WidgetGroupMeta[] = [
  {
    id: "goals_trackers",
    label: "Hedefler ve Sayaçlar",
    accent: "#3ecfcf",
    kinds: ["goal", "kicksubs", "subathon", "viewers", "labels"],
  },
  {
    id: "physics_visuals",
    label: "Fizik ve Görsel",
    accent: "#f59e0b",
    kinds: ["emotewall", "emotecombo", "cup"],
  },
  {
    id: "chat_events",
    label: "Sohbet ve Olaylar",
    accent: "#38bdf8",
    kinds: ["chat", "activity", "shoutout"],
  },
  {
    id: "gamification",
    label: "Oyunlaştırma",
    accent: "#fb7185",
    kinds: ["wheel", "poll", "raffles", "hypetrain"],
  },
  {
    id: "media_tts",
    label: "Medya ve TTS",
    accent: "#a78bfa",
    kinds: ["songrequest", "tts", "now-playing"],
  },
  {
    id: "utility",
    label: "Yayın Sonu",
    accent: "#94a3b8",
    kinds: ["credits", "redeems", "alerts"],
  },
];

export type FieldSection =
  | "general"
  | "style"
  | "physics"
  | "data"
  | "sfx"
  | "ai"
  | "chain"
  | "transform"
  | "advanced";

export const FIELD_SECTIONS: { id: FieldSection; label: string }[] = [
  { id: "general", label: "Genel" },
  { id: "style", label: "Görsel" },
  { id: "physics", label: "Animasyon & Fizik" },
  { id: "data", label: "Veri" },
  { id: "sfx", label: "Ses (SFX)" },
  { id: "ai", label: "AI / Hype" },
  { id: "chain", label: "Zincirleme" },
  { id: "transform", label: "Pozisyon" },
  { id: "advanced", label: "Gelişmiş" },
];

export type FieldType =
  | "text"
  | "number"
  | "slider"
  | "bool"
  | "color"
  | "select"
  | "stringList"
  | "objectList"
  | "css"
  | "date";
export type FieldSpec = {
  key: string;
  label: string;
  type: FieldType;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  section?: FieldSection;
  description?: string;
};

/** Bilinen anahtarlar: Türkçe etiket + aralık / tip / sekme */
const FIELD_HINTS: Record<
  string,
  Partial<FieldSpec> & { hide?: boolean }
> = {
  schema: { hide: true },
  metrics: { hide: true },
  layouts: { hide: true },
  themes: { hide: true },
  engines: { hide: true },
  items: {
    label: "Etiket satırları",
    type: "objectList",
    section: "data",
    description: "label / source / value",
  },
  levels: {
    label: "Hype seviyeleri",
    type: "objectList",
    section: "data",
  },
  sections: {
    label: "Credits bölümleri",
    type: "stringList",
    section: "data",
  },
  sources: {
    label: "Müzik kaynakları",
    type: "stringList",
    section: "data",
  },
  platforms: {
    label: "Platformlar",
    type: "stringList",
    section: "general",
    description: "kick, twitch, youtube…",
  },
  spawnOn: {
    label: "Spawn tetikleri",
    type: "stringList",
    section: "physics",
  },
  bodyKinds: {
    label: "Cisim türleri",
    type: "stringList",
    section: "physics",
  },
  _previewDemo: { hide: true },
  _previewMode: { hide: true },
  _widgetName: { hide: true },
  sfxPresets: { hide: true },
  vessels: { hide: true },
  physicsModes: { hide: true },
  messageAnims: { hide: true },
  custom_entries: {
    label: "Özel girdiler",
    type: "objectList",
    section: "data",
  },

  title: { label: "Başlık", type: "text", section: "general" },
  custom_title: { label: "Başlık (Özel)", type: "text", section: "general" },
  question: { label: "Anket sorusu", type: "text", section: "general" },
  closingMessage: { label: "Kapanış mesajı", type: "text", section: "general" },
  footer_message: { label: "Kapanış mesajı", type: "text", section: "general" },
  requestCommand: { label: "İstek komutu (!sr)", type: "text", section: "general" },
  allowYoutube: { label: "YouTube kabul", type: "bool", section: "general" },
  allowSpotify: { label: "Spotify kabul", type: "bool", section: "general" },
  show_video: { label: "Video göster", type: "bool", section: "style" },
  options: {
    label: "Anket seçenekleri",
    type: "stringList",
    section: "data",
    description: "Her seçenek otomatik !oy 1, !oy 2… komutu alır",
  },
  slices: { label: "Çark dilimleri", type: "objectList", section: "data" },
  segments: { label: "Çark dilimleri", type: "objectList", section: "data" },
  metric: {
    label: "Hedef Tipi",
    type: "select",
    options: ["followers", "subs", "tips", "kick"],
    section: "general",
    description: "tips = Bağış (webhook ile artar)",
  },
  goalType: {
    label: "Hedef Tipi",
    type: "select",
    options: ["followers", "subs", "tips", "kick"],
    section: "general",
  },
  startValue: { label: "Başlangıç Değeri", type: "number", min: 0, section: "general" },
  start: { label: "Başlangıç Değeri", type: "number", min: 0, section: "general" },
  layout: {
    label: "Tasarım",
    type: "select",
    options: ["bar", "circle", "minimal", "list", "combined", "alert"],
    section: "style",
  },
  showMilestones: {
    label: "Ara işaretler (25/50/75)",
    type: "bool",
    section: "style",
  },
  showBackground: {
    label: "Kart arka planı",
    type: "bool",
    section: "style",
  },
  valuePrefix: {
    label: "Değer öneki (örn. ₺)",
    type: "text",
    section: "style",
  },
  valueSuffix: {
    label: "Değer soneki",
    type: "text",
    section: "style",
  },
  decimals: {
    label: "Ondalık basamak",
    type: "number",
    min: 0,
    max: 2,
    section: "style",
  },
  currencyPrefix: {
    label: "Para birimi öneki",
    type: "text",
    section: "style",
    hide: true,
  },
  theme: {
    label: "Tema stili",
    type: "select",
    options: [
      "neon",
      "minimal",
      "cyberpunk",
      "kick",
      "glass",
      "cyber",
      "boxed",
      "clean",
      "transparent",
      "bubbles",
      "streamline",
      "side",
      "glitch",
    ],
    section: "style",
  },
  mode: {
    label: "Mod",
    type: "select",
    options: ["sum", "kick", "twitch", "max"],
    section: "general",
  },
  engine: {
    label: "TTS motoru",
    type: "select",
    options: ["browser", "cloud"],
    section: "general",
  },
  barStyle: {
    label: "Bar stili",
    type: "select",
    options: ["solid", "gradient", "glow", "striped"],
    section: "style",
  },
  revealEffect: {
    label: "Açılış efekti",
    type: "select",
    options: ["fade", "slide", "confetti", "none"],
    section: "style",
  },
  anim: {
    label: "Animasyon",
    type: "select",
    options: ["slide", "fade", "pop", "none"],
    section: "style",
  },
  animIn: {
    label: "Giriş animasyonu",
    type: "select",
    options: ["fade", "slide", "zoom", "none"],
    section: "style",
  },
  animOut: {
    label: "Çıkış animasyonu",
    type: "select",
    options: ["fade", "slide", "zoom", "none"],
    section: "style",
  },
  vessel: {
    label: "Kap şekli",
    type: "select",
    options: ["cup", "glass", "bowl"],
    section: "physics",
  },
  physics: {
    label: "Fizik",
    type: "select",
    options: ["matter", "simple"],
    section: "physics",
  },
  sfxPreset: {
    label: "SFX paketi",
    type: "select",
    options: ["none", "chime", "coin", "boom", "levelup", "sparkle", "success"],
    section: "sfx",
  },
  messageAnim: {
    label: "Mesaj animasyonu",
    type: "select",
    options: ["slide", "fade", "pop"],
    section: "style",
  },
  listTemplate: {
    label: "Liste metni",
    type: "text",
    section: "general",
    description: "{user} {months} {gift}",
  },
  alertTemplate: {
    label: "Alert metni",
    type: "text",
    section: "general",
    description: "{user} {months} {gift}",
  },
  alertDurationMs: {
    label: "Alert süresi (ms)",
    type: "number",
    min: 2000,
    max: 20000,
    section: "style",
  },
  showSessionCount: { label: "Oturum sayacı", type: "bool", section: "general" },
  showGoal: { label: "Hedef barı göster", type: "bool", section: "general" },
  showMonths: { label: "Ay bilgisini göster", type: "bool", section: "general" },
  showGifted: { label: "Hediye rozeti", type: "bool", section: "general" },
  showTitle: { label: "Başlık göster", type: "bool", section: "general" },
  goalTarget: { label: "Abone hedefi", type: "number", min: 1, section: "data" },
  goalCurrent: { label: "Mevcut abone", type: "number", min: 0, section: "data" },
  goalStart: { label: "Hedef başlangıç", type: "number", min: 0, section: "data" },
  sessionCount: { hide: true },
  direction: {
    label: "Yön / akış",
    type: "select",
    options: ["vertical", "horizontal", "bottom", "top"],
    section: "style",
    description: "Chat: bottom/top",
  },
  animation: {
    label: "Animasyon",
    type: "select",
    options: ["slide", "fade", "bounce"],
    section: "physics",
  },
  sfxOnSub: { label: "Abone SFX", type: "text", section: "sfx" },
  custom_bg_url: { label: "Özel arka plan URL", type: "text", section: "style" },
  currency: { label: "Para birimi", type: "text", section: "general" },
  prefix: { label: "Önek", type: "text", section: "style" },
  suffix: { label: "Sonek", type: "text", section: "style" },
  separator: { label: "Ayırıcı", type: "text", section: "style" },
  command: { label: "Komut", type: "text", section: "general" },
  voteCommand: { label: "Oy komutu öneki", type: "text", section: "general" },
  joinCommand: { label: "Katılım komutu", type: "text", section: "general" },
  fontFamily: { label: "Yazı tipi", type: "select", section: "style" },
  font_family: { label: "Yazı tipi", type: "select", section: "style" },
  lang: { label: "Dil", type: "select", section: "general" },

  color: { label: "Renk", type: "color", section: "style" },
  primary_color: { label: "Ana renk", type: "color", section: "style" },
  colorFrom: { label: "Gradient başlangıç", type: "color", section: "style" },
  colorTo: { label: "Gradient bitiş", type: "color", section: "style" },
  accent: { label: "Vurgu rengi", type: "color", section: "style" },
  labelColor: { label: "Etiket rengi", type: "color", section: "style" },
  nameColor: { label: "İsim rengi", type: "color", section: "style" },
  messageColor: { label: "Mesaj rengi", type: "color", section: "style" },
  bgColor: { label: "Arka plan rengi", type: "color", section: "style" },
  animationMs: { label: "Animasyon (ms)", type: "number", min: 0, section: "physics" },
  mass: {
    label: "Kütle (mass)",
    type: "slider",
    min: 0.2,
    max: 3,
    step: 0.1,
    section: "physics",
  },
  friction: {
    label: "Sürtünme",
    type: "slider",
    min: 0,
    max: 1,
    step: 0.01,
    section: "physics",
  },
  frictionAir: {
    label: "Hava sürtünmesi",
    type: "slider",
    min: 0,
    max: 0.1,
    step: 0.001,
    section: "physics",
  },
  endsAt: {
    label: "Hedef bitiş tarihi",
    type: "date",
    section: "general",
  },  scrollSpeed: { label: "Kayma hızı", type: "slider", min: 10, max: 120, step: 1, section: "style" },
  scroll_speed: {
    label: "Kayma hızı (1–10)",
    type: "slider",
    min: 1,
    max: 10,
    step: 1,
    section: "style",
  },

  current: { label: "Mevcut Değer", type: "number", min: 0, section: "general" },
  target: { label: "Bitiş Değeri (Hedef)", type: "number", min: 1, section: "general" },
  thickness: { label: "Kalınlık", type: "slider", min: 4, max: 48, step: 1, section: "style" },
  fontSize: { label: "Yazı boyutu", type: "slider", min: 10, max: 96, step: 1, section: "style" },
  titleSize: { label: "Başlık boyutu", type: "slider", min: 16, max: 72, step: 1, section: "style" },
  lineSize: { label: "Satır boyutu", type: "slider", min: 12, max: 48, step: 1, section: "style" },
  opacity: { label: "Opaklık", type: "slider", min: 0, max: 1, step: 0.05, section: "style" },
  background_opacity: {
    label: "Arka plan opaklığı",
    type: "slider",
    min: 0,
    max: 100,
    step: 1,
    section: "style",
  },
  volume: {
    label: "SFX Ses Seviyesi",
    type: "slider",
    min: 0,
    max: 100,
    step: 1,
    section: "sfx",
  },
  sfxVolume: {
    label: "SFX Ses Seviyesi",
    type: "slider",
    min: 0,
    max: 1,
    step: 0.05,
    section: "sfx",
  },
  glowIntensity: {
    label: "Neon parlama",
    type: "slider",
    min: 0,
    max: 2,
    step: 0.1,
    section: "style",
  },
  gravity: { label: "Yerçekimi", type: "slider", min: 0.2, max: 2, step: 0.1, section: "physics" },
  burstScale: { label: "Patlama ölçeği", type: "slider", min: 1, max: 3, step: 0.1, section: "physics" },
  burstCount: {
    label: "Burst emoji sayısı",
    type: "slider",
    min: 8,
    max: 60,
    step: 1,
    section: "physics",
  },

  secondsRemaining: { label: "Kalan süre (sn)", type: "number", min: 0, section: "general" },
  secondsPerFollow: {
    label: "Takip başına süre (sn)",
    type: "slider",
    min: 0,
    max: 3600,
    step: 15,
    section: "data",
    hide: true,
  },
  time_per_follow: {
    label: "Takip başına süre (sn)",
    type: "slider",
    min: 0,
    max: 3600,
    step: 15,
    section: "data",
  },
  secondsPerSub: {
    label: "Abonelik başına süre (sn)",
    type: "slider",
    min: 0,
    max: 3600,
    step: 15,
    section: "data",
    hide: true,
  },
  time_per_sub: {
    label: "Abonelik başına süre (sn)",
    type: "slider",
    min: 0,
    max: 3600,
    step: 15,
    section: "data",
  },
  secondsPerTip: {
    label: "Bağış birimi başına süre (sn)",
    type: "slider",
    min: 0,
    max: 3600,
    step: 15,
    section: "data",
    hide: true,
  },
  time_per_donation: {
    label: "1 TL / 1$ bağış başına süre (sn)",
    type: "slider",
    min: 0,
    max: 3600,
    step: 15,
    section: "data",
  },
  secondsPerKick: {
    label: "Kick / Host başına süre (sn)",
    type: "slider",
    min: 0,
    max: 3600,
    step: 15,
    section: "data",
    hide: true,
  },
  time_per_kick: {
    label: "Kick / Host başına süre (sn)",
    type: "slider",
    min: 0,
    max: 3600,
    step: 15,
    section: "data",
  },
  tipUnit: { label: "Bağış birimi (TL/$)", type: "number", min: 0.01, step: 0.01, section: "data" },
  durationSec: {
    label: "Süre (sn)",
    type: "slider",
    min: 15,
    max: 600,
    step: 5,
    section: "general",
  },
  durationMs: { label: "Süre (ms)", type: "number", min: 500, section: "general" },
  spinDurationMs: {
    label: "Dönüş (ms)",
    type: "slider",
    min: 1500,
    max: 12000,
    step: 100,
    section: "general",
  },
  showResultMs: { label: "Sonuç süresi (ms)", type: "number", min: 500, section: "general" },
  hideAfterMs: { label: "Gizleme (ms, 0=kapalı)", type: "number", min: 0, section: "general" },
  lifetimeMs: { label: "Ömür (ms)", type: "number", min: 500, section: "physics" },
  windowMs: { label: "Kombo penceresi (ms)", type: "number", min: 500, section: "general" },
  windowSec: { label: "Pencere (sn)", type: "number", min: 30, section: "general" },
  autoCloseSec: { label: "Otomatik kapanış (sn)", type: "number", min: 0, section: "general" },
  speedSec: {
    label: "Jenerik hızı (sn)",
    type: "slider",
    min: 10,
    max: 120,
    step: 1,
    section: "style",
  },
  marqueeSpeed: {
    label: "Kayan yazı hızı",
    type: "slider",
    min: 10,
    max: 120,
    step: 1,
    section: "style",
  },

  maxMessages: { label: "Max mesaj", type: "slider", min: 3, max: 50, step: 1, section: "general" },
  maxItems: { label: "Max öğe", type: "slider", min: 3, max: 40, step: 1, section: "general" },
  maxOnScreen: {
    label: "Ekrandaki max",
    type: "slider",
    min: 5,
    max: 80,
    step: 1,
    section: "physics",
  },
  maxBodies: { label: "Max cisim", type: "slider", min: 20, max: 200, step: 5, section: "physics" },
  maxQueue: { label: "Max kuyruk", type: "slider", min: 5, max: 50, step: 1, section: "general" },
  maxOptions: { label: "Max seçenek", type: "slider", min: 2, max: 8, step: 1, section: "general" },
  maxVisibleEntrants: {
    label: "Görünen katılımcı",
    type: "slider",
    min: 5,
    max: 80,
    step: 1,
    section: "general",
  },
  minSize: { label: "Min boyut", type: "slider", min: 16, max: 64, step: 1, section: "physics" },
  maxSize: { label: "Max boyut", type: "slider", min: 32, max: 160, step: 1, section: "physics" },
  cupWidth: { label: "Kap genişliği", type: "number", min: 120, section: "physics" },
  cupHeight: { label: "Kap yüksekliği", type: "number", min: 120, section: "physics" },
  threshold: { label: "Kombo eşiği", type: "slider", min: 2, max: 20, step: 1, section: "general" },
  pointsPerSub: { label: "Abone puanı", type: "number", min: 1, section: "general" },
  pointsPerTip: { label: "Bağış puanı", type: "number", min: 1, section: "general" },
  minTipAmount: { label: "Min bağış (TTS)", type: "number", min: 0, section: "general" },

  weightFromAmount: {
    label: "Bağışa göre ağırlık",
    type: "bool",
    section: "physics",
  },
  smallTipThreshold: {
    label: "Küçük bağış eşiği",
    type: "number",
    min: 1,
    section: "physics",
  },
  bigTipThreshold: {
    label: "Büyük bağış eşiği",
    type: "number",
    min: 1,
    section: "physics",
  },
  smallTipCount: {
    label: "Küçük bağışta obje sayısı",
    type: "slider",
    min: 3,
    max: 40,
    step: 1,
    section: "physics",
  },
  bigTipScale: {
    label: "Büyük bağış ölçeği",
    type: "slider",
    min: 1,
    max: 4,
    step: 0.1,
    section: "physics",
  },

  showPercent: { label: "Yüzde göster", type: "bool", section: "style" },
  showValue: { label: "Değer göster", type: "bool", section: "style" },
  showEndsAt: { label: "Bitiş zamanı", type: "bool", section: "style" },
  showBadges: { label: "Rozetler", type: "bool", section: "style" },
  showPlatform: { label: "Platform ikonu", type: "bool", section: "style" },
  showEmotes: { label: "Emotelar", type: "bool", section: "style" },
  textShadow: { label: "Yazı gölgesi", type: "bool", section: "style" },
  highlightMentions: { label: "@ bahsetmeleri vurgula", type: "bool", section: "style" },
  hideOldMessages: { label: "Eski mesajları gizle", type: "bool", section: "general" },
  ignoreBots: { label: "Bot mesajlarını gizle", type: "bool", section: "general" },
  mentionUser: { label: "Kanal adı (@ vurgu)", type: "text", section: "general" },
  hideAfterSec: {
    label: "Gizleme süresi (sn)",
    type: "number",
    min: 2,
    max: 180,
    section: "general",
  },
  lineGap: {
    label: "Satır aralığı",
    type: "slider",
    min: 2,
    max: 24,
    step: 1,
    section: "style",
  },
  showFollow: { label: "Takip göster", type: "bool", section: "general" },
  showSub: { label: "Abone göster", type: "bool", section: "general" },
  showRaid: { label: "Raid göster", type: "bool", section: "general" },
  showTip: { label: "Bağış göster", type: "bool", section: "general" },
  showCheer: { label: "Cheer göster", type: "bool", section: "general" },
  showAvatar: { label: "Avatar", type: "bool", section: "style" },
  showLastGame: { label: "Son oyun", type: "bool", section: "style" },
  showCount: { label: "Sayaç göster", type: "bool", section: "style" },
  showQueue: { label: "Kuyruk göster", type: "bool", section: "style" },
  showProgress: { label: "İlerleme", type: "bool", section: "style" },
  showThumbnail: { label: "Kapak görseli", type: "bool", section: "style" },
  showTrain: { label: "Tren animasyonu", type: "bool", section: "style" },
  showVoteCommands: {
    label: "Oy komutlarını göster (!oy 1…)",
    type: "bool",
    section: "general",
  },
  pulseOnChange: { label: "Değişimde nabız", type: "bool", section: "style" },
  marquee: { label: "Kayan yazı", type: "bool", section: "style" },
  autoFreezeWhenZero: { label: "Sıfırda dondur", type: "bool", section: "general" },
  soundEnabled: { label: "Ses efekti", type: "bool", section: "sfx" },
  sfxEnabled: { label: "SFX açık", type: "bool", section: "sfx" },
  sfxUrl: {
    label: "Özel SFX URL (mp3/wav)",
    type: "text",
    section: "sfx",
    description: "Doluysa preset yerine bu URL çalınır",
  },
  sfxOnComplete: { label: "Tamamlanınca SFX", type: "text", section: "sfx" },
  sfxOnEnd: { label: "Bitişte SFX", type: "text", section: "sfx" },
  sfxOnDrop: { label: "Düşüşte SFX", type: "text", section: "sfx" },
  sfxOnLevel: { label: "Seviyede SFX", type: "text", section: "sfx" },
  sfxOnStop: { label: "Durunca SFX", type: "text", section: "sfx" },
  readTips: { label: "Bağış oku", type: "bool", section: "general" },
  readSubs: { label: "Abone oku", type: "bool", section: "general" },
  readChat: { label: "Chat oku", type: "bool", section: "general" },

  triggerCreditsOnComplete: {
    label: "Hedefte Movie Credits tetikle",
    type: "bool",
    section: "chain",
  },
  triggerEmoteBurstOnComplete: {
    label: "Hedefte Emote Wall patlat",
    type: "bool",
    section: "chain",
  },
  burstEmoteWallOnLevel: {
    label: "Seviyede Emote Wall patlat",
    type: "bool",
    section: "chain",
  },
  burstOnHypeLevel: {
    label: "Hype seviyesini dinle",
    type: "bool",
    section: "chain",
  },
  listenGoalComplete: {
    label: "Hedef tamamlanınca patla",
    type: "bool",
    section: "chain",
  },
  autoPlayOnGoalComplete: {
    label: "Hedefte otomatik oynat",
    type: "bool",
    section: "chain",
  },

  sentimentEnabled: {
    label: "Sentiment (ton) analizi",
    type: "bool",
    section: "ai",
  },
  hypeWaveEnabled: {
    label: "W / Hype dalgası",
    type: "bool",
    section: "ai",
  },
  hypeLetter: { label: "Hype harfi", type: "text", section: "ai" },
  hypeThreshold: {
    label: "Hype eşiği",
    type: "slider",
    min: 3,
    max: 30,
    step: 1,
    section: "ai",
  },
  hypeWindowMs: {
    label: "Hype penceresi (ms)",
    type: "number",
    min: 1000,
    section: "ai",
  },

  minigameEnabled: {
    label: "Mini oyun (balon patlat)",
    type: "bool",
    section: "physics",
  },
  minigamePopCommand: {
    label: "Patlat komutu",
    type: "text",
    section: "physics",
  },
  balloonCount: {
    label: "Balon sayısı",
    type: "slider",
    min: 3,
    max: 24,
    step: 1,
    section: "physics",
  },

  restitution: {
    label: "Sekme (restitution)",
    type: "slider",
    min: 0,
    max: 1,
    step: 0.05,
    section: "physics",
  },
  burstImpulse: {
    label: "Fırlatma gücü",
    type: "slider",
    min: 0.4,
    max: 2.5,
    step: 0.1,
    section: "physics",
  },
  spawnImpulse: {
    label: "Düşüş / fırlatma",
    type: "slider",
    min: 0.4,
    max: 2.5,
    step: 0.1,
    section: "physics",
  },

  posX: {
    label: "X (legacy px)",
    type: "slider",
    min: -400,
    max: 1920,
    step: 1,
    section: "transform",
    hide: true,
  },
  posY: {
    label: "Y (legacy px)",
    type: "slider",
    min: -400,
    max: 1080,
    step: 1,
    section: "transform",
    hide: true,
  },
  position_x: {
    label: "X Pozisyonu",
    type: "slider",
    min: -960,
    max: 2880,
    step: 1,
    section: "transform",
    description: "Master Overlay yatay konum (px) — negatif = sola taşır",
  },
  position_y: {
    label: "Y Pozisyonu",
    type: "slider",
    min: -540,
    max: 1620,
    step: 1,
    section: "transform",
    description: "Master Overlay dikey konum (px) — negatif = yukarı taşır",
  },
  width: {
    label: "Genişlik (px)",
    type: "slider",
    min: 80,
    max: 1920,
    step: 10,
    section: "style",
  },
  height: {
    label: "Yükseklik (px)",
    type: "slider",
    min: 60,
    max: 1080,
    step: 10,
    section: "style",
  },
  scale: {
    label: "Ölçek",
    type: "slider",
    min: 0.5,
    max: 3,
    step: 0.05,
    section: "style",
  },
  z_index: {
    label: "Z-Index (katman)",
    type: "slider",
    min: 0,
    max: 200,
    step: 1,
    section: "transform",
  },
  enabled: {
    label: "Master’da görünür",
    type: "bool",
    section: "general",
    hide: true,
  },
  rotateDeg: {
    label: "Açı (°)",
    type: "slider",
    min: -45,
    max: 45,
    step: 1,
    section: "transform",
  },
  customCss: {
    label: "Custom CSS",
    type: "css",
    section: "advanced",
    description: "Profesyonel marka override — .yya-widget-stage içinde yazın",
  },
  custom_css: { label: "Custom CSS", type: "css", section: "advanced" },
};

const FONT_OPTIONS = [
  "Outfit",
  "Plus Jakarta Sans",
  "Space Grotesk",
  "JetBrains Mono",
  "Inter",
  "Segoe UI",
  "Arial",
  "Georgia",
];

const LANG_OPTIONS = ["tr-TR", "en-US", "en-GB", "de-DE"];

const SELECT_SIBLINGS: Record<string, string> = {
  theme: "themes",
  layout: "layouts",
  metric: "metrics",
  engine: "engines",
  messageAnim: "messageAnims",
  sfxPreset: "sfxPresets",
  vessel: "vessels",
  physics: "physicsModes",
};

const SELECT_SIBLINGS_VALUES = new Set(Object.values(SELECT_SIBLINGS));

/** Botrix tarzı — her widget için düzenlenebilir alan listesi (gürültüyü keser). */
const KIND_EDITABLE_KEYS: Record<string, string[]> = {
  goal: [
    "title", "metric", "layout", "startValue", "current", "target",
    "colorFrom", "colorTo", "fontFamily", "fontSize", "thickness",
    "showPercent", "showValue", "showMilestones", "showBackground",
    "valuePrefix", "valueSuffix", "decimals",
    "glowIntensity", "sfxEnabled", "sfxPreset", "sfxOnComplete", "volume",
    "triggerCreditsOnComplete", "triggerEmoteBurstOnComplete", "opacity",
    "position_x", "position_y", "width", "height", "scale",
  ],
  goals: [
    "title", "metric", "layout", "startValue", "current", "target",
    "colorFrom", "colorTo", "fontFamily", "fontSize", "thickness",
    "showPercent", "showValue", "showMilestones", "showBackground",
    "valuePrefix", "valueSuffix", "decimals",
    "glowIntensity", "sfxEnabled", "sfxPreset", "sfxOnComplete", "volume",
    "triggerCreditsOnComplete", "triggerEmoteBurstOnComplete", "opacity",
    "position_x", "position_y", "width", "height", "scale",
  ],
  kicksubs: [
    "custom_title", "layout", "theme", "maxItems", "showTitle", "showMonths",
    "showGifted", "showSessionCount", "showGoal", "goalTarget", "goalCurrent",
    "listTemplate", "alertTemplate", "alertDurationMs", "fontFamily", "fontSize",
    "accent", "color", "sfxEnabled", "opacity",
    "position_x", "position_y", "width", "height", "scale",
  ],
  "kick-subs": [
    "custom_title", "layout", "theme", "maxItems", "showTitle", "showMonths",
    "showGifted", "showSessionCount", "showGoal", "goalTarget",
    "fontFamily", "fontSize", "accent", "color", "opacity",
    "position_x", "position_y", "width", "height", "scale",
  ],
  subathon: [
    "custom_title", "theme", "secondsRemaining", "time_per_follow", "time_per_sub",
    "time_per_donation", "time_per_kick", "fontFamily", "font_family", "fontSize",
    "primary_color", "accent", "color", "background_opacity", "showEndsAt", "endsAt",
    "autoFreezeWhenZero", "scale", "opacity",
    "position_x", "position_y", "width", "height",
  ],
  viewers: [
    "mode", "platforms", "prefix", "suffix", "fontFamily", "fontSize", "color",
    "pulseOnChange", "opacity", "position_x", "position_y", "width", "height", "scale",
  ],
  labels: [
    "items", "marquee", "marqueeSpeed", "separator", "fontFamily", "fontSize",
    "color", "labelColor", "opacity",
    "position_x", "position_y", "width", "height", "scale",
  ],
  label: [
    "items", "marquee", "separator", "fontFamily", "fontSize", "color", "opacity",
    "position_x", "position_y", "width", "height",
  ],
  chat: [
    "theme", "direction", "fontFamily", "font_family", "fontSize", "primary_color",
    "accent", "background_opacity", "opacity", "showEmotes", "showBadges",
    "textShadow", "hideOldMessages", "hideAfterMs", "lineGap", "highlightMentions",
    "ignoreBots", "messageAnim", "maxMessages",
    "position_x", "position_y", "width", "height", "scale",
  ],
  alerts: [
    "title", "layout", "durationMs", "primary_color", "accent", "fontFamily",
    "fontSize", "opacity", "position_x", "position_y", "width", "height", "scale",
  ],
  alert: [
    "title", "layout", "durationMs", "primary_color", "accent", "fontFamily",
    "fontSize", "opacity", "position_x", "position_y", "width", "height",
  ],
  activity: [
    "maxItems", "anim", "showFollow", "showSub", "showTip", "showRaid", "showCheer",
    "fontSize", "opacity", "position_x", "position_y", "width", "height",
  ],
  activityfeed: [
    "maxItems", "anim", "showFollow", "showSub", "showTip", "opacity",
    "position_x", "position_y", "width", "height",
  ],
  shoutout: [
    "command", "durationMs", "animIn", "animOut", "showLastGame", "fontSize",
    "opacity", "position_x", "position_y", "width", "height", "scale",
  ],
  shoutouts: [
    "command", "durationMs", "animIn", "animOut", "opacity",
    "position_x", "position_y", "width", "height",
  ],
  emotewall: [
    "physics", "mass", "friction", "frictionAir", "restitution", "maxEmotes",
    "opacity", "position_x", "position_y", "width", "height",
  ],
  emotes: [
    "physics", "mass", "friction", "restitution", "opacity",
    "position_x", "position_y", "width", "height",
  ],
  emotecombo: [
    "threshold", "showCount", "burstScale", "fontSize", "accent", "opacity",
    "position_x", "position_y", "width", "height", "scale",
  ],
  "emote-combo": [
    "threshold", "showCount", "burstScale", "opacity",
    "position_x", "position_y", "width", "height",
  ],
  cup: [
    "vessel", "physics", "spawnOn", "bodyKinds", "mass", "friction", "restitution",
    "opacity", "position_x", "position_y", "width", "height",
  ],
  glass: [
    "vessel", "physics", "spawnOn", "mass", "friction", "opacity",
    "position_x", "position_y", "width", "height",
  ],
  wheel: [
    "slices", "command", "fontFamily", "fontSize", "opacity",
    "position_x", "position_y", "width", "height", "scale",
  ],
  fortunewheel: [
    "slices", "command", "opacity", "position_x", "position_y", "width", "height",
  ],
  poll: [
    "question", "options", "command", "fontFamily", "fontSize", "accent", "opacity",
    "position_x", "position_y", "width", "height",
  ],
  polls: [
    "question", "options", "command", "opacity",
    "position_x", "position_y", "width", "height",
  ],
  raffles: [
    "joinCommand", "revealEffect", "fontFamily", "fontSize", "accent", "opacity",
    "position_x", "position_y", "width", "height",
  ],
  giveaway: [
    "joinCommand", "revealEffect", "opacity",
    "position_x", "position_y", "width", "height",
  ],
  hypetrain: [
    "theme", "levels", "fontFamily", "fontSize", "accent", "opacity",
    "position_x", "position_y", "width", "height",
  ],
  hype: [
    "theme", "levels", "opacity", "position_x", "position_y", "width", "height",
  ],
  songrequest: [
    "command", "requestCommand", "allowYoutube", "allowSpotify", "show_video",
    "volume", "fontFamily", "fontSize", "opacity",
    "position_x", "position_y", "width", "height",
  ],
  "now-playing": [
    "command", "show_video", "volume", "opacity",
    "position_x", "position_y", "width", "height",
  ],
  tts: [
    "engine", "lang", "volume", "sfxEnabled", "opacity",
    "position_x", "position_y", "width", "height",
  ],
  cloudtts: [
    "engine", "lang", "volume", "opacity",
    "position_x", "position_y", "width", "height",
  ],
  credits: [
    "title", "sections", "custom_entries", "footer_message", "closingMessage",
    "scroll_speed", "fontFamily", "fontSize", "color", "opacity",
    "position_x", "position_y", "width", "height",
  ],
  moviecredits: [
    "title", "sections", "footer_message", "scroll_speed", "opacity",
    "position_x", "position_y", "width", "height",
  ],
};

function humanize(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

function isHexColor(v: unknown): boolean {
  return typeof v === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v);
}

function looksLikeColorKey(key: string): boolean {
  const k = key.toLowerCase();
  return k.includes("color") || k === "accent";
}

function sectionForKey(key: string, hint?: Partial<FieldSpec>): FieldSection {
  if (hint?.section) return hint.section;
  const k = key.toLowerCase();
  if (k.includes("sfx") || k.includes("sound") || k === "volume") return "sfx";
  if (
    k.startsWith("pos") ||
    k.startsWith("position_") ||
    k === "scale" ||
    k === "width" ||
    k === "height" ||
    k === "z_index" ||
    k.includes("rotate")
  ) {
    return "transform";
  }
  if (k.includes("css") || k.includes("custom")) return "advanced";
  if (k.includes("hype") || k.includes("sentiment")) return "ai";
  if (k.includes("trigger") || k.includes("listen") || k.includes("burst") || k.includes("chain")) {
    return "chain";
  }
  if (k.includes("gravity") || k.includes("vessel") || k.includes("tip") || k.includes("physics")) {
    return "physics";
  }
  if (k.includes("color") || k.includes("font") || k.includes("theme") || k.includes("opacity")) {
    return "style";
  }
  return "general";
}

/**
 * `config_json` nesnesinden form alanları üretir.
 * `kind` verilirse yalnızca o widget’a ait alanlar gösterilir.
 */
export function inferFieldsFromConfig(
  config: Record<string, unknown>,
  kind?: string
): FieldSpec[] {
  const fields: FieldSpec[] = [];
  const k = (kind || "").toLowerCase();
  const allow = k && KIND_EDITABLE_KEYS[k] ? new Set(KIND_EDITABLE_KEYS[k]) : null;

  for (const [key, value] of Object.entries(config)) {
    if (allow && !allow.has(key)) continue;
    const hint = FIELD_HINTS[key];
    if (hint?.hide) continue;

    const label = hint?.label || humanize(key);
    const section = sectionForKey(key, hint);

    if (hint?.type === "css") {
      fields.push({
        key,
        label,
        type: "css",
        section,
        description: hint.description,
      });
      continue;
    }

    if (hint?.type === "date") {
      fields.push({
        key,
        label,
        type: "date",
        section,
        description: hint.description,
      });
      continue;
    }

    if (Array.isArray(value) || hint?.type === "stringList" || hint?.type === "objectList") {
      if (
        hint?.type === "stringList" ||
        (Array.isArray(value) && value.every((x) => typeof x === "string" || x == null))
      ) {
        if (SELECT_SIBLINGS_VALUES.has(key)) continue;
        fields.push({
          key,
          label,
          type: "stringList",
          section,
          description: hint?.description,
        });
        continue;
      }
      if (
        hint?.type === "objectList" ||
        (Array.isArray(value) &&
          value.length > 0 &&
          typeof value[0] === "object" &&
          value[0] !== null &&
          ("label" in (value[0] as object) || "color" in (value[0] as object)))
      ) {
        fields.push({ key, label, type: "objectList", section });
        continue;
      }
      continue;
    }

    if (value !== null && typeof value === "object") continue;

    const siblingKey = SELECT_SIBLINGS[key];
    if (siblingKey) {
      const fromSibling = Array.isArray(config[siblingKey])
        ? (config[siblingKey] as unknown[]).map(String).filter(Boolean)
        : [];
      const fromHint = hint?.options?.length ? hint.options : [];
      const options = fromSibling.length ? fromSibling : fromHint;
      if (options.length) {
        fields.push({ key, label, type: "select", options, section });
        continue;
      }
    }
    if (key === "fontFamily" || key === "font_family") {
      fields.push({ key, label, type: "select", options: FONT_OPTIONS, section });
      continue;
    }
    if (key === "lang") {
      fields.push({ key, label, type: "select", options: LANG_OPTIONS, section });
      continue;
    }
    if (hint?.type === "select" && hint.options?.length) {
      fields.push({ key, label, type: "select", options: hint.options, section });
      continue;
    }

    if (typeof value === "boolean" || hint?.type === "bool") {
      fields.push({ key, label, type: "bool", section, description: hint?.description });
      continue;
    }

    if (isHexColor(value) || looksLikeColorKey(key) || hint?.type === "color") {
      fields.push({ key, label, type: "color", section });
      continue;
    }

    if (typeof value === "number" || hint?.type === "number" || hint?.type === "slider") {
      const hasRange = hint?.min != null && hint?.max != null;
      const useSlider = hint?.type === "slider" || (hasRange && hint?.type !== "number");
      fields.push({
        key,
        label,
        type: useSlider ? "slider" : "number",
        min: hint?.min,
        max: hint?.max,
        step: hint?.step ?? (hint?.max != null && hint.max <= 1 ? 0.05 : 1),
        section,
      });
      continue;
    }

    fields.push({ key, label, type: "text", section, description: hint?.description });
  }

  // allow list’te olup henüz field üretilmeyen alanları ekle
  if (allow) {
    const have = new Set(fields.map((f) => f.key));
    for (const key of allow) {
      if (have.has(key)) continue;
      const hint = FIELD_HINTS[key];
      if (hint?.hide) continue;
      const label = hint?.label || humanize(key);
      const section = sectionForKey(key, hint);
      if (hint?.type === "bool") {
        fields.push({ key, label, type: "bool", section });
      } else if (hint?.type === "select" && hint.options?.length) {
        fields.push({ key, label, type: "select", options: hint.options, section });
      } else if (hint?.type === "number" || hint?.type === "slider") {
        fields.push({
          key,
          label,
          type: hint.type === "slider" ? "slider" : "number",
          min: hint.min,
          max: hint.max,
          step: hint.step,
          section,
        });
      } else if (hint?.type === "color") {
        fields.push({ key, label, type: "color", section });
      } else if (hint?.type === "objectList" || hint?.type === "stringList") {
        fields.push({ key, label, type: hint.type, section });
      } else {
        fields.push({ key, label, type: "text", section });
      }
    }
  }

  // Boyut/yazı her zaman formda olsun (kind allow list’te yoksa bile)
  {
    const have = new Set(fields.map((f) => f.key));
    for (const key of ["fontSize", "width", "height", "scale"] as const) {
      if (have.has(key)) continue;
      if (allow && !allow.has(key)) continue;
      const hint = FIELD_HINTS[key];
      if (!hint) continue;
      fields.push({
        key,
        label: hint.label || humanize(key),
        type: "slider",
        min: hint.min,
        max: hint.max,
        step: hint.step,
        section: hint.section || "style",
      });
    }
  }

  return fields;
}

export function groupFieldsBySection(
  fields: FieldSpec[]
): { section: FieldSection; label: string; fields: FieldSpec[] }[] {
  const map = new Map<FieldSection, FieldSpec[]>();
  for (const f of fields) {
    const s = f.section || "general";
    if (!map.has(s)) map.set(s, []);
    map.get(s)!.push(f);
  }
  return FIELD_SECTIONS.filter((s) => map.has(s.id)).map((s) => ({
    section: s.id,
    label: s.label,
    fields: map.get(s.id)!,
  }));
}

export function groupIdForKind(kind: string): WidgetGroupId {
  const k = kind.toLowerCase();
  for (const g of WIDGET_GROUPS) {
    if (g.kinds.includes(k)) return g.id;
  }
  return "other";
}

export function groupMeta(id: WidgetGroupId): WidgetGroupMeta {
  return (
    WIDGET_GROUPS.find((g) => g.id === id) || {
      id: "other",
      label: "Diğer",
      accent: "#64748b",
      kinds: [],
    }
  );
}

export function accentForKind(kind: string): string {
  return groupMeta(groupIdForKind(kind)).accent;
}
