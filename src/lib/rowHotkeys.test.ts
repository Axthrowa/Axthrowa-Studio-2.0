import { describe, expect, it } from "vitest";
import {
  findMute,
  findSrcToggle,
  muteBindingId,
  setSrcToggleMode,
  srcToggleBindingId,
  upsertMute,
  upsertSrcToggle,
} from "./rowHotkeys";
import { buildHotkeyPlan } from "./hotkeyPlan";
import type { HotkeyRow } from "./obsHotkeyCatalog";

describe("kaynak görünürlüğü satırı", () => {
  it("tuş atanınca yeni srcToggle satırı oluşur (tersle kipiyle)", () => {
    const out = upsertSrcToggle([], "Oyun ekranı", "Kamera", "F9", "id1");
    expect(out).toEqual([
      { id: "id1", kind: "srcToggle", scene: "Oyun ekranı", source: "Kamera", mode: "toggle", hotkey: "F9" },
    ]);
  });

  it("aynı sahne+kaynağa tekrar atamak çoğaltmaz, tuşu değiştirir ve kipi korur", () => {
    let rows = upsertSrcToggle([], "Oyun", "Kamera", "F9", "id1");
    rows = setSrcToggleMode(rows, "id1", "hide");
    rows = upsertSrcToggle(rows, "Oyun", "Kamera", "F10", "id2");
    expect(rows.length).toBe(1);
    expect(rows[0]).toMatchObject({ id: "id1", hotkey: "F10", mode: "hide" });
  });

  it("aynı kaynak başka sahnede ayrı satırdır", () => {
    let rows = upsertSrcToggle([], "A", "Kamera", "F1", "x");
    rows = upsertSrcToggle(rows, "B", "Kamera", "F2", "y");
    expect(rows.length).toBe(2);
    expect(findSrcToggle(rows, "B", "Kamera")?.hotkey).toBe("F2");
  });

  it("ad eşleşmesi büyük/küçük harf ve boşluk duyarsız", () => {
    const rows = upsertSrcToggle([], "Oyun", "Kamera", "F9", "x");
    expect(findSrcToggle(rows, " oyun ", "KAMERA")).toBeDefined();
  });

  it("tuş temizlenince satır silinir, başka satırlara dokunulmaz", () => {
    let rows: HotkeyRow[] = [{ id: "v", kind: "volume", input: "Müzik", hotkey: "F5" }];
    rows = upsertSrcToggle(rows, "Oyun", "Kamera", "F9", "x");
    rows = upsertSrcToggle(rows, "Oyun", "Kamera", "  ", "y");
    expect(rows).toEqual([{ id: "v", kind: "volume", input: "Müzik", hotkey: "F5" }]);
  });

  it("olmayan satırı temizlemek hiçbir şey değiştirmez", () => {
    const rows = [{ id: "v", kind: "volume" }];
    expect(upsertSrcToggle(rows, "A", "B", "", "z")).toBe(rows);
  });
});

describe("ses girişi (mixer) satırı", () => {
  it("atama, değiştirme ve temizleme", () => {
    let list = upsertMute([], "Mic/Aux", "Ctrl+M", "m1");
    expect(list).toEqual([{ id: "m1", input: "Mic/Aux", hotkey: "Ctrl+M" }]);
    list = upsertMute(list, "mic/aux", "Ctrl+N", "m2");
    expect(list.length).toBe(1);
    expect(list[0]).toMatchObject({ id: "m1", hotkey: "Ctrl+N" });
    list = upsertMute(list, "Mic/Aux", "", "m3");
    expect(list).toEqual([]);
    expect(findMute(list, "Mic/Aux")).toBeUndefined();
  });
});

describe("bağlama kimlikleri ve plan", () => {
  it("kimlikler planın kullandığıyla aynı biçimde", () => {
    expect(srcToggleBindingId({ id: "abc", kind: "srcToggle" })).toBe("act:abc");
    expect(muteBindingId({ id: "m1" })).toBe("srcMute:m1");
    expect(srcToggleBindingId(undefined)).toBe("");
  });

  it("üretilen satırlar hotkeyPlan'a girer ve doğru kimliği alır", () => {
    const actionHotkeys = upsertSrcToggle([], "Oyun", "Kamera", "F9", "sv1");
    const sourceMuteHotkeys = upsertMute([], "Mic/Aux", "F8", "mu1");
    const plan = buildHotkeyPlan({ obs: { actionHotkeys, sourceMuteHotkeys } });
    const ids = plan.bindings.map((b) => b.id);
    expect(ids).toContain("act:sv1");
    expect(ids).toContain("srcMute:mu1");
    const act = plan.bindings.find((b) => b.id === "act:sv1")!;
    expect(act.kind).toBe("srcToggle");
    expect(act.source).toBe("Kamera");
    expect(act.scene).toBe("Oyun");
    expect(act.mode).toBe("toggle");
    expect(plan.bindings.find((b) => b.id === "srcMute:mu1")?.input).toBe("Mic/Aux");
  });
});
