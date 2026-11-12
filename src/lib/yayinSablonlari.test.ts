import { describe, expect, it } from "vitest";
import { kategoriEslestir, sablonKaydet, sablonlariOku } from "./yayinSablonlari";

describe("yayın şablonları", () => {
  it("bozuk ayarı süzer, tekrarlanan adı atar", () => {
    const s = sablonlariOku([
      { ad: " Valorant ", baslik: "Rank", kategori: "VALORANT", etiketler: ["fps", "", 3] },
      { ad: "valorant", baslik: "ikinci" },
      { baslik: "adsız" },
      "bozuk",
    ]);
    expect(s).toEqual([{ ad: "Valorant", baslik: "Rank", kategori: "VALORANT", etiketler: ["fps"] }]);
    expect(sablonlariOku(null)).toEqual([]);
  });

  it("aynı adla kaydetmek günceller", () => {
    const a = { ad: "Sohbet", baslik: "a", kategori: "Just Chatting", etiketler: [] };
    const l = sablonKaydet([a], { ...a, ad: "SOHBET", baslik: "b" });
    expect(l).toHaveLength(1);
    expect(l[0].baslik).toBe("b");
    expect(sablonKaydet(l, { ...a, ad: "Oyun" })).toHaveLength(2);
  });

  it("kategoriyi önce tam adla, yoksa ilk sonuçla eşler", () => {
    const aday = [{ id: "1", ad: "Valorant Mobile" }, { id: "2", ad: "VALORANT" }];
    expect(kategoriEslestir("valorant", aday)?.id).toBe("2");
    expect(kategoriEslestir("valo", aday)?.id).toBe("1");
    expect(kategoriEslestir("", aday)).toBeNull();
    expect(kategoriEslestir("x", [])).toBeNull();
    expect(kategoriEslestir("valo", aday, false)).toBeNull();
  });
});
