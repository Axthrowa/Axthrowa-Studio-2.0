import { describe, expect, it } from "vitest";
import { SKIN_ACCENT_KEYS, computePlatformVars, hexToRgbTriple } from "./platformTheme";

describe("computePlatformVars", () => {
  it("platform yokken skin'in vurgusunu ezmez (hepsi null)", () => {
    // Regresyon: eskiden platform boşken bile turkuaz inline yazılıyor, inline
    // stil skin bloklarını ezdiği için hiçbir skin'in vurgusu görünmüyordu.
    const v = computePlatformVars(null);
    for (const key of SKIN_ACCENT_KEYS) {
      expect(v[key], key).toBeNull();
    }
  });

  it("Kick de skin'i ezmez: marka rengi zaten varsayılan vurguyla aynı", () => {
    const v = computePlatformVars("kick");
    for (const key of SKIN_ACCENT_KEYS) {
      expect(v[key], key).toBeNull();
    }
  });

  it("aktif platform bilgisi (BotPanel kullanıyor) her zaman dolu kalır", () => {
    for (const p of [null, "kick", "twitch"] as const) {
      const v = computePlatformVars(p);
      expect(v["--platform-color"], String(p)).toBeTruthy();
      expect(v["--platform-ink"], String(p)).toBeTruthy();
    }
  });

  it("Twitch/YouTube/Discord kullanıcının bilinçli seçimi: marka rengi yazılır", () => {
    const t = computePlatformVars("twitch");
    expect(t["--panel-accent"]).toBe("#9146FF");
    expect(t["--accent-rgb"]).toBe("145 70 255");
    expect(t["--platform-color"]).toBe("#9146FF");
    for (const key of SKIN_ACCENT_KEYS) {
      expect(t[key], key).not.toBeNull();
    }
  });

  it("açık temada metin vurgusu koyu tona (hover) düşer", () => {
    // Parlak marka rengi beyaz zeminde okunmuyor.
    const koyu = computePlatformVars("twitch", false);
    const acik = computePlatformVars("twitch", true);
    expect(koyu["--accent-text-rgb"]).toBe(hexToRgbTriple("#9146FF"));
    expect(acik["--accent-text-rgb"]).toBe(hexToRgbTriple("#7c3aed"));
    // Dolgu vurgusu açık temada da parlak kalır
    expect(acik["--accent-rgb"]).toBe(koyu["--accent-rgb"]);
  });
});

describe("hexToRgbTriple", () => {
  it("altı ve üç haneli hex'i çözer", () => {
    expect(hexToRgbTriple("#3EEDFE")).toBe("62 237 254");
    expect(hexToRgbTriple("#fff")).toBe("255 255 255");
    expect(hexToRgbTriple("9146FF")).toBe("145 70 255");
  });

  it("bozuk girdide varsayılan turkuaza düşer, patlamaz", () => {
    expect(hexToRgbTriple("bozuk")).toBe("62 237 254");
    expect(hexToRgbTriple("")).toBe("62 237 254");
  });
});
