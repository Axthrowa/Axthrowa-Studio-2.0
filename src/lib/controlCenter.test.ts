import { describe, expect, it } from "vitest";
import {
  applyPreset,
  cycleSpan,
  defaultLayout,
  movePanel,
  overallLive,
  parseLayout,
  PANELS,
  PRESETS,
  toggleVisible,
  formatBytes,
} from "./controlCenter";

describe("Kontrol Merkezi yerleşimi", () => {
  it("varsayılan düzen tüm panelleri bir kez içerir", () => {
    const l = defaultLayout();
    expect(l.panels.map((p) => p.id).sort()).toEqual(PANELS.map((p) => p.id).sort());
  });

  it("her hazır profil tüm panelleri tam bir kez içerir", () => {
    for (const [ad, p] of Object.entries(PRESETS)) {
      const ids = p.panels.map((x) => x.id);
      expect(new Set(ids).size, ad).toBe(PANELS.length);
    }
  });

  it("bozuk / eski kayıtlar güvenle açılır", () => {
    expect(parseLayout(null).preset).toBe("streamer");
    expect(parseLayout({ panels: "x" }).preset).toBe("streamer");
    const l = parseLayout({ panels: [{ id: "audit", visible: true, span: 9 }, { id: "yok-boyle" }, { id: "audit" }] });
    expect(l.panels[0]).toEqual({ id: "audit", visible: true, span: 1 });
    // Kayıtta olmayan (sonradan eklenen) paneller gizli olarak sona eklenir
    expect(l.panels.length).toBe(PANELS.length);
    expect(l.panels.filter((p) => p.visible).length).toBe(1);
    expect(l.version).toBe(1);
  });

  it("göster/gizle, genişlik döngüsü ve sürükle-bırak özel düzene geçirir", () => {
    let l = applyPreset("minimal");
    l = toggleVisible(l, "audit");
    expect(l.panels.find((p) => p.id === "audit")?.visible).toBe(true);
    expect(l.preset).toBe("custom");
    l = cycleSpan(l, "audit");
    l = cycleSpan(l, "audit");
    l = cycleSpan(l, "audit");
    expect(l.panels.find((p) => p.id === "audit")?.span).toBe(1);
    const once = l.panels.map((p) => p.id);
    l = movePanel(l, once[3], once[0]);
    expect(l.panels[0].id).toBe(once[3]);
    expect(movePanel(l, "audit", "audit")).toBe(l);
  });
});

describe("hedef durumu özeti", () => {
  it("en az bir hedef canlıysa LIVE; hata varsa kısmi", () => {
    expect(overallLive([])).toBe("offline");
    expect(overallLive(["ready", "stopped"])).toBe("offline");
    expect(overallLive(["live", "ready"])).toBe("live");
    expect(overallLive(["live", "failed"])).toBe("partial");
    expect(overallLive(["warning", "reconnecting"])).toBe("partial");
  });

  it("bayt biçimi", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

describe("Sahne & Ses paneli", () => {
  it("yayıncı ve teknik düzende görünür; önceden kaydedilmiş düzene gizli olarak eklenir", () => {
    expect(PRESETS.streamer.panels.find((p) => p.id === "scenes")?.visible).toBe(true);
    expect(PRESETS.technical.panels.find((p) => p.id === "scenes")?.visible).toBe(true);
    // Bu panel eklenmeden önce kaydedilmiş düzen: kullanıcının yerleşimi bozulmaz
    const eski = {
      version: 1,
      preset: "custom",
      panels: [
        { id: "destinations", visible: true, span: 2 },
        { id: "session", visible: true, span: 1 },
      ],
    };
    const l = parseLayout(eski);
    expect(l.panels.slice(0, 2).map((p) => p.id)).toEqual(["destinations", "session"]);
    expect(l.panels.find((p) => p.id === "scenes")).toMatchObject({ visible: false });
  });
});

describe("Kontrol destesi paneli", () => {
  it("hazır profildeki eski düzene profilin görünürlüğüyle eklenir; özel düzende gizli kalır", () => {
    const panelsiz = (preset: string) => ({
      version: 1,
      preset,
      panels: PRESETS.streamer.panels.filter((p) => p.id !== "deck"),
    });
    expect(parseLayout(panelsiz("streamer")).panels.find((p) => p.id === "deck")).toMatchObject({ visible: true });
    expect(parseLayout(panelsiz("custom")).panels.find((p) => p.id === "deck")).toMatchObject({ visible: false });
    // Profil adı nesne prototipinden gelemez
    expect(parseLayout(panelsiz("constructor")).panels.find((p) => p.id === "deck")).toMatchObject({ visible: false });
  });
});
