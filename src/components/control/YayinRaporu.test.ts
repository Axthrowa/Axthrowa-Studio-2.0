import { describe, expect, it } from "vitest";
import { egriNoktalari } from "./YayinRaporu";

describe("egriNoktalari", () => {
  it("zamanı ve en yüksek izleyiciyi kutuya sığdırır", () => {
    expect(egriNoktalari([[0, 0], [50, 10], [100, 5]], 100, 10)).toBe("0,10 50,0 100,5");
    expect(egriNoktalari([[7, 4]], 100, 10)).toBe("0,0 100,0");
    expect(egriNoktalari([], 100, 10)).toBe("");
  });
});
