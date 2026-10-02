import { describe, expect, it } from "vitest";
import { yayinSagligi } from "./yayinSagligi";

const c = (x: Partial<{ tur: string; etkin: boolean; kare: number; dusen_kare: number; durum: string }>) => ({ tur: "rtmp", etkin: true, kare: 1000, dusen_kare: 0, durum: "canli", ...x });

describe("yayın sağlığı", () => {
  it("yayın yoksa gösterilmez", () => {
    expect(yayinSagligi([])).toBeNull();
    expect(yayinSagligi([c({ tur: "kayit" })])).toBeNull();
    expect(yayinSagligi([c({ etkin: false, durum: "durduruldu" })])).toBeNull();
  });
  it("eşikler", () => {
    expect(yayinSagligi([c({})])).toBe("yesil");
    expect(yayinSagligi([c({ dusen_kare: 20 })])).toBe("sari");
    expect(yayinSagligi([c({ dusen_kare: 60 })])).toBe("kirmizi");
    expect(yayinSagligi([c({}), c({ durum: "yeniden_baglaniyor", etkin: false })])).toBe("sari");
    expect(yayinSagligi([c({}), c({ durum: "basarisiz", etkin: false })])).toBe("kirmizi");
  });
});
