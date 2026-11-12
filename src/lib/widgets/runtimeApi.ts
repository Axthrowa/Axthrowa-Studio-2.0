/** Widget runtime HTTP istemcisi — poll / raffle / songs / donations. */

import { API_BASE } from "../api";

async function j<T = Record<string, unknown>>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || r.statusText);
  }
  return (await r.json()) as T;
}

export type PollRuntime = {
  active: boolean;
  question: string;
  options: string[];
  command: string;
  votes: Record<string, number>;
  voters?: string[];
};

export type RaffleRuntime = {
  active: boolean;
  joinCommand: string;
  durationSec: number;
  entrants: string[];
  winner: string | null;
  endsAt?: number | null;
};

export type SongItem = {
  id: string;
  title: string;
  by: string;
  videoId?: string | null;
  url?: string | null;
  requestedAt?: number;
};

export type SongsRuntime = {
  queue: SongItem[];
  current: SongItem | null;
  playing: boolean;
};

export const runtimeApi = {
  getPoll: () => j<PollRuntime>("/api/bot/runtime/poll"),
  startPoll: (body: { question: string; options: string[]; command?: string }) =>
    j<PollRuntime>("/api/bot/runtime/poll", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  stopPoll: () =>
    j<PollRuntime>("/api/bot/runtime/poll/stop", { method: "POST", body: "{}" }),

  getRaffle: () => j<RaffleRuntime>("/api/bot/runtime/raffle"),
  startRaffle: (body: { joinCommand?: string; durationSec?: number }) =>
    j<RaffleRuntime>("/api/bot/runtime/raffle", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  drawRaffle: () =>
    j<RaffleRuntime>("/api/bot/runtime/raffle/draw", {
      method: "POST",
      body: "{}",
    }),
  stopRaffle: () =>
    j<RaffleRuntime>("/api/bot/runtime/raffle/stop", {
      method: "POST",
      body: "{}",
    }),

  getSongs: () => j<SongsRuntime>("/api/bot/runtime/songs"),
  addSong: (body: { text?: string; by?: string; videoId?: string; title?: string }) =>
    j<SongsRuntime>("/api/bot/runtime/songs", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  skipSong: () =>
    j<SongsRuntime>("/api/bot/runtime/songs/skip", { method: "POST", body: "{}" }),
  playSong: () =>
    j<SongsRuntime>("/api/bot/runtime/songs/play", { method: "POST", body: "{}" }),
  pauseSong: () =>
    j<SongsRuntime>("/api/bot/runtime/songs/pause", { method: "POST", body: "{}" }),
  clearSongs: () =>
    j<SongsRuntime>("/api/bot/runtime/songs/clear", { method: "POST", body: "{}" }),
  reorderSongs: (order: string[]) =>
    j<SongsRuntime>("/api/bot/runtime/songs/reorder", {
      method: "POST",
      body: JSON.stringify({ order }),
    }),

  donationsWebhookUrl: () => `${API_BASE}/api/webhooks/donations`,
};
