import { describe, expect, it } from "vitest";
import { klipBitisi, twitchSuresi, vodBul } from "./twitchWrite";

describe("Twitch VOD klibi (Y1)", () => {
  it("süre biçimi", () => {
    expect(twitchSuresi("1h2m3s")).toBe(3723);
    expect(twitchSuresi("45m")).toBe(2700);
    expect(twitchSuresi("bozuk")).toBe(0);
  });
  it("işareti içeren VOD ve ofset", () => {
    const vodlar = [
      { id: "yeni", created_at: "2026-11-13T20:00:00Z", duration: "2h0m0s" },
      { id: "eski", created_at: "2026-11-12T20:00:00Z", duration: "1h0m0s" },
    ];
    expect(vodBul(vodlar, Date.parse("2026-11-13T20:10:00Z"))).toEqual({ vodId: "yeni", ofsetSn: 600 });
    expect(vodBul(vodlar, Date.parse("2026-11-12T20:30:00Z"))).toEqual({ vodId: "eski", ofsetSn: 1800 });
    expect(vodBul(vodlar, Date.parse("2026-11-12T22:00:00Z"))).toBeNull();
  });
  it("klip bitişi süreden küçük olmaz", () => {
    expect(klipBitisi(600, -20, 30)).toBe(610);
    expect(klipBitisi(3, -10, 30)).toBe(30);
  });
});
