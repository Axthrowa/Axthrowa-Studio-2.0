import { describe, expect, it } from "vitest";
import {
  GENERAL_HOTKEYS,
  buildHotkeyCatalog,
  friendlyHotkeyName,
  generalHotkeyOf,
  generalRowId,
  hotkeyGroup,
  isGeneralName,
  needsContext,
  replaceSection,
  rowSection,
  setGeneralHotkey,
  splitRows,
} from "./obsHotkeyCatalog";

// Gerçek OBS 32 çıktısından kısaltılmış örnek (aynı ad çok kaynakta tekrarlanıyor).
const REAL = [
  "OBSBasic.StartStreaming",
  "OBSBasic.StopStreaming",
  "OBSBasic.SelectScene",
  "OBSBasic.SelectScene",
  "OBSBasic.QuickTransition.1",
  "libobs.mute",
  "libobs.unmute",
  "libobs.push-to-talk",
  "libobs.mute",
  "libobs.unmute",
  "libobs.push-to-talk",
  "ObsBrowser.Refresh",
  "ObsBrowser.Refresh",
  "ObsBrowser.Refresh",
  "Bilinmeyen.Kisayol",
];

describe("buildHotkeyCatalog", () => {
  const cat = buildHotkeyCatalog(REAL);
  const by = (n: string) => cat.find((c) => c.name === n)!;

  it("tekrarlı adları tek girişe indirir ve sayar", () => {
    expect(by("libobs.mute").count).toBe(2);
    expect(by("ObsBrowser.Refresh").count).toBe(3);
    expect(by("OBSBasic.StartStreaming").count).toBe(1);
    expect(cat.length).toBe(new Set(REAL).size);
  });

  it("kaynak/tarayıcı/sahne kısayolları bağlam ister, genel olanlar istemez", () => {
    expect(by("libobs.mute").needsContext).toBe(true);
    expect(by("ObsBrowser.Refresh").needsContext).toBe(true);
    expect(by("OBSBasic.SelectScene").needsContext).toBe(true);
    expect(by("OBSBasic.StartStreaming").needsContext).toBe(false);
  });

  it("bilinmeyen ad birden fazla geçiyorsa yine bağlam ister", () => {
    expect(needsContext("X.Y", 2)).toBe(true);
    expect(needsContext("X.Y", 1)).toBe(false);
  });

  it("gruplara göre sıralanır: genel, sahne, kaynak, tarayıcı, diğer", () => {
    const groups = cat.map((c) => c.group);
    const first = (g: string) => groups.indexOf(g as any);
    expect(first("general")).toBeLessThan(first("scene"));
    expect(first("scene")).toBeLessThan(first("source"));
    expect(first("source")).toBeLessThan(first("browser"));
    expect(first("browser")).toBeLessThan(first("other"));
  });
});

describe("okunur adlar", () => {
  it("genel kısayollar Türkçe etiket alır", () => {
    expect(friendlyHotkeyName("OBSBasic.StartStreaming")).toBe("Yayını başlat");
    expect(friendlyHotkeyName("libobs.push-to-mute")).toBe("Bas-sustur");
    expect(friendlyHotkeyName("OBSBasic.QuickTransition.2")).toBe("Hızlı geçiş 2");
  });
  it("sayısal kimlikli kaynak göster/gizle kısayolları okunur ve ayrı gruba girer", () => {
    expect(friendlyHotkeyName("libobs.show_scene_item.12")).toBe("Kaynağı göster (#12)");
    expect(friendlyHotkeyName("libobs.hide_scene_item.4")).toBe("Kaynağı gizle (#4)");
    expect(hotkeyGroup("libobs.show_scene_item.12")).toBe("sceneItem");
    expect(hotkeyGroup("libobs.mute")).toBe("source");
    expect(isGeneralName("libobs.hide_scene_item.4")).toBe(true);
    expect(isGeneralName("libobs.mute")).toBe(false);
  });
  it("bilinmeyen ad olduğu gibi döner", () => {
    expect(friendlyHotkeyName("Eklenti.Ozel")).toBe("Eklenti.Ozel");
  });
  it("her genel kısayolun benzersiz adı ve etiketi var", () => {
    expect(new Set(GENERAL_HOTKEYS.map((g) => g.name)).size).toBe(GENERAL_HOTKEYS.length);
    for (const g of GENERAL_HOTKEYS) {
      expect(g.label.length).toBeGreaterThan(3);
      expect(hotkeyGroup(g.name)).toBe("general");
    }
  });
});

describe("satır bölümleri", () => {
  const rows = [
    { id: "a", kind: "srcToggle", source: "Kamera" },
    { id: "gen:OBSBasic.StartStreaming", kind: "obsHotkey", name: "OBSBasic.StartStreaming" },
    { id: "hk:1", kind: "obsHotkey", name: "libobs.mute", source: "Mic/Aux" },
    { id: "v", kind: "volume", input: "Müzik" },
  ];
  it("her satır doğru bölüme girer", () => {
    expect(rows.map(rowSection)).toEqual(["source", "general", "obsHotkey", "action"]);
    const s = splitRows(rows);
    expect(s.source.length).toBe(1);
    expect(s.general.length).toBe(1);
    expect(s.obsHotkey.length).toBe(1);
    expect(s.action.length).toBe(1);
  });
  it("bir bölümü değiştirmek diğer bölümlere dokunmaz", () => {
    const out = replaceSection(rows, "action", [{ id: "v", kind: "volume", input: "Yeni" }]);
    expect(out.find((r) => r.id === "v")?.input).toBe("Yeni");
    expect(out.filter((r) => r.kind === "srcToggle").length).toBe(1);
    expect(out.length).toBe(rows.length);
  });
  it("bölümden satır silmek yalnız onu siler", () => {
    const out = replaceSection(rows, "source", []);
    expect(out.map((r) => r.id).sort()).toEqual(["gen:OBSBasic.StartStreaming", "hk:1", "v"]);
  });
});

describe("genel kısayol atama", () => {
  it("tuş atanınca satır oluşur, sabit kimlikle", () => {
    const out = setGeneralHotkey([], "OBSBasic.StartRecording", "Ctrl+F9");
    expect(out).toEqual([
      { id: generalRowId("OBSBasic.StartRecording"), kind: "obsHotkey", name: "OBSBasic.StartRecording", label: "Kaydı başlat", hotkey: "Ctrl+F9" },
    ]);
    expect(generalHotkeyOf(out, "OBSBasic.StartRecording")).toBe("Ctrl+F9");
  });
  it("aynı kısayola tekrar atamak çoğaltmaz, değiştirir", () => {
    let out = setGeneralHotkey([], "OBSBasic.Screenshot", "F8");
    out = setGeneralHotkey(out, "OBSBasic.Screenshot", "F9");
    expect(out.length).toBe(1);
    expect(out[0].hotkey).toBe("F9");
  });
  it("tuş temizlenince satır silinir, başkasına dokunulmaz", () => {
    let out = setGeneralHotkey([{ id: "x", kind: "volume" }], "OBSBasic.Screenshot", "F8");
    out = setGeneralHotkey(out, "OBSBasic.Screenshot", "  ");
    expect(out).toEqual([{ id: "x", kind: "volume" }]);
    expect(generalHotkeyOf(out, "OBSBasic.Screenshot")).toBe("");
  });
});
