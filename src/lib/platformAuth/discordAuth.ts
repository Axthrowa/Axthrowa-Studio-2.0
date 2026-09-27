/**
 * Discord OAuth (identify) — Botrix tarzı “Login with Discord”.
 * Bot paneline bağlanınca webhook / bildirim için oturum saklanır.
 */

const LS = "yya.discordAuth.v1";
const AUTH = "https://discord.com/api/oauth2/authorize";
const TOKEN = "https://discord.com/api/oauth2/token";
const ME = "https://discord.com/api/users/@me";

export type DiscordSession = {
  accessToken: string;
  refreshToken?: string;
  clientId: string;
  userId: string;
  username: string;
  expiresAt: number;
};

function save(s: DiscordSession | null) {
  try {
    if (!s) localStorage.removeItem(LS);
    else localStorage.setItem(LS, JSON.stringify(s));
  } catch {
    /* */
  }
}

export function discordRedirectUri() {
  const base = (import.meta as any).env?.VITE_API_BASE || "http://127.0.0.1:8843";
  return `${String(base).replace(/\/$/, "")}/oauth/discord`;
}

export function buildDiscordAuthorizeUrl(clientId: string): string {
  const params = new URLSearchParams({
    client_id: clientId.trim(),
    redirect_uri: discordRedirectUri(),
    response_type: "token",
    scope: "identify",
    prompt: "consent",
  });
  return `${AUTH}?${params}`;
}

/** Implicit flow (#access_token=…) */
export async function completeDiscordOAuthFromHash(
  hash: string,
  clientId: string
): Promise<DiscordSession> {
  const q = new URLSearchParams(hash.replace(/^#/, ""));
  const accessToken = q.get("access_token") || "";
  if (!accessToken) throw new Error("Discord access_token yok");
  const expiresIn = Number(q.get("expires_in") || 0);
  const me = await fetch(ME, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!me.ok) throw new Error("Discord kullanıcı bilgisi alınamadı");
  const u = (await me.json()) as { id?: string; username?: string; global_name?: string };
  const username = String(u.global_name || u.username || "discord");
  const session: DiscordSession = {
    accessToken,
    clientId: clientId.trim(),
    userId: String(u.id || ""),
    username,
    expiresAt: expiresIn > 0 ? Date.now() + expiresIn * 1000 - 30_000 : 0,
  };
  save(session);
  return session;
}

void TOKEN;
