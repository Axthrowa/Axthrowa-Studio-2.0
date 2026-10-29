import { describe, expect, it } from "vitest";
import { botKickYazabilir } from "./ConnectionsHub";

describe("botKickYazabilir", () => {
  it("bağlı değilse yazamaz", () => {
    expect(botKickYazabilir(undefined)).toBe(false);
    expect(botKickYazabilir({ connected: false, yazabilir: true })).toBe(false);
  });
  it("yeni bot (1.9+): yazabilir alanı belirler", () => {
    expect(botKickYazabilir({ connected: true, yazabilir: true })).toBe(true);
    expect(botKickYazabilir({ connected: true, yazabilir: false })).toBe(false);
  });
  it("eski bot (1.8): alan yoksa bağlı olması yeter", () => {
    expect(botKickYazabilir({ connected: true })).toBe(true);
  });
});
