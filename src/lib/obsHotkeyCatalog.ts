/**
 * OBS'in kendi "Ayarlar → Kısayollar" sekmesine karşılık gelen katalog.
 *
 * OBS'te kısayollar üç gruba ayrılır ve WebSocket `GetHotkeyList` bunların
 * adlarını döndürür (canlı listeden doğrulandı, OBS 32 / WS 5.7):
 *  - `OBSBasic.*`   Genel: yayın, kayıt, tekrar arabelleği, sanal kamera,
 *                   ekran görüntüsü, geçiş, `SelectScene` (sahne başına)
 *  - `libobs.*`     Kaynaklar: `mute`, `unmute`, `push-to-mute`, `push-to-talk`
 *                   — HER ses kaynağı için aynı isimle tekrarlanır
 *  - `ObsBrowser.*` Tarayıcı kaynağı: `Refresh` (kaynak başına)
 *
 * Aynı ad birçok kaynakta bulunduğu için `TriggerHotkeyByName` bir **bağlam
 * adı** (kaynak/sahne adı) ister; kısayol satırında `source` alanında saklanır.
 */

export type HotkeyRow = {
  id: string;
  kind?: string;
  hotkey?: string;
  label?: string;
  name?: string;
  source?: string;
  scene?: string;
  input?: string;
  mode?: string;
};

/** Sık kullanılan genel kısayollar — OBS'te aramadan tek listede. */
export const GENERAL_HOTKEYS: { name: string; label: string }[] = [
  { name: "OBSBasic.StartStreaming", label: "Yayını başlat" },
  { name: "OBSBasic.StopStreaming", label: "Yayını durdur" },
  { name: "OBSBasic.StartRecording", label: "Kaydı başlat" },
  { name: "OBSBasic.StopRecording", label: "Kaydı durdur" },
  { name: "OBSBasic.PauseRecording", label: "Kaydı duraklat" },
  { name: "OBSBasic.UnpauseRecording", label: "Kayda devam et" },
  { name: "OBSBasic.SplitFile", label: "Kayıt dosyasını böl" },
  { name: "OBSBasic.AddChapterMarker", label: "Bölüm işareti ekle" },
  { name: "OBSBasic.StartReplayBuffer", label: "Tekrar arabelleğini başlat" },
  { name: "OBSBasic.StopReplayBuffer", label: "Tekrar arabelleğini durdur" },
  { name: "OBSBasic.StartVirtualCam", label: "Sanal kamerayı başlat" },
  { name: "OBSBasic.StopVirtualCam", label: "Sanal kamerayı durdur" },
  { name: "OBSBasic.Screenshot", label: "Ekran görüntüsü al" },
  { name: "OBSBasic.Transition", label: "Geçiş yap (Transition)" },
];

const GENERAL_NAMES = new Set(GENERAL_HOTKEYS.map((g) => g.name));

/** Genel satırın sabit kimliği: aynı kısayol iki kez eklenemez. */
export function generalRowId(name: string): string {
  return `gen:${name}`;
}

const FRIENDLY: Record<string, string> = {
  "libobs.mute": "Sessize al",
  "libobs.unmute": "Sesi aç",
  "libobs.push-to-mute": "Bas-sustur",
  "libobs.push-to-talk": "Bas-konuş",
  "ObsBrowser.Refresh": "Tarayıcı kaynağını yenile",
  "OBSBasic.SelectScene": "Sahneyi seç",
  "OBSBasic.SelectedSourceScreenshot": "Seçili kaynağın ekran görüntüsü",
  "OBSBasic.ResetStats": "İstatistikleri sıfırla",
  "OBSBasic.ForceStopStreaming": "Yayını zorla durdur",
  "OBSBasic.EnablePreview": "Önizlemeyi aç",
  "OBSBasic.DisablePreview": "Önizlemeyi kapat",
  "OBSBasic.EnablePreviewProgram": "Stüdyo modunu aç",
  "OBSBasic.DisablePreviewProgram": "Stüdyo modunu kapat",
  "OBSBasic.ShowContextBar": "Bağlam çubuğunu göster",
  "OBSBasic.HideContextBar": "Bağlam çubuğunu gizle",
};

/** OBS adının okunur karşılığı (bilinmiyorsa adın kendisi). */
export function friendlyHotkeyName(name: string): string {
  const g = GENERAL_HOTKEYS.find((x) => x.name === name);
  if (g) return g.label;
  if (FRIENDLY[name]) return FRIENDLY[name];
  const si = /^libobs\.(show|hide)_scene_item\.(\d+)$/.exec(name);
  if (si) return `Kaynağı ${si[1] === "show" ? "göster" : "gizle"} (#${si[2]})`;
  const q = /^OBSBasic\.QuickTransition\.(\d+)$/.exec(name);
  if (q) return `Hızlı geçiş ${q[1]}`;
  return name;
}

export type HotkeyGroup = "general" | "source" | "browser" | "scene" | "sceneItem" | "other";

/** Bir kısayol adının hangi gruba girdiği (arayüzde başlıklandırma için). */
export function hotkeyGroup(name: string): HotkeyGroup {
  if (/^libobs\.(show|hide)_scene_item\.\d+$/.test(name)) return "sceneItem";
  if (name === "OBSBasic.SelectScene") return "scene";
  if (name.startsWith("OBSBasic.")) return "general";
  if (name.startsWith("libobs.")) return "source";
  if (name.startsWith("ObsBrowser.")) return "browser";
  return "other";
}

export const GROUP_LABEL: Record<HotkeyGroup, string> = {
  general: "Genel",
  scene: "Sahne",
  source: "Ses kaynağı",
  sceneItem: "Kaynak görünürlüğü (OBS kimliğiyle)",
  browser: "Tarayıcı kaynağı",
  other: "Diğer",
};

/** Bağlam adı gerektiren gruplar: kaynak (ses/tarayıcı) ve sahne. */
export function needsContext(name: string, occurrences: number): boolean {
  const g = hotkeyGroup(name);
  return g === "source" || g === "browser" || g === "scene" || occurrences > 1;
}

export type CatalogEntry = { name: string; count: number; group: HotkeyGroup; label: string; needsContext: boolean };

/** `GetHotkeyList` çıktısını (tekrarlı adlar) benzersiz, gruplu ve sayılı listeye çevirir. */
export function buildHotkeyCatalog(names: string[]): CatalogEntry[] {
  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) || 0) + 1);
  const order: HotkeyGroup[] = ["general", "scene", "source", "browser", "sceneItem", "other"];
  return [...counts.entries()]
    .map(([name, count]) => ({
      name,
      count,
      group: hotkeyGroup(name),
      label: friendlyHotkeyName(name),
      needsContext: needsContext(name, count),
    }))
    .sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || a.label.localeCompare(b.label, "tr"));
}

/**
 * "Gelişmiş" listede gösterilmeyen adlar: genel katalogdakiler (kendi bölümleri var)
 * ve OBS'in sayısal kimlikli kaynak göster/gizle kısayolları (adla çalışan
 * "Kaynak görünürlüğü" bölümü aynı işi daha anlaşılır yapıyor).
 */
export function isGeneralName(name: string): boolean {
  return GENERAL_NAMES.has(name) || hotkeyGroup(name) === "sceneItem";
}

/* --------------------------------------------------------- satır ayrıştırma */

/** Özel bölümleri olan satır türleri: genel "Eylemler" listesinde gösterilmez. */
export type RowSection = "source" | "general" | "obsHotkey" | "action";

export function rowSection(r: HotkeyRow): RowSection {
  if (r.kind === "srcToggle") return "source";
  if (r.kind === "obsHotkey") return String(r.id).startsWith("gen:") ? "general" : "obsHotkey";
  return "action";
}

export function splitRows(rows: HotkeyRow[]): Record<RowSection, HotkeyRow[]> {
  const out: Record<RowSection, HotkeyRow[]> = { source: [], general: [], obsHotkey: [], action: [] };
  for (const r of rows) out[rowSection(r)].push(r);
  return out;
}

/** Bir bölümün düzenlenmiş satırlarını diğer bölümlerle birleştirir (sıra korunur). */
export function replaceSection(all: HotkeyRow[], section: RowSection, next: HotkeyRow[]): HotkeyRow[] {
  const others = all.filter((r) => rowSection(r) !== section);
  return [...others, ...next];
}

/** Genel bir kısayolun tuşunu atar/temizler; tuş boşsa satır silinir. */
export function setGeneralHotkey(all: HotkeyRow[], name: string, hotkey: string): HotkeyRow[] {
  const id = generalRowId(name);
  const rest = all.filter((r) => r.id !== id);
  const key = hotkey.trim();
  if (!key) return rest;
  return [...rest, { id, kind: "obsHotkey", name, label: friendlyHotkeyName(name), hotkey: key }];
}

export function generalHotkeyOf(all: HotkeyRow[], name: string): string {
  return all.find((r) => r.id === generalRowId(name))?.hotkey || "";
}
