/** Botaxt tarzı widget / sadakat / etkileşim geniş tipleri. */

import type {
  BotCommand,
  BotConfig,
  BotCounter,
  BotModules,
  BotTimer,
  LoyaltyUser,
  Quote,
  SpamFilters,
  UserLevel,
} from "./types";
import { uid } from "./types";
import { ensurePanelExtras, type PanelExtras } from "./panelExtras";

export type { PanelExtras } from "./panelExtras";
export {
  defaultPanelExtras,
  defaultCommandExtras,
  ensurePanelExtras,
  mergePanelExtras,
} from "./panelExtras";

export type ShopItem = {
  id: string;
  name: string;
  cost: number;
  response: string;
  enabled: boolean;
  /** Overlay’de alert göster */
  alert: boolean;
};

/** Emote kombo overlay ayarları */
export type EmoteComboConfig = {
  enabled: boolean;
  minCount: number;
  windowMs: number;
  showMs: number;
  sound: boolean;
};

/** Aktivite akışı filtreleri */
export type ActivityFeedConfig = {
  muted: boolean;
  paused: boolean;
  maxItems: number;
  showFollow: boolean;
  showSub: boolean;
  showRaid: boolean;
  showRedeem: boolean;
  showBits: boolean;
  hideControls: boolean;
};

export type PollState = {
  active: boolean;
  question: string;
  options: string[];
  votes: Record<string, number>; // userKey -> option index
  endsAt: number | null;
  durationSec: number;
};

export type PredictionState = {
  active: boolean;
  question: string;
  options: [string, string];
  pots: [number, number];
  bets: Record<string, { side: 0 | 1; amount: number }>;
};

export type RecentLists = {
  follows: { user: string; t: number }[];
  subs: { user: string; t: number }[];
  raids: { user: string; amount?: string; t: number }[];
  redeems: { user: string; item: string; t: number }[];
};

export type SubathonConfig = {
  enabled: boolean;
  endsAt: number | null;
  secondsPerSub: number;
  secondsPerFollow: number;
  secondsPerTip: number;
  secondsPerBit: number;
  baseSeconds: number;
  paused: boolean;
};

export type WheelConfig = {
  spinning: boolean;
  result: string;
  options: string[];
  /** Seçenek ağırlıkları (aynı uzunlukta; yoksa eşit) */
  weights: number[];
  spinDurationMs: number;
  /** Derece cinsinden son dönüş açısı (overlay animasyonu) */
  rotationDeg: number;
};

export type HypeTrainConfig = {
  active: boolean;
  level: number;
  progress: number;
  goal: number;
  conductor: string;
};

export type LabelConfig = {
  kind: "follows" | "subs" | "raids" | "redeems" | "top";
  title: string;
  maxItems: number;
  textColor: string;
  accentColor: string;
};

export type StreamGoal = {
  id: string;
  name: string;
  /** followers | subs | custom | tips | kicks */
  kind: "followers" | "subs" | "custom" | "tips" | "kicks";
  current: number;
  target: number;
  enabled: boolean;
  color: string;
  layout: "bar" | "circle" | "minimal";
  showPercent: boolean;
};

export type AlertStyle = {
  enabled: boolean;
  durationMs: number;
  layout: "banner" | "card" | "minimal";
  sound: boolean;
  tts: boolean;
  followText: string;
  subText: string;
  raidText: string;
  bitsText: string;
  redeemText: string;
};

export type LevelTier = { name: string; minPoints: number }[];

export type TtsConfig = {
  enabled: boolean;
  volume: number;
  rate: number;
  pitch: number;
  maxLen: number;
  skipCommands: boolean;
  spamFilter: boolean;
  blacklist: string[];
  /** Bulut bayrağı — yerel SpeechSynthesis; OBS Browser Source */
  cloudMode: boolean;
  voice: string;
  lang: string;
};

export type CupConfig = {
  enabled: boolean;
  label: string;
  current: number;
  target: number;
  minBits: number;
  minKicks: number;
  color: string;
};

export type GiveawayConfig = {
  active: boolean;
  keyword: string;
  prize: string;
  entrants: string[];
  subMultiplier: number;
  subsOnly: boolean;
  spinDurationSec: number;
  claimDurationSec: number;
  spinning: boolean;
  winner: string;
  claimUntil: number | null;
};

export type EmoteWallConfig = {
  enabled: boolean;
  max: number;
  durationMs: number;
  swaySpeed: number;
  explosionOnFollow: boolean;
  explosionOnSub: boolean;
  minSize: number;
  maxSize: number;
};

export type MovieCreditsConfig = {
  enabled: boolean;
  startMessage: string;
  endMessage: string;
  scrollSpeed: number;
  textColor: string;
  hours: number;
  loop: boolean;
};

export type SalesLogEntry = {
  id: string;
  user: string;
  item: string;
  cost: number;
  t: number;
};

export type AlertTypeKey = "follow" | "sub" | "gifted" | "host" | "tip" | "kicks";

export type AlertTypeStyle = {
  enabled: boolean;
  durationSec: number;
  imageUrl: string;
  soundUrl: string;
  volume: number;
  text: string;
  textColor: string;
  accentColor: string;
  animation: string;
  fontSize: number;
  ttsLang: string;
};

export type AlertTypesConfig = Record<AlertTypeKey, AlertTypeStyle>;

export type BotConfigV2 = Omit<BotConfig, "version"> & {
  version: 2;
  shop: ShopItem[];
  goals: StreamGoal[];
  alerts: AlertStyle;
  labels: LabelConfig[];
  levels: LevelTier;
  tts: TtsConfig;
  poll: PollState;
  prediction: PredictionState;
  recent: RecentLists;
  accent: string;
  subathon: SubathonConfig;
  viewerCount: number;
  wheel: WheelConfig;
  hypeTrain: HypeTrainConfig;
  salesLog: SalesLogEntry[];
  discordWebhook: string;
  alertTypes: AlertTypesConfig;
  cup: CupConfig;
  giveaway: GiveawayConfig;
  emotewall: EmoteWallConfig;
  movieCredits: MovieCreditsConfig;
  activityFeed: ActivityFeedConfig;
  emoteCombo: EmoteComboConfig;
  viewerLabel: string;
} & PanelExtras;

export function defaultShop(): ShopItem[] {
  return [
    {
      id: uid("shop"),
      name: "selam",
      cost: 50,
      response: "$(user) mağazadan Selam aldı!",
      enabled: true,
      alert: true,
    },
    {
      id: uid("shop"),
      name: "highlight",
      cost: 200,
      response: "$(user) highlight istedi!",
      enabled: true,
      alert: true,
    },
  ];
}

export function defaultGoals(): StreamGoal[] {
  return [
    {
      id: uid("goal"),
      name: "Takipçi hedefi",
      kind: "followers",
      current: 0,
      target: 100,
      enabled: true,
      color: "#3ecfcf",
      layout: "bar",
      showPercent: true,
    },
    {
      id: uid("goal"),
      name: "Abone hedefi",
      kind: "subs",
      current: 0,
      target: 10,
      enabled: true,
      color: "#38bdf8",
      layout: "bar",
      showPercent: true,
    },
    {
      id: uid("goal"),
      name: "Bağış hedefi",
      kind: "tips",
      current: 0,
      target: 500,
      enabled: true,
      color: "#fb7185",
      layout: "bar",
      showPercent: true,
    },
    {
      id: uid("goal"),
      name: "KICK hedefi",
      kind: "kicks",
      current: 0,
      target: 100,
      enabled: true,
      color: "#3EEDFE",
      layout: "bar",
      showPercent: true,
    },
  ];
}

export function defaultAlerts(): AlertStyle {
  return {
    enabled: true,
    durationMs: 6500,
    layout: "banner",
    sound: true,
    tts: false,
    followText: "{user} takip etti!",
    subText: "{user} abone oldu{amount}!",
    raidText: "{user} raid attı{amount}!",
    bitsText: "{user} bits gönderdi{amount}!",
    redeemText: "{user} aldı: {item}",
  };
}

export function defaultLevels(): LevelTier {
  return [
    { name: "Yeni", minPoints: 0 },
    { name: "Düzenli", minPoints: 100 },
    { name: "Sadık", minPoints: 500 },
    { name: "Efsane", minPoints: 2000 },
    { name: "Efsane+", minPoints: 10000 },
  ];
}

export function emptyPoll(): PollState {
  return { active: false, question: "", options: [], votes: {}, endsAt: null, durationSec: 120 };
}

export function emptyPrediction(): PredictionState {
  return {
    active: false,
    question: "",
    options: ["Evet", "Hayır"],
    pots: [0, 0],
    bets: {},
  };
}

function defaultAlertType(text: string, accentColor: string): AlertTypeStyle {
  return {
    enabled: true,
    durationSec: 6,
    imageUrl: "",
    soundUrl: "",
    volume: 0.7,
    text,
    textColor: "#ffffff",
    accentColor,
    animation: "fadeUp",
    fontSize: 28,
    ttsLang: "tr-TR",
  };
}

export function defaultAlertTypes(): AlertTypesConfig {
  return {
    follow: defaultAlertType("{user} takip etti!", "#f59e0b"),
    sub: defaultAlertType("{user} abone oldu!", "#38bdf8"),
    gifted: defaultAlertType("{user} hediye abone gönderdi!", "#a78bfa"),
    host: defaultAlertType("{user} host attı!", "#34d399"),
    tip: defaultAlertType("{user} bahşiş gönderdi!", "#fb7185"),
    kicks: defaultAlertType("{user} Kick ile destekledi!", "#3EEDFE"),
  };
}

export function defaultSubathon(): SubathonConfig {
  return {
    enabled: false,
    endsAt: null,
    secondsPerSub: 60,
    secondsPerFollow: 10,
    secondsPerTip: 30,
    secondsPerBit: 1,
    baseSeconds: 3600,
    paused: false,
  };
}

export function defaultWheel(): WheelConfig {
  return {
    spinning: false,
    result: "",
    options: ["Ödül 1", "Ödül 2", "Ödül 3", "Tekrar"],
    weights: [1, 1, 1, 1],
    spinDurationMs: 4000,
    rotationDeg: 0,
  };
}

/** Ağırlıklı rastgele dilim indeksi */
export function pickWeightedIndex(weights: number[], length: number): number {
  const n = Math.max(1, length);
  const w = Array.from({ length: n }, (_, i) => Math.max(0, Number(weights[i]) || 0));
  const total = w.reduce((a, b) => a + b, 0);
  if (total <= 0) return Math.floor(Math.random() * n);
  let r = Math.random() * total;
  for (let i = 0; i < n; i++) {
    r -= w[i];
    if (r <= 0) return i;
  }
  return n - 1;
}

/**
 * İşaretçi üstte; dilim merkezi üste gelsin diye ekstra turlar + açı.
 * CSS conic-gradient 0° üstten başlar, saat yönünde ilerler.
 */
export function computeWheelRotationDeg(index: number, count: number, extraSpins = 5): number {
  const n = Math.max(1, count);
  const slice = 360 / n;
  const center = index * slice + slice / 2;
  return extraSpins * 360 + ((360 - center) % 360);
}

export function defaultHypeTrain(): HypeTrainConfig {
  return {
    active: false,
    level: 1,
    progress: 0,
    goal: 100,
    conductor: "",
  };
}

export function defaultCup(): CupConfig {
  return {
    enabled: true,
    label: "Kupa",
    current: 0,
    target: 100,
    minBits: 1,
    minKicks: 1,
    color: "#f59e0b",
  };
}

export function defaultGiveaway(): GiveawayConfig {
  return {
    active: false,
    keyword: "+1",
    prize: "",
    entrants: [],
    subMultiplier: 1,
    subsOnly: false,
    spinDurationSec: 5,
    claimDurationSec: 60,
    spinning: false,
    winner: "",
    claimUntil: null,
  };
}

export function defaultEmoteWall(): EmoteWallConfig {
  return {
    enabled: true,
    max: 40,
    durationMs: 3500,
    swaySpeed: 1,
    explosionOnFollow: true,
    explosionOnSub: true,
    minSize: 28,
    maxSize: 64,
  };
}

export function defaultEmoteCombo(): EmoteComboConfig {
  return {
    enabled: true,
    minCount: 3,
    windowMs: 8000,
    showMs: 4000,
    sound: true,
  };
}

export function defaultMovieCredits(): MovieCreditsConfig {
  return {
    enabled: true,
    startMessage: "Teşekkürler",
    endMessage: "İzlediğiniz için teşekkürler",
    scrollSpeed: 80,
    textColor: "#ffffff",
    hours: 8,
    loop: true,
  };
}

export function defaultActivityFeed(): ActivityFeedConfig {
  return {
    muted: false,
    paused: false,
    maxItems: 12,
    showFollow: true,
    showSub: true,
    showRaid: true,
    showRedeem: true,
    showBits: true,
    hideControls: true,
  };
}

export function defaultTts(): TtsConfig {
  return {
    enabled: false,
    volume: 0.85,
    rate: 1,
    pitch: 1,
    maxLen: 200,
    skipCommands: true,
    spamFilter: true,
    blacklist: [],
    cloudMode: false,
    voice: "",
    lang: "tr-TR",
  };
}

export function defaultLabels(): LabelConfig[] {
  return [
    { kind: "follows", title: "Son takipler", maxItems: 5, textColor: "#ffffff", accentColor: "#3ecfcf" },
    { kind: "subs", title: "Son aboneler", maxItems: 5, textColor: "#ffffff", accentColor: "#38bdf8" },
    { kind: "raids", title: "Son raidler", maxItems: 5, textColor: "#ffffff", accentColor: "#34d399" },
    { kind: "redeems", title: "Son ödüller", maxItems: 5, textColor: "#ffffff", accentColor: "#a78bfa" },
    { kind: "top", title: "Top puan", maxItems: 5, textColor: "#ffffff", accentColor: "#f59e0b" },
  ];
}

function defaultFiltersMerge(filters: Partial<SpamFilters> | undefined): SpamFilters {
  const f = filters || {};
  return {
    enabled: f.enabled ?? false,
    bannedWords: Array.isArray(f.bannedWords) ? f.bannedWords : [],
    blockLinks: f.blockLinks ?? false,
    maxCapsPercent: f.maxCapsPercent ?? 80,
    maxMessageLen: f.maxMessageLen ?? 400,
    permitSec: f.permitSec ?? 30,
    maxEmotes: f.maxEmotes ?? 8,
    maxSymbols: f.maxSymbols ?? 20,
    action: f.action === "delete_warn" ? "delete_warn" : "warn",
    timeoutSec: f.timeoutSec ?? 60,
    bypassMods: f.bypassMods ?? true,
    bypassSubs: f.bypassSubs ?? false,
  };
}

export function ensureV2(cfg: BotConfig | BotConfigV2): BotConfigV2 {
  const base = cfg as Partial<BotConfigV2>;
  const alertTypesBase = base.alertTypes || ({} as Partial<AlertTypesConfig>);
  const defaults = defaultAlertTypes();
  const goals = (Array.isArray(base.goals) ? base.goals : defaultGoals()).map((g) => ({
    ...g,
    layout: g.layout || "bar",
    showPercent: g.showPercent !== false,
    color: g.color || "#3ecfcf",
  }));
  const labels = (Array.isArray(base.labels) ? base.labels : defaultLabels()).map((l) => {
    const textColor = l.textColor || "#ffffff";
    const accentColor = l.accentColor || "#3ecfcf";
    return { ...l, textColor, accentColor };
  });
  const wheelOpts = Array.isArray(base.wheel?.options) ? base.wheel!.options : defaultWheel().options;
  const wheelWeights = Array.isArray(base.wheel?.weights)
    ? base.wheel!.weights
    : wheelOpts.map(() => 1);
  return {
    ...(cfg as BotConfig),
    version: 2,
    filters: defaultFiltersMerge((cfg as BotConfig).filters),
    shop: Array.isArray(base.shop) ? base.shop : defaultShop(),
    goals,
    alerts: { ...defaultAlerts(), ...(base.alerts || {}) },
    labels,
    levels: Array.isArray(base.levels) ? base.levels : defaultLevels(),
    tts: { ...defaultTts(), ...(base.tts || {}) },
    poll: { ...emptyPoll(), ...(base.poll || {}) },
    prediction: base.prediction || emptyPrediction(),
    recent: base.recent || { follows: [], subs: [], raids: [], redeems: [] },
    accent: base.accent || "#3ecfcf",
    subathon: { ...defaultSubathon(), ...(base.subathon || {}) },
    viewerCount: typeof base.viewerCount === "number" ? base.viewerCount : 0,
    viewerLabel: typeof base.viewerLabel === "string" ? base.viewerLabel : "İzleyici",
    wheel: {
      ...defaultWheel(),
      ...(base.wheel || {}),
      options: wheelOpts,
      weights: wheelWeights.length === wheelOpts.length ? wheelWeights : wheelOpts.map(() => 1),
    },
    hypeTrain: { ...defaultHypeTrain(), ...(base.hypeTrain || {}) },
    salesLog: Array.isArray(base.salesLog) ? base.salesLog : [],
    discordWebhook: typeof base.discordWebhook === "string" ? base.discordWebhook : "",
    alertTypes: {
      follow: { ...defaults.follow, ...(alertTypesBase.follow || {}) },
      sub: { ...defaults.sub, ...(alertTypesBase.sub || {}) },
      gifted: { ...defaults.gifted, ...(alertTypesBase.gifted || {}) },
      host: { ...defaults.host, ...(alertTypesBase.host || {}) },
      tip: { ...defaults.tip, ...(alertTypesBase.tip || {}) },
      kicks: { ...defaults.kicks, ...(alertTypesBase.kicks || {}) },
    },
    cup: { ...defaultCup(), ...(base.cup || {}) },
    giveaway: {
      ...defaultGiveaway(),
      ...(base.giveaway || {}),
      entrants: Array.isArray(base.giveaway?.entrants) ? base.giveaway!.entrants : [],
    },
    emotewall: { ...defaultEmoteWall(), ...(base.emotewall || {}) },
    emoteCombo: { ...defaultEmoteCombo(), ...(base.emoteCombo || {}) },
    movieCredits: { ...defaultMovieCredits(), ...(base.movieCredits || {}) },
    activityFeed: { ...defaultActivityFeed(), ...(base.activityFeed || {}) },
    ...ensurePanelExtras(base as Partial<PanelExtras>),
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
      ...(base.modules || {}),
    },
  };
}

export type {
  BotCommand,
  BotConfig,
  BotCounter,
  BotModules,
  BotTimer,
  LoyaltyUser,
  Quote,
  SpamFilters,
  UserLevel,
};
