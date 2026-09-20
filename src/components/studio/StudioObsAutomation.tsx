/**
 * Studio OBS otomasyonu — bağlantı, sahne listesi, sayaç → sahne,
 * BRB sahnesinde mikrofon mute.
 *
 * Mimari: Panel FE `obs-websocket-js` (zaten projede). Rust `obws` yalnızca
 * tepsi/hotkey arka planı için; UI sayaçları FE'de kalır.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchSettings, patchSettings, type OverlaySettings } from "../../lib/api";
import {
  getCurrentProgramScene,
  isObsConnected,
  listScenes,
  onObsConnection,
  onProgramSceneChanged,
  setInputMute,
  switchScene,
} from "../../lib/obs";
import { useObs } from "../../lib/obs/ObsContext";
import { Btn, Field, Header } from "../panel/botTabs/ui";

type Props = { onToast: (m: string) => void };

function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export default function StudioObsAutomation({ onToast }: Props) {
  const { connect: obsConnect, disconnect: obsDisconnect } = useObs();
  const [host, setHost] = useState("127.0.0.1");
  const [port, setPort] = useState(4455);
  const [password, setPassword] = useState("");
  const [connected, setConnected] = useState(false);
  const [scenes, setScenes] = useState<string[]>([]);
  const [sceneOnEnd, setSceneOnEnd] = useState("");
  const [brbScene, setBrbScene] = useState("");
  const [micInput, setMicInput] = useState("");
  const [timerMin, setTimerMin] = useState(5);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const [currentScene, setCurrentScene] = useState("");
  const [brbMuteEnabled, setBrbMuteEnabled] = useState(true);
  const endAt = useRef<number | null>(null);
  const fired = useRef(false);
  const settingsRef = useRef<OverlaySettings | null>(null);

  // Tam ayarı bayat bir kopyayla geri yazmak (`saveSettings`) `panel` içindeki
  // başkasının verisini (şablonlar, ses kartları, bot ayarı) siliyordu. Yalnız
  // değişen `obs` alanları yama olarak gönderilir.
  const persistObs = useCallback(async (patch: Record<string, unknown>) => {
    const cur = settingsRef.current || (await fetchSettings("panel"));
    settingsRef.current = { ...cur, obs: { ...((cur.obs as object) || {}), ...patch } } as OverlaySettings;
    await patchSettings("panel", { obs: patch });
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const s = await fetchSettings("panel");
        settingsRef.current = s;
        const obs = (s.obs || {}) as Record<string, unknown>;
        setHost(String(obs.host || "127.0.0.1"));
        setPort(Number(obs.port) || 4455);
        setPassword(String(obs.password || ""));
        setSceneOnEnd(String(obs.sceneOnEnd || (obs.sceneMap as any)?.game || ""));
        setBrbScene(String(obs.brbScene || (obs.sceneMap as any)?.brb || ""));
        setMicInput(String(obs.micInput || ""));
        setBrbMuteEnabled(obs.brbAutoMute !== false);
      } catch {
        /* */
      }
    })();
    return onObsConnection((ok) => setConnected(ok));
  }, []);

  const refreshScenes = useCallback(async () => {
    try {
      const list = await listScenes();
      setScenes(list);
      const cur = await getCurrentProgramScene();
      setCurrentScene(cur);
    } catch {
      setScenes([]);
    }
  }, []);

  const connect = async () => {
    try {
      await obsConnect({ host, port, password });
      await persistObs({ host, port, password });
      await refreshScenes();
      setConnected(true);
      onToast("OBS bağlandı");
    } catch (e) {
      setConnected(false);
      onToast(String((e as Error).message || "OBS bağlantısı başarısız"));
    }
  };

  // BRB → mute / diğer → unmute
  useEffect(() => {
    if (!connected || !brbMuteEnabled) return;
    return onProgramSceneChanged((sceneName) => {
      setCurrentScene(sceneName);
      const brb = brbScene.trim();
      const mic = micInput.trim();
      if (!brb || !mic) return;
      const isBrb = sceneName === brb || sceneName.toLowerCase().includes("brb") || sceneName.toLowerCase().includes("mola");
      void setInputMute(mic, isBrb)
        .then(() => {
          if (isBrb) onToast(`BRB · mikrofon susturuldu (${mic})`);
          else onToast(`Mikrofon açıldı (${mic})`);
        })
        .catch(() => undefined);
    });
  }, [connected, brbMuteEnabled, brbScene, micInput, onToast]);

  // Mağaza `!buy` → OBS sahne (overlay-sync)
  useEffect(() => {
    let ws: WebSocket | null = null;
    let retry = 0;
    let timer: number | undefined;
    let cancelled = false;

    const handleScene = (scene: string) => {
      const name = scene.trim();
      if (!name || !isObsConnected()) return;
      void switchScene({ sceneName: name })
        .then(() => onToast(`Mağaza → OBS sahne: ${name}`))
        .catch((e) =>
          onToast(String((e as Error).message || "Mağaza sahne geçilemedi"))
        );
    };

    const connectWs = () => {
      if (cancelled) return;
      try {
        const base =
          (import.meta as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE ||
          "http://127.0.0.1:8843";
        ws = new WebSocket(`${base.replace(/^http/, "ws")}/ws/overlay-sync`);
      } catch {
        schedule();
        return;
      }
      ws.onopen = () => {
        retry = 0;
      };
      ws.onclose = () => schedule();
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data));
          if (msg?.type === "shop-obs-scene" && msg.scene) {
            handleScene(String(msg.scene));
            return;
          }
          if (msg?.type === "settings" && msg.screen === "panel") {
            const s = msg.data?._shopObsScene?.scene;
            if (s) handleScene(String(s));
          }
        } catch {
          /* */
        }
      };
    };

    const schedule = () => {
      if (cancelled) return;
      const delay = Math.min(12_000, 800 * 2 ** Math.min(retry, 4));
      retry += 1;
      timer = window.setTimeout(connectWs, delay);
    };

    connectWs();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      try {
        ws?.close();
      } catch {
        /* */
      }
    };
  }, [onToast]);

  // Sayaç tick
  useEffect(() => {
    if (!running || !endAt.current) return;
    const id = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((endAt.current! - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0 && !fired.current) {
        fired.current = true;
        setRunning(false);
        const target = sceneOnEnd.trim();
        if (target && isObsConnected()) {
          void switchScene({ sceneName: target })
            .then(() => onToast(`Süre bitti → ${target}`))
            .catch((e) => onToast(String((e as Error).message || "Sahne geçilemedi")));
        } else {
          onToast("Süre bitti");
        }
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [running, sceneOnEnd, onToast]);

  const startTimer = () => {
    const sec = Math.max(1, Math.round(timerMin * 60));
    endAt.current = Date.now() + sec * 1000;
    fired.current = false;
    setRemaining(sec);
    setRunning(true);
    onToast(`Sayaç başladı · ${fmt(sec)}`);
  };

  const stopTimer = () => {
    setRunning(false);
    endAt.current = null;
    fired.current = true;
    onToast("Sayaç durdu");
  };

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <Header
        title="OBS Otomasyon"
        sub="WebSocket · sayaç bitince sahne · BRB’de mikrofon mute"
      />

      <div className="yya-card space-y-3">
        <p className="text-xs font-medium text-white">Bağlantı</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Host" value={host} onChange={setHost} />
          <Field
            label="Port"
            type="number"
            value={String(port)}
            onChange={(v) => setPort(Number(v) || 4455)}
          />
          <Field
            label="Şifre"
            type="password"
            value={password}
            onChange={setPassword}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Btn onClick={() => void connect()}>Bağlan</Btn>
          <Btn
            tone="ghost"
            onClick={() =>
              void obsDisconnect().then(() => {
                setConnected(false);
                onToast("OBS bağlantısı kesildi");
              })
            }
          >
            Kopar
          </Btn>
          <Btn tone="ghost" disabled={!connected} onClick={() => void refreshScenes()}>
            Sahneleri yenile
          </Btn>
          <span
            className={
              "rounded-lg px-2 py-1 text-[11px] " +
              (connected ? "bg-panel-soft text-panel-accent" : "bg-white/5 text-panel-muted")
            }
          >
            {connected ? `Bağlı${currentScene ? ` · ${currentScene}` : ""}` : "Kapalı"}
          </span>
        </div>
      </div>

      <div className="yya-card space-y-3">
        <p className="text-xs font-medium text-white">Giriş / mola sayacı</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Süre (dakika)"
            type="number"
            value={String(timerMin)}
            onChange={(v) => setTimerMin(Math.max(0.1, Number(v) || 1))}
          />
          <label className="block text-xs text-panel-muted">
            <span className="mb-1.5 block">Süre bitince şu sahneye geç</span>
            <select
              className="yya-input"
              value={sceneOnEnd}
              onChange={(e) => {
                setSceneOnEnd(e.target.value);
                void persistObs({
                  sceneOnEnd: e.target.value,
                  sceneMap: {
                    ...(((settingsRef.current?.obs as any)?.sceneMap as object) || {}),
                    game: e.target.value,
                  },
                });
              }}
            >
              <option value="">— seç —</option>
              {scenes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {!scenes.length ? (
              <span className="mt-1 block text-[10px] text-panel-muted">
                Liste için önce Bağlan
              </span>
            ) : null}
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="font-display text-4xl font-semibold tracking-tight text-panel-accent tabular-nums">
            {fmt(running ? remaining : Math.round(timerMin * 60))}
          </div>
          <div className="flex gap-2">
            {!running ? (
              <Btn onClick={startTimer}>Başlat</Btn>
            ) : (
              <Btn tone="danger" onClick={stopTimer}>
                Durdur
              </Btn>
            )}
          </div>
        </div>
      </div>

      <div className="yya-card space-y-3">
        <p className="text-xs font-medium text-white">BRB mikrofon otomasyonu</p>
        <p className="text-[11px] text-panel-muted">
          Program sahnesi BRB/Mola olduğunda mikrofon susturulur; başka sahneye
          geçince açılır.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-panel-muted">
            <span className="mb-1.5 block">BRB sahnesi</span>
            <select
              className="yya-input"
              value={brbScene}
              onChange={(e) => {
                setBrbScene(e.target.value);
                void persistObs({
                  brbScene: e.target.value,
                  sceneMap: {
                    ...(((settingsRef.current?.obs as any)?.sceneMap as object) || {}),
                    brb: e.target.value,
                  },
                });
              }}
            >
              <option value="">— seç —</option>
              {scenes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Mikrofon girdi adı (OBS)"
            value={micInput}
            onChange={(v) => {
              setMicInput(v);
              void persistObs({ micInput: v });
            }}
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-panel-muted">
          <input
            type="checkbox"
            checked={brbMuteEnabled}
            onChange={(e) => {
              setBrbMuteEnabled(e.target.checked);
              void persistObs({ brbAutoMute: e.target.checked });
            }}
          />
          BRB’de otomatik mute açık
        </label>
      </div>

      <div className="rounded-xl border border-panel-border/70 bg-panel-elevated/40 px-3 py-2 text-[11px] text-panel-muted">
        Overlay URL’ler:{" "}
        <code className="text-panel-accent/90">/overlay/alerts?obs=1</code> ·{" "}
        <code className="text-panel-accent/90">/overlay/widgets/chat?obs=1</code>
      </div>
    </section>
  );
}
