import { describe, expect, it } from "vitest";
import { BOS, dolanlar, kalanMetin, sureMs } from "./cikisZamanlayicisi";

describe("çıkış zamanlayıcısı", () => {
  it("süre ve kalan metin", () => {
    expect(sureMs(1, 30, 0)).toBe(5_400_000);
    expect(sureMs(0, 0, 0)).toBeNull();
    expect(sureMs(25, 0, 0)).toBeNull();
    expect(kalanMetin(10_000 + 3_725_000, 10_000)).toBe("01:02:05");
    expect(kalanMetin(0, 5_000)).toBe("00:00:00");
  });

  it("süresi dolan çıktı durdurulur; zaten kapalıysa yalnız zamanlayıcı düşer", () => {
    const z = { yayinBitis: 1000, kayitBitis: 5000 };
    expect(dolanlar(z, 999, true, true)).toEqual({ durdur: [], kalan: z });
    expect(dolanlar(z, 1000, true, true)).toEqual({ durdur: ["yayin"], kalan: { yayinBitis: null, kayitBitis: 5000 } });
    expect(dolanlar(z, 6000, false, true)).toEqual({ durdur: ["kayit"], kalan: BOS });
  });
});
