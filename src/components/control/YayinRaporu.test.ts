import { describe, expect, it } from "vitest";
import { anMetni, egriNoktalari, yayinSarkilari } from "./YayinRaporu";

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

describe("yayinSarkilari", () => {
  it("başlangıcı 10 dk içinde en yakın özetin şarkıları; yoksa boş", () => {
    const a = [{ zaman: 1, ad: "A" }];
    const b = [{ zaman: 2, ad: "B" }];
    const ozetler = [{ baslangic: 1_000_000, sarkilar: a }, { baslangic: 1_200_000, sarkilar: b }];
    expect(yayinSarkilari(ozetler, 1_150_000)).toBe(b);
    expect(yayinSarkilari(ozetler, 5_000_000)).toEqual([]);
    expect(yayinSarkilari([{ baslangic: 0 }], 0)).toEqual([]);
  });
});
