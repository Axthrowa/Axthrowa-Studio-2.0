/**
 * Sağ tık menülerinin (A7) bileşenler arası istekleri: "Kısayol ata" Kısayollar sayfasında satır açar,
 * "Desteye ekle" kontrol destesine düğme ekler. İstek olay olarak gider; sayfa ya da deste açık değilse
 * de çalışır (ayar dosyası güncellenir).
 */
import type { DeckButton } from "./deck";
import type { HotkeyRow } from "./obsHotkeyCatalog";

export const KISAYOL_OLAYI = "axt:kisayol-ata";
export const DESTE_OLAYI = "axt:deste-yenile";

/** Eylem kayıt defterindeki bir eylemi tuşa bağlayan satır (`kind: "action"`) */
export type KisayolIstegi = { name: string; label: string; scene?: string; input?: string; source?: string; delta?: number; target?: string };

export const KISAYOL_YOK = "Kısayol ataması ana pencerede: Kısayollar sayfasından yapılır";

/** Ana panel isteği karşıladıysa true; OBS dock gibi Kısayollar sayfası olmayan pencerede false */
export function kisayolAta(i: KisayolIstegi): boolean {
  return !window.dispatchEvent(new CustomEvent<KisayolIstegi>(KISAYOL_OLAYI, { detail: i, cancelable: true }));
}

/** Deste düğmesinin eylemi ve parametreleri kısayol satırına */
export function destedenKisayol(b: Pick<DeckButton, "actionId" | "label" | "params">): KisayolIstegi {
  const p = b.params || {};
  const delta = Number(p.delta);
  return {
    name: b.actionId,
    label: b.label,
    ...(p.scene ? { scene: p.scene } : {}),
    ...(p.input ? { input: p.input } : {}),
    ...(p.source ? { source: p.source } : {}),
    ...(Number.isFinite(delta) && delta ? { delta } : {}),
    ...(p.id ? { target: p.id } : {}),
  };
}

/** Aynı eylem ve parametrelerle satır zaten varsa onu döndürür; yoksa tuşu boş yeni satır ekler */
export function kisayolSatiriEkle(satirlar: HotkeyRow[], i: KisayolIstegi, id: string): { satirlar: HotkeyRow[]; satir: HotkeyRow; yeni: boolean } {
  const ayni = (r: HotkeyRow & { delta?: number; target?: string }) =>
    r.kind === "action" && r.name === i.name && (r.scene || "") === (i.scene || "") && (r.input || "") === (i.input || "") && (r.source || "") === (i.source || "") && (Number(r.delta) || 0) === (i.delta || 0) && (r.target || "") === (i.target || "");
  const var_ = satirlar.find(ayni);
  if (var_) return { satirlar, satir: var_, yeni: false };
  const satir = { id, kind: "action", hotkey: "", ...i } as HotkeyRow;
  return { satirlar: [...satirlar, satir], satir, yeni: true };
}
