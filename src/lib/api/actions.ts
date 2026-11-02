/**
 * Eylem kayıt defteri istemcisi (`/api/actions`). Kontrol Merkezi'ndeki her denetim buradan geçer: sunucu izni,
 * onayı ve denetim günlüğünü tek yerde uygular (ileride Stream Deck / uzak arayüz aynı eylemleri kullanır).
 */
import { API_BASE } from "../api";
import { olay } from "../analitik";

export type ActionParamKind =
  "scene" | "optionalScene" | "input" | "source" | "destination" | "db" | "filter" | "transition" | "text";

export type ActionInfo = {
  id: string;
  label: string;
  category: string;
  perm: string;
  confirm: boolean;
  requires: "obs" | "multistream" | "streamAxt";
  params: { name: string; kind: ActionParamKind }[];
  available: boolean;
  reason: string | null;
};

export class ActionError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const text = await r.text();
  if (!r.ok) throw new ActionError(text || `HTTP ${r.status}`, r.status);
  return (text ? JSON.parse(text) : {}) as T;
}

export const actionsApi = {
  list: () => call<{ actions: ActionInfo[]; local: boolean }>("/api/actions").then((r) => r.actions),
  run: (id: string, params: Record<string, string | number> = {}, confirm = false) => {
    // Eylem kimliği ürün verisi (ör. scene.switch); parametreler (sahne/kaynak adı) gönderilmez
    olay("eylem_calisti", { eylem: id });
    return call<{ ok: boolean; id: string; result: unknown }>("/api/actions/run", {
      method: "POST",
      body: JSON.stringify({ id, params, confirm }),
    });
  },
};

/** Hızlı eylem panelinde gösterilecekler: parametresiz eylemler, kategoriye göre sıralı. */
export const QUICK_CATEGORIES = ["alerts", "replay", "recording", "stream", "outputs", "engine"] as const;

export function quickActions(list: ActionInfo[]): ActionInfo[] {
  const sira = (c: string) => {
    const i = (QUICK_CATEGORIES as readonly string[]).indexOf(c);
    return i < 0 ? 99 : i;
  };
  return list.filter((a) => a.params.length === 0).sort((a, b) => sira(a.category) - sira(b.category));
}

export const CATEGORY_LABEL: Record<string, string> = {
  alerts: "Uyarılar",
  replay: "Tekrar",
  recording: "Kayıt",
  stream: "OBS yayını",
  outputs: "Çoklu yayın",
  scene: "Sahne",
  audio: "Ses",
  engine: "Yayın motoru",
  voice: "Sesli komut",
};

/** Kayıt defteri eyleminin parametreleri — kısayol satırındaki alanlardan (Rust `hotkeys::eylem_parametreleri`). */
export function actionParams(row: { scene?: string; input?: string; source?: string; delta?: number; target?: string }) {
  return {
    scene: row.scene || "",
    input: row.input || "",
    source: row.source || "",
    delta: Number(row.delta) || 0,
    id: row.target || "",
  };
}

/** Satırda doldurulmamış zorunlu parametre (isteğe bağlı sahne hariç); yoksa null. */
export function missingActionParam(
  spec: Pick<ActionInfo, "params">,
  row: { scene?: string; input?: string; source?: string; delta?: number; target?: string }
): string | null {
  const p = actionParams(row);
  for (const x of spec.params) {
    if (x.kind === "optionalScene") continue;
    if (x.kind === "db" ? !p.delta : !String(p[x.name as keyof typeof p] ?? "").trim()) return PARAM_LABEL[x.kind];
  }
  return null;
}

export const PARAM_LABEL: Record<ActionParamKind, string> = {
  scene: "sahne",
  optionalScene: "sahne",
  input: "ses girişi",
  source: "kaynak",
  destination: "hedef",
  db: "dB farkı",
  filter: "filtre adı",
  transition: "geçiş adı",
  text: "metin",
};

/** Destek paketi (§93): sırları ayıklanmış JSON dosyası uygulama veri klasörüne yazılır; hiçbir yere gönderilmez. */
export type SupportBundle = { yol: string; klasor: string; boyut: number; gizlenen: number; bolumler: string[] };
export const supportApi = {
  create: () => call<SupportBundle>("/api/destek/paket", { method: "POST", body: "{}" }),
};

export type ObsCanvas = {
  name: string;
  uuid: string;
  main: boolean;
  width: number;
  height: number;
  fps: number;
  mixAudio: boolean;
  ephemeral: boolean;
  provider: string | null;
  sceneSwitchSupported: boolean;
};

export type ObsInputLevel = { name: string; peakDb: number; magnitudeDb: number; channels?: { peakDb: number; magnitudeDb: number }[] };

/** OBS tuvalleri (salt-okunur; obs-websocket 5.7 / OBS 32.1+) ve ses ölçerleri. */
export const obsApi = {
  canvases: () => call<{ canvases: ObsCanvas[] }>("/api/obs/canvases").then((r) => r.canvases),
  /** Sık yoklanır: özel başlık yok → tarayıcı her istekte CORS ön denetimi göndermez. */
  meters: async (): Promise<{ inputs: ObsInputLevel[]; ageMs: number }> => {
    const r = await fetch(`${API_BASE}/api/obs/meters`, { cache: "no-store" });
    if (!r.ok) throw new ActionError((await r.text()) || `HTTP ${r.status}`, r.status);
    return r.json();
  },
};
