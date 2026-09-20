/**
 * YouTube canlı chat yazma — Google OAuth (implicit) + Data API liveChatMessages.
 */

import { API_BASE } from "../api";

const LS = "yya.youtubeWrite.v1";
const SCOPES = "https://www.googleapis.com/auth/youtube.force-ssl";

export type YoutubeWriteSession = {
  accessToken: string;
  clientId: string;
  expiresAt: number;
  email?: string;
};

let cachedLiveChatId = "";
let cachedVideoId = "";

function load(): YoutubeWriteSession | null {
  try {
    const raw = localStorage.getItem(LS);
    if (!raw) return null;
    const j = JSON.parse(raw) as YoutubeWriteSession;
    if (!j?.accessToken) return null;
    if (j.expiresAt > 0 && j.expiresAt < Date.now()) {
      localStorage.removeItem(LS);
      return null;
    }
    return j;
  } catch {
    return null;
  }
}

function save(s: YoutubeWriteSession | null) {
  try {
    if (!s) localStorage.removeItem(LS);
    else localStorage.setItem(LS, JSON.stringify(s));
  } catch {
    /* */
  }
}

export function getYoutubeWriteSession() {
  return load();
}

export function clearYoutubeWriteSession() {
  save(null);
  cachedLiveChatId = "";
  cachedVideoId = "";
}

export function youtubeWriteStatus() {
  const s = load();
  return {
    connected: !!s?.accessToken,
    clientId: s?.clientId || "",
    email: s?.email || "",
    liveChatId: cachedLiveChatId,
    videoId: cachedVideoId,
  };
}

export function youtubeRedirectUri() {
  const base = (import.meta as any).env?.VITE_API_BASE || "http://127.0.0.1:8843";
  return `${String(base).replace(/\/$/, "")}/oauth/youtube`;
}

export function buildYoutubeAuthorizeUrl(clientId: string): string {
  const params = new URLSearchParams({
    client_id: clientId.trim(),
    redirect_uri: youtubeRedirectUri(),
    response_type: "token",
    scope: SCOPES,
    include_granted_scopes: "true",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function completeYoutubeOAuthFromHash(
  hash: string,
  clientId: string
): Promise<YoutubeWriteSession> {
  const q = new URLSearchParams(hash.replace(/^#/, ""));
  const accessToken = q.get("access_token") || "";
  if (!accessToken) throw new Error("YouTube access_token yok");
  const expiresIn = Number(q.get("expires_in") || 0);
  let email = "";
  try {
    const info = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (info.ok) {
      const j = (await info.json()) as { email?: string };
      email = j.email || "";
    }
  } catch {
    /* */
  }
  const session: YoutubeWriteSession = {
    accessToken,
    clientId: clientId.trim(),
    expiresAt: expiresIn > 0 ? Date.now() + expiresIn * 1000 - 30_000 : 0,
    email,
  };
  save(session);
  return session;
}

/** chatHub canlı videoId’yi buraya yazar */
export function setYoutubeLiveContext(videoId: string) {
  if (videoId && videoId !== cachedVideoId) {
    cachedVideoId = videoId;
    cachedLiveChatId = "";
  }
}

async function resolveLiveChatId(videoId: string, token: string): Promise<string> {
  if (cachedLiveChatId && cachedVideoId === videoId) return cachedLiveChatId;
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "liveStreamingDetails");
  url.searchParams.set("id", videoId);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`YouTube videos API ${res.status}`);
  const j = (await res.json()) as {
    items?: { liveStreamingDetails?: { activeLiveChatId?: string } }[];
  };
  const id = j.items?.[0]?.liveStreamingDetails?.activeLiveChatId || "";
  if (!id) throw new Error("activeLiveChatId yok — yayın canlı mı?");
  cachedLiveChatId = id;
  cachedVideoId = videoId;
  return id;
}

async function resolveVideoIdFromHub(refHint?: string): Promise<string> {
  if (cachedVideoId) return cachedVideoId;
  const q = (refHint || "").trim();
  if (!q) throw new Error("YouTube kanal / video referansı yok");
  const res = await fetch(`${API_BASE}/api/youtube/live?q=${encodeURIComponent(q)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Canlı yayın bulunamadı");
  const data = await res.json();
  const vid = String(data?.videoId || "");
  if (!vid) throw new Error("videoId yok");
  cachedVideoId = vid;
  return vid;
}

export async function sendYoutubeLiveChat(
  text: string,
  channelRef?: string
): Promise<boolean> {
  const session = load();
  if (!session) return false;
  const msg = String(text || "").trim().slice(0, 200);
  if (!msg) return false;
  try {
    const videoId = await resolveVideoIdFromHub(channelRef);
    const liveChatId = await resolveLiveChatId(videoId, session.accessToken);
    const res = await fetch(
      "https://www.googleapis.com/youtube/v3/liveChat/messages?part=snippet",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          snippet: {
            liveChatId,
            type: "textMessageEvent",
            textMessageDetails: { messageText: msg },
          },
        }),
      }
    );
    if (res.status === 401) {
      clearYoutubeWriteSession();
      return false;
    }
    return res.ok;
  } catch {
    return false;
  }
}

/** Canlı sohbetteki son metin mesajlarını siler (toplu clear API yok). */
export async function clearYoutubeLiveChat(channelRef?: string): Promise<boolean> {
  const session = load();
  if (!session) return false;
  try {
    const videoId = await resolveVideoIdFromHub(channelRef);
    const liveChatId = await resolveLiveChatId(videoId, session.accessToken);
    const listUrl = new URL("https://www.googleapis.com/youtube/v3/liveChat/messages");
    listUrl.searchParams.set("liveChatId", liveChatId);
    listUrl.searchParams.set("part", "id,snippet");
    listUrl.searchParams.set("maxResults", "200");
    const list = await fetch(listUrl.toString(), {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    if (list.status === 401) {
      clearYoutubeWriteSession();
      return false;
    }
    if (!list.ok) return false;
    const data = (await list.json()) as {
      items?: { id?: string; snippet?: { type?: string } }[];
    };
    const ids = (data.items || [])
      .filter((it) => it.id && it.snippet?.type === "textMessageEvent")
      .map((it) => String(it.id))
      .slice(0, 80);
    if (!ids.length) return true;
    const results = await Promise.all(
      ids.map(async (id) => {
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/liveChat/messages?id=${encodeURIComponent(id)}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${session.accessToken}` },
          }
        );
        return res.ok || res.status === 404;
      })
    );
    return results.some(Boolean);
  } catch {
    return false;
  }
}
