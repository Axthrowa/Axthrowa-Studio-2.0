import { describe, expect, it } from "vitest";
import { mergeOH } from "./panelLayout";

describe("mergeOH — sonradan eklenen sekmenin yeri", () => {
  const known = ["profile", "starting", "sounds", "hotkeys", "settings"];

  it("yeni sekme varsayılan sıradaki komşusunun arkasına girer, sona atılmaz", () => {
    const eski = { order: ["profile", "starting", "sounds", "settings"], hidden: [] };
    expect(mergeOH({ order: known, hidden: [] }, eski, known).order).toEqual([
      "profile",
      "starting",
      "sounds",
      "hotkeys",
      "settings",
    ]);
  });

  it("kullanıcının kendi sıralaması korunur", () => {
    const eski = { order: ["settings", "sounds", "starting", "profile"], hidden: [] };
    const out = mergeOH({ order: known, hidden: [] }, eski, known).order;
    expect(out.slice(0, 3)).toEqual(["settings", "sounds", "hotkeys"]);
    expect(out).toContain("profile");
  });

  it("bilinmeyen (silinmiş) kimlikler atılır, gizli liste süzülür", () => {
    const eski = { order: ["eskiTab", "profile"], hidden: ["eskiTab", "starting"] };
    const r = mergeOH({ order: known, hidden: [] }, eski, known);
    expect(r.order).not.toContain("eskiTab");
    expect(r.hidden).toEqual(["starting"]);
  });

  it("kayıtlı düzen yoksa varsayılan döner", () => {
    const base = { order: known, hidden: [] };
    expect(mergeOH(base, undefined, known)).toBe(base);
  });

  it("hiç komşusu olmayan yeni sekme başa girer", () => {
    const r = mergeOH({ order: ["a", "b"], hidden: [] }, { order: ["b"], hidden: [] }, ["a", "b"]);
    expect(r.order).toEqual(["a", "b"]);
  });
});
