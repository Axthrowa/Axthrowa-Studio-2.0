import { describe, expect, it } from "vitest";
import { anMetni, egriNoktalari } from "./YayinRaporu";

describe("egriNoktalari", () => {
  it("zamanı ve en yüksek izleyiciyi kutuya sığdırır", () => {
    expect(egriNoktalari([[0, 0], [50, 10], [100, 5]], 100, 10)).toBe("0,10 50,0 100,5");
    expect(egriNoktalari([[7, 4]], 100, 10)).toBe("0,0 100,0");
    expect(egriNoktalari([], 100, 10)).toBe("");
  });
});

describe("anMetni (U6)", () => {
  it("yayındaki anı saat:dakika:saniye yazar", () => {
    expect(anMetni(65_000)).toBe("1:05");
    expect(anMetni(3_723_000)).toBe("1:02:03");
    expect(anMetni(null)).toBeNull();
  });
});
