import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fetch7tvGlobalEmotes, mergeEmoteDictionaries } from "./fetch7tv";
import { buildKickEmoteDictionary } from "./kickEmotes";
import type { EmoteDictionary, EmoteLookup } from "./types";
import { logger } from "../logger";

type EmoteContextValue = {
  ready: boolean;
  count: number;
  lookup: EmoteLookup;
};

const EmoteContext = createContext<EmoteContextValue | null>(null);

export function EmoteProvider({ children }: { children: ReactNode }) {
  const [dict, setDict] = useState<EmoteDictionary>(() => buildKickEmoteDictionary());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch7tvGlobalEmotes()
      .then((globals) => {
        if (cancelled) return;
        setDict((prev) => mergeEmoteDictionaries(prev, globals));
      })
      .catch((err) => {
        logger.warn("[EmoteEngine] 7TV yüklenemedi:", err);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const lookup = useCallback<EmoteLookup>(
    (token: string) => {
      const t = String(token || "").trim();
      if (!t) return undefined;
      return dict.get(t) ?? dict.get(t.toLowerCase());
    },
    [dict]
  );

  const value = useMemo(
    () => ({ ready, count: dict.size, lookup }),
    [ready, dict.size, lookup]
  );

  return <EmoteContext.Provider value={value}>{children}</EmoteContext.Provider>;
}

export function useEmotes(): EmoteContextValue {
  const ctx = useContext(EmoteContext);
  if (!ctx) {
    return {
      ready: false,
      count: 0,
      lookup: () => undefined,
    };
  }
  return ctx;
}
