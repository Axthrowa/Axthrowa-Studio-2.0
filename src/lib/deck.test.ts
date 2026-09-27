import { describe, expect, it } from "vitest";
import { addButton, addPage, DECK_MAX_BUTTONS, defaultDeck, moveButton, parseDeck, removeButton, removePage } from "./deck";

describe("parseDeck", () => {
  it("bozuk ya da boş kayıt varsayılan desteye düşer", () => {
    expect(parseDeck(null)).toEqual(defaultDeck());
    expect(parseDeck({ pages: "x" })).toEqual(defaultDeck());
    expect(parseDeck({ pages: [] })).toEqual(defaultDeck());
  });

  it("geçersiz düğme ve yinelenen kimlik ayıklanır; parametre ve renk süzülür", () => {
    const d = parseDeck({
      version: 1,
      pages: [
        {
          id: "ana",
          name: "Ana\u0007",
          buttons: [
            { id: "b1", label: "Oyun", actionId: "scene.switch", params: { scene: "Oyun", "__proto__": "x", SCENE: "y" }, color: "sky" },
            { id: "b1", label: "yinelenen", actionId: "alert.pause" },
            { id: "b2", actionId: "javascript:alert(1)" },
            { id: "../x", actionId: "alert.pause" },
            { id: "b3", actionId: "alert.skip", color: "red;background:url(x)" },
          ],
        },
        { id: "ana", name: "yinelenen sayfa", buttons: [] },
      ],
    });
    expect(d.pages).toHaveLength(1);
    expect(d.pages[0].name).toBe("Ana");
    expect(d.pages[0].buttons.map((b) => b.id)).toEqual(["b1", "b3"]);
    expect(d.pages[0].buttons[0].params).toEqual({ scene: "Oyun" });
    expect(d.pages[0].buttons[1]).toMatchObject({ label: "alert.skip", color: "slate" });
  });
});

describe("deste düzenleme", () => {
  it("ekle / taşı / sil ve sayfa işlemleri; sınırlar korunur", () => {
    let d = defaultDeck();
    const sayfa = d.pages[0].id;
    d = addButton(d, sayfa, { label: "Mikrofon", actionId: "audio.toggle", params: { input: "Mik" }, color: "rose" });
    const yeni = d.pages[0].buttons.at(-1)!;
    expect(yeni.actionId).toBe("audio.toggle");
    d = moveButton(d, sayfa, yeni.id, -1);
    expect(d.pages[0].buttons.at(-2)!.id).toBe(yeni.id);
    d = removeButton(d, sayfa, yeni.id);
    expect(d.pages[0].buttons.some((b) => b.id === yeni.id)).toBe(false);

    d = addPage(d, "Sahneler");
    expect(d.pages).toHaveLength(2);
    d = removePage(d, d.pages[1].id);
    expect(d.pages).toHaveLength(1);
    expect(removePage(d, d.pages[0].id).pages).toHaveLength(1); // son sayfa silinmez

    for (let i = 0; i < DECK_MAX_BUTTONS + 5; i++) d = addButton(d, sayfa, { label: "x", actionId: "alert.skip", params: {}, color: "slate" });
    expect(d.pages[0].buttons.length).toBe(DECK_MAX_BUTTONS);
  });
});
