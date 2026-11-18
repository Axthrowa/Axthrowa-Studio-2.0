/**
 * Eylem kayıt defteri istemcisi (`/api/actions`). Kontrol Merkezi'ndeki her denetim buradan geçer: sunucu izni,
 * onayı ve denetim günlüğünü tek yerde uygular (ileride Stream Deck / uzak arayüz aynı eylemleri kullanır).
 */
import { API_BASE } from "../api";
import { olay } from "../analitik";

export type ActionParamKind =
  "scene" | "optionalScene" | "input" | "source" | "destination" | "db" | "filter" | "transition" | "text" | "percent" | "playlist" | "number";

export type ActionInfo = {
  id: string;
  label: string;
  category: string;
  perm: string;
  confirm: boolean;
  requires: "obs" | "multistream" | "axBot" | "music";
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
  // Sayısal parametreli eylemler (kaynak dönüşümü) yalnız AxBoT otomasyonundan çağrılır: Studio formlarında bu alanlar yok
  list: () => call<{ actions: ActionInfo[]; local: boolean }>("/api/actions").then((r) => r.actions.filter((a) => !a.params.some((p) => p.kind === "number"))),
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
  music: "Müzik",
};

/** Kayıt defteri eyleminin parametreleri — kısayol satırındaki alanlardan (Rust `hotkeys::eylem_parametreleri`). */
export function actionParams(row: { scene?: string; input?: string; source?: string; delta?: number; target?: string; filter?: string; transition?: string; text?: string }) {
  return {
    scene: row.scene || "",
    input: row.input || "",
    source: row.source || "",
    delta: Number(row.delta) || 0,
    id: row.target || "",
    filter: row.filter || "",
    transition: row.transition || "",
    text: row.text || "",
    percent: Number(row.delta) || 0,
    playlist: row.text || "",
  };
}

/** Satırda doldurulmamış zorunlu parametre (isteğe bağlı sahne hariç); yoksa null. */
export function missingActionParam(
  spec: Pick<ActionInfo, "params">,
  row: { scene?: string; input?: string; source?: string; delta?: number; target?: string; filter?: string; transition?: string; text?: string }
): string | null {
  const p = actionParams(row);
  for (const x of spec.params) {
    if (x.kind === "optionalScene" || x.kind === "playlist") continue;
    // Yüzde 0 (sessiz) geçerli ama boş bırakılan alan sessize almasın
    if (x.kind === "percent") {
      if (row.delta == null || !Number.isFinite(Number(row.delta))) return PARAM_LABEL.percent;
      continue;
    }
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
  percent: "yüzde (0–100)",
  playlist: "liste adı (boş = AxthrowA Yayın)",
  number: "sayı",
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
  /**
   * R7: ölçerler WebSocket'ten (OBS'in 50 ms'lik akışı, yoklama yok). `null` = OBS bağlı değil / ölçer yok.
   * Akış açılamazsa (uzaktan, Bearer'lı panel: tarayıcı WS'e başlık ekleyemez) 2 sn'de bir HTTP'ye düşer.
   */
  olcerAkisi(dinle: (r: { inputs: ObsInputLevel[]; ageMs: number } | null) => void): () => void {
    let bitti = false;
    let ws: WebSocket | null = null;
    let zaman: ReturnType<typeof setTimeout> | undefined;
    const ac = () => {
      if (bitti) return;
      let geldi = false;
      try {
        ws = new WebSocket(`${API_BASE.replace(/^http/, "ws")}/ws/obs-meters`);
      } catch {
        ws = null;
      }
      if (!ws) return void (zaman = setTimeout(ac, 2000));
      ws.onmessage = (e) => {
        geldi = true;
        try {
          const d = JSON.parse(String(e.data));
          dinle(Array.isArray(d?.inputs) ? d : null);
        } catch {
          dinle(null);
        }
      };
      ws.onclose = () => {
        if (bitti) return;
        dinle(null);
        if (!geldi) void obsApi.meters().then(dinle, () => dinle(null));
        zaman = setTimeout(ac, 2000);
      };
    };
    ac();
    return () => {
      bitti = true;
      clearTimeout(zaman);
      ws?.close();
    };
  },
};
