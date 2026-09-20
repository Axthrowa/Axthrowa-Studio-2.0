/** Örnek OAuth 2.0 istemci ayarları — production’da env’e taşıyın. */

export type OAuthPlatform = "twitch" | "kick" | "youtube";

const REDIRECT_URI =
  typeof window !== "undefined"
    ? `${window.location.origin}/auth/callback`
    : "http://127.0.0.1:8843/auth/callback";

/** Demo / örnek client_id değerleri */
export const OAUTH_CLIENTS = {
  twitch: "YOUR_TWITCH_CLIENT_ID",
  kick: "YOUR_KICK_CLIENT_ID",
  youtube: "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
} as const;

const SCOPES = {
  twitch: "user:read:email chat:read chat:write",
  kick: "user:read channel:read chat:write",
  youtube: "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.force-ssl",
} as const;

function randomState(platform: OAuthPlatform): string {
  const nonce = crypto.randomUUID?.() ?? String(Date.now());
  try {
    sessionStorage.setItem("yya.oauth.state", `${platform}:${nonce}`);
  } catch {
    /* */
  }
  return `${platform}:${nonce}`;
}

/** Platform authorize URL’leri (response_type=code). */
export function buildAuthorizeUrl(platform: OAuthPlatform): string {
  const state = randomState(platform);
  const redirectUri = REDIRECT_URI;

  if (platform === "twitch") {
    const q = new URLSearchParams({
      client_id: OAUTH_CLIENTS.twitch,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES.twitch,
      state,
      force_verify: "true",
    });
    return `https://id.twitch.tv/oauth2/authorize?${q}`;
  }

  if (platform === "kick") {
    const q = new URLSearchParams({
      response_type: "code",
      client_id: OAUTH_CLIENTS.kick,
      redirect_uri: redirectUri,
      scope: SCOPES.kick,
      state,
    });
    // Kick docs: sacrificial redirect=127.0.0.1 before redirect_uri (Next.js quirk)
    return `https://id.kick.com/oauth/authorize?redirect=127.0.0.1&${q}`;
  }

  const q = new URLSearchParams({
    client_id: OAUTH_CLIENTS.youtube,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.youtube,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

export function oauthRedirectUri() {
  return REDIRECT_URI;
}
