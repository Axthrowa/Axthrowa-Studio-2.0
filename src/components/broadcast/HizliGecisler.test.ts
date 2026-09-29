import { describe, expect, it } from "vitest";
import { hizliEtiket } from "./HizliGecisler";

describe("hızlı geçiş etiketi", () => {
  const gecisler = [
    { id: "kes", ad: "Kes", tur: "cut_transition", yerlesik: true },
    { id: "g1", ad: "Kaydır", tur: "slide_transition", yerlesik: false },
  ];
  it("süreli geçişte süre, kesmede yalnız ad", () => {
    expect(hizliEtiket({ id: "h1", gecis: "g1", sure_ms: 500 }, gecisler)).toBe("Kaydır 500 ms");
    expect(hizliEtiket({ id: "h2", gecis: "kes", sure_ms: 0 }, gecisler)).toBe("Kes");
  });
  it("silinmiş geçişte kimlik gösterilir", () => {
    expect(hizliEtiket({ id: "h3", gecis: "g9", sure_ms: 300 }, gecisler)).toBe("g9 300 ms");
  });
});
