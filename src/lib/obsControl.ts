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
};

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
        sceneItems?: { sourceName: string; sourceType?: string; sceneItemEnabled?: boolean }[];
      };
      const items = res.sceneItems || [];
      return items.map((item) => ({
        name: item.sourceName,
        kind: item.sourceType || "",
        visible: item.sceneItemEnabled !== false,
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
  /** Sahnenin anlık karesi (data URL) */
  screenshot: async (sceneName: string, width: number): Promise<string> => {
    try {
      return await tryInvoke<string>("obs_screenshot", { sceneName, width });
    } catch {
      const r = (await getObs().call("GetSourceScreenshot", { sourceName: sceneName, imageFormat: "jpg", imageWidth: width, imageCompressionQuality: 60 })) as { imageData: string };
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
  stopStreamSequence: async () => {
    try {
      return await tryInvoke<ObsSceneSnapshot>("obs_stop_stream_sequence");
    } catch {
      await stopStream();
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
