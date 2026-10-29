/**
 * Merkezi OBS WebSocket durumu — tüm panel / bot / otomasyon aynı bağlantıyı kullanır.
 * `obs.ts` singleton istemcisinin React yüzü.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { getBotConfig } from "../smartBot";
import {
  connectObs,
  disconnectObs,
  isObsConnected,
  onObsConnection,
  switchScene,
  type ObsConnection,
} from "../obs";
import { useAxthrowaStore } from "../../store/useAxthrowaStore";
import { API_BASE, isObsMode } from "../api";
import { logger } from "../logger";
import { sendTwitchPrivmsg } from "../platformAuth/twitchWrite";

type ObsCtx = {
  connected: boolean;
  connecting: boolean;
  lastError: string | null;
  connect: (cfg?: Partial<ObsConnection>) => Promise<void>;
  disconnect: () => Promise<void>;
  goScene: (sceneName: string) => Promise<void>;
};

const Ctx = createContext<ObsCtx | null>(null);

const setConnected = (isObsConnected: boolean) => useAxthrowaStore.setState({ isObsConnected });
const setConnecting = (obsConnecting: boolean) => useAxthrowaStore.setState({ obsConnecting });
const setLastError = (obsLastError: string | null) => useAxthrowaStore.setState({ obsLastError });

function defaultCfg(): ObsConnection {
  return { host: "127.0.0.1", port: 4455, password: "" };
}

/** Panel ayarlarındaki OBS bloğunu HTTP üzerinden oku (yoksa varsayılan). */
async function loadObsCfgFromServer(): Promise<ObsConnection> {
  try {
    const r = await fetch(`${API_BASE}/api/settings`, { cache: "no-store" });
    if (!r.ok) return defaultCfg();
    const j = await r.json();
    const screens = [j?.panel, j?.starting, j?.brb];
    for (const screen of screens) {
      const obs = ((screen || {}) as Record<string, unknown>).obs as
        | Record<string, unknown>
        | undefined;
      if (!obs) continue;
      const host = String(obs.host || "").trim();
      if (host || obs.password != null) {
        return {
          host: host || "127.0.0.1",
          port: Number(obs.port) || 4455,
          password: String(obs.password || ""),
        };
      }
    }
    return defaultCfg();
  } catch {
    return defaultCfg();
  }
}

export function ObsProvider({ children }: { children: ReactNode }) {
  const connected = useAxthrowaStore((s) => s.isObsConnected);
  const connecting = useAxthrowaStore((s) => s.obsConnecting);
  const lastError = useAxthrowaStore((s) => s.obsLastError);
  const cfgRef = useRef<ObsConnection>(defaultCfg());

  useEffect(() => {
    return onObsConnection((ok, reason) => {
      setConnected(ok);
      if (!ok && reason) setLastError(reason);
      if (ok) setLastError(null);
    });
  }, []);

  const connect = useCallback(async (partial?: Partial<ObsConnection>) => {
    setConnecting(true);
    setLastError(null);
    try {
      const base = await loadObsCfgFromServer();
      const cfg = { ...base, ...partial };
      cfgRef.current = cfg;
      await connectObs(cfg, 6000);
      setConnected(true);
    } catch (e) {
      setConnected(false);
      setLastError(String((e as Error).message || e));
      throw e;
    } finally {
      setConnecting(false);
    }
  }, []);

  // Açılışta otomatik bağlan: kaydedilmiş bir OBS yapılandırması varsa
  // kullanıcının her seferinde "Bağlan"a basması gerekmesin. Yalnız panelde
  // çalışır — OBS tarayıcı kaynakları da denerse aynı OBS'e onlarca bağlantı
  // açılırdı. Başarısız olursa artan aralıklarla birkaç kez dener, sonra susar;
  // OBS henüz açılmamış olabilir.
  useEffect(() => {
    if (isObsMode()) return undefined;
    let iptal = false;
    let zaman: number | undefined;
    const gecikmeler = [0, 4000, 10000, 20000, 40000];

    const dene = async (sira: number) => {
      if (iptal || sira >= gecikmeler.length) return;
      if (isObsConnected()) return;
      try {
        const cfg = await loadObsCfgFromServer();
        // Hiç ayar yapılmamışsa boşuna deneme.
        if (!cfg.host || (!cfg.password && cfg.host === "127.0.0.1" && !cfg.port)) return;
        await connectObs(cfg, 6000);
        if (!iptal) {
          cfgRef.current = cfg;
          setConnected(true);
        }
      } catch {
        // Sessiz: OBS kapalıyken açılışta kırmızı uyarı basmak gürültü olurdu.
        if (!iptal) zaman = window.setTimeout(() => void dene(sira + 1), gecikmeler[sira + 1] ?? 0);
      }
    };

    zaman = window.setTimeout(() => void dene(0), 1200);
    return () => {
      iptal = true;
      window.clearTimeout(zaman);
    };
  }, []);

  const disconnect = useCallback(async () => {
    await disconnectObs();
    setConnected(false);
  }, []);

  const goScene = useCallback(async (sceneName: string) => {
    if (!sceneName.trim()) return;
    if (!isObsConnected()) {
      await connect();
    }
    await switchScene({ sceneName });
  }, [connect]);

  // Bot → Twitch cevap + shop OBS sahne (tek WS dinleyici)
  useEffect(() => {
    let ws: WebSocket | null = null;
    let retry: number | undefined;
    let closed = false;
    const port = (API_BASE.match(/:(\d+)/) || [])[1] || "8843";
    const url = `ws://127.0.0.1:${port}/ws/overlay-sync`;

    const onMsg = async (raw: string) => {
      try {
        const msg = JSON.parse(raw) as Record<string, unknown>;
        if (msg.type === "bot-reply-request" && msg.platform === "twitch") {
          const text = String(msg.text || "").trim();
          if (text) {
            try {
              const cfg = getBotConfig();
              const channel =
                (cfg as { twitchChannel?: string }).twitchChannel ||
                cfg.channelName ||
                "";
              if (channel) await sendTwitchPrivmsg(channel, text);
            } catch (e) {
              logger.warn("[ObsProvider] Twitch reply:", e);
            }
          }
          return;
        }
        if (msg.type === "shop-obs-scene" || msg.type === "remote-obs-scene") {
          const scene = String(msg.scene || "").trim();
          if (scene) {
            try {
              await goScene(scene);
            } catch (e) {
              logger.warn("[ObsProvider] scene:", e);
            }
          }
        }
        if (msg.type === "auth_success") {
          window.dispatchEvent(
            new CustomEvent("yya-auth-success", { detail: msg })
          );
        }
      } catch {
        /* */
      }
    };

    const connectWs = () => {
      if (closed) return;
      try {
        ws = new WebSocket(url);
      } catch {
        retry = window.setTimeout(connectWs, 2500);
        return;
      }
      ws.onmessage = (e) => void onMsg(String(e.data));
      ws.onclose = () => {
        if (!closed) retry = window.setTimeout(connectWs, 2500);
      };
    };
    connectWs();
    return () => {
      closed = true;
      if (retry) window.clearTimeout(retry);
      try {
        ws?.close();
      } catch {
        /* */
      }
    };
  }, [goScene]);

  const value = useMemo(
    () => ({ connected, connecting, lastError, connect, disconnect, goScene }),
    [connected, connecting, lastError, connect, disconnect, goScene]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useObs(): ObsCtx {
  const v = useContext(Ctx);
  if (!v) {
    // Provider dışında: güvenli no-op (overlay rotaları)
    return {
      connected: isObsConnected(),
      connecting: false,
      lastError: null,
      connect: async (cfg) => {
        await connectObs({ ...defaultCfg(), ...cfg });
      },
      disconnect: disconnectObs,
      goScene: async (sceneName) => {
        await switchScene({ sceneName });
      },
    };
  }
  return v;
}
