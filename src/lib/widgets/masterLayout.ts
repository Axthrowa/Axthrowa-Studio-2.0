/** Master Overlay — evrensel konum / boyut / z-index yardımcıları. */

export type MasterWidgetRow = {
  id: string;
  kind: string;
  name?: string;
  enabled?: number | boolean;
  sort_order?: number;
  config?: Record<string, unknown>;
  config_json?: string;
};

export function parseWidgetConfig(w: MasterWidgetRow): Record<string, unknown> {
  if (w.config && typeof w.config === "object") return { ...w.config };
  if (w.config_json) {
    try {
      const j = JSON.parse(w.config_json);
      if (j && typeof j === "object") return j as Record<string, unknown>;
    } catch {
      /* ignore */
    }
  }
  return {};
}

/** DB `enabled` + config.enabled — ikisi de false ise kapalı. */
export function isWidgetMasterEnabled(w: MasterWidgetRow, config?: Record<string, unknown>): boolean {
  const cfg = config || parseWidgetConfig(w);
  const dbOn = w.enabled === true || w.enabled === 1 || w.enabled == null;
  const cfgOn = cfg.enabled === undefined ? true : Boolean(cfg.enabled);
  return dbOn && cfgOn;
}

export function readMasterLayout(config: Record<string, unknown>): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const x = Number(config.position_x ?? config.posX ?? 0);
  const y = Number(config.position_y ?? config.posY ?? 0);
  const w = Number(config.width ?? 480);
  const h = Number(config.height ?? 320);
  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    w: Number.isFinite(w) && w > 0 ? w : 480,
    h: Number.isFinite(h) && h > 0 ? h : 320,
  };
}

export type MasterLayoutPatch = {
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  posX: number;
  posY: number;
};

/** Sahne editörü — konum + boyut + ölçek */
export type MasterScenePatch = MasterLayoutPatch & {
  scale?: number;
};

export type ClampLayoutOpts = {
  /** Önizleme: sahne dışına serbest konumlandırma */
  freePosition?: boolean;
  /** Önizleme: genişlik/yükseklik sahne ile sınırlanmaz */
  freeSize?: boolean;
  stageW?: number;
  stageH?: number;
};

export function clampMasterLayout(
  x: number,
  y: number,
  w: number,
  h: number,
  stageW = 1920,
  stageH = 1080,
  opts?: ClampLayoutOpts
): MasterLayoutPatch {
  const sw = opts?.stageW ?? stageW;
  const sh = opts?.stageH ?? stageH;
  const width = Math.round(
    opts?.freeSize ? Math.max(80, w) : Math.min(sw, Math.max(80, w))
  );
  const height = Math.round(
    opts?.freeSize ? Math.max(60, h) : Math.min(sh, Math.max(60, h))
  );

  let position_x: number;
  let position_y: number;
  if (opts?.freePosition) {
    position_x = Math.round(x);
    position_y = Math.round(y);
  } else {
    position_x = Math.round(Math.min(sw - width, Math.max(0, x)));
    position_y = Math.round(Math.min(sh - height, Math.max(0, y)));
  }

  return {
    position_x,
    position_y,
    width,
    height,
    posX: position_x,
    posY: position_y,
  };
}

/** WidgetStage içinde çift kaymayı önlemek için transform sıfırlanır. */
export function configForMasterInner(config: Record<string, unknown>): Record<string, unknown> {
  return {
    ...config,
    posX: 0,
    posY: 0,
    position_x: 0,
    position_y: 0,
    scale: 1,
    rotateDeg: 0,
  };
}

