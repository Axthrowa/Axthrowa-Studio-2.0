/** Botaxt panel sekmelerinden aktarılan ekstra config şeması. */

import { uid, type BotCommand, type UserLevel } from "./types";

export type CommandTrigger = "command" | "keyword";
export type KeywordMatch = "exact" | "startsWith" | "contains" | "endsWith";
export type CmdAvailability = "always" | "live" | "offline";
export type PlatformFlag = "kick" | "twitch" | "youtube" | "all";

/** Botaxt custom/keyword command alanları (BotCommand üzerine). */
export type ExtraCommandFields = {
  trigger: CommandTrigger;
  keywordMatch: KeywordMatch;
  platforms: PlatformFlag[];
  availability: CmdAvailability;
  /** Komutu çalıştırmak için sadakat puanı */
  cost: number;
  /** response dışında ek rastgele yanıtlar */
  responses: string[];
};

/** @deprecated alias — ExtraCommandFields */
export type CommandExtras = ExtraCommandFields;

export type ExtendedCommand = BotCommand & ExtraCommandFields;

export type ClaimDropConfig = {
  enabled: boolean;
  auto: boolean;
  command: string;
  cooldownSec: number;
  durationSec: number;
  reward: number;
  claimLimit: number;
  minMessages: number;
  minLevel: number;
  openMsg: string;
  reminderMsg: string;
  successMsg: string;
  closeMsg: string;
  activeUntil: number | null;
  claimed: string[];
};

export type LoyaltyExtras = {
  ignoredUsers: string[];
  initialPoints: number;
  pointsPer100Bits: number;
  pointsPerSub: number;
  leaderboardPeriod: "daily" | "weekly" | "monthly" | "lifetime";
  claimDrop: ClaimDropConfig;
};

export type MinigameGameConfig = {
  enabled: boolean;
  commands: string[];
  cooldownSeconds: number;
  difficulty: "easy" | "normal";
  maxBet: number;
  minRole: UserLevel;
  pricePoints: number;
};

export type MinigamesConfig = {
  slots: MinigameGameConfig;
  roulette: MinigameGameConfig;
  gamble: MinigameGameConfig;
  bduel: MinigameGameConfig & { note: string };
};

export type QueueConfig = {
  enabled: boolean;
  open: boolean;
  name: string;
  cost: number;
  userCooldownSec: number;
  maxUsers: number;
  minLevel: number;
  users: string[];
};

export type SongRequestItem = {
  id: string;
  user: string;
  title: string;
  url: string;
  t: number;
};

export type SongRequestConfig = {
  enabled: boolean;
  cost: number;
  maxPerUser: number;
  maxDurationSec: number;
  blacklist: string[];
  queue: SongRequestItem[];
  paused: boolean;
  volume: number;
};

export type TextAlertSettings = {
  enabled: boolean;
  follow: string;
  sub: string;
  raid: string;
  bits: string;
};

export type AlertVariant = {
  id: string;
  typeKey: string;
  name: string;
  minAmount: number;
  imageUrl: string;
  soundUrl: string;
  text: string;
  enabled: boolean;
};

export type AlertsExtras = {
  theme: "compact" | "default" | "legacy" | "fade" | "slide" | "random";
  opacity: number;
  variants: AlertVariant[];
  textAlerts: TextAlertSettings;
};

export type ProfileConfig = {
  displayName: string;
  language: string;
  primaryPlatform: "kick" | "twitch" | "youtube";
};

export type SubuserPerm = { module: string; read: boolean; modify: boolean };

export type SubuserMember = {
  id: string;
  username: string;
  platform: string;
  status: "pending" | "active" | "revoked";
  perms: SubuserPerm[];
};

export type SubusersConfig = {
  members: SubuserMember[];
  invites: { id: string; username: string; platform: string; t: number }[];
};

export type ReferralsConfig = {
  code: string;
  invited: { user: string; t: number }[];
  points: number;
  pointsToNextMonth: number;
};

export type DiscordIntegration = {
  webhookUrl: string;
  goLiveMessage: string;
  enabled: boolean;
};

export type PanelExtras = {
  /** Komut id → ekstra alanlar (trigger/keyword/platform/cost) */
  commandExtras: Record<string, ExtraCommandFields>;
  loyaltyExtras: LoyaltyExtras;
  minigames: MinigamesConfig;
  queue: QueueConfig;
  songRequest: SongRequestConfig;
  alertsExtras: AlertsExtras;
  profile: ProfileConfig;
  subusers: SubusersConfig;
  referrals: ReferralsConfig;
  discord: DiscordIntegration;
};

function defaultGame(cmds: string[]): MinigameGameConfig {
  return {
    enabled: true,
    commands: cmds,
    cooldownSeconds: 15,
    difficulty: "normal",
    maxBet: 500,
    minRole: 100,
    pricePoints: 0,
  };
}

export function defaultClaimDrop(): ClaimDropConfig {
  return {
    enabled: false,
    auto: false,
    command: "claim",
    cooldownSec: 300,
    durationSec: 60,
    reward: 50,
    claimLimit: 100,
    minMessages: 0,
    minLevel: 100,
    openMsg: "Puan düşüşü başladı! !claim yaz.",
    reminderMsg: "Hâlâ aktif — !claim",
    successMsg: "$(user) {reward} puan aldı!",
    closeMsg: "Puan düşüşü bitti.",
    activeUntil: null,
    claimed: [],
  };
}

export function defaultPanelExtras(): PanelExtras {
  return {
    commandExtras: {},
    loyaltyExtras: {
      ignoredUsers: [],
      initialPoints: 0,
      pointsPer100Bits: 10,
      pointsPerSub: 100,
      leaderboardPeriod: "lifetime",
      claimDrop: defaultClaimDrop(),
    },
    minigames: {
      slots: defaultGame(["slots"]),
      roulette: defaultGame(["roulette", "rulet"]),
      gamble: defaultGame(["gamble", "bahis"]),
      bduel: {
        ...defaultGame(["bduel", "duel"]),
        enabled: false,
        note: "B-Duel bulut oyunu — yerel stub (Komut kaydı hazır)",
      },
    },
    queue: {
      enabled: true,
      open: false,
      name: "Oyun sırası",
      cost: 0,
      userCooldownSec: 10,
      maxUsers: 50,
      minLevel: 100,
      users: [],
    },
    songRequest: {
      enabled: true,
      cost: 0,
      maxPerUser: 3,
      maxDurationSec: 600,
      blacklist: [],
      queue: [],
      paused: false,
      volume: 0.8,
    },
    alertsExtras: {
      theme: "default",
      opacity: 1,
      variants: [],
      textAlerts: {
        enabled: true,
        follow: "Teşekkürler takip @$(user)!",
        sub: "Teşekkürler abone @$(user)!",
        raid: "Raid! @$(user)",
        bits: "Bits @$(user) $(amount)",
      },
    },
    profile: {
      displayName: "",
      language: "tr",
      primaryPlatform: "kick",
    },
    subusers: { members: [], invites: [] },
    referrals: {
      code: uid("ref").slice(0, 10),
      invited: [],
      points: 0,
      pointsToNextMonth: 1000,
    },
    discord: {
      webhookUrl: "",
      goLiveMessage: "$(channel) yayında! $(title)",
      enabled: false,
    },
  };
}

export function defaultCommandExtras(): ExtraCommandFields {
  return {
    trigger: "command",
    keywordMatch: "exact",
    platforms: ["all"],
    availability: "always",
    cost: 0,
    responses: [],
  };
}

export function ensurePanelExtras(partial?: Partial<PanelExtras> | null): PanelExtras {
  const d = defaultPanelExtras();
  const p = partial || {};
  // Eski queueCfg anahtarını destekle
  const legacyQueue = (p as { queueCfg?: QueueConfig }).queueCfg;
  const queueSrc = p.queue || legacyQueue;
  return {
    commandExtras: p.commandExtras && typeof p.commandExtras === "object" ? p.commandExtras : {},
    loyaltyExtras: {
      ...d.loyaltyExtras,
      ...(p.loyaltyExtras || {}),
      claimDrop: {
        ...d.loyaltyExtras.claimDrop,
        ...(p.loyaltyExtras?.claimDrop || {}),
        claimed: Array.isArray(p.loyaltyExtras?.claimDrop?.claimed)
          ? p.loyaltyExtras!.claimDrop!.claimed
          : [],
      },
      ignoredUsers: Array.isArray(p.loyaltyExtras?.ignoredUsers)
        ? p.loyaltyExtras!.ignoredUsers
        : [],
    },
    minigames: {
      slots: { ...d.minigames.slots, ...(p.minigames?.slots || {}) },
      roulette: { ...d.minigames.roulette, ...(p.minigames?.roulette || {}) },
      gamble: { ...d.minigames.gamble, ...(p.minigames?.gamble || {}) },
      bduel: { ...d.minigames.bduel, ...(p.minigames?.bduel || {}) },
    },
    queue: {
      ...d.queue,
      ...(queueSrc || {}),
      users: Array.isArray(queueSrc?.users) ? queueSrc.users : [],
    },
    songRequest: {
      ...d.songRequest,
      ...(p.songRequest || {}),
      queue: Array.isArray(p.songRequest?.queue) ? p.songRequest!.queue : [],
      blacklist: Array.isArray(p.songRequest?.blacklist) ? p.songRequest!.blacklist : [],
    },
    alertsExtras: {
      ...d.alertsExtras,
      ...(p.alertsExtras || {}),
      variants: Array.isArray(p.alertsExtras?.variants) ? p.alertsExtras!.variants : [],
      textAlerts: { ...d.alertsExtras.textAlerts, ...(p.alertsExtras?.textAlerts || {}) },
    },
    profile: { ...d.profile, ...(p.profile || {}) },
    subusers: {
      members: Array.isArray(p.subusers?.members) ? p.subusers!.members : [],
      invites: Array.isArray(p.subusers?.invites) ? p.subusers!.invites : [],
    },
    referrals: {
      ...d.referrals,
      ...(p.referrals || {}),
      invited: Array.isArray(p.referrals?.invited) ? p.referrals!.invited : [],
    },
    discord: { ...d.discord, ...(p.discord || {}) },
  };
}

/** ensurePanelExtras alias — kısmi config birleştirme */
export function mergePanelExtras(base?: Partial<PanelExtras> | null): PanelExtras {
  return ensurePanelExtras(base);
}
