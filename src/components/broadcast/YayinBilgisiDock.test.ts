import { describe, expect, it } from "vitest";
import { etiketleriAyir } from "./YayinBilgisiDock";

describe("yayın bilgisi", () => {
  it("etiketler virgülle ayrılır, boşlar atılır, en çok 10", () => {
    expect(etiketleriAyir(" türkçe, fps ,, sohbet ")).toEqual(["türkçe", "fps", "sohbet"]);
    expect(etiketleriAyir(Array.from({ length: 12 }, (_, i) => `e${i}`).join(","))).toHaveLength(10);
    expect(etiketleriAyir("  ")).toEqual([]);
  });
});
