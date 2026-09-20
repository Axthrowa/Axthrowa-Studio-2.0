/**
 * Ses paneli (soundboard) — AxthrowA
 * Canlı yayında kısayolla çalınan SFX listesi.
 * Dosyalar `assets/sfx` (yeni sunucu) veya `assets/music` içinde `sfx__` öneki (eski exe).
 * OBS: `/sfx?obs=1` tarayıcı kaynağı; panel çalınca cue ile orada da çalar.
 */

import { buildPlayCue, buildStopCue, decidePadTrigger } from "./sfxCue";
import { API_BASE, overlayUrl, patchSettings } from "./api";

export type SoundPad = {
  id: string;
  name: string;
  file: string;
  hotkey: string;
  volume: number;
};

const STORAGE_KEY = "panel.soundboard";
export const SFX_PREFIX = "sfx__";

export function newSoundId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `sfx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function loadSoundboard(): SoundPad[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && typeof x === "object" && x.file)
      .map((x) => ({
        id: String(x.id || newSoundId()),
        name: String(x.name || x.file || "Ses"),
        file: String(x.file),
        hotkey: String(x.hotkey || ""),
        volume: Math.min(100, Math.max(0, Number(x.volume) || 80)),
      }));
  } catch {
    return [];
  }
}

export function saveSoundboard(pads: SoundPad[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pads));
  } catch {
    /* */
  }
  // OBS chat/SFX pencereleri ayrı localStorage kullanır — sunucuya da yaz
  void patchSettings("panel", { soundboard: pads }).catch(() => {});
}

/** Panel + OBS ortak: önce localStorage, boşsa sunucu panel ayarı. */
export async function resolveSoundboard(): Promise<SoundPad[]> {
  const local = loadSoundboard();
  try {
    const res = await fetch(`${API_BASE}/api/settings?screen=panel`, { cache: "no-store" });
    if (!res.ok) return local;
    const data = await res.json();
    const remote = data?.soundboard;
    if (Array.isArray(remote) && remote.length) {
      const pads = remote
        .filter((x: unknown) => x && typeof x === "object" && (x as SoundPad).file)
        .map((x: SoundPad) => ({
          id: String(x.id || newSoundId()),
          name: String(x.name || x.file || "Ses"),
          file: String(x.file),
          hotkey: String(x.hotkey || ""),
          volume: Math.min(100, Math.max(0, Number(x.volume) || 80)),
        }));
      if (pads.length && !local.length) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(pads));
        } catch {
          /* */
        }
      }
      return pads.length ? pads : local;
    }
  } catch {
    /* */
  }
  return local;
}

/** Oynatma için olası URL adayları (eski/yeni sunucu uyumu).
 *  Eski exe `/assets/sfx/*` için SPA HTML (200) döner; müzik yolu önce denenir. */
export function sfxCandidateUrls(file: string): string[] {
  const name = encodeURIComponent(file);
  const urls = [
    `${API_BASE}/assets/music/${name}`,
    `${API_BASE}/assets/sfx/${name}`,
  ];
  if (!file.startsWith(SFX_PREFIX)) {
    urls.splice(1, 0, `${API_BASE}/assets/music/${encodeURIComponent(SFX_PREFIX + file)}`);
  }
  return [...new Set(urls)];
}

export function sfxUrl(file: string): string {
  return sfxCandidateUrls(file)[0];
}

const active = new Set<HTMLAudioElement>();

type QueueItem = {
  pad: SoundPad;
  onError?: (msg: string) => void;
  onStart?: () => void;
  relay: boolean;
};

const playQueue: QueueItem[] = [];
let queueBusy = false;
/** Şu an çalan ses paneli sesi (aynı tuşla durdurma için). */
let activePadId: string | null = null;
const lastTriggerAt = new Map<string, number>();

export function sfxOverlayUrl(base?: string): string {
  return overlayUrl(base || API_BASE, "sfx");
}

function isSfxOverlayRoute(): boolean {
  const p = (window.location.pathname || "").replace(/\/$/, "") || "/";
  return p === "/sfx";
}

/** OBS `/sfx` sayfasına çal / dur cue (panel ayarı üzerinden — eski exe uyumlu). */
export async function emitSfxCue(
  cue: { file: string; volume: number } | { stop: true }
): Promise<void> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  try {
    await patchSettings("panel", {
      // Tüm alanlar açıkça yazılır (bkz. sfxCue.ts): eski `stop:true` sonraki
      // çal komutuna yapışıyordu.
      _sfxCue:
        "stop" in cue && cue.stop
          ? buildStopCue(id, now)
          : buildPlayCue(id, (cue as { file: string }).file, (cue as { volume: number }).volume, now),
    });
  } catch {
    /* */
  }
}

export type PlaySoundOpts = {
  /** false: yalnızca bu pencerede çal (OBS sayfası). varsayılan: true → OBS'e de ilet */
  relay?: boolean;
};

function playOneNow(
  pad: SoundPad,
  onError?: (msg: string) => void,
  onStart?: () => void,
  onDone?: () => void
): HTMLAudioElement {
  const candidates = sfxCandidateUrls(pad.file);
  const a = new Audio();
  a.volume = Math.min(1, Math.max(0, (Number(pad.volume) || 80) / 100));
  let i = 0;
  let started = false;
  let generation = 0;
  let finished = false;

  const finish = (err?: string) => {
    if (finished) return;
    finished = true;
    active.delete(a);
    if (err) onError?.(err);
    onDone?.();
  };

  const tryNext = () => {
    if (i >= candidates.length) {
      finish("play failed");
      return;
    }
    const gen = ++generation;
    const url = candidates[i++];
    a.src = url;
    void a.play().then(() => {
      if (gen !== generation) return;
      if (!started) {
        started = true;
        onStart?.();
      }
    }).catch(() => {
      if (gen !== generation) return;
      tryNext();
    });
  };

  active.add(a);
  a.addEventListener("ended", () => finish());
  a.addEventListener("error", () => {
    if (!started) tryNext();
    else finish();
  });
  tryNext();
  return a;
}

function drainPlayQueue() {
  if (queueBusy) return;
  const next = playQueue.shift();
  if (!next) return;
  queueBusy = true;

  activePadId = next.pad.id;
  const start = () => {
    playOneNow(
      next.pad,
      (msg) => next.onError?.(msg),
      () => next.onStart?.(),
      () => {
        queueBusy = false;
        if (activePadId === next.pad.id) activePadId = null;
        drainPlayQueue();
      }
    );
  };

  if (next.relay) {
    void emitSfxCue({
      file: next.pad.file,
      volume: Number(next.pad.volume) || 80,
    }).then(() => {
      // OBS WebSocket cue’nun ulaşması için kısa gecikme
      window.setTimeout(start, 40);
    }).catch(() => start());
  } else {
    start();
  }
}

/**
 * Sesleri sıraya koyar — biri bitmeden diğeri başlamaz.
 * Aynı anda çalma yok; yeni istekler kuyruğa girer.
 */
export function playSoundPad(
  pad: SoundPad,
  onError?: (msg: string) => void,
  onStart?: () => void,
  opts?: PlaySoundOpts
): HTMLAudioElement | null {
  if (!pad.file) {
    onError?.("no file");
    return null;
  }
  const relay = opts?.relay !== false && !isSfxOverlayRoute();
  // OBS sayfası kendi kuyruğunu yönetir; aç/kapa ve tekrar koruması panel tarafında.
  if (!isSfxOverlayRoute()) {
    const now = Date.now();
    const decision = decidePadTrigger({
      padId: pad.id,
      activePadId,
      queuedPadIds: playQueue.map((q) => q.pad.id),
      lastTriggerAt: lastTriggerAt.get(pad.id),
      now,
    });
    lastTriggerAt.set(pad.id, now);
    if (decision === "ignore") return null;
    if (decision === "stop") {
      stopAllSounds(opts);
      return null;
    }
  }
  playQueue.push({ pad, onError, onStart, relay });
  drainPlayQueue();
  return null;
}

export function stopAllSounds(opts?: PlaySoundOpts) {
  const relay = opts?.relay !== false && !isSfxOverlayRoute();
  playQueue.length = 0;
  queueBusy = false;
  activePadId = null;
  if (relay) void emitSfxCue({ stop: true });
  for (const a of active) {
    try {
      a.pause();
      a.src = "";
    } catch {
      /* */
    }
  }
  active.clear();
}

let sfxApiOk: boolean | null = null;

/** Eski exe `/api/sfx` yokken SPA HTML (200) döner — sadece gerçek JSON API kabul. */
async function detectSfxApi(): Promise<boolean> {
  if (sfxApiOk != null) return sfxApiOk;
  try {
    const res = await fetch(`${API_BASE}/api/sfx`, { cache: "no-store" });
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (!res.ok || !ct.includes("json")) {
      sfxApiOk = false;
      return false;
    }
    const data = await res.json();
    sfxApiOk = Array.isArray(data) || Array.isArray(data?.files);
  } catch {
    sfxApiOk = false;
  }
  return !!sfxApiOk;
}

export async function fetchSfxFiles(): Promise<string[]> {
  if (await detectSfxApi()) {
    const res = await fetch(`${API_BASE}/api/sfx`, { cache: "no-store" });
    const data = await res.json();
    return Array.isArray(data) ? data : data?.files || [];
  }
  try {
    const res = await fetch(`${API_BASE}/api/music`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    const all: string[] = Array.isArray(data) ? data : data?.files || [];
    // Prefiksli SFX + soundboard'ta kayıtlı diğer müzik dosyaları
    const known = new Set(loadSoundboard().map((p) => p.file));
    return all.filter((n) => String(n).startsWith(SFX_PREFIX) || known.has(n));
  } catch {
    return [];
  }
}

export async function uploadSfxFile(file: File): Promise<string> {
  if (await detectSfxApi()) {
    const res = await fetch(`${API_BASE}/api/sfx`, {
      method: "POST",
      headers: {
        "Content-Type": file.type || "audio/mpeg",
        "x-filename": file.name,
      },
      body: file,
    });
    if (!res.ok) throw new Error("upload failed");
    const data = await res.json();
    return String(data.name || file.name);
  }
  const safe = `${SFX_PREFIX}${file.name.replace(/[/\\]/g, "_")}`;
  const res = await fetch(`${API_BASE}/api/music`, {
    method: "POST",
    headers: {
      "Content-Type": file.type || "audio/mpeg",
      "x-filename": safe,
    },
    body: file,
  });
  if (!res.ok) throw new Error("upload failed");
  const data = await res.json();
  return String(data.name || safe);
}

export async function deleteSfxFile(name: string): Promise<void> {
  const endpoint = (await detectSfxApi())
    ? `${API_BASE}/api/sfx/delete`
    : `${API_BASE}/api/music/delete`;
  await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}
