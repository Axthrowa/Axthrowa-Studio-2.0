/**
 * Sayfa başına tek `/ws/overlay-sync` bağlantısı. Kancalar abone olur;
 * son abone ayrılınca soket kapanır. Yeniden bağlanma tek, üstel (2 sn → 30 sn).
 */
import { API_BASE } from "./api";

export type OverlaySyncSubscriber = {
  onMessage?: (ev: MessageEvent) => void;
  onOpen?: () => void;
  onClose?: () => void;
};

const MIN_RETRY_MS = 2_000;
const MAX_RETRY_MS = 30_000;

const subs = new Set<OverlaySyncSubscriber>();
let ws: WebSocket | null = null;
let retry: ReturnType<typeof setTimeout> | undefined;
let attempt = 0;

/** OBS Browser Source için loopback; aynı kökten (API_BASE "") sunulduysa sayfanın kendi portu. */
export function overlaySyncWsUrl(): string {
  const fromEnv = (import.meta as { env?: { VITE_WS_OVERLAY?: string } }).env?.VITE_WS_OVERLAY;
  if (fromEnv && fromEnv.startsWith("ws")) return fromEnv;
  if (!API_BASE && typeof location !== "undefined" && /^https?:$/.test(location.protocol)) {
    return `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/overlay-sync`;
  }
  const port = API_BASE.match(/:(\d+)/)?.[1] || "8843";
  return `ws://127.0.0.1:${port}/ws/overlay-sync`;
}

/** Sıradaki bekleme: 2, 4, 8, 16, 30, 30… sn (±%20 sapma, OBS kaynakları aynı anda vurmasın). */
export function overlaySyncRetryDelay(n: number): number {
  const raw = Math.min(MAX_RETRY_MS, MIN_RETRY_MS * 2 ** Math.min(n, 5));
  return Math.min(MAX_RETRY_MS, Math.round(raw * (0.8 + Math.random() * 0.4)));
}

function each(fn: (s: OverlaySyncSubscriber) => void) {
  // Abone içinde abonelik değişebilir — kopya üzerinde dolaş.
  for (const s of [...subs]) {
    try {
      fn(s);
    } catch {
      /* bir abonenin hatası diğerlerini durdurmasın */
    }
  }
}

function scheduleRetry() {
  if (!subs.size || retry) return;
  retry = setTimeout(() => {
    retry = undefined;
    connect();
  }, overlaySyncRetryDelay(attempt++));
}

function connect() {
  if (!subs.size || ws) return;
  let sock: WebSocket;
  try {
    sock = new WebSocket(overlaySyncWsUrl());
  } catch {
    scheduleRetry();
    return;
  }
  ws = sock;
  sock.onopen = () => {
    if (ws !== sock) return;
    attempt = 0;
    each((s) => s.onOpen?.());
  };
  sock.onmessage = (ev) => {
    if (ws === sock) each((s) => s.onMessage?.(ev));
  };
  sock.onerror = () => {
    try {
      sock.close();
    } catch {
      /* */
    }
  };
  sock.onclose = () => {
    if (ws !== sock) return;
    ws = null;
    each((s) => s.onClose?.());
    scheduleRetry();
  };
}

export function subscribeOverlaySync(sub: OverlaySyncSubscriber): () => void {
  subs.add(sub);
  if (ws?.readyState === WebSocket.OPEN) sub.onOpen?.();
  else if (!retry) connect();
  return () => {
    if (!subs.delete(sub) || subs.size) return;
    if (retry) clearTimeout(retry);
    retry = undefined;
    attempt = 0;
    const sock = ws;
    ws = null;
    try {
      sock?.close();
    } catch {
      /* */
    }
  };
}

export function overlaySyncOpen(): boolean {
  return ws?.readyState === WebSocket.OPEN;
}

export function sendOverlaySync(data: string): void {
  if (ws?.readyState === WebSocket.OPEN) ws.send(data);
}

/** Yarım açık bağlantı şüphesi: soketi kapat, ortak geri çekilme yeniden kursun. */
export function dropOverlaySync(): void {
  try {
    ws?.close();
  } catch {
    /* */
  }
}
