import { describe, expect, it } from "vitest";
import { saglikSatiri } from "./saglikSatiri";

describe("saglikSatiri", () => {
  it("OBS yoksa tek cümle", () => {
    expect(saglikSatiri({ obs: false, yayin: false, dropPct: 0, clip: false })).toBe("OBS bağlı değil");
  });
  it("kare düşüşü ve kırpılma aynı satırda", () => {
    expect(saglikSatiri({ obs: true, yayin: true, dropPct: 3.2, clip: true })).toBe("kare düşüşü %3.2 · ses kırpmaya yakın");
    expect(saglikSatiri({ obs: true, yayin: false, dropPct: 0, clip: false })).toBe("yayın kapalı · ses normal");
  });
});
