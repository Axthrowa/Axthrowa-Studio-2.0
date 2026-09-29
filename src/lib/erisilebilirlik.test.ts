import { describe, expect, it } from "vitest";
import { HAZIRLAR, temizle, VARSAYILAN_RENKLER } from "./erisilebilirlik";

describe("erişilebilirlik renkleri", () => {
  it("geçersiz ya da eksik alanlar varsayılana döner", () => {
    expect(temizle(null)).toEqual(VARSAYILAN_RENKLER);
    expect(temizle({ secim: "red", normal: "#ABCDEF", uyari: "#12345", hata: 5 })).toEqual({ ...VARSAYILAN_RENKLER, normal: "#abcdef" });
    expect(temizle({ secim: "url(javascript:x)" }).secim).toBe(VARSAYILAN_RENKLER.secim);
  });
  it("hazırların hepsi geçerli renk", () => {
    for (const h of HAZIRLAR) expect(temizle(h.renkler)).toEqual(h.renkler);
  });
});
