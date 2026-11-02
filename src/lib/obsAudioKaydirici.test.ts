import { describe, expect, it } from "vitest";
import { sesDbdenYuzde, sesYuzdedenDb } from "./obsAudio";

describe("ses kaydırıcısı", () => {
  it("uçlar OBS sınırlarına denk gelir", () => {
    expect(sesYuzdedenDb(100)).toBe(0);
    expect(sesYuzdedenDb(0)).toBe(-100);
    expect(sesDbdenYuzde(0)).toBe(100);
    expect(sesDbdenYuzde(-100)).toBe(0);
  });

  it("gidiş dönüş aynı yüzdeyi verir", () => {
    for (const y of [1, 25, 50, 80, 99]) expect(sesDbdenYuzde(sesYuzdedenDb(y))).toBe(y);
  });
});
