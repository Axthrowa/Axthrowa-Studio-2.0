/**
 * Satır başına kısayol — OBS Kontrol kartındaki her kaynak ve her ses girişi için.
 *
 * Kaynak (sahne öğesi) → `obs.actionHotkeys[]` içinde `srcToggle` satırı
 * Ses girişi (mixer)   → `obs.sourceMuteHotkeys[]` içinde `{input, hotkey}` satırı
 *
 * İkisi de zaten kısayol planında (`hotkeyPlan.ts`) ve Rust'ta çalışıyor; bu
 * dosya yalnızca "bu kaynağın satırını bul / ata / temizle" mantığıdır. Tuş
 * temizlenince satır silinir, böylece listede boş satır birikmez.
 */

import type { HotkeyRow } from "./obsHotkeyCatalog";

export type MuteRow = { id: string; input?: string; hotkey?: string };

const norm = (s: unknown) => String(s ?? "").trim().toLocaleLowerCase("tr");

/** Bu sahnedeki bu kaynağın kısayol satırı (sahne adı boşsa "yayındaki sahne" sayılır). */
export function findSrcToggle(rows: HotkeyRow[], scene: string, source: string): HotkeyRow | undefined {
  return rows.find(
    (r) => r.kind === "srcToggle" && norm(r.source) === norm(source) && norm(r.scene) === norm(scene)
  );
}

export function upsertSrcToggle(
  rows: HotkeyRow[],
  scene: string,
  source: string,
  hotkey: string,
  newId: string
): HotkeyRow[] {
  const cur = findSrcToggle(rows, scene, source);
  const key = hotkey.trim();
  if (!key) return cur ? rows.filter((r) => r !== cur) : rows;
  if (cur) return rows.map((r) => (r === cur ? { ...r, hotkey: key } : r));
  return [...rows, { id: newId, kind: "srcToggle", scene, source, mode: "toggle", hotkey: key }];
}

/** Kısayolun işlemini (tersle / göster / gizle) değiştirir. */
export function setSrcToggleMode(rows: HotkeyRow[], id: string, mode: string): HotkeyRow[] {
  return rows.map((r) => (r.id === id ? { ...r, mode } : r));
}

export function findMute(list: MuteRow[], input: string): MuteRow | undefined {
  return list.find((r) => norm(r.input) === norm(input));
}

export function upsertMute(list: MuteRow[], input: string, hotkey: string, newId: string): MuteRow[] {
  const cur = findMute(list, input);
  const key = hotkey.trim();
  if (!key) return cur ? list.filter((r) => r !== cur) : list;
  if (cur) return list.map((r) => (r === cur ? { ...r, hotkey: key } : r));
  return [...list, { id: newId, input, hotkey: key }];
}

/** Bir sahne + kaynak için eylem kısayolunun plandaki bağlama kimliği (`act:<id>`). */
export function srcToggleBindingId(row: HotkeyRow | undefined): string {
  return row ? `act:${row.id}` : "";
}

/** Bir ses girişi kısayolunun plandaki bağlama kimliği (`srcMute:<id>`). */
export function muteBindingId(row: MuteRow | undefined): string {
  return row ? `srcMute:${row.id}` : "";
}
