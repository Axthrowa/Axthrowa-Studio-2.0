/**
 * Overlay-sync üzerinden poll/raffle/sr/goal runtime olayları.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeOverlaySync } from "../overlaySyncHub";
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

    return subscribeOverlaySync({ onMessage: (e) => onMsg(String(e.data)) });
  }, []);

  return { poll, raffle, songs, lastWinner, goalBump, subscribe, setPoll, setRaffle, setSongs };
}
