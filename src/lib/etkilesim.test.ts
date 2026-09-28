import { describe, expect, it } from "vitest";
import { dugmeAdi, kaynakNoktasi, tusOlayi } from "./etkilesim";

describe("etkileşim", () => {
  it("işaretçi kaynak pikseline çevrilir (sığdırma boşlukları ve kenar sınırı)", () => {
    // 960×540 kaynak, 480×400 kutuda: ölçek 0,5; üst/alt 65 px boşluk
    const kutu = { left: 10, top: 20, width: 480, height: 400 };
    expect(kaynakNoktasi(10, 85, kutu, [960, 540])).toEqual([0, 0]);
    expect(kaynakNoktasi(250, 220, kutu, [960, 540])).toEqual([480, 270]);
    expect(kaynakNoktasi(9999, -50, kutu, [960, 540])).toEqual([959, 0]);
  });

  it("fare düğmeleri", () => {
    expect([dugmeAdi(0), dugmeAdi(1), dugmeAdi(2), dugmeAdi(3)]).toEqual(["sol", "orta", "sag", null]);
  });

  it("tuş olayı: basılabilir karakter metin olur, bırakmada metin gitmez, Ctrl kısayolunda metin yok", () => {
    const g = { key: "g", keyCode: 71, shiftKey: false, ctrlKey: false, altKey: false };
    expect(tusOlayi(g, false)).toEqual({ tur: "tus", metin: "g", vkey: 71, birak: false, shift: false, ctrl: false, alt: false });
    expect(tusOlayi(g, true).metin).toBe("");
    expect(tusOlayi({ ...g, ctrlKey: true }, false).metin).toBe("");
    expect(tusOlayi({ key: "Enter", keyCode: 13, shiftKey: false, ctrlKey: false, altKey: false }, false).metin).toBe("\r");
    expect(tusOlayi({ key: "ArrowLeft", keyCode: 37, shiftKey: true, ctrlKey: false, altKey: false }, false)).toMatchObject({ metin: "", vkey: 37, shift: true });
  });
});
