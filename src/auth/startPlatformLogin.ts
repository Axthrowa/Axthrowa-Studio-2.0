/** Botrix tarzı platform girişi → bot OAuth / çerez + kanal bağlama */

import { patchSettings } from "../lib/api";
import { openExternal } from "../lib/openExternal";
import { loadBotConfig, saveBotConfig } from "../lib/smartBot/store";
import { buildTwitchAuthorizeUrl } from "../lib/platformAuth/twitchWrite";
import { buildYoutubeAuthorizeUrl } from "../lib/platformAuth/youtubeWrite";
import { buildDiscordAuthorizeUrl } from "../lib/platformAuth/discordAuth";
import type { BotPlatform } from "../lib/platformTheme";
import { setActivePlatform } from "../lib/platformTheme";
import { kickGirisiAc } from "../lib/kickAuth";

export type StartLoginResult =
  | { ok: true; opened: boolean; message: string }
  | { ok: false; message: string; needConfig?: boolean };

export async function startPlatformBotLogin(
  platform: BotPlatform
): Promise<StartLoginResult> {
  const cfg = loadBotConfig();

  if (platform === "kick") {
    setActivePlatform("kick");
    const r = await kickGirisiAc("bot");
    return r.ok ? { ok: true, opened: true, message: r.message } : { ok: false, needConfig: r.needConfig, message: r.message };
  }

  if (platform === "twitch") {
    const id = (cfg.twitchClientId || "").trim();
    if (!id) {
      return {
        ok: false,
        needConfig: true,
        message: "Twitch Client ID gerekli — Bot → Entegrasyonlar’dan ekleyin.",
      };
    }
    sessionStorage.setItem("yya.oauth.twitch.clientId", id);
    setActivePlatform("twitch");
    const result = await openExternal(buildTwitchAuthorizeUrl(id));
    return {
      ok: true,
      opened: result === "opened",
      message: result === "opened" ? "Twitch izin penceresi açıldı" : "Twitch OAuth panoya kopyalandı",
    };
  }

  if (platform === "youtube") {
    const id = (cfg.youtubeClientId || "").trim();
    if (!id) {
      return {
        ok: false,
        needConfig: true,
        message: "YouTube / Google Client ID gerekli — Bot → Entegrasyonlar’dan ekleyin.",
      };
    }
    sessionStorage.setItem("yya.oauth.youtube.clientId", id);
    setActivePlatform("youtube");
    const result = await openExternal(buildYoutubeAuthorizeUrl(id));
    return {
      ok: true,
      opened: result === "opened",
      message: result === "opened" ? "YouTube izin penceresi açıldı" : "YouTube OAuth panoya kopyalandı",
    };
  }

  const discordId = String(cfg.discordClientId || localStorage.getItem("yya.discord.clientId") || "").trim();
  if (!discordId) {
    return {
      ok: false,
      needConfig: true,
      message:
        "Discord Client ID gerekli — Bot → Entegrasyonlar’da Discord Client ID kaydedin (Developer Portal OAuth2).",
    };
  }
  sessionStorage.setItem("yya.oauth.discord.clientId", discordId);
  setActivePlatform("discord");
  const result = await openExternal(buildDiscordAuthorizeUrl(discordId));
  return {
    ok: true,
    opened: result === "opened",
    message: result === "opened" ? "Discord izin penceresi açıldı" : "Discord OAuth panoya kopyalandı",
  };
}

export async function attachTwitchChannel(login: string) {
  const slug = login.trim().replace(/^#/, "").toLowerCase();
  if (!slug) return;
  saveBotConfig((prev) => ({
    ...prev,
    enabled: true,
    replyToTwitch: true,
    channelName: prev.channelName || slug,
  }));
  try {
    await patchSettings("chat", { twitchChannel: slug });
  } catch {
    /* */
  }
  try {
    await patchSettings("starting", {
      socials: { twitch: { enabled: true, handle: slug } },
    });
  } catch {
    /* */
  }
}
