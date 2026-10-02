/**
 * OBS kısayol aksiyonları — kaynak görünürlüğü, kayıt, ses seviyesi, filtre,
 * OBS'in kendi kısayolları ve sahne gezme.
 *
 * Asıl çalıştırıcı Rust tarafında (`hotkeys.rs`): pencere tepsideyken de
 * çalışsın diye tuş orada yakalanıyor. Bu dosya iki iş yapar:
 *  1. **Tanımlar** — arayüzün kind seçicisi ve satır şeması.
 *  2. **Yedek çalıştırıcı** — Tauri olmayan ortamda (tarayıcıda açılan panel)
 *     aynı aksiyonları obs-websocket-js ile yapar.
 *
 * Saf yardımcılar (`nextVolumeDb`, `cycleIndex`, …) Rust'takilerle aynı
 * sözleşmeyi taşır; iki tarafın testleri birbirini doğrular.
 */

import { getObs } from "./obs";
import { actionParams, actionsApi } from "./api/actions";

export type ActionKind =
  | "srcToggle"
  | "volume"
  | "record"
  | "filter"
  | "sceneNext"
  | "scenePrev"
  | "obsHotkey"
  | "action";

export type RecordMode = "toggle" | "start" | "stop" | "pause";

/** Kaynak görünürlüğü: değiştir (ters) · göster · gizle. */
export type SourceMode = "toggle" | "show" | "hide";

export const SOURCE_MODES: { id: SourceMode; label: string }[] = [
  { id: "toggle", label: "Aç/kapat (tersle)" },
  { id: "show", label: "Göster" },
  { id: "hide", label: "Gizle" },
];

/** Kaynak görünürlüğünün yeni durumu (Rust `source_enabled_after` ile aynı sözleşme). */
export function sourceEnabledAfter(mode: unknown, currentlyEnabled: boolean): boolean {
  const m = String(mode ?? "").trim().toLowerCase();
  if (m === "show") return true;
  if (m === "hide") return false;
  return !currentlyEnabled;
}

/** `obs.actionHotkeys[]` satırı. */
export type ActionRow = {
  id: string;
  kind: ActionKind;
  hotkey?: string;
  label?: string;
  /** srcToggle: kaynağın bulunduğu sahne (boş = şu an yayındaki sahne) */
  scene?: string;
  /** srcToggle / filter: kaynak adı */
  source?: string;
  /** filter: filtre adı */
  filter?: string;
  /** engine.studio.quickTransition: adlandırılmış geçiş adı */
  transition?: string;
  /** volume: ses girişi */
  input?: string;
  /** volume: dB farkı */
  delta?: number;
  /** record: RecordMode · srcToggle: SourceMode */
  mode?: RecordMode | SourceMode | string;
  /** obsHotkey: OBS kısayol adı · action: eylem kayıt defteri kimliği */
  name?: string;
  /** action: çoklu yayın hedef kimliği */
  target?: string;
  /** action: onay isteyen eylem bu kısayolda onaysız çalışsın (kullanıcı açıkça işaretler) */
  confirmed?: boolean;
};

export const ACTION_KINDS: { id: ActionKind; label: string; hint: string }[] = [
  {
    id: "srcToggle",
    label: "Kaynağı aç/kapa",
    hint: "Sahnedeki bir kaynağı (kamera, görsel, yazı…) görünür/gizli yapar.",
  },
  { id: "volume", label: "Ses seviyesi", hint: "Bir ses girişini dB olarak artırır ya da azaltır." },
  { id: "record", label: "Kayıt", hint: "OBS kaydını başlatır, durdurur, duraklatır ya da tersler." },
  { id: "filter", label: "Filtre aç/kapa", hint: "Bir kaynağın filtresini (bulanıklık, chroma key…) açar/kapatır." },
  { id: "sceneNext", label: "Sonraki sahne", hint: "Sahne listesinde bir ileri gider, sondan başa sarar." },
  { id: "scenePrev", label: "Önceki sahne", hint: "Sahne listesinde bir geri gider, baştan sona sarar." },
  {
    id: "obsHotkey",
    label: "OBS kısayolu (ileri düzey)",
    hint: "OBS'teki herhangi bir kısayolu adıyla tetikler: tekrar arabelleği, sanal kamera, stüdyo modu…",
  },
  {
    id: "action",
    label: "Panel eylemi",
    hint: "Kontrol Merkezi'ndeki bir eylemi (çoklu yayın hedefi, yayın motoru, uyarılar…) tuşa bağlar. Kontrol Merkezi ile aynı yoldan çalışır ve denetim günlüğüne yazılır.",
  },
];

/* ------------------------------------------------------------ saf yardımcılar */

export const VOLUME_MIN_DB = -100;
export const VOLUME_MAX_DB = 26;

/** Mevcut seviyeye `delta` dB ekler; OBS'in kabul ettiği aralığa sıkıştırır. */
export function nextVolumeDb(currentDb: number, deltaDb: number): number {
  // OBS tam sessizken -inf bildirebiliyor; sonsuzla işlem yapmayalım.
  const cur = Number.isFinite(currentDb) ? currentDb : VOLUME_MIN_DB;
  const d = Number.isFinite(deltaDb) ? deltaDb : 0;
  return Math.min(VOLUME_MAX_DB, Math.max(VOLUME_MIN_DB, cur + d));
}

/** Sahne listesinde bir sonraki/önceki indeks; uçlarda sarar. Liste boşsa null. */
export function cycleIndex(len: number, current: number | null, forward: boolean): number | null {
  if (len <= 0) return null;
  if (current === null || current < 0) return forward ? 0 : len - 1;
  return forward ? (current + 1) % len : (current + len - 1) % len;
}

/** Bilinmeyen kayıt kipi güvenli varsayılana (toggle) düşer. */
export function normalizeRecordMode(raw: unknown): RecordMode {
  const v = String(raw ?? "").trim().toLowerCase();
  return v === "start" || v === "stop" || v === "pause" ? v : "toggle";
}

/** Bir aksiyon satırı çalışmak için gereken alanları taşıyor mu? Eksik alanı söyler. */
export function missingField(row: ActionRow): string | null {
  switch (row.kind) {
    case "srcToggle":
      return (row.source || "").trim() ? null : "kaynak";
    case "volume":
      return (row.input || "").trim() ? null : "ses girişi";
    case "filter":
      if (!(row.source || "").trim()) return "kaynak";
      return (row.filter || "").trim() ? null : "filtre";
    case "obsHotkey":
      return (row.name || "").trim() ? null : "OBS kısayol adı";
    case "action":
      return (row.name || "").trim() ? null : "eylem";
    default:
      return null;
  }
}

/** Kısayol satırının binding kimliği — Rust ve `hotkeyPlan` bununla eşleşir. */
export function actionBindingId(rowId: string): string {
  return `act:${rowId}`;
}

/* ------------------------------------------------------------ yedek çalıştırıcı */

/**
 * Aksiyonu obs-websocket-js ile çalıştırır. OBS bağlı olmalı.
 * @returns kullanıcıya gösterilecek kısa sonuç metni
 */
export async function runObsAction(row: ActionRow): Promise<string> {
  const eksik = missingField(row);
  if (eksik) throw new Error(`${eksik} seçilmemiş`);
  const obs = getObs();

  switch (row.kind) {
    case "srcToggle": {
      const source = String(row.source).trim();
      const scene =
        (row.scene || "").trim() ||
        ((await obs.call("GetCurrentProgramScene")) as { currentProgramSceneName: string })
          .currentProgramSceneName;
      const list = (await obs.call("GetSceneItemList", { sceneName: scene })) as {
        sceneItems: { sceneItemId: number; sourceName: string }[];
      };
      const item = list.sceneItems.find((i) => i.sourceName.toLowerCase() === source.toLowerCase());
      if (!item) throw new Error(`«${source}» «${scene}» sahnesinde yok`);
      const cur = (await obs.call("GetSceneItemEnabled", {
        sceneName: scene,
        sceneItemId: item.sceneItemId,
      })) as { sceneItemEnabled: boolean };
      const next = sourceEnabledAfter(row.mode, cur.sceneItemEnabled);
      await obs.call("SetSceneItemEnabled", {
        sceneName: scene,
        sceneItemId: item.sceneItemId,
        sceneItemEnabled: next,
      });
      return `${source} ${next ? "gösterildi" : "gizlendi"}`;
    }

    case "volume": {
      const input = String(row.input).trim();
      const cur = (await obs.call("GetInputVolume", { inputName: input })) as {
        inputVolumeDb: number;
      };
      const next = nextVolumeDb(cur.inputVolumeDb, Number(row.delta) || 0);
      await obs.call("SetInputVolume", { inputName: input, inputVolumeDb: next });
      return `${input}: ${next.toFixed(1)} dB`;
    }

    case "record": {
      const mode = normalizeRecordMode(row.mode);
      if (mode === "start") await obs.call("StartRecord");
      else if (mode === "stop") await obs.call("StopRecord");
      else if (mode === "pause") await obs.call("ToggleRecordPause");
      else await obs.call("ToggleRecord");
      return { toggle: "Kayıt tersine çevrildi", start: "Kayıt başladı", stop: "Kayıt durdu", pause: "Kayıt duraklatma değişti" }[mode];
    }

    case "filter": {
      const source = String(row.source).trim();
      const filter = String(row.filter).trim();
      const cur = (await obs.call("GetSourceFilter", {
        sourceName: source,
        filterName: filter,
      })) as { filterEnabled: boolean };
      await obs.call("SetSourceFilterEnabled", {
        sourceName: source,
        filterName: filter,
        filterEnabled: !cur.filterEnabled,
      });
      return `${filter} ${cur.filterEnabled ? "kapandı" : "açıldı"}`;
    }

    case "obsHotkey": {
      const context = String(row.source || "").trim();
      await obs.call("TriggerHotkeyByName", {
        hotkeyName: String(row.name).trim(),
        ...(context ? { contextName: context } : {}),
      });
      return `OBS kısayolu: ${row.name}${context ? ` · ${context}` : ""}`;
    }

    case "action": {
      await actionsApi.run(String(row.name).trim(), actionParams(row), !!row.confirmed);
      return "Eylem çalıştı";
    }

    case "sceneNext":
    case "scenePrev": {
      const list = (await obs.call("GetSceneList")) as unknown as {
        scenes: { sceneName: string }[];
        currentProgramSceneName: string;
      };
      const names = list.scenes.map((s) => s.sceneName);
      const idx = names.indexOf(list.currentProgramSceneName);
      const next = cycleIndex(names.length, idx >= 0 ? idx : null, row.kind === "sceneNext");
      if (next === null) throw new Error("OBS'te sahne yok");
      await obs.call("SetCurrentProgramScene", { sceneName: names[next] });
      return `Sahne: ${names[next]}`;
    }
  }
}

/* ------------------------------------------------ OBS'ten liste okuma */

/** Bir sahnedeki kaynak adları (boş sahne = şu an yayındaki). */
export async function listSceneItems(scene?: string): Promise<{ scene: string; items: string[] }> {
  const obs = getObs();
  const name =
    (scene || "").trim() ||
    ((await obs.call("GetCurrentProgramScene")) as { currentProgramSceneName: string }).currentProgramSceneName;
  const list = (await obs.call("GetSceneItemList", { sceneName: name })) as {
    sceneItems: { sourceName: string }[];
  };
  const items = [...new Set(list.sceneItems.map((i) => i.sourceName))];
  return { scene: name, items };
}

/** OBS'in tüm kısayol adları (aynı ad kaynak başına tekrarlanır). */
export async function listObsHotkeys(): Promise<string[]> {
  const res = (await getObs().call("GetHotkeyList")) as { hotkeys: string[] };
  return res.hotkeys || [];
}
