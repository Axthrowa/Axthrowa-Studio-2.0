/**
 * Overlay-sync üzerinden poll/raffle/sr/goal runtime olayları.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { overlaySyncWsUrl } from "./useWidgetSync";
import type { PollRuntime, RaffleRuntime, SongsRuntime } from "./runtimeApi";

export type RuntimeMsg = {
  type: string;
  data?: unknown;
  winner?: string;
  amount?: number;
  [k: string]: unknown;
};

export function useRuntimeBus() {
  const [poll, setPoll] = useState<PollRuntime | null>(null);
  const [raffle, setRaffle] = useState<RaffleRuntime | null>(null);
  const [songs, setSongs] = useState<SongsRuntime | null>(null);
  const [lastWinner, setLastWinner] = useState<string | null>(null);
  const [goalBump, setGoalBump] = useState(0);
  const listeners = useRef(new Set<(m: RuntimeMsg) => void>());

  const subscribe = useCallback((fn: (m: RuntimeMsg) => void) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let retry: number | undefined;
    let closed = false;
    const url = overlaySyncWsUrl();

    const onMsg = (raw: string) => {
      try {
        const msg = JSON.parse(raw) as RuntimeMsg;
        const t = String(msg.type || "");
        if (t === "poll-state" && msg.data) setPoll(msg.data as PollRuntime);
        if (t === "raffle-state" && msg.data) setRaffle(msg.data as RaffleRuntime);
        if (t === "raffle-winner" && msg.winner) {
          setLastWinner(String(msg.winner));
        }
        if (t === "sr-queue" && msg.data) setSongs(msg.data as SongsRuntime);
        if (t === "goal-update" || t === "config_updated") {
          setGoalBump((n) => n + 1);
        }
        listeners.current.forEach((fn) => {
          try {
            fn(msg);
          } catch {
            /* */
          }
        });
      } catch {
        /* */
      }
    };

    const connect = () => {
      if (closed) return;
      try {
        ws = new WebSocket(url);
      } catch {
        retry = window.setTimeout(connect, 2200);
        return;
      }
      ws.onmessage = (e) => onMsg(String(e.data));
      ws.onclose = () => {
        if (!closed) retry = window.setTimeout(connect, 2200);
      };
    };
    connect();
    return () => {
      closed = true;
      if (retry) window.clearTimeout(retry);
      try {
        ws?.close();
      } catch {
        /* */
      }
    };
  }, []);

  return { poll, raffle, songs, lastWinner, goalBump, subscribe, setPoll, setRaffle, setSongs };
}
