import OBSWebSocket from "obs-websocket-js";
import { isAudioInput } from "./obsAudio";
import { yayinBilerekDurduruluyor } from "./yayinSagligi";
import { useAxthrowaStore } from "../store/useAxthrowaStore";

export type ObsConnection = {
  host: string;
  port: number;
  password: string;
};

let obs: OBSWebSocket | null = null;
let connectedKey: string | null = null;

function cfgKey(cfg: ObsConnection) {
  return `${cfg.host}:${cfg.port}`;
}

/** `baglandi=false` ve `sebep` doluysa bağlantı beklenmedik şekilde koptu. */
export type ObsDurumDinleyici = (baglandi: boolean, sebep?: string) => void;

const durumDinleyiciler = new Set<ObsDurumDinleyici>();
let dinleyicilerBagli = false;
// `disconnect()` de "ConnectionClosed" üretiyor. Kullanıcı bağlantıyı kendisi
// kestiğinde uyarı çıkmaması için o olayı işaretliyoruz.
let kasitliKapanis = false;

function duyur(baglandi: boolean, sebep?: string) {
  for (const f of durumDinleyiciler) f(baglandi, sebep);
}

/**
 * Bağlantı durumu değişimlerini dinler.
 *
 * Panel eskiden `obsConnected` durumunu yalnızca kendi `connect` çağrısına
 * göre ayarlıyordu; OBS kapanınca bayrak `true` kalıyor, sahne kısayolları
 * sessizce çalışmıyordu.
 *
 * @returns Aboneliği bırakan işlev.
 */
export function onObsConnection(cb: ObsDurumDinleyici): () => void {
  durumDinleyiciler.add(cb);
  // Dinleyici, istemci daha kurulmadan da eklenebilsin.
  getObs();
  return () => durumDinleyiciler.delete(cb);
}

export function getObs() {
  if (!obs) obs = new OBSWebSocket();
  if (!dinleyicilerBagli) {
    dinleyicilerBagli = true;
    obs.on("Identified", () => {
      duyur(true);
      // Bağlanınca o anki sahne ve yayın durumu; sonrası olaylarla gelir
      void obs!.call("GetCurrentProgramScene").then((s) => useAxthrowaStore.setState({ currentScene: s.currentProgramSceneName })).catch(() => {});
      void obs!.call("GetStreamStatus").then((s) => useAxthrowaStore.setState({ isLive: s.outputActive })).catch(() => {});
    });
    obs.on("CurrentProgramSceneChanged", (e) => useAxthrowaStore.setState({ currentScene: e.sceneName }));
    obs.on("StreamStateChanged", (e) => useAxthrowaStore.setState({ isLive: e.outputActive }));
    obs.on("ConnectionClosed", (err: any) => {
      connectedKey = null;
      const kasitli = kasitliKapanis;
      kasitliKapanis = false;
      duyur(false, kasitli ? undefined : err?.message || "bağlantı kapandı");
    });
    obs.on("ConnectionError", (err: any) => {
      connectedKey = null;
      duyur(false, err?.message || "bağlantı hatası");
    });
  }
  return obs;
}

export function isObsConnected() {
  try {
    return !!(getObs() as any).identified;
  } catch {
    return false;
  }
}

export async function connectObs(cfg: ObsConnection, timeoutMs = 6000) {
  const client = getObs();
  const key = cfgKey(cfg);
  if ((client as any).identified && connectedKey === key) {
    return client;
  }
  if ((client as any).identified) {
    kasitliKapanis = true;
    try {
      await client.disconnect();
    } catch {
      /* */
    }
    connectedKey = null;
  }
  const url = `ws://${cfg.host}:${cfg.port}`;
  await Promise.race([
    client.connect(url, cfg.password || undefined),
    new Promise<never>((_, rej) =>
      setTimeout(
        () => rej(new Error(`OBS bağlantı zaman aşımı (${timeoutMs}ms)`)),
        timeoutMs
      )
    ),
  ]);
  connectedKey = key;
  return client;
}

export async function disconnectObs() {
  connectedKey = null;
  if (obs) {
    kasitliKapanis = true;
    try {
      await obs.disconnect();
    } catch {
      /* */
    }
  }
}

export async function listScenes() {
  const { scenes } = await getObs().call("GetSceneList");
  return (scenes as any[]).map((s) => s.sceneName as string);
}

export async function listTransitions() {
  const res = await getObs().call("GetSceneTransitionList");
  return ((res as any).transitions || []).map((t: any) => t.transitionName as string);
}

export async function listInputs() {
  const { inputs } = await getObs().call("GetInputList");
  return (inputs as any[]).map((i) => ({
    name: i.inputName as string,
    kind: i.inputKind as string,
  }));
}

export async function switchScene(opts: {
  sceneName: string;
  transition?: string;
  transitionMs?: number;
}) {
  const client = getObs();
  if (opts.transition) {
    await client.call("SetCurrentSceneTransition", {
      transitionName: opts.transition,
    });
  }
  if (opts.transitionMs != null) {
    await client.call("SetCurrentSceneTransitionDuration", {
      transitionDuration: opts.transitionMs,
    });
  }
  await client.call("SetCurrentProgramScene", { sceneName: opts.sceneName });
}

export async function setInputMute(inputName: string, muted: boolean) {
  await getObs().call("SetInputMute", { inputName, inputMuted: muted });
}

export async function getInputMute(inputName: string): Promise<boolean> {
  const res = await getObs().call("GetInputMute", { inputName });
  return !!(res as any).inputMuted;
}

/** Mikrofon (veya herhangi bir girdi) sessiz durumunu tersine çevirir. */
export async function toggleInputMute(inputName: string): Promise<boolean> {
  const res = await getObs().call("ToggleInputMute", { inputName });
  return !!(res as any).inputMuted;
}

/**
 * OBS ses kaynaklarını toplu aç/kapa.
 * En az biri açıksa hepsini susturur; hepsi sessizse hepsini açar.
 * @returns Yeni durum: `true` = susturuldu.
 */
export async function toggleAudioInputsMuted(
  opts?: { onlyNames?: string[]; excludeNames?: string[] }
): Promise<boolean> {
  const inputs = await listInputs();
  const only = new Set((opts?.onlyNames || []).filter(Boolean));
  const exclude = new Set((opts?.excludeNames || []).filter(Boolean));

  let anyUnmuted = false;
  const targets: string[] = [];
  for (const i of inputs) {
    if (exclude.has(i.name)) continue;
    const match = only.size
      ? only.has(i.name)
      : isAudioInput(i.kind, i.name);
    if (!match) continue;
    targets.push(i.name);
    try {
      if (!(await getInputMute(i.name))) anyUnmuted = true;
    } catch {
      /* */
    }
  }
  const muted = anyUnmuted;
  for (const name of targets) {
    try {
      await setInputMute(name, muted);
    } catch {
      /* */
    }
  }
  return muted;
}

export async function stopStream() {
  yayinBilerekDurduruluyor();
  const client = getObs();
  // Zaten kapalıysa hata fırlatmasın — tekrar denemelerde gürültü olmasın.
  try {
    const st = await client.call("GetStreamStatus");
    if (!(st as any)?.outputActive) return;
  } catch {
    /* durum okunamasa StopStream dene */
  }
  await client.call("StopStream");
}

export async function startStream() {
  const client = getObs();
  try {
    const st = await client.call("GetStreamStatus");
    if ((st as any)?.outputActive) return;
  } catch {
    /* durum okunamasa StartStream dene */
  }
  await client.call("StartStream");
}

export type StreamHealth = {
  active: boolean;
  reconnecting: boolean;
  durationMs: number;
  congestion: number;
  skippedFrames: number;
  totalFrames: number;
  dropPct: number;
};

export async function getStreamHealth(): Promise<StreamHealth> {
  const st = (await getObs().call("GetStreamStatus")) as {
    outputActive?: boolean;
    outputReconnecting?: boolean;
    outputDuration?: number;
    outputCongestion?: number;
    outputSkippedFrames?: number;
    outputTotalFrames?: number;
  };
  const total = Number(st.outputTotalFrames || 0);
  const skipped = Number(st.outputSkippedFrames || 0);
  return {
    active: !!st.outputActive,
    reconnecting: !!st.outputReconnecting,
    durationMs: Number(st.outputDuration || 0),
    congestion: Number(st.outputCongestion || 0),
    skippedFrames: skipped,
    totalFrames: total,
    dropPct: total > 0 ? (skipped / total) * 100 : 0,
  };
}

/**
 * Uygulamamızın overlay URL'lerini taşıyan OBS tarayıcı kaynaklarını yeniler.
 *
 * OBS kapatılıp açılınca CEF kaynakları çoğu zaman siyah kalıyor; elle
 * "Yenile" şart oluyor. WebSocket bağlanınca aynı işlemi otomatik yapıyoruz.
 */
export async function refreshOurBrowserSources(opts?: {
  /** örn. http://127.0.0.1:8843 */
  base?: string;
}): Promise<number> {
  const base = (opts?.base || "http://127.0.0.1:8843").replace(/\/$/, "");
  let portHint = "8843";
  try {
    const u = new URL(base);
    if (u.port) portHint = u.port;
  } catch {
    /* */
  }
  const oursRe = new RegExp(
    `(127\\.0\\.0\\.1|localhost):${portHint}|:${portHint}/|${portHint}/(starting|ending|brb|chat|sfx|resonance)`,
    "i"
  );

  const inputs = await listInputs();
  let n = 0;
  for (const i of inputs) {
    if (!/browser_source/i.test(i.kind)) continue;
    try {
      const res = await getObs().call("GetInputSettings", { inputName: i.name });
      const url = String((res as any)?.inputSettings?.url || "");
      if (!url || (!oursRe.test(url) && !url.startsWith(base))) continue;
      await getObs().call("PressInputPropertiesButton", {
        inputName: i.name,
        propertyName: "refreshnocache",
      });
      n += 1;
    } catch {
      /* kaynak mute/yenile desteklemiyor olabilir */
    }
  }
  return n;
}

/** OBS WebSocket kısa süreliğine hazır olmayabilir; birkaç kez dene. */
export async function stopStreamWithRetry(cfg: ObsConnection, tries = 3) {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      await connectObs(cfg, 5000);
      await Promise.race([
        stopStream(),
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error("StopStream zaman aşımı")), 5000)
        ),
      ]);
      return;
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  throw last instanceof Error ? last : new Error(String(last || "StopStream başarısız"));
}

