import { describe, expect, it } from "vitest";
import { kayitOku } from "./ayrikPanel";

describe("ayrık panel kaydı (U9)", () => {
  it("geçerli kaydı okur, bozuk ve bilinmeyeni ayıklar", () => {
    const k = kayitOku(JSON.stringify({ sohbet: { acik: true, geo: { x: -1900, y: 40, g: 420, y2: 640 } }, mikser: { acik: true, geo: { x: 0, y: 0, g: 10, y2: 640 } }, bilinmez: { acik: true } }));
    expect(k.sohbet).toEqual({ acik: true, geo: { x: -1900, y: 40, g: 420, y2: 640 } });
    expect(k.mikser).toEqual({ acik: true, geo: undefined });
    expect(Object.keys(k)).toEqual(["sohbet", "mikser"]);
    expect(kayitOku("{bozuk")).toEqual({});
  });
});
