import { describe, expect, it } from "vitest";
import { destedenKisayol, kisayolSatiriEkle } from "./nesneMenusu";
import { menuTusuMu } from "../components/axthrowa/SagTikMenusu";
import { addToFirstFree, DECK_MAX_BUTTONS, defaultDeck, duplicateButton, nextColor, updateButton, type DeckConfig } from "./deck";

describe("nesne menüleri (A7)", () => {
  it("Menü tuşu ve Shift+F10 menüyü açar; Ctrl/Alt ile birlikte açmaz", () => {
    expect(menuTusuMu({ key: "ContextMenu", shiftKey: false })).toBe(true);
    expect(menuTusuMu({ key: "F10", shiftKey: true })).toBe(true);
    expect(menuTusuMu({ key: "F10", shiftKey: false })).toBe(false);
    expect(menuTusuMu({ key: "F10", shiftKey: true, ctrlKey: true })).toBe(false);
  });

  it("Kısayol ata: aynı eylem ve parametreye ikinci satır açılmaz", () => {
    const istek = { name: "scene.switch", label: "Sahne: Oyun", scene: "Oyun" };
    const a = kisayolSatiriEkle([], istek, "k1");
    expect(a.yeni).toBe(true);
    expect(a.satirlar).toEqual([{ id: "k1", kind: "action", hotkey: "", ...istek }]);
    const b = kisayolSatiriEkle(a.satirlar, istek, "k2");
    expect(b.yeni).toBe(false);
    expect(b.satirlar).toBe(a.satirlar);
    expect(kisayolSatiriEkle(a.satirlar, { ...istek, scene: "Mola" }, "k3").yeni).toBe(true);
  });

  it("deste düğmesinin parametreleri kısayol satırına taşınır", () => {
    expect(destedenKisayol({ actionId: "audio.volume", label: "Mik -3", params: { input: "Mik", delta: "-3" } })).toEqual({ name: "audio.volume", label: "Mik -3", input: "Mik", delta: -3 });
    expect(destedenKisayol({ actionId: "multistream.toggle", label: "YT", params: { id: "yt" } })).toEqual({ name: "multistream.toggle", label: "YT", target: "yt" });
  });

  it("deste: kopya hemen arkaya, renk sırayla döner, dolu sayfa atlanır", () => {
    const d = defaultDeck();
    const sayfa = d.pages[0];
    const ilk = sayfa.buttons[0];
    const kopya = duplicateButton(d, sayfa.id, ilk.id).pages[0].buttons;
    expect(kopya).toHaveLength(sayfa.buttons.length + 1);
    expect(kopya[1]).toMatchObject({ label: ilk.label, actionId: ilk.actionId });
    expect(kopya[1].id).not.toBe(ilk.id);
    expect(updateButton(d, sayfa.id, ilk.id, { color: nextColor(ilk.color) }).pages[0].buttons[0].color).toBe(nextColor(ilk.color));
    expect(nextColor("violet")).toBe("slate");

    const dolu: DeckConfig = { ...d, pages: [{ ...sayfa, buttons: Array.from({ length: DECK_MAX_BUTTONS }, (_, i) => ({ ...ilk, id: `b${i}` })) }, { id: "p2", name: "İkinci", buttons: [] }] };
    const r = addToFirstFree(dolu, { label: "Oyun", actionId: "scene.switch", params: { scene: "Oyun" }, color: "sky" });
    expect(r?.page).toBe("İkinci");
    expect(r?.deck.pages[1].buttons).toHaveLength(1);
    expect(addToFirstFree({ ...dolu, pages: [dolu.pages[0]] }, { label: "x", actionId: "a", params: {}, color: "sky" })).toBeNull();
  });
});
