/**
 * Kick / Twitch / YouTube sohbetini platform tarafında temizler
 * ve yerel overlay listesini sıfırlar.
 */

import { API_BASE, patchSettings } from "./api";
import { sendTwitchPrivmsg } from "./platformAuth/twitchWrite";
import { clearYoutubeLiveChat } from "./platformAuth/youtubeWrite";
import { getBotConfig } from "./smartBot";

export type ClearPlatformResult = {
  local: boolean;
  kick: boolean;
  twitch: boolean;
  youtube: boolean;
  detail: string[];
};

export async function clearPlatformChats(opts?: {
  twitchChannel?: string;
  youtubeChannel?: string;
}): Promise<ClearPlatformResult> {
  const detail: string[] = [];
  const cfg = getBotConfig();
  const twitchChannel = String(
    opts?.twitchChannel || (cfg as { twitchChannel?: string }).twitchChannel || ""
  ).replace(/^#/, "");
  const youtubeChannel = String(
    opts?.youtubeChannel || (cfg as { youtubeChannel?: string }).youtubeChannel || ""
  );

  let local = false;
  try {
    await patchSettings("chat", { clearEpoch: Date.now() });
    local = true;
  } catch {
    detail.push("Yerel overlay temizlenemedi");
  }

  let kick = false;
  try {
    const res = await fetch(`${API_BASE}/api/chat/clear-platforms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (res.ok) {
      const body = (await res.json()) as { kick?: boolean; kickError?: string };
      kick = !!body.kick;
      if (!kick && body.kickError) detail.push(`Kick: ${body.kickError}`);
      else if (!kick) detail.push("Kick sohbeti temizlenemedi (moderatör oturumu gerekir)");
    } else {
      detail.push(`Kick API ${res.status}`);
    }
  } catch (e) {
    detail.push(`Kick: ${String((e as Error).message || e)}`);
  }

  let twitch = false;
  if (twitchChannel) {
    twitch = await sendTwitchPrivmsg(twitchChannel, "/clear");
    if (!twitch) detail.push("Twitch /clear gönderilemedi — yazma oturumu veya kanal adı yok");
  } else {
    detail.push("Twitch kanalı tanımlı değil");
  }

  let youtube = false;
  try {
    youtube = await clearYoutubeLiveChat(youtubeChannel || undefined);
    if (!youtube) detail.push("YouTube mesajları silinemedi — OAuth veya canlı chat yok");
  } catch (e) {
    detail.push(`YouTube: ${String((e as Error).message || e)}`);
  }

  return { local, kick, twitch, youtube, detail };
}

export function clearResultToast(r: ClearPlatformResult): string {
  const ok = [
    r.kick ? "Kick" : null,
    r.twitch ? "Twitch" : null,
    r.youtube ? "YouTube" : null,
    r.local ? "yerel overlay" : null,
  ].filter(Boolean);
  if (!ok.length) return r.detail[0] || "Sohbet temizlenemedi";
  return `Sohbet temizlendi: ${ok.join(", ")}`;
}
