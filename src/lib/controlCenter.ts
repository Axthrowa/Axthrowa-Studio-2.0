/**
 * Kontrol Merkezi çalışma alanı — yerleşim modeli (saf).
 *
 * Paneller gösterilir/gizlenir, sürükle-bırak ile sıralanır, genişlik (1–3 sütun) alır; hazır profiller ve
 * kullanıcının kaydettiği düzen `version` alanıyla saklanır (eski kayıtlar göçle açılır). Tam yuvalama
 * (bölme ağacı, ayrı pencere) sonraki adım — bkz. docs/CONTROL_CENTER_ARCHITECTURE.md §2.
 */

export type PanelId =
  | "destinations"
  | "scenes"
  | "quickActions"
  | "deck"
  | "chat"
  | "activity"
  | "preflight"
  | "alertQueue"
  | "session"
  | "audit"
  | "notes";

export type PanelMeta = { id: PanelId; title: string; hint: string };

export const PANELS: PanelMeta[] = [
  { id: "session", title: "Yayın oturumu", hint: "GO LIVE, OBS yönlendirme, alıcı durumu" },
  { id: "destinations", title: "Hedefler", hint: "Platform başına durum, başlat / durdur" },
  { id: "scenes", title: "Sahne & Ses", hint: "OBS: tek tıkla sahne geçişi, giriş susturma" },
  { id: "quickActions", title: "Hızlı eylemler", hint: "Uyarı, tekrar, kayıt, yayın — izinli ve günlüklü" },
  { id: "deck", title: "Kontrol destesi", hint: "Stream Deck benzeri düğme ızgarası — sayfalar, renkler, kendi eylemlerin" },
  { id: "chat", title: "Evrensel sohbet", hint: "Tüm platformlar tek akışta; görünümler, arama, moderasyon" },
  { id: "activity", title: "Etkinlik akışı", hint: "Takip, abone, bağış, baskın — tekilleştirilmiş" },
  { id: "preflight", title: "Yayın öncesi kontrol", hint: "Platform kuralları ve kodlayıcı uyumu" },
  { id: "alertQueue", title: "Uyarı kuyruğu", hint: "Duraklat, sustur, atla, yeniden oynat" },
  { id: "audit", title: "Denetim günlüğü", hint: "Kim, neyi, ne zaman yaptı" },
  { id: "notes", title: "Operatör notları", hint: "Bu yayına özel kısa notlar" },
];

export type PanelState = { id: PanelId; visible: boolean; span: 1 | 2 | 3 };

export type ControlLayout = { version: 1; preset: string; panels: PanelState[] };

export const LAYOUT_VERSION = 1 as const;

const ALL: PanelId[] = PANELS.map((p) => p.id);

function build(order: PanelId[], visible: PanelId[], spans: Partial<Record<PanelId, 1 | 2 | 3>> = {}): PanelState[] {
  const rest = ALL.filter((id) => !order.includes(id));
  return [...order, ...rest].map((id) => ({ id, visible: visible.includes(id), span: spans[id] ?? 1 }));
}

/** Hazır profiller (§46). */
export const PRESETS: Record<string, { label: string; panels: PanelState[] }> = {
  streamer: {
    label: "Yayıncı",
    panels: build(
      ["session", "deck", "quickActions", "scenes", "chat", "activity", "destinations", "alertQueue", "preflight", "audit", "notes"],
      ["session", "deck", "quickActions", "scenes", "chat", "activity", "destinations", "alertQueue", "preflight"],
      { destinations: 2, chat: 2 }
    ),
  },
  moderator: {
    label: "Moderatör",
    panels: build(
      ["chat", "activity", "alertQueue", "quickActions", "audit", "notes"],
      ["chat", "activity", "alertQueue", "quickActions", "audit", "notes"],
      { chat: 2 }
    ),
  },
  technical: {
    label: "Teknik",
    panels: build(
      ["destinations", "preflight", "session", "scenes", "audit"],
      ["destinations", "preflight", "session", "scenes", "audit"],
      { destinations: 2 }
    ),
  },
  minimal: {
    label: "Sade",
    panels: build(["session", "destinations"], ["session", "destinations"], { destinations: 2 }),
  },
};

export function defaultLayout(): ControlLayout {
  return { version: LAYOUT_VERSION, preset: "streamer", panels: PRESETS.streamer.panels.map((p) => ({ ...p })) };
}

/**
 * Kayıtlı düzeni doğrular / göç ettirir: bilinmeyen panel atılır, sonradan eklenen panel sona eklenir (hazır
 * profildeki düzende profilin görünürlüğüyle, özel düzende gizli), bozuk kayıt varsayılana düşer. Eski (sürümsüz) kayıt `panels` dizisiyse kabul edilir.
 */
export function parseLayout(raw: unknown): ControlLayout {
  const v = raw as { version?: number; preset?: unknown; panels?: unknown } | null;
  if (!v || typeof v !== "object" || !Array.isArray(v.panels)) return defaultLayout();
  const seen = new Set<PanelId>();
  const panels: PanelState[] = [];
  for (const p of v.panels as Array<Partial<PanelState>>) {
    const id = p?.id as PanelId;
    if (!ALL.includes(id) || seen.has(id)) continue;
    seen.add(id);
    const span = p.span === 2 || p.span === 3 ? p.span : 1;
    panels.push({ id, visible: p.visible !== false, span });
  }
  const preset = typeof v.preset === "string" ? v.preset : "custom";
  // Sonradan eklenen panel: düzen hâlâ hazır bir profildeyse (kullanıcı özelleştirmemiş) profilin kararı
  // uygulanır; özel düzende gizli olarak sona eklenir — kullanıcının yerleşimi bozulmaz.
  const profil = Object.prototype.hasOwnProperty.call(PRESETS, preset) ? PRESETS[preset].panels : null;
  for (const id of ALL) {
    if (seen.has(id)) continue;
    const p = profil?.find((x) => x.id === id);
    panels.push(p ? { ...p } : { id, visible: false, span: 1 });
  }
  return { version: LAYOUT_VERSION, preset, panels };
}

export function toggleVisible(l: ControlLayout, id: PanelId): ControlLayout {
  return { ...l, preset: "custom", panels: l.panels.map((p) => (p.id === id ? { ...p, visible: !p.visible } : p)) };
}

export function cycleSpan(l: ControlLayout, id: PanelId): ControlLayout {
  return {
    ...l,
    preset: "custom",
    panels: l.panels.map((p) => (p.id === id ? { ...p, span: (p.span === 3 ? 1 : p.span + 1) as 1 | 2 | 3 } : p)),
  };
}

/** Sürükle-bırak: `drag` paneli `drop` panelinin yerine taşınır. */
export function movePanel(l: ControlLayout, drag: PanelId, drop: PanelId): ControlLayout {
  if (drag === drop) return l;
  const from = l.panels.findIndex((p) => p.id === drag);
  const to = l.panels.findIndex((p) => p.id === drop);
  if (from < 0 || to < 0) return l;
  const next = [...l.panels];
  const [m] = next.splice(from, 1);
  next.splice(to, 0, m);
  return { ...l, preset: "custom", panels: next };
}

export function applyPreset(name: string): ControlLayout {
  const p = PRESETS[name];
  if (!p) return defaultLayout();
  return { version: LAYOUT_VERSION, preset: name, panels: p.panels.map((x) => ({ ...x })) };
}

// ─── Hedef durumu sunumu ─────────────────────────────────────────────────

export type DestState =
  | "disabled"
  | "ready"
  | "connecting"
  | "live"
  | "warning"
  | "reconnecting"
  | "failed"
  | "stopped";

export const STATE_LABEL: Record<DestState, string> = {
  disabled: "Kapalı",
  ready: "Hazır",
  connecting: "Bağlanıyor",
  live: "Canlı",
  warning: "Uyarı",
  reconnecting: "Yeniden bağlanıyor",
  failed: "Başarısız",
  stopped: "Durduruldu",
};

export const STATE_TONE: Record<DestState, "ok" | "warn" | "bad" | "idle"> = {
  disabled: "idle",
  ready: "idle",
  connecting: "warn",
  live: "ok",
  warning: "warn",
  reconnecting: "warn",
  failed: "bad",
  stopped: "idle",
};

export function isActive(s: DestState): boolean {
  return s === "connecting" || s === "live" || s === "warning" || s === "reconnecting";
}

/** Genel yayın durumu: en az bir hedef canlıysa LIVE. */
export function overallLive(states: DestState[]): "live" | "partial" | "offline" {
  const live = states.filter((s) => s === "live" || s === "warning").length;
  if (!live) return "offline";
  return states.some((s) => s === "failed" || s === "reconnecting") ? "partial" : "live";
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}
