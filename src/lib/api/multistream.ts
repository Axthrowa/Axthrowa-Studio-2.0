/** Çoklu yayın / Control Plane API istemcisi (`/api/multistream`, `/api/audit`). */

import { API_BASE } from "../api";
import type { DestState } from "../controlCenter";

export type Platform = "twitch" | "kick" | "youtube" | "custom";

export type DestProgress = {
  frames: number;
  fps: number;
  bitrateKbps: number | null;
  totalBytes: number;
  outTimeMs: number;
  speed: number | null;
  ended: boolean;
};

export type Destination = {
  id: string;
  name: string;
  platform: Platform;
  platformLabel: string;
  server: string;
  enabled: boolean;
  hasKey: boolean;
  /** Sırrın başvurusu (değer değil): secure://<platform>/<hedef>/stream-key */
  keyRef?: string;
  state: DestState;
  failures: number;
  progress: DestProgress | null;
  droppedTotal: number;
  lastError: string | null;
  retryInSecs: number | null;
};

export type MultistreamStatus = {
  session: {
    port: number;
    server: string;
    ingest: "listening" | "receiving";
    uptimeSecs: number;
    bytesIn: number;
    sourceSecs: number | null;
  } | null;
  destinations: Destination[];
  ffmpeg: string | null;
  log: string[];
  presets: { platform: Platform; label: string; server: string | null }[];
  obsRedirected: boolean;
  ingest?: { server: string; key: string };
  /** Doğrulanmış platform sınırları (kaynak + tarih) */
  sinirlar?: { kickMaxKbps: number; youtubeMaxKeyintSn: number; kaynaklar: Record<string, string>; dogrulama: string };
};

export type Finding = {
  id: string;
  level: "info" | "warn" | "block";
  destination: string | null;
  message: string;
  source: string;
  verified: string;
};

export type EncoderInfo = {
  codec: string | null;
  bitrateKbps: number | null;
  rateControl: string | null;
  keyintSec: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
};

export type AuditRow = { id: number; actor: string; action: string; detail_json: string; ts: number };

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(text || `HTTP ${r.status}`);
  return (text ? JSON.parse(text) : {}) as T;
}

const post = <T>(path: string, body: unknown = {}) => call<T>(path, { method: "POST", body: JSON.stringify(body) });

export const multistreamApi = {
  status: () => call<MultistreamStatus>("/api/multistream"),
  preflight: () => call<{ findings: Finding[]; encoder: EncoderInfo }>("/api/multistream/preflight"),
  upsert: (d: { id?: string; name: string; platform: Platform; server: string; enabled: boolean; key?: string }) =>
    post<MultistreamStatus>("/api/multistream/destinations", d),
  remove: (id: string) => post<MultistreamStatus>("/api/multistream/destinations/delete", { id }),
  start: (id: string) => post<MultistreamStatus>("/api/multistream/destinations/start", { id }),
  stop: (id: string) => post<MultistreamStatus>("/api/multistream/destinations/stop", { id }),
  goLive: () =>
    post<MultistreamStatus & { started: string[]; blocked: { id: string; name: string; error?: string }[] }>(
      "/api/multistream/go-live"
    ),
  endAll: () => post<MultistreamStatus>("/api/multistream/session/stop", { confirm: true }),
  obsConnect: () => post<MultistreamStatus>("/api/multistream/obs/connect"),
  obsRestore: () => post<MultistreamStatus>("/api/multistream/obs/restore"),
  audit: (limit = 50) => call<{ items: AuditRow[] }>(`/api/audit?limit=${limit}`),
  /** Anahtarı gösterir — yalnız bu bilgisayardan; değer hiçbir duruma yazılmamalı (arayüz 20 sn sonra gizler) */
  reveal: (id: string) => post<{ key: string }>("/api/multistream/destinations/reveal", { id }),
  keyDelete: (id: string) => post<MultistreamStatus>("/api/multistream/destinations/key-delete", { id }),
  /** Yalnız TCP bağlantısı sınar; yayın göndermez */
  test: (id: string) => post<{ ok: boolean; ms: number; hata: string | null; sunucu: string; not: string }>("/api/multistream/destinations/test", { id }),
};
