import { describe, expect, it } from "vitest";
import { bolgeyiSinirla } from "./KlipDuzenleyici";

describe("dikey klip kırpma bölgesi (Y2)", () => {
  it("karenin içinde ve en az %5 boyda kalır", () => {
    expect(bolgeyiSinirla({ x: 0.9, y: -0.2, w: 0.3, h: 0.5 })).toEqual({ x: 0.7, y: 0, w: 0.3, h: 0.5 });
    expect(bolgeyiSinirla({ x: 0.5, y: 0.5, w: 0.01, h: 2 })).toEqual({ x: 0.5, y: 0, w: 0.05, h: 1 });
  });
});
