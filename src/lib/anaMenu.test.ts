import { describe, expect, it } from "vitest";
import { ANA_MENU, OVERLAY_PENCERESI, botSekmesiBul, menuGrubuBul, sayfaAcikMi } from "./anaMenu";
import { DEFAULT_TABS } from "./panelLayout";

describe("ana menü", () => {
  it("her sekme menüde bir yerde durur", () => {
    const menudekiler = new Set(ANA_MENU.flatMap((g) => g.sayfalar.map((s) => s.nav)));
    for (const t of DEFAULT_TABS) expect(menudekiler.has(t.id)).toBe(true);
  });

  it("bot sayfası kendi başlığını bulur", () => {
    expect(menuGrubuBul("bot", "giveaways")).toBe("etkilesim");
    expect(menuGrubuBul("bot", "alerts")).toBe("sahne");
    expect(menuGrubuBul("bot", "commands")).toBe("bot");
    expect(menuGrubuBul("bot", "platforms")).toBe("bot");
    expect(menuGrubuBul("bot")).toBe("bot");
    expect(menuGrubuBul("chat")).toBe("canli");
    expect(menuGrubuBul("hotkeys")).toBe("ayarlar");
  });

  it("bot sekmesi alt sayfadan bulunur; bilinmeyen sayfa Tüm ayarlar", () => {
    expect(botSekmesiBul()).toBe("commands");
    expect(botSekmesiBul("timers")).toBe("commands");
    expect(botSekmesiBul("shield")).toBe("automod");
    expect(botSekmesiBul("platforms")).toBeNull();
  });

  it("Overlay ve Uyarılar penceresinde iki sayfa da vardır", () => {
    expect(OVERLAY_PENCERESI.map((s) => s.id)).toEqual(["overlays", "alerts", "pano", "tts"]);
  });

  it("aynı gruptaki alt sayfada menü satırı seçili kalır", () => {
    const overlay = { nav: "bot" as const, botSayfa: "overlays" };
    expect(sayfaAcikMi(overlay, "bot", "alerts")).toBe(true);
    expect(sayfaAcikMi(overlay, "bot", "commands")).toBe(false);
    expect(sayfaAcikMi({ nav: "chat" }, "chat")).toBe(true);
  });

  it("Etkileşimde üç sayfa var, yalnız açık olan seçili", () => {
    const grup = ANA_MENU.find((g) => g.id === "etkilesim")!;
    expect(grup.sayfalar.map((s) => s.botSayfa)).toEqual(["polls", "giveaways", "interaction"]);
    expect(sayfaAcikMi(grup.sayfalar[1], "bot", "giveaways")).toBe(true);
    expect(sayfaAcikMi(grup.sayfalar[0], "bot", "giveaways")).toBe(false);
  });
});
