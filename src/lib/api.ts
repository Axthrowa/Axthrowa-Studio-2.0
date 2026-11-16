function computeApiBase(): string {
  const env = String((import.meta as any).env?.VITE_API_BASE || "")
    .trim()
    .replace(/\/$/, "");
  if (env) return env;
  if (typeof window === "undefined") return "http://127.0.0.1:8843";
  const { protocol, hostname, port } = window.location;
  if (protocol === "http:" || protocol === "https:") {
    if (port === "1420") return "http://127.0.0.1:8843";
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]" ||
      port === "8843"
    ) {
      return "";
    }
  }
  return "http://127.0.0.1:8843";
}

/** Başarısız yanıtın gövdesini (ör. 503 + {"error"}) veri sanmaz: `ok` değilse hata fırlatır. */
export async function okJson<T = any>(r: Response): Promise<T> {
  if (!r.ok) throw new Error(`HTTP ${r.status}${r.url ? ` ${r.url}` : ""}`);
  return r.json() as Promise<T>;
}

/** Aynı kökte (8843) göreli yol; Vite (1420) → yerel bot sunucusu. */
export const API_BASE = computeApiBase();

export function apiBaseCandidates(): string[] {
  const out: string[] = [];
  const push = (b: string) => {
    const n = String(b || "").replace(/\/$/, "");
    if (!out.includes(n)) out.push(n);
  };
  push(API_BASE);
  if (typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location;
    if (protocol === "http:" || protocol === "https:") {
      if (port === "1420") {
        push("http://127.0.0.1:8843");
        push("http://localhost:8843");
      } else {
        push("");
        if (hostname === "localhost") push(`http://127.0.0.1:${port || "8843"}`);
        if (hostname === "127.0.0.1") push(`http://localhost:${port || "8843"}`);
      }
    }
  }
  push("http://127.0.0.1:8843");
  push("http://localhost:8843");
  return out;
}

export type ScreenId = "starting" | "ending" | "brb" | "chat" | "panel";

export type OverlaySettings = Record<string, any>;

export async function fetchSettings(screen: ScreenId): Promise<OverlaySettings> {
  const res = await fetch(`${API_BASE}/api/settings?screen=${screen}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("settings fetch failed");
  return res.json();
}

export async function saveSettings(screen: ScreenId, data: OverlaySettings) {
  await fetch(`${API_BASE}/api/settings?screen=${screen}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function patchSettings(screen: ScreenId, patch: OverlaySettings) {
  const res = await fetch(`${API_BASE}/api/settings/patch?screen=${screen}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return res.json();
}

const AUDIO_EXT = /\.(mp3|wav|ogg|flac|m4a|aac)$/i;
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|apng)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|mkv|m4v)$/i;
const BG_IMAGE_EXT = /\.(png|jpe?g|webp|gif|apng)$/i;

function libraryAssetUrl(folder: string, name: string) {
  return `${API_BASE}/assets/${folder}/${encodeURIComponent(name)}`;
}

/** Ses/video/logo/arka plan yolu → HTTP URL. Kütüphane dosya adları desteklenir. */
export function mediaUrl(
  absolutePath: string | null | undefined,
  hint?: "logos" | "backgrounds" | "videos" | "music" | "particles"
): string | null {
  if (!absolutePath) return null;
  if (/^https?:\/\//i.test(absolutePath) || absolutePath.startsWith("data:")) return absolutePath;
  const norm = absolutePath.replace(/\\/g, "/");
  const base = norm.split("/").pop() || norm;

  if (/\/assets\/videos\//i.test(norm)) return libraryAssetUrl("videos", base);
  if (/\/assets\/music\//i.test(norm)) return libraryAssetUrl("music", base);
  if (/\/assets\/logos\//i.test(norm)) return libraryAssetUrl("logos", base);
  if (/\/assets\/backgrounds\//i.test(norm)) return libraryAssetUrl("backgrounds", base);
  if (/\/assets\/particles\//i.test(norm)) return libraryAssetUrl("particles", base);

  // Sadece dosya adı → uzantı / hint
  if (!norm.includes(":") && !norm.startsWith("/") && !norm.includes("/")) {
    if (hint) return libraryAssetUrl(hint, norm);
    if (AUDIO_EXT.test(norm)) return libraryAssetUrl("music", norm);
    if (VIDEO_EXT.test(norm)) return libraryAssetUrl("videos", norm);
    if (BG_IMAGE_EXT.test(norm) || IMAGE_EXT.test(norm)) return libraryAssetUrl("logos", norm);
  }

  return `${API_BASE}/media/file?path=${encodeURIComponent(absolutePath)}`;
}

export async function importLibraryFile(
  kind: "logos" | "videos" | "music" | "backgrounds" | "sfx",
  path: string
) {
  const res = await fetch(`${API_BASE}/api/library/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, path }),
  });
  if (!res.ok) throw new Error("import failed");
  return res.json() as Promise<{ ok: boolean; name: string; kind: string }>;
}

// ---------------------------------------------------------------------------
// Gömülü müzik eklentisi (Resonance)
// ---------------------------------------------------------------------------

export type NowPlaying = {
  title: string;
  artist: string;
  album: string;
  albumArt: string;
  isPlaying: boolean;
  /** ms */
  progress: number;
  /** ms */
  duration: number;
  source: string;
  updatedAt: number;
  /** Paylaşım bağlantısı (Spotify); bilinmiyorsa boş */
  url?: string;
  /** source "smtc": Windows medya oturumundaki oynatıcı (ör. AppleMusic, Brave) */
  app?: string;
};

export type PlayerStatus = {
  source: "spotify" | "youtube-music";
  sourceAuto?: boolean;
  /** R3: kaynak sırası (boş = otomatik) ve yok sayılan uygulamalar */
  tercih?: { oncelik: string[]; yoksay: string[] };
  spotify: { connected: boolean; clientId: string; displayName: string };
  ytmd: { connected: boolean; host: string; port: string };
  note: string | null;
  nowPlaying: NowPlaying | null;
};

export async function fetchNowPlaying(): Promise<NowPlaying | null> {
  const res = await fetch(`${API_BASE}/api/now-playing`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchPlayerStatus(): Promise<PlayerStatus> {
  const res = await fetch(`${API_BASE}/api/player/status`, { cache: "no-store" });
  if (!res.ok) throw new Error("player status failed");
  return res.json();
}

export async function setPlayerTercih(tercih: { oncelik: string[]; yoksay: string[] }): Promise<PlayerStatus> {
  const res = await fetch(`${API_BASE}/api/player/tercih`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tercih),
  });
  if (!res.ok) throw new Error("tercih kaydedilemedi");
  return res.json();
}

export async function sendPlayerCommand(action: string, source?: string) {
  const res = await fetch(`${API_BASE}/api/player/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, source }),
  });
  if (!res.ok) throw new Error((await res.text()) || "komut başarısız");
}

/** Y5: yayın süresince Spotify'da çalanlardan gizli çalma listesi */
export async function spotifyYayinListesi(baslangic: number, bitis: number, ad: string): Promise<{ ad: string; url: string; eklenen: number }> {
  const res = await fetch(`${API_BASE}/api/player/spotify/yayin-listesi`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ baslangic, bitis, ad }),
  });
  if (!res.ok) throw new Error((await res.text()) || "liste oluşturulamadı");
  return res.json();
}

/** Y11 Discord etkinliği: bot token'ı yalnız Studio kasasında; yanıtlarda dönmez */
export type DiscordEtkinlikDurumu = { tokenVar: boolean; sunucuId: string; sunucuAdi?: string; hata?: string };
async function discordIstek<T>(yol: string, govde?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}/api/discord/etkinlik${yol}`, govde === undefined ? { cache: "no-store" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(govde) });
  if (!res.ok) throw new Error((await res.text()) || `Discord isteği başarısız (${res.status})`);
  return res.json();
}
export const discordEtkinlikDurumu = () => discordIstek<DiscordEtkinlikDurumu>("/durum");
export const discordEtkinlikAyari = (a: { token?: string; sunucuId?: string; sil?: boolean }) => discordIstek<DiscordEtkinlikDurumu>("/ayar", a);
export const discordEtkinlikEkle = (e: { baslik: string; zaman: string; sureDk: number; konum: string; aciklama?: string }) => discordIstek<{ id: string }>("", e);
export const discordEtkinlikSil = (id: string) => discordIstek<{ tamam: boolean }>("/sil", { id });

export async function fetchServerInfo() {
  const res = await fetch(`${API_BASE}/api/server`, { cache: "no-store" });
  return res.json();
}

export function isObsMode() {
  const q = new URLSearchParams(window.location.search);
  if (q.get("obs") === "1") return true;
  const hash = window.location.hash || "";
  if (hash.includes("obs=1")) return true;
  const p = window.location.pathname.replace(/\/$/, "") || "/";
  if (["/starting", "/ending", "/brb", "/chat", "/sfx"].includes(p)) return true;
  return false;
}

/** OBS Browser Source URL — path tabanlı (Hash OBS'te sorun çıkarır) */
export function overlayUrl(base: string, screen: string) {
  const b = (base || "http://127.0.0.1:8843").replace(/\/$/, "");
  return `${b}/${screen}?obs=1`;
}

/** Ticker: hız 1–20 (yüksek=hızlı). Eski sn (>=25) süre olarak kalır. */
export function tickerDurationSec(speed: number | undefined) {
  const v = Number(speed);
  if (!Number.isFinite(v) || v <= 0) return 10;
  if (v >= 25) return Math.max(4, Math.min(90, v));
  const level = Math.max(1, Math.min(20, Math.round(v)));
  // 1≈40s, 8≈10s, 12≈8s, 20≈5s — daha uzun kayma
  return Math.max(4.5, Math.round((80 / level) * 10) / 10);
}
