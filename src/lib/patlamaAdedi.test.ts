import { describe, expect, it } from "vitest";
import { patlamaAdedi } from "./patlamaAdedi";

const acik = { follow: true, sub: true };

describe("patlamaAdedi", () => {
  it("takip ve abone sabit, kapalıyken yok", () => {
    expect(patlamaAdedi("follow", 0, acik)).toBe(6);
    expect(patlamaAdedi("follow", 0, { follow: false, sub: true })).toBeNull();
    expect(patlamaAdedi("sub", 0, { follow: true, sub: false })).toBeNull();
    expect(patlamaAdedi("raid", 0, acik)).toBe(8);
  });
  it("bağış karekök ile artar ve 12'de durur", () => {
    expect(patlamaAdedi("donation", "25", acik)).toBe(5);
    expect(patlamaAdedi("bits", 10000, acik)).toBe(12);
    expect(patlamaAdedi("donation", 0, acik)).toBe(4);
  });
});
