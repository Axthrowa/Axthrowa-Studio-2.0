/** Kick OAuth / oturum — frozen exe snake_case + yeni camelCase. */

import { API_BASE, patchSettings } from "./api";
import { botaxtApi } from "./api/botaxt";
import { openExternal } from "./openExternal";
import { saveBotConfig } from "./smartBot";

export const KICK_LOGIN_URL = "https://id.kick.com/login";

export function kickAuthBody(clientId: string, clientSecret: string, slug?: string) {
  const broadcaster = (slug || "").trim() || undefined;
  return {
    clientId,
    client_id: clientId,
    clientSecret,
    client_secret: clientSecret,
    broadcasterSlug: broadcaster,
    broadcaster_slug: broadcaster,
  };
}

export async function postKickJson(path: string, body: unknown) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const raw = await r.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    json = { error: raw };
  }
  return { ok: r.ok, status: r.status, raw, json };
}

type KickIdentity = {
  username?: string | null;
  channelSlug?: string | null;
  broadcasterSlug?: string | null;
  ready?: boolean;
  connected?: boolean;
  hasCookies?: boolean;
};

function pickSlug(...vals: Array<string | null | undefined>) {
  for (const v of vals) {
    const s = String(v || "")
      .trim()
      .replace(/^@/, "");
    if (s) return s;
  }
  return "";
}

export async function readKickIdentity(): Promise<{ slug: string; ready: boolean }> {
  const tries: KickIdentity[] = [];
  for (const path of ["/api/kick/bot-session/status", "/api/kick/oauth/status", "/api/kick/hub"]) {
    try {
      const r = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
      if (r.ok) tries.push((await r.json()) as KickIdentity);
    } catch {
      /* */
    }
  }
  const slug = pickSlug(
    ...tries.map((t) => t.channelSlug),
    ...tries.map((t) => t.broadcasterSlug),
    ...tries.map((t) => t.username)
  );
  const ready = tries.some((t) => !!(t.ready || t.connected || t.hasCookies || t.username));
  return { slug, ready };
}

/** Giriş yapılan Kick hesabını kanal olarak kaydet ve sohbeti bağla. */
export async function bindBotToKickChannel(preferredSlug?: string) {
  const ident = await readKickIdentity();
  const slug = pickSlug(preferredSlug, ident.slug);
  if (!slug) return { ok: false as const, slug: "", message: "Kick kanalı bulunamadı" };
  saveBotConfig((prev) => ({
    ...prev,
    enabled: true,
    replyToKick: true,
    channelName: slug,
  }));
  try {
    await patchSettings("chat", { kickSlug: slug });
  } catch {
    /* */
  }
  try {
    await patchSettings("starting", {
      socials: {
        kick: { enabled: true, handle: slug },
      },
    });
  } catch {
    /* */
  }
  try {
    await botaxtApi.kickChatConnect(slug);
  } catch {
    /* sohbet ayrı bağlanabilir */
  }
  return { ok: true as const, slug, message: `Bot Kick kanalına bağlandı: ${slug}` };
}

export async function openKickLoginPage() {
  return openExternal(KICK_LOGIN_URL);
}
