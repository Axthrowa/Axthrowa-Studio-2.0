import { invoke } from "@tauri-apps/api/core";
import {
  connectObs,
  disconnectObs,
  getInputMute,
  getObs,
  isObsConnected,
  listInputs,
  setInputMute,
  startStream,
  stopStream,
  switchScene,
} from "./obs";

export type ObsConnectionStatus = {
  connected: boolean;
  connecting: boolean;
  host: string;
  port: number;
  lastError?: string | null;
};

export type ObsSceneSnapshot = {
  scenes: string[];
  currentScene: string;
  streaming: boolean;
};

export type ObsSourceInfo = {
  name: string;
  kind: string;
  visible: boolean;
  /** OBS'te kilitli (yerinden oynatılamaz) */
  locked?: boolean;
};

/** Katman öğesi sağ tık işlemleri (A7) */
export type KatmanIslemi = "duplicate" | "lock" | "unlock" | "front" | "back" | "remove" | "url";

export type ObsInputInfo = {
  name: string;
  kind: string;
  muted: boolean;
};

async function tryInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return invoke<T>(cmd, args);
}

async function sceneSnapshotJs(): Promise<ObsSceneSnapshot> {
  const client = getObs();
  const list = (await client.call("GetSceneList")) as unknown as {
    scenes?: { sceneName: string }[];
    currentProgramSceneName?: string;
  };
  const scenes = (list.scenes || []).map((s) => s.sceneName);
  let streaming = false;
  try {
    const st = (await client.call("GetStreamStatus")) as unknown as { outputActive?: boolean };
    streaming = !!st.outputActive;
  } catch {
    /* */
  }
  return {
    scenes,
    currentScene: String(list.currentProgramSceneName || ""),
    streaming,
  };
}

export type IzlemeTuru = "none" | "monitorOnly" | "monitorAndOutput";
const OBS_IZLEME: Record<IzlemeTuru, string> = {
  none: "OBS_MONITORING_TYPE_NONE",
  monitorOnly: "OBS_MONITORING_TYPE_MONITOR_ONLY",
  monitorAndOutput: "OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT",
};

export const obsControl = {
  connect: async (host: string, port: number, password: string) => {
    try {
      return await tryInvoke<ObsConnectionStatus>("connect_obs", { host, port, password });
    } catch {
      await connectObs({ host, port, password });
      return {
        connected: true,
        connecting: false,
        host,
        port,
        lastError: null,
      } satisfies ObsConnectionStatus;
    }
  },
  status: async () => {
    try {
      return await tryInvoke<ObsConnectionStatus>("obs_get_status");
    } catch {
      return {
        connected: isObsConnected(),
        connecting: false,
        host: "127.0.0.1",
        port: 4455,
      } satisfies ObsConnectionStatus;
    }
  },
  disconnect: async () => {
    try {
      return await tryInvoke<ObsConnectionStatus>("obs_disconnect");
    } catch {
      await disconnectObs();
      return {
        connected: false,
        connecting: false,
        host: "127.0.0.1",
        port: 4455,
      } satisfies ObsConnectionStatus;
    }
  },
  scenes: async () => {
    try {
      return await tryInvoke<ObsSceneSnapshot>("obs_get_scenes");
    } catch {
      return sceneSnapshotJs();
    }
  },
  setScene: async (sceneName: string) => {
    try {
      await tryInvoke<void>("obs_set_scene", { sceneName });
    } catch {
      await switchScene({ sceneName });
    }
  },
  sources: async (sceneName: string) => {
    try {
      return await tryInvoke<ObsSourceInfo[]>("obs_get_sources", { sceneName });
    } catch {
      const client = getObs();
      const res = (await client.call("GetSceneItemList", { sceneName })) as unknown as {
        sceneItems?: { sourceName: string; sourceType?: string; sceneItemEnabled?: boolean; sceneItemLocked?: boolean }[];
      };
      const items = res.sceneItems || [];
      return items.map((item) => ({
        name: item.sourceName,
        kind: item.sourceType || "",
        visible: item.sceneItemEnabled !== false,
        locked: item.sceneItemLocked === true,
      }));
    }
  },
  setSourceVisible: async (sceneName: string, sourceName: string, visible: boolean) => {
    try {
      await tryInvoke<void>("obs_toggle_source", { sceneName, sourceName, visible });
    } catch {
      const client = getObs();
      const res = (await client.call("GetSceneItemList", { sceneName })) as unknown as {
        sceneItems?: { sourceName: string; sceneItemId: number }[];
      };
      const items = res.sceneItems || [];
      const hit = items.find((item) => item.sourceName === sourceName);
      if (!hit) throw new Error("Kaynak bulunamadı");
      await client.call("SetSceneItemEnabled", {
        sceneName,
        sceneItemId: hit.sceneItemId,
        sceneItemEnabled: visible,
      });
    }
  },
  inputs: async () => {
    try {
      return await tryInvoke<ObsInputInfo[]>("obs_get_inputs");
    } catch {
      const list = await listInputs();
      const out: ObsInputInfo[] = [];
      for (const item of list) {
        let muted = false;
        try {
          muted = await getInputMute(item.name);
        } catch {
          /* */
        }
        out.push({ name: item.name, kind: item.kind, muted });
      }
      return out;
    }
  },
  setMuted: async (inputName: string, muted: boolean) => {
    try {
      await tryInvoke<void>("obs_toggle_mute", { inputName, muted });
    } catch {
      await setInputMute(inputName, muted);
    }
  },
  volumeDb: async (inputName: string): Promise<number> => {
    try {
      return await tryInvoke<number>("obs_get_volume", { inputName });
    } catch {
      const r = (await getObs().call("GetInputVolume", { inputName })) as { inputVolumeDb: number };
      return r.inputVolumeDb;
    }
  },
  setVolumeDb: async (inputName: string, db: number) => {
    try {
      await tryInvoke<void>("obs_set_volume", { inputName, db });
    } catch {
      await getObs().call("SetInputVolume", { inputName, inputVolumeDb: db });
    }
  },
  /** `url` tarayıcı kaynağının adresini döndürür */
  sceneItemOp: async (sceneName: string, sourceName: string, op: KatmanIslemi): Promise<string | null> => {
    try {
      return await tryInvoke<string | null>("obs_scene_item_op", { sceneName, sourceName, op });
    } catch (e) {
      // Rust komutu yoksa (tarayıcıda geliştirme) yalnız adres okuma JS istemcisiyle yapılır
      if (op !== "url") throw e;
      const r = (await getObs().call("GetInputSettings", { inputName: sourceName })) as { inputSettings?: { url?: string } };
      if (!r.inputSettings?.url) throw new Error("Bu kaynağın adresi yok (tarayıcı kaynağı değil)");
      return r.inputSettings.url;
    }
  },
  monitorType: async (inputName: string): Promise<IzlemeTuru> => {
    try {
      return await tryInvoke<IzlemeTuru>("obs_get_monitor_type", { inputName });
    } catch {
      const r = (await getObs().call("GetInputAudioMonitorType", { inputName })) as { monitorType: string };
      return (Object.keys(OBS_IZLEME) as IzlemeTuru[]).find((k) => OBS_IZLEME[k] === r.monitorType) || "none";
    }
  },
  setMonitorType: async (inputName: string, tur: IzlemeTuru) => {
    try {
      await tryInvoke<void>("obs_set_monitor_type", { inputName, tur });
    } catch {
      await getObs().call("SetInputAudioMonitorType", { inputName, monitorType: OBS_IZLEME[tur] } as never);
    }
  },
  /** OBS'in kendi filtre penceresi (OBS'in çalıştığı makinede açılır) */
  openFilters: async (inputName: string) => {
    try {
      await tryInvoke<void>("obs_open_filters", { inputName });
    } catch {
      await getObs().call("OpenInputFiltersDialog", { inputName });
    }
  },
  /** Sahnenin anlık karesi (data URL) */
  screenshot: async (sceneName: string, width: number): Promise<string> => {
    try {
      return await tryInvoke<string>("obs_screenshot", { sceneName, width });
    } catch {
      const r = (await getObs().call("GetSourceScreenshot", { sourceName: sceneName, imageFormat: "jpg", imageWidth: width, imageCompressionQuality: 85 })) as { imageData: string };
      return r.imageData;
    }
  },
  startStreamSequence: async () => {
    try {
      return await tryInvoke<ObsSceneSnapshot>("obs_start_stream_sequence");
    } catch {
      await startStream();
      return sceneSnapshotJs();
    }
  },
  /**
   * Yayını bitirme: önce çıkış sahnesine geçilir, yayın çıkış ekranının süresi dolunca kapanır.
   * Yerel (Rust) dizi başarısız olursa eskiden burada yayın HEMEN kapatılıyor, çıkış ekranı hiç gösterilmiyordu.
   * Artık yalnız çıkış sahnesine geçilir; kapatmayı çıkış ekranının sayacı (`endingEnd`) yapar.
   */
  stopStreamSequence: async (cikisSahnesi = "") => {
    try {
      return await tryInvoke<ObsSceneSnapshot>("obs_stop_stream_sequence");
    } catch {
      if (cikisSahnesi) await switchScene({ sceneName: cikisSahnesi });
      return sceneSnapshotJs();
    }
  },
  toggleStream: async () => {
    try {
      return await tryInvoke<boolean>("obs_toggle_stream");
    } catch {
      const snap = await sceneSnapshotJs();
      if (snap.streaming) await stopStream();
      else await startStream();
      return !snap.streaming;
    }
  },
};
