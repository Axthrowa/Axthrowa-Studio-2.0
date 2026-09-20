/**
 * Twitch chat:write — tarayıcı OAuth (implicit) + IRC PRIVMSG.
 * Rust derlemesi gerekmez; token localStorage’da.
 */

const LS = "yya.twitchWrite.v1";
const AUTH_URL = "https://id.twitch.tv/oauth2/authorize";
const IRC_URL = "wss://irc-ws.chat.twitch.tv:443";
const SCOPES = "chat:read chat:write user:read:chat";

export type TwitchWriteSession = {
  accessToken: string;
  login: string;
  userId?: string;
  clientId: string;
  expiresAt: number; // 0 = bilinmiyor
};

function load(): TwitchWriteSession | null {
  try {
    const raw = localStorage.getItem(LS);
    if (!raw) return null;
    const j = JSON.parse(raw) as TwitchWriteSession;
    if (!j?.accessToken || !j?.login) return null;
    if (j.expiresAt > 0 && j.expiresAt < Date.now()) {
      localStorage.removeItem(LS);
      return null;
    }
    return j;
  } catch {
    return null;
  }
}

function save(s: TwitchWriteSession | null) {
  try {
    if (!s) localStorage.removeItem(LS);
    else localStorage.setItem(LS, JSON.stringify(s));
  } catch {
    /* */
  }
}

export function getTwitchWriteSession(): TwitchWriteSession | null {
  return load();
}

export function clearTwitchWriteSession() {
  save(null);
}

export function twitchWriteStatus() {
  const s = load();
  return {
    connected: !!s?.accessToken,
    login: s?.login || "",
    clientId: s?.clientId || "",
  };
}

/** Redirect URI — kullanıcı Twitch Developer Console’da bunu eklemeli */
export function twitchRedirectUri() {
  const base = (import.meta as any).env?.VITE_API_BASE || "http://127.0.0.1:8843";
  return `${String(base).replace(/\/$/, "")}/oauth/twitch`;
}

export function buildTwitchAuthorizeUrl(clientId: string): string {
  const params = new URLSearchParams({
    client_id: clientId.trim(),
    redirect_uri: twitchRedirectUri(),
    response_type: "token",
    scope: SCOPES,
    force_verify: "true",
  });
  return `${AUTH_URL}?${params}`;
}

/** Callback sayfasından hash token yakala */
export async function completeTwitchOAuthFromHash(
  hash: string,
  clientId: string
): Promise<TwitchWriteSession> {
  const q = new URLSearchParams(hash.replace(/^#/, ""));
  const accessToken = q.get("access_token") || "";
  if (!accessToken) throw new Error("Twitch access_token yok");
  const expiresIn = Number(q.get("expires_in") || 0);
  const validate = await fetch("https://id.twitch.tv/oauth2/validate", {
    headers: { Authorization: `OAuth ${accessToken}` },
  });
  if (!validate.ok) throw new Error("Twitch token doğrulanamadı");
  const v = (await validate.json()) as { login?: string; user_id?: string };
  const login = String(v.login || "").toLowerCase();
  if (!login) throw new Error("Twitch login yok");
  const session: TwitchWriteSession = {
    accessToken,
    login,
    userId: v.user_id,
    clientId: clientId.trim(),
    expiresAt: expiresIn > 0 ? Date.now() + expiresIn * 1000 - 30_000 : 0,
  };
  save(session);
  return session;
}

/** Tek seferlik IRC bağlantısı ile PRIVMSG gönder */
export function sendTwitchPrivmsg(channel: string, text: string): Promise<boolean> {
  const session = load();
  if (!session) return Promise.resolve(false);
  const ch = String(channel || "")
    .trim()
    .replace(/^#/, "")
    .toLowerCase();
  const msg = String(text || "").trim().slice(0, 480);
  if (!ch || !msg) return Promise.resolve(false);

  return new Promise((resolve) => {
    let done = false;
    let ws: WebSocket | null = null;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      try {
        ws?.close();
      } catch {
        /* */
      }
      resolve(ok);
    };
    try {
      ws = new WebSocket(IRC_URL);
    } catch {
      finish(false);
      return;
    }
    const t = window.setTimeout(() => finish(false), 8000);
    ws.onopen = () => {
      ws!.send("CAP REQ :twitch.tv/commands");
      ws!.send(`PASS oauth:${session.accessToken}`);
      ws!.send(`NICK ${session.login}`);
    };
    ws.onmessage = (ev) => {
      const raw = String(ev.data || "");
      if (raw.includes("Login authentication failed") || raw.includes("Login unsuccessful")) {
        window.clearTimeout(t);
        clearTwitchWriteSession();
        finish(false);
        return;
      }
      // 001 = welcome → yaz
      if (raw.includes(" 001 ") || raw.includes("GLOBALUSERSTATE")) {
        try {
          ws!.send(`PRIVMSG #${ch} :${msg}`);
          window.clearTimeout(t);
          window.setTimeout(() => finish(true), 200);
        } catch {
          window.clearTimeout(t);
          finish(false);
        }
      }
    };
    ws.onerror = () => {
      window.clearTimeout(t);
      finish(false);
    };
    ws.onclose = () => {
      window.clearTimeout(t);
      if (!done) finish(false);
    };
  });
}
