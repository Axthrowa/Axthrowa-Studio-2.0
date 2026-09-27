import { describe, expect, it } from "vitest";
import { canliOzeti, sayiGirdisi, sesKaynagi, sureBicimi, ustenAlta } from "./broadcast";
import type { MotorHedef } from "./api/motor";

describe("yayın çalışma alanı yardımcıları", () => {
  it("süre biçimi", () => {
    expect(sureBicimi(0)).toBe("00:00:00");
    expect(sureBicimi(61_500)).toBe("00:01:01");
    expect(sureBicimi(3_723_000)).toBe("01:02:03");
    expect(sureBicimi(-5)).toBe("00:00:00");
  });

  it("ses kaynağı ve sıra", () => {
    expect(sesKaynagi({ tur: "mikrofon" })).toBe(true);
    expect(sesKaynagi({ tur: "renk" })).toBe(false);
    const o = (kaynak: string) => ({ oge: `s/${kaynak}`, kaynak, konum: [0, 0] as [number, number], olcek: [1, 1] as [number, number], sinir: null, gorunur: true });
    expect(ustenAlta([o("arka"), o("yazi")]).map((x) => x.kaynak)).toEqual(["yazi", "arka"]);
  });

  it("canlı özeti yalnız etkin ve anahtarlı hedefleri sayar", () => {
    const h = (d: Partial<MotorHedef>): MotorHedef => ({
      id: "x", ad: "x", platform: "twitch", etkin: true, anahtarVar: true, tuval: null, iz: null, durum: "hazir", kod: null, yonlendiricideCanli: false, ...d,
    });
    expect(canliOzeti({ hedefler: [h({ durum: "canli" }), h({}), h({ anahtarVar: false, durum: "canli" }), h({ etkin: false })] })).toEqual({ canli: 1, toplam: 2 });
  });

  it("sayı girdisi", () => {
    expect(sayiGirdisi("120", 0, 1000)).toBe(120);
    expect(sayiGirdisi("12,6", 0, 1000)).toBe(13);
    expect(sayiGirdisi("", 0, 10)).toBeNull();
    expect(sayiGirdisi("abc", 0, 10)).toBeNull();
    expect(sayiGirdisi("99999", 0, 16384)).toBe(16384);
  });
});
